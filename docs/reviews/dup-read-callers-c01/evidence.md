# DUP-READ-CALLERS-C01 — Lane A evidence (source cycle)

Base `ccf31e77` (`origin/main`). Worktree `E:\ATLAS-worktrees\dup-read-callers-c01`, branch
`work/dup-read-callers-c01`. Risk MEDIUM (client read-path concurrency); **no deployment, no
browser, no login, no server change** in this cycle (§0/§3 of the packet).

## Commit sequence (A5)

| # | Commit | Scope |
|---|---|---|
| A1 | `b95dc956` | `settings.ts` (shared per-epoch `/auth/me`), auth-me counter suite, `package.json` script |
| A2 | `7c3a19b0` | `enrollpro-public-settings.ts` (profile-keyed `runtime/context`), profile suite, script extended |
| A3 | `592b1379` | `settings.ts` (`rollover-status` `(school, includeCounts)` key), rollover suite, script extended |
| E | evidence commit | this file |

Exact changed paths: `atlas-client/src/lib/settings.ts`,
`atlas-client/src/lib/enrollpro-public-settings.ts`, `atlas-client/package.json`,
`atlas-client/src/lib/__tests__/dup-read-auth-me-dedup.test.ts`,
`atlas-client/src/lib/__tests__/dup-read-runtime-context-profile.test.ts`,
`atlas-client/src/lib/__tests__/dup-read-rollover-status-dedup.test.ts`,
`docs/reviews/dup-read-callers-c01/evidence.md`.

## What changed and why

- **A1** — `resolveActorSchoolId` and `verifySessionToken` now await one shared
  `requestAuthMe(tokenEpoch)` promise (`inflightAuthMeByToken`, keyed by the exact preferred
  access token). A rejected request clears the entry in `finally`; the resolver's late-response
  epoch check is preserved, so a token change is never served the previous session's actor.
  No `AppShell.tsx` edit was needed: A1 is fully satisfied inside `settings.ts` (the file is
  authorized but not required to change).
- **A2** — the `runtime/context` registry is now
  `inflightBySchool: Map<'schoolId:verifyUpstream:allowEnrollProFallback:allowStaleOnError', …>`.
  Absent options normalize to their **effective** defaults. `forceRefresh` no longer bypasses
  the registry, so an equal-profile `forceRefresh+verifyUpstream` caller joins the in-flight
  live fetch (never cache), while a different `verifyUpstream`/`allowStaleOnError`/fallback
  profile dispatches its own request. `promoteActiveSchoolYearContext` uses the same key. The
  `useTimetableData.ts:1175-1190` follow-up is **kept** (A2 Keep clause); no edit to that file.
- **A3** — `fetchRolloverStatus` shares one in-flight request per `(schoolId, includeCounts)`;
  differing `includeCounts` stay independent; a rejection clears the entry.

### Packet discrepancy, disclosed (A2 normalization)

Packet §2 A2's parenthetical groups `verifyUpstream` with `allowEnrollProFallback` as
`!== false`. That would normalize an **absent** `verifyUpstream` to `true` and collapse it with
explicit `verifyUpstream:true`, letting a `verifyUpstream:true` caller join a
`verifyUpstream:false` request — the exact user-visible regression §2 A2 prose and mandatory
row **S2** forbid ("never joins a `verifyUpstream:false` in-flight request"). The key therefore
uses each option's **effective** value (`verifyUpstream === true`, the other two `!== false`),
which satisfies the prose, S2, and the stated purpose (callers differing only by an omitted
default still dedupe). S2-b and S2-e are the load-bearing controls for this axis.

## S1–S5 rows

**S1 `/auth/me` — PASSED.** Instrumented counter over the `atlasApi` transport; `beforeEach`
resets `recorded`. Failing-first control (base source, new suite): 5/6 fail, literal
over-counts `2 !== 1` (S1-a/b/c), `3 !== 1` (S1-d). Post-A1: 6/6 pass, each asserting one
dispatch per epoch, a new dispatch on epoch change, entry cleared on rejection, and no
cross-epoch sharing.

```
✖ S1-a concurrent resolveActorSchoolId + verifySessionToken dispatch exactly one /auth/me per token epoch
  AssertionError [ERR_ASSERTION]: exactly one /auth/me dispatched for one token epoch
  2 !== 1
✖ S1-d many concurrent resolveActorSchoolId callers dispatch one request
  AssertionError [ERR_ASSERTION]: three concurrent resolvers share one /auth/me
  3 !== 1
```

**S2 `runtime/context` — PASSED.** Failing-first control: `S2-a` (`2 !== 1`, equal-profile
`forceRefresh` did not join) and `S2-e` (`1 !== 2`, `promote` wrongly joined a weaker-profile
background refresh). Post-A2 6/6 pass, including: `verifyUpstream:true` never joins a
`verifyUpstream:false` request (query params asserted: `undefined` vs `'true'`); the
`allowStaleOnError` axis asserted on the **success** path (S2-c, two independent dispatches)
and the **failure** path (S2-d, the strict caller throws while the lax caller falls back to
`{source:'cache', stale:true}`); `promote` uses the same key; a fresh cache still
short-circuits with zero dispatch; the returned `activeTerm`/`source` state is unchanged.

```
✖ S2-a a forceRefresh caller with an equal profile joins the in-flight request
  AssertionError: an equal-profile forceRefresh caller shares the one in-flight request  2 !== 1
✖ S2-e promoteActiveSchoolYearContext dispatches its own request instead of joining a weaker profile
  AssertionError: promote does not join the background refresh under a different profile  1 !== 2
```

**S3 `rollover-status` — PASSED.** Failing-first control: `S3-a` and `S3-d` (`2 !== 1`).
Post-A3 5/5 pass: one dispatch for one `(schoolId, includeCounts)` pair, differing
`includeCounts` independent with params `{schoolId, includeCounts:false|true}`, count-less and
counts payloads not crossed, rejection clears the entry, omitted default shares with explicit
`false`, and a settled request is not reused.

**S4 no consumer behaviour change — PASSED.** Mechanical enumeration (search performed:
`grep -n "from '@/lib/(settings|enrollpro-public-settings|actor-scope-session)'"` over
`atlas-client/src/**/*.test.ts*`) yields 6 existing consumer suites — `active-school-year-scope`,
`actor-school-session-epoch`, `actor-scope-session`, `session-scope-late-discard`,
`term-authority-actor-scope`, `rollover-term-repair` — all executed and passing, plus the
source-scanning `rollover-ui-guardrails` (4/4). `git diff --numstat ccf31e77..HEAD` over test
files shows **only 3 added files, 0 deletions**; no existing assertion was changed, deleted, or
weakened.

**S5 script reachability and gates — PASSED.** `atlas-client/package.json` adds
`test:dup-read-callers`, which runs the three new files plus all seven named suites (real paths
under `atlas-client/src/lib/__tests__/`). Client type-check: `tsc --noEmit -p tsconfig.json`
→ **exit 0**. Full committed script → **68 tests, 68 pass, 0 fail**.

```
ℹ tests 68
ℹ pass 68
ℹ fail 0
```

### S5 environment disclosure (NON_BLOCKING)

The worktree's stable dependency anchor (`E:\ATLAS-worktrees\ux-quickfix-c01\atlas-client\node_modules`,
the workspace's shared target) is missing `@tanstack/react-query`, so without it both the
type-check (3 pre-existing `TS2307` errors in `useTimetableData.ts`, `timetableQueryClient.ts`,
`main.tsx` — none in a changed file) and `ux-p01-timetable-data-layer` fail to load. `npm ci`
was not run (not authorized). For verification only, a **transient, read-only, root-level**
junction `dup-read-callers-c01/node_modules` was pointed at
`D:\ATLAS-runtime-supervised-434b2a81-20260921\atlas-client\node_modules`
(`@tanstack/react-query@5.103.1` / `query-core@5.103.1`, exact match to the branch range
`^5.103.1`). No runtime file was read-write modified. The overlay was removed before handoff
(`Test-Path` false; junction list confirms only the `ux-quickfix-c01` anchor remains); the
release target is intact. A re-runner needs a complete install in the worktree for S5.

## Deferred rows (not counted)

- **B1** `/timetable` request counts — `DEFERRED` (deployment-acceptance; requires the
  deferred release build, §0).
- **B2** no user-visible regression at `1366x768`, console baseline — `DEFERRED` (requires the
  deployed build and an authorized login).

## Observations (not acceptance rows)

- **O1** the 502 lead's exact status/body/headers — not captured; this cycle opened no browser
  and made no authenticated request.
- **O2** the duplicate baseline outside the three callers — not measured this cycle.

## Rollback

Revert the three source commits; no runtime, database, migration, env, publication, or
deployment state was touched. Source-only rollback is a normal Git revert on the branch.

## Risks

- `NON_BLOCKING` — S5's type-check/`ux-p01` require a complete `node_modules`; the stable
  anchor lacks `@tanstack/react-query` (see disclosure above). Committed bytes are unaffected.
- `NON_BLOCKING` — A2's profile key uses equal-profile joining only (not a weaker/stronger
  merge); this is strictly conservative and satisfies "equal-or-stronger".
- `NON_BLOCKING` — `AppShell.tsx` is authorized by the packet but unchanged, because A1 is
  fully implemented in `settings.ts`.

## Worktree disposition

`RETIRE_AFTER_INTEGRATION`. No deployment is unlocked by this evidence.
