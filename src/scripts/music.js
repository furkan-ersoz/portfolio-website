// ─────────────────────────────────────────────────────────────
// SOUND ENGINE (computers only — phones and tablets get no sound)
// An atmospheric background sound built with the browser's Web Audio API
// (nothing to download). It only *reads* mouse input from the window;
// it never touches the visuals and never blocks clicks or scrolling.
//
// Layers:
//   1. RUMBLE      very deep noise. Always there while the sound is on.
//   2. SWELL       dark atmospheric noise that slowly breathes in and out.
//   3. MOUSE NOISE quiet noise through a band-pass filter;
//                  the filter frequency follows the mouse left → right.
//   4. SYNTH       one wide synth sound on a single note. It plays while the mouse
//                  moves or is pressed and stops when that stops. The faster the
//                  movement and the longer the press, the more aggressive it gets.
//   TONE sets the levels of the layers (never pitches or filters).
//   SPACE sets reverb + echo.
//
//   layers → dry + reverb + delay → compressor → master (volume) → fade → limiter → speakers
//
// The numbers in the "SOUND DESIGN" section below are safe to play with.
// ─────────────────────────────────────────────────────────────
import { CONTROLS, clampControl } from './music-controls.js';

const STORAGE_KEY = 'music-controls';
const MAX_GAIN = 6; // master gain at Volume 100% (the limiter keeps peaks in check)
const SYNTH_NOTE = 73.42; // the synth's single note in Hz (D2)
const CLICK_MS = 300; // a single click sounds at least this long

// ── Control values (remembered for this visit) ──
/** @type {{ tone: number, space: number, volume: number }} */
export const state = {
  tone: CONTROLS.tone.default,
  space: CONTROLS.space.default,
  volume: CONTROLS.volume.default,
};
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  for (const name of /** @type {const} */ (['tone', 'space', 'volume'])) {
    if (typeof saved[name] === 'number') state[name] = clampControl(name, saved[name]);
  }
} catch {
  // storage unavailable: keep defaults
}

// ── Mouse input (passive listeners: never blocks anything) ──
const input = {
  x: 0.5, // 0 = left, 1 = right
  rawSpeed: 0, // latest movement speed, 0…1
  speed: 0, // smoothed movement speed, 0…1
  holding: false, // mouse button held down
  pressTime: 0, // seconds the current press has lasted
  clickUntil: 0, // a click keeps the synth on at least until this time (ms)
  lastX: 0,
  lastY: 0,
  lastT: 0,
};

/** @param {number} clientX @param {number} clientY */
function move(clientX, clientY) {
  const now = performance.now();
  if (input.lastT && now - input.lastT < 200) {
    const dt = Math.max(8, now - input.lastT) / 1000;
    const dist = Math.hypot(clientX - input.lastX, clientY - input.lastY);
    const screensPerSecond = dist / Math.hypot(window.innerWidth, window.innerHeight) / dt;
    input.rawSpeed = Math.max(input.rawSpeed, Math.min(1, screensPerSecond / 2));
  }
  input.lastX = clientX;
  input.lastY = clientY;
  input.lastT = now;
  input.x = clientX / window.innerWidth;
}

const release = () => (input.holding = false);
window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
window.addEventListener(
  'pointerdown',
  (e) => {
    move(e.clientX, e.clientY);
    input.holding = true;
    input.clickUntil = performance.now() + CLICK_MS;
  },
  { passive: true },
);
window.addEventListener('pointerup', release, { passive: true });
window.addEventListener('pointercancel', release, { passive: true });
window.addEventListener('blur', release);

// Browsers only allow sound after a click or key press (moving or scrolling doesn't count),
// so the sound starts on the visitor's first one.
const GESTURES = ['pointerdown', 'keydown'];
let everStarted = false;
const firstGesture = () => {
  if (everStarted) return;
  GESTURES.forEach((t) => window.removeEventListener(t, firstGesture, true));
  if (state.volume > 0) start();
};
GESTURES.forEach((t) => window.addEventListener(t, firstGesture, true));

// ── Audio graph (built on first start) ──
/** @type {AudioContext} */
let ctx;
/** @type {Record<string, any>} */
let n; // all the nodes we change later
let running = false;
/** @type {number | null} */
let tickId = null;
let suspendTimer = 0;
let resumeWhenVisible = false;

// waiting = the fader is up but the visitor hasn't clicked yet
const status = () => ({ playing: running, waiting: !everStarted && state.volume > 0 });
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(status()));
/** @param {(status: { playing: boolean, waiting: boolean }) => void} fn */
export const onStatusChange = (fn) => {
  listeners.add(fn);
  fn(status());
};

// Smoothly move an AudioParam towards a value. (No cancelling: every new glide starts
// from wherever the value currently is, so nothing ever jumps or clicks.)
/** @param {AudioParam} param @param {number} value */
function glide(param, value, time = 0.05) {
  param.setTargetAtTime(value, ctx.currentTime, time);
}

/** @param {'white' | 'brown'} type */
function noiseBuffer(type, seconds = 4) {
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'white') data[i] = white * 0.5;
    else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buffer;
}

/** A stereo reverb impulse: decaying noise. @param {number} seconds */
function reverbBuffer(seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
}

/** @param {AudioBuffer} buffer */
function loopSource(buffer) {
  const src = new AudioBufferSourceNode(ctx, { buffer, loop: true });
  src.start(0, Math.random() * 2); // start at different points so copies don't line up
  return src;
}

/** @param {OscillatorType} type @param {number} frequency */
function osc(type, frequency) {
  const o = new OscillatorNode(ctx, { type, frequency });
  o.start();
  return o;
}

/** @param {BiquadFilterType} type @param {number} frequency */
const filter = (type, frequency, Q = 0.7) => new BiquadFilterNode(ctx, { type, frequency, Q });
const gain = (value = 1) => new GainNode(ctx, { gain: value });

function buildGraph() {
  ctx = new AudioContext({ latencyHint: 'playback' });
  const white = noiseBuffer('white');
  const brown = noiseBuffer('brown');
  n = {};

  // Everything sums here.
  n.bus = gain(1);
  n.atmosphere = filter('lowpass', 380, 0.7); // keeps the background dark
  n.atmosphere.connect(n.bus);

  // 1. RUMBLE: very deep noise ─────────────────────
  n.rumbleLP = filter('lowpass', 90);
  n.rumbleGain = gain(0.5); // Tone
  loopSource(brown).connect(n.rumbleLP).connect(n.rumbleGain).connect(n.atmosphere);

  // 2. SWELL: dark atmospheric noise, slowly breathing ─
  n.swellBP = filter('bandpass', 110, 2.5);
  n.swellBreath = gain(0.5);
  n.swellAmount = gain(1); // Tone
  loopSource(brown).connect(n.swellBP).connect(n.swellBreath).connect(n.swellAmount).connect(n.atmosphere);
  n.swellLFO = osc('sine', 0.06);
  n.swellDepth = gain(0.5);
  n.swellLFO.connect(n.swellDepth).connect(n.swellBreath.gain);

  // 3. MOUSE NOISE (parallel, quiet) ───────────────
  n.mouseBP = filter('bandpass', 400, 4);
  n.mouseGain = gain(0);
  loopSource(white).connect(n.mouseBP).connect(n.mouseGain).connect(n.bus);

  // 4. SYNTH: one wide note ────────────────────────
  // detuned saws spread left/right + an octave layer → drive → filter → envelope (+ a clean sub)
  n.synthMix = gain(0.35);
  n.synthHigh = gain(0); // octave layer, grows with aggression
  /** @type {{ osc: OscillatorNode, side: number }[]} */
  n.saws = [];
  for (const [multiplier, target] of [
    [1, n.synthMix],
    [2, n.synthHigh],
  ]) {
    for (const side of [-1, 1]) {
      const o = osc('sawtooth', SYNTH_NOTE * multiplier);
      const pan = new StereoPannerNode(ctx, { pan: side * 0.75 });
      o.connect(pan).connect(target);
      n.saws.push({ osc: o, side });
    }
  }
  n.synthHigh.connect(n.synthMix);
  n.vibrato = osc('sine', 4.8);
  n.vibratoDepth = gain(4); // cents
  n.vibrato.connect(n.vibratoDepth);
  n.saws.forEach((/** @type {{ osc: OscillatorNode }} */ s) => n.vibratoDepth.connect(s.osc.detune));

  n.synthDrive = gain(1);
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 1.5);
  n.synthShaper = new WaveShaperNode(ctx, { curve, oversample: '4x' });
  n.synthPost = gain(1);
  n.synthLP = filter('lowpass', 300, 2);
  n.synthEnv = gain(0); // on while moving/pressing
  n.synthLevel = gain(0); // Tone
  n.synthMix.connect(n.synthDrive).connect(n.synthShaper).connect(n.synthPost).connect(n.synthLP);
  n.synthLP.connect(n.synthEnv).connect(n.synthLevel).connect(n.bus);
  // the sub stays clean (distorting a very low tone turns it into a clicking buzz)
  n.sub = osc('sine', SYNTH_NOTE / 2);
  n.subGain = gain(0.22);
  n.sub.connect(n.subGain).connect(n.synthEnv);

  // SPACE: dry + two reverbs (short/long) + feedback delay ─
  n.fx = gain(1); // sum of dry + effects
  n.dry = gain(1);
  n.bus.connect(n.dry).connect(n.fx);

  n.revShort = new ConvolverNode(ctx, { buffer: reverbBuffer(1.4) });
  n.revLong = new ConvolverNode(ctx, { buffer: reverbBuffer(7) });
  n.revShortGain = gain(0);
  n.revLongGain = gain(0);
  n.bus.connect(n.revShort).connect(n.revShortGain).connect(n.fx);
  n.bus.connect(n.revLong).connect(n.revLongGain).connect(n.fx);

  n.delaySend = gain(0);
  n.delay = new DelayNode(ctx, { maxDelayTime: 2, delayTime: 0.4 });
  n.delayLP = filter('lowpass', 2400);
  n.delayHP = filter('highpass', 150);
  n.feedback = gain(0.3);
  n.bus.connect(n.delaySend).connect(n.delay);
  n.delay.connect(n.delayLP).connect(n.delayHP).connect(n.feedback).connect(n.delay);
  n.delayOut = gain(1);
  n.delay.connect(n.delayOut).connect(n.fx);
  n.delayOut.connect(n.revLong); // echoes smear into the long reverb

  // DYNAMICS + OUTPUT (fixed settings: nothing here moves while playing) ─
  n.comp = new DynamicsCompressorNode(ctx, { threshold: -12, knee: 8, ratio: 2, attack: 0.01, release: 0.3 });
  n.master = gain(0);
  n.fade = gain(0);
  n.limiter = new DynamicsCompressorNode(ctx, { threshold: -8, knee: 0, ratio: 20, attack: 0.003, release: 0.25 });
  n.trim = gain(0.6); // the browser compressor adds make-up gain; trim it back
  n.fx.connect(n.comp).connect(n.master).connect(n.fade).connect(n.limiter).connect(n.trim).connect(ctx.destination);

  applyTone(0.01);
  applySpace(0.01);
}

// ═════════════════════════════════════════════════════════════
//  SOUND DESIGN — how the knobs and the mouse shape the sound
// ═════════════════════════════════════════════════════════════

// TONE: only levels. 0 = a thin, quiet background … 1 = heavy rumble, big swell, mouse noise and synth up front.
// (Mouse noise and synth levels are also multiplied by this in applyInput.)
const toneMix = () => ({
  rumble: 0.2 + 0.8 * state.tone,
  swell: 0.8 + 2.2 * state.tone,
  mouse: 0.3 + 0.7 * state.tone,
  synth: 0.35 + 0.65 * state.tone,
});

function applyTone(time = 0.3) {
  const mix = toneMix();
  glide(n.rumbleGain.gain, mix.rumble, time);
  glide(n.swellAmount.gain, mix.swell, time);
  glide(n.synthLevel.gain, mix.synth, time);
}

// SPACE: 0 = close and dry … 1 = huge reverb and long, dense echoes.
function applySpace(time = 0.3) {
  const s = state.space;
  glide(n.dry.gain, 1 - 0.45 * s, time);
  glide(n.revShortGain.gain, 0.6 * (1 - s) + 0.1, time);
  glide(n.revLongGain.gain, 1.6 * s, time);
  glide(n.delaySend.gain, 0.65 * s, time);
  glide(n.delay.delayTime, 0.18 + 0.6 * s, 0.6); // slow glide = tape-like, no clicks
  glide(n.feedback.gain, 0.15 + 0.62 * s, time);
  glide(n.delayLP.frequency, 3500 - 1800 * s, time);
}

/** Smoothing that doesn't depend on the frame rate. @param {number} current @param {number} target @param {number} tau @param {number} dt */
const ease = (current, target, tau, dt) => current + (target - current) * (1 - Math.exp(-dt / tau));

// Runs ~30 times a second while the sound is on.
function applyInput(/** @type {number} */ dt) {
  // movement speed: rises fast, falls quickly once the mouse stops
  input.speed = ease(input.speed, input.rawSpeed, input.rawSpeed > input.speed ? 0.05 : 0.15, dt);
  input.rawSpeed *= Math.exp(-dt / 0.06);
  input.pressTime = input.holding ? input.pressTime + dt : 0;
  const { x, speed, pressTime } = input;
  const mix = toneMix();

  // MOUSE NOISE: band-pass follows the mouse left → right (100 Hz … 2.5 kHz),
  // a little quieter towards the right (higher bands hold more noise energy).
  glide(n.mouseBP.frequency, 100 * 2 ** (x * 4.6), 0.08);
  const highCut = 2 ** (-x * 3.6);
  glide(n.mouseGain.gain, (0.14 + 0.12 * speed) * highCut * mix.mouse, 0.08);

  // SYNTH: on while moving or pressing (a click lasts at least CLICK_MS), off when that stops.
  const active = input.holding || speed > 0.04 || performance.now() < input.clickUntil;
  // aggression grows with movement speed and with how long the press lasts (full after ~3 s)
  const a = Math.min(1, speed * 1.2 + pressTime / 3);
  glide(n.synthEnv.gain, active ? 0.12 + 0.16 * a : 0, active ? 0.03 : 0.15);
  glide(n.synthLP.frequency, 300 + 6000 * a ** 1.4, 0.06);
  glide(n.synthLP.Q, 2 + 5 * a, 0.06);
  glide(n.synthDrive.gain, 1 + 14 * a, 0.06); // saturation (synth only)
  glide(n.synthPost.gain, 1 / (1 + 2.2 * a), 0.06); // only partly compensated → louder when aggressive
  glide(n.synthHigh.gain, 0.15 + 0.7 * a, 0.06);
  for (const s of n.saws) glide(s.osc.detune, s.side * (6 + 24 * a), 0.06); // wider when aggressive

  // MASTER: the Volume fader, a touch louder while moving fast or pressing
  const level = state.volume ** 2 * MAX_GAIN * (1 + 0.2 * speed + 0.25 * Math.min(1, pressTime / 3));
  glide(n.master.gain, level, 0.06);
}
// ═════════════════════════════════════════════════════════════

let lastTick = 0;
function tick() {
  const now = performance.now();
  applyInput(Math.min(0.1, (now - lastTick) / 1000));
  lastTick = now;
}

function start() {
  if (running) return;
  running = true;
  everStarted = true;
  clearTimeout(suspendTimer);
  // Create / resume the audio right inside the click (required by browsers).
  if (!ctx) buildGraph();
  ctx.resume();
  glide(n.fade.gain, 1, 0.5); // fade in
  if (tickId === null) {
    lastTick = performance.now();
    tickId = window.setInterval(tick, 33);
  }
  emit();
}

function stop() {
  if (!running) return;
  running = false;
  glide(n.fade.gain, 0, 0.12); // fade out
  clearTimeout(suspendTimer);
  suspendTimer = window.setTimeout(() => {
    if (tickId !== null) clearInterval(tickId);
    tickId = null;
    ctx.suspend(); // no audio processing while off
  }, 700);
  emit();
}

/** @param {keyof typeof CONTROLS} name @param {number} value */
export function setControl(name, value) {
  state[name] = clampControl(name, value);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable: values still work for this page
  }
  if (name === 'volume') {
    if (state.volume > 0) start();
    else stop();
    emit();
  }
  if (ctx && name === 'tone') applyTone();
  if (ctx && name === 'space') applySpace();
  return state[name];
}

// Fade out when the tab is hidden; come back only if it was on.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) {
    stop();
    resumeWhenVisible = true;
  } else if (!document.hidden && resumeWhenVisible) {
    resumeWhenVisible = false;
    if (state.volume > 0) start();
  }
});
