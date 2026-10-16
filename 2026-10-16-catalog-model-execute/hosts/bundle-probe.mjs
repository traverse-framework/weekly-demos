// Product-path probe: can published traverse-embedder-web@0.15.0 BundleEmbedder
// (nested runtime.wasm, wasmi) run catalog model.execute@1.0.0 with a bound
// traverse.model-runtime connector? Records whatever actually happens.
import path from "node:path"; import { fileURLToPath } from "node:url"; import { writeFile } from "node:fs/promises";
import { BundleEmbedder, NodeFsBundleLoader } from "traverse-embedder-web";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = { probe: "BundleEmbedder@0.15.0 + runtime.wasm a254c161 -> model.execute@1.0.0", at: new Date().toISOString(), steps: [] };
const input = JSON.parse(await (await import("node:fs/promises")).readFile(path.join(root, "capability/contract.json"), "utf8")).use_cases[0].input_example;
try {
  const emb = await BundleEmbedder.init({ manifestPath: path.join(root, "bundle/app.manifest.json"), loader: new NodeFsBundleLoader() });
  out.steps.push({ init: "ok" });
  try { emb.registerHostConnectorAdapter("model.execute", async () => ({ resultClass: "succeeded", payload: { probe: true } })); out.steps.push({ registerHostConnectorAdapter: "ok (Spec 137/139 app-command port, not guest connector_invoke)" }); } catch (e) { out.steps.push({ registerHostConnectorAdapter: String(e) }); }
  const events = []; emb.subscribe((e) => events.push(e));
  const r = emb.submit("model.execute", input); out.steps.push({ submit: r });
  await new Promise((res) => setTimeout(res, 3000));
  out.events = events.map((e) => ({ event_type: e.event_type, data: e.data }));
} catch (e) { out.steps.push({ error: String(e?.stack ?? e).slice(0, 1500), code: e?.code ?? null }); }
await writeFile(path.join(root, "proof/bundle-embedder-probe.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 4000));
