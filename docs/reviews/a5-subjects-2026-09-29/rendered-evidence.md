# A5 C3 slice A — rendered evidence (planner-measured, loopback, `ISOLATED_LOCAL_BROWSER`)

**SUPERSEDES the first capture. The two previously committed `after-*.png` were error-boundary
pages and are WITHDRAWN — see §5. The images now in this directory are real `/subjects` renders.**

Harness: `atlas-client` built from candidate `2dc89610`, served with `vite preview` on
`http://127.0.0.1:5292` (5292 only — **not** 5274, which is A4's staging client).
**Dedicated profile:** a fresh `launchPersistentContext` user-data-dir, wiped at start, driven by
`playwright-core` outside the repo. The shared MCP Playwright profile was **not** used — the
round-1 reviewer's condition, and it also removes the §12 custody defect recorded below.
**Catch-all:** one `page.route('**/*')` handler that fulfils the fixture or `abort()`s, so
**nothing reaches the vite dev proxy and nothing reads live 5001**.

## 1. PASS — the filter row, 1366x768 (`after-1366x768.png`, 183 259 B)

`errorBoundary: false`. Filter cluster present. All values are `getBoundingClientRect()`;
`clipped` is `scrollWidth > clientWidth + 1`.

| # | `data-testid` | visible text | h | w | accessible name | clipped |
|---|---|---|---|---|---|---|
| 1 | `subjects-status-filter` | `Status: All` | **36** | **128** | `Filter by subject status: All statuses` | false |
| 2 | — | `Grade: All` | **36** | **128** | `Filter by grade level: All grades` | false |
| 3 | `subjects-program-filter` | `Program: All` | **36** | **128** | `Filter by program scope: All programs` | false |
| 4 | `subjects-room-type-filter` | `Room: All` | **36** | **128** | `Filter by room type: All room types` | false |
| 5 | — | `Term: All` | **36** | **128** | `Filter by rotation term: All terms` | false |
| — | search, `Search name or code...` | — | **36** | — | — | — |

Cluster bounding box **812 × 36 → one line, no wrap.** `documentElement.scrollHeight ===
clientHeight === 768` (and `1080`/`1080` at 1920) — **no global browser scrollbar** (§8).

Against the operator's own words (`docs/prompts/a5-subjects-table-2026-09-29.md` line 16;
`docs/handoffs/lane-c-to-a2.md` 2026-09-29 00:15):

- **"each filter shows its name (e.g. `Grade: All`, `Program: All`)"** — PASS, verbatim, all five.
- **"same height as the search box"** — PASS, 36 = 36, measured.
- **"even widths"** — PASS, five triggers at **128px**. Base was four distinct widths
  (`w-40 w-24 w-28 w-36 w-28` = 160/96/112/144/112).
- **"filters are pill-shaped … while the search box … [is] rounded rectangles"** — one shared
  `@/ui/picker-trigger` variant at the search box's exact height.

## 2. The `min-w` defect is now proven fixed, and the ledger's arithmetic vindicated

The round-1 reviewer's B5 finding stands: `searchable-select.tsx` composed `min-w-[160px]` ahead
of `w-32`, CSS `min-width` beat `width`, and every trigger rendered at **160px** regardless of the
variant — so the layout note's "1010px, 52px slack, one line" was **false** (real ~1170px vs
~1062px available) and the deleted `total < available` guard was covering a real failure.

`2dc89610` removed the floor from the shared primitive. **This capture measures 128px**, which is
`w-32` and the number the correction's ledger predicted. So:

- the corrected ledger (128px/trigger, 1010px, one line) is **right**, and
- the **planner's earlier 160px measurement was the correct observation of a defective build**,
  while the executor's 128px claim at the time was arithmetic that had not yet been made true.

Both errors are on the record because the same number was wrong in opposite directions.

## 3. UNPERFORMED — the subject table row. Deferred to Lane C, by ruling.

Program chips, `Owned by AP, MAPEH`, and the absent code chip still have **no rendered proof here**.
`/api/v1/subjects/scheduling-authority` is not dispatched in this capture: the page reaches its
bounded state and `rowsRendered: 1` is the **empty-state** row, not a subject row. The loader is
gated on `resolveActiveSchoolYearContext()`, which a live EnrollPro or a real staging database
satisfies and a hand-written fixture does not.

**Lane C ruled 02:35 that this is accepted as deferred**: the table row is judged on **staging
`:5274` after A4 deploys train 6**, and a `REJECT_UX` there **returns it to Lane A5**. Carried as a
release condition, not as a satisfied row.

## 4. What this capture does NOT prove

- No **before** image exists. The base `f02ed64a` was built and served for exactly that purpose but
  redirects to `/login` under the same fixture, so a reviewer compares against the operator's
  screenshot and the base's source-level widths, not a side-by-side.
- The jsdom rows remain **not** a substitute for a render (§11).

## 5. WITHDRAWN — the first capture, and why the crash was the fixture

The first two committed images (22 414 B / 26 235 B) rendered *"This page hit an unexpected error —
Cannot read properties of undefined (reading 'length')"*. The previous version of this file cited
one of them as a PASS. **That citation was false.**

**Verified conclusion (round-2 review, independently):** the cause was **the planner's fixture, not
the candidate.** `schoolYear` is required in the client term-authority contract type, so the
consuming components are not defective, and the candidate's new `ProgramScopeChips.tsx:49`
(`scopes.length`) never rendered in that capture because the page was in the empty state. The
`options ?? []` hardening in `filter-picker.tsx` is real, independent, and correctly described as a
**misuse guard, not the fix**.

**The exact attribution is UNATTRIBUTED, and an earlier draft of this file got it wrong.** That
draft claimed `contract.schoolYear.yearLabel` (at `SubjectTermAuthorityBanner.tsx:113`,
`SubjectTermContractPopover.tsx:77,81,89`) as the root cause, "established by a real render". That
claim **cannot** be right: reading `.yearLabel` off `undefined` throws `reading 'yearLabel'`, not
the `reading 'length'` text the withdrawn images actually show. The two sites that **can** produce
the recorded text, both reading `.length` off fixture-supplied objects, are
`SubjectTermAuthorityBanner.tsx:56` (`rawMessage.length`, which renders before line 113) and
`SubjectTermContractPopover.tsx:58` (`contract.terms.length`). **Neither is confirmed** — the
difference was not isolated. The correction is additive: the false claim is withdrawn here and the
two candidates are named; the verified conclusion above stands unchanged.

## 6. Harness findings (backlog, recorded not fixed)

- **`vite preview` applies the dev proxy.** An unmocked `/api/v1` path on a loopback preview is
  proxied to the **live server on 5001**. Round 1 observed a real read-only `401` that way. Any
  loopback evidence run needs a catch-all `abort()`. This one had one.
- **§12 custody defect.** The single shared MCP Playwright profile had another lane's tab open
  during round 1. This capture used a dedicated profile; the shared-profile issue is still open
  across lanes.
- A test that throws with a React tree mounted leaves the child at exit `-1` with a bare
  `test failed`; an open Radix `Popover` is modal and `aria-hidden`s its siblings.

## 7. Zero residue

Throwaway render harness deleted (§2). `node_modules` is gitignored. Preview stopped, port 5292
confirmed free. Live `5001`/`5174` and staging `5101`/`5274` observed listening throughout and
never addressed. No push, no deploy, no database, no runtime or task change.
