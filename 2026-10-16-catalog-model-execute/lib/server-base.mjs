// Minimal static + tiny API server shared by the hf-proto-* prototypes. 127.0.0.1 only.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".wasm": "application/wasm", ".sha256": "text/plain; charset=utf-8",
  ".diff": "text/plain; charset=utf-8", ".log": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".wav": "audio/wav", ".png": "image/png", ".md": "text/plain; charset=utf-8" };
export function serve({ port, name, routes, publicRoot, api = {} }) {
  const server = createServer(async (req, res) => {
    try {
      const p = decodeURIComponent((req.url ?? "/").split("?")[0]);
      if (api[`${req.method} ${p}`]) {
        let body = "";
        for await (const c of req) { body += c; if (body.length > 8 << 20) throw new Error("body too large"); }
        const out = await api[`${req.method} ${p}`](body ? JSON.parse(body) : null);
        res.writeHead(200, { "Content-Type": TYPES[".json"], "Cache-Control": "no-store" });
        return res.end(JSON.stringify(out));
      }
      for (const [prefix, dir] of Object.entries(routes)) {
        if (p.startsWith(prefix)) return send(res, dir, p.slice(prefix.length));
      }
      return send(res, publicRoot, p === "/" ? "index.html" : p);
    } catch (e) { res.writeHead(500, { "Content-Type": "text/plain" }); res.end(String(e)); }
  });
  server.listen(port, "127.0.0.1", () => console.log(`${name} on http://127.0.0.1:${port}`));
  return server;
}
async function send(res, dir, rel) {
  const full = resolve(join(dir, normalize(rel).replace(/^(\.\.[/\\])+/, "")));
  if (!full.startsWith(resolve(dir))) { res.writeHead(403); return res.end("forbidden"); }
  try {
    const buf = await readFile(full);
    res.writeHead(200, { "Content-Type": TYPES[extname(full)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(buf);
  } catch { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("not found: " + rel); }
}
export { writeFile };
