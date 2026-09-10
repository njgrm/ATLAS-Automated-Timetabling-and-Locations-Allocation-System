# RR-UX01 — Rollover Awareness and Historical Teaching Load

Status: `READY_FOR_EXECUTION`
Risk: `MEDIUM` source/UI; no live mutation

## Objective

Make an EnrollPro school-year rollover visible and understandable without a
manual refresh, consolidate Year Setup into one normal workflow, and make
archived Teaching Load genuinely viewable as read-only history.

## Git boundary

Create a fresh worktree from refreshed `origin/main`:

```powershell
git -C D:\ATLAS fetch origin
git -C D:\ATLAS worktree add D:\ATLAS-worktrees\rollover-rrux01 -b work/rollover-rrux01 origin/main
```

Record the base SHA and require a clean worktree. Commit one candidate; do not
merge, rebase, amend, or push.

## Required implementation

1. Add a privileged actor-school-scoped school-level notification channel for
   rollover/integration events. Keep existing year-scoped streams for ordinary
   generation and timetable events. An old-year subscriber must receive the
   successful new-year rollover; cross-school and non-privileged access fail.
2. On a rollover/archive completion event, invalidate cached runtime/year
   context, refetch the verified active year, update the visible year/term,
   close the old subscription, bind the new subscription, and remount/refetch
   the current route once. Coalesce duplicates to prevent loops.
3. On window focus, visibility restoration, and online restoration, verify the
   active context so a closed/offline browser detects a missed rollover.
4. Show a persistent, plain-language `aria-live=polite` notice that names the
   new school year and explains that the previous year is read-only.
5. Remove school-id fallback behavior from the changed path; use authenticated
   actor scope and include school identity in cache/subscription keys.
6. Render one normal Year Setup status/archive/sync card. Keep the destructive
   disposable reset only in an advanced admin disclosure, render it only when
   `canResetDummyYear` is true, reuse the already-loaded status, and make no
   duplicate status request.
7. Add a new ATLAS-owned history-years read service/router returning same-school
   mirrors with annual Teaching Load cycles. It must not call EnrollPro.
8. Let `/teaching-load?schoolYearId=<id>&view=history` display an archived year
   through a Teaching-Load-local year picker. Show a prominent read-only banner
   and remove every reconcile, suggest, reset, edit, save, and staffing action.
9. Archived-year links in Year Setup must open that history view. Do not create
   a global historical mode for Subjects, Dashboard, or Timetable.

## Parallel boundary

Allowed likely paths:

- notification router/service and focused tests;
- `AppShell.tsx`, `useNotificationStream.ts`;
- `AdminYearSetup.tsx`, rollover guidance/reset components;
- a new Teaching Load history authority service/router and `app.ts` mount;
- `TeachingLoad.tsx`, `useTeachingLoadData.ts`, and a new local year picker;
- one progress document, runtime source map, and changelog.

Do not edit:

- `faculty-assignment.router.ts` or `faculty-assignment.service.ts` in this wave;
- Subject/term adapters, Subject schema/form, generation services, demand
  services, or companion repositories.

If an existing write endpoint permits archived-year mutation and the fix would
require a forbidden file, stop with `PLANNER_DECISION_REQUIRED` and exact
evidence. Do not cross into GEN-ZW01 ownership.

## Acceptance gates

- Old-year privileged subscriber receives new-year rollover; other-school and
  faculty subscribers do not; year-scoped delivery remains exact.
- One event causes one context refresh/remount; duplicates do not loop.
- Focus/online recovery detects a missed rollover and rebinds old year to new.
- Year Setup makes one status request and presents one primary status surface.
- Real-data setup hides disposable reset.
- History list works for direct local-login officers without bridge auth.
- History navigation performs GETs only and makes no EnrollPro call.
- Historical Teaching Load is labelled read-only and exposes no mutation action.
- Existing archived-write guards are mounted-route tested for zero writes; if
  absent, report the bounded blocker as described above.
- Keyboard, screen-reader status, 1280x720, 390x844, 200% and 400% reflow have
  no overflow, duplicate primary action, or obscured notice.
- Browser network evidence shows zero POST/PUT/PATCH/DELETE during history use.
- Focused tests, both TypeScript checks/builds, `git diff --check`, and isolated
  built-server startup pass; no live process restart.

## Return

Return `REVIEW_REQUIRED` with base/candidate SHAs, exact changed paths, decisive
tests, browser evidence, remaining risks, and collision proof. No live rollover,
Teaching Load apply, generation, publication, merge, or push.
