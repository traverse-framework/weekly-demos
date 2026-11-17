import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

// published/catalog.json must be the MINIMAL catalog written by tools/minimal-catalog.mjs from
// catalog.allowlist. Refuse a full registry catalog so it can never be bundled or staged again.
const allow = readFileSync("catalog.allowlist", "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
const catalog = JSON.parse(readFileSync("published/catalog.json", "utf8"));
if (!catalog._minimal || !Array.isArray(catalog.capabilities)) throw new Error("published/catalog.json is not a minimal catalog; run: node tools/minimal-catalog.mjs --allowlist catalog.allowlist --out published/catalog.json");
const refs = catalog.capabilities.map((e) => e.reference);
if (refs.length !== allow.length || allow.some((r) => !refs.includes(r))) throw new Error(`published/catalog.json entries [${refs}] do not match catalog.allowlist [${allow}]`);
const entries = catalog.capabilities;
const entry = entries.find((e) => e.reference === "model/model.execute@1.0.0");
if (!entry) throw new Error("model/model.execute@1.0.0 is not in the minimal catalog (add it to catalog.allowlist)");
const wasm = readFileSync("bundle/components/model-execute/model-execute-agent.wasm");
const digest = `sha256:${createHash("sha256").update(wasm).digest("hex")}`;
const text = JSON.stringify(entry);
if (!text.includes(digest.slice(7))) throw new Error(`catalog entry does not name ${digest}`);
writeFileSync("bundle/components/model-execute/contract.json", JSON.stringify(entry.contract, null, 2));
const requirements = entry.contract.connector_requirements;
writeFileSync(
  "bundle/components/model-execute/component.manifest.json",
  JSON.stringify(
    {
      component_id: "catalog.model-execute",
      version: "1.0.0",
      schema_version: "1.0.0",
      capability_id: "model.execute",
      capability_version: "1.0.0",
      execution_mode: "wasm",
      contract_path: "contract.json",
      wasm_binary_path: "model-execute-agent.wasm",
      wasm_digest: digest,
      runtime_constraints: {},
      permitted_targets: ["local", "browser"],
      dependencies: [],
      connector_requirements: requirements,
      validation_evidence: [],
    },
    null,
    2,
  ),
);
writeFileSync(
  "bundle/app.manifest.json",
  JSON.stringify(
    {
      app_id: "weekly-kill-switch",
      version: "0.17.0",
      schema_version: "1.0.0",
      workspace_defaults: { workspace_id: "local-default", registry_scope: "private" },
      components: [
        {
          component_id: "catalog.model-execute",
          version: "1.0.0",
          digest,
          manifest_path: "components/model-execute/component.manifest.json",
        },
      ],
      workflows: [],
      model_dependencies: [],
      config_schema: {
        type: "object",
        required: ["workspace_id"],
        properties: { workspace_id: { type: "string" } },
        additionalProperties: false,
      },
      default_config: { workspace_id: "local-default" },
      placement_policy: { preferred_targets: ["browser"], allow_fallback: false },
      public_surfaces: ["http_json"],
    },
    null,
    2,
  ),
);
console.log("bundle ok", digest, JSON.stringify(requirements));
