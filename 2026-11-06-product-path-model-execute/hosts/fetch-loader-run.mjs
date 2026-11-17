/**
 * HTTP bundle path the browser UI uses (absolute URLs under DEMO_BASE).
 * WASM still runs in Node — not Chromium. Open /#auto for a real browser proof.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { runScenarios } from "./core.mjs";

const base = (process.env.DEMO_BASE || "http://127.0.0.1:8779").replace(/\/$/, "");

class HttpBundleLoader {
  resolve(basePath, relativePath) {
    return new URL(relativePath, new URL(basePath, base + "/")).toString();
  }
  async loadBytes(path) {
    const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }
  async loadText(path) {
    return new TextDecoder().decode(await this.loadBytes(path));
  }
}

const results = await runScenarios({
  read: async (path) => {
    const response = await fetch(`${base}/${path}`);
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  },
  loader: new HttpBundleLoader(),
  manifestPath: "/bundle/app.manifest.json",
  platform: "web",
});
await mkdir("proof", { recursive: true });
const proof = {
  host: `http-bundle-loader under node ${process.version} via ${base}`,
  note: "Same HTTP bundle loading the browser UI uses; WASM still runs in Node, not Chromium. Parent: open http://127.0.0.1:8779/#auto for real browser proof + screenshots.",
  product_path: "BundleEmbedder.init + activateMediatedConnector(exactModelMediatedConnector) + submitAsync",
  npm: "traverse-embedder-web@0.16.2",
  runtime_wasm: "runtime-wasm-v0.16.2 (sha256:b313b5c5…)",
  catalog_ref: "model/model.execute@1.0.0",
  results,
};
await writeFile("proof/fetch-loader.json", JSON.stringify(proof, null, 2));
console.log(results.map((r) => `${r.name}: reg=${r.registration_reason} frame=${(r.output_frame_hex||"").slice(0,16)}`).join("\n"));
