# TIMETABLE-RELAXED-SUBPAGES-C01 — independent QA of the live, previously-unreviewed delta

**Role:** one fresh independent `atlas-qa`. The implementer is a different agent (GPT, timetable
simplification) and did **not** review this work.
**Risk:** MEDIUM client source. The delta is **already live** and shipped under the `AGENTS.md` §11
unreviewed-delta condition.
**Mode:** read-only. No edits, no integration, no push, no persisted browser action.

---

## 1. Why this exists

`57592dd7 fix(timetable): relax scheduler chrome on subpages` reached the live runtime with **no
independent pass**. It edits `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx` —
the shell against which the `TIMETABLE-UX-REHAUL-C01R` **U1–U6** bar was proved — so an
unreviewed change there can silently regress an accepted row. `e794dee2` is a **fixture-path
correction**, the exact class that once shipped a real defect (`d3e9dfef`, D6): the QA must confirm
the fixture now resolves to the **real** surface.

## 2. Frozen facts — verify, do not trust

- `origin/main` = `2dfe0b48ffa6389ba0b24cfc0bfd50b9e73f321c`.
- Live release = **`7dbb3b90`** at `D:\ATLAS-runtime-supervised-7dbb3b90-20260922` (supervisor-owned
  5001/5174; supervisor 44476; server `5001`→9228; client `5174`→19892; Tailnet healthy). Served
  entry chunk **`/assets/index-CnDObevR.js`**.
- Previously live = **`714fadf7`** (entry `/assets/index-BxOX7te1.js`).
- **Source range under review: `714fadf7..7dbb3b90`.**
- **Product delta = exactly four `atlas-client` paths**, from `57592dd7` + `e794dee2`, merged at
  `6cc202b7` and folded into `7dbb3b90`:
  `atlas-client/package.json`,
  `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`,
  `atlas-client/src/components/timetable/TimetableRouteViewSync.tsx`,
  `atlas-client/src/components/timetable/__tests__/timetable-relaxed-subpages-c01.test.ts`.
- **Reconciliation (2026-09-23):** `7dbb3b90..origin/main` touches **zero** `atlas-client/**` paths
  (only `ops/runtime/**` + docs) — there is no undeployed client work above the live release.
- **Reconciliation finding, out of scope, do not review:** local branch
  `work/timetable-live-term-authority-c01` (HEAD `b8e2e48e`, worktree clean) and its integration
  branch `integration/timetable-live-term-authority-c01` (HEAD `38a94bb0`) hold **5 unreviewed,
  unintegrated, undeployed** commits that touch `atlas-client/package.json`,
  `src/hooks/useTimetableData.ts`, `src/lib/academic-term.ts`,
  `src/lib/timetable-data/timetablePrefetch.ts`, `src/hooks/useScheduleReviewWorkspaceState.ts`,
  `src/components/AppShell.tsx` and `src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`.
  They have **no packet and no committed review verdict**. They are **not** this QA's scope and must
  not be folded in; record them as a separate cycle. Note the `atlas-client/package.json` overlap.
- Planner-side satisfiability only (not QA evidence): `npm run test:timetable-relaxed-subpages`
  ran 2/2 pass in the QA worktree before dispatch.

## 3. Scope boundary

- Review the **deployed delta only**: `714fadf7..7dbb3b90`, product files as listed in §2.
- Do **not** review, repair, or plan `work/timetable-live-term-authority-c01`.
- Do **not** propose edits; return a verdict only.
- Live rows are valid **only** because the reviewed bytes are deployed; you must independently
  establish that (row E2) before crediting any live row as proof of this source delta.

## 4. Mandatory rows (20)

### A — source range and blast radius
- **A1** Prove the Git identity: `714fadf7..7dbb3b90` product delta is exactly the four named paths;
  `6cc202b7` is an ancestor of `7dbb3b90`; `7dbb3b90` is an ancestor of `origin/main`;
  `7dbb3b90..origin/main` has no `atlas-client/**` path.
- **A2** Read the full diff of `57592dd7` and `e794dee2`. Enumerate **every** consumer of the new
  `isTimetableSchedulerView` export and confirm the blast radius is confined to the two gates in
  `ScheduleReviewWorkspace.tsx`.
- **A3** Confirm the gate predicate is derived from the **routed** view
  (`state.headerContext.centerView`) and enumerate its value domain against
  `resolveTimetableRouteView`; only `schedule` and `pre-generation` may show chrome.
- **A4** Confirm the relaxation does **not** structurally remove a rehaul deliverable: `TimetableSubNav`
  (D1) and `ScheduleReviewWorkspaceBody` must render **outside** the gated region, and the D2/D3
  header contents must still render on the scheduler views.
- **A5** Blast radius on `layoutMode === 'advanced'`: the gate also suppresses the advanced header on
  sub-pages. Confirm that is intended relaxation and that **no control reachable only through that
  header** is lost on any `/timetable*` sub-page (name each control you checked).

### B — `TimetableRouteViewSync.tsx`
- **B1** Confirm the file is **modified, not added**, that `isTimetableSchedulerView` is additive, and
  that the pre-existing exports (`resolveTimetableRouteView`, `resolveTimetableRouteForView`,
  `resolveUrlRestoreTarget`, `TimetableRouteViewSync`) are byte-unchanged in the range.
- **B2** Confirm the sync component's behaviour is unchanged: the route→view effect, the guarded
  setter path, and the leave-dialog URL-restore effect.
- **B3** Confirm the change introduces no new route, no new data request, and no remount.

### C — rehaul acceptance rows, on the **deployed** page (see §5)
- **C1** **U3:** the sub-nav is present on the index **and** every `/timetable*` sub-page. Enumerate
  the routes you checked.
- **C2** **U3:** navigate three sub-pages and back — **no grid refetch** (network count) and the
  workspace **does not remount** (prove element identity, e.g. a marker property set on a stable
  workspace DOM node before navigating and re-read after).
- **C3** **U2:** exactly **one** solid/filled primary action and **one** status surface in the state
  you observe.
- **C4** **U6:** `documentElement.scrollHeight === documentElement.clientHeight` at **1366×768**; no
  global scrollbar.
- **C5** **U1/U5:** no jargon or raw enum/code tokens in operator-visible text; the warning copy is
  intact (the identity + unit-bearing string, e.g. `…180 consecutive teaching minutes…`).

### D — the test change
- **D1** Confirm the test change is **additive**: `e794dee2` is a one-line fixture-path correction and
  **no assertion was deleted or weakened** across `57592dd7`+`e794dee2`.
- **D2** Confirm the fixture is **real**: the second test reads a **tracked** source file — verify the
  resolved path is the actual `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
  (not a copy, not invented, not a fixture that already contains the expected text). Then adjudicate
  whether a **source-text regex** is sufficient production-path proof, or a `NON_BLOCKING` weakness.
- **D3** Confirm the new script `test:timetable-relaxed-subpages` is committed in
  `atlas-client/package.json`, that it names the new file, and that the new file is covered by the
  committed `test:client-suite` inventory (the inverse reachability guard).

### E — gates
- **E1** `npm run test:client-suite` — record the literal tally and exit code.
- **E2** `npm run build` — record exit code **and** whether the emitted client entry chunk is
  byte-identical to the live served `/assets/index-CnDObevR.js`. This is the deploy-proof row; state
  the comparison you actually performed.

### F — custody and disclosure
- **F1** One authorized login is permitted for this pass. Disclose the login footprint (read the
  `audit_logs` row id read-only if a safe path exists; otherwise record the limitation explicitly),
  log out, and prove session cleanup (`GET /api/v1/auth/me` → 401 `NO_TOKEN`). Record that no
  Save/Apply/Generate/Publish/Delete was invoked and no timetable cell was clicked (a cell click can
  place a session).

### L — packet lint
- **L1** Confirm every row above is **satisfiable** in the named environment, that none requires an
  unauthorized mutation, and that the live rows are correctly scoped to the deployed release. Report
  any unsatisfiable or ambiguous row as a finding.

## 5. Browser authorization and custody

- Origin **`https://njgrm.buru-degree.ts.net`**, assert `window.location.origin`, viewport
  **1366×768**. Credentials from
  `%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md` — never copied into prompts, docs,
  fixtures, traces, screenshots or logs.
- **Read-only.** No Save/Apply/Generate/Publish/Delete, no cell click, no slot selection.
- Exactly **one** agent controls the shared browser profile: this dispatch. Close the context when
  done.
- A live row is never reported as passed for an **undeployed** change, and a green unit suite never
  substitutes for a live row.

## 6. Environment

- QA worktree (registered, detached, **not a clone**):
  `E:\ATLAS-worktrees\qa-timetable-relaxed-subpages-20260923` at `2dfe0b48`, clean.
- `atlas-client` dependencies installed there by the planner (`npm ci`, lockfile blob
  `14dae9ba749cc4d58aef8864bb4999873e9dcfc7`, identical to the live release's lockfile).
- Run all client gates from
  `E:\ATLAS-worktrees\qa-timetable-relaxed-subpages-20260923\atlas-client`.

## 7. Return format

Return exactly `ACCEPT_READY`, `CORRECTION_REQUIRED`, or `PLANNER_DECISION_REQUIRED`, immediately
followed by `mandatory total / passed / blocked / unperformed`. `ACCEPT_READY` is invalid unless
`passed == total` and `blocked == 0` and `unperformed == 0`. Classify every finding `BLOCKING` or
`NON_BLOCKING` with precise evidence. End with
`RETURN_TO_PRIMARY_PLANNER: <specific reason>`.
