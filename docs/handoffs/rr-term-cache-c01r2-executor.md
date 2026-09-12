# RR-TERM-CACHE-C01R2 — executor handoff

- **Role:** EXECUTOR (bounded delegate). No merge/push/rebase/amend/deploy; no
  register/`CHANGELOG.md`/runtime-map edit; no self-approval. Returns
  `REVIEW_REQUIRED`.
- **Worktree:** `D:/ATLAS-worktrees/rr-term-cache-c01r2`
- **Branch:** `work/rr-term-cache-c01r2`
- **Base SHA:** `781a457fa1c6c9c2515787b6cab302f9f1558bb6` (verified equal to
  `git rev-parse HEAD` with an empty `git status --short` before editing).
- **Product candidate:** `9d7b6f367312c3684ddc8abba751b493b6a689a9`
  (`fix(rollover): bind actor-school authority to the session token epoch`).
- **Docs packet commit:** `7bcdd8c2536c9543845296bffa4087d138b8a66f`
  (`docs(prompts): make RR-TERM-CACHE-C01R deploy packet executable`).
- **Review range:** `781a457fa1c6c9c2515787b6cab302f9f1558bb6...<tip>` where the
  tip is this handoff commit (docs-only addendum). Exact tip SHA is reported in
  the executor return message.
- **Governing prompt:** RR-TERM-CACHE-C01R2 correction packet (session-bound
  actor-school authority + executable HIGH deployment packet).

## Objective delivered

1. **Defect A — session-bound actor-school authority.** `resolveActorSchoolId()`
   in `atlas-client/src/lib/settings.ts` now caches the resolved actor school
   against the exact `getPreferredAccessToken()` epoch that produced it. Any
   token change invalidates re-use; an absent token fails closed with zero
   dispatch; a late/obsolete `/auth/me` response can neither return, seed, nor
   overwrite a newer scope; invalid/absent school ids are never cached. The
   exported signature `resolveActorSchoolId(): Promise<number | null>` is
   unchanged, so all existing consumers compile and stay fail-closed.
2. **Defect B — impossible deployment ordering.** The HIGH packet
   `docs/prompts/rr-term-cache-live-deploy-preview-2026-09-12.md` now specifies a
   stop-then-start swap with per-stage rollback, states explicitly that the swap
   is not zero-downtime, and replaces the stale product pin with an
   integration-finalized pin (status stays `PREPARED — NOT APPROVED`).

## Changed paths

Product:
- `atlas-client/src/lib/settings.ts` (session-bound resolver)

Tests:
- `atlas-client/src/lib/__tests__/actor-school-session-epoch.test.ts` (new,
  real-path suite)

Docs:
- `docs/prompts/rr-term-cache-live-deploy-preview-2026-09-12.md`
- `docs/handoffs/rr-term-cache-c01r2-executor.md` (this file)

Out of scope and untouched: `atlas-client/src/lib/auth.ts`, all other client
consumers, all server source/tests, `CHANGELOG.md`, the living register, the
runtime source-of-truth map, Prisma schema/migrations, companion repositories,
the shared runtime (5001/5174), and the live database.

## Trace table

| # | Requirement | Production path | Negative control | Verification | Result |
|---|---|---|---|---|---|
| A1 | Cached school is bound to the current token epoch | `resolveActorSchoolId` reads `getPreferredAccessToken()` before reuse and stores the epoch | pre-fix cache was module-lifetime with no token binding | `actor-school-session-epoch` S4/S6: re-login and bridge replacement return the new school (1→2) | PASS |
| A2 | No token ⇒ `null`, zero `/auth/me` dispatch, never a cached school | early return before `atlasApi.get('/auth/me')` | pre-fix dispatched `/auth/me` and returned the stale cache | S1/S3/S8: zero `/auth/me`, zero scoped dispatch, `null` | PASS |
| A3 | Late/obsolete response cannot return, seed, or overwrite | post-await `getPreferredAccessToken() !== tokenEpoch` guard | pre-fix committed any response | S5a (late after B resolved) and S5b (late before B resolved): both discarded, cache stays school 2 | PASS |
| A4 | Fail closed; no school-1 fallback; invalid ids never cached | `isResolvedActorSchoolIdValue` strict guard; `resetActorSchoolIdCache()` on invalid | pre-fix cached `null` as "unresolved" but reused any valid id across sessions | S7: `0/-4/1.5/'2'/null/undefined` → `null`, second call re-dispatches (not cached) | PASS |
| A5 | Bounded per-token cache: repeated calls reuse, no re-dispatch | epoch-matched early return | pre-fix also cached (only correct behavior pre-fix) | S2: one `/auth/me` for two resolves | PASS |
| A6 | Signature unchanged; consumers compile and remain fail-closed | existing `useDashboardData`, `useTeachingLoadData`, `Subjects.tsx`, `ActorScopedRolloverGuidanceCard` gate on `isResolvedActorSchoolId` | n/a | client `tsc --noEmit` exit 0; `term-authority-actor-scope` 8/8; `dashboard-lifecycle-truth` 18/18 | PASS |
| A7 | Scoped fetchers receive only the resolved epoch school | `fetchRolloverStatus`/`previewTermCacheSync`/`applyTermCacheSync` | pre-fix B re-login reused school-1 scope | S4: all 3 recorded scoped requests carry school 2 and token `epoch-s4-b`; none carry school 1 | PASS |
| B1 | Executable stop-then-start order (build/stage → record incumbents → stop server → start server → stop client → start client → post-swap) | packet §3 steps 1-9 | pre-fix §3 started new listeners before stopping incumbents | packet re-read: ordering is stop-before-start at each port | PASS |
| B2 | Explicitly not zero-downtime; per-stage rollback | packet §3 preamble + §4 rollback bullets | pre-fix implied zero-downtime/start-before-stop | packet re-read: only "not zero-downtime" and a proxy/alternate-port exception remain | PASS |
| B3 | Integration-finalized product pin; status stays PREPARED | packet §1 + §8 | pre-fix pinned stale `2e871007` as deployable | packet §1 records «recorded at integration»; §8 references the recorded pin | PASS |

No BLOCKED or DEFERRED mandatory rows.

## Failing-first evidence (mandatory)

Commands (client workspace, in order):

1. `git stash push -- atlas-client/src/lib/settings.ts`
2. `npx tsx --test src/lib/__tests__/actor-school-session-epoch.test.ts`
   → **tests 9 / pass 1 / fail 8** (only S2 passes; S1, S3, S4, S5a, S5b, S6,
   S7, S8 fail). Representative failures:
   - S1: `expected: 0, actual: 1` — pre-fix dispatched `/auth/me` with no token.
   - S3: `cleared session must not return the cached school` (`1 !== null`).
   - S4: `re-login must revalidate, not reuse school 1` (`1 !== 2`).
   - S5a: `session B resolves its own school` (`1 !== 2`).
   - S5b: `obsolete A response must not seed school 1` (`1 !== null`).
   - S6: `bridge replacement must revalidate` (`1 !== 2`).
   - S7: `school id 0 must fail closed` (`1 !== null`).
   - S8: `1 !== null` (stale school returned with no token).
3. `git stash pop` (fix restored)

Post-fix: same command → **tests 9 / pass 9 / fail 0**. The suite is therefore a
genuine regression control, not a passing tautology.

## Decisive gate counts

Server (`atlas-server`; source untouched in this candidate):
- Gate 1 `term-authority-status-rrtc01`: 11 passed / 0 failed / 0 skipped
- Gate 2 `term-cache-catchup-rrtc01` (mounted disposable PostgreSQL): 1 passed /
  0 failed / 0 skipped
- Gate 3 `npx tsc --noEmit`: exit 0
- Gate 4 `npm run build`: exit 0
- Gate 5 built `node dist/server.js` on isolated port 5099 with
  `ROLLOVER_AUTO_SYNC_ENABLED=false`: PID 31456, health 200,
  `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false` logged,
  `term-authority/preview` → 401, `term-authority/apply` → 401, process stopped,
  port 5099 free; ports 5001/5174 never touched

Client (`atlas-client`):
- Gate 6 `actor-school-session-epoch` (new): 9 passed / 0 failed / 0 skipped
  (failing-first against pre-fix `settings.ts`: 1 passed / 8 failed)
- Gate 7 `rollover-term-repair` 6 passed + `term-authority-actor-scope` 8 passed
  (aggregate 14/14, 0 failed)
- Gate 8 regressions: `dashboard-lifecycle-truth` 18 + `rollover-ui-guardrails` 3
  + `teaching-load-carry-forward-helpers` 11 = 32 passed / 0 failed
- Gate 9 `npx tsc --noEmit`: exit 0
- Gate 10 `npm run build`: exit 0

Both:
- `git diff --check` on the staged diff: exit 0
- Changed-path stat is confined to the allowed set (settings.ts, new test,
  packet, this handoff).

## Zero-residue proof

`term-cache-catchup-rrtc01` provisions and drops its own
`atlas_restore_drill_20260912_rrtc*` database inside a guarded `try/finally`.
A read-only `pg_database` probe after the run found no `..._rrtc*` database.
The single remaining `atlas_restore_drill_20260911_uxc01rc6e5ba0d` row is a
pre-existing, unrelated UXC01R artifact dated the prior day; it was not created
by this run and was deliberately not dropped (out of scope). `.env` and build
outputs remain gitignored; nothing is staged or untracked outside the allowed
paths.

## Known risks

- The epoch guard uses the whole preferred access token as the epoch identity,
  matching how `atlasApi` re-reads the token per request. If a session is renewed
  with the *same* token string, the cache legitimately survives; a same-value
  re-issue is indistinguishable from an unchanged session by design.
- No live Tailnet/browser evidence is claimed. This is a source + docs
  correction; authenticated Stage C belongs to the separately approved
  deployment in the packet.
- The deployment packet now fails closed on the missing integration pin: it
  cannot authorize deployment until the integration owner records the final
  product SHA. That is intentional, not a blocker to this source candidate.

## Zero-mutation / safety statement

- No merge, push, rebase, amend, reset, or self-approval.
- No shared runtime process on 5001/5174 was started, stopped, or used; no
  browser, login, or Tailnet session write occurred.
- No live/shared database write; the disposable-PostgreSQL suite was the only DB
  target, and its database was dropped.
- No term-cache apply, rollover sync, Teaching Load mutation, generation,
  publication, schema, or migration was executed.
- Companion repositories, `atlas-client/src/lib/auth.ts`, the living register,
  `CHANGELOG.md`, and the runtime source-of-truth map were not touched.

**REVIEW_REQUIRED**
