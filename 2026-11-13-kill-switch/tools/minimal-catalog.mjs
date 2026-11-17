#!/usr/bin/env node
// minimal-catalog.mjs: write a demo's published/catalog.json containing ONLY the allowlisted
// capability entries. The full registry catalog is fetched into a temp dir OUTSIDE the demo tree
// and deleted before exit, so it can never be vendored.
//
// usage: node minimal-catalog.mjs --allowlist catalog.allowlist --out published/catalog.json \
//          [--source https://registry.traverse-framework.com/catalog.json | /path/to/catalog.json]
//
// allowlist: one `namespace/id@version` per line; blank lines and `#` comments ignored.
// Exit 1 with a clear error if any allowlisted entry is missing, revoked, or lacks a digest.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, realpathSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, relative, isAbsolute } from "node:path";

// Deny patterns live in a PRIVATE file that is never copied into a demo (so the demo never
// contains the strings it guards against). Override with LEAK_PATTERNS_FILE.
const PATTERNS_FILE = process.env.LEAK_PATTERNS_FILE ?? "/workspace/weekly-demo-tools/leak-patterns.txt";
let LEAK = /(?!)/; // matches nothing
if (existsSync(PATTERNS_FILE)) {
  const pats = readFileSync(PATTERNS_FILE, "utf8").split("\n").map((l) => l.trim()).filter(Boolean)
    .map((p) => p.replaceAll("[:space:]", "\\s"));
  LEAK = new RegExp(pats.join("|"), "i");
} else {
  console.warn(`minimal-catalog: WARNING: no deny-pattern file at ${PATTERNS_FILE}; kept entries are not field-stripped (run leak-check before release)`);
}
// Fields whose values must survive untouched (digests, trust, revocation, artifact location).
const PROTECTED = new Set(["reference", "contract_digest", "contract_url", "revoked", "revocation", "deprecated", "artifact", "digest", "risk", "licensing", "permissions"]);

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const die = (m) => { console.error(`minimal-catalog: ERROR: ${m}`); process.exit(1); };
if (!args.allowlist || !args.out) die("need --allowlist <file> and --out <published/catalog.json>");
const source = args.source ?? "https://registry.traverse-framework.com/catalog.json";

const allow = readFileSync(args.allowlist, "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
if (!allow.length) die(`allowlist ${args.allowlist} is empty`);
for (const ref of allow) if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+@\d+\.\d+\.\d+$/i.test(ref)) die(`allowlist line is not namespace/id@x.y.z: ${ref}`);

// Full catalog lives only in a temp dir outside the demo tree.
mkdirSync(dirname(args.out), { recursive: true });
const demoRoot = realpathSync(resolve(dirname(args.out), ".."));
const tmp = mkdtempSync(join(tmpdir(), "traverse-full-catalog-"));
let full;
try {
  const rel = relative(demoRoot, realpathSync(tmp));
  if (!rel.startsWith("..") && !isAbsolute(rel)) throw new Error(`temp dir ${tmp} is inside the demo tree; refusing`);
  const fullPath = join(tmp, "catalog.full.json");
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`fetch ${source} -> HTTP ${res.status}`);
    writeFileSync(fullPath, Buffer.from(await res.arrayBuffer()));
  } else {
    writeFileSync(fullPath, readFileSync(source));
  }
  full = JSON.parse(readFileSync(fullPath, "utf8"));
} catch (e) {
  rmSync(tmp, { recursive: true, force: true });
  die(e.message);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const caps = full.capabilities;
if (!Array.isArray(caps)) die("source catalog has no `capabilities` array (catalog format changed?)");
const stripped = [];
function strip(node, path) {
  if (Array.isArray(node)) return node.map((v, i) => strip(v, `${path}[${i}]`)).filter((v) => v !== undefined);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      const p = `${path}.${k}`;
      if (typeof v === "string" && LEAK.test(v)) {
        if (PROTECTED.has(k)) die(`protected field ${p} carries a leak pattern; refusing to strip a trust/digest field`);
        stripped.push(p);
        continue;
      }
      const s = strip(v, p);
      if (s !== undefined) out[k] = s;
    }
    return out;
  }
  if (typeof node === "string" && LEAK.test(node)) { stripped.push(path); return undefined; }
  return node;
}

const kept = [];
const missing = [];
for (const ref of allow) {
  const e = caps.find((c) => c.reference === ref);
  if (!e) { missing.push(ref); continue; }
  if (e.revoked) die(`${ref} is revoked in the registry: ${JSON.stringify(e.revocation)}`);
  if (!e.contract_digest || !e.contract?.artifact?.digest) die(`${ref} has no contract_digest / artifact.digest`);
  kept.push(strip(e, ref));
}
if (missing.length) die(`allowlisted capabilities not found in ${source}: ${missing.join(", ")} (catalog has ${caps.length} entries). Fix the allowlist or wait for the registry; NOT falling back to the full catalog.`);
if (stripped.some((p) => p.includes(".contract."))) console.warn(`minimal-catalog: WARNING: stripped fields inside a contract; that entry's contract_digest now refers to the upstream contract, not the trimmed copy: ${stripped.join(", ")}`);

const out = {
  _minimal: {
    note: "Minimal catalog: only the capabilities this demo executes. Full registry catalog is not vendored.",
    source,
    generated_at: new Date().toISOString(),
    allowlist: allow,
    stripped_fields: stripped,
  },
  capabilities: kept,
};
const text = JSON.stringify(out, null, 2) + "\n";
if (LEAK.test(text)) die("minimal catalog still matches a leak pattern after filtering");
mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, text);
console.log(`minimal-catalog: wrote ${args.out}: ${kept.length}/${caps.length} entries (${allow.join(", ")}), ${Buffer.byteLength(text)} bytes, stripped ${stripped.length} field(s)`);
