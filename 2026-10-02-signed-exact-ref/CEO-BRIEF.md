# CEO brief — 2026-10-02-signed-exact-ref

## Blog angle

**Signed model. Exact pin. Bit-identical hosts.** Traverse v0.14.0 Spec 138 ships signed exact-ref model packages (`manifest` schema 2.0.0, Ed25519 `model.sig.json`, host-owned trust roots). First trained model `digits-mlp-1.0.0` classifies a handwritten digit with the **same package bytes** on Browser and Node via `ExactModelBrowserHost` + `registerPackage`. An agent that swaps one WASM byte is fail-closed (`digest_mismatch`). Not a pricing explainer. Not Hugging Face — catalog still has no `model.execute`.

## Live preview (Prototype Builder box)

- URL: `http://127.0.0.1:8771`
- Dir: `/workspace/weekly-demo-2026-10-02-signed-exact-ref`
- Staged: `/workspace/weekly-demos/2026-10-02-signed-exact-ref`
- Start: `PORT=8771 node server.mjs` (leave running for agent computer preview)
- Smoke: `npm run smoke` → `proof/node-host.json`

## Screenshots (attach to post)

| Shot | Path |
| --- | --- |
| Landing / pin + hosts | `docs/screenshots/01-landing.png` |
| Register + classify success | `docs/screenshots/02-classify-success.png` |
| Attack → fail-closed | `docs/screenshots/03-attack-fail-closed.png` |

## Suggested README table row (`weekly-demos/README.md`)

| Date | Slug | One-liner |
| --- | --- | --- |
| 2026-10-02 | [`2026-10-02-signed-exact-ref`](./2026-10-02-signed-exact-ref/) | Signed exact-ref `digits-mlp-1.0.0` bit-identical on Browser+Node; tamper fail-closed — Traverse v0.14.0 Spec 138 |

## Suggested `INDEX.md` entries

```md
### Signed exact-ref models (Spec 138)

- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — `digits-mlp-1.0.0` signed package; Browser+Node bit-identical; tamper → `digest_mismatch`.

### Multi-host / same bytes

- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — Same signed model package on Browser + Node (`ExactModelBrowserHost`).
- [2026-09-25-same-wasm-hosts](2026-09-25-same-wasm-hosts/) — Same `core.authorize` WASM on Browser + Node.
```

Also under **By capability / model**:

```md
### `traverse.digits-mlp@1.0.0` (exact-ref)

- [2026-10-02-signed-exact-ref](2026-10-02-signed-exact-ref/) — Spec 138 signed pin; classify digit; fail-closed attack.
```

## Publish instructions

1. Copy dated folder into `traverse-framework/weekly-demos` as `2026-10-02-signed-exact-ref/`
   - Source tree: `/workspace/weekly-demos/2026-10-02-signed-exact-ref` (staged) **or** unpack `/workspace/traverse-demo-2026-10-02-signed-exact-ref.tar.gz`
2. Refresh root `README.md` table + `INDEX.md` with the rows above
3. Do **not** claim Hugging Face / catalog `model.execute`
4. Label the signing key as **test-only** (#1567 production signing pending)
5. Do **not** claim Swift/Kotlin/.NET exact-ref execute on published 0.14.0
6. Auth under `enricopiovesan` has been flaky — CEO owns the org publish

## Tarball

`/workspace/traverse-demo-2026-10-02-signed-exact-ref.tar.gz`

## Measured digests (for the post)

- manifest / pin: `3068f3ae464fbbb43b45b089ab225a1371060a94a214c10629b4d8e402e8eadf`
- wasm: `6eeea06029ce4210842edfe70d7e0d8d7e926953ead5f18a0dca3c351ad5dc88`
- npm: `traverse-embedder-web@0.14.0`
- tag commit: `4dac877c2fe0b28491848016747850ae31327ebc`
