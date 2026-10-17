import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { cueAtTime, subtitleSpeakers, subtitleTracks, type SubtitleCue } from './subtitles';

export default function MapSubtitles({ audioRef, trackId, audioUrl }: {
  audioRef: RefObject<HTMLAudioElement | null>;
  trackId?: string;
  audioUrl?: string;
}) {
  const [cue, setCue] = useState<SubtitleCue | null>(null);
  const track = trackId ? subtitleTracks[trackId] : undefined;
  useEffect(() => {
    const audio = audioRef.current;

    setCue(null);
    if (!audio || !track || !audioUrl) return;
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
  if (!cue) return null;
  const speaker = subtitleSpeakers[cue.speaker];
  return <div className="map-subtitles" aria-label={`Subtitles: ${speaker.name}`}
    style={{ '--speaker-light': speaker.colorLight, '--speaker-dark': speaker.colorDark } as CSSProperties}>
    <div className="subtitle-speaker">{speaker.name}</div>
    <p>{cue.lines.map((line, index) => <span key={index}>{line}</span>)}</p>
  </div>;
}

