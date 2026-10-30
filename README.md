# Traverse weekly demos

Runnable progress demos for [Traverse](https://traverse-framework.com) — one folder per week, shared in this repo (not a new repository each week).

This repository stays **private**. The public story for a week is the blog post in the table (plus screenshots). The clone snippet below is for people who already have access — it is not a public invite. Unauthenticated clone fails until [`.github`#30](https://github.com/traverse-framework/.github/issues/30) says otherwise.

Each week shows a concrete capability path you can clone, install, and run locally **if you can see this repo**. Prefer the [topic index](INDEX.md) when you are hunting for an *example* (guardrails, authorize, MFA, contract fail-closed, browser embedder, signed exact-ref, agent MCP, …) rather than a calendar date.

## How to run a week

```bash
git clone https://github.com/traverse-framework/weekly-demos.git
cd weekly-demos/<week-folder>
npm install
node server.mjs
# open the URL printed by the server (often http://127.0.0.1:8767)

# Node-only smoke (no browser):
node smoke.mjs
```

See that week’s `README.md` for ports, screenshots, and honest gaps.

## Table of contents

| Date | Folder | One-line | Capability | Blog |
|------|--------|----------|------------|------|
| 2026-09-18 | [`2026-09-18-agent-blocked`](2026-09-18-agent-blocked/) | Agent freestyle → blocked (junior_analyst $2.4M wire deny) | `core.authorize@1.2.0` | [agent-freestyle-blocked](https://traverse-framework.com/blog/agent-freestyle-blocked.html) |
| 2026-09-25 | [`2026-09-25-same-wasm-hosts`](2026-09-25-same-wasm-hosts/) | Same `core.authorize` WASM on Browser + Node (+ digest fingerprint); $2.4M wire cheat denied — Traverse v0.13.0 multi-host | `core.authorize@1.2.0` | [same-wasm-multi-host](https://traverse-framework.com/blog/same-wasm-multi-host.html) |
| 2026-10-02 | [`2026-10-02-signed-exact-ref`](2026-10-02-signed-exact-ref/) | Signed exact-ref `digits-mlp-1.0.0` bit-identical on Browser+Node; tamper fail-closed — Traverse v0.14.0 Spec 138 | `traverse.digits-mlp@1.0.0` | [signed-exact-ref-digits](https://traverse-framework.com/blog/signed-exact-ref-digits.html) |
| 2026-10-09 | [`2026-10-09-agent-mcp-exact-ref`](2026-10-09-agent-mcp-exact-ref/) | Agent MCP tools over signed exact-ref `digits-mlp`; freestyle → `digest_mismatch` / `key_untrusted` / `rights_mismatch`; Browser+Node bit-identical — Traverse v0.14.0 Spec 138 | `traverse.digits-mlp@1.0.0` | [agent-mcp-exact-ref](https://traverse-framework.com/blog/agent-mcp-exact-ref.html) |
| 2026-10-16 | [`2026-10-16-catalog-model-execute`](2026-10-16-catalog-model-execute/) | Catalog `model.execute@1.0.0` runs a signed ONNX `mnist-12` package bit-identically on Browser + Node + Native; agent freestyle fails closed — Traverse v0.15.0 | `model/model.execute@1.0.0` | [catalog-model-execute](https://traverse-framework.com/blog/catalog-model-execute.html) |
| 2026-10-23 | [`2026-10-23-agent-mcp`](2026-10-23-agent-mcp/) | Agent talks to the real published `traverse-mcp` 0.15.0 (built from crates.io, Mode A over a digest-verified cache); $2.4M wire cheat denied on Browser + Node + Agent; five MCP freestyle moves → typed refusals; `policy_hash` split found (traverse#1722) — Traverse v0.15.0 | `core.authorize@1.2.0` | [agent-mcp-real-server](https://traverse-framework.com/blog/agent-mcp-real-server.html) |
| 2026-10-30 | [`2026-10-30-hash-converges`](2026-10-30-hash-converges/) | Before/after: same `core.authorize` WASM now gives one `policy_hash` on Browser + Node + `traverse-mcp` (RFC 8785 canonical input, #1739); agent syncs live registry with `traverse-mcp sync`; freestyle still fails closed — traverse main 70f3ee7 (unreleased, after v0.15.0) | `core.authorize@1.2.0` | [hash-converges](https://traverse-framework.com/blog/hash-converges.html) |

## Topic index

Browse by theme / capability id: **[INDEX.md](INDEX.md)**.

## License

Apache-2.0 — see [LICENSE](LICENSE). Week folders inherit the root license.
