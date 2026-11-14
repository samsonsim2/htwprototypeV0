import { useEffect, useState, type CSSProperties, type RefObject, type ReactNode } from 'react';
import { cueAtTime, subtitleSpeakers, subtitleTracks, type SubtitleCue } from './subtitles';

export default function MapSubtitles({ audioRef, trackId, audioUrl, onSubtitlesStarted, onVisibilityChange, onOpenDirections, belowBoardingHeading = false, leadingContent, hideCue = false }: {
  audioRef: RefObject<HTMLAudioElement | null>;
  trackId?: string;
  audioUrl?: string;
  onSubtitlesStarted?: (started: boolean) => void;
  onVisibilityChange?: (visible: boolean) => void;
  belowBoardingHeading?: boolean;
  leadingContent?: ReactNode;
  hideCue?: boolean;
  onOpenDirections?: () => void;
}) {
  const [cue, setCue] = useState<SubtitleCue | null>(null);
  const track = trackId ? subtitleTracks[trackId] : undefined;
  useEffect(() => {
    const audio = audioRef.current;

    setCue(null);
    if (!audio || !track || track.contentStatus === 'ambient' || !audioUrl) return;
    let frame = 0;
    const expectedSrc = new URL(audioUrl, window.location.href).href;
    const update = () => {
      const matches = (audio.currentSrc || audio.src) === expectedSrc;
      const next = matches && audio.readyState >= 2 && !audio.ended
        ? cueAtTime(track.cues, audio.currentTime - track.offsetSeconds)
        : null;
      setCue(current => current === next ? current : next);
    };
    const tick = () => {
      update();
      if (!audio.paused && !audio.ended) frame = requestAnimationFrame(tick);
    };
    const start = () => { cancelAnimationFrame(frame); tick(); };
    const stop = () => { cancelAnimationFrame(frame); update(); };
    const clear = () => { cancelAnimationFrame(frame); setCue(null); };
    const events = ['timeupdate', 'seeking', 'seeked', 'loadeddata', 'waiting', 'ratechange'] as const;
    events.forEach(event => audio.addEventListener(event, update));
    audio.addEventListener('play', start);
    audio.addEventListener('pause', stop);
    audio.addEventListener('ended', clear);
    audio.addEventListener('emptied', clear);
    audio.addEventListener('error', clear);
    start();
    return () => {
      cancelAnimationFrame(frame);
      events.forEach(event => audio.removeEventListener(event, update));
      audio.removeEventListener('play', start);
      audio.removeEventListener('pause', stop);
      audio.removeEventListener('ended', clear);
      audio.removeEventListener('emptied', clear);
      audio.removeEventListener('error', clear);
    };
  }, [audioRef, track, audioUrl]);
  useEffect(() => {
    if (cue) onSubtitlesStarted?.(true);
  }, [cue, onSubtitlesStarted]);
  useEffect(() => {
    onVisibilityChange?.(!!cue);
    return () => onVisibilityChange?.(false);
  }, [cue, onVisibilityChange]);
  const visibleCue = hideCue || track?.contentStatus === 'ambient' ? null : cue;
  if (!visibleCue && !onOpenDirections && !leadingContent) return null;
  const speaker = visibleCue ? subtitleSpeakers[visibleCue.speaker] : null;
  return <div className={`map-subtitles${onOpenDirections || leadingContent ? ' with-directions' : ''}${belowBoardingHeading ? ' below-boarding-heading' : ''}`} aria-label={speaker ? `Subtitles: ${speaker.name}` : 'Direction guides'}
    style={{ '--speaker-light': speaker?.colorLight, '--speaker-dark': speaker?.colorDark } as CSSProperties}>
    {leadingContent && <div className="walking-stop-prompt">{leadingContent}</div>}
    {onOpenDirections && <div className="walk-end-directions"><p>You’ve reached the end of the walk.<br />Follow the directions to the bus stop<br />and board the next bus 166.</p><button type="button" className="direction-guide-link" onClick={onOpenDirections}><span className="phone-info-icon" aria-hidden="true">i</span><span>View direction guides</span></button></div>}
    {speaker && visibleCue && <div className="subtitle-cue-block"><div className="subtitle-speaker">{speaker.name}</div>
    <p>{visibleCue.lines.map((line, index) => <span key={index}>{line}</span>)}</p></div>}
  </div>;
}

