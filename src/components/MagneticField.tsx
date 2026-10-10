import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LocationPin } from '../config';
import type { FieldSettings } from './FieldDebugPanel';
import type { PlaybackEnergy } from './usePlaybackField';

type Pole = { x: number; y: number; sign: number };
type Particle = { x: number; y: number; vx: number; vy: number; age: number; life: number; ox: number; oy: number; ovx: number; ovy: number };

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

export default function MagneticField({ pins, enabled, userPos, settings, sampleAudio }: {
  pins: LocationPin[];
  enabled: boolean;
  userPos: [number, number] | null;
  settings: FieldSettings;
  sampleAudio: () => PlaybackEnergy;
}) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const previous = container.style.background;
    container.style.background = settings.background;
    return () => { container.style.background = previous; };
  }, [map, settings.background]);
  const userPosition = useRef(userPos);
  const playback = useRef(sampleAudio);
  useEffect(() => { playback.current = sampleAudio; }, [sampleAudio]);
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
    // Beyond the largest audio displacement (32px) and half-stroke length.
    const margin = 96;
    let anchor = map.getCenter();
    let anchorPoint = map.latLngToContainerPoint(anchor);
    const wrap = (value: number, size: number) => ((value + margin) % (size + margin * 2) + size + margin * 2) % (size + margin * 2) - margin;
    let poles: Pole[] = [];
    let particles: Particle[] = [];
    let frame = 0, previous = 0, time = 0;
    let zooming = false;
    let audioLevel = 0, audioPhase = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const spawn = (particle: Particle, initial = false) => {
      // Keep the entire viewport populated, including areas far from a marker.
      particle.x = Math.random() * (width + margin * 2) - margin;
      particle.y = Math.random() * (height + margin * 2) - margin;
      particle.vx = (Math.random() - 0.5) * 0.4;
      particle.vy = (Math.random() - 0.5) * 0.4;
      particle.life = config.current.lifetime * (1 + Math.random() * 0.5);
      particle.ox = particle.oy = particle.ovx = particle.ovy = 0;
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
      anchor = map.getCenter();
      anchorPoint = map.latLngToContainerPoint(anchor);
      const count = particleCount();
      particles = Array.from({ length: count }, () => {
        const p = { x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, ox: 0, oy: 0, ovx: 0, ovy: 0 };
        spawn(p, true);
        return p;
      });
    };

    const draw = (step: number) => {
      const cfg = config.current;
      const baseColour = [1, 3, 5].map(start => parseInt(cfg.color.slice(start, start + 2), 16));
      // Cache a small ramp once per frame instead of allocating colours per particle.
      const stops = [[20, 184, 166], [59, 130, 246], [168, 85, 247]];
      const colourRamp = Array.from({ length: 32 }, (_, index) => {
        const amount = index / 31;
        const position = amount * (stops.length - 1);
        const lower = Math.min(stops.length - 2, Math.floor(position));
        const fraction = position - lower;
        const blend = Math.min(1, amount * 2.5);
        const rgb = baseColour.map((channel, i) => Math.round(channel * (1 - blend)
          + (stops[lower][i] * (1 - fraction) + stops[lower + 1][i] * fraction) * blend));
        return `rgb(${rgb.join(',')})`;
      });
      const energy = playback.current();
      const smoothing = 1 - Math.pow(0.88, step);
      const loudness = Math.min(1, Math.sqrt(energy.level) * 1.4);
      audioLevel += (loudness - audioLevel) * smoothing;
      audioPhase += step * 0.055;
      const count = particleCount();
      if (particles.length > count) particles.length = count;
      while (particles.length < count) {
        const p = { x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, ox: 0, oy: 0, ovx: 0, ovy: 0 };
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
        const directionX = fx / magnitude;
        const directionY = fy / magnitude;
        const damping = Math.pow(cfg.damping, step);
        const acceleration = cfg.flowSpeed * 0.14 * cfg.damping * (1 - damping) / (1 - cfg.damping);
        const audioBoost = 1;
        p.vx = p.vx * damping + directionX * acceleration * audioBoost;
        p.vy = p.vy * damping + directionY * acceleration * audioBoost;
        const velocity = Math.hypot(p.vx, p.vy);
        if (velocity > 3.5) { p.vx *= 3.5 / velocity; p.vy *= 3.5 / velocity; }
        p.x += p.vx * step; p.y += p.vy * step; p.age += step;
        if (p.age >= p.life) {
          spawn(p);
          continue;
        }
        p.x = wrap(p.x, width);
        p.y = wrap(p.y, height);
        // Audio displacement is separate from the underlying magnetic trajectory.
        // Distributed expansion/contraction gives pressure-like motion everywhere.
        const force = audioLevel * (22 + energy.bass * 10);
        const targetX = Math.sin(p.x * 0.022 + audioPhase) * Math.cos(p.y * 0.013 - audioPhase * 0.7) * force;
        const targetY = Math.sin(p.y * 0.022 - audioPhase * 0.9) * Math.cos(p.x * 0.013 + audioPhase * 0.6) * force;
        const oldX = p.ox, oldY = p.oy;
        // Substeps keep the damped spring stable across frame rates.
        for (let remaining = step; remaining > 0;) {
          const dt = Math.min(1, remaining);
          p.ovx = (p.ovx + (targetX - p.ox) * 0.075 * dt) * Math.pow(0.78, dt);
          p.ovy = (p.ovy + (targetY - p.oy) * 0.075 * dt) * Math.pow(0.78, dt);
          p.ox += p.ovx * dt; p.oy += p.ovy * dt;
          remaining -= dt;
        }
        const displacement = Math.hypot(p.ox, p.oy);
        if (displacement > 32) {
          p.ox *= 32 / displacement; p.oy *= 32 / displacement;
          p.ovx *= 0.5; p.ovy *= 0.5;
        }
        const dx = p.vx + (p.ox - oldX) / step;
        const dy = p.vy + (p.oy - oldY) / step;
        const speed = Math.hypot(dx, dy) || 1;
        // Clip naturally at the canvas edge; recycling happens in the offscreen buffer.
        const x = p.x + p.ox;
        const y = p.y + p.oy;
        if (x < -32 || x > width + 32 || y < -32 || y > height + 32) continue;
        const fade = Math.max(0, Math.min(1, p.age / 25, (p.life - p.age) / 50));
        ctx.globalAlpha = Math.min(1, cfg.opacity * (1 + audioLevel * 0.35)) * fade;
        const reaction = Math.min(1, audioLevel * (0.35 + 0.65 * Math.min(1, displacement / 24)));
        ctx.strokeStyle = colourRamp[Math.round(reaction * 31)];
        const length = cfg.length * (1 + audioLevel * 0.25);
        ctx.beginPath();
        ctx.moveTo(x - dx / speed * length / 2, y - dy / speed * length / 2);
        ctx.lineTo(x + dx / speed * length / 2, y + dy / speed * length / 2);
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
    const move = () => {
      if (zooming) return;
      const nextAnchor = map.latLngToContainerPoint(anchor);
      const delta = nextAnchor.subtract(anchorPoint);
      anchorPoint = nextAnchor;
      // Translate existing trajectories with the map rather than reseeding them.
      for (const particle of particles) {
        particle.x = wrap(particle.x + delta.x, width);
        particle.y = wrap(particle.y + delta.y, height);
      }
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
      project();
      // Old trails belong to the previous view; clear without losing particle state.
      ctx.clearRect(0, 0, width, height);
      draw(0.001);
    };
    const resize = () => { reset(); if (reducedMotion.matches) draw(1); };
    const zoomStart = () => { zooming = true; canvas.style.visibility = 'hidden'; };
    const zoomEnd = () => { zooming = false; canvas.style.visibility = ''; reset(); start(); };
    function particleCount() {
      const bufferRatio = (width + margin * 2) * (height + margin * 2) / Math.max(1, width * height);
      return Math.min(20000, Math.round(Math.min(8000, Math.max(1200, width * height / 250)) * config.current.density * bufferRatio));
    }
    refresh.current = () => { ctx.clearRect(0, 0, width, height); draw(1); };
    reset();
    start();
    map.on('move', move);
    map.on('resize', resize);
    map.on('zoomstart', zoomStart);
    map.on('zoomend', zoomEnd);
    document.addEventListener('visibilitychange', start);
    reducedMotion.addEventListener('change', start);
    return () => {
      refresh.current = null;
      cancelAnimationFrame(frame);
      map.off('move', move);
      map.off('resize', resize);
      map.off('zoomstart', zoomStart);
      map.off('zoomend', zoomEnd);
      document.removeEventListener('visibilitychange', start);
      reducedMotion.removeEventListener('change', start);
      canvas.remove();
    };
  }, [map, pins, enabled]);

  return null;
}
