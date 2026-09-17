# YEAR10-GEN-READINESS-CONFIG-C01 — bundle the active-year configuration write

ROLE: EXECUTOR. Recommended reasoning variant: `high`. Risk tier: **HIGH** — one live persisted-configuration write to school 1 / school year 10 (`schoolYearId = 10`, the active year 2031-2032). No generation, publication, deployment, migration, or runtime action.

**Operator rulings that bind this packet:** the teacher cap stays at the policy's current `maxTeachingMinutesPerDay = 400` (do **not** change it to the DepEd 360 in this action); 225 min/week is a subject allotment, not a teacher cap; `DEVL_READING` is a legitimate SPA/SPS specialization and must **not** be archived — its load is offloaded to qualified peers instead. The Wave Completion Auditor is **waived for this demo window** by operator decision; the independent pre-action review is **not** waived.

## Objective

Make the active year (school 1 / year 10) generation-ready by clearing the three remaining blocker classes in one bundled configuration write:

| Class | Now | Source |
| --- | --- | --- |
| `FLAG_CEREMONY_SCOPE_INVALID` | 8 | global `07:00-07:30` window applies to the afternoon G9/G10 grid, which cannot contain it |
| `WORKLOAD_POLICY_BLOCK` | 33 | owners at their cap; `DEVL_READING` 22, `SCI_BIO` 10, `STE_ENV_SCI` 3 (approx) |
| `SEARCH_LIMIT_UNRESOLVED` | 14 | slot collisions; `DEVL_READING` 10, `SCI_BIO` 2, `STE_RESEARCH` 3 (approx) |

`ROOM_RESOURCE_UNAVAILABLE` is already **0** and must stay 0.

## Immutable identity

- Base: current `origin/main` at dispatch — record the full 40-hex SHA. (At authoring: `e468b3b6`.)
- Live release: `131baab7d68fcc8a1a9b874d88e30f45d56a63e0` at `D:\ATLAS-runtime-supervised-131baab7-20260918`. **No deploy is required** — the subject-edit fix is already live (proven: `PATCH /api/v1/subjects/22` → 200) and a scoped `PolicySpecialEvent` row snaps on this release.
- Worktree: `E:/ATLAS-worktrees/year10-gen-readiness-c01`. Branch `work/year10-gen-readiness-c01`.
- Directive: read `origin/main:AGENTS.md`; record its blob + LF-SHA-256.
- Production entry points: `GET /api/v1/generation/1/10/readiness/diagnostic` (read) and `POST /api/v1/faculty-assignments/reset` (preview only, read).

## Gate 0 — capacity probe (READ-ONLY; run first, report before writing)

Before any write, produce the capacity table that decides whether step 1 can succeed:

1. For school 1 / year 10, per faculty: assigned teaching minutes and period count versus the policy cap (`maxTeachingMinutesPerDay`, currently 400) and available periods.
2. Identify, for `DEVL_READING` (subject id 22; qualified departments ENG + FIL) and `SCI_BIO` (subject id 8; owner SCI, rotation family `SCIENCE`), which currently at-cap owners hold the blocked pairs and which **qualified** peers have measurable headroom.
3. Report the arithmetic: total assigned minutes vs total headroom for each subject. **If headroom is insufficient, say so and stop before writing** — do not fabricate feasibility.

Gate 0 is a STOP gate: if it shows no viable headroom, return `PLANNER_DECISION_REQUIRED` with the table rather than performing a write that cannot clear the class.

## Action 1 — offload the over-cap pairs (HIGH write)

Reassign the blocked `DEVL_READING` and `SCI_BIO` section-subject ownership pairs from at-cap owners to qualified peers that Gate 0 proved have headroom, updating **both**:
- `subject_section_ownerships.faculty_id` (the owner), and
- the receivers' `faculty_subjects.section_ids` (so the persisted ownership stays internally consistent).

Rules:
- Only move pairs the readiness diagnostic reports as `WORKLOAD_POLICY_BLOCK` or `SEARCH_LIMIT_UNRESOLVED`.
- Never move a pair to a peer whose resulting load would exceed the 400 cap.
- Preserve every other pair, every other subject, and every other school year byte-identically.
- Never archive or deactivate any subject. `DEVL_READING` stays active.

## Action 2 — per-scope Flag/HGP authority (HIGH write)

Create per-scope `PolicySpecialEvent` flag rows for school 1 / year 10 so the overlay resolves per shift:

| Scope | Window | Authority |
| --- | --- | --- |
| G7, G8 (all programs) | `07:00-07:30` | existing global policy window; snaps into the morning CLASS row `06:45-07:30` |
| G9, G10 (all programs) | `12:15-13:00` | `D:\ATLAS\stakeholderFiles\grade9STE_Sched.jpg` — DepEd Class Program, Grade 9 Enhanced K to 10, SY 2026-2027, section FE DEL MUNDO: Monday `12:15-1:00 = Flag Ceremony/HGP`, adjacent to `11:30-12:15 Lunch Break` |

**CRITICAL — do not write only the afternoon rows.** `resolvePolicyFlagOverlaySlots` (`schedule-constructor.ts:541-557`) skips the global `07:00-07:30` fallback as soon as *any* flag row exists, so an afternoon-only write would silently drop the **G7/G8 morning** overlay. Both shifts must be configured together.

Set `eventType`, `label`, `gradeGroup`, `programType`, `startTime`, `endTime`, `enabled = true`, and `sortOrder` per row. `12:15-13:00` is a canonical CLASS row in both `GRADE_9_10_REGULAR` and `GRADE_9_10_SPECIAL`, so it snaps deterministically.

## Acceptance matrix

| # | Row | Pass condition | Negative control |
| --- | --- | --- | --- |
| 0 | Capacity table | reported before any write, with per-faculty headroom and the arithmetic | — |
| 1 | **Flag class cleared** | `FLAG_CEREMONY_SCOPE_INVALID` = **0** (was 8) on the live diagnostic for year 10 | before-state captured as 8 |
| 2 | **Both overlays render** | the shape contracts show a Monday flag overlay for **G7/G8 at `07:00-07:30`-snapped** and **G9/G10 at `12:15-13:00`** | a mutant/write that omits the morning rows must show the morning overlay disappear |
| 3 | **Workload/search reduced** | `WORKLOAD_POLICY_BLOCK` + `SEARCH_LIMIT_UNRESOLVED` reduced to the Gate 0 minimum; report the exact residual and name every still-over-cap teacher | before/after counts |
| 4 | **Rooms unchanged** | `ROOM_RESOURCE_UNAVAILABLE` stays **0** | — |
| 5 | **Scope safety** | no row outside school 1 / year 10 changed; year 9 and every other school year byte-identical; `subject_section_ownerships` and `faculty_subjects` counts reconcile (moved, not created or lost) | pre/post row-count and per-table signature |
| 6 | **No subject archived** | every subject's `isActive` unchanged from before-state | — |
| 7 | **Cap untouched** | `scheduling_policy.maxTeachingMinutesPerDay` = 400 before and after | — |
| 8 | **Zero residue** | no other table changed; the write is a single reviewed transaction with a captured pre-state enabling exact rollback | before/after signature |

## Mutation boundary and forbidden actions

- **Allowed:** the two writes above, inside one reviewed transaction, with a captured pre-state and an exact rollback statement.
- **Forbidden:** changing `maxTeachingMinutesPerDay` or any other policy field; archiving/deactivating any subject; editing any subject's `preferredRoomType`, `requiredFeatures`, or allowed departments; generation; publication; deployment; restart; schema or migration; term-cache apply; any companion repository; the register; `CHANGELOG.md`; any file outside `docs/` evidence.

## Pre-action review and approval

This is a HIGH live write. Before execution:
1. The executor returns the Gate 0 capacity table and the exact planned mutation set (the specific pairs and the specific flag rows) as a frozen pre-action artifact.
2. **One fresh independent pre-action review** verifies the mutation set against this packet.
3. The operator's **exact approval sentence** is required before the apply. The Wave Completion Auditor is waived for this window by operator decision; the pre-action review is not.

## Return contract

Return one compact handoff: base SHA, the Gate 0 capacity table, the frozen mutation set (exact pairs + exact flag rows), the pre/post signatures, the acceptance matrix with every row PASS/BLOCKED/DEFERRED, the gate tally, the rollback statement, and `REVIEW_REQUIRED` before the write (the write itself waits for approval). If Gate 0 shows insufficient headroom, return `PLANNER_DECISION_REQUIRED` with the arithmetic and no write.
