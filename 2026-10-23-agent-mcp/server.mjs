#!/usr/bin/env node
/**
 * Server for 2026-10-23-agent-mcp (static + live /api/hosts).
 * Serves: page assets, app bundle (incl. runtime.wasm), npm package dist,
 * and proof/ JSON for the digest panel.
 * Not traverse-cli serve — no sidecar.
 */
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const pkgDist = join(root, "node_modules/traverse-embedder-web/dist");
const bundleRoot = join(root, "bundle");
const publicRoot = join(root, "public");
const proofRoot = join(root, "proof");
const port = Number(process.env.PORT || 8777);

const routes = [
  { prefix: "/pkg/", root: pkgDist },
  { prefix: "/bundle/", root: bundleRoot },
  { prefix: "/proof/", root: proofRoot },
  { prefix: "/hosts/", root: join(root, "hosts") },
];

const server = createServer(async (req, res) => {
  try {
    const requestPath = req.url?.split("?")[0] ?? "/";
    if (requestPath === "/api/hosts" && req.method === "POST") {
      // Live: Node embedder (caller bytes + sorted keys) and the real traverse-mcp binary.
      const r = spawnSync(process.execPath, [join(root, "hosts/digest-match.mjs")], { cwd: root, encoding: "utf8" });
      const body = r.status !== 0 ? { error: r.stderr || r.stdout } : {
        node: JSON.parse(await readFile(join(proofRoot, "node-host.json"), "utf8")),
        agent: JSON.parse(await readFile(join(proofRoot, "agent-mcp.json"), "utf8")),
        match: JSON.parse(await readFile(join(proofRoot, "digest-match.json"), "utf8")),
      };
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(body));
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
    await send(res, join(publicRoot, relative));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(String(error));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`2026-10-23-agent-mcp on http://127.0.0.1:${port}`);
  console.log(`host: browser+node traverse-embedder-web@0.15.0, agent traverse-mcp 0.15.0 Mode A`);
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
