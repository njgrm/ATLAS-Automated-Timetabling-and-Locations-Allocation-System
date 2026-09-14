# TT-TL-MODULES-C04R1 — stalled correction recovery handoff

Status: **CYCLE ON — resume one interrupted MEDIUM source correction to a
frozen `REVIEW_REQUIRED` candidate.** This packet replaces the former planner
session route because that session stopped while holding uncommitted work.

Canonical directive: current tracked `origin/main:AGENTS.md`, LF-normalized
SHA-256 `F4F86185F2A0B4D78B50E8375F72E35B9F6E8A788A6F558952C2B29BE174CE64`.
Read it before touching the worktree. Also read the governing correction packet
`docs/prompts/timetable-teaching-load-modules-c04r1-correction-2026-09-14.md`.
This recovery packet changes session ownership only; F1–F5 and every safety
boundary in that packet remain mandatory.

## Verified recovery state

- Worktree: `D:/ATLAS-worktrees/tt-tl-modules-c04`
- Branch: `work/tt-tl-modules-c04`
- Original base: `d4e9dc8e07869725d4beb55b30c4502650597d24`
- Prior product candidate: `6a8f471712eb51a6ff83549beb446bd6242dc5de`
- Prior docs tip: `a09a43162c32368f76d6892f4f6ff759d7295de6`
- Additive committed correction: `5afdd1cd6284be0274c1315a8898525f97810f14`
  (`fix(api): guard and bound capability-override authority`), touching only
  `faculty-assignment.router.ts`, `department-authority.service.ts`, and
  `faculty-assignment.service.ts`. Its commit message claims F2/F3 server work;
  treat that as a claim to verify, not acceptance.
- At recovery capture (2026-09-14 13:57 +08), no OS process command line owned
  this worktree and no file had changed since 13:20 +08.
- The worktree is **dirty by interrupted execution**, not a frozen candidate:
  eight tracked client files are modified and three client files are untracked.
  `git diff --check` is clean, but no final tests or commit bind these bytes.
- Recovery manifest aggregate at capture: SHA-256
  `A5B73F3FC029A0C09545BBB265AAE5CC29A5407120089B2F86F973480584F99A`,
  computed from sorted `relative-path<TAB>file-SHA-256` rows for the eleven paths
  below with one terminal LF. Recompute before adoption. A mismatch means the
  residual changed after capture and requires a fresh attribution check; it is
  not permission to discard either version.

Interrupted residual paths, exactly:

```text
M atlas-client/src/components/timetable/TacticalSandboxDock.helpers.ts
M atlas-client/src/components/timetable/TacticalSandboxDock.parts.tsx
M atlas-client/src/components/timetable/TacticalSandboxDock.tsx
M atlas-client/src/components/timetable/TeacherDepartureRecoverySheet.tsx
M atlas-client/src/components/timetable/TimetableSimpleHeader.tsx
M atlas-client/src/components/timetable/simple/SimpleDriftBanner.tsx
M atlas-client/src/lib/__tests__/timetable-dynamic-workspace-rendered.test.ts
M atlas-client/src/lib/__tests__/tt-tl-modules-helpers.test.ts
? atlas-client/src/components/timetable/TacticalSandboxDock.useTeachingLoadModules.ts
? atlas-client/src/lib/__tests__/tt-tl-modules-c04r1-behavior.test.ts
? atlas-client/src/lib/__tests__/tt-tl-modules-c04r1-contract.test.ts
```

## Recovery procedure

1. Confirm no other planner/executor/process owns the worktree. Run index
   refresh, `git status --porcelain=v2`, full diff, untracked-file inventory,
   and `git diff --check`. Never describe this state as clean.
2. Preserve every byte until inspected. Do not reset, clean, stash, checkout,
   rebase, amend, or overwrite the residual. Attribute it requirement-by-
   requirement against F1–F5. If part is unusable, repair it additively in
   place; do not discard the rest wholesale.
3. Use exactly one executor writer for this worktree. The executor must finish
   F1–F5, including the missing safe capability client entry point, truthful
   absence semantics, published drift routing, server-issued confirmation, and
   physical component extraction. The 1,000-line gate uses physical lines.
4. Run every production-path, mounted-route, rendered-consumer, disposable-DB,
   typecheck/build/runtime-import, mutant, and cumulative-range gate required by
   the governing C04R1 packet. Tests executed before the final commit do not
   prove the final SHA; rerun the decisive set after freezing source bytes.
5. Commit the adopted residual and any completion fixes additively. Do not
   amend/rebase/reset/merge/squash/push. Require a completely clean worktree by
   `git status --porcelain=v2` plus `git diff --quiet` before QA.
6. Commission a **fresh independent QA** over the complete cumulative range
   `d4e9dc8e07869725d4beb55b30c4502650597d24...<new-tip>`. QA must independently
   reject helper-only evidence, missing client wiring, self-declared path-scope
   waivers, and nonblank-only line counts.
7. Return one terminal report to the head planner: exact SHAs/path inventory,
   F1–F5 trace table, command outcomes, fresh QA ID and mandatory tally,
   physical line counts, disposable-DB identity/cleanup, integration forecast
   against refreshed `origin/main`, and explicit no-live-mutation statement.

## Boundaries

No integration or push. No browser login, live database write, Teaching Load
apply, generation, publication, deployment/restart, schema/migration, or
companion-repository edit. The already integrated EnrollPro proxy source is a
separate stream. Stop on an actual overlapping product-file edit rather than
silently combining streams.

PLANNER_SESSION_ROUTE: FRESH_REQUIRED former planner stopped with an
uncommitted residual and no active worktree-owning process
EXECUTOR_SESSION_ROUTE: FRESH_REQUIRED adopt and complete the interrupted
residual under one writer
QA_SESSION_ROUTE: FRESH_REQUIRED corrected frozen candidate requires
independent review

Suggested commit:

```text
fix(timetable): finish C04R1 Teaching Load module authority correction
```
