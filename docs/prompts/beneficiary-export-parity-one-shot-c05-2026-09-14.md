# BENEFICIARY-EXPORT-PARITY-C05 — One-Shot Correction Packet

**Stream:** `BENEFICIARY-EXPORT-PARITY-C05`
**Parent audit:** `docs/analysis/stakeholder-export-parity-audit-2026-09-14.md`
(STAKEHOLDER-EXPORT-PARITY-AUDIT-C05, 2026-09-14)
**Output contract:** `docs/reference/atlas-beneficiary-output-contract.md`
**Risk tier:** MEDIUM source + client + tests. No schema change, no deployment,
no live generation, no publication, no runtime action.
**Suggested worktree:** `E:/ATLAS-worktrees/beneficiary-export-parity-c05`
**Suggested branch:** `work/beneficiary-export-parity-c05`
**Base:** current `origin/main` at dispatch (minimum ancestor
`84dd537bb2a2c045b8518c35b3a5372142e0080c`). This packet’s docs commit sits
above the base; product base is the audit SHA.
**Directive:** read `origin/main:AGENTS.md` at dispatch and obey the current
hash; record it in the handoff.
**EXTERNAL_QA_BUNDLE:** enabled — commit the executor handoff at
`docs/handoffs/beneficiary-export-parity-c05-executor.md` as part of the
candidate.

## 0. Objective and governing outcome

Make ATLAS produce beneficiary-ready, term-correct official outputs that
faithfully reproduce the practical content and layout of the school’s 2026–2027
class and teacher programs and provide equivalent section, teacher, room, and
summary exports — per the output contract above, with the fixed decisions
(three ordered terms; selected-term-only official exports; ARAL Program absent
from every output (operator-resolved); HG excluded; AP ordinary; Flag/HGP
Monday-only overlay; school-agnostic configuration).

The audit found the outputs **PARTIAL/ABSENT**, not complete. This packet closes
the confirmed gaps. **Do not rewrite what is already correct** (§10).

## 1. Environment and evidence rules

- Standard worktree provisioning for this repo is allowed in the executor
  worktree (npm ci per lockfile). Do not touch root `D:/ATLAS`, other
  workstreams (`E:/ATLAS-worktrees/workflow-hardening-c02`,
  `E:/ATLAS-worktrees/term-cache-apply-packet-c01`), or companion repos.
- Reference artifacts live in untracked `D:/ATLAS/stakeholderFiles/**` — READ
  ONLY. Copy to temp before opening. Never commit them, never modify them.
- Renderers available (verified on this host): MS Word COM DOCX→PDF
  (`Documents.Open(path,$false,$true,$false)` + `ExportAsFixedFormat(pdf,17)`),
  Excel COM XLSX→per-sheet PDF (`Worksheets.Item(i).ExportAsFixedFormat(0,pdf)`),
  Windows.Data.Pdf PDF→PNG at 1600px. Put all produced artifacts/renders under
  `%TEMP%/opencode/beneficiary-export-parity-c05/` (never in the repo).
- No database mutation may be required by tests outside existing
  disposable-PostgreSQL patterns; never run against a shared/live database.
- No package additions beyond the existing lockfile; no schema/migration change.

## 2. Owned paths (change only these)

Server services:
- `atlas-server/src/services/workbook-export.service.ts`
- `atlas-server/src/services/teacher-program-export.service.ts`
- `atlas-server/src/services/docx-export.service.ts`
- `atlas-server/src/services/class-program-matrix.service.ts`
- `atlas-server/src/services/room-schedule.service.ts`
- `atlas-server/src/services/published-schedule.service.ts` (presentation
  projection/term identity/identity binding only)
- `atlas-server/src/services/scheduling-policy.service.ts` (use the existing
  passive reader; do not change policy semantics)
- `atlas-server/src/services/academic-term.service.ts` (only if a typed
  term-required error constant is needed)
- new `atlas-server/src/services/room-program-export.service.ts` (or equivalent
  bounded addition)

Server routes:
- `atlas-server/src/routes/generation.router.ts`
- `atlas-server/src/routes/room-schedule.router.ts`

Client:
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/simple/SimpleBeneficiaryControls.tsx`
- `atlas-client/src/components/timetable/simple/simpleExportRequests.ts`
- `atlas-client/src/components/room-schedules/RoomSchedules.tsx`
- `atlas-client/src/components/room-schedules/schedule-export.ts`

Tests (new/extended):
- `atlas-server/src/__tests__/*` export/term/room suites;
- `atlas-client/src/lib/__tests__/*` export suites.

Docs (bounded corrections only):
- `docs/reference/timetable-dynamic-workspace-and-warning-contract.md:303-304`
- `docs/reference/atlas-runtime-source-of-truth-map.md:920`
- `docs/handoffs/tt-output-c03r-planner-result.md:78-82`

**Forbidden:** `prisma/**`, migrations, `package.json`/lockfiles, `AGENTS.md`,
`ATLAS_AGENT_KI.md`, `.opencode/**`, `ops/**`, `.gitattributes`,
`stakeholderFiles/**`, `docs/plans/**`, `CHANGELOG.md`, runtime
config/releases/tasks/processes, other services/routes/pages beyond the list,
`D:/ATLAS` root, companion repositories.

## 3. Workstreams

### W1 — Term truth and fail-closed (P0)

**T1. Require a resolved selected term on every official export route.**
`generation.router.ts` summary (`:582-638`), class (`:642-710`), teacher
(`:714-794`) and the new room route must reject an absent `termIndex` with a
typed 4xx (`TERM_INDEX_REQUIRED`) and zero file bytes; keep `termIndex=active`
authority resolution and explicit-index contract validation unchanged. Do NOT
change `resolveRequestedTermIndex`’s `undefined → all terms` semantics for
other consumers (`generation.service.ts:1501,1512`).

**T2. Published teacher-program term identity and run binding (BLOCKING).**
Add `termIndex` to the presentation projection entries
(`published-schedule.service.ts:613-666`) so the existing strict filter in
`teacher-program-export.service.ts:238-278` can work, and bind identity: if the
requested `runId` is not the published run resolved as authoritative for the
scope, fail closed exactly like `workbook-export.service.ts:195-199`. Fix the
latent Flag-day fallback in break rows
(`teacher-program-export.service.ts:320-336`) to match
`workbook-export.service.ts:75-80` Monday-only semantics.

**T3. Matrix JSON semantics parity.** Absent term behaves as T1 (typed
rejection for official use); a completed zero-entry source does not return
200-empty for a requested run; published mismatch semantics align with the
workbook path (`class-program-matrix.service.ts:115-119,140-143,211-227`).

### W2 — Class-program and summary parity (P1)

**T4. Class program layout (DNO family).** In `exportClassProgramWorkbook`
(`workbook-export.service.ts:480-629`) each section block carries, at minimum:
- a learner/identity row: Grade, Section, Number of Learners Male/Female/Total
  (blank values when no authoritative source — D-E);
- `TIME | MINUTES | MONDAY..FRIDAY | TEACHER` columns with unambiguous teacher
  attribution (dedicated column, or day-tagged text where weekdays differ);
- merged break bands across the weekday columns (geometry recorded in tests);
- Monday-only Flag/HGP overlay with Tue–Fri cells remaining teachable
  (preserve `:604-613` semantics; do not add Tue–Fri flag cells);
- a daily totals row with exact arithmetic (from entries, reconciling with the
  period structure);
- a configurable branding block (school/region/division/district lines, year,
  selected term) — blank-line fallbacks, no hardcoded names;
- an approval block after each grade sheet: Prepared by / Reviewed by /
  Recommending Approval / Approved by with configurable names/roles (blank
  lines when unset) and Adviser;
- print setup: landscape, fit-to-width, no clipped columns;
- no HG rows; ARAL Program absent entirely (no row, cell, label, placeholder,
  or credit) — operator-resolved, not optional.

**T5. Summary workbook parity.** Extend `exportSummaryWorkbook`
(`workbook-export.service.ts:384-478`): keep the SUMMARY matrix; add per-subject
teacher sheets mirroring the reference workbook structure (subject panels with
subject/section columns, time rows, advisory/ancillary/total rows); add print
setup (orientation, fit, page breaks) and term/school identity in the header;
add reconciliation totals consistent with the class program for the same
selected term and run.

**T6. Teacher-program presentation parity.** `docx-export.service.ts` and
`teacher-program-export.service.ts`: add the configurable branding block above
the title (school/division/district lines with blank fallback); render the
picture placeholder box (embed a photo only if an existing faculty image value
is available — no schema change); keep the six-column schedule and `Monday to
Friday` compaction; the load block carries **no ARAL component** —
`Total Teaching Load = Class Advising Duty + Actual Teaching Load + Ancillary
Work` — and ARAL Program must not appear anywhere in the document (no row, no
label, no 0-min entry); add the daily-total annotation row convention
(“X mins. (Monday–Friday)” plus the conditioned HGP/PEACE note) when policy
defines those windows.

**T7. Room program official export (new).** Add a server export route
(`runs/:runId/export/room-program.xlsx?termIndex=&roomId=`) built from the same
`loadExportContext` entries as the class program (`roomId` scopes rooms; omit
= all rooms with entries). Layout per the contract §3.3: room/building + year +
term header; TIME | minutes | Monday–Friday; cells carry Subject + Section +
Teacher; breaks banded; ARAL Program absent (no cell/row/label); print setup.
Actor-school scope and zero-write apply.
Client: bind an official room download control on the RoomSchedules page to a
resolved run + selected term; disabled with zero dispatch when either is
unresolved.

**T8. Room read term scope and passive policy read (G11).** Extend
`getRoomScheduleView` (`room-schedule.service.ts:87-92`) with an optional
`termIndex` that applies the same strict per-term filter as exports, and replace
`policyService.getOrCreatePolicy` (`:101`) with the existing passive policy
reader (`scheduling-policy.service.ts:1001+`) so reads cannot create/normalize
policies or run DDL. The room view/export must never write.

**T9. File identity.** Server `Content-Disposition` and client filenames must
identify type + school-year label + term (+ entity where applicable), e.g.
`class-program-SY2026-2027-term1.xlsx`,
`summary-teacher-schedule-SY2026-2027-term1.xlsx`,
`teacher-program-<faculty>-SY2026-2027-term1.docx`,
`room-program-<room|ALL>-SY2026-2027-term1.xlsx` (sanitized). Keep client and
server identical.

**T10. Publication-state marker (G13).** Every official output (summary, class,
teacher, room) must identify its publication state from the run’s persisted
publication data: a non-published output renders an explicit
`NOT PUBLISHED — DRAFT/REVIEW` marker (workbook header area and DOCX banner
area); a published output renders `PUBLISHED` with the revision identity
available from the run summary. No schema change; use existing run summary
fields.

### W3 — Controls and tests (P2, mandatory)

Replace weak/tautological controls (audit G8) with the mandatory matrix in §4.
Extend — do not delete — the existing export/term suites; any adjudicated test
update must be documented with the requirement it formerly masked (no assertion
removal without replacement coverage).

### W4 — Documentation corrections (bounded, G10)

Fix the three stale/false claims (paths in §2) to match verified behavior after
T1–T10: shared selected-term parity for room/teacher/exports must now be true;
`TERM_FILTER_NOT_READY` semantics description corrected; the stale “default
downloads are all-term” closure annotated as superseded by this stream. Touch
no other docs.

## 4. Mandatory verification matrix (acceptance)

Each row needs a production entry point, an observable pass condition, and a
failing-first/adversarial control. A row without production-path evidence is
not PASS.

| # | Requirement | Pass condition | Failing-first / adversarial control |
|---|---|---|---|
| M1 | Selected-term-only official exports | Absent `termIndex` → typed 4xx, zero bytes on all four routes | Base serves mixed file (G1) → new test red on base |
| M2 | T1/T2/T3 isolation | Per-term export contains only that term’s cells/rows | Mutant removing the term filter fails the matrix |
| M3 | Published teacher-program term | Real-producer published fixture + selected term → 200 with term cells | Current code returns 501 → red on base |
| M4 | Published identity binding | Requested published runId ≠ resolved → typed 4xx, zero bytes (teacher/workbook/matrix) | Latest-published differs from requested |
| M5 | Five-session weekly subject | 5 sessions in every applicable term in class/teacher/summary outputs | Drop one term occurrence → reconciliation fails |
| M6 | Rotation propagation | T1/T2/T3 subject/teacher/room changes appear in every output | Share/freeze rotation → cross-surface check fails |
| M7 | Monday-only Flag/HGP | Monday flag cell; Tue–Fri teachable cells; teacher-program break day-scope | Flag on all days → fails |
| M8 | ARAL absence everywhere, HG exclusion, AP inclusion | ARAL Program absent from class/teacher/room/summary exports (no row/cell/label/placeholder/credit; operator-resolved); HG excluded; AP present as an ordinary subject | Inject ARAL subject → any ARAL cell/row/load entry appears (must fail); ARAL label/placeholder reappearing must fail; AP removal must fail |
| M9 | Class-program layout | Teacher column values, merged break ranges, totals arithmetic, approval rows, learner fields present in produced xlsx | Remove merge/totals → geometry/extraction assertion fails |
| M10 | Teacher-program layout | Branding rows, **no ARAL component**, `Total Teaching Load = advisory + actual + ancillary`, signature roles, photo placeholder | ARAL row/0-min entry appearing → fails; break total invariant → fails |
| M11 | Room program export | Mounted route 200 selected term, zero-write, filename identity; client control dispatches only with resolved scope | Client unresolved scope → zero dispatch |
| M12 | Summary workbook | Per-subject sheets present; print setup set; totals reconcile with class program | Remove a subject sheet → fails |
| M13 | Cross-output reconciliation | Independently parsed class/teacher/room/summary artifacts agree on the fixture’s `(term, day, interval, section, subject, teacher, room)` tuples | Any single-surface mutation fails |
| M14 | Auth/cross-school | Mounted matrix: missing/invalid JWT 401, non-privileged 403, cross-school 403/404, raw system token 401 — zero dispatch/write | Each rejection asserted with zero downstream |
| M15 | Zero-write | Instrumented DB client: exports and room read perform zero writes | Base room read writes (G11) → red on base |
| M16 | Empty/unresolved fail-closed | Zero-entry completed run → typed 4xx; missing faculty/room/term/run → typed 4xx, zero bytes | Empty-200 path removed |
| M17 | Duplicate download guard | Behavioral client test: second dispatch blocked while first in flight | Remove guard → test fails |
| M18 | File identity | Server `Content-Disposition` includes year+term+entity; client filename identical | Filename assertion |
| M19 | Artifact/print sanity | Produced files within sane size bounds; DOCX portrait; XLSX landscape/fit; every produced page/sheet rendered to PDF/PNG with an inventory | Clipped column/blank-page check on renders |
| M20 | Docs corrections | Three claims corrected; `git diff --check` clean | Diff assertion |
| M21 | Test preservation | No assertion removals without documented adjudicated replacement | Inventory check |
| M22 | Real builder artifacts | Deterministic fixture → real builders produce DOCX/XLSX in temp; extraction checks exact values both directions | Helper-only test cannot satisfy this row |
| M23 | Publication-state marker | Draft fixture export shows the explicit not-published marker; published fixture shows the published marker | Remove the marker → fails (contract §7.11 / G13) |

**Fixture requirements (deterministic):** three ordered terms; ≥1 ordinary
five-session subject; ≥1 rotation family with per-term subject/teacher/room
changes; Monday Flag/HGP + Tue–Fri teachable period; ARAL and HG subjects
present in input demand but absent from every output (no cell, row, label,
placeholder, or credit); AP ordinary; morning and
afternoon shift grades; ≥2 sections; ≥2 teachers; ≥2 rooms; breaks defined in
policy; one fixture variant for published revision-effective truth.

**Rendering evidence:** render every produced page/sheet of the corrected
outputs (Word/Excel COM recipes §1) into the evidence dir with a page/sheet
inventory and inspect them; include exact paths in the handoff. QA re-renders
the decisive pages independently.

## 5. Commit, handoff, and QA contract

- One branch, additive commits; do not amend/rebase after handoff. Stage only
  owned paths. `git diff --cached --check` clean. Conventional commit(s):
  `fix(exports): …`.
- Handoff must contain: base SHA, candidate SHA, exact changed paths, the §4
  matrix tally (PASS/BLOCKED/DEFERRED per row), decisive commands, fixture
  inventory, artifact evidence paths, rendering inventory, known risks, and
  `REVIEW_REQUIRED`. Mark every row PASS only with production-path evidence.
- **Fresh independent QA is mandatory** (`atlas-qa-delegate`, fresh context,
  immutable range `base...candidate`). `ACCEPT_READY` requires
  `passed == total`, `blocked: 0`, `unperformed: 0`. QA must independently
  reproduce M1–M3 failing-first on base, parse produced artifacts with
  independent readers, and re-render decisive pages.
- After `ACCEPT_READY`: planner integrates under standing authorization, then a
  fresh Wave Completion Auditor reviews the integrated tree (this stream
  changes export authority/parity).

## 6. Mutation boundary and stop conditions

- No deployment, no runtime touch, no live generation, no publication, no
  migration/schema change, no live data write, no companion repository change,
  no stakeholder-file change.
- If a required fix needs a schema/field (e.g., photo storage), stop and return
  `PLANNER_DECISION_REQUIRED` with the exact need; do not change `prisma/**`.
- If a product-meaning question arises that the contract/decision list does not
  answer, record it and default per §10 of the contract; do not invent school
  content.

## 7. Sizing and budget

- One-shot where dependencies allow; internally ordered W1 → W2 → W3 → W4.
- Executor budget: **150 minutes**, with a 75% checkpoint report (active
  command, completed evidence, remaining critical path). At budget, freeze
  scope, preserve evidence, return the smallest actionable blocker.
- Recommended split only if a material dependency appears: W1 (term truth) is
  independently acceptable; do not split W2 arbitrarily.

## 8. Evidence reuse and known limitations

- `tt-output-c03r-route.test.ts` already proves mounted-route zero-dispatch and
  real-buffer cell output for the class workbook path — extend it rather than
  duplicating.
- `tt-output-c03r3.test.ts` already proves per-term demand 5/term and rotation
  membership at the service level — keep and reuse; add artifact-level checks.
- The audit made no live/runtime claims; do not claim any in the handoff beyond
  what tests and rendered artifacts prove.

## 9. Open decisions (defaults apply if unanswered)

D-B room shape (default: contract §3.3); D-C class-program family (default:
DNO single-section day-column field set per T4); D-D period/shift
canonicalization (default: persisted scheduling policy + canonical slots
as-is); D-E learner counts (default: blank fields); D-F slot configuration
(default: persisted `classProgramSlot` rows are authoritative; DNO catalog is
the default seed). D-A (ARAL placeholder) is closed by the operator decision:
ARAL is absent from every official export.

## 10. Preserve list (must not be rewritten)

Per-term derived-demand 5/term + rotation isolation logic; no implicit T1
coercion; HG exclusion; ARAL Program absent from every output (no demand,
credit, cell, row, label, or placeholder); AP ordinary; Flag/HGP
Monday-only overlay with Tue–Fri teachable; actor-school scope with zero
dispatch; client term-bound requests, all-term disable, visible retryable error
banner, single-flight guard; export service read-only behavior; published
workbook revision binding; mounted zero-write instrumentation patterns.
