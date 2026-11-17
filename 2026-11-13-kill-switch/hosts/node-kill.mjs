import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { NodeFsBundleLoader } from "traverse-embedder-web";
import { runKillSwitch } from "./kill-core.mjs";
const mode = process.argv[2] ?? "worker";
function nodeWorker() {
  const w = new Worker(new URL("./node-worker.mjs", import.meta.url));
  const adapter = { onmessage: null, onerror: null, postMessage: (m) => w.postMessage(m), terminate: () => { void w.terminate(); } };
  w.on("message", (data) => adapter.onmessage?.({ data }));
  w.on("error", (e) => adapter.onerror?.(e));
  return adapter;
}
await mkdir("proof", { recursive: true });
const t0 = Date.now();
let last = performance.now(), maxGap = 0;
const hb = setInterval(() => { const t = performance.now(); maxGap = Math.max(maxGap, t - last); last = t; }, 10);
const results = await runKillSwitch({
  read: async (p) => new Uint8Array(await readFile(p)), loader: new NodeFsBundleLoader(),
  manifestPath: "bundle/app.manifest.json", platform: "web",
  createWorker: mode === "inline" ? null : nodeWorker,
});
clearInterval(hb);
const proof = { max_main_thread_gap_ms: Math.round(maxGap), host: `node ${process.version}`, mode, npm: "traverse-embedder-web@0.17.0", runtime_wasm: "v0.17.0 runtime/runtime.wasm sha256:3f763665…", wall_ms: Date.now() - t0, results };
await writeFile(`proof/node-${mode}.json`, JSON.stringify(proof, null, 2));
for (const r of results) console.log(`${r.name.padEnd(22)} ${String(r.reason).padEnd(22)} ${r.ms ?? ""}ms ${r.frame_hex ?? ""}`);
process.exit(0);
