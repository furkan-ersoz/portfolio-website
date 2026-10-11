// ─────────────────────────────────────────────────────────────
// MUSIC ENGINE
// Plays the Strudel pattern from music-pattern.js and connects it to
// the mouse and the panel controls. Completely separate from the
// background visuals: it only listens to mouse/touch positions.
//
// Signal chain:  Strudel (superdough) → master gain (volume + fades) → limiter → trim → speakers
// Strudel itself is only downloaded the first time someone presses Play.
// ─────────────────────────────────────────────────────────────
import { CONTROLS, clampControl } from './music-controls.js';

const STORAGE_KEY = 'music-controls';
const FADE_IN = 0.4; // seconds (time constant)
const FADE_OUT = 0.12;
const STOP_AFTER_MS = 700; // stop the scheduler once the fade-out is silent
const MAX_GAIN = 2.5; // master gain at Volume 100% (the limiter keeps peaks around -10 dB)

// Live values read by the pattern through ref().
/** @type {{ mouseX: number, mouseY: number, tone: number, space: number, speed: number, volume: number }} */
export const state = {
  mouseX: 0.5, // 0 = left, 1 = right (smoothed)
  mouseY: 0.5, // 0 = bottom, 1 = top (smoothed)
  ...Object.fromEntries(Object.entries(CONTROLS).map(([name, c]) => [name, c.default])),
};

// Restore knob positions from earlier in this visit.
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  for (const name of Object.keys(CONTROLS)) {
    if (typeof saved[name] === 'number') state[name] = clampControl(name, saved[name]);
  }
} catch {
  // storage unavailable: keep defaults
}

// ── Mouse / touch position (only read, never blocks anything) ──
const target = { x: 0.5, y: 0.5 };
function track(e) {
  target.x = e.clientX / window.innerWidth;
  target.y = 1 - e.clientY / window.innerHeight;
}
window.addEventListener('pointermove', track, { passive: true });
window.addEventListener('pointerdown', track, { passive: true });

let smoothingId = null;
function smooth() {
  state.mouseX += (target.x - state.mouseX) * 0.08;
  state.mouseY += (target.y - state.mouseY) * 0.08;
  smoothingId = requestAnimationFrame(smooth);
}

// Low-pass cutoff: Tone sets the base (≈150 Hz – 13 kHz), mouse Y moves it ±1.5 octaves.
function brightnessHz() {
  const base = 150 * 2 ** (state.tone * 6.5);
  const mod = 2 ** ((state.mouseY - 0.5) * 3);
  return Math.min(16000, Math.max(80, base * mod));
}

const volumeGain = () => state.volume ** 2 * MAX_GAIN; // feels more even than linear
const cps = () => state.speed / 60 / 4; // one cycle = one 4-beat bar

// ── Audio engine (created on first Play) ──
let ctx = null;
let master = null;
let repl = null;
let pattern = null;
let enginePromise = null;
let stopTimer = null;
let playing = false;
let loading = false;
let resumeWhenVisible = false;

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn({ playing, loading }));
/** @param {(status: { playing: boolean, loading: boolean }) => void} fn */
export const onStatusChange = (fn) => {
  listeners.add(fn);
  fn({ playing, loading });
};

function createAudioContext() {
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  // The browser's compressor adds its own make-up gain; this trim keeps the loudest peaks around -8 dB.
  const trim = ctx.createGain();
  trim.gain.value = 0.6;
  master.connect(limiter).connect(trim).connect(ctx.destination);
}

async function loadEngine() {
  const strudel = await import('@strudel/web');
  repl = await strudel.initStrudel({ audioContext: ctx });
  await strudel.initAudio();

  // Route Strudel's output through our master gain + limiter instead of straight to the speakers.
  const output = strudel.getSuperdoughAudioController().output;
  output.destinationGain.disconnect();
  output.destinationGain.connect(master);

  const { ref } = strudel;
  const { pattern: makePattern } = await import('./music-pattern.js');
  pattern = makePattern({
    mouseX: ref(() => state.mouseX),
    mouseY: ref(() => state.mouseY),
    degree: ref(() => Math.round(state.mouseX * 7)),
    brightness: ref(brightnessHz),
    space: ref(() => state.space * 0.85),
    state,
  });
}

export async function play() {
  if (playing) return;
  playing = true;
  resumeWhenVisible = false;
  clearTimeout(stopTimer);

  // Create/resume the audio context right inside the click (required by browsers).
  if (!ctx) createAudioContext();
  ctx.resume();

  if (!pattern) {
    loading = true;
    emit();
    try {
      enginePromise ??= loadEngine();
      await enginePromise;
    } catch (err) {
      console.error('Music could not start:', err);
      enginePromise = null;
      playing = false;
      loading = false;
      emit();
      return;
    }
    loading = false;
    if (!playing) return emit(); // stopped while loading
  }
  emit();

  await ctx.resume();
  repl.setCps(cps());
  await repl.setPattern(pattern, true);

  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.setTargetAtTime(volumeGain(), now, FADE_IN);

  if (smoothingId === null) smooth();
}

export function stop() {
  if (!playing) return;
  playing = false;
  emit();
  if (!ctx) return;
  if (!repl) {
    ctx.suspend(); // stopped while still loading
    return;
  }

  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.setTargetAtTime(0, now, FADE_OUT);

  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    repl.stop();
    ctx.suspend(); // no audio processing while stopped
    cancelAnimationFrame(smoothingId);
    smoothingId = null;
  }, STOP_AFTER_MS);
}

export const toggle = () => (playing ? stop() : play());

/** @param {keyof typeof CONTROLS} name @param {number} value */
export function setControl(name, value) {
  state[name] = clampControl(name, value);
  try {
    const saved = Object.fromEntries(Object.keys(CONTROLS).map((n) => [n, state[n]]));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // storage unavailable: values still work for this page
  }
  if (name === 'speed' && repl) repl.setCps(cps());
  if (name === 'volume' && playing && master) {
    master.gain.setTargetAtTime(volumeGain(), ctx.currentTime, 0.05);
  }
  return state[name];
}

// Fade out when the tab is hidden; come back only if it was playing.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing) {
    stop();
    resumeWhenVisible = true;
  } else if (!document.hidden && resumeWhenVisible) {
    play();
  }
});
