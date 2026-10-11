// Some of hydra-synth's dependencies expect Node's `global` object.
// In the browser, point it at `window` (globalThis) before they load.
globalThis.global ??= globalThis;
