// Build the veritas.circom witness input for a given amount + settlementRef, holding the (mock)
// registry + IVMS inputs constant so the in-circuit registryRoot keeps matching the pinned root
// (45278072…). Mirrors circuits/gen-veritas-input.mjs exactly (so leafA/leafB hash the same).
const P = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;
const DEPTH = 16;

const strF = (s) => {
  let n = 0n;
  for (const byte of new TextEncoder().encode(s)) n = (n << 8n) | BigInt(byte); // == BigInt('0x'+hex)
  return n % P;
};

// Exported as the single source of truth: buildInput() (below) and the regulator-side attCommitment
// recompute in attestation.js both derive from these same field elements.
export const leafA = strF('VASP:506700GE1G29325QX363:CH'); // originator (index 0)
export const leafB = strF('VASP:5299000F4XGCT0BR6E08:SG'); // beneficiary (index 1)
export const ivmsHash = strF('IVMS101:demo-payload');
export const ackSecret = strF('ack-secret-B');
export const regulatorKey = strF('regulator-view-key');
export const salt = strF('attestation-salt');
const zerosUp = Array(DEPTH - 1).fill('0');

export function buildInput(amount, settlementRef) {
  return {
    settlementRef: (settlementRef % P).toString(),
    threshold: '1000',
    amount: BigInt(amount).toString(),
    leafA: leafA.toString(),
    leafB: leafB.toString(),
    pathA: [leafB.toString(), ...zerosUp],
    idxA: Array(DEPTH).fill('0'),
    pathB: [leafA.toString(), ...zerosUp],
    idxB: ['1', ...Array(DEPTH - 1).fill('0')],
    ivmsHash: ivmsHash.toString(),
    ackSecret: ackSecret.toString(),
    regulatorKey: regulatorKey.toString(),
    salt: salt.toString()
  };
}

// 31 random bytes < 2^248 < field order r, so it's always a canonical signal (passes the contract's
// canonicity check) and fresh per run (avoids AlreadyAnchored).
export function randomSettlementRef() {
  const b = new Uint8Array(31);
  crypto.getRandomValues(b);
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  return n;
}
