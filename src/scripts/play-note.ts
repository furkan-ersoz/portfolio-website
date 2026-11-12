// ─────────────────────────────────────────────────────────────
// PLAY A NOTE — the single hook every interactive figure in the blog calls.
//
//   playNote(freqHz, durationMs = 600)        one note, right now
//   playSequence(notes, { onStep, onEnd })    notes one after another (returns stop())
//   playTones(tones, { onStep, onEnd })       exact-length test tones (sine, 5 ms ramps by default),
//                                             each at its own onset; for listening experiments
//
// Sound only ever starts inside a click / key press (these functions are only
// called from event handlers), so nothing plays before the visitor's first interaction.
//
// It follows the Volume fader of the sound panel (bottom-right): the panel saves its
// values to sessionStorage on every change, so we read the latest value from there.
// Volume "Off" = silent (the functions return false so a figure can say so).
// Phones/tablets have no panel; there the panel's default volume is used.
//
// TODO(furkan): route this through the site's sound engine (src/scripts/music.js)
// instead of its own small AudioContext. Suggested wiring: in music.js export a
// `noteInput()` that returns { ctx, input } where `input` is a GainNode connected to
// `n.fx` (so Space adds reverb) or straight to `n.master` (so Vol applies without
// reading sessionStorage). Then replace getOutput() below with it and drop volumeLevel().
// Keep in mind music.js is never loaded on touch-only devices (see MusicPanel.astro),
// so phones still need this fallback.
// ─────────────────────────────────────────────────────────────
import { CONTROLS } from './music-controls.js';

const STORAGE_KEY = 'music-controls'; // same key as music.js
const ATTACK = 0.012; // s — short, but long enough to avoid clicks
const RELEASE = 0.06; // s

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let wave: PeriodicWave | null = null;

/** The panel's Volume (0…1). */
function volume(): number {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    if (typeof saved.volume === 'number') return Math.min(1, Math.max(0, saved.volume));
  } catch {
    // storage unavailable: use the default
  }
  return CONTROLS.volume.default;
}

/** Peak level of one note for the current Volume (0 = muted). */
function volumeLevel(): number {
  const v = volume();
  return v <= 0 ? 0 : 0.5 * Math.sqrt(v);
}

export const isMuted = () => volumeLevel() === 0;

// ── iPhone / iPad: play even when the silent switch is on ──
// iOS treats Web Audio as "ambient" sound, which the ring/silent switch mutes (also inside
// in-app browsers like LinkedIn's). Media playback is not muted, so we ask for that:
//   1. Safari 16.4+: navigator.audioSession.type = 'playback'
//   2. older iOS: start a silent, looping <audio> element inside the tap, which switches
//      the page's audio session to playback for as long as it runs.
let iosUnlocked = false;
function unlockIOSAudio() {
  if (iosUnlocked) return;
  iosUnlocked = true;
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  try {
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch {
    // not supported: the fallback below still runs
  }
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return;
  try {
    const el = document.createElement('audio');
    el.setAttribute('x-webkit-airplay', 'deny');
    el.preload = 'auto';
    el.loop = true;
    el.src = silentWavUrl();
    el.volume = 0;
    void el.play().catch(() => {});
  } catch {
    // ignore: worst case the silent switch still mutes the notes
  }
}

/** A 0.5 s silent mono WAV as a blob URL. */
function silentWavUrl(): string {
  const rate = 8000;
  const samples = rate / 2;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function getOutput(): { ctx: AudioContext; out: GainNode } | null {
  unlockIOSAudio(); // must run inside the tap, like creating the AudioContext
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' }) as AudioContext;
    // a gentle limiter so overlapping notes never clip
    const limiter = new DynamicsCompressorNode(ctx, { threshold: -6, knee: 4, ratio: 12, attack: 0.002, release: 0.15 });
    out = new GainNode(ctx, { gain: 1 });
    out.connect(limiter).connect(ctx.destination);
    // a soft, slightly reedy tone: the fundamental plus a few quiet harmonics
    // (pure sines vanish on phone speakers in the bass)
    const harmonics = [0, 1, 0.45, 0.25, 0.12, 0.06];
    wave = ctx.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics));
  }
  if (ctx.state !== 'running') void ctx.resume();
  return { ctx, out: out! };
}

function scheduleNote(c: AudioContext, dest: AudioNode, freq: number, start: number, seconds: number, peak: number) {
  const osc = new OscillatorNode(c, { frequency: freq });
  osc.setPeriodicWave(wave!);
  const env = new GainNode(c, { gain: 0 });
  const end = start + Math.max(seconds, ATTACK + RELEASE);
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(peak, start + ATTACK);
  env.gain.setValueAtTime(peak, end - RELEASE);
  env.gain.linearRampToValueAtTime(0, end);
  osc.connect(env).connect(dest);
  osc.start(start);
  osc.stop(end + 0.02);
  osc.onended = () => env.disconnect();
}

/**
 * Play one note. Returns false when nothing was played (Volume off or no Web Audio).
 */
export function playNote(freqHz: number, durationMs = 600): boolean {
  const peak = volumeLevel();
  if (peak === 0) return false;
  const o = getOutput();
  if (!o) return false;
  scheduleNote(o.ctx, o.out, freqHz, o.ctx.currentTime + 0.005, durationMs / 1000, peak);
  return true;
}

export interface SequenceNote {
  freq: number; // 0 = rest
  ms: number; // slot length
  gate?: number; // part of the slot that sounds (default 0.95 = slightly detached)
}

let stopCurrent: (() => void) | null = null;

/**
 * Play notes one after another. Starting a new sequence stops the previous one.
 * Returns stop(), or null when nothing was played.
 */
export function playSequence(
  notes: SequenceNote[],
  { onStep, onEnd }: { onStep?: (i: number) => void; onEnd?: () => void } = {},
): (() => void) | null {
  stopCurrent?.();
  const peak = volumeLevel();
  if (peak === 0) return null;
  const o = getOutput();
  if (!o) return null;
  const { ctx: c } = o;
  const bus = new GainNode(c, { gain: 1 });
  bus.connect(o.out);

  const t0 = c.currentTime + 0.05;
  const timers: number[] = [];
  let t = t0;
  notes.forEach((n, i) => {
    if (n.freq > 0) scheduleNote(c, bus, n.freq, t, (n.ms / 1000) * (n.gate ?? 0.95), peak);
    if (onStep) timers.push(window.setTimeout(() => onStep(i), (t - c.currentTime) * 1000));
    t += n.ms / 1000;
  });

  let stopped = false;
  const finish = () => {
    if (stopped) return;
    stopped = true;
    timers.forEach(clearTimeout);
    if (stopCurrent === stop) stopCurrent = null;
    onEnd?.();
  };
  timers.push(window.setTimeout(finish, (t - c.currentTime) * 1000 + 50));

  function stop() {
    bus.gain.setTargetAtTime(0, c.currentTime, 0.02);
    window.setTimeout(() => bus.disconnect(), 200);
    finish();
  }
  stopCurrent = stop;
  return stop;
}

// ── Exact test tones ─────────────────────────────────────────
// Durations are scheduled on the audio clock (sample-accurate), not rounded to animation frames.

export interface Tone {
  freqHz: number;
  durationMs: number;
  onsetMs: number; // from the start of the sequence
  attackMs?: number; // default 5
  releaseMs?: number; // default 5
  wave?: OscillatorType; // default 'sine'
}

export interface ScheduledTone {
  freqHz: number;
  start: number; // AudioContext time, s
  stop: number;
}

function scheduleTone(c: AudioContext, dest: AudioNode, t: Tone, start: number, peak: number): ScheduledTone {
  const dur = t.durationMs / 1000;
  const attack = Math.min((t.attackMs ?? 5) / 1000, dur / 2);
  const release = Math.min((t.releaseMs ?? 5) / 1000, dur / 2);
  const stop = start + dur;
  const osc = new OscillatorNode(c, { type: t.wave ?? 'sine', frequency: t.freqHz });
  const env = new GainNode(c, { gain: 0 });
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(peak, start + attack);
  env.gain.setValueAtTime(peak, stop - release);
  env.gain.linearRampToValueAtTime(0, stop);
  osc.connect(env).connect(dest);
  osc.start(start);
  osc.stop(stop);
  osc.onended = () => env.disconnect();
  return { freqHz: t.freqHz, start, stop };
}

/**
 * Play exact-length tones at their onsets. Starting a new sequence stops the previous one.
 * Returns { stop, schedule } (schedule = the exact start/stop times), or null when nothing was played.
 */
export function playTones(
  tones: Tone[],
  { onStep, onEnd }: { onStep?: (i: number) => void; onEnd?: () => void } = {},
): { stop: () => void; schedule: ScheduledTone[] } | null {
  stopCurrent?.();
  const peak = volumeLevel();
  if (peak === 0) return null;
  const o = getOutput();
  if (!o) return null;
  const { ctx: c } = o;
  const bus = new GainNode(c, { gain: 1 });
  bus.connect(o.out);

  const t0 = c.currentTime + 0.05;
  const schedule = tones.map((t) => scheduleTone(c, bus, t, t0 + t.onsetMs / 1000, peak));
  if (import.meta.env.DEV) {
    console.debug(
      '[playTones]',
      schedule.map((s) => `${s.freqHz.toFixed(2)} Hz: ${((s.stop - s.start) * 1000).toFixed(2)} ms`).join(' · '),
    );
  }
  const timers = onStep
    ? schedule.map((s, i) => window.setTimeout(() => onStep(i), (s.start - c.currentTime) * 1000))
    : [];
  const end = Math.max(t0, ...schedule.map((s) => s.stop));

  let stopped = false;
  const finish = () => {
    if (stopped) return;
    stopped = true;
    timers.forEach(clearTimeout);
    if (stopCurrent === stop) stopCurrent = null;
    onEnd?.();
  };
  timers.push(window.setTimeout(finish, (end - c.currentTime) * 1000 + 50));

  function stop() {
    bus.gain.setTargetAtTime(0, c.currentTime, 0.01);
    window.setTimeout(() => bus.disconnect(), 150);
    finish();
  }
  stopCurrent = stop;
  (window as any).__lastToneSchedule = schedule; // handy for checking exact timings in the console
  return { stop, schedule };
}
