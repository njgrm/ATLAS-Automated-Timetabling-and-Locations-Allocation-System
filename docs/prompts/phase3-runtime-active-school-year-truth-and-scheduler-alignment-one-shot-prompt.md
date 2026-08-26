# Copilot Execution Prompt: Phase 3 Runtime Active School Year Truth And Scheduler Alignment One-Shot

## Objective

Fix the runtime source-of-truth bug that is causing scheduler pages, especially `Teaching Load`, to bootstrap into the wrong school year.

This is now the highest-priority blocker because current live behavior proves the app is mixing two real datasets:

- `schoolYearId = 1`
  - `Coverage 190 / 794`
  - `Unassigned 604`
- `schoolYearId = 55`
  - `Coverage 962 / 962`
  - `Unassigned 0`

The user-facing symptom is:

- route entry can briefly show `Working from Saved Data`
- `Teaching Load` can render the `190 / 794` state
- refresh can then show the other state

This is not a normal stale-cache flicker.
It is a runtime active-school-year truth failure.

This pass must:

1. make ATLAS resolve the correct active school year consistently
2. stop scheduler pages from bootstrapping into the wrong year
3. stop cached first-render state from masquerading as final truth
4. verify the fix directly on Tailnet and report the live result

This is a strict Copilot-owned backend + frontend + Tailnet-verification pass.

## User Approval For Live Testing

The user has explicitly approved aggressive testing for this pass because current `Teaching Load` data can be recreated and is not precious.

Allowed in this pass:

- local code changes
- local build/test runs
- Tailnet read verification
- Tailnet UI verification
- controlled live runtime/year-resolution correction if required
- controlled live testing of the corrected runtime flow

Still forbidden:

- broad destructive reset as a shortcut
- wiping teaching-load ownership just to hide the bug
- mutating unrelated school years or schools
- undocumented direct DB edits without code-backed reasoning and evidence

If a live mutation is needed, keep it narrow and explicit:

- school `1` only
- active-school-year/runtime-context repair only
- no broad assignment wipe

## Out of Scope

Do not:

- reopen rotational load math
- redesign `Teaching Load`
- do another special-program redistribution pass
- reset global teaching load as the primary fix
- change published-schedule behavior
- reopen unrelated faculty, sections, or public-schedule features except where they depend on active school year resolution

## Required Reading

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- `atlas-client/src/lib/settings.ts`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/Dashboard.tsx`

## Confirmed Live Failure

Current live Tailnet verification shows:

- `GET /api/v1/runtime/context?schoolId=1`
  - `activeSchoolYearId = 1`
  - `activeSchoolYearLabel = 2026-2027`
  - `source = atlas-persisted`
  - `upstream.reachable = true`
  - `upstream.verified = false`
  - `upstream.matched = false`

At the same time:

- `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=1`
  - `assignedPairs = 190`
  - `totalPairs = 794`
  - `unassignedPairs = 604`
- `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55`
  - `assignedPairs = 962`
  - `totalPairs = 962`
  - `unassignedPairs = 0`

And the current client contract makes this worse:

- `resolveActiveSchoolYearContext()` can return cached year context before live verification
- `FacultyAssignments` warm-loads cached summary/subject/section payloads for that resolved year
- `FacultyAssignments` still classifies upstream truth too narrowly (`yearContextSource === 'enrollpro'`)
- `ActiveSchoolYearContext.source` typing is stale and does not match current runtime values like:
  - `atlas-persisted`
  - `enrollpro-verified`

Most likely root cause to prove or disprove:

- `atlas-server/src/services/runtime-context.service.ts`
- `pickBestRuntimeYear()` currently prioritizes `scheduling-policy` over fresher scheduler evidence
- a stale policy row on `schoolYearId = 1` may be outranking the real active scheduler dataset on `55`

## Required Outcomes

### A. Fix active-school-year truth at the backend

You must determine why `/api/v1/runtime/context` resolves `schoolYearId = 1` instead of `55`.

You must inspect and correct:

- evidence priority
- stale-year selection rules
- upstream match behavior
- any persisted runtime-context assumptions that let an old policy row dominate

The final backend rule must produce the correct scheduler year for school `1` on Tailnet.

Do not leave this as a frontend-only workaround.

### B. Unify frontend source typing and classification

`ActiveSchoolYearContext.source` and downstream client logic must match current backend runtime reality.

Required:

- stop returning impossible/under-typed source values
- stop treating only literal `enrollpro` as live truth
- correctly handle:
  - `atlas-persisted`
  - `enrollpro-verified`
  - `cache`

All scheduler pages that depend on active school year must classify runtime state consistently.

### C. Fix bootstrap behavior on scheduler pages

Pages must stop presenting the wrong school year as final truth during bootstrap.

At minimum fix:

- `Teaching Load`
- `Teachers`
- `Sections`
- `Subjects`
- `Dashboard`

Required behavior:

1. If cached data is shown before live verification settles, label it as a transient refresh state, not final saved-data truth.
2. Do not render stale metrics for the wrong year as if they are the active live workspace.
3. If runtime context resolves to a different year than the last cached page snapshot, suppress or invalidate mismatched cached page truth.
4. If EnrollPro is reachable but runtime is still ATLAS-persisted, explain that honestly without implying upstream outage.

### D. Align shell-level active year and page-level active year

`AppShell` and page-level resolution must not disagree.

Required:

- the selected year displayed in the shell
- the year used by scheduler pages
- the year coming from `/runtime/context`

must converge on the same value.

No silent shell/page split is allowed.

### E. Test it directly on Tailnet

Copilot must not stop at local builds.

It must prove the fix on Tailnet by:

1. checking runtime context before and after
2. opening the real `Teaching Load` route
3. verifying the route no longer boots into the `190 / 794` state when `55` is the intended scheduler year
4. verifying refresh/re-entry stays stable

If a narrow live correction step is required to make runtime context truthful, do it and report exactly what changed.

### F. Update documentation and evidence

This pass must update:

- `docs/verification/evidence-log.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`

The evidence entry must clearly distinguish:

- local build/test proof
- Tailnet runtime-context proof
- whether live year truth changed
- whether `Teaching Load` now consistently boots into the correct year

## Implementation Directives

### 1. Fix the backend before masking in UI

Do not solve this purely by forcing the client to remember `55`.

The first priority is making `/api/v1/runtime/context` truthful.

Likely areas to inspect:

- stale `scheduling-policy` priority dominance
- mirror/snapshot evidence ranking
- active-year upstream reconciliation when `upstream.reachable = true` but `matched = false`
- whether a policy row from a previous school year should still outrank fresher scheduler evidence

### 2. Harden client typing and runtime classification

Fix `atlas-client/src/lib/enrollpro-public-settings.ts` and any downstream consumers so the client contract is type-safe and runtime-accurate.

Do not leave stale unions like:

- `'atlas' | 'enrollpro' | 'cache'`

when the real contract already uses:

- `atlas-persisted`
- `enrollpro-verified`

### 3. Prevent wrong-year cached first paint

If cached page state belongs to a different year than the newly resolved runtime year, do not paint it as authoritative workspace truth.

This may require:

- page-cache scoping hardening
- year-aware invalidation
- deferred display until year resolution settles
- softer `Refreshing...` state instead of `Working from Saved Data`

### 4. Keep the no-scroll scheduler shell intact

Do not regress the current EnrollPro shell/layout rules while fixing source-state behavior.

No browser-level scrollbars.
No raw controls.
No giant new banners.

### 5. Keep the fix school-agnostic

Do not hardcode `55`.

The logic must choose the correct scheduler year from real runtime evidence, not from a pilot-school special case.

## Verification Requirements

### Automated

Run:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`

Run any targeted tests needed for runtime context and client source classification.

If no current regression test exists for this path, add coverage for:

- runtime year evidence ranking
- `enrollpro-verified` vs `atlas-persisted` client classification
- wrong-year cached bootstrap suppression

### Tailnet Verification

You must test on the live Tailnet environment, not localhost.

Minimum required proof:

1. `GET /api/v1/runtime/context?schoolId=1`
   - before fix result
   - after fix result
2. `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=<resolvedYear>`
   - prove the resolved year matches the page truth
3. open `/teaching-load`
   - verify first render
   - verify refresh
   - verify route re-entry
4. confirm the page no longer flashes the wrong `190 / 794` workspace if the resolved scheduler year is the repaired one
5. verify `Teachers` and `Sections` do not regress into false saved-data messaging on normal re-entry under the corrected year

### Evidence Log

Append a full entry to `docs/verification/evidence-log.md` with:

- files changed
- local builds/tests
- Tailnet runtime-context evidence
- whether any controlled live correction was executed
- final resolved active school year
- page-level results for `Teaching Load`, `Teachers`, and `Sections`

Do not claim `GO` without direct Tailnet proof.

## GO / NO-GO

### GO only if

- `/api/v1/runtime/context` resolves the correct scheduler year on Tailnet
- shell-level and page-level active year agree
- `Teaching Load` no longer boots into the wrong-year `190 / 794` workspace
- refresh and route re-entry remain stable
- source-state messaging is honest
- builds/tests pass
- evidence log is updated with real Tailnet results

### NO-GO if

- runtime context still resolves the wrong year
- the client merely hides the wrong-year state without fixing backend truth
- `Teaching Load` can still first-paint the wrong school year
- shell year and page year can still diverge
- Tailnet proof is missing
