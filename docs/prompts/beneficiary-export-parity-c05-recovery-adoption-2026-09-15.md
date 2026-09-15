# BENEFICIARY-EXPORT-PARITY-C05 — Recovery Adoption Packet (2026-09-15)

**Role:** EXECUTOR (fresh session; the interrupted provider-stalled session must
not be resumed).
**Stream:** `BENEFICIARY-EXPORT-PARITY-C05`
**Worktree:** `E:/ATLAS-worktrees/beneficiary-export-parity-c05`
**Branch:** `work/beneficiary-export-parity-c05`
**Governing packet (authority, read in full):**
`docs/prompts/beneficiary-export-parity-one-shot-c05-2026-09-14.md`
**Output contract:** `docs/reference/atlas-beneficiary-output-contract.md`
**Audit analysis:** `docs/analysis/stakeholder-export-parity-audit-2026-09-14.md`
**Directive:** `origin/main:AGENTS.md` raw-blob SHA-256
`5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5`
(re-verified 2026-09-15 against `origin/main` `53a781a4`; identical to the
audit-time pin — no directive drift).
**Risk tier:** MEDIUM source/client/tests/docs. No schema, deployment, runtime,
live generation, publication, or live-data action.

## 0. Adoption provenance (immutable)

- `55b8a29a` — **adoption checkpoint**: the interrupted session's uncommitted
  five-file delta adopted **verbatim** (no bytes changed) so a second transport
  failure cannot strand it. Captured pre-adoption diff SHA-256:
  `604029CEDF86424900E6ED2D7CC35C30EE1B64BC548331870DEF795A35B4E66A`.
- `90c539bc` — W1 commit produced by the interrupted session (T1/T2/T3/T8
  claimed; 9 files).
- `2e0b406f` — audit docs tip (parent of the implementation range; the docs
  themselves were closed by the audit cycle at r4 `AUDIT_CLEAR`).
- `53a781a4` — current `origin/main` (drift since audit base `84dd537b` touches
  only `ops/workflow/**`, docs, `.opencode/agents/**`, packets; **zero overlap**
  with this stream's product paths — verify before final freeze anyway).
- **Do not rebase, amend, revert, or rewrite `55b8a29a` or `90c539bc`.** All
  recovery corrections are new additive commits on this branch.
- Frozen history is evidence, not truth: re-verify every adopted claim below
  with production-path evidence before marking any matrix row PASS.

## 1. What the adopted delta contains (verify, then finish)

Adopted in `90c539bc` (committed):

- `generation.router.ts`: `parseRequiredTermQuery` (absent → `TERM_INDEX_REQUIRED` 400,
  `active`/numeric passthrough) applied to summary/class/teacher export routes and
  the `class-program-matrix` route; typed ordered-term errors mapped to JSON.
- `published-schedule.service.ts`: presentation projection carries entry `termIndex`.
- `teacher-program-export.service.ts`: requested `runId` bound to authoritative
  published run (`RUN_NOT_FOUND` on mismatch); Monday-only Flag/HGP break day scope.
- `class-program-matrix.service.ts`: `NO_SOURCE_RUN` / `EMPTY_SOURCE_RUN` typed
  failures; published mismatch always fails.
- `room-schedule.service.ts` + `room-schedule.router.ts`: passive policy reader
  (no write-on-read) and optional strict term scope.
- Tests: `tt-output-c03r-route.test.ts` extended; `timetable-output-export-c03.test.ts`
  adjudicated updates.

Adopted in `55b8a29a` (verbatim checkpoint; partial W2):

- `docx-export.service.ts`: branding block, publication banner, photo
  placeholder/embed, daily-total note; the `ARAL Program` load row removed.
- `teacher-program-export.service.ts`: ARAL removed from workload kinds/summary;
  `branding`/`term`/`publication`/`notes`/`avatarUrl` on the shape;
  `totalTeachingLoad = advisory + actual + ancillary`.
- `workbook-export.service.ts`: `resolveExportSchoolYearLabel`, publication
  marker in `addReportHeader`, `termIndex` + `publication` on `ExportContext`.
- `generation.router.ts`: filename identity (`<type>[-<entity>]-SY<year>-term<N>`)
  for summary/class/teacher exports; `exportFileStem` helper.
- `timetable-output-export-c03.test.ts`: `school.findUnique` stubs.

## 2. Known defects to correct first (planner-verified 2026-09-15)

1. **Compile break (must fix in your first commit):**
   `timetable-output-export-c03.test.ts:162-163` has a duplicate `school:` key
   (TS1117). The checkpoint line is a duplicate of the line above it — remove
   exactly one. `npx tsc --noEmit` in `atlas-server` currently fails with only
   this error; everything else in the adopted delta compiles.
2. **Stale/contradictory comment:** `generation.router.ts` matrix route comment
   ("an absent termIndex keeps all terms of that run") contradicts the enforced
   T1 rejection below it. Correct the comment.
3. **Teacher DOCX signature block:** the adopted delta removed the
   `['Checked by:', 'Teacher', teacher.fullName]` row. Contract §3.2 requires
   "Checked by Teacher + School Head, Noted, Recommending Approval, Approved".
   Reconcile to the contract and prove the final role set in the M10 assertion.
4. **Client/server filename identity mismatch:** server now emits
   `summary-teacher-schedule-SY<year>-term<N>.xlsx`,
   `class-program-SY<year>-term<N>.xlsx`,
   `teacher-program-<facultyId>-SY<year>-term<N>.docx`; the client
   (`simpleExportRequests.ts`) still emits the old
   `*-run-<id>-term<N>` shape. Thread the persisted year label (or the same
   `SY-UNLABELED` degradation rule, byte-identical sanitization) through the
   client resolver and prove client == server for all three (M18).
5. Do not assume the adopted hunks are otherwise complete — the remainder of
   this packet lists what the planner verified as **missing**.

## 3. Remaining work (packet T1–T10; §4 matrix unchanged)

Re-read governing packet §3–§4. Verified gap ledger (planner, 2026-09-15):

- **T4 — class-program layout (largest remaining server item).** In
  `exportClassProgramWorkbook` (`workbook-export.service.ts:538-687`), each
  section block currently has only SECTION/ADVISER/BLDG.-RM. row, TIME |
  MINUTES | MON..FRI header, and stacked `subject\nteacher` day cells. Missing:
  learner/identity row (Grade, Section, Male/Female/Total; blank when no
  authoritative source), dedicated/unambiguous TEACHER column per packet T4,
  merged break bands (record geometry in tests), daily totals row with exact
  arithmetic reconciling to the period structure, configurable branding block
  above the title (school/region/division/district + year + selected term,
  blank-line fallbacks), per-grade approval block (Prepared by / Reviewed by /
  Recommending Approval / Approved by + Adviser; blank when unset), print setup
  (landscape, fit-to-width, no clipped columns). Preserve the existing
  Monday-only Flag/HGP overlay (`:666-672`) with Tue–Fri teachable cells. ARAL
  Program absent entirely; no HG rows.
- **T5 — summary workbook parity.** Extend `exportSummaryWorkbook`
  (`:442-536`): keep the SUMMARY matrix; add per-subject teacher sheets
  mirroring `stakeholderFiles/root-reference/SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx`
  (subject panels; subject/section columns; time rows; advisory/ancillary/total
  rows); add print setup (orientation, fit, page breaks); term/school identity
  in header (partially adopted); reconciliation totals consistent with the
  class program for the same selected term and run.
- **T6 — teacher-program presentation (partially adopted; finish + verify).**
  Verify/adjust branding block position and content above the title; photo
  placeholder box (embed only a usable inline data-URL `avatarUrl` — field
  exists on `FacultyMirror`, no schema change); six-column schedule and
  `Monday to Friday` compaction preserved; no ARAL row/label/0-min anywhere;
  `Total Teaching Load = Class Advising Duty + Actual Teaching Load + Ancillary
  Work`; daily-total annotation convention ("X mins. (Monday–Friday)" plus the
  conditioned HGP/PEACE note when policy defines those windows); signature
  roles per defect §2.3.
- **T7 — room program export (absent entirely).** New
  `atlas-server/src/services/room-program-export.service.ts` (or equivalent
  bounded addition) + route
  `/:schoolId/:schoolYearId/runs/:runId/export/room-program.xlsx?termIndex=&roomId=`
  (likely mounted via `room-schedule.router.ts` or `generation.router.ts` —
  your choice, keep actor-school scope + typed fail-closed + zero bytes on
  rejection). Build from the same `loadExportContext` entries as the class
  program; `roomId` scopes one room, omitted = all rooms with entries. Layout
  per contract §3.3: room/building + year + term header; TIME | minutes |
  Monday–Friday; cells carry Subject + Section + Teacher unambiguously; breaks
  banded; ARAL absent; publication marker (T10); print setup; filename
  `room-program-<room|ALL>-SY<year>-term<N>.xlsx` (sanitized). Client: bind an
  official room download control on `RoomSchedules.tsx` to a resolved run +
  selected term; disabled with zero dispatch when either is unresolved. The
  existing client CSV (`schedule-export.ts`) is a view export, not the official
  output — keep or replace per contract §3.3 ("server-generated file, not ...
  a client-side CSV") without breaking existing UI contracts.
- **T9 — file identity (client half + room).** See defect §2.4; add the room
  filename; keep client and server byte-identical.
- **T10 — publication marker.** Summary/class covered via `addReportHeader`;
  teacher DOCX banner adopted; **room export must carry the marker**; verify
  the marker text/state derives from persisted run publication data only.
- **W3 — mandatory matrix M1–M23.** Extend, do not delete, existing suites
  (`timetable-output-export-c03.test.ts`, `tt-output-c03r-route.test.ts`,
  `tt-output-c03r.test.ts`, `tt-output-c03r3.test.ts`,
  `tt-output-c03r3-placement-term.test.ts`, `workbook-export-content.test.ts`;
  client `timetable-*-export-c03r*.test.ts`). Every row needs production entry
  point + observable pass condition + failing-first/adversarial control. M14/M15
  use the repo's existing mounted/disposable-PostgreSQL patterns only — never a
  shared/live database. M19/M22 produce real DOCX/XLSX and render pages via the
  host Word/Excel COM recipes (packet §1) with a page/sheet inventory. M21 test
  preservation inventory is mandatory.
- **W4 — docs corrections (exactly three, nothing else):**
  `docs/reference/timetable-dynamic-workspace-and-warning-contract.md:303-304`,
  `docs/reference/atlas-runtime-source-of-truth-map.md:920`,
  `docs/handoffs/tt-output-c03r-planner-result.md:78-82`.

## 4. Execution order and budget

1. Fix defect §2.1 (compile) → run `npx tsc --noEmit` (server) and
   `npx tsc --noEmit` / project typecheck (client) → **first additive commit**.
2. Audit the adopted W1 claims against the packet with real production-path
   checks; correct in place additively if wrong.
3. W2 remaining (T4 → T5 → T6-finish → T7 → T9-client → T10-room), committing
   per coherent unit; then W3 controls/artifacts; then W4 docs.
4. Budget: 150 minutes with a 75% checkpoint note (active command, completed
   evidence, remaining critical path). At budget: freeze scope, preserve
   evidence, return the smallest actionable blocker.
5. Final gates before freeze: server + client typecheck/build; the complete
   changed+related test matrix; `git diff --check`; clean `git status`; artifact
   render inventory; no stray files.

## 5. Boundary

- Source, tests, owned docs only, exactly per governing packet §2/§6 plus this
  packet. Never touch `prisma/**`, migrations, lockfiles/`package.json`,
  `AGENTS.md`, `ATLAS_AGENT_KI.md`, `.opencode/**`, `ops/**`, `.gitattributes`,
  `stakeholderFiles/**` (READ ONLY), `docs/plans/**`, `CHANGELOG.md`, runtime
  config/releases/tasks/processes, `D:/ATLAS` root, companion repositories, or
  the living register.
- No browser login, live download, database mutation (live/shared), runtime
  restart, deployment, generation, publication, migration, or companion edit.
  No push. No new dependencies.
- Clean up every temp artifact you create in the worktree; renders/artifacts
  live only under `%TEMP%/opencode/beneficiary-export-parity-c05/`.

## 6. Handoff and return contract

- One branch, additive commits; no amend/rebase after handoff; stage only owned
  paths; `git diff --cached --check` clean.
- Handoff file (EXTERNAL_QA_BUNDLE enabled):
  `docs/handoffs/beneficiary-export-parity-c05-executor.md` — base SHA
  (`2e0b406f` for the full implementation range; name the exact range you
  reviewed), candidate SHA, exact changed paths, the §4 matrix tally
  (PASS/BLOCKED/DEFERRED per row), decisive commands, fixture inventory,
  artifact/render paths + page/sheet inventory, known risks, and
  `REVIEW_REQUIRED`.
- `Worktree clean` means the complete `git status --short` is empty at freeze.
- Return `REVIEW_REQUIRED`; do not self-accept, merge, or push. A fresh
  independent QA delegate will review `2e0b406f...<candidate>`; every row you
  mark PASS must survive production-path re-verification.
