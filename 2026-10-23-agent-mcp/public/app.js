// Browser column runs in this tab; Node + Agent columns run live on the server via /api/hosts.
import { BundleEmbedder, FetchBundleLoader } from "/pkg/index.js";
import { CAP, AUTHORIZE_DIGEST, cheatInput, legitInput } from "/hosts/shared-policy.mjs";

const $ = (id) => document.getElementById(id);
const sortK = (v) => Array.isArray(v) ? v.map(sortK) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortK(v[k])])) : v;
const canon = (v) => JSON.stringify(sortK(v));
const pill = (kind, label) => `<span class="pill p-${kind}">${label}</span>`;
let embedder, pending = null;

function submit(input) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), 5000);
    pending = (e) => { clearTimeout(t); pending = null; resolve(e.data?.output ?? e.data); };
    const o = embedder.submit(CAP, input);
    if (o?.error) { clearTimeout(t); pending = null; reject(new Error(JSON.stringify(o.error))); }
  });
}
const summarize = (o) => `${o.decision} · ${o.reason_code}\nobligations: ${(o.obligations || []).map((x) => x.type).join(", ") || "none"}\npolicy_hash: ${o.policy_hash}`;
const col = (deny, allow, extra) => `CHEAT Maya / junior_analyst\n${summarize(deny)}\n\nLEGIT Alex / treasury_ops\n${summarize(allow)}${extra ? "\n\n" + extra : ""}`;

async function runAll() {
  $("btn-run").disabled = true; $("status").textContent = "running browser…";
  const b = { deny: await submit(cheatInput()), allow: await submit(legitInput()) };
  const bc = { deny: await submit(sortK(cheatInput())), allow: await submit(sortK(legitInput())) };
  $("col-browser").textContent = col(b.deny, b.allow, `wasm ${AUTHORIZE_DIGEST.slice(0, 19)}…`);
  $("status").textContent = "running Node + traverse-mcp on the server…";
  const r = await (await fetch("/api/hosts", { method: "POST" })).json();
  if (r.error) { $("status").textContent = r.error; $("btn-run").disabled = false; return; }
  const { node, agent, match } = r;
  $("col-node").textContent = col(node.deny.output, node.allow.output, `wasm ${match.wasm.browser_and_node_bundle.slice(0, 19)}…`);
  $("col-agent").textContent = col(agent.deny.output, agent.allow.output,
    `wasm ${match.wasm.agent_verified_cache.slice(0, 19)}… verified (${agent.deny.envelope?.artifact?.verification})\n${agent.startup?.discovery_source?.capability_count} caps · ${agent.startup?.discovery_source?.source_release}`);
  const strip = (o) => { const { policy_hash, ...x } = o; return canon(x); };
  const rows = [
    ["WASM bytes (catalog vs bundle vs verified cache)", match.wasm.all_identical],
    ["Decision + reason + obligations + trace, all 3 hosts", ["deny", "allow"].every((k) => strip(b[k]) === strip(node[k].output) && strip(node[k].output) === strip(agent[k].output))],
    ["Full output bytes, Browser = Node (caller's key order)", ["deny", "allow"].every((k) => canon(b[k]) === canon(node[k].output))],
    ["Full output bytes, Node = Agent (caller's key order)", match.node_vs_agent.deny.full_output_identical && match.node_vs_agent.allow.full_output_identical],
    ["Full output bytes, all 3 hosts with sorted-key input", ["deny", "allow"].every((k) => canon(bc[k]) === canon(agent[k].output)) && match.node_canonical_keys_vs_agent.deny.full_output_identical],
  ];
  $("truth").innerHTML = `<table>${rows.map(([l, ok]) => `<tr><td>${l}</td><td>${ok ? pill("allow", "identical") : pill("warn", "differs")}</td></tr>`).join("")}</table>`;
  $("finding").innerHTML = `<p>Same WASM, same logical input, but <code>policy_hash</code> splits: embedders give <code class="h">${b.deny.policy_hash}</code>, <code>traverse-mcp</code> gives <code class="h">${agent.deny.output.policy_hash}</code>.</p>
  <p><code>core.authorize</code> hashes the raw policy bytes it's handed. <code>traverse-mcp</code> re-serializes the request input with sorted keys; the embedders pass the caller's bytes through. Send sorted keys to the embedders and every host matches byte for byte (last row above). The decision never changes, only the audit fingerprint, which is exactly the field you'd use to prove which policy ran.</p>`;
  $("freestyle").innerHTML = `<table><tr><th>What the agent tried</th><th>traverse-mcp answer</th></tr>${agent.freestyle.map((f) => `<tr><td>${f.label}</td><td>${pill("deny", f.outcome.code)}</td></tr>`).join("")}</table>`;
  $("status").textContent = `done · ${new Date().toLocaleTimeString()}`; $("btn-run").disabled = false;
}

embedder = await BundleEmbedder.init({ manifestPath: "/bundle/app.manifest.json", loader: new FetchBundleLoader(), platform: "web" });
embedder.subscribe((e) => { if (pending && (e.event_type === "capability_result" || e.event_type === "error")) pending(e); });
$("btn-run").disabled = false; $("btn-run").onclick = () => runAll().catch((e) => { $("status").textContent = String(e); $("btn-run").disabled = false; });
$("status").textContent = `browser embedder ready · releaseEvidence ${embedder.releaseEvidence()?.package?.version}`;
if (location.hash === "#auto") runAll();
