// ─────────────────────────────────────────────────────────────
// SOUND ENGINE
// An atmospheric background sound built with the browser's Web Audio API
// (nothing to download). It only *reads* mouse/touch input from the window;
// it never touches the visuals and never blocks clicks or scrolling.
//
// Three layers:
//   1. ATMOSPHERE  rumble + wind + air + a low drone.        Shaped by TONE.
//   2. MOUSE NOISE very quiet noise through a band-pass filter;
//                  the filter frequency follows the mouse left → right.
//   3. GESTURE     a growling synth that only sounds while the mouse moves
//                  (faster = louder/brighter) or a button/finger is held.
//
//   layers → drive (saturation) → dry + reverb + delay (SPACE) → compressor
//          → master (volume, movement, hold) → fade → limiter → speakers
//
// Holding the mouse button / a finger makes everything more aggressive:
// more saturation, harder compression, a bit louder.
// The numbers in the "SOUND DESIGN" section below are safe to play with.
// ─────────────────────────────────────────────────────────────
import { CONTROLS, clampControl } from './music-controls.js';

const STORAGE_KEY = 'music-controls';
const MAX_GAIN = 1.6; // master gain at Volume 100% (the limiter keeps peaks in check)

// ── Control values (Tone and Space are remembered for this visit; Volume always starts Off) ──
/** @type {{ tone: number, space: number, volume: number }} */
export const state = {
  tone: CONTROLS.tone.default,
  space: CONTROLS.space.default,
  volume: CONTROLS.volume.default,
};
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  for (const name of /** @type {const} */ (['tone', 'space'])) {
    if (typeof saved[name] === 'number') state[name] = clampControl(name, saved[name]);
  }
} catch {
  // storage unavailable: keep defaults
}

// ── Mouse / touch input (passive listeners: never blocks anything) ──
const input = {
  x: 0.5, // 0 = left, 1 = right
  y: 0.5, // 0 = bottom, 1 = top
  rawSpeed: 0, // latest movement speed, 0…1
  speed: 0, // smoothed movement speed, 0…1
  holding: false, // mouse button / finger held down
  intensity: 0, // smoothed hold amount, 0…1
  lastX: 0,
  lastY: 0,
  lastT: 0,
};

function move(clientX, clientY) {
  const now = performance.now();
  if (input.lastT && now - input.lastT < 200) {
    const dt = Math.max(8, now - input.lastT) / 1000;
    const dist = Math.hypot(clientX - input.lastX, clientY - input.lastY);
    const screensPerSecond = dist / Math.hypot(window.innerWidth, window.innerHeight) / dt;
    input.rawSpeed = Math.max(input.rawSpeed, Math.min(1, screensPerSecond / 1.5));
  }
  input.lastX = clientX;
  input.lastY = clientY;
  input.lastT = now;
  input.x = clientX / window.innerWidth;
  input.y = 1 - clientY / window.innerHeight;
}

window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
window.addEventListener(
  'pointerdown',
  (e) => {
    move(e.clientX, e.clientY);
    if (e.pointerType !== 'touch') input.holding = true; // touch holds are handled below
  },
  { passive: true },
);
const release = () => (input.holding = false);
window.addEventListener('pointerup', release, { passive: true });
window.addEventListener('pointercancel', release, { passive: true });
window.addEventListener('blur', release);

// Touch: moving the finger (scrolling) counts as movement; holding it still counts as a hold.
/** @type {{ x: number, y: number } | null} */
let touchStart = null;
let holdTimer = 0;
window.addEventListener(
  'touchstart',
  (e) => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
    move(t.clientX, t.clientY);
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => (input.holding = true), 250);
  },
  { passive: true },
);
window.addEventListener(
  'touchmove',
  (e) => {
    const t = e.touches[0];
    move(t.clientX, t.clientY);
    if (touchStart && Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) > 12) {
      clearTimeout(holdTimer);
      input.holding = false;
    }
  },
  { passive: true },
);
const touchEnd = () => {
  clearTimeout(holdTimer);
  touchStart = null;
  input.holding = false;
};
window.addEventListener('touchend', touchEnd, { passive: true });
window.addEventListener('touchcancel', touchEnd, { passive: true });

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

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn({ playing: running }));
/** @param {(status: { playing: boolean }) => void} fn */
export const onStatusChange = (fn) => {
  listeners.add(fn);
  fn({ playing: running });
};

/** Smoothly move an AudioParam to a value. @param {AudioParam} param @param {number} value */
function glide(param, value, time = 0.05) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, time);
}

/** @param {'white' | 'pink' | 'brown'} type */
function noiseBuffer(type, seconds = 4) {
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'white') data[i] = white * 0.5;
    else if (type === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      // pink (simple 3-pole approximation)
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
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
  const pink = noiseBuffer('pink');
  const brown = noiseBuffer('brown');
  n = {};

  // Everything sums here.
  n.bus = gain(1);

  // 1. ATMOSPHERE ────────────────────────────────
  n.bedFilter = filter('lowpass', 2000, 0.7);
  n.bedFilter.connect(n.bus);

  // rumble: brown noise, very low
  n.rumbleLP = filter('lowpass', 120);
  n.rumbleGain = gain(0.3);
  loopSource(brown).connect(n.rumbleLP).connect(n.rumbleGain).connect(n.bedFilter);

  // wind: pink noise through a slowly wandering band-pass, with slow gusts
  n.windBP = filter('bandpass', 800, 2);
  n.windGain = gain(0.2);
  loopSource(pink).connect(n.windBP).connect(n.windGain).connect(n.bedFilter);
  n.windLFO = osc('sine', 0.08);
  n.windDepth = gain(300);
  n.windLFO.connect(n.windDepth).connect(n.windBP.frequency);
  n.gustLFO = osc('sine', 0.045);
  n.gustDepth = gain(0.08);
  n.gustLFO.connect(n.gustDepth).connect(n.windGain.gain);

  // air: high, thin hiss
  n.airHP = filter('highpass', 5000);
  n.airGain = gain(0.02);
  loopSource(white).connect(n.airHP).connect(n.airGain).connect(n.bedFilter);

  // drone: low, slowly beating, inharmonic (no notes, just a hum)
  n.droneLP = filter('lowpass', 400, 1);
  n.droneGain = gain(0.12);
  n.droneOscs = [osc('sine', 45), osc('sine', 45.3), osc('triangle', 127)];
  n.droneOscs.forEach((/** @type {OscillatorNode} */ o) => o.connect(n.droneLP));
  n.droneLP.connect(n.droneGain).connect(n.bedFilter);
  n.droneLFO = osc('sine', 0.07);
  n.droneDepth = gain(0.04);
  n.droneLFO.connect(n.droneDepth).connect(n.droneGain.gain);

  // 2. MOUSE NOISE (parallel, very quiet) ─────────
  n.mouseBP = filter('bandpass', 800, 5);
  n.mouseGain = gain(0.18);
  loopSource(white).connect(n.mouseBP).connect(n.mouseGain).connect(n.bus);

  // 3. GESTURE SYNTH (silent without input) ──────
  n.synthLP = filter('lowpass', 300, 4);
  n.synthGain = gain(0);
  n.synthOscs = [osc('sawtooth', 55), osc('sawtooth', 55.6), osc('square', 27.5)];
  n.synthOscs.forEach((/** @type {OscillatorNode} */ o) => o.connect(n.synthLP));
  n.synthLP.connect(n.synthGain).connect(n.bus);

  // DRIVE (saturation, more when holding) ─────────
  n.drive = gain(1);
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 1.3);
  n.shaper = new WaveShaperNode(ctx, { curve, oversample: '2x' });
  n.postDrive = gain(1);
  n.bus.connect(n.drive).connect(n.shaper).connect(n.postDrive);

  // SPACE: dry + two reverbs (short/long) + feedback delay ─
  n.fx = gain(1); // sum of dry + effects
  n.dry = gain(1);
  n.postDrive.connect(n.dry).connect(n.fx);

  n.revShort = new ConvolverNode(ctx, { buffer: reverbBuffer(1.4) });
  n.revLong = new ConvolverNode(ctx, { buffer: reverbBuffer(7) });
  n.revShortGain = gain(0);
  n.revLongGain = gain(0);
  n.postDrive.connect(n.revShort).connect(n.revShortGain).connect(n.fx);
  n.postDrive.connect(n.revLong).connect(n.revLongGain).connect(n.fx);

  n.delaySend = gain(0);
  n.delay = new DelayNode(ctx, { maxDelayTime: 2, delayTime: 0.4 });
  n.delayLP = filter('lowpass', 2400);
  n.delayHP = filter('highpass', 150);
  n.feedback = gain(0.3);
  n.postDrive.connect(n.delaySend).connect(n.delay);
  n.delay.connect(n.delayLP).connect(n.delayHP).connect(n.feedback).connect(n.delay);
  n.delayOut = gain(1);
  n.delay.connect(n.delayOut).connect(n.fx);
  n.delayOut.connect(n.revLong); // echoes smear into the long reverb

  // DYNAMICS + OUTPUT ─────────────────────────────
  n.comp = new DynamicsCompressorNode(ctx, { threshold: -14, knee: 6, ratio: 2, attack: 0.01, release: 0.3 });
  n.master = gain(0);
  n.fade = gain(0);
  n.limiter = new DynamicsCompressorNode(ctx, { threshold: -8, knee: 0, ratio: 20, attack: 0.002, release: 0.2 });
  n.trim = gain(0.6); // the browser compressor adds make-up gain; trim it back
  n.fx.connect(n.comp).connect(n.master).connect(n.fade).connect(n.limiter).connect(n.trim).connect(ctx.destination);

  applyTone(0.01);
  applySpace(0.01);
}

// ═════════════════════════════════════════════════════════════
//  SOUND DESIGN — how the knobs and the mouse shape the sound
// ═════════════════════════════════════════════════════════════

// TONE: 0 = dark, deep, rumbling cavern … 1 = bright, airy, windy and restless.
function applyTone(time = 0.3) {
  const t = state.tone;
  glide(n.bedFilter.frequency, 300 * 2 ** (t * 5), time); // 300 Hz … 9.6 kHz
  glide(n.bedFilter.Q, 0.7 + (1 - t) * 1.5, time);
  glide(n.rumbleGain.gain, 0.08 + 0.5 * (1 - t), time);
  glide(n.rumbleLP.frequency, 60 + 160 * t, time);
  glide(n.windGain.gain, 0.08 + 0.32 * t, time);
  glide(n.windBP.frequency, 250 * 2 ** (t * 3.5), time); // 250 Hz … 2.8 kHz
  glide(n.windDepth.gain, 120 * 2 ** (t * 3.5), time);
  glide(n.windBP.Q, 1 + 3 * (1 - t), time);
  glide(n.windLFO.frequency, 0.03 + 0.25 * t, time);
  glide(n.gustLFO.frequency, 0.02 + 0.12 * t, time);
  glide(n.airGain.gain, 0.004 + 0.05 * t * t, time);
  glide(n.airHP.frequency, 3000 + 5000 * t, time);
  const hum = 34 + 40 * t; // the hum rises with Tone
  glide(n.droneOscs[0].frequency, hum, time);
  glide(n.droneOscs[1].frequency, hum * 1.0071, time);
  glide(n.droneOscs[2].frequency, hum * 2.83, time);
  glide(n.droneLP.frequency, 150 + 1000 * t, time);
  glide(n.droneGain.gain, 0.14 * (1 - 0.5 * t), time);
  glide(n.droneLFO.frequency, 0.04 + 0.2 * t, time);
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

// Smoothing that doesn't depend on the frame rate: move `current` towards `target` with time constant `tau` (s).
const ease = (current, target, tau, dt) => current + (target - current) * (1 - Math.exp(-dt / tau));

// Runs ~30 times a second while the sound is on: mouse position, movement speed and holding.
function applyInput(dt) {
  // movement speed: rises fast, falls slowly
  input.speed = ease(input.speed, input.rawSpeed, input.rawSpeed > input.speed ? 0.05 : 0.35, dt);
  input.rawSpeed *= Math.exp(-dt / 0.06);
  // holding: builds up over ~1 s, relaxes over ~0.5 s
  input.intensity = ease(input.intensity, input.holding ? 1 : 0, input.holding ? 0.4 : 0.25, dt);
  const { x, y, speed, intensity } = input;

  // MOUSE NOISE: band-pass follows the mouse left → right (120 Hz … 7.7 kHz)
  glide(n.mouseBP.frequency, 120 * 2 ** (x * 6), 0.08);
  glide(n.mouseGain.gain, 0.18 + 0.25 * speed + 0.15 * intensity, 0.08);

  // GESTURE SYNTH: silent at rest; movement and holding bring it in
  const pitch = 40 * (1 + 0.6 * speed + 0.25 * intensity) * 2 ** ((y - 0.5) * 0.6);
  glide(n.synthOscs[0].frequency, pitch, 0.1);
  glide(n.synthOscs[1].frequency, pitch * 1.012, 0.1);
  glide(n.synthOscs[2].frequency, pitch / 2, 0.1);
  glide(n.synthLP.frequency, 150 + 2500 * speed + 4000 * intensity, 0.06);
  glide(n.synthGain.gain, 0.09 * speed + 0.22 * intensity, 0.06);

  // AGGRESSION while holding: saturation + harder compression (+ a bit louder, below)
  glide(n.drive.gain, 1 + 12 * intensity, 0.08); // push hard into the saturator…
  glide(n.postDrive.gain, 1 / (1 + 4 * intensity), 0.08); // …and bring the level back down
  glide(n.comp.threshold, -14 - 18 * intensity, 0.08);
  glide(n.comp.ratio, 2 + 10 * intensity, 0.08);

  // MASTER: the Volume fader, a little louder when moving fast or holding
  const level = state.volume ** 2 * MAX_GAIN * (1 + 0.35 * speed) * (1 + 1.1 * intensity);
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
  clearTimeout(suspendTimer);

  // iPhone: play web audio even when the ring/silent switch is on silent.
  try {
    // @ts-ignore — Safari 16.4+ only
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {
    // not supported
  }
  // Create / resume the audio right inside the touch or click (required by browsers).
  if (!ctx) buildGraph();
  ctx.resume();
  // Older iOS needs one sound started directly inside the gesture to unlock audio.
  const unlock = new AudioBufferSourceNode(ctx, { buffer: ctx.createBuffer(1, 1, ctx.sampleRate) });
  unlock.connect(ctx.destination);
  unlock.start();

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
  if (name === 'volume') {
    if (state.volume > 0) start();
    else stop();
  } else {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tone: state.tone, space: state.space }));
    } catch {
      // storage unavailable: values still work for this page
    }
    if (ctx && name === 'tone') applyTone();
    if (ctx && name === 'space') applySpace();
  }
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
