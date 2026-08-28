# Prompt 05 - Cumulative Release Proof

## Role

You are the ATLAS executor assigned to produce the final Technical GO / NO-GO evidence for Simple timetable old-scheduler readiness.

This prompt should not introduce broad new behavior. Fix only small release-blocking regressions discovered during proof. If a blocker requires product or backend redesign, report `NO-GO` with exact evidence.

## Required preflight

Before editing:

1. Confirm Prompts 00-04 are GO.
2. Read:
   - `docs/prompts/timetable-simple-old-scheduler-finalization-sequence-2026-08-28.md`
   - every prompt file from this sequence;
   - `docs/reference/atlas-runtime-source-of-truth-map.md`.
3. Check git state and latest commit.

## Scope

In scope:

- final source guards;
- final static and browser gates;
- live Tailnet old-scheduler journey proof;
- evidence document under `docs/verification/`;
- small release-blocking fixes only.

Out of scope:

- new feature work;
- generation algorithm changes;
- backend writes;
- product signoff by proxy;
- claiming moderated older-scheduler validation without a real moderated session.

## Required cumulative checks

### 1. Source guards

Run source guards for:

- raw `<button>`, native `<select>`, raw `title`, native `<details>` in timetable interactive components;
- stale swap copy: `Review occupied-slot swap`, `Blocking 0`, `Blocking - - Warnings -`;
- weak swap assertion: `primaryRegionCount).toBeGreaterThanOrEqual(1)`;
- broken More tutorial handler;
- nested status key trigger inside the Simple status-key dialog;
- critical Simple actions using `h-7` or `h-8`;
- visible Advanced foolproof help still hidden as `sr-only`.

Any positive hit must be explained as either fixed, allowed non-critical, or `NO-GO`.

### 2. Static and unit gates

Run:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

If backend files changed in earlier prompts, also run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
```

Backend changes are not complete until the built server can start and touched routes respond.

### 3. Focused browser gates

Run all focused specs created or updated by Prompts 00-04.

Also run:

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts timetable-swap-old-scheduler-baseline.spec.ts timetable-swap-visual-decision.spec.ts timetable-draft-review-visual-parity.spec.ts timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

### 4. Live Tailnet old-scheduler journey

Use:

- `https://njgrm.buru-degree.ts.net/timetable`
- Admin test account from ATLAS project instructions

Capture evidence for:

- desktop `1366x768`;
- mobile portrait `390x844`;
- mobile landscape `844x390`.

For each viewport, prove:

- no app-critical console errors;
- no global horizontal overflow;
- Simple next action is visible and readable;
- visible helper line exists;
- primary action is visible and old-scheduler-sized;
- Tutorial opens from the direct header path;
- Tutorial opens from More/help path;
- Status key shows definitions directly;
- More menu does not bury Help;
- generated swap review still has exactly three primary regions and no footer overlap;
- publish/blocker state gives a direct next action;
- no primary modal or drawer presents a wall of text before the action.

Save screenshots under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\05-release-proof\
```

### 5. Evidence document

Create:

```text
docs/verification/timetable-simple-old-scheduler-finalization-release-proof-2026-08-28.md
```

The document must include:

- prompt-by-prompt GO/NO-GO ledger;
- files changed;
- commands and results;
- viewport screenshots;
- remaining fixture limitations;
- Technical GO / NO-GO verdict;
- Product GO status.

## Final verdict rules

Technical GO requires:

- all required static gates pass;
- all required source guards are clean or explicitly justified;
- live Tailnet three-viewport proof passes;
- generated swap is live-proven;
- fixture-limited draft/blocked states are honestly marked;
- no wall-of-text primary decision state remains in the tested journey.

Product GO requires:

- moderated older-scheduler validation, or explicit user acceptance to defer it.

If Product GO is not available, report:

```text
Technical GO, Product GO pending moderated older-scheduler validation.
```

## Final report requirements

Report:

- final verdict;
- files changed;
- command results;
- browser evidence paths;
- fixture limitations;
- remaining risks;
- suggested commit message.
