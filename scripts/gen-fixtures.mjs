// Generate demo fixtures: a mock licensed-VASP registry (Poseidon Merkle tree) + a sample IVMS101
// payload + the inputs the circuit expects. Run after `npm install` inside circuits/.
//
//   node scripts/gen-fixtures.mjs
//
// Needs `circomlibjs` (add to circuits/package.json deps). Writes circuits/build/fixtures.json.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'circuits', 'build');
const DEPTH = 16;

let buildPoseidon;
try {
  ({ buildPoseidon } = await import('circomlibjs'));
} catch {
  console.error('Missing dep: run `npm i circomlibjs` in circuits/ first.');
  process.exit(1);
}

const poseidon = await buildPoseidon();
const F = poseidon.F;
const H = (xs) => F.toObject(poseidon(xs));

// --- mock licensed VASPs ---
const vasps = [
  { name: 'Helvetia Digital AG', lei: '506700XXXXVERITAS01', jurisdiction: 'CH' },
  { name: 'Meridian Exchange Ltd', lei: '529900XXXXVERITAS02', jurisdiction: 'SG' },
  { name: 'Atlas Custody Inc', lei: '254900XXXXVERITAS03', jurisdiction: 'US' },
  { name: 'Nordic Coin AS', lei: '549300XXXXVERITAS04', jurisdiction: 'NO' }
];

// leaf = Poseidon(hash(name), hash(lei))  — placeholder identity commitment
const strToField = (s) => BigInt('0x' + Buffer.from(s).toString('hex')) % F.p;
const leaves = vasps.map((v) => H([strToField(v.lei), strToField(v.jurisdiction)]));

// pad to a full tree
const ZERO = 0n;
function buildTree(leaves, depth) {
  let level = [...leaves];
  while (level.length < 2 ** depth) level.push(ZERO);
  const layers = [level];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(H([level[i], level[i + 1]]));
    layers.push(next);
    level = next;
  }
  return layers;
}
function proof(layers, index, depth) {
  const path = [], idx = [];
  let i = index;
  for (let d = 0; d < depth; d++) {
    const sib = i ^ 1;
    path.push(layers[d][sib].toString());
    idx.push(i & 1);
    i >>= 1;
  }
  return { path, idx };
}

const layers = buildTree(leaves, DEPTH);
const root = layers[DEPTH][0];

const sample = {
  registryRoot: root.toString(),
  threshold: '1000',
  transfer: { originatorIdx: 0, beneficiaryIdx: 1, amount: '4200', asset: 'USDC' },
  originator: proof(layers, 0, DEPTH),
  beneficiary: proof(layers, 1, DEPTH),
  ivms101: {
    originatorVASP: vasps[0],
    beneficiaryVASP: vasps[1],
    // kept minimal here — the full synthetic IVMS101 record lives in web/src/lib/fixtures.js
    note: 'synthetic demo data — no real customer PII'
  }
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'fixtures.json'), JSON.stringify(sample, null, 2));
console.log('wrote', join(OUT, 'fixtures.json'));
console.log('registryRoot =', root.toString());
