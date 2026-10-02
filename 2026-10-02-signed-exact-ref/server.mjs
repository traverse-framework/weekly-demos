#!/usr/bin/env node
/**
 * Static file server for 2026-10-02-signed-exact-ref.
 * Serves: public UI, npm package dist, model package bytes, proof JSON.
 * Not traverse-cli serve — no sidecar.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const pkgDist = join(root, "node_modules/traverse-embedder-web/dist");
const publicRoot = join(root, "public");
const proofRoot = join(root, "proof");
const modelsRoot = join(root, "package/models");
const port = Number(process.env.PORT || 8771);

const routes = [
  { prefix: "/pkg/", root: pkgDist },
  { prefix: "/proof/", root: proofRoot },
  { prefix: "/models/", root: modelsRoot },
];

const server = createServer(async (req, res) => {
  try {
    const requestPath = req.url?.split("?")[0] ?? "/";
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
    await send(res, join(publicRoot, relative));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(String(error));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`signed-exact-ref on http://127.0.0.1:${port}`);
  console.log(`host: traverse-embedder-web@0.14.0 ExactModelBrowserHost · digits-mlp-1.0.0`);
});

async function send(res, filePath) {
  try {
    const contents = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", typeFor(filePath));
    res.setHeader("Cache-Control", "no-store");
    res.end(contents);
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(`Not found: ${filePath}`);
  }
}

function typeFor(filePath) {
  switch (extname(filePath)) {
    case ".html": return "text/html; charset=utf-8";
    case ".js":
    case ".mjs": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".wasm": return "application/wasm";
    case ".tes":
    case ".sha256": return "text/plain; charset=utf-8";
    default: return "application/octet-stream";
  }
}
