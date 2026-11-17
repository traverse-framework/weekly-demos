#!/usr/bin/env bash
# stage.sh <demo-src-dir> <staged-dir> <tarball> <tar-root-name>
# Copies the demo into the weekly-demos staging folder and builds a tarball, excluding node_modules,
# caches, and every signing key, then runs leak-check on both. Never touches any git remote.
set -euo pipefail
src=$(cd "$1" && pwd); staged=$2; tarball=$3; root=$4
here=$(cd "$(dirname "$0")" && pwd)
EXCL=(--exclude=node_modules --exclude=.npm-cache --exclude=.cargo-home --exclude=.cargo-target --exclude='*signing-key*' --exclude='*.pem' --exclude='*.key' --exclude='id_ed25519*')
tmp=$(mktemp -d)
mkdir -p "$tmp/$root"
tar cf - -C "$src" "${EXCL[@]}" . | tar xf - -C "$tmp/$root"
tar czf "$tarball" -C "$tmp" "$root"
# replace the staged folder wholesale (local, untracked staging copy only)
rm -rf "$staged"; mkdir -p "$(dirname "$staged")"
cp -a "$tmp/$root" "$staged"
rm -rf "$tmp"
echo "staged: $staged ($(find "$staged" -type f | wc -l) files)"; echo "tarball: $tarball ($(stat -c %s "$tarball") bytes, sha256 $(sha256sum "$tarball" | cut -c1-16)...)"
"$here/leak-check.sh" --gitignore "$src" "$staged" "$tarball"
