let launchId = 0;
export type HandCameraLaunch = ReturnType<typeof launchHandCamera>;

export function launchHandCamera() {
  const overlayRoot = document.createElement('div');
  overlayRoot.className = 'ar-session-overlay';
  document.body.appendChild(overlayRoot);
  let disposed = false;
  let active: MediaStream | undefined;
  const stream = (async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Open the HTTPS link to use the hand camera.');
    const next = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 720 }, height: { ideal: 960 }, frameRate: { ideal: 24, max: 30 } },
    });
    active = next;
    if (disposed) next.getTracks().forEach(track => track.stop());
    return next;
  })();
  void stream.catch(() => {});
  return {
    id: ++launchId, overlayRoot, stream,
    dispose: async () => {
      disposed = true;
      active?.getTracks().forEach(track => track.stop());
      overlayRoot.remove();
    },
  };
}
