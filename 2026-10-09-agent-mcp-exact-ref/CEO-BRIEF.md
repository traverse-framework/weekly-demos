# CEO brief — 2026-10-09-agent-mcp-exact-ref

## Blog angle (one-liner)

**Agent speaks MCP. Exact pin kills the freestyle.** Same Spec 138 signed
`digits-mlp-1.0.0` package classifies bit-identically on Browser + Node while an
MCP-shaped agent that tampers WASM / empties trust / lies about rights
fail-closes with `digest_mismatch` / `key_untrusted` / `rights_mismatch` —
Traverse v0.14.0. Not HF. Not Mode A binary (yet).

## Live preview (Prototype Builder box)

- URL: `http://127.0.0.1:8772`
- Dir: `/workspace/weekly-demo-2026-10-09-agent-mcp-exact-ref`
- Staged: `/workspace/weekly-demos/2026-10-09-agent-mcp-exact-ref`
- Start: `PORT=8772 node server.mjs` (leave running for agent computer preview)
- Smoke: `npm run smoke:all` → `proof/node-host.json` + `proof/mcp-agent.json`

## Screenshots (attach to post)

| Shot | Path |
| --- | --- |
| Landing / agent kill banner | `docs/screenshots/01-landing.png` |
| Three columns (Browser · Node · MCP) | `docs/screenshots/02-three-hosts.png` |
| Attack → fail-closed | `docs/screenshots/03-attack-fail-closed.png` |

## Suggested README table row (`weekly-demos/README.md`)

| Date | Slug | One-liner |
| --- | --- | --- |
| 2026-10-09 | [`2026-10-09-agent-mcp-exact-ref`](./2026-10-09-agent-mcp-exact-ref/) | Agent MCP tools over signed exact-ref `digits-mlp`; freestyle → `digest_mismatch` / `key_untrusted` / `rights_mismatch`; Browser+Node bit-identical — Traverse v0.14.0 Spec 138 |

## Suggested `INDEX.md` entries

```md
### Agent guardrails / deny authority

- [2026-10-09-agent-mcp-exact-ref](2026-10-09-agent-mcp-exact-ref/) — MCP-shaped agent freestyle against signed exact-ref model → fail-closed stable reasons.

### Signed exact-ref models (Spec 138)

- [2026-10-09-agent-mcp-exact-ref](2026-10-09-agent-mcp-exact-ref/) — Same `digits-mlp-1.0.0` via Browser + Node + MCP façade; tamper / empty trust / rights lie.
- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — First signed exact-ref Browser+Node ship.

### Multi-host / same bytes

- [2026-10-09-agent-mcp-exact-ref](2026-10-09-agent-mcp-exact-ref/) — Browser ↔ Node ↔ Agent MCP bit-identical classify.
```

Also under **By capability / model**:

```md
### `traverse.digits-mlp@1.0.0` (exact-ref)

- [2026-10-09-agent-mcp-exact-ref](2026-10-09-agent-mcp-exact-ref/) — Agent MCP + three fail-closed attacks.
- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — Spec 138 signed pin; Browser+Node.
```

## Publish instructions

1. Copy dated folder into `traverse-framework/weekly-demos` as
   `2026-10-09-agent-mcp-exact-ref/`
   - Source tree: `/workspace/weekly-demos/2026-10-09-agent-mcp-exact-ref`
     (staged) **or** unpack `/workspace/traverse-demo-2026-10-09-agent-mcp-exact-ref.tar.gz`
2. Refresh root `README.md` table + `INDEX.md` with the rows above
3. Do **not** claim Hugging Face / catalog `model.execute`
4. Do **not** claim a Mode A checksum-pinned `traverse-mcp` binary — Agent
   column is MCP-shaped tools over published `ExactModelBrowserHost` under Node
5. Label the signing key as **test-only** (#1567 production signing pending)
6. Do **not** claim Swift/Kotlin/.NET exact-ref execute on published 0.14.0
7. Auth under `enricopiovesan` has been flaky — CEO owns the org publish

## Tarball

`/workspace/traverse-demo-2026-10-09-agent-mcp-exact-ref.tar.gz`

## Measured digests (for the post)

- manifest / pin: `3068f3ae464fbbb43b45b089ab225a1371060a94a214c10629b4d8e402e8eadf`
- wasm: `6eeea06029ce4210842edfe70d7e0d8d7e926953ead5f18a0dca3c351ad5dc88`
- npm: `traverse-embedder-web@0.14.0`
- tag commit: `4dac877c2fe0b28491848016747850ae31327ebc`
- catalog: 227 / `d8e3f165…` / no `model.execute`

## Next-week candidates

- Real Mode A `traverse-mcp` binary pin-and-verify (when a packaged binary is
  already on the box / CI artifact)
- HF / catalog `model.execute` when catalog gains it
- .NET / Swift exact-ref execute when published past 0.14.0
