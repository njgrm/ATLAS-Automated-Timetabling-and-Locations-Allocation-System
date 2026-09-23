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

## 6. Deployment (HIGH — executed 2026-09-23 under the operator's standing authorization, §13)

- **Target:** integrated `origin/main` = `7ac2812449984f7a21c5effb4b6e77c6dcedb2eb` (merge of
  `work/timetable-truthfulness-c01` tip `adfbf9f9`), built into a supervised release directory.
- **Release-root deviation (recorded, deliberate):** the release directory is
  `E:\ATLAS-runtime-supervised-7ac28124-20260923`, not a new `D:\ATLAS-runtime-supervised-*`, because `D:`
  was at **16.83 GiB** — 1.83 GiB above the §3 15 GiB fail-closed line — while §3 makes `E:` the root for
  every new worktree and PostgreSQL lives on `D:`. `E:` is a local fixed NTFS volume; `D:` finished the
  deployment **unchanged at 16.82 GiB**. The release owns its own dependency tree (no junctions).
- **Incumbent / rollback basis:** `d9a6aa53` at `D:\ATLAS-runtime-supervised-d9a6aa53-20260923`
  (supervisor 44116; 5001->19296 / 5174->41948), retained and startable in place.
- **Expected delta:** client bundle + server bundle. Client entry chunk changed
  `index-BKcGq9ln.js` -> `index-BbufnI_M.js`; server `dist` carries `activePublishedRunId`,
  `blockingHardCount`, `publishedRawSoftViolationCount`. **No schema change, no migration, no seed, no
  live-data mutation, no generation, no publication.**
- **Verification (recorded):** served chunk SHA-256
  `49838BFE0F230EA18D78A3A870931C3FE79EB4571F875904D72DA556BFAB5CB6` byte-identical to the release build;
  the incumbent chunk now **404**; local `/api/v1/health` + `/api/v1/health/ready` (`database:"ok"`) +
  DB-backed `GET /api/v1/subjects?schoolId=1` all 200; Tailnet root and new chunk 200; supervisor log
  `releaseSha=7ac28124` / `sourceDir=E:\...` / "All targets healthy"; authoritative
  `supervisor-state.json` `state=running`, `releaseSha=7ac28124`.
- **Execution:** the reviewed `ops/runtime/deploy-runner.ps1` (dry-run, then `-Execute`), audit
  `C:\ProgramData\ATLAS\release-audit\7ac28124-20260923-132431`. No hand-authored cutover block.
- **Rollback:** re-point the task XML and the two machine runtime variables to `d9a6aa53`; the runner's
  captured task XML and machine values are in the audit directory.

## 7. Browser acceptance (post-deployment, fresh QA, both viewports)

Labelled **browser rows**, decided on the **deployed** release at `https://njgrm.buru-degree.ts.net`,
asserting `window.location.origin`, at **1366×768 and 390×844**. Rows D2 and D4 were **re-targeted** after
the pre-action review falsified the original D2 row (it would have been decided by the dashboard's
`runWide*` tile from `GET …/runs/latest/violations`, not by the changed artifact).

1. **D2 (network row).** Authenticated `GET /api/v1/dashboard/readiness-summary` for school 1 / active
   year returns `generation.blockingHardCount === 0` with a soft-labelled `softViolationCount`, and
   `generation.violationCount` is **absent**. *(Decided by the payload; the rendered tile is a
   corroborating observation only, not the row.)*
2. **D4 (header row).** The Simple header source line is one of the honest states — `Verified with
   EnrollPro`, or `School year from ATLAS, checked <age>`, or the `up to date` fallback — and never
   `Using cached school year`; it does not wrap or overflow, and the header stays one row at both
   viewports.
3. **Preservation.** One header row; grid top ≤ ~140 px at 1366×768; one status region; the published
   surface out-ranks `Generate`; no document scrollbar at either viewport; the nine `/timetable*` routes
   keep the sub-nav; zero new console errors.
4. **D1 (corroborating).** Authenticated `GET /api/v1/generation/1/10/runs` returns per-run
   `summary.isPublished` and `activePublishedRunId` = the active published run (317), so the list alone
   distinguishes published from unpublished.
