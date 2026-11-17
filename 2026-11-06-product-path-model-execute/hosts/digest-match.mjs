import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sorted = (value) =>
  Array.isArray(value)
    ? value.map(sorted)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, sorted(value[k])]))
      : value;
const canonical = (value) => JSON.stringify(sorted(value));
const strip = ({ placement_evidence, ...rest }) => rest;

const node = JSON.parse(readFileSync("proof/node.json", "utf8"));
const browser = existsSync("proof/browser.json")
  ? JSON.parse(readFileSync("proof/browser.json", "utf8"))
  : null;
const fetchLoader = existsSync("proof/fetch-loader.json")
  ? JSON.parse(readFileSync("proof/fetch-loader.json", "utf8"))
  : null;
const vector = JSON.parse(readFileSync("published/package/vector.json", "utf8"));

const hosts = { node };
if (fetchLoader) hosts.fetch_loader = fetchLoader;
if (browser) hosts.browser = browser;

let pass = true;
const fail = (m) => {
  pass = false;
  console.error("FAIL", m);
};

const scenarioNames = node.results.map((r) => r.name);
const scenarios = scenarioNames.map((name) => {
  const rows = Object.fromEntries(
    Object.entries(hosts).map(([host, proof]) => {
      const row = proof.results.find((r) => r.name === name);
      return [
        host,
        {
          registration_reason: row.registration_reason,
          output_sha256: sha(canonical(strip(row.output))),
          output_frame_hex: row.output_frame_hex ?? null,
          output: strip(row.output),
          submit_status: row.submit_status,
        },
      ];
    }),
  );
  const values = Object.values(rows);
  const first = values[0];
  for (const other of values.slice(1)) {
    if (other.output_sha256 !== first.output_sha256) fail(`${name}: outputs differ`);
    if (other.registration_reason !== first.registration_reason) fail(`${name}: registration reasons differ`);
    if (other.output_frame_hex !== first.output_frame_hex) fail(`${name}: frames differ`);
  }
  return { name, registration_reason: first.registration_reason, output_sha256: first.output_sha256, output_frame_hex: first.output_frame_hex, output: first.output, hosts: Object.keys(rows) };
});

const by = (n) => scenarios.find((s) => s.name === n);
if (by("success").output.status !== "ok" || !by("success").output.model_evidence) fail("success missing ok/model_evidence");
if (by("success").output_frame_hex !== vector.cases[0].output_frame_hex) fail("success frame != signed vector");
if (by("connector_unavailable").output.reason !== "connector_unavailable") fail("unbound");
if (by("pin_mismatch").output?.error?.reason !== "pin_mismatch") fail("pin_mismatch");
if (by("package_revoked").output?.error?.reason !== "package_revoked") fail("package_revoked");
for (const name of ["usage_undeclared", "key_untrusted", "digest_mismatch"]) {
  if (by(name).output?.error?.code !== "model_unavailable") fail(`${name} output`);
}

const file = (p) => sha(readFileSync(p));
const digests = {
  "npm traverse-embedder-web@0.16.2 integrity": JSON.parse(readFileSync("package-lock.json", "utf8")).packages[
    "node_modules/traverse-embedder-web"
  ].integrity,
  "runtime.wasm": file("bundle/runtime/runtime.wasm"),
  "model-execute-agent.wasm": file("bundle/components/model-execute/model-execute-agent.wasm"),
  "model.manifest.json (package digest)": file("published/package/model.manifest.json"),
  "model.wasm": file("published/package/model.wasm"),
  "catalog.json": file("published/catalog.json"),
};

const comparison = {
  all_identical: pass,
  hosts_compared: Object.keys(hosts),
  host_labels: Object.fromEntries(Object.entries(hosts).map(([k, v]) => [k, v.host])),
  honesty: {
    node: "NodeFsBundleLoader — published product path",
    fetch_loader: fetchLoader
      ? "HTTP loader mirroring browser FetchBundleLoader; WASM still in Node (not Chromium)"
      : null,
    browser: browser
      ? "Real browser tab via public UI"
      : "Not captured in this proof run — open http://127.0.0.1:8779/#auto (parent computerUse / Enrico preview)",
  },
  digests,
  product_path: {
    browser_node: "BundleEmbedder + activateMediatedConnector(exactModelMediatedConnector) + submitAsync",
    published: "Traverse v0.16.2 / traverse-embedder-web@0.16.2 / runtime-wasm-v0.16.2",
    closes: "2026-10-16 weekly demo red badge (constraint_violated: connector_invoke)",
  },
  scenarios,
};
writeFileSync("proof/digest-match.json", JSON.stringify(comparison, null, 2));
console.log(JSON.stringify({ all_identical: comparison.all_identical, hosts: comparison.hosts_compared, digests }, null, 2));
process.exit(pass ? 0 : 1);
