#!/usr/bin/env bash
# Compile a Circom circuit on BLS12-381 and run a Groth16 trusted setup.
# Usage: scripts/build-circuit.sh [circuit-name]   (default: veritas)
set -euo pipefail

CIRCUIT="${1:-veritas}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CDIR="$HERE/circuits"
OUT="$CDIR/build"
POWER="${POWER:-16}"   # 2^16 constraints; bump if the circuit grows
mkdir -p "$OUT"

echo "==> compiling $CIRCUIT.circom (BLS12-381)"
circom "$CDIR/$CIRCUIT.circom" \
  --r1cs --wasm --sym \
  --prime bls12381 \
  -l "$CDIR/node_modules" \
  -o "$OUT"

echo "==> powers of tau (bls12-381, 2^$POWER)"
snarkjs powersoftau new bls12-381 "$POWER" "$OUT/pot_0.ptau" -v
snarkjs powersoftau contribute "$OUT/pot_0.ptau" "$OUT/pot_1.ptau" --name="veritas" -v -e="$(date +%s)$RANDOM"
snarkjs powersoftau prepare phase2 "$OUT/pot_1.ptau" "$OUT/pot_final.ptau" -v

echo "==> groth16 setup + verification key"
snarkjs groth16 setup "$OUT/$CIRCUIT.r1cs" "$OUT/pot_final.ptau" "$OUT/${CIRCUIT}_0.zkey"
snarkjs zkey contribute "$OUT/${CIRCUIT}_0.zkey" "$OUT/${CIRCUIT}_final.zkey" --name="veritas" -v -e="$(date +%s)$RANDOM"
snarkjs zkey export verificationkey "$OUT/${CIRCUIT}_final.zkey" "$OUT/verification_key.json"

echo "==> done. Artifacts in $OUT (vkey: verification_key.json)"
echo "    Next: generate a proof, then verify it inside the Soroban contract (scripts/deploy.sh)."
