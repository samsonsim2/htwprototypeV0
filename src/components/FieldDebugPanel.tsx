import { useEffect, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

function ColourControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  return (
    <div className="space-y-2 text-xs text-zinc-300">
      <label className="flex items-center justify-between gap-2">
        {label}
        <input aria-label={`${label} picker`} type="color" value={value} className="h-9 w-12 cursor-pointer"
          onInput={e => onChange(e.currentTarget.value)} onChange={e => onChange(e.currentTarget.value)} />
      </label>
      <input aria-label={`${label} hex code`} type="text" value={hex} spellCheck={false} maxLength={7}
        className="min-h-9 w-full rounded border border-white/20 bg-white/5 px-2 font-mono text-white"
        onChange={e => { const next = e.target.value; setHex(next); if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next); }}
        onBlur={() => setHex(value)} />
      <div className="flex gap-1">
        {['#ffffff', '#f2f2f2', '#adadad', '#787878', '#4b4b4b', '#10b981'].map(colour => (
          <button key={colour} type="button" aria-label={`${label}: ${colour}`} aria-pressed={value.toLowerCase() === colour}
            onClick={() => onChange(colour)} className="h-8 flex-1 rounded border border-white/30"
            style={{ backgroundColor: colour }} />
        ))}
      </div>
    </div>
  );
}

export const DEFAULT_FIELD_SETTINGS = {
  density: 1.5, flowSpeed: 0.64, damping: 0.8, length: 7, strokeWidth: 0.4,
  turbulence: 0.3, fieldStrength: 0.2, lifetime: 800, trailFade: 0.38,
  opacity: 0.35, color: '#4b4b4b', background: '#f2f2f2',
};
export type FieldSettings = typeof DEFAULT_FIELD_SETTINGS;
type NumericSetting = { [K in keyof FieldSettings]: FieldSettings[K] extends number ? K : never }[keyof FieldSettings];
const controls: { key: NumericSetting; label: string; min: number; max: number; step: number }[] = [
  { key: 'density', label: 'Particle density', min: 0.1, max: 3, step: 0.1 },
  { key: 'flowSpeed', label: 'Flow speed', min: 0.1, max: 3, step: 0.01 },
  { key: 'damping', label: 'Damping', min: 0.8, max: 0.99, step: 0.01 },
  { key: 'length', label: 'Particle length', min: 1, max: 40, step: 1 },
  { key: 'strokeWidth', label: 'Stroke width', min: 0.1, max: 4, step: 0.1 },
  { key: 'opacity', label: 'Particle opacity', min: 0.05, max: 1, step: 0.05 },
  { key: 'trailFade', label: 'Trail fade speed', min: 0.03, max: 1, step: 0.01 },
  { key: 'turbulence', label: 'Turbulence', min: 0, max: 2, step: 0.05 },
  { key: 'fieldStrength', label: 'Field strength', min: 0.1, max: 3, step: 0.1 },
  { key: 'lifetime', label: 'Particle lifetime', min: 60, max: 1200, step: 20 },
];

export default function FieldDebugPanel({ settings, onChange, mapOpacity, onMapOpacity }: {
  settings: FieldSettings; onChange: (settings: FieldSettings) => void;
  mapOpacity: number; onMapOpacity: (opacity: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <aside className="map-tool text-white">
      <button type="button" aria-expanded={expanded} aria-controls="field-debug-controls"
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? 'Close particle settings' : 'Open particle settings'} title="Particle settings"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/80 backdrop-blur-md hover:text-white">
        {expanded ? <X className="h-5 w-5" /> : <SlidersHorizontal className="h-5 w-5" />}
      </button>
      {expanded && (
        <div id="field-debug-controls" className="map-debug-popover rounded-xl border border-white/10 bg-zinc-950/95 p-3 shadow-lg backdrop-blur-md">
          <p className="mb-3 text-sm font-medium">Particle settings</p>
          <p className="mb-2 text-[10px] uppercase tracking-widest text-zinc-400">Map visibility</p>
          <div className="mb-4 flex gap-1" role="group" aria-label="OpenStreetMap visibility">
            {[{ value: 1, label: '100%' }, { value: 0.2, label: '20%' }, { value: 0, label: 'Off' }].map(option => (
              <button key={option.value} type="button" aria-pressed={mapOpacity === option.value}
                onClick={() => onMapOpacity(option.value)}
                className={`min-h-9 flex-1 rounded-lg text-xs ${mapOpacity === option.value ? 'bg-emerald-500 text-zinc-950' : 'bg-white/10'}`}>
                {option.label}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {controls.map(control => (
              <label key={control.key} className="block text-xs">
                <span className="flex justify-between gap-2 text-zinc-300">
                  {control.label}<span className="font-mono text-emerald-400">{Number(settings[control.key].toFixed(2))}{control.key === 'density' ? '×' : ''}</span>
                </span>
                <input type="range" min={control.min} max={control.max} step={control.step}
                  value={settings[control.key]} className="mt-1 h-6 w-full accent-emerald-400"
                  onChange={e => onChange({ ...settings, [control.key]: Number(e.target.value) })} />
              </label>
            ))}
            <div className="space-y-3">
              {(['color', 'background'] as const).map(key => (
                <div key={key}><ColourControl label={key === 'color' ? 'Particle colour' : 'Background'} value={settings[key]}
                  onChange={value => { onChange({ ...settings, [key]: value }); if (key === 'background') onMapOpacity(0); }} /></div>
              ))}
            </div>
            <button type="button" onClick={() => { onChange({ ...DEFAULT_FIELD_SETTINGS }); onMapOpacity(0); }}
              className="min-h-10 w-full rounded-lg bg-white/10 text-xs hover:bg-white/20">Reset defaults</button>
          </div>
        </div>
      )}
    </aside>
  );
}
