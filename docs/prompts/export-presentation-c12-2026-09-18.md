# EXPORT-PRESENTATION-C12 — DepEd-fidelity Class Program and Teacher Program exports

- Stream: `EXPORT-PRESENTATION-C12`
- Kind: `CYCLE`, source-only. Risk: `MEDIUM` source. No live publication, no
  generation, no deployment, no data mutation.
- Base: `49aa4eaf` (current `origin/main`)
- Writable worktree: `E:/ATLAS-worktrees/export-presentation-c12` (planner-provisioned)
- Branch: `work/export-presentation-c12`
- Additive commits only.
- Recommended executor reasoning: `high`.

## 0. Authority and stakeholder artifacts

Authoritative inputs (READ_ONLY, `D:/ATLAS/stakeholderFiles/`):

| Artifact | Role |
| --- | --- |
| `DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx` | **Division-issued blank form** (4 samples). Masthead in `header1.xml`, single `83CAEB` accent, no placeholders, fill-in-by-hand. This is the per-section layout authority. |
| `aral-prog_G7_Class-Program_SY2026-2027docx.docx` | **Grade-level master class program** — sections as **columns**, with `ADVISER` and `BLDG/ROOM NO.` rows. G7 green palette verified (`70AD47` / `E2EFD9`). Header: *HINIGARAN NATIONAL HIGH SCHOOL*. **A distinct renderer, not a variant.** |
| `grade9STE_Sched.jpg` | Per-section **Class Program**, G9 STE / Fe Del Mundo (worked example) |
| `GRADE10_REGULAR.jpg` | Per-section **Class Program**, G10 REGULAR / PEARL (worked example) |
| `grade10STE_Sched.jpg` | Per-section **Class Program**, G10 STE |
| `Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx` | **Teacher Program** output |
| `CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx` | Class Program, Grade 8 (xlsx form) |
| `teacherSched+LoadActual.png`, `teacher2Sched+LoadActual.png` | Teacher schedule + actual load |

**There are two distinct class-program shapes.** The per-section form (division
template) has one section per document with a `Teacher` column. The grade-level
master form (`aral-prog_G7...`) has **all sections of a grade side by side as
columns**, with `ADVISER` and `BLDG/ROOM NO.` rows above the grid. Both must be
produced. Do not treat one as a variant of the other.

### DepEd scope (researched 2026-09-18)

DepEd prescribes the **curriculum and time allotments**, not the document layout:

- DO 10, s. 2024 and DO 12, s. 2024 (MATATAG) — DO 12 item 2.a grants schools
  "flexibility ... in consideration of their specific contexts" (typology,
  curricular offerings, teacher and classroom availability).
- DO 9, s. 2026 (Three-Term Calendar).
- Division memoranda (e.g. Aklan DM 321 s. 2026, Bulacan DM 231 s. 2026) state
  the sample class programs in DO 9 s. 2026 are **"intended merely as
  illustrative references and are not to be construed as rigid or mandatory
  templates"**.
- School heads weigh class shifts, classroom availability, enrolment size,
  teacher availability, and localized constraints.

**Consequence:** the document layout is school/division-determined. A hardcoded
renderer is wrong for a multi-school product. This packet therefore requires a
**built-in default renderer that reproduces the stakeholder artifacts exactly**,
plus a **template-override seam** so a school can supply its own layout. Do not
implement the override now — implement the seam and the default.

## 1. Known defects to close

| ID | Defect | Evidence |
| --- | --- | --- |
| D1 | `Total minutes per day` writes the **same value into all five weekday cells** | `atlas-server/src/services/workbook-export.service.ts` |
| D2 | The xlsx class-program renderer has fonts and break merges but **no cell borders, no alignment, no merged title/header block**; the DOCX renderer already has them | `workbook-export.service.ts` vs `docx-export.service.ts` |
| D3 | Header fields are hardcoded empty: region, division, district | `workbook-export.service.ts` |
| D4 | No grade palette. G7 green, G8 yellow, G9 red, G10 blue are required | absent |

## 2. Required outcomes

**R1 — Computed daily totals.** `Total minutes per day` must be computed per
weekday from that day's actual intervals. The Monday-relocated Flag/HGP
compensation row (see `FLAG-COMPENSATION-SLOT-C01`) changes Monday's total
relative to Tue-Fri. A single copied value is a defect.

**R2 — Grade palette.** Cells are tinted by the section's grade:
G7 green, G8 yellow, G9 red, G10 blue. Source the palette from one shared
authority — do not hardcode hex values in two renderers. Grade 7's artifact is
the visual reference for structure; the other grades differ **only** by palette.

**R3 — Class Program fidelity.** Reproduce the stakeholder structure:
DepEd masthead (Republic of the Philippines / Department of Education / Region /
Schools Division Office), document title
`Class Program for Grade <n> <program> for SY <year>`, the
`Grade / Section / Number of Learners (Male, Female, TOTAL)` line, the table
`Time | No. of min. | Monday..Friday | Teacher`, break rows spanning the full
width, the computed totals row, and the signature block
(Adviser, Prepared by, Reviewed by, Recommending Approval, Approved by).

**R4 — Teacher Program.** Per teacher, from `Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx`:
the teacher's load across sections/days, with the same masthead and signature
treatment.

**R5 — Term scoping preserved.** Exports remain term-scoped (`?termIndex=`) per
the ordered-term contract; a term-less or `All terms` export must dispatch zero
requests and explain that one term must be selected.

**R6 — Template-override seam.** Isolate layout in one descriptor so a
school-supplied layout can replace the default without touching data assembly.
Document the seam; do not build a UI for it.

**R7 — Grade-level master class program.** Produce the `aral-prog_G7...` shape
as its own renderer: **one column per section of the grade**, with `SECTION`,
`ADVISER`, and `BLDG/ROOM NO.` rows above the time grid, and the grade palette
applied. Column set is data-driven (the artifact shows 5 sections; a grade may
have more). Prove conservation: every section of the grade appears exactly once,
and every session appears in the correct section column and time row.

**R8 — Palette switchable.** The grade palette is an HNHS artifact convention,
not a DepEd requirement (the division's blank form uses one accent, `83CAEB`).
Expose palette-on/off in the layout descriptor so an export intended for
division submission can render the neutral form.

## 3. Data-availability gaps (must be resolved or explicitly blanked)

These fields appear on the artifact but may not exist in the schema. For each,
either wire a real source or render an explicit blank with a documented reason —
never invent a value:

- Number of Learners **Male / Female** split (only a total appears to exist).
- **Region / Division / District** names.
- **Signature names** (Adviser, Principal, PSDS, CID Chief, ASDS).
- **Adviser** per section.

## 4. Production-path proof required

| # | Requirement | Negative control |
| --- | --- | --- |
| 1 | Daily totals computed per weekday | Failing-first: the pre-fix renderer produces one value in five cells; the test must fail before the fix |
| 2 | Monday differs from Tue-Fri when a compensation row exists | Assert the exact per-day totals |
| 3 | Palette per grade | Render G7/G8/G9/G10; assert the four distinct palette tokens |
| 4 | Structure parity with the DOCX renderer | Assert borders/merges/alignment present in the xlsx path |
| 5 | Real download route | Download each artifact through the real endpoint; assert HTTP 200, a valid container, and the filename from `Content-Disposition` |
| 6 | Term scoping | `?termIndex=` required; missing term dispatches zero requests |
| 7 | Conservation | Every scheduled session in the source run appears exactly once in the export; assert counts and identities |

## 5. Forbidden

- No live publication, generation, apply, deployment, or migration.
- No edits to `docs/plans/live-state.md`, the machine register, or `CHANGELOG.md`.
- Do not modify anything under `D:/ATLAS/stakeholderFiles/` — READ_ONLY reference.
- Do not hardcode one school's names, addresses, or hex palette values into the
  renderer.

## 6. Return contract

Commit the bounded candidate and return `REVIEW_REQUIRED` with base SHA,
candidate SHA, exact changed paths, the requirement -> production path ->
negative control -> result table, captured failing-first evidence, the
data-gap resolutions from §3, and any `BLOCKED`/`DEFERRED` row named explicitly.
Executors do not self-accept, merge, or push.

## 7. Browser evidence

Exports are operator-triggered downloads on a rendered surface. Live Tailnet
browser evidence with a `window.location.origin` assertion is required for the
download action and its failure states. Read-only inspection only.
