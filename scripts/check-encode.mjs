// De-risk gate: the JS proof encoder MUST byte-match the Rust encoder (tools/encode) before any
// browser wiring. The only serious risk in live submission is endianness / Fq2 order — this catches it.
// Self-contained: builds/runs the Rust encoder itself into a fresh temp dir, so it works on any
// machine with `circuits/build/veritas_{proof,vkey}.json` already generated.
//   node scripts/check-encode.mjs
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert';
import { g1, g2, toHex } from '../web/src/lib/proof.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const B = process.env.VERITAS_BUILD_DIR ?? join(ROOT, 'circuits', 'build');
const OUT = mkdtempSync(join(tmpdir(), 'veritas-check-encode-'));

const pf = JSON.parse(readFileSync(join(B, 'veritas_proof.json')));
const vk = JSON.parse(readFileSync(join(B, 'veritas_vkey.json')));

execFileSync(
  'cargo',
  [
    'run',
    '--quiet',
    '--manifest-path',
    join(ROOT, 'tools', 'encode', 'Cargo.toml'),
    '--',
    join(B, 'veritas_vkey.json'),
    join(B, 'veritas_proof.json'),
    OUT,
  ],
  { stdio: 'inherit' },
);

const rp = JSON.parse(readFileSync(join(OUT, 'proof.json'))); // Rust encoder output
const rv = JSON.parse(readFileSync(join(OUT, 'vk.json')));
rmSync(OUT, { recursive: true, force: true });

assert.equal(toHex(g1(pf.pi_a)), rp.a, 'pi_a');
assert.equal(toHex(g2(pf.pi_b)), rp.b, 'pi_b');
assert.equal(toHex(g1(pf.pi_c)), rp.c, 'pi_c');
assert.equal(toHex(g1(vk.vk_alpha_1)), rv.alpha, 'alpha');
assert.equal(toHex(g2(vk.vk_beta_2)), rv.beta, 'beta');
assert.equal(toHex(g2(vk.vk_gamma_2)), rv.gamma, 'gamma');
assert.equal(toHex(g2(vk.vk_delta_2)), rv.delta, 'delta');
vk.IC.forEach((p, i) => assert.equal(toHex(g1(p)), rv.ic[i], `ic[${i}]`));

console.log('byte-match OK — JS encoder == Rust encoder (', vk.IC.length, 'IC points )');
