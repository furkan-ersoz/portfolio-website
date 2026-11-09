// ─────────────────────────────────────────────────────────────
// TUNING DATA for the blog post "Makam Pitches" (and anything later that needs it).
// Pure data + small helpers, used at build time by the figure components.
//
// Conventions (same everywhere):
//   one octave, Sol (G4) = 392 Hz … 784 Hz; Rast = Sol.
//   53-grid position k  →  cents = k · 1200/53
//   AEU pitch from a chain of fifths  →  cents = (k_fifth · 701.955) mod 1200
// ─────────────────────────────────────────────────────────────

export const BASE_HZ = 392;
export const FIFTH = 701.955;
export const COMMA = 1200 / 53; // one Holdrian comma ≈ 22.64 cents

export const hz = (cents: number, base = BASE_HZ) => base * 2 ** (cents / 1200);
export const commaToCents = (k: number) => k * COMMA;
export const fifthChainCents = (k: number) => (((k * FIFTH) % 1200) + 1200) % 1200;
export const ratioToCents = (ratio: number) => 1200 * Math.log2(ratio);

const signed = (v: number, digits = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;
export const fmtCents = (c: number) => `${c.toFixed(1)} cents`;
export const fmtHz = (f: number) => `${f.toFixed(1)} Hz`;
export const fmtDiff = (d: number) => `${signed(d)} cents`;
// "3.9 cents higher" / "15.6 cents lower" / "exactly"
export const fmtRel = (d: number) =>
  Math.abs(d) < 0.05 ? 'exactly' : `${Math.abs(d).toFixed(1)} cents ${d > 0 ? 'higher' : 'lower'}`;

// ── Western 12-TET, counted from G ──
export const WESTERN = ['G', 'G♯', 'A', 'A♯', 'B', 'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G'];

export function nearestWestern(cents: number) {
  const i = Math.round(cents / 100);
  return { name: WESTERN[i], diff: cents - i * 100 };
}

export function nearestComma(cents: number) {
  const k = Math.round(cents / COMMA);
  return { k, diff: cents - k * COMMA };
}

// ── Note codes (Karaosmanoğlu 2012): letter + commas above (♯) or below (♭) ──
export const CODES = [
  'G', 'G♯1', 'G♯2', 'G♯3', 'G♯4', 'A♭4', 'A♭3', 'A♭2', 'A♭1', 'A',
  'A♯1', 'A♯2', 'A♯3', 'A♯4', 'B♭4', 'B♭3', 'B♭2', 'B♭1', 'B', 'B♯1',
  'B♯2', 'C♭1', 'C', 'C♯1', 'C♯2', 'C♯3', 'C♯4', 'D♭4', 'D♭3', 'D♭2',
  'D♭1', 'D', 'D♯1', 'D♯2', 'D♯3', 'D♯4', 'E♭4', 'E♭3', 'E♭2', 'E♭1',
  'E', 'E♯1', 'E♯2', 'E♯3', 'F', 'F♯1', 'F♯2', 'F♯3', 'F♯4', 'G♭4',
  'G♭3', 'G♭2', 'G♭1', 'G',
];

// ── Arel-Ezgi-Uzdilek: 24 pitches (+ octave). [name, fifth-chain k, comma position] ──
export interface AeuPitch {
  name: string;
  k: number | null; // null for the octave
  pos: number;
  cents: number; // Pythagorean value
}

const AEU_RAW: [string, number | null, number][] = [
  ['Rast', 0, 0],
  ['Nim Zirgüle', -5, 4],
  ['Zirgüle', 7, 5],
  ['Dik Zirgüle', -10, 8],
  ['Dügâh', 2, 9],
  ['Kürdî', -3, 13],
  ['Dik Kürdî', 9, 14],
  ['Segâh', -8, 17],
  ['Bûselik', 4, 18],
  ['Dik Bûselik', -13, 21],
  ['Çârgâh', -1, 22],
  ['Nim Hicaz', -6, 26],
  ['Hicaz', 6, 27],
  ['Dik Hicaz', -11, 30],
  ['Nevâ', 1, 31],
  ['Nim Hisar', -4, 35],
  ['Hisar', 8, 36],
  ['Dik Hisar', -9, 39],
  ['Hüseynî', 3, 40],
  ['Acem', -2, 44],
  ['Dik Acem', 10, 45],
  ['Eviç', -7, 48],
  ['Mâhur', 5, 49],
  ['Dik Mâhur', -12, 52],
  ['Gerdaniye', null, 53],
];

export const AEU: AeuPitch[] = AEU_RAW.map(([name, k, pos]) => ({
  name,
  k,
  pos,
  cents: k === null ? 1200 : fifthChainCents(k),
}));

export const aeuAt = (pos: number) => AEU.find((p) => p.pos === pos);

// ── SymbTr: the 37 positions used in practice (+ octave) ──
export const PRACTICAL = [
  0, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18, 21, 22, 24, 25, 26, 27, 28, 31, 34, 35, 36, 37, 38,
  39, 40, 43, 44, 45, 46, 47, 48, 49, 53,
];

export interface ExtraPitch {
  pos: number;
  writtenAs: string;
  makam: string;
  notes: number;
}

// The 15 practical pitches AEU cannot write (SymbTr, ≥10% of some makam's pieces and ≥3 pieces)
export const EXTRA: ExtraPitch[] = [
  { pos: 16, writtenAs: 'Segâh (1 lower)', makam: 'Tâhir, Gerdaniye 100%; Uşşak family', notes: 29080 },
  { pos: 47, writtenAs: 'Eviç (1 lower)', makam: 'Tâhir, Gerdaniye 100%', notes: 16260 },
  { pos: 37, writtenAs: 'Hisar (1 higher)', makam: 'Hüzzam 82%', notes: 7399 },
  { pos: 28, writtenAs: 'Hicaz (1 higher)', makam: 'Bestenigâr 100%, Saba 89%', notes: 4979 },
  { pos: 25, writtenAs: 'Nim Hicaz (1 lower)', makam: 'Nişâburek 96%, Yegâh 82%', notes: 3503 },
  { pos: 38, writtenAs: 'Dik Hisar (1 lower)', makam: 'Kürdîlihicazkâr 43%', notes: 1776 },
  { pos: 46, writtenAs: 'Dik Acem (1 higher)', makam: 'İsfahan 50%', notes: 642 },
  { pos: 43, writtenAs: 'Acem (1 lower)', makam: 'Yegâh 55%', notes: 558 },
  { pos: 3, writtenAs: 'Nim Zirgüle (1 lower)', makam: 'Nişâburek 88%', notes: 440 },
  { pos: 15, writtenAs: 'Dik Kürdî (1 lower)', makam: 'Muhayyerkürdî 22%', notes: 315 },
  { pos: 12, writtenAs: 'Kürdî (1 lower)', makam: 'Segâh 11%', notes: 235 },
  { pos: 7, writtenAs: 'Dik Zirgüle (1 lower)', makam: 'Kürdîlihicazkâr 14%', notes: 109 },
  { pos: 6, writtenAs: 'Zirgüle (1 higher)', makam: 'Kürdîlihicazkâr 11%', notes: 64 },
  { pos: 24, writtenAs: 'Çârgâh (2 higher)', makam: 'Sûzidil 21%', notes: 41 },
  { pos: 34, writtenAs: 'Nim Hisar (1 lower)', makam: 'Nişâburek 15%', notes: 33 },
];

export const extraAt = (pos: number) => EXTRA.find((e) => e.pos === pos);

// ── Makams and keys (Figure 2) ──
export interface ScaleNote {
  pos: number;
  share?: number; // % of this makam's notes (SymbTr)
  extra?: string; // extra tooltip line
  note?: string; // small visible annotation under the marker
}
export interface Makam {
  name: string;
  sub: string;
  notes: ScaleNote[];
  final: number;
}

export const MAKAMS: Makam[] = [
  {
    name: 'Çârgâh makam',
    sub: 'the makam closest to C major',
    final: 22,
    notes: [0, 9, 18, 22, 31, 40, 44, 53].map((pos) => ({ pos })),
  },
  {
    name: 'Rast makam',
    sub: 'theory',
    final: 0,
    notes: [
      { pos: 0 },
      { pos: 9 },
      { pos: 17, extra: 'About 15 cents below Western B', note: '−15 c vs B' },
      { pos: 22 },
      { pos: 31 },
      { pos: 40 },
      { pos: 44, extra: 'Used descending' },
      { pos: 48, extra: 'Used ascending · about 13 cents below Western F♯', note: '−13 c vs F♯' },
      { pos: 53 },
    ],
  },
  {
    name: 'Uşşak',
    sub: '118 pieces',
    final: 9,
    notes: [
      [0, 9.0], [9, 16.5], [16, 14.4], [22, 18.0], [31, 19.5], [40, 12.0], [44, 5.1],
    ].map(([pos, share]) => ({ pos, share })),
  },
  {
    name: 'Hüseynî',
    sub: '92 pieces',
    final: 9,
    notes: [
      [0, 10.8], [9, 14.0], [16, 9.6], [22, 14.6], [31, 19.1], [40, 18.6], [44, 3.9], [47, 4.0],
    ].map(([pos, share]) => ({ pos, share })),
  },
  {
    name: 'Saba',
    sub: '66 pieces',
    final: 9,
    notes: [
      [0, 7.4], [9, 13.0], [16, 15.8], [22, 24.8], [28, 13.6], [31, 2.6], [40, 10.1], [44, 6.1],
    ].map(([pos, share]) => ({ pos, share })),
  },
  {
    name: 'Hüzzam',
    sub: '96 pieces',
    final: 17,
    notes: [
      [0, 14.7], [9, 6.2], [13, 2.6], [17, 10.0], [22, 12.0], [31, 20.1], [37, 12.2], [47, 13.3],
    ].map(([pos, share]) => ({ pos, share })),
  },
];

// ── Other cultures (Figure 4) ──
export const SLENDRO_LABELS = ['1', '2', '3', '5', '6', '1'];
export const PELOG_CENTS = [0, 128, 267, 563, 702, 814, 979];

export const LU: [string, number][] = [
  ['Huangzhong', 0], ['Linzhong', 1], ['Taicu', 2], ['Nanlü', 3], ['Guxian', 4], ['Yingzhong', 5],
  ['Ruibin', 6], ['Dalü', 7], ['Yize', 8], ['Jiazhong', 9], ['Wuyi', 10], ['Zhonglü', 11],
];

export const SRUTI: string[] = [
  '1/1', '256/243', '16/15', '10/9', '9/8', '32/27', '6/5', '5/4', '81/64', '4/3', '27/20', '45/32',
  '729/512', '3/2', '128/81', '8/5', '5/3', '27/16', '16/9', '9/5', '15/8', '243/128', '2/1',
];
export const parseRatio = (r: string) => {
  const [a, b] = r.split('/').map(Number);
  return a / b;
};

// ── Ear: one comma vs. the just noticeable difference (Figure 3) ──
export const COMMA_RATIO = 2 ** (1 / 53) - 1; // ≈ 0.013164
// Read from course slide 11 (approximate); flat ≈ 3 Hz below 225 Hz.
export const JND_SLIDE11: [number, number][] = [
  [225, 3.0], [250, 3.0], [500, 3.7], [750, 4.5], [1000, 5.5], [1500, 7.5], [2000, 10.0],
  [2500, 12.0], [3000, 15.0], [3500, 19.0], [4000, 22.2], [4500, 25.8], [5000, 30.0],
];
export function jndSlide11(f: number) {
  if (f <= JND_SLIDE11[0][0]) return JND_SLIDE11[0][1];
  for (let i = 1; i < JND_SLIDE11.length; i++) {
    const [f0, d0] = JND_SLIDE11[i - 1];
    const [f1, d1] = JND_SLIDE11[i];
    if (f <= f1) return d0 + ((d1 - d0) * (f - f0)) / (f1 - f0);
  }
  return JND_SLIDE11.at(-1)![1];
}
// Wier, Jesteadt & Green (1977), fitted line: log10(Δf) = 0.026·√f − 0.533
export const jndWier = (f: number) => 10 ** (0.026 * Math.sqrt(f) - 0.533);

// ── Happy Birthday (public domain) in G, 3/4, 100 BPM: [note, octave offset from G4, beats] ──
export type HbNote = 'G' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F♯';
export const HAPPY_BIRTHDAY: [HbNote, number, number][] = [
  ['D', -1, 0.75], ['D', -1, 0.25], ['E', -1, 1], ['D', -1, 1], ['G', 0, 1], ['F♯', -1, 2],
  ['D', -1, 0.75], ['D', -1, 0.25], ['E', -1, 1], ['D', -1, 1], ['A', 0, 1], ['G', 0, 2],
  ['D', -1, 0.75], ['D', -1, 0.25], ['D', 0, 1], ['B', 0, 1], ['G', 0, 1], ['F♯', -1, 1], ['E', -1, 2],
  ['C', 0, 0.75], ['C', 0, 0.25], ['B', 0, 1], ['G', 0, 1], ['A', 0, 1], ['G', 0, 2],
];
export const HB_WESTERN: Record<HbNote, number> = { G: 0, A: 200, B: 400, C: 500, D: 700, E: 900, 'F♯': 1100 };
// Turkish (AEU) names of the melody's notes when Rast = G4. Key: note + octave offset.
export const HB_TURKISH: Record<string, string> = {
  'D-1': 'Yegâh',
  'E-1': 'Hüseynîaşîran',
  'F♯-1': 'Irak',
  'G0': 'Rast',
  'A0': 'Dügâh',
  'B0': 'Segâh',
  'C0': 'Çârgâh',
  'D0': 'Nevâ',
};
export const HB_RAST: Record<HbNote, number> = {
  G: commaToCents(0),
  A: commaToCents(9),
  B: commaToCents(17), // Segâh
  C: commaToCents(22),
  D: commaToCents(31),
  E: commaToCents(40),
  'F♯': commaToCents(48), // Eviç
};
