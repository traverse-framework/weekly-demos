// Spec 104 guest host for ONE WASI-command capability: stdin = input JSON,
// stdout = output JSON, plus `traverse_host.connector_invoke`.
// The connector checks mirror traverse-runtime 0.15.0 executor/wasm.rs
// (declared -> activated -> semver-compatible -> 64 KiB bounds -> no host-private data).
// WHY THIS EXISTS: published runtime.wasm (a254c161, nested wasmi) does not link
// connector_invoke, so BundleEmbedder@0.15.0 cannot instantiate model.execute@1.0.0
// (see proof/bundle-embedder-probe.json). This is demo glue, labelled as such.
const ERR = { INVALID: -1, UNBOUND: -2, UNDECLARED: -3, UNAUTHORIZED: -4, TOO_LARGE: -5, FAILED: -6 };
const MAX = 64 * 1024;
const caretOk = (req, ver) => { const [a, b, c] = req.replace(/^[\^=~]/, "").split(".").map(Number), [x, y, z] = ver.split(".").map(Number);
  return x === a && (y > b || (y === b && z >= c)); }; // cargo default req "2.3.0" == ^2.3.0
function hostPrivate(v) {
  if (Array.isArray(v)) return v.some(hostPrivate);
  if (v && typeof v === "object") return Object.entries(v).some(([k, x]) => ["config", "credential", "secret", "password", "path", "device", "endpoint", "bucket"].some((n) => k.toLowerCase().includes(n)) || hostPrivate(x));
  if (typeof v === "string") return v.startsWith("/") || v.includes("://");
  return false;
}
/**
 * @param wasm Uint8Array capability bytes
 * @param input JSON value (stdin)
 * @param ctx { declared: [{connector_id, version}], activated: [{connector_id, version, invoke(req)=>Promise<resp>}] } | null
 */
export async function runCapability(wasm, input, ctx) {
  const stdin = new TextEncoder().encode(JSON.stringify(input)); let off = 0; const stdout = []; const evidence = [];
  let mem; const u8 = () => new Uint8Array(mem.buffer); const dv = () => new DataView(mem.buffer);
  const imports = {
    wasi_snapshot_preview1: {
      fd_read(fd, iovs, n, nread) { let t = 0; for (let i = 0; i < n; i++) { const p = dv().getUint32(iovs + i * 8, true), l = dv().getUint32(iovs + i * 8 + 4, true);
          const k = Math.min(l, stdin.length - off); u8().set(stdin.subarray(off, off + k), p); off += k; t += k; if (k < l) break; } dv().setUint32(nread, t, true); return 0; },
      fd_write(fd, iovs, n, nw) { let t = 0; for (let i = 0; i < n; i++) { const p = dv().getUint32(iovs + i * 8, true), l = dv().getUint32(iovs + i * 8 + 4, true);
          if (fd === 1) stdout.push(u8().slice(p, p + l)); t += l; } dv().setUint32(nw, t, true); return 0; },
    },
    traverse_host: {
      connector_invoke(rp, rl, op, cap) {
        if (rp < 0 || rl < 0 || op < 0 || cap < 0 || rl > MAX || cap > MAX) return ERR.INVALID;
        let req; try { req = JSON.parse(new TextDecoder().decode(u8().slice(rp, rp + rl))); } catch { return ERR.INVALID; }
        const fail = (cls, code, ver = null) => { evidence.push({ connector_id: req.connector_id, resolved_version: ver, result_class: "failure", failure_class: cls }); return code; };
        if (!ctx) return fail("unbound", ERR.UNBOUND);
        if (!ctx.declared.some((d) => d.connector_id === req.connector_id)) return fail("undeclared", ERR.UNDECLARED);
        const c = ctx.activated.find((a) => a.connector_id === req.connector_id); if (!c) return fail("unbound", ERR.UNBOUND);
        if (!ctx.declared.filter((d) => d.connector_id === req.connector_id).some((d) => caretOk(d.version, c.version))) return fail("incompatible", ERR.UNAUTHORIZED, c.version);
        let resp; try { resp = c.invoke(req); } catch (e) {
          if (e?.deferred) { evidence.push({ connector_id: req.connector_id, resolved_version: c.version, result_class: "deferred", failure_class: null, request: req }); return ERR.FAILED; }
          return fail("execution_failed", ERR.FAILED, c.version); }
        if (resp.abi_version !== "1.0.0" || !resp.result_class || hostPrivate(resp.payload)) return fail("unauthorized_output", ERR.UNAUTHORIZED, c.version);
        const bytes = new TextEncoder().encode(JSON.stringify(resp)); if (bytes.length > cap) return fail("bounded_io", ERR.TOO_LARGE, c.version);
        u8().set(bytes, op); evidence.push({ connector_id: req.connector_id, resolved_version: c.version, result_class: resp.result_class, failure_class: null, request: req });
        return bytes.length;
      },
    },
  };
  const { instance } = await WebAssembly.instantiate(wasm, imports); mem = instance.exports.memory; instance.exports._start();
  const text = new TextDecoder().decode(new Uint8Array(stdout.flatMap((b) => [...b])));
  return { stdout: text, output: JSON.parse(text), connector_evidence: evidence };
}
