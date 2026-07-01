# Veritas circuits

`veritas.circom` proves that a compliant FATF Travel Rule exchange occurred for a settlement of a
**hidden amount**, without revealing the customer's IVMS101 data or the amount on-chain.

## What it proves (public ← private)

The circuit exposes exactly **five public signals**, in snarkjs order. Three are **outputs the
circuit computes**; two are **public inputs** the prover supplies and the contract pins/checks:

| # | Signal | Kind | Meaning |
|---|---|---|---|
| 1 | `bracket` | computed output | 1 = full IVMS101 (≥ threshold), 0 = reduced (< threshold) |
| 2 | `registryRoot` | computed output | Merkle root of the licensed-VASP registry, recomputed in-circuit; the contract rejects it unless it equals the pinned root |
| 3 | `attCommitment` | computed output | regulator-view-key-openable commitment to the full attestation |
| 4 | `settlementRef` | public input | binds the proof to the exact Stellar settlement payment |
| 5 | `threshold` | public input | FATF data-sharing threshold (e.g. 1000); the contract pins it against its own constant |

There is deliberately **no `compliant` output**: a public signal constrained to a constant 1 is a
ZK anti-pattern — it carries no information, because an accepting Groth16 proof already means every
constraint held. Compliance is the proof verifying, not a flag.

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
