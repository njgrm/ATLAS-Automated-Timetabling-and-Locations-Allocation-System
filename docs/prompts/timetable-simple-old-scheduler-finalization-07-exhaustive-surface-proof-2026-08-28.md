# Prompt 07 - Exhaustive Timetable Surface Proof

## Role

You are the ATLAS executor assigned to prove that the timetable is as old-scheduler-friendly as the current product can be before Codex QA re-checks it.

This is an exhaustive proof prompt. Do not introduce broad new behavior here. Fix only small regressions found while running the proof. If a surface fails the old-scheduler standard and needs real redesign, mark `NO-GO` and report the exact surface.

## Required preflight

Before editing:

1. Confirm Prompt 06 is GO.
2. Read:
   - `docs/prompts/timetable-simple-old-scheduler-finalization-sequence-2026-08-28.md`
   - `docs/prompts/timetable-simple-old-scheduler-finalization-06-no-go-remediation-2026-08-28.md`
   - `docs/reference/atlas-runtime-source-of-truth-map.md`
3. Inspect the current source for all timetable user-facing surfaces:
   - `atlas-client/src/pages/ScheduleReview.tsx`
   - `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
   - `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
   - `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
   - `atlas-client/src/components/timetable/ScheduleReviewWorkspaceBody.tsx`
   - `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
   - `atlas-client/src/components/timetable/SimplePublishReadinessSheet.tsx`
   - `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`
   - `atlas-client/src/components/timetable/TimetableCellOverflowSheet.tsx`
   - `atlas-client/src/components/timetable/TeacherDepartureRecoverySheet.tsx`
   - `atlas-client/src/components/timetable/ManualEditPanel.tsx`
   - `atlas-client/src/components/timetable/RightPanel.tsx`
   - `atlas-client/src/components/timetable/LeftRail.tsx`
   - `atlas-client/src/components/timetable/LeftRailContent.tsx`
   - `atlas-client/src/components/timetable/CenterWorkspace.tsx`
   - `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
   - `atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx`
4. Check git state.

## Scope

In scope:

- exhaustive live interaction proof for `/timetable`;
- Simple and Advanced mode surface audit;
- wall-of-text detection;
- old-scheduler next-action clarity;
- screenshot and metrics evidence;
- small fixes to release-blocking UI/test defects found during proof.

Out of scope:

- backend algorithm changes;
- changing persisted schedule truth;
- live destructive saves/publishes;
- rewriting unrelated setup pages;
- moderated Product GO.

## Required old-scheduler standard

Every opened timetable component/state must satisfy:

- It answers `What is happening?`
- It answers `What should I do next?`
- It does not require technical enum interpretation.
- It does not present a wall of text before the first action.
- It has a visible close/cancel/back path.
- Its primary action is visually clear.
- It uses old-scheduler-friendly target sizes for critical actions.
- It avoids global page overflow.
- It works in desktop, mobile portrait, and mobile landscape.

## Required surfaces to open

Open and capture proof for every reachable non-destructive surface below.

Simple mode:

- initial Simple timetable header;
- source chip/details;
- readiness chip/sheet;
- Section, Teacher, and Room schedule switching;
- entity selector or mobile schedule sheet;
- direct Tutorial;
- More -> Tutorial;
- direct Status key;
- More -> Status key;
- More -> Filters;
- More -> How this works route or equivalent help path;
- More -> Place unresolved sessions;
- More -> Swap sessions;
- More -> Plan draft;
- More -> Teacher leaving / Reassign load;
- More -> Review issues;
- More -> Schedule data actions where non-destructive;
- selected class strip;
- selected class More menu;
- selected class Details sheet;
- selected class Move flow up to non-destructive preview;
- selected class Swap flow up to non-destructive review;
- cell overflow sheet if a multi-entry cell exists.

Decision/review states:

- generated placement review if fixture exists;
- generated swap review;
- generated swap preview-failure state if reachable;
- draft placement review if fixture exists;
- draft swap review if fixture exists;
- blocked swap/placement recovery if fixture exists;
- publish readiness blockers;
- warning/details disclosure.

Advanced mode:

- Advanced task guide;
- visible foolproof help;
- left rail collapsed/expanded;
- Violations tab;
- Unassigned tab;
- Requests tab;
- Pinned/draft queue if present;
- right panel selected-class details;
- manual edit panel entry points up to preview;
- Tactical Sandbox / Teaching Load repair entry up to non-destructive preview if present;
- room/map/policy/preferences expert tools if exposed from the timetable shell.

If a fixture is unavailable, record it as fixture-limited with the selector and API/runtime evidence used to prove unavailability.

## Wall-of-text measurement

For every modal, sheet, drawer, popover, or menu opened:

- record visible word count;
- record primary region count if applicable;
- record whether body scroll is required before the first primary action;
- record whether action footer overlaps primary content;
- record whether any raw enum or diagnostic phrase is visible.

Failure thresholds:

- Primary decision modal over 90 visible words before actions: `NO-GO` unless the content is a review list and the first action remains visible.
- Drawer first viewport over 140 visible words before the first action: `NO-GO`.
- Menu over 55 visible words in the first visible viewport: `NO-GO` unless it is locally scrollable and Help/Daily tasks remain visible.
- Any visible raw enum such as `UNASSIGNED_SECTION`, `FACULTY_SLOT_UNAVAILABLE`, `NO_AVAILABLE_SLOT`, or `ROOM_TYPE_MISMATCH` in scheduler-facing copy: `NO-GO` unless paired with plain text and hidden behind `Explain`.
- Any primary action hidden below a scroll requirement at `844x390`: `NO-GO`.

## Required tests

Create or update one exhaustive non-mutating Playwright proof spec that:

- runs on `1366x768`, `390x844`, and `844x390`;
- opens the surfaces listed above where fixtures exist;
- records screenshots and JSON metrics;
- blocks or cancels destructive writes;
- fails on the wall-of-text thresholds above;
- fails when Status key definitions are not directly visible;
- fails when More remains visible behind a child dialog/sheet/popover;
- fails when swap preview failure still shows a disabled-looking commit action;
- fails when stale `Review occupied-slot swap` is required by active release specs.

## Required commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

```bash
cd D:\ATLAS
npx playwright test -c playwright.config.ts timetable-simple-view-completion.spec.ts timetable-simple-ease-of-use.spec.ts timetable-simple-publish-blockers.spec.ts timetable-swap-old-scheduler-baseline.spec.ts timetable-swap-visual-decision.spec.ts timetable-draft-review-visual-parity.spec.ts timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

Run the new exhaustive proof spec separately and include its result.

## Required Tailnet proof

Use live Tailnet:

- `https://njgrm.buru-degree.ts.net/timetable`
- Admin credentials from project instructions

Save artifacts under:

```text
D:\ATLAS\qa-artifacts\timetable-simple-old-scheduler-finalization\07-exhaustive-surface-proof\
```

Required artifact files:

- one screenshot per opened surface per viewport where applicable;
- `surface-proof-metrics.json`;
- `fixture-limitations.json`;
- final Markdown evidence document:

```text
docs/verification/timetable-simple-old-scheduler-finalization-exhaustive-proof-2026-08-28.md
```

## Final verdict rules

Technical GO requires:

- Prompt 06 remains GO;
- all static gates pass;
- all active focused Playwright gates pass;
- exhaustive proof spec passes;
- no reachable old-scheduler surface violates the wall-of-text thresholds;
- no known stale/weak active test contract remains;
- all fixture-limited states are honestly documented.

Product GO remains pending real moderated older-scheduler validation unless the user explicitly accepts simulated/browser evidence as enough.

## Final report requirements

Report:

- final Technical GO / NO-GO;
- every surface opened;
- surfaces skipped and why;
- files changed;
- commands and results;
- screenshot/artifact paths;
- wall-of-text metrics summary;
- fixture limitations;
- Product GO status;
- suggested commit message.
