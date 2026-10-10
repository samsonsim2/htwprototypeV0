import { useCallback, useEffect, useRef } from 'react';

export type PlaybackEnergy = { level: number; bass: number };

// Analyse the existing player; no microphone or second playback stream.
export default function usePlaybackField(audio: { current: HTMLAudioElement | null }) {
  const graph = useRef<{
    context: AudioContext; analyser: AnalyserNode; source: MediaElementAudioSourceNode;
    frequencies: Uint8Array<ArrayBuffer>; waveform: Uint8Array<ArrayBuffer>;
  } | null>(null);

  const prepare = useCallback(() => {
    if (!audio.current) return;
    try {
      if (!graph.current) {
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        const source = context.createMediaElementSource(audio.current);
        // Direct output preserves volume; analyser is only a monitoring branch.
        source.connect(context.destination);
        source.connect(analyser);
        graph.current = { context, analyser, source,
          frequencies: new Uint8Array(analyser.frequencyBinCount), waveform: new Uint8Array(analyser.fftSize) };
      }
      void graph.current.context.resume().catch(error => console.warn('Audio visualisation unavailable', error));
    } catch (error) {
      console.warn('Audio visualisation unavailable', error);
    }
  }, [audio]);

  const sample = useCallback((): PlaybackEnergy => {
    const current = graph.current;
    if (!current || !audio.current || audio.current.paused || audio.current.ended || current.context.state !== 'running') {
      return { level: 0, bass: 0 };
    }
    current.analyser.getByteTimeDomainData(current.waveform);
    current.analyser.getByteFrequencyData(current.frequencies);
    let sum = 0, bass = 0;
    for (const value of current.waveform) sum += (value / 128 - 1) ** 2;
    const bins = Math.max(1, Math.floor(250 / (current.context.sampleRate / current.analyser.fftSize)));
    for (let i = 1; i <= bins; i++) bass += current.frequencies[i] / 255;
    return { level: Math.min(1, Math.sqrt(sum / current.waveform.length) * 3), bass: Math.min(1, bass / bins) };
  }, [audio]);

  useEffect(() => () => {
    const current = graph.current;
    if (current) {
      current.source.disconnect();
      current.analyser.disconnect();
      void current.context.close();
      graph.current = null;
    }
  }, []);
  return { prepare, sample };
}
