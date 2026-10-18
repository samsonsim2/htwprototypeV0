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
      className="map-debug-popover debug-audio-panel">
      <div className="debug-audio-heading">
        <h2>DEBUG / Audio preview</h2>
        <button type="button" aria-label="Collapse debug audio controls" title="Collapse controls" onClick={() => setExpanded(false)} className="debug-audio-close"><X size={16} /></button>
      </div>
      <div className="debug-audio-meta">
        <label htmlFor="debug-stop-select">Stop {index + 1} / {props.pins.length}</label>
        <span>{track?.contentStatus === 'ambient' ? 'Ambient · GPS paused' : 'GPS triggers paused'}</span>
      </div>
      <select id="debug-stop-select" value={pin?.id ?? ''} disabled={!pin}
        onChange={event => props.onPreview(event.target.value)}
        className="debug-audio-select">
        {props.pins.map(item => <option key={item.id} value={item.id}>{item.id.replace('pin-', '')} · {item.name}</option>)}
      </select>
      <div className="debug-audio-timeline">
        <input type="range" aria-label="Debug seek position" min={0} max={props.duration || 1} step={0.1}
          value={selectedIsActive ? Math.min(props.elapsed, props.duration || 0) : 0}
          disabled={!selectedIsActive || props.duration <= 0}
          onChange={event => props.onSeek(Number(event.target.value))} />
      <div className="debug-audio-times">
        <span>{time(selectedIsActive ? props.elapsed : 0)}</span><span>{time(selectedIsActive ? props.duration : track?.duration ?? 0)}</span>
      </div>
      </div>
      <div className="debug-audio-controls">
        <button type="button" aria-label="Restart" title="Restart track" disabled={!pin} onClick={() => props.onPreview(pin.id)} className="debug-audio-action"><RotateCcw size={16} /></button>
        <button type="button" aria-label="Debug previous stop" title="Previous stop" disabled={!pin} onClick={() => cycle(-1)} className="debug-audio-action"><SkipBack size={18} /></button>
        <button type="button" disabled={!pin} onClick={() => selectedIsActive ? props.onTogglePlayback() : props.onPreview(pin.id)}
          title={isPlaying ? 'Pause' : 'Play'} aria-label={isPlaying ? 'Debug pause audio' : 'Debug play selected stop'} className="debug-audio-action debug-audio-play">
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button type="button" aria-label="Debug next stop" title="Next stop" disabled={!pin} onClick={() => cycle(1)} className="debug-audio-action"><SkipForward size={18} /></button>
        <button type="button" aria-label="Exit debugging" onClick={() => { props.onExit(); setExpanded(false); }} className="debug-audio-action debug-audio-exit">Exit</button>
      </div>
    </section>}
  </aside>;
}
