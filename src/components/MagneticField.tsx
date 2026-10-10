import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LocationPin } from '../config';
import type { FieldSettings } from './FieldDebugPanel';

type Pole = { x: number; y: number; sign: number };
type Particle = { x: number; y: number; vx: number; vy: number; age: number; life: number };

// Smooth noise and tangential inverse-square forces, adapted from sound-field.html.
function noise(x: number, y: number) {
  const hash = (a: number, b: number) => {
    const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const ix = Math.floor(x), iy = Math.floor(y);
  const sx = x - ix, sy = y - iy;
  const u = sx * sx * (3 - 2 * sx), v = sy * sy * (3 - 2 * sy);
  const a = hash(ix, iy), b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export default function MagneticField({ pins, enabled, userPos, settings }: {
  pins: LocationPin[];
  enabled: boolean;
  userPos: [number, number] | null;
  settings: FieldSettings;
}) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const previous = container.style.background;
    container.style.background = settings.background;
    return () => { container.style.background = previous; };
  }, [map, settings.background]);
  const userPosition = useRef(userPos);
  const config = useRef(settings);
  const refresh = useRef<(() => void) | null>(null);
  useEffect(() => { config.current = settings; refresh.current?.(); }, [settings]);
  useEffect(() => { userPosition.current = userPos; }, [userPos]);

  useEffect(() => {
    if (!enabled) return;
    const pane = map.getPane('magneticField') ?? map.createPane('magneticField');
    pane.style.zIndex = '450';
    pane.style.pointerEvents = 'none';
    const canvas = L.DomUtil.create('canvas', '', pane);
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }

    let width = 0, height = 0;
    let poles: Pole[] = [];
    let particles: Particle[] = [];
    let frame = 0, previous = 0, time = 0;
    let zooming = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const spawn = (particle: Particle, initial = false) => {
      // Keep the entire viewport populated, including areas far from a marker.
      particle.x = Math.random() * width;
      particle.y = Math.random() * height;
      particle.vx = (Math.random() - 0.5) * 0.4;
      particle.vy = (Math.random() - 0.5) * 0.4;
      particle.life = config.current.lifetime * (1 + Math.random() * 0.5);
      particle.age = initial ? Math.random() * particle.life : 0;
    };

    const project = () => {
      poles = pins.map((pin, index) => {
        const point = map.latLngToContainerPoint([pin.lat, pin.lng]);
        return { x: point.x, y: point.y, sign: index % 2 ? -1 : 1 };
      });
    };

    const reset = () => {
      const size = map.getSize();
      width = size.x; height = size.y;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
      project();
      const count = particleCount();
      particles = Array.from({ length: count }, () => {
        const p = { x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0 };
        spawn(p, true);
        return p;
      });
    };

    const draw = (step: number) => {
      const cfg = config.current;
      const count = particleCount();
      if (particles.length > count) particles.length = count;
      while (particles.length < count) {
        const p = { x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0 };
        spawn(p, true);
        particles.push(p);
      }
      // GPS updates move this pole without restarting the particle simulation.
      const position = userPosition.current;
      const userPoint = position ? map.latLngToContainerPoint(position) : null;
      const fieldPoles = userPoint
        ? [...poles, { x: userPoint.x, y: userPoint.y, sign: -1 }]
        : poles;
      // Fade to transparency so the map remains visible beneath the trails.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${1 - Math.pow(1 - cfg.trailFade, step)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = cfg.strokeWidth;
      ctx.lineCap = 'round';
      for (const p of particles) {
        let fx = 0, fy = 0;
        for (const pole of fieldPoles) {
          const dx = p.x - pole.x, dy = p.y - pole.y;
          const square = dx * dx + dy * dy + 400;
          const strength = pole.sign * cfg.fieldStrength * 12000 / (square * Math.sqrt(square));
          fx -= dy * strength;
          fy += dx * strength;
        }
        fx += (noise(p.x * 0.004 + time, p.y * 0.003) * 2 - 1) * cfg.turbulence * 0.12;
        fy += (noise(p.x * 0.003 - time * 0.7, p.y * 0.004 + 0.5) * 2 - 1) * cfg.turbulence * 0.12;
        const magnitude = Math.hypot(fx, fy) || 1;
        const damping = Math.pow(cfg.damping, step);
        const acceleration = cfg.flowSpeed * 0.14 * cfg.damping * (1 - damping) / (1 - cfg.damping);
        p.vx = p.vx * damping + fx / magnitude * acceleration;
        p.vy = p.vy * damping + fy / magnitude * acceleration;
        const velocity = Math.hypot(p.vx, p.vy);
        if (velocity > 3.5) { p.vx *= 3.5 / velocity; p.vy *= 3.5 / velocity; }
        p.x += p.vx * step; p.y += p.vy * step; p.age += step;
        if (p.age >= p.life) {
          spawn(p);
          continue;
        }
        if (p.x < -6) p.x = width + 6;
        if (p.x > width + 6) p.x = -6;
        if (p.y < -6) p.y = height + 6;
        if (p.y > height + 6) p.y = -6;
        const speed = Math.hypot(p.vx, p.vy) || 1;
        const fade = Math.max(0, Math.min(1, p.age / 25, (p.life - p.age) / 50));
        ctx.globalAlpha = cfg.opacity * fade;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx / speed * cfg.length / 2, p.y - p.vy / speed * cfg.length / 2);
        ctx.lineTo(p.x + p.vx / speed * cfg.length / 2, p.y + p.vy / speed * cfg.length / 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      frame = 0;
      if (document.hidden || zooming || reducedMotion.matches) return;
      if (!previous || now - previous >= 1000 / 30) {
        const step = previous ? Math.min((now - previous) / (1000 / 60), 3) : 1;
        previous = now;
        time += step * 0.003;
        draw(step);
      }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      if (reducedMotion.matches) draw(1);
      else if (!document.hidden && !zooming) frame = requestAnimationFrame(tick);
    };
    const move = () => { reset(); if (reducedMotion.matches) draw(1); };
    const zoomStart = () => { zooming = true; canvas.style.visibility = 'hidden'; };
    const zoomEnd = () => { zooming = false; canvas.style.visibility = ''; reset(); start(); };
    function particleCount() {
      return Math.min(20000, Math.round(Math.min(8000, Math.max(1200, width * height / 250)) * config.current.density));
    }
    refresh.current = () => { ctx.clearRect(0, 0, width, height); draw(1); };
    reset();
    start();
    map.on('move resize', move);
    map.on('zoomstart', zoomStart);
    map.on('zoomend', zoomEnd);
    document.addEventListener('visibilitychange', start);
    reducedMotion.addEventListener('change', start);
    return () => {
      refresh.current = null;
      cancelAnimationFrame(frame);
      map.off('move resize', move);
      map.off('zoomstart', zoomStart);
      map.off('zoomend', zoomEnd);
      document.removeEventListener('visibilitychange', start);
      reducedMotion.removeEventListener('change', start);
      canvas.remove();
    };
  }, [map, pins, enabled]);

  return null;
}
