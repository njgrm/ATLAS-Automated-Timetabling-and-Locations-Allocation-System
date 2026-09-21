# TIMETABLE-UX-REHAUL-ONESHOT-C01 — the relaxed, scheduler-first Timetable page

Status: **PREPARED — the operator has authorized it end to end and is asleep.** One fresh planner runs
this to completion: packet → batched review → executors → browser QA → release → demo evidence.
Risk: **MEDIUM** client source; the release that carries it is **HIGH** (standing authorization,
gates retained).

## 0. The operator's words (the acceptance bar)

> "a brand new and improved timetable page that is truly older-user friendly, not overwhelming, not
> easy to get lost in, good performance, offers the most help so that scheduling, resolving blockers
> and warnings, are as easy as it can be for schedulers."

Measurable form — every row must be shown on the **live deployed** page, not a component test:

| # | Requirement | Decidable by |
| --- | --- | --- |
| U1 | **Older-user friendly** — plain language, no jargon or raw codes, legible type, generous hit targets | rendered text + a 1366x768 screenshot; no code/enum token in operator-visible text |
| U2 | **Not overwhelming** — one primary action per state, progressive disclosure, Simple shows only what a scheduler needs | count of primary actions per state; the audit's F-findings closed |
| U3 | **Not easy to get lost** — breadcrumbs + persistent sub-nav; the grid stays mounted across sub-pages | navigate 3 sub-pages and back; assert no remount and a visible breadcrumb trail |
| U4 | **Good performance** — no request waterfall, navigation never slower than before | request count/waterfall for a clean `/timetable` load; sub-page round trip; `keepPreviousData` |
| U5 | **Most help** — every blocker/warning says who/what/when/what-to-do, and there is a path from a blocker to its fix | run 316's warning surface: every item carries an identity, a unit-bearing number and an action |
| U6 | **No-scroll architecture preserved** | `scrollHeight == clientHeight` at 1366x768; never a global window scroll |

## 1. Read first (in this order)

1. `AGENTS.md` from `origin/main` — the authority. §8 (frontend constraints: no-scroll, Radix-only,
   no raw `<select>`, 1000-line cap), §11 (gates, real-surface fixtures, batched reviewer
   dispatches), §12 (browser QA), §15 (dated blockers), §16.
2. **`docs/handoffs/ux-rehaul-handoff.md`** — the program: what was discovered, the operator
   directives, the boundaries, the stream order, the traps. **This is the spec.** It was unlinked for
   three days and the program stalled — keep it linked.
3. **`docs/reviews/ux-audit-c01/atlas-timetable-relaxed-view-audit.md`** — the evidence: F-01…F-18,
   C-01…C-05, the live measurements, the Simple interaction inventory, and the nine capstone verdicts
   with the planner's adjudications.
4. `docs/reference/agent-live-browser-qa.md`, `agent-context-economy.md`, `agent-verification-gates.md`,
   `agent-worktree-lifecycle.md`, `agent-runtime-deploy-facts.md`.
5. `docs/plans/live-state.md` (Lane A section) and `docs/handoffs/planner-session-handoff.md`.

## 2. Already done — do not redo

- **`UX-P01`** (the data-layer prerequisite: TanStack Query, parallel fetches, prefetch,
  `keepPreviousData`) is **integrated**. Verify it is actually delivering (U4), do not rebuild it.
- **`UX-R06`** (micro-copy) is **integrated**.
- The **warning presentation** was rehauled and released: every one of the 25 live `VIOLATION_CODES`
  has operator-facing copy, raw codes and bare units are gone from the surfaces, and the real run-316
  surface reads `"…180 consecutive teaching minutes…"`. Build **U5** on that, do not re-fix it.

## 3. Scope — the streams to deliver

Operator directives are authoritative: **desktop-first** (mobile de-prioritised), **Advanced is not
rehauled — demote it**, **build on Simple**, **navigation must not get slower**, ATLAS must read as
one system with SMART/EnrollPro.

- **R01** — `PageHeader` (promote the SMART `SmartCommandBar` anatomy) + **breadcrumbs** + token
  fixes. This is the visible foundation and the U3 spine.
- **R01a** — shared visual language: SMART's PageHeader anatomy, shadow/token structure. **The
  operator has resolved D-1 by authorizing this program**: adopt the patterns the audit already
  specifies; do not invent a new visual language and do not copy SMART's duplicate role layouts,
  `min-h-screen` document scroll, or DM Sans wholesale (ATLAS has an EnrollPro/HNHS branding
  contract).
- **R02** — Simple strip-down: visible filters with counts, **one** status region, **one** primary
  action, progressive disclosure of everything else.
- **R03** — nested layout route so the **grid stays mounted** across sub-page panels (unblocked —
  `UX-P01` landed). This is U3's structural half.
- **R04** — move admin/diagnostics off the operator surface.
- **R05** — Advanced demotion to an "Expert" entry point only.
- **U5 work** — the help affordances: from a warning/blocker to the thing that resolves it.

**Boundaries (do not break):** publication gates, ordered-term identity and actor-school scope are
load-bearing from earlier waves; `ScheduleReviewWorkspace.tsx` `buildScopeKey`/`clearScopeState`
scope-change hygiene must survive any route split; no-scroll architecture; shadcn/Radix primitives
only (0 native `<select>` today — keep it); **1000-line component cap** — `useTimetableMutations.ts`
(1735), `useTimetableData.ts` (1687) and `useScheduleReviewWorkspaceState.ts` (1648) already exceed
it and must be extracted **as you touch them**; companion repos are **READ_ONLY**.

## 4. Authorization and custody (the operator granted everything)

- **All access is authorized**: browser QA as often as needed (one controller, §12), logins (disclose
  every `audit_logs` row and `last_login_at` delta), `webfetch` and **Context7** for UX/UI patterns,
  unlimited executor dispatches.
- **HIGH actions** proceed under the standing authorization with every gate retained — including the
  release. No per-action approval round-trip. **This program is client source only** until its
  release.
- **Custody:** you are Lane A. Client files (`atlas-client/**`), `docs/plans/live-state.md`,
  `AGENTS.md`, the register, `CHANGELOG.md`, deployment and the browser controller are yours.
  **Planner B** is live in `atlas-server/src/routes/runtime.router.ts` (ROLLOVER-YEAR-IDENTITY-C01)
  and `companion-sso.service.ts` may be taken by the SSO fix — **stay out of both**. Edit only your
  own section of `live-state.md`; every blocker line you write carries `as of <date>` + its proof.

## 5. Method

- One packet per stream is fine, but **do not split one coherent delivery across turns**: finish each
  stream inside a turn, checkpoint with a commit, and push.
- **≤ 2 reviewer dispatches per release** (`AGENTS.md` §11): one pre-action reviewer closes the
  source range **and** the packet lint in a single pass; one post-action QA closes all deployment and
  browser rows. Do not re-dispatch for a docs-only packet fix.
- **Fixtures come from the real surface.** A control validated against an invented fixture let a real
  defect ship on 2026-09-21 and cost a whole release cycle. Copy the rendered string you actually
  observe.
- Browser rows are `DEFERRED(DEPLOYMENT_ACCEPTANCE)` while the change is undeployed, and must be run
  by the release that carries it — never simulated, never reported as passed.
- Traps: `D:\ATLAS` is stale and dirty (never a boundary); an agent shell inherits a stale
  process-scope `ATLAS_RUNTIME_SOURCE_DIR`/`…_RELEASE_SHA` (pass explicit overrides to `cli.mjs`);
  **executors cannot create worktrees — the planner provisions them**; a worktree you retired earlier
  is gone, so re-check before naming it; create a **registered worktree, never a clone**.

## 6. Live facts at authoring (re-verify, never assume)

Live release `ecff1d7e` (accepted 6/6): supervisor 26972, `5001`→26724, `5174`→31148, client entry
`index-CbCvgFxw.js`. `D:` free 32.83 GiB (warn < 25, fail closed < 15). Published run **315 /
revision 42: zero HARD violations**; the newest run is **316** (94 TERM-2-scoped SOFT warnings, zero
HARD). Active year is upstream **10** (mirror row **551**, `2031-2032`). EnrollPro origin
`https://dev-jegs.buru-degree.ts.net` (entry point `/personnel/login`; the bare root 404s).

## 7. Deliverable and acceptance

A **release** carrying the rehauled page, then the browser acceptance in one post-action QA run:
U1–U6 each with its own literal result at `1366x768`, on the named Tailnet origin with a
`window.location.origin` assertion, using a run with real violations. Evidence artifact
`docs/reviews/timetable-ux-rehaul-oneshot/acceptance.md`. Then update the Lane A section of
`live-state.md` and the living handoff, and retire your worktrees.

**The operator's bar is U1–U6 on the live page — not a green test suite, not a component render.**
If a row cannot be met, report it `BLOCKED` with the reason and the smallest next step; do not
declare the program done on partial evidence.
