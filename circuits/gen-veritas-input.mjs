// Build a witness input for veritas.circom WITHOUT any off-circuit Poseidon (which can't match the
// in-circuit BLS12-381 Poseidon). The circuit derives registryRoot + attCommitment itself; we only
// supply leaves + Merkle paths arranged so both VASPs share the upper subtree (=> rootA === rootB).
//   node gen-veritas-input.mjs   ->   build/veritas_input.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, 'build');
const DEPTH = 16;

// BLS12-381 scalar field modulus.
const P = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;
const strF = (s) => BigInt('0x' + Buffer.from(s).toString('hex')) % P;

// VASP identity commitments (opaque leaves; in production a Poseidon commitment to LEI + jurisdiction).
const leafA = strF('VASP:506700GE1G29325QX363:CH'); // originator (index 0)
const leafB = strF('VASP:5299000F4XGCT0BR6E08:SG'); // beneficiary (index 1)

// A at index 0, B at index 1: their level-0 siblings are each other; above level 0 they share the same
// (empty) subtree, so the circuit recomputes the SAME root from both inclusion paths.
const zerosUp = Array(DEPTH - 1).fill('0');
const pathA = [leafB.toString(), ...zerosUp];
const idxA = Array(DEPTH).fill('0');               // A is the left leaf at every level
const pathB = [leafA.toString(), ...zerosUp];
const idxB = ['1', ...Array(DEPTH - 1).fill('0')]; // B is the right leaf at level 0

const input = {
  // public
  settlementRef: strF('settlement-ref-0001').toString(),
  threshold: '1000',
  // private
  amount: '4200', // hidden; only the bracket (>= 1000 => full IVMS101) is proven
  leafA: leafA.toString(),
  leafB: leafB.toString(),
  pathA, idxA, pathB, idxB,
  ivmsHash: strF('IVMS101:demo-payload').toString(),
  ackSecret: strF('ack-secret-B').toString(),
  regulatorKey: strF('regulator-view-key').toString(),
  salt: strF('attestation-salt').toString(),
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'veritas_input.json'), JSON.stringify(input, null, 2));
console.log('wrote build/veritas_input.json (Poseidon-free; circuit computes registryRoot + attCommitment)');
console.log('amount(hidden)=4200 threshold=1000  => bracket should be 1 (full IVMS101)');
