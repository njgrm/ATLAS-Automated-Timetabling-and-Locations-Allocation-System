# TIMETABLE-TRUTHFULNESS-C01 — close the remaining recorded UX/UI residuals

**Status:** `READY`. **Risk:** MEDIUM (server + client source). **Owner:** Lane A.
**Base:** `origin/main` = `5ff8d80f37da792eff3f14fcee1960290b74b87f`; live release `d9a6aa53`.
**Executor worktree (provisioned — do not create another, do not clone):**
`E:\ATLAS-worktrees\timetable-truthfulness-c01`, branch `work/timetable-truthfulness-c01`, clean,
dependencies installed.

## 0. Why

The relaxed timetable and the header collapse shipped and were independently accepted. The operator
then asked for the **remaining recorded residuals** to be closed. Two of them are **truthfulness**
bugs — the class that produced a false continuity claim during this cycle — so they lead.

## 1. Deliverables

- **D1 — the runs list must expose publication state.** `GET /api/v1/generation/:schoolId/:schoolYearId/runs`
  omits `summary.isPublished`, so every run renders without a published marker. That omission caused a
  real false claim: "all COMPLETED" was mis-read as "none published" when two revisions (41, 42) were
  already live. Add the publication state to the **list projection** (at minimum `isPublished`, and the
  active published run identity if cheaply available). A consumer must be able to tell a published run
  from an unpublished one **from the list alone**. Add a failing-first control.
- **D2 — the dashboard readiness summary must not present raw soft violations as blockers.**
  `GET /api/v1/dashboard/readiness-summary` reports `generation.violationCount 334` (the raw stored
  count) in a field consumers read as blockers, while the canonical counts are **289 soft / 0 HARD**.
  Align it with the canonical report: HARD/blocking must be 0, soft must be labelled as soft, and the
  field must not be readable as a blocker count. Add a failing-first control that fails on the raw-334
  presentation.
- **D3 — `summary.publishedSoftViolationCount` must agree with the canonical list.** Stored 334 (run
  317) / 335 (run 316) versus canonical 289 / 284. Both are internally reproducible; decide which is
  authoritative, make the stored value agree with the canonical computation (or rename it so it cannot
  be read as the canonical count), and state the decision. Pre-existing in both runs.
- **D4 — the "Using cached school year" wording must not read as staleness.** In the header's source
  line, replace the wording with something honest and specific about what is cached and when it was
  verified (the underlying state is `enrollpro-verified`, `stale:false`). Keep it short — one line, no
  jargon, no raw codes.

## 2. Explicitly NOT in scope

- `TacticalSandboxDock` jargon — Advanced-only technical dock; the audit itself deferred it to UX-R04.
- The draft-tray swap modal (the Simple swap path is already inline) — a product decision.
- The two pre-existing over-cap components (`ManualEditPanel.tsx` 1012, `FacultyRoomPreferences.tsx`
  1007) — separate backlog.
- The 289 soft advisory violations themselves (faculty consecutive limits, building/floor transitions,
  idle gaps) — that is **scheduling quality**, not UI truthfulness, and needs its own cycle.

## 3. Boundaries — do not break

- Do not weaken the publication gate, ordered-term identity, actor-school scope, the strict publication
  predicate, or the scope-clear hygiene.
- Do not change published state: run #317 / revision 43 must remain the active publication.
- No migration, no schema change, no generation, no publication, no deployment, no live-data mutation.
- No `docs/**`, no `CHANGELOG.md`, no companion-repo edits.
- Every touched component ≤ **1000 physical lines** (`[IO.File]::ReadAllLines`); `@/ui` primitives only;
  no raw unstyled `<button>`, no `title`, no native `<select>`.
- Preserve everything accepted: one header row, grid top 139.6 px, one status region, one dominant
  primary, the published-state dominance, no document scrollbar at 1366×768 and 390×844, the 12 px
  floor, per-entry term labels, the draft surface, scroll restoration, the inline placement contract,
  no workspace remount.

## 4. Gates — run and paste literal results

1. `atlas-server`: `npm run test:server-suite` (record the tally).
2. `atlas-server`: `npm run test:server-db` — **add any new DB test file to that script**; disposable
   `DATABASE_URL` named `atlas_restore_drill_<yyyymmdd>_<suffix>` derived from
   `D:\ATLAS-runtime-config\atlas-server.env` by replacing only the database name — **never print that
   file or the URL**.
3. `atlas-server`: `npm run build` plus a real built-server load proof.
4. `atlas-client`: `npm run test:client-suite`; `npm run test:timetable-relaxed-main`; `npm run typecheck`;
   `npm run build` with `VITE_ENROLLPRO_URL='https://dev-jegs.buru-degree.ts.net'`.
5. `git diff --check`.
6. Any new/changed test file must be named by a **committed `package.json` script** in the same commit
   (the inverse reachability guards).
7. **A failing-first control for D1, D2 and D3** — each must fail on the pre-correction behaviour and
   pass after. Do not cite pre-existing tests.
8. **Fixtures from the real surface.** Prove the outcome, not the wiring — exercise the real route and
   assert the resulting payload.

## 5. Evidence to return (one page)

Base SHA · candidate SHA · exact changed paths · what changed per D1–D4 · the D3 authority decision and
its rationale · each failing-first control with its literal before/after · the gate results including
the server and client tallies · known risks each marked `BLOCKING`/`NON_BLOCKING` · verdict
`REVIEW_REQUIRED`. Additive commits only — never amend, rebase or push. Checkpoint early; do not leave
the worktree dirty.
