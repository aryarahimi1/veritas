// De-risk gate: the from-scratch JS Poseidon (web/src/lib/poseidon.js) MUST byte-match the in-circuit
// attCommitment for a known real on-chain proof before it's trusted in the regulator-reveal UI.
// Recomputes Poseidon(3) [ack] -> Poseidon(9) [attCommitment] from the same mock secret fields
// witness.js uses, and checks it equals the attCommitment anchored on testnet (fixtures.js).
//   node scripts/check-poseidon.mjs
import assert from 'node:assert';
import { poseidon3, poseidon9 } from '../web/src/lib/poseidon.js';

const P = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;
const strF = (s) => {
  let n = 0n;
  for (const byte of new TextEncoder().encode(s)) n = (n << 8n) | BigInt(byte);
  return n % P;
};

const leafA = strF('VASP:506700GE1G29325QX363:CH');
const leafB = strF('VASP:5299000F4XGCT0BR6E08:SG');
const ivmsHash = strF('IVMS101:demo-payload');
const ackSecret = strF('ack-secret-B');
const regulatorKey = strF('regulator-view-key');
const salt = strF('attestation-salt');

// The real, on-chain pre-generated proof (web/src/lib/fixtures.js): amount=4200, bracket=1.
const amount = 4200n;
const bracket = 1n;
const settlementRef = 2573423666217965037452880345879372805356662833n;
const EXPECTED_ATT_COMMITMENT = '5408308759447454863842711105285429093958858093295668608020638075467636608655';

const ackOut = poseidon3(ackSecret, ivmsHash, leafB);
const attCommitment = poseidon9([ivmsHash, ackOut, settlementRef, regulatorKey, salt, amount, bracket, leafA, leafB]);

assert.equal(attCommitment.toString(), EXPECTED_ATT_COMMITMENT, 'JS Poseidon attCommitment != real on-chain attCommitment');
console.log('byte-match OK — JS Poseidon(BLS12-381) attCommitment == on-chain attCommitment');
console.log('  ', attCommitment.toString());
