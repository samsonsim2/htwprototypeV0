import { useState } from 'react';
import { Bug, Pause, Play, RotateCcw, SkipBack, SkipForward, X } from 'lucide-react';
import type { LocationPin } from '../config';
import { subtitleTracks } from './subtitles';

type Props = {
  pins: LocationPin[];
  enabled: boolean;
  selectedId: string;
  activeId?: string;
  playing: boolean;
  elapsed: number;
  duration: number;
  onEnter: () => void;
  onExit: () => void;
  onPreview: (id: string) => void;
  onTogglePlayback: () => void;
  onSeek: (seconds: number) => void;
};

const time = (seconds: number) => {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};

export default function DebugAudioPanel(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const index = Math.max(0, props.pins.findIndex(pin => pin.id === props.selectedId));
  const pin = props.pins[index];
  const selectedIsActive = pin?.id === props.activeId;
  const isPlaying = selectedIsActive && props.playing;
  const track = pin ? subtitleTracks[pin.id] : undefined;
  const cycle = (step: number) => {
    if (!props.pins.length) return;
    props.onPreview(props.pins[(index + step + props.pins.length) % props.pins.length].id);
  };
  return <aside className="map-tool text-white">
    <button type="button" title="Debug audio preview" aria-label="Debug audio preview"
      aria-expanded={expanded} aria-controls="debug-audio-panel"
      data-debug-active={props.enabled}
      className="debug-audio-launcher flex flex-col items-center justify-center rounded-xl border backdrop-blur-md"
      onClick={() => {
        if (!expanded && !props.enabled) props.onEnter();
        setExpanded(!expanded);
      }}>
      <Bug size={17} aria-hidden="true" />
      <span className="text-[8px] font-bold leading-3 tracking-wide">DEBUG</span>
    </button>
    {expanded && <section id="debug-audio-panel" aria-label="Debug audio preview controls"
      className="map-debug-popover debug-audio-panel rounded-xl border border-amber-400/50 bg-zinc-950/95 p-3 shadow-lg backdrop-blur-md">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-amber-300">DEBUG · Audio preview</h2>
        <button type="button" aria-label="Collapse debug audio controls" onClick={() => setExpanded(false)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"><X size={17} /></button>
      </div>
      <p className="mb-3 text-xs text-zinc-300">Test subtitles and particles anywhere. GPS triggers are paused.</p>
      <label className="block text-xs" htmlFor="debug-stop-select">Stop {index + 1} of {props.pins.length}</label>
      <select id="debug-stop-select" value={pin?.id ?? ''} disabled={!pin}
        onChange={event => props.onPreview(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-zinc-900 px-2 text-sm text-white">
        {props.pins.map(item => <option key={item.id} value={item.id}>{item.id.replace('pin-', '')} · {item.name}</option>)}
      </select>
      <div className="my-3 grid grid-cols-3 gap-2">
        <button type="button" aria-label="Debug previous stop" disabled={!pin} onClick={() => cycle(-1)} className="debug-audio-action"><SkipBack size={16} />Previous</button>
        <button type="button" disabled={!pin} onClick={() => selectedIsActive ? props.onTogglePlayback() : props.onPreview(pin.id)}
          aria-label={isPlaying ? 'Debug pause audio' : 'Debug play selected stop'} className="debug-audio-action debug-audio-play">
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}{isPlaying ? 'Pause' : 'Play'}
        </button>
        <button type="button" aria-label="Debug next stop" disabled={!pin} onClick={() => cycle(1)} className="debug-audio-action"><SkipForward size={16} />Next</button>
      </div>
      <label className="block text-xs text-zinc-300">
        Seek through this recording
        <input type="range" aria-label="Debug seek position" min={0} max={props.duration || 1} step={0.1}
          value={selectedIsActive ? Math.min(props.elapsed, props.duration || 0) : 0}
          disabled={!selectedIsActive || props.duration <= 0}
          onChange={event => props.onSeek(Number(event.target.value))} className="mt-1 h-6 w-full accent-amber-400" />
      </label>
      <div className="mb-2 flex justify-between font-mono text-xs text-zinc-300">
        <span>{time(selectedIsActive ? props.elapsed : 0)}</span><span>{time(selectedIsActive ? props.duration : track?.duration ?? 0)}</span>
      </div>
      {track?.contentStatus === 'ambient' && <p className="mb-2 text-xs text-amber-200">Ambient track · no spoken subtitles</p>}
      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
        <button type="button" disabled={!pin} onClick={() => props.onPreview(pin.id)} className="debug-audio-action"><RotateCcw size={14} />Restart</button>
        <button type="button" onClick={() => { props.onExit(); setExpanded(false); }} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-amber-300 underline underline-offset-2">Exit debugging</button>
      </div>
    </section>}
  </aside>;
}
