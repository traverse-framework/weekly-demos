// Browser and Node share this file. Imports ONLY published traverse-embedder-web@0.17.0.
import {
  BundleEmbedder, ExactModelBrowserHost, MODEL_RUNTIME_CONNECTOR, MODEL_RUNTIME_CONNECTOR_VERSION,
  exactModelMediatedConnector, resolveBrowserModelDependency,
} from "traverse-embedder-web";

const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (t) => Uint8Array.from(t.match(/../g), (p) => parseInt(p, 16));
const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
const now = () => performance.now();

// workerMode: "worker" (default Worker / supplied factory) or "inline" (createWorker: null — the pre-0.17 behaviour)
export async function runKillSwitch({ read, loader, manifestPath, platform, createWorker, onStep = () => {}, runawayUnits = 4000, abortAfterMs = 300 }) {
  const json = async (p) => JSON.parse(new TextDecoder().decode(await read(p)));
  const digits = { vector: await json("published/package/vector.json"), input: await json("published/input.json"),
    manifest: await read("published/package/model.manifest.json"), wasm: await read("published/package/model.wasm"), sig: await read("published/package/model.sig.json") };
  const spin = { vector: await json("published/spin/vector.json"), input: await json("published/spin/input.json"),
    manifest: await read("published/spin/model.manifest.json"), wasm: await read("published/spin/model.wasm"), sig: await read("published/spin/model.sig.json") };
  const worker = createWorker === undefined ? {} : { createWorker };
  const results = [];
  const record = (r) => { results.push(r); onStep(r); };

  async function hostFor(pkg, opts = {}) {
    const host = new ExactModelBrowserHost([pkg.vector.pin], {
      trustedPublicKeysHex: [pkg.vector.trusted_public_key_hex], modelUsage: "non_commercial", ...worker, ...opts });
    const reg = await host.registerPackage(pkg.manifest, new Uint8Array(pkg.wasm), pkg.sig, { policy_ref: "policy:default-wasm-cpu" })
      .then(() => null, (e) => e.reason ?? e.code ?? String(e));
    return { host, reg };
  }
  async function submit(host, input, frame, { signal } = {}) {
    const embedder = await BundleEmbedder.init({ manifestPath, loader, platform });
    const events = []; embedder.subscribe((e) => events.push(e));
    embedder.activateMediatedConnector(MODEL_RUNTIME_CONNECTOR, MODEL_RUNTIME_CONNECTOR_VERSION,
      exactModelMediatedConnector(host, { allowedClassifications: ["public"] }));
    const input_ref = host.io.stageModelInput(frame, 4096);
    input = { ...input, input_ref };
    const t0 = now();
    const outcome = await embedder.submitAsync("model.execute", input, signal ? { signal } : undefined);
    const ms = Math.round(now() - t0);
    const terminal = events.find((e) => e.event_type === "capability_result" || e.event_type === "error");
    const output = terminal?.data?.output ?? null;
    const reason = output?.status === "ok" ? "ok" : (output?.reason ?? output?.error?.reason ?? output?.error?.code ?? outcome?.error?.code ?? outcome.status);
    return { ms, submit_status: outcome.status, reason, output,
      frame_hex: output?.output_ref ? hex(host.io.readModelOutput(output.output_ref, input.max_output_bytes)) : null,
      model_evidence: output?.model_evidence ?? null };
  }

  // 1. Host ceilings refuse at registration (before any guest instruction runs)
  for (const [name, opts] of [["ceiling_package_bytes", { maxPackageBytes: 64 * 1024 }], ["ceiling_memory", { maxMemoryBytes: 1024 * 1024 }], ["ceiling_fuel", { maxFuel: 1_000_000 }]]) {
    const { host, reg } = await hostFor(digits, opts);
    record({ name, phase: "register", host_option: opts, registration_reason: reg, reason: reg ?? "admitted" });
    host.shutdown();
  }
  // 2. The governed HF-derived digits model still answers bit-identically under the Worker
  {
    const { host, reg } = await hostFor(digits);
    const r = await submit(host, digits.input, unhex(digits.vector.cases[0].input_frame_hex));
    record({ name: "digits_ok", phase: "execute", registration_reason: reg, ...r, expected_frame_hex: digits.vector.cases[0].output_frame_hex, frame_matches_signed_vector: r.frame_hex === digits.vector.cases[0].output_frame_hex });
    host.shutdown();
  }
  // 3. Runaway guest: same signed package, small vs huge work frame
  const { host, reg } = await hostFor(spin);
  record({ name: "spin_registered", phase: "register", registration_reason: reg, reason: reg ?? "admitted", manifest_max_execution_ms: 1500 });
  record({ name: "spin_small_ok", phase: "execute", work_units: 50, ...(await submit(host, spin.input, u32(50))) });
  record({ name: "runaway_deadline", phase: "execute", work_units: runawayUnits, deadline_ms: 1500, ...(await submit(host, spin.input, u32(runawayUnits))) });
  {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), abortAfterMs);
    record({ name: "runaway_abort", phase: "execute", work_units: runawayUnits, abort_after_ms: abortAfterMs, ...(await submit(host, spin.input, u32(runawayUnits), { signal: ctl.signal })) });
  }
  record({ name: "after_kill_ok", phase: "execute", work_units: 50, ...(await submit(host, spin.input, u32(50))) });
  host.shutdown();

  // 4. Spec 045 browser resolver: Ollama candidate skipped, signed exact-ref pin selected
  const dependency = { interface_id: "model.execute", version_range: "^1.0.0", selection_policy: { strategy: "priority", allow_fallback: true },
    required_capabilities: [], minimum_context_window: 0, candidates: [
      { candidate_id: "local-ollama", provider_capability_id: "model.execute", provider_implementation_id: "ollama.local.generate", model_identifier: "llama3.2", placement_target: "browser", priority: 0 },
      { candidate_id: "signed-digits", provider_capability_id: "model.execute", provider_implementation_id: "exact-ref.wasm-cpu", model_identifier: "traverse.digits-onnx@1.0.0", placement_target: "browser", priority: 1, metadata: { exact_ref_model_id: "traverse.digits-onnx", exact_ref_version: "1.0.0" } },
    ] };
  let resolution;
  try { resolution = resolveBrowserModelDependency(dependency, { phase: "execution", requested_interface_id: "model.execute", requested_placement: "browser" }, [["traverse.digits-onnx", "1.0.0"]]); }
  catch (e) { resolution = { error: String(e) }; }
  record({ name: "resolver_skips_ollama", phase: "resolve", reason: resolution?.resolution?.selected?.candidate_id ?? resolution?.resolution?.failure_code ?? "error", resolution });
  return results;
}
