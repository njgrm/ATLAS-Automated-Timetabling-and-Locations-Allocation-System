# G9/G10 Canonical-Grid Feasibility Delta — 2026-09-17

**Role:** `ROLE: EXECUTOR` — one read-only vs disposable-DB measurement probe.
**Directive:** `origin/main:AGENTS.md` blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3` (recomputed from the blob bytes).
**Base:** `origin/main` `28e18b5d523d448971dd4034ea1f3d4a66d99a06` (fetch confirmed; did not move).
**Worktree / branch:** `E:/ATLAS-worktrees/g9g10-grid-delta-probe` / `probe/g9g10-grid-delta`.
**Risk tier:** LOW (read-only against live; all writes confined to a self-created disposable database).
**Disposition:** `RETIRE_AFTER_INTEGRATION`.

This artifact answers one question with real numbers:

> Does correcting the G9/G10 REGULAR canonical grid (and making the Monday-only Flag/HGP
> overlay representable) materially reduce the unassigned-session count and typed blockers?

**Short answer: the grid correction is the load-bearing lever and yields a modest reduction
(123 → 109 unassigned, 308 → 282 blockers) — but it is NOT achievable as a database-only change.**
As a pure DB change it fail-closes the entire diagnostic and the scheduler never runs. The
Flag/HGP correction as specified does not reduce Flag blockers at all; it increases them.
Neither correction touches the dominant `WORKLOAD_POLICY_BLOCK` driver.

---

## 0. Method, entry point, and mutation boundary

### 0.1 Canonical entry point (no ad-hoc scheduler logic)

| Item | Value |
|---|---|
| Function | `buildGenerationReadiness(1, 9)` |
| Source | `atlas-server/src/services/generation-readiness.service.ts:149` |
| HTTP equivalent | `GET /api/v1/generation/:schoolId/:schoolYearId/readiness/diagnostic` (`generation.router.ts`) |
| Scope | school `1` (HINIGARAN NATIONAL HIGH SCHOOL), `schoolYearId` `9` (= EnrollPro year id; active mirror `EnrollProSchoolYearMirror.id = 223`, `yearLabel = 2030-2031`) |

This is the same zero-write canonical readiness path used by the prior reconnaissance
(`docs/analysis/unassigned-feasibility-recon-2026-09-17.md`, branch `work/unassigned-feasibility-recon-c01`,
commit `67125b91`). It calls `buildGenerationPreflight`, runs the **real hybrid scheduler dry run**,
classifies every unassigned item with `classifyUnassignedBlocker`, and re-verifies zero-write before
reporting status. Ad-hoc SQL was used only to attribute blocker `sectionId`s to grade/program and to
inspect the canonical shape contracts.

### 0.2 Database boundary

- **Live database:** `atlas_recovery_clean_rebuild_20260905` on `localhost:5432` — **read-only** for
  this probe. Never written. Probed only with `pg_dump` (snapshot) and `SELECT`/`BEGIN READ ONLY` queries.
- **Snapshot:** `pg_dump --no-owner --no-privileges --serializable-deferrable` → 1,138,207-byte plain
  SQL dump (13 MB database).
- **Disposable database:** `atlas_g9g10_delta_probe`, created from that dump, all corrections applied
  there, dropped at the end (§7).
- No `class-program-slot.service.ts`, `schedule-constructor.ts`, display service, `ops/workflow/**`,
  or register file was modified. `git diff origin/main..HEAD` on the candidate contains exactly one
  added documentation file.
- No login, no browser, no generation, no publication, no runtime/port/task/env change, no migration,
  no companion write. Zero outbound HTTP requests were made (the term authority resolves from the
  persisted `termContractCache` mirror, not the network).

### 0.3 Live-database zero-mutation proof

Signature captured before and after every probe run (read-only queries):

```
runs=1 maxid=179 audits=247 maxaudit=798 locks=0 lockactions=0 tlcycles=2
own=530 facsub=183 slots=182 spol=2 sev=0 secmir=40 pubrev=0
```

`Compare-Object` of before/after → **diff-count = 0**. No audit row was created, so the run was
fully unauthenticated. The live database is byte-identical before and after this probe.

### 0.4 Dependency isolation

The probe worktree carried no `node_modules`. Lockfile identity verified equal to the base and to the
deployed tree (`atlas-server/package-lock.json` blob `ee29339c156af106302c8e74069117afbb1ee3f8`) and
an **isolated `npm ci`** was run inside the probe worktree (252 packages). No junction or shared
dependency tree was used. **Cleanup owner: this cycle's worktree retirement** (`RETIRE_AFTER_INTEGRATION`).

---

## 1. Baseline reproduction — EXACT MATCH

Command (disposable DB pointed at by `DATABASE_URL`; the live DB was never addressed):

```
cd E:/ATLAS-worktrees/g9g10-grid-delta-probe/atlas-server
npx tsx _probe-scratch/run-readiness.ts baseline <outdir>
```

| Metric | Stated baseline (packet) | **Measured** | Match |
|---|---|---|---|
| `scheduler.assignedCount` | 802 | **802** | ✓ |
| `scheduler.unassignedCount` | 123 | **123** | ✓ |
| `scheduler.classesProcessed` | — | 925 | — |
| `selectedProfileId` | `GRADE_ASC_SUBJECT_ASC` | **`GRADE_ASC_SUBJECT_ASC`** | ✓ |
| Total typed blockers | 308 | **308** | ✓ |
| `WORKLOAD_POLICY_BLOCK` | 244 | **244** | ✓ |
| `ROOM_RESOURCE_UNAVAILABLE` | 25 | **25** | ✓ |
| `SEARCH_LIMIT_UNRESOLVED` | 16 | **16** | ✓ |
| `FLAG_CEREMONY_SCOPE_INVALID` | 8 | **8** | ✓ |
| `CANONICAL_SHAPE_CAPACITY_EXCEEDED` | *(not itemized in the packet)* | **15** | see note |
| hard violations | 0 | **0** | ✓ |
| soft violations | — | 291 | — |
| `databaseSignature.zeroWrite` | — | `true` | — |

**Note on the packet's arithmetic.** The packet lists "308 typed blockers of which 244 + 25 + 16,
plus 8 `FLAG_CEREMONY_SCOPE_INVALID`" = 293. The 308 total additionally includes **15**
`CANONICAL_SHAPE_CAPACITY_EXCEEDED`, which the packet does not itemize. The measured distribution
`244 + 25 + 16 + 15 + 8 = 308` is therefore consistent with the packet's stated total; only the
itemization was incomplete. This is a documentation discrepancy, not a data discrepancy.

**Per-scope share of the 285 unassigned-session blockers: 236 / 285 = 82.8 %** in the four REGULAR
scopes (G8 REGULAR 78, G7 REGULAR 68, G9 REGULAR 50, G10 REGULAR 40), matching the stated ~82.8 %.

**Baseline is reproduced exactly. The probe is anchored.** (State `baseline`.)

---

## 2. HEADLINE FINDING — correction (a) is NOT a database-only correction

### 2.1 What was applied (disposable DB only)

The operator 2026-09-17 ruling form — G9/G10 REGULAR, 8 CLASS + 2 BREAK, shift 11:30–18:30:

```sql
-- move the Lunch BREAK row 12:15-13:00 -> 11:30-12:15
UPDATE class_program_slots SET start_time='11:30', end_time='12:15'
 WHERE school_id=1 AND school_year_id=9 AND grade_level IN (9,10)
   AND program_type='REGULAR' AND row_kind='BREAK' AND start_time='12:15' AND end_time='13:00';
-- reclaim 12:15-13:00 as the 8th canonical CLASS row
INSERT INTO class_program_slots (...) SELECT 1, 9, g, 'REGULAR', NULL, '12:15','13:00','CLASS', ... FROM (VALUES (9),(10)) v(g);
```

Verified result: `BREAK:11:30-12:15, CLASS:12:15-13:00, CLASS:13:00-13:45, CLASS:13:45-14:30,
CLASS:14:30-15:15, BREAK:15:15-15:30, CLASS:15:30-16:15, CLASS:16:15-17:00, CLASS:17:00-17:45,
CLASS:17:45-18:30` → **8 CLASS + 2 BREAK**, span 11:30–18:30 = 420 min. Exactly as specified.

### 2.2 Observed result — the scheduler NEVER RUNS

| Metric | Baseline | **A (grid only)** |
|---|---|---|
| `scheduler.ran` | true | **false** |
| `scheduler.assignedCount` | 802 | **0 (not measured — see note)** |
| `scheduler.unassignedCount` | 123 | **0 (not measured — see note)** |
| `CANONICAL_TEMPLATE_INCOMPLETE` | 0 | **2** |
| `missingScopes` | `[]` | **`[G9 REGULAR, G10 REGULAR]`** |
| `CANONICAL_SHAPE_CAPACITY_EXCEEDED` | 15 | 3 |
| `FLAG_CEREMONY_SCOPE_INVALID` | 8 | 8 |
| Total blockers | 308 | 13 |

> **The `0` values are the initialised default, not a measured zero.** `runHybridScheduler` is only
> invoked when `assembly.schedulerCanRun` is true; it was false, so no scheduler result exists.
> Reporting "0 unassigned" here would be a serious misreading.

Coverage issues reported for both scopes:

```
G9  REGULAR: classRows=8 rows=10 issues=[missing:12:15-13:00-BREAK,
              unexpected:11:30-12:15-BREAK, unexpected:12:15-13:00-CLASS]
G10 REGULAR: (identical)
```

### 2.3 Root cause (source evidence)

1. `atlas-server/src/services/class-program-slot.service.ts:208-218` — `GRADE_9_10_REGULAR`
   **hard-codes** the 7-CLASS grid with `12:15-13:00 BREAK` "Lunch Break". The in-source canonical
   template, not only the persisted rows, encodes the grid the packet calls defective.
2. `atlas-server/src/services/class-program-slot.service.ts:240-259` — `validateCanonicalTemplateRows`
   compares the persisted row keys `${startTime}-${endTime}-${rowKind}` against the template with
   **exact set equality** (`missing:` for every expected key absent, `unexpected:` for every actual
   key not expected, plus a duplicate check).
3. `atlas-server/src/services/generation-preflight.service.ts:888-906` — any scope whose coverage
   `issues.length > 0` is pushed into `missingSlotScopes` and raises `CANONICAL_TEMPLATE_INCOMPLETE`.
4. `generation-preflight.service.ts:1124` — `schedulerCanRun` requires
   `missingSlotScopes.length === 0`. It is false, so the dry run is skipped and
   `CANONICAL_SHAPE_CAPACITY_EXCEEDED` (which needs the scheduler's per-term demand) collapses 15 → 3.

### 2.4 Consequence

**The corrected G9/G10 REGULAR grid cannot be reached by a database-only change.** The required
correction is a source change to `class-program-slot.service.ts` (`GRADE_9_10_REGULAR`) — a file this
packet explicitly forbids touching — followed by a re-seed of the persisted rows. Any operator plan
that treats the grid correction as a configuration-only apply is wrong: it would fail closed and
leave the diagnostic reporting `CANONICAL_TEMPLATE_INCOMPLETE` with **no** scheduler result at all.

Capacity arithmetic that *would* change if the grid were correct: `computeCanonicalCapacityBlockers`
uses `capacity = classRows * 5`, so G9/G10 REGULAR moves 7×5 = **35** → 8×5 = **40** required weekly
sessions per term.

---

## 3. Correction (b) — Flag/HGP overlay as specified

### 3.1 What was applied (disposable DB only)

The packet's corrected form: scoped Monday-only `PolicySpecialEvent` `FLAG_OR_HGP` rows plus the
reconciled global `scheduling_policies` flag window.

```sql
INSERT INTO policy_special_events (school_id, school_year_id, event_type, label, grade_group,
  program_type, start_time, end_time, enabled, sort_order, created_at, updated_at)
VALUES (1,9,'FLAG_OR_HGP','Flag Ceremony/HGP (7-8 shift)','7-8',NULL, :window_start, :window_end, true, 1, now(), now()),
       (1,9,'FLAG_OR_HGP','Flag Ceremony/HGP (9-10 shift)','9-10',NULL, :window_start, :window_end, true, 2, now(), now());
UPDATE scheduling_policies SET flag_ceremony_start_time=:window_start, flag_ceremony_end_time=:window_end
 WHERE school_id=1 AND school_year_id=9;
```

`policy_special_events` has **no day column**, so a persisted `FLAG_OR_HGP` row is implicitly
Monday-only: `resolveFlagCeremonyDayAuthority` maps an absent day to `MONDAY` with
`explicitNonMonday=false` (`atlas-server/src/lib/policy-special-events.ts:68-77`). The scoped rows
therefore satisfy the Monday-only contract by construction.

### 3.2 The snap check is GLOBAL, not per-scope

`generation-preflight.service.ts:1008-1049` selects **one** `configuredFlagEvent`
(`persistedFlagEvents.find(...)`, i.e. the lowest `sortOrder`) and validates **that single window**
against `resolveContainingClassRow` for **every** shape in `timetableShapeContracts` — a declared
requirement of exactly one containing canonical CLASS row. `gradeGroup`/`programType` on the special
event are **not consulted** by this check anywhere in the source.

The probe confirmed **16 shape contracts** exist (grades 7–10 × REGULAR/STE/SPS/SPA). The window must
therefore be contained by a CLASS row in **all 16** shapes simultaneously. It cannot be:

| Scope class | CLASS rows start | Shared with |
|---|---|---|
| G7/G8 REGULAR | 06:00 … 11:30 | morning rows only — day ends 12:15 |
| G7/G8 STE/SPS/SPA | 06:00 … 11:30, 13:00, 13:45 | 13:00-13:45 and 13:45-14:30 shared with G9/G10 |
| G9/G10 REGULAR (corrected) | 12:15, 13:00 … 17:45 | afternoon rows only |
| G9/G10 STE/SPS/SPA | 09:45 … 11:15, 13:00 … 17:45 | 13:00-13:45 and 13:45-14:30 shared with G7/G8 specials |

G7/G8 REGULAR shares **no** interval with any G9/G10 shape, so no single window can satisfy both
groups. The best achievable single-window coverage is a shared afternoon row such as `13:00-13:45`
or `13:45-14:30`, which satisfies 14 of 16 shapes and fails only G7 REGULAR and G8 REGULAR.

### 3.3 Measured results

| State | Window | Scheduler ran | FLAG blockers | FLAG blocker scopes |
|---|---|---|---|---|
| Baseline | 07:00–07:30 | yes | **8** | G9 + G10, all four programs |
| B only (DB-only) | 12:15–13:00 | yes | **16** | **all 16 shapes** |
| A + B (DB-only) | 12:15–13:00 | no | **14** | all except G9/G10 REGULAR |
| A + B (DB-only) | 13:00–13:45 | no | **2** | G7 REGULAR, G8 REGULAR |

**The packet's specified window makes the Flag defect worse, not better.** Moving the global window to
the corrected 12:15–13:00 advisory row raises `FLAG_CEREMONY_SCOPE_INVALID` from 8 to 16, because
`12:15-13:00` is a `BREAK` row in all fourteen shapes that are not G9/G10 REGULAR. Only a shared
*afternoon* CLASS row (`13:00-13:45`) reduces the count, and it cannot reach zero for the reason in §3.2.

---

## 4. Corrections combined, measured

### 4.1 Database-only states

| State | Scheduler ran | assigned | unassigned | total blockers | WL | ROOM | SEARCH | SHAPE | FLAG | TPL |
|---|---|---|---|---|---|---|---|---|---|---|
| **baseline** | yes | 802 | 123 | 308 | 244 | 25 | 16 | 15 | 8 | 0 |
| A (grid) | **no** | n/m | n/m | 13 | 0 | 0 | 0 | 3 | 8 | **2** |
| B (flag 12:15–13:00) | yes | 805 | 120 | 311 | 245 | 25 | 10 | 15 | **16** | 0 |
| A+B (flag 12:15–13:00) | **no** | n/m | n/m | 19 | 0 | 0 | 0 | 3 | 14 | **2** |
| A+B (flag 13:00–13:45) | **no** | n/m | n/m | 7 | 0 | 0 | 0 | 3 | 2 | **2** |
| **negative control** | yes | **802** | **123** | **308** | **244** | **25** | **16** | **15** | **8** | 0 |

`n/m` = not measured (the scheduler did not execute; `0` is the default initialiser, not a result).

### 4.2 Counterfactual states — grid effect WITH the template expectation aligned

> **These rows are labelled `COUNTERFACTUAL` and are NOT database-only.**
> Because §2 blocks the DB-only path, the grid effect can only be measured by also modelling the
> source-side template change. The harness injected a `Proxy` over the Prisma client whose **only**
> effect was to answer `readCanonicalClassProgramSlotsCoverage()`'s `findMany` with the row set the
> **current** source template expects, so that the exact-set gate passes while
> `resolveClassProgramSlots()` — which feeds the real scheduler — still reads the **corrected** DB
> grid. Two coverage queries were instrumented per run. No product file was modified on disk.
> This models "`GRADE_9_10_REGULAR` was updated to the corrected grid"; it is **not** a shippable
> state and it is **not** reachable by a configuration-only apply.

| State (counterfactual) | assigned | unassigned | vs base | total blockers | vs base | WL | ROOM | SEARCH | SHAPE | FLAG |
|---|---|---|---|---|---|---|---|---|---|---|
| **baseline** | 802 | 123 | — | 308 | — | 244 | 25 | 16 | 15 | 8 |
| **A only** (grid; flag untouched) | 816 | **109** | **−14** | **282** | **−26** | 245 | 20 | 6 | 3 | 8 |
| **A + B** (flag 12:15–13:00) | **817** | **108** | **−15** | 285 | −23 | 245 | 21 | 2 | 3 | 14 |
| **A + B** (flag 13:00–13:45) | 811 | 114 | −9 | 291 | −17 | 242 | 20 | 24 | 3 | **2** |

Per-scope breakdown of the 285 unassigned-session blockers (for reference; T1/T2/T3 instances):

| Scope | baseline | CF A only | CF A+B (12:15) | CF A+B (13:00) |
|---|---|---|---|---|
| G7 REGULAR | 68 | 68 | 65 | 62 |
| G8 REGULAR | 73 | 73 | 75 | 75 |
| G9 REGULAR | 45 | 46 | 45 | 47 |
| G10 REGULAR | 30 | 30 | 30 | 33 |
| **REGULAR subtotal** | **216** | **217** | **215** | **217** |
| G7 SPA | 5 | 5 | 5 | 5 |
| G7 STE | 1 | 1 | — | 1 |
| G7 SPS | 3 | 3 | — | — |
| G8 SPS | 17 | 17 | 20 | 14 |
| G8 STE | 5 | 5 | 5 | 5 |
| G8 SPA | 3 | 3 | — | — |
| G9 SPS | — | — | — | — |
| G10 STE | — | — | — | — |
| **Total (285-session subset)** | **285** | — | — | — |

By blocker code and scope (baseline → CF A only → CF A+B 12:15 → CF A+B 13:00):

- `CANONICAL_SHAPE_CAPACITY_EXCEEDED`: 15 (G10 REGULAR 6, G9 REGULAR 6, G10 STE 3) → **3** (G10 STE only) in every corrected state. G9/G10 REGULAR clear entirely.
- `ROOM_RESOURCE_UNAVAILABLE`: 25 (G10 STE 15, G10 REGULAR 5, G8 REGULAR 5) → 20 (G10 STE 15, G8 REGULAR 5) → 21 (+G10 REGULAR 1) → 20.
- `SEARCH_LIMIT_UNRESOLVED`: 16 (G10 REGULAR 5, G9 REGULAR 5, G7 SPS 3, G8 SPA 3) → 6 (G7 SPS 3, G8 SPA 3) → 2 → **24** (8 scopes × 3).
- `WORKLOAD_POLICY_BLOCK`: 244 → 245 → 245 → 242. **Essentially unmoved by either correction.**
- `FLAG_CEREMONY_SCOPE_INVALID`: 8 → 8 → 14 → 2.

---

## 5. Negative control — PASS

Reverted correction (a) (delete the reclamation CLASS rows, restore the Lunch BREAK from a
pre-change backup table) and correction (b) (delete the `FLAG_OR_HGP` rows, restore
`flag_ceremony_start_time='07:00'` / `flag_ceremony_end_time='07:30'`), then re-ran the identical
path.

| Table | Baseline fingerprint | Negative-control fingerprint | Result |
|---|---|---|---|
| `class_program_slots` (full row md5) | `9138caa689cc727c9bd169710c49e2d7` | `9138caa689cc727c9bd169710c49e2d7` | **identical** |
| `policy_special_events` (full row md5) | `(empty)` | `(empty)` | **identical** |
| `scheduling_policies` (full row md5) | `82dc5f3d1f695f534c8a3f2301788f19` | `7092be3d372e075bde8711ad414c2b2c` | differs — `updatedAt` only |

The `scheduling_policies` difference is **exclusively the `"updatedAt"` timestamp written by the
revert `UPDATE`**; that column is `@updatedAt`-managed and is not part of the configuration contract.
A semantic hash over every `scheduling_policies` column except `"updatedAt"` computed **independently
against the live database** (read-only) and against the negative-control disposable database:

| Hash | Live (read-only) | Negative-control disposable |
|---|---|---|
| `slots_full` | `9138caa689cc727c9bd169710c49e2d7` | `9138caa689cc727c9bd169710c49e2d7` |
| `slots_semantic` | `506ae5f82d629aa8d216461ce8e4ddba` | `506ae5f82d629aa8d216461ce8e4ddba` |
| `sev_full` | `(empty)` | `(empty)` |
| `spol_semantic` | `55655f2af33aec730aa271cd93f4b1f8` | `55655f2af33aec730aa271cd93f4b1f8` |

**Readiness numbers returned to the baseline exactly:**

| Metric | Baseline | Negative control | Match |
|---|---|---|---|
| assigned | 802 | **802** | ✓ |
| unassigned | 123 | **123** | ✓ |
| total blockers | 308 | **308** | ✓ |
| `WORKLOAD_POLICY_BLOCK` | 244 | **244** | ✓ |
| `ROOM_RESOURCE_UNAVAILABLE` | 25 | **25** | ✓ |
| `SEARCH_LIMIT_UNRESOLVED` | 16 | **16** | ✓ |
| `CANONICAL_SHAPE_CAPACITY_EXCEEDED` | 15 | **15** | ✓ |
| `FLAG_CEREMONY_SCOPE_INVALID` | 8 | **8** | ✓ |
| `selectedProfileId` | `GRADE_ASC_SUBJECT_ASC` | **`GRADE_ASC_SUBJECT_ASC`** | ✓ |
| hard / soft violations | 0 / 291 | **0 / 291** | ✓ |
| `zeroWrite` | true | **true** | ✓ |

---

## 6. Cleanup proof

```
DROP DATABASE IF EXISTS atlas_g9g10_delta_probe WITH (FORCE);   -- exit 0
SELECT count(*) FROM pg_database WHERE datname='atlas_g9g10_delta_probe';  -- 0
SELECT count(*) FROM pg_database WHERE datname LIKE '%g9g10%' OR datname LIKE '%delta_probe%';  -- 0
```

- Disposable database dropped; absence asserted twice (exact name and pattern).
- No database, table, role, or backup artefact created on the Postgres instance survives.
- Live-database signature identical before/after (diff-count 0, §0.3).
- The probe worktree's scratch harness (`atlas-server/_probe-scratch/`) and every `.sql` file lived
  outside the committed tree; nothing but the single analysis artifact is staged.
- Retained fallback: the full read-only snapshot (`live-snapshot.sql`) remains in `%TEMP%` only and is
  not committed.

---

## 7. What this measures — and what it does NOT

### 7.1 Direct answers

1. **Baseline:** reproduced exactly (802/123, 308 blockers, hard 0, profile `GRADE_ASC_SUBJECT_ASC`).
2. **Grid correction (a), database-only: NOT POSSIBLE.** It fail-closes the diagnostic with
   `CANONICAL_TEMPLATE_INCOMPLETE` ×2 and the scheduler does not run. A source change to
   `class-program-slot.service.ts` (`GRADE_9_10_REGULAR`, lines 208-218) is a prerequisite.
3. **Grid correction (a), with the template aligned (counterfactual): real but modest.** Unassigned
   **−14** (123 → 109, −11.4 %), typed blockers **−26** (308 → 282, −8.4 %), driven by
   `CANONICAL_SHAPE_CAPACITY_EXCEEDED` −12, `SEARCH_LIMIT_UNRESOLVED` −10 and
   `ROOM_RESOURCE_UNAVAILABLE` −5.
4. **Flag/HGP correction (b) as specified does not fix the Flag defect.** Window `12:15-13:00` is a
   BREAK row in 14 of 16 shapes: DB-only it raises FLAG 8 → **16**; combined with (a) it holds FLAG at
   **14**. Only a shared afternoon CLASS row (`13:00-13:45`) reaches FLAG **2**, and it cannot reach 0
   because G7/G8 REGULAR share no interval with G9/G10.
5. **Neither correction addresses the dominant driver.** `WORKLOAD_POLICY_BLOCK` stays 244 → 242–245
   in every measured state. It remains ~85 % of the unassigned-session blockers.
6. **No measured state reaches `generateAllowed`.** `status` stays `BLOCKED`; the best combined state
   (817 assigned / 108 unassigned) still carries 285 blockers.

### 7.2 NOT verified

1. **The deployed runtime.** Every number here is from **current `origin/main` `28e18b5d` source**
   executed against a disposable copy of the live database. The running release is
   `3d916b26`/`54dce67b` lineage; this probe did not read, restart, or compare against it.
2. **Any real generation or persisted run.** No `GenerationRun` was created; these are dry-run
   results from the canonical readiness scheduler, not a completed run.
3. **Publication or rendered output.** No export, Class Program workbook, or published revision was
   produced or inspected.
4. **Browser/UX.** No login, no browser session, no Tailnet page origin asserted.
5. **The counterfactual rows' shippability.** §4.2 required a client-side instrument; it proves the
   *scheduler's* response to an 8-CLASS grid, not that such a grid can be deployed without the
   matching source change.
6. **Whether the operator's 11:30–12:15 afternoon lunch ruling is correct as product intent.** This
   probe measured consequences; it did not adjudicate the ruling. Note the in-source template and all
   182 persisted rows currently encode 12:15–13:00, so the ruling implies both a source and a data change.
7. **Blocker attribution beyond `sectionId`.** `FLAG_CEREMONY_SCOPE_INVALID` and
   `CANONICAL_TEMPLATE_INCOMPLETE` carry no `sectionId`; their scope was derived from the shape
   contract list, not from a per-section field.
8. **Long-run stability of the scheduler's profile selection.** Each state was measured once;
   `runtimeMs` and the soft-violation split varied slightly (291–312) between runs, though
   `assigned`/`unassigned`/blocker codes were stable and reproduced exactly on the negative control.
9. **Any other active writer of `class_program_slots`.** This probe did not inventory seed/repair paths
   that could re-write the grid; it only read the current persisted rows and applied its own changes
   in a disposable copy.

### 7.3 Risks / cautions for the planner

- Treating the grid correction as a configuration apply would silently stop the readiness diagnostic
  from running its scheduler at all (`scheduler.ran=false`), which is easy to misread as "0 unassigned".
- The proposed `PolicySpecialEvent` scoping does not work as written: the snap check is global, so
  scoping the event rows has no effect on it. Fixing the Flag overlay to be genuinely per-shift is a
  **source** change (the check would have to consult the event's `gradeGroup`/`programType` when
  selecting the window per shape), not a data change.
- The measured blocker reduction from the grid is real but ~8 %, and it leaves the workload-policy
  driver untouched.

---

## 8. Reproduction

Snapshot and disposable database (live read-only):

```powershell
# 1. read-only snapshot (never writes the live DB)
pg_dump --no-owner --no-privileges --serializable-deferrable -f live-snapshot.sql
# 2. disposable database
psql -c "CREATE DATABASE atlas_g9g10_delta_probe;"
psql -d atlas_g9g10_delta_probe -v ON_ERROR_STOP=1 -f live-snapshot.sql
# 3. point DATABASE_URL at the disposable database only
$env:DATABASE_URL = <live url with /atlas_g9g10_delta_probe>
```

Corrections are in §2.1 (a) and §3.1 (b); revert/negative control in §5. Each state was measured with:

```powershell
cd atlas-server
npx tsx _probe-scratch/run-readiness.ts       <label> <outdir>   # canonical path
npx tsx _probe-scratch/run-readiness-cf.ts    <label> <outdir>   # counterfactual instrument (§4.2)
```

The scratch harness was worktree-local and deleted before the candidate commit; the SQL above is the
complete correction set.

---

## 9. Evidence index

| Artefact | Location (not committed) |
|---|---|
| Per-state readiness summaries / blockers / raw results | `%TEMP%/opencode/g9g10-probe/<label>.{summary,blockers,readiness}.json` |
| Correction / revert SQL | `%TEMP%/opencode/g9g10-probe/0{1..5}-*.sql`, `99-negative-control.sql` |
| Baseline + negative-control table fingerprints | `%TEMP%/opencode/g9g10-probe/baseline-table-fingerprints.txt`, `negative-control-fingerprints.txt` |
| Live signature before/after + disposal evidence | `%TEMP%/opencode/g9g10-probe/live-signature-{before,after}.txt`, `cleanup-proof.txt`, `nc-vs-live.txt` |
| Read-only live snapshot | `%TEMP%/opencode/g9g10-probe/live-snapshot.sql` |
