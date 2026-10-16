// 127.0.0.1-only demo server. Static files + three tiny APIs that re-run the Node and Native hosts on demand.
import { execFile } from "node:child_process"; import { readFile, writeFile } from "node:fs/promises"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { serve } from "./lib/server-base.mjs";
const root = path.dirname(fileURLToPath(import.meta.url)); const PORT = Number(process.env.PORT ?? 8776);
const run = (cmd, args) => new Promise((res) => execFile(cmd, args, { cwd: root, maxBuffer: 64 << 20 }, (e, so, se) => res({ code: e?.code ?? 0, stdout: so, stderr: se })));
serve({ port: PORT, name: "catalog-model-execute", publicRoot: path.join(root, "public"),
  routes: { "/pkg/": path.join(root, "node_modules/traverse-embedder-web/dist"), "/lib/": path.join(root, "lib"), "/capability/": path.join(root, "capability"),
    "/package/": path.join(root, "package"), "/fixtures/": path.join(root, "fixtures"), "/proof/": path.join(root, "proof"), "/bundle/": path.join(root, "bundle"), "/docs/": path.join(root, "docs") },
  api: {
    "POST /api/node-run": async () => { const r = await run(process.execPath, ["hosts/node-run.mjs"]); return { code: r.code, log: r.stdout.slice(-4000), proof: JSON.parse(await readFile(path.join(root, "proof/node.json"), "utf8")) }; },
    "POST /api/native-run": async () => { const r = await run(path.join(root, "native-host/target/release/model-execute-native-host"), [root, path.join(root, "proof/scenarios.json")]);
      if (r.code === 0) await writeFile(path.join(root, "proof/native-mediated.json"), r.stdout); return { code: r.code, stderr: r.stderr.slice(-2000), proof: r.code === 0 ? JSON.parse(r.stdout) : null }; },
    "POST /api/browser-proof": async (body) => { await writeFile(path.join(root, `proof/${body.name}.json`), JSON.stringify(body.data, null, 2)); return { ok: true }; },
  } });
