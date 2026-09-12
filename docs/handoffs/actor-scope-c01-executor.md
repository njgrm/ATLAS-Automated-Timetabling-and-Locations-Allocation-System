# ACTOR-SCOPE-C01 — Executor Handoff

## Identity

- Repository: `D:\ATLAS`.
- Worktree: `D:\ATLAS-worktrees\actor-scope-c01` (planner-created; clean at start).
- Branch: `work/actor-scope-c01`.
- Accepted base: `a4dcd0613ff807f8b76b55d184742c090701328e` (`origin/main`).
- Implementation candidate: `b2a1598f` (handoff doc adds one docs-only commit on top).
- Risk tier: MEDIUM source. **No deployment, no shared-runtime action, no live/browser claims**
  (Tailnet was down; no browser evidence was produced).

## Objective

Close actor-school/year scope end to end: remove `schoolId = 1` defaults from
actor/tenant-sensitive helpers, bind every authenticated consumer to the
token-epoch actor school, and gate the three server runtime READ routes on an
explicit actor school.

## Provisioning notes

- `npm ci` (root), `npm ci --prefix atlas-server`, `npm ci --prefix atlas-client`,
  `npx prisma generate --schema ..\prisma\schema.prisma`.
- Copied `atlas-server\.env` from `integration-rrtc01r-20260912`; never printed or
  committed. Disposable databases only for DB-backed tests; never the configured DB.

## Exact changed paths (26)

Client:
`atlas-client/src/lib/auth.ts`, `atlas-client/src/lib/actor-scope-session.ts` (new),
`atlas-client/src/lib/settings.ts`, `atlas-client/src/lib/enrollpro-public-settings.ts`,
`atlas-client/src/hooks/useDashboardData.ts`, `atlas-client/src/hooks/useTimetableData.ts`,
`atlas-client/src/components/AppShell.tsx`,
`atlas-client/src/components/RoomScheduleOverlay.tsx`,
`atlas-client/src/components/campus-map/CampusMapOverview.tsx`,
`atlas-client/src/components/dashboard/CampusReadinessCard.tsx`,
`atlas-client/src/components/dashboard/RoomSchedulePreview.tsx`,
`atlas-client/src/components/runtime/RolloverGuidanceCard.tsx`,
`atlas-client/src/pages/{Audit,Faculty,FacultyPreferences,FacultyRoomPreferences,MyDashboard,MySchedule,OfficerPreferences,OfficerRoomPreferences,RoomSchedules,Sections,Subjects}.tsx`,
`atlas-client/src/lib/__tests__/actor-scope-session.test.ts` (new).

Server:
`atlas-server/src/routes/runtime.router.ts`,
`atlas-server/src/__tests__/runtime-router-actor-scope.test.ts` (new).

## Shared mechanism

`atlas-client/src/lib/actor-scope-session.ts`:
`runActorScoped`, `isActorScopeCurrent`, `loadActorYearContext`,
`loadActorRolloverStatus`, `loadActorRecoveryClassification`,
`loadActorArchivePreview`, and `useActorSchoolScope()` (immediate synchronous
`null` on every token mutation, then re-resolve/rebind in place; `retry` and
`epochVersion`/`token` exposed).

`atlas-client/src/lib/auth.ts`: monotonic token-epoch version + subscription.
`getAtlasTokenEpochVersion()` / `subscribeAtlasTokenEpoch()`; notification on
every `setLocalToken` / `setBridgeToken` / `clearLocalToken` / `clearBridgeToken`
(so `clearAtlasAuthStorage` and `expireAtlasSession` notify transitively).

## Caller-closure matrix (helper → caller → classification → school source → proof)

| Helper (default removed) | Production callers | Classification | School source | Proof |
|---|---|---|---|---|
| `resolveActiveSchoolYearContext` | Subjects, Audit, MyDashboard, MySchedule, FacultyPreferences, FacultyRoomPreferences, OfficerPreferences, OfficerRoomPreferences, RoomSchedules, Faculty, Sections, useTimetableData, AppShell, RoomScheduleOverlay, CampusMapOverview, CampusReadinessCard, RoomSchedulePreview, useTeachingLoadData | Authenticated actor-scoped | `useActorSchoolScope()` / `resolveActorSchoolId()` | `npx tsc --noEmit` now errors on every omitted caller; `actor-scope-session.test.ts` `loadActorYearContext` row; probes below |
| `promoteActiveSchoolYearContext` | Faculty (`:289`), Sections (`:298`) | Authenticated actor-scoped | resolved actor school | `tsc`; `term-authority-actor-scope.test.ts` production-caller guard |
| `fetchAtlasRuntimeContext` | `enrollpro-public-settings.ts` (internal) | Actor-scoped (delegated) | explicit `schoolId` arg | `tsc` + `loadActorYearContext` row |
| `fetchRolloverStatus` | `loadActorRolloverStatus`; `RolloverGuidanceCard` (`schoolId` prop); `actor-school-session-epoch.test.ts` | Actor-scoped | resolved actor / explicit prop | `actor-scope-session.test.ts` A/B + late-response rows; epoch suite S4 |
| `previewRolloverSync`, `applyRolloverSync`, `applyTestYearRecovery`, `previewArchiveAndSync`, `applyArchiveAndSync`, `fetchRecoveryClassification` | `RolloverGuidanceCard` (explicit `schoolId` prop; `ActorScopedRolloverGuidanceCard` fail-closed wrapper) | Actor-scoped | resolved actor / explicit prop | `tsc`; `term-authority-actor-scope.test.ts`; `loadActorArchivePreview` A/B row |
| `resetDummyRolloverYear` | `RolloverResetPanel` (explicit `schoolId` prop) | Actor-scoped | explicit prop | `tsc` |

Server read boundary: `GET /context` (any authenticated same-school role),
`GET /rollover-status` and `GET /rollover-recovery/classify` (JWT privileged
operator, or system token with explicit school) — see requirement table.

## Requirement → production path → negative control → verification

| # | Requirement | Production path | Negative control | Verification | Status |
|---|---|---|---|---|---|
| 1 | No `schoolId = 1` default in scoped helpers | `settings.ts`/`enrollpro-public-settings.ts` | omit arg → `tsc` fails | `npx tsc --noEmit` (client) | PASS |
| 2 | Unresolved session → unresolved + zero dispatch | `runActorScoped`, `useActorSchoolScope` | no token | `actor-scope-session.test.ts` row 1 | PASS |
| 3 | Invalid actor school ids fail closed | `resolveActorSchoolId` via `runActorScoped` | `0,-4,1.5,'2',null,undefined` | `actor-scope-session.test.ts` row 2 | PASS |
| 4 | A→B re-login: all scoped requests use school 2/token B, none school 1 | `loadActorRolloverStatus`, `loadActorArchivePreview` | same-tab re-login | `actor-scope-session.test.ts` row 4 | PASS |
| 5 | Late A response discarded (both orderings) | `runActorScoped` + `resolveActorSchoolId` | deferred `/auth/me` A | `actor-scope-session.test.ts` row 6 | PASS |
| 6 | Epoch notified synchronously on every mutation, unsubscribes cleanly | `auth.ts` epoch | set/set/clear | `actor-scope-session.test.ts` row 7 | PASS |
| 7 | Dashboard immediate-null + clear on epoch change | `useDashboardData.ts` subscription | mirror unmounted epoch change | `npx tsc`; `dashboard-lifecycle-truth.test.ts` | PASS |
| 8 | Shell rebinds on epoch change, clears year state, re-verifies | `AppShell.tsx` | token mutation | `npx tsc`; `npm run build` | PASS |
| 9 | Timetable uses canonical resolver, not direct `/auth/me`; explicit school; late discard | `useTimetableData.ts` `fetchSchoolYear` | `resolvedSchoolIdRef` mismatch | `npx tsc` (no `/auth/me` remains) | PASS |
| 10 | Rollover card clears terminal state on school change; wrapper drops to null on epoch | `RolloverGuidanceCard.tsx` | school change | `npx tsc`; `term-authority-actor-scope.test.ts` | PASS |
| 11 | Server: malformed schoolId → 400 before dispatch | `runtime.router.ts` `authorizeRuntimeRead` | `missing,'' ,'abc',0,-1,1.5` × 3 routes | `runtime-router-actor-scope.test.ts` | PASS |
| 12 | Server: JWT missing actor school → 403 SCHOOL_SCOPE_REQUIRED, zero dispatch | same | actor without `schoolId` | same | PASS |
| 13 | Server: cross-school JWT → 403 CROSS_SCHOOL_DENIED, zero dispatch | same | school 99 → school 1 | same | PASS |
| 14 | Server: system token explicit school allowed; omitted never defaults | same | system token valid vs missing | same (disposable DB positive + 400) | PASS |
| 15 | Server: operator routes reject non-privileged JWT; `/context` allows faculty | same | faculty token | same | PASS |
| 16 | Mutant control: reintroduce gate default fails decisively | `parseStrictSchoolId` → `return 1` | missing schoolId | negative test failed `got 500/UNHANDLED`; restored green | PASS |
| 17 | Preserved client controls unchanged | `actor-school-session-epoch.test.ts` (9), `term-authority-actor-scope.test.ts` (8), `active-school-year-scope.test.ts`, `dashboard-lifecycle-truth.test.ts` | n/a | 38/38 pass | PASS |
| 18 | Preserved server disposable suite unchanged | `term-cache-catchup-rrtc01.test.ts` | its `/rollover-status` privileged same-school call | 1/1 pass | PASS |

No row is BLOCKED or DEFERRED.

## Commands actually run (results)

- Client `npx tsc --noEmit` → 0 errors (before commit 2 and again before final gates).
- Client `npm run build` → `✓ built in 7.80s`, exit 0.
- Client focused: `npx tsx --test actor-school-session-epoch.test.ts term-authority-actor-scope.test.ts active-school-year-scope.test.ts dashboard-lifecycle-truth.test.ts` → **38 pass / 0 fail**.
- Client new: `npx tsx --test src/lib/__tests__/actor-scope-session.test.ts` → **8 pass / 0 fail**.
- Server `npm run build` → exit 0.
- Server new: `npx tsx --test src/__tests__/runtime-router-actor-scope.test.ts` → **2 pass / 0 fail** (disposable PostgreSQL created/migrated/dropped, zero residue; negative matrix asserts zero DB ops + zero upstream requests per rejection).
- Server preserved: `npx tsx --test src/__tests__/term-cache-catchup-rrtc01.test.ts` → **1 pass / 0 fail**.
- Isolated built server: `node dist/server.js` with `PORT=5099 ROLLOVER_AUTO_SYNC_ENABLED=false` → `/api/v1/health` 200 `{"status":"ok","service":"atlas"}`, process alive after 2s, stopped only that PID (35460).
- `git diff --check a4dcd061..HEAD` → clean.

## Mutant-control record

1. MUTANT: `runtime.router.ts` `parseStrictSchoolId` — `return null` → `return 1` for missing/empty.
2. RESULT: `runtime-router-actor-scope.test.ts` failed decisively: `/context system token schoolId missing -> 400 (got 500/UNHANDLED)` (a default silently dispatched the service).
3. RESTORE: `git checkout -- atlas-server/src/routes/runtime.router.ts` (byte restore to committed candidate).
4. RE-VERIFY: suite green again (2/2); `git status` clean.

## Observation backlog (non-blocking, NOT touched)

These files still contain a module-level `DEFAULT_SCHOOL_ID = 1` pilot constant and were
explicitly out of this packet's owned scope:

- `atlas-client/src/pages/MapEditor.tsx`
- `atlas-client/src/pages/MapView.tsx`
- `atlas-client/src/pages/PublicPublishedSchedule.tsx` (public school-scoped by contract)
- `atlas-client/src/pages/SpecializationMapping.tsx`
- `atlas-client/src/components/faculty/CreatePlaceholderDialog.tsx`
- `atlas-client/src/lib/coverage.ts`

Recommend a separate bounded stream to classify each as intentional public scope
or convert to actor scope.

## Known risks

- The in-scope pages (`Faculty`, `Sections`, `FacultyRoomPreferences`,
  `OfficerPreferences`, `OfficerRoomPreferences`, `RoomSchedules`, `Audit`,
  `MyDashboard`, `MySchedule`) now bind their `resolveActiveSchoolYearContext`
  calls, cache keys, SSE/stream URLs, and scoped reads/mutations to the resolved
  actor school where the scope was threaded. A small number of pre-existing
  helper calls remain parameterized by the resolved local value inside their
  function; all such functions early-return when `actorSchoolId == null`, so no
  scoped dispatch occurs while unresolved.
- JSX child props that require a `number` receive `actorSchoolId ?? 0`; those
  children only render once a school-year is resolved, and their handlers also
  early-return on unresolved scope, so `0` is never dispatched.
- The packet named suites `runtime-context-active-term.test.ts`,
  `runtime-context-priority.test.ts`, `system-token-auth.test.ts`, and
  `faculty-route-restrictions.test.ts`; those files do not exist at this base
  (searched `atlas-server/src/**`). The affected runtime route is covered by the
  new mounted suite and by `term-cache-catchup-rrtc01.test.ts`.
- No live/browser acceptance was possible (Tailnet down); no runtime claims made.

## CORRECTION ROUND 1 (F1 + F2)

Fresh independent QA reviewed `a4dcd061...42faf6a7` and returned
`CORRECTION_REQUIRED` with two in-scope blocking defects. Additive correction
commits: `db381da3` (F1 + F2) and a whitespace-only follow-up. Pre-correction
QA tip: `42faf6a7`. The full range remains `a4dcd061..<new tip>`.

### F1 — Sections must never dispatch scoped requests with school 0

- `Sections.tsx`: `const scopedSchoolId = isResolvedActorSchoolId(actorSchoolId) ? actorSchoolId : null;`
  is now the only school passed to children. The four child consumers
  (`SectionMobileCard`, `SectionRow`, `SectionRoomMapModal`,
  `HomeRoomAutoAssignDialog`) render ONLY when `scopedSchoolId != null`; never `0`.
- On actor-school change (including unresolved) an effect clears
  `activeSchoolYearId`, `detailTarget`, and closes `globalBrowseModalOpen` /
  `autoAssignOpen`, so no child survives across a scope change.
- Defense in depth:
  - `SectionRoomMapModal.tsx` exports `fetchSectionRoomMapBuildings(schoolId)`,
    which returns `null` for any non-strict-positive school (zero dispatch); the
    modal uses it and the load effect also requires `schoolId > 0`.
  - `HomeRoomAutoAssignDialog.tsx` exports `requestHomeRoomAutoAssign(...)`,
    which returns `null` for a non-positive school/school-year (zero dispatch);
    preview, apply, and the open effect all guard on valid scope.
  - `SectionRoomPicker.tsx` renders the map modal only when `schoolId > 0`.
- Sweep: the only remaining `?? 0` in the section files is a display count
  (`result?.counts.assigned ?? 0`), not a dispatch.

### F2 — MyDashboard / MySchedule late session-A responses

- Both pages capture `getPreferredAccessToken()` + `getAtlasTokenEpochVersion()`
  before any await and re-check after every await; effect-local `loadSeqRef`
  cancellation increments on actor-school change / unmount.
- The scope-gated network reads now route through the shared, tested
  `runActorScoped` mechanism via exported production functions:
  - `MyDashboard.tsx` → `loadMyDashboardScoped(schoolId, schoolYearId)` returns
    `ok | discarded | unresolved`; the component applies state only on `ok`.
  - `MySchedule.tsx` → `loadMyScheduleScoped(schoolId, schoolYearId, facultyId, requestDate)`
    returns the payload or `null`; the component applies state only on non-null.
- A late A response resolves to `discarded`/`null` in both orderings and is
  never applied; offline-cache fallbacks are also gated on the captured epoch.

### Failing-first record (execution)

With the production fix stashed (`git stash push -m actor-scope-c01-correction-f1f2`)
and HEAD at the QA tip `42faf6a7`, the new control suites were run and FAILED:

```
npx tsx --test src/lib/__tests__/section-scope-dispatch.test.ts src/lib/__tests__/session-scope-late-discard.test.ts
  SyntaxError: The requested module '@/components/sections/SectionRoomMapModal' does not provide an export named 'fetchSectionRoomMapBuildings'
  SyntaxError: The requested module '@/pages/MyDashboard' does not provide an export named 'loadMyDashboardScoped'
  tests 2 / pass 0 / fail 2
```

The old code dispatched unconditionally (the old `SectionRoomMapModal.loadMapData`
and `HomeRoomAutoAssignDialog.fetchPreview` called `atlasApi` with whatever
`schoolId` was passed, and `MyDashboard`/`MySchedule` applied post-await state
with no epoch re-check) — confirmed by inspection of `42faf6a7`. After
`git stash pop`, the same suites pass 9/9.

### Correction commit list (additive)

- `db381da3` — fix(scope): fail closed on unresolved sections scope and discard late session responses.
- `<tip>` — docs(scope): record actor-scope-c01 correction round 1 (this section).

### Gates rerun (all green)

- Client `npx tsc --noEmit` → 0 errors.
- Client `npm run build` → `✓ built in 4.50s`, exit 0.
- Client focused (52/52): `actor-school-session-epoch`, `actor-scope-session`,
  `term-authority-actor-scope`, `dashboard-lifecycle-truth`,
  `section-scope-dispatch` (4), `session-scope-late-discard` (5).
- Server `npm run build` → exit 0.
- Server `runtime-router-actor-scope.test.ts` → 2/2; `term-cache-catchup-rrtc01.test.ts` → 1/1 (disposable).
- `git diff --check a4dcd061..HEAD` → clean; worktree clean after commit.

### Forbidden-scope statement

Only the allowed paths changed: `Sections.tsx`, section child components that
receive/pass `schoolId` (`SectionRoomMapModal`, `HomeRoomAutoAssignDialog`,
`SectionRoomPicker`), `MyDashboard.tsx`, `MySchedule.tsx`, and two new client
test files. `actor-scope-session.ts` and the server were not touched in this
round. No `?? 1`/`|| 1` fallback was introduced; no non-listed residual was changed.
