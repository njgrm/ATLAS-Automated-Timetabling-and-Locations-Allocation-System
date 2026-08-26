# Home-Room Auto-Assign and Building Grade Scope Sequence - 2026-08-26

## Purpose

This sequence adds a safer setup path for dummy and pilot data by letting ATLAS classify teaching buildings by grade scope and auto-assign section home rooms from that scoped room inventory.

The immediate runtime problem is that the active Tailnet run can be EnrollPro-aligned while still not publishable because setup feasibility is incomplete. On 2026-08-26, active `schoolYearId=2` was aligned with EnrollPro and active term `T1`, but latest run `427` still had `105` hard `UNASSIGNED_SECTION` violations. All `20` active sections had no `homeRoomId`, while `273` of `378` total violations were soft warnings.

Run these prompts in order as one continuous executor sequence. After each prompt, record the prompt result and gate evidence in the final handoff notes, then continue to the next prompt without stopping for Codex QA. Only stop early when a blocker makes later prompts technically impossible to execute, such as a failed migration that prevents the server from starting.

## Sequence

| Iteration | Prompt file | Scope | Internal gate before continuing |
|---:|---|---|---|
| 01 | `docs/prompts/home-room-grade-scope-01-baseline-contract-2026-08-26.md` | Investigate current data, route contracts, and migration shape before editing | Baseline proves latest violations, homeroom state, and grade-building mapping assumptions |
| 02 | `docs/prompts/home-room-grade-scope-02-building-grade-scope-contract-2026-08-26.md` | Add persisted building grade-scope contract and map editor controls | Building create/update/read support grade scope with tests and no UI regression |
| 03 | `docs/prompts/home-room-grade-scope-03-home-room-auto-assign-backend-2026-08-26.md` | Add preview/apply service and endpoint for homeroom auto-assignment | Backend preview/apply assigns only valid rooms and reports skips deterministically |
| 04 | `docs/prompts/home-room-grade-scope-04-sections-ui-auto-assign-2026-08-26.md` | Add Sections UI workflow for preview/apply and operator review | UI exposes a compact, reversible auto-assign action without breaking manual edits |
| 05 | `docs/prompts/home-room-grade-scope-05-generation-proof-and-final-qa-2026-08-26.md` | Rerun readiness/generation proof and cumulative QA | Final proof separates fixed setup gaps from remaining dummy Teaching Load pressure |

## Current live evidence to preserve

- Tailnet target: `https://njgrm.buru-degree.ts.net`
- Active school year: `2 / 2026-2027`
- Runtime source: `enrollpro-verified`
- Active-year drift: `aligned`
- Active term: `T1`, `termIndex=1`, `matchedSchoolYear=true`
- Latest run: `427`
- Latest run status: `COMPLETED`
- Assigned entries: `820`
- Unassigned entries: `105`
- Hard violations: `105`, all `UNASSIGNED_SECTION`
- Soft violations: `273`
- Soft warning buckets:
  - `ROOM_TYPE_MISMATCH=100`
  - `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED=90`
  - `FACULTY_EXCESSIVE_IDLE_GAP=80`
  - `ZONE_IMBALANCE_WARNING=3`
- Section readiness:
  - `20` active sections
  - `0` sections with home room
  - `20` sections missing home room
  - `98` eligible home-room options
- Teaching Load pressure:
  - `265 / 265` coverage pairs assigned
  - `17 / 21` active faculty over cap
  - Several dummy faculty at `142%` to `154%` of the 30-hour standard

Treat these as baseline evidence, not permanent constants. Every prompt must refresh current runtime values before claiming GO.

## Global executor rules

- Investigate blockers before implementing each prompt.
- Do not stop for Codex QA between prompts.
- Finish each prompt's implementation and verification before starting the next prompt.
- If a prompt has failed gates but later prompts can still be implemented safely, continue and carry the failed gate into the final cumulative QA report.
- If a prompt has a hard dependency failure that makes later prompts invalid, stop the sequence and report the blocker with exact evidence.
- Do not claim live readiness from source-only proof if the prompt requires live Tailnet proof.
- Do not weaken publish rules. Hard violations must still block publish.
- Do not classify hard `UNASSIGNED_SECTION` violations as warnings.
- Do not hard-code `schoolYearId`, grade labels, room IDs, building IDs, or section IDs.
- Do not share a database or call EnrollPro writes.
- Keep ATLAS as the persisted owner of building scope, room metadata, and section home-room overrides.
- Keep EnrollPro as the roster and active school-year/term authority.
- Preserve manual home-room editing and swap behavior on the Sections page.
- Use `@/ui/*` primitives for frontend controls. Do not add native `<select>` or raw styled buttons.
- Keep no-scroll architecture intact: root work areas must use `flex-1 min-h-0 overflow-auto`.
- Backend runtime imports under `atlas-server/src` must keep explicit `.js` endings.
- Update `docs/reference/atlas-runtime-source-of-truth-map.md` if ownership, fallback, runtime readiness, or page dependencies change.
- Do not stage generated `dist` files or unrelated local changes.

## Required per-prompt evidence log

Executor must keep a compact per-prompt evidence log for the final handoff:

1. `GO` or `NO-GO`.
2. Investigation summary and blockers found before implementation.
3. Files changed.
4. Exact commands run and results.
5. Tailnet endpoint outputs used as proof.
6. Tests added or updated.
7. Whether the executor continued, skipped dependent work, or stopped on a hard blocker.
8. Remaining caveats.

Do not send separate Codex QA handoffs after prompts 01-04. Submit one comprehensive final report after Prompt 05.

## Required minimum command gates

Use the targeted prompt-specific tests first, then run the relevant broader gates:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
```

If a prompt changes notification, workbook, published schedule, generation, or timetable behavior, run the existing focused suites listed in that prompt as well.

## Final expected outcome

At the end of this sequence, ATLAS should be able to:

- Mark a teaching building as available for any grade or only selected grades.
- Preserve that grade scope through map API create/update/read contracts.
- Preview home-room auto-assignment before applying.
- Auto-assign missing section home rooms from eligible teaching rooms.
- Respect building grade scope, room teaching-space status, existing room occupancy, room capacity, and section grade.
- Report skipped sections with explicit reasons.
- Keep manual home-room editing as the final override.
- Rerun readiness/generation proof and clearly separate:
  - remaining dummy Teaching Load pressure
  - livable soft warnings
  - hard publish blockers

## Suggested final commit

```text
feat(sections): add grade-scoped homeroom auto assignment
```
