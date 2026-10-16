// Shared by the Node smoke and the browser page: pins, request, attacks.
// Hosts pass in the ExactModelBrowserHost class + a byte loader, so Browser and
// Node drive the SAME code path against the SAME package bytes.
export const RELEASE = { tag: "v0.15.0", commit: "4491553969ce31beee3590aa3bbcc8087b07c943", npm: "traverse-embedder-web@0.15.0", cli: "traverse-cli-rs 0.15.0 (crates.io)",
  label: "published Traverse v0.15.0 (npm traverse-embedder-web@0.15.0 · crates.io traverse-cli-rs 0.15.0)" };
export const HF = { repo: "onnxmodelzoo/mnist-12", commit: "1cd752f4a3d818fa215aa621c78b8a10a4a1a3a5", file: "mnist-12.onnx",
  url: "https://huggingface.co/onnxmodelzoo/mnist-12", onnx_sha256: "5c688690f8bacf667d4c2074af5ad0646ca328d7ab03eccf944a65b320171bdd", license: "Apache-2.0 (HF repo metadata; README carries an MIT SPDX comment)" };
export const DIGESTS = { manifest: "d820ea394c3c1fa3a109c3fe57fb145f38bb3595fe3b6e469ec70ab83569688a",
  wasm: "fd0735e421c5a64b816e73930b091fc97ace8c168bbb90ff002f377ea7b7f973",
  runner: "d0b4d534631b71345756587fb892d1e959b0f538bb56824dc6d32aadaef68cae" };
export const KEY_ID = "ed25519:986edbcb29edbb2b1b937ffd1547c7526ac71a7e7308d86093693b3228fba8ce";
export const PIN = { model_id: "hf.onnxmodelzoo.mnist-12", version: "1.0.0", digest: DIGESTS.manifest, offline_allowed: true,
  target: "wasm-cpu", rights: { license_id: "Apache-2.0", commercial_use: "allowed" }, key_id: KEY_ID };
export const REQUEST = { policy_ref: "policy-hf-proto", data_classification: "internal", input_schema_ref: "schema:mnist-28x28-f32",
  input_schema_version: "1.0.0", max_output_bytes: 56, allowed_classifications: ["internal"] };
export const CASES = ["mnist-test-0-label7", "mnist-test-1-label2", "mnist-test-2-label1", "mnist-test-3-label0"];
export const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
export async function sha256(bytes) {
  if (globalThis.crypto?.subtle) return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
  const { createHash } = await import("node:crypto"); return createHash("sha256").update(bytes).digest("hex");
}
export function logits(frame) { const v = new DataView(frame.buffer, frame.byteOffset, frame.byteLength); const out = [];
  for (let i = 0; i < 10; i++) out.push(v.getFloat32(frame.byteLength - 40 + i * 4, true)); return out; }
export const argmax = (a) => a.indexOf(Math.max(...a));
const err = (e) => ({ name: e?.name, code: e?.code, reason: e?.reason ?? null, message: String(e?.message ?? e).slice(0, 300) });

/** load(path) -> Uint8Array for package/... and fixtures/... */
export async function runAll({ ExactModelBrowserHost, load, trustedKeyHex, label }) {
  const pkgDir = "package/mnist-12-1.0.0";
  const manifest = await load(`${pkgDir}/model.manifest.json`), wasm = await load(`${pkgDir}/model.wasm`), sig = await load(`${pkgDir}/model.sig.json`);
  const vector = JSON.parse(new TextDecoder().decode(await load("package/conformance-mnist-12.json")));
  const app = JSON.parse(new TextDecoder().decode(await load("package/app.model-deps.json")));
  const canon = (v) => v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(",")}}` : JSON.stringify(v);
  if (canon(app.exact_model_dependencies[0]) !== canon(PIN)) throw new Error("app.model-deps.json pin != shared PIN");
  const USAGE = app.model_usage;
  const out = { host: label, app_model_usage: USAGE, digests: { manifest: await sha256(manifest), wasm: await sha256(wasm), sig: await sha256(sig) }, cases: [], attacks: {} };
  const t0 = Date.now();
  const host = new ExactModelBrowserHost([PIN], { trustedPublicKeysHex: [trustedKeyHex], modelUsage: USAGE });
  const digest = await host.registerPackage(manifest, wasm, sig);
  out.register = { digest, ms: Date.now() - t0, rights: host.modelRights(digest) };
  for (const [i, name] of CASES.entries()) {
    const frame = await load(`fixtures/${name}.frame.bin`);
    const t = Date.now();
    const input_ref = host.io.stageModelInput(frame, 3160);
    const r = await host.execute({ model_ref: { model_id: PIN.model_id, version: PIN.version, digest }, input_ref, ...REQUEST });
    const o = host.io.readModelOutput(r.output_ref, 56);
    const lg = logits(o);
    out.cases.push({ name, label: Number(name.slice(-1)), predicted: argmax(lg), output_frame_hex: hex(o),
      matches_native_conformance_vector: hex(o) === vector.cases[i].output_frame_hex, ms: Date.now() - t, placement: r.placement ?? null });
  }
  host.shutdown?.();
  // ---- attacks (each must fail closed with a stable reason) ----
  const attempt = async (key, fn) => { try { const v = await fn(); out.attacks[key] = { result: "ACCEPTED (unexpected)", value: v }; } catch (e) { out.attacks[key] = err(e); } };
  const fresh = (opts = {}) => new ExactModelBrowserHost([opts.pin ?? PIN], { trustedPublicKeysHex: opts.keys ?? [trustedKeyHex], ...(opts.usage === undefined ? { modelUsage: USAGE } : opts.usage ? { modelUsage: opts.usage } : {}) });
  const tampered = wasm.slice(); tampered[tampered.length - 1000] ^= 0x01; // flip one bit inside the embedded ONNX model bytes (data section)
  await attempt("tamper_one_weight_bit", () => fresh().registerPackage(manifest, tampered, sig));
  await attempt("empty_trust_roots", () => fresh({ keys: [] }).registerPackage(manifest, wasm, sig));
  const up = (f) => load(`fixtures/digits-onnx-1.0.0-upstream/${f}`);
  await attempt("swap_in_other_signed_package", async () => fresh().registerPackage(await up("model.manifest.json"), await up("model.wasm"), await up("model.sig.json")));
  // Even with the upstream signer trusted, a validly-signed DIFFERENT package does not match our pin digest.
  const upstreamKey = JSON.parse(new TextDecoder().decode(await up("upstream-test-signing-key.public.json"))).public_key_hex;
  await attempt("swap_other_package_signer_trusted", async () => fresh({ keys: [trustedKeyHex, upstreamKey] }).registerPackage(await up("model.manifest.json"), await up("model.wasm"), await up("model.sig.json")));
  await attempt("pin_rights_lie_prohibited", () => fresh({ pin: { ...PIN, rights: { ...PIN.rights, commercial_use: "prohibited" } } }).registerPackage(manifest, wasm, sig));
  await attempt("no_model_usage_declared", () => fresh({ usage: null }).registerPackage(manifest, wasm, sig));
  // v0.15.0 host-owned package status map: the host revokes this exact digest; execute must refuse.
  await attempt("package_revoked_by_host", async () => { const h = fresh(); const d = await h.registerPackage(manifest, wasm, sig);
    h.setPackageStatus({ [d]: { status: "revoked", reason: "hf-proto: revoked by host" } });
    const frame = await load(`fixtures/${CASES[0]}.frame.bin`);
    return h.execute({ model_ref: { model_id: PIN.model_id, version: PIN.version, digest: d }, input_ref: h.io.stageModelInput(frame, 3160), ...REQUEST }); });
  // Probe (not an attack claim): does the host validate the model_usage value itself?
  try { const h = fresh({ usage: "research" }); await h.registerPackage(manifest, wasm, sig); out.probe_unknown_model_usage = { modelUsage: "research", result: "accepted", effective_usage: h.modelRightsRecord?.(PIN.digest)?.effective_usage ?? null }; }
  catch (e) { out.probe_unknown_model_usage = { modelUsage: "research", result: "refused", ...err(e) }; }
  out.generated_at = new Date().toISOString();
  return out;
}
