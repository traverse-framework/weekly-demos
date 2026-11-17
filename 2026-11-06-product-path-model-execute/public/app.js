import { FetchBundleLoader } from "traverse-embedder-web";
import { runScenarios } from "/hosts/core.mjs";

const $ = (id) => document.getElementById(id);
const status = (msg) => { $("status").textContent = msg; };

const EXPECTED = {
  success: { kind: "ok" },
  connector_unavailable: { reason: "connector_unavailable" },
  usage_undeclared: { code: "model_unavailable" },
  key_untrusted: { code: "model_unavailable" },
  pin_mismatch: { reason: "pin_mismatch" },
  digest_mismatch: { code: "model_unavailable" },
  package_revoked: { reason: "package_revoked" },
};

function summarize(proof) {
  if (!proof?.results) return "no proof";
  return proof.results
    .map((r) => {
      const out = r.output;
      let tag = "—";
      if (r.name === "success" && out?.status === "ok") tag = `ok frame=${(r.output_frame_hex || "").slice(0, 16)}…`;
      else if (out?.reason) tag = out.reason;
      else if (out?.error?.reason) tag = out.error.reason;
      else if (out?.error?.code) tag = out.error.code;
      else if (r.registration_reason) tag = `reg:${r.registration_reason}`;
      return `${r.name}: ${tag}`;
    })
    .join("\n");
}

function renderFreestyle(proof) {
  if (!proof?.results) return "<p class='muted'>waiting…</p>";
  const rows = proof.results
    .filter((r) => r.name !== "success")
    .map((r) => {
      const out = r.output || {};
      const reason = out.reason || out.error?.reason || out.error?.code || r.registration_reason || "?";
      return `<tr><td><code>${r.name}</code></td><td><span class="pill p-deny">${reason}</span></td><td class="mono">${r.registration_reason ?? "—"}</td></tr>`;
    })
    .join("");
  return `<table><thead><tr><th>Attempt</th><th>Refused</th><th>Registration</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTruth(browser, node, match) {
  if (!browser && !node) return "<p class='muted'>waiting…</p>";
  const parts = [];
  if (browser && node) {
    const ok = match?.all_identical;
    parts.push(
      `<p><span class="pill ${ok ? "p-ok" : "p-deny"}">${ok ? "all_identical: true" : "MISMATCH"}</span> Browser ↔ Node on ${match?.hosts_compared?.join(" + ") || "hosts"}.</p>`,
    );
  }
  const success = (browser || node)?.results?.find((r) => r.name === "success");
  if (success?.output?.status === "ok") {
    parts.push(
      `<p class="allow">success → <code>status: ok</code> + <code>model_evidence</code>; frame <code class="mono">${(success.output_frame_hex || "").slice(0, 32)}…</code></p>`,
    );
  }
  if (match?.digests) {
    parts.push(
      `<pre class="mini mono">${Object.entries(match.digests)
        .map(([k, v]) => `${k}\n  ${v}`)
        .join("\n")}</pre>`,
    );
  }
  return parts.join("") || "<p class='muted'>partial</p>";
}

async function runBrowser() {
  status("Browser running scenarios…");
  $("card-browser").classList.add("active");
  try {
    const results = await runScenarios({
      read: async (path) => {
        const response = await fetch(`/${path}`);
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        return new Uint8Array(await response.arrayBuffer());
      },
      loader: new FetchBundleLoader(),
      manifestPath: "/bundle/app.manifest.json",
      platform: "web",
    });
    const proof = {
      host: `browser: ${navigator.userAgent}`,
      product_path: "BundleEmbedder.init + activateMediatedConnector(exactModelMediatedConnector) + submitAsync",
      npm: "traverse-embedder-web@0.16.2",
      runtime_wasm: "runtime-wasm-v0.16.2 (sha256:b313b5c5…)",
      catalog_ref: "model/model.execute@1.0.0",
      results,
    };
    $("col-browser").textContent = summarize(proof);
    await fetch("/api/browser-proof", { method: "POST", body: JSON.stringify(proof, null, 2) });
    status("Browser proof saved.");
    return proof;
  } catch (error) {
    $("col-browser").textContent = `FAILED ${error?.stack ?? error}`;
    status("Browser failed.");
    throw error;
  } finally {
    $("card-browser").classList.remove("active");
  }
}

async function runNode() {
  status("Node re-running…");
  $("card-node").classList.add("active");
  try {
    const response = await fetch("/api/node", { method: "POST" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "node failed");
    $("col-node").textContent = summarize(body.node);
    status("Node proof ready.");
    return body;
  } catch (error) {
    $("col-node").textContent = `FAILED ${error?.stack ?? error}`;
    status("Node failed.");
    throw error;
  } finally {
    $("card-node").classList.remove("active");
  }
}

async function refreshFromDisk() {
  const [node, browser, match, statusJson] = await Promise.all([
    fetch("/proof/node.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch("/proof/browser.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch("/proof/digest-match.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch("/api/status").then((r) => r.json()),
  ]);
  if (node) $("col-node").textContent = summarize(node);
  if (browser) $("col-browser").textContent = summarize(browser);
  $("truth").innerHTML = renderTruth(browser, node, match);
  $("freestyle").innerHTML = renderFreestyle(browser || node);
  $("pins").textContent = JSON.stringify(
    {
      traverse: "v0.16.2",
      npm: "traverse-embedder-web@0.16.2",
      runtime_wasm: statusJson.runtime_wasm,
      catalog_caps: 234,
      catalog_sha256: "13cc8f84d29210e2163d74ed81c8534962fcc0912eccbddb922e3a6550f4f5cb",
      model_execute_wasm: "5ccfa3721db61b42a598d703c2a110c57beaf57cde26e1c5cb7f9c5fbc8b4275",
      model_wasm: "954ca59b005699efcd126cde69446c7a935bfccd9561dd248ddd844246ea10a9",
      package_digest: "a7a8aa35c79ed38e7e2646d1b4f531e5d3167949ac8bd3e4efc8bfd678b901d2",
    },
    null,
    2,
  );
  return { node, browser, match };
}

$("btn-browser").onclick = async () => {
  await runBrowser();
  await refreshFromDisk();
};
$("btn-node").onclick = async () => {
  await runNode();
  await refreshFromDisk();
};
$("btn-both").onclick = async () => {
  await runNode();
  await runBrowser();
  await refreshFromDisk();
};

await refreshFromDisk();
if (location.hash === "#auto") {
  await runNode();
  await runBrowser();
  await refreshFromDisk();
}
