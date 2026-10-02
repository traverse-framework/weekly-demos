# 2026-10-02 — Signed exact-ref `digits-mlp`

**Traverse v0.14.0 · Spec 138 · `traverse-embedder-web@0.14.0`**

An agent tries to freestyle / swap a model. Traverse only admits the **exact signed package** pinned by SHA-256 of the manifest bytes. The same `digits-mlp-1.0.0` package classifies a handwritten digit **bit-identically** on Browser and Node (same npm `ExactModelBrowserHost`). Tamper one WASM byte → fail closed (`digest_mismatch`). Empty trust roots → `key_untrusted`.

Live preview (Prototype Builder box): **http://127.0.0.1:8771**

```bash
npm install
npm run smoke    # Node host + proof/
PORT=8771 node server.mjs
```

## Runtime pins (measured on this box)

| Artifact | Value |
| --- | --- |
| Product tag | `v0.14.0` (+ `web-v0.14.0`) @ `4dac877c2fe0b28491848016747850ae31327ebc` |
| npm | `traverse-embedder-web@0.14.0` |
| Model | `traverse.digits-mlp@1.0.0` (64→32→10 MLP, UCI optdigits, 96.10%) |
| Manifest digest (pin) | `3068f3ae464fbbb43b45b089ab225a1371060a94a214c10629b4d8e402e8eadf` |
| WASM digest | `6eeea06029ce4210842edfe70d7e0d8d7e926953ead5f18a0dca3c351ad5dc88` |
| Signature digest | `7d13ee6aa15f5d0704bf717494321b9235e45d3fc52cde15df528832e7a583b7` |
| Signer key id | `ed25519:455dffb093163d8439b544cc4f0ea79e33a07b20594c4739a8bbb4c0819d2d67` |
| Trust root (test-only) | `97002eba1e28b582a739eb48750a5f0822b2bbcb61e6bcedd2fada36b51af355` |
| Manifest schema | `2.0.0` |
| Governing spec | `138-governed-exact-model-execution` |

Smoke results (Node): conformance cases **0 → 0**, **7 → 7**, **4 → 4** with byte-identical `output_frame_hex` vs fixture; tamper → `model_incompatible` / `digest_mismatch`; empty trust → `key_untrusted`.

## Product path

- `ExactModelBrowserHost(pins, { trustedPublicKeysHex })`
- `registerPackage(manifestBytes, wasm, signatureBytes)` (replaces `insertVerified`)
- `encodeGuestFrame` + `model.execute` via host `execute(...)`
- Host-owned trust roots only; apps cannot add trust
- Pins bind SHA-256 of **manifest bytes**, declare `target`, expected `rights`, optional `key_id`

## Honesty / gaps

- **Not** Hugging Face / **not** catalog `model.execute` — catalog still 227 caps with no model capability. This is Spec 138 exact-ref only.
- Signing key is **test-only** (fixture). Production signing is tracked as #1567.
- Swift / Kotlin / .NET do **not** execute exact-ref models on published 0.14.0.
- Node column is the published **web embedder under Node**, not a separate native Rust CLI invoke.
- As of 2026-10-02 morning watch, `main` was ~+24 ahead of `v0.14.0` (Swift/Android exact-ref, ONNX packaging on unreleased tip). This demo pins **published 0.14.0 only**.

## Layout

```
hosts/          node-smoke.mjs + shared.mjs
public/         UI (index.html, app.js, styles.css)
package/models/ digits-mlp-1.0.0 + conformance vector + public trust key
proof/          node-host.json + digest-match.json (from npm run smoke)
fixtures/       upstream v0.14.0 copies (incl. full test key for local experiments)
docs/screenshots/
```

## Screenshots

| Shot | Path |
| --- | --- |
| Landing | `docs/screenshots/01-landing.png` |
| Register + classify success | `docs/screenshots/02-classify-success.png` |
| Attack fail-closed | `docs/screenshots/03-attack-fail-closed.png` |

## License

Apache-2.0. Model weights/data attribution: CC BY 4.0 (UCI optdigits) — see package rights JSON.
