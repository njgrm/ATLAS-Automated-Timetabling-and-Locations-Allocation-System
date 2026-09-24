# Deployment acceptance — release `70a51608` (unified official export presentation) — 2026-09-24

Deployment and acceptance are separate outcomes.

- **Deployment: `DEPLOYED`.** Release `70a5160819349f5ea0742b839c11606e8408185d` is live on the
  supervisor-owned 5001/5174 and the served client bundle is byte-identical to the release build.
- **Acceptance: `PARTIAL`.** All deployment / identity / migration / artifact rows pass. Every
  authenticated browser row is `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` — the shared browser
  session has expired and no login was authorized for this cycle.

Cycle: primary planner, elevated OpenCode, one cycle. Deploy target and incumbent were SHA-pinned;
one writer owned the runtime; the deployment runner was the sole cutover owner.

---

## 1. Cutover and live identity

| Item | Value |
| --- | --- |
| Target release | `70a5160819349f5ea0742b839c11606e8408185d` |
| Target source dir | `E:\ATLAS-runtime-supervised-70a51608-20260924` (detached worktree; clean at build; HEAD == target) |
| Incumbent / rollback | `c7fc0c955253b924fd880f346c23d428166437c6` at `E:\ATLAS-runtime-supervised-c7fc0c95-20260924` |
| Runtime env file | `D:\ATLAS-runtime-config\atlas-server.env` (unchanged; never printed) |
| Cutover owner | `ops/runtime/deploy-runner.ps1` (dry-run then `-Execute`) |
| Dry-run audit | `C:\ProgramData\ATLAS\release-audit\70a51608-20260924-180954` |
| Execute audit | `C:\ProgramData\ATLAS\release-audit\70a51608-20260924-181010` (plan + `task-before.xml` + `task-target.xml`) |
| Machine `ATLAS_RUNTIME_SOURCE_DIR` | `E:\ATLAS-runtime-supervised-70a51608-20260924` |
| Machine `ATLAS_RUNTIME_RELEASE_SHA` | `70a5160819349f5ea0742b839c11606e8408185d` |
| Machine `ATLAS_RUNTIME_ENV_FILE` | `D:\ATLAS-runtime-config\atlas-server.env` |

The dry-run plan was reviewed before execution: `mode=dry-run`, `mutates=false`, `secretsPrinted=false`,
`supervisorPid=67540`, `listenerPids=[46716,66848]` (the declared incumbent's tree). The
fail-closed pre-mutation gate passed: `docs/plans/live-state.md` at `origin/main` names the target
prefix `70a51608` in its `## Live release` section (record commit `23ccb3cf`; the handoff commit
`ddb1a6c1` is docs-only above it and was **not** used as the runtime source).

Post-cutover live identity (independently re-derivable, read-only):

- `ops/runtime/logs/supervisor-state.json` in the target release:
  `releaseSha=70a5160819349f5ea0742b839c11606e8408185d`, `state=running`,
  `ownedPids.server=59568`, `ownedPids.client=59572`, `startedAt=2026-09-24T10:10:46.513Z`.
- Listeners: `5001`→`59568` (server), `5174`→`59572` (production host), one lineage.
- `GET http://127.0.0.1:5001/api/v1/health` → 200 `{"status":"ok","service":"atlas"}`.
- `GET http://127.0.0.1:5001/api/v1/health/ready` → 200 `{"status":"ready",...,"database":"ok"}`.
- `GET https://njgrm.buru-degree.ts.net/api/v1/health` → 200 (Tailnet origin asserted).
- DB-backed read `GET /api/v1/subjects?schoolId=1` → 200 (19,440 B) — liveness alone is not readiness.
- Product pin: `70a51608` descends from the reviewed contract `productPin` `d44f29e0` (ancestry model).

**Served bundle changed and is byte-identical to the build:**

| | Path | Bytes | SHA-256 |
| --- | --- | --- | --- |
| Build (target release) | `atlas-client/dist/assets/index-DBNdrVle.js` | 377,895 | `E080F7F52B7D146DA3AFC27FE21AFAE46A4BB9B118679974E7EA555146F4EE60` |
| Served (local 5174 + Tailnet) | `/assets/index-DBNdrVle.js` | 377,895 | `E080F7F52B7D146DA3AFC27FE21AFAE46A4BB9B118679974E7EA555146F4EE60` |

The prior entry `assets/index-C7SskN0k.js` now returns **404**, so the old release is not being
served. The target worktree was `CLEAN` (`git status --short` empty) before the cutover.

---

## 2. Migration outcome

The additive migration was intentionally unapplied at handoff; it was applied with the **guarded**
runner only (never bare Prisma).

- Host `localhost:5432`; database `atlas_recovery_clean_rebuild_20260905` (recorded before the schema
  command; credentials never printed).
- **Before:** 6 applied migrations — `0000_clean_baseline`, `0001_term_subject_authority`,
  `0002_companion_sso_code`, `0003_teacher_program_presentation`, `0004_notification_inbox`,
  `20260923000000_publication_approval_requests`.
- **Fresh verified backup before the schema command:** `atlas-backup-atlas_recovery_clean_rebuild_20260905-20260924-100920.dump`,
  625,890 B, sha256 `d6af71f77700c4f8920b091a02d6c194d03e4986825abe4b58dd005e85df79dc`,
  514 `pg_restore --list` entries. The guarded gate revalidated the exact selected archive
  (fresh checksum + current `pg_restore --list`) immediately before spawning Prisma.
- **Guarded runner:** `npx tsx src/scripts/atlas-migrate.ts` → `MIGRATE_GATE_OK`, then
  `prisma migrate deploy --schema ../prisma/schema.prisma` applied
  `20260924000000_unified_official_export_profile`; **exit 0**.
- **After:** 7 applied migrations; all five additive columns present on
  `teacher_program_presentation_revisions`: `official_school_name`, `header_line`, `region_line`,
  `division_line`, `district_line`.
- The DDL is additive and nullable (5 × `VARCHAR`) and touches no existing rows
  (`teacher_program_presentation_revisions` row count = 0). No data was rewritten.

The backup/revalidation gate passed; no bypass was used. Rollback for this step is dropping the five
additive columns (no data loss).

---

## 3. Export matrix + document content check

**What ships (official printable exports):**

| Document | Format | Renderer (deployed source) | Shape |
| --- | --- | --- | --- |
| Grade-level Class Program | DOCX (official Word) | `atlas-server/src/services/official-program-docx.service.ts` | One landscape matrix across **all** grade sections: section / adviser / room headers with paired subject + teacher rows |
| Section Class Program | DOCX (official Word) | `official-program-docx.service.ts` via direct template renderer | Per-section form |
| Room Program | DOCX (official Word) | `room-program-export.service.ts` (stacked details) | Per-room form |
| Teacher Program | DOCX (official Word) | `teacher-program-export.service.ts` | Per-teacher form |
| Class Program / working data | XLSX (working Excel) | `workbook-export.service.ts` (separate weekday cells) | Readable working workbook, not the official form |

Supporting contracts: the Export Center (`atlas-client/src/components/timetable/simple/SchedulerExportCenterDialog.tsx`) now distinguishes official
Word output from Excel working data; the official export identity/profile is additive and frozen for
published schedules (`export-presentation.service.ts`); grade exports reject a misleading `sectionId`
filter (`generation.router.ts`); the DOCX→printable path uses `docx-export.service.ts`.

**Content check.** The rendered multi-section Grade / Section / Room DOCX fixtures were inspected in
Word→PDF over the reviewed range `e74408c1...70a51608` (recorded in the cycle handoff). On the
**deployed bytes** this cycle additionally reproduced the hermetic export checks from the release tree:

- `npm run test:export-center` → **4/4 pass**, including
  *“schedule workbook DOCX conversion preserves printable grid text in a real DOCX table.”*
- `npx tsx --test src/__tests__/official-export-presentation-profile-c01.test.ts` → **5/5 pass**
  (school-year identity/profile, typed fail-closed on a missing unified-profile column, and the
  additive schema ↔ source-only migration field parity).

The **live download and on-screen content check** of the Grade DOCX (and the Section/Room/Teacher
DOCX and XLSX) against the live published run is part of the authenticated browser acceptance: the
Export Center control was verified live, but the document download did not complete (§4).

---

## 4. Browser acceptance — `PARTIAL` (Export Center verified; document downloads blocked by a tooling crash)

Pre-login, the session was confirmed expired read-only: `GET /api/v1/auth/me` → **401** `NO_TOKEN`,
`document.cookie` length **0**, console `401` on `/api/v1/auth/me` on load.

**One login was authorized and consumed exactly once** — audit `LOCAL_LOGIN_SUCCESS` id **943**
(actor 46, school 1, `2026-09-24 10:24:18Z`); the pre-existing row id 942 predates this cycle.
Credentials were read and entered entirely inside the browser process via a loopback-only broker and
were never printed, committed, staged, or written to any artifact/log/history. The authenticated shell
rendered as `officer / Admin`, `Active Term: T2`, `Active year: 2031-2032`, with the published run
read-only.

Verified live at 1366×768 (origin asserted `https://njgrm.buru-degree.ts.net`):

- `/timetable` renders the published schedule (run #317 / revision 43) read-only, with **no** reachable
  generation or publication action (`Published — view only`; the Generate control is inert on a
  published run).
- The toolbar **Download** menu exposes *Open Export Center…* and a *Summary workbook (.xlsx)* shortcut.
- **Export Center controls — PASS.** The `Export Center` dialog
  (`data-testid="scheduler-export-center"`) binds to the selected run and ordered term and its
  "Schedule file" selector distinguishes official Word output from Excel working data:
  *Teacher working data — Excel*, *Class working data — Excel*, *Official grade class program — Word*,
  *Room program — Word or Excel*, *Section program — Word or Excel*. Selecting the official grade
  option forces the format to Word (Excel disabled) and reveals a Grade selector (G7–G10) with the
  note "Includes every section in the selected grade."

**Not completed — tooling crash.** While capturing the first official document download (grade class
program, G7, DOCX) the **Playwright MCP browser closed unexpectedly** (the `download.saveAs` target
directory did not exist). The session token lived only in `sessionStorage` (`atlas_local_token`), so
the session was lost with the tab and the browser tool surface disconnected. The following rows are
therefore **not performed**:

- Grade-level DOCX matrix download + real content check against the live run.
- Section / Room / Teacher official DOCX downloads.
- Readable XLSX working-book download.
- Console/network regression sweep and the 390×844 viewport pass.

**This is a test-harness failure, not a product failure.** The served bundle is byte-identical to the
reviewed build (`E080F7F5…F4EE60`) and the official renderers were exercised on the deployed tree (§3).
**Next action:** authorize one further login to re-run the download/content and responsive rows.

Cohort note (not a blocker): cohort sections are not active for the live school year — the cohorts
endpoint returns 200 with zero cohorts and the current run has no cohort entries. This needs
data/EnrollPro population, not a UI or deployment change.

---

## 5. Confirmation — no generation or publication occurred

- Latest generation run: **#317**, `COMPLETED`, `createdAt 2026-09-22 23:21:09` — predates this
  deployment (cutover `2026-09-24 10:10Z`).
- Latest published schedule revision: **id 43**, `effective_date 2026-09-22 23:22:04` — predates this
  deployment.
- No `POST …/generation/…/runs` and no `POST …/runs/:id/publish` was invoked. The only database
  change this cycle made was the additive DDL in §2.

---

## 6. Rollback basis

- Runtime rollback: `c7fc0c955253b924fd880f346c23d428166437c6` at
  `E:\ATLAS-runtime-supervised-c7fc0c95-20260924` (startable in place). The deploy runner captured the
  incumbent task XML before mutating (`task-before.xml` in the execute audit directory) and restores
  the two machine runtime variables plus that XML on its own failure path.
- Schema rollback: drop the five additive nullable columns added by
  `20260924000000_unified_official_export_profile` (no row data touched).
- The pre-migration recovery point is the fresh backup in §2 (sha256 `d6af71f7…`, 514 entries).

---

## 7. Evidence index

- Deploy audit: `C:\ProgramData\ATLAS\release-audit\70a51608-20260924-180954` (dry-run plan) and
  `…-181010` (`deployment-plan.json`, `task-before.xml`, `task-target.xml`).
- Live identity: target `ops/runtime/logs/supervisor-state.json`; listeners 5001/5174; health, ready,
  Tailnet, and DB-backed read probes above.
- Bundle parity: served vs built `assets/index-DBNdrVle.js` (SHA-256 `E080F7F5…F4EE60`); incumbent
  `assets/index-C7SskN0k.js` → 404.
- Migration: `MIGRATE_GATE_OK` + `prisma migrate deploy` exit 0; 6 → 7 applied; five columns present;
  backup manifest `atlas-backup-…-20260924-100920.dump.manifest.json`.
- Authorized login delta: exactly one `LOCAL_LOGIN_SUCCESS` (id 943, actor 46); credentials never
  printed.
- Acceptance artifact commit: this file.

**Verdict:** deployment `DEPLOYED` and verified (independent QA `ACCEPT_READY` 8/8/0/0 on range
`676771ec`); acceptance `PARTIAL` — Export Center control verified live, document-download and
responsive rows pending a further authorized login after a Playwright MCP crash.
