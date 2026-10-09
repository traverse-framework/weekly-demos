# 2026-10-09 — Agent MCP · signed exact-ref `digits-mlp`

**Traverse v0.14.0 · Spec 138 · `traverse-embedder-web@0.14.0`**

An agent speaks **MCP-shaped** tool calls (`exact_model_register` /
`exact_model_execute`) against the same Spec 138 signed exact-ref package
`digits-mlp-1.0.0` that Browser and Node run. Legitimate classify is
**bit-identical** across hosts. Agent freestyle fail-closes with stable reasons:

| Attack | Stable reason |
| --- | --- |
| Tamper one WASM byte | `digest_mismatch` |
| Empty trust roots | `key_untrusted` |
| Pin rights lie (`commercial_use: forbidden`) | `rights_mismatch` |

Visible MCP JSON-RPC-style transcript + host traces. Optimize for excitement —
not a pricing explainer.

Live preview (Prototype Builder box): **http://127.0.0.1:8772**

```bash
npm install
npm run smoke        # Node host → proof/node-host.json + digest-match.json
npm run smoke:mcp    # Agent MCP façade → proof/mcp-agent.json
PORT=8772 node server.mjs
```

## Runtime pins (measured on this box)

| Artifact | Value |
| --- | --- |
| Product tag | `v0.14.0` (+ `web-v0.14.0`) @ `4dac877c2fe0b28491848016747850ae31327ebc` |
| npm | `traverse-embedder-web@0.14.0` |
| crates (lockstep) | runtime / embedder / contracts / mcp **0.14.0** |
| crates.io `traverse-registry` | **0.27.0** (published Oct 8; not required by this demo) |
| Catalog | 227 caps, fingerprint `d8e3f165…` — **no** `model.execute` |
| Model | `traverse.digits-mlp@1.0.0` (64→32→10 MLP, UCI optdigits, 96.10%) |
| Manifest digest (pin) | `3068f3ae464fbbb43b45b089ab225a1371060a94a214c10629b4d8e402e8eadf` |
| WASM digest | `6eeea06029ce4210842edfe70d7e0d8d7e926953ead5f18a0dca3c351ad5dc88` |
| Signature digest | `7d13ee6aa15f5d0704bf717494321b9235e45d3fc52cde15df528832e7a583b7` |
| Signer key id | `ed25519:455dffb093163d8439b544cc4f0ea79e33a07b20594c4739a8bbb4c0819d2d67` |
| Trust root (test-only) | `97002eba1e28b582a739eb48750a5f0822b2bbcb61e6bcedd2fada36b51af355` |
| Manifest schema | `2.0.0` |
| Governing spec | `138-governed-exact-model-execution` |

## Product path

- `ExactModelBrowserHost(pins, { trustedPublicKeysHex })`
- `registerPackage(manifestBytes, wasm, signatureBytes)`
- `encodeGuestFrame` + host `execute(...)`
- Agent column: in-process **MCP-shaped** JSON-RPC tools over that same host
  under Node (`hosts/mcp-agent-smoke.mjs`)

## Honesty / gaps

- **Agent / MCP column is a façade**, not a checksum-pinned Mode A
  `traverse-mcp` binary (Spec 119). Mode A pin-and-verify is the longer-term
  product story; this week ships the published web exact-ref host under Node so
  we do not spend the night compiling Rust.
- **Not** Hugging Face / **not** catalog `model.execute` — catalog still 227
  caps with no model capability.
- Signing key is **test-only** (fixture). Production signing is #1567.
- Swift / Kotlin / .NET do **not** execute exact-ref models on published 0.14.0.
- `main` is ~+44 ahead of `v0.14.0` with unreleased Decision 110/111
  (ABI-v3 / ONNX / .NET exact-ref). This demo pins **published 0.14.0 only**.

## Layout

```
hosts/          shared.mjs · node-smoke.mjs · mcp-agent-smoke.mjs
public/         UI (Browser · Node · Agent MCP columns)
package/models/ digits-mlp-1.0.0 + conformance + public trust key
proof/          node-host.json · mcp-agent.json · digest-match.json
fixtures/       upstream copies (full test signing key intentionally not shipped; public key lives in package/models/)
docs/screenshots/
```

## Screenshots

| Shot | Path |
| --- | --- |
| Landing / kill banner | `docs/screenshots/01-landing.png` |
| Three-column match | `docs/screenshots/02-three-hosts.png` |
| Attack fail-closed | `docs/screenshots/03-attack-fail-closed.png` |

## License

Apache-2.0. Model weights/data attribution: CC BY 4.0 (UCI optdigits) — see package rights JSON.
