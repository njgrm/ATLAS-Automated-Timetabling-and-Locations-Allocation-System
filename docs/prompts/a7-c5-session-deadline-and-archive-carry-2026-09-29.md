# A7-C5 — a sign-in check that ends, and carry-over on the archive-shaped start

**Lane A7 · 2026-09-29 08:20 +08 · MEDIUM (production wiring, cross-layer, user-facing)**
Base `967d521a` · branch `work/a7-c5-session-gate-20260929` · worktree `E:/ATLAS-worktrees/lane-a7-c5-exec`
Loop: executor → ONE fresh QA (with the §11 design judgement) → planner integration → merge to `main`.

## Why this packet exists (the requester's own words)

> On `/admin/year-setup`, **"Verifying session… Checking your sign-in" can wait forever.** Give it a time
> limit of about 8 s. After that, show one plain sentence that says what is wrong, one **Try again**, and a
> safe way back to the dashboard. Check whether the same gate guards other admin routes, and fix it once
> where it lives. Also make the carry-over switches reachable on the archive-shaped start you routed,
> keeping the default to keep.

Evidence: Codex staging walk, train 6 (`docs/reviews/codex-staging-train6-24e268fb/run2-report.md`)
`BLOCKER - /admin/year-setup - open local page, wait 10 s, reload once. Observed "Verifying session.
Checking your sign-in" indefinitely, with no setup content.` and `BLOCKER - School Year Setup - "Verifying
session. Checking your sign-in" leaves the operator stranded; show a time limit and plain recovery action.`
Lane C routed it in `docs/handoffs/lane-c-to-a2.md` (2026-09-29 06:58, A7 bullet).

## Intent, not just instructions (§11 rule 1)

- **Who:** an older, mouse-first scheduler in the school office, on a shared machine, on a link that is
  often slow because the ATLAS server is busy. They are not waiting to read a status; they are waiting to
  *do the next thing*.
- **The task on this screen:** open School Year Setup after the school moved to a new year, and start the
  new year without re-typing every grade's start/finish time, flag ceremony and special day.
- **What must feel different:** **nothing on this screen ever promises a future it cannot keep.** If ATLAS
  cannot confirm the sign-in in about eight seconds it says so in one plain sentence, and offers exactly
  two ways forward — *Try again* and *Back to dashboard*. It does not spin, it does not clear a working
  sign-in, and it does not throw the operator at the login page over a slow network. And the two
  *"keep what you had"* switches sit above the ONE button that actually starts the new year — **whichever
  shape that button takes** — so the choice is always visible at the moment it is used, with **keep** as
  the default.
- **Copy what works.** The recovery notice copies the `rollover-awareness-notice` band in `AppShell.tsx`
  (full-width band under the header, one sentence, labelled `@/ui` buttons at `min-h-11`) — that is the
  best instance of this pattern in the app. The switches reuse the existing `CarrySwitchRow` +
  `PLAIN_KEEP_*` copy from `rollover-plain-copy.ts`. **Do not invent a local variant, and do not add a
  new `@/ui` variant.**

## Item 1 — the gate has no deadline, and it is interpreted in two places

`verifySessionToken()` (`atlas-client/src/lib/settings.ts:963`) has no time bound, and **two** call sites
interpret "am I signed in" with an unbounded `verifying` state:

1. `AppShell.tsx:336` `verifyActorSession()` — guards **every** route; the sidebar then shows
   `Verifying session…` / `Checking your sign-in` (`AppSidebar.tsx:260,270`) indefinitely.
2. `pages/AdminYearSetup.tsx:147-177` — a page-local gate with its own `verifying` state that renders
   `Checking your access...` and no content, forever.

**Route census (the planner's check, 2026-09-29):** `App.tsx` has exactly one admin route
(`path: 'admin/year-setup'`, line 337) and `AdminYearSetup` is the **only** page that calls
`verifySessionToken()` for a guard (`AppShell`, `EnrollProAuthorize`, `Login` are the only other callers,
and neither gates content). So the page-local gate is the only one of its kind — and the shell gate is
the one that covers every other admin route that will ever be added.

**Fix it once where it lives.** One shared, deadline-bound resolver used by both call sites, and ONE
recovery surface mounted once:

- New `atlas-client/src/lib/session-verification.ts`:
  - `SESSION_VERIFICATION_TIMEOUT_MS = 8000` (about 8 s, as asked — name it, do not scatter the number).
  - `type SessionVerificationOutcome = { kind: 'authenticated'; user } | { kind: 'unauthenticated' } | { kind: 'unconfirmed'; reason: 'deadline-exceeded' }`.
  - `verifySessionWithinDeadline(opts?): Promise<SessionVerificationOutcome>` — races
    `verifySessionToken()` against one timer; **the timer is always cleared** (no leaked timer per
    attempt); it never throws.
  - **Authority rules, unchanged:** absent token / `null` user / a **rejection** still mean
    `unauthenticated` and still clear storage and navigate to `/login`. **A deadline is
    `unconfirmed`** — it must NOT clear the token, must NOT log the operator out, and must NOT redirect.
    A slow server is not proof of a bad session, and this is the one place that could quietly destroy a
    working sign-in.
- `AppShell`: add the `unconfirmed` state; on it, keep `bridgeUser`/auth source, render the shared
  recovery notice **once** (a band under the header, beside the rollover notice) with one plain sentence,
  one **Try again** (re-runs the same resolver) and one **Back to dashboard**. The sidebar's role line
  reads `Sign-in not confirmed` — short, and **no second copy of the sentence and no second set of
  buttons** (§8: one status per fact; the notice is the only recovery surface in the tree).
- `AdminYearSetup`: use the same shared resolver for its own authority gate (role/school scope are
  unchanged). On `unconfirmed` it renders **no** panel of its own — the shell's notice is directly above
  it, and a second copy of the same sentence on the page is a defect. Prove with the R9 renders that the
  page reads as a deliberate "could not load" surface, not a blank one.

No new route. No new page. No nav change. No change to what the page shows when the session resolves.

## Item 2 — the carry-over switches must be reachable on the archive-shaped start

**The defect is a UI exclusion, not a missing feature.** A7-C4 hid the two switches on the archive-shaped
start with `!copy.primaryStartsArchivedYear` (`RolloverPlainYearSetupCard.tsx:147-149`), because that
request did not carry `yearSetupCarry`. But the **server already carries over on that path**:
`archiveAndSyncActiveYear` → `applyRolloverSync` (`enrollpro-rollover.service.ts:1563`), which resolves the
fail-safe default in `resolveYearSetupCarryOptions` (`:1779`) and runs the carry. So on the archive-shaped
start ATLAS has been silently keeping the previous year's setup with **no way to turn it off, and no way
to see that it is doing it**. That is the worst of both: an invisible control and an invisible default.

Make the choice real on that path:

- **Server (transport only, R1 preserved):** `ArchiveAndSyncInput` gains
  `yearSetupCarry?: Partial<YearSetupCarryOptions>`; `archiveAndSyncActiveYear` forwards it verbatim into
  `applyRolloverSync`'s `yearSetupCarry`. Route `POST /runtime/rollover-archive/apply` forwards
  `req.body?.yearSetupCarry?.keepSchedulingRules` / `.keepGradeTimeWindows` **raw**, exactly as
  `/rollover-sync/apply` already does (no `Boolean()`, no `?? true`, no default at the boundary).
  **`resolveYearSetupCarryOptions` stays the only interpreter of the two values** (fail-safe: anything not
  literally `false` keeps). A stale client, a direct API caller and a missing field all still keep.
- **Client:** `applyArchiveAndSync(schoolId, options?)` gains `yearSetupCarry` and sends it; the card's
  `handleArchiveAndSync` sends the two switch values it already holds. The plain card shows the two
  switches on the archive-shaped primary as well as on the rollover-sync primary — i.e. drop
  `&& !copy.primaryStartsArchivedYear`. **The ordered-terms primary still shows no switches**: that
  request genuinely carries nothing, and a switch above an action that ignores it is a control that
  silently does nothing.
- **Default stays keep**, in both places: the visible state is `true`/`true` in `RolloverGuidanceCard`, and
  the guarantee is `resolveYearSetupCarryOptions`. Both switches off must be the only way to get an empty
  new year.
- No new audit action and no new `YearSetupCarryResult` shape: the existing
  `YEAR_SETUP_KEPT_FROM_PREVIOUS_YEAR` row and the existing `plainYearSetupCarrySummary` confirmation
  already read the sync result this path returns.

## Acceptance rows — every row names the harness that decides it

| # | Row | Harness |
|---|---|---|
| R1 | **Failing-first.** On base `967d521a` a new test proves the gate is unbounded (a never-resolving `verifySessionToken` leaves the page in its verifying state past the deadline) and that the archive-shaped primary renders **no** switches. It must FAIL on base and PASS on the candidate. | `npm run test:a7-c5-session-deadline` (new script, added in the same commit) |
| R2 | The deadline lives in exactly one module; `AppShell` and `AdminYearSetup` both call the same exported resolver, and neither re-implements a timer. | same script + a grep row over both files |
| R3 | A deadline yields `unconfirmed`: token storage not cleared, no `navigate('/login')`, `bridgeUser` not dropped. A **rejection** and an absent token still take the existing clear-and-redirect path. | same script (assert on the two branches) |
| R4 | Exactly one recovery surface in the tree: one sentence, one `Try again`, one `Back to dashboard`; no second copy of the sentence on the page. | same script (one `data-testid`, count = 1) + R9 renders |
| R5 | The archive-shaped start sends both switch values; the server forwards them un-coerced; a garbage / absent value still resolves to KEEP; both off is honoured. | `npm run test:a7-c5-session-deadline` (client half) + `npm run test:a7-year-setup-carryover` (server half) |
| R6 | The ordered-terms primary still renders **no** switches. | same script |
| R7 | Existing gates stay green: `test:a7-year-setup-carry-switches`, `test:a7-year-setup-plain-words`, `test:ux-guardrails`, `test:dup-read-callers`; server `tsc` + `build`; client `tsc` + `build`. | the committed scripts, quoted with results |
| R8 | §8: no touched file over 1000 physical lines; `CarrySwitchRow` and `@/ui` primitives reused; no new `title`/`<details>`/native `<select>`. | the executor's own count, quoted |
| R9 | **Rendered evidence**, 1366x768, from a loopback preview started ONLY with `scripts/dev/start-preview.ps1` (proxied to staging, never to live 5001): (a) `/admin/year-setup` with a session check that never resolves — before and after; (b) the archive-shaped start with the two switches visible and both on. Screenshot paths recorded. | Playwright MCP; planner re-renders its own copy for the QA judgement |
| R10 | Zero residue: `git status --short` empty, no stash, no reflog junk, nothing written under `D:\ATLAS`. | executor report |

## Hard boundaries

- **No deployment, no migration, no schema, no live-data write, no login, no generation, no publication.**
  A4 deploys. This packet produces an accepted candidate on `main` and a `A7 ready for release at <sha>`
  post.
- **Never write in `D:\ATLAS`.** `D:/ATLAS` is Lane C's checkout and the shared reference. Work only in
  `E:/ATLAS-worktrees/lane-a7-c5-exec`. `node_modules` there is a **junction** to
  `D:\ATLAS\atlas-client\node_modules` / `D:\ATLAS\atlas-server\node_modules` — never a copy, never a write
  into the target.
- **Previews only via `scripts/dev/start-preview.ps1 -ClientDir <dir> -Port <p>`** (it proxies to staging).
  No `vite preview` in the foreground, no `Start-Process` for a server, no `chrome.exe`.
- One writer: this worktree and this branch. Additive commits only; never amend or rebase a handed-off
  commit.
- Keep the four lanes' hard rule intact: no new request is added to any read path. Item 1 adds a **timer**,
  not a request. Item 2 adds a body field to a request that already exists.
