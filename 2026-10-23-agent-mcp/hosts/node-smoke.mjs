#!/usr/bin/env node
/**
 * Node/CLI host smoke — SAME product path as the browser:
 * traverse-embedder-web@0.15.0 BundleEmbedder + NodeFsBundleLoader +
 * app-owned runtime/runtime.wasm (nested-wasmi). Not a hand WASI shim.
 *
 * Honesty notes:
 * - This is the published web embedder under Node (same ABI, same bytes).
 * - releaseEvidence().package.version is still hardcoded "0.9.0" inside
 *   dist/types.js even though npm package.json is 0.15.0 (known skew).
 * - Swift / .NET / Kotlin hosts exist in the 0.15.0 cut but aren't run here.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BundleEmbedder, NodeFsBundleLoader } from "traverse-embedder-web";
import {
  CAP,
  AUTHORIZE_DIGEST,
  RUNTIME_DIGEST,
  cheatInput,
  legitInput,
} from "./shared-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "bundle", "app.manifest.json");
const proofDir = path.join(root, "proof");

async function sha256File(filePath) {
  const buf = await readFile(filePath);
  return `sha256:${createHash("sha256").update(buf).digest("hex")}`;
}

const authorizeDigest = await sha256File(
  path.join(root, "bundle/components/authorize/core-authorize.wasm"),
);
const runtimeDigest = await sha256File(path.join(root, "bundle/runtime/runtime.wasm"));

console.log("=== Same WASM hosts · Node smoke (0.15.0) ===");
console.log("authorize.wasm", authorizeDigest, authorizeDigest === AUTHORIZE_DIGEST ? "OK" : "MISMATCH");
console.log("runtime.wasm  ", runtimeDigest, runtimeDigest === RUNTIME_DIGEST ? "OK" : "MISMATCH");

const events = [];
/** @type {null | ((event: any) => void)} */
let pendingResolver = null;

function waitResult(timeoutMs = 5000) {
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

async function runOne(embedder, label, input) {
  const pending = waitResult();
  const outcome = embedder.submit(CAP, input);
  if (outcome?.error) {
    pendingResolver = null;
    return { label, submit_error: outcome.error };
  }
  const event = await pending;
  const data = event.data || {};
  const output = data.output ?? null;
  return {
    label,
    host: "node-bundle-embedder",
    product_path:
      "traverse-embedder-web@0.15.0 BundleEmbedder + NodeFsBundleLoader + runtime.wasm",
    event_type: event.event_type,
    status: data.status ?? null,
    decision: output?.decision ?? null,
    reason_code: output?.reason_code ?? data.code ?? null,
    reason: output?.reason ?? data.message ?? null,
    obligations: output?.obligations ?? [],
    output,
  };
}

const embedder = await BundleEmbedder.init({
  manifestPath,
  loader: new NodeFsBundleLoader(),
  platform: "web",
});

// Single lifetime subscriber — subscribe() replays history to new listeners,
// so per-call subscribe would re-deliver the prior deny into the allow wait.
embedder.subscribe((e) => {
  events.push({ event_type: e.event_type, sequence: e.sequence });
  if (
    pendingResolver &&
    (e.event_type === "capability_result" || e.event_type === "error")
  ) {
    pendingResolver(e);
  }
});

const evidence = embedder.releaseEvidence();
console.log("releaseEvidence.package", JSON.stringify(evidence?.package ?? null));
console.log("releaseEvidence.runtime", JSON.stringify(evidence?.runtime ?? null));


// CANONICAL_KEYS=1 sends the same logical input with keys sorted (what traverse-mcp's
// serde_json re-serialization produces) to prove the policy_hash split is caller bytes.
const CANON = process.env.CANONICAL_KEYS === "1";
const sortK = (v) => Array.isArray(v) ? v.map(sortK) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortK(v[k])])) : v;
const prep = (x) => (CANON ? sortK(x) : x);
const deny = await runOne(embedder, "CHEAT junior_analyst payments.transfer", prep(cheatInput()));
const allow = await runOne(embedder, "LEGIT treasury_ops payments.transfer", prep(legitInput()));

console.log("\n--- DENY ---");
console.log(
  JSON.stringify(
    { decision: deny.decision, reason_code: deny.reason_code, reason: deny.reason },
    null,
    2,
  ),
);
console.log("\n--- ALLOW ---");
console.log(
  JSON.stringify(
    { decision: allow.decision, reason_code: allow.reason_code, obligations: allow.obligations },
    null,
    2,
  ),
);

const fingerprint = {
  host: CANON ? "node-canonical-keys" : "node",
  npm_installed: "traverse-embedder-web@0.15.0",
  release_evidence_package_version_skew: evidence?.package?.version ?? null,
  npm: "traverse-embedder-web@0.15.0",
  authorize_wasm_digest: authorizeDigest,
  runtime_wasm_digest: runtimeDigest,
  deny: {
    decision: deny.decision,
    reason_code: deny.reason_code,
    reason: deny.reason,
    output: deny.output,
  },
  allow: {
    decision: allow.decision,
    reason_code: allow.reason_code,
    obligations: allow.obligations,
    output: allow.output,
  },
  event_types_seen: [...new Set(events.map((e) => e.event_type))],
  release_evidence: evidence,
};

await mkdir(proofDir, { recursive: true });
await writeFile(path.join(proofDir, CANON ? "node-host-canonical.json" : "node-host.json"), JSON.stringify(fingerprint, null, 2));
console.log("\nwrote proof/node-host.json");

embedder.shutdown();

if (deny.decision !== "deny" || allow.decision !== "allow") {
  console.error("SMOKE FAILED: expected deny then allow");
  process.exit(1);
}
console.log("\nSMOKE OK — deny + allow via same authorize.wasm");
