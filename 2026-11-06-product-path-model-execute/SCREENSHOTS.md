# Screenshots — 2026-11-06 product-path-model-execute

This executor subagent has **no computerUse / CDP / Playwright**. Live browser screenshots were not captured here.

## Already generated (static from proof JSON)
- `docs/screenshots/01-proof-preview.svg` — scenario table + digests rendered from `proof/digest-match.json`
- `docs/screenshots/01-proof-preview.png` — rasterized via sharp

## Parent: capture live UI (computerUse)
1. Confirm server: `curl -s http://127.0.0.1:8779/api/status`
2. Open **http://127.0.0.1:8779/#auto** in the agent computer preview (or local browser).
3. Wait until both columns finish (Browser runs in-tab; Node via `/api/node`).
4. Save screenshots into `docs/screenshots/`:
   - `02-full-page-two-hosts.png` — full page after `#auto`
   - `03-success-and-freestyle.png` — truth + freestyle table
   - `04-pins-and-gaps.png` — pins + honest gaps cards
5. Re-run `node hosts/digest-match.mjs` after browser proof lands in `proof/browser.json` (posted by the UI).

## Enrico
Opens demos via agent computer preview on Prototype Builder's box (`127.0.0.1`), not Mac mini copy.
