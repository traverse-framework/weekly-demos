// Node host: published npm traverse-embedder-web@0.15.0 (ExactModelBrowserHost) + catalog model.execute@1.0.0 bytes.
import { readFile, writeFile } from "node:fs/promises"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { ExactModelBrowserHost, modelSigningKeyId } from "traverse-embedder-web";
import { runDemo } from "../lib/demo.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = async (p) => new Uint8Array(await readFile(path.join(root, p)));
const out = await runDemo({ ExactModelBrowserHost, modelSigningKeyId, load, label: `node ${process.version}` });
await writeFile(path.join(root, "proof/node.json"), JSON.stringify(out, null, 2));
console.log("capability digest matches catalog:", out.digests.capability_matches_catalog, "contract:", out.digests.contract_matches_catalog);
for (const c of out.cases) console.log(`${c.name}: predicted ${c.predicted} conformance=${c.matches_native_conformance_vector} passes=${c.passes} replay_identical=${c.replay_request_identical} ${c.ms}ms`);
for (const a of out.attempts) console.log(`[${a.layer}] ${a.title}: ${a.status} ${a.reason ?? ""} model_ran=${a.model_ran} calls=${a.connector_calls}`);
console.log("fingerprint", out.fingerprint, out.ms + "ms");
