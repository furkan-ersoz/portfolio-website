// ─────────────────────────────────────────────────────────────
// HYDRA BACKGROUND
// Draws the moving visual behind every page.
// You only need to edit the two marked sections below:
//   "SPARKLE SETTINGS" and "EDIT YOUR HYDRA SKETCH HERE".
// ─────────────────────────────────────────────────────────────
import './global-shim.js'; // must come before hydra-synth
import Hydra from 'hydra-synth';
import { createSparkles } from './sparkles.js';

// ═════════════════════════════════════════════════════════════
//  SPARKLE SETTINGS
//  Red sparkles on black. Moving the mouse pushes them away;
//  holding the mouse button (or a finger on phones) pulls them in.
// ═════════════════════════════════════════════════════════════
const SPARKLES = {
  enabled: true, // false = no sparkles (e.g. if you paste a sketch that doesn't use s0)
  count: 260, // how many sparkles (half as many on phones)
  colors: ['#ff1a1a', '#ff3b2f', '#e00000', '#ff6a4d', '#b30000'],
  size: 1.2, // dot size
  driftSpeed: 0.35, // calm drifting speed
  repelRadius: 160, // how close (px) the mouse must be to push sparkles away
  repelStrength: 0.9, // how hard the mouse pushes
  pullStrength: 0.35, // how hard a click / touch pulls them in
  trailFade: 0.28, // 1 = no trails, smaller = longer glowing trails
};

// ═════════════════════════════════════════════════════════════
//  EDIT YOUR HYDRA SKETCH HERE
//  Paste code from the Hydra web editor (https://hydra.ojack.xyz)
//  between the curly braces. Same syntax: osc(), noise(), shape(),
//  .out(), mouse.x, mouse.y, time … all work.
//  The sparkles arrive as source `s0`, so src(s0) shows them and you
//  can add Hydra effects on top, e.g. src(s0).modulate(noise(2), 0.01).out()
//  Audio input (a.fft) is disabled, so don't use `a.` here.
// ═════════════════════════════════════════════════════════════
function sketch() {
  src(s0).out();
}
// ═════════════════════════════════════════════════════════════
//  END OF SKETCH — you shouldn't need to change anything below.
// ═════════════════════════════════════════════════════════════

const CANVAS_ID = 'hydra-bg';

// Render resolution: full size on desktop, a bit lower on phones to save battery.
function renderSize() {
  const small = window.innerWidth < 768;
  const scale = small ? 0.75 : 1;
  return {
    width: Math.max(1, Math.round(window.innerWidth * scale)),
    height: Math.max(1, Math.round(window.innerHeight * scale)),
  };
}

// hydra-synth's setResolution() prints to the console; keep the console clean.
function quietly(fn) {
  const log = console.log;
  console.log = () => {};
  try {
    fn();
  } finally {
    console.log = log;
  }
}

function start() {
  const canvas = document.getElementById(CANVAS_ID);
  if (!canvas || window.__hydraStarted) return;
  window.__hydraStarted = true;

  const size = renderSize();
  canvas.width = size.width;
  canvas.height = size.height;

  let hydra;
  try {
    hydra = new Hydra({
      canvas,
      width: size.width,
      height: size.height,
      makeGlobal: true, // same syntax as the Hydra web editor
      detectAudio: false, // no microphone permission prompt
      enableStreamCapture: false,
      autoLoop: false, // we run our own loop below (so we can pause it)
    });
  } catch (err) {
    // No WebGL (very old device / disabled): just keep the plain black background.
    console.warn('Hydra background disabled:', err);
    canvas.remove();
    return;
  }

  // Hydra normally provides `mouse` globally. If not, provide it ourselves.
  if (typeof window.mouse === 'undefined') {
    window.mouse = { x: 0, y: 0 };
    window.addEventListener('mousemove', (e) => {
      window.mouse.x = e.clientX;
      window.mouse.y = e.clientY;
    }, { passive: true });
  }

  // The sparkle simulation draws on its own hidden canvas, which Hydra reads as s0.
  const sparkles = SPARKLES.enabled ? createSparkles(SPARKLES) : null;
  if (sparkles) {
    sparkles.resize(size.width, size.height);
    s0.init({ src: sparkles.canvas });
  }

  try {
    sketch();
  } catch (err) {
    console.error('Error in Hydra sketch (src/scripts/background.js):', err);
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rafId = null;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(now - last, 100);
    sparkles?.update(dt, now);
    hydra.tick(dt);
    last = now;
    rafId = requestAnimationFrame(frame);
  }

  function play() {
    if (rafId !== null || document.hidden || reducedMotion.matches) return;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function pause() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // A single still frame (used for reduced motion).
  function still() {
    sparkles?.update(16, performance.now());
    hydra.tick(16);
  }

  // Pause when the tab is hidden, resume when visible.
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));

  // Respect the "reduce motion" setting, also if it changes while the page is open.
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      pause();
      still();
    } else {
      play();
    }
  });

  // Keep the resolution in step with the window (debounced).
  // Small height-only changes (phone address bar showing/hiding) are ignored.
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const next = renderSize();
      const widthChanged = next.width !== canvas.width;
      const bigHeightChange = Math.abs(next.height - canvas.height) > 120;
      if (!widthChanged && !bigHeightChange) return;
      sparkles?.resize(next.width, next.height);
      quietly(() => hydra.setResolution(next.width, next.height));
      if (reducedMotion.matches) still();
    }, 200);
  });

  if (reducedMotion.matches) still();
  else play();
}

start();
