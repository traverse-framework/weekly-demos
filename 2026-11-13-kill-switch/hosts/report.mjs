// Static, self-contained report (no network, no modules) rendered from proof/*.json → docs/report.html
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const cols = ["browser-worker", "deno-worker", "node-worker", "browser-inline", "deno-inline", "node-inline"].filter((c) => existsSync(`proof/${c}.json`));
const P = Object.fromEntries(cols.map((c) => [c, JSON.parse(readFileSync(`proof/${c}.json`, "utf8"))]));
const cmp = JSON.parse(readFileSync("proof/compare.json", "utf8"));
const css = readFileSync("public/styles.css", "utf8");
const pill = (r) => `<span class="pill ${r === "ok" || r === "admitted" || r === "signed-digits" ? "p-ok" : r === "timeout" || r === "cancelled" ? "p-kill" : "p-deny"}">${r}</span>`;
const names = P[cols[0]].results.map((r) => r.name);
const label = { "deno-worker": "Deno · web Worker<br><small>package default modelWorker.js</small>", "node-worker": "Node 22 · worker_threads<br><small>adapter</small>", "deno-inline": "Deno · inline<br><small>createWorker:null</small>", "node-inline": "Node 22 · inline<br><small>createWorker:null</small>", "browser-worker": "Chromium · Worker", "browser-inline": "Chromium · inline" };
const rows = names.map((n) => `<tr><td><code>${n}</code></td>${cols.map((c) => { const r = P[c].results.find((x) => x.name === n) || {};
  return `<td>${pill(r.reason)} ${r.ms !== undefined ? `<span class="mono">${r.ms} ms</span>` : ""}${r.frame_hex ? `<div class="mono dim">${r.frame_hex.slice(0, 16)}…</div>` : ""}</td>`; }).join("")}</tr>`).join("");
const dl = (c) => P[c]?.results.find((x) => x.name === "runaway_deadline");
const ab = (c) => P[c]?.results.find((x) => x.name === "runaway_abort");
const res = P[cols[0]].results.find((x) => x.name === "resolver_skips_ollama").resolution;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Kill switch · Traverse v0.17 · 2026-11-13</title><style>${css}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{border-bottom:1px solid #2a3140;padding:6px 8px;text-align:left;vertical-align:top}th small{color:var(--muted);font-weight:400}
.pill{display:inline-block;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600}.p-ok{background:#16382a;color:#7fe0a8}.p-deny{background:#4a1d22;color:#ff8f8f}.p-kill{background:#3a1f4d;color:#e2a8ff}
.mono{font-family:ui-monospace,Menlo,monospace;font-size:12px}.dim{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem}.stat{text-align:center}.big{font-size:2rem;font-weight:700}.lbl{color:var(--muted);font-size:.8rem}
.good{color:#7fe0a8}.bad{color:#ff8f8f}</style></head><body><main>
<p class="eyebrow">Friday demo · 2026-11-13 · Traverse v0.17.0 · npm traverse-embedder-web@0.17.0 · runtime.wasm 3f763665… · catalog model/model.execute@1.0.0 (5ccfa372…)</p>
<h1>Kill switch: a governed model call you can actually stop</h1>
<p class="lede">A signed model guest goes rogue and spins. Before v0.17 the web host only <em>noticed</em> afterwards — and on a blocked thread your cancel button can't even fire.
v0.17.0 runs each model package in its own Worker: the manifest deadline and <code>AbortSignal</code> <strong>terminate it mid-run</strong>, the host thread never stalls, the next call gets a fresh guest.
Host ceilings refuse oversize packages before a single guest instruction runs.</p>
<section class="grid">
<div class="card stat"><div class="lbl">runaway vs 1500 ms deadline · Worker</div><div class="big good">${dl("deno-worker").ms} ms</div>${pill(dl("deno-worker").reason)} <span class="mono dim">Deno · Node ${dl("node-worker").ms} ms</span></div>
<div class="card stat"><div class="lbl">same runaway · inline (old behaviour)</div><div class="big bad">${dl("deno-inline").ms} ms</div>${pill(dl("deno-inline").reason)} <span class="mono dim">ran to the end, then failed</span></div>
<div class="card stat"><div class="lbl">AbortSignal at 300 ms · Worker</div><div class="big good">${ab("deno-worker").ms} ms</div>${pill(ab("deno-worker").reason)}</div>
<div class="card stat"><div class="lbl">AbortSignal at 300 ms · inline</div><div class="big bad">${ab("deno-inline").ms} ms</div>${pill(ab("deno-inline").reason)} <span class="mono dim">abort timer never got the thread</span></div>
</section>
<section class="card"><h2>Longest host-thread stall during the run</h2><p class="mono">${cols.map((c) => `${c}: <b class="${P[c].max_main_thread_gap_ms > 1000 ? "bad" : "good"}">${P[c].max_main_thread_gap_ms} ms</b>`).join(" · ")}</p></section>
<section class="card"><h2>Same scenarios, same catalog WASM, every host</h2><p class="muted">worker hosts identical: <b class="good">${cmp.worker_hosts_identical}</b> · output frames identical on all hosts: <b class="good">${cmp.frames_identical_all_hosts}</b></p>
<table><thead><tr><th>scenario</th>${cols.map((c) => `<th>${label[c]}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></section>
<section class="card"><h2>Spec 045 browser resolver (new in 0.17)</h2><pre class="mini">${res.resolution.candidates.map((c) => `${c.candidate_id.padEnd(14)} ${c.readiness.padEnd(9)} ${c.rejection_code ?? ""}  ${c.reason}`).join("\n")}\n→ selected: ${res.resolution.selected?.candidate_id} · trust_class: ${res.trust_class}</pre></section>
<section class="card"><h2>Honesty</h2><ul class="muted">
<li><b>Runaway guest</b> = 185-byte demo guest (deterministic LCG spin), signed with a demo-only Ed25519 key generated on the box and trusted by this host only. <b>Digits</b> = the real signed HF-derived ONNX fixture; frame equals the signed vector everywhere.</li>
<li><b>Deno</b> runs the package's unmodified default Worker path (the browser path). <b>Node</b> needs the small worker_threads adapter the typings call for.</li>
<li><b>Chromium leg not run</b>: the box browser now firewalls loopback, so the live page at :8780 can't be opened in the box browser this week.</li>
<li><b>Native wasmtime</b> epoch interruption (also 0.17) not run: crates.io still 0.16.2 (v0.17.0 crate publish failed; v0.17.1 tagged today).</li></ul></section>
<p class="muted mono">generated ${new Date().toISOString()} from proof/*.json</p>
</main></body></html>`;
writeFileSync("docs/report.html", html);
console.log("docs/report.html", cols);
