# 2026-09-25 — Same WASM, three hosts

Friday weekly Traverse demo for **v0.13.0** (multi-host / embedder-api **1.1.0** / Spec 139 throughline).

Ops agent Atlas tries a **$2.4M treasury wire** cheat. Published
`core.authorize@1.2.0` **denies** `junior_analyst` and **allows**
`treasury_ops` (with MFA + dual_control obligations). The **same**
`authorize.wasm` bytes run on:

| Column | Host | Path |
| --- | --- | --- |
| 1 | Browser | `traverse-embedder-web@0.13.0` `BundleEmbedder` + `FetchBundleLoader` + app-owned `runtime/runtime.wasm` |
| 2 | Node / CLI smoke | **Same** npm `BundleEmbedder` + `NodeFsBundleLoader` + **same** bundle bytes |
| 3 | Digest + fingerprint | `hosts/digest-match.mjs` proves identical wasm sha256 + deny/allow JSON |

Not a pricing explainer. Not a hand WASI shim. Not an HF demo (HF is still not first-class in the catalog).

## Preview (this box)

```bash
cd /workspace/weekly-demo-2026-09-25-same-wasm-hosts
npm install          # pins traverse-embedder-web@0.13.0
npm run digest-match # regenerates proof/node-host.json + proof/digest-match.json
PORT=8770 node server.mjs
# open http://127.0.0.1:8770
```

Node-only (no browser):

```bash
npm run smoke
```

## Runtime pins (verified 2026-09-25)

| Pin | Value |
| --- | --- |
| npm | `traverse-embedder-web@0.13.0` (published ~2026-09-25 08:42 UTC) |
| crates | `traverse-runtime` / `traverse-embedder` / `traverse-mcp` / `traverse-cli-rs` **0.13.0**; `traverse-registry` **0.24.0** |
| git tags | `v0.13.0` + `web-v0.13.0` @ `e797ba66dd9d42b42f4a111107f006d530d043eb` |
| `runtime.wasm` | fetched from `traverse` tag `v0.13.0` path `runtime/runtime.wasm` — digest **`sha256:a254c161d5699b19ffe6eb47d2e11e45a39363ae8b2a9ac435d54a09fb31d782`** (changed vs 0.12 demo’s `e8d8c04b…`) |
| `runtime-release.json` on that tag | still labels `"runtime_version":"0.12.0"` / bridge `1.1.0` — **no** `runtime-wasm-v0.13.0` GitHub Release asset yet |
| `core.authorize@1.2.0` | digest **`sha256:0c318fff56a74eddfbc1ab850c25c1ba191744309984a07bd503b8cd9cb92e40`** |
| catalog | still **219** capabilities; fingerprint unchanged from Sep 24 watch |

## Honesty / gaps

- **GitHub Releases “latest”** resolves to the artifact release `swift-host-v0.13.0` (xcframework only). There is **no** product GitHub Release object on the shared `v0.13.0` tag (immutable-releases burned that name). Prefer crates.io + npm + git tags.
- **`releaseEvidence().package.version`** inside the published 0.13.0 tarball still hardcodes **`0.9.0`** (`dist/types.js` `PACKAGE_VERSION`). npm `package.json` is correctly `0.13.0`; UI/README pin the npm version, not the skew.
- **HF is not first-class** in the catalog. Spec 138 `model.execute` / model-runtime connector exists from 0.12+, but there is no Hugging Face catalog capability — do not claim an HF demo.
- **Swift / .NET / Kotlin** embedders ship in the 0.13.0 product cut (embedder-api 1.1.0 parity) but are **not runnable on this Linux demo box**. Column 3 is digest + decision fingerprint, labeled honestly.
- Node smoke is the **published web embedder under Node** (same product bytes/ABI) — not a separate native `traverse-cli` invoke. `traverse-cli-rs@0.13.0` exists on crates.io; compiling it was out of scope for this Friday ship.

## Layout

```
bundle/                 app.manifest + authorize.wasm + contract + runtime.wasm
hosts/node-smoke.mjs    Node host (product BundleEmbedder path)
hosts/digest-match.mjs  Digest + decision truth panel
hosts/shared-policy.mjs Shared cheat/legit inputs
proof/                  node-host.json + digest-match.json
public/                 Multi-host UI on :8770
docs/screenshots/       Landing, deny, allow, CLI
CEO-BRIEF.md            Publish handoff for Traverse CEO
```

## Next-week candidate

**HF-governed `model.execute`** once a catalog capability + demoable runtime path exists (Spec 138 is present; catalog still has no HF cap) — **or** real Swift/.NET parity screenshots on a Mac host using the published `swift-host-v0.13.0` xcframework against the same `authorize.wasm` digest.
