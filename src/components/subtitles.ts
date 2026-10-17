import config from '../config/subtitles.json';

export type SubtitleCue = { speaker: string; start: number; end: number; lines: string[] };
export type SubtitleTrack = {
  location: string;
  audioFile: string;
  duration: number;
  sha256: string;
  offsetSeconds: number;
  script: string;
  notes: string[];
  cues: SubtitleCue[];
};
export type SubtitleSpeaker = { name: string; colorLight: string; colorDark: string };
export const subtitleSpeakers = config.speakers as Record<string, SubtitleSpeaker>;
export const subtitleTracks = config.tracks as Record<string, SubtitleTrack>;

// Half-open intervals prevent two captions appearing at a shared boundary.
export function cueAtTime(cues: SubtitleCue[], seconds: number): SubtitleCue | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  let low = 0, high = cues.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const cue = cues[middle];
    if (seconds < cue.start) high = middle - 1;
    else if (seconds >= cue.end) low = middle + 1;
    else return cue;
  }
  return null;
}
