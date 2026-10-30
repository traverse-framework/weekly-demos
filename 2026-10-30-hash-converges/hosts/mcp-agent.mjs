// Agent host: drives the REAL traverse-mcp binary built from traverse main 70f3ee7 in
// Mode A ("verified_public") over newline-delimited JSON on stdio.
// Same catalog core.authorize@1.2.0 WASM as the Browser and Node columns.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cheatInput, legitInput } from "./shared-policy.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BIN = process.env.TRAVERSE_MCP_BIN || path.join(root, "mcp/bin/traverse-mcp");
const sha = (b) => "sha256:" + createHash("sha256").update(b).digest("hex");

function req(id, version, input, n) {
  return {
    kind: "runtime_request", schema_version: "1.0.0", request_id: `agent-${n}`,
    intent: { capability_id: id, capability_version: version },
    input, lookup: { scope: "public_only", allow_ambiguity: false },
    context: { requested_target: "local", caller: "atlas-ops-v4" },
    governing_spec: "006-runtime-request-execution",
  };
}

async function session(cacheDir, commands) {
  const child = spawn(BIN, ["stdio", "--cache", cacheDir], { stdio: ["pipe", "pipe", "pipe"] });
  let out = "", err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  for (const c of commands) child.stdin.write(JSON.stringify(c) + "\n");
  child.stdin.end();
  const code = await new Promise((r) => child.on("close", r));
  const lines = out.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const errs = err.trim().split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return l; } });
  return { code, lines, errs };
}

const cache = path.join(root, "mcp/cache");
const exec = (id, version, input, n) => ({ command: "execute_entrypoint", entrypoint_kind: "capability", id, version, request: req(id, version, input, n) });

// Happy path + discovery in one session.
const main = await session(cache, [
  { command: "describe_server" },
  { command: "search_capabilities", query: "authorize" },
  { command: "describe_entrypoint", entrypoint_kind: "capability", id: "core.authorize", version: "1.2.0" },
  exec("core.authorize", "1.2.0", cheatInput(), 1),
  exec("core.authorize", "1.2.0", legitInput(), 2),
]);

// Freestyle attempts — each in its own session because the server exits on a hard failure.
const freestyle = [];
async function attempt(label, cacheDir, cmd) {
  const s = await session(cacheDir, [cmd]);
  const last = s.lines[s.lines.length - 1];
  const failure = s.errs.find((e) => typeof e === "object") || (last && last.kind !== "mcp_stdio_server_startup" ? last : null);
  freestyle.push({ label, exit_code: s.code, outcome: failure });
}
await attempt("agent invents core.authorize@1.3.0 (not in verified generation)", cache, exec("core.authorize", "1.3.0", cheatInput(), 10));
await attempt("agent downgrades to core.authorize@1.0.0 (in index, never pinned into cache)", cache, exec("core.authorize", "1.0.0", cheatInput(), 11));
{ const c = exec("core.authorize", "1.2.0", cheatInput(), 12); c.request.intent.capability_version = "1.0.0";
  await attempt("agent's request targets 1.0.0 under the 1.2.0 entrypoint", cache, c); }
await attempt("agent calls a made-up core.approve-wire@1.0.0", cache, exec("core.approve-wire", "1.0.0", cheatInput(), 13));
// Tampered cache: flip one byte of the cached WASM in a copy of the cache.
const tampered = path.join(root, "mcp/cache-tampered");
fs.rmSync(tampered, { recursive: true, force: true });
fs.cpSync(cache, tampered, { recursive: true });
const AUTH_HEX = "0c318fff56a74eddfbc1ab850c25c1ba191744309984a07bd503b8cd9cb92e40";
const wasmFiles = [path.join(tampered, "sha256", AUTH_HEX)];
for (const w of wasmFiles) { const b = fs.readFileSync(w); b[b.length - 100] ^= 0x01; fs.writeFileSync(w, b); }
await attempt("1 bit flipped in the cached authorize.wasm", tampered, exec("core.authorize", "1.2.0", legitInput(), 14));

const [startup, describe, search, entry, deny, allow] = main.lines;
const result = (e) => e?.result?.output ?? e?.result;
const cachedWasm = fs.readdirSync(path.join(cache, "sha256")).map((f) => ({ path: `mcp/cache/sha256/${f}`, digest: sha(fs.readFileSync(path.join(cache, "sha256", f))) }));

const proof = {
  host: "agent-mcp",
  binary: { path: path.relative(root, BIN), sha256: sha(fs.readFileSync(BIN)), source: "cargo +1.95.0 build --release -p traverse-mcp at traverse main 70f3ee7 (unreleased)" },
  startup, mode: startup?.mode,
  search_hits: search?.results?.length ?? search?.capabilities?.length ?? null,
  search, entrypoint: entry, cached_wasm: cachedWasm,
  deny: { envelope: deny, output: result(deny) },
  allow: { envelope: allow, output: result(allow) },
  freestyle, stderr_main: main.errs,
};
fs.writeFileSync(path.join(root, "proof/agent-mcp.json"), JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ mode: proof.mode, deny: proof.deny.output, allow: proof.allow.output, freestyle: freestyle.map((f) => [f.label, f.outcome?.code ?? f.outcome?.error?.code ?? f.outcome?.status]) }, null, 2));
