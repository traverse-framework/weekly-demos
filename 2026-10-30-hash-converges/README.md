# 2026-10-30 · One audit fingerprint, every host

**traverse `main` 70f3ee7 (unreleased; latest tag is still v0.15.0) · `traverse-mcp` built from main · `traverse-embedder-web` 0.15.0 (npm) + main `runtime.wasm` (`ec49cb76…`) · registry `index-v412` · catalog `core.authorize@1.2.0` (`sha256:0c318fff…`)**

Last week, running `core.authorize@1.2.0` on three hosts found a split: same WASM, same wire, same decision, but the agent's MCP server produced a different `policy_hash` than the embedders (traverse#1722). This week traverse `main` closed it, along with the two papercuts around it. This demo shows before and after, live, on four columns.

| Column | Path | `policy_hash` (cheat wire) |
|---|---|---|
| 0 · Before, Browser | embedder-web 0.15.0 + v0.15.0-era `runtime.wasm` `a254c161…` | `2a126b86…` |
| 1 · Browser (main) | embedder-web 0.15.0 + main `runtime.wasm` `ec49cb76…`, nested wasmi in the tab | `51a64653…` |
| 2 · Node (main) | same npm package, NodeFsBundleLoader, same main `runtime.wasm` | `51a64653…` |
| 3 · Agent (main) | `traverse-mcp` built from main, stdio, Mode A `verified_public`, native wasmtime | `51a64653…` |

The caller sends unsorted JSON. Since [#1739](https://github.com/traverse-framework/traverse/pull/1739) (Spec 1722, Decision 118) every host hands the guest RFC 8785 canonical bytes, so the full output, `policy_hash` included, is byte-identical across Browser, Node, and the agent.

## Last week's three tickets
| Ticket | Status | What this demo shows |
|---|---|---|
| [traverse#1722](https://github.com/traverse-framework/traverse/issues/1722) policy_hash split | closed by #1739 | four-column before/after above |
| [traverse#1720](https://github.com/traverse-framework/traverse/issues/1720) Mode A needs staged expedition fixtures | closed by #1725 | binary runs from an empty directory; the 13-file fixture staging script is gone; no source path compiled into the binary |
| [traverse#1721](https://github.com/traverse-framework/traverse/issues/1721) no sync command / no prebuilt binary | half done: `traverse-mcp sync` shipped in #1758 (today) | `mcp/synced-state.json` now comes from `traverse-mcp sync` against live `index-v412` (232 records), not hand-built |

The five freestyle attempts from last week still fail closed through the main binary: `not_found` (invented 1.3.0), `registry_cache_entry_missing` (downgrade to 1.0.0), `invalid_request` (version mismatch under the entrypoint), `not_found` (made-up `core.approve-wire`), `registry_artifact_digest_mismatch` (one bit flipped in the cache).

## Run
```bash
npm install
# traverse-mcp from traverse main (needs rust 1.95.0; wasmtime 48.0.7 requires it)
git -C <traverse checkout> checkout 70f3ee74825a02b180715e7b173944de9cc52b58
cargo +1.95.0 build --release -p traverse-mcp && cp <traverse>/target/release/traverse-mcp mcp/bin/
cp <traverse>/runtime/runtime.wasm* <traverse>/runtime/runtime-release.json bundle/runtime/
mcp/bin/traverse-mcp sync --out mcp/synced-state.json --json
mcp/bin/traverse-mcp prepare-cache --synced-state mcp/synced-state.json --cache mcp/cache --ref 'core/core.authorize@=1.2.0' --json
npm run digest-match        # before + after on Node, plus the agent -> proof/*.json
PORT=8778 npm start         # open http://127.0.0.1:8778/#auto
```

## Honest gaps
- **Unreleased.** All of this is on `main`, not a tag. npm and crates.io are still 0.15.0, and the browser/Node columns use the npm 0.15.0 JS with main's `runtime.wasm` swapped into the app bundle (canonicalization lives in `runtime.wasm`, so this is the real code path, but it's not a published package).
- **#1721 is still open:** no prebuilt `traverse-mcp` binary on a release yet. Building it needs Rust 1.95.0 now (1.94 fails on wasmtime 48.0.7).
- `prepare-cache --json` still reports `kind: mcp_mode_b_prepare_cache` even when the cache is used by Mode A (cosmetic).
- Mode A still verifies by digest only (no Ed25519 signature on the cache).
- traverse#1719 (model.execute on the embedders) is still open; PR #1755 is in review.

## Proof files
`proof/digest-match.json` (before + after comparison), `proof/node-host.json`, `proof/node-host-before.json`, `proof/node-host-canonical.json`, `proof/agent-mcp.json`, `proof/sync.json`, `proof/prepare-cache.json`, archived last-week proofs in `proof-v0.15.0/`, screenshots in `docs/screenshots/`.

## Not committed here
The two `runtime.wasm` files (over 1 MB each) are not in this folder; their digests are in `bundle/runtime/runtime.wasm.sha256` (main, `ec49cb76…`) and `bundle-before/runtime/runtime.wasm.sha256` (v0.15.0-era, `a254c161…`). Copy main's from your traverse checkout as in **Run**, and the v0.15.0 one from the v0.15.0 release (or `2026-10-23-agent-mcp/bundle/runtime/runtime.wasm` in this repo) into `bundle-before/runtime/`. The `traverse-mcp` binary is not committed either (`mcp/bin/` is empty).
