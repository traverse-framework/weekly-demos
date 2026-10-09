/**
 * Browser host + proof panels for 2026-10-09 agent-mcp-exact-ref.
 * Uses published traverse-embedder-web@0.14.0 ExactModelBrowserHost.
 */
import {
  ExactModelBrowserHost,
  ExactModelError,
  encodeGuestFrame,
  normalizeModelExecuteEvidence,
} from "/pkg/index.js";

const PIN = {
  model_id: "traverse.digits-mlp",
  version: "1.0.0",
  digest: "3068f3ae464fbbb43b45b089ab225a1371060a94a214c10629b4d8e402e8eadf",
  offline_allowed: true,
  target: "wasm-cpu",
  rights: { license_id: "CC-BY-4.0", commercial_use: "allowed" },
  key_id: "ed25519:455dffb093163d8439b544cc4f0ea79e33a07b20594c4739a8bbb4c0819d2d67",
};

const TRUSTED_PUBLIC_KEY_HEX =
  "97002eba1e28b582a739eb48750a5f0822b2bbcb61e6bcedd2fada36b51af355";

const REQUEST = {
  policy_ref: "policy-1",
  data_classification: "sensitive",
  input_schema_ref: "schema:traverse-digits-mlp-in",
  input_schema_version: "1.0.0",
  max_output_bytes: 64,
  allowed_classifications: ["sensitive"],
};

const el = (id) => document.getElementById(id);
const canvas = el("digit-canvas");
const ctx = canvas.getContext("2d");

/** @type {Float32Array} */
let grid = new Float32Array(64);
/** @type {ExactModelBrowserHost | null} */
let host = null;
/** @type {string | null} */
let registeredDigest = null;
/** @type {Uint8Array | null} */
let pkgManifest = null;
/** @type {Uint8Array | null} */
let pkgWasm = null;
/** @type {Uint8Array | null} */
let pkgSig = null;
/** @type {object | null} */
let lastBrowser = null;
/** @type {object | null} */
let nodeProof = null;
/** @type {object | null} */
let mcpProof = null;
/** @type {Array<object>} */
let samples = [];

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(hash));
}

function parseDigitsOutput(output) {
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const logits = [];
  for (let i = 0; i < 10; i += 1) logits.push(view.getFloat32(12 + i * 4, true));
  const predicted = Math.round(view.getFloat32(52, true));
  return { logits, predicted, outputHex: toHex(output) };
}

function drawGrid() {
  const cell = canvas.width / 8;
  ctx.fillStyle = "#02050a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const v = grid[y * 8 + x] / 16;
      const g = Math.round(20 + v * 220);
      ctx.fillStyle = `rgb(${g * 0.4},${g},${g * 0.75})`;
      ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    }
  }
}

function paintAt(clientX, clientY, value = 16) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((clientX - rect.left) / rect.width) * 8);
  const y = Math.floor(((clientY - rect.top) / rect.height) * 8);
  if (x < 0 || y < 0 || x > 7 || y > 7) return;
  const idx = y * 8 + x;
  grid[idx] = Math.max(grid[idx], value);
  for (const [dx, dy, w] of [[1,0,10],[0,1,10],[-1,0,10],[0,-1,10],[1,1,6],[-1,1,6],[1,-1,6],[-1,-1,6]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx > 7 || ny > 7) continue;
    const i = ny * 8 + nx;
    grid[i] = Math.min(16, Math.max(grid[i], w));
  }
  drawGrid();
}

let drawing = false;
canvas.addEventListener("pointerdown", (e) => { drawing = true; canvas.setPointerCapture(e.pointerId); paintAt(e.clientX, e.clientY); });
canvas.addEventListener("pointermove", (e) => { if (drawing) paintAt(e.clientX, e.clientY); });
canvas.addEventListener("pointerup", () => { drawing = false; });
canvas.addEventListener("pointercancel", () => { drawing = false; });

el("btn-clear").addEventListener("click", () => {
  grid = new Float32Array(64);
  drawGrid();
  el("big-digit").textContent = "—";
  el("big-digit").className = "big-digit pending";
  el("match-badge").textContent = "output_frame_hex · awaiting";
  el("match-badge").className = "badge muted-badge";
});

function setSample(features) {
  grid = Float32Array.from(features);
  drawGrid();
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function loadAssets() {
  const [manifestBuf, wasmBuf, sigBuf, keyJson, vector, sampleText, nodeJson, mcpJson] = await Promise.all([
    fetch("/models/digits-mlp-1.0.0/model.manifest.json").then((r) => r.arrayBuffer()),
    fetch("/models/digits-mlp-1.0.0/model.wasm").then((r) => r.arrayBuffer()),
    fetch("/models/digits-mlp-1.0.0/model.sig.json").then((r) => r.arrayBuffer()),
    fetch("/models/test-signing-key.public.json").then((r) => r.json()),
    fetch("/models/signed-digits-mlp.json").then((r) => r.json()),
    fetch("/models/optdigits-sample.tes").then((r) => r.text()),
    fetch("/proof/node-host.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch("/proof/mcp-agent.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  pkgManifest = new Uint8Array(manifestBuf);
  pkgWasm = new Uint8Array(wasmBuf);
  pkgSig = new Uint8Array(sigBuf);
  nodeProof = nodeJson;
  mcpProof = mcpJson;

  const manifestDigest = await sha256Hex(pkgManifest);
  const wasmDigest = await sha256Hex(pkgWasm);
  el("pin-panel").textContent = JSON.stringify(
    {
      pin: PIN,
      trust_root: {
        warning: keyJson.warning,
        key_id: keyJson.key_id,
        public_key_hex: keyJson.public_key_hex,
      },
      measured: { manifest: manifestDigest, wasm: wasmDigest },
      pin_match: manifestDigest === PIN.digest,
      honesty: {
        agent_mcp: "MCP-shaped façade over ExactModelBrowserHost — not Mode A traverse-mcp binary",
        not_hf: true,
        catalog_model_execute: false,
      },
    },
    null,
    2,
  );

  samples = [];
  for (const c of vector.cases) {
    const frame = hexToBytes(c.input_frame_hex);
    const features = new Float32Array(frame.buffer, frame.byteOffset + 12, 64);
    samples.push({
      name: `conformance · label ${c.label} → pred ${c.predicted}`,
      label: c.label,
      predicted: c.predicted,
      features: Float32Array.from(features),
      expectedOutputHex: c.output_frame_hex,
    });
  }
  for (const line of sampleText.trim().split("\n").slice(0, 12)) {
    const vals = line.split(",").map(Number);
    const label = vals.pop();
    samples.push({
      name: `optdigits · label ${label}`,
      label,
      predicted: null,
      features: Float32Array.from(vals),
      expectedOutputHex: null,
    });
  }
  const select = el("sample-select");
  select.innerHTML = "";
  samples.forEach((s, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = s.name;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => setSample(samples[Number(select.value)].features));
  setSample(samples[0].features);

  renderNodePanel();
  renderMcpPanel();
}

function renderNodePanel() {
  if (!nodeProof) {
    el("node-panel").textContent = "No proof yet — run npm run smoke";
    return;
  }
  const c0 = nodeProof.cases?.[0];
  el("node-panel").textContent = JSON.stringify(
    {
      host: nodeProof.host,
      npm: nodeProof.runtime?.npm,
      register_digest: nodeProof.register_digest,
      first_case: c0
        ? { label: c0.label, predicted: c0.predicted, hexMatch: c0.hexMatch, outputHex: c0.outputHex?.slice(0, 40) + "…" }
        : null,
      fail_closed: {
        tamper: nodeProof.fail_closed?.tamper_wasm_byte?.reason,
        empty_trust: nodeProof.fail_closed?.empty_trust_roots?.reason,
        rights_lie: nodeProof.fail_closed?.rights_lie?.reason,
      },
    },
    null,
    2,
  );
  updateMatch();
}

function renderMcpPanel() {
  if (!mcpProof) {
    el("mcp-panel").textContent = "No proof yet — run npm run smoke:mcp";
    el("kill-banner").textContent = "Run npm run smoke:mcp for agent freestyle proof";
    el("mcp-transcript").textContent = "…";
    return;
  }
  const fc = mcpProof.fail_closed || {};
  el("mcp-panel").textContent = JSON.stringify(
    {
      host: mcpProof.host,
      product_path: mcpProof.product_path,
      not_mode_a_binary: mcpProof.not_mode_a_binary,
      tools: mcpProof.tools,
      success: {
        digest: mcpProof.success?.register_digest,
        predicted: mcpProof.success?.execute?.predicted,
        hexMatch: mcpProof.success?.execute?.hexMatch,
      },
      fail_closed: {
        tamper: fc.tamper_wasm_byte?.reason,
        empty_trust: fc.empty_trust_roots?.reason,
        rights_lie: fc.rights_lie?.reason,
      },
    },
    null,
    2,
  );
  el("kill-banner").textContent = JSON.stringify(
    {
      tamper_wasm: fc.tamper_wasm_byte?.reason,
      empty_trust: fc.empty_trust_roots?.reason,
      rights_lie: fc.rights_lie?.reason,
      story: "Agent freestyle fail-closed with stable Spec 138 reasons",
    },
    null,
    2,
  );
  // Show last few transcript turns (attacks + success)
  const turns = (mcpProof.transcript || []).slice(-6);
  el("mcp-transcript").textContent = turns
    .map((t) => {
      const method = t.request?.method;
      const name = t.request?.params?.name;
      const attack = t.request?.params?.arguments?.attack;
      const err = t.response?.result?._exact_model || t.response?.result?.isError;
      const structured = t.response?.result?.structuredContent;
      const line = {
        method,
        tool: name,
        attack: attack || undefined,
        result: structured
          ? { ok: structured.ok, predicted: structured.predicted, digest: structured.digest?.slice?.(0, 16) }
          : err
            ? t.response.result._exact_model
            : t.response?.result?.serverInfo
              ? { server: t.response.result.serverInfo.name }
              : t.response?.result?.tools
                ? { tools: t.response.result.tools.length }
                : "ok",
      };
      return JSON.stringify(line);
    })
    .join("\n");
  updateMatch();
}

function updateMatch() {
  const badge = el("match-badge");
  if (!lastBrowser) {
    el("match").textContent = "Register + classify, then refresh proofs…";
    return;
  }
  const nodeCase =
    nodeProof?.cases?.find((c) => c.label === lastBrowser.sampleLabel && c.predicted === lastBrowser.predicted) ||
    nodeProof?.cases?.[0];
  const mcpHex = mcpProof?.success?.execute?.output_frame_hex;
  const nodeHex = nodeCase?.outputHex;
  const browserHex = lastBrowser.outputHex;
  const browserNode = nodeHex ? browserHex === nodeHex : null;
  const browserMcp =
    mcpHex && lastBrowser.sampleLabel === mcpProof?.success?.execute?.label
      ? browserHex === mcpHex
      : mcpHex && nodeHex
        ? nodeHex === mcpHex
        : null;
  const nodeMcp = nodeHex && mcpHex ? nodeHex === mcpHex : null;

  if (browserNode === true) {
    badge.textContent = "BIT-IDENTICAL · Browser ↔ Node";
    badge.className = "badge ok";
  } else if (browserNode === false) {
    badge.textContent = "HEX MISMATCH · Browser ↔ Node";
    badge.className = "badge danger";
  }

  el("match").textContent = JSON.stringify(
    {
      browser_predicted: lastBrowser.predicted,
      node_predicted: nodeCase?.predicted ?? null,
      mcp_predicted: mcpProof?.success?.execute?.predicted ?? null,
      browser_node_bit_identical: browserNode,
      node_mcp_bit_identical: nodeMcp,
      browser_mcp_same_case: browserMcp,
      digests: nodeProof?.digests || mcpProof?.digests,
    },
    null,
    2,
  );
}

el("btn-register").addEventListener("click", async () => {
  try {
    el("trace").textContent = "Verifying Ed25519 signature over exact manifest bytes…";
    host = new ExactModelBrowserHost([PIN], { trustedPublicKeysHex: [TRUSTED_PUBLIC_KEY_HEX] });
    registeredDigest = await host.registerPackage(pkgManifest, pkgWasm, pkgSig);
    const rights = host.modelRights(registeredDigest);
    el("browser-panel").textContent = JSON.stringify(
      {
        status: "registered",
        digest: registeredDigest,
        pin_ok: registeredDigest === PIN.digest,
        rights,
      },
      null,
      2,
    );
    el("trace").textContent = JSON.stringify(
      {
        event: "registerPackage",
        digest: registeredDigest,
        signature: "ed25519 verified",
        key_id: PIN.key_id,
        note: "test-only trust root",
      },
      null,
      2,
    );
    el("btn-classify").disabled = false;
    el("btn-attack").disabled = false;
    el("big-digit").textContent = "✓";
    el("big-digit").className = "big-digit";
  } catch (error) {
    el("browser-panel").textContent = formatErr(error);
    el("trace").textContent = formatErr(error);
    el("big-digit").textContent = "✖";
    el("big-digit").className = "big-digit fail";
  }
});

el("btn-classify").addEventListener("click", async () => {
  if (!host || !registeredDigest) return;
  try {
    const frame = encodeGuestFrame(2, [64], new Uint8Array(grid.buffer.slice(0)));
    const input_ref = host.io.stageModelInput(frame, 268);
    const result = await host.execute({
      model_ref: { model_id: PIN.model_id, version: PIN.version, digest: registeredDigest },
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
    const sampleIdx = Number(el("sample-select").value);
    lastBrowser = {
      predicted: parsed.predicted,
      logits: parsed.logits,
      outputHex: parsed.outputHex,
      sampleLabel: samples[sampleIdx]?.label,
      trace: result.trace,
      evidence,
    };
    el("big-digit").textContent = String(parsed.predicted);
    el("big-digit").className = "big-digit";
    el("logits").textContent = parsed.logits
      .map((v, i) => `${i}: ${v.toFixed(3)}${i === parsed.predicted ? "  ←" : ""}`)
      .join("\n");
    el("browser-panel").textContent = JSON.stringify(
      {
        status: "classified",
        predicted: parsed.predicted,
        digest: registeredDigest,
        usage: result.trace.usage,
        outputHex: parsed.outputHex,
      },
      null,
      2,
    );
    el("trace").textContent = JSON.stringify({ trace: result.trace, evidence }, null, 2);
    updateMatch();
  } catch (error) {
    el("trace").textContent = formatErr(error);
    el("big-digit").textContent = "✖";
    el("big-digit").className = "big-digit fail";
  }
});

el("btn-attack").addEventListener("click", async () => {
  try {
    const tampered = new Uint8Array(pkgWasm);
    tampered[Math.min(64, tampered.length - 1)] ^= 0xff;
    const attackHost = new ExactModelBrowserHost([PIN], {
      trustedPublicKeysHex: [TRUSTED_PUBLIC_KEY_HEX],
    });
    await attackHost.registerPackage(pkgManifest, tampered, pkgSig);
    el("trace").textContent = "UNEXPECTED: tampered package registered";
    el("big-digit").textContent = "‽";
    el("big-digit").className = "big-digit fail";
  } catch (error) {
    el("big-digit").textContent = "✖";
    el("big-digit").className = "big-digit fail";
    el("trace").textContent = JSON.stringify(
      {
        event: "attack_tamper_wasm",
        fail_closed: true,
        ...errFields(error),
        story: "Agent swapped one WASM byte. Host fail-closed with digest_mismatch.",
        also_see: "MCP transcript attacks: empty_trust → key_untrusted, rights_lie → rights_mismatch",
      },
      null,
      2,
    );
    el("browser-panel").textContent = JSON.stringify(
      { status: "attack_blocked", ...errFields(error) },
      null,
      2,
    );
  }
});

el("btn-refresh").addEventListener("click", async () => {
  try {
    const ts = Date.now();
    const [n, m] = await Promise.all([
      fetch("/proof/node-host.json?ts=" + ts).then((r) => (r.ok ? r.json() : null)),
      fetch("/proof/mcp-agent.json?ts=" + ts).then((r) => (r.ok ? r.json() : null)),
    ]);
    nodeProof = n;
    mcpProof = m;
    renderNodePanel();
    renderMcpPanel();
  } catch {
    el("node-panel").textContent = "Failed to load proofs";
  }
});

function errFields(error) {
  return {
    name: error?.name,
    code: error instanceof ExactModelError ? error.code : undefined,
    reason: error instanceof ExactModelError ? error.reason : undefined,
    message: String(error?.message || error),
  };
}

function formatErr(error) {
  return JSON.stringify(errFields(error), null, 2);
}

drawGrid();
loadAssets().catch((e) => {
  el("pin-panel").textContent = String(e);
});
