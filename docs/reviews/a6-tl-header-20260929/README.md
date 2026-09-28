# A6 c4 — Teaching Load header: before/after rendered evidence (isolated loopback, 2026-09-29)

**Venue.** `vite dev` on `http://127.0.0.1:5399` serving a **temporary, untracked** harness
(`atlas-client/a6-header-harness.html` + `atlas-client/src/a6-header-harness.tsx`) that mounts the **real**
`WorkspaceToolbar` and the **real** `TeachingLoadRepairQueue` with the props `src/pages/TeachingLoad.tsx` passes
(quoted from `__tests__/a6-tl-header-budget.test.ts`, which itself quotes the page), inside the route's own
`h-[calc(100svh-3.5rem)]` shell. Both harness files were **deleted** after the captures (AGENTS.md §2).

**This is `isolated` loopback evidence, NOT ATLAS acceptance.** No session, no live data, no Tailnet origin. It
proves the header *renders*; it does not prove a deployed build. Live/staging acceptance stays owed to Lane C
after A4 ships.

**Browser.** Playwright MCP, headless, one browser per run. No console errors other than a `favicon.ico` 404 from
the harness document.

**Before** = `ce1257c8` (`origin/main` at packet issue) `WorkspaceToolbar.tsx` + `TeachingLoadRepairQueue.tsx`
checked out over the candidate, captured, then restored. Restoration proven: `git status --short` empty and
`TeachingLoadRepairQueue.tsx` SHA-256 `DE6FD485290D0CA6A98E01F1F853597A37E4B177C9194F9C887C599166CEF0C7` —
the same digest the QA round recorded after its own byte-restoration.

## 1. Degraded (EnrollPro unreachable) at 1366x768 — the operator's state

`01-before-degraded-1366x768.png` → `02-after-degraded-1366x768.png`

Before, row 2 carried **three** separately-toned status surfaces plus a clipped button:

1. amber `Using the last saved data — ATLAS is offline`
2. green `Next step · Teaching Load not verified · Unverified — EnrollPro is not reachable, so this figure is withheld.`
3. amber `Read-only: verify the source first`
4. primary action truncated on screen: **`Review staff work…`**

After, the same row carries **two** surfaces and the action reads in full:

1. amber `Using the last saved data — ATLAS is offline`
2. `Next step · Teaching Load not verified · Unverified — EnrollPro is not reachable, so this figure is withheld. · Read-only: verify the source first`
3. primary action in full: **`Review staff workload`**

The read-only reason moved from its own amber surface into the next step's own text, so it kept its
`data-testid` and its visibility without being a second status band. The Lane C T5 finding ("two amber lines when
EnrollPro is unreachable") is closed **as rendered**.

## 2. Healthy at 1366x768 — the primary action was clipped before

`03-before-healthy-1366x768.png` → `04-after-healthy-1366x768.png`

Before: `Review subject co…` — the primary action's own label truncated at 1366. After: `Review subject coverage`,
in full. Row 1 is unchanged (title, tabs, one roster chip, `Saved`, Help, `Suggest assignments`, More).

## 3. Degraded at 1920x1080

`05-after-degraded-1920x1080.png` — same two-row structure, nothing wrapped, no ellipsis.

## What these rows do and do not decide

Decided by rendering: two rows, one primary action, no truncated label in either state at 1366x768, one amber
surface instead of two in the degraded state, no `…` anywhere on the strip.

Not decided here: the **full route** `/teaching-load` with real data, the pickers row, the `Load summary` dialog,
and every claim about a deployed build. Those remain deployment-acceptance rows for Lane C.
