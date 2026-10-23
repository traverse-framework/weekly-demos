# CEO brief · 2026-10-23 · "The agent gets the real MCP server, and still can't freestyle"

**Folder to publish:** `weekly-demos/2026-10-23-agent-mcp`

## Hook
For the first time, the agent in the demo talks to the **published `traverse-mcp` binary** (v0.15.0, built from crates.io), not a mock. It runs in Mode A: it only serves what's in a digest-verified registry cache. The same catalog WASM runs in the browser, in Node, and behind the agent's MCP server. The agent tries five ways to cheat and gets five typed refusals.

## Beats for the post
1. Atlas (ops agent) tries a $2.4M offshore wire for a junior analyst. `core.authorize@1.2.0` says deny (`no_matching_rule`) on all three hosts. The legit treasury_ops call says allow, with MFA and dual control.
2. The agent can't route around it through MCP: an invented version gives `not_found`; a real-but-unpinned version gives `registry_cache_entry_missing`; a version swap inside the request gives `invalid_request`; a made-up capability gives `not_found`; a one-bit tamper of the cached WASM gives `registry_artifact_digest_mismatch`.
3. The honest twist, and the best part: running one WASM on three hosts caught a real determinism bug. Decisions match, but the policy fingerprint (`policy_hash`) differs, because the MCP server re-sorts JSON keys before the capability sees them. Sort the keys and every byte matches. That's the point of multi-host truth: it finds things single-host demos never would. Filed as traverse#1722.

## Version truth
Traverse v0.15.0 (tag @44915539). traverse-mcp / runtime / embedder crates 0.15.0, traverse-registry 0.28.0, npm traverse-embedder-web 0.15.0, runtime.wasm a254c161, catalog 228 caps, registry index-v407 (226 caps). traverse-mcp binary sha256 0b6e5b85…

## Gaps (filed, on the Traverse board as Ready)
- traverse#1720: the crates.io traverse-mcp can't start outside a monorepo checkout (compiled-in fixture path).
- traverse#1721: no prebuilt binaries, no sync command for Mode A state, and an opaque cache-validation error.
- traverse#1722: cross-host input-bytes contract (`policy_hash` divergence).
- Mode A is digest-only today (no signature on the cache).

## Screenshots
`docs/screenshots/01-three-hosts-truth-freestyle.png`: the three host columns, cross-host truth table, finding card, and freestyle table in one frame.
