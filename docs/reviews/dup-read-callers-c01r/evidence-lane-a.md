# DUP-READ-CALLERS-C01R — Lane A (client) source evidence

Base `0d19b51b` (`origin/main`). Worktree
`E:\ATLAS-worktrees\dup-read-callers-c01r`, branch `work/dup-read-callers-c01r`.
Risk MEDIUM (client auth read path). **Part A only: no deployment, no release
build, no browser, no login, no `atlas-server/**` change** (Lane B owns it).

## What changed and why

`atlas-client/src/lib/settings.ts` — `requestAuthMe` (the one choke point
shared by `resolveActorSchoolId` and `verifySessionToken`) gains a
**short-lived, per-token-epoch resolved-value memo** (`resolvedAuthMeMemo`):
`{ token, version, user }`, single entry, served only when the exact token
string AND the monotonic `getAtlasTokenEpochVersion()` both match and the
stored user carries a valid actor school. The first successful resolution in an
epoch memoizes; every later caller in the same epoch — serial or concurrent —
resolves with no dispatch. The pre-existing in-flight map is untouched.

Fail-closed invalidation: every session mutation drops the memo synchronously
via `subscribeAtlasTokenEpoch`; the no-token paths of both callers drop it;
an authoritative `401`/`403` drops it (the rejection handler) and is never
stored; only successes with a valid positive-integer school are stored, so the
S7 fail-closed rule (invalid school never cached) is preserved; rejections
never store. The single dispatch keeps its exact shape
(`GET /auth/me`, `authorization: Bearer <token>`, no params).

Consumer enumeration (gate 9; search performed:
`resolveActorSchoolId|verifySessionToken|verifyBridgeToken|requestAuthMe` over
`atlas-client/src/**/*.ts*`): production callers are `EnrollProAuthorize`,
`AdminYearSetup`, `Login`, `AppShell` (verify) and `useDashboardData`,
`useTimetableData`, `useTeachingLoadData`, `timetablePrefetch`,
`actor-scope-session`, `RolloverGuidanceCard` (resolve). Test consumers are
`dup-read-auth-me-dedup`, `actor-school-session-epoch`,
`actor-scope-session`, `session-scope-late-discard`,
`term-authority-actor-scope` (source-text only) — all executed below, all
passing, none modified.

## S1–S5 rows (source; D/B rows are out of custody — see below)

**S1 serial cross-caller dedup — PASSED with failing-first.** New suite
`atlas-client/src/lib/__tests__/dup-read-auth-me-epoch-memo.test.ts` (8
tests) counts real `atlasApi` dispatches. Pre-fix run (before the source
edit): **8 tests / 2 pass / 6 fail**, every failure behavioural:

```
✖ M1-a … 2 !== 1   ✖ M1-b … 2 !== 1   ✖ M1-c … 2 !== 1
✖ M2 … 3 !== 2     ✖ M3-c … (over-count)   ✖ M4 … 2 !== 1
ℹ tests 8 / ℹ pass 2 / ℹ fail 6
```

(M3-a/M3-b 401/403 invariants already held pre-fix — nothing was memoized.)
Post-fix: **8/8 pass**. Full literal pre-fix output retained at
`C:\Users\njgro\AppData\Local\Temp\opencode\memo-prefix-failing.txt`
(executor scratch, outside the repo).

**S2 epoch change + logout — PASSED** (M2: new epoch dispatches once with the
new value; logout resolves null with zero dispatch; re-login re-dispatches).

**S3 401/403 + rejection — PASSED** (M3-a/M3-b/M3-c: authoritative failures
drop the memo, are never served back, session cleared on 401; non-auth
rejection leaves no memo).

**S4 no behaviour drift — PASSED** (M4: single request keeps the exact bearer
and params, `authSource` defaulting intact, no dispatch on any other path;
`git diff --stat` shows only `settings.ts` + `package.json` modified and one
added test file; zero existing assertions changed — `git diff --numstat` over
test files shows **1 added file, 0 deletions**).

**S5 script reachability + gates — PASSED.** `test:dup-read-callers` extended
additively with the new file (test-script entry only, same commit).
`npm run typecheck` → **exit 0**. `npm run test:dup-read-callers` →
**tests 76 / pass 76 / fail 0** (68 prior + 8 new; includes S7, all six
concurrent-dedup S1-a…f, epoch, late-discard, and scope suites).

## Out-of-custody rows (not performed, reason stated)

- **D1–D4** (deployment) and **B1–B3** (browser): Lane B / independent-QA
  custody per the packet. No release was built and no browser opened by Lane
  A. Reported UNPERFORMED (awaiting Lane B re-release + QA pass), not passed.

## Commits (additive; nothing amended)

1. source: `settings.ts` + new test + `package.json` script.
2. this evidence file.

## Risks

- `NON_BLOCKING` — the memo serves the same stored user object per epoch;
  both callers already derive fresh values from it (`verifySessionToken`
  spreads a new object; `resolveActorSchoolId` reads the school primitive).
- `NON_BLOCKING` — a same-string token re-set bumps the epoch version and
  forces one conservative re-dispatch; never stale, at most one extra request.

Worktree disposition: `RETIRE_AFTER_INTEGRATION`.
