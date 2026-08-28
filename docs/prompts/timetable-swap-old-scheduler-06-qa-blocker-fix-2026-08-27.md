# Prompt 06 - Swap Old-Scheduler QA Blocker Fix

## Role

You are the ATLAS executor assigned to fix the QA blockers found after `refactor(timetable): simplify swap review for scheduler usability`.

Do not add new timetable feature scope. Fix only the defects and proof gaps listed here, then rerun the release proof honestly.

## QA verdict to address

Codex QA marked the Prompt 01-05 implementation `NO-GO` for these blockers:

1. `TimetablePlacementDialogs.tsx` introduced a raw `<button>` for generated swap option rows, violating the ATLAS `@/ui/*` primitive rule.
2. The generated swap body still requires local modal scrolling on mobile landscape. On live Tailnet at `844x390`, the actual body container measured `scrollHeight: 600` and `clientHeight: 205`, with the selected status panel below the initial viewport and the sticky footer intersecting the options area.
3. Blocked recovery was not live-proven. The latest blocked-recovery metrics showed `isBlocked=false`, `hasManualActions=false`, and `hasCancelSafely=false`, while the spec only asserted manual actions when it happened to find a blocked pair.
4. Draft review parity was not live-proven. The latest draft parity run skipped three checks because no draft queue fixture was available.
5. The reported committed scope was inaccurate. The source commit included only two component files; the Playwright specs and screenshots under `qa-artifacts/` are ignored and untracked unless explicitly force-added or moved to a tracked test location.
6. The current Playwright checks are too weak: the baseline spec now asserts the new title, the visual-decision spec allows up to four sections despite the three-region target, the scroll check measures `ReviewActionSheet` instead of the actual scroll container, and blocked recovery does not force or locate a blocked pair.

## Required preflight

Before editing:

1. Read the sequence and Prompts 01-05:
   - `docs/phases/timetable-swap-old-scheduler-ux-sequence-2026-08-26.md`
   - `docs/prompts/timetable-swap-old-scheduler-01-baseline-and-fixture-2026-08-26.md`
   - `docs/prompts/timetable-swap-old-scheduler-02-generated-swap-visual-decision-2026-08-26.md`
   - `docs/prompts/timetable-swap-old-scheduler-03-draft-review-parity-2026-08-26.md`
   - `docs/prompts/timetable-swap-old-scheduler-04-blocked-autofix-manual-actions-2026-08-26.md`
   - `docs/prompts/timetable-swap-old-scheduler-05-release-proof-2026-08-26.md`
2. Check current git state:

```bash
cd D:\ATLAS
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks log -1 --oneline
git --no-optional-locks show --name-only --format= HEAD
git check-ignore -v qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts
```

3. Inspect:
   - `atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx`
   - `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`
   - `atlas-client/src/lib/__tests__/ux-guardrails.test.ts`
   - `qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts`
   - `qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts`

If any blocker cannot be fixed safely, report `NO-GO` with exact reason and continue fixing independent blockers where possible.

## Scope

In scope:

- generated swap review layout hardening;
- draft review parity proof or honest fixture-limited classification;
- blocked recovery proof and interaction hardening;
- Playwright spec corrections;
- source-level design-system guardrail corrections;
- documentation/evidence corrections for ignored QA artifacts.

Out of scope:

- changing generation truth;
- changing swap preview or commit semantics unless required to expose existing blocked-state data;
- adding new timetable write paths;
- changing publish lifecycle gates;
- changing Teaching Load ownership rules;
- claiming older-scheduler Product GO from automated checks alone.

## UI Implementation Directive: Timetable Swap QA Closure

**Target File(s):** `atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx`, `atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx`
**Framework Requirements:** `@/ui/*` shadcn primitives, `lucide-react`, existing ATLAS Tailwind tokens

**Layout Constraints to Enforce:**
- Keep the modal footer in a `shrink-0` action zone that never overlaps decision content.
- The actual modal body scroll container, not only `ReviewActionSheet`, must be measured in tests.
- At `1366x768` and `390x844`, the generated swap title, affected classes, all strategy options, selected-strategy status, and footer actions must be visible without internal body scrolling for the baseline fixture.
- At `844x390`, the generated swap must keep the title, affected classes, all strategy options, and primary footer actions visible without footer overlap. If any local scroll remains, the selected-strategy status must remain reachable with a visible scroll cue, and the final report must include exact `scrollHeight`, `clientHeight`, and footer-overlap measurements.
- Use visual grouping and concise labels. Do not restore dense paragraph sections or long explanatory copy.

**Component Selection:**
- Replace raw option-row `<button>` controls with the project `Button` primitive or an existing local shadcn/Radix selectable control pattern.
- Use `Tooltip`, `Popover`, or inline helper text for compact explanations. Do not use raw `title` attributes or native disclosure controls.
- Use `Badge` or equivalent existing primitives for recommended, unavailable, warning, and blocked status labels.
- Use lucide icons only where they clarify status or action.

**Developer Instructions for Claude/Codex:**
"Fix the current swap review implementation so it satisfies the original old-scheduler goal under real viewport constraints. Preserve the three-region decision model, preserve selected-strategy-aware status, and keep the server-owned swap preview/commit contract intact. Do not introduce raw native controls. The final UI must let a scheduler decide what will happen, which option is recommended, why an option is unavailable, and what to do when blocked without reading a wall of text."

## Required fixes

### 1. Replace raw native controls

Find every raw interactive control introduced by the swap redesign.

Required outcome:

- No raw `<button>` remains in the generated swap option list.
- New controls use `@/ui/button` or an existing shadcn/Radix project primitive.
- Keyboard focus, selected state, disabled state, and `aria-pressed` or equivalent state are preserved.
- `npm run test:ux-guardrails` either catches this class of violation or a targeted source-pattern test proves the swap modal does not use raw controls for strategy rows.

### 2. Fix generated swap body fit and footer overlap

Rework only the generated swap review layout as needed.

Required outcome:

- The footer no longer overlaps or covers swap option rows on mobile landscape.
- The selected-strategy status is no longer buried below a large scroll region in normal desktop and mobile portrait.
- The mobile landscape composition is compact and direct: affected classes, strategy choices, and primary action must stay understandable in one glance.
- The modal must not re-expand into the earlier five-section wall of text.

Do not solve this by shrinking all text below readable sizes. Keep touch targets and labels suitable for older scheduler users.

### 3. Make blocked recovery real or honest

Audit the blocked-state actions added in Prompt 04.

Required outcome:

- If an action label says `Review blockers`, it must open or focus a real blocker/conflict explanation surface.
- If an action label says `Try manual move`, it must open or focus the real manual move workflow for the affected class when that workflow exists.
- If no real action is available, rename the control to an honest non-action such as `Close and choose another pair`, and do not present it as a fix.
- A blocked swap must never leave the scheduler with only a disabled commit button.

### 4. Strengthen blocked recovery proof

Fix the Playwright blocked recovery spec so it cannot pass without exercising a blocked state.

Required outcome:

- The spec must either locate a real live blocked pair or create a non-mutating preview fixture that deterministically renders `recommendedStrategy=BLOCKED`.
- If the app cannot provide a safe blocked fixture, the final report must mark blocked recovery `NO-GO` instead of silently passing.
- The spec must assert visible manual next action text, cancel safety, and absence of a destructive write request.

### 5. Strengthen layout proof

Fix the visual decision spec to measure the actual modal body container and footer geometry.

Required outcome:

- The spec records `scrollHeight`, `clientHeight`, footer rectangle, section rectangles, and any footer overlap for all three viewports.
- The spec fails if the footer intersects strategy rows or primary decision content.
- The spec fails if the generated swap non-blocked path has more than three primary visual regions.
- The spec fails if selected strategy status always shows direct-swap data after a non-direct strategy is selected.

### 6. Restore a real baseline meaning

Correct the baseline spec and evidence naming.

Required outcome:

- The baseline spec is either renamed/reframed as a regression spec for the redesigned modal, or it captures immutable pre-fix evidence from saved artifacts without pretending to be live before-state proof.
- The final report must distinguish `historical baseline`, `current live regression`, and `current live release proof`.

### 7. Resolve draft parity proof honestly

Do not claim full draft parity from skipped tests.

Required outcome:

- Prefer a deterministic non-mutating draft placement/swap fixture if the codebase already supports one.
- If no safe fixture exists, keep the skip but mark draft parity as `fixture-limited`, not `PASS`.
- The final report must list exactly which draft checks passed, skipped, or remain unproven.

### 8. Fix committed-scope evidence

Decide how QA artifacts should be handled.

Required outcome:

- If the Playwright specs are intended as durable regression coverage, move them to a tracked test location or intentionally force-add the exact ignored files.
- If screenshots and JSON metrics remain local-only artifacts, document that clearly and do not claim they are committed.
- Prove committed scope with:

```bash
cd D:\ATLAS
git --no-optional-locks show --name-only --format= HEAD
git --no-optional-locks ls-files qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts
```

## Required commands

Client:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-swap-old-scheduler-baseline.spec.ts ../qa-artifacts/playwright/specs/timetable-swap-visual-decision.spec.ts ../qa-artifacts/playwright/specs/timetable-draft-review-visual-parity.spec.ts ../qa-artifacts/playwright/specs/timetable-swap-blocked-recovery.spec.ts --workers=1 --reporter=line
```

Source guards:

```bash
cd D:\ATLAS
rg -n "<button|<select|title=|Review occupied-slot swap|Blocking - - Warnings -" atlas-client/src/components/timetable/modals atlas-client/src/lib/__tests__ qa-artifacts/playwright/specs
git --no-optional-locks status --short --untracked-files=all
git --no-optional-locks diff -- atlas-client/src/components/timetable/modals/ReviewActionSheet.tsx atlas-client/src/components/timetable/modals/TimetablePlacementDialogs.tsx
```

If backend files are changed, also run:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
```

## Required Tailnet browser proof

Use live Tailnet by default:

- `https://njgrm.buru-degree.ts.net/timetable`
- Admin test account documented in ATLAS project instructions

Verify generated swap at:

- `1366x768`
- `390x844`
- `844x390`

For each viewport, capture:

- screenshot path;
- modal title;
- primary region count;
- visible recommended label;
- visible unavailable reason;
- selected-strategy status before and after selecting a non-default option when available;
- footer rectangle and whether it intersects any primary decision region;
- actual body `scrollHeight` and `clientHeight`;
- whether swap commit requests were intercepted or absent.

For blocked recovery:

- prove a blocked state was rendered, or mark `NO-GO`;
- capture visible manual next action text;
- prove no destructive write request occurred during the proof.

For draft parity:

- prove a draft fixture was rendered, or mark `fixture-limited`;
- do not count skipped draft checks as full PASS.

## Acceptance criteria

- Generated swap uses no raw native option-row buttons.
- Generated swap still has no more than three primary visual regions.
- Generated swap selected-strategy status reflects the selected strategy.
- Generated swap footer never overlaps primary decision content in all three required viewports.
- Generated swap is readable and actionable at `844x390` without burying the core decision below a large hidden scroll region.
- Blocked recovery is exercised by a deterministic proof or explicitly remains `NO-GO`.
- Blocked recovery shows at least one honest useful next action.
- Draft parity is either proven with a fixture or honestly reported as `fixture-limited`.
- Playwright specs fail on the specific blockers found by QA.
- Committed scope is reported accurately, including whether QA specs/artifacts are tracked or local-only.
- Product GO remains pending real older-scheduler moderated validation unless the stakeholder explicitly accepts automated proof.

## Required final report

Return one compact final report:

- final `GO`, `CONDITIONAL GO`, or `NO-GO`;
- blocker-by-blocker resolution table;
- files changed;
- command results;
- Tailnet viewport measurements;
- screenshot/artifact paths;
- committed-scope proof;
- remaining caveats;
- suggested conventional commit message.

Use `GO` only if all technical blockers are resolved, blocked recovery is actually proven, and draft parity is either proven or explicitly accepted as fixture-limited. Otherwise use `CONDITIONAL GO` or `NO-GO`.

