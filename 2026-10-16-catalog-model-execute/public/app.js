// Browser host: published traverse-embedder-web@0.15.0 + catalog model.execute@1.0.0, same lib as Node.
import { ExactModelBrowserHost, modelSigningKeyId, BundleEmbedder, FetchBundleLoader } from "/pkg/index.js";
import { runDemo, CATALOG, PIN, HF, RELEASE, CASES } from "/lib/demo.mjs";
const $ = (s) => document.querySelector(s);
const load = async (p) => { const r = await fetch("/" + p); if (!r.ok) throw new Error(`fetch ${p} ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };
const canon = (v) => (v && typeof v === "object" ? (Array.isArray(v) ? `[${v.map(canon).join(",")}]` : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`) : JSON.stringify(v));
const short = (h) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : "—");
const state = { browser: null, node: null, native: null, probe: null };
function pins() {
  const p = [["catalog", CATALOG.ref, true], ["capability wasm", short(CATALOG.wasm_digest) + (state.browser?.digests.capability_matches_catalog ? " ✓ catalog" : ""), state.browser?.digests.capability_matches_catalog],
    ["contract", short(CATALOG.contract_digest) + (state.browser?.digests.contract_matches_catalog ? " ✓" : ""), state.browser?.digests.contract_matches_catalog],
    ["HF model", `${HF.repo}@${HF.commit.slice(0, 8)}`, true], ["exact-ref pin", `${PIN.model_id}@${PIN.version} · ${short(PIN.digest)}`, true], ["release", "Traverse v0.15.0 (npm + crates)", true]];
  $("#pins").innerHTML = p.map(([k, v, ok]) => `<span class="pin ${ok ? "ok" : ""}"><b>${k}</b> ${v}</span>`).join("");
}
const byId = (proof, id) => proof?.cases?.find((c) => c.name === id) ?? null;
const atk = (proof, id) => proof?.attempts?.find((a) => a.id === id) ?? null;
const nat = (id) => state.native?.results?.find((r) => r.id === id) ?? null;
function render() {
  pins(); const B = state.browser, N = state.node; let allSame = !!(B && N && state.native);
  $("#digits").innerHTML = CASES.map((name) => {
    const b = byId(B, name), n = byId(N, name), x = nat(name);
    const same = b && n && x && b.output_frame_hex === n.output_frame_hex && n.output_frame_hex === x.output_frame_hex && canon(JSON.parse(b.capability_stdout)) === canon(JSON.parse(n.capability_stdout)) && canon(JSON.parse(n.capability_stdout)) === canon(x.capability_output);
    if (!same) allSame = false;
    const lg = b?.output_frame_hex;
    return `<div class="digit"><img src="/fixtures/${name}.png" alt="${name}"><div class="p"><div>label <b>${name.slice(-1)}</b> → <span class="big">${b?.predicted ?? "…"}</span></div>
      <div><span style="color:var(--b)">B</span> ${b?.predicted ?? "…"} · <span style="color:var(--n)">N</span> ${n?.predicted ?? "…"} · <span style="color:var(--x)">X</span> ${x ? (x.output_frame_hex ? "✓" : "✗") : "…"}</div>
      <div>${same ? '<span class="r yes">bytes identical ×3</span>' : '<span class="r f">waiting</span>'} ${b?.matches_native_conformance_vector ? '<span class="r yes">= wasmtime/wasmi vector</span>' : ""}</div>
      <div class="hx">frame ${short(lg)}</div></div></div>`; }).join("");
  const rows = (B ?? N)?.attempts ?? [];
  $("#attempts tbody").innerHTML = rows.map((a) => {
    const cell = (r) => (r ? (r.status === "error" ? `<span class="r no">${r.reason}</span>` : `<span class="r f">accepted</span>`) : "…");
    const nx = nat(a.id); const nr = nx ? nx.capability_output ?? { status: "error", reason: nx.executor_error?.slice(0, 40) } : null;
    const b = atk(B, a.id), n = atk(N, a.id);
    if (!(b && n && nr && b.reason === n.reason && n.reason === (nr.reason ?? null))) allSame = false;
    return `<tr><td>${a.title}${a.finding ? ' <span class="r f">finding</span>' : ""}</td><td class="layer">${a.layer}</td><td>${cell(b)}</td><td>${cell(n)}</td><td>${cell(nr)}</td><td>${(b ?? n).model_ran ? '<span class="r f">yes</span>' : '<span class="r yes">no</span>'}</td></tr>`; }).join("");
  const v = $("#verdict"); if (B && N && state.native) { v.className = "verdict " + (allSame ? "ok" : "bad"); v.textContent = allSame ? `✓ Browser = Node = Native · fingerprint ${short(B.fingerprint)}` : "✗ hosts disagree"; }
  const c0 = B?.cases?.[0]; if (c0) $("#trace").textContent = `// stdin → model.execute@1.0.0 WASM (sha256 ${short(CATALOG.wasm_digest)})\n// WASM → traverse_host.connector_invoke:\n${JSON.stringify(c0.connector_request, null, 2)}\n\n// WASM stdout (identical on all 3 hosts):\n${JSON.stringify(JSON.parse(c0.capability_stdout), null, 2)}`;
  const t = [];
  if (state.probe) t.push(`<div class="truth bad"><div class="t">✗ Published BundleEmbedder@0.15.0 can't run it (live, this browser)</div>runtime.wasm a254c161: <code>${state.probe.slice(0, 170)}</code></div>`);
  t.push(`<div class="truth ok"><div class="t">✓ Native is the real product path</div>crates.io <code>traverse-runtime 0.15.0</code> <code>run_bytes_with_mediated_connectors</code> (wasmtime) + the crate's own Spec 138 <code>ExactModelHostConnector</code>. Host-written code: one ~60-line bridge.</div>`);
  t.push(`<div class="truth"><div class="t">△ Browser/Node bind the connector in demo glue</div><code>lib/spec104-host.mjs</code> mirrors the Rust connector checks; model verify + execute is published <code>ExactModelBrowserHost</code>. Sync ABI vs async host → deterministic 2-pass replay (requests asserted identical).</div>`);
  t.push(`<div class="truth"><div class="t">△ Contract says additionalProperties:false; the WASM accepts extra fields</div>Enforcement is runtime-side (#1671 on main, not in v0.15.0).</div>`);
  $("#truth").innerHTML = t.join("");
}
async function probe() {
  try { const emb = await BundleEmbedder.init({ manifestPath: "/bundle/app.manifest.json", loader: new FetchBundleLoader() });
    const ev = []; emb.subscribe((e) => ev.push(e)); const input = JSON.parse(new TextDecoder().decode(await load("capability/contract.json"))).use_cases[0].input_example;
    emb.submit("model.execute", input); await new Promise((r) => setTimeout(r, 1500));
    const e = ev.find((x) => x.event_type === "error"); state.probe = e ? `${e.data.error.code}: ${e.data.error.message}` : `events: ${ev.map((x) => x.event_type).join(",")}`;
  } catch (e) { state.probe = `init: ${String(e?.message ?? e)}`; }
  fetch("/api/browser-proof", { method: "POST", body: JSON.stringify({ name: "browser-bundle-embedder-probe", data: { probe: state.probe, ua: navigator.userAgent, at: new Date().toISOString() } }) });
}
async function main() {
  pins();
  const [nodeP, natP] = [fetch("/proof/node.json").then((r) => r.ok ? r.json() : null), fetch("/proof/native-mediated.json").then((r) => r.ok ? r.json() : null)];
  state.node = await nodeP; state.native = await natP.catch(() => null); render();
  state.browser = await runDemo({ ExactModelBrowserHost, modelSigningKeyId, load, label: `browser ${navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] ?? ""}` }); render();
  fetch("/api/browser-proof", { method: "POST", body: JSON.stringify({ name: "browser", data: state.browser }) });
  await probe(); render();
}
$("#rerunNode").onclick = async () => { state.node = null; render(); state.node = (await (await fetch("/api/node-run", { method: "POST" })).json()).proof; render(); };
$("#rerunNative").onclick = async () => { state.native = null; render(); state.native = (await (await fetch("/api/native-run", { method: "POST" })).json()).proof; render(); };
main().catch((e) => { $("#verdict").textContent = "error: " + e.message; console.error(e); });
