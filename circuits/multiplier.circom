pragma circom 2.1.9;

// Phase-0 trivial circuit: prove knowledge of a, b such that a*b = c,
// where c is the public output. Used only to validate the
// circom -> snarkjs (BLS12-381) -> Groth16 -> Soroban verification path.
template Multiplier() {
    signal input a;
    signal input b;
    signal output c;
    c <== a * b;
}

component main = Multiplier();
