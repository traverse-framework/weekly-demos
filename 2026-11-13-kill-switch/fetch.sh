#!/usr/bin/env bash
# Re-download published inputs (no git checkout). runtime.wasm comes from the v0.17.0 tag tree:
# v0.17.0 never got a runtime-wasm-v0.17.0 release asset (crates.io publish failed, see v0.17.1 notes).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p published/package bundle/runtime bundle/components/model-execute
B=https://raw.githubusercontent.com/traverse-framework/traverse/v0.17.0
curl -fsSL $B/runtime/runtime.wasm -o bundle/runtime/runtime.wasm
curl -fsSL $B/runtime/runtime.wasm.sha256 -o bundle/runtime/runtime.wasm.sha256
curl -fsSL $B/runtime/runtime-release.json -o published/runtime-release.json
for f in model.manifest.json model.wasm model.sig.json; do curl -fsSL "$B/fixtures/models/digits-onnx-1.0.0/$f" -o "published/package/$f"; done
curl -fsSL "$B/fixtures/models/conformance/signed-digits-onnx.json" -o published/package/vector.json
curl -fsSL "$B/fixtures/cross-host/model-execute-v1/input.json" -o published/input.json
curl -fsSL https://github.com/traverse-framework/registry/releases/download/artifacts/model.execute-1.0.0/model-execute-agent.wasm -o bundle/components/model-execute/model-execute-agent.wasm
# Minimal catalog only: the full registry catalog is fetched into a temp dir outside this tree,
# filtered to catalog.allowlist, and deleted. Missing allowlisted entry = hard failure.
node tools/minimal-catalog.mjs --allowlist catalog.allowlist --out published/catalog.json
npm install --no-audit --no-fund
node hosts/make-bundle.mjs
node spin/build.mjs   # demo runaway guest; reuses spin/demo-signing-key.json if present
