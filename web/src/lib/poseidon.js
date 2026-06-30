// Poseidon hash over the BLS12-381 scalar field — reproduces EXACTLY what circomlib's Poseidon()
// circuit template computes when veritas.circom is compiled with `--prime bls12381`.
//
// Why this isn't just "import circomlibjs": circomlibjs's buildPoseidon() hardcodes the BN254 field
// (see circuits/gen-veritas-input.mjs's note: "off-circuit Poseidon ... can't match the in-circuit
// BLS12-381 Poseidon"). circom compiles circomlib's literal round constants under WHATEVER --prime is
// active; since those constants are all < BN254's r < BLS12-381's r, the constants themselves don't
// change, but every add/mul wraps at a different (larger) modulus. So the in-circuit permutation here
// is the same algorithm + same constants as standard Poseidon, just reduced mod a different prime —
// reimplemented below with plain BigInt (no ffjavascript/circomlibjs at runtime, avoiding the Node-
// builtins bundling problem proof.js's header note already flagged for snarkjs). Byte-matched against
// a real on-chain attCommitment by scripts/check-poseidon.mjs.
import PARAMS from './poseidon-constants.js';

export const BLS_SCALAR_FIELD = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

const mod = (x) => ((x % BLS_SCALAR_FIELD) + BLS_SCALAR_FIELD) % BLS_SCALAR_FIELD;
const add = (a, b) => mod(a + b);
const mul = (a, b) => mod(a * b);
const square = (a) => mul(a, a);
const pow5 = (a) => mul(a, square(square(a))); // a^5, the Poseidon S-box
const big = (hexOrDec) => mod(BigInt(hexOrDec));

/** Poseidon over the BLS12-381 scalar field. `inputs` is an array of 3 or 9 BigInt/number/string field
 * elements (the only arities veritas.circom uses: Poseidon(3) for the ack, Poseidon(9) for attCommitment). */
export function poseidon(inputs) {
  const t = inputs.length + 1;
  const params = PARAMS[String(t)];
  if (!params) throw new Error(`poseidon: no parameters for ${inputs.length} inputs (t=${t})`);
  const { nRoundsF, nRoundsP, C, S, M, P } = params;
  const c = (i) => big(C[i]);
  const m = (j, i) => big(M[j][i]);
  const p = (j, i) => big(P[j][i]);
  const s = (i) => big(S[i]);

  let state = [0n, ...inputs.map((x) => mod(BigInt(x)))];
  state = state.map((a, i) => add(a, c(i)));

  const fullRound = (cOffset, matFn) => {
    state = state.map((a) => pow5(a));
    state = state.map((a, i) => add(a, c(cOffset + i)));
    state = state.map((_, i) => state.reduce((acc, a, j) => add(acc, mul(matFn(j, i), a)), 0n));
  };

  for (let r = 0; r < nRoundsF / 2 - 1; r++) fullRound((r + 1) * t, m);
  // last full round of the first half switches to the (dense) P matrix before the partial rounds
  fullRound((nRoundsF / 2) * t, p);

  const cBase = (nRoundsF / 2 + 1) * t;
  for (let r = 0; r < nRoundsP; r++) {
    state[0] = add(pow5(state[0]), c(cBase + r));
    const s0 = state.reduce((acc, a, j) => add(acc, mul(s((t * 2 - 1) * r + j), a)), 0n);
    for (let k = 1; k < t; k++) state[k] = add(state[k], mul(state[0], s((t * 2 - 1) * r + t + k - 1)));
    state[0] = s0;
  }

  const cBase2 = cBase + nRoundsP;
  for (let r = 0; r < nRoundsF / 2 - 1; r++) fullRound(cBase2 + r * t, m);
  state = state.map((a) => pow5(a));
  state = state.map((_, i) => state.reduce((acc, a, j) => add(acc, mul(m(j, i), a)), 0n));

  return state[0];
}

/** Poseidon-3: the receiving-VASP acknowledgement (veritas.circom's `ack`). */
export const poseidon3 = (a, b, cc) => poseidon([a, b, cc]);

/** Poseidon-9: the attestation commitment (veritas.circom's `attCommitment`). Input order MUST match
 * the circuit exactly: [ivmsHash, ackOut, settlementRef, regulatorKey, salt, amount, bracket, leafA, leafB]. */
export const poseidon9 = (inputs) => poseidon(inputs);
