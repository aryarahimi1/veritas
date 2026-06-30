// Regulator-side recompute of the on-chain attCommitment, from the same secret/identity field
// elements witness.js fed into the circuit as the prover's witness. This is what makes "it's the same
// cryptographic object" on the regulator-reveal pane a verifiable claim instead of an assertion: the
// regulator independently rebuilds Poseidon(3) [ack] -> Poseidon(9) [attCommitment] off-chain and
// compares it to the attCommitment that was actually anchored on-chain for that run.
import { poseidon3, poseidon9 } from './poseidon.js';
import { ivmsHash, ackSecret, regulatorKey, salt, leafA, leafB } from './witness.js';

/** Recomputes attCommitment from a run's public fields ({ amount, settlementRef, bracket }) plus the
 * regulator's known secret/identity consts (above). Returns a decimal string — directly comparable to
 * result.attCommitment, which is also a decimal string (snarkjs's publicSignals).
 *
 * Input order is load-bearing — it MUST exactly match circuits/veritas.circom's `att.inputs[0..8]`:
 * [ivmsHash, ack.out, settlementRef, regulatorKey, salt, amount, bracket, leafA, leafB]. */
export function recomputeAttCommitment({ amount, settlementRef, bracket }) {
  if (amount == null || settlementRef == null || bracket == null) {
    throw new Error('recomputeAttCommitment: missing amount/settlementRef/bracket on the anchored run');
  }
  const ackOut = poseidon3(ackSecret, ivmsHash, leafB);
  const attCommitment = poseidon9([
    ivmsHash,
    ackOut,
    BigInt(settlementRef),
    regulatorKey,
    salt,
    BigInt(amount),
    BigInt(bracket),
    leafA,
    leafB
  ]);
  return attCommitment.toString();
}
