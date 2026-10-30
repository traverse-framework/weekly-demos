// Browser column runs in this tab (twice: v0.15.0-era runtime.wasm and main runtime.wasm).
// Node + Agent columns run live on the server via /api/hosts.
import { BundleEmbedder, FetchBundleLoader } from "/pkg/index.js";
import { CAP, AUTHORIZE_DIGEST, cheatInput, legitInput } from "/hosts/shared-policy.mjs";

const $ = (id) => document.getElementById(id);
const sortK = (v) => Array.isArray(v) ? v.map(sortK) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortK(v[k])])) : v;
const canon = (v) => JSON.stringify(sortK(v));
const pill = (kind, label) => `<span class="pill p-${kind}">${label}</span>`;
const short = (h) => h ? h.replace("fnv1a64:", "").slice(0, 8) : "?";

async function makeEmbedder(manifestPath) {
  const e = await BundleEmbedder.init({ manifestPath, loader: new FetchBundleLoader(), platform: "web" });
  const box = { e, pending: null };
  e.subscribe((ev) => { if (box.pending && (ev.event_type === "capability_result" || ev.event_type === "error")) box.pending(ev); });
  box.submit = (input) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), 5000);
    box.pending = (ev) => { clearTimeout(t); box.pending = null; resolve(ev.data?.output ?? ev.data); };
    const o = e.submit(CAP, input);
    if (o?.error) { clearTimeout(t); box.pending = null; reject(new Error(JSON.stringify(o.error))); }
  });
  return box;
}
const summarize = (o) => `${o.decision} · ${o.reason_code}\nobligations: ${(o.obligations || []).map((x) => x.type).join(", ") || "none"}\npolicy_hash: ${o.policy_hash}`;
const col = (deny, allow, extra) => `CHEAT Maya / junior_analyst\n${summarize(deny)}\n\nLEGIT Alex / treasury_ops\n${summarize(allow)}${extra ? "\n\n" + extra : ""}`;

let before, after;
async function runAll() {
  $("btn-run").disabled = true; $("status").textContent = "running browser (before + after)…";
  const bb = { deny: await before.submit(cheatInput()), allow: await before.submit(legitInput()) };
  const b = { deny: await after.submit(cheatInput()), allow: await after.submit(legitInput()) };
  $("col-before").textContent = col(bb.deny, bb.allow, `runtime.wasm a254c161… (v0.15.0-era)`);
  $("col-browser").textContent = col(b.deny, b.allow, `runtime.wasm ec49cb76… (main)\nwasm ${AUTHORIZE_DIGEST.slice(0, 19)}…`);
  $("status").textContent = "running Node + traverse-mcp (main) on the server…";
  const r = await (await fetch("/api/hosts", { method: "POST" })).json();
  if (r.error) { $("status").textContent = r.error; $("btn-run").disabled = false; return; }
  const { node, agent, match } = r;
  $("col-node").textContent = col(node.deny.output, node.allow.output, `runtime.wasm ec49cb76… (main)\nwasm ${match.wasm.browser_and_node_bundle.slice(0, 19)}…`);
  $("col-agent").textContent = col(agent.deny.output, agent.allow.output,
    `wasm ${match.wasm.agent_verified_cache.slice(0, 19)}… verified (${agent.deny.envelope?.artifact?.verification})\n${agent.startup?.discovery_source?.capability_count} caps · ${agent.startup?.discovery_source?.source_release} via traverse-mcp sync`);
  const strip = (o) => { const { policy_hash, ...x } = o; return canon(x); };
  const ks = ["deny", "allow"];
  const rows = [
    ["WASM bytes (catalog = bundle = verified cache)", match.wasm.all_identical],
    ["Decision + reason + obligations + trace, all hosts", ks.every((k) => strip(b[k]) === strip(node[k].output) && strip(node[k].output) === strip(agent[k].output) && strip(bb[k]) === strip(b[k]))],
    ["Full output bytes, Browser = Node = Agent (caller's unsorted input, main)", ks.every((k) => canon(b[k]) === canon(node[k].output) && canon(node[k].output) === canon(agent[k].output))],
    ["Full output bytes, Browser v0.15.0-era runtime = Agent", ks.every((k) => canon(bb[k]) === canon(agent[k].output))],
  ];
  $("truth").innerHTML = `<table>${rows.map(([l, ok]) => `<tr><td>${l}</td><td>${ok ? pill("allow", "identical") : pill("warn", "differs")}</td></tr>`).join("")}</table>`;
  $("finding").innerHTML = `<p><strong>Before</strong> (v0.15.0 runtime.wasm): <code class="h">${short(bb.deny.policy_hash)}</code> in the browser vs <code class="h">${short(agent.deny.output.policy_hash)}</code> from the agent. Same WASM, same logical input, different audit fingerprint.</p>
  <p><strong>After</strong> (traverse main, <a href="https://github.com/traverse-framework/traverse/pull/1739">#1739</a>, Spec 1722): every host now hands the guest RFC 8785 canonical JSON. Browser <code class="h">${short(b.deny.policy_hash)}</code> · Node <code class="h">${short(node.deny.output.policy_hash)}</code> · Agent <code class="h">${short(agent.deny.output.policy_hash)}</code>. The caller didn't sort anything. The runtime did, on every host.</p>`;
  $("freestyle").innerHTML = `<table><tr><th>What the agent tried</th><th>traverse-mcp answer</th></tr>${agent.freestyle.map((f) => `<tr><td>${f.label}</td><td>${pill("deny", f.outcome.code)}</td></tr>`).join("")}</table>`;
  $("status").textContent = `done · ${new Date().toLocaleTimeString()}`; $("btn-run").disabled = false;
}

before = await makeEmbedder("/bundle-before/app.manifest.json");
after = await makeEmbedder("/bundle/app.manifest.json");
$("btn-run").disabled = false; $("btn-run").onclick = () => runAll().catch((e) => { $("status").textContent = String(e); $("btn-run").disabled = false; });
$("status").textContent = `browser embedders ready · npm traverse-embedder-web ${after.e.releaseEvidence()?.package?.version}`;
if (location.hash === "#auto") runAll();
