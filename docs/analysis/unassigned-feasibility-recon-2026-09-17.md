# Unassigned-Feasibility Reconnaissance — 2026-09-17

**Cycle:** `UNASSIGNED-FEASIBILITY-RECON-C01` (head-planner, read-only reconnaissance)
**Authority packet:** `docs/prompts/unassigned-feasibility-recon-c01-2026-09-17.md`
**Role:** `ROLE: HEAD PLANNER`, effort `high`
**Risk tier:** LOW (read-only)
**Directive:** `origin/main:AGENTS.md` blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`
**Dispatch base:** `origin/main` `43f6909f` (authoring base `dd4f8552`)
**Main at artifact commit:** `0a134bba` (fast-forward merged; `9170126e`, `4deb9d9c`,
`0a134bba` and `7c97ebe0`/`19d4dbba` are docs/workflow-register commits only)
**Worktree:** `E:/ATLAS-worktrees/unassigned-feasibility-recon-c01`, branch
`work/unassigned-feasibility-recon-c01`, disposition `RETIRE_AFTER_INTEGRATION`
**Context:** target is a **demo** published schedule on Tailnet using the mandated EnrollPro test
data. `stakeholderFiles/` (including the new `grade9STE_Sched.jpg` / `grade10STE_Sched.jpg`) are
**shape references, not data of record**.

---

## 0. Method, scope, and zero-write proof

**Scope read:** school `1` (HINIGARAN NATIONAL HIGH SCHOOL), `schoolYearId` `9`.

`schoolYearId` in ATLAS is the **EnrollPro school-year id**, not the mirror primary key: the
active-year mirror row is `EnrollProSchoolYearMirror.id = 223` with `enrollProSchoolYearId = 9`,
`yearLabel = 2030-2031`, `isActive = true`. All `section_mirrors`, `class_program_slots`,
`subject_section_ownerships` and `faculty_subjects` rows for the active year carry `school_year_id = 9`.

**No live write occurred.** Every computation ran through an injected Prisma
interactive-transaction client and the transaction was **always rolled back** (a sentinel error is
thrown). Three independent zero-write proofs agree:

| Proof | Value |
|---|---|
| Canonical service's own `databaseSignature.zeroWrite` | `true` |
| Service `before`/`after` signature (run count, audit count, lock count, cycle versions, ownership count) | byte-identical |
| Recon's own before/after signature (`generation_runs`, `audit_logs`, `locked_sessions`, `locked_session_actions`, `teaching_load_cycles`, `subject_section_ownerships`, `faculty_subjects`) | identical, `audit_logs = 247` before and after |

No login, no generation, no publication, no runtime/port/task/env change, no companion edit,
`stakeholderFiles/` untouched (read-only; images were copied to a temp directory before rotation).

**Dependency isolation.** The recon worktree carried no `node_modules`; a junction into another
worktree's dependency tree was rejected because a junction inside a worktree that must later be
retired is an unacceptable deletion hazard (AGENTS.md worktree-lifecycle rule). An isolated
`npm ci` was therefore run inside the recon worktree (`atlas-server`, 252 packages, 54 s; lockfile
blob `ee29339c…` identical to the deployed tree). Cleanup owner: this cycle's worktree retirement.

**Canonical entry point used.** `buildGenerationReadiness(schoolId, schoolYearId, { client })`
(`atlas-server/src/services/generation-readiness.service.ts:149`), the same function behind
`GET /:schoolId/:schoolYearId/readiness/diagnostic` (`generation.router.ts:139-161`) — "the
zero-write canonical readiness". It calls `buildGenerationPreflight`, runs the **real hybrid
scheduler dry run**, classifies every unassigned item with `classifyUnassignedBlocker`
(`generation-preflight.service.ts:377-443`), and re-verifies zero-write before reporting status.
Ad-hoc SQL was used only to attribute blocker `sectionId`s (which are `externalId`s) to grade/program.

---

## F1 — Shape parity against both 2026-09-17 reference schedules

**Reads used.** `stakeholderFiles/grade9STE_Sched.jpg` (Grade 9, Section `FE DEL MUNDO`,
adviser RUSSEL ANN G. PEREZ) and `stakeholderFiles/grade10STE_Sched.jpg` (Grade 10, Section
`STE-FELIX MARAMBA`, adviser REYART P. BEBOSO). Both are rotated photographs; they were copied to
`%TEMP%/opencode/ufr-c01/`, rotated 270°, cropped and upscaled (`System.Drawing`, read-only on the
originals) so the Time/No.-of-min and Teacher columns could be transcribed exactly.
Persisted canonical grid read from `class_program_slots` for school 1 / year 9 (182 rows).

### F1.1 Reference grids (transcribed)

Both references print **13 table rows = 11 CLASS rows + Lunch band + Health band**, plus a
`Total minutes per day` row.

| # | Grade 9 (`FE DEL MUNDO`) Time / min / Monday | Grade 10 (`STE-FELIX MARAMBA`) Time / min / Monday |
|---|---|---|
| 1 | 9:45 – 10:30 / **60** / `Science (45min)` | 9:45 – 10:30 / **60** / `Science` |
| 2 | 10:00 – 10:45 / 45 / `Applied Chemistry` | 10:30 – 11:15 / 45 / `Research IV` |
| 3 | 10:45 – 11:30 / 45 / `Research III` | 11:15 – 12:15 / 45 / `Applied Physics` |
| 4 | 11:30 – 12:15 / 45 / *(blank)* | 12:15 – 1:00 / 45 / *(blank)* |
| 5 | 12:15 – 1:00 / 45 / `Flag Ceremony/HGP` | 12:15 – 1:00 / 45 / `Flag Ceremony/HGP` |
| 6 | 1:00 – 1:45 / 45 / `Araling Panlipunan` | 1:00 – 1:45 / 45 / `Filipino` |
| 7 | 1:45 – 2:30 / 45 / `Mathematics` | 1:45 – 2:30 / 45 / `Mathematics` |
| 8 | 2:30 – 3:15 / 45 / `TLE` | 2:30 – 3:15 / 45 / `MAPEH` |
| 9 | 3:15 – 3:30 / **15** / *(blank)* | 3:15 – 3:30 / **15** / *(blank)* |
| 10 | 3:30 – 4:15 / 45 / `English` | 3:30 – 4:15 / 45 / `English` |
| 11 | 4:15 – 5:00 / 45 / `MAPEH` | 4:15 – 5:00 / 45 / `AP` |
| 12 | 5:00 – 5:45 / 45 / `Filipino` | 5:00 – 5:45 / 45 / `TLE` |
| 13 | 5:45 – 6:30 / 45 / `Values Education` | 5:45 – 6:30 / 45 / `VE` |
| Total | **510** Mon–Thu, **495** Fri | **510** Mon–Thu, **495** Fri |

### F1.2 Field-by-field parity verdict

| Field | Grade 9 ref | Grade 10 ref | Persisted canonical (G9/G10 STE) | Verdict |
|---|---|---|---|---|
| Shift 09:45 → 18:30 | ✓ | ✓ | `09:45…18:30` | **PASS** |
| One section per page | ✓ (Grade/Section/Learners/Adviser) | ✓ | one section block per grade sheet | **PASS** |
| Day columns Mon–Fri | ✓ | ✓ | ✓ | **PASS** |
| Per-period Teacher column | ✓ (rightmost) | ✓ (rightmost) | `TEACHER` column, day-tagged | **PASS** |
| Lunch 12:15–13:00 | band `11:30–12:15` | band `12:15–1:00` | `12:15–13:00` | **G9 DIVERGES** |
| Health Break 15:15–15:30 (15 min) | ✓ | ✓ | `15:15–15:30` | **PASS** |
| 45-minute periods | 10 of 11 rows | 10 of 11 rows | all rows 45 | **PASS, first row is a document error** |
| Monday-only Flag/HGP on one ordinary CLASS row, subject continuing Tue–Fri | ✓ row 5: `Flag Ceremony/HGP` Mon, `Science` Tue–Fri | ✓ row 5: same | `FLAG_CEREMONY_SCOPE_INVALID` ×8 for G9/G10 | **FAILS CLOSED for exactly these grades** |
| "12 rows/day" | 13 rows | 13 rows | 12 rows (10 CLASS + 2 BREAK) | packet's "12" matches the **persisted canonical grid**, not the references |
| Mon–Thu 510 / Fri 495 | printed | printed | class-minute total **450**, no Friday variant | **NOT canonical** |
| Learner M/F/Total | printed `14 / 20 / 34` | printed `11 / 20 / 31` | export renders labels only, values blank | see F5 |

### F1.3 The printed 60-minute first row is a STAKEHOLDER DOCUMENT ERROR

**Both** references print the first row (`9:45 – 10:30`) as **60 minutes**. Three independent
internal inconsistencies prove it is a typographic/template defect, not a real period length:

1. The canonical persisted grid for the same scope has `09:45–10:30` as a **45-minute** CLASS row.
2. The Grade 9 reference's own Monday cell for that row reads `Science (45min)` — the document
   annotates its own row as 45 minutes while the adjacent minute column says 60.
3. In **both** references the Teacher cell for that row is **empty** while every other CLASS row
   carries a teacher name.

**It must never be encoded.** Any ATLAS output that prints 60 minutes for the first row, or 510/495
per day, would be printing the document error.

### F1.4 Divergences to report (beyond the 60-minute row)

1. **Grade 9's second row is `10:00 – 10:45`, which overlaps row 1 (`9:45 – 10:30`) by 30 minutes.**
   The grid is internally impossible; rows thereafter step cleanly in 45-minute increments.
2. **Grade 9's Lunch band is `11:30 – 12:15`; Grade 10's is `12:15 – 1:00`.** The canonical value
   (D-D) is `12:15–13:00`. Grade 9's reference is one period early.
3. **Grade 10 prints the Lunch band and the Flag row with the identical interval `12:15 – 1:00`.**
   ATLAS already tracks this: `STAKEHOLDER_DECISION_NOTES[1]` reads *"Duplicate 12:15–13:00 row:
   Lunch Break remains blocked for class placement; the overlapping Flag Ceremony/HGP/TLE row
   remains template drift pending a Product decision."*
4. **Grade 10's row 3 is labelled `11:15 – 12:15` (a 60-minute span) with `45` in the minute
   column** — a second arithmetic inconsistency.
5. **"Mon–Thu 510 / Fri 495" is not reproducible from the 45-minute canonical grid.** Arithmetic:
   `510 = 60 + 10×45` (break rows excluded) and `495 = 11×45 = 45 + 10×45`. The printed totals
   therefore depend on the 60-minute error. An all-45 grid yields **495 min/day every day**, and the
   persisted canonical class-minute total is **450** (10 CLASS rows × 45). The packet's
   "Mon-Thu 510 / Fri 495" is a reference-printed artifact, **not** a canonical fact, and
   "45-min periods" + "Mon-Thu 510" cannot both hold.
6. **The references imply 11 CLASS rows; the persisted canonical grid has 10** (3 Specialization
   `09:45–12:00` + 7 Class `13:00–18:30`). Resolving rows 1–2 as a single 45-minute period plus the
   duplicated `12:15–13:00` row reconciles the reference to 10.

### F1.5 Grading 9/10 scopes are mis-gridded outside STE, and the Flag overlay cannot be represented

Persisted `class_program_slots` (school 1 / year 9, 182 rows, 16 scopes):

| Scope | CLASS rows | Class minutes/day | Expected (D-D) |
|---|---|---|---|
| Grades 7–8 REGULAR | 8 | 360 | 8 ✓ |
| Grades 9–10 REGULAR | **7** | **315** | 8 ✗ |
| All STE/SPS/SPA (G7–G10) | 10 | 450 | 10 ✓ |

`CANONICAL_SHAPE_CAPACITY_EXCEEDED` fires for exactly the short REGULAR scopes plus one STE section:
sections `125` (G10 STE), `128`/`129` (G10 REGULAR), `139`/`140` (G9 REGULAR) × T1/T2/T3 = **15
blockers**.

The Flag/HGP failure has a precise cause. `SchedulingPolicy id 50` (year 9) carries
`flagCeremonyStartTime 07:00`, `flagCeremonyEndTime 07:30`, `enableFlagCeremony true`, and
`PolicySpecialEvent` has **0 rows** and `GradeShiftWindow` has **0 rows**. The policy flag window
`07:00–07:30` intersects a G7/G8 morning canonical row (`06:45–07:30`) but intersects **no**
G9/G10 canonical row (their day is `09:45–18:30`). The Monday-only overlay therefore fails closed
with `FLAG_CEREMONY_SCOPE_INVALID` for **exactly Grades 9 and 10, all four programs = 8 blockers** —
the two grades the demo references describe. Both references place their Flag row where ATLAS
reserves Lunch (`12:15–13:00`), which is the unresolved Product decision in
`STAKEHOLDER_DECISION_NOTES[1]`.

> Note: the *validation* authority is already canonical (`SLOT-BREAK-AUTHORITY-C11`), but the
> **display** surfaces still render the retired policy lunch `11:55–12:55`
> (`schedule-constructor.ts:287-288,373-374`, `room-schedule.service.ts:131-150`,
> `locked-session.service.ts:129-130`, `published-schedule.service.ts:542-543`). That is the
> already-registered, `RUNNING` `SLOT-BREAK-AUTHORITY-C11R` packet
> (`docs/prompts/slot-break-authority-c11r-2026-09-17.md`); this recon does not duplicate it.

---

## F2 — Unassigned sessions: exact count, breakdown, typed causes

**Command/read:** `buildGenerationReadiness(1, 9, { client: tx })` inside a rolled-back interactive
transaction; then blocker attribution by `section_mirrors.external_id`.

**Headline (best profile).** The scheduler evaluated all **6** profiles; the best is
`GRADE_ASC_SUBJECT_ASC`:

| Metric | Value |
|---|---|
| `scheduler.assignedCount` | **802** |
| `scheduler.unassignedCount` | **123** |
| `scheduler.classesProcessed` | 925 (= 802 + 123) |
| `scheduler.policyBlockedCount` | 0 |
| `selectedProfileId` | `GRADE_ASC_SUBJECT_ASC` |
| `runtimeMs` | 3,250 |
| `status` / `generateAllowed` | `BLOCKED` / `false` |
| hard violations | **0** |
| soft violations | 291 (`ROOM_TYPE_MISMATCH` 138, `FACULTY_EXCESSIVE_IDLE_GAP` 84, `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED` 66, `FACULTY_DAILY_STANDARD_EXCEEDED` 3) |

Other profiles for reference: `MOST_CONSTRAINED_FIRST` 798/127, `GRADE_DESC_SUBJECT_ASC` 798/127,
`SESSION_PATTERN_PRIORITY` 798/127, `PACKED_BLOCK_PRIORITY` 798/127,
`LOAD_DENSITY_SLOT_PRIORITY` 786/139.

**The "≈95 unassigned sessions" figure carried in the prompt is superseded by the measured 123.**

**Two denominators, both exact.**

- **123** distinct unassigned sessions (section × subject × session × cause) — identical to
  `scheduler.unassignedCount`, computed independently from the blocker set.
- **285** per-term blocker instances in the operator-visible blocker list (T1 **97**, T2 **99**,
  T3 **89**) because each unassigned session resolves per applicable term.

### F2.1 Typed causes (285 instances) mapped to the requested categories

| Requested category | ATLAS typed code | Instances | Share |
|---|---|---|---|
| **Section-faculty shortfall** | `WORKLOAD_POLICY_BLOCK` | **244** | **85.6 %** |
| **No feasible room** | `ROOM_RESOURCE_UNAVAILABLE` | **25** | 8.8 % |
| **Scheduler search limit** | `SEARCH_LIMIT_UNRESOLVED` | **16** | 5.6 % |
| Missing qualified faculty | `TL_NO_QUALIFIED_OWNER` | **0** | — |
| Policy / shift-window exclusion | `POLICY_WINDOW_BLOCK` | **0** | — |
| Rotation-term gaps | `ROTATION_*` | **0** | — |
| Cohort / specialization sizing | — | **0** | — |

Cause semantics (verbatim from `classifyUnassignedBlocker`): `WORKLOAD_POLICY_BLOCK` = *"Every
candidate owner is at their workload/slot limit for this session"* (owning surface: Teaching Load /
Scheduling policy); `ROOM_RESOURCE_UNAVAILABLE` = *"No room matched the required type/features/capacity"*
(Campus map / rooms); `SEARCH_LIMIT_UNRESOLVED` = *"the scheduler could not place this session within
its bounded search"* (Generation algorithm).

### F2.2 Breakdown by (grade, program, subject)

| Grade | Program | Subject | Code | Instances |
|---|---|---|---|---|
| 8 | REGULAR | ESP | WORKLOAD_POLICY_BLOCK | 15 |
| 8 | REGULAR | FIL | WORKLOAD_POLICY_BLOCK | 15 |
| 8 | REGULAR | ENG | WORKLOAD_POLICY_BLOCK | 15 |
| 8 | REGULAR | MATH | WORKLOAD_POLICY_BLOCK | 15 |
| 8 | REGULAR | MAPEH | WORKLOAD_POLICY_BLOCK | 12 |
| 8 | REGULAR | TLE_ICT_EXP | ROOM_RESOURCE_UNAVAILABLE | 5 |
| 8 | REGULAR | SCI_BIO | WORKLOAD_POLICY_BLOCK | 1 |
| 7 | REGULAR | ENG | WORKLOAD_POLICY_BLOCK | 15 |
| 7 | REGULAR | ESP | WORKLOAD_POLICY_BLOCK | 15 |
| 7 | REGULAR | FIL | WORKLOAD_POLICY_BLOCK | 15 |
| 7 | REGULAR | MATH | WORKLOAD_POLICY_BLOCK | 15 |
| 7 | REGULAR | TLE_ICT_EXP | WORKLOAD_POLICY_BLOCK | 5 |
| 7 | REGULAR | MAPEH | WORKLOAD_POLICY_BLOCK | 3 |
| 9 | REGULAR | ESP | WORKLOAD_POLICY_BLOCK | 15 |
| 9 | REGULAR | FIL | WORKLOAD_POLICY_BLOCK | 15 |
| 9 | REGULAR | ENG | WORKLOAD_POLICY_BLOCK | 15 |
| 9 | REGULAR | SCI_BIO | SEARCH_LIMIT_UNRESOLVED | 5 |
| 10 | REGULAR | ESP | WORKLOAD_POLICY_BLOCK | 15 |
| 10 | REGULAR | FIL | WORKLOAD_POLICY_BLOCK | 15 |
| 10 | REGULAR | SCI_BIO | SEARCH_LIMIT_UNRESOLVED | 5 |
| 10 | REGULAR | TLE_ICT_EXP | ROOM_RESOURCE_UNAVAILABLE | 5 |
| 8 | SPS | ENG | WORKLOAD_POLICY_BLOCK | 12 |
| 8 | SPS | TLE_ICT_EXP | WORKLOAD_POLICY_BLOCK | 5 |
| 10 | STE | STE_ROBOTICS | ROOM_RESOURCE_UNAVAILABLE | 15 |
| 7 | SPA | TLE_ICT_EXP | WORKLOAD_POLICY_BLOCK | 5 |
| 8 | STE | TLE_ICT_EXP | WORKLOAD_POLICY_BLOCK | 5 |
| 7 | SPS | DEVL_READING | SEARCH_LIMIT_UNRESOLVED | 3 |
| 8 | SPA | DEVL_READING | SEARCH_LIMIT_UNRESOLVED | 3 |
| 7 | STE | TLE_ICT_EXP | WORKLOAD_POLICY_BLOCK | 1 |
| **Total** | | | | **285** |

Rolled up — **236 of 285 (82.8 %) are in the four REGULAR scopes**: G8 REGULAR 78, G7 REGULAR 68,
G9 REGULAR 50, G10 REGULAR 40; then G8 SPS 17, G10 STE 15, G7 SPA 5, G8 STE 5, G7 SPS 3, G8 SPA 3,
G7 STE 1.

By subject: `ESP` 60, `FIL` 60, `ENG` 57, `MATH` 30, `TLE_ICT_EXP` 31, `MAPEH` 15,
`STE_ROBOTICS` 15, `SCI_BIO` 11, `DEVL_READING` 6.

**Sections with zero unassigned:** Grade 9 STE (`Rose`, externalId 136) and Grade 9 SPA/SPA-adjacent
programs, and most of Grades 9–10 STE. The **Grade 9 reference section is already fully schedulable**;
the **Grade 10 reference section (`Silver`, 125) has 15** (`STE_ROBOTICS` room scarcity).

### F2.3 Context that is *not* part of the 285

| Signal | Value | Meaning |
|---|---|---|
| `derivedDemandBlockers` | **[]** | demand authority is clean |
| `totals` | 555 lines, 265 pairs, 925 sessions/term (`T1`/`T2`/`T3` each 925) | term-consistent |
| `teachingLoadCoverage` | required 265 / owned 265 / missing **0** | every demand pair has an owner |
| `termStructure` | `TRIMESTER` `T1/T2/T3`, revision `a51b62a2…` | resolved from the EnrollPro mirror cache |
| `derivedDemandRevision` | `4EB2F672098605303042A4ECB229BAC6873319751FC7CA946F20127220B526F3` | |
| `policy` | id 50, 45 min, `periodsPerDay` 10 | |
| `resources` | 98 teaching rooms, capacity 4,379, **`featureCoverage: {}`** | **no room has any feature recorded** |
| `gradeWindows` | `resolvedCount` **0**, `missingScopes` [] | shift bounds come from `classProgramSlot` |
| `CANONICAL_SHAPE_CAPACITY_EXCEEDED` | **15** | G9/G10 REGULAR + section 125, ×3 terms (F1.5) |
| `FLAG_CEREMONY_SCOPE_INVALID` | **8** | G9 + G10, all programs (F1.5) |

Faculty context behind the 244 workload blocks: **42** faculty mirrors, all
`isActiveForScheduling = true`, `isStale = false`, `isPlaceholder = false`, `maxHoursPerWeek = 30`
for all; **37 own at least one pair, 5 own none**. Pair concentration: TLE — 5 faculty × 12 pairs;
ENG / ESP / FIL / MATH — 10 pairs each; MAPEH 8; AP/SCI 5–7. 88 `faculty_subjects` and 265
`subject_section_ownerships` rows for year 9.

---

## F3 — Ranked minimal corrections

Legend: **DEMO-BLOCKING** = cannot reach a credible demo published schedule without it;
**DEMO-ACCEPTABLE** = may ship as-is for the demo, documented.

| # | Rank | Finding | Class | Owner | Cheapest safe test |
|---|---|---|---|---|---|
| **C1** | 1 | **244 `WORKLOAD_POLICY_BLOCK`** (85.6 % of unassigned; concentrated in ENG/ESP/FIL/MATH/MAPEH/TLE across the four REGULAR scopes) — every candidate owner is at their workload/slot limit | **DEMO-BLOCKING** | Teaching Load / Scheduling policy | Re-run `buildGenerationReadiness(1,9)` after a *disposable-DB* ownership/policy change; the function already prints the per-profile unassigned count, so each candidate fix is one command |
| **C2** | 2 | **Flag/HGP cannot be represented for G9/G10** — policy flag window `07:00–07:30` intersects no G9/G10 canonical CLASS row → 8 fail-closed blockers on exactly the two demo reference grades | **DEMO-BLOCKING** | Scheduling policy + `classProgramSlot` authority (predecessor of the `RUNNING` `SLOT-BREAK-AUTHORITY-C11R`) | Read-only: compare the policy flag window against the G9/G10 canonical rows (done). Any fix is a persisted-configuration write → separate reviewed preview |
| **C3** | 3 | **G9/G10 REGULAR carry 7 CLASS rows (315 min) instead of 8 (360 min)** → 12 of the 15 `CANONICAL_SHAPE_CAPACITY_EXCEEDED` blockers and a structural 225 min/week deficit per REGULAR section | **DEMO-BLOCKING** | `classProgramSlot` configuration (D-F/D-D seed) | Read-only diff of the persisted grid against D-D (done); replay on a disposable DB with the 8th row added |
| **C4** | 4 | **25 `ROOM_RESOURCE_UNAVAILABLE`**: `STE_ROBOTICS` 15 (G10 STE `Silver`) + `TLE_ICT_EXP` 10 (G8/G10 REGULAR). `featureCoverage` is empty — no room records any `features`, and 138 `ROOM_TYPE_MISMATCH` soft violations accompany it | **DEMO-BLOCKING** for the G10 STE reference page; acceptable for REGULAR | Campus map / rooms (`Room.type`, `Room.features`, `capacity`) | Read-only room inventory; disposable-DB replay after reclassifying one lab |
| **C5** | 5 | **16 `SEARCH_LIMIT_UNRESOLVED`** (`SCI_BIO` 10, `DEVL_READING` 6) — bounded-search exhaustion, likely downstream of C1's load pressure | **DEMO-BLOCKING** if it persists after C1 | Generation algorithm | Re-measure after C1; it is an outcome indicator, not an independent lever |
| **C6** | 6 | **Reference-only artifacts must not be encoded**: 60-minute first row, `510/495` daily totals, Grade 9's `10:00–10:45` overlap, Grade 9's `11:30–12:15` Lunch, Grade 10's duplicate `12:15–1:00` rows | **DEMO-ACCEPTABLE** (must stay documented) | Product / contract | Already covered by `STAKEHOLDER_DECISION_NOTES[1]`; assert the rendered Class Program prints 45-min rows and `TOTAL MINUTES PER DAY = 450`, never 510/495 |
| **C7** | 7 | **`SYNC-SECTION-ENROLMENT-C01` does not move the demo**: see F5/F7 — it changes no unassigned count and prints no learner number | **DEMO-ACCEPTABLE** (de-prioritise for the demo) | Operator | The F7 A/B below is the test; it is already done |

**Highest-value single insight:** the demo's own reference sections are nearly feasible — **Grade 9
STE has 0 unassigned** and Grade 10 STE has only the 15 `STE_ROBOTICS` room blocks. The 244 workload
blocks live almost entirely in the **REGULAR** scopes, which the demo references do not cover.

---

## F4 — NOT VERIFIED

Everything below requires the deployed runtime or a HIGH action, or was deliberately reused rather
than re-derived:

1. **Rendered output of a real run.** No completed year-9 `GenerationRun` exists
   (`generation_runs` holds exactly one row: id 179, `schoolYearId` 8, `status = FAILED`,
   2026-09-09). `published_schedule_revisions` is **empty** — **nothing has ever been published**.
   Every F1/F6 layout claim is therefore source-level, not a rendered artifact from a live run.
2. **Real generation.** Not run and not authorised; the 123/285 figures are a **dry-run** result
   from the canonical readiness scheduler, not a persisted run.
3. **Publication path.** `PublishedScheduleRevision` is empty, so published-immutability rendering
   (C08/C08R1) and the public/published read paths were not exercised.
4. **Raw upstream EnrollPro payload key-set.** Not re-probed by this recon — the packet's §1
   instructs reuse. The reused probe is `SYNC-SECTION-ENROLMENT-C01` §1 (2026-09-17): HTTP 200,
   `total: 20`, 20/20 rows `enrolledCount > 0`, `meta.scope` = schoolId **4**, year 9
   "2030-2031", `isActiveSchoolYear: true`, TRIMESTER. The recon packet's own key list
   (`…, availableSlots, schoolYear`) does **not** match the adapter's typed row, and the
   `schoolId 4` vs ATLAS `schoolId 1` discrepancy was **not** independently resolved.
5. **Browser/UX acceptance.** No login; no browser session; no Tailnet page origin asserted.
6. **Live runtime identity.** Reused from `SYNC-SECTION-ENROLMENT-C01` §0.1 (2026-09-17T11:13+08):
   supervisor PID 4020 on `D:\ATLAS-runtime-supervised-54dce67b-20260914`, server 5001 / host 5174,
   release `54dce67b`, product pin `d44f29e0`, `SECTION_SOURCE_MODE=enrollpro`. Not re-probed here.
   The prose register's "`3d916b26`" narrative is stale.
7. **Physical print fidelity** (Word/Excel pagination, fonts) of the Class Program export.
8. **`SLOT-BREAK-AUTHORITY-C11R` display parity.** Registered `RUNNING`; its display/validator
   contradiction (retired `11:55–12:55` on display surfaces) was **not** fixed or re-verified here.
9. **Disposable-DB replay** of any F3 correction. None was executed; no correction was applied.

---

## F5 — Learner-count provenance

**Reads used.** `section_mirrors` for school 1 / years 8 and 9; `section_snapshots`;
`section-adapter.ts:529-614`; `section.service.ts:196-299`; `workbook-export.service.ts:802-1022`.

| Claim | Observed | Verdict |
|---|---|---|
| ATLAS year-9 (active) mirrors are all zero | 20 rows, `SUM(enrolledCount) = 0` | **CONFIRMED** |
| ATLAS year-8 mirrors carry 81 | 20 rows, `SUM(enrolledCount) = 81` (2–6 per section) | **CONFIRMED** |
| Upstream path / field | `const url = \`${baseUrl}/integration/v1/sections\`` (`ENROLLPRO_API` already ends in `/api`), consumed keys `id, name, maxCapacity, enrolledCount, programType, tleProgramId, tleSpecialization, tleProgramCategory, gradeLevel{id,name,displayOrder}, advisingTeacher{id,firstName,lastName,middleName}` | **CONFIRMED** |
| **No Male/Female split exists upstream** | The consumed row type has **no gender key of any kind**; the captured `section_snapshot` payload for year 9 (source `enrollpro`) exposes only `id, name, adviserId, adviserName, maxCapacity, programCode, programName, programType, displayOrder, gradeLevelId, tleProgramId, admissionMode, enrolledCount, gradeLevelName, isSpecialProgram, tleSpecialization, tleProgramCategory, upstreamProgramType` | **CONFIRMED — no gender split anywhere in the contract** |

**New evidence for the root cause of the zeros (refines the C01 packet).** The year-9
`section_snapshots` row (`source = enrollpro`) **already contains non-zero counts** — Grade 7:
Aguinaldo 4, Bonifacio 4, Luna 4, Mabini 4, Rizal 4 — while the live year-9 mirrors were last
written at `2026-09-10T11:18:14Z` with `enrolledCount = 0`. The snapshot's `fetchedAt` is
`2026-09-10T18:53:39Z`, i.e. **after** the mirror write. The mirror write path itself is correct:
`syncSectionsFromExternal` persists `enrolledCount` on both `update` and `create`
(`section.service.ts:246,267`). So the zeros are a **stale mirror write**, exactly as
`SYNC-SECTION-ENROLMENT-C01` concludes — and the snapshot additionally proves the counts were
reachable through the same adapter on the same day.

**Would a re-sync make anything printable? No.** `exportClassProgramWorkbook` writes only the
**labels** `No. of Learners — MALE:` / `FEMALE:` / `TOTAL:` and **never reads `enrolledCount`**
(no reference to `enrolledCount` exists in `workbook-export.service.ts`). This implements decision
**D-E** ("Male, Female, and Total remain visibly present but blank in every official Class Program
export until an authoritative learner-count source is integrated"). A re-sync would populate
`section_mirrors.enrolledCount` (20/20 > 0) and feed `enrolledCount`-consuming internals only; the
printed **Total per section would remain blank** unless the D-E contract is separately changed.
Per-section printed totals observed in the references (`FE DEL MUNDO` 14/20/34, `STE-FELIX MARAMBA`
11/20/31) are **reference content, not ATLAS output**.

---

## F6 — Class-program export granularity

**Reads used.** `generation.router.ts:694-771`;
`workbook-export.service.ts:802-1022`; `resolveExportSchoolYearLabel`.

**Current layout — CONFIRMED.**

- Route: `GET /:schoolId/:schoolYearId/runs/:runId/export/class-program.xlsx`, guarded by
  `authenticate` + `PRIVILEGED_ROLES` (`admin|officer|SYSTEM_ADMIN`) + `assertActorSchoolScope`.
  Query parameters are **`termIndex` (now REQUIRED — `parseRequiredTermQuery`, so the former G1
  fail-open is closed)** and optional `specializationVisibility` (`hidden|visible`).
  **There is no `section` parameter and no per-section route.**
- Server filename: `exportFileStem('class-program', null, yearLabel, resolvedTerm).xlsx`
  (entity = `null`, i.e. no section identity in the filename).
- Builder: `exportClassProgramWorkbook` → sections sorted by grade then name, grouped into
  `gradeGroups` → **one worksheet per grade** (`sheetName = \`Grade ${gradeLevel}\``).
- Within a grade sheet: a single `rowCursor` walks **one five-weekday block per section** — section
  heading row, adviser/room/term identity row, header row (`TIME | MINUTES | Mon…Fri | TEACHER`),
  interleaved CLASS and merged-BREAK rows, then a `TOTAL MINUTES PER DAY` row, then two blank
  separator rows before the next section.
- Per-section block content: `GRADE n — SECTION: <name>`; `No. of Learners — MALE: / FEMALE: /
  TOTAL:` (labels only); `ADVISER:`; `BLDG./RM.:`; `TERM: Tn`; per-period **`TEACHER` column**
  (day-tagged via `formatDayTaggedField`); week-spanning breaks merged across Mon–Fri; a
  **Monday-only** Flag/HGP event writes only Monday's cell and leaves the other weekdays teachable;
  a grade-level `APPROVAL` block (`Prepared by:` / `Reviewed by:` / `Recommending Approval:` /
  `Approved by:` with blank signature lines) plus an `Adviser:` row; landscape print setup.
- `dailyTotalMinutes` is computed as the **sum of rendered CLASS-row minutes only** (breaks excluded).

**What a single-section export must produce.** The DNO single-section, day-column family
(contract §3.1 / decision D-C) is already the target shape. A section-scoped export must therefore:

1. accept a section selector (e.g. `sectionId` = `SectionMirror.externalId`, or `section=<name>`)
   and emit **exactly one section page or bounded block** — not the whole grade sheet;
2. carry the DNO day-column family: **Time | No. of min | Monday–Friday day columns | per-period
   Teacher**, one section per page/block, with the section heading, adviser, and shift/term identity;
3. render `Lunch Break` and `Health Break` as **merged bands**, and the canonical grid for the
   section's own `(gradeLevel, programType)` scope (never a global period count);
4. render the **Monday-only Flag Ceremony/HGP overlay on one ordinary CLASS row with the underlying
   subject continuing Tue–Fri** — which today fails closed for G9/G10 (F1.5);
5. keep learner M/F/Total **present but blank** (D-E), print `TOTAL MINUTES PER DAY` from the class
   rows only, and keep ARAL Program absent and HG non-standalone;
6. fail closed with zero bytes on an unknown section, an empty selected-term set, or a missing term.

---

## F7 — Cohort / specialization impact of zero enrolment: **magnitude = 0**

**Claim under test.** `cohort.service.ts` consumes `enrolledCount`
(`deriveFallbackTleCohorts` `:115,128`; `deriveSpecialProgramCohortsFromOwnership` `:220,301,307`),
so zero counts "may distort specialization demand" and contribute to the unassigned total.

**Decisive A/B experiment (zero-write).** The canonical readiness was re-run with an injected
`Proxy` over the transaction client that rewrites `SectionMirror.enrolledCount` **in the result set
only**, then the transaction was rolled back. Because `buildGenerationReadiness` accepts an injected
client, no write of any kind occurs.

| Run | `enrolledCount` | assigned | **unassigned** | blocker total | code breakdown |
|---|---|---|---|---|---|
| Control (live) | 0 (as stored) | 802 | **123** | 308 | WORKLOAD 244 / ROOM 25 / SEARCH 16 / SHAPE_CAP 15 / FLAG 8 |
| **Pooled** | **35** (realistic class size, ≤ every room capacity) | 802 | **123** | **308** | **identical, byte-for-byte** |
| **Negative control (mutant)** | **100000** | **0** | **925** | **2,399** | ROOM **2,375**, plus `EMPTY_SCHEDULE_OUTPUT` |

**The negative control is load-bearing.** Raising enrolment above every room's capacity collapses the
schedule (unassigned 123 → 925) and multiplies `ROOM_RESOURCE_UNAVAILABLE` by 95× (25 → 2,375),
proving the injection genuinely reaches the scheduler's `roomCanFitEnrollment`/capacity path
(`schedule-constructor.ts:2291-2414`) and cohort `expectedEnrollment` sizing
(`schedule-constructor.ts:1101-1127`). The pooled run therefore returns a *real* answer.

### Result

> **F7 magnitude: 0. Zero of the 123 unassigned sessions (0 of 285 instances) are explained by the
> stale zero enrolment counts.**

**Why, mechanically.** `enrolledCount = 0` only ever makes constraints *weaker*: a zero-enrolment
section fits **any** room (`roomCanFitEnrollment(capacity, 0)` is trivially true), and cohort
`expectedEnrollment` only sizes rooms, never the number of demand lines, pairs, sessions, or owner
requirements (555 lines / 265 pairs / 925 sessions-per-term are unchanged between the control and the
pooled run). Zero enrolment therefore cannot *create* unassigned sessions — it can only fail to
surface a room-capacity shortage that would appear at realistic enrolment. With the real reference
sizes (Grade 9: 34 learners; Grade 10: 31) and every room at capacity 40, even that effect is
absent: pooled enrolment changes nothing.

**Corollary for the demo.** `SYNC-SECTION-ENROLMENT-C01` is a **stale-mirror correction, not a
feasibility correction**. It is not on the demo critical path for either the unassigned total (0
impact) or the printed Class Program learner fields (still blank under D-E). Its secondary-lead
justification ("zero enrolment may also distort specialization demand") is **falsified** by the
load-bearing A/B above and should not be used to prioritise the HIGH live write. The write may still
be justified on data-integrity grounds — but not as an unassigned-session remedy.

---

## Ranked DEMO-BLOCKING list

| Rank | Item | Owner | Why it blocks the demo |
|---|---|---|---|
| **1** | 244 workload/slot-limit blocks (85.6 % of unassigned) across the REGULAR scopes | Teaching Load / Scheduling policy | Largest single driver of the 123 unassigned sessions |
| **2** | Flag Ceremony/HGP unrepresentable for Grades 9 and 10 (8 fail-closed blockers) | Scheduling policy + `classProgramSlot` authority | The two demo reference grades cannot render their Monday-only Flag row |
| **3** | G9/G10 REGULAR grid is 7 CLASS rows (315 min) instead of 8 (360 min) | `classProgramSlot` configuration (D-D/D-F) | 12 of 15 shape-capacity blockers + a 225 min/week deficit per REGULAR section |
| **4** | 25 room-infeasible sessions (`STE_ROBOTICS` 15 on the Grade 10 STE reference section + `TLE_ICT_EXP` 10); no room records any `features` | Campus map / rooms | The Grade 10 reference section cannot be completed |

**Demo-acceptable (document, do not encode):** the 60-minute first row and `510/495` totals; Grade 9's
`10:00–10:45` overlap and `11:30–12:15` Lunch; Grade 10's duplicate `12:15–1:00` rows; the stale
enrolment mirrors (F7); blank learner M/F/Total (D-E).

## Single cheapest next action

**Author one bounded, cohesive G9/G10 configuration-correction packet covering exactly the two
persisted-configuration defects — (a) the G9/G10 REGULAR canonical grid (7 → 8 CLASS rows) and
(b) the Monday-only Flag/HGP window/scope for G9/G10 — with a disposable-database replay proof
through the canonical readiness and the real Class Program builder.** These two defects share one
authority (`classProgramSlot` + `SchedulingPolicy` for school 1 / year 9), produce 20 of the 23
non-unassigned blockers, and are individually the smallest self-contained fixes with the largest
blocker yield. The packet must be prepared as a **persisted-configuration write**: reviewed preview,
independent pre-action review, explicit approval before apply. It must **not** be bundled with the
term-cache apply, generation, or publication.

---

## Evidence index

| Artifact | Location |
|---|---|
| Reference transcriptions / rotated+cropped reads | `%TEMP%/opencode/ufr-c01/` (`*-rot.png`, `g9-*`, `g10-*`) |
| Read-only survey output | `E:/ATLAS-scratch/ufr-c01/survey-out.txt` |
| Readiness JSON (full result) | `E:/ATLAS-scratch/ufr-c01/readiness-year9.json` |
| F2 attribution passes | `E:/ATLAS-scratch/ufr-c01/summarize-out.txt`, `summarize2-out.txt` |
| F7 A/B (control / pooled / mutant) | `E:/ATLAS-scratch/ufr-c01/f7-ab-out.txt`, `f7-mutant-out.txt` |
| F1 canonical grid | `E:/ATLAS-scratch/ufr-c01/f1-slots-out.txt` |
| F5 snapshot / mirror provenance | `E:/ATLAS-scratch/ufr-c01/f5-snapshot-out.txt`, `f5b-out.txt` |
| F1/F3 policy + special events | `E:/ATLAS-scratch/ufr-c01/f1-policy-out.txt` |
| F2/F3 faculty concentration | `E:/ATLAS-scratch/ufr-c01/f2-owners-out.txt` |
| Scratch scripts (not committed; worktree-local) | `atlas-server/_ufr-scratch/*.ts` — deleted before the candidate commit |

**Registered concurrent work noted, not duplicated:** `SLOT-BREAK-AUTHORITY-C11R` (display-surface
break/shift parity) and `SYNC-SECTION-ENROLMENT-C01` (HIGH live mirror sync) are both `RUNNING` on
`origin/main` as of this artifact's base. This recon writes no register entry and performs no live
action.
