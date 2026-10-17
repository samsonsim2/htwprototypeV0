import { useEffect, useRef, useState } from 'react';
import logoUrl from '../assets/logo/Logo.svg';
import type { FieldSettings } from './FieldDebugPanel';

// Sample the actual SVG silhouette so the particles begin inside the logo.
function OpeningParticles({ settings, reduced }: { settings: FieldSettings; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frame = 0;
    let disposed = false;
    const image = new Image();
    image.src = logoUrl;
    image.onload = () => {
      if (disposed) return;
      const sample = document.createElement('canvas');
      sample.width = 72; sample.height = 87;
      const source = sample.getContext('2d')!;
      source.drawImage(image, 0, 0, 72, 87);
      const data = source.getImageData(0, 0, 72, 87).data;
      const dots: { x: number; y: number; angle: number; distance: number }[] = [];
      for (let y = 0; y < 87; y += 2) for (let x = 0; x < 72; x += 2) {
        if (data[(y * 72 + x) * 4 + 3] > 100) dots.push({ x: x - 36, y: y - 43.5, angle: Math.random() * Math.PI * 2, distance: 100 + Math.random() * 450 });
      }
      const start = performance.now();
      const draw = (now: number) => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const seconds = (now - start) / 1000;
        const spread = reduced ? 1 : Math.min(1, Math.max(0, (seconds - 1.15) / 2.1));
        if (!reduced && spread < 1 && seconds >= 1.15) {
          ctx.strokeStyle = settings.color;
          ctx.lineWidth = settings.strokeWidth;
          ctx.lineCap = 'round';
          ctx.globalAlpha = (1 - spread) * 0.8;
          dots.forEach(p => {
            const angle = p.angle + spread * 1.8;
            const x = w / 2 + p.x + Math.cos(angle) * p.distance * spread;
            const y = h / 2 + p.y + Math.sin(angle) * p.distance * spread;
            const tangent = angle + Math.PI / 3;
            const length = settings.length * (0.4 + spread * 0.6);
            ctx.beginPath();
            ctx.moveTo(x - Math.cos(tangent) * length / 2, y - Math.sin(tangent) * length / 2);
            ctx.lineTo(x + Math.cos(tangent) * length / 2, y + Math.sin(tangent) * length / 2);
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
        }
        if (!reduced && spread < 1) frame = requestAnimationFrame(draw);
      };
      draw(start);
    };
    return () => { disposed = true; cancelAnimationFrame(frame); image.onload = null; };
  }, [settings, reduced]);
  return <canvas className="opening-particles" ref={ref} aria-hidden="true" />;
}

// Each phrase keeps its place in reading order, but appears on its own random schedule.
function Reveal({ children }: { children: string }) {
  const [timing] = useState(() => ({ animationDelay: Math.random() * 650 + 'ms', animationDuration: 650 + Math.random() * 450 + 'ms' }));
  return <span className="reveal-chunk" style={timing}>{children}</span>;
}

export default function JourneyOpening({ settings, onContinue }: { settings: FieldSettings; onContinue: () => void }) {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [ready, setReady] = useState(reduced);
  const [stage, setStage] = useState<'intro' | 'begin' | 'instructions'>('intro');
  const [leaving, setLeaving] = useState(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const beginRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), reduced ? 0 : 3400);
    return () => window.clearTimeout(timer);
  }, [reduced]);
  useEffect(() => {
    if (stage === 'instructions') continueRef.current?.focus();
    if (stage === 'begin') beginRef.current?.focus();
  }, [stage]);
  const advance = () => {
    if (!ready || leaving) return;
    if (stage === 'intro') setStage('begin');
    else if (stage === 'instructions') { setLeaving(true); onContinue(); }
  };
  return (
    <div className={`journey-opening stage-${stage}${ready ? ' is-ready' : ''}${leaving ? ' is-leaving' : ''}`} onClick={advance}>
      <div className="opening-veil" aria-hidden="true" style={{ backgroundColor: settings.background }} />
      <OpeningParticles settings={settings} reduced={reduced} />
      {!reduced && <img className="opening-logo" src={logoUrl} alt="From Ulu" />}
      {ready && <div className="opening-copy" aria-hidden={stage !== 'intro'}>
        <header><h1><Reveal>FROM ULU</Reveal></h1><p><Reveal>Reclaiming archives</Reveal><br /><Reveal>of a living city</Reveal></p></header>
        <p className="opening-note"><Reveal>This index remains provisional,</Reveal><br /><Reveal>subject to expansion and</Reveal><br /><Reveal>reorganization as fieldwork</Reveal><br /><Reveal>continues and analytical</Reveal><br /><Reveal>patterns emerge from</Reveal><br /><Reveal>accumulated documentation.</Reveal></p>
      </div>}
      {ready && stage === 'intro' && <button type="button" className="journey-continue intro-continue" onClick={event => { event.stopPropagation(); advance(); }}>Tap anywhere to continue...</button>}
      {stage === 'begin' && <button ref={beginRef} type="button" className="journey-begin" onClick={event => { event.stopPropagation(); setStage('instructions'); }}>begin journey</button>}
      {stage === 'instructions' && <div className="journey-instructions" role="dialog" aria-modal="true" aria-labelledby="instruction-title">
        <h2 id="instruction-title"><Reveal>Before</Reveal><br /><Reveal>we begin...</Reveal></h2>
        <div className="instruction-copy"><p><Reveal>If you are on a</Reveal><br /><Reveal>double-decker bus,</Reveal><br /><Reveal>head to the upper deck.</Reveal></p><p><Reveal>Take a seat right</Reveal><br /><Reveal>at the front.</Reveal></p><p><Reveal>The view is part</Reveal><br /><Reveal>of the journey.</Reveal></p></div>
        <button ref={continueRef} type="button" className="journey-continue" onClick={event => { event.stopPropagation(); advance(); }}>Tap anywhere to continue...</button>
      </div>}
    </div>
  );
}
