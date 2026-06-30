pragma circom 2.1.9;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/mux1.circom";
include "circomlib/circuits/bitify.circom";

/*
 * Veritas — Travel Rule compliance circuit (BLS12-381 / Groth16)
 * --------------------------------------------------------------
 * Proves, over PRIVATE inputs, that a compliant FATF R16 (Travel Rule) data exchange occurred for a
 * settlement of a HIDDEN amount — without revealing the IVMS101 data, the amount, or which VASPs were
 * involved on-chain. registryRoot + attCommitment are computed IN-CIRCUIT and exposed as PUBLIC
 * OUTPUTS; the contract pins the expected registry root and checks the proof's registryRoot against it.
 *
 * PUBLIC inputs:  settlementRef (binds to the Soroban payment), threshold (FATF threshold; the contract
 *                 must also pin this against its own constant).
 * PUBLIC outputs: bracket (1=full IVMS101 >= threshold, 0=reduced), registryRoot, attCommitment.
 * PRIVATE:        amount, leafA/leafB (VASP identity commitments), Merkle paths, ivmsHash, ackSecret,
 *                 regulatorKey, salt.
 *
 * SECURITY NOTES — demo trust assumptions (intentionally NOT enforced in-circuit; see README/SECURITY):
 *   - The receiving VASP's acknowledgement is modelled as a hash of a prover-supplied `ackSecret`. A
 *     production version must verify an in-circuit EdDSA signature by B over (settlementRef, ivmsHash)
 *     against the key committed in leafB. Here it is a demo binding only.
 *   - `regulatorKey` is a prover-supplied field element; production must pin the real regulator key and
 *     use a verifiable encryption (e.g. ElGamal/ECIES) so the regulator can truly OPEN the attestation.
 *     Here `attCommitment` is a Poseidon COMMITMENT: the regulator opens it by reconstructing the
 *     committed tuple and checking it against the on-chain commitment (selective disclosure by opening).
 *   - `settlementRef` is bound into the proof but is not yet checked against the real payment's parties
 *     and value; the contract should additionally bind it and require_auth from the originating VASP.
 */

// Recompute a Merkle root from a leaf + inclusion path (Poseidon, BLS12-381 field).
template MerkleRoot(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndex[depth];   // 0 = leaf on the left, 1 = leaf on the right
    signal output root;

    component hashers[depth];
    component mux[depth];
    signal cur[depth + 1];
    cur[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        pathIndex[i] * (1 - pathIndex[i]) === 0; // boolean

        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== cur[i];          mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i]; mux[i].c[1][1] <== cur[i];
        mux[i].s <== pathIndex[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];
        cur[i + 1] <== hashers[i].out;
    }

    root <== cur[depth];
}

template Veritas(depth) {
    // public inputs
    signal input settlementRef;
    signal input threshold;
    // public outputs
    signal output bracket;
    signal output registryRoot;
    signal output attCommitment;
    // private inputs
    signal input amount;
    signal input leafA;
    signal input leafB;
    signal input pathA[depth];
    signal input idxA[depth];
    signal input pathB[depth];
    signal input idxB[depth];
    signal input ivmsHash;
    signal input ackSecret;
    signal input regulatorKey;
    signal input salt;

    // 1) Both VASPs are members of the same licensed-VASP registry.
    component incA = MerkleRoot(depth);
    incA.leaf <== leafA;
    for (var i = 0; i < depth; i++) { incA.pathElements[i] <== pathA[i]; incA.pathIndex[i] <== idxA[i]; }

    component incB = MerkleRoot(depth);
    incB.leaf <== leafB;
    for (var i = 0; i < depth; i++) { incB.pathElements[i] <== pathB[i]; incB.pathIndex[i] <== idxB[i]; }

    incA.root === incB.root;          // same registry for both counterparties
    registryRoot <== incA.root;       // contract checks this against its pinned root

    // 1b) Distinct counterparties — no self-pairing (fixes C2 self-pairing).
    component distinct = IsEqual();
    distinct.in[0] <== leafA;
    distinct.in[1] <== leafB;
    distinct.out === 0;

    // 2) Range-constrain amount AND threshold (GreaterEqThan is only sound when both are < 2^64),
    //    then compute the bracket over the HIDDEN amount (the load-bearing ZK part).
    component amtBits = Num2Bits(64);
    amtBits.in <== amount;
    component thrBits = Num2Bits(64);
    thrBits.in <== threshold;

    component ge = GreaterEqThan(64);
    ge.in[0] <== amount;
    ge.in[1] <== threshold;
    bracket <== ge.out;               // 1 => full IVMS101 required, 0 => reduced

    // 3) Receiving VASP acknowledgement (DEMO binding — see SECURITY NOTES).
    component ack = Poseidon(3);
    ack.inputs[0] <== ackSecret;
    ack.inputs[1] <== ivmsHash;
    ack.inputs[2] <== leafB;

    // 4) Attestation commitment — binds the FULL attestation: payload, acknowledgement, settlement,
    //    regulator key, salt, the hidden amount, the bracket, and BOTH counterparties. Exposed as a
    //    public output for the contract to store; openable by the regulator via commitment opening.
    component att = Poseidon(9);
    att.inputs[0] <== ivmsHash;
    att.inputs[1] <== ack.out;
    att.inputs[2] <== settlementRef;
    att.inputs[3] <== regulatorKey;
    att.inputs[4] <== salt;
    att.inputs[5] <== amount;
    att.inputs[6] <== bracket;
    att.inputs[7] <== leafA;
    att.inputs[8] <== leafB;
    attCommitment <== att.out;
}

component main { public [settlementRef, threshold] } = Veritas(16);
