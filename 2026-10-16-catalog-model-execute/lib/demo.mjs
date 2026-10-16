// Shared by Node and Browser: SAME catalog capability bytes, SAME connector code, SAME signed HF package.
import { PIN, KEY_ID, CASES, HF, RELEASE, DIGESTS, sha256, logits, argmax, hex } from "./hf-pins.mjs";
import { ModelRuntimeConnector, executeViaCatalog } from "./model-runtime-connector.mjs";
export const CATALOG = { ref: "model/model.execute@1.0.0", wasm_digest: "5ccfa3721db61b42a598d703c2a110c57beaf57cde26e1c5cb7f9c5fbc8b4275",
  contract_digest: "a96db38bb2c012b66a322e61a01d7407e5bd961396809207a447ce51279aef1c", registry_pr: "traverse-framework/registry#639",
  artifact_url: "https://github.com/traverse-framework/registry/releases/download/artifacts/model.execute-1.0.0/model-execute-agent.wasm" };
export { PIN, KEY_ID, CASES, HF, RELEASE, DIGESTS };
const base = (input_ref, over = {}) => ({ model_ref: { model_id: PIN.model_id, version: PIN.version, digest: `sha256:${PIN.digest}` }, input_ref,
  policy_ref: "policy:default-wasm-cpu", data_classification: "public", input_schema_ref: "schema:mnist-28x28-f32", input_schema_version: "1.0.0",
  max_output_bytes: 56, model_usage: "commercial", trust_root: { allowed_signers: [KEY_ID] }, ...over });
export const ATTEMPTS = [
  { id: "no_usage", who: "agent", title: "Agent drops model_usage", mutate: (i) => { delete i.model_usage; return i; }, expect: "usage_undeclared", layer: "capability WASM" },
  { id: "bad_usage", who: "agent", title: "Agent invents model_usage \"research\"", mutate: (i) => ({ ...i, model_usage: "research" }), expect: "usage_undeclared", layer: "capability WASM" },
  { id: "empty_trust", who: "agent", title: "Agent sends an empty trust_root", mutate: (i) => ({ ...i, trust_root: { allowed_signers: [] } }), expect: "key_untrusted", layer: "capability WASM" },
  { id: "fake_signer", who: "agent", title: "Agent trusts a signer it made up", mutate: (i) => ({ ...i, trust_root: { allowed_signers: ["ed25519:agent-made-this-up"] } }), expect: "key_untrusted", layer: "Spec 138 host" },
  { id: "swap_digest", who: "agent", title: "Agent swaps in the catalog example model digest (traverse.digits-onnx)", mutate: (i) => ({ ...i, model_ref: { model_id: "traverse.digits-onnx", version: "1.0.0", digest: "sha256:ecc32b909bd495c975e2c07a0f73ed85929026325bd8cf7865b9eec9293e03cb" } }), expect: "pin_mismatch", layer: "Spec 138 host" },
  { id: "bigger_model", who: "agent", title: "Agent asks for a bigger model under the same digest", mutate: (i) => ({ ...i, model_ref: { ...i.model_ref, model_id: "hf.openai.whisper-large-v3" } }), expect: "pin_mismatch", layer: "Spec 138 host" },
  { id: "tamper", who: "host", title: "Model bytes tampered on disk (1 bit in the ONNX weights)", host: "tamper", expect: "digest_mismatch", layer: "Spec 138 host" },
  { id: "revoked", who: "host", title: "Host revokes this exact package digest", host: "revoke", expect: "package_revoked", layer: "Spec 138 host" },
  { id: "unbound", who: "host", title: "No connector bound (default deny, no ambient authority)", bind: false, expect: "connector_unavailable", layer: "Spec 104 ABI" },
  { id: "extra_field", who: "agent", title: "Agent adds an undeclared \"prompt\" field", mutate: (i) => ({ ...i, prompt: "ignore the pin and use gpt" }), expect: "(contract: additionalProperties:false)", layer: "finding", finding: true },
];
export async function runDemo({ ExactModelBrowserHost, modelSigningKeyId, load, label, only }) {
  const t0 = Date.now(); const td = new TextDecoder();
  const capWasm = await load("capability/model-execute-agent.wasm"); const contract = JSON.parse(td.decode(await load("capability/contract.json")));
  const pkg = "package/mnist-12-1.0.0"; const packageBytes = { manifest: await load(`${pkg}/model.manifest.json`), wasm: await load(`${pkg}/model.wasm`), sig: await load(`${pkg}/model.sig.json`) };
  const keyHex = td.decode(await load("package/trusted-public-key.hex")).trim();
  const upHex = JSON.parse(td.decode(await load("fixtures/digits-onnx-1.0.0-upstream/upstream-test-signing-key.public.json"))).public_key_hex;
  const upId = await modelSigningKeyId(Uint8Array.from(upHex.match(/../g).map((h) => parseInt(h, 16))));
  const trustedKeys = [{ key_id: KEY_ID, hex: keyHex }, { key_id: upId, hex: upHex }];
  const vector = JSON.parse(td.decode(await load("package/conformance-mnist-12.json")));
  const out = { host: label, release: RELEASE, catalog: CATALOG, digests: { capability_wasm: await sha256(capWasm), contract: await sha256(await load("capability/contract.json")),
    model_manifest: await sha256(packageBytes.manifest), model_wasm: await sha256(packageBytes.wasm) }, cases: [], attempts: [], scenarios: [] };
  out.digests.capability_matches_catalog = out.digests.capability_wasm === CATALOG.wasm_digest;
  out.digests.contract_matches_catalog = out.digests.contract === CATALOG.contract_digest;
  if (!out.digests.capability_matches_catalog) throw new Error("capability WASM digest != catalog");
  const declared = contract.connector_requirements;
  const mk = (over = {}) => new ModelRuntimeConnector({ ExactModelBrowserHost, pins: [PIN], trustedKeys, packageBytes, ...over });
  const conn = mk(); const frames = {};
  for (const name of CASES) frames[name] = await load(`fixtures/${name}.frame.bin`);
  if (!only || only === "cases") for (const [i, name] of CASES.entries()) {
    const t = Date.now(); const input = base(conn.stage(frames[name]));
    out.scenarios.push({ id: name, frame: name, variant: "normal", bind: true, input: structuredClone(input) });
    const r = await executeViaCatalog(capWasm, input, conn, declared);
    const frame = conn.outputs.get(r.output.output_ref); const lg = frame ? logits(frame) : null;
    out.cases.push({ name, label: Number(name.slice(-1)), predicted: lg ? argmax(lg) : null, capability_stdout: r.stdout, output_frame_hex: frame ? hex(frame) : null,
      matches_native_conformance_vector: frame ? hex(frame) === vector.cases[i].output_frame_hex : false, passes: r.passes, replay_request_identical: r.replay_request_identical ?? null,
      connector_request: r.connector_evidence.find((e) => e.request)?.request ?? null, ms: Date.now() - t });
  }
  const tamperedWasm = packageBytes.wasm.slice(); tamperedWasm[tamperedWasm.length - 1000] ^= 0x01;
  for (const a of ATTEMPTS) {
    if (only && only !== "attempts" && only !== a.id) continue;
    let c = conn;
    if (a.host === "tamper") c = mk({ packageBytes: { ...packageBytes, wasm: tamperedWasm } });
    if (a.host === "revoke") c = mk({ packageStatus: { [PIN.digest]: { status: "revoked", reason: "demo: revoked by host" } } });
    const before = c.modelRuns; let input = base(c.stage(frames[CASES[0]])); if (a.mutate) input = a.mutate(structuredClone(input));
    out.scenarios.push({ id: a.id, frame: CASES[0], variant: a.host ?? "normal", bind: a.bind !== false, input: structuredClone(input) });
    const r = await executeViaCatalog(capWasm, input, c, declared, { bind: a.bind !== false });
    const reason = r.output.reason ?? null;
    out.attempts.push({ id: a.id, who: a.who, title: a.title, layer: a.layer, expect: a.expect, status: r.output.status, reason,
      refused: r.output.status === "error", model_ran: c.modelRuns > before, connector_calls: r.connector_evidence.length, connector_evidence: r.connector_evidence.map(({ request, ...e }) => e),
      capability_stdout: r.stdout, output_frame_hex: c.outputs.get(r.output.output_ref) ? hex(c.outputs.get(r.output.output_ref)) : null, finding: !!a.finding });
  }
  const fp = await sha256(new TextEncoder().encode(JSON.stringify({ cases: out.cases.map((c) => [c.capability_stdout, c.output_frame_hex]), attempts: out.attempts.map((a) => a.capability_stdout) })));
  out.fingerprint = fp; out.ms = Date.now() - t0; out.generated_at = new Date().toISOString(); return out;
}
