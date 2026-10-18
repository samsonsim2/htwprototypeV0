import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Hand, Pause, Play } from 'lucide-react';
import MapSubtitles from './MapSubtitles';
import type { HandCameraLaunch } from './ar/handCamera';
import { bindARExitControls } from './ar/exitControls';
import { coverPoint, handSide, StableHandSide, type Point, type HandSide } from './ar/handPose';
import { drawHandEffect } from './ar/handEffects';

type Props = {
  launch: HandCameraLaunch; trackId: string; audioUrl: string;
  audioRef: RefObject<HTMLAudioElement | null>; playing: boolean;
  onToggleAudio: () => void; onClose: () => void; onRetry: () => void;
};

export default function HandARExperience(props: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(props.onClose); close.current = props.onClose;
  const [status, setStatus] = useState('Opening the camera…');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    let stopped = false, worker: Worker | undefined, raf = 0, readyTimer = 0;
    let busy = false, initialized = false, lastFrame = -1, lastSent = 0, lastSeen = -1000;
    let points: Point[] = [], side: HandSide | null = null, effectSince = 0;
    const stability = new StableHandSide();
    const unbind = bindARExitControls(props.launch.overlayRoot, closeButton.current!, () => close.current());
    closeButton.current?.focus();
    const fail = (message: string) => {
      if (stopped) return;
      initialized = false; worker?.terminate(); cancelAnimationFrame(raf); clearTimeout(readyTimer);
      points = []; const ctx = canvas.current?.getContext('2d');
      if (ctx && canvas.current) ctx.clearRect(0, 0, canvas.current.width, canvas.current.height);
      video.current?.srcObject && (video.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      setError(message); setTracked(false);
    };
    const boot = window.setTimeout(async () => {
      try {
        const stream = await props.launch.stream;
        if (stopped) return;
        const player = video.current!, surface = canvas.current!, ctx = surface.getContext('2d');
        if (!ctx) throw new Error('This browser cannot display the hand filter.');
        player.srcObject = stream; await player.play();
        if (stopped) return;
        if (!window.Worker || !window.createImageBitmap) throw new Error('Hand tracking is unavailable in this browser. Try Chrome or Safari on your phone.');
        setStatus('Loading hand tracking…');
        worker = new Worker(new URL('./ar/hand.worker.ts', import.meta.url), { type: 'module' });
        readyTimer = window.setTimeout(() => fail('Hand tracking took too long to load. Check your connection and try again.'), 45000);
        worker.onerror = () => fail('Hand tracking could not load. Please try again.');
        worker.onmessage = ({ data }) => {
          if (stopped) return;
          if (data.type === 'error') { fail('Hand tracking could not start. Please try again.'); return; }
          if (data.type === 'ready') {
            clearTimeout(readyTimer); initialized = true; setReady(true); setStatus('Show your open palm to the camera.'); return;
          }
          if (data.type !== 'hand') return;
          busy = false;
          const now = performance.now();
          if (!data.landmarks || !data.handedness || data.handedness.score < .6) {
            points = []; side = stability.update(null, now); setTracked(false);
            setStatus('Show one hand to the camera.'); return;
          }
          const next = data.landmarks as Point[];
          points = points.length === 21 ? next.map((p, i) => ({ x: points[i].x * .25 + p.x * .75, y: points[i].y * .25 + p.y * .75, z: p.z })) : next;
          const nextSide = stability.update(handSide(next, data.handedness.categoryName), now);
          if (nextSide !== side) effectSince = now;
          side = nextSide; lastSeen = now; setTracked(!!side);
          setStatus(side === 'palm' ? 'A tomato in your palm. Turn your hand over.' : side === 'back' ? 'Red hair is growing. Turn back to your palm.' : 'Turn your hand a little more towards the camera.');
        };
        worker.postMessage({ type: 'init', base: window.location.origin });
        const tick = (now: number) => {
          if (stopped) return;
          if (initialized && busy && now - lastSent > 5000) { fail('Hand tracking paused. Tap Try again to restart it.'); return; }
          const width = surface.clientWidth, height = surface.clientHeight, ratio = Math.min(window.devicePixelRatio || 1, 2);
          if (surface.width !== Math.round(width * ratio) || surface.height !== Math.round(height * ratio)) {
            surface.width = Math.round(width * ratio); surface.height = Math.round(height * ratio);
          }
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
          if (side && points.length === 21 && now - lastSeen < 300) {
            drawHandEffect(ctx, points.map(p => coverPoint(p, player.videoWidth, player.videoHeight, width, height)), side, Math.min(1, (now - effectSince) / 650), now / 1000);
          } else if (now - lastSeen >= 300) { setTracked(false); }
          if (initialized && !busy && player.readyState >= 2 && player.currentTime !== lastFrame && now - lastSent >= 80) {
            busy = true; lastFrame = player.currentTime; lastSent = now;
            const scaledWidth = Math.min(640, player.videoWidth);
            void createImageBitmap(player, { resizeWidth: scaledWidth, resizeHeight: Math.round(player.videoHeight * scaledWidth / player.videoWidth) }).then(bitmap => {
              if (stopped || !initialized) { bitmap.close(); return; }
              worker!.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap]);
            }).catch(() => fail('The camera frame could not be read. Please try again.'));
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (reason) {
        fail(reason instanceof Error && reason.name === 'NotAllowedError' ? 'Allow camera access to try the hand filter.' : reason instanceof Error ? reason.message : 'The camera could not open.');
      }
    }, 0);
    const player = video.current;
    return () => {
      stopped = true; clearTimeout(boot); clearTimeout(readyTimer); cancelAnimationFrame(raf); worker?.terminate(); unbind();
      if (player) { player.pause(); player.srcObject = null; }
    };
  }, [props.launch]);

  return createPortal(<div className="ar-ui hand-ar-ui" role="dialog" aria-modal="true" aria-label="Tomato and red hair hand filter"
    onKeyDown={event => { if (event.key === 'Escape') close.current(); }}>
    <video ref={video} className="hand-camera" autoPlay playsInline muted aria-hidden="true" />
    <canvas ref={canvas} className="hand-effects" aria-hidden="true" />
    <div className="ar-top-wash" aria-hidden="true" />
    <header className="ar-header">
      <div><p className="ar-eyebrow ar-mode-badge">HAND AR MODE</p><h1>Tomato / red hair</h1></div>
      <button ref={closeButton} type="button" className="ar-back-button" onClick={props.onClose}><ArrowLeft size={16} />Back to map</button>
    </header>
    <MapSubtitles audioRef={props.audioRef} trackId={props.trackId} audioUrl={props.audioUrl} />
    {error ? <div className="ar-camera-message" role="alert"><p>{error}</p>
      <button type="button" className="ar-capsule" onClick={props.onRetry}>Try again</button>
      <button type="button" className="ar-text-button" onClick={props.onClose}>Back to map</button>
    </div> : !tracked && <div className="ar-scan-guide hand-guide" role="status"><Hand size={40} strokeWidth={1.3} /><h2>{ready ? 'Show your hand' : 'Just a moment'}</h2><p>{status}</p></div>}
    <footer className="ar-footer"><div className="ar-control-group">
      {!error && <><p className="ar-instruction" role="status">{tracked ? status : 'Palm towards camera: tomato. Back of hand: red hair.'}</p><p className="hand-camera-note">Keep one hand fully in view, in good light.</p></>}
      <button type="button" className="ar-audio-toggle" onClick={props.onToggleAudio} aria-label={props.playing ? 'Pause journey audio' : 'Resume journey audio'}>
        {props.playing ? <Pause size={14} /> : <Play size={14} />}<span>{props.playing ? 'Journey audio playing' : 'Journey audio paused'}</span>
      </button>
    </div></footer>
  </div>, props.launch.overlayRoot);
}
