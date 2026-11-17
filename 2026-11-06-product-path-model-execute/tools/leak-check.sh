#!/usr/bin/env bash
# leak-check.sh: fail (exit 1) if a staged demo folder or demo tarball carries leak markers or signing secrets.
#
# usage: leak-check.sh [--gitignore <demo-source-dir>] <dir-or-tarball> [<dir-or-tarball> ...]
#
# Checks, per target (tarballs are extracted to a temp dir outside every tree and scanned there):
#   1. case-insensitive, binary-safe (rg -a, no ignore files, hidden files included) matches of every
#      regex in the private pattern file (leak markers, secret field names, Ed25519 PKCS#8 key headers)
#   2. no file named *signing-key* / *.pem / *.key / id_ed25519* is present
# With --gitignore DIR: DIR/.gitignore must list spin/demo-signing-key.json, and every *signing-key*
# file in DIR that holds secret material must be ignored by that .gitignore.
set -uo pipefail
# Patterns come from a PRIVATE file that is never staged, so this script holds none of the strings it hunts.
PATTERNS_FILE=${LEAK_PATTERNS_FILE:-/workspace/weekly-demo-tools/leak-patterns.txt}
[[ -s "$PATTERNS_FILE" ]] || { echo "leak-check: ERROR: pattern file $PATTERNS_FILE missing or empty (fail closed)"; exit 2; }
fail=0
command -v rg >/dev/null || { echo "leak-check: ERROR: ripgrep (rg) not found"; exit 2; }

scan_dir() { # $1 dir, $2 label
  local dir=$1 label=$2 hits files
  hits=$(rg -a -i -n -c --no-ignore --hidden -f "$PATTERNS_FILE" "$dir" 2>/dev/null)
  if [[ -n "$hits" ]]; then
    echo "FAIL [$label] leak/secret pattern matches (file:count):"; echo "$hits" | sed "s#^$dir/#  #"; fail=1
  else
    echo "PASS [$label] 0 matches for $(wc -l < "$PATTERNS_FILE") patterns in $PATTERNS_FILE (rg -a -i --no-ignore --hidden)"
  fi
  files=$(find "$dir" \( -iname '*signing-key*' -o -iname '*.pem' -o -iname '*.key' -o -iname 'id_ed25519*' \) -print)
  if [[ -n "$files" ]]; then
    echo "FAIL [$label] key files present:"; echo "$files" | sed "s#^$dir/#  #"; fail=1
  else
    echo "PASS [$label] no *signing-key* / *.pem / *.key / id_ed25519* files"
  fi
}

if [[ "${1:-}" == "--gitignore" ]]; then
  src=$2; shift 2
  gi="$src/.gitignore"
  if grep -qxF 'spin/demo-signing-key.json' "$gi" 2>/dev/null || grep -qE '(^|/)\*?signing-key' "$gi" 2>/dev/null; then
    echo "PASS [gitignore $src] signing key ignored by .gitignore"
  else
    echo "FAIL [gitignore $src] .gitignore does not ignore spin/demo-signing-key.json"; fail=1
  fi
  while IFS= read -r k; do
    relk=${k#"$src"/}
    if rg -q -a -i -e 'secret|pkcs8|private' -f "$PATTERNS_FILE" "$k"; then
      tmpg=$(mktemp -d); (cd "$tmpg" && git init -q && cp "$gi" .gitignore && mkdir -p "$(dirname "$relk")" && touch "$relk" && git check-ignore -q "$relk")
      ok=$?; rm -rf "$tmpg"
      if [[ $ok -eq 0 ]]; then echo "PASS [gitignore $src] $relk holds secret material and is gitignored"
      else echo "FAIL [gitignore $src] $relk holds secret material but is NOT gitignored"; fail=1; fi
    fi
  done < <(find "$src" -path "$src/node_modules" -prune -o -iname '*signing-key*' -type f -print)
fi

[[ $# -gt 0 ]] || { echo "usage: $0 [--gitignore DIR] <dir-or-tarball>..."; exit 2; }
for t in "$@"; do
  if [[ -d "$t" ]]; then
    scan_dir "$(cd "$t" && pwd)" "dir $t"
  elif [[ -f "$t" && ( "$t" == *.tar.gz || "$t" == *.tgz ) ]]; then
    tmp=$(mktemp -d /tmp/leak-check-XXXXXX)
    if tar xzf "$t" -C "$tmp"; then
      echo "INFO [tar $t] $(find "$tmp" -type f | wc -l) files extracted to temp for scanning"
      scan_dir "$tmp" "tar $t"
    else
      echo "FAIL [tar $t] could not extract"; fail=1
    fi
    rm -rf "$tmp"
  else
    echo "FAIL [$t] not a directory or .tar.gz"; fail=1
  fi
done
if [[ $fail -eq 0 ]]; then echo "LEAK-CHECK: PASS"; else echo "LEAK-CHECK: FAIL"; fi
exit $fail
