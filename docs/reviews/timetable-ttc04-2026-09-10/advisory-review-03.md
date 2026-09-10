# Advisory Review 03 — TT-C04R2 changed scope (fresh reviewer)

- Plan: timetable-ttc04; Prompt: TT-C04R2 (remove dead hidden generation bypasses, extend focused test)
- Branch: `work/timetable-ttc04` @ HEAD `67ad632604152689ac1453a9553a9b97d8ee3209`
- Worktree: `D:/ATLAS-worktrees/timetable-ttc04`
- Date (UTC): 2026-09-10
- Reviewer task context identifier: **no parent-relayed execution-system spawn ID was supplied with this review task** — this artifact is authored by a fresh advisory context that did not implement the R2 change and did not author prior reviews/candidates on this branch. Independence is evidenced by the independently rerun commands and timestamps below, not by a relayed ID. Per the sequence protocol this artifact is **advisory evidence only**; it does not constitute formal planner/QA acceptance and does not unlock a successor.

## Base-context check (prior candidates must NOT be rewritten)

`git log --oneline -4` returns, in order: `67ad6326`, `47305835`, `6f8d121f`, `8ec94181`.
Both prior candidates (`67ad6326` fix(timetable): expose the honest no-run primary action;
`47305835` fix(timetable): clarify generation and review workflow states) are intact at HEAD/HEAD~1.
PASS — no rewrite, no rebase detected.

## Reviewed diff identity (uncommitted R2 changed scope only)

`git status --short` (uncommitted): exactly three modified files —
1. `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx` (R2 source fix)
2. `atlas-client/src/lib/__tests__/timetable-operator-workflow-state.test.ts` (R2 test extension)
3. `docs/progress/timetable-ttc04-2026-09-10-progress.md` (ledger bookkeeping only)

`git diff --stat` for the two R2 files:

```
.../components/timetable/TimetableSimpleHeader.tsx | 85 ----------------------
.../timetable-operator-workflow-state.test.ts      | 25 +++++++
2 files changed, 25 insertions(+), 85 deletions(-)
```

Net: pure deletion in production source (-85), pure addition in test (+25). No other
source/test file is touched by the uncommitted diff. (Ledger diff not reproduced here;
it carries no production behavior.)

## Requirement-to-enforcement mapping (R2 scope)

| # | R2 requirement | Enforcement in diff | Verified how |
|---|---|---|---|
| R2-1 | Remove dead hidden mobile lifecycle button (`timetable-simple-mobile-lifecycle-action`, own label/disabled derivation, direct `context.handleTriggerGenerate`) | 85-line deletion in `TimetableSimpleHeader.tsx`: the entire `mobileLabel`/`mobileDisabled`/`mobileIcon` IIFE block plus its `className={cn('hidden',…)}` Button is gone | Diff shows full block removal; repo-wide grep for `timetable-simple-mobile-lifecycle-action` in `atlas-client/src` hits only the new test's `doesNotMatch` assertion lines — zero production references |
| R2-2 | Remove dead hidden direct-generation button (`timetable-simple-generate-action`, weak loading/year check) | Same deletion: the `className="hidden"` Button with `disabled={context.generating \|\| context.loading \|\| !context.schoolYearId}` and `onClick={context.handleTriggerGenerate}` is gone | Repo-wide grep for `timetable-simple-generate-action` hits only the new test's `doesNotMatch` line — zero production references |
| R2-3 | Keep visible production actions unchanged | Diff is deletion-only outside the test: `handleLifecycleAction` dispatcher (lines 176–193, all prior cases intact), no-run sole primary `onClick={handleLifecycleAction}` (line 772), `Preview demand` secondary `onClick={() => setInsertionOpen(true)}` (line 790), More-menu `Plan draft` + `Generate schedule` both `disabled={!canPlanOrGenerate}` (lines 469, 513) are all untouched | Read lines 140–193, 403–554, 732–798, 850–871; no additions/modifications to any visible action |
| R2-4 | Extend the focused test across the full Header source | New test `removed hidden generation bypasses are gone from the full header` (test file lines 138–161) pins: both test IDs absent full-file; no `onClick={context.handleTriggerGenerate}` literal anywhere; no `className="hidden"` within 300 chars before a generation call; `retry-generate` dispatcher case still present; gated More-menu call still present; no-run branch contains no `handleTriggerGenerate`, keeps insertion test ID + `Preview demand` + `setInsertionOpen(true)` | Read test file lines 95–174; suite rerun 24/24 pass (below) |
| R2-5 | No new parallel action introduced | No added JSX/handlers in the header diff | Diff adds zero lines to the header file |

## Check 1 — Both test IDs fully gone

Grep `timetable-simple-mobile-lifecycle-action|timetable-simple-generate-action` over
`D:/ATLAS-worktrees/timetable-ttc04/atlas-client/src`: exactly 2 hits, both inside
`src/lib/__tests__/timetable-operator-workflow-state.test.ts` lines 141–142 (the new
negative assertions themselves). No production file references either ID. PASS.

## Check 2 — No hidden element retains a direct generation call; every remaining call site enumerated

Remaining `handleTriggerGenerate` occurrences in `TimetableSimpleHeader.tsx` (exhaustive, 3 sites):

- Line 182: `case 'generate': if (generationReady) context.handleTriggerGenerate(); break;`
  → inside `handleLifecycleAction`, double-gated by the derived `generate` kind AND the
  `generationReady` (`curriculumReadiness.state === 'ready'`, line 108) call-time check.
- Line 184: `case 'retry-generate': context.handleTriggerGenerate(); break;`
  → inside `handleLifecycleAction`. Gate lives in derivation: `deriveSimpleLifecycleAction`
  (`src/lib/simple-timetable-state.ts` lines 85–115) returns `retry-generate` only after
  the fail-closed gates (scope unresolved → `resolve-scope` disabled; `loading` →
  `retry-readiness` disabled; `unavailable`/`failed` → `retry-readiness`; `blocked` →
  `fix-setup`), and the header always passes a concrete state
  (`context.curriculumReadiness?.state ?? 'unavailable'`, line 163), so the kind is
  unreachable without resolved readiness. No bypass.
- Line 514: More-menu `Generate schedule` item,
  `disabled={!canPlanOrGenerate}` (line 513) with
  `canPlanOrGenerate = scopeResolved && generationReady && !context.generating && !context.loading`
  (line 111). Explicitly gated. PASS (this is the exact call the new test pins at line 149).

Hidden-`className` audit in the header (`Select-String "hidden"`): remaining `hidden`
usages are responsive spans (`hidden sm:inline`), `sr-only` text, the publish button
`className={cn('hidden',…)}` wired to `handlePublishClick` (line 417, publish path — not
generation), readiness-summary banners wired to `setReadinessSheetOpen`, and the
`hidden-row-controls` status row. **No element with a `hidden` class retains any
`handleTriggerGenerate` wiring.** The literal-`className="hidden"` + direct-`onClick`
combination existed only on the removed button. PASS.

## Check 3 — Visible actions unchanged

- `handleLifecycleAction` dispatcher (lines 176–193): all prior cases present and
  byte-identical to the reviewed base (`resolve-scope`, `fix-setup`, `start-draft`,
  `generate`, `retry-generate`, `retry-readiness`, `fix-blockers`, `review-warnings`,
  `publish`, `review-follow-ups`, `generating`, `published`). PASS.
- `Preview demand` secondary (lines 783–796): still rendered only when `generationReady`,
  `disabled={!canPlanOrGenerate}`, `onClick={() => setInsertionOpen(true)}` — preview-only,
  no apply path (corroborated: `UnassignedInsertionWorkflow.tsx` contains zero
  `handleTriggerGenerate` references per timetable-dir grep; suite test
  `insertion workflow stays preview-only with zero production apply` passes). PASS.
- More-menu (lines 469, 511–518): `Plan draft` and `Generate schedule` both still
  `disabled={!canPlanOrGenerate}`. PASS.
- No new button, menu item, handler, or route added (header diff is -85/+0). PASS.

## Check 4 — The extended test actually pins the contract (static reasoning, test untouched)

Restoration scenarios against the new test (lines 138–161):

- Restoring the mobile button (any element carrying `timetable-simple-mobile-lifecycle-action`)
  → fails line 141 `doesNotMatch`. (Its `cn('hidden',…)` form would not trip the
  literal-`className="hidden"` patterns, but the test-ID tripwire is sufficient and specific.)
- Restoring the direct-generation button (`timetable-simple-generate-action` +
  `className="hidden"` + `onClick={context.handleTriggerGenerate}`) → fails lines 142,
  144, AND 145 (triple tripwire).
- Adversarial variant (restored call, no test ID): fails line 144
  (`onClick={context.handleTriggerGenerate}` literal) for the direct-reference form, or
  line 145 (`className="hidden"` within 300 chars before a generation call) for a hidden
  wrapper around the call form.
- No false positives on legit code: lines 182/184 live in handler logic with no nearby
  `className`; line 514's item uses `className="h-9 gap-2 text-xs"`; the publish button
  uses `className={cn(…)}` (not the literal `className="hidden"`). Confirmed by the green run.
- No-run branch slice (lines 153–160): restoring any `handleTriggerGenerate` into the
  no-run prompt fails line 157; removing preview-only wiring fails lines 158–160.

I did not edit the test; the suite passing with the production deletion applied, combined
with the above per-assertion tripwire analysis, establishes the pin. PASS.

## Check 5 — Adversarial: no-run generation paths after this change (exhaustive trace)

For `!hasGeneratedRun && !context.isPreGenerationWorkspace`, every UI path that can invoke
generation, and its gate:

1. **No-run sole primary** (`timetable-simple-primary-action`, line 767–781) →
   `handleLifecycleAction`. Reachable `generate` calls: `generate` kind (double-gated:
   derivation post-readiness + `generationReady` call-time check) and `retry-generate`
   kind (gated by derivation; only derivable when readiness already resolved `ready`,
   header default fail-closed to `unavailable`). All other kinds route away from generation
   (`fix-setup` → curriculum repair nav; `start-draft` → `plan-draft` task, not a run;
   `retry-readiness` → `handleRefresh` readiness re-check; unresolved/loading states are
   `disabled`). No direct call remains in the no-run branch (test line 157 + read of
   lines 732–798 confirm).
2. **Preview demand** (line 783–795) → `setInsertionOpen(true)` only; insertion workflow
   has no generation/apply wiring (zero `handleTriggerGenerate` hits; dedicated
   preview-only suite test passes). Preview cannot trigger a run.
3. **More-menu Generate schedule** (line 511–518) → `disabled={!canPlanOrGenerate}`
   (`scopeResolved && generationReady && !generating && !loading`). Same gate family as
   the lifecycle path, strictly stronger (adds scope + in-flight guards).
4. **More-menu Plan draft** (line 469) → `startTask('plan-draft')`, same gate, draft
   planning only — not a generation run.
5. Removed paths (mobile hidden button with its own weak label/disabled derivation;
   hidden direct button with loading/year-only check) no longer exist anywhere in the file.

Conclusion: **no, a no-run operator cannot reach generation without the shared
lifecycle/readiness gate after this change.** Every surviving path funnels through
`generationReady` (curriculum `ready`), and the menu path additionally requires resolved
scope and no in-flight work. The deleted buttons were the only paths that bypassed the
shared derivation (mobile button re-derived its own label/enabled state; hidden button
checked only loading/year). Their removal strictly reduces bypass surface.

Out-of-scope observation (NOT a finding on this diff): `ScheduleReviewWorkspaceHeader.tsx`
lines 463 and 859 wire visible Generate / Regenerate Draft buttons with the weaker
`generating || loading || !schoolYearId` (+ drift) check. That is the generated-run review
workspace surface, a different component outside the TT-C04R2 changed scope, and it is not
reachable from the no-run operator path traced above. Flagged for planner awareness only;
no action required in R2.

Minor asymmetry noted (NOT a finding / no fix required): the `generate` dispatcher case
re-checks `generationReady` at call time while `retry-generate` relies solely on the
derivation gate. This is safe because the derivation is fail-closed and the header always
supplies a concrete readiness state, and both surviving paths are pinned by the new test.
A future hardening pass may add the symmetric call-time check, but it is outside R2 scope
and must not be snuck into this diff.

## Independently rerun results (no broad suites; source untouched by reviewer)

1. `npm run test:timetable-operator-ux` in `D:/ATLAS-worktrees/timetable-ttc04/atlas-client`
   (runs `timetable-operator-workflow-state.test.ts` + `timetable-ttc02-insertion.test.ts`):
   **24 pass, 0 fail, 0 skipped** — exit 0. Includes the pre-existing no-run bypass test
   and the new `removed hidden generation bypasses are gone from the full header` test.
2. `npx tsc --noEmit` in the same directory: **clean, no output — exit 0.**

Reviewer performed zero edits, zero commits, zero pushes, zero rebases, no service
restarts, no generation/save/publish, and touched no server, companion-repo, or database
state. Only this artifact file was written.

## Findings

None. No required fixes in the R2 changed scope. The two modified files match the R2
instruction exactly; visible actions are preserved; the extended test pins the contract
with failing-on-restoration tripwires; all no-run generation paths remain behind the
shared lifecycle/readiness gate.

## Verdict

- `zeroFix: true`
- R2 changed scope is correct and complete as far as this advisory review can determine;
  returned for formal planner/QA review (this advisory artifact alone does not constitute
  acceptance or unlock any successor).
