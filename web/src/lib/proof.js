// snarkjs (BLS12-381) proof/vk JSON -> Soroban groth16_verifier byte encoding.
// Mirrors tools/encode/src/main.rs (arkworks serialize_uncompressed): each Fq big-endian, x||y.
// Byte-matched against the Rust encoder by scripts/check-encode.mjs before any browser use.

const fq = (dec) => {
  let n = BigInt(dec);
  const b = new Uint8Array(48);
  for (let i = 47; i >= 0; i--) { b[i] = Number(n & 0xffn); n >>= 8n; } // big-endian
  return b;
};
const cat = (...arrs) => {
  const out = new Uint8Array(arrs.reduce((s, a) => s + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
};

export const g1 = (p) => cat(fq(p[0]), fq(p[1])); // 96B
export const g2 = (p) => cat(fq(p[0][1]), fq(p[0][0]), fq(p[1][1]), fq(p[1][0])); // 192B (Fq2 = c1||c0)
export const toHex = (u8) => [...u8].map((x) => x.toString(16).padStart(2, '0')).join('');

export const encodeProof = (pf) => ({ a: g1(pf.pi_a), b: g2(pf.pi_b), c: g1(pf.pi_c) });
