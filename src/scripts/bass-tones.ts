// Tone lists for the bass/duration post, built from the test settings (src/lib/bass.ts).
import { BEAT_MS, MELODY, RAMP_MS, WHOLE_TONE } from '../lib/bass';
import type { Tone } from './play-note';

/** Two notes, one beat apart (as in the test): f, then a whole tone up (or down). */
export function pairTones(hz: number, ms: number, direction: 1 | -1 = 1): Tone[] {
  const second = direction === 1 ? hz * WHOLE_TONE : hz / WHOLE_TONE;
  return [
    { freqHz: hz, durationMs: ms, onsetMs: 0, attackMs: RAMP_MS, releaseMs: RAMP_MS },
    { freqHz: second, durationMs: ms, onsetMs: BEAT_MS, attackMs: RAMP_MS, releaseMs: RAMP_MS },
  ];
}

/** The test melody in a register, one unit = `ms` (legato, as written in Cubase). */
export function melodyTones(hz: number, ms: number): Tone[] {
  let onset = 0;
  return MELODY.map(([semis, units]) => {
    const tone = {
      freqHz: hz * 2 ** (semis / 12),
      durationMs: units * ms,
      onsetMs: onset,
      attackMs: RAMP_MS,
      releaseMs: RAMP_MS,
    };
    onset += units * ms;
    return tone;
  });
}
