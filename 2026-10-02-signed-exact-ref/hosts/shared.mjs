/**
 * Shared pin / digests / frame helpers for Spec 138 digits-mlp exact-ref demo.
 * Pin digest is SHA-256 of exact model.manifest.json bytes (Decision 101).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const models = path.join(root, "package/models");
const digitsDir = path.join(models, "digits-mlp-1.0.0");

export const RUNTIME = {
  product: "Traverse v0.14.0",
  npm: "traverse-embedder-web@0.14.0",
  tag: "v0.14.0",
  commit: "4dac877c2fe0b28491848016747850ae31327ebc",
  governing_spec: "138-governed-exact-model-execution",
  schema_version: "2.0.0",
};

export const PIN = {
  model_id: "traverse.digits-mlp",
  version: "1.0.0",
  digest: "3068f3ae464fbbb43b45b089ab225a1371060a94a214c10629b4d8e402e8eadf",
  offline_allowed: true,
  target: "wasm-cpu",
  rights: { license_id: "CC-BY-4.0", commercial_use: "allowed" },
  key_id: "ed25519:455dffb093163d8439b544cc4f0ea79e33a07b20594c4739a8bbb4c0819d2d67",
};

export const TRUSTED_PUBLIC_KEY_HEX =
  "97002eba1e28b582a739eb48750a5f0822b2bbcb61e6bcedd2fada36b51af355";

export const DIGESTS = {
  manifest: PIN.digest,
  wasm: "6eeea06029ce4210842edfe70d7e0d8d7e926953ead5f18a0dca3c351ad5dc88",
  sig: "7d13ee6aa15f5d0704bf717494321b9235e45d3fc52cde15df528832e7a583b7",
};

export const REQUEST = {
  policy_ref: "policy-1",
  data_classification: "sensitive",
  input_schema_ref: "schema:traverse-digits-mlp-in",
  input_schema_version: "1.0.0",
  max_output_bytes: 64,
  allowed_classifications: ["sensitive"],
};

export function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

export function loadPackageBytes() {
  return {
    manifest: new Uint8Array(readFileSync(path.join(digitsDir, "model.manifest.json"))),
    wasm: new Uint8Array(readFileSync(path.join(digitsDir, "model.wasm"))),
    sig: new Uint8Array(readFileSync(path.join(digitsDir, "model.sig.json"))),
  };
}

export function loadConformance() {
  return JSON.parse(readFileSync(path.join(models, "signed-digits-mlp.json"), "utf8"));
}

export function loadPublicKey() {
  return JSON.parse(readFileSync(path.join(models, "test-signing-key.public.json"), "utf8"));
}

/** Parse digits-mlp guest output: 11×f32 payload = 10 logits + predicted class. */
export function parseDigitsOutput(output) {
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const abi = view.getUint16(0, true);
  const dtype = output[2];
  const rank = output[3];
  const dim0 = view.getUint32(4, true);
  const payloadLen = view.getUint32(8, true);
  const logits = [];
  for (let i = 0; i < 10; i += 1) {
    logits.push(view.getFloat32(12 + i * 4, true));
  }
  const predicted = view.getFloat32(52, true);
  return {
    abi,
    dtype,
    rank,
    dim0,
    payloadLen,
    logits,
    predicted: Math.round(predicted),
    predictedRaw: predicted,
    outputHex: Buffer.from(output).toString("hex"),
  };
}

export function featuresFromCsvRow(line) {
  const values = line.trim().split(",").map(Number);
  const label = values.pop();
  return { features: Float32Array.from(values), label };
}

export function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export { root, models, digitsDir };
