# Veritas — Security & Threat Model

Veritas was reviewed by independent Code-Review and Security-Engineering passes during Phase 1. This
document records what the zero-knowledge circuit **actually enforces** versus what is **mocked or
deferred** for the hackathon demo — in the spirit of "an honest work-in-progress over a polished
mystery."

## What the circuit cryptographically enforces

- **Registry membership.** Both VASP leaves are members of the same Merkle tree, and the recomputed
  `registryRoot` is a public output. The contract pins the expected root and rejects any proof whose
  `registryRoot` ≠ the pinned value — so a prover cannot substitute a fake registry.
- **Distinct counterparties.** `leafA ≠ leafB` is enforced (no self-pairing).
- **Sound bracket over a hidden amount.** `amount` and `threshold` are range-constrained to < 2^64
  (`Num2Bits(64)`), so `GreaterEqThan` is a valid comparison; the `bracket` bit cannot be flipped by an
  out-of-range amount.
- **Full-attestation commitment.** `attCommitment` binds the IVMS payload hash, the acknowledgement,
  `settlementRef`, the regulator key, a salt, the hidden `amount`, the `bracket`, and both VASP leaves —
  so the commitment can't be opened to a different attestation.
- **Settlement binding / replay.** `settlementRef` is a public input baked into the Groth16
  verification, and the contract checks it and dedups (`AlreadyAnchored`), so an identical proof can't
  be replayed to a different payment.

## What is mocked or deferred (NOT yet enforced) — be clear-eyed

The gap between "a sound demo of the mechanism" and "a production compliance system":

- **Receiving-VASP acknowledgement.** Modelled as a hash of a prover-supplied `ackSecret`; there is no
  real signature from B. *Production:* verify an in-circuit EdDSA signature by B over
  `(settlementRef, ivmsHash)` against the key committed in `leafB`.
- **Regulator opening = commitment open, not decryption.** `attCommitment` is a Poseidon commitment, not
  a ciphertext: the regulator "opens" it by reconstructing the committed tuple and checking it against
  the on-chain commitment — it cannot be decrypted from the chain alone, and `regulatorKey` is currently
  prover-chosen. *Production:* pin the regulator key and use verifiable encryption (ElGamal/ECIES).
- **settlementRef ↔ real payment.** The demo now sends a **real testnet settlement payment** and derives
  the proof's `settlementRef` from that payment's tx hash, so the payment and the compliance proof share
  one on-chain settlement id (UI/flow linkage — two linked txs on stellar.expert). But the **circuit does
  not yet constrain** `settlementRef` to equal `H(payment from, to, amount, asset)`, so it is not
  cryptographically bound to the payment's parties/value. *Production (PLAN.md Phase 21):* enforce that
  equality in-circuit; the contract additionally `require_auth()`s the originating VASP to stop anonymous
  attestation-squatting.
- **Counterparty authority.** The circuit proves the leaves are in the registry, not that the prover
  controls them. *Production:* prove knowledge of the secret behind each leaf (A and B both sign).
- **The registry, the VASPs, and the IVMS101 customer data are simulated.** The IVMS101 *format* is
  real; the participants are not.

## Contract-level hardening (Phase 2) — implemented & audited

Audited by Code-Review + Security-Engineer passes; the following are implemented in `lib.rs`:

- Public-signal ordering corrected to snarkjs order `[bracket, registryRoot, attCommitment,
  settlementRef, threshold]` (the scaffold read them in the wrong order — a real bug the review caught).
- Registry root + verification key pinned **atomically at deploy** via `__constructor`, closing the
  HIGH-1 front-run window where an attacker could pin a malicious VK between deploy and init.
- `threshold` pinned against the contract constant; cheap binding/replay checks run **before** the
  expensive pairing (fail-fast); every public signal is **canonicity-checked** (`< field order`) to
  prevent the `S` / `S+r` dedup-bypass (MED-1).
- Storage **TTL extended** so the compliance receipts stay durable (MED-2).
- The submitting address is **recorded** in the attestation (provenance). The VK/registry are
  intentionally immutable post-deploy — no admin backdoor to forge proofs.
- Real BLS12-381 Groth16 pairing check (not a stub); the BLS host functions validate point membership.
- 10 unit tests cover every negative branch (malformed/canonicity/registry/settlement/threshold/auth) plus
  real-proof accept/reject.

**Still deferred (HIGH-2, honest):** `require_auth(submitter)` proves *a* signer, not the originating
VASP's identity — the submitter is not yet bound in-circuit, so a holder of a valid proof could anchor
it under their own address. Binding the submitter as a public signal (with knowledge-of-leaf-secret) is
the production fix, tracked alongside the in-circuit counterparty signature.

## Phase 7 / web layer — closing security pass

The Phase 7 live-in-browser-proving code (`web/src/lib/*`) was given a dedicated Security-Engineer pass
after shipping. Two things not covered by the circuit/contract sections above:

- **The regulator view-key reveal is a client-side UI simulation, not a real access-control boundary.**
  Every secret needed to reconstruct the attestation (`ackSecret`, `regulatorKey`, `salt`, both VASP
  leaves, `ivmsHash`) plus the full synthetic IVMS101 payload (names, addresses, DOB) ships in the public
  demo's client JS bundle regardless of whether the "Apply regulator view-key" button is ever clicked —
  every visitor already has everything "the regulator" has. This is separate from the already-documented
  fact that `attCommitment` is a commitment-open rather than real decryption: this is about the *demo
  build* additionally shipping the plaintext secret and payload to every browser. *Production:* gate
  those values behind a real server-side check (or real verifiable encryption per the item above) so
  "SEALED" is an actual state, not a component-state toggle.
- **The Groth16 trusted setup was a single local contribution** (one `powersoftau contribute`, no
  multi-party ceremony, no public beacon). Whoever ran it transiently held the toxic waste for this
  circuit/verifying key; unless verifiably destroyed, that party could in principle forge a proof
  satisfying the on-chain pairing check for arbitrary public inputs. *Production:* a real multi-party
  ceremony (or a transparent/updatable-SRS proof system) is required before this could anchor real
  compliance decisions.

## Reviews

Phase 1 was audited by a Code-Review pass (found the unranged-`amount` under-constraint) and a
Security-Engineering threat model (found the unbound-`amount`, self-pairing, signal-ordering, and
regulator-modelling issues). Phase 7 was audited by a follow-up Security-Engineer pass (found the two
items directly above). The cheap, high-value fixes were applied; the heavyweight items are documented
rather than faked.
