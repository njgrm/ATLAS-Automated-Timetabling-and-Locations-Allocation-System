# Gemini Execution Prompt: Phase 3 Teaching Load Readability Recovery One-Shot

## Objective

Recover readability on the current `Teaching Load` page without undoing the recent truth and clarity work.

The page is now more truthful, but it has crossed the density limit.
The current problem is not math or missing data.
The current problem is that the selected-teacher surface and assignment chips are too crowded and too small-text-heavy for comfortable scheduler use.

This pass must make the page calmer and easier to scan while preserving:

- current live truth
- current compact workspace
- current no-scroll architecture
- current rotation-aware explanation model

## Out of Scope

Do not:

- change backend staffing, coverage, or load math
- reopen rotation-model correctness work
- redesign the page from scratch
- bring back oversized top cards or tall dashboard slabs
- reintroduce global browser scrolling
- add more explanatory blocks than the current page already needs
- weaken the current assignment-time rotation cues

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-ux-and-live-data-audit-2026-05-25.md`
- `docs/analysis/phase3-teaching-load-post-clarity-readability-audit-2026-05-25.md`
- `docs/analysis/phase3-teaching-load-live-data-and-control-audit-2026-05-24.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- any extracted selected-teacher/load explanation subcomponents if they exist

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui`
- `Popover`
- `Tooltip`
- `HoverCard`
- `Accordion`
- `motion`

## Facts To Treat As Settled

- live Teaching Load totals are currently coherent
- the rotation-aware weekly-load math is currently working
- the remaining blocker is readability, not truth
- the page must stay compact enough for the no-scroll workspace
- the selected-teacher panel is still the core trust surface
- section chips must stay dense, but not cramped

## Current Failure

The latest clarity passes improved meaning, but they overloaded the UI.

Current symptoms:

- the selected-teacher strip is trying to carry too much information in one compressed horizontal band
- the page uses too much `text-[0.45rem]` to `text-[0.7rem]` sizing in core trust surfaces
- section chips still show too many simultaneous states in too little space
- uppercase + tight tracking + bold + tiny sizes make dense labels harder to read

The result is:

- more truthful
- less readable

That is not acceptable for a scheduler’s primary workspace.

## Required Product Outcome

A scheduler should be able to:

1. identify the selected teacher and their current load quickly
2. understand the load explanation without reading microtext
3. scan section chips without parsing a wall of tiny labels
4. distinguish the primary assignment state from secondary metadata
5. trust the page without feeling visually overloaded

## Required UX Changes

### A. Raise the minimum text-size floor on the main trust surface

Required:

- stop using sub-`text-xs` sizing for primary and secondary load explanation
- reserve the tiniest text only for tertiary helper labels if absolutely necessary
- promote the main selected-teacher arithmetic and state labels to a more readable `text-xs` / `text-sm` hierarchy

The operator should not need to squint at the load strip.

### B. Decompress the selected-teacher strip without making it tall

Required:

- keep the overall band compact
- but reduce the number of equal-weight elements shown at once
- split primary information from secondary information more clearly

Primary information should stay immediately visible:

- teacher identity
- current load result
- one clear overlap-state sentence
- save / undo / redo / primary action path

Secondary information should be visually calmer or progressively disclosed:

- tertiary labels
- repeated helper copy
- deep family detail

Do not solve this by adding another full-height card.

### C. Reduce visible metadata density inside section chips

Required:

- keep the current chip/grid structure
- simplify what is always visible inside each chip
- preserve important states, but do not show all of them at equal emphasis

The chip should clearly prioritize:

1. section identity
2. whether it is assignable / selected / already owned / conflicted
3. whether it adds weekly load or shares an existing lane

Secondary metadata like specialization, stale-owner context, and program detail can remain available, but must stop crowding the primary reading path.

### D. Use mixed hierarchy instead of all-caps microtext everywhere

Required:

- reduce overuse of uppercase + wide tracking on dense metadata
- keep uppercase only where it still genuinely improves scanning
- let the page use calmer mixed-case or standard `text-xs` metadata where that improves readability

This is especially important in:

- load strip labels
- helper copy
- section-chip secondary labels
- roster-side supporting metadata

### E. Keep one visible explanation, not many competing ones

Required:

- preserve the recent zero-overlap and non-zero-overlap clarity gains
- but stop repeating the same idea in too many tiny surfaces
- keep one short visible explanation near the arithmetic
- let deeper explanation remain behind progressive disclosure

The page should feel confident, not over-explained.

## Implementation Direction

- keep the current layout structure
- improve readability by pruning simultaneous signals, not by adding more content
- use stronger visual hierarchy instead of smaller text
- make the selected-teacher band feel authoritative and calm
- make section chips feel deliberate and scannable rather than busy

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive controls were introduced
- verify no mojibake remains
- verify the page still fits the no-scroll workspace on a normal laptop viewport
- verify the selected-teacher trust surface is easier to read at a glance
- verify sub-`text-xs` microtext is reduced on the core load surface
- verify section chips are easier to scan without losing critical assignment-state cues
- verify no regression to current rotation-overlap explanation quality

## Required Output

Return:

1. files changed
2. selected-teacher readability changes
3. section-chip density changes
4. text hierarchy changes
5. confirmation that compactness and no-scroll architecture were preserved
6. verification results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the page is materially easier to read
- the main load explanation no longer feels microtext-heavy
- section chips are calmer and more scannable
- the compact workspace remains intact
- recent truth and rotation-clarity gains are preserved
