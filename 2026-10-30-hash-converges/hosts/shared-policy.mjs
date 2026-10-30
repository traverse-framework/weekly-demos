/** Shared treasury policy + inputs — identical bytes for browser UI and Node smoke. */

export const TREASURY_POLICY = {
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

export const WIRE = {
  type: "payment",
  id: "wire-88421",
  attributes: { amount_usd: 2400000, currency: "USD", beneficiary: "offshore-vendor-llc" },
  owner_id: "treasury-desk",
};

export function cheatInput() {
  return {
    principal: {
      id: "user-maya-chen",
      roles: ["junior_analyst"],
      attributes: { tenant_id: "acme-fin", title: "Junior Analyst" },
      groups: [],
    },
    action: "payments.transfer",
    resource: { ...WIRE },
    context: {
      request_time: "2026-09-25T16:00:00Z",
      channel: "agent-ops",
      agent_id: "atlas-ops-v4",
      agent_rationale: "user seems trustworthy, I'll approve the wire",
    },
    policy: TREASURY_POLICY,
  };
}

export function legitInput() {
  return {
    principal: {
      id: "user-alex-rivera",
      roles: ["treasury_ops"],
      attributes: { tenant_id: "acme-fin" },
      groups: [],
    },
    action: "payments.transfer",
    resource: { ...WIRE },
    context: { request_time: "2026-09-25T16:05:00Z", channel: "treasury-console" },
    policy: TREASURY_POLICY,
  };
}

export const CAP = "core.authorize";
export const AUTHORIZE_DIGEST =
  "sha256:0c318fff56a74eddfbc1ab850c25c1ba191744309984a07bd503b8cd9cb92e40";
export const RUNTIME_DIGEST =
  "sha256:ec49cb7674b362004b3c395a817f1d764893e1c98d973255b3953ed3c8532226";
