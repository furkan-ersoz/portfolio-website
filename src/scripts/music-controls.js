// The four controls in the music panel: range, default value and how the value is shown.
// Used by the panel (MusicPanel.astro) and the engine (music.js).

const percent = (v) => `${Math.round(v * 100)}%`;

export const CONTROLS = {
  tone: { label: 'Tone', min: 0, max: 1, step: 0.01, default: 0.55, format: percent },
  space: { label: 'Space', min: 0, max: 1, step: 0.01, default: 0.35, format: percent },
  speed: { label: 'Speed', min: 60, max: 120, step: 1, default: 80, format: (v) => `${Math.round(v)} BPM` },
  volume: { label: 'Volume', min: 0, max: 1, step: 0.01, default: 0.3, format: percent },
};

export const clampControl = (name, value) => {
  const c = CONTROLS[name];
  return Math.min(c.max, Math.max(c.min, value));
};
