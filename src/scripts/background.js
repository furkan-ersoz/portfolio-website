// ─────────────────────────────────────────────────────────────
// HYDRA BACKGROUND
// Draws the moving visual behind every page.
// You only need to edit the section marked "EDIT YOUR HYDRA SKETCH HERE".
// ─────────────────────────────────────────────────────────────
import './global-shim.js'; // must come before hydra-synth
import Hydra from 'hydra-synth';

// ═════════════════════════════════════════════════════════════
//  EDIT YOUR HYDRA SKETCH HERE
//  Paste code from the Hydra web editor (https://hydra.ojack.xyz)
//  between the curly braces. Same syntax: osc(), noise(), shape(),
//  .out(), mouse.x, mouse.y, time … all work.
//  Audio input (a.fft) is disabled, so don't use `a.` here.
// ═════════════════════════════════════════════════════════════
function sketch() {
  osc(() => 10 + mouse.x / 100, 0.1, 1.2)
    .rotate(() => mouse.y / 1000)
    .out();
}
// ═════════════════════════════════════════════════════════════
//  END OF SKETCH — you shouldn't need to change anything below.
// ═════════════════════════════════════════════════════════════

const CANVAS_ID = 'hydra-bg';

// Render at a fraction of the screen size: looks the same behind the darkened layer
// and is much lighter on the GPU (especially on phones).
function renderSize() {
  const small = window.innerWidth < 768;
  const scale = small ? 0.5 : 0.75;
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

  try {
    sketch();
  } catch (err) {
    console.error('Error in Hydra sketch (src/scripts/background.js):', err);
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rafId = null;
  let last = performance.now();

  function frame(now) {
    hydra.tick(Math.min(now - last, 100));
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
      quietly(() => hydra.setResolution(next.width, next.height));
      if (reducedMotion.matches) still();
    }, 200);
  });

  if (reducedMotion.matches) still();
  else play();
}

start();
