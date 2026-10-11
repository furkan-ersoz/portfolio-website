// The controls in the sound panel: range, default value and how the value is shown.
// Used by the panel (MusicPanel.astro) and the sound engine (music.js).

const percent = (v) => `${Math.round(v * 100)}%`;

export const CONTROLS = {
  tone: { label: 'Tone', min: 0, max: 1, step: 0.01, default: 0.5, format: percent },
  space: { label: 'Space', min: 0, max: 1, step: 0.01, default: 0.4, format: percent },
  // Volume starts at 0 = off. Raising it starts the sound (browsers only allow audio after a touch/click).
  volume: { label: 'Volume', min: 0, max: 1, step: 0.01, default: 0, format: (v) => (v === 0 ? 'Off' : percent(v)) },
};

export const clampControl = (name, value) => {
  const c = CONTROLS[name];
  return Math.min(c.max, Math.max(c.min, value));
};
