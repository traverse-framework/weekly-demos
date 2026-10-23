# 2026-10-23 · The agent gets the real MCP server, and still can't freestyle

**Traverse v0.15.0 · `traverse-mcp` 0.15.0 (crates.io) · `traverse-embedder-web` 0.15.0 · catalog `core.authorize@1.2.0`**

Atlas, an ops agent, tries to push a $2.4M offshore wire for a junior analyst. The catalog's `core.authorize@1.2.0` WASM (`sha256:0c318fff…`) decides it on three hosts, live from one button:

| Host | Path | Engine |
|---|---|---|
| Browser | `traverse-embedder-web` 0.15.0 BundleEmbedder → `runtime.wasm` (`a254c161…`) | nested wasmi in the tab |
| Node | same npm package, NodeFsBundleLoader | nested wasmi in Node |
| **Agent** | **published `traverse-mcp` 0.15.0 binary**, stdio, Mode A `verified_public` over a digest-verified registry cache prepared from `index-v407` | native wasmtime |

This is the first week the agent column is the real product MCP server rather than a façade.

## What it shows
- **Same decision everywhere.** Cheat gives `deny` / `no_matching_rule`; legit `treasury_ops` gives `allow` with `require_mfa` + `dual_control` (threshold $100k).
- **The agent can't freestyle through MCP.** Each of these was tried through the real server:

| Attempt | Answer |
|---|---|
| invent `core.authorize@1.3.0` | `not_found` |
| downgrade to `@1.0.0` (in the index, never pinned into the cache) | `registry_cache_entry_missing` |
| request 1.0.0 under the 1.2.0 entrypoint | `invalid_request` |
| made-up `core.approve-wire@1.0.0` | `not_found` |
| one bit flipped in the cached WASM | `registry_artifact_digest_mismatch` |

- **Found by running it three ways:** `policy_hash` splits across hosts (`2a126b86…` on the embedders vs `51a64653…` on traverse-mcp) for the same WASM and the same logical input. `traverse-mcp` re-serializes input with sorted keys, the embedders pass caller bytes through, and `core.authorize` hashes raw bytes. With sorted-key input, all three hosts are byte-identical. Filed as traverse#1722.

## Run
```bash
npm install
cargo +1.94.0 install traverse-mcp --version 0.15.0 --locked --root /tmp/tmcp-bin && cp /tmp/tmcp-bin/bin/traverse-mcp mcp/bin/
npm run stage-mcp-fixture   # workaround for traverse#1720
mcp/bin/traverse-mcp prepare-cache --synced-state mcp/synced-state.json --cache mcp/cache --ref 'core/core.authorize@=1.2.0' --json
npm run digest-match        # Node + Node(sorted keys) + Agent → proof/*.json
PORT=8777 npm start          # open http://127.0.0.1:8777  (#auto runs on load)
```

## Honest gaps
- traverse#1720: the crates.io `traverse-mcp` binary can't start stdio outside a monorepo checkout (expedition bundle path compiled in via `CARGO_MANIFEST_DIR`). The demo stages 13 fixture files from tag v0.15.0 (`mcp/stage-expedition-fixture.sh`).
- traverse#1721: there's no prebuilt binary and no sync command. `mcp/synced-state.json` is built by hand from `index-v407`; a thin first version failed with an opaque `invalid verification bindings`.
- traverse#1722: cross-host `policy_hash` divergence (input-bytes contract).
- Mode A verifies by digest only (`verification: "digest"`, development security config). There's no Ed25519 signature on the cache yet.
- Fixed since 09-25: `releaseEvidence().package.version` now reports 0.15.0.

## Proof files
`proof/agent-mcp.json`, `proof/node-host.json`, `proof/node-host-canonical.json`, `proof/digest-match.json`, `proof/prepare-cache.json`, `docs/screenshots/`.
