# A7-C2 executor result — every past school year, and the leftovers

Executor, 2026-09-29. Base `f72885a1` · branch `work/a7-school-year-setup-c2`.
Packets: `a7-school-year-setup-c2-hangfix.md` (read first) and
`a7-school-year-setup-c2-executor.md`.

## The hang, and the fix (addendum item 1, done first and proved)

The previous executor stalled ~5 h and left only the untracked draft of
`runtime-router-archive-school-year-a7c2.test.ts`. All four causes are fixed:

| Cause | Fix | Evidence |
| --- | --- | --- |
| real `PrismaClient` at module scope (query-engine child) | `mock.module('../lib/prisma.js')` **before** the router is dynamically imported | 0 `node.exe` with the worktree path alive after every run |
| cleanup in a parent `finally`, unreachable when a subtest stalls | all cleanup in `t.after(...)` | file exits on every path |
| servers/keep-alive sockets holding the loop | `server.unref()` right after `listen`; `closeAllConnections()` then `close()` in the same `t.after` | — |
| unbounded `fetch` | every request wrapped in a 10 s `Promise.race` that rejects with the path | `A7-C2 REQUEST_BOUND` |

## Failing-first, per item (literal)

| # | Item | Red, before the fix |
| --- | --- | --- |
| R3 | the two per-year routes | `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON` on all 8 route rows — the routes did not exist (Express HTML 404) |
| R4 | `schoolYears` on every status site | `AssertionError: getRolloverStatus did not carry schoolYears` / `previewRolloverSync did not carry schoolYears` / `the EnrollPro-unreachable status site did not carry schoolYears` |
| 1 | every year listed | `AssertionError: the past-not-yet-kept year has no row on the page` |
| 2 | keep-as-history, preview first | `AssertionError: the keep flow must PREVIEW before it can apply` |
| 3 | Teaching Load + Timetable links | `AssertionError: this tree has no timetable component that reads the schoolYearId param; the flag must be false or the link lies` |
| 4 | plain distribution block | `AssertionError: the bare "carry"/"skipped" pair is still on screen: MATH: 2 carry · 2 skipped` |
| 4c | jargon guard | `AssertionError: "carry" was already covered by an old entry, so this control would prove nothing` (the guard's hole) |

Item 2's first red run also caught a real defect in my own design: the page was
calling `fetchRolloverStatus`, which `rollover-ui-guardrails.test.ts` forbids
("Year Setup does not add a duplicate status request"). Fixed by adding an
opt-in `reloadSignal` prop so the **status-owning card** reloads; the page keeps
exactly one status reader.

## Rulings applied

- **R3** — two new routes over the already-shipped `archiveSchoolYear()`.
  `schoolId` from `authorizeRuntimeMutation` only; `requirePrivileged: true`;
  `withSchoolLock`; no sync, rollover, term authority or reset reachable.
- **R4** — additive optional `schoolYears` on `RolloverStatusResult`, one shared
  exported `listSchoolYears()` called at all four sites (both `getRolloverStatus`
  returns, `previewRolloverSync`, `composeResumedRecoveryPreview`).
  `archivedYears` untouched and asserted unchanged.
- **R5** — the SENTENCE is plain and the code sits in a readable box with a
  "what saving does" line. The PHRASE `SAVE_TERM_AUTHORITY_1_9` and the
  comparison are byte-identical. **Open row, handed back to Lane C: whether to
  drop the interlock is the operator's decision, not this lane's.**
- **R6** — the Timetable link uses `enrollProSchoolYearId` and **fails closed**
  (`TIMETABLE_READS_SCHOOL_YEAR_PARAM = false`), because no timetable component
  in this tree reads the param. A2 flips one boolean in the same commit that
  makes the route honour it.

## Gates (every command through the bounded launcher, 120 s cap, `taskkill /T /F` on timeout)

| Gate | Result |
| --- | --- |
| `npm run test:archive-school-year-a7c2` | exit 0 · 12/12 · 1.29 s |
| `npm run test:a7-year-setup-plain-words` | exit 0 · 16/16 · 14.24 s |
| `npm run test:ux-guardrails` | exit 0 · 31/31 · 0.96 s |
| `npm run test:client-quality` | exit 0 · 34/34 · 1.33 s |
| `npm run test:dup-read-callers` | exit 0 · 75/75 · 7.21 s |
| client `npx tsc --noEmit` | 5 errors, **0 in changed files** (all 4 pre-existing files) |
| server `npx tsc --noEmit` | **BLOCKED**, see below |
| surviving `node.exe` after every run | 0 |

Server `tsc --noEmit` is **not satisfiable in this worktree**: `node_modules/.prisma/client`
was never generated here and the packet forbids any build. 1048 errors at
candidate, of which **0 fall in any line range this cycle added** (verified by
line number against the diff hunks: 170-199, 1021-1023, 1120-1122, 1230-1354,
2337-2341), and 0 in the new test file. The 1048 are the
`no exported member 'ProgramType' / 'DayOfWeek' / 'Prisma.InputJsonValue'` and
`implicitly any` cascade across 1019 lines of production files this cycle does
not touch. A4 owns re-running this after a `prisma generate`.

## Boundaries honoured

No install, no build, no `prisma generate`, no database, no live or staging
runtime, no credential, no scheduled task, no deployment. No server or watcher
was left running. The five non-plain mounts of `RolloverGuidanceCard` are
unchanged; `reloadSignal` defaults to 0 and its effect is skipped entirely.
