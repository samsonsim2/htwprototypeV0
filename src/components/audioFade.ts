export type FadeSettings = { seconds: number; curve: 'smooth' | 'linear' | 'exponential'; shape: number };
export const DEFAULT_FADE: FadeSettings = { seconds: 18, curve: 'exponential', shape: 1 };
export function fadeGain(progress: number, settings: FadeSettings) {
  const t = Math.max(0, Math.min(1, progress));
  const shaped = t ** settings.shape;
  if (settings.curve === 'linear') return shaped;
  if (settings.curve === 'exponential') return (1 - 0.001 ** shaped) / 0.999;
  return shaped * shaped * (3 - 2 * shaped);
}
export function loadFade(): FadeSettings {
  try {
    const value = JSON.parse(localStorage.getItem('htw-audio-fade') || 'null');
    if (value && Number.isFinite(value.seconds) && value.seconds >= 2 && value.seconds <= 40 &&
      ['smooth', 'linear', 'exponential'].includes(value.curve) && Number.isFinite(value.shape) && value.shape >= 0.5 && value.shape <= 3) return value;
  } catch { /* Use defaults when storage is unavailable. */ }
  return { ...DEFAULT_FADE };
}
