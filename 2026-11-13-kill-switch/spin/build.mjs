import fs from "node:fs"; import crypto from "node:crypto"; import wabtInit from "wabt";
const wabt = await wabtInit();
const mod = wabt.parseWat("spin.wat", fs.readFileSync("spin/spin.wat","utf8"));
const wasm = Buffer.from(mod.toBinary({}).buffer);
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
let kp; const kf = "spin/demo-signing-key.json";
if (fs.existsSync(kf)) { const k = JSON.parse(fs.readFileSync(kf)); kp = { priv: crypto.createPrivateKey({key: Buffer.from(k.pkcs8,"hex"), format:"der", type:"pkcs8"}) }; kp.pub = crypto.createPublicKey(kp.priv);}
else { const g = crypto.generateKeyPairSync("ed25519"); kp = {priv:g.privateKey,pub:g.publicKey}; fs.writeFileSync(kf, JSON.stringify({note:"DEMO-ONLY key generated on the box; no production trust", pkcs8: g.privateKey.export({format:"der",type:"pkcs8"}).toString("hex")})); }
const rawPub = kp.pub.export({format:"der",type:"spki"}).subarray(-32);
const keyId = "ed25519:" + sha(rawPub);
const manifest = {
  schema_version: "2.0.0", model_id: "demo.runaway-spin", version: "1.0.0", wasm_digest: sha(wasm),
  registry_ref: "registry:demo.runaway-spin@1.0.0", executable_format: "traverse-model-wasm", abi_version: 1,
  input_schema_ref: "schema:demo-spin-in", input_schema_version: "1.0.0",
  output_schema_ref: "schema:demo-spin-out", output_schema_version: "1.0.0",
  rights: { license_id: "Apache-2.0", attribution: "Prototype Builder demo guest (deterministic LCG spin loop), not a real model", redistribution: "Redistribution permitted; signed with a demo-only key (no production trust)", commercial_use: "allowed", source_url: "https://github.com/traverse-framework/weekly-demos" },
  supported_profiles: ["wasm-cpu"], max_memory_bytes: 1048576, max_fuel: 10000000000,
  max_input_bytes: 4, max_output_bytes: 8, max_execution_ms: 1500, offline_allowed: true,
};
const mbytes = Buffer.from(JSON.stringify(manifest, null, 2));
const sig = crypto.sign(null, mbytes, kp.priv).toString("hex");
fs.mkdirSync("published/spin", {recursive:true});
fs.writeFileSync("published/spin/model.wasm", wasm);
fs.writeFileSync("published/spin/model.manifest.json", mbytes);
fs.writeFileSync("published/spin/model.sig.json", JSON.stringify({alg:"ed25519", key_id:keyId, signature:sig}, null, 2));
const digest = sha(mbytes);
fs.writeFileSync("published/spin/vector.json", JSON.stringify({ pin: { model_id: manifest.model_id, version: manifest.version, digest, offline_allowed: true, target: "wasm-cpu", rights: {license_id:"Apache-2.0", commercial_use:"allowed"}, key_id: keyId }, trusted_public_key_hex: rawPub.toString("hex"), wasm_sha256: sha(wasm) }, null, 2));
console.log({wasm_bytes: wasm.length, wasm_sha256: sha(wasm), manifest_digest: digest, keyId});
// keep the demo input pointed at the freshly signed manifest
const inputPath = "published/spin/input.json";
if (fs.existsSync(inputPath)) { const i = JSON.parse(fs.readFileSync(inputPath, "utf8")); i.model_ref.digest = `sha256:${digest}`; fs.writeFileSync(inputPath, JSON.stringify(i, null, 2)); }
