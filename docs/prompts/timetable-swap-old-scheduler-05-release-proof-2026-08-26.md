# Prompt 05 - Swap Old-Scheduler Release Proof

## Role

You are the ATLAS release verifier. Do not add new product scope in this prompt unless a small test or documentation correction is required to prove the sequence honestly.

## Problem

The swap redesign must not be signed off from source checks alone. It must prove that generated swap, draft review, blocked recovery, keyboard cancellation, and mobile/landscape layout remain usable on live Tailnet.

## Required prerequisite

Prompts 01-04 must be complete. Any `NO-GO` must be explicitly carried into this prompt and either fixed or left as a release blocker.

## Target files to inspect

- All files changed by Prompts 01-04
- `atlas-client/src/lib/__tests__/ux-guardrails.test.ts`
- `qa-artifacts/playwright/specs/`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

## Scope

In scope:

- cumulative verification;
- evidence documentation;
- minor test/doc corrections;
- final GO/NO-GO decision.

Out of scope:

- new visual redesign beyond what Prompts 02-04 requested;
- live destructive timetable writes unless a reversible fixture was explicitly built and restored;
- claiming Product GO from automated testing alone.

## Required verification

1. Check worktree state:
   - `git --no-optional-locks status --short`
2. Re-run static gates:
   - client type-check;
   - client build;
   - UX guardrails;
   - timetable conflict tests.
3. If backend files changed in Prompt 04:
   - server type-check;
   - server build;
   - built server startup;
   - health route;
   - touched swap preview route.
4. Re-run all new browser specs:
   - baseline;
   - generated visual decision;
   - draft visual parity;
   - blocked recovery.
5. Run any existing timetable simplification or older-user Playwright specs that overlap swap opening and cancellation.
6. Manually inspect screenshots/artifacts for:
   - modal not reading as a wall of text;
   - recommended option visible;
   - selected option status visible;
   - blocked next action visible;
   - footer action visibility;
   - mobile portrait and mobile landscape fit.
7. Verify no live write leakage:
   - browser routes should intercept or never invoke swap commit in non-mutating specs;
   - if any reversible write fixture is used, prove exact restoration.

## Required release evidence document

Create:

- `docs/verification/timetable-swap-old-scheduler-release-proof-2026-08-26.md`

Include:

- sequence summary;
- files changed by prompt;
- command results table;
- live Tailnet viewport results;
- before/after metrics table;
- screenshot/artifact paths;
- no-write or reversible-write proof;
- remaining risks;
- final verdict.

Append a concise entry to:

- `docs/verification/evidence-log.md`

Only update `docs/reference/atlas-runtime-source-of-truth-map.md` if the implementation changed page dependencies, runtime ownership, fallback behavior, or API contracts.

## Required final gates

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts ../qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts ../qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts ../qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

If backend files changed:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
```

## Acceptance criteria

- Generated swap opens from Simple mode on desktop, mobile portrait, and mobile landscape.
- Generated swap primary path has no more than three visual regions.
- Generated swap avoids desktop inner scrolling for the baseline fixture, or any remaining local scroll is justified with exact evidence and no hidden footer action.
- Selected strategy drives visible status and conflict counts.
- Blocked swap shows at least one useful manual next action.
- Draft placement review uses the same simplified visual language.
- Draft swap is verified or honestly classified as fixture-limited.
- No raw native controls are introduced.
- No global page overflow is introduced.
- No live timetable write occurs in non-mutating specs.
- Product GO remains pending real older-scheduler moderated validation unless the stakeholder explicitly accepts automated evidence as enough.

## Final report requirements

Return one comprehensive final report:

- final `GO` or `NO-GO`;
- per-prompt status table;
- files changed;
- commands and results;
- live viewport evidence;
- artifact paths;
- remaining caveats;
- suggested commit message.
