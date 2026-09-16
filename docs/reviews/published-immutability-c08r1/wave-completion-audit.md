# Wave Completion Audit — PUBLISHED-IMMUTABILITY-C08R1

- Auditor role: `WAVE_COMPLETION_AUDITOR`
- Auditor task/session id (harness-returned, recorded by the primary planner): `ses_f5567dd8cffe35eR7tAi4LpFrz`
- Model / reasoning: `opencode-go/deepseek-v4.1-flash` — `high`. Disclosed substitution:
  the operator directed `high` (not `max`) for this cycle; the governing directive
  normally prefers `max` for publication/actor-tenant-adjacent audits.
- Reviewed `origin/main`: `92835f6c0e8bbcadd5e40d7d70361eac820e0daf`
- Re-integrated product merge: `46603a31417fa11230abdd01cad331b21136d1c5`
- R1 candidate: `8dc0da89fa4a044982bb2a43943dfff0008972cb` (base `5436ce96ae3bd35d68ca586d8e6c9e9ec46be61b`)
- Original C08 integration: `f3537544` (candidate `37a5074c`, base `47e062a3`)
- R1 QA: `ACCEPT_READY` 8/8/0/0/0 (`ses_f55733bdbffeGXhjE4e8sc8HdC`)
- Prior C08 audit: `CORRECTION_REQUIRED` (B1 snapshot-consistency gate rejected the
  canonical Flag/HGP overlay; B2 faculty sync re-asserted `isPublished: true` on a
  superseded run)
- Parity: `git diff 8dc0da89 46603a31` empty; `92835f6c` vs `46603a31` is docs-only.

## Verdict: `AUDIT_CLEAR` — mandatory tally 8/8 passed, 0 failed, 0 blocked, 0 unperformed

The two BLOCKING findings of the C08 wave audit are closed on the re-integrated
tree, and the frozen-publication invariant survives the new checks.

### New adversarial checks actually run
1. Gate probe over 15 hand-built snapshots: canonical snapped Flag/HGP ACCEPT;
   uncontained event REJECT `EVENT_INTERVAL_MISSING`; nulled `SPECIAL_EVENT.dayOfWeek`
   REJECT `DAY_SCOPED_EVENT_NOT_DAY_SCOPED`; PERIOD-only containing slot REJECT;
   week-spanning slot REJECT; inclusive boundary ACCEPT; unbacked `SPECIAL_EVENT`
   slot REJECT `SPECIAL_EVENT_SLOT_UNBACKED`; policy-global lunch fallback ACCEPT.
2. Real-producer tracing: `buildTimetableShapeContract` snap via
   `resolveContainingClassRow` (`schedule-constructor.ts:469,444,594`) vs gate
   `containsInterval` (`published-identity-snapshot.service.ts:196-234`);
   `buildUnionDisplaySlots` preserves `dayOfWeek` (`schedule-constructor.ts:726-746`).
3. Whole-repo `isPublished` writer inventory: the sole `isPublished: true` assertion
   outside tests is `publication-contract.service.ts:402`; the drift branch is
   copy-through (`generation.service.ts:1636-1662`).
4. Publication authority re-read: Serializable + advisory lock
   (`publication-contract.service.ts:176-179`), snapshot built before any write
   (`:317`), prior-run retire CAS (`:342-354`), run CAS (`:415-419`), single audit +
   post-commit-only notification/replay short-circuit (`:429+`).
5. Assertion integrity: base 84 → R1 114 `check/checkEqual` call sites; no assertion
   removed without replacement.

### Reused evidence (not rerun)
C08 `MANDATORY_SOURCE 26/26`; R1 QA `ACCEPT_READY 8/8`; the disposable-DB C08 suite
and both executor mutants with byte-exact restore.

## Findings (none BLOCKING)

- **F1 — NON_BLOCKING (pre-existing concurrency residual).**
  `invalidateStaleCompletedRuns` writes after an out-of-transaction `findMany`
  (`generation.service.ts:1593-1601`) with unguarded `update where {id}` in the drift
  branch (`:1647-1650`) and the destructive branch (`:1678-1681`). A concurrent
  `publishSchedule` can be clobbered by a stale copy. Not deterministic, not
  introduced by R1 (R1 strictly reduced sequential harm). Registered successor:
  `FACULTY-SYNC-PUBLICATION-CAS-C01` (owner: primary planner; dispatch condition:
  next operator-activated cycle or before any live generation/publication unlock).
- **F2 — NON_BLOCKING.** `timeToMinutes` coerces non-finite components to 0
  (`published-identity-snapshot.service.ts:196-199`) vs the producer's `NaN`
  (`schedule-constructor.ts:1351-1354`); not reachable through mounted writes
  (`policy-special-event.service.ts:20-22,92-93`; `scheduling-policy.service.ts:408-416`).
  Owner: primary planner; folded into the F1 successor scope as a hardening row.
- **F3 — NON_BLOCKING (observation).** Live listeners 5001→PID 13244 / 5174→PID 13260
  are up with health/ready 200, but the register-recorded runtime identity
  (supervisor 3132 / children 19448 / 10880) does not match. Owner: the already-active
  `TERM-CACHE-CATCHUP-APPLY-REFRESH-C01` preflight must re-verify listener/release
  identity from the registered task/process rather than reuse stale PIDs. No runtime
  action is unlocked by this source-only wave.
- **F4 — NON_BLOCKING (pre-existing).** `faculty.router.ts:77-79,94-99` derives
  `schoolId`/`schoolYearId` from the request body without actor-school equality
  (privileged-role gated, unchanged by this wave). Owner: the existing
  defaulting-scope backlog lane; must not be silently waived.

## Live preconditions (observed only)
5001→13244 and 5174→13260 listening; `:5001/api/v1/health` 200;
`:5001/api/v1/health/ready` 200 `{database:ok}`; `:5174/` 200. Nothing was started,
stopped, restarted, or configured by this audit.

## Required primary-planner action
Record this capsule, set `PUBLISHED-IMMUTABILITY-C08R1` to `COMPLETE` with the
closure receipt, apply the docs-only register delta, register F1–F4 with owners, and
keep every `HIGH` action locked. No product/test change is required by this audit.
