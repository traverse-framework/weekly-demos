// Host-owned traverse.model-runtime@2.3.0 connector (operation model.execute) backed by the
// PUBLISHED Spec 138 host: traverse-embedder-web@0.15.0 ExactModelBrowserHost.
// The guest never sees keys, model bytes, or host paths: only refs + verified evidence.
//
// ABI mismatch handled here: Spec 104 connector_invoke is synchronous, ExactModelBrowserHost
// is async. So: pass 1 records the guest's exact request (deferred), the host executes it,
// pass 2 re-runs the pure guest from scratch with the response ready. The guest is a pure
// function of (stdin, connector response); we assert both passes emit byte-identical requests.
export class ModelRuntimeConnector {
  constructor({ ExactModelBrowserHost, pins, trustedKeys, packageBytes, packageStatus = {}, allowedClassifications = ["public", "internal"] }) {
    Object.assign(this, { ExactModelBrowserHost, pins, trustedKeys, packageBytes, packageStatus, allowedClassifications });
    this.connector_id = "traverse.model-runtime"; this.version = "2.3.0";
    this.hosts = new Map(); this.staged = new Map(); this.outputs = new Map(); this.cache = new Map(); this.pending = null; this.n = 0; this.modelRuns = 0;
  }
  stage(frame) { const ref = `host:input:frame-${++this.n}`; this.staged.set(ref, frame); return ref; }
  async hostFor(usage, signers) {
    const key = `${usage ?? ""}|${[...signers].sort().join(",")}`; if (this.hosts.has(key)) return this.hosts.get(key);
    const keys = this.trustedKeys.filter((k) => signers.includes(k.key_id)).map((k) => k.hex);
    const entry = { host: null, digest: null, error: null };
    try { const h = new this.ExactModelBrowserHost(this.pins, { trustedPublicKeysHex: keys, ...(usage ? { modelUsage: usage } : {}) });
      const { manifest, wasm, sig } = this.packageBytes; entry.digest = await h.registerPackage(manifest, wasm, sig);
      if (Object.keys(this.packageStatus).length) h.setPackageStatus(this.packageStatus); entry.host = h;
    } catch (e) { entry.error = { reason: e?.reason ?? "model_unavailable", code: e?.code ?? "model_unavailable" }; }
    this.hosts.set(key, entry); return entry;
  }
  invoke(req) { // synchronous Spec 104 connector body
    const k = JSON.stringify(req); if (this.cache.has(k)) return this.cache.get(k);
    if (req.operation !== "model.execute") return this.done(k, this.err("invalid_request"));
    if (!this.staged.has(req.payload?.input_ref)) return this.done(k, this.err("invalid_request"));
    this.pending = { k, req }; const d = new Error("deferred"); d.deferred = true; throw d;
  }
  err(reason, cls = "model_unavailable") { return { abi_version: "1.0.0", result_class: cls, payload: { status: "error", reason } }; }
  done(k, r) { this.cache.set(k, r); return r; }
  async resolvePending() {
    const { k, req } = this.pending; this.pending = null; const p = req.payload;
    const entry = await this.hostFor(p.model_usage, p.trust_root?.allowed_signers ?? []);
    if (entry.error) return this.done(k, this.err(entry.error.reason, entry.error.code));
    const want = String(p.model_ref.digest).replace(/^sha256:/, "");
    try {
      const h = entry.host; const inRef = h.io.stageModelInput(this.staged.get(p.input_ref), 3160);
      const r = await h.execute({ model_ref: { model_id: p.model_ref.model_id, version: p.model_ref.version, digest: want }, input_ref: inRef,
        policy_ref: p.policy_ref, data_classification: p.data_classification, input_schema_ref: p.input_schema_ref, input_schema_version: p.input_schema_version,
        max_output_bytes: p.max_output_bytes, allowed_classifications: this.allowedClassifications });
      this.modelRuns++;
      const outRef = `host:output:${this.modelRuns}`; this.outputs.set(outRef, h.io.readModelOutput(r.output_ref, p.max_output_bytes));
      const ev = r.model_evidence ?? {};
      // Spec 138 nests rights under model_evidence.rights; the catalog output_example is flat {license_id, commercial_use}.
      // Only non-URL, non-path rights fields cross back into the guest (Spec 104 host-private filter rejects "://").
      return this.done(k, { abi_version: "1.0.0", result_class: "ok", payload: { status: "ok", output_ref: outRef, output_schema_ref: "schema:mnist-12-logits-f32",
        model_ref: { model_id: r.model_ref.model_id, version: r.model_ref.version, digest: `sha256:${r.model_ref.digest.replace(/^sha256:/, "")}` },
        placement: r.placement, result_class: "ok", model_evidence: { license_id: ev.rights?.license_id ?? null, commercial_use: ev.rights?.commercial_use ?? null, derivation: ev.rights?.derivation?.kind ?? null, effective_usage: ev.effective_usage ?? null, status: ev.status ?? null } } });
    } catch (e) { return this.done(k, this.err(e?.reason ?? "model_unavailable", e?.code ?? "model_unavailable")); }
  }
}
import { runCapability } from "./spec104-host.mjs";
/** Run catalog model.execute through the connector; returns guest output + evidence + replay proof. */
export async function executeViaCatalog(capWasm, input, connector, declared, { bind = true } = {}) {
  const ctx = bind ? { declared, activated: [connector] } : null;
  const p1 = await runCapability(capWasm, input, ctx);
  if (!connector.pending) return { ...p1, passes: 1 };
  const req1 = JSON.stringify(connector.pending.req); await connector.resolvePending();
  const p2 = await runCapability(capWasm, input, ctx);
  const req2 = p2.connector_evidence.find((e) => e.request)?.request;
  return { ...p2, passes: 2, replay_request_identical: JSON.stringify(req2) === req1 };
}
