# FLAG-COMPENSATION-SLOT-C01 — the flag period is occupied, and the displaced session is relocated

- Stream: `FLAG-COMPENSATION-SLOT-C01`
- Kind: `CYCLE`, source-only. Risk: `MEDIUM` source; generation stays `HIGH`-gated.
- Base: `49aa4eaf` (current `origin/main`)
- Writable worktree: `E:/ATLAS-worktrees/flag-compensation-slot-c01` (planner-provisioned)
- Branch: `work/flag-compensation-slot-c01`
- Additive commits only.
- Recommended executor reasoning: `high`.

## 0. Authority — the stakeholder artifact settles the model

`D:/ATLAS/stakeholderFiles/grade9STE_Sched.jpg` (READ_ONLY), Grade 9 STE /
section FE DEL MUNDO, read directly:

| Time | No. of min. | Monday | Tue-Fri | Teacher |
| --- | --- | --- | --- | --- |
| 9:45 - 10:30 | 60 *(source typo; actual 45)* | `Science (45min)` | *(empty)* | *(empty)* |
| 10:00 - 10:45 | 45 | Applied Chemistry | Applied Chemistry | ZANE REY C. GAVILANGA |
| 10:45 - 11:30 | 45 | Research III | Research III | ERWIN L. SAMSON |
| 11:30 - 12:15 | 45 | **Lunch Break** (spans) | | |
| 12:15 - 1:00 | 45 | **Flag Ceremony/HGP** | Science | RUSSEL ANN G. PEREZ |
| 1:00 - 1:45 | 45 | Araling Panlipunan | (same) | CATHERINE M. PEDREGOSA |
| 1:45 - 2:30 | 45 | Mathematics | (same) | EMMIE NANAGAD |
| 2:30 - 3:15 | 45 | TLE | (same) | RAYLIN GEROGALIN |
| 3:15 - 3:30 | 15 | **Health Break** (spans) | | |
| 3:30 - 4:15 | 45 | English | (same) | MAICA JOY CRESCENCIA FABALINAS |
| 4:15 - 5:00 | 45 | MAPEH | (same) | EIRENE FLORES |
| 5:00 - 5:45 | 45 | Filipino | (same) | ROWENA BUNOL |
| 5:45 - 6:30 | 45 | Values Education | (same) | MIKE ESTORES |
| **Total minutes per day** | 510 | 510 | 510 | 510 | 495 |

Signature block: Adviser `RUSSEL ANN G. PEREZ`; Prepared by `JUDY ANN B. NONATO`
(Principal); Reviewed by `EMILIA L. ENGLISH` (PSDS); Recommending Approval
`ARCH. NELSON G. BEDAIJRE, PhD` (CID Chief); Approved by `JULITO L. FELICANO,
CESE` (ASDS).

### The model this establishes

1. The flag ceremony **occupies** the Monday 12:15-1:00 period. It is **not** an
   in-period overlay.
2. The displaced subject session is **relocated to a Monday-only compensation
   row** (here 9:45-10:30). That row is **empty Tuesday-Friday**.
3. The displaced subject keeps its **full weekly session count** — Science still
   has five sessions: four at 12:15-1:00 Tue-Fri plus one on Monday at 9:45-10:30.
4. The Adviser also teaches the affected subject and handles HGP.

**This directly contradicts the current source behaviour.** `ec2430ab`
("fix(timetable): treat Flag/HGP as in-period overlay, not a capacity block")
encodes the opposite of the stakeholder document and must be replaced, not
extended.

## 1. Required outcomes

**R1 — Replace the overlay model.** The flag/HGP special event must consume the
Monday period it occupies. It must be **day-scoped**: it blocks Monday only and
must never become a five-day event or a five-day capacity loss.

**R2 — Relocate the displaced session.** The subject session displaced by the
Monday flag must be placed in a Monday-only compensation row, preserving the
subject's full weekly session count. It must not be dropped, and it must not be
counted as an extra weekly session.

**R3 — Day-scoped rendering.** The compensation row appears **Monday only**. It
must not render on Tuesday-Friday, and it must not inflate any other day.

**R4 — Non-overlapping interval contract.** The source document is internally
inconsistent: `9:45-10:30` overlaps `10:00-10:45`, and the stated `60` minutes
contradicts the required 45. Normalise into **one non-overlapping grid** with
the compensation row at **45 minutes**. Record the resolved canonical intervals
and prove no two rows overlap on any day.

**R5 — Generation feasibility.** Capacity without the compensation row is
900 < 920 (infeasible); with it, 920 = 920. The scheduler and the preflight must
both agree on the resolved grid. The preflight must not report the flag as a
five-day block, and must not report a false capacity blocker.

**R6 — Export parity.** The class program export must render
`Flag Ceremony/HGP` on Monday and `Science` Tue-Fri **in the same 12:15-1:00
row**, plus the Monday-only compensation row, and must compute Monday's total
from the resolved grid (see `EXPORT-PRESENTATION-C12` R1).

## 2. Operator decisions required before dispatch

1. **Interval resolution (R4).** The source overlaps `9:45-10:30` with
   `10:00-10:45`. Choose: (a) compensation row `9:45-10:30` (45 min) and shift
   the following rows so the day stays non-overlapping, or (b) re-base the whole
   grid to a canonical 45-minute ladder and place the compensation row in the
   first free band. The packet cannot proceed without one.
2. **Scope of the relocation.** The flag ceremony is school-wide. Confirm that
   the period is occupied for **every** program type (REGULAR, STE, SPA, SPS) and
   that only the compensation placement may differ by program. The stakeholder
   artifact evidences STE only.
3. **`Total minutes per day` semantics.** With a 45-minute compensation row:
   Monday = 495, Tue-Fri = 450. The source artifact prints 510/510/510/510/495,
   which is internally inconsistent. Confirm the computed-per-day rule.

## 3. Production-path proof required

| # | Requirement | Negative control |
| --- | --- | --- |
| 1 | Monday period is occupied by the flag | Assert no subject session is scheduled at 12:15-1:00 on Monday |
| 2 | Tue-Fri 12:15-1:00 still carries the subject | Assert four sessions remain |
| 3 | Weekly session count preserved | Assert the displaced subject totals five sessions; failing-first under the overlay model |
| 4 | Compensation row is Monday-only | Assert zero occurrences on Tue-Fri |
| 5 | Non-overlap invariant | Assert no two rows overlap on any day, across all programs |
| 6 | Capacity | Assert the resolved grid reaches 920 assigned / 0 unassigned with 0 HARD violations |
| 7 | Preflight truthfulness | Assert the flag is not reported as a five-day block |
| 8 | Export parity | Assert the rendered row content and the computed Monday total |

Generation proof must assemble demand through the **real derived-demand
authority** and run the **real scheduler**. Hand-built entries with one
convenient term per row are supplementary only.

## 4. Forbidden

- No live generation, publication, apply, deployment, or migration.
- No edits to `docs/plans/live-state.md`, the machine register, or `CHANGELOG.md`.
- Do not modify anything under `D:/ATLAS/stakeholderFiles/` — READ_ONLY.
- Do not hardcode Grade 9 STE, Fe Del Mundo, or the sample teacher names.
- Do not preserve `ec2430ab`'s overlay semantics as a fallback.

## 5. Return contract

Commit the bounded candidate and return `REVIEW_REQUIRED` with base SHA,
candidate SHA, exact changed paths, the requirement -> production path ->
negative control -> result table, the resolved canonical interval grid, the
captured failing-first evidence for the overlay model, and any
`BLOCKED`/`DEFERRED` row named explicitly. Executors do not self-accept, merge,
or push.

## 6. Browser evidence

The affected surface is the rendered timetable grid. Live Tailnet browser
evidence with a `window.location.origin` assertion is required. Read-only
inspection only.
