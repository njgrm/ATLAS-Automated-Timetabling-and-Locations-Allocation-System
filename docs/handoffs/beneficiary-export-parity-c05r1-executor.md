# BENEFICIARY-EXPORT-PARITY-C05R1 — Executor Handoff

**Verdict:** `REVIEW_REQUIRED` (final source candidate; no self-accept, merge, or push).
**Stream:** `BENEFICIARY-EXPORT-PARITY-C05R1` (Teacher Program correction).
**Worktree:** `E:/ATLAS-worktrees/beneficiary-export-parity-c05` — branch `work/beneficiary-export-parity-c05`.
**Worktree disposition:** `PRESERVE_FOR_DECISION` until head-planner integration; then `RETIRE_AFTER_INTEGRATION`.
**Directive verified:** `origin/main:AGENTS.md` LF-normalized raw-blob SHA-256
`5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5` (blob
`a372b5b52b4e9e756cb1689abe8689a8edd2d898`) — matches the packet pin.
**Risk tier:** MEDIUM source/client/tests/docs with a HIGH-class future migration apply (not performed).
**Mechanically reconciled against git at `dc05c933` (2026-09-15 16:30 Asia/Manila; product/test bytes remain at `0b48b1a1`).** Every commit SHA/subject, range endpoint and pin, changed-path list and count, suite/gate count, stakeholder/contract hash, and cross-reference in this handoff was re-verified against `git log`/`git diff`/`Get-FileHash` in one pass during QA round 2; the final tip pin lives in the last docs-only commit above `dc05c933`.

## 1. Immutable range

Rebuilt verbatim from `git log --oneline 691a7c4a..HEAD` (one row per commit, exact subject):

| Commit | Subject |
|---|---|
| `076b4b2d` | `docs(exports): carry C05R1 governing packet and teacher-program contract into the candidate range` — dispatch base (not a correction commit) |
| `e052a564` | `fix(exports): align teacher program with beneficiary schedule authority` |
| `f1e74b14` | `feat(exports): editable teacher-program signatory settings in the download area` |
| `c7533e4a` | `test(exports): instrument the draft export zero-write path` |
| `0b48b1a1` | `fix(exports): state the reference per-day teaching total in the load block` |
| `a715b84e` | `docs(exports): classify the teacher-program contract and record the C05R1 handoff` |
| `af2a54f9` | `docs(exports): pin the C05R1 final source candidate SHA in the handoff` |
| `af3b10a6` | `docs(exports): correct C05R1 handoff path inventory and contract cross-reference` |
| `a2a6dc35` | `docs(exports): pin the C05R1 QA-round-1 correction tip in the handoff` |
| `dc05c933` | `docs(exports): reconcile the C05R1 handoff against git (QA round 2)` |
| Final docs-only pin commit | replaces this pin row with the SHA above and states that it is the final commit; it changes no other statement |

| Derived pin | Value |
|---|---|
| Prior frozen candidate | `691a7c4a` |
| Final **source** candidate (last product/test commit) | `0b48b1a1` |
| Frozen product/docs state before this docs-only round | `a2a6dc35` |
| Cumulative range (product + docs) | `076b4b2d..a2a6dc35` |
| Immutable correction range (prior candidate → source candidate) | `691a7c4a..0b48b1a1` |
| Final tip pin | lives in the **final docs-only commit** above `dc05c933` (it changes only the two pin rows in this table) |

No amend, rebase, reset, squash, merge, or push. Every commit is additive.

## 2. Changed paths (cumulative `076b4b2d..a2a6dc35`, 20 paths, verified with `git diff --name-status`)

**Server product (5):** `atlas-server/src/services/teacher-program-export.service.ts`,
`atlas-server/src/services/docx-export.service.ts`,
`atlas-server/src/services/export-presentation.service.ts` (new),
`atlas-server/src/routes/export-presentation.router.ts` (new),
`atlas-server/src/app.ts` (mount).

**Server tests (6):** `tt-output-c05r1-teacher-program.test.ts` (new),
`export-presentation-route.test.ts` (new), `export-presentation-postgres.test.ts` (new),
`timetable-output-export-c03.test.ts`, `tt-output-c03r-route.test.ts`,
`tt-output-c05-beneficiary-parity.test.ts`.

_Inventory verified mechanically against `git diff --name-status
076b4b2d..a2a6dc35` (20 paths: 10 A / 10 M) and `git diff --name-only
691a7c4a..af2a54f9` (21 paths, 6 server tests). `tt-output-c03r.test.ts` is
**not** in the range — its blob is identical at `691a7c4a` and `af2a54f9`
(`21b3eaf44f4a144682aea48cb97bb26ae02a0a19`); it is listed in §7 only as an
unchanged regression rerun. `docs/prompts/beneficiary-export-parity-c05r1-teacher-program-correction-2026-09-15.md`
is not in the cumulative range (it was carried by the dispatch base `076b4b2d`)._

**Client (4 + 1 test):** `components/timetable/simple/exportPresentationApi.ts` (new),
`components/timetable/simple/ExportPresentationSettingsDialog.tsx` (new),
`components/timetable/simple/SimpleBeneficiaryControls.tsx`,
`components/timetable/TimetableSimpleHeader.tsx`,
`lib/__tests__/timetable-c05r1-presentation-settings.test.ts` (new).

**Prisma source (2):** `prisma/schema.prisma` (new model + School relation),
`prisma/migrations/0003_teacher_program_presentation/migration.sql` (new).

**Docs (2):** `docs/reference/atlas-teacher-program-output-contract-2026-09-15.md`,
`docs/handoffs/beneficiary-export-parity-c05r1-executor.md`.

No path outside the executor's ownership. `git diff --check` clean over the range.

## 3. Stakeholder input evidence

| Input | Path | Bytes | SHA-256 |
|---|---|---|---|
| Authoritative DOCX | `D:/ATLAS/stakeholderFiles/Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx` | 177185 | `79AEC6435D6BB718BF54760B7ADCECEBB23762F77BFCCA48C6262EAF6D1A3BF9` |
| Reference image | `D:/ATLAS/stakeholderFiles/teacherSched+LoadActual.png` | 447707 | `359E6E4D3DD6D227302B829FEF74B99B4F27348B75B0F5A6F576C994EB3AD34C` |

Both were copied to `%TEMP%` and inspected (image read directly; DOCX unzipped,
`document.xml`/`header1.xml`/`footer1.xml` text extracted, and the DOCX rendered
to PDF/PNG for visual comparison). `stakeholderFiles/**` was never modified.

## 4. Canonical per-day row matrix and teaching-load arithmetic

Real-builder fixture (`build-teacher-program-fixture.mts`) — Grade 10 afternoon
program, 12 canonical intervals, five 45-minute Science 10 sessions Mon–Fri,
Lunch + Health breaks, adviser credit from policy.

| Interval | Kind | Label | Min | Day scope |
|---|---|---|---|---|
| 10:00–10:45 | ANCILLARY | Ancillary Work | 45 | Monday to Friday |
| 10:45–11:30 | ANCILLARY | Ancillary Work | 45 | Monday to Friday |
| 11:30–12:15 | BREAK | Lunch Break | 45 | Monday to Friday |
| 12:15–13:00 | TEACHING | Science 10 | 45 | Monday to Friday |
| 13:00–13:45 | TEACHING | Science 10 | 45 | Monday to Friday |
| 13:45–14:30 | TEACHING | Science 10 | 45 | Monday to Friday |
| 14:30–15:15 | ANCILLARY | Ancillary Work | 45 | Monday to Friday |
| 15:15–15:30 | BREAK | Health Break | 15 | Monday to Friday |
| 15:30–16:15 | ANCILLARY | Ancillary Work | 45 | Monday to Friday |
| 16:15–17:00 | ANCILLARY | Ancillary Work | 45 | Monday to Friday |
| 17:00–17:45 | TEACHING | Science 10 | 45 | Monday to Friday |
| 17:45–18:30 | TEACHING | Science 10 | 45 | Monday to Friday |

Arithmetic (weekly): actual teaching = 1125; ancillary = 0 (never credited);
adviser credit = 60 (persisted policy + real adviser); total = 1185.
Reference-form convention (rendered): `Total minutes per day` = **225**
(per-day teaching only, excluding breaks/ancillary), load block = Class Advising
Duty **60** / Actual Teaching Load **225** / Total Teaching Load **285** — the
exact figures of the authoritative template.

## 5. Signatory persistence / snapshot authority + mounted permission matrix

**Persistence:** new append-only `teacher_program_presentation_revisions`
(school/year scoped; `revision` unique per scope; names/titles for School Head,
PSDS, CID Chief, ASDS + optional footer; `createdBy`, `auditId`, `createdAt`).
**Authority:** JWT privileged role + positive actor id + actor-school equality +
single active non-archived school year; revision CAS inside a `Serializable`
transaction; `P2002`/`P2034` → typed `PRESENTATION_PROFILE_STALE`; exactly one
`TEACHER_PROGRAM_PRESENTATION_UPDATED` audit on a committed change; a no-change
replay performs zero writes. **Snapshot binding:** published/archived exports
resolve the immutable revision effective at `publication.publishedAt`
(`created_at <= published_at`); draft/review exports use the current effective
revision. Later edits never rewrite historical output identity. The Teacher
signatory always resolves from the selected teacher; missing names render blank
lines with the canonical role titles.

| Matrix row | Result |
|---|---|
| Missing JWT | 401 `NO_TOKEN`, zero dispatch |
| Invalid JWT | 401 `INVALID_TOKEN`, zero dispatch |
| Raw system token | 401, zero dispatch |
| Non-privileged role | 403 `FORBIDDEN`, zero dispatch |
| Cross-school actor (read/preview/write) | 403 `CROSS_SCHOOL_DENIED`, zero dispatch |
| Same-school read | 200, zero writes |
| Same-school preview | 200, normalized echo, zero writes |
| Committed save | 200, revision 1, exactly one audit row |
| No-change replay | 200, `replayed:true`, zero additional rows |
| Stale `expectedRevision` | 409 `PRESENTATION_PROFILE_STALE`, zero writes |
| Validation (over-length / control char) | 400 `PRESENTATION_PROFILE_INVALID`, zero writes |
| Non-active school year | 409 `SCHOOL_YEAR_NOT_ACTIVE`, zero writes |

Disposable-PostgreSQL proof additionally exercised the real `Serializable`
transaction with concurrent saves: exactly one winner, one typed 409, exactly
one new revision + one new audit, then zero-residue database drop.

## 6. Failing-first / mutant evidence (controls 1–13)

| # | Control | Status | Evidence |
|---|---|---|---|
| 1 | class rows + policy break rows + `Ancillary Work` in exact intervals | PASS | `tt-output-c05r1-teacher-program.test.ts` control 1; FAILS on `691a7c4a` (`failing-first-old-candidate.txt`) |
| 2 | removing the configured event → ancillary, never a health break | PASS | control 2; FAILS on `691a7c4a` |
| 3 | Mon–Fri compaction once; one-day exception explicit | PASS | control 3; FAILS on `691a7c4a` |
| 4 | ancillary/break/HG/ARAL zero; ancillary-in-total mutant fails | PASS | control 4 + mutant `mutant-ancillary-in-total.txt` (7 pass / 4 fail; total 735 ≠ 330) |
| 5 | AP ordinary with true minutes | PASS | control 5 (passes on `691a7c4a` too — already correct) |
| 6 | adviser credit only with policy + real adviser | PASS | control 6 (already correct on `691a7c4a`) |
| 7 | selected-term parity; no missing-term→T1 | PASS | control 7 (already correct on `691a7c4a`) |
| 8 | signatory write authority matrix | PASS | `export-presentation-route.test.ts` 9/9; actor-school guard mutant `mutant-actorschool-route.txt` (8 pass / 1 fail); audit-omission mutant `mutant-audit-omission.txt` (8 pass / 1 fail) |
| 9 | zero-write read/preview/draft export (+published/archived resolution) | PASS | route test read/preview zero-write; control 9 instrumented export `writes=[]`; control 10 published binding |
| 10 | active-year edits change drafts, not published revisions | PASS | control 10; FAILS on `691a7c4a` |
| 11 | DOCX extraction: six headers, ordered rows, merged bands, load equation, no ARAL/ancillary load component, profile, full role hierarchy | PASS | control 11; FAILS on `691a7c4a`; blank-signatory control PASS |
| 12 | render both DOCX to PDF/PNG + side-by-side checklist | PASS | `render-checklist.md`, `png/reference/reference-page1.png`, `png/generated/generated-page1.png` |
| 13 | one page for the canonical fixture; continuation statement | PASS (continuation unexercised) | generated = 1 page, template = 1 page; six-column header is `tableHeader:true` |

Failing-first on the old candidate: **3 pass / 7 fail** (raw log
`failing-first-old-candidate.txt`). Services were byte-restored after each
mutant with `git checkout HEAD -- <path>` and verified clean.

## 7. Gate results (counts)

| Gate | Result |
|---|---|
| Server `tsc --noEmit` | exit 0 |
| Client `tsc --noEmit -p tsconfig.json` | exit 0 |
| Server `npm run build` (`tsc`) | exit 0 |
| Client `npm run build` (vite/rolldown) | exit 0 |
| Built-server dist ESM import/start (`app.js`, router, 3 services) | `ESM_IMPORT_OK` |
| `tt-output-c05r1-teacher-program.test.ts` | 11 / 11 / 0 |
| `export-presentation-route.test.ts` | 9 / 9 / 0 |
| `export-presentation-postgres.test.ts` | 1 / 1 / 0 |
| `tt-output-c05-beneficiary-parity.test.ts` | 11 / 11 / 0 |
| `timetable-output-export-c03.test.ts` | 7 / 7 / 0 |
| `tt-output-c03r.test.ts` (unchanged regression rerun; not in the correction range) | 13 / 13 / 0 |
| `tt-output-c03r3.test.ts` | 12 / 12 / 0 |
| `tt-output-c03r3-placement-term.test.ts` | 8 / 8 / 0 |
| `tt-output-c03r-route.test.ts` | 15 / 15 / 0 |
| Derived demand (`authority` + `c01r` + `c01r2`) | 10 / 10 / 0, 10 / 10 / 0, 7 / 7 / 0 |
| `publication-contract-readiness.test.ts` | all checks passed |
| `teaching-load-effective-workload-policy.test.ts` | 56 / 56 / 0 |
| `teaching-load-write-authority.test.ts` | PASS |
| `runtime-router-actor-scope.test.ts` | 1 pass / 1 skip (disposable test needs `DATABASE_URL`) |
| `generation-readiness-actor-scope-genc02r.test.ts` | 5 / 5 / 0 |
| Full client inventory (60 files) | **487 / 487 / 0 fail / 0 skipped** |
| `git diff --check` (cumulative range) | clean |

## 8. Render / checklist summary + artifact paths

All under `%TEMP%/opencode/beneficiary-export-parity-c05r1/executor/`:
`reference-template.pdf` (216685 B), `generated-teacher-program.pdf` (119207 B),
`png/reference/reference-page1.png` (163288 B),
`png/generated/generated-page1.png` (98390 B),
`teacher-program-fixture-SY2026-2027-term1.docx` (12863 B),
`teacher-program-fixture-matrix.json`, `render-checklist.md`.

Side-by-side checklist result: **PASS** for border, identity header, title/SY,
six-column geometry, merged break bands, compaction, totals row, load block,
photo/profile, signature hierarchy, footer, pagination. Four recorded
deviations, all authority-backed: ARAL row intentionally absent (contract §2.5
+ control 11); region/division/district lines omitted (no persisted source,
never invented) — SUCCESSOR; logo placeholders instead of images (no persisted
asset, never hardcoded) — SUCCESSOR; merged break bands per contract §3.
Render environment: default printer name restored (`printerRestored=True`); no
new WINWORD left by the job; port-suffix re-resolution recorded NON_BLOCKING.

## 9. Schema / migration source status

`prisma/migrations/0003_teacher_program_presentation/migration.sql` +
`prisma/schema.prisma` model `TeacherProgramPresentationRevision` are committed
as **source only**. **NO MIGRATION WAS APPLIED** to any database — not the
shared/live database, not any other database. The only execution was
`prisma generate` (client regeneration, no DB) and a guarded disposable
`atlas_restore_drill_*` database created and dropped with a zero-residue
assertion.

## 10. Residuals

| ID | Class | Note |
|---|---|---|
| R1 | NON_BLOCKING | Region/division/district identity lines and DepEd/school logo images are absent (no persisted ATLAS source; never invented). SUCCESSOR: EnrollPro branding contract. |
| R2 | NON_BLOCKING | The template's decorative page-border corner ornaments and its plain (unmerged) break rows differ from the contract-mandated single page border and merged break bands. Contract wins. |
| R3 | NON_BLOCKING | Continuation (multi-page) rendering was not exercised: the canonical fixture fits one page. The six-column header is `tableHeader:true`; no fixed-position content. |
| R4 | NON_BLOCKING | Published/archived signatory binding uses the append-only revision effective at `publishedAt` (immutable revision binding), not a JSON snapshot embedded in the publication record. Meets contract §4.5. |
| R5 | NON_BLOCKING | Default-printer `Device` port suffix was re-resolved by `SetDefaultPrinter` (`winspool,Ne03:` → `PORTPROMPT:`); the printer name is restored. Environment-only. |
| R6 | NON_BLOCKING | `runtime-router-actor-scope.test.ts` skipped its disposable-DB case because `DATABASE_URL` is unset in this shell; the same control is proven by the dedicated disposable suite for this range. |
| R7 | EXTERNALLY_BLOCKED | Disposable PostgreSQL availability depends on the host `D:/PostgreSQL/18/bin/psql.exe` and a configured `DATABASE_URL`; the push-updated migration numbering (`0003`) could collide with a future origin migration of the same number. |

## 11. `origin/main` drift and predicted integration conflicts

**Single drift snapshot.** The binding boundary is the timestamp below; `origin/main` moves, so any later reading supersedes it.

- As of **2026-09-15 16:30 Asia/Manila** (host TZ Singapore, same UTC+8 offset), fetched `origin/main` = **`c6d83cb45f11c11ae98d3e3e26787f5341a30945`**.
- Merge-base with this branch = **`84dd537bb2a2c045b8518c35b3a5372142e0080c`**.
- `git rev-list --left-right --count origin/main...HEAD` measured at `a2a6dc35` = **`57	29`** (57 commits only on `origin/main`; 29 commits only on this branch).
- This docs-only round adds two commits on this branch and none to `origin/main`, so at the final pin tip the same command reads **`57	31`**.
- Overlap lint (`git diff --name-only 84dd537b..origin/main` ∩ my cumulative paths) re-run against this snapshot: **no overlapping paths** → predicted same-file merge conflicts: **none**.
- Remaining risks: (a) both branches add files under `prisma/migrations/` — origin currently has no `0003_*`, so no collision today; (b) `prisma/schema.prisma` and `atlas-server/src/app.ts` are single-site additive edits that union cleanly; (c) `docs/plans/**` on `origin/main` is a WF lane surface this range does not touch.

## 12. Integration / push / deployment status

**NOT performed.** No merge to `main`, no push, no deployment, no shared-runtime
restart, no browser login, no live/shared-database write, no migration apply,
no generation, no publication, no term-cache or Teaching Load apply, no rollover,
no companion-repository edit. Ports 5001/5174/5175, the supervisor task, and the
durable env were untouched. All artifacts are under `%TEMP%`; the repository
contains no generated render, screenshot, or scratch file.

## 13. Single next action

Primary planner: verify the immutable range (`076b4b2d..a2a6dc35`; product/test
range `691a7c4a..0b48b1a1`), then commission fresh independent QA on the frozen
candidate (control 12/13 render evidence and the per-day totals convention are
the highest-value re-checks). Do not integrate or push from this handoff; the
migration source remains unapplied and the publication snapshot binding is
revision-based (R4).
