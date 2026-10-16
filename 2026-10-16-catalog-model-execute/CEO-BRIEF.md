# CEO brief: weekly demo 2026-10-16 · catalog-model-execute

**Headline:** An agent picks a model off the shelf, and the contract still decides. The registry's new `model/model.execute@1.0.0` runs a signed Hugging Face model with byte-identical output on Browser, Node and Native.

**Blog angle:** Last week we asked for a governed model capability in the catalog, and it shipped. This week we pulled that exact 8 KB WASM (digest-checked against the catalog) and pointed it at a signed HF ONNX model (`onnxmodelzoo/mnist-12`, exact-ref pinned). It ran on three hosts with one fingerprint (`12fea82f…c9d9`). Then an agent tried to freestyle: no usage declaration, an invented signer, a swapped model, a bigger model, tampered weights, a revoked package. Every host refused the same way, and the model never ran. One honest red badge remains: the published browser runtime can't link the connector import yet. Native is the real product path today, and the gap is filed (traverse#1719).

**Facts you can quote:**
- Catalog `model/model.execute@1.0.0`: WASM sha256 `5ccfa372…4275` and contract `a96db38b…ef1c`, both equal to the catalog entry.
- 14 scenarios (4 digits + 10 freestyle attempts). Capability stdout and model output bytes are identical on Chrome 154, Node 22 and native wasmtime 44. The digit frames also equal the wasmtime and wasmi conformance vector. Predictions 7, 2, 1, 0 are correct.
- Refusals: `usage_undeclared` ×2 and `key_untrusted` (empty trust root) come from the capability WASM itself, before any host call. `key_untrusted`, `pin_mismatch` ×2, `digest_mismatch` and `package_revoked` come from the Spec 138 host. `connector_unavailable` means no ambient authority.
- Native runs on crates.io `traverse-runtime 0.15.0` `run_bytes_with_mediated_connectors` plus the crate's own `ExactModelHostConnector`, with a 63-line host bridge.
- Browser and Node use npm `traverse-embedder-web@0.15.0` `ExactModelBrowserHost`, with 55 lines of labelled Spec 104 glue.

**Do NOT claim:**
- That it runs via `BundleEmbedder` in the browser. It doesn't yet: `constraint_violated … (traverse_host,connector_invoke)`.
- That it uses production signing. The key is a throwaway prototype key, and only the public half is in the tree.
- That extra input fields are rejected. The WASM accepts them, and enforcement is runtime-side (#1671, unreleased).

**Screenshots:** `docs/screenshots/01-full-page-three-hosts.png`, `02-hero-bit-identical-digits.png`, `03-agent-freestyle-refusals.png`, `04-product-path-truth.png`

**Tickets filed (both on the boards as Ready, both under epic traverse#1655):** traverse#1719 (runtime.wasm, embedders and shipped binding for `connector_invoke`) and registry#641 (normative `model_evidence` shape).

**Publish:** Push `2026-10-16-catalog-model-execute/` into `traverse-framework/weekly-demos`. README row and INDEX entries are prepared in `/workspace/weekly-demos/README.md` and `INDEX.md`. The tarball has the folder plus both files.
