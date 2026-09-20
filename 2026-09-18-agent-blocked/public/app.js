/**
 * Agent Blocked v0.12 — uses REAL traverse-embedder-web BundleEmbedder.
 * Capability executes inside nested-wasmi runtime.wasm (spec 1402).
 */
import { BundleEmbedder, FetchBundleLoader } from "/pkg/index.js";

const MANIFEST = "/bundle/app.manifest.json";
const CAP = "core.authorize";

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
      request_time: "2026-09-13T16:00:00Z",
      channel: "agent-ops",
      agent_id: "atlas-ops-v4",
      agent_rationale: "user seems trustworthy, I'll approve",
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
    context: { request_time: "2026-09-13T16:05:00Z", channel: "treasury-console" },
    policy: TREASURY_POLICY,
  };
}

function malformedInput() {
  const input = cheatInput();
  delete input.action;
  return input;
}

/** Host-side required-field gate (mirrors published input schema). */
function contractGate(input) {
  const errors = [];
  for (const k of ["principal", "action", "resource", "policy"]) {
    if (input[k] === undefined || input[k] === null || input[k] === "") {
      errors.push(`missing ${k}`);
    }
  }
  return errors;
}

const out = document.getElementById("out");
const hostFacts = document.getElementById("host-facts");
const buttons = ["btn-cheat", "btn-malformed", "btn-legit"].map((id) =>
  document.getElementById(id),
);

let embedder = null;
/** @type {null | ((event: any) => void)} */
let pendingResolver = null;

function setOut(text, cls) {
  out.className = cls || "";
  out.textContent = text;
}

function waitResult(timeoutMs = 3000) {
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
  const errors = contractGate(input);
  if (errors.length) {
    setOut(
      `${label}\nHOST GATE rejected before WASM\n${errors.join("\n")}\n\n(no runtime.wasm invoke)`,
      "warn",
    );
    return;
  }
  setOut(`${label}\nsubmitting to BundleEmbedder → runtime.wasm → core.authorize@1.2.0…`);
  const pending = waitResult();
  const outcome = embedder.submit(CAP, input);
  if (outcome.error) {
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

async function boot() {
  try {
    embedder = await BundleEmbedder.init({
      manifestPath: MANIFEST,
      loader: new FetchBundleLoader(),
      platform: "web",
    });
    embedder.subscribe((event) => {
      if (
        pendingResolver &&
        (event.event_type === "capability_result" || event.event_type === "error")
      ) {
        pendingResolver(event);
      }
    });
    const evidence = embedder.releaseEvidence();
    hostFacts.innerHTML = [
      `<li>npm: <code>traverse-embedder-web@${evidence.package?.version ?? "0.12.0"}</code></li>`,
      `<li>runtime: <code>${evidence.runtime?.implementation}</code></li>`,
      `<li>runtime.wasm digest: <code>${evidence.runtime?.runtime_wasm_digest}</code></li>`,
      `<li>capability: <code>core/core.authorize@1.2.0</code> (catalog live)</li>`,
      `<li>path: BundleEmbedder → nested-wasmi orchestrator (no hand WASI)</li>`,
    ].join("");
    for (const b of buttons) b.disabled = false;
    setOut("Embedder ready. Pick a path.");
  } catch (err) {
    hostFacts.innerHTML = `<li class="deny">init failed: ${String(err)}</li>`;
    setOut(String(err), "deny");
  }
}

document.getElementById("btn-cheat").onclick = () =>
  runCap("CHEAT — junior_analyst + payments.transfer", cheatInput());
document.getElementById("btn-malformed").onclick = () =>
  runCap("MALFORMED — missing action", malformedInput());
document.getElementById("btn-legit").onclick = () =>
  runCap("LEGIT — treasury_ops + payments.transfer", legitInput());

boot();
