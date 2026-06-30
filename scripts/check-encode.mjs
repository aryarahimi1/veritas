// De-risk gate: the JS proof encoder MUST byte-match the Rust encoder (tools/encode) before any
// browser wiring. The only serious risk in live submission is endianness / Fq2 order — this catches it.
//   node scripts/check-encode.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import { g1, g2, toHex } from '../web/src/lib/proof.js';

const B = '/Users/arya/Desktop/projects/veritas/circuits/build';
const VARGS = '/private/tmp/claude-501/-Users-arya/f08ff39a-2c93-47cc-9f41-793a60db3de2/scratchpad/vargs';

const pf = JSON.parse(readFileSync(`${B}/veritas_proof.json`));
const vk = JSON.parse(readFileSync(`${B}/veritas_vkey.json`));
const rp = JSON.parse(readFileSync(`${VARGS}/proof.json`)); // Rust encoder output
const rv = JSON.parse(readFileSync(`${VARGS}/vk.json`));

assert.equal(toHex(g1(pf.pi_a)), rp.a, 'pi_a');
assert.equal(toHex(g2(pf.pi_b)), rp.b, 'pi_b');
assert.equal(toHex(g1(pf.pi_c)), rp.c, 'pi_c');
assert.equal(toHex(g1(vk.vk_alpha_1)), rv.alpha, 'alpha');
assert.equal(toHex(g2(vk.vk_beta_2)), rv.beta, 'beta');
assert.equal(toHex(g2(vk.vk_gamma_2)), rv.gamma, 'gamma');
assert.equal(toHex(g2(vk.vk_delta_2)), rv.delta, 'delta');
vk.IC.forEach((p, i) => assert.equal(toHex(g1(p)), rv.ic[i], `ic[${i}]`));

console.log('byte-match OK — JS encoder == Rust encoder (', vk.IC.length, 'IC points )');
