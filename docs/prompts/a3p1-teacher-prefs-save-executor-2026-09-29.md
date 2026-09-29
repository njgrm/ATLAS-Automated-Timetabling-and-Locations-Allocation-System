# A3 p1 executor packet — Teacher Preferences Save disabled (root cause found)

Base `7d894255` (`origin/main`). Worktree `E:/ATLAS-worktrees/lane-a3-prefs-save`, branch `fix/a3-prefs-save`.
Risk tier **MEDIUM** (client-only; no `atlas-server/**` and no generation file may change — if you believe one must,
STOP and say so instead of editing it).
`node_modules` are JUNCTIONS to `E:\ATLAS-worktrees\lane-c-a7c7\{atlas-client,atlas-server}\node_modules`. Do not
`npm install`, do not remove the junctions.

## Root cause (proven on real staging data, not theorised)

Reproduced live on staging `cd542245` through a loopback preview on real staging data (officer account,
1366x768): open `/faculty/preferences`, pick AGUILAR, CARLO MIGUEL -> the grid renders, **Save and
"Anything else" are disabled**, and the only sentence on screen is the unrelated room-need one.

`GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true` on staging returns **200** with
`activeSchoolYearId: 2`, `source: "enrollpro-verified"`, `activeTerm.verified: true`, `termIndex: 1`,
`orderedTerms: T1/T2/T3`, `upstream.reachable: true`. So **the term data is healthy — it is not the cause.**

The null input is **`schoolYearId`**, not `termUnresolved`. Instrumented in the browser (temporary
`console.warn`, since reverted; never ship it):

```
[A3P1DIAG] effect start            { actorSchoolId: 1, token: true, epoch: 0 }
[A3P1DIAG] isCurrent               { cancelled: false, v: true }        <- called by the resolver
[A3P1DIAG] resolver after fast read { obsolete: true }                  <- same call, same instant
[A3P1DIAG] resolved                { current: true, isNull: true }
```

**`resolveActiveTermAuthority`'s second parameter is a "this read is obsolete, discard it" predicate
(`true` = discard). `TeacherConcerns.tsx:148` passes `isCurrent` — a "still current" predicate whose
`true` means the OPPOSITE.** So every healthy resolution is treated as obsolete, the resolver returns
`null`, and the page's `if (resolution == null) return;` silently leaves `schoolYearId = null`.

Consequences, all confirmed on the real page:
- `writesDisabled = termUnresolved || actorSchoolId == null || schoolYearId == null || selectedFacultyId == null`
  is true because `schoolYearId` is null.
- The availability/room reads (`TeacherConcerns.tsx:226`, `:292`) never fire — zero
  `/faculty/availability` requests on the wire.
- **No explanation is ever shown.** The "Active ordered term unresolved" card (`:577`) is gated on
  `schoolYearId != null`, so the one case that actually happens is the one case that says nothing.

`AdminYearSetup.tsx:75` passes `() => cancelled` — correct polarity, leave it working. The existing
`a2-c14-active-term-authority.test.ts` passes `() => false` / `() => true` in the discard sense, so it
cannot catch this inversion; a caller-shaped regression is required.

## What to change

1. **Fix the polarity at the contract, not at one call site.** Make it impossible to pass the wrong
   sense: e.g. rename the parameter to `isStaleRead` (or accept a named option), document "true = discard",
   and pass `() => !isCurrent()` from `TeacherConcerns`. Update the JSDoc on
   `active-term-authority.ts` so the polarity is stated at the signature. `AdminYearSetup` must keep
   working; its meaning is unchanged.
2. **Never dead-end silently.** `resolution == null` must not be able to leave the page in a state with
   writes disabled and no reason. After the fix a discard means unmount or a newer effect run, so it is
   safe to leave state alone — **prove that with a test**, do not assume it.
3. **Say the real reason next to Save whenever writes are disabled** (packet requirement). Today only
   `termUnresolved` explains itself. Cover every reason the Save button is disabled: no school scope,
   school year unresolved, ordered term unresolved (use `describeUnresolvedTermReason`), no teacher
   chosen, a read in flight. One plain sentence for an older, mouse-first scheduler, in the sticky Save
   row, with a `data-testid` (e.g. `data-testid='concern-save-disabled-reason'`). No jargon, no raw
   codes. Do NOT add a new chip, row or helper sentence under a button (AGENTS §8): one short sentence
   beside Save, and subtract rather than add where you can.
4. **Receipts rule.** After a successful save the page must say what was saved and that the next
   timetable will use it. `describeSavedConcern` / `savedMessage` exist — check what they actually say
   and make them truthful about the next timetable. Do not add a second status element.
5. **Generation reads reviewed availability.** `atlas-server/src/services/faculty-availability.service.ts:346`
   reads `status: 'REVIEWED'` when building a timetable. Prove on the SERVER side, read-only, that a
   REVIEWED record with an Unavailable slot is what generation consumes. **Do not edit any server file**;
   if existing coverage does not prove it, write a read-only test under `atlas-server` that does, or
   report the gap in your handoff instead of editing production server code.

## Tests (AGENTS §11: a test no gate runs is not evidence)

- A **failing-first regression** that calls `resolveActiveTermAuthority` the way `TeacherConcerns` does
  (a still-current predicate) and asserts the resolution is returned and bound — it must FAIL on the
  current code and pass after the fix. Show both runs in the handoff.
- A test for each disabled-writes reason rendering its sentence (including the `schoolYearId == null`
  case, which is today's silent hole).
- A test proving a discarded read cannot leave writes disabled with no reason.
- **Wire every new or changed test file into a committed `atlas-client/package.json` script** in the
  same commit, and name the script in the handoff. Prefer adding to an existing aggregate
  (`test:client-suite`) over a new orphan script.

## Gates to run (record the literal command and result)

- your new script(s);
- `npm --prefix atlas-client run test:client-suite` (large — run detached with a log if it exceeds 10 min);
- `npm --prefix atlas-client run tsc` / the repo's type-check script, and the client build;
- `npm run test:encoding` (root) — must pass;
- `git diff --check`.

## Boundaries

- No `atlas-server/**`, no generation/publication/migration, no deploy, no runtime/task/env change, no
  browser run against live (`:5001`, `:5174`, the Tailnet origin without `:8443`).
- A staging preview is fine on a port in 5200-5299 via
  `powershell -File scripts/dev/start-preview.ps1 -ClientDir <worktree>\atlas-client -Port <p>`, opened at
  `/__dev/staging-login`. Never read `D:\ATLAS-runtime-config\atlas-staging-qa.env`; never start a
  browser or server in a way that keeps a tool call open (`scripts/dev/start-detached.ps1`).
- Ordinary UI mutation on staging (saving a preference) is allowed; it is how the fix is proved.
- Commit `wip(...)` and push at least every 30 minutes and before any long step.

## Return

One handoff, one page: root-cause confirmation, base SHA, candidate SHA, exact changed paths, the literal
gates with results, the failing-first evidence, known risks marked BLOCKING/NON_BLOCKING, and anything a
`data-testid` gives QA for the rendered rows. State plainly whether any file outside
`atlas-client/src` changed.
