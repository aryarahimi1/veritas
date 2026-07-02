// One switch for the demo-vs-product surface.
//
// Defaults to the DEMO build, where the live "try to forge it" tamper button and the SIMULATED
// provenance badges are BOTH visible — they are the strongest touchable trust signals for any
// visitor (a real on-chain forgery rejection + an honest disclosure that only the VASPs/PII are
// synthetic). Set VITE_VERITAS_ENV=prod to hide them in a future customer console; the demo never
// hides them.
export const VERITAS_ENV = import.meta.env?.VITE_VERITAS_ENV ?? 'demo';
export const DEMO_MODE = VERITAS_ENV !== 'prod';
