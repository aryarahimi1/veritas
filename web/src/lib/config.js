// One switch for the demo-vs-product surface.
//
// Defaults to the DEMO build, where the live "try to forge it" tamper button and the SIMULATED
// provenance badges are BOTH visible — they are the strongest touchable trust signals in a judge's
// skim (a real on-chain forgery rejection + an honest disclosure that only the VASPs/PII are
// synthetic). Set VITE_VERITAS_ENV=prod to hide them in a future customer console; the demo never
// hides them. See PLAN.md Phase 8 (and Phase 21 for where prod-gating actually belongs).
export const VERITAS_ENV = import.meta.env?.VITE_VERITAS_ENV ?? 'demo';
export const DEMO_MODE = VERITAS_ENV !== 'prod';
