#!/usr/bin/env node
/**
 * Agent / MCP-shaped smoke — JSON-RPC-style transcript of tool calls
 * against the SAME ExactModelBrowserHost path as Browser + Node.
 *
 * Honesty (read this twice):
 * - This is an in-process MCP façade over traverse-embedder-web@0.14.0
 *   ExactModelBrowserHost under Node — the same product npm path as Oct 2.
 * - It is NOT a checksum-pinned Mode A `traverse-mcp` binary (Spec 119).
 * - Catalog still has no model.execute / HF path.
 * - Test-only Spec 138 signing key.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  ExactModelBrowserHost,
  ExactModelError,
  normalizeModelExecuteEvidence,
} from "traverse-embedder-web";
import {
  PIN,
  PIN_RIGHTS_LIE,
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

/** Visible MCP JSON-RPC-style transcript (stdio framing omitted for readability). */
const transcript = [];
let rpcId = 0;
function nextId() {
  rpcId += 1;
  return rpcId;
}

function pushRpc(method, params, result, error) {
  const id = nextId();
  const request = { jsonrpc: "2.0", id, method, params };
  const response = error
    ? { jsonrpc: "2.0", id, error }
    : { jsonrpc: "2.0", id, result };
  transcript.push({ request, response, at: new Date().toISOString() });
  return { request, response };
}

console.log("=== Agent MCP-shaped · exact-ref smoke (Traverse v0.14.0) ===");
console.log("product_path  ExactModelBrowserHost + MCP façade (NOT Mode A binary)");
console.log("npm          ", RUNTIME.npm);

// --- initialize / tools/list ---
pushRpc(
  "initialize",
  {
    protocolVersion: "2024-11-05",
    clientInfo: { name: "prototype-builder-agent", version: "2026-10-09" },
    capabilities: {},
  },
  {
    protocolVersion: "2024-11-05",
    serverInfo: {
      name: "traverse-exact-ref-mcp-facade",
      version: "0.14.0-demo",
      note: "In-process façade over ExactModelBrowserHost; not packaged traverse-mcp Mode A",
    },
    capabilities: { tools: {} },
  },
);

const TOOLS = [
  {
    name: "exact_model_register",
    description:
      "Register a Spec 138 signed exact-ref model package against host pins + trust roots. Returns pin digest on success.",
    inputSchema: {
      type: "object",
      properties: {
        package_id: { type: "string" },
        attack: {
          type: "string",
          enum: ["none", "tamper_wasm", "empty_trust", "rights_lie"],
        },
      },
      required: ["package_id"],
    },
  },
  {
    name: "exact_model_execute",
    description:
      "Execute a registered exact-ref model (digits-mlp classify). Returns predicted digit + output_frame_hex + redacted trace.",
    inputSchema: {
      type: "object",
      properties: {
        digest: { type: "string" },
        input_frame_hex: { type: "string" },
        case_label: { type: "number" },
      },
      required: ["digest", "input_frame_hex"],
    },
  },
  {
    name: "exact_model_rights",
    description: "Read machine-readable rights for a registered digest.",
    inputSchema: {
      type: "object",
      properties: { digest: { type: "string" } },
      required: ["digest"],
    },
  },
];

pushRpc("tools/list", {}, { tools: TOOLS });

/** In-process façade state (one "session"). */
let sessionHost = null;
let sessionDigest = null;

function mcpError(code, message, data) {
  return { code, message, data };
}

async function toolRegister({ package_id, attack = "none" }) {
  if (package_id !== "digits-mlp-1.0.0") {
    throw Object.assign(new Error(`unknown package_id ${package_id}`), {
      mcpCode: -32602,
    });
  }
  let trust = [TRUSTED_PUBLIC_KEY_HEX];
  let pin = PIN;
  let wasm = pkg.wasm;
  if (attack === "empty_trust") trust = [];
  if (attack === "rights_lie") pin = PIN_RIGHTS_LIE;
  if (attack === "tamper_wasm") {
    wasm = new Uint8Array(pkg.wasm);
    wasm[0] ^= 0xff;
  }
  const host = new ExactModelBrowserHost([pin], { trustedPublicKeysHex: trust });
  const digest = await host.registerPackage(pkg.manifest, wasm, pkg.sig);
  sessionHost = host;
  sessionDigest = digest;
  return {
    ok: true,
    digest,
    pin_match: digest === PIN.digest,
    attack,
    rights: host.modelRights(digest),
    product_path: "ExactModelBrowserHost.registerPackage",
  };
}

async function toolExecute({ digest, input_frame_hex, case_label }) {
  if (!sessionHost || !sessionDigest) {
    throw Object.assign(new Error("no package registered in this session"), {
      mcpCode: -32000,
    });
  }
  if (digest !== sessionDigest) {
    throw Object.assign(new Error("digest not registered"), { mcpCode: -32602 });
  }
  const frame = new Uint8Array(Buffer.from(input_frame_hex, "hex"));
  const input_ref = sessionHost.io.stageModelInput(frame, 268);
  const result = await sessionHost.execute({
    model_ref: { model_id: PIN.model_id, version: PIN.version, digest },
    input_ref,
    ...REQUEST,
  });
  const output = sessionHost.io.readModelOutput(result.output_ref, 64);
  const parsed = parseDigitsOutput(output);
  const evidence = normalizeModelExecuteEvidence({
    status: "ok",
    model_ref: result.model_ref,
    placement: result.placement,
    output_ref: result.output_ref,
  });
  return {
    ok: true,
    case_label: case_label ?? null,
    predicted: parsed.predicted,
    logits: parsed.logits,
    output_frame_hex: parsed.outputHex,
    trace: result.trace,
    evidence,
  };
}

async function callTool(name, args) {
  const params = { name, arguments: args };
  try {
    let resultContent;
    if (name === "exact_model_register") {
      resultContent = await toolRegister(args);
    } else if (name === "exact_model_execute") {
      resultContent = await toolExecute(args);
    } else if (name === "exact_model_rights") {
      if (!sessionHost) throw Object.assign(new Error("no session"), { mcpCode: -32000 });
      resultContent = {
        ok: true,
        digest: args.digest,
        rights: sessionHost.modelRights(args.digest),
      };
    } else {
      throw Object.assign(new Error(`unknown tool ${name}`), { mcpCode: -32601 });
    }
    const wrapped = {
      content: [{ type: "text", text: JSON.stringify(resultContent, null, 2) }],
      structuredContent: resultContent,
      isError: false,
    };
    pushRpc("tools/call", params, wrapped);
    return { ok: true, result: resultContent };
  } catch (error) {
    const reason =
      error instanceof ExactModelError
        ? error.reason
        : undefined;
    const code = error instanceof ExactModelError ? error.code : undefined;
    const payload = {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: false,
              fail_closed: true,
              code,
              reason,
              message: String(error.message || error),
              attack: args?.attack,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
      _exact_model: { code, reason, message: String(error.message || error) },
    };
    // MCP tools/call returns isError:true in result for tool failures (not JSON-RPC error)
    pushRpc("tools/call", params, payload);
    return {
      ok: false,
      code,
      reason,
      message: String(error.message || error),
    };
  }
}

// --- Legitimate path: register + rights + execute case 0 ---
const reg = await callTool("exact_model_register", {
  package_id: "digits-mlp-1.0.0",
  attack: "none",
});
if (!reg.ok) throw new Error(`register failed: ${JSON.stringify(reg)}`);
console.log("MCP register OK", reg.result.digest);

const rightsCall = await callTool("exact_model_rights", { digest: reg.result.digest });
console.log("MCP rights OK", rightsCall.result?.rights?.license_id);

const case0 = vector.cases[0];
const exec = await callTool("exact_model_execute", {
  digest: reg.result.digest,
  input_frame_hex: case0.input_frame_hex,
  case_label: case0.label,
});
if (!exec.ok) throw new Error(`execute failed: ${JSON.stringify(exec)}`);
const hexMatch = exec.result.output_frame_hex === case0.output_frame_hex;
console.log(
  `MCP execute label=${case0.label} predicted=${exec.result.predicted} hexMatch=${hexMatch}`,
);
if (!hexMatch || exec.result.predicted !== case0.predicted) {
  throw new Error("MCP execute conformance mismatch");
}

// Fresh session attacks (each register is its own host — agent freestyle)
sessionHost = null;
sessionDigest = null;

const attackTamper = await callTool("exact_model_register", {
  package_id: "digits-mlp-1.0.0",
  attack: "tamper_wasm",
});
console.log("MCP tamper", attackTamper.reason || attackTamper);

sessionHost = null;
sessionDigest = null;
const attackTrust = await callTool("exact_model_register", {
  package_id: "digits-mlp-1.0.0",
  attack: "empty_trust",
});
console.log("MCP empty_trust", attackTrust.reason || attackTrust);

sessionHost = null;
sessionDigest = null;
const attackRights = await callTool("exact_model_register", {
  package_id: "digits-mlp-1.0.0",
  attack: "rights_lie",
});
console.log("MCP rights_lie", attackRights.reason || attackRights);

if (attackTamper.ok || attackTamper.reason !== "digest_mismatch") {
  throw new Error(`expected digest_mismatch, got ${JSON.stringify(attackTamper)}`);
}
if (attackTrust.ok || attackTrust.reason !== "key_untrusted") {
  throw new Error(`expected key_untrusted, got ${JSON.stringify(attackTrust)}`);
}
if (attackRights.ok || attackRights.reason !== "rights_mismatch") {
  throw new Error(`expected rights_mismatch, got ${JSON.stringify(attackRights)}`);
}

const proof = {
  generated_at: new Date().toISOString(),
  host: "agent-mcp-facade",
  product_path:
    "MCP-shaped JSON-RPC tools over ExactModelBrowserHost from traverse-embedder-web@0.14.0 under Node",
  not_mode_a_binary: true,
  mode_a_note:
    "Mode A packaged traverse-mcp pin-and-verify is the longer-term product story; this demo intentionally uses the published web exact-ref host under Node so we do not spend the night compiling Rust.",
  runtime: RUNTIME,
  digests: measured,
  pin: PIN,
  trusted_public_key_hex: TRUSTED_PUBLIC_KEY_HEX,
  key_warning:
    "TEST-ONLY Spec 138 fixture signing key. Never trust it in a real host. Production signing is #1567.",
  tools: TOOLS.map((t) => t.name),
  success: {
    register_digest: reg.result.digest,
    rights: rightsCall.result?.rights,
    execute: {
      label: case0.label,
      predicted: exec.result.predicted,
      output_frame_hex: exec.result.output_frame_hex,
      expected_output_frame_hex: case0.output_frame_hex,
      hexMatch,
      trace: exec.result.trace,
      evidence: exec.result.evidence,
    },
  },
  fail_closed: {
    tamper_wasm_byte: attackTamper,
    empty_trust_roots: attackTrust,
    rights_lie: attackRights,
  },
  transcript,
  honesty: {
    not_hugging_face: true,
    catalog_has_model_execute: false,
    test_only_signing_key: true,
    swift_kotlin_dotnet_exact_ref_execute: false,
    agent_mcp_is_facade_not_mode_a_binary: true,
    bit_identical_with_browser_node: true,
  },
};

await writeFile(path.join(proofDir, "mcp-agent.json"), JSON.stringify(proof, null, 2) + "\n");
console.log("wrote proof/mcp-agent.json");
console.log("MCP SMOKE OK");
