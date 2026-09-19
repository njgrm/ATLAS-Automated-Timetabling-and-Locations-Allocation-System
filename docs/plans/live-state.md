# ATLAS Live State

Single current-state document. Replaces the retired delivery register
(`docs/plans/atlas-active-delivery-streams.md`, historical only).
Keep this file short; update it only when live facts change.

Last verified: 2026-09-18 19:40 +08

## Objective

Presentable live demo on the active school year (`schoolYearId = 10`,
2031-2032) at `https://njgrm.buru-degree.ts.net`: exports
(class / teacher / room / summary) plus corrected Teaching Load and dynamic
timetable UX, with generation running end to end.

## Deployed runtime (verified)

| Item | Value |
| --- | --- |
| Product pin | `74c1f12a` (`1400bea2` is docs-only above it) |
| Release dir | `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918` |
| Supervisor | PID 67028, owner `NT AUTHORITY\SYSTEM`, task-launched |
| Task | `ATLAS-Runtime-Supervisor` — ONSTART, SYSTEM, Highest, IgnoreNew, `PT0S` |
| 5001 (server) | PID 63688 — `atlas-server/dist/server.js` |
| 5174 (host) | PID 12992 — `ops/runtime/host.mjs` |
| Health | local health/ready 200, host live 200, Tailnet health 200, DB-backed read 200 |
| Entry chunk | `assets/index-CtOKnF1z.js` |
| Rollover automation | disabled (`ROLLOVER_AUTO_SYNC_ENABLED=false`) |

Machine env (all three are required; the task-launched process resolves the
release from these, **not** from its own directory):

- `ATLAS_RUNTIME_ENV_FILE` = `D:\ATLAS-runtime-config\atlas-server.env` (17 keys)
- `ATLAS_RUNTIME_SOURCE_DIR` = the release dir above
- `ATLAS_RUNTIME_RELEASE_SHA` = `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74`

### Rollback

Set the two env vars back to
`D:\ATLAS-runtime-supervised-f0d65a531e34-20260918` /
`f0d65a531e34ded9d8148a1c3f7bf5ddbf2eec4a`, then stop and start the task.
Retained startable releases on disk: `f0d65a53`, `4ce73d15`, `3c4cc3cd`,
`798cd783`, `0eb3b67f`, `131baab7`, `20f07f59`, `405e5b18`.

## Hard dependencies — do not retire

- **`D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918`** is the live
  `atlas-server/node_modules` chain root. The live release links to it in a
  single hop:
  `74c1f12a...\atlas-server\node_modules` -> `0eb3b67f...\atlas-server\node_modules`.
  Lockfile identity verified identical (`9332EF25659983DA`) across
  `0eb3b67f`, `f0d65a53`, `74c1f12a`. Treat the target read-only; never run an
  install through the junction.
- `git config --system --add safe.directory "*"` is required. The SYSTEM-owned
  supervisor runs `git -C <releaseDir> rev-parse HEAD`; without it the pin check
  fails closed with `PIN_UNRESOLVED` (dubious ownership) and the task exits 1.

## Data state

- Database `atlas_recovery_clean_rebuild_20260905` @ localhost:5432.
- Active year = upstream `enrollProSchoolYearId` **10** (mirror row 551).
  Data tables key on the upstream id (10), not 551. Archived year = upstream 9.
- `grade_shift_windows` seeded for year 10 (ids 1-20). This was the real
  generation blocker: the client sends `enforceShiftWindows: true` by default
  while the table had 0 rows for year 10.
  Rollback: `delete from grade_shift_windows where id between 1 and 20;`
- Generation verified: run #314 COMPLETED in 7.2 s, 920 assigned / 0
  unassigned / 0 HARD violations, published revision 41, all four exports 200.
- Blocker arc closed: 66 -> 48 -> 110 -> 55 -> 69 -> 30 -> 0 (room, capacity,
  flag, scheduler search).

## Confirmed defects with ready packets

| Packet | Defect (confirmed live) |
| --- | --- |
| `docs/prompts/home-room-auto-assign-c01-2026-09-18.md` | Auto-assign places **all 20 sections of every grade into the Grade 10 Academic Wing**. Captured via `mode: 'preview'`, `overwriteExisting: true` (zero writes). Persisted manual assignment is per-grade correct, so the manual data masks it. Cause: every academic wing has `gradeScope=[]` -> all score any-grade -> tiebreak falls to `buildingName`, and `"Grade 10 Academic Wing"` sorts before `"Grade 7 Academic Wing"`. Needs a source fix **plus** a separate HIGH-gated `gradeScope` apply. |
| `docs/prompts/flag-compensation-slot-c01-2026-09-18.md` | The flag ceremony **occupies** the Monday 12:15-1:00 period and the displaced subject is **relocated to a Monday-only compensation row** (Science at 9:45-10:30 in `grade9STE_Sched.jpg`). `ec2430ab` ("in-period overlay") encodes the opposite and must be replaced. |
| `docs/prompts/export-presentation-c12-2026-09-18.md` | `Total minutes per day` writes one value into all five weekday cells; xlsx class-program renderer lacks borders/alignment/merged header; no grade palette (G7 green, G8 yellow, G9 red, G10 blue); header fields hardcoded empty. |
| `docs/prompts/published-revision-authority-c12-2026-09-18.md` | The published-revision path performs **no hard-constraint validation**, so a revision can introduce a HARD violation. No published-safe swap. `manual-edit.service.ts:461` leaks "Prompt 6". |

## Operator decisions — all resolved (2026-09-18)

1. **Flag interval** — compensation row is `9:15-10:00` (45 min), contiguous
   with `10:00-10:45`. Source's `9:45-10:30` / `60` assumed wrong.
2. **Shift window** — move G9/G10 STE/SPA/SPS to `09:15-18:30` so the
   compensation row does not precede its own section's window. (Data change,
   needs its own approval.)
3. **Flag slot** — HNHS runs **both** a morning and an afternoon shift, with a
   flag ceremony every Monday for **both**. The flag row is derived from the
   section's own shift, never a fixed clock time.
4. **Displacement strategies — three, all real, all required:**
   - **S1** Monday-only compensation row (`grade9STE_Sched.jpg`, G9 STE Science)
   - **S2** cross-day relocation into another day's free slot
     (`GRADE10_REGULAR.jpg`, G10 REGULAR Science -> Friday `11:15-12:15`)
   - **S3** partial occupancy, no relocation (`aral-prog_G7...`, the `6:00-6:45`
     row keeps a real subject for every section)
   Blocking-vs-overlay must be a **per-shift, per-program configuration** exposed
   through the existing `grade_shift_windows` authority. This **corrects** the
   earlier stance: `ec2430ab` is *right* for S3 and *wrong* for S1/S2.
   Deliberately left open: G7/G8 special programs spanning both shifts would
   attend **two** ceremonies and have **two** displacements — the model must be
   able to express that; it must not assume one.
5. **Displaced subject** — data-driven, never hardcoded `TLE`/`Science`.
   Relocation applies to the **special programs**; HNHS's shifting is an edge
   case caused by buildings under construction, and normal schools run whole-day.
6. **Totals semantics** — instructional minutes per weekday, **breaks excluded**,
   computed independently. Flag period counts as occupied.
7. **Export architecture** — DepEd prescribes curriculum and time allotments, not
   layout; division memoranda call the DO 9 s. 2026 samples "illustrative
   references ... not rigid or mandatory templates". Ship a default renderer
   matching the artifacts plus a template-override seam, with the grade palette
   **switchable** (the division blank form uses one accent, `83CAEB`).

## Two distinct class-program export shapes

- **Per-section** — one section per document, `Teacher` column (division
  template `DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx`).
- **Grade-level master** — **all sections of a grade side by side as columns**,
  with `ADVISER` and `BLDG/ROOM NO.` rows
  (`aral-prog_G7_Class-Program_SY2026-2027docx.docx`).

Both are required. The master form is not a variant of the per-section form.

## School identity

HNHS — Hinigaran National High School. Masthead chain: *Republic of the
Philippines / Department of Education / NEGROS ISLAND REGION / DIVISION OF
NEGROS OCCIDENTAL / HINIGARAN NATIONAL HIGH SCHOOL*. Footer tagline: *"Tatak
Negrense: Smart, Healthy, Strong, Happy Schools!"*.

## Other open items

4. `DATA-CORRECTION-C01` is mis-targeted at the archived year and has 4 blocking
   findings — rescope onto year 10 or abandon.
5. SSO env activation needs one restart (must not overlap another runtime action).
6. Hygiene: untracked scratch `atlas-server/src/__probe-preflight.ts` in the
   integration worktree.

## Operator log viewing

`ops/runtime/atlas-logs.ps1` tails the merged supervisor log in an interactive
window (`-Stream all|server|client`). Two logon-triggered tasks open one window
per stream. The runtime itself stays SYSTEM-owned in the background: Windows
Session 0 isolation means a SYSTEM process cannot display a window on the
interactive desktop, so visible terminals must be launched in the user session.

## Boundaries

- `D:\ATLAS` is a stale/dirty checkout (~466 behind) and is never an
  integration boundary. Real work happens in `E:/ATLAS-worktrees/*`.
- The harness may inject a stale `D:/ATLAS/AGENTS.md`; read the directive from
  Git bytes (`origin/main:AGENTS.md`).
- Companion repos (EnrollPro, AIMS, SMART) are read-only.
