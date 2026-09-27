# Overnight packet — Planner A3 (non-timetable UI/UX) — 2026-09-27 22:00 +08 → 2026-09-28 07:00 +08

Issued by Lane C (overnight manager). **Operator authorization, in chat with Lane C, 2026-09-27; live data is test
data.** The operator is asleep: nobody will answer a question tonight. Where this packet says decide, decide, record
why in your handoff, and keep going. Stop only at a real blocker, recorded as `BLOCKED(<reason>)` with evidence.

## Authority

- **Standing HIGH authorization** (`live-state.md` → Operator decisions, 2026-09-20), **with every gate retained**
  (one executor per candidate, fresh independent QA, labelled browser rows, real tally).
- Ordinary UI mutations for acceptance rows are allowed. You do not generate or publish timetables (A2's surface).
- **You do not deploy tonight. A2 owns every release** and ships what you have integrated on `origin/main`. When your
  last integration lands, post `A3 integrated for release at <sha>` in `docs/handoffs/lane-a-to-c.md` — **by 04:30 +08**
  if you want it in the night's second release — and list in your handoff the rows needing live acceptance, with exact
  steps, so A2's browser pass can run them.
- Out of bounds: timetable surfaces (see your handoff → Ownership boundary), EnrollPro/SMART/AIMS writes,
  credentials/tokens, history rewrites.

## Coordination

- **Browser custody, one agent per profile (§12):** before any browser session create `E:/ATLAS-worktrees/.browser-lock`
  containing `A3 <ISO time> <purpose>`. If it names A2 and is younger than 45 min, do other work and retry. Delete it
  when done; older than 45 min is stale — overwrite and say so.
- Loopback builds from your worktree are allowed for pre-integration evidence, labelled as isolated checks; Tailnet
  evidence only proves what is deployed.
- Your owed decision ("deploy `c4a9960e` as staged vs re-pin to `main`") is **superseded**: `c4a9960e` is an ancestor
  of live `9b28c572`, and A2 releases `16961054` tonight. Record that and close it.

## Queue, in order — each item ends integrated on `main` with its QA verdict, or `BLOCKED` with evidence

**1. Close your ledger** (`planner-a3-non-timetable-ui-ux-handoff.md` → Current finding ledger): 01 and 02 get their
preservation controls; 14, 16, 23, 24 get their browser rows (you run your own browser QA; set 1366x768 where the row
needs it). 08 stays `BLOCKED_PRODUCT_DECISION` — write the two options in ≤ 3 lines each for the morning; 27, 28, 34
stay `BLOCKED_SOURCE_GAP`.

**2. Lane C findings on your surfaces:**
- **#53** — every room utilisation reads "0%" on the campus map tile and in Building view, and an unlabelled "50%"
  appears. Wire the real value from the published run, or remove the number until it is real. A fabricated number on a
  screen the operator will present is the worst outcome.
- **#52** — Building view's first render from More kept the previous section's class grid.
- Inventory rows 249/250 — `Empty floor` vs `Empty` on one screen; pick one word.
- Row 40 if A2 hands it to you (`/faculty/concerns` shows the class grid under "Teacher Concerns").

**3. Whole-site cohesion (objective: SMART-family calm, task-first identity), non-timetable routes:** `UX-R02`–`UX-R05`
and the non-timetable part of `UX-R03c` (`/setup`, `/exports` sub-pages and chrome overrides) from `live-state.md` →
Open items. Audit each route live first (Tailnet, your profile), grade it for older, mouse-first schedulers (word count,
one verb per action, a visual cue beside every status, less is more), then fix in consolidated streams as in S1–S3.

**4. Debt:** `uxc01-derived-setup-surface.test.ts` 1-of-4 red; the double policy fetch only if its owner is on your side.

Keep going until 06:30 +08, then write the handoff.

## Deliverables (Lane C reads these when your run ends)

1. Your handoff's ledger with every row terminal or explicitly blocked, plus a dated section "2026-09-28 overnight":
   candidate and merge SHAs, QA verdicts + tallies, browser evidence paths, rows for live acceptance (exact steps).
2. `docs/plans/live-state.md` Lane A3 section updated and dated.
3. The `A3 integrated for release at <sha>` line in `docs/handoffs/lane-a-to-c.md`.
4. Everything pushed to `origin/main`.

Your final message: ≤ 15 lines — done / blocked / not reached, last integrated SHA, handoff path.
