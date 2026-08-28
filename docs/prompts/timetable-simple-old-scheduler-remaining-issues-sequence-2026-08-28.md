# Timetable Simple Old-Scheduler Remaining Issues Sequence - 2026-08-28

Use this continuation sequence after the Simple old-scheduler finalization Prompts 00-08.

The timetable is close to Technical GO, but the latest Codex old-scheduler verification found remaining release blockers in proof quality and fixture determinism:

- post-generation teacher-leaving reassignment is reachable and previewable, but full save/revert proof is blocked by `NO_FIXTURE_SOURCE`;
- several active Playwright specs still expect older wording such as `Review draft placement` or `Plan before generating`;
- the mobile touch queue proof cannot find `generated-unassigned-card` in the current live run state;
- broad concurrent runs produced one intermittent readiness-sheet open failure that passed in isolation;
- final signoff still needs one cumulative proof that all active specs match the current plain-language UX.

Run these prompts in order. Do not move to the next prompt until the current prompt's internal gate passes. If a gate fails because the current live fixture cannot support the proof, fix the deterministic fixture/proof path instead of marking it acceptable.

## Sequence

| Iteration | Prompt file | Scope | Internal gate before continuing |
|---:|---|---|---|
| 09 | `docs/prompts/timetable-simple-old-scheduler-finalization-09-test-contract-alignment-2026-08-28.md` | Align stale Playwright wording and release assertions with the current simple timetable UX | Active specs no longer require old labels; focused specs fail on real UX regressions instead of stale copy |
| 10 | `docs/prompts/timetable-simple-old-scheduler-finalization-10-teacher-departure-deterministic-mutation-proof-2026-08-28.md` | Make post-generation teacher-leaving save/revert proof deterministic and non-destructive | Reversible teacher-departure proof passes against an isolated unpublished run or stops with a true implementation blocker |
| 11 | `docs/prompts/timetable-simple-old-scheduler-finalization-11-touch-queue-and-focus-fixture-repair-2026-08-28.md` | Repair generated unassigned touch queue, focus/cancel, and fixture drift tests | Touch queue, focus/cancel, draft planning, and readiness sheet flows pass serially and in the active release bundle |
| 12 | `docs/prompts/timetable-simple-old-scheduler-finalization-12-cumulative-release-proof-2026-08-28.md` | Final old-scheduler release proof after remaining blockers | Static gates, browser gates, live Tailnet evidence, teacher-departure mutation proof, and fixture limitations are recorded in one final report |
| 13 | `docs/prompts/timetable-simple-old-scheduler-finalization-13-status-key-200-percent-reflow-closure-2026-08-28.md` | Close the final Status key 200% reflow accessibility caveat | Status key opens at 200% from More across all required viewports; skips no longer hide dialog/menu failures |

## Current verification evidence to preserve

Refresh all live values before claiming GO. Treat these as 2026-08-28 evidence only:

- Tailnet target: `https://njgrm.buru-degree.ts.net`
- Current live run used by Codex QA: `schoolId=1`, `schoolYearId=2`, `runId=440`, `runVersion=1`
- Latest run has `830` timetable entries.
- Non-mutating teacher-leaving API preview succeeded with:
  - `entryId=entry-101`
  - `subjectId=1`
  - `sectionId=4`
  - `fromFacultyId=24261`
  - `toFacultyId=24258`
  - `proposalCount=5`
  - `errorCount=0`
  - `affectedTeachers=2`
  - `ownershipDeltas=1`
- Full reversible teacher-departure proof is blocked today by `NO_FIXTURE_SOURCE` from `/api/v1/generation/1/2/runs/performance-fixture-source`.
- Old-scheduler live browser proof that passed:
  - `timetable-simple-lost-scheduler.spec.ts`: `36/36` passed across desktop, mobile portrait, and mobile landscape.
  - `timetable-teacher-departure.spec.ts`: `6/6` passed across all configured projects/viewports.
  - focused swap decision specs: `4 passed / 1 skipped` on desktop.
  - targeted publish-blocker flows: `9/9` passed.
  - `timetable-finalization-published-revision.spec.ts`: `1/1` passed.
- Remaining failing or stale proof surfaces:
  - `timetable-teacher-departure-live-reversible.spec.ts`: fails with `NO_FIXTURE_SOURCE`.
  - `timetable-current-full-function-matrix.spec.ts`: expects `Review draft placement`; current UI says `Place this class?`.
  - `timetable-review-focus-and-cancel.spec.ts`: expects `Plan before generating`; current UI uses newer planning language.
  - `timetable-touch-queue-and-reflow.spec.ts`: cannot find `[data-virtualized-rail="Unassigned generated sessions"] [data-testid="generated-unassigned-card"]` in current state.
- broad publish-blocker bundle had one readiness sheet timing failure that passed in isolation.
- final Prompt 12 caveat: Status key at 200% font size was skipped because the dialog did not open or was not reachable. Treat this as an accessibility blocker for Prompt 13, not as a fixture limitation.

## Global executor rules

- Start every prompt by reading this sequence, the specific prompt, `ATLAS_AGENT_KI.md`, and `docs/reference/atlas-runtime-source-of-truth-map.md`.
- Check `git --no-optional-locks status --short --untracked-files=all` before editing.
- Do not revert unrelated user work.
- Keep `/timetable` Simple mode as the default scheduler workflow.
- Do not create live destructive timetable writes during browser proof.
- Reversible mutation tests must create or isolate their own run and must restore or delete the fixture before passing.
- Published timetable teacher-leaving repairs must remain revision-only and must not rewrite canonical Teaching Load ownership.
- Unpublished timetable teacher-leaving repairs may use the existing `/teaching-load-repairs/preview` and `/apply` endpoints only through a deterministic reversible proof.
- Do not change generation algorithm semantics, publish gates, role permissions, EnrollPro ownership, or persisted schedule truth except where a prompt explicitly requires fixture creation for non-destructive test proof.
- Use `@/ui/*` primitives only for any touched UI.
- Preserve no-scroll architecture and old-scheduler target sizes.
- Keep wall-of-text constraints active: decision surfaces must remain concise, visual, and action-first.

## Required command gates

Each prompt must run its focused tests first. Before moving to the next prompt, run the applicable static gates:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

Browser gates must run from the repo root:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-teacher-departure.spec.ts --workers=1 --reporter=line
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

Prompt-specific specs are listed in each file.

## Required Tailnet proof

Use live Tailnet by default:

```bash
cd D:\ATLAS
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing https://njgrm.buru-degree.ts.net/api/v1/health -TimeoutSec 10"
```

Required viewports:

- `1366x768`
- `390x844`
- `844x390`

## Final expected outcome

At the end of Prompt 12:

- teacher-leaving after generation is proven through open, preview, save, verify, revert, and verify-restored steps on an isolated unpublished run;
- published teacher-leaving remains revision-only;
- active specs match current scheduler-facing wording;
- touch queue and focus/cancel specs use deterministic fixtures or honest fixture-limited guards;
- readiness sheet opening is stable in the active release bundle;
- no active timetable component or state presents a wall of text;
- all remaining fixture limitations are real data limitations, not avoidable test gaps;
- final status is Technical GO or a specific NO-GO with exact blocker evidence.

After Prompt 12, run Prompt 13 if the Status key 200% reflow caveat is still present. The sequence may only move from `CONDITIONAL GO` to `Technical GO` when Status key opens and remains usable at 200% across desktop, mobile portrait, and mobile landscape.

Product GO remains pending moderated older-scheduler validation unless the user explicitly accepts browser/operator simulation as enough.

## Suggested final commit

```text
test(timetable): close old-scheduler remaining proof gaps
```
