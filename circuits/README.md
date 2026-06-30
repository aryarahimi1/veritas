# Veritas circuits

`veritas.circom` proves that a compliant FATF Travel Rule exchange occurred for a settlement of a
**hidden amount**, without revealing the customer's IVMS101 data or the amount on-chain.

## What it proves (public ← private)

| Public input | Meaning |
|---|---|
| `registryRoot` | Merkle root of the licensed-VASP registry |
| `settlementRef` | binds the proof to the exact Soroban payment |
| `threshold` | FATF data-sharing threshold (e.g. 1000) |
| `attCommitment` | regulator-view-key-openable commitment to the full attestation |
| `compliant` (out) | 1 iff all checks pass |
| `bracket` (out) | 1 = full IVMS101 (≥ threshold), 0 = reduced (< threshold) |

The **load-bearing ZK** is the bracket logic over the private `amount` plus the
verifiable computation over the private IVMS101 commitment — neither can be replicated by a plain
signature without leaking the data the Travel Rule moves privately.

## Build

```bash
npm install            # circomlib
npm run build          # -> ../scripts/build-circuit.sh  (compile bls12381 + trusted setup + vkey)
```

Outputs land in `circuits/build/` (git-ignored): `veritas.r1cs`, `veritas_js/veritas.wasm`,
`veritas_final.zkey`, `verification_key.json`.

> Phase 0 first builds a **trivial** circuit to prove the on-chain verification path before this one.
