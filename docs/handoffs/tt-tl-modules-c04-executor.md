# TT-TL-MODULES-C04R1 — Executor Handoff

- Role: EXECUTOR. Returns `REVIEW_REQUIRED` only; no self-approval.
- Worktree: `D:/ATLAS-worktrees/tt-tl-modules-c04`
- Branch: `work/tt-tl-modules-c04`
- Cumulative base: `d4e9dc8e07869725d4beb55b30c4502650597d24`
- Commit chain: `6a8f4717` → `a09a4316` → `5afdd1cd` → `117beeb9` → **`e7916315`** (this correction)
- Product candidate SHA: `e7916315843ef74e0b4f64c9b8e41d7e63cddde4`
- Docs tip: this document, quoted in the executor's return message.
- Canonical directive: `origin/main:AGENTS.md`, LF-normalized SHA-256
  `F4F86185F2A0B4D78B50E8375F72E35B9F6E8A788A6F558952C2B29BE174CE64`. The
  worktree-local `AGENTS.md` is stale and was neither modified nor used.

## 1. Cumulative changed paths (18)

Product:
- `atlas-client/src/components/timetable/TacticalSandboxDock.tsx`
- `atlas-client/src/components/timetable/TacticalSandboxDock.parts.tsx`
- `atlas-client/src/components/timetable/TacticalSandboxDock.helpers.ts`
- `atlas-client/src/components/timetable/TacticalSandboxDock.useTeachingLoadModules.ts`
- `atlas-client/src/components/timetable/TeacherDepartureRecoverySheet.tsx`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/simple/SimpleDriftBanner.tsx`
- `atlas-server/src/routes/faculty-assignment.router.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/department-authority.service.ts`

Tests:
- `atlas-client/src/lib/__tests__/timetable-dynamic-workspace-rendered.test.ts`
- `atlas-client/src/lib/__tests__/tt-tl-modules-contract.test.ts`
- `atlas-client/src/lib/__tests__/tt-tl-modules-helpers.test.ts`
- `atlas-client/src/lib/__tests__/tt-tl-modules-c04r1-contract.test.ts`
- `atlas-client/src/lib/__tests__/tt-tl-modules-c04r1-behavior.test.ts`
- `atlas-server/src/__tests__/tt-tl-modules-contract.test.ts`
- `atlas-server/src/__tests__/capability-override-mount.test.ts` (new, F2)

Docs:
- `docs/handoffs/tt-tl-modules-c04-executor.md` (this file)

## 2. C04R1 trace table (F1–F5)

| Req | Production path | Negative control | Verification command | Outcome |
|---|---|---|---|---|
| F1 | `TeacherDepartureRecoverySheet.tsx` renders `describeDepartureRepairTruth(isPublished, …)` at `teacher-departure-truth` and `teacher-departure-window-confirmation`; published mode validates only `revisionDateError(revisionEffectiveDate)` | rendered body has no `type="date"`, no `teacher-departure-window-start/end/indefinite`, no `absenceWindow*`; absence-window mutant test rejects reintroduction | `npx tsx --test src/lib/__tests__/tt-tl-modules-c04r1-behavior.test.ts` | **PASS** — 6/6 |
| F2 | `faculty-assignment.router.ts` `parseCapabilityOverrideScope` + `rejectCapabilityOverrideScope` on GET/preview/apply; retired PUT/DELETE → 410; `faculty-assignment.service.ts` preview/apply fingerprint + revision + Serializable transaction; read path is zero-write | missing actor school, malformed IDs, cross-school, archived/historical year, stale fingerprint, concurrent source drift, duplicate replay, system token — each with zero writes | `npx tsx src/__tests__/capability-override-mount.test.ts` (disposable DB) | **PASS** — 69/69 |
| F3 | `department-authority.service.ts` preview returns `confirmationText: DEPARTMENT_AUTHORITY_APPLY_CONFIRMATION`; apply requires it exactly; client binds `preview.confirmationText` only | mutating either side alone fails: client contract suite asserts no client constant and requires `confirmationText !== preview.confirmationText` gating | `npx tsx --test src/lib/__tests__/tt-tl-modules-c04r1-contract.test.ts` + helpers suite | **PASS** — 11/11 + 23/23 |
| F4 | `TimetableSimpleHeader.tsx` derives `isRunPublished = isRunPublishedStrict(draftSummaryRaw)` and passes it to `SimpleDriftBanner`; banner gates sync/dispatch and renders `timetable-simple-published-drift-guidance` | loose-predicate mutant: retained `publishedAt`/`publishedBy` on a superseded run still renders the sync action when `isPublished` is false | `npx tsx --test src/lib/__tests__/tt-tl-modules-c04r1-behavior.test.ts` | **PASS** — rendered 3/3 F4 rows |
| F5 | `TacticalSandboxDock.tsx` presenter; mini-module section extracted to `TeachingLoadModulesSection` in `TacticalSandboxDock.parts.tsx` | physical-line gate fails if the dock exceeds 900 | `npx tsx --test src/lib/__tests__/tt-tl-modules-c04r1-contract.test.ts` | **PASS** — dock 882 phys (≤900); all touched files ≤1000 |

## 3. Corrections applied in `e7916315`

1. **F5** — dock was 919 physical lines (above the 900 target). Extracted the
   focused mini-module section into `TeachingLoadModulesSection` (parts), behavior
   unchanged. Dock → 882.
2. **F1 rendered control** — Radix `SheetContent` renders through a client portal
   that `renderToStaticMarkup` cannot emit, so the C04R1 behavior suite rendered
   `''`. Split the sheet into a portal-free `TeacherDepartureRecoverySheetBody`
   (the real interior) plus the thin `TeacherDepartureRecoverySheet` wrapper. The
   rendered F1 rows now execute the production interior: 6/6.
3. **Stale assertions in the original suite** — `tt-tl-modules-contract.test.ts`
   (untouched since `6a8f4717`) still asserted the removed absence window and the
   removed client confirmation constant, so it failed 7/14 while contradicting
   F1/F3. Repaired those assertions to the corrected contract and relocated
   production paths (mini-modules now live in the extracted hook). No coverage
   was deleted; the suite is 14/14.
4. **F2 fail-open GET** (new mounted suite caught it) — `GET
   /capability-overrides` accepted an actor with **no** school and dispatched the
   read (`rejectSchoolScopeConflict` is permissive for the documented
   integration-token surface). Added `rejectCapabilityOverrideScope`, then used
   it on all three capability-override routes: missing actor school → 403
   `ACTOR_SCHOOL_REQUIRED`, cross-school → 403 `SCHOOL_MISMATCH`.
5. **F2 write-on-read** — `listTeachingLoadCapabilityOverrides` called
   `getOrCreatePolicy`, creating a `schedulingPolicy` row on a GET. Replaced with
   a read-only `findUnique`; a missing policy now means "no stored overrides".

## 4. Failing-first / mutant evidence

- **F2 actor-school guard**: before the fix the mounted suite recorded
  `F2-a GET missing actor school → 200` and a policy row created by the read
  (zero-write checks failed). After the fix: 403 `ACTOR_SCHOOL_REQUIRED` and
  `policy=0 / audit=0` on every rejection row.
- **F3 server-issued confirmation**: `tt-tl-modules-c04r1-contract` asserts the
  four client files declare no `DEPARTMENT_AUTHORITY_CONFIRMATION_PHRASE` and
  that `buildQualificationApplyPayload` returns `null` unless the typed value
  equals `preview.confirmationText`; helpers suite covers the mutated-preview
  case. The pre-fix original suite asserted the local constant and failed.
- **F4 published sync gate**: `tt-tl-modules-c04r1-behavior` renders the banner
  with `isPublished=true` (no sync/impact/repair testids) and with a
  loose-marker superseded draft + `isPublished=false` (sync present), proving the
  strict prop is the only authority.
- **F1 absence-window removal**: the behavior suite renders the real interior in
  both modes and asserts no date input, no window testids, no "until further
  notice"; the pre-fix render contained `teacher-departure-window-start`.
- **F2 drift/replay**: `F2-e` wrong fingerprint → 409 `FINGERPRINT_MISMATCH`;
  `F2-f` interleave (unrelated policy write between preview and apply) → 409
  `CAPABILITY_OVERRIDE_SOURCE_DRIFT` with no audit row; `F2-g` re-preview then
  re-apply → `replayed:true` with zero new rows.

## 5. Command outcomes (frozen tip `e7916315`)

Client (`npx tsx --test`, all exit 0): `tt-tl-modules-contract` 14/14,
`tt-tl-modules-helpers` 23/23, `tt-tl-modules-c04r1-contract` 11/11,
`tt-tl-modules-c04r1-behavior` 6/6, `timetable-dynamic-workspace-rendered` 8/8,
`npm run test:timetable-operator-ux` 58/58, plus `-drift` 8/8, `-publication`
8/8, `-capabilities-guard` 7/7, `-behavioral` 12/12, `-r2-consumers` 3/3,
`-scope-links` 6/6, `-truth-fixes` 11/11, `-undo-redo` 8/8.

Server (disposable DB, all exit 0): `capability-override-mount` 69/69,
`tt-tl-modules-contract` 21/21, `tt-tl-authority-guard-c04` 46/46,
`department-authority-apply` 63/63, `teaching-load-suggestion-apply-parity`
34/34, `teaching-load-write-authority` exit 0.

Type-check/build: server `tsc --noEmit` exit 0; server `npm run build` exit 0;
client `tsc --noEmit` exit 0; client `npm run build` exit 0.

Built-server import/startup + mounted touched-route probe (built `dist/server.js`,
disposable DB, ephemeral port): `startup_ready=true`, `health_status=200`,
`GET /faculty-assignments/capability-overrides` unauthenticated → `401 NO_TOKEN`
(route mounted, not 404), bogus token → `401`, process alive after probes.

`git diff --check` exit 0; `git diff --cached --check` exit 0.

## 6. Physical / nonblank line counts

| File | Physical | Nonblank |
|---|---|---|
| `TacticalSandboxDock.tsx` | 882 | 841 |
| `TacticalSandboxDock.parts.tsx` | 800 | 777 |
| `TacticalSandboxDock.useTeachingLoadModules.ts` | 355 | 344 |
| `TacticalSandboxDock.helpers.ts` | 612 | 549 |
| `TeacherDepartureRecoverySheet.tsx` | 811 | 774 |
| `TimetableSimpleHeader.tsx` | 813 | 779 |
| `SimpleDriftBanner.tsx` | 214 | 206 |

## 7. Disposable database and zero residue

- Database: `atlas_restore_drill_20260914_c04r1a` (classification: **disposable**;
  PostgreSQL 18.1 at `localhost:5432`). Schema applied with
  `npx prisma migrate deploy --schema=../prisma/schema.prisma` — 3 migrations
  (`0000_clean_baseline`, `0001_term_subject_authority`, `0002_companion_sso_code`).
  The configured `.env` database was never a mutation target and was never printed.
- Teardown: `DROP DATABASE atlas_restore_drill_20260914_c04r1a WITH (FORCE)`;
  post-drop `pg_database` count for that name returned `0` — **zero residue**.
  The two unrelated disposable databases
  (`atlas_restore_drill_20260911_uxc01rc6e5ba0d`,
  `atlas_restore_drill_20260912_rrtc80be4ffb`) were observed and left untouched.

## 8. Clean-state proof

At the frozen tip: `git status --porcelain=v2` is empty and `git diff --quiet`
exits `0`.

## 9. Integration conflict forecast

- Refreshed `origin/main` = `bba85ea5d69ac7f53ffb87c01d734f8e235c5299`
  (the packet's `ab75c131` has advanced by one docs commit).
- Branch is ahead 5 / behind 18 vs `origin/main`; merge-base is exactly
  `d4e9dc8e`.
- `origin/main` changed 39 paths since the base; the branch changed 18.
  **Path overlap: none.** The only plausible integration conflicts are shared
  documentation (`CHANGELOG.md`, living register) owned by the integration owner.
- No remote branch contains HEAD; the branch was never pushed.

## 10. Known risks / BLOCKED

- **Not re-run (data-dependent):** `teaching-load-summary-zero-write-route.test.ts`
  requires an active non-archived school-year mirror and fails on an empty
  disposable DB (`[FAIL] active non-archived school year resolves (found 0)`). It
  is not in the C04R1 required gate list and touches no changed code path.
- **Pre-existing, environment:** `department-authority-gates.test.ts` 82 total /
  81 pass / 1 fail — `sidecar carries the exact byte SHA of the artifact file`.
  `docs/verification/department-authority-apply-r4a.json` is checked out with
  CRLF, so its on-disk byte hash (`44ADC028…`) differs from the sidecar
  (`D1D8E74E…`); the LF-normalized hash equals the sidecar exactly, and the
  artifact + sidecar are **byte-identical between base `d4e9dc8e` and this tip**.
  This is a checkout line-ending artifact, not a candidate regression.
- **Previously recorded pre-existing:** `teaching-load-reconciliation.test.ts`
  and `teaching-load-reconciliation-route.test.ts` were recorded failing at the
  base by the prior C04 executor pass; they were not re-run this pass and no
  changed code path is shared with them.
- **DEFERRED (D1):** persisted faculty availability remains out of scope; no
  availability table, endpoint, or automatic reversion was added.

## 11. No-mutation statement

No live or shared-database write, Teaching Load apply, generation, publication,
deployment/restart, schema/migration apply against the configured database,
login, browser use, companion-repository edit, integration, push, merge, rebase,
amend, or history rewrite was performed. The living register, `CHANGELOG.md`, the
runtime source-of-truth map, and both governing packets were not modified. The
only database activity was against the uniquely named disposable database, which
was dropped with proven zero residue.

## 12. Return

`REVIEW_REQUIRED`
