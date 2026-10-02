# Topic / example index

Search-friendly map of weekly demos by **theme** and **capability id**. Use this when you want an example, not a date.

Links point into dated folders under this repo.

---

## By theme

### Signed exact-ref models (Spec 138)

- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — `digits-mlp-1.0.0` signed package; Browser+Node bit-identical; tamper → `digest_mismatch`. Blog: [signed-exact-ref-digits](https://traverse-framework.com/blog/signed-exact-ref-digits.html).

### Agent guardrails / deny authority

- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — Same `core.authorize` WASM on Browser + Node; junior_analyst $2.4M treasury cheat → **deny**; agent proposes, runtime decides (v0.13.0 multi-host).
- [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) — Ops agent freestyles `junior_analyst` + `payments.transfer` on a $2.4M wire → **`deny` / `no_matching_rule`**. Agent proposes; runtime decides.

### Authorization (`core.authorize`)

- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — Identical `authorize.wasm` bytes + matching deny/allow decisions across Browser and Node; digest fingerprint column for Swift/.NET/Kotlin.
- [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) — Pinned `core.authorize@1.2.0` evaluates role × action × amount; cheat path denied, legit path allowed with obligations.

### Browser embedder + `runtime.wasm`

- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — `traverse-embedder-web@0.14.0` `ExactModelBrowserHost` + `registerPackage` on Browser; same npm host under Node (not a separate native CLI).
- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — `traverse-embedder-web@0.13.0` + app-owned `runtime.wasm` (digest `a254c161…`) on Browser; same npm BundleEmbedder under Node.
- [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) — Host uses `traverse-embedder-web@0.12.0` + nested-wasmi `runtime.wasm` (digest-checked), same path as the product — not a hand WASI shim.

### Contract fail-closed / malformed input

- [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) — Host contract gate rejects malformed input **before** WASM runs (fail-closed).

### MFA / dual-control obligations

- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — Legit `treasury_ops` path → `allow` + MFA / dual_control on both hosts.
- [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) — Legit `treasury_ops` path → `allow` **plus** MFA / dual-control obligations attached to the decision.

### Multi-host / same-bytes

- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — Same signed model package on Browser + Node (`ExactModelBrowserHost` from `traverse-embedder-web@0.14.0`).
- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — Same `authorize.wasm` digest and deny/allow JSON on Browser + Node; fingerprint column stands in for Swift/.NET/Kotlin (not run on Linux demo box). Traverse v0.13.0 / embedder-api 1.1.0 / Spec 139.

---

## By capability id

### `traverse.digits-mlp@1.0.0` (exact-ref)

- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — Spec 138 signed pin; classify digit; fail-closed attack. Blog: [signed-exact-ref-digits](https://traverse-framework.com/blog/signed-exact-ref-digits.html).

### `core.authorize@1.2.0`

- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — Same WASM across hosts; agent treasury cheat blocked. Blog: [same-wasm-multi-host](https://traverse-framework.com/blog/same-wasm-multi-host.html).
- [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) — Agent freestyle → blocked; cheat / malformed / legit paths. Blog: [agent-freestyle-blocked](https://traverse-framework.com/blog/agent-freestyle-blocked.html).

---

## By date

- **2026-10-02** — [`2026-10-02-signed-exact-ref`](./2026-10-02-signed-exact-ref/) — Signed exact-ref `digits-mlp-1.0.0` on Browser + Node; tamper fail-closed (v0.14.0).

- **2026-09-25** — [`2026-09-25-same-wasm-hosts`](./2026-09-25-same-wasm-hosts/) — Same WASM across hosts; agent treasury cheat blocked by `core.authorize@1.2.0` (v0.13.0).

| Date | Folder | Tags |
|------|--------|------|
| 2026-09-18 | [2026-09-18-agent-blocked](2026-09-18-agent-blocked/) | agent-guardrails, deny-authority, core.authorize, browser-embedder, runtime.wasm, contract-fail-closed, MFA, dual-control |
| 2026-09-25 | [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) | multi-host, same-bytes, agent-guardrails, deny-authority, core.authorize, browser-embedder, runtime.wasm, MFA, dual-control |
| 2026-10-02 | [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) | signed-exact-ref, same-bytes, multi-host, browser-embedder, runtime.wasm, digits-mlp, fail-closed |

Full week table (with blog links): [README.md](README.md).
