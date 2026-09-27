# A3 c1 — pre-fix source record (item 0, source-level part)

**Written 2026-09-27 23:20 +08 by Planner A3, before any c1 fix was dispatched.**
Base `3cbcba9297d1dba606081e9a36aedd51f7bfbb38` (`origin/main`). This record exists because
`docs/prompts/overnight-a3-ui-ux-2026-09-28-c1.md` item 0 says **"audit first, live, then fix …
Commit the table before fixing."** The browser lock was held by Lane A2 from 22:46 and could not be
taken before 23:31, so this file commits the part of the audit that is **source-determinable** and
orders the first stream from it. The **live graded route table** (item 0) and the **walkthrough
grades** (item 2) follow in this directory once the lock frees.

**This is not the item 0 route table.** It measures one thing, exactly, and it is a fact about the
source rather than a guess about the screen.

## S-a finding — three different page-title patterns across 13 non-timetable pages

`PageHeader` (`atlas-client/src/components/app-shell/PageHeader.tsx`) is the repo's **canonical**
title component: it renders the single `<h1>`, the `eyebrow`, the `subtitle`, and the one
`data-page-primary-action` slot. The contract is already committed and already enforced by a test
that ships on `main`:

- `atlas-client/src/lib/__tests__/ux-r01-shared-chrome.test.tsx:54` —
  *"canonical PageHeader owns one h1 and one primary-action slot"*, asserting exactly one `<h1` and
  exactly one `data-page-primary-action` in rendered markup.
- same file, line 67 — *"production shell consumes the shared breadcrumb and route resolver"*, and
  it asserts `SmartPageShell` uses `<PageHeader` and emits **no** raw `<h1`.

So the intended architecture is: **shell supplies the breadcrumb trail, the page supplies the
canonical `PageHeader` h1.** Measured adoption across the 13 non-timetable pages:

| Page | Lines | `PageHeader` refs | Own raw `<h1>` | Title pattern in use |
|---|---|---|---|---|
| `pages/Dashboard.tsx` | 942 | 0 | 1 | **ad-hoc** |
| `pages/Sections.tsx` | 982 | 0 | 0 | **none** |
| `pages/Subjects.tsx` | 698 | 0 | 0 | **none** |
| `pages/Faculty.tsx` | 947 | 0 | 0 | **none** |
| `pages/TeachingLoad.tsx` | 925 | 0 | 0 | **none** |
| `pages/MapView.tsx` | 176 | 0 | 0 | **none** |
| `pages/MapEditor.tsx` | 329 | 0 | 1 | **ad-hoc** |
| `pages/Audit.tsx` | 857 | 0 | 1 | **ad-hoc** |
| `pages/AdminYearSetup.tsx` | 154 | 0 | 0 | **none** |
| `pages/TeacherConcerns.tsx` | 381 | 2 | 0 | **canonical** |
| `pages/OfficerPreferences.tsx` | 773 | 0 | 0 | **none** |
| `pages/OfficerRoomPreferences.tsx` | 619 | 0 | 0 | **none** |
| `pages/HowItWorks.tsx` | 289 | 0 | 0 | **none** |

**1 canonical · 3 ad-hoc · 9 with no page title at all.**

## Why "no page title" is what the desktop actually shows — proven from the shell, not assumed

`atlas-client/src/components/AppShell.tsx`:

- line 449 — `const currentPageTitle = routeChrome.title;`
- line 492 — `{currentPageTitle}` is rendered **inside the `isMobile` branch only**
  (`<div className='flex-1 truncate text-center text-sm font-semibold'>`).
- line 506 — the **desktop** branch renders `<AppBreadcrumbs breadcrumbs={routeChrome.breadcrumbs} />`
  and no title.

`currentPageTitle` has exactly **one** render site in the whole file, and it is the mobile one.
So on a **1366x768 desktop** viewport, the nine pages with no `PageHeader` and no `<h1>` display
**no page title anywhere** — only a breadcrumb trail reading e.g. `School Setup / Subjects`. An
older mouse-first scheduler moving between screens in a demo has no on-screen word telling them
where they are. That is a demo failure under the packet's own rubric ("fewest words that still
tell the truth", "one calm product") and it is a **source fact**, decided before the browser was
available.

## Stream S-a, as scoped from this record

**Goal:** one title pattern, one primary-action slot, on every A3-owned non-timetable page, by
adopting the `PageHeader` component that already exists and is already the committed contract.

Explicitly **not** in S-a:

- **No change to `AppShell.tsx`.** Rendering the title into the shared desktop top bar would be a
  smaller diff, but it is a shared component and it would restyle Lane A2's timetable surfaces,
  which the handoff ownership boundary forbids without A2's written acceptance. Adopting
  `PageHeader` per page touches **A3-owned files only** and has **zero** timetable blast radius.
- No copy or verb rewrites (that is stream S-b, and it needs the live audit).
- No status cues or empty states (S-c), no density work (S-d).

## Two constraints the fix must respect, both load-bearing and both previously earned

1. **`AGENTS.md` §8, 1000-physical-line cap.** `Sections.tsx` is at **982**. The per-page addition
   must stay small, and any page that would cross 1000 after the change extracts a sub-component
   first. Blank lines and comments count.
2. **Accepted browser rows 14 / 16 (no page-level scrollbar, >1 roster row visible at 1366x768)
   must not regress.** `PageHeader` is a real header and consumes vertical space. The change is
   therefore bounded: adopt the component, but add **no** `eyebrow` and **no** `subtitle` where the
   page did not already render that text, and put the page's existing single most important action
   in the one primary slot rather than adding a second action. Rows 14/16 are re-run in the browser
   after the change and are reported as their own rows, not assumed.

## Status

Item 6 (debt) was checked first and is **already closed**: `npm run test:derived-setup-ux` is
**23/23, exit 0** at this base, including all four `uxc01-derived-setup-surface.test.ts` controls.
The packet's "1-of-4 red on a `navigation.ts` substring assertion (as of 2026-09-20)" is **stale** —
the `resolveRouteChrome` extraction in `components/app-shell/navigation.ts` retired that assertion.
No test correction is needed and none was made.
