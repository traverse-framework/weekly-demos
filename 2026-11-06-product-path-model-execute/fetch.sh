#!/usr/bin/env bash
# Re-download published 0.16.2 inputs (no git checkout required).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p published/package bundle/runtime bundle/components/model-execute
curl -fsSL 'https://github.com/traverse-framework/traverse/releases/download/runtime-wasm-v0.16.2/runtime.wasm' -o bundle/runtime/runtime.wasm
curl -fsSL 'https://github.com/traverse-framework/traverse/releases/download/runtime-wasm-v0.16.2/runtime.wasm.sha256' -o bundle/runtime/runtime.wasm.sha256
curl -fsSL 'https://github.com/traverse-framework/traverse/releases/download/runtime-wasm-v0.16.2/runtime-release.json' -o published/runtime-release.json
TAG=https://raw.githubusercontent.com/traverse-framework/traverse/v0.16.2
for f in model.manifest.json model.wasm model.sig.json; do
  curl -fsSL "$TAG/fixtures/models/digits-onnx-1.0.0/$f" -o "published/package/$f"
done
curl -fsSL "$TAG/fixtures/models/conformance/signed-digits-onnx.json" -o published/package/vector.json
curl -fsSL "$TAG/fixtures/cross-host/model-execute-v1/input.json" -o published/input.json
curl -fsSL https://github.com/traverse-framework/registry/releases/download/artifacts/model.execute-1.0.0/model-execute-agent.wasm \
  -o bundle/components/model-execute/model-execute-agent.wasm
# Minimal catalog only: the full registry catalog is fetched into a temp dir outside this tree,
# filtered to catalog.allowlist, and deleted. Missing allowlisted entry = hard failure.
node tools/minimal-catalog.mjs --allowlist catalog.allowlist --out published/catalog.json
node hosts/make-bundle.mjs
npm install --no-audit --no-fund --save-exact traverse-embedder-web@0.16.2
