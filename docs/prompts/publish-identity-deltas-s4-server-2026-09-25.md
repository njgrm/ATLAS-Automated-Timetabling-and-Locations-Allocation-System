# S4-server — POST-PUBLISH MID-YEAR IDENTITY DELTAS packet (2026-09-25)

Program: `docs/plans/teacher-concern-authority-plan-2026-09-24.md` — stream **S4** (server half),
decision **D4**, cycle **C5** (lane B of two; runs in parallel with S1). Read the plan doc and
`docs/reference/agent-verification-gates.md` before editing. The frozen contract is the plan doc
**§C (Revision identity deltas)** plus this packet.

- Base SHA: `6d3ce4b4c88dd38aa30b4c08ff0d1078760450bd`
- Worktree / branch (single writer): `E:/ATLAS-worktrees/publish-identity-s4-server` / `work/publish-identity-s4-server`
- Tier: **MEDIUM-HIGH server source**. No schema change. The withdraw/supersede **apply** and any live
  schedule mutation remain separately gated HIGH and are **not** authorized; this lane builds and tests
  the path, it does not run it against live data.

## 1. Objective

Let a published revision carry optional, effective-dated `identityOverrides` (term authority, special
events, display slots, policy projection, class-program template) validated by the same
`assertSnapshotConsistency` the base freeze uses, applied in effective-date order on read; plus a
bounded, audited, reason-required withdraw/supersede action. History stays immutable; the base revision
is never mutated.

Verified on base: `published-identity-snapshot.service.ts` exports `readPublishedIdentitySnapshot`,
`snapshotDigest`, `assertSnapshotConsistency` (`:234`); `published-revision.service.ts` stores
`metadata` (`:53`, `:566/582`, `:735`) and its create path validates the base freeze;
`published-revision.router.ts` has only create (`:84`) and swap (`:132`) — no withdraw. Reuse these.

## 2. Owned paths (edit only these)

- `atlas-server/src/services/published-revision.service.ts`
- `atlas-server/src/services/published-identity-snapshot.service.ts` — apply overrides on read
- `atlas-server/src/routes/published-revision.router.ts` — the withdraw/supersede route
- `atlas-server/src/services/manual-edit.service.ts` — **only** if the withdraw path needs it; the
  `RUN_ALREADY_PUBLISHED` direct-edit block (`:482-494`) must be preserved
- `atlas-server/src/__tests__/published-revision-identity-s4.test.ts` (new)
- `atlas-server/package.json` — add only your own `test:published-revision-identity` line

## 3. Acceptance rows

1. **Failing-first (gate 2):** on base, `identityOverrides` are absent/ignored; on the candidate a
   valid override changes the read-back authority at/after the effective date. A mutant that skips
   override validation must fail.
2. **Validation:** every override is validated with the same consistency rule as the base freeze
   (`assertSnapshotConsistency` or an equivalent strict validator); an invalid override is rejected with
   a typed 4xx and **zero writes**.
3. **Effective-date order:** the read path applies the base freeze then the overrides in effective-date
   order; a read before the effective date returns the base authority; at/after it returns the override.
   Overrides never mutate the base revision or its frozen snapshot.
4. **Immutability:** the base revision and its frozen identity are unchanged after an override revision
   (prove with a digest/`snapshotDigest` comparison); history is append-only.
5. **Withdraw/supersede:** bounded, audited, reason-required — a missing/blank reason is a typed 4xx with
   zero writes; a valid withdraw writes exactly one audit row and leaves the base intact. The action is
   actor-school scoped and capability-gated (admin/officer/SYSTEM_ADMIN as the existing router enforces).
6. **Preserve:** `RUN_ALREADY_PUBLISHED` still blocks direct edits and swaps on a published run; the
   `PUBLISHED_SWAP` revision path and its snapshot validation are unchanged.
7. **Zero-write on rejection** (gate 6) for every new rejection path.

## 4. Do NOT touch

- `prisma/schema.prisma`, `prisma/migrations/**` — no schema change; overrides live in revision metadata.
- The S1 lane files: `faculty-availability.*`, `preference.service.ts`, `preference.router.ts`,
  `generation-preflight.service.ts`, `schedule-constructor.ts`, `hybrid-scheduler.ts`,
  `generation-input-snapshot.service.ts`, `app.ts`.
- `atlas-client/**` entirely (drift/revision UX is C6/S4-client).
- `scheduling-policy.service.ts`, `teaching-load-automation.service.ts`, `constraint-validator.ts`.
- `docs/plans/**` (planner-owned), `CHANGELOG.md`, runtime dirs, `D:\ATLAS`, companion repos, other
  worktrees. No generation, publication, live apply, deployment, or login.

## 5. Required checks

- Register the new suite as `test:published-revision-identity`; `test:server-suite` (runs
  `gate-reachability`) must stay green.
- Enumerate consumers mechanically (gate 9): `assertSnapshotConsistency`,
  `readPublishedIdentitySnapshot`, `snapshotDigest`, `identityOverrides`, and the revision create/read
  callers; report every fixture affected (notably `published-immutability-c08`,
  `faculty-sync-publication-cas-c01`) and keep them green without weakening assertions.
- If a DB-backed row is needed, use the disposable harness (ephemeral `atlas_restore_drill_*`) only.
- Commands: `npm run test:published-revision-identity`, `npm run test:server-suite`, `npm run build`,
  `git diff --check` (from `atlas-server` where applicable).

## 6. Evidence

Commit only the owned paths on `work/publish-identity-s4-server`. Do not push; do not touch `main` or
other branches. If you approach your step limit, commit a coherent candidate and report its exact state.
Handoff: base SHA · candidate SHA · changed paths · what changed and why · decisive commands with
results · consumer enumeration (search + affected fixtures) · each risk `BLOCKING`/`NON_BLOCKING` ·
verdict `REVIEW_REQUIRED`. Then a fresh independent `atlas-qa` reviews the immutable range, and only then
does the planner integrate. `atlas-server/package.json` is shared with the S1 lane and is resolved by
union at integration — add only your own line.
