import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Pause, Play, RotateCw, Smartphone } from 'lucide-react';
import MapSubtitles from './MapSubtitles';
import { GroundEncounter, type GroundState } from './ar/GroundEncounter';
import { endGroundSession, type GroundARLaunch } from './ar/session';
import { bindARExitControls } from './ar/exitControls';
import type { EncounterKind } from './ar/characters';

type Props = {
  kind: EncounterKind;
  launch: GroundARLaunch;
  trackId: string;
  audioUrl: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  playing: boolean;
  onToggleAudio: () => void;
  onClose: () => void | Promise<void>;
  onRetry: () => void;
};

export default function ARExperience(props: Props) {
  const { kind, launch } = props;
  const title = kind === 'mynas' ? 'Meet the mynas' : kind === 'rubber-tree' ? 'Tap a rubber tree' : 'Find the pink bun';
  const host = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const engine = useRef<GroundEncounter | null>(null);
  const onClose = useRef(props.onClose);
  onClose.current = props.onClose;
  const [error, setError] = useState('');
  const closing = useRef(false);
  const [isClosing, setIsClosing] = useState(false);
  const [exitFailed, setExitFailed] = useState(false);
  const requestClose = async () => {
    if (closing.current) return;
    closing.current = true;
    setIsClosing(true);
    setExitFailed(false);
    try { await onClose.current(); }
    catch { setExitFailed(true); }
    finally { closing.current = false; setIsClosing(false); }
  };
  const [state, setState] = useState<GroundState>({ immersive: false, surface: false, placed: false, tracking: true });

  useEffect(() => {
    let cancelled = false;
    // Avoid adopting the same XR session twice during StrictMode's effect replay.
    const timer = window.setTimeout(async () => {
      try {
        const session = await launch.session;
        if (cancelled) return;
        const next = new GroundEncounter(host.current!, kind, setState);
        engine.current = next;
        await next.startGroundAR(Promise.resolve(session), () => { if (!cancelled) onClose.current(); });
      } catch (reason) {
        if (cancelled) return;
        engine.current?.dispose();
        engine.current = null;
        void launch.session.then(endGroundSession).catch(() => {});
        const name = reason instanceof Error ? reason.name : '';
        setError(name === 'NotSupportedError'
          ? 'Ground-tracked AR is not available on this phone or browser. Try a compatible AR-enabled Android phone with Chrome.'
          : name === 'NotAllowedError' || name === 'SecurityError'
            ? 'AR access was not allowed. Check your camera and AR permissions, then try again.'
            : reason instanceof Error ? reason.message : 'Ground tracking could not start. Please try again.');
      }
    }, 0);
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const preventSelect = (event: Event) => {
      if ((event.target as Element)?.closest('button, input, a')) event.preventDefault();
    };
    launch.overlayRoot.addEventListener('beforexrselect', preventSelect);
    const unbindExit = bindARExitControls(launch.overlayRoot, closeButton.current!, () => { void requestClose(); });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      engine.current?.dispose();
      engine.current = null;
      launch.overlayRoot.removeEventListener('beforexrselect', preventSelect);
      unbindExit();
      previousFocus?.focus();
    };
  }, [kind, launch]);

  const scanning = state.immersive && (!state.tracking || (!state.placed && !state.surface));
  const canPlace = state.immersive && state.tracking && state.surface && !state.placed;
  return <>
    {createPortal(<div className="ar-experience" aria-hidden="true"><div ref={host} className="ar-renderer" /></div>, document.body)}
    {createPortal(<div className="ar-ui" data-immersive={state.immersive} role="dialog" aria-modal="true" aria-label={title}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); void requestClose(); }
        if (event.key === 'Tab') {
          const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="ar-top-wash" aria-hidden="true" />
      <header className="ar-header">
        <div><p className="ar-eyebrow ar-mode-badge">AR MODE</p><h1>{title}</h1></div>
        <button ref={closeButton} type="button" className="ar-back-button" onClick={requestClose} aria-busy={isClosing} aria-live="polite"><ArrowLeft size={16} aria-hidden="true" />{isClosing ? 'Returning…' : exitFailed ? 'Retry back to map' : 'Back to map'}</button>
      </header>
      <MapSubtitles audioRef={props.audioRef} trackId={props.trackId} audioUrl={props.audioUrl} />
      {error ? <div className="ar-camera-message" role="status">
        <Smartphone size={28} /><p>{error}</p>
        <button type="button" className="ar-capsule" onClick={props.onRetry}>Try again</button>
        <button type="button" className="ar-text-button" onClick={requestClose}>Back to map</button>
      </div> : scanning ? <div className="ar-scan-guide" role="status">
        <div className="ar-scan-animation" aria-hidden="true"><div className="ar-scan-ground" /><Smartphone className="ar-scan-phone" size={52} strokeWidth={1.4} /></div>
        <h2>{state.tracking ? 'Scan the ground' : 'Find the ground again'}</h2>
        <p>Point your camera down and move it gently from side to side.</p>
      </div> : !state.immersive && <div className="ar-opening-status" role="status">Opening ground tracking…</div>}
      <footer className={`ar-footer${error ? ' ar-footer-error' : ''}`}>
        <div className="ar-control-group">
        {!error && state.tracking && (canPlace || state.placed) && <p className="ar-instruction" role="status">
          {canPlace ? 'Ground found. Tap to place.' : kind === 'mynas' ? 'Tap the mynas to make them hop.' : kind === 'rubber-tree' ? 'Tap the trunk to watch latex flow into the cup.' : 'Tap the pink bun for a little bounce.'}
        </p>}
        {!error && canPlace && <button type="button" className="ar-capsule" onClick={() => engine.current?.place()}>{kind === 'mynas' ? 'Place the mynas' : kind === 'rubber-tree' ? 'Place the rubber tree' : 'Place the pink bun'}</button>}
        {!error && state.placed && state.tracking && kind === 'rubber-tree' && <button type="button" className="ar-capsule" onClick={() => engine.current?.interact()}>Tap the tree</button>}
        {!error && state.placed && state.tracking && <>
          <div className="ar-placement-controls"><button type="button" className="ar-text-button" onClick={() => engine.current?.reset()}>Place again</button>
            <button type="button" className="ar-icon-button" aria-label="Rotate AR object" onClick={() => engine.current?.rotate()}><RotateCw size={18} /></button></div>
        </>}
        <button type="button" className="ar-audio-toggle" aria-label={props.playing ? 'Pause journey audio' : 'Resume journey audio'} onClick={props.onToggleAudio}>
          {props.playing ? <Pause size={14} /> : <Play size={14} />}<span>{props.playing ? 'Journey audio playing' : 'Journey audio paused'}</span>
        </button>
        </div>
      </footer>
    </div>, launch.overlayRoot)}
  </>;
}
