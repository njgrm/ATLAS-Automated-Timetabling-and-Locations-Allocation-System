# DUP-READ-DIAGNOSIS-C01 — findings (read-only, no source changed)

Base `5ce47f60`. Live runtime during probing: release `434b2a81` (server PID 74212:5001, host PID 90380:5174, state `running`). Source below is read at base `5ce47f60`; if the live release drifts from base, caller line numbers may shift but the mechanisms cited are structural.

## 1. Which callers double-fetch — StrictMode ruled out (measured)

`main.tsx:14` keeps `<React.StrictMode>`, but StrictMode double-invokes effects **only in development builds**. The live host serves the production `atlas-client/dist` on 5174 and refuses a dev tree (`ops/runtime/lib/production-host.mjs:74-86` `assertProductionArtifact`). The duplicates were observed on that production build, so **(c) is ruled out**. `atlasApi` (`lib/api.ts`, 20 lines) has no retry/caching interceptor, so it cannot self-duplicate either.

- **`/auth/me` ×2 (measured code, inferred count on a load): (a) two distinct mechanisms, no shared result.** `resolveActorSchoolId` (`lib/settings.ts:463-505`) has **no in-flight sharing**: concurrent callers while the cache is cold each dispatch. Concurrent resolvers on one load: `AppShell` session verify (`AppShell.tsx:348-383` → `verifySessionToken`, `settings.ts:788-849`, itself up to 2 dispatches: local-token attempt `:797` then bridge attempt `:826`) plus `useActorSchoolScope` (`lib/actor-scope-session.ts:126-186` → `:149`), plus per-route resolvers (`useTimetableData.ts:1151`, `useDashboardData.ts:398/418`, `timetablePrefetch.ts:111`, `RolloverGuidanceCard.tsx:88`). Any two racing = 2+ identical GETs.
- **`runtime/context` ×4 (measured code): (a)+(d).** `resolveActiveSchoolYearContext` dedups concurrent calls via `inflightBySchool` **except** `forceRefresh:true` bypasses it (`lib/enrollpro-public-settings.ts:231-241`). Bypass callers: `AppShell.verifyActiveSchoolYear` (`AppShell.tsx:169-201`, `forceRefresh`+`verifyUpstream`) and the `useTimetableData` stale-follow-up (`useTimetableData.ts:1175-1190`). The same hook also fires `preferCache`+`backgroundRefresh` (`:1161-1169` → background HTTP even on a cache hit) and then the forceRefresh follow-up when `source==='cache'||stale` — **2 HTTP from this hook alone on a warm-cache load**, plus AppShell's, plus prefetch (`timetablePrefetch.ts:111-113`).
- **`rollover-status` ×2-3 (measured code): (a), no dedup anywhere.** `fetchRolloverStatus` (`settings.ts:528-534`) is raw axios per call; each mounted `RolloverGuidanceCard` loads once (`RolloverGuidanceCard.tsx:244-248`). The Timetable route can mount two cards at once (review header `:766` in `ScheduleReviewWorkspaceHeader.tsx` + `SimpleDriftBanner:200` in `simple/SimpleDriftBanner.tsx`, rendered by both `TimetableSetupPane.tsx:167` and `TimetableSimpleHeader.tsx:521`).
- **502 routes have single owners (measured):** `manual-edits` GET only via `fetchEditHistory` (`useTimetableMutations.ts:857-865`, initial load from `useScheduleReviewWorkspaceState.ts:1508`); `flags` GET only via `ensureTimetableFollowUps` (`timetableServerState.ts:122-131`, TanStack-deduped by key, `retry:1` on failure only). No duplicate mechanism exists for either.

## 2. Avoidable per caller (inferred from the code above; behaviour-preserving)

- `/auth/me`: share one in-flight promise per token epoch in `resolveActorSchoolId` (same pattern as `inflightBySchool`). **1 file** (`settings.ts`); optionally unify `verifySessionToken` with the same epoch cache (**+`AppShell.tsx`**).
- `runtime/context`: make `forceRefresh` join (not bypass) in-flight work or drop the `:1175` follow-up when the background refresh already covers it. **2-3 files** (`enrollpro-public-settings.ts`, `useTimetableData.ts`, `AppShell.tsx`).
- `rollover-status`: module-level in-flight map or one shared status hook. **1-2 files** (`RolloverGuidanceCard.tsx` + hook) without touching the 6 mounting pages.

## 3. What produces the 502s — layer NOT proven; server unlikely, proxy possible (measured + inferred)

- **40/40 unauthenticated probes 401, never 502** (10 reps × 2 routes × 2 layers; host 5174 and direct 5001; max 106 ms, means 1-12 ms). Routes exist; auth middleware answers fast. **Could not reproduce without a login (out of scope), so this is a clean non-reproduction, not an exoneration.**
- **Supervisor log scan: 0 matches** for `502|UPSTREAM|manual-edits|follow-up-flags|error` across the whole active `atlas-supervisor.log` (only scheduler info lines). No proxy `UPSTREAM_UNREACHABLE` and no server 5xx line for the window.
- **Server almost certainly cannot emit a 502 on these two routes (measured):** neither handler sets 502 (`manual-edit.router.ts:203-223`, `follow-up-flag.router.ts:17-40`; both `next(err)` → `errorHandler`, which relays `err.statusCode ?? 500`). The only `serviceError(502)` sources are EnrollPro paths (`enrollpro-rollover.service.ts:295/346`, cohort/faculty routers) unreachable from these handlers, which are local-DB reads.
- **Proxy has two distinct 502 shapes (measured, `production-host.mjs:163-197`):** upstream connection error → typed `UPSTREAM_UNREACHABLE` JSON; otherwise the upstream status is relayed verbatim. **Inference:** a typed 502 with `code:UPSTREAM_UNREACHABLE` = host-side connection blip; a typed 502 with another code = server-relayed; a bare 502 with no JSON = neither (client abort or infra). **The UX lane must record the response bodies** — that single field settles the layer.

## 4. Do they interact (measured sample + inference)

The 2 browser samples show duplicates and 502s on **disjoint endpoint sets**, and my 40 sequential probes produced 0 502s. The 502 routes have single owners (§1), so duplicates cannot precede a 502 on the same endpoint by construction. **Inferred: independent.** Caveat: sequential unauthenticated probes cannot test duplicate→502 concurrency; a concurrent authenticated replay (needs login) would be the falsifier.

## 5. Recommendation: fix the named callers (narrow)

- **Do:** (i) in-flight-share `resolveActorSchoolId` per token epoch; (ii) stop `forceRefresh` bypassing `inflightBySchool` / remove the redundant `:1175` follow-up; (iii) share in-flight `rollover-status` per school. Blast radius: 3-4 client files, read-path only, no server/host/data change. Verify: instrumented clean-load request counts (context ≤2 with verify, rollover-status 1/card, auth/me 1/epoch), plus existing suites (`actor-school-session-epoch`, `actor-scope-session`, timetable data-layer tests).
- **Do not:** coalesce in `atlasApi` (touches every API call); fix the host proxy or server routes (no evidence either emits these 502s); add retry (TanStack `retry:1` already covers only query-cache reads).
- **For the 502s: no fix yet.** Ask the browser lane to capture one failing response's exact status/body/headers; if `UPSTREAM_UNREACHABLE`, investigate transient server unavailability during generation load (the log shows a full scheduler sweep at 02:15-02:16Z); anything else re-opens this diagnosis with a login-authorized replay.
