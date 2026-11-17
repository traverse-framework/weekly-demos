#!/usr/bin/env node
/**
 * Server for 2026-11-13-kill-switch.
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
const port = Number(process.env.PORT || 8780);

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
    if (requestPath === "/api/browser-proof" && req.method === "POST") {
      const mode = new URL(req.url, "http://x").searchParams.get("mode") === "inline" ? "inline" : "worker";
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      await mkdir(join(root, "proof"), { recursive: true });
      await writeFile(join(root, `proof/browser-${mode}.json`), Buffer.concat(chunks));
      spawnSync(process.execPath, [join(root, "hosts/compare.mjs")], { cwd: root, encoding: "utf8" });
      res.writeHead(204).end();
      return;
    }
    if (requestPath === "/api/status") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ demo: "2026-11-13-kill-switch", port, npm: "traverse-embedder-web@0.17.0", runtime_wasm: "3f763665dabdbc239b49929cfec408d6503527a87bf856ebafb0a949b5c7754c" }, null, 2));
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

server.listen(port, process.env.HOST || "0.0.0.0", () => {
  console.log(`2026-11-13-kill-switch on http://127.0.0.1:${port}`);
  console.log(`kill switch: traverse-embedder-web@0.17.0 · runtime.wasm v0.17.0 3f763665`);
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
