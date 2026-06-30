#!/usr/bin/env bash
# Veritas — one-time toolchain setup.
set -euo pipefail

echo "==> Veritas toolchain setup"

# 1. Rust + wasm target (for the Soroban contract)
if ! command -v rustc >/dev/null 2>&1; then
  echo "Install Rust first: https://rustup.rs"; exit 1
fi
rustup target add wasm32-unknown-unknown || rustup target add wasm32v1-none || true

# 2. Stellar CLI (Soroban)
if ! command -v stellar >/dev/null 2>&1; then
  echo "==> installing stellar-cli"
  cargo install --locked stellar-cli
fi

# 3. snarkjs (proof generation + on-chain vkey export)
if ! command -v snarkjs >/dev/null 2>&1; then
  echo "==> installing snarkjs (global)"
  npm install -g snarkjs
fi

# 4. circom (compile circuits). Built from source — the npm package is deprecated.
if ! command -v circom >/dev/null 2>&1; then
  echo "==> circom not found. Install with:"
  echo "    git clone https://github.com/iden3/circom && cd circom && cargo build --release && cargo install --path circom"
fi

# 5. JS deps
( cd "$(dirname "$0")/../circuits" && npm install )
( cd "$(dirname "$0")/../web" && npm install )

echo "==> done. Next: scripts/build-circuit.sh trivial   (the Phase-0 day-one gate)"
