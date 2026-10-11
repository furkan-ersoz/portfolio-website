// ─────────────────────────────────────────────────────────────
// SOUND ENGINE
// An atmospheric background sound built with the browser's Web Audio API
// (nothing to download). It only *reads* mouse/touch input from the window;
// it never touches the visuals and never blocks clicks or scrolling.
//
// Layers:
//   1. ATMOSPHERE  deep rumble + low hum. Always there while the sound is on.
//   2. SWELL       a dark, slowly breathing low texture (extra layer).
//   3. MOUSE NOISE very quiet noise through a band-pass filter;
//                  the filter frequency follows the mouse left → right.
//   4. SYNTH       one monophonic instrument voice, played only by the mouse:
//                  mouse height picks the note, moving/clicking plays it.
//   TONE sets how loud the extra layers (2–4) are; it never changes pitches or filters.
//   SPACE sets reverb + echo.
//
//   layers → drive (saturation) → dry + reverb + delay → compressor
//          → master (volume, movement, hold) → fade → limiter → speakers
//
// Holding the mouse button / a finger makes everything more aggressive:
// more saturation, harder compression, a bit louder.
// The numbers in the "SOUND DESIGN" section below are safe to play with.
// ─────────────────────────────────────────────────────────────
import { CONTROLS, clampControl } from './music-controls.js';

const STORAGE_KEY = 'music-controls';
const MAX_GAIN = 3; // master gain at Volume 100% (the limiter keeps peaks in check)

// Notes the synth can play, low → high (D minor pentatonic, D2 … D4, as MIDI numbers).
const SCALE = [38, 41, 43, 45, 48, 50, 53, 55, 57, 60, 62];

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

function press() {
  input.holding = true;
  if (running) playNote(noteAt(input.y), 1); // a click always plays the note under the mouse
}
function release() {
  input.holding = false;
  if (running) releaseNote();
}

window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
window.addEventListener(
  'pointerdown',
  (e) => {
    move(e.clientX, e.clientY);
    if (e.pointerType !== 'touch') press(); // touch holds are handled below
  },
  { passive: true },
);
window.addEventListener('pointerup', (e) => e.pointerType !== 'touch' && release(), { passive: true });
window.addEventListener('pointercancel', () => (input.holding = false), { passive: true });
window.addEventListener('blur', () => (input.holding = false));

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
    holdTimer = window.setTimeout(press, 250);
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
  release();
};
window.addEventListener('touchend', touchEnd, { passive: true });
window.addEventListener('touchcancel', touchEnd, { passive: true });

// Browsers only allow sound after a click, tap or key press: start on the first one.
const firstGesture = () => {
  ['pointerup', 'touchend', 'keydown'].forEach((t) => window.removeEventListener(t, firstGesture, true));
  if (state.volume > 0) start();
};
['pointerup', 'touchend', 'keydown'].forEach((t) => window.addEventListener(t, firstGesture, true));

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
const midiToHz = (/** @type {number} */ m) => 440 * 2 ** ((m - 69) / 12);

function buildGraph() {
  ctx = new AudioContext({ latencyHint: 'playback' });
  const white = noiseBuffer('white');
  const brown = noiseBuffer('brown');
  n = {};

  // Everything sums here.
  n.bus = gain(1);

  // 1. ATMOSPHERE: deep rumble + low hum ─────────
  n.atmosphere = filter('lowpass', 380, 0.7); // keeps it dark
  n.atmosphere.connect(n.bus);

  n.rumbleLP = filter('lowpass', 90);
  n.rumbleGain = gain(0.5);
  loopSource(brown).connect(n.rumbleLP).connect(n.rumbleGain).connect(n.atmosphere);

  // hum: E1 with a slowly beating twin, plus soft E2/E3 partials so phone and laptop speakers can hear it
  n.humLP = filter('lowpass', 260, 1);
  n.humGain = gain(0.16);
  [osc('sine', 41.2), osc('sine', 41.45), osc('triangle', 82.4), osc('sine', 164.8)].forEach((o) => o.connect(n.humLP));
  n.humLP.connect(n.humGain).connect(n.atmosphere);
  n.humLFO = osc('sine', 0.05);
  n.humDepth = gain(0.05);
  n.humLFO.connect(n.humDepth).connect(n.humGain.gain);

  // 2. SWELL: dark breathing texture (extra layer, level set by Tone) ─
  n.swellBP = filter('bandpass', 110, 2.5);
  n.swellAmount = gain(0); // Tone
  n.swellBreath = gain(0.5);
  loopSource(brown).connect(n.swellBP).connect(n.swellBreath).connect(n.swellAmount).connect(n.atmosphere);
  n.swellLFO = osc('sine', 0.06);
  n.swellDepth = gain(0.5);
  n.swellLFO.connect(n.swellDepth).connect(n.swellBreath.gain);

  // 3. MOUSE NOISE (parallel, very quiet) ─────────
  n.mouseBP = filter('bandpass', 400, 4);
  n.mouseGain = gain(0);
  loopSource(white).connect(n.mouseBP).connect(n.mouseGain).connect(n.bus);

  // 4. SYNTH: one voice, played by the mouse ──────
  // two slightly detuned saws + a sine an octave below, a soft vibrato, a filter that opens on each note
  n.synthOscs = [osc('sawtooth', 110), osc('sawtooth', 110), osc('sine', 55)];
  n.synthOscs[1].detune.value = 9;
  n.vibrato = osc('sine', 5.2);
  n.vibratoDepth = gain(6); // cents
  n.vibrato.connect(n.vibratoDepth);
  n.synthOscs.forEach((/** @type {OscillatorNode} */ o) => n.vibratoDepth.connect(o.detune));
  n.synthMix = gain(0.5);
  n.synthOscs.forEach((/** @type {OscillatorNode} */ o) => o.connect(n.synthMix));
  n.synthLP = filter('lowpass', 400, 5);
  n.synthEnv = gain(0); // note envelope
  n.synthLevel = gain(0); // Tone
  n.synthMix.connect(n.synthLP).connect(n.synthEnv).connect(n.synthLevel).connect(n.bus);

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

// TONE: only levels. 0 = just the deep atmosphere … 1 = swell, mouse noise and synth up front.
// (Mouse noise and synth levels are multiplied by this in applyInput / playNote.)
const toneMix = () => ({
  swell: 2.5 * state.tone,
  mouse: 0.2 + 0.8 * state.tone,
  synth: 0.25 + 0.75 * state.tone,
});

function applyTone(time = 0.3) {
  const mix = toneMix();
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

// SYNTH: which note is under the mouse (low at the bottom of the screen, high at the top)
const noteAt = (/** @type {number} */ y) => SCALE[Math.min(SCALE.length - 1, Math.max(0, Math.floor(y * SCALE.length)))];
let currentNote = 0;
let lastNoteTime = 0;

// Play one note on the single synth voice (a new note replaces the old one, with a short glide).
function playNote(/** @type {number} */ note, /** @type {number} */ velocity) {
  const now = ctx.currentTime;
  const f = midiToHz(note);
  glide(n.synthOscs[0].frequency, f, 0.025);
  glide(n.synthOscs[1].frequency, f, 0.025);
  glide(n.synthOscs[2].frequency, f / 2, 0.025);

  const peak = 0.22 * velocity;
  const env = n.synthEnv.gain;
  env.cancelScheduledValues(now);
  env.setValueAtTime(env.value, now);
  env.linearRampToValueAtTime(peak, now + 0.015);
  // held: sustain; not held: a soft pluck that fades by itself
  env.setTargetAtTime(input.holding ? peak * 0.6 : 0, now + 0.015, input.holding ? 0.4 : 0.35);

  const cutoff = n.synthLP.frequency;
  cutoff.cancelScheduledValues(now);
  cutoff.setValueAtTime(cutoff.value, now);
  cutoff.linearRampToValueAtTime(500 + 2500 * velocity, now + 0.02);
  cutoff.setTargetAtTime(input.holding ? 1400 : 450, now + 0.02, 0.3);

  currentNote = note;
  lastNoteTime = performance.now();
}

function releaseNote() {
  glide(n.synthEnv.gain, 0, 0.35);
  glide(n.synthLP.frequency, 400, 0.4);
}

/** Smoothing that doesn't depend on the frame rate. @param {number} current @param {number} target @param {number} tau @param {number} dt */
const ease = (current, target, tau, dt) => current + (target - current) * (1 - Math.exp(-dt / tau));

// Runs ~30 times a second while the sound is on: mouse position, movement speed and holding.
function applyInput(/** @type {number} */ dt) {
  // movement speed: rises fast, falls slowly
  input.speed = ease(input.speed, input.rawSpeed, input.rawSpeed > input.speed ? 0.05 : 0.35, dt);
  input.rawSpeed *= Math.exp(-dt / 0.06);
  // holding: builds up over ~1 s, relaxes over ~0.5 s
  input.intensity = ease(input.intensity, input.holding ? 1 : 0, input.holding ? 0.4 : 0.25, dt);
  const { x, y, speed, intensity } = input;
  const mix = toneMix();

  // MOUSE NOISE: band-pass follows the mouse left → right (100 Hz … 2.5 kHz).
  // Higher bands hold more noise energy, so the level drops steeply to the right
  // (it ends up ~12 dB quieter at the right edge than at the left).
  glide(n.mouseBP.frequency, 100 * 2 ** (x * 4.6), 0.08);
  const highCut = 2 ** (-x * 4.3);
  glide(n.mouseGain.gain, (0.07 + 0.1 * speed + 0.06 * intensity) * highCut * mix.mouse, 0.08);

  // SYNTH: moving onto a new note plays it (at most ~7 notes a second; faster = stronger)
  const note = noteAt(y);
  if (speed > 0.06 && note !== currentNote && performance.now() - lastNoteTime > 140) {
    playNote(note, 0.45 + 0.55 * Math.min(1, speed * 2));
  }

  // AGGRESSION while holding: saturation + harder compression (+ a bit louder, below)
  glide(n.drive.gain, 1 + 12 * intensity, 0.08);
  glide(n.postDrive.gain, 1 / (1 + 4 * intensity), 0.08);
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
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable: values still work for this page
  }
  if (name === 'volume') {
    if (state.volume > 0) start();
    else stop();
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
