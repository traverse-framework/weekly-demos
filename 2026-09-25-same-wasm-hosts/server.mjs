#!/usr/bin/env node
/**
 * Static file server for 2026-09-25-same-wasm-hosts.
 * Serves: page assets, app bundle (incl. runtime.wasm), npm package dist,
 * and proof/ JSON for the digest panel.
 * Not traverse-cli serve — no sidecar.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const pkgDist = join(root, "node_modules/traverse-embedder-web/dist");
const bundleRoot = join(root, "bundle");
const publicRoot = join(root, "public");
const proofRoot = join(root, "proof");
const port = Number(process.env.PORT || 8770);

const routes = [
  { prefix: "/pkg/", root: pkgDist },
  { prefix: "/bundle/", root: bundleRoot },
  { prefix: "/proof/", root: proofRoot },
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
  console.log(`same-wasm-hosts on http://127.0.0.1:${port}`);
  console.log(`host: traverse-embedder-web@0.13.0 + bundle runtime.wasm (nested-wasmi, no hand WASI shim)`);
});

async function send(res, filePath) {
  try {
    const contents = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", typeFor(filePath));
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
    case ".sha256": return "text/plain; charset=utf-8";
    default: return "application/octet-stream";
  }
}
