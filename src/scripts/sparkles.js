// ─────────────────────────────────────────────────────────────
// SPARKLES
// Red sparkles drifting on black, drawn on a hidden canvas.
// background.js feeds this canvas into Hydra as source s0.
//   • moving the mouse pushes nearby sparkles away
//   • holding the mouse button (or a finger) pulls them in
//   • each sparkle fades in, lives a random time, fades out and is reborn elsewhere
// The look is tuned in background.js (SPARKLE SETTINGS).
// ─────────────────────────────────────────────────────────────

export function createSparkles(settings) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let width = 0;
  let height = 0;
  let scale = 1; // render pixels per CSS pixel
  let particles = [];

  const pointer = { x: -9999, y: -9999, down: false, active: false };

  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  const FADE_MS = 1200; // fade-in / fade-out time

  function makeParticle(startAtRandomAge = false) {
    const [minLife, maxLife] = settings.lifetime;
    const life = rand(minLife, maxLife) * 1000;
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(0.3, 1) * settings.driftSpeed;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: rand(0.6, 1.8) * settings.size,
      color: pick(settings.colors),
      phase: Math.random() * Math.PI * 2,
      twinkle: rand(1, 4), // twinkles per ~6 seconds
      restOffset: Math.random(), // where it settles in the cloud when pulled
      life, // how long it lives (ms)
      // at start-up, spread ages so they don't all appear/disappear together
      age: startAtRandomAge ? Math.random() * life : 0,
    };
  }

  function resize(renderWidth, renderHeight) {
    const oldW = width || renderWidth;
    const oldH = height || renderHeight;
    width = canvas.width = renderWidth;
    height = canvas.height = renderHeight;
    scale = renderWidth / window.innerWidth;

    // Fewer sparkles on small screens.
    const count = Math.round(window.innerWidth < 768 ? settings.count * 0.5 : settings.count);
    if (particles.length === 0) {
      particles = Array.from({ length: count }, () => makeParticle(true));
    } else {
      // keep existing sparkles, just move them into the new size
      particles.forEach((p) => {
        p.x *= width / oldW;
        p.y *= height / oldH;
      });
      while (particles.length < count) particles.push(makeParticle(true));
      particles.length = count;
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  }

  // ── Pointer input (listens on window: the background never blocks clicks) ──
  function setPointer(clientX, clientY) {
    pointer.x = clientX * scale;
    pointer.y = clientY * scale;
    pointer.active = true;
  }
  window.addEventListener('pointermove', (e) => setPointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerdown', (e) => {
    setPointer(e.clientX, e.clientY);
    pointer.down = true;
  }, { passive: true });
  const release = () => {
    pointer.down = false;
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  document.addEventListener('pointerleave', () => {
    pointer.active = false;
    pointer.down = false;
  });

  // ── One animation step. dt is in milliseconds. ──
  function update(dt, time) {
    const step = Math.min(dt, 50) / 16.67; // 1 = one frame at 60 fps
    const repelRadius = settings.repelRadius * scale;
    const baseSpeed = settings.driftSpeed;

    for (let i = 0; i < particles.length; i++) {
      let p = particles[i];

      // Life cycle: when its time is up, a new sparkle is born somewhere else.
      p.age += dt;
      if (p.age > p.life) p = particles[i] = makeParticle();

      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (pointer.down) {
        // Pull towards the pointer, but gather them in a swirling cloud
        // (each sparkle has its own resting distance) instead of a single dot.
        const rest = (40 + p.restOffset * 110) * scale;
        const pull = settings.pullStrength * Math.max(-0.5, Math.min(1, (dist - rest) / (150 * scale)));
        p.vx -= (dx / dist) * pull * step;
        p.vy -= (dy / dist) * pull * step;
        // a little sideways push → swirl
        p.vx += (-dy / dist) * settings.pullStrength * 0.25 * step;
        p.vy += (dx / dist) * settings.pullStrength * 0.25 * step;
      } else if (pointer.active && dist < repelRadius) {
        // Push away from the mouse.
        const push = settings.repelStrength * (1 - dist / repelRadius);
        p.vx += (dx / dist) * push * step;
        p.vy += (dy / dist) * push * step;
      }

      // Friction: fast sparkles slow back down to a calm drift,
      // but keep the direction they were pushed in.
      const speed = Math.hypot(p.vx, p.vy) || 0.0001;
      const friction = pointer.down ? 0.94 : 0.97;
      if (speed > baseSpeed) {
        const newSpeed = Math.max(baseSpeed, speed * friction ** step);
        p.vx *= newSpeed / speed;
        p.vy *= newSpeed / speed;
      } else if (speed < baseSpeed * 0.3) {
        p.vx *= 1.05; // never come to a complete stop
        p.vy *= 1.05;
      }

      p.x += p.vx * step;
      p.y += p.vy * step;

      // Wrap around the edges.
      if (p.x < -5) p.x += width + 10;
      else if (p.x > width + 5) p.x -= width + 10;
      if (p.y < -5) p.y += height + 10;
      else if (p.y > height + 5) p.y -= height + 10;
    }

    draw(time);
  }

  function draw(time) {
    // Black with a little transparency → short glowing trails.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0, 0, 0, ${settings.trailFade})`;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'lighter';
    const t = time / 1000;
    for (const p of particles) {
      // twinkle: mostly dim, with short bright flashes
      const wave = 0.5 + 0.5 * Math.sin(t * p.twinkle + p.phase);
      // fade in at birth, fade out before disappearing
      const fade = Math.max(0, Math.min(1, p.age / FADE_MS, (p.life - p.age) / FADE_MS));
      const alpha = (0.25 + 0.75 * wave ** 3) * fade;
      const r = p.size * scale * (0.8 + 0.6 * wave);

      ctx.globalAlpha = alpha * 0.25; // soft glow
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha; // bright core
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { canvas, resize, update };
}
