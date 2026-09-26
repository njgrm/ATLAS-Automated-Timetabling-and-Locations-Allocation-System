# System walk 1 — year setup, subjects, sections, teachers, rooms (2026-09-26)

**Release:** `26f7c907` (chunk `assets/index-BgXhGnEV.js` confirmed). **Method:** read-only
`atlas-browser-qa` on Claude in Chrome, operator session; **viewport 1536×730** (the window cannot be
resized, so every "1366×768" row in this walk series actually rendered at 1536 px). Tally **9 observed /
0 blocked / 1 unperformed** (narrow width). EnrollPro's host (`dev-jegs`) is down during this walk.
Console: **0 errors on every page**. **Perspective:** a veteran scheduler setting up a new year.

## Verdict

The pages are orderly and the numbers are clear (21 subjects, 20 sections with 20/20 home rooms, 42
teachers all carrying load, 98 rooms ready). But **the setup side cannot say which school year it is
working on**, and it says so in engine language. With EnrollPro down, ATLAS falls back to its saved
term record, and that saved record **fails its own integrity check** — so the fallback built for exactly
this outage does not work. Year setup is stuck on "Waiting for EnrollPro school year status", and the
Subjects page shows "Saved term contract failed its semantic revision check." There is also no guided
path: nothing leads a first-time scheduler from year setup to subjects to sections to teachers to rooms to
the timetable.

## Findings

| # | Finding | Evidence | Severity |
|---|---|---|---|
| 1 | **The offline fallback for the school year is broken.** `/subjects` shows "EnrollPro year or term authority blocked / READ-ONLY SOURCE / Saved term contract failed its semantic revision check." The message is raised when the saved term contract's recomputed semantic revision does not match the stored one (`enrollpro-term-contract.service.ts:481-482`, code `TERM_CACHE_INVALID`). So the saved copy is stale or corrupt, **independent of the EnrollPro outage**. The outage only exposes it. Needs a read-only diagnosis of why the stored revision disagrees (A2/A: server). | P2a | **HIGH** |
| 2 | **Year setup is a dead end during the outage.** "Checking school year" / "Waiting for EnrollPro school year status." with no timeout, no "EnrollPro is unreachable — last known year is …", no retry. "Preview" is disabled with "ATLAS needs a resolved active school year before a carry-forward preview is available." The reason is honest, but a scheduler cannot tell whether to wait, retry, or call someone. | P1 | HIGH |
| 3 | **Engine text on the operator surface.** "Saved term contract failed its semantic revision check" (a server string shown verbatim); subject codes `STE_APPLIED_CHEM`, `DEVL_READING`; tags `OWNER_DEPT:ENG`, `OWNER_DEPT:FIL`, `OWNER_DEPT:TLE` on Subjects and Teachers. This is the same class J2 cleared from the timetable, but it was never applied outside it. A subject *code* may be legitimate if schools use it; `OWNER_DEPT:` is not. | P2a, P4 | MEDIUM |
| 4 | **Three "saved data" banners, each with a different instruction.** Subjects: "Using saved data…". Sections: "…last safe section mirror because the live source is not fully verified. Home-room edits can be queued if saving fails. Reconnect or sync before treating this as final roster truth." Teachers: "…Reconnect or sync before relying on this roster for final setup." "Mirror", "roster truth", "live source is not fully verified" are system words. One plain, shared sentence would do: *EnrollPro is unreachable; you are seeing the copy saved on <date>.* Say **when** it was saved. | P2a, P3, P4 | MEDIUM |
| 5 | **No guided setup path.** No page from year setup to rooms shows a "next step". Year setup links only to itself and to Teaching Load history. A first-time scheduler must know the order from the sidebar. | FLOW | MEDIUM |
| 6 | **Building View shows no classes.** `/timetable/building`: a Mon–Fri grid, 6:00 AM–6:30 PM, with only Flag Ceremony and Health Break rows. No class appears, and no text says why (no building selected? no published schedule?). The Section view of the same draft shows classes. Either a defect or a missing empty-state. | P6 | MEDIUM (verify) |
| 7 | **Two old routes land on one page silently.** `/subjects/requirements` and `/subjects/decision-workspace` both redirect to `/subjects?context=derived-setup`. The page explains that required subjects are now derived, which is good. Check that no sidebar link or button still points at the old routes. | P2b, P2c | LOW |
| 8 | **Teachers: "below standard" is not counted.** The header counts "ABOVE WEEKLY MAX 0" but not how many are below the 30 h standard, while the first teacher shown is "Below standard 15 / 30h". Under-load is the more common problem, so it deserves the count. | P4 | LOW |
| 9 | **Demo data looks unreal.** Section Aguinaldo GR7 has "5 STUDENTS", "40 CAPACITY", "13%". A principal watching a demo will notice. Data, not code. | P3 | LOW (demo) |

## Keep

- Every count is visible up front, and 20/20 home rooms and 42/42 with load read at a glance.
- The disabled Preview states its reason in plain words.
- Teachers' "NEXT TEACHER TO REVIEW" card ("…below the 30h standard and can still receive assignments") is exactly the prompt a scheduler wants.
- The rooms page leads with readiness ("Fix rooms first — Check room readiness first. Open the map only when you need room details.") and puts the map second. That is the right order.
- The derived-subjects explanation on `/subjects?context=derived-setup` is clear.

## Hand-off

- Findings 1–2 (school-year authority during an outage) are server and client work. Timetable-adjacent term authority goes to **A2**, because the term contract is its §7 invariant. Finding 1 needs diagnosis before any fix.
- Findings 3–5 and 7–8 (setup pages) go to **Planner A**.
- Finding 6 goes to **A2** (timetable view).

`subagent_tokens`: 100,450 (60 tool calls).
