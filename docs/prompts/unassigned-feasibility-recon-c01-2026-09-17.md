# UNASSIGNED-FEASIBILITY-RECON-C01 — read-only reconnaissance packet

Status: authored 2026-09-17 (Asia/Manila). **READ-ONLY.** No live write, no register write required to
start, no login, no generation, no publication.

## 0. Identity and authority

- Directive pin: `origin/main:AGENTS.md` blob `051ad26a…`, LF-SHA-256
  `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`.
- Base: `origin/main` at dispatch. Authoring base `dd4f8552843863203bf49f1832baf4d4fa7b8e2a`.
- Risk tier: LOW (read-only). No worktree required; if one is used:
  `E:/ATLAS-worktrees/unassigned-feasibility-recon-c01`, disposition `RETIRE_AFTER_INTEGRATION`.
- Deliverable: `docs/analysis/unassigned-feasibility-recon-2026-09-17.md`.
- Context: the target is a **demo** published schedule on Tailnet using the mandated EnrollPro test
  data; the stakeholder files (including `grade9STE_Sched.jpg` and `grade10STE_Sched.jpg`, added
  2026-09-17) are **references for shape**, not the data of record.

## 1. Inputs (all read-only)

- Live DB via `DATABASE_URL` from `D:\ATLAS-runtime-config\atlas-server.env` (never print secrets).
- Reference schedules `D:/ATLAS/stakeholderFiles/grade9STE_Sched.jpg` and `grade10STE_Sched.jpg`
  (read-only; never modify anything under `stakeholderFiles/`).
- Canonical grid: `class-program-slot.service.ts` (`CANONICAL_TEMPLATE_VERSION`
  `STAKEHOLDER_DNO_2026_2027_45MIN_R2`) plus the persisted 182 rows for school 1 / year 9.
- Contracts: `docs/reference/atlas-beneficiary-output-contract.md` (§8 operator decisions D-B…D-F),
  `docs/analysis/stakeholder-export-parity-audit-2026-09-14.md` (build on; do not re-derive).
- Evidence already established (reuse, do not redo): EnrollPro returns 20 year-9 sections all with
  `enrolledCount > 0`; ATLAS year-9 mirrors are all zero; year-8 mirrors carry 81 learners.

## 2. Required findings

```
F1. SHAPE PARITY vs both reference schedules — field by field:
    09:45->18:30 shift, 12 rows/day, 45-minute periods, Lunch 12:15-13:00, Health Break 15:15-15:30,
    Mon-Thu 510 / Fri 495, one section per page, day-column Mon-Fri, per-period Teacher column,
    Monday-only Flag Ceremony/HGP occupying one ordinary CLASS row with the subject continuing Tue-Fri.
    Cite the reference's printed 60-minute first row explicitly as a STAKEHOLDER DOCUMENT ERROR
    (canonical is 45 minutes) so it is never encoded. Report any other divergence.
F2. UNASSIGNED SESSIONS: the exact count (best profile) and its per-(grade, program, subject) breakdown,
    with typed cause categories and counts: missing qualified faculty, no feasible room/time, policy or
    shift-window exclusion, rotation-term gaps, TLE/specialization gaps, section-faculty shortfall,
    cohort/specialization sizing.
F3. RANKED MINIMAL CORRECTIONS: each marked DEMO-BLOCKING or DEMO-ACCEPTABLE, with owner and the
    cheapest safe way to test it.
F4. NOT-VERIFIED list: everything requiring the deployed runtime or a HIGH action.
F5. LEARNER-COUNT PROVENANCE: confirm ATLAS year-9 mirrors are 0 and year-8 carry 81; confirm the
    upstream field/path inspected (`/integration/v1/sections`, key `enrolledCount`); confirm NO
    Male/Female split exists upstream (keys are id,name,programType,maxCapacity,enrolledCount,
    availableSlots,gradeLevel,advisingTeacher,schoolYear). State whether a re-sync would resolve it
    (see SYNC-SECTION-ENROLMENT-C01) and what the resulting printed Total would be per section.
F6. CLASS-PROGRAM EXPORT GRANULARITY: confirm the current layout (one worksheet per grade,
    `workbook-export.service.ts`, with one five-weekday block per section; route
    `GET /:schoolId/:schoolYearId/runs/:runId/export/class-program.xlsx` with NO section parameter),
    and specify precisely what a single-section export must produce (DNO day-column family:
    Time / No. of min / Mon-Fri / per-period Teacher, one section per page or bounded block).
F7. COHORT/SPECIALIZATION IMPACT of zero enrolment: `cohort.service.ts` consumes `enrolledCount`;
    quantify whether zero counts distort cohort/specialization demand and whether that contributes to
    F2's unassigned total. This is the cheapest lever identified so far - state its magnitude.
```

## 3. Method and boundaries

- Read the live snapshot only.
- If a computation genuinely requires writes (e.g. running the readiness diagnostic), do it against a
  **DISPOSABLE** database created from the read-only snapshot and dropped afterwards, asserting the
  drop and zero residue. Never point a write at the live database.
- No login, no generation, no publication, no runtime/ports/task/env change, no companion edit.
  `stakeholderFiles/` read-only.
- Prefer the canonical derived-demand / readiness entry points over ad-hoc SQL so the numbers match
  what the operator will see after deployment.

## 4. Deliverable structure

`docs/analysis/unassigned-feasibility-recon-2026-09-17.md` with F1-F7, each carrying the exact command
or read used, the observed value, and the interpretation. End with a ranked DEMO-BLOCKING list with
owners and the single cheapest next action.

## 5. Return contract

F1-F7, the artifact path and commit SHA, the ranked DEMO-BLOCKING list, the F7 magnitude, and an
explicit statement of anything NOT verified.
