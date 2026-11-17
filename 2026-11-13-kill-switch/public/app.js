import { FetchBundleLoader } from "traverse-embedder-web";
import { runKillSwitch } from "/hosts/kill-core.mjs";
const $ = (id) => document.getElementById(id);
let beat = 0, last = performance.now(), maxGap = 0;
setInterval(() => { const t = performance.now(); maxGap = Math.max(maxGap, t - last); last = t; beat++;
  $("beat").textContent = beat; $("dot").style.opacity = beat % 2 ? "1" : ".35"; $("gap").textContent = `${Math.round(maxGap)} ms`; }, 50);
const read = async (p) => new Uint8Array(await (await fetch(`/${p}`)).arrayBuffer());
const proofs = {};
const pill = (r) => {
  const k = r === "ok" || r === "admitted" || r === "signed-digits" ? "p-ok" : r === "timeout" || r === "cancelled" ? "p-kill" : "p-deny";
  return `<span class="pill ${k}">${r}</span>`;
};
async function load(name) { try { const r = await fetch(`/proof/${name}.json?${Date.now()}`); if (r.ok) proofs[name] = await r.json(); } catch {} }
function render() {
  const cols = ["browser-worker", "deno-worker", "node-worker", "browser-inline", "deno-inline", "node-inline"].filter((c) => proofs[c]);
  if (!cols.length) return;
  const names = proofs[cols[0]].results.map((r) => r.name);
  const head = cols.map((c) => `<th>${c}<div class="muted mono">stall ${proofs[c].max_main_thread_gap_ms ?? "?"} ms</div></th>`).join("");
  const rows = names.map((n) => `<tr><td><code>${n}</code></td>${cols.map((c) => { const r = proofs[c].results.find((x) => x.name === n) || {};
    return `<td>${pill(r.reason)} ${r.ms !== undefined ? `<span class="mono">${r.ms} ms</span>` : ""}${r.frame_hex ? `<div class="mono">${r.frame_hex.slice(0, 16)}…</div>` : ""}</td>`; }).join("")}</tr>`).join("");
  $("table").innerHTML = `<table><thead><tr><th>scenario</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  const dead = (c) => proofs[c]?.results.find((x) => x.name === "runaway_deadline");
  const w = dead("browser-worker") ?? dead("node-worker"); const i = dead("browser-inline") ?? dead("node-inline");
  if (w) $("s-dead-w").innerHTML = `${w.ms} ms ${pill(w.reason)}`;
  if (i) $("s-dead-i").innerHTML = `${i.ms} ms ${pill(i.reason)}`;
  const res = (proofs["browser-worker"] ?? proofs[cols[0]]).results.find((x) => x.name === "resolver_skips_ollama");
  if (res) $("resolver").textContent = res.resolution.resolution.candidates.map((c) => `${c.candidate_id.padEnd(14)} ${c.readiness.padEnd(9)} ${c.rejection_code ?? ""} ${c.reason}`).join("\n") + `\n→ selected: ${res.resolution.resolution.selected?.candidate_id} · trust_class: ${res.resolution.trust_class}`;
}
async function run(mode) {
  $("status").textContent = `running in this tab (${mode})…`; maxGap = 0; last = performance.now();
  const t0 = performance.now();
  const results = await runKillSwitch({ read, loader: new FetchBundleLoader(), manifestPath: "/bundle/app.manifest.json", platform: "web",
    ...(mode === "inline" ? { createWorker: null } : {}),
    onStep: (r) => { $("status").textContent = `${mode}: ${r.name} → ${r.reason}${r.ms !== undefined ? ` (${r.ms} ms)` : ""}`; } });
  const proof = { host: navigator.userAgent, mode, npm: "traverse-embedder-web@0.17.0", runtime_wasm: "v0.17.0 sha256:3f763665…", wall_ms: Math.round(performance.now() - t0), max_main_thread_gap_ms: Math.round(maxGap), results };
  proofs[`browser-${mode}`] = proof;
  await fetch(`/api/browser-proof?mode=${mode}`, { method: "POST", body: JSON.stringify(proof, null, 2) });
  $("status").textContent = `${mode} done in ${proof.wall_ms} ms · longest main-thread stall ${proof.max_main_thread_gap_ms} ms`;
  render();
}
$("run-worker").onclick = () => run("worker");
$("run-inline").onclick = () => run("inline");
$("abort").onclick = async () => { $("status").textContent = "live runaway started… pulling the plug in 300 ms (Worker)"; await run("worker"); };
await Promise.all(["browser-worker", "deno-worker", "node-worker", "browser-inline", "deno-inline", "node-inline"].map(load)); render();
if (location.hash === "#auto") { await run("worker"); await run("inline"); }
