#!/usr/bin/env node
// Native host: published traverse-cli-rs 0.15.0 from crates.io. `model verify`
// does host-equivalent registration; `model conformance check` re-runs every case on
// wasmtime AND wasmi and requires byte-identical output vs the vector.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";
import path from "node:path"; import { fileURLToPath } from "node:url";
import * as S from "../lib/hf-pins.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = "/workspace/hf-proto-shared/cli-0.15.0/bin/traverse-cli"; // cargo install traverse-cli-rs --version =0.15.0 --locked
const key = readFileSync(path.join(root, "package/trusted-public-key.hex"), "utf8").trim();
const pkg = path.join(root, "package/mnist-12-1.0.0");
function cli(args) {
  const t = Date.now();
  try { const out = execFileSync(CLI, [...args, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); return { exit: 0, ms: Date.now() - t, json: JSON.parse(out) }; }
  catch (e) { let j = null; try { j = JSON.parse(e.stdout || e.stderr); } catch {} return { exit: e.status, ms: Date.now() - t, json: j, stream: e.stdout ? "stdout" : "stderr" }; }
}
const p = { host: "native", product_path: `${S.RELEASE.cli} (wasmtime + wasmi engines)`, release: S.RELEASE };
p.verify = cli(["model", "verify", pkg, "--trusted-key", key]);
p.conformance_check = cli(["model", "conformance", "check", pkg, path.join(root, "package/conformance-mnist-12.json"), "--trusted-key", key]);
p.pin = cli(["model", "pin", pkg]);
const vec = JSON.parse(readFileSync(path.join(root, "package/conformance-mnist-12.json"), "utf8"));
p.cases = vec.cases.map((c, i) => { const b = Buffer.from(c.output_frame_hex, "hex"); const lg = S.logits(new Uint8Array(b));
  return { name: S.CASES[i], predicted: S.argmax(lg), output_frame_hex: c.output_frame_hex }; });
p.engines = vec.engines;
const tmp = "/tmp/wk1016-onnx-tamper"; rmSync(tmp, { recursive: true, force: true }); cpSync(pkg, tmp, { recursive: true });
const w = readFileSync(`${tmp}/model.wasm`); w[w.length - 1000] ^= 0x01; writeFileSync(`${tmp}/model.wasm`, w);
p.attacks = { tamper_one_weight_bit: cli(["model", "verify", tmp, "--trusted-key", key]),
  untrusted_key: cli(["model", "verify", pkg, "--trusted-key", "00".repeat(32)]) };
rmSync(tmp, { recursive: true, force: true });
p.generated_at = new Date().toISOString();
mkdirSync(path.join(root, "proof"), { recursive: true });
writeFileSync(path.join(root, "proof/native.json"), JSON.stringify(p, null, 2));
console.log("verify:", p.verify.exit, p.verify.json?.ok, p.verify.json?.digest);
console.log("conformance check (wasmtime+wasmi):", p.conformance_check.exit, JSON.stringify(p.conformance_check.json));
for (const c of p.cases) console.log(`  ${c.name}: predicted ${c.predicted}`);
for (const [k, v] of Object.entries(p.attacks)) console.log(`attack ${k}: exit ${v.exit} ${JSON.stringify(v.json ?? v.stderr).slice(0, 220)}`);
console.log("wrote proof/native.json");
