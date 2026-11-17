// Deno (V8 + web-standard module Worker): runs the package's DEFAULT Worker path unmodified —
// the same `new Worker(new URL("./modelWorker.js", import.meta.url), {type:"module"})` a browser uses.
// Bundle + fixtures are fetched over HTTP from server.mjs with the package's FetchBundleLoader.
import { FetchBundleLoader } from "traverse-embedder-web";
import { runKillSwitch } from "./kill-core.mjs";
const base = Deno.env.get("BASE") ?? "http://127.0.0.1:8780";
const mode = Deno.args[0] ?? "worker";
const read = async (p) => new Uint8Array(await (await fetch(`${base}/${p}`)).arrayBuffer());
let last = performance.now(), maxGap = 0;
const hb = setInterval(() => { const t = performance.now(); maxGap = Math.max(maxGap, t - last); last = t; }, 10);
const t0 = performance.now();
const results = await runKillSwitch({ read, loader: new FetchBundleLoader(), manifestPath: `${base}/bundle/app.manifest.json`, platform: "web",
  ...(mode === "inline" ? { createWorker: null } : {}) });
clearInterval(hb);
const proof = { max_main_thread_gap_ms: Math.round(maxGap), host: `deno ${Deno.version.deno} (v8 ${Deno.version.v8})`, mode, worker: mode === "inline" ? "createWorker:null" : "package default modelWorker.js (web Worker, unmodified)",
  npm: "traverse-embedder-web@0.17.0", runtime_wasm: "v0.17.0 sha256:3f763665…", wall_ms: Math.round(performance.now() - t0), results };
await Deno.writeTextFile(`proof/deno-${mode}.json`, JSON.stringify(proof, null, 2));
for (const r of results) console.log(`${r.name.padEnd(22)} ${String(r.reason).padEnd(22)} ${r.ms ?? ""}ms ${r.frame_hex ?? ""}`);
Deno.exit(0);
