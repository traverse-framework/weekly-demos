import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BundleEmbedder,
  NodeFsBundleLoader,
} from "traverse-embedder-web";

const root = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(root, "bundle", "app.manifest.json");

const TREASURY_POLICY = {
  version: "payments-treasury-v3.2",
  mode: "hybrid",
  default_effect: "deny",
  rules: [
    {
      id: "junior-view-draft",
      effect: "allow",
      priority: 50,
      principal: { roles: ["junior_analyst"] },
      action: ["payments.view", "payments.create_draft"],
      resource: { type: "payment" },
    },
    {
      id: "treasury-transfer",
      effect: "allow",
      priority: 100,
      principal: { roles: ["treasury_ops"] },
      action: ["payments.transfer"],
      resource: { type: "payment" },
      obligations: [
        { type: "require_mfa", severity: "required" },
        { type: "dual_control", severity: "required", metadata: { threshold_usd: 100000 } },
      ],
    },
  ],
};

const cheat = {
  principal: {
    id: "user-maya-chen",
    roles: ["junior_analyst"],
    attributes: { tenant_id: "acme-fin", title: "Junior Analyst" },
    groups: [],
  },
  action: "payments.transfer",
  resource: {
    type: "payment",
    id: "wire-88421",
    attributes: { amount_usd: 2400000, currency: "USD", beneficiary: "offshore-vendor-llc" },
    owner_id: "treasury-desk",
  },
  context: {
    request_time: "2026-09-13T16:00:00Z",
    channel: "agent-ops",
    agent_id: "atlas-ops-v4",
  },
  policy: TREASURY_POLICY,
};

const events = [];
const embedder = await BundleEmbedder.init({
  manifestPath,
  loader: new NodeFsBundleLoader(),
  platform: "web",
});
embedder.subscribe((e) => events.push(e));
console.log("init ok evidence keys", Object.keys(embedder.releaseEvidence()));
console.log("runtime", JSON.stringify(embedder.releaseEvidence().runtime, null, 2));

const outcome = embedder.submit("core.authorize", cheat);
console.log("submit outcome", outcome);

// wait briefly for async? submit appears sync from API
await new Promise((r) => setTimeout(r, 50));
for (const e of events) {
  console.log("EVENT", e.event_type, JSON.stringify(e.data)?.slice(0, 400));
}
embedder.shutdown();
