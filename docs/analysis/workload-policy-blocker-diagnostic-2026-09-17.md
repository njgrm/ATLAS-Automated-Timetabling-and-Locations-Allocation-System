# Workload-Policy Blocker Diagnostic — 2026-09-17

**Role:** `ROLE: EXECUTOR` — one read-only-vs-disposable-DB diagnostic. No product source,
test, `ops/workflow/**`, or register file was edited; one analysis artifact is committed.

**Directive:** `origin/main:AGENTS.md` blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`
(recomputed from the raw blob bytes via `git cat-file -p <blob>`, byte-safe redirect,
CRLF→LF normalized; verified MATCH). `D:/ATLAS/AGENTS.md` was never read.

**Base:** `origin/main` = `056f2e4bf3e3beca20d52aa0ab4f96ab19875f01` (`git fetch origin main`
confirmed; the packet's expected `28e18b5d` is an **ancestor**, verified with
`git merge-base --is-ancestor`).

**Worktree / branch:** `E:/ATLAS-worktrees/workload-blocker-diagnostic` /
`probe/workload-blocker-diagnostic` (created from `origin/main`, E: 68.4 GiB free at start).
**Risk tier:** LOW (live DB read-only; every write confined to a self-created disposable database).
**Disposition:** `RETIRE_AFTER_INTEGRATION`.

**Question answered:** what exactly produces the 244 `WORKLOAD_POLICY_BLOCK`s, and is there a
legitimate, reversible configuration lever that clears them?

> **Short answer: 207 of the 244 (84.8 %) are a real, arithmetic Teaching-Load ownership
> over-assignment — 7 teachers hold 2250 min/term of section pairs against an 1800 min/term
> cap while 5 qualified same-department colleagues hold zero. Correcting that ownership is a
> legitimate 21-row Teaching-Load change and takes the diagnostic from 802/123/308 to
> 861/64/113 with the weekly-cap rule at ZERO. The other 37 (15.2 %) are not workload breaches
> at all — they are teacher **slot collisions** mislabelled as workload. No configuration
> lever reaches `generateAllowed=true`: `generateAllowed` requires ZERO blockers, and 23 of the
> remaining 113 are configuration-unreachable.**

---

## 0. Method, entry point, and mutation boundary

### 0.1 Canonical entry point (no ad-hoc scheduler logic)

| Item | Value |
|---|---|
| Function | `buildGenerationReadiness(1, 9)` |
| Source | `atlas-server/src/services/generation-readiness.service.ts:149` |
| HTTP equivalent | `GET /api/v1/generation/:schoolId/:schoolYearId/readiness/diagnostic` |
| Scope | school `1` (HINIGARAN NATIONAL HIGH SCHOOL), `schoolYearId` `9`; ordered terms T1/T2/T3 (`TRIMESTER`) from the persisted `termContractCache` mirror |

Same zero-write canonical path the two prior probes used
(`docs/analysis/g9g10-grid-feasibility-delta-2026-09-17.md`). It calls
`buildGenerationPreflight`, runs the **real hybrid scheduler dry run**, classifies every
unassigned item with `classifyUnassignedBlocker`, and re-verifies zero-write before reporting.

A second harness (`run-raw.ts`) called the **same** `buildGenerationPreflight` +
`buildPreflightConstructorInput` + `runHybridScheduler` production functions but dumped the RAW
`unassignedItems` (with `reason`, `roomAssignmentReason`, `homeRoomFallbackCause`, `facultyId`,
`facultyTermLoad`, `facultyMax`, `termIndex`), the resolved `policyRow`, and the constructor's
effective per-teacher caps — because `GenerationReadinessResult.blockers[]` does not carry those
fields and the exact firing rule cannot be attributed from the blocker list alone.

### 0.2 Database boundary

- **Live database:** `atlas_recovery_clean_rebuild_20260905` on `localhost:5432` — **read-only**.
  Read with `pg_dump --no-owner --no-privileges --serializable-deferrable` (1,138,207-byte
  snapshot) and `SELECT` probes only. **No login, no browser, no generation, no publication,
  no migration, no runtime/port/task/env change, no companion write.**
- **Disposable database:** `atlas_workload_blocker_probe`, created from that snapshot, all levers
  applied there, dropped at the end (§5). Signature of the restored copy matched live exactly
  before any lever was applied.
- Scratch harness (`atlas-server/_probe-scratch/`) was worktree-local and deleted before commit.

### 0.3 Live-database zero-mutation proof

Signature captured before and after every probe run (one read-only text row):

```
before: runs=1 maxid=179 audits=247 maxaudit=798 locks=0 lockactions=0 tlcycles=2 own=530
        facsub=183 slots=182 spol=2 sev=0 secmir=40 pubrev=0 y9own=265 y9cycles=1
after : runs=1 maxid=179 audits=247 maxaudit=798 locks=0 lockactions=0 tlcycles=2 own=530
        facsub=183 slots=182 spol=2 sev=0 secmir=40 pubrev=0 y9own=265 y9cycles=1
```

`Compare-Object` → **diff-count = 0**. `audit_logs` high-water stayed `798` — no login occurred,
so the run was fully unauthenticated. The live database is byte-identical before and after.

### 0.4 Dependency isolation

The probe worktree carried no `node_modules`. `atlas-server/package-lock.json` blob
`ee29339c156af106302c8e74069117afbb1ee3f8` was verified **identical** to the base tree and to the
prior probe worktree, and an **isolated `npm ci`** was run inside this worktree (exit 0), followed
by an isolated `prisma generate` (v6.19.2) into this worktree's own `node_modules`. No junction or
shared dependency tree was used. **Cleanup owner: this worktree's retirement**
(`RETIRE_AFTER_INTEGRATION`).

---

## 1. F1 — What raises `WORKLOAD_POLICY_BLOCK`, and the exact clusters

### 1.1 The single raise site and its thresholds

`WORKLOAD_POLICY_BLOCK` has exactly **one** raise site in the repository
(`generation-preflight.service.ts:405-414`):

```ts
if (item.reason === 'FACULTY_OVERLOADED' || roomReason === 'FACULTY_SLOT_UNAVAILABLE') {
    return {
        ...base,
        code: 'WORKLOAD_POLICY_BLOCK',
        category: 'POLICY_BLOCKER',
        reason: 'Every candidate owner is at their workload/slot limit for this session.',
        owningSurface: 'Teaching Load / Scheduling policy',
        nextAction: 'Reduce assigned load or adjust the workload policy for this school year.',
    };
}
```

This branch is evaluated **before** `ROOM_RESOURCE_UNAVAILABLE` (`:415`) and
`POLICY_WINDOW_BLOCK` (`:425`). So `roomReason === 'FACULTY_SLOT_UNAVAILABLE'` **outranks** a
genuine room failure, and `reason === 'FACULTY_OVERLOADED'` outranks everything except
`NO_QUALIFIED_FACULTY`.

`FACULTY_OVERLOADED` itself has two producers in `schedule-constructor.ts`:

**(a) per-term weekly load cap — `schedule-constructor.ts:1775-1783` and `:1836-1841`**

```ts
const isWithinLoadAndOccupancy = (facId: number): boolean => {
    const maxLoad = facultyMax.get(facId) ?? 0;
    const relevantLoad = getFacultyProjectedLoadForTerm(facId, termIndex);
    if (relevantLoad + item.durationPerSession > maxLoad) return false;
    if (facultyOcc.isOccupied(facId, day, slot.startTime, slot.endTime)) return false;
    return true;
};
...
const overloaded = candidates.every((facId) => {
    const maxLoad = facultyMax.get(facId) ?? 0;
    const relevantLoad = getFacultyProjectedLoadForTerm(facId, termIndex);
    return relevantLoad + item.durationPerSession > maxLoad;
});
return { ids: [], reason: overloaded ? 'FACULTY_OVERLOADED' : 'NO_AVAILABLE_SLOT' };
```

with the threshold at `schedule-constructor.ts:1958`:

```ts
const facultyMax = new Map(faculty.map((f) => [f.id, f.maxHoursPerWeek * 60]));
```

and that `maxHoursPerWeek` is already reduced by ancillary minutes
(`generation-preflight.service.ts:1275` / `:1357`, via `scheduling-policy.service.ts:20-24`):

```ts
maxHoursPerWeek: Math.floor(computeEffectiveWeeklyTeachingMinutes(member.maxHoursPerWeek, member.ancillaryMinutesPerWeek) / 60),
...
export function computeEffectiveWeeklyTeachingMinutes(maxHoursPerWeek, ancillaryMinutesPerWeek) {
    const baseMinutes = Math.max(0, Math.round(maxHoursPerWeek * 60));
    const deduction = Math.max(0, Math.round(ancillaryMinutesPerWeek ?? 0));
    return Math.max(0, baseMinutes - deduction);
}
```

Effective threshold = `floor((maxHoursPerWeek*60 − ancillary)/60)*60`. All 42 school-1 teachers
persist `max_hours_per_week = 30`, `ancillary_minutes_per_week = 0` → **threshold 1800 min/term**.

**(b) daily hard limit — `schedule-constructor.ts:2587-2597`** (`policy.maxTeachingMinutesPerDay`,
resolved through `resolvePolicyPlacementSemantics`, `scheduling-policy.service.ts:136-149`;
persisted value **480**). **This rule never fires** — see §1.4.

`FACULTY_SLOT_UNAVAILABLE` is produced by a **different** rule
(`schedule-constructor.ts:2462-2465` and `:2843-2851`):

```ts
if (qReason) {
    sessionFailureReasons.add(qReason);
    if (qReason === 'FACULTY_OVERLOADED' || qReason === 'NO_AVAILABLE_SLOT') sawFacultySlotUnavailable = true;
}
...
const roomAssignmentReason: RoomAssignmentReason = reason === 'NO_QUALIFIED_FACULTY'
    ? 'NO_QUALIFIED_FACULTY'
    : sawDailyHardLimit || sawConsecutiveHardLimit
        ? 'POLICY_SLOT_BLOCKED'
        : reason === 'FACULTY_OVERLOADED' || sawFacultySlotUnavailable
            ? 'FACULTY_SLOT_UNAVAILABLE'
            : ...
```

**`NO_AVAILABLE_SLOT` — i.e. every candidate teacher is already teaching another section at that
slot, with no load cap breached — is relabelled `FACULTY_SLOT_UNAVAILABLE` and then classified
`WORKLOAD_POLICY_BLOCK`.** (The C07 wave audit already recorded this as N1:
`docs/reviews/generation-authority-realism-c07/wave-completion-audit.md:79`.)

### 1.2 Baseline reproduction — EXACT MATCH

Command (disposable DB pointed at by `DATABASE_URL`; the live DB was never addressed):

```
cd E:/ATLAS-worktrees/workload-blocker-diagnostic/atlas-server
node_modules/.bin/tsx _probe-scratch/run-readiness.ts baseline <statedir>
```

| Metric | Packet | Measured | Match |
|---|---|---|---|
| `assignedCount` | 802 | **802** | ✓ |
| `unassignedCount` | 123 | **123** | ✓ |
| total typed blockers | 308 | **308** | ✓ |
| `WORKLOAD_POLICY_BLOCK` | 244 | **244** | ✓ |
| `ROOM_RESOURCE_UNAVAILABLE` | 25 | **25** | ✓ |
| `SEARCH_LIMIT_UNRESOLVED` | 16 | **16** | ✓ |
| `CANONICAL_SHAPE_CAPACITY_EXCEEDED` | 15 | **15** | ✓ |
| `FLAG_CEREMONY_SCOPE_INVALID` | 8 | **8** | ✓ |
| `selectedProfileId` | `GRADE_ASC_SUBJECT_ASC` | **`GRADE_ASC_SUBJECT_ASC`** | ✓ |
| `classesProcessed` | — | 925 | — |
| hard / soft violations | 0 / — | 0 / 291 | ✓ |
| `databaseSignature.zeroWrite` | — | `true` | — |
| `generateAllowed` | — | **`false`** | — |

**Baseline anchored.** `244 + 25 + 16 + 15 + 8 = 308` is internally consistent.

### 1.3 The 244 by cluster — exact rule, scope, subject, section

**Raw** unassigned items (123) classified by the exact `(reason, roomAssignmentReason)` tuple, then
**expanded** to per-term blocker instances by `resolvePerTermUnassignedItems`
(`per-term-schedule-resolution.service.ts:215-231`: a refusal that already names a term stays in
that term; a year-long refusal expands to one instance per ordered term — 3 here):

| raw tuple | raw items | classified as | expanded instances |
|---|---|---|---|
| `FACULTY_OVERLOADED` / `FACULTY_SLOT_UNAVAILABLE` | 69 | `WORKLOAD_POLICY_BLOCK` (rule 1841) | **207** |
| `NO_COMPATIBLE_ROOM` / `FACULTY_SLOT_UNAVAILABLE` | 21 | `WORKLOAD_POLICY_BLOCK` (rule 2464) | part of **37** |
| `NO_AVAILABLE_SLOT` / `FACULTY_SLOT_UNAVAILABLE` | 6 | `WORKLOAD_POLICY_BLOCK` (rule 2464) | part of **37** |
| `NO_AVAILABLE_SLOT` / `FALLBACK_UNRESOLVED` | 12 | `SEARCH_LIMIT_UNRESOLVED` | 16 |
| `NO_COMPATIBLE_ROOM` / `SPECIALIZED_ROOM_UNAVAILABLE` | 10 | `ROOM_RESOURCE_UNAVAILABLE` | part of 25 |
| `NO_COMPATIBLE_ROOM` / `ROOM_PATH_EXHAUSTED` | 5 | `ROOM_RESOURCE_UNAVAILABLE` | part of 25 |
| | **123** | | **285** |

Degrees of freedom: 81 year-long refusals × 3 terms = 243, plus 42 term-explicit refusals = **285**
(hence more blocker instances than unassigned items).

**The 244 decompose into exactly two rules:**

| rule (source) | instances | share |
|---|---|---|
| `schedule-constructor.ts:1841` — per-term weekly load cap `maxHoursPerWeek*60` | **207** | 84.8 % |
| `schedule-constructor.ts:2464 + :2847` — `NO_AVAILABLE_SLOT` slot collision relabelled | **37** | 15.2 % |

**By `(gradeLevel, programType)`:**

| scope | rule 1841 | rule 2464 | total |
|---|---|---|---|
| G7 REGULAR | 60 | 8 | 68 |
| G8 REGULAR | 60 | 13 | 73 |
| G9 REGULAR | 45 | 0 | 45 |
| G10 REGULAR | 30 | 0 | 30 |
| G8 SPS | 12 | 5 | 17 |
| G7 SPA | 0 | 5 | 5 |
| G8 STE | 0 | 5 | 5 |
| G7 STE | 0 | 1 | 1 |
| **total** | **207** | **37** | **244** |

**By subject (expanded instances):**

| subject | rule 1841 | rule 2464 | total |
|---|---|---|---|
| FIL | 60 | 0 | 60 |
| ESP | 60 | 0 | 60 |
| ENG | 57 | 0 | 57 |
| MATH | 30 | 0 | 30 |
| TLE_ICT_EXP | 0 | 21 | 21 |
| MAPEH | 0 | 15 | 15 |
| SCI_BIO | 0 | 1 | 1 |

**By `(gradeLevel, programType, section)` — all 244:**

| scope | section | rule 1841 | rule 2464 | total |
|---|---|---|---|---|
| G7 REGULAR | 135 `Luna` | 60 | 5 | 65 |
| G8 REGULAR | 134 `Makabansa` | 60 | 0 | 60 |
| G9 REGULAR | 140 `Orchid` | 45 | 0 | 45 |
| G10 REGULAR | 129 `Jade` | 30 | 0 | 30 |
| G8 SPS | 124 `Makakalikasan` | 12 | 5 | 17 |
| G8 REGULAR | 122 `Matapat` | 0 | 13 | 13 |
| G7 SPA | 133 `Rizal` | 0 | 5 | 5 |
| G8 STE | 123 `Makatao` | 0 | 5 | 5 |
| G7 REGULAR | 131 `Aguinaldo` | 0 | 3 | 3 |
| G7 STE | 132 `Bonifacio` | 0 | 1 | 1 |
| | | **207** | **37** | **244** |

**Interpretation.** The 207 weekly-cap instances are carried entirely by four REGULAR
subject columns in four grades — FIL, ESP, ENG, MATH. The 37 slot-collision instances are
carried entirely by the rotation/specialisation columns (TLE ICT, MAPEH, SCI BIO) plus two
G7/G8 REGULAR sections. The two clusters have different root causes and different remedies.

### 1.4 Rules that do **not** fire at baseline

`policyBlockedCount = 0` and **zero** `POLICY_SLOT_BLOCKED` rows in every measured state prove
that neither the daily hard limit (`maxTeachingMinutesPerDay` = 480) nor the consecutive-break rule
ever fired. `enforceConsecutiveBreakAsHard = false` (persisted), so
`schedule-constructor.ts:2599-2608` is inert. `maxConsecutiveTeachingMinutesBeforeBreak = 120` is
the legacy value that `resolveMaxConsecutiveTeachingMinutesBeforeBreak` deliberately treats as
unset. **The daily-cap and break rules are not implicated at all.**

---

## 2. F2 — Root-cause classification per cluster

### 2.1 Cluster A — 207 instances, rule 1841 (per-term weekly load cap)

**Root cause (e): Teaching-Load ownership / load mismatch.** Not demand, not rooms, not the policy row.

The 207 instances come from exactly **7 owners**, each owning **10 section pairs × 225 min =
2250 min/term** against the **1800 min/term** cap:

| owner | department | owned pairs | min/term | cap | utilisation | WPB instances |
|---|---|---|---|---|---|---|
| 8 | ESP | 10 | 2250 | 1800 | **125 %** | 30 |
| 13 | ESP | 10 | 2250 | 1800 | **125 %** | 30 |
| 15 | FIL | 10 | 2250 | 1800 | **125 %** | 30 |
| 22 | FIL | 10 | 2250 | 1800 | **125 %** | 30 |
| 35 | ENG | 10 | 2250 | 1800 | **125 %** | 30 |
| 31 | MATH | 10 | 2250 | 1800 | **125 %** | 30 |
| 28 | ENG | 10 | 2250 | 1800 | **125 %** | 27 |
| | | | | | | **207** |

Raw `facultyTermLoad` reported by the scheduler = **1800** and `facultyMax` = **1800** for every
one of these rows — i.e. each owner is *saturated exactly at the cap*; the arithmetic
`1800 + 45 > 1800` refuses every remaining session. 10 pairs × 5 sessions/week = 50 sessions;
the cap admits 40. **The 10-session shortfall per owner is arithmetic, not algorithmic.**

Crucially, this is a **distribution** defect, not a shortage:

| measure | value |
|---|---|
| demand | **41,625 min/term** (925 sessions/term, identical T1/T2/T3) |
| total capacity | **75,600 min/term** (42 teachers × 1800) |
| utilisation | **55 %** |
| spare minutes across under-cap owners | **27,675 min/term** |
| deficit minutes across over-cap owners | **3,150 min/term** |
| owners at ≥100 % of cap | 10 (7 at 125 %, 3 MAPEH at exactly 100 %) |
| qualified teachers with **zero** year-9 ownership | **5** — FIL 1/7/10, ESP 34/37 |

All 42 teachers persist an identical cap (30 h, ancillary 0), so no cap is "misconfigured
low" relative to its peers. The over-assignment lives in
`subject_section_ownerships.faculty_id`.

### 2.2 Cluster B — 37 instances, rule 2464+2847 (slot collision relabelled)

**Root cause (f), named precisely: a diagnostic classification defect.**
These are *not* workload-policy breaches. `getQualifiedFacultyIds` returned
`NO_AVAILABLE_SLOT` — meaning **not every** candidate was over cap (`overloaded === false` at
`:1836-1840`), so at least one candidate was under cap but already **occupied at that slot** by
another section. Two further facts make the relabel load-bearing:

1. `sawFacultySlotUnavailable` is set for `NO_AVAILABLE_SLOT` just as for `FACULTY_OVERLOADED`
   (`:2464`);
2. the precedence in `classifyUnassignedBlocker` puts `FACULTY_SLOT_UNAVAILABLE` ahead of the
   real room reason (`:405` before `:415`), so 21 raw items whose `reason` was
   **`NO_COMPATIBLE_ROOM`** are reported as workload-policy breaches even though their room path
   had also failed.

The 37 instances are carried by 6 teachers — 21 MAPEH (15 instances), TLE 27/30/42/25
(21 instances), SCI 36 (1) — every one of them at **exactly 1800/1800**, i.e. 40 of the ~40
canonical CLASS slots available per week. A teacher at 100 % of both the minute cap and the
weekly slot supply has zero headroom, so a collision is expected; it is still not a
workload-cap refusal.

### 2.3 Sub-classes (a)–(d) that were tested for and **excluded**

- **(a) required weekly minutes exceed available CLASS slots** — this is
  `CANONICAL_SHAPE_CAPACITY_EXCEEDED` (15 blockers), a separate code, unchanged by every lever.
- **(b) `maxTeachingMinutesPerDay`** — never fires (§1.4).
- **(c) consecutive/break rules** — never fire (`enforceConsecutiveBreakAsHard=false`, §1.4).
- **(d) per-subject weekly caps** — no such rule exists in the constructor's refusal path; all
  22 schedulable subjects persist `min_minutes_per_week = 225` (or 60 for HG, which has zero
  ownership) and are governed by sessions/week, not a per-subject cap.

---

## 3. F3 — Smallest legitimate configuration change per cluster

### 3.1 Cluster A → correct the Teaching-Load ownership over-assignment (**legitimate**)

**Surface:** `subject_section_ownerships.faculty_id` (+ the matching
`faculty_subjects.section_ids` / `grade_levels` scope row). This is the production Teaching-Load
authority — written by `faculty-assignment.service.ts`, `teaching-load-reconciliation.service.ts`,
`teaching-load-suggestion-proposal.service.ts`, `timetable-teaching-load-repair.service.ts`, and
the rollover services. No source change is needed.

**Why the smallest move is exactly "reassign pairs":** for an owned pair the candidate pool is
*exactly* the owner. `schedule-constructor.ts:1703-1710` overwrites the qualified map from
`pairOwners` unconditionally, and `:1757-1758` refuses to widen owner-controlled pairs even when
flexible assignment is enabled:

```ts
const ownerControlled = item.entryKind !== 'COHORT' && isOwnerControlledPair(item.subjectId, item.sectionId);
const shouldAugmentWithTieredCandidates = subject != null && allowFlexible && !ownerControlled;
```

All 265 demand pairs have an owner (`teachingLoadCoverage.missingPairs = 0`), so **the only
configuration lever that can move load off a saturated owner is changing the owner row.**

**Measured before → after (per over-cap owner), `n = 3` pairs moved:**

| owner | dept | before pairs | before min/term | after pairs | after min/term | cap |
|---|---|---|---|---|---|---|
| 8 | ESP | 10 | 2250 | 7 | 1575 | 1800 |
| 13 | ESP | 10 | 2250 | 7 | 1575 | 1800 |
| 15 | FIL | 10 | 2250 | 7 | 1575 | 1800 |
| 22 | FIL | 10 | 2250 | 7 | 1575 | 1800 |
| 28 | ENG | 10 | 2250 | 7 | 1575 | 1800 |
| 31 | MATH | 10 | 2250 | 7 | 1575 | 1800 |
| 35 | ENG | 10 | 2250 | 7 | 1575 | 1800 |
| **receiving peer** | | **before** | | **after** | | |
| 34 | ESP | 0 | 0 | 3 | 675 | 1800 |
| 37 | ESP | 0 | 0 | 3 | 675 | 1800 |
| 1 | FIL | 0 | 0 | 3 | 675 | 1800 |
| 7 | FIL | 0 | 0 | 3 | 675 | 1800 |
| 29 | ENG | 2 | 450 | 5 | 1125 | 1800 |
| 12 | ENG | 3 | 675 | 6 | 1350 | 1800 |
| 4 | MATH | 5 | 1125 | 8 | 1800 | 1800 |

21 ownership rows move. The receiving teachers are all same-department, active, non-stale,
and previously under-loaded — **four of the seven (FIL 1, FIL 7, ESP 34, ESP 37) held literally
zero year-9 ownership** before the move.

**One production detail the first attempt missed and the artifact records:** reassigning the
ownership row alone is *not* sufficient. The hard validator builds its qualification set **only**
from `faculty_subjects.section_ids` (`constraint-validator.ts:574-576`), and the preflight loads
only `schoolYearId = 9` scope rows (`generation-preflight.service.ts:740`). Moving the owner
without folding the moved sections into the receiver's year-9 `faculty_subjects` row produced a
new `FACULTY_SUBJECT_NOT_QUALIFIED = 14` hard blocker. A correct Teaching-Load reassignment
therefore updates **both** authorities, exactly as the production Teaching-Load services do.

### 3.2 Cluster B → **no configuration change clears it**; it needs a source correction

There is no policy field, ownership row, or slot row that changes the classification. The remedy
is in `schedule-constructor.ts:2464` / `:2847` (do not set `sawFacultySlotUnavailable` for
`NO_AVAILABLE_SLOT`, or tag the room reason with the observed faculty cause) and/or
`generation-preflight.service.ts:405` (do not let `FACULTY_SLOT_UNAVAILABLE` outrank a real room
reason). That is a product source change and is explicitly outside this packet —
**reported, not implemented.**

### 3.3 Levers considered and their status

| lever | surface | class | legitimate? |
|---|---|---|---|
| **L1** ownership rebalance (2 or 3 pairs per over-cap owner) | `subject_section_ownerships` + `faculty_subjects` | Teaching-Load correction | **YES — recommended** |
| **L1c** full 265-row round-robin rebalance | same | Teaching-Load rewrite | YES but larger; measured, slightly worse (§4) |
| **L2** raise the 7 caps 30 h → 38 h | `faculty_mirrors.max_hours_per_week` | **guard relaxation / capacity inflation** | **NO — see F6** |
| **L3** `allowFlexibleSubjectAssignment = true` | `scheduling_policies` | policy switch | YES, but **measured no-effect** |
| fix the slot-collision relabel | `schedule-constructor.ts` / `generation-preflight.service.ts` | source change | desired, **out of scope** |
| any `class_program_slot` grid change | `class_program_slots` | fail-closes (`CANONICAL_TEMPLATE_INCOMPLETE`, `schedulerCanRun=false`) | **NO — proven by the prior probe** |
| `policy_special_events` FLAG window | `policy_special_events` / `scheduling_policies` | measured 8 → 2 minimum, never 0 | **NO — cannot reach zero** |

---

## 4. F4 — Measured lever-vs-yield table (disposable database)

Each state was applied to `atlas_workload_blocker_probe` and measured with the identical canonical
path (`run-readiness.ts` + `run-raw.ts` + `run-capacity.ts`, plus an independent reclassification
of the raw items that reproduced the readiness blocker counts exactly). `WPB(1841)` /
`WPB(2464)` are the two rules from §1.3, attributed from the raw tuples.

| # | state | lever | assigned | unassigned | total blockers | WPB | WPB(1841) | WPB(2464) | ROOM | SEARCH | SHAPE | FLAG | hard | `generateAllowed` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B | `baseline` | — | 802 | 123 | 308 | 244 | 207 | 37 | 25 | 16 | 15 | 8 | 0 | **false** |
| 1 | `L1a-move2` | ownership: 14 rows moved (2 per owner) | 856 | 69 | 120 | 52 | **0** | 52 | 25 | 20 | 15 | 8 | 0 | false |
| 2 | **`L1b-move3`** | **ownership: 21 rows moved (3 per owner)** | **861** | **64** | **113** | **45** | **0** | 45 | 25 | 20 | 15 | 8 | 0 | **false** |
| 3 | `L1c-rr` | ownership: full 265-row round-robin | 859 | 66 | 127 | 51 | **0** | 51 | 35 | 18 | 15 | 8 | 0 | false |
| 4 | `L2-caps38` | raise 7 caps 30 h → 38 h | 850 | 75 | 144 | 89 | **0** | 89 | 15 | 17 | 15 | 8 | 0 | false |
| 5 | `L3-flex` | `allowFlexibleSubjectAssignment = true` | 802 | 123 | 308 | 244 | 207 | 37 | 25 | 16 | 15 | 8 | 0 | false |
| 6 | `L1b+L2+L3` | combined | 861 | 64 | 113 | 45 | **0** | 45 | 25 | 20 | 15 | 8 | 0 | false |
| — | `NC-after-L1a` | revert | 802 | 123 | 308 | 244 | 207 | 37 | 25 | 16 | 15 | 8 | 0 | false |
| — | `NC-after-L1b` | revert | 802 | 123 | 308 | 244 | 207 | 37 | 25 | 16 | 15 | 8 | 0 | false |
| — | `NC-after-L1c` | revert | 802 | 123 | 308 | 244 | 207 | 37 | 25 | 16 | 15 | 8 | 0 | false |
| — | `NC-after-L2` | revert | 802 | 123 | 308 | 244 | 207 | 37 | 25 | 16 | 15 | 8 | 0 | false |
| — | `NC-after-L3` | revert | 802 | 123 | 308 | 244 | 207 | 37 | 25 | 16 | 15 | 8 | 0 | false |

### 4.1 Negative control — PASS (5 independent runs)

After every lever state the database was reverted (caps, policy flags, all 265 ownership rows,
and every `faculty_subjects` `section_ids`/`grade_levels`/`version`) and re-measured on the
identical path. **All five reverts returned the baseline exactly**: `802 / 123 / 308` with
`244 / 25 / 16 / 15 / 8`, hard 0, false `generateAllowed`. The post-revert table state was also
re-read directly: `subject_section_ownerships` = 265 rows, `faculty_subjects` = 183 rows,
`nonstandard_caps` = 0, `allow_flexible_subject_assignment` = `f` — i.e. every lever column had
returned to its baseline value, not merely the derived numbers.

### 4.2 Readings

- **The weekly-cap rule is fully clearable by ownership correction alone.** 207 → **0** in every
  L1 state, and in `L2` as well. The 7 saturated owners are the entire cause.
- **`L1b` (move 3, not 2) is the best legitimate state.** Moving only 2 pairs parks each owner at
  exactly 1800/1800 (zero headroom) and yields 69 unassigned; moving 3 leaves 1575 and yields 64.
- **Doing *more* is worse.** The full round-robin (`L1c`, 265 rows) yields 859/66/127 — *more*
  blockers than `L1b` — because evenly spreading the rotation families pushes room pressure up
  (`ROOM` 25 → 35). A larger ownership rewrite is not automatically better.
- **Raising the caps (`L2`) is measurably worse than correcting the ownership.** It clears the
  weekly-cap rule too, but leaves 89 slot collisions (vs 45), drops `ROOM` to 15 and
  `SEARCH` to 17, and produces 75 unassigned. It buys a worse schedule while leaving the 10-pair
  over-assignment in place, and it does not reach the goal either.
- **`allowFlexibleSubjectAssignment` is provably inert here** (802/123/308, byte-identical to
  baseline) — the owner short-circuit at `schedule-constructor.ts:1757-1758` means it can never
  widen a pair that already has an owner, and all 265 do.
- **Adding `L2`+`L3` to `L1b` changes nothing** (identical `113 / 45 / 64`): once the ownership is
  corrected the caps never bind, so the extra levers contribute only risk.

---

## 5. F5 — Does any legitimate configuration lever reach `generateAllowed = true`?

**No.** The gate is structural (`generation-readiness.service.ts:316`):

```ts
const generateAllowed = sortedBlockers.length === 0 && scheduler.ran && violations.hardCount === 0 && zeroWrite;
```

`sortedBlockers.length === 0` requires **zero** blockers, and every unassigned item contributes one
(`generation-readiness.service.ts:289-292`). The best legitimate configuration state measured —
`L1b`, 861 assigned / 64 unassigned / 113 blockers — leaves:

| remaining blocker | count | configuration-reachable? |
|---|---|---|
| `WORKLOAD_POLICY_BLOCK` (all 45 = rule 2464 slot collisions) | 45 | **No** — classification defect, source change required |
| `ROOM_RESOURCE_UNAVAILABLE` | 25 | Partially — coordinated room/type/capacity work; not cleared by any lever measured |
| `SEARCH_LIMIT_UNRESOLVED` | 20 | Partially — scheduler/exhaustion, not cleared by any lever measured |
| `CANONICAL_SHAPE_CAPACITY_EXCEEDED` | 15 | **No** — the G9/G10 REGULAR 8-CLASS grid requires a source change; a DB-only grid change fail-closes with `CANONICAL_TEMPLATE_INCOMPLETE` and `schedulerCanRun=false` (prior probe, §2.2-2.3 there; corroborated here by the exact-set template check at `class-program-slot.service.ts:240-259`) |
| `FLAG_CEREMONY_SCOPE_INVALID` | 8 | **No** — the snap check validates ONE global window against all 16 shape contracts (`generation-preflight.service.ts:1008-1049`); the prior probe measured 8 → 2 at best, never 0 |

So **at least 23 blockers** (`SHAPE` 15 + `FLAG` 8) are configuration-unreachable, and the 45
residual `WORKLOAD_POLICY_BLOCK` require a source change too. `generateAllowed` cannot be reached
by configuration. The diagnostic would remain `BLOCKED` and the demo cannot produce a run.

**What beyond configuration would be required:**

1. **Source change** to `class-program-slot.service.ts` (`GRADE_9_10_REGULAR`, lines 208-218) to
   adopt the 8-CLASS G9/G10 grid, followed by a re-seed of the 182 persisted `class_program_slots`
   rows — a HARD preflight `CANONICAL_TEMPLATE_INCOMPLETE` fail-close blocks the DB-only path.
2. **Source change** to make the FLAG/HGP window genuinely per-shift
   (`generation-preflight.service.ts:1008-1049` must consult the event's `gradeGroup`/`programType`
   per shape instead of validating one global window against all 16).
3. **Source change** to stop relabelling `NO_AVAILABLE_SLOT` as `FACULTY_SLOT_UNAVAILABLE`
   (`schedule-constructor.ts:2464` / `:2847`) and to stop letting it outrank a real room reason
   (`generation-preflight.service.ts:405`).
4. A **room/type/capacity work item** for the `ROOM_RESOURCE_UNAVAILABLE` 25 (G10 STE 15,
   G10 REGULAR 5, G8 REGULAR 5 in the baseline distribution).
5. A **residual-slot work item** for the `SEARCH_LIMIT_UNRESOLVED` 20.
6. The **Teaching-Load ownership correction** (§3.1) — the one item that *is* configuration.

Items 1–3 are product source changes and were **not** performed here.

---

## 6. F6 — Levers that would be GAMING (operator should reject)

| lever | what it does | why it is gaming | measured? |
|---|---|---|---|
| **L2** — raise `faculty_mirrors.max_hours_per_week` 30 → 38 for the 7 saturated owners | raises the per-teacher ceiling so a 2250 min/term over-assignment fits under 2280 | **inflates capacity to match a mis-assignment.** It leaves the 10-pair over-assignment in place and hides it. It is also *worse* on every other metric and still does not reach `generateAllowed`. | **YES** — measured; 850/75/144, WPB 89 |
| reducing/removing demand (`subjects.min_minutes_per_week`, deleting ownership rows, dropping sessions) | lowers the required minutes | **removes demand** rather than resolving it | not measured (would be gaming) |
| clearing `class_program_slots` or replacing the grid to dodge `CANONICAL_SHAPE_CAPACITY_EXCEEDED` | frees capacity by changing the shape | fails closed anyway (`CANONICAL_TEMPLATE_INCOMPLETE`, `schedulerCanRun=false`) — it is both gaming **and** non-functional | prior probe measured; **not re-run** |
| setting `enableFlagCeremony = false` to make `FLAG_CEREMONY_SCOPE_INVALID` disappear | removes the ceremony constraint | deletes a real, school-owned scheduling constraint instead of making it representable | **NOT VERIFIED** (not tested) — flagged as borderline; legitimate only if the school genuinely has no flag ceremony |
| `allowFlexibleSubjectAssignment = true` | widens the candidate pool | **not gaming** — but measured **inert** here (owner short-circuit), so it is not a lever either | **YES** — measured; zero effect |

Explicitly **not** gaming: the L1 ownership correction. It moves teaching load from 125 %-loaded
owners to zero-/under-loaded qualified same-department colleagues while aggregate utilisation stays
at 55 %. It is a correction of a mis-assignment, not a relaxation of a guard.

---

## 7. Ranked lever table

| rank | lever | scope | legitimacy | measured effect | verdict |
|---|---|---|---|---|---|
| 1 | **Ownership rebalance, 3 pairs per over-cap owner (21 rows)** | `subject_section_ownerships` + `faculty_subjects` (year 9) | legitimate Teaching-Load correction | 802/123/308 → **861/64/113**; rule-1841 WPB **207 → 0** | **Recommended.** Best legitimate state; still not `generateAllowed` |
| 2 | Ownership rebalance, 2 pairs per owner (14 rows) | same | legitimate | 856/69/120; rule-1841 **207 → 0** | Minimal defensible change; parks owners at exactly 1800 with zero headroom |
| 3 | Fix the slot-collision relabel | `schedule-constructor.ts`, `generation-preflight.service.ts` | legitimate but **source change** | would remove 45 mislabelled WPB | **Out of scope** — report to planner |
| 4 | FLAG/HGP per-shift source correction | `generation-preflight.service.ts:1008-1049` | legitimate but **source change** | prior probe measured 8 → 2 minimum, never 0 | **Out of scope** |
| 5 | G9/G10 REGULAR grid source correction + re-seed | `class-program-slot.service.ts:208-218` | legitimate but **source change + data re-seed** | prior probe: 123 → 109 unassigned counterfactually | **Out of scope** |
| 6 | `allowFlexibleSubjectAssignment = true` | `scheduling_policies` | legitimate | **zero effect** (802/123/308) | Not a lever here |
| 7 | Full 265-row round-robin rebalance | ownership | legitimate but larger | 859/66/127 — **worse** than rank 1 | Do not prefer |
| — | **Raise the 7 caps to 38 h** | `faculty_mirrors.max_hours_per_week` | **GAMING** | 850/75/144, WPB 89 | **Reject** |
| — | Demand reduction / ownership deletion | various | **GAMING** | not measured | **Reject** |

---

## 8. NOT-VERIFIED

1. **The deployed runtime.** Every number is from **current `origin/main` `056f2e4b` source**
   executed against a disposable copy of the live database. The running release is the
   `3d916b26`/`54dce67b` lineage; this probe did not read, restart, or compare against it.
2. **Any real generation or persisted run.** No `GenerationRun`, draft, lock, or assignment was
   created; these are dry-run results from the canonical readiness scheduler.
3. **`enableFlagCeremony = false`** was **not** tested. Its classification as gaming/borderline is
   a source-reading judgement, not a measurement.
4. **Demand-reduction levers** were **not** tested (deliberately — gaming).
5. **Publication, exports, rendered output, and browser/UX.** Nothing was produced or inspected.
   No login, no browser session, no Tailnet page origin asserted.
6. **The `ROOM_RESOURCE_UNAVAILABLE` and `SEARCH_LIMIT_UNRESOLVED` clusters** were not root-caused
   beyond their blocker counts and scopes; no room inventory or slot-supply audit was performed.
7. **The exact `class_program_slots` semantics** were taken from the prior probe's measurement plus
   a source read of the exact-set template check; the grid levers were not re-measured here.
8. **Scheduler profile/search stability.** Each state was measured once; `softCount` varied
   (171–405) and `runtimeMs` was not controlled, though `assigned`/`unassigned`/blocker codes were
   stable and reproduced exactly on all five negative controls.
9. **No inventory of other active writers** of `subject_section_ownerships` / `faculty_subjects`
   was performed beyond identifying the services that own those writes; the levers were applied
   only inside the disposable database.
10. **Whether the FIL/ESP zero-ownership allocation is a recent defect or an intentional
    historical choice** was not investigated. The probe establishes the arithmetic, not the intent.

---

## 9. Evidence index

| Artefact | Location (not committed) |
|---|---|
| Per-state readiness summaries / blockers / full readiness | `%TEMP%/opencode/wlblk-probe/states/<label>.{summary,blockers,readiness}.json` |
| Per-state raw scheduler dump (raw unassigned items, policy row, effective caps) | `%TEMP%/opencode/wlblk-probe/states/<label>.raw.json` |
| Per-state capacity / ownership-load measurement | `%TEMP%/opencode/wlblk-probe/states/<label>.capacity.json` |
| Per-state blocker-attribution tables (rule × scope × subject × section) | `%TEMP%/opencode/wlblk-probe/analysis/<label>.attribution.json` |
| Live signature before/after + disposable-DB snapshot | `%TEMP%/opencode/wlblk-probe/live-signature-{before,after}.txt`, `live-snapshot.sql` |

**Reproduction (live read-only, all writes in the disposable DB only):**

```powershell
# 1. read-only snapshot (never writes the live DB)
pg_dump --no-owner --no-privileges --serializable-deferrable -f live-snapshot.sql
# 2. disposable database
psql -d postgres -c "CREATE DATABASE atlas_workload_blocker_probe;"
psql -d atlas_workload_blocker_probe -v ON_ERROR_STOP=1 -f live-snapshot.sql
# 3. point DATABASE_URL at the disposable database only
$env:DATABASE_URL = <live url with /atlas_workload_blocker_probe>
# 4. canonical path
cd atlas-server
node_modules/.bin/tsx _probe-scratch/run-readiness.ts <label> <statedir>
```

Lever SQL applied to the disposable database: an ownership move of *n* pairs from each of
owners {8→34, 13→37, 15→1, 22→7, 28→29, 35→12, 31→4} ordered by lowest `section_id`, followed by
folding the moved sections and their `grade_level_id` into the receiver's year-9
`faculty_subjects.section_ids`/`grade_levels`, then transferring
`subject_section_ownerships.faculty_id` + `faculty_subject_id`; the revert restores all four
tables from in-database backup tables (`probe_own_backup`, `probe_facsub_backup`,
`probe_policy_backup`, `probe_faculty_backup`). The scratch harness and those backup tables lived
only inside the disposable database / worktree scratch and were removed before the commit.

**Disposal proof:** `DROP DATABASE IF EXISTS atlas_workload_blocker_probe WITH (FORCE)` → exit 0;
`SELECT count(*) FROM pg_database WHERE datname='atlas_workload_blocker_probe'` → **0**;
`... WHERE datname LIKE '%workload_blocker%' OR ... LIKE '%wlblk%' OR ... LIKE '%probe%'` → **0**.
Live signature identical before/after (diff-count 0); `audit_logs` high-water unchanged at 798.
