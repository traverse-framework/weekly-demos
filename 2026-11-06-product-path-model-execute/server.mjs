#!/usr/bin/env node
/**
 * Server for 2026-11-06-product-path-model-execute.
 * Serves public UI, app bundle (runtime.wasm), npm package dist, published fixtures, proof JSON.
 * POST /api/node re-runs Node proof; POST /api/browser-proof saves browser results.
 */
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 8779);

const routes = [
  { prefix: "/pkg/", root: join(root, "node_modules/traverse-embedder-web/dist") },
  { prefix: "/bundle/", root: join(root, "bundle") },
  { prefix: "/published/", root: join(root, "published") },
  { prefix: "/hosts/", root: join(root, "hosts") },
  { prefix: "/proof/", root: join(root, "proof") },
  { prefix: "/docs/", root: join(root, "docs") },
];

const server = createServer(async (req, res) => {
  try {
    const requestPath = req.url?.split("?")[0] ?? "/";
    if (requestPath === "/api/node" && req.method === "POST") {
      const r = spawnSync(process.execPath, [join(root, "hosts/node-run.mjs")], {
        cwd: root,
        encoding: "utf8",
        timeout: 120_000,
      });
      if (r.status !== 0) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: r.stderr || r.stdout || "node-run failed" }));
        return;
      }
      spawnSync(process.execPath, [join(root, "hosts/digest-match.mjs")], { cwd: root, encoding: "utf8" });
      const body = {
        node: JSON.parse(await readFile(join(root, "proof/node.json"), "utf8")),
        match: existsSync(join(root, "proof/digest-match.json"))
          ? JSON.parse(await readFile(join(root, "proof/digest-match.json"), "utf8"))
          : null,
      };
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(body));
      return;
    }
    if (requestPath === "/api/browser-proof" && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      await mkdir(join(root, "proof"), { recursive: true });
      await writeFile(join(root, "proof/browser.json"), Buffer.concat(chunks));
      spawnSync(process.execPath, [join(root, "hosts/digest-match.mjs")], { cwd: root, encoding: "utf8" });
      res.writeHead(204).end();
      return;
    }
    if (requestPath === "/api/status") {
      const status = {
        demo: "2026-11-06-product-path-model-execute",
        port,
        published: "Traverse v0.16.2",
        npm: "traverse-embedder-web@0.16.2",
        runtime_wasm: "b313b5c5c11291d9e9669125a0a9a77aa42a911b15d431a73e86b17c874e298c",
        has_node_proof: existsSync(join(root, "proof/node.json")),
        has_browser_proof: existsSync(join(root, "proof/browser.json")),
        has_match: existsSync(join(root, "proof/digest-match.json")),
      };
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(status, null, 2));
      return;
    }
    for (const route of routes) {
      if (requestPath.startsWith(route.prefix)) {
        const relative = normalize(requestPath.slice(route.prefix.length))
          .replace(/^([.][.][/\\])+/, "")
          .replace(/^\/+/, "");
        await send(res, join(route.root, relative));
        return;
      }
    }
    const relative = requestPath === "/" ? "index.html" : normalize(requestPath).replace(/^\/+/, "");
    await send(res, join(root, "public", relative));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(String(error?.stack ?? error));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`2026-11-06-product-path-model-execute on http://127.0.0.1:${port}`);
  console.log(`product path: BundleEmbedder + activateMediatedConnector + submitAsync · traverse-embedder-web@0.16.2 · runtime-wasm-v0.16.2`);
});

async function send(res, filePath) {
  try {
    const contents = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", typeFor(filePath));
    // COOP/COEP not required; wasm needs correct MIME
    res.end(contents);
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(`Not found: ${filePath}`);
  }
}

function typeFor(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".sha256":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
