# One-shot C04-A: Unified Simple-first Timetable workspace

Packet ID: `TT-DYNAMIC-WORKSPACE-C04`
Role: EXECUTOR (fresh session). This packet is implemented by an executor and
returns `REVIEW_REQUIRED`; it does not self-approve, merge, or push.
Risk tier: MEDIUM source (client-heavy) with HIGH interaction guardrails; no
live mutation, deployment, generation, publication, or migration.
Date authored: 2026-09-13 (Asia/Manila), from cycle TT-DYNAMIC-AUDIT-C04.

## 0. Governing references

- `D:/ATLAS/AGENTS.md` (canonical directive; normalized SHA-256 at authoring
  `84047C3FCB54D78ED9DC71B8B009DE1209B15EE2D6BA317D73D2B3F2DD193149`; if this
  differs at dispatch, read the canonical file and the planner's dispatch note).
- `docs/reference/timetable-dynamic-workspace-and-warning-contract.md` —
  the target operating model this packet implements.
- `docs/audits/timetable-dynamic-workspace-audit-2026-09-13.md` — evidence and
  findings A-01…A-19 consumed here.

## 1. Objective

Make Timetable one Simple-first workspace whose lifecycle modes, capability
gates, persistence status, undo/redo/history, source-drift state, and repair
navigation are truthful and complete, without collapsing the distinct mutation
authorities (pre-generation draft vs generated-run edit/revision) and without
touching the warning/policy/token surfaces owned by the parallel packet
`TT-WARNING-AUTHORITY-C04`.

## 2. Worktree, base, and boundaries

- Create a clean worktree from refreshed `origin/main` at the exact base SHA the
  planner pins at dispatch (must include the integrated TT-DYNAMIC-AUDIT-C04
  docs package). Branch: `work/tt-dynamic-workspace-c04`. Never use the dirty
  `D:/ATLAS` checkout as an implementation boundary.
- **Owned paths (exclusive):**
  - `atlas-client/src/components/timetable/**` EXCEPT
    `ScheduleReviewWorkspace.constants.ts`, `simplePublishReadiness.ts`, and
    `GeneratedRunRailPanels.tsx` (owned by the parallel warning packet).
  - `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
  - `atlas-client/src/hooks/useTimetableMutations.ts`
  - `atlas-client/src/pages/ScheduleReview.tsx`
  - New S1 test files under `atlas-client/src/lib/__tests__/timetable-dynamic-workspace-*.test.ts`
    and colocated component tests following existing repo patterns.
  - Server extension (only if a required truth is not otherwise reachable from
    the existing run/rollover read models): `atlas-server/src/services/timetable-workspace-status.service.ts`
    (NEW), `atlas-server/src/routes/timetable-workspace.router.ts` (NEW), and the
    mount registration line in `atlas-server/src/app.ts`. Any such route must be
    read-only, actor-school/year scoped, and zero-write.
  - One executor handoff: `docs/handoffs/tt-dynamic-workspace-c04-executor.md`.
- **Forbidden paths (other packets / planner):**
  - `atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts`,
    `atlas-client/src/components/timetable/simplePublishReadiness.ts`,
    `atlas-client/src/components/timetable/GeneratedRunRailPanels.tsx`,
    `atlas-client/src/hooks/useTimetableData.ts`, `atlas-client/src/types.ts`,
    `atlas-client/src/components/ExplainabilityDrawer.tsx`,
    `atlas-client/src/components/PolicyImpactSummary.tsx`,
    `atlas-client/src/components/SchedulingPolicyPane.tsx`,
    `atlas-client/src/components/scheduling-policy/**`.
  - All `atlas-server/src/services/*` warning/policy/generation/TL/sync files
    (`constraint-validator.ts`, `scheduling-policy.service.ts`,
    `generation.service.ts`, `generation-preflight.service.ts`,
    `generation-input-snapshot.service.ts`, `manual-edit.service.ts`,
    `pre-generation-draft.service.ts`, `timetable-teaching-load-repair.*`,
    `reconciliation.service.ts`, `timetable-sync-setup.service.ts`,
    `timetable-quick-place.service.ts`, `publication-contract.service.ts`)
    except the three S1 server files named above.
  - `CHANGELOG.md`, `docs/plans/atlas-active-delivery-streams.md`, and
    `docs/reference/atlas-runtime-source-of-truth-map.md` (planner consolidates).
- **Forbidden actions:** any live database write or live API mutation; starting
  any server against the shared/live `.env` database; generation, publication,
  deployment, process restart, migration, term-cache apply, Teaching Load
  apply, login, or companion-repository edits (EnrollPro/AIMS/SMART remain
  READ_ONLY). Do not push any branch.

## 3. Required outcomes and failing-first controls

Before editing, build the trace table
`requirement -> production path -> negative control -> verification command`.
For each row below, the negative control must fail on the current base.

### R1 — Publication gate parity (findings A-01, A-02; contract CP-1)

- Publish gating in Simple and Advanced must consume the **run-wide** blocker
  truth (canonical run summary hard count / persisted run violations), while the
  **display** list stays selected-term scoped per the ordered-term invariants.
  Current defect: the gate consumes the term-filtered array
  (`useTimetableData.ts:492-503,542`; `useScheduleReviewWorkspaceState.ts:1547`;
  headers gate at `TimetableSimpleHeader.tsx:171-198`,
  `ScheduleReviewWorkspaceHeader.tsx:242,441`).
- Soft-acknowledgement UI must reflect the run-wide soft count the server
  requires (`publication-contract.service.ts:274-279`).
- Control: run fixture with a HARD violation scoped only to an unselected term
  (or term-less) → Publish must be blocked with a truthful reason; old code
  allows the attempt. Add both a gate-derivation unit test and a header
  component test.

### R2 — One publication predicate (findings A-04/B-11; contract CP-2)

- Every Timetable client surface must treat `summary.isPublished === true` as
  the only publication truth. Superseded runs (`isPublished:false` with retained
  markers, `publication-contract.service.ts:295-305`) must not render
  "published" affordances, must not offer revision creation, and must not offer
  Sync/Repair that always 409.
- Current defect: loose marker OR-checks at
  `ScheduleReviewWorkspace.tsx:130-137` (also `CenterWorkspace.tsx:360-367`,
  `TacticalSandboxDock.tsx`, `TeacherDepartureRecoverySheet.tsx` per lane A/B).
- Control: fixture with `publishedAt` present and `isPublished:false` renders
  "not published" and no revision CTA; old code renders published affordances.

### R3 — Selected-class Swap is armed (finding A-05)

- The selected-class strip/sheet Swap must arm the same swap workflow the More
  menu arms (`TimetableSimpleHeader.tsx:300-305` →
  `ScheduleReviewWorkspace.tsx:371-375`), in both layouts, and must not be a
  state-only no-op (`ScheduleReviewWorkspace.tsx:198-214,322-325,546-556`).
- Control: component test — clicking strip Swap sets the swap source and opens
  the swap flow exactly once; Advanced body no longer lacks the drawer path.

### R4 — Truthful persistence status and durable Undo/Redo/history (contract §4)

- Implement the contract's per-mode vocabulary: `Previewing`, `Saving`,
  `Saved` (+ timestamp), `Save failed` (retry), `Version-stale`, `Undo`,
  `Redo`, `History`. One-click clean placement must disclose auto-commit before
  the click (fix `TimetableTaskDrawer.tsx:74-81` copy) and show the visible
  `Saved … Undo` strip after (existing at `ScheduleReviewWorkspace.tsx:245-277`).
- Undo must target a specific edit id with `expectedVersion` CAS and must label
  whose edit it reverts; it must never silently revert another operator's edit.
- Redo is bounded and authoritative: it re-dispatches the same
  preview/commit/revision endpoint with a fresh CAS; a failed CAS renders
  `Version-stale` and dispatches nothing. Redo state clears when its target
  version is no longer current or when scope changes. No client-only replay.
- History must show actor, time, type, and counts per entry with a per-row
  revert affordance.
- Controls: unit tests for undo/redo state machine including stale-CAS refusal
  (assert zero dispatch), and for pre-generation placement undo/redo routes.

### R5 — Scope hygiene (finding A-08; ordered-term invariant 6)

- On school/year/run/term change, all component-local state (activeSimpleTask,
  selected entry, teacher-departure focus, details/readiness sheets, repair
  state, inline previews) must clear or be revalidated before any dispatch.
- Control: scope-change test asserting zero stale-scope dispatch and cleared
  UI state; old code retains sheets/task state (`ScheduleReviewWorkspace.tsx:62-93`).

### R6 — Source-drift and term-authority visibility in Simple (findings A-11, B-06 UI, B-14)

- Simple must surface: run input freshness domains (`inputState`) with per-domain
  chips, ordered-term authority state, and rollover drift status before publish
  or sync; actions route to the correct repair per domain (sync / targeted
  repair / regenerate / reconcile). Advanced keeps the same information.
- Control: fixture run with `inputState.status !== FRESH` plus a term-authority
  mismatch → Simple shows the typed state and the routed action; old code shows
  nothing in Simple.

### R7 — Capability model is the production guard; Advanced migration (finding A-14)

- `deriveTimetableCapabilities` (or its documented successor) must be the
  production guard for generate/publish/move/swap/requests/review actions in
  both modes; no material workflow may remain Advanced-only.
- Migrate or make reachable from Simple with context: room-request review when
  requests block the current task; setup-sync impact review; selected-class
  Teaching Load owner repair (identity-preserving deep link); policy access
  (Simple shows status + link; editing stays Advanced). Keep the existing
  Advanced expert panels.
- Control: capability test asserting each gate derives from the shared model;
  reachability test enumerating Simple entry points for the migrated actions.

### R8 — No dead repair navigation (finding A-03, S1-owned links only)

- Remove/replace all S1-owned `/campus-rooms` links
  (`TimetableSimpleHeader.tsx:849`, `SimpleTaskDrawerHelpers.tsx:31-32`) with a
  mounted route (room configuration lives at `/map`; verify the correct surface
  by tracing `openMapWorkspace`/`openRoomGridWorkspace`). Add a route-resolution
  test that every S1-owned repair href exists in the router table.
- The parallel warning packet fixes the same target for
  `simplePublishReadiness.ts:66-67`; do not edit that file.

### R9 — Workspace polish and truth fixes

- Deep links: `/timetable?runId=&entryId=&view=&severity=` must be consumed on
  mount and preserved by navigation helpers (finding A-17).
- Readiness-sheet Teaching Load links must preserve teacher/section/subject
  identity (finding A-18; `TimetableSimpleHeader.tsx:840-842`).
- Tutorial must receive the authenticated role, not the localStorage string
  (findings A-09/A-19).
- Policy-read failure must not leave a permissive `{teacherMoveEnabled:true}`
  default or suppress the hidden-row warning (finding A-16).
- Advanced `Requests` must expand the collapsed rail (finding A-12); collapse
  the duplicate selected-class surfaces (finding A-13).
- No-active-year/error state must offer a real Year Setup route, not Retry-only
  (finding A-10).
- Advanced re-publish of an already-published run must block/say "already
  published" using the server `replayed` flag instead of a success toast
  (finding A-15).
- Edit-history/cache staleness: show the data's checked-at age where the 120 s
  cache is surfaced (finding B-10).

### R10 — Archived read-only contract (finding B-16; decision D4)

- The workspace must not present mutation affordances for non-active years. If
  binding an archived year read-only is not reachable within this packet,
  implement the honest exclusion (no archived affordance pretending to work)
  and record the D4 dependency in the handoff. Do not invent a second year
  binding authority.

## 4. Mandatory gates

- `atlas-client`: `npx tsc --noEmit` (or the repo's exact client type-check
  command), `npm run build`, and the focused suites:
  `npm run test:timetable-operator-ux`, `npm run test:timetable-conflict`,
  `npm run test:ux-guardrails`, `npm run test:timetable-sync-setup`, plus all
  new `timetable-dynamic-workspace-*` tests.
- If any S1 server file was added: `atlas-server` `npm run build` and a mounted
  read-route test proving actor-school scoping and zero writes.
- `git diff --check` and a clean staged-path audit (only owned paths).
- The existing full client test inventory must be run once before handoff; no
  unexplained test/assertion reduction is allowed.

## 5. Browser QA requirements (no login authorized)

- Mandatory browser rows for positive interaction (swap arming, auto-commit
  disclosure, undo strip, scope clearing) may be executed **only** as
  `ISOLATED_LOCAL_BROWSER` against a matched candidate client+server build on
  localhost ports, clearly labeled, and **only** with a disposable/local
  database configuration — never the shared/live `.env` database. If no safe
  disposable runtime exists, cover the rows with component tests and mark the
  browser row `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` in the handoff.
- Tailnet read-only rows (`https://njgrm.buru-degree.ts.net`) require a
  reusable existing session with an origin assertion; if none exists, mark
  `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`. Do not log in, do not use the
  shared runtime for writes, and do not ask for credentials.
- The handoff must list every browser row with its label and evidence.

## 6. Review, correction budget, and return contract

- Fresh independent QA is mandatory on the immutable `<base>...<candidate>`
  range (delegated by the planner; do not self-review).
- Maximum two correction rounds in this packet; the executor keeps the same
  branch and adds correction commits (no amend/force-push).
- Return a single handoff: base SHA, candidate SHA, changed paths, the trace
  table with PASS/BLOCKED/DEFERRED per row, decisive command results, browser
  row labels, known risks, and `REVIEW_REQUIRED`. Do not edit the living
  register, `CHANGELOG.md`, or another stream's files.
