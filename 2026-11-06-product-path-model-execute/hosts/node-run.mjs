import { readFile, writeFile, mkdir } from "node:fs/promises";
import { NodeFsBundleLoader } from "traverse-embedder-web";
import { runScenarios } from "./core.mjs";

await mkdir("proof", { recursive: true });
const results = await runScenarios({
  read: async (path) => new Uint8Array(await readFile(path)),
  loader: new NodeFsBundleLoader(),
  manifestPath: "bundle/app.manifest.json",
  platform: "web",
});
const proof = {
  host: `node ${process.version}`,
  product_path: "BundleEmbedder.init + activateMediatedConnector(exactModelMediatedConnector) + submitAsync",
  npm: "traverse-embedder-web@0.16.2",
  runtime_wasm: "runtime-wasm-v0.16.2 (sha256:b313b5c5…)",
  catalog_ref: "model/model.execute@1.0.0",
  results,
};
await writeFile("proof/node.json", JSON.stringify(proof, null, 2));
console.log(results.map((r) => `${r.name}: reg=${r.registration_reason} status=${r.submit_status} ${JSON.stringify(r.output)?.slice(0, 120)}`).join("\n"));
