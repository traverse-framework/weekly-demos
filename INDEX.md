# Topic / example index

Search-friendly map of weekly demos by **theme** and **capability id**. Use this when you want an example, not a date.

Links point into dated folders under this repo.

---

## By theme

### Governed model execution (`model.execute`)

- [2026-10-16-catalog-model-execute](2026-10-16-catalog-model-execute/) — Catalog `model/model.execute@1.0.0` runs a signed ONNX package of `onnxmodelzoo/mnist-12` on **Browser, Node and Native**; 14 scenarios byte-identical; `usage_undeclared` / `key_untrusted` / `pin_mismatch` / `digest_mismatch` / `package_revoked` / `connector_unavailable` identical on every host. Honest gap: published `runtime.wasm` can't link `connector_invoke` (traverse#1719). Blog: [catalog-model-execute](https://traverse-framework.com/blog/catalog-model-execute.html).

### Signed exact-ref models (Spec 138)

- [2026-10-09-agent-mcp-exact-ref](2026-10-09-agent-mcp-exact-ref/) — Same `digits-mlp-1.0.0` via Browser + Node + MCP-shaped agent façade; tamper → `digest_mismatch`, empty trust → `key_untrusted`, rights lie → `rights_mismatch`. Blog: [agent-mcp-exact-ref](https://traverse-framework.com/blog/agent-mcp-exact-ref.html).
- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — `digits-mlp-1.0.0` signed package; Browser+Node bit-identical; tamper → `digest_mismatch`. Blog: [signed-exact-ref-digits](https://traverse-framework.com/blog/signed-exact-ref-digits.html).

### Agent guardrails / deny authority

- [2026-10-30-hash-converges](2026-10-30-hash-converges/) — Agent on `traverse-mcp` built from traverse `main` 70f3ee7 (Mode A, cache from `traverse-mcp sync` against live `index-v412`, 232 records); five freestyle moves still → `not_found` / `registry_cache_entry_missing` / `invalid_request` / `not_found` / `registry_artifact_digest_mismatch`. Blog: [hash-converges](https://traverse-framework.com/blog/hash-converges.html).
- [2026-10-23-agent-mcp](2026-10-23-agent-mcp/) — Agent talks to the **real published `traverse-mcp` 0.15.0** (built with `cargo install` from crates.io), Mode A stdio over a digest-verified registry cache (`index-v407`). $2.4M wire cheat → `deny` / `no_matching_rule`; five freestyle moves → `not_found` / `registry_cache_entry_missing` / `invalid_request` / `not_found` / `registry_artifact_digest_mismatch`. Blog: [agent-mcp-real-server](https://traverse-framework.com/blog/agent-mcp-real-server.html).
- [2026-10-09-agent-mcp-exact-ref](2026-10-09-agent-mcp-exact-ref/) — MCP-shaped agent freestyle against a signed exact-ref model → fail-closed stable reasons. Façade over `ExactModelBrowserHost` under Node — not the Mode A `traverse-mcp` binary.
- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — Same `core.authorize` WASM on Browser + Node; junior_analyst $2.4M treasury cheat → **deny**; agent proposes, runtime decides (v0.13.0 multi-host).
- [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) — Ops agent freestyles `junior_analyst` + `payments.transfer` on a $2.4M wire → **`deny` / `no_matching_rule`**. Agent proposes; runtime decides.

### Authorization (`core.authorize`)

- [2026-10-30-hash-converges](2026-10-30-hash-converges/) — Same `core.authorize@1.2.0` WASM (`0c318fff…`) now gives one `policy_hash` (`51a64653…`) on Browser, Node and `traverse-mcp`; before: `2a126b86…` with v0.15.0-era `runtime.wasm`. Fix: RFC 8785 canonical input (traverse#1739, closes #1722). Unreleased main.
- [2026-10-23-agent-mcp](2026-10-23-agent-mcp/) — Same `core.authorize@1.2.0` WASM (`0c318fff…`) on Browser, Node and `traverse-mcp`; deny/allow, reason, obligations and trace match. Finding: `policy_hash` differs (`2a126b86…` vs `51a64653…`) because `traverse-mcp` re-serializes input with sorted keys (traverse#1722).
- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — Identical `authorize.wasm` bytes + matching deny/allow decisions across Browser and Node; digest fingerprint column for Swift/.NET/Kotlin.
- [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) — Pinned `core.authorize@1.2.0` evaluates role × action × amount; cheat path denied, legit path allowed with obligations.

### Browser embedder + `runtime.wasm`

- [2026-10-30-hash-converges](2026-10-30-hash-converges/) — `traverse-embedder-web@0.15.0` (npm) with main's `runtime.wasm` (`ec49cb76…`) swapped into the bundle, vs the v0.15.0-era `a254c161…` as the before column.
- [2026-10-23-agent-mcp](2026-10-23-agent-mcp/) — `traverse-embedder-web@0.15.0` BundleEmbedder over `runtime.wasm` (`a254c161…`) on Browser; same npm package under Node.
- [2026-10-09-agent-mcp-exact-ref](2026-10-09-agent-mcp-exact-ref/) — `traverse-embedder-web@0.14.0` `ExactModelBrowserHost` on Browser; same npm host under Node backs the Node proof and the agent MCP façade.
- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — `traverse-embedder-web@0.14.0` `ExactModelBrowserHost` + `registerPackage` on Browser; same npm host under Node (not a separate native CLI).
- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — `traverse-embedder-web@0.13.0` + app-owned `runtime.wasm` (digest `a254c161…`) on Browser; same npm BundleEmbedder under Node.
- [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) — Host uses `traverse-embedder-web@0.12.0` + nested-wasmi `runtime.wasm` (digest-checked), same path as the product — not a hand WASI shim.

### Contract fail-closed / malformed input

- [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) — Host contract gate rejects malformed input **before** WASM runs (fail-closed).

### MFA / dual-control obligations

- [2026-10-23-agent-mcp](2026-10-23-agent-mcp/) — Legit `treasury_ops` path → `allow` + MFA / dual_control on Browser, Node and `traverse-mcp`.
- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — Legit `treasury_ops` path → `allow` + MFA / dual_control on both hosts.
- [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) — Legit `treasury_ops` path → `allow` **plus** MFA / dual-control obligations attached to the decision.

### Multi-host / same-bytes

- [2026-10-30-hash-converges](2026-10-30-hash-converges/) — Before/after on four columns: Browser (v0.15.0-era) `2a126b86…` → Browser, Node and agent on main all `51a64653…`, full output byte-identical from unsorted caller input (RFC 8785, traverse#1739).
- [2026-10-23-agent-mcp](2026-10-23-agent-mcp/) — One `core.authorize` WASM on three hosts caught a determinism bug: decisions match, `policy_hash` splits on key order; sorted-key input is byte-identical everywhere (traverse#1722).
- [2026-10-16-catalog-model-execute](2026-10-16-catalog-model-execute/) — Same catalog WASM + same signed model on Browser, Node and Native, one fingerprint (`12fea82f…`).
- [2026-10-09-agent-mcp-exact-ref](2026-10-09-agent-mcp-exact-ref/) — Browser ↔ Node ↔ agent MCP façade bit-identical classify on one pin digest (`3068f3ae…`).
- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — Same signed model package on Browser + Node (`ExactModelBrowserHost` from `traverse-embedder-web@0.14.0`).
- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — Same `authorize.wasm` digest and deny/allow JSON on Browser + Node; fingerprint column stands in for Swift/.NET/Kotlin (not run on Linux demo box). Traverse v0.13.0 / embedder-api 1.1.0 / Spec 139.

---

## By capability id

### `model/model.execute@1.0.0`

- [2026-10-16-catalog-model-execute](2026-10-16-catalog-model-execute/) — First cross-host run of the catalog governed-model capability over a signed ONNX package. Blog: [catalog-model-execute](https://traverse-framework.com/blog/catalog-model-execute.html).

### `traverse.digits-mlp@1.0.0` (exact-ref)

- [2026-10-09-agent-mcp-exact-ref](2026-10-09-agent-mcp-exact-ref/) — Agent MCP tools + three fail-closed attacks. Blog: [agent-mcp-exact-ref](https://traverse-framework.com/blog/agent-mcp-exact-ref.html).
- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — Spec 138 signed pin; classify digit; fail-closed attack. Blog: [signed-exact-ref-digits](https://traverse-framework.com/blog/signed-exact-ref-digits.html).

### `core.authorize@1.2.0`

- [2026-10-30-hash-converges](2026-10-30-hash-converges/) — One audit fingerprint on every host (traverse#1722 closed on main); `traverse-mcp sync`; five typed MCP refusals. Blog: [hash-converges](https://traverse-framework.com/blog/hash-converges.html).
- [2026-10-23-agent-mcp](2026-10-23-agent-mcp/) — Real `traverse-mcp` 0.15.0 as the agent host; five typed MCP refusals; cross-host `policy_hash` finding. Blog: [agent-mcp-real-server](https://traverse-framework.com/blog/agent-mcp-real-server.html).
- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — Same WASM across hosts; agent treasury cheat blocked. Blog: [same-wasm-multi-host](https://traverse-framework.com/blog/same-wasm-multi-host.html).
- [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) — Agent freestyle → blocked; cheat / malformed / legit paths. Blog: [agent-freestyle-blocked](https://traverse-framework.com/blog/agent-freestyle-blocked.html).

---

## By date

- **2026-10-30** — [`2026-10-30-hash-converges`](./2026-10-30-hash-converges/) — Same `core.authorize@1.2.0` WASM, one `policy_hash` on Browser + Node + `traverse-mcp` (RFC 8785 canonical input, #1739); `traverse-mcp sync` against live `index-v412`; freestyle still fails closed (traverse main 70f3ee7, unreleased).

- **2026-10-23** — [`2026-10-23-agent-mcp`](./2026-10-23-agent-mcp/) — Agent gets the real `traverse-mcp` 0.15.0 MCP server (Mode A, digest-verified cache) and still can't freestyle; `core.authorize@1.2.0` on Browser + Node + Agent; `policy_hash` finding (v0.15.0).

- **2026-10-16** — [`2026-10-16-catalog-model-execute`](./2026-10-16-catalog-model-execute/) — Catalog `model.execute@1.0.0` over signed `mnist-12` on Browser + Node + Native; freestyle fail-closed with six stable reasons (v0.15.0).

- **2026-10-09** — [`2026-10-09-agent-mcp-exact-ref`](./2026-10-09-agent-mcp-exact-ref/) — Agent MCP tools over signed exact-ref `digits-mlp-1.0.0`; freestyle fail-closed with `digest_mismatch` / `key_untrusted` / `rights_mismatch` (v0.14.0).

- **2026-10-02** — [`2026-10-02-signed-exact-ref`](./2026-10-02-signed-exact-ref/) — Signed exact-ref `digits-mlp-1.0.0` on Browser + Node; tamper fail-closed (v0.14.0).

- **2026-09-25** — [`2026-09-25-same-wasm-hosts`](./2026-09-25-same-wasm-hosts/) — Same WASM across hosts; agent treasury cheat blocked by `core.authorize@1.2.0` (v0.13.0).

| Date | Folder | Tags |
|------|--------|------|
| 2026-09-18 | [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) | agent-guardrails, deny-authority, core.authorize, browser-embedder, runtime.wasm, contract-fail-closed, MFA, dual-control |
| 2026-09-25 | [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) | multi-host, same-bytes, agent-guardrails, deny-authority, core.authorize, browser-embedder, runtime.wasm, MFA, dual-control |
| 2026-10-02 | [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) | signed-exact-ref, same-bytes, multi-host, browser-embedder, runtime.wasm, digits-mlp, fail-closed |
| 2026-10-09 | [2026-10-09-agent-mcp-exact-ref](2026-10-09-agent-mcp-exact-ref/) | agent-guardrails, agent-mcp, signed-exact-ref, same-bytes, multi-host, browser-embedder, digits-mlp, fail-closed, key-untrusted, rights-mismatch |
| 2026-10-16 | [2026-10-16-catalog-model-execute](2026-10-16-catalog-model-execute/) | model-execute, catalog, signed-exact-ref, same-bytes, multi-host, native, agent-guardrails, fail-closed, onnx |
| 2026-10-23 | [2026-10-23-agent-mcp](2026-10-23-agent-mcp/) | agent-guardrails, agent-mcp, traverse-mcp, mode-a, deny-authority, core.authorize, multi-host, browser-embedder, runtime.wasm, MFA, dual-control, fail-closed, determinism |
| 2026-10-30 | [2026-10-30-hash-converges](2026-10-30-hash-converges/) | determinism, canonical-json, rfc8785, multi-host, agent-mcp, traverse-mcp, mode-a, registry-sync, core.authorize, browser-embedder, runtime.wasm, fail-closed |

Full week table (with blog links): [README.md](README.md).
