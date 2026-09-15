# TL-OPERATOR-WORKSPACE-C05 wave completion audit — round 1 (CORRECTION_REQUIRED)

- Auditor: delegated read-only adversarial context (`atlas-qa-delegate` shell),
  `opencode-go/deepseek-v4.1-flash` (default variant; no HIGH action pending, no
  max-tier requirement applied).
- Auditor task/session: `ses_f5b8c0d99ffezvYYAlXQ5os1sv` (returned to the
  planner after the task completed, per the orchestration harness provenance
  rule).
- Reviewed `origin/main`: `7b7e9b8b8bfde3e04b0f94f9158f02253fbc06d0` (register
  R1; single-parent of the integration merge).
- Base / product-test candidate / frozen tip: `0c203423` / `51800840` /
  `05bb8e51`.
- Integration merge: `87aa24a3ff2b62482b329e6583524ea9addbb121` (parents
  `387a1f6d` + `05bb8e51`; pushed as `origin/main` before this audit).
- Directive LF-SHA-256 (independently recomputed): `5F9206708A4763376DDA1943C1EAD28F49427ED1B1F0532AD25661F74ED3EBB5` — match for
  `origin/main:AGENTS.md` and `D:/ATLAS/AGENTS.md`.
- Mandatory tally: **10 total / 9 passed / 0 blocked / 0 unperformed / 1 failed**.
- Verdict: **CORRECTION_REQUIRED**.

## Checks independently run (10)

1. `git fetch --prune`; reviewed tip recorded; `87aa24a3` is an ancestor and the
   only tip delta (`87aa24a3..7b7e9b8b`) is the two register files — no
   intersection with the 26 changed paths.
2. Integration identity: merge parent order `387a1f6d` (first) + `05bb8e51`
   (second); `git diff 05bb8e51 87aa24a3 -- atlas-client atlas-server prisma` is
   EMPTY (byte-identical product tree); `git diff 387a1f6d 87aa24a3` is exactly
   the 26 candidate paths; R1 `7b7e9b8b` is register/docs-only.
3. Changed-scope census `0c203423..05bb8e51`: no forbidden path; the two
   modified test files gained assertions (no unexplained reduction); deleted
   `TeachingLoadReconciliationPanel.tsx` has zero remaining importers.
4. F1 producer/consumer parity: producer union
   `teaching-load-automation.service.ts:166-173` (6 members); emission sites
   `:1464/:3313`, `:1481/:3335`, `:3281`, `:3293`, `:3397`; client
   union/labels/details/order cover all six; `summarizeCandidateRejections`
   conserves `sum(count) === total` with the `UNKNOWN_REASON` group; the parity
   control reads the real server file.
5. Adversarial mutant (auditor-authored, restored byte-exact): appending a
   member to the real server union failed the R5 parity control (31/32); blob
   `405964f7…` identical before/after, `git diff --quiet` exit 0.
6. R3/C-2 truth: `computeOverloadCapacityTotals`
   (`teaching-load-reconciliation.service.ts:1264-1298`) derives
   `capacityMinutes`/`beforeExcessMinutes`, null when unconfigured, and the real
   builder delegates to it (`:1359`); client fails closed on null/unconfigured
   (`teaching-load-authority-truth.ts:156-201`).
7. F2 supersession mechanics: literal ordering checks pass — but see the
   blocking finding.
8. Consumer trace: truth panel ← `TeachingLoad.tsx:682`; candidate diagnostics ←
   `AutoFillSummaryModal.tsx:666`; `scope-request-epoch` consumers; zero-write
   confirmed; `TacticalSandboxDock.helpers.ts` unchanged.
9. Decisive re-runs (hermetic): five client TL suites 59/59/0/0; server C-2
   `teaching-load-overload-capacity-totals` 7/7; `workflow:test` 251/251;
   `verify-cycle` exit 0; `render-register --check` exit 0.
10. Register/receipt: C05 `INTEGRATED`, gates `21/21/0/0/0`, QA2 session
    recorded, `auditorVerdict null` at audit time, `closure null`, no receipt;
    `record-audit`/`close-cycle` have no coordination precondition, so closing
    C05 while `COMPANION-SSO-C03` holds `CYCLE_ACTIVE` violates no verifier rule.

## Findings

### BLOCKING — F2 guard self-invalidates the initial diagnostics read (R3 truth panel dead on cold first load)

`useTeachingLoadData.ts:232` (`setActiveSchoolYearId`) is in the same
synchronous continuation as the token capture at `:264` and the dispatch at
`:267` (the last await before it is the `Promise.all` at `:178`), so React
cannot have flushed a render/effect before the capture. The scope effect
(`:456-467`, deps `[scopeKey, …]`) therefore runs after that block yields and
calls `begin()` (`:465`) + `setAuthorityDiagnostics(null)` (`:466`). On a cold
cache the warm branch (`:152-176`) is skipped, `scopeKey` transitions
`null → "<school>:<year>"`, the captured token is deterministically stale when
the reply lands, `:274`/`:277` discard it, and `:280` skips clearing the loading
flag. `TeachingLoad.tsx:684` maps that flag to the panel `loading` prop, so the
panel renders “Checking source” + every chip “Not available”
(`TeachingLoadTruthPanel.tsx:44-55,108-111`). The warm-cache path sets
`activeSchoolYearId` at `:160` before `Promise.all` and works; the first-ever
visit per browser profile (empty cache) and a fast year change are broken.

The existing proofs cannot see it: `tl-operator-workspace-c05.test.ts:535-566`
is source-regex + pure-epoch, and
`tl-operator-workspace-c05-r3-truth.test.ts:84-101` builds the model from a
hand-crafted payload, bypassing the hook. No production-hook positive path
exists.

**Pass condition:** with an empty cache, after the scope-resolving load, the
`GET /faculty-assignments/authority-diagnostics` payload must persist into
`authorityDiagnostics` with `authorityDiagnosticsLoading === false`, while a
reply from an actually-obsolete scope is still discarded. Requires a
rendered-hook production-path control (mocked API, empty cache) that fails on
the current bytes. Evidence class: source-analytic (React scheduling
semantics); no browser was permitted in this audit.

### NON_BLOCKING

- The shared boolean widening also changes the unchanged timetable consumer
  (`TacticalSandboxDock.helpers.ts:22` now admits blank-department faculty);
  server authority remains final; the handoff describes this only as a copy
  asymmetry.
- DB-gated server rows and browser pixel/click rows remain unexecuted
  (`BLOCKED_EXTERNAL(DISPOSABLE_DB_UNAVAILABLE)`,
  `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`) — disclosed and consistent.

## Live-precondition snapshot (read-only)

Source-only cycle: no runtime/process restart, deployment, login, browser
session, database read/write, migration, generation, publication, or companion
edit was performed by this cycle, and none by this audit. Shared runtime
identity is taken from the register only: supervised release `3d916b26` on
5001/5174 (rollback `9d293879`; `d44f29e0` manual last resort). No HIGH action
is unlocked.

## Required primary-planner action

Do not record the audit as clear or close the cycle: author the bounded additive
correction on `work/tl-operator-workspace-c05` (scope-resolving diagnostics read
survives while true cross-scope discard is preserved) with a rendered-hook
production-path control (empty cache) that fails on the current bytes, then
fresh QA and a fresh post-correction Wave Completion Auditor before any closure
or receipt.
