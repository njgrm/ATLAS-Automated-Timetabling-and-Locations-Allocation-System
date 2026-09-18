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

1. The flag ceremony **occupies** the Monday period. It is **not** an in-period
   overlay.
2. The displaced subject session is **relocated to a Monday-only compensation
   row** (here 9:45-10:30). That row is **empty Tuesday-Friday**.
3. The displaced subject keeps its **full weekly session count** — Science still
   has five sessions: four at 12:15-1:00 Tue-Fri plus one on Monday at 9:45-10:30.
4. The Adviser also teaches the affected subject and handles HGP.

### Division-issued template confirms and extends the pattern

`D:/ATLAS/stakeholderFiles/DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx` (READ_ONLY,
inspected 2026-09-18) is the Schools Division of Negros Occidental template. It
contains **four sample class programs** and repeats the same flag pattern:

| Sample | Flag row | Monday | Tue-Fri |
| --- | --- | --- | --- |
| G7 morning | `6:00 - 6:45` (45) | `Flag Ceremony/HGP` | `TLE` |
| G7 afternoon | `12:15 - 1:00` (45) | `Flag Ceremony/HGP` | `TLE` |
| G9 morning | `12:15 - 1:00` (45) | `Flag Ceremony/HGP` | `TLE` |
| G9 afternoon | `12:15 - 1:00` (45) | `Flag Ceremony/HGP` | `TLE` |

**The flag slot is shift-dependent** — the division template places it at
`6:00-6:45` for a morning-shift section and `12:15-1:00` for an afternoon-shift
section. ATLAS already carries per-grade/program shift windows in
`grade_shift_windows` (G7/G8 REGULAR 06:00-12:15; G9/G10 REGULAR 12:15-18:30;
G9/G10 STE/SPA/SPS 09:45-18:30). The flag row must therefore be derived from the
section's own shift, not hardcoded to one clock time.

Template structure notes (relevant to `EXPORT-PRESENTATION-C12`):

- Masthead lives in `word/header1.xml`: *Republic of the Philippines /
  Department of Education / NEGROS ISLAND REGION / SCHOOLS DIVISION OF NEGROS
  OCCIDENTAL* plus two logos. Footer carries the tagline
  *"Tatak Negrense : Smart, Healthy, Strong, Happy Schools!"* plus four images.
- **No placeholders**: zero `{{...}}`, zero content controls, zero field codes.
  `Section: ___________` and the learner counts are literal underscores — this is
  a fill-in-by-hand form, so data injection must locate the data table by its
  column signature (`Time | No. of min. | Monday..Friday | Teacher`).
- Exactly **one** fill colour: `83CAEB` (light blue) on 34 cells. The division
  template has **no grade palette** — G7 green / G8 yellow / G9 red / G10 blue is
  an ATLAS system convention layered on top, not a DepEd or division requirement.
- The template's own `Total minutes per day` row is internally inconsistent
  (`420 420 420 420 405` and `510 510 510 510 495` — Friday always 15 less).
  Do not reproduce it verbatim; compute per day.
- Signature block is fixed sample data in the template: Adviser
  `BRIAN F. TORNEA`; Prepared by `JUDY ANN B. NONATO` (Principal); Reviewed by
  `EMILIA L. ENGLIS` (PSDS); Recommending Approval `ARCH. NELSON G. BEDAURE, PhD`
  (CID Chief); Approved by `JULITO L. FELICANO, CESE` (ASDS).

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

## 2. Decisions

### RESOLVED by the operator (2026-09-18)

**D2 — Interval resolution.** The compensation row is **`9:15-10:00`** (45 min),
aligned to the existing `10:00-10:45` row so the day stays contiguous and
non-overlapping. The source artifact's `9:45-10:30` window and `60`-minute value
are **assumed wrong** and must not be reproduced.

> **Follow-on conflict this creates (must be resolved in the same packet).**
> The seeded `grade_shift_windows` for G9/G10 STE/SPA/SPS is **`09:45-18:30`**.
> A `9:15-10:00` compensation row starts **30 minutes before** that window, so
> the row would violate its own section's shift authority. Resolve by either
> (a) moving the G9/G10 STE/SPA/SPS window to **`09:15-18:30`**, or
> (b) explicitly exempting the Monday compensation row from the shift window
> and documenting why. Option (a) is preferred because it keeps one authority.
> This is a `grade_shift_windows` data change and therefore needs the same
> separate approval as any other live config apply.

### OPEN — required before dispatch

1. **Flag slot derivation.** The division template places the flag at
   `6:00-6:45` for a morning-shift sample and `12:15-1:00` for afternoon-shift
   samples, so the slot follows the section's shift rather than one fixed clock
   time. ATLAS already carries per-grade/program shift windows in
   `grade_shift_windows`. Confirm whether HNHS actually runs **both** a morning
   and an afternoon shift. If every section shares one shift, a fixed time is
   equivalent and simpler; if both exist, the flag must be derived per section or
   a morning section would show a flag after its day has ended.
2. **Scope of the relocation.** Confirm the period is occupied for **every**
   program type (REGULAR, STE, SPA, SPS) and that **the displaced subject is
   whatever the timetable placed in that period** (data-driven), not a fixed
   subject. The division template uses `TLE`; the school artifact uses
   `Science`. Capacity evidence supports a broad rule: the grid holds 900
   sessions without the compensation row and the run needs 920, so the extra
   rows are required for feasibility, not optional.
3. **`Total minutes per day` semantics.** Confirmed rule to adopt: **sum of
   instructional minutes per weekday, breaks excluded, each weekday computed
   independently.** Derived from the division template (sample 1: 8 x 45 = 360
   plus a 60-minute ARAL block = `420`; lunch 45 and health break 15 are
   excluded; Friday reads `405` because its ARAL/TLE block runs 45 instead of
   60). Both source documents print internally inconsistent totals, so the
   computed rule is authoritative over the printed values. Under this rule the
   G9 STE section with the resolved `9:15-10:00` row yields **Monday 495,
   Tue-Fri 450**.

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
