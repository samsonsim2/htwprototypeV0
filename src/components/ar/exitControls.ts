// WebXR can deliver beforexrselect even when no normal DOM click follows.
export function bindARExitControls(root: HTMLElement, button: HTMLButtonElement, close: () => void) {
  const activate = (event: Event) => {
    if (!event.composedPath().includes(button) && !button.contains(event.target as Node)) return;
    // Keyboard/assistive clicks need not have a primary pointer.
    if (event.type === 'pointerdown' && (event as PointerEvent).button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  const events = ['beforexrselect', 'pointerdown', 'touchstart', 'click'];
  events.forEach(type => root.addEventListener(type, activate, { capture: true, passive: false }));
  return () => events.forEach(type => root.removeEventListener(type, activate, { capture: true }));
}
