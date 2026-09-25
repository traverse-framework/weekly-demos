# CEO brief — 2026-09-25-same-wasm-hosts

## Blog angle

**Same WASM, three hosts.** Traverse v0.13.0’s multi-host throughline (embedder-api 1.1.0 / Spec 139) made real: an ops agent tries a $2.4M treasury wire cheat; published `core.authorize@1.2.0` denies `junior_analyst` and allows `treasury_ops` with MFA + dual_control — identical capability bytes and matching deny/allow decisions on Browser + Node, with a digest/fingerprint column standing in for Swift/.NET hosts that ship in 0.13 but aren’t on this Linux box. Agent can’t freestyle. Same binary. Visible traces.

## Live preview (Prototype Builder box)

- URL: `http://127.0.0.1:8770`
- Dir: `/workspace/weekly-demo-2026-09-25-same-wasm-hosts`
- Start: `PORT=8770 node server.mjs` (leave running for agent computer preview)

## Screenshots (attach to post)

| Shot | Path |
| --- | --- |
| Landing / multi-host UI | `docs/screenshots/01-landing-multi-host.png` |
| Cheat → deny | `docs/screenshots/02-cheat-deny.png` |
| Legit → allow | `docs/screenshots/03-legit-allow.png` |
| Node/CLI smoke output | `docs/screenshots/04-node-smoke.png` |

## Suggested README table row (`weekly-demos/README.md`)

| Date | Slug | One-liner |
| --- | --- | --- |
| 2026-09-25 | [`2026-09-25-same-wasm-hosts`](./2026-09-25-same-wasm-hosts/) | Same `core.authorize` WASM on Browser + Node (+ digest fingerprint); $2.4M wire cheat denied — Traverse v0.13.0 multi-host |

## Suggested `INDEX.md` entry

```md
- **2026-09-25** — [`2026-09-25-same-wasm-hosts`](./2026-09-25-same-wasm-hosts/) — Same WASM across hosts; agent treasury cheat blocked by `core.authorize@1.2.0` (v0.13.0).
```

## Publish instructions

1. Copy dated folder into `traverse-framework/weekly-demos` as `2026-09-25-same-wasm-hosts/`
   - Source tree: `/workspace/weekly-demos/2026-09-25-same-wasm-hosts` (staged) **or** unpack `/workspace/traverse-demo-2026-09-25-same-wasm-hosts.tar.gz`
2. Refresh root `README.md` table + `INDEX.md` with the rows above
3. Do **not** claim HF works; do **not** treat GitHub Releases “latest” (`swift-host-v0.13.0`) as the product changelog
4. Auth under `enricopiovesan` has been flaky — CEO owns the org publish

## Tarball

`/workspace/traverse-demo-2026-09-25-same-wasm-hosts.tar.gz`
