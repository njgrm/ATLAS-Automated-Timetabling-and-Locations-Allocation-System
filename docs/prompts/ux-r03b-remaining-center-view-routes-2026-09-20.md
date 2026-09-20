# UX-R03b — route the remaining existing center views + close the R03a residual

Status: **PREPARED — NOT APPROVED; awaiting cycle dispatch.**

Risk: **MEDIUM** client source with **HIGH interaction guardrails** (unsaved-change
guard, selection-dependent panes, scope hygiene, publication/ordered-term invariants).

Base: the `origin/main` tip recorded in the dispatch prompt. Client source only: no
server, route-authority, runtime, deployment, generation, publication, database or
companion change.

Worktree disposition: `RETIRE_AFTER_INTEGRATION`.

## 1. Objective

Finish the route split for **every center view that already exists as a component**,
so the timetable's URL describes what the operator is looking at, and close the
`UX-R03a` residual. `UX-R03a` (accepted) made `/timetable` a persistent parent route
with `/timetable/policies`; this increment routes the rest.

## 2. Scope of this increment

Deliver exactly:

1. **Routes for the four remaining existing center views**, driven through the same
   route → `centerView` mechanism `UX-R03a` established, reusing the existing panes and
   the existing guarded setter:
   - `/timetable/pre-generation` → `centerView = 'pre-generation'`
   - `/timetable/map` → `centerView = 'map'`
   - `/timetable/manual-edit` → `centerView = 'manual-edit'`
   - `/timetable/building` → `centerView = 'building'`
2. **Selection-dependent panes must be honest.** `manual-edit` renders only with a
   `selectedEntry` and `building` only with a `selectedMapBuilding`
   (`CenterWorkspace.tsx:395`, `:467`). Entering those routes **without** a selection
   must show a truthful empty state that tells the operator how to reach the pane —
   never a blank center surface, and never a fabricated selection. Do not invent a
   default entry or building.
3. **The `/map` duplication is resolved by routing, not by deleting a feature.** The
   timetable's `map` center view becomes `/timetable/map`; the standalone campus editor
   page stays where it is. Do not merge, delete or re-implement either one, and do not
   add a second link path to the same surface.
4. **Close the `UX-R03a` residual (QA finding, `NON_BLOCKING`).** Cancelling the
   unsaved-change guard while on `pre-generation` can raise the guard dialog **twice**,
   because the URL restore re-triggers the route effect, which then wants `schedule`
   while the pane shows `pre-generation`. One cancel must settle the state: the URL
   must match the shown view and the guard must not re-open for the same cancelled
   navigation.
5. **Explicitly deferred to `UX-R03c`:** new `/timetable/runs`, `/timetable/setup` and
   `/timetable/exports` **sub-pages**. Those panes do not exist as components today —
   creating them is a design task, not a routing task — and the audit's
   `/map`-dedupe clause is satisfied by item 3.

## 3. Boundaries — do not break these

- `ScheduleReviewWorkspace.tsx` `buildScopeKey` / `clearScopeState`: untouched.
- The unsaved-change guard is the sole center-view setter. No direct `setCenterView`
  and no second source of truth for the shown view.
- **No-scroll architecture:** root `flex flex-col h-[calc(100svh-3.5rem)]`,
  `flex-1 min-h-0 overflow-auto` for scrolling regions; no global window scrollbar.
- **Publication and ordered-term invariants** unchanged; Generate / Publish / Preview
  impact / Sync with setup behaviour unchanged.
- **shadcn/Radix primitives only** — no native `<select>`, no raw unstyled `<button>`,
  no `<details>`/`title` attributes.
- **1000-line component cap**; extract in the same commit if a touched file would cross it.
- Desktop-first; mobile de-prioritized.
- Keep the `UX-R03a` route contract intact: `/timetable` index and `/timetable/policies`
  must keep working, and the unknown-child fallback must still land on the index.

## 4. Authorized paths

`atlas-client/src/App.tsx` (or the route table),
`atlas-client/src/components/timetable/**`,
`atlas-client/src/pages/ScheduleReview.tsx` (only if the route host lives there), and
focused client tests under `atlas-client/src/**/__tests__/**`. Nothing else.

## 5. Acceptance — 8 mandatory rows

1. **Routes.** Each of the four routes renders the same mounted shell with its own
   center view; `/timetable` and `/timetable/policies` still work. In-source proof is
   a rendered/source test; a live row would require a browser against undeployed bytes
   and is therefore a deployment-acceptance clause, not a source row.
2. **Selection-dependent honesty.** `/timetable/manual-edit` and `/timetable/building`
   entered with no selection show a truthful empty state naming how to reach the pane;
   no blank surface; no fabricated `selectedEntry`/`selectedMapBuilding`. Test both.
3. **Guard integrity.** Every route-driven view change goes through the existing
   guarded setter, including direct URL entry, in both directions; no direct
   `setCenterView`; the guard implementation is not modified.
4. **R03a residual closed.** One cancel from `pre-generation` settles the URL and the
   shown view and does **not** re-open the guard for the same cancelled navigation.
   Pin it with a test; state explicitly that the live dialog observation remains a
   deployment-acceptance clause.
5. **No workspace remount, no refetch** (the `UX-R03a` contract, now for four more
   routes): child navigation keeps the workspace mounted and issues no new data
   request. Empirical DOM/request-count proof is a deployment-acceptance clause.
6. **`/map` duplication.** The timetable map is reachable at `/timetable/map` and the
   standalone campus editor is unchanged; exactly one link path per surface; nothing
   deleted.
7. **Layout and primitives.** No global scrollbar introduced by any new route at
   `1366x768` (browser clause deferred to deployment acceptance); no native `<select>`;
   no raw button; 12px chrome floor holds; no touched file over 1000 lines.
8. **No functional regression.** The four views remain reachable as before, Generate /
   Publish / Preview impact / Sync call sites are untouched, and the existing client
   suites covering them pass unchanged.

## 6. Verification the executor must run and report

Client type-check and build (build-only `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`;
SMART/AIMS start URLs stay unset), the new tests, and the preservation suites for the
touched components, with exact commands and observed results. Label every row as
source-proven or deferred-to-deployment-acceptance; never present a deferred clause as
passed.

## 7. Rollback

Revert the commit. No persisted state, schema, environment or runtime artifact changes.

## 8. Return

One short handoff: base SHA · candidate SHA · exact changed paths with line counts ·
what changed and why · decisive commands and results · rows 1–8 with
`pass`/`blocked`/`unperformed` and the source-vs-deferred label · known risks each
marked `BLOCKING` or `NON_BLOCKING` · verdict `REVIEW_REQUIRED`. One page; no
transcripts, no pasted file contents.
