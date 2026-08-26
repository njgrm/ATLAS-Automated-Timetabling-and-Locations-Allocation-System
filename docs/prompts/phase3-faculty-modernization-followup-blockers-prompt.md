# Gemini Execution Prompt: Phase 3 Faculty Modernization Follow-Up Blockers

## Objective

Close the concrete runtime, contract, and verification blockers left behind by the first `Faculty` modernization pass.

This is a narrow follow-up prompt.
Do not redesign the page again.
Fix the specific defects that currently prevent the pass from being accepted as a real `GO`.

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-faculty-and-teaching-load-ux-audit-2026-05-22.md`

Inspect directly:
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/components/faculty/FacultyRow.tsx`
- `atlas-client/src/components/faculty/FacultyProfileSheet.tsx`
- `atlas-client/src/types.ts`
- `atlas-server/src/routes/faculty.router.ts`
- `atlas-server/src/services/faculty.service.ts`

## Context7 Preflight Summary

Before importing or changing any UI primitive or library behavior:
- inspect local repo usage first
- use Context7 only if a UI import or version-sensitive behavior is unclear
- do not guess import paths or component APIs from memory

Record in your final output:
1. whether Context7 was needed
2. what it was used to confirm
3. which local contract/pattern you aligned to

## The Specific Blockers To Fix

These are already verified and should be treated as factual.

### 1. Profile sheet runtime crash

`atlas-client/src/components/faculty/FacultyProfileSheet.tsx` uses `ClipboardList` in the action area but does not import it.

Required fix:
- remove the runtime crash path
- ensure the profile sheet renders safely

### 2. Wrong sync timestamp response contract

`Faculty.tsx` currently expects `/faculty` to return `lastSyncedAt`.
The server route currently returns `fetchedAt`.

Required fix:
- align the client and server contract cleanly
- use one stable field name deliberately
- do not leave dead client expectations behind

### 3. Wrong sync success payload assumption

`Faculty.tsx` currently assumes `/faculty/sync` returns `count`.
The route returns fields like `activeCount`, `staleCount`, and `deactivatedCount`.

Required fix:
- stop using the wrong response shape
- make the sync success toast truthful and useful
- if the API contract should change, change it deliberately and keep client/server aligned

### 4. `FacultyMirror` type drift

The new client components read `faculty.employeeId`, but the client-side `FacultyMirror` type does not currently define `employeeId`.

Required fix:
- make the type contract honest
- do not leave local components compiling only through weak build coverage
- align the client type with the real API payload actually used by the page

### 5. Overstated verification

The first pass reported a clean typecheck without actually proving the specific new code was type-safe.

Required fix:
- verify the modified files honestly
- if repo-wide typecheck has unrelated failures, still prove the touched files are correct and explicitly separate local blockers from unrelated repo debt

### 6. Copy clarity issue in the profile sheet

The sheet currently says `Weekly Minutes` while visually presenting hours.

Required fix:
- make the label truthful
- keep the wording scheduler-friendly

## Scope

### In Scope

- fix the missing icon import/runtime crash
- fix the `Faculty` page sync timestamp contract mismatch
- fix the `Faculty` sync toast response mismatch
- fix the `FacultyMirror` type drift for the newly used fields
- tighten the sheet copy so metrics are correctly named
- perform honest verification of the touched pass

### Out Of Scope

Do not:
- redesign the Faculty page again
- expand the profile sheet scope
- rework Teaching Load
- change shell/sidebar IA in this prompt
- do unrelated repo-wide cleanup

## Implementation Discipline

- Prefer the smallest coherent fix set that closes the blockers.
- Do not claim repo-wide type health if only the touched page was verified.
- If the server contract changes, keep the client and route aligned in the same pass.
- If you touch types, ensure the consuming page/components match the final shape.

## Verification Gates

Required:
- client build
- direct verification that the profile sheet no longer references an undefined icon
- direct verification that the `/faculty` response field consumed by `Faculty.tsx` matches the route response
- direct verification that the `/faculty/sync` success toast uses a real returned field
- direct verification that the touched client types include the newly used `employeeId` field

If repo-wide typecheck is noisy:
- run it anyway if practical
- explicitly separate unrelated pre-existing failures from the touched-faculty fixes

## Required Output

Return:
1. the exact blockers fixed
2. files changed
3. final client/server sync contract used
4. final `FacultyMirror` type change made
5. verification results
6. whether any unrelated repo-wide TS failures still remain
7. `GO` or `NO-GO` for this narrow follow-up scope

## GO Condition

Return `GO` only if:
- the profile sheet no longer has the icon runtime crash
- the Faculty page uses the real sync timestamp contract
- the sync success toast uses a real response field
- the client-side `FacultyMirror` type honestly includes the fields the new Faculty components use
- the metric copy is corrected
- verification is truthful and specific

If not, return `NO-GO` with the exact remaining blocker.
