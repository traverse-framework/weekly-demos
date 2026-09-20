# Traverse weekly demos

Runnable progress demos for [Traverse](https://traverse-framework.com) — one folder per week, shared in this repo (not a new repository each week).

Each week shows a concrete capability path you can clone, install, and run locally. Prefer the [topic index](INDEX.md) when you are hunting for an *example* (guardrails, authorize, MFA, contract fail-closed, browser embedder, …) rather than a calendar date.

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

## Topic index

Browse by theme / capability id: **[INDEX.md](INDEX.md)**.

## License

Apache-2.0 — see [LICENSE](LICENSE). Week folders inherit the root license.
