// Compares Browser / Node / Native: capability stdout (canonical JSON) + model output frame bytes + refusal reasons.
import { readFile, writeFile } from "node:fs/promises"; import { existsSync } from "node:fs";
const j = async (p) => (existsSync(p) ? JSON.parse(await readFile(p, "utf8")) : null);
const canon = (v) => (v && typeof v === "object" ? (Array.isArray(v) ? `[${v.map(canon).join(",")}]` : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`) : JSON.stringify(v));
const N = await j("proof/node.json"), X = await j("proof/native-mediated.json"), B = await j("proof/browser.json");
const vec = await j("package/conformance-mnist-12.json");
const rows = N.scenarios.map((s, i) => {
  const n = N.cases.find((c) => c.name === s.id) ?? N.attempts.find((a) => a.id === s.id); const b = B ? (B.cases.find((c) => c.name === s.id) ?? B.attempts.find((a) => a.id === s.id)) : null;
  const x = X.results.find((r) => r.id === s.id);
  const nOut = canon(JSON.parse(n.capability_stdout)), bOut = b ? canon(JSON.parse(b.capability_stdout)) : null, xOut = canon(x.capability_output);
  const vi = N.cases.findIndex((c) => c.name === s.id);
  return { id: s.id, stdout_identical: nOut === xOut && (!B || bOut === nOut), frame_identical: (n.output_frame_hex ?? null) === (x.output_frame_hex ?? null) && (!B || (b.output_frame_hex ?? null) === (n.output_frame_hex ?? null)),
    matches_native_conformance_vector: vi >= 0 ? x.output_frame_hex === vec.cases[vi].output_frame_hex : null, result: JSON.parse(n.capability_stdout).reason ?? JSON.parse(n.capability_stdout).status };
});
const out = { hosts: ["browser" + (B ? "" : " (missing)"), "node", "native"], all_identical: rows.every((r) => r.stdout_identical && r.frame_identical), browser_fingerprint: B?.fingerprint ?? null, node_fingerprint: N.fingerprint, rows, generated_at: new Date().toISOString() };
await writeFile("proof/digest-match.json", JSON.stringify(out, null, 2)); console.log(JSON.stringify({ all_identical: out.all_identical, B: out.browser_fingerprint, N: out.node_fingerprint }), rows.filter((r) => !(r.stdout_identical && r.frame_identical)));
