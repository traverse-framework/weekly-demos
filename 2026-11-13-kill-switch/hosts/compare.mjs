// Compare outcome reasons + output frames across every proof file present.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const files = ["browser-worker", "deno-worker", "node-worker", "browser-inline", "deno-inline", "node-inline"].filter((f) => existsSync(`proof/${f}.json`));
const proofs = Object.fromEntries(files.map((f) => [f, JSON.parse(readFileSync(`proof/${f}.json`, "utf8"))]));
const names = proofs[files[0]]?.results.map((r) => r.name) ?? [];
const rows = names.map((name) => {
  const cells = Object.fromEntries(files.map((f) => { const r = proofs[f].results.find((x) => x.name === name); return [f, { reason: r?.reason, ms: r?.ms, frame_hex: r?.frame_hex ?? null }]; }));
  const frames = new Set(Object.values(cells).map((c) => c.frame_hex));
  const workerReasons = new Set(files.filter((f) => f.endsWith("worker")).map((f) => cells[f].reason));
  return { name, cells, frames_identical: frames.size === 1, worker_hosts_agree: workerReasons.size <= 1 };
});
const out = { generated_at: new Date().toISOString(), hosts: files,
  worker_hosts_identical: rows.every((r) => r.worker_hosts_agree) && rows.every((r) => r.frames_identical),
  frames_identical_all_hosts: rows.every((r) => r.frames_identical), rows,
  freeze_ms: Object.fromEntries(files.map((f) => [f, proofs[f].max_main_thread_gap_ms ?? null])) };
writeFileSync("proof/compare.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({ hosts: files, worker_hosts_identical: out.worker_hosts_identical, frames_identical_all_hosts: out.frames_identical_all_hosts }));
