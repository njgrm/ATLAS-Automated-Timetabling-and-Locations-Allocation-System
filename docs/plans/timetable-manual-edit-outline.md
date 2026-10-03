# Timetable — manual edit, drag & drop, and editing controls

**Status: OUTLINE ONLY. No code changed, no packet dispatched, no deployment.**
Written 2026-10-03 by Hermes for an overnight `goal` session on the ATLAS timetable editing surface.

Base at time of writing: `origin/main` = `70a07b02`. Live release: `e44d4925`.
Member input is the 88-row triage ledger (`MR-01`…`MR-88`), currently uncommitted in
`C:\Users\njgro\AppData\Local\Temp\atlas-triage-ledger.md`.

---

## 0. Read this first — three constraints that will otherwise waste the night

1. **A different planner owns Subjects right now.** Program-label work (BEC/SPS/SPA/STE revert)
   is in a worktree mid-merge. **Do not touch** `atlas-client/src/components/subjects/**`,
   `atlas-client/src/lib/deped-glossary.ts`, `atlas-client/src/components/sections/**`, or
   anything under `faculty-assignments/` naming those labels. Re-check `git fetch origin && git
   log --oneline -1 origin/main` before starting.

2. **Every user-facing fix needs rendered evidence before it counts as done.** `AGENTS.md` §11:
   "A user-facing fix is done when it is seen rendered." Six changes shipped yesterday on tests
   alone. The evidence tool now exists:

   ```bash
   node ops/qa/atlas-live-acceptance.mjs --route /timetable --name timetable --mobile
   node ops/qa/atlas-live-acceptance.mjs --all-known
   ```

   It asserts `window.location.origin`, waits 8s before asserting rendered state, records every
   non-GET as a write, and measures DOM geometry. **Do not trust a single sweep** — one run
   reported three scrollbar defects that two subsequent runs could not reproduce. Replicate any
   finding before acting on it.

3. **Batch the release.** Yesterday: three production cutovers in 90 minutes for chip labels.
   Assemble the train, pin target and rollback, then cut over once.

---

## 1. The surface, as it actually exists

**Server** — `atlas-server/src/routes/manual-edit.router.ts`, 8 endpoints:

| Line | Method | Purpose (confirm before relying) |
|---|---|---|
| 101, 128, 162, 189, 229, 280, 302 | POST | move / swap / assign / clear-classes style mutations |
| 259 | GET | read the editable run |

Also: `timetable-quick-place.router.ts` (quick placement), `timetable-unassigned.router.ts`
(unassigned queue), `timetable-collaboration.router.ts` (room-preference tickets — this one is
firing 2 POSTs on every page load and is untriaged).

**Client** — drag & drop spans 14 files. The ones that matter for this work:

- `components/timetable/ScheduleReviewWorkspace.tsx` — the workspace shell
- `components/timetable/TimetableGridDropContext.tsx` — drop-target geometry
- `components/timetable/TimetableDraggableEntry.tsx`, `TimetableDragOverlay.tsx` — the entry itself
- `components/timetable/DraggablePinWrappers.tsx` — pin wrappers
- `components/timetable/TimetableTaskDrawer.tsx` — per-task editing drawer
- `components/timetable/SimpleUnassignedQueueRow.tsx` — drag out of the unassigned queue
- `components/timetable/simple/SimplePastYearView.tsx` — past-year comparison
- `components/timetable/timetableWorkspaceTruth.ts` — the source-of-truth read this area uses

**Locked constraint:** `AGENTS.md` §7 timetable invariants — missing term identity never becomes
Term 1; one selected ordered term preserves subject/teacher/room and full weekly demand; published
output has zero HARD violations; every consumer proves parity from one source run.

---

## 2. Member asks on this surface, by priority

Source: triage ledger, `/timetable` rows only. Quote column is verbatim member text.

### Tier 1 — manual edit and drag/drop (the ask in the prompt)

| Row | Quote | Class | Status in source |
|---|---|---|---|
| **MR-17** | "-> also put EDIT (this is where the manual edit happens)" | NEW_FEATURE | `manual-edit.router.ts` exists; `SimpleHeaderStatusStrip.tsx:15` references an `Edit draft` control. **Locate the existing control before adding one** — §8 header budget is 2 rows. |
| **MR-49** | "Clicking the card body or the `[Edit assignments]` button unintentionally opens the `Review load` modal because the parent card container has an unhandled `onClick`" | BUG_DEFECT | Teaching Load, not the grid. Reproduce on live before building. |
| **MR-05** | "scheduler cannot access what the teacher administrator can do (example: scheduler cannot swap teachers to other sections or edit anything in assigning teaching load)" | AUTH_BOUNDARY | **Largely closed** — `d52f5355` added `requireCapability` to 5 routers / 34 mutating routes and is live. Verify what remains. |
| **MR-72** | "the last list items … are sliced in half and hidden directly underneath the footer action row" | BUG_DEFECT | Sections auto-assign dialog. Clipping under a sticky footer. |

### Tier 2 — grid cell semantics and colours

| Row | Quote | Status |
|---|---|---|
| **MR-14** | "Class Schedule Menu: -> green = occupied -> light red = conflict -> gray = available (room)" | SOURCE_GAP — no cell-state palette constant exists. Needs the hex values (see §4). |
| **MR-15** | "-> do not put warnings, if that slot is already reached its limit, automatic BLOCKED" | CONFLICTS_WITH_LOCKED_DECISION — collides with the publication model. **Do not auto-BLOCK.** |
| **MR-18** | "-> change color of HEALTH BREAK" | Already shipped (`ca761217`, dark pink band, `aria-label`, contrast-safe text). Verify, don't rebuild. |
| **MR-19/20** | "It is not obvious that it is clickable because of its color. Light gray is assumed to be unable to click." | Already shipped (`419c270b`, tab affordance). Verify. |

### Tier 3 — vocabulary (settled, do not reopen)

| Row | Quote | Decision |
|---|---|---|
| **MR-16** | "-> do not use DRAFT. All generated schedule should automatically SAVE" | **Operator decided: use EDIT and SAVE instead of Draft and Published.** Display vocabulary only; persisted values unchanged. Shipped as D1. |

---

## 3. Suggested packet order

Independent VISUAL/LOW first; MEDIUM cross-layer next; auth last. No two packets own the same
file. Each packet must land its rendered evidence before the next begins.

- **T1 — EDIT control (VISUAL).** Find the existing `Edit draft` control referenced at
  `SimpleHeaderStatusStrip.tsx:15`, confirm whether it reaches the manual-edit surface, and either
  make it reachable within the 2-row header budget or record that it already is. **Verify-and-close
  first; build only if genuinely absent.**
- **T2 — Drag/drop affordance + cell states (VISUAL→MEDIUM).** One packet: the drag overlay, drop
  target feedback, and the occupied/conflict/available palette from MR-14. Cannot start until the
  hex values are answered (§4).
- **T3 — Sticky-footer clipping (BUG_DEFECT, MEDIUM).** MR-72. Reproduce on live first; a footer
  that hides the last rows is a data-visibility defect, not styling.
- **T4 — Manual-edit authority audit (AUTH, MEDIUM).** Verify `d52f5355`'s guards cover the swap
  path in `manual-edit.router.ts` and `timetable-quick-place.router.ts` specifically. Read-only
  unless a gap is proven.
- **T4b — Unassigned-queue drag (VISUAL/MEDIUM).** MR-76 unassigned panel. Overlaps Sections;
  hold until the other planner's merge lands.
- **T4c — Card click-handling (BUG_DEFECT).** MR-49. Teaching Load; separate worktree.

---

## 4. Blocked on operator answers — ask before the night gets long

These are the rows the ledger marks SOURCE_GAP. A `goal` session will otherwise burn hours
building something that cannot be verified.

1. **MR-14 hex values.** "green = occupied / light red = conflict / gray = available" — no
   palette constant exists. Give the three hex values, or say to derive them from the existing
   DepEd token map.
2. **MR-15.** Keep warnings, or convert to BLOCKED? This collides with the locked publication
   model; the ledger flags it CONFLICTS_WITH_LOCKED_DECISION.
3. **MR-17 placement.** The header budget is 2 rows at 1366x768. Does EDIT go in row 1, or
   behind `More`?
4. **MR-61 sort-header tooltips.** `fix-2.docx` states keep *and* remove as alternatives. Pick
   one.
5. **MR-10 / MR-13.** Is "Substitute" a roster status that exists in data, or a new one? Is
   "Loading button: with load / non load" the same filter as the department filter?
6. **MR-79** is a member *question*, not a request: "should we just remove browser room map". It
   needs an answer before anything is built.

---

## 5. Pre-flight for the overnight session

```bash
# 1. Sync and confirm what you are building on
git fetch origin --prune && git log --oneline -1 origin/main
cd D:/ATLAS && git worktree add E:/ATLAS-worktrees/lane-timetable-manual -b work/timetable-manual-edit origin/main

# 2. Fresh worktree needs its generated client or tsc fails
cd E:/ATLAS-worktrees/lane-timetable-manual/atlas-client && npm ci
npm exec -- prisma generate --schema ../prisma/schema.prisma

# 3. Evidence tool
node ops/qa/atlas-live-acceptance.mjs --route /timetable --name timetable --mobile
```

**Hard rules for the night:**

- Never `vite preview`, `npm run dev`, or `node dist/server.js` in the foreground. Background it,
  poll the port, kill it after.
- Never run DB-writing tests against live. `npm run test:server-db` only, disposable
  `atlas_restore_drill_*` databases.
- Never echo a credential, token, or a credential-bearing URL.
- One writer per worktree. Name the owner before dispatching.
- Give every long gate its own tool call. Yesterday a chained `npm run lint && npm run typecheck`
  exceeded a 420s ceiling and killed a subagent after 75 minutes of work.
- Replicate a finding before building on it. One sweep reported three defects that could not be
  reproduced.

---

## 6. What "done" means at the end of the night

- Each packet has a committed SHA on its own branch, with its tests wired into a committed
  `package.json` script.
- Each **user-facing** change has rendered before/after evidence from
  `ops/qa/atlas-live-acceptance.mjs`, committed under `docs/reviews/`.
- One batched train, pinned target and rollback, one cutover — not one per fix.
- Any row that could not be verified reported as `BLOCKED` with the reason, never as done.