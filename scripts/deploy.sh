#!/usr/bin/env bash
# Build + deploy the Veritas Soroban contract to Stellar testnet.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
NET="${NET:-testnet}"
IDENTITY="${IDENTITY:-veritas-dev}"

# Ensure an identity + funded testnet account exist.
stellar keys address "$IDENTITY" >/dev/null 2>&1 || stellar keys generate "$IDENTITY" --network "$NET" --fund

echo "==> building contract (wasm)"
stellar contract build --manifest-path "$HERE/contracts/veritas/Cargo.toml"

WASM="$HERE/contracts/target/wasm32-unknown-unknown/release/veritas_contract.wasm"

echo "==> optimizing"
stellar contract optimize --wasm "$WASM" || true

echo "==> deploying to $NET"
CID=$(stellar contract deploy \
  --wasm "$WASM" \
  --source "$IDENTITY" \
  --network "$NET")

echo "==> deployed: $CID"
echo "$CID" > "$HERE/.contract-id"
echo "    View on explorer: https://stellar.expert/explorer/$NET/contract/$CID"
echo "    Saved to .contract-id"
