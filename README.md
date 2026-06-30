# Veritas

**A privacy-preserving Travel Rule compliance layer for Stellar — proven on-chain.**

When a licensed exchange (a VASP) sends a stablecoin transfer for a customer to another exchange, FATF
Recommendation 16 (the "Travel Rule") forces the sender to hand over the customer's identifying
details. Today that data moves through off-chain networks (Notabene, Sygna, TRP) in the
[IVMS101](https://www.intervasp.org/) format — but there is **no shared, verifiable proof that the
exchange actually happened.** Each VASP just trusts its own private database, which a regulator must
take on faith and which can be quietly edited or "lost" — and the stakes are concrete: in November 2023
Binance reached a $4.3B settlement with the U.S. DOJ, FinCEN, CFTC, and OFAC (FinCEN's $3.4B share alone
the largest Bank Secrecy Act enforcement action in U.S. history), with AML-program, registration, and
SAR-filing failures cited among the core violations — exactly the kind of cross-border customer-data
breakdown the Travel Rule exists to prevent.

Veritas adds the missing piece: a **single zero-knowledge proof, verified inside a Soroban smart
contract and anchored to a settlement**, that attests — *without revealing any personal data* — that
both counterparties are licensed VASPs in the same registry, that the correct rule was applied for the
transfer's value bracket (full IVMS101 above the ~$1,000 FATF threshold, reduced below) **over a hidden
amount**, and that binds a **regulator-openable commitment** to the full attestation. The result is a
tamper-evident, non-repudiable, settlement-anchored **receipt of compliance** that no single party owns:
the public sees only a verified ✓, while a regulator holding the view key can open the full record.

## ✅ Verify it yourself on Stellar testnet

This isn't a slide — a real Groth16/BLS12-381 proof from the Veritas circuit is verified inside a
Soroban contract on testnet. Click and confirm:

| What | Link |
|---|---|
| **Veritas contract** (verifies + anchors compliance) | [`CB6DCNEG…OFWV`](https://stellar.expert/explorer/testnet/contract/CB6DCNEGNXP7WQB3XVDABZ2TUNM5DSK4VYXLCE4OZWGXMGSZRGYBOFWV) |
| **`submit_compliance`** — real proof verified, attestation anchored, `verified` event | [tx `20c48e42…`](https://stellar.expert/explorer/testnet/tx/20c48e426a3bf44b7a719226f06db8f919da9b3028fc2f6ce20355554ddedc28) |
| Phase-1 proof verified on-chain (`verify_proof → true`) | [tx `11f2f89b…`](https://stellar.expert/explorer/testnet/tx/11f2f89b8ff38a01b538b7a24d66cc691fe846038fd3db34612de232b657ef5b) |
| Day-one gate (trivial proof on-chain) | [tx `51c26280…`](https://stellar.expert/explorer/testnet/tx/51c26280818a3eca81293c4c281d85740d363aafb0cb183c1d2a6647c21eb8da) |

The on-chain pairing check costs ~41M of the 100M CPU budget. The attestation read back from chain
(`get_attestation`) contains **no personal data** — only `{bracket, att_commitment, settlement_ref,
submitter}`.

## Why ZK, and why on a blockchain

The PII already moves fine off-chain — what's missing is a **shared, forgery-proof compliance fact**
bound to settlement that no party owns. That's the one thing a smart contract gives you that an
encrypted inbox can't. ZK is what makes it possible: it proves the *correct compliance computation ran
over private inputs* (the hidden amount, the registry membership, the IVMS commitment) and emits a
public ✓ that a signature alone could only produce by **revealing** the very data the Travel Rule is
trying to move privately.

## What's real vs. simulated (honest disclosure)

- **Real:** the IVMS101 format, the Groth16/BLS12-381 circuit, the proof, its **on-chain verification**,
  the registry/threshold/settlement binding, the regulator-openable commitment, and the deployed
  contract — all independently checkable on [stellar.expert](https://stellar.expert).
- **Simulated for the demo:** the participating VASPs, the licensing registry, and the customer PII
  (synthetic IVMS101). You can't onboard a real licensed exchange for a hackathon — but the mocked part
  is only the *participants*, never the cryptography or the on-chain artifact.
- Proofs are generated **live, in-browser** (Groth16/BLS12-381 via snarkjs) and submitted as a **fresh
  transaction on every run** — not pre-generated. If that live call fails, the demo falls back to a
  cached, previously-anchored proof rather than hard-failing. See **[SECURITY.md](./SECURITY.md)** for
  the full threat model and the items deferred to a production build (in-circuit counterparty signature,
  verifiable encryption for the regulator, settlement↔payment binding).

## Architecture

```
┌─────────────┐   IVMS101 (encrypted, off-chain)   ┌─────────────┐
│   VASP A    │ ─────────────────────────────────► │   VASP B    │
│ (originator)│ ◄───────── acknowledgement ──────── │(beneficiary)│
└──────┬──────┘                                     └─────────────┘
       │ Groth16 proof (Circom / BLS12-381), generated off-chain
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Veritas Soroban contract (Stellar testnet)                  │
│   • verify_groth16 — real BLS12-381 pairing check            │
│   • pin registry root + FATF threshold; bind settlementRef   │
│   • store the regulator-openable commitment                  │
│   • emit "verified ✓" (no personal data)                     │
└──────────────────────────────────────────────────────────────┘
       │ public sees only ✓        │ regulator opens with view key
       ▼                           ▼
   stellar.expert              full IVMS101 attestation
```

The circuit (`circuits/veritas.circom`) proves: Merkle membership of both VASP leaves in the same
registry (root exposed as a public output the contract pins), `leafA ≠ leafB`, a **range-checked**
bracket over the hidden `amount`, and a Poseidon commitment binding the whole attestation (payload,
acknowledgement, settlement, regulator key, amount, bracket, both leaves).

## Repository layout

| Path | What it is |
|---|---|
| `circuits/` | Circom circuit + Poseidon-free fixture generator |
| `contracts/veritas/` | Rust Soroban contract — the on-chain compliance anchor (8 unit tests) |
| `tools/encode/` | snarkjs-JSON → Soroban-bytes encoder (arkworks serialization) |
| `web/` | SvelteKit frontend — the public-✓ → regulator-reveal demo |
| `docs/`, `SECURITY.md`, `PLAN.md` | architecture, threat model, phased build log |

## Run it yourself

```bash
# 1. toolchain (circom, snarkjs, stellar-cli, rust wasm target)
./scripts/setup.sh

# 2. circuit -> proof (BLS12-381 Groth16)
cd circuits && npm install && node gen-veritas-input.mjs
../scripts/build-circuit.sh veritas      # compile + trusted setup + vkey
# (generate witness + proof with snarkjs; see scripts/)

# 3. contract: test + deploy + verify on testnet
cargo test --manifest-path contracts/veritas/Cargo.toml
# deploy with the __constructor (admin, registry_root, vk), then submit_compliance — see scripts/deploy.sh

# 4. the demo
cd web && npm install && npm run dev
```

## Engineering & review

Built in phases (see [PLAN.md](./PLAN.md)), each verified by independent **Code-Review** and
**Security-Engineer** audit passes. Those audits caught and fixed real issues — an unconstrained `amount`
(ZK under-constraint), a public-signal ordering bug, and a front-runnable initializer — before this
README was written. Honest work-in-progress over a polished mystery.

## License

MIT — see [LICENSE](./LICENSE).
