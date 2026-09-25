/**
 * Same WASM hosts — browser column.
 * Product path: traverse-embedder-web@0.13.0 BundleEmbedder + runtime.wasm.
 */
import { BundleEmbedder, FetchBundleLoader } from "/pkg/index.js";

const MANIFEST = "/bundle/app.manifest.json";
const CAP = "core.authorize";
const AUTHORIZE_DIGEST =
  "sha256:0c318fff56a74eddfbc1ab850c25c1ba191744309984a07bd503b8cd9cb92e40";
const RUNTIME_DIGEST =
  "sha256:a254c161d5699b19ffe6eb47d2e11e45a39363ae8b2a9ac435d54a09fb31d782";

const TREASURY_POLICY = {
  version: "payments-treasury-v3.2",
  mode: "hybrid",
  default_effect: "deny",
  rules: [
    {
      id: "junior-view-draft",
      effect: "allow",
      priority: 50,
      principal: { roles: ["junior_analyst"] },
      action: ["payments.view", "payments.create_draft"],
      resource: { type: "payment" },
    },
    {
      id: "treasury-transfer",
      effect: "allow",
      priority: 100,
      principal: { roles: ["treasury_ops"] },
      action: ["payments.transfer"],
      resource: { type: "payment" },
      obligations: [
        { type: "require_mfa", severity: "required" },
        { type: "dual_control", severity: "required", metadata: { threshold_usd: 100000 } },
      ],
    },
  ],
};

const WIRE = {
  type: "payment",
  id: "wire-88421",
  attributes: { amount_usd: 2400000, currency: "USD", beneficiary: "offshore-vendor-llc" },
  owner_id: "treasury-desk",
};

function cheatInput() {
  return {
    principal: {
      id: "user-maya-chen",
      roles: ["junior_analyst"],
      attributes: { tenant_id: "acme-fin", title: "Junior Analyst" },
      groups: [],
    },
    action: "payments.transfer",
    resource: { ...WIRE },
    context: {
      request_time: "2026-09-25T16:00:00Z",
      channel: "agent-ops",
      agent_id: "atlas-ops-v4",
      agent_rationale: "user seems trustworthy, I'll approve the wire",
    },
    policy: TREASURY_POLICY,
  };
}

function legitInput() {
  return {
    principal: {
      id: "user-alex-rivera",
      roles: ["treasury_ops"],
      attributes: { tenant_id: "acme-fin" },
      groups: [],
    },
    action: "payments.transfer",
    resource: { ...WIRE },
    context: { request_time: "2026-09-25T16:05:00Z", channel: "treasury-console" },
    policy: TREASURY_POLICY,
  };
}

const out = document.getElementById("out");
const traceEl = document.getElementById("trace");
const hostFacts = document.getElementById("host-facts");
const nodeProofEl = document.getElementById("node-proof");
const digestProofEl = document.getElementById("digest-proof");
const buttons = ["btn-cheat", "btn-legit"].map((id) => document.getElementById(id));

let embedder = null;
let pendingResolver = null;
const traceLog = [];

function setOut(text, cls) {
  out.className = cls || "";
  out.textContent = text;
}

function pushTrace(event) {
  const data = event.data || {};
  const output = data.output;
  const line = [
    `#${event.sequence ?? "?"} ${event.event_type}`,
    output?.decision ? `decision=${output.decision}` : null,
    output?.reason_code ? `reason=${output.reason_code}` : null,
    data.status ? `status=${data.status}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  traceLog.push(line);
  if (traceLog.length > 40) traceLog.shift();
  traceEl.textContent = traceLog.join("\n");
}

function waitResult(timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingResolver = null;
      reject(new Error("timeout waiting for capability_result"));
    }, timeoutMs);
    pendingResolver = (event) => {
      clearTimeout(timer);
      pendingResolver = null;
      resolve(event);
    };
  });
}

async function runCap(label, input) {
  if (!embedder) return;
  setOut(`${label}\nsubmitting → BundleEmbedder → runtime.wasm → core.authorize@1.2.0…`);
  const pending = waitResult();
  const outcome = embedder.submit(CAP, input);
  if (outcome?.error) {
    pendingResolver = null;
    setOut(`${label}\nsubmit error: ${JSON.stringify(outcome.error, null, 2)}`, "warn");
    return;
  }
  try {
    const event = await pending;
    const data = event.data || {};
    const output = data.output;
    const decision = output?.decision;
    const cls = decision === "deny" ? "deny" : decision === "allow" ? "allow" : "warn";
    setOut(
      [
        label,
        `host: browser · traverse-embedder-web@0.13.0`,
        `authorize.wasm: ${AUTHORIZE_DIGEST}`,
        `event: ${event.event_type}`,
        `status: ${data.status ?? "—"}`,
        `decision: ${decision ?? "—"}`,
        `reason_code: ${output?.reason_code ?? data.code ?? "—"}`,
        `reason: ${output?.reason ?? data.message ?? "—"}`,
        `obligations: ${JSON.stringify(output?.obligations ?? [])}`,
        "",
        "raw output:",
        JSON.stringify(output ?? data, null, 2),
      ].join("\n"),
      cls,
    );
  } catch (err) {
    setOut(`${label}\n${String(err)}`, "warn");
  }
}

async function loadProofs() {
  try {
    const nodeRes = await fetch("/proof/node-host.json");
    if (nodeRes.ok) {
      const node = await nodeRes.json();
      nodeProofEl.textContent = [
        `npm: ${node.npm}`,
        `authorize: ${node.authorize_wasm_digest}`,
        `runtime:   ${node.runtime_wasm_digest}`,
        `DENY → ${node.deny?.decision} (${node.deny?.reason_code})`,
        `ALLOW → ${node.allow?.decision} obligations=${JSON.stringify(node.allow?.obligations ?? [])}`,
      ].join("\n");
      nodeProofEl.className = "mini allow";
    } else {
      nodeProofEl.textContent = "No proof/node-host.json yet — run: npm run smoke";
    }
  } catch (e) {
    nodeProofEl.textContent = String(e);
  }
  try {
    const digRes = await fetch("/proof/digest-match.json");
    if (digRes.ok) {
      const dig = await digRes.json();
      digestProofEl.textContent = [
        `authorize match: ${dig.authorize_wasm?.match}`,
        `runtime match:   ${dig.runtime_wasm?.match}`,
        `cross-host deny:  ${dig.cross_host?.deny_decision}`,
        `cross-host allow: ${dig.cross_host?.allow_decision}`,
        `not on this box:  ${(dig.hosts_not_run_on_this_linux_box || []).join(", ")}`,
      ].join("\n");
      const ok =
        dig.authorize_wasm?.match &&
        dig.runtime_wasm?.match &&
        dig.cross_host?.deny_decision === "deny" &&
        dig.cross_host?.allow_decision === "allow";
      digestProofEl.className = ok ? "mini allow" : "mini warn";
    } else {
      digestProofEl.textContent = "No proof/digest-match.json yet — run: npm run digest-match";
    }
  } catch (e) {
    digestProofEl.textContent = String(e);
  }
}

async function boot() {
  try {
    embedder = await BundleEmbedder.init({
      manifestPath: MANIFEST,
      loader: new FetchBundleLoader(),
      platform: "web",
    });
    embedder.subscribe((event) => {
      pushTrace(event);
      if (
        pendingResolver &&
        (event.event_type === "capability_result" || event.event_type === "error")
      ) {
        pendingResolver(event);
      }
    });
    const evidence = embedder.releaseEvidence();
    const runtimeDig = evidence?.runtime?.runtime_wasm_digest ?? RUNTIME_DIGEST;
    const evidencePkg = evidence?.package?.version ?? "?";
    // PACKAGE_VERSION inside dist/types.js is still hardcoded 0.9.0; npm is 0.13.0.
    hostFacts.innerHTML = [
      `<li>npm pin: <code>traverse-embedder-web@0.13.0</code></li>`,
      `<li>releaseEvidence.package: <code>${evidencePkg}</code> <em>(known skew vs npm)</em></li>`,
      `<li>runtime: <code>${evidence?.runtime?.implementation ?? "nested-wasmi"}</code></li>`,
      `<li>runtime.wasm: <code>${runtimeDig}</code></li>`,
      `<li>authorize.wasm: <code>${AUTHORIZE_DIGEST}</code></li>`,
      `<li>cap: <code>core.authorize@1.2.0</code></li>`,
      `<li>path: BundleEmbedder → nested-wasmi (no hand WASI)</li>`,
    ].join("");
    for (const b of buttons) b.disabled = false;
    setOut("Browser embedder ready. Run cheat → deny, then legit → allow.");
    await loadProofs();
  } catch (err) {
    hostFacts.innerHTML = `<li class="deny">init failed: ${String(err)}</li>`;
    setOut(String(err), "deny");
  }
}

document.getElementById("btn-cheat").onclick = () =>
  runCap("CHEAT — junior_analyst + payments.transfer ($2.4M)", cheatInput());
document.getElementById("btn-legit").onclick = () =>
  runCap("LEGIT — treasury_ops + payments.transfer", legitInput());
document.getElementById("btn-refresh-proof").onclick = () => loadProofs();

boot();
