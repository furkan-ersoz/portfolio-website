// ─────────────────────────────────────────────────────────────
// DATA for the blog post "Pitch Detection and Melody Perception at Low Frequencies by Duration".
// Note names follow Cubase (middle C = C3), so C1 ≈ 65 Hz … C4 ≈ 523 Hz.
// ─────────────────────────────────────────────────────────────

export const BPM = 100;
export const BEAT_MS = 60000 / BPM; // 600 ms; the two-note test starts one note per beat
export const WHOLE_TONE = 2 ** (200 / 1200);
export const RAMP_MS = 5; // attack and release, as in the test

export const REGISTERS = [
  { name: 'C1', hz: 65.41 },
  { name: 'C2', hz: 130.81 },
  { name: 'C3', hz: 261.63 },
  { name: 'C4', hz: 523.25 },
] as const;
export type RegisterName = (typeof REGISTERS)[number]['name'];

export const DURATIONS = [
  { name: '1/128', ms: 18.75 },
  { name: '1/64', ms: 37.5 },
  { name: '1/32', ms: 75 },
  { name: '1/16', ms: 150 },
] as const;

export const cycles = (hz: number, ms: number) => (hz * ms) / 1000;

// Test 1: two notes, the second a whole tone higher. true = the step was heard.
export const TWO_NOTE: Record<RegisterName, boolean[]> = {
  C4: [true, true, true, true],
  C3: [true, true, true, true],
  C2: [false, false, true, true],
  C1: [false, false, true, true],
};

// Test 2: the melody at 1/64, 1/32, 1/16 (1/128 not tested).
// Each measure lists the first duration (ms) where it was reached and my estimate of how often (%).
export const MELODY_DURATIONS = [37.5, 75, 150];
export const MELODY_RESULTS: Record<RegisterName, { change: [number, number]; recognized: [number, number] }> = {
  C4: { change: [37.5, 100], recognized: [75, 100] },
  C3: { change: [37.5, 100], recognized: [75, 100] },
  C2: { change: [37.5, 100], recognized: [150, 100] },
  C1: { change: [75, 50], recognized: [150, 50] },
};
/** 0 = not reached, 0.5 = half (50%), 1 = reached, for a measure at a duration. */
export function melodyLevel([first, pct]: [number, number], ms: number): 0 | 0.5 | 1 {
  if (ms < first) return 0;
  if (ms === first) return pct >= 100 ? 1 : 0.5;
  return 1;
}

// Minimum duration for a pitch sensation, read from course slide 14 (approximate): [Hz, ms]
export const MIN_DURATION_CURVE: [number, number][] = [
  [50, 60], [65, 48], [100, 39], [131, 31], [200, 22], [262, 19.5], [400, 16], [523, 14.5], [800, 13],
  [1000, 12], [2000, 11], [4000, 12.5], [6000, 15.5], [8000, 20], [10000, 26],
];

// The melody from my Cubase project (read from the rendered audio): semitones above the
// register's C, and length in units of the selected note value (1/64, 1/32 or 1/16).
// C D E♭ C D E♭ F E♭ D C D C B C
export const MELODY: [number, number][] = [
  [0, 1], [2, 1], [3, 1], [0, 1], [2, 1], [3, 1], [5, 1], [3, 1], [2, 1], [0, 1], [2, 1], [0, 1], [-1, 1], [0, 3],
];
