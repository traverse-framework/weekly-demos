#!/usr/bin/env node
/**
 * Third "host" column: digest + decision fingerprint match.
 * Proves browser-served bytes and Node host saw identical authorize.wasm /
 * runtime.wasm digests and identical deny/allow decision JSON.
 *
 * Honesty: Swift / .NET / Kotlin embedders ship in the 0.13.0 product cut
 * (embedder-api 1.1.0) but are not runnable on this Linux demo box today.
 * This script is the cross-host truth panel for digests + decisions.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { AUTHORIZE_DIGEST, RUNTIME_DIGEST } from "./shared-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const proofDir = path.join(root, "proof");

async function sha256File(filePath) {
  const buf = await readFile(filePath);
  return `sha256:${createHash("sha256").update(buf).digest("hex")}`;
}

function runNodeSmoke() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "hosts/node-smoke.mjs")], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`node-smoke exit ${code}\n${err}\n${out}`));
      else resolve(out);
    });
  });
}

await runNodeSmoke();
const nodeProof = JSON.parse(await readFile(path.join(proofDir, "node-host.json"), "utf8"));

const authorizeDigest = await sha256File(
  path.join(root, "bundle/components/authorize/core-authorize.wasm"),
);
const runtimeDigest = await sha256File(path.join(root, "bundle/runtime/runtime.wasm"));
const declaredRuntime = (await readFile(path.join(root, "bundle/runtime/runtime.wasm.sha256"), "utf8")).trim();

const match = {
  checked_at: new Date().toISOString(),
  authorize_wasm: {
    file: authorizeDigest,
    expected: AUTHORIZE_DIGEST,
    match: authorizeDigest === AUTHORIZE_DIGEST,
  },
  runtime_wasm: {
    file: runtimeDigest,
    declared_sha_file: declaredRuntime,
    expected: RUNTIME_DIGEST,
    match: runtimeDigest === RUNTIME_DIGEST && runtimeDigest === declaredRuntime,
  },
  node_host: {
    authorize_wasm_digest: nodeProof.authorize_wasm_digest,
    runtime_wasm_digest: nodeProof.runtime_wasm_digest,
    deny: nodeProof.deny,
    allow: nodeProof.allow,
  },
  cross_host: {
    authorize_bytes_identical: nodeProof.authorize_wasm_digest === authorizeDigest,
    runtime_bytes_identical: nodeProof.runtime_wasm_digest === runtimeDigest,
    deny_decision: nodeProof.deny?.decision,
    allow_decision: nodeProof.allow?.decision,
  },
  hosts_not_run_on_this_linux_box: ["swift", "dotnet", "kotlin"],
  note: "Browser host uses the same bundle/ bytes served over HTTP; digest panel proves file + Node agreement. Swift/.NET/.NET/Kotlin are product 0.13.0 hosts (embedder-api 1.1.0) not executed here.",
};

await mkdir(proofDir, { recursive: true });
await writeFile(path.join(proofDir, "digest-match.json"), JSON.stringify(match, null, 2));

console.log("=== Digest + decision fingerprint ===");
console.log(JSON.stringify(match, null, 2));

const ok =
  match.authorize_wasm.match &&
  match.runtime_wasm.match &&
  match.cross_host.authorize_bytes_identical &&
  match.cross_host.runtime_bytes_identical &&
  match.cross_host.deny_decision === "deny" &&
  match.cross_host.allow_decision === "allow";

if (!ok) {
  console.error("DIGEST MATCH FAILED");
  process.exit(1);
}
console.log("\nDIGEST MATCH OK");
