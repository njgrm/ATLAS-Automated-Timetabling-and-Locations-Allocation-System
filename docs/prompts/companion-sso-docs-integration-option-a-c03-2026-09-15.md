# CYCLE ON — COMPANION-SSO-C03 Docs Integration and Option-A Source Correction

## Activation dependency

Do not activate this cycle until `WF-C04` has integrated and pushed the atomic `create-stream` operation. At activation, create/register this stream atomically from current `origin/main`; do not hand-edit a stale worktree copy of machine state.

## Role

Act as **PRIMARY PLANNER** through docs integration, bounded source execution, fresh independent QA, serialized source integration, and Wave Completion Audit. Continue end to end until an integrated ordinary source result or a concrete product/external blocker. No HIGH action is authorized.

Read current `origin/main:AGENTS.md` and record its LF-normalized SHA-256. Re-probe every mutable runtime/external claim at the boundary; worktree prose is not current-state authority.

## Phase 1 — integrate the accepted docs candidate truthfully

- Candidate worktree: `E:/ATLAS-worktrees/companion-sso-live-prep-c02`
- Branch: `work/companion-sso-live-prep-c02`
- Frozen docs candidate: `233ae67f0263f78744fd605a6af7ccd550cdcb64`
- Original range: `234046f80effa5b963295bb27f83a90020b4f544...233ae67f0263f78744fd605a6af7ccd550cdcb64`
- Six added docs paths only; preserve all commits. Candidate disposition after accepted integration: `RETIRE_AFTER_INTEGRATION`.

Create a clean `E:/ATLAS-worktrees/integration-companion-sso-c03-20260915` worktree from refreshed `origin/main`. Verify the immutable range and merge-tree. Integrate the six docs paths, then apply a narrowly bounded integration-time truth reconciliation:

1. Preserve the four-way proxy distinction: approval status, execution status, installed-configuration proof, and SSO activation dependency.
2. Replace stale `CURRENT_STATE` statements about EnrollPro being offline with a fresh read-only reachability observation. Historical captures remain `HISTORICAL`.
3. Reconcile the current proxy execution result from `origin/main`: the last attempt performed zero mutation and stopped at its exact elevation/task boundary. Do not describe it as completed merely because EnrollPro is reachable.
4. Preserve the selected D1 decision: **Option A — ATLAS normalizes reverse-SSO roles/names**.
5. Preserve D2 as EnrollPro-owned work in a developer handoff only; never edit the companion repository.
6. Keep migration and runtime activation packets `NOT GRANTED` unless the operator separately grants their exact HIGH sentences.
7. Run claim classification over verdicts, capability matrices, preserve lists, handoffs, and successor rows: `REQUIREMENT`, `CURRENT_STATE`, `SUCCESSOR`, or `HISTORICAL`. A current-state claim duplicated as unfinished successor work fails.

Fresh docs QA must verify the resulting current-main range, current machine registry, and all six documents before Phase 2 starts.

## Phase 2 — Option-A ATLAS source correction

Create `E:/ATLAS-worktrees/companion-sso-option-a-c03` from the Phase-1 integrated `origin/main`; branch `work/companion-sso-option-a-c03`; disposition `RETIRE_AFTER_INTEGRATION`.

Implement the ATLAS-owned reverse SSO correction defined by `docs/handoffs/enrollpro-sso-contract-corrections-2026-09-15.md`:

1. At the real `POST /api/v1/auth/sso/exchange` producer, map local roles to the exact EnrollPro contract vocabulary:
   - `officer` and `admin` -> `SYSTEM_ADMIN`;
   - `faculty` -> `TEACHER` only when the downstream authorization contract permits that flow;
   - every unmappable role -> typed 4xx, zero assertion, zero success audit.
2. Guarantee valid non-empty `firstName` and `lastName` from persisted actor/faculty identity or a documented deterministic account-name derivation. If no valid source exists, fail typed rather than emitting an invalid assertion.
3. Remove the production-shape gap in the mounted test: the positive fixture must use the lowercase roles actually stored by ATLAS. An uppercase-only fixture is insufficient.
4. Centralize role/name normalization in a typed service helper used by the real route. Controllers remain transport-only.
5. Add the missing ATLAS SSO keys and route contracts to `atlas-server/.env.example` with placeholders only. Never write secrets.
6. Do not implement EnrollPro D2. Keep/update the developer handoff with its exact companion-owned `.env.example` correction.

## Mandatory controls

1. Mounted lowercase `officer` exchange emits `SYSTEM_ADMIN`, valid non-empty names, exact school/user identity, and a consumer-schema-valid response.
2. Mounted lowercase `faculty` either emits permitted `TEACHER` or returns the documented typed denial; never schema 502.
3. Missing name sources fail typed or use the documented deterministic derivation; empty strings never cross the boundary.
4. Unknown/unmappable roles fail before assertion issuance and produce zero exchange success audit rows.
5. Mutating the mapping back to raw `account.role` fails the consumer-contract test.
6. Mutating name normalization back to empty strings fails.
7. Actor-school, client ID, redirect URI, one-time-code/replay, expiry, PKCE/state, and existing SSO security regressions remain green.
8. Server/client TypeScript and builds, built-server ESM start/import, and `git diff --check` pass.
9. If EnrollPro is reachable and an existing authorized session/codes are available without login or data mutation, a read-only contract probe may run. Otherwise label live cross-app rows externally blocked; source acceptance must rely on mounted contract proof and must not consume a login.

## Integration and audit

Freeze the source candidate and commission fresh independent QA. QA must inspect the real route/service path, rerun mutants, and report a mechanical tally with `passed == total`, `blocked = 0`, `unperformed = 0` for the source scope. On `ACCEPT_READY`, integrate from a fresh current-main worktree, rerun combined gates, push without force, then commission a fresh Wave Completion Auditor. Any post-QA product-byte change invalidates the prior QA and requires fresh exact-range QA.

## Parallel boundaries

- This lane may run beside `TL-OPERATOR-WORKSPACE-C05` and `BENEFICIARY-EXPORT-PARITY-C05R1`; they own no SSO source paths.
- `WF-C04` must be terminal before activation because this cycle depends on its atomic registry writer.
- Do not edit Teaching Load, timetable generation/export, beneficiary-output, workflow-engine, runtime-supervisor, durable environment, or companion-repository source.

## Forbidden

No deployment, listener/task/env mutation, live login, migration application, live database write, term-cache apply, Teaching Load apply, generation, publication, or companion-repository edit. The migration and runtime-activation packets remain separately gated HIGH.

## Return

Return the final `origin/main` SHA, docs merge and truth-correction SHAs, source candidate and integration SHAs, exact paths, QA/audit tallies, role/name matrix, mutant evidence, current proxy/EnrollPro observation, active/awaited roles, worktree disposition, locked HIGH successors, and one next action.

Suggested commits:

```text
merge(docs): integrate companion SSO live-prep C02

fix(auth): normalize reverse SSO assertion identity

Map ATLAS roles to the EnrollPro contract, guarantee valid assertion names,
and fail closed before issuing an unmappable companion identity.
```
