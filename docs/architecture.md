# Veritas — architecture & design

## The problem (precisely)

FATF **Recommendation 16** (the "Travel Rule") requires that when an originating VASP transfers value
on a customer's behalf, it transmits required originator/beneficiary information to the beneficiary
VASP. For crypto, that data is exchanged off-chain in the **IVMS101** format via networks like
Notabene, Sygna, and TRP.

The gap: those networks move the data privately but produce **no shared, verifiable proof that the
exchange happened correctly and was bound to a specific settlement.** Each VASP keeps its own private
log. An auditor must trust a database the VASP fully controls — which can be edited or "lost."

## What Veritas adds

A single Groth16 (BLS12-381) proof, verified by a Soroban contract and **bound to the on-chain payment
that moved the money**, attesting four things at once without revealing any personal data:

1. **Both counterparties are licensed VASPs** — Merkle membership in a registry whose root is on-chain.
2. **The correct bracket logic was applied to a hidden amount** — a range proof over the FATF threshold
   (full IVMS101 ≥ threshold, reduced below). *This is the load-bearing ZK: it proves the compliance
   computation ran correctly over private inputs.*
3. **The receiving VASP acknowledged receipt** of the required IVMS101 data — bound in-circuit.
4. **A regulator-openable commitment** to the full attestation — selective disclosure via a view key.

## Data flow

1. **Off-chain (unchanged from today):** VASP A sends the IVMS101 payload to VASP B, encrypted. B
   acknowledges.
2. **Proving (client-side):** A constructs the witness (amount, IVMS commitment, registry paths, ack,
   regulator key, salt) and generates the Groth16 proof in the browser (snarkjs WASM).
3. **Anchoring (on-chain):** A submits `(proof, public_inputs, settlementRef)` to the Veritas Soroban
   contract. The contract verifies the proof, checks the public inputs bind to the registry root, the
   settlement, and the threshold, stores the attestation, and emits a public `verified ✓` event.
4. **Public view:** anyone on stellar.expert sees only the ✓, the bracket, and the settlement binding —
   no names, no amount, no IVMS101.
5. **Regulator view:** the holder of the designated view key reconstructs the committed attestation
   tuple and verifies it against the on-chain `attCommitment`, opening the full IVMS101 record for *this*
   settlement and nothing else. (`attCommitment` is a Poseidon *commitment*, opened by reconstruction —
   not a ciphertext decrypted from the chain. See [SECURITY.md](../SECURITY.md) for the production
   verifiable-encryption note.) `registryRoot` and `attCommitment` are public **outputs** the circuit
   computes, not supplied inputs.

## Public vs. private inputs

| | Field | Why |
|---|---|---|
| public | `registryRoot` | so the contract can confirm both VASPs are licensed |
| public | `settlementRef` | binds the proof to the exact Soroban payment |
| public | `threshold` | the FATF data-sharing threshold the bracket was decided against |
| public | `attCommitment` | regulator-openable; reveals nothing on its own |
| private | `amount` | only the *bracket* (≥/< threshold) is provable, never the value |
| private | `ivmsHash`, IVMS fields | the customer data — never on-chain |
| private | VASP identity leaves + Merkle paths | which VASPs is not disclosed publicly |
| private | `ackSecret`, `regulatorKey`, `salt` | acknowledgement + selective-disclosure plumbing |

## What's real vs. simulated

- **Real:** IVMS101 format, the Soroban settlement tx (testnet USDC), the Groth16 proof, its on-chain
  verification, the settlement binding, the view-key reveal. All independently checkable.
- **Simulated:** the participating VASPs, the licensing registry, and the customer PII (synthetic). The
  mocked part is only the *participants*, never the cryptography or the on-chain artifact.

## Why ZK and not just signatures

A signature could attest "source is authorized" or "I received the data" — but only by **naming** the
parties or **revealing** the amount, which defeats the privacy the Travel Rule is trying to preserve.
ZK is what lets a third party verify the *compliance computation ran correctly over private inputs*
and produce a public, non-repudiable ✓ that leaks nothing. Remove the proof and you're back to
trusting a private database — which is exactly the status quo Veritas replaces.
