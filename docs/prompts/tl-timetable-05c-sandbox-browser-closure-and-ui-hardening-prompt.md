# Prompt 5c: Sandbox Browser Closure And UI Hardening

## Mission

Close the final remaining Prompt 5 gap on `/timetable` by:

1. capturing a true browser end-to-end valid sandbox save from the Tactical Teaching Load Dock
2. improving the dock UI so it no longer feels dense, noisy, and improvised while the operator is reviewing repair decisions

This is the last closure pass before Prompt 6. Do not reopen sandbox architecture or published revision data-model work here.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/reports/crud-teaching-load-timetable-audit-2026-05-31.md`
- `docs/prompts/teaching-load-timetable-repair-sequence-2026-05-31.md`
- `docs/prompts/tl-timetable-04-tactical-bottom-dock-live-sandbox-prompt.md`
- `docs/prompts/tl-timetable-05-sandbox-draft-commit-path-prompt.md`
- `docs/prompts/tl-timetable-05b-sandbox-draft-commit-closure-prompt.md`
- latest Prompt 5 evidence entry in `docs/verification/evidence-log.md`

Apply:

- `atlas-express-api`
- `atlas-mvc-enforcement`
- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`

Inspect before editing:

- `atlas-client/src/components/timetable/TacticalSandboxDock.tsx`
- `atlas-client/src/components/timetable/CenterWorkspace.tsx`
- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- `atlas-client/src/hooks/useTimetableMutations.ts`
- any browser-qa/playwright artifacts or current manual QA helpers already used in this stream

## Verified Remaining Problem To Treat As Real

Prompt 5 is now API-proven, but still not fully browser-closed.

Current verified state:

- authenticated Tailnet API proof exists for:
  - invalid hard-block batch commit
  - soft-warning save requiring acknowledgement
  - acknowledged valid commit
  - latest draft persistence
  - no-regeneration behavior
- the dock browser path proved hard-block review behavior
- but a real browser-valid save click-through from a browser-selectable block/candidate pair was not captured

Result:

- Prompt 5 remains conditional instead of full `GO`

There is also a product-quality issue:

- the dock UI is functional, but still reads as cluttered and overly technical during review/save
- the current surface needs calmer hierarchy and clearer operator scanning before it becomes the durable repair workflow carried into Prompt 6

## Scope

In scope:

- browser end-to-end closure for a valid Tactical Dock save
- browser proof for invalid hard-block behavior
- Tactical Dock UI cleanup and readability hardening
- calmer review/save hierarchy
- evidence-log update

Out of scope:

- new sandbox architecture
- published revision data model or effective-date logic
- broad timetable redesign outside the dock and directly related review affordances
- generation algorithm changes
- Prompt 6 implementation

## Product Decisions

- Prompt 5 is not fully closed until a real browser-valid save is captured from the dock itself.
- UI cleanup here should improve review clarity, not add more complexity.
- The dock should feel like a focused repair tool, not a debug panel or mini-admin report.
- Hard-block behavior and soft-warning acknowledgement rules from Prompt 5/5b remain authoritative.

## Mandatory Outcomes

### 1. Capture true browser-valid save proof

Required outcome:

- using the live/browser `/timetable` surface, complete one valid Tactical Dock save end-to-end

That means proving all of the following from the browser path:

- select a generated block
- open the dock
- choose a valid teacher change
- review the batch
- satisfy any required soft-warning acknowledgement if applicable
- click save from the dock
- observe success state
- confirm latest draft reflects the change

If the currently visible matrix blocks do not expose an API-valid candidate pair, the implementer must make the browser workflow discoverable enough to reach one legitimate valid candidate rather than stopping at API-only proof.

### 2. Preserve invalid hard-block browser proof

Required outcome:

- keep at least one browser-verified invalid path where the dock shows the reviewed block state and prevents save

Do not regress the hard-block honesty while optimizing for a successful click-through.

### 3. Improve dock review/save hierarchy

Required outcome:

- the dock must become easier to scan and less visually messy

Improve at least:

- stronger selected-block identity
- clearer separation between:
  - selected block context
  - teacher candidate selection
  - same-subject bulk scope
  - review/save status
- calmer treatment of conflict/warning summaries
- clearer primary action hierarchy between:
  - `Review Changes`
  - `Save Changes`
  - `Reset Sandbox`
  - `Close Dock`

Do not solve density by shrinking text.

### 4. Reduce technical noise in operator copy

Required outcome:

- keep necessary truth, but reduce the feeling of raw internal/system language

Examples:

- prefer scheduler-facing action language
- avoid debug-panel tone
- keep warnings readable and directive
- keep published/read-only messaging calm and specific

### 5. Keep the sandbox bounded

Required outcome:

- do not turn the dock into a full embedded Teaching Load workspace
- do not add broad new panels or unrelated diagnostics
- preserve the current subject-scoped bulk model

### 6. Promote Prompt 5 only if browser closure is actually achieved

Required outcome:

- if a real browser-valid save is captured, update the evidence so Prompt 5 is no longer conditional
- if the browser-valid save still cannot be captured, return `NO-GO` with the exact blocker and the exact missing condition

Do not overclaim closure from API proof alone.

## UI Rules

- Use current `@/ui/*` primitives only
- no raw native `<button>`, `<select>`, `<details>`, or raw `title=`
- preserve no-scroll architecture and avoid nested scroll traps inside the dock
- normal operator-facing text floor:
  - primary content `text-sm`
  - secondary content `text-xs`
- keep the bottom-dock feel; do not convert this to a modal takeover

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-client run build`
- `npm --prefix atlas-server run build` if backend is touched
- primitive scan for lowercase native `<button`, lowercase native `<select`, `<details`, and `title=`
- line-count check for touched React files

Browser/Tailnet closure proof:

- open `/timetable`
- perform one valid dock save end-to-end from the browser path
- confirm success state in the dock/UI
- confirm latest draft reflects the saved change
- perform one invalid hard-block browser path and confirm save stays blocked
- confirm no regeneration/new run occurred

UI smoke:

- verify the dock reads clearly at desktop width
- verify the dock remains usable at a narrower viewport
- verify warning/review/save hierarchy is calmer than before

Self-correction requirement:

- if browser-valid save proof, hard-block proof, build, or dock UI clarity fails, fix in the same session and rerun the failed check once

## Required Output

Return:

- files changed
- what was changed in the dock UI hierarchy
- browser-valid save proof
- browser-invalid hard-block proof
- latest-draft/no-regeneration proof
- whether Prompt 5 is now promoted to full `GO`
