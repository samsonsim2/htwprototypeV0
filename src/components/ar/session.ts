const endingSessions = new WeakMap<XRSession, Promise<void>>();
const endedSessions = new WeakSet<XRSession>();
let nextLaunchId = 0;

export function endGroundSession(session: XRSession, timeoutMs = 4000) {
  if (endedSessions.has(session)) return Promise.resolve();
  const pending = endingSessions.get(session);
  if (pending) return pending;
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const ending = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  endingSessions.set(session, ending);
  const cleanup = () => {
    clearTimeout(timer);
    session.removeEventListener('end', finished);
    if (endingSessions.get(session) === ending) endingSessions.delete(session);
  };
  const finished = () => { endedSessions.add(session); cleanup(); resolve(); };
  const failed = (reason: unknown) => { cleanup(); reject(reason); };
  const timer = setTimeout(() => failed(new Error('AR is taking too long to close. Tap Back to map to retry.')), timeoutMs);
  session.addEventListener('end', finished, { once: true });
  // The end event can arrive before the promise settles on a mobile browser.
  try { void session.end().then(finished, failed); } catch (error) { failed(error); }
  return ending;
}

export type GroundARLaunch = { id: number; overlayRoot: HTMLDivElement; session: Promise<XRSession>; dispose: () => Promise<void> };

// Run in the original capsule click, before lazy loading or awaiting anything.
export function launchGroundAR(): GroundARLaunch {
  const overlayRoot = document.createElement('div');
  overlayRoot.className = 'ar-session-overlay';
  document.body.appendChild(overlayRoot);
  let disposed = false;
  let active: XRSession | null = null;
  let request: Promise<XRSession>;
  try {
    if (!window.isSecureContext) throw new Error('Open the HTTPS version of the app to use ground-tracked AR.');
    if (!navigator.xr) throw new DOMException('Ground tracking is unavailable.', 'NotSupportedError');
    request = navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', 'dom-overlay'], domOverlay: { root: overlayRoot },
    });
  } catch (error) { request = Promise.reject(error); }
  const session = request.then(next => {
    next.addEventListener('end', () => endedSessions.add(next), { once: true });
    active = next;
    if (disposed) void endGroundSession(next).catch(() => {});
    return next;
  });
  // A rejection can precede loading the AR chunk. The UI still receives it.
  void session.catch(() => {});
  return {
    id: ++nextLaunchId, overlayRoot, session,
    dispose: () => {
      disposed = true;
      if (active) return endGroundSession(active).then(() => overlayRoot.remove());
      overlayRoot.remove();
      return Promise.resolve();
    },
  };
}
