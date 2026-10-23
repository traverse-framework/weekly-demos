#!/usr/bin/env bash
# WORKAROUND for a traverse-mcp 0.15.0 packaging bug: the crates.io binary loads the
# expedition seed bundle from env!("CARGO_MANIFEST_DIR")/../../examples/... at startup
# (even in Mode A), a path that only exists inside the traverse monorepo checkout.
# This stages exactly those 14 fixture files (from tag v0.15.0) at the compiled-in path.
set -euo pipefail
ROOT="${CARGO_HOME:-$HOME/.cargo}/registry/src"
REF=v0.15.0
BASE=https://raw.githubusercontent.com/traverse-framework/traverse/$REF
files=(examples/expedition/registry-bundle/manifest.json)
for c in capture-expedition-objective interpret-expedition-intent assess-conditions-summary validate-team-readiness assemble-expedition-plan plan-expedition; do files+=(contracts/examples/expedition/capabilities/$c/contract.json); done
for e in expedition-objective-captured expedition-intent-interpreted conditions-summary-assessed team-readiness-validated expedition-plan-assembled; do files+=(contracts/examples/expedition/events/$e/contract.json); done
files+=(workflows/examples/expedition/plan-expedition/workflow.json)
for f in "${files[@]}"; do mkdir -p "$ROOT/$(dirname "$f")"; curl -fsSL "$BASE/$f" -o "$ROOT/$f"; done
echo "staged ${#files[@]} files under $ROOT"
