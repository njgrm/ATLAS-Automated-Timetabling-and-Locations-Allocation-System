# A2 c13 — rendered evidence (planner-run, ISOLATED loopback)

**Taken by:** A2 primary planner (not the executor — the executor ran out of steps on this row).
**Surface:** built client from `E:\ATLAS-worktrees\lane-a2-c13\atlas-client`, served by
`scripts/dev/start-preview.ps1 -ClientDir <dir> -Port 5401`, viewport **1366×768**.
**Origin asserted:** `http://127.0.0.1:5401` — **ISOLATED, never ATLAS acceptance** (AGENTS.md §12).
**Session:** `atlas_local_token` seeded in the profile + `/api/v1` intercepted. **No real sign-in**
(sign-in is origin-bound; a loopback port must never be asked of the operator — 2026-09-29 02:10).
**Preview stopped:** `taskkill /T /F` on the recorded pid; port 5401 confirmed free.

## How the workspace was reached (the load-bearing detail)

The guard is `hasAnyAuthToken()` in `components/AppShell.tsx:337`, a **local** check, and
`verifySessionToken()` (`lib/auth.ts`) reads `/auth/me` as an **envelope** — `data.user`, not the user
at top level. Both were required to pass the guard:

- seeding `atlas_local_token` alone → the failed `/auth/me` (a CORS error) called
  `clearAtlasAuthStorage()` and the app redirected to `/login`;
- returning the user at top level → `data.user` was `undefined`, the `.authSource` read threw, and the
  same redirect followed.

With `{ user: {…} }` the guard passes, `sessionVerificationState` reaches `authenticated`, and
`/timetable` mounts.

## Item 1 — the loading band and the 8 s time limit: PROVEN RENDERED

Probed in a real browser against `[data-testid="timetable-first-paint"]`, three reads on one navigation:

| elapsed | technical copy present | `Your schedule is still loading.` | `Retry` | `Show the last published schedule` |
|---|---|---|---|---|
| **1.9 s** | **false** | true | **0** | 0 |
| **4.3 s** | **false** | true | **0** | 0 |
| **11.1 s** | **false** | true | **1** | 0 |

- The old sentence — `Loading timetable: navigation is ready now; the grid fills as soon as the latest run
  resolves.` — is **absent** at every reading. It was deleted, not reworded.
- **No control before the limit; exactly one `Retry` after it.** The gate discriminates in a browser, not
  only in JSDOM.
- **`Show the last published schedule` renders 0 times** — correct for this fixture, which has no published
  run. This is the operator's "if one exists" branch, captured in its negative form. **The positive branch
  (a published run present) is NOT captured in a browser**; it is proven by rendered JSDOM control `L3`,
  which was failing-first at base (`0 !== 1`).

Captures: `a2c13-01-loading-before-8s.png` (1.9 s), `a2c13-01b-loading-at-3s.png` (4.3 s),
`a2c13-02-loading-after-8s.png` (11.1 s).

## Item 2 — one name for the place: PROVEN RENDERED

| Probe | Value |
|---|---|
| `<h1>` (`data-testid="timetable-page-heading"`) | **"Class Schedule"** |
| sidebar group divider | **"CLASS SCHEDULE"** |
| nav group item | **"Class Schedule"** |
| `/latest run resolves|navigation is ready now|Loading timetable:/` anywhere in `body.innerText` | **false** |
| global scrollbar at 1366×768 | **false** (no §8 no-scroll violation) |

Capture: `a2c13-03-name-and-loading.png`. The nav, the group and the page heading all read the same name;
the internal name is gone from the surface an operator reads.

## Item 3 — the disabled Generate: **NOT SEEN RENDERED.** Labelled deployment-acceptance row.

The disabled-control *look* could not be captured honestly on loopback, and I am not going to claim it was.

**What blocked it, measured:** with a synthetic `/api/v1`, the workspace never resolves school-year scope
and **no readiness or runs request is ever dispatched** (request log empty for
`/readiness/diagnostic` and `/generation/*/runs`), so the header — and with it the Generate and Publish
controls — never renders. Reaching a *blocked generation* state in a browser would mean reproducing the
full run-data contract endpoint by endpoint, and a synthetic payload is not the real surface in any case:
AGENTS.md §11 requires *"A control's fixture must come from the real surface, and the row most likely to
be dropped is the load-bearing one."*

**What is proven instead, and by what:** the control's **markup** is proven by rendered JSDOM controls
`L4`/`L5` — no `bg-primary`, the unavailable variant's classes, an honest `disabled`, and the reason
printed beside it — each failing at base and each killed again by the `N1` negative control
(`a disabled control must not wear the primary background`; `the disabled Publish carries "bg-muted" too`).
`L5b`, which passes at base and at the candidate, is the control that stops a "make everything grey" fix
from hiding the enabled control.

**So item 3 ships on its markup, its failing-first proof, its negative control and a 77-fail/77-fail
suite with an empty two-way difference set — and its appearance is owed a browser row on signed-in
staging after A4 cuts over.** That row is a **deployment-acceptance clause, not a source row** (§11), and
it is listed as such in the handoff to A4 and Lane C.

## Honest tally

| Item | Rendered proof | Outstanding |
|---|---|---|
| 1 — loading copy + 8 s gate | **yes**, three browser readings | positive published-run branch is JSDOM-only |
| 2 — one name | **yes** | none |
| 3 — plainly-unavailable Generate | **no** | **browser row owed on signed-in staging after deploy** |

Not claimed: nothing is live. Nothing is deployed. A4 is the only deployer.
