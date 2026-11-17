import { useState } from 'react';
import { Bug, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
import type { LocationPin } from '../config';
import { subtitleTracks } from './subtitles';
import { DEFAULT_FADE, fadeGain, type FadeSettings } from './audioFade';

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
  fadeSettings: FadeSettings;
  onFadeSettings: (settings: FadeSettings) => void;
  fadeProgress: number | null;
  audioClearance: number;
  onCrossfade: (id: string) => void;
};

const time = (seconds: number) => {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};

export default function DebugAudioPanel(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const [fadeExpanded, setFadeExpanded] = useState(false);
  const index = Math.max(0, props.pins.findIndex(pin => pin.id === props.selectedId));
  const pin = props.pins[index];
  const selectedIsActive = pin?.id === props.activeId;
  const isPlaying = selectedIsActive && props.playing;
  const track = pin ? subtitleTracks[pin.id] : undefined;
  const cycle = (step: number) => {
    if (!props.pins.length) return;
    props.onPreview(props.pins[(index + step + props.pins.length) % props.pins.length].id);
  };
  return <><aside className="map-tool text-white">
    <button type="button" title="Debug audio preview" aria-label="Debug audio preview"
      aria-expanded={expanded} aria-controls="debug-audio-panel"
      data-debug-active={props.enabled}
      className="debug-audio-launcher flex flex-col items-center justify-center rounded-xl border backdrop-blur-md"
      onClick={() => {
        if (!expanded && !props.enabled) props.onEnter();
        setFadeExpanded(false);
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
  </aside>
  <aside className="map-tool text-white">
    <button type="button" aria-label="Crossfade debug settings" title="Crossfade settings" aria-expanded={fadeExpanded} aria-controls="crossfade-debug-panel"
      className="debug-audio-launcher flex flex-col items-center justify-center rounded-xl border backdrop-blur-md"
      onClick={() => { setFadeExpanded(!fadeExpanded); setExpanded(false); }}>
      <Volume2 size={17} aria-hidden="true" /><span className="text-[8px] font-bold leading-3">FADE</span>
    </button>
    {fadeExpanded && <section id="crossfade-debug-panel" aria-label="Crossfade settings and preview" className="map-debug-popover debug-audio-panel crossfade-debug-panel"
      style={{ maxHeight: `max(80px, calc(100dvh - ${props.audioClearance}px - 90px - env(safe-area-inset-top)))` }}>
      <div className="debug-audio-heading"><h2>DEBUG / Crossfade</h2><button type="button" aria-label="Close crossfade settings" className="debug-audio-close" onClick={() => setFadeExpanded(false)}><X size={16} /></button></div>
      <div className="fade-debug">
        <label>Preview starting track
          <select aria-label="Crossfade starting track" className="debug-audio-select" value={pin?.id ?? ''} onChange={event => props.onPreview(event.target.value)}>
            {props.pins.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button type="button" className="debug-audio-action" disabled={!pin} onClick={() => props.onPreview(pin.id)}>Play starting track</button>
        <p>Incoming audio starts at full volume; only the outgoing track fades out. Settings are saved on this device.</p>
        <label>Duration: {props.fadeSettings.seconds}s
          <input aria-label="Crossfade duration" type="range" min="2" max="40" step="1" disabled={props.fadeProgress !== null}
            value={props.fadeSettings.seconds} onChange={event => props.onFadeSettings({ ...props.fadeSettings, seconds: Number(event.target.value) })} />
        </label>
        <label>Curve
          <select aria-label="Crossfade curve" className="debug-audio-select" disabled={props.fadeProgress !== null} value={props.fadeSettings.curve}
            onChange={event => props.onFadeSettings({ ...props.fadeSettings, curve: event.target.value as FadeSettings['curve'] })}>
            <option value="smooth">Smooth S-curve</option><option value="linear">Linear</option><option value="exponential">Exponential (previous curve)</option>
          </select>
        </label>
        <label>Curve shape: {props.fadeSettings.shape.toFixed(1)}
          <input aria-label="Crossfade shape" type="range" min="0.5" max="3" step="0.1" disabled={props.fadeProgress !== null}
            value={props.fadeSettings.shape} onChange={event => props.onFadeSettings({ ...props.fadeSettings, shape: Number(event.target.value) })} />
        </label>
        <svg viewBox="0 0 280 110" role="img" aria-label="Crossfade volume graph: outgoing track in orange, incoming track in green">
          <path d="M10 5 V95 H270" fill="none" stroke="#777" />
          {[false, true].map(incoming => <polyline key={String(incoming)} fill="none" stroke={incoming ? '#86efac' : '#fdba74'} strokeWidth="2"
            points={Array.from({ length: 101 }, (_, i) => {
              const gain = fadeGain(i / 100, props.fadeSettings);
              return `${10 + i * 2.6},${95 - (incoming ? 1 : 1 - gain) * 85}`;
            }).join(' ')} />)}
          {props.fadeProgress !== null && <line x1={10 + props.fadeProgress * 260} x2={10 + props.fadeProgress * 260} y1="5" y2="95" stroke="white" strokeDasharray="3 3" />}
          <text x="10" y="108" fill="white" fontSize="9">0s</text><text x="250" y="108" fill="white" fontSize="9">{props.fadeSettings.seconds}s</text>
        </svg>
        <p><span style={{ color: '#fdba74' }}>Outgoing</span> / <span style={{ color: '#86efac' }}>Incoming</span> · Volume 0–100%</p>
        <p role="status">{props.fadeProgress === null ? 'Play a stop, then preview the transition to the next stop.' : `Fading: ${(props.fadeProgress * props.fadeSettings.seconds).toFixed(1)}s / ${props.fadeSettings.seconds}s`}</p>
        <button type="button" className="debug-audio-action" disabled={!isPlaying || props.fadeProgress !== null || props.pins.length < 2}
          onClick={() => props.onCrossfade(props.pins[(index + 1) % props.pins.length].id)}>Crossfade to next stop</button>
        <button type="button" className="debug-audio-action" disabled={props.fadeProgress !== null} onClick={() => props.onFadeSettings({ ...DEFAULT_FADE })}>Reset settings</button>
        <button type="button" className="debug-audio-action" onClick={props.onExit}>Stop preview / resume GPS</button>
      </div>
    </section>}
  </aside></>;
}

