#!/usr/bin/env node
/**
 * Node host smoke — SAME product path as the browser:
 * ExactModelBrowserHost from traverse-embedder-web@0.14.0 under Node.
 * Spec 138 signed exact-ref digits-mlp-1.0.0.
 *
 * Honesty: published web embedder under Node, not a separate native Rust CLI.
 * Test-only signing key. Catalog has no model.execute / HF path.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  ExactModelBrowserHost,
  ExactModelError,
  encodeGuestFrame,
  normalizeModelExecuteEvidence,
} from "traverse-embedder-web";
import {
  PIN,
  TRUSTED_PUBLIC_KEY_HEX,
  DIGESTS,
  REQUEST,
  RUNTIME,
  loadPackageBytes,
  loadConformance,
  parseDigitsOutput,
  sha256Hex,
  root,
} from "./shared.mjs";

const proofDir = path.join(root, "proof");
await mkdir(proofDir, { recursive: true });

const pkg = loadPackageBytes();
const vector = loadConformance();

const measured = {
  manifest: sha256Hex(pkg.manifest),
  wasm: sha256Hex(pkg.wasm),
  sig: sha256Hex(pkg.sig),
};

console.log("=== Signed exact-ref · Node smoke (Traverse v0.14.0) ===");
console.log("npm           ", RUNTIME.npm);
console.log("manifest dig  ", measured.manifest, measured.manifest === DIGESTS.manifest ? "OK" : "MISMATCH");
console.log("wasm dig      ", measured.wasm, measured.wasm === DIGESTS.wasm ? "OK" : "MISMATCH");
console.log("pin digest    ", PIN.digest);

if (measured.manifest !== DIGESTS.manifest || measured.wasm !== DIGESTS.wasm) {
  throw new Error("fixture digests drifted from pinned README values");
}

const host = new ExactModelBrowserHost([PIN], {
  trustedPublicKeysHex: [TRUSTED_PUBLIC_KEY_HEX],
});

const digest = await host.registerPackage(pkg.manifest, pkg.wasm, pkg.sig);
console.log("registerPackage", digest, digest === PIN.digest ? "OK" : "MISMATCH");

const rights = host.modelRights(digest);
console.log("rights        ", JSON.stringify(rights));

async function classify(frameBytes, label) {
  const input_ref = host.io.stageModelInput(frameBytes, 268);
  const result = await host.execute({
    model_ref: { model_id: PIN.model_id, version: PIN.version, digest },
    input_ref,
    ...REQUEST,
  });
  const output = host.io.readModelOutput(result.output_ref, 64);
  const parsed = parseDigitsOutput(output);
  const evidence = normalizeModelExecuteEvidence({
    status: "ok",
    model_ref: result.model_ref,
    placement: result.placement,
    output_ref: result.output_ref,
  });
  return { result, parsed, evidence, label };
}

// Conformance case 0 (digit 0 → predicted 0) + case 7 (digit 7)
const cases = [];
for (const c of [vector.cases[0], vector.cases[7], vector.cases[4]]) {
  const frame = Buffer.from(c.input_frame_hex, "hex");
  const run = await classify(new Uint8Array(frame), c.label);
  const hexMatch = run.parsed.outputHex === c.output_frame_hex;
  console.log(
    `case label=${c.label} predicted=${run.parsed.predicted} expected=${c.predicted} hexMatch=${hexMatch}`,
  );
  if (!hexMatch || run.parsed.predicted !== c.predicted) {
    throw new Error(`conformance mismatch for label ${c.label}`);
  }
  cases.push({
    label: c.label,
    predicted: run.parsed.predicted,
    logits: run.parsed.logits,
    outputHex: run.parsed.outputHex,
    expectedOutputHex: c.output_frame_hex,
    hexMatch,
    trace: run.result.trace,
    evidence: run.evidence,
  });
}

// Fail-closed: tamper one wasm byte → digest_mismatch
const tamperedWasm = new Uint8Array(pkg.wasm);
tamperedWasm[0] ^= 0xff;
let tamper = null;
try {
  const attackHost = new ExactModelBrowserHost([PIN], {
    trustedPublicKeysHex: [TRUSTED_PUBLIC_KEY_HEX],
  });
  await attackHost.registerPackage(pkg.manifest, tamperedWasm, pkg.sig);
  tamper = { ok: true, error: null };
  console.log("TAMPER UNEXPECTEDLY SUCCEEDED");
} catch (error) {
  tamper = {
    ok: false,
    code: error instanceof ExactModelError ? error.code : "unknown",
    reason: error instanceof ExactModelError ? error.reason : undefined,
    message: String(error.message || error),
  };
  console.log("tamper fail-closed", tamper.code, tamper.reason);
}

// Fail-closed: empty trust roots → key_untrusted
let untrusted = null;
try {
  const bad = new ExactModelBrowserHost([PIN], { trustedPublicKeysHex: [] });
  await bad.registerPackage(pkg.manifest, pkg.wasm, pkg.sig);
  untrusted = { ok: true };
} catch (error) {
  untrusted = {
    ok: false,
    code: error instanceof ExactModelError ? error.code : "unknown",
    reason: error instanceof ExactModelError ? error.reason : undefined,
    message: String(error.message || error),
  };
  console.log("untrusted-key fail-closed", untrusted.code, untrusted.reason);
}

if (tamper.ok || tamper.reason !== "digest_mismatch") {
  throw new Error(`expected digest_mismatch on tamper, got ${JSON.stringify(tamper)}`);
}
if (untrusted.ok || untrusted.reason !== "key_untrusted") {
  throw new Error(`expected key_untrusted, got ${JSON.stringify(untrusted)}`);
}

const proof = {
  generated_at: new Date().toISOString(),
  host: "node",
  product_path: "ExactModelBrowserHost from traverse-embedder-web@0.14.0 under Node",
  runtime: RUNTIME,
  digests: measured,
  pin: PIN,
  trusted_public_key_hex: TRUSTED_PUBLIC_KEY_HEX,
  key_warning: "TEST-ONLY Spec 138 fixture signing key. Never trust it in a real host. Production signing is #1567.",
  rights,
  register_digest: digest,
  cases,
  bit_identical_note:
    "Browser host uses the same ExactModelBrowserHost + same package bytes; compare outputHex to /proof/browser-host.json after UI classify.",
  fail_closed: { tamper_wasm_byte: tamper, empty_trust_roots: untrusted },
  honesty: {
    not_hugging_face: true,
    catalog_has_model_execute: false,
    test_only_signing_key: true,
    swift_kotlin_dotnet_exact_ref_execute: false,
    node_is_web_embedder_under_node: true,
  },
};

await writeFile(path.join(proofDir, "node-host.json"), JSON.stringify(proof, null, 2) + "\n");
await writeFile(
  path.join(proofDir, "digest-match.json"),
  JSON.stringify(
    {
      generated_at: proof.generated_at,
      digests: measured,
      pin_digest: PIN.digest,
      wasm_digest_in_manifest: DIGESTS.wasm,
      match: {
        manifest_eq_pin: measured.manifest === PIN.digest,
        wasm_eq_manifest_field: measured.wasm === DIGESTS.wasm,
      },
      npm: RUNTIME.npm,
      tag: RUNTIME.tag,
      commit: RUNTIME.commit,
    },
    null,
    2,
  ) + "\n",
);

console.log("wrote proof/node-host.json + proof/digest-match.json");
console.log("SMOKE OK");
