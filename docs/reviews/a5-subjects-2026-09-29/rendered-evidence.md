# A5 C3 slice A — rendered evidence (planner-measured, loopback, `ISOLATED_LOCAL_BROWSER`)

> **WITHDRAWN IN CORRECTION ROUND 1 — READ THIS FIRST.** Every `PASS` below is VOID and is **not**
> ATLAS acceptance. The two committed screenshots, `after-1366x768.png` and `after-1920x1080.png`,
> both show an error boundary — *"This page hit an unexpected error — Cannot read properties of
> undefined (reading 'length')"* with a `Reload page` button. They do not show `/subjects` at all,
> so the §11 rule-4 `REJECT_UX` gate has no image to judge, and the filter-row table below is
> evidence about a measurement pass whose image was never captured. The withdrawal is recorded
> here rather than the file being deleted, per `AGENTS.md` §16.
>
> The measurement itself also **disproved the candidate's own width arithmetic**: it recorded all
> five triggers at **160px**, not the 128px the ledger and two test comments claimed. That was
> `SearchableSelect`'s `min-w-[160px]` silently overriding the `w-32` variant — QA finding B5,
> since fixed, with the re-derived figure (1010px, one line, 52px slack) in `layout-note.md` §3.1.
> The measurement was right and the ledger was wrong; that is now the record.
>
> **Re-taking these rows is the planner's.** The exact command and fixture are in the correction
> handoff. The subject-table half stays `UNPERFORMED` under a mocked surface and needs a real-data
> render on staging, which is A4/Lane C's surface.

Harness: built `atlas-client` from candidate `911f5b3d`, served with `vite preview` on
`http://127.0.0.1:5292`. All `/api/v1` and `/enrollpro-api/**` traffic intercepted in the browser
and fulfilled from a fixture.

**There is NO captured before-render, so this is an after-only capture and the reviewer is judging
one side.** The base `f02ed64a` was built and served on `:5294` for exactly that purpose, but under
the identical fixture the base build redirects to `/login` (its actor-school resolution differs
from the candidate's), so no before screenshot exists. The "before" facts used in the table below
are therefore **source-level** (base `w-40 w-24 w-28 w-36 w-28` = four distinct widths; base label
`All Status`; the deleted `COMPACT_SELECT` chrome string) plus the operator's own screenshot. The
executor measured and reported those from source. A reviewer wanting a true side-by-side should use
the operator's screenshot as the before.
**These are loopback rows. Per `AGENTS.md` §12 they are `ISOLATED_LOCAL_BROWSER` and are NOT ATLAS
acceptance** — they prove this candidate's own rendered paint and nothing about
`https://njgrm.buru-degree.ts.net`. The Tailnet rows stay owed to Lane C.

## PASS — the filter row, measured at 1366x768 (`after-1366x768.png`)

All five triggers present, one line, no wrap. Values are `element.getBoundingClientRect()`;
`clipped` is `scrollWidth > clientWidth + 1` on the trigger button.

| # | `data-testid` | visible text | h | w | accessible name | clipped |
|---|---|---|---|---|---|---|
| 1 | `subjects-status-filter` | `Status: All` | **36** | **160** | `Filter by subject status: All statuses` | false |
| 2 | — | `Grade: All` | **36** | **160** | `Filter by grade level: All grades` | false |
| 3 | `subjects-program-filter` | `Program: All` | **36** | **160** | `Filter by program scope: All programs` | false |
| 4 | `subjects-room-type-filter` | `Room: All` | **36** | **160** | `Filter by room type: All room types` | false |
| 5 | — | `Term: All` | **36** | **160** | `Filter by rotation term: All terms` | false |
| — | search box, `Search name or code...` | — | **36** | — | — | — |

Against the operator's own words (`docs/prompts/a5-subjects-table-2026-09-29.md` line 16, and
`docs/handoffs/lane-c-to-a2.md` 2026-09-29 00:15):

- **"each filter names itself (e.g. `Grade: All`, `Program: All`)"** — PASS, verbatim, all five.
  The truncated bare `All…` reading is gone.
- **"same height as the search box"** — PASS, 36 = 36, measured, not asserted.
- **"even widths"** — PASS, five triggers at 160px, one width. (Base was 4 distinct widths:
  `w-40 w-24 w-28 w-36 w-28` = 160/96/112/144/112.)
- **"filters are pill-shaped (rounded-full) while the search box and the Section/Teacher pickers
  elsewhere are rounded rectangles"** — the five now render through one shared
  `@/ui/picker-trigger` variant at the same height as the search box; the source-level half
  (the deleted `COMPACT_SELECT` string) is a test row, not this one.

`document.documentElement.scrollHeight === clientHeight === 768` — **no global browser scrollbar**
on `/subjects` at 1366x768 (`AGENTS.md` §8 No-Scroll). Also captured at 1920x1080
(`after-1920x1080.png`).

## UNPERFORMED — the subject table row. Not a pass, and not claimed as one.

**The operator's other three table complaints — abbreviated program chips, `Owned by AP, MAPEH`
instead of `OWNER_DEPT:AP, OWNER_DEPT:MAPEH`, and the code chip gone — have NO rendered proof in
this cycle.** They are covered by source-level and jsdom tests only, which `AGENTS.md` §11 says is
not acceptance evidence for a user-facing change.

**Why, precisely:** under a fully mocked `/api/v1`, `/subjects` renders its filter row and then
stops at the bounded empty state. `pages/Subjects.tsx:149-184` only issues a catalog request once
`resolveActiveSchoolYearContext()` returns an `activeSchoolYearId`; with the EnrollPro public
settings mocked the resolver does not yield one, so `GET /api/v1/subjects/scheduling-authority` is
**never dispatched** (observed request set: `auth/me`, `runtime/context` only) and
`setSubjects` is never called. Every fixture shape tried and the exact gate each one failed is in
the planner's session; the honest summary is that satisfying this loader needs the real
active-school-year / term-authority contract (A5 c2a's resolver plus A2's active-term work), not
a hand-written fixture.

Recorded as `UNPERFORMED`, per `AGENTS.md` §16 — a mandatory row is never silently dropped, and a
vacuous pass is not a pass. The `OWNER_DEPT` absence asserted by a source test is **not**
corroborated here.

## Consequences for the cycle

1. **§11's `REJECT_UX` judgement cannot be completed for the table row.** A reviewer who did not
   build this compares before/after at 1366x768 — the filter row is judgeable, the table row is
   not, because the row does not paint under a mocked surface.
2. **The Tailnet rows are still owed** and now include four table-row items that have never been
   seen rendered by anyone. Lane C's older-user walk is the second judge and **blocks the release
   of this screen** (`AGENTS.md` §11 rule 4).
3. **The single cheapest fix for both** is a real-data render: point one browser at staging
   (which A4 already runs from a copy of live, at `:8443` / `127.0.0.1:5274`), where the catalog
   is non-empty and `/subjects` paints its rows. That is A4's/Lane C's surface, not a lane-A5
   deployment, and it needs no new authority.

## Non-blocking findings recorded by the planner (not fixed here)

- `vite preview` applies the **dev** proxy config, so an unmocked `/api/v1` path on a loopback
  preview is proxied to **127.0.0.1:5001 — the live server**. A loopback evidence run therefore
  needs a catch-all `abort()`/fulfil, or it silently reads production. Observed live here as a
  real `401 INVALID_TOKEN` on `auth/me`; no write was issued and no live data was mutated.
- The Playwright profile in use is **shared**: a second tab belonging to another lane
  (`A2 measurement harness`) was open in the same profile. `AGENTS.md` §12 — one agent per
  browser profile at a time. Flagged to the lanes, not resolved here.
