// ─────────────────────────────────────────────────────────────
// MUSIC PATTERN (Strudel)
// The music that plays when a visitor presses Play in the
// bottom-right panel. Edit only the marked section below.
//
// All Strudel functions (note, n, s, stack, ref, sine, rev, …) are
// available here, just like on https://strudel.cc
//
// The function receives live controls, already wrapped in ref():
//   mouseX      0 → 1   mouse left → right
//   mouseY      0 → 1   mouse bottom → top
//   degree      0 → 7   mouseX as scale steps (use as .add(n(degree)) before .scale())
//   brightness  Hz      low-pass cutoff = Tone knob, opened/closed by mouseY
//   space       0 → 1   Space knob (use with .room())
//   state       the raw values, if you want to build your own:
//               ref(() => state.mouseX), ref(() => state.tone), …
// Volume and Speed are applied automatically (master volume, tempo).
// ─────────────────────────────────────────────────────────────

export function pattern(controls) {
  // Also available: controls.mouseX, controls.mouseY, controls.state (add them here when you use them)
  const { degree, brightness, space } = controls;

  // ═════════════════════════════════════════════════════════════
  //  EDIT YOUR STRUDEL PATTERN HERE
  //  Return one pattern. To paste a pattern from strudel.cc:
  //   • paste it after `return` (several `$:` lines → put them in stack(a, b, c))
  //   • remove setcpm()/setcps() — the Speed knob sets the tempo
  //   • connect the knobs by adding .lpf(brightness) and .room(space)
  // ═════════════════════════════════════════════════════════════

  // A slow, hypnotic line in A minor pentatonic. Mouse X moves it up the scale.
  const melody = n('0 ~ 2 4 ~ <3 5> ~ <1 7>')
    .add(n(degree))
    .scale('A3:minor:pentatonic')
    .s('triangle')
    .attack(0.01)
    .decay(0.5)
    .sustain(0.15)
    .release(0.9)
    .lpf(brightness)
    .lpq(3)
    .gain(0.32)
    .delay(0.35)
    .delaytime(0.375)
    .delayfeedback(0.45)
    .room(space)
    .roomsize(6);

  // A soft pad underneath: Am – F – C – G, two cycles per chord.
  const pad = note('<[a2,e3,c4] [f2,c3,a3] [c3,g3,e4] [g2,d3,b3]>')
    .slow(2)
    .s('sawtooth')
    .attack(1.5)
    .sustain(0.8)
    .release(3)
    .lpf(brightness.mul(0.45))
    .gain(0.1)
    .room(space)
    .roomsize(6);

  // A low A drone that breathes in and out.
  const drone = note('a1')
    .s('sine')
    .attack(2)
    .release(3)
    .gain(sine.range(0.12, 0.22).slow(8));

  // Very gentle off-beat noise ticks, a few randomly left out.
  const ticks = s('~ pink ~ pink')
    .decay(0.04)
    .sustain(0)
    .hpf(5000)
    .gain(0.05)
    .degradeBy(0.3)
    .room(space);

  return stack(melody, pad, drone, ticks);

  // ═════════════════════════════════════════════════════════════
  //  END OF PATTERN
  // ═════════════════════════════════════════════════════════════
}
