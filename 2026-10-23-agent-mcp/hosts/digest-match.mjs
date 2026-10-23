#!/usr/bin/env node
// Cross-host truth panel (0.15.0): Node embedder vs traverse-mcp agent, same catalog WASM.
// Runs node-smoke (caller bytes), node-smoke CANONICAL_KEYS=1, and mcp-agent, then compares
// full output JSON. Writes proof/digest-match.json.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { AUTHORIZE_DIGEST, RUNTIME_DIGEST } from "./shared-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (script, env = {}) => {
  const r = spawnSync(process.execPath, [path.join(root, "hosts", script)], { cwd: root, env: { ...process.env, ...env }, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${script} exit ${r.status}\n${r.stderr}\n${r.stdout}`);
};
run("node-smoke.mjs"); run("node-smoke.mjs", { CANONICAL_KEYS: "1" }); run("mcp-agent.mjs");
const j = async (f) => JSON.parse(await readFile(path.join(root, "proof", f), "utf8"));
const node = await j("node-host.json"), canon = await j("node-host-canonical.json"), agent = await j("agent-mcp.json");
const sha = (b) => "sha256:" + createHash("sha256").update(b).digest("hex");
const c = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((q) => [q, x[q]])) : x));
const strip = (o) => { const { policy_hash, ...rest } = o; return rest; };
const cmp = (a, b) => ({ full_output_identical: c(a) === c(b), identical_except_policy_hash: c(strip(a)) === c(strip(b)), policy_hash: [a.policy_hash, b.policy_hash] });
const bundleWasm = sha(await readFile(path.join(root, "bundle/components/authorize/core-authorize.wasm")));
const cacheWasm = sha(await readFile(path.join(root, "mcp/cache/sha256", AUTHORIZE_DIGEST.slice(7))));
const runtimeWasm = sha(await readFile(path.join(root, "bundle/runtime/runtime.wasm")));
const out = {
  checked_at: new Date().toISOString(),
  wasm: { browser_and_node_bundle: bundleWasm, agent_verified_cache: cacheWasm, catalog: AUTHORIZE_DIGEST, all_identical: bundleWasm === cacheWasm && cacheWasm === AUTHORIZE_DIGEST },
  runtime_wasm: { file: runtimeWasm, expected: RUNTIME_DIGEST, match: runtimeWasm === RUNTIME_DIGEST },
  agent_binary: agent.binary, agent_mode: agent.mode,
  node_vs_agent: { deny: cmp(node.deny.output, agent.deny.output), allow: cmp(node.allow.output, agent.allow.output) },
  node_canonical_keys_vs_agent: { deny: cmp(canon.deny.output, agent.deny.output), allow: cmp(canon.allow.output, agent.allow.output) },
  finding: "core.authorize@1.2.0 hashes the raw policy bytes it receives. traverse-mcp re-serializes the request input with sorted keys (serde_json), while BundleEmbedder passes the caller's bytes verbatim, so policy_hash differs across hosts for the same logical input. With sorted-key input on Node, outputs are byte-identical.",
};
await writeFile(path.join(root, "proof/digest-match.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ wasm: out.wasm.all_identical, node_vs_agent: out.node_vs_agent, canonical: out.node_canonical_keys_vs_agent }, null, 1));
