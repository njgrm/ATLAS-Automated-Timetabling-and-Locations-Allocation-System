# Phase 3 Offline Capability And Outage UI Audit - 2026-05-25

## Scope

This audit checks current ATLAS outage readiness against the offline-first objective:

- ATLAS should remain usable when EnrollPro is down, as long as ATLAS has already synced the required school data at least once.
- Pages should communicate source state honestly and in plain language.
- Cached or mirrored data should not be presented as if it were freshly verified from EnrollPro.

This audit covers the current scheduler/faculty route inventory in the live Tailnet environment and the client/runtime code paths that decide whether a page can reopen from ATLAS-owned data.

## Method

- Live Tailnet probes against `https://njgrm.buru-degree.ts.net`
- Current client bootstrap review in `atlas-client/src/pages`, `atlas-client/src/components`, and `atlas-client/src/hooks`
- Runtime ownership review in `docs/reference/atlas-runtime-source-of-truth-map.md`

Important context:

- During this audit, EnrollPro was reachable again.
- That means current outage conclusions are based on:
  - the live contracts that ATLAS now exposes
  - the page bootstrap code that would run when EnrollPro is unavailable
  - prior degraded-mode behavior already verified during recent outage testing

## Executive Verdict

ATLAS is not yet offline-first across the full product surface.

The current state is mixed:

- `Teachers`, `Teaching Load`, `Sections`, `Subjects`, `Dashboard`, and `Audit` now have real ATLAS-side continuity foundations.
- `Teaching Load` is the most advanced degraded surface.
- `Sections` has improved but still falls short of full offline workflow parity.
- `Timetable`, `Room Schedules`, both preference portals, both room-request portals, and the faculty dashboard still contain direct EnrollPro bootstrap points.
- The shell still depends on EnrollPro for school branding and can still show weak fallback wording when branding/year metadata is missing.

So the system is no longer fully blocked by EnrollPro, but it is still too dependent on EnrollPro to claim the offline/PWA objective is complete.

## Live Snapshot

Current live Tailnet probes during this audit:

- `GET /api/v1/runtime/context?schoolId=1`
  - `activeSchoolYearId=55`
  - `activeSchoolYearLabel="2026-2027"`
  - `source="enrollpro-verified"`
- `GET /api/v1/sections/summary/55?schoolId=1`
  - `source="atlas-mirror"`
  - `totalSections=82`
- `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55`
  - `assignedPairs=843`
  - `rawAssignedPairs=843`
  - `unassignedPairs=119`
- `POST /api/v1/faculty-assignments/report/staffing-needs`
  - `sectionSource="cached-enrollpro"`
  - `sectionFallbackReason="atlas-mirror-preferred-runtime-control"`
- `POST /api/v1/faculty-assignments/auto-fill`
  - `sectionSource="cached-enrollpro"`
  - `sectionFallbackReason="atlas-mirror-preferred-runtime-control"`

This confirms the central runtime truth:

- ATLAS already has enough persisted section and teaching-load evidence to keep some scheduler controls alive without waiting on EnrollPro.
- But several page entry points still do not use that local evidence first.

## Objective Status

| Objective Slice | Status | Notes |
|---|---|---|
| Active school-year continuity | Partial | `runtime/context` now exists and works, but many pages still bypass it. |
| Branding continuity | No | School name/logo still come from EnrollPro settings, not durable ATLAS-owned cache. |
| Scheduler read continuity | Partial | `Teachers`, `Teaching Load`, `Sections`, and `Audit` are materially better. |
| Scheduler write continuity | Partial | `Teaching Load` supports degraded writes in some cases; `Sections` still lags; other pages do not. |
| Faculty self-service continuity | No | Preferences, room requests, and dashboard still bootstrap from EnrollPro settings. |
| Timetable review continuity | No | Review workspace still bootstraps from `fetchPublicSettings()`. |
| Honest outage messaging | Partial | Some pages improved; wording is still inconsistent and too technical. |
| Plain-language outage copy | No | Terms like `ATLAS Mirror`, `Cached snapshot`, and `Live upstream-backed` are not layman-friendly. |

## Route Matrix

| Route | Current Bootstrap | Can Open Without EnrollPro? | Can Work From ATLAS-Owned Data? | Current Messaging Verdict |
|---|---|---|---|---|
| `/login` | `fetchPublicSettings()` for branding; local auth for login | Yes, but branding degrades | Login itself can work | Messaging is acceptable, but school identity is still upstream-dependent. |
| `/` dashboard | Mostly ATLAS APIs plus `resolveActiveSchoolYearContext()` | Mostly yes | Read-only dashboard value is good | No explicit outage/source-state explanation. |
| `/subjects` | ATLAS subjects + `resolveActiveSchoolYearContext()` only for coverage school-year | Yes | Yes for normal catalog work | No source-state badge; outage mode is not explained at all. |
| `/teachers` | `resolveActiveSchoolYearContext()` + cached teaching-load summary | Yes | Read continuity is good | `Live data` / `Cached snapshot` is still too technical and can still overstate freshness. |
| `/teaching-load` | `resolveActiveSchoolYearContext()` + cached summary/subjects/sections | Yes | Best current degraded workflow; partial write support | Improved, but still technical. Outage explanation is better than other pages. |
| `/sections` | `resolveActiveSchoolYearContext()` + cached summary/home-room data | Yes | Read continuity is real; write parity still incomplete | More honest than before, but `ATLAS Mirror` is not plain language. |
| `/audit` | `resolveActiveSchoolYearContext()` + partial degraded reads | Yes | Yes for partial diagnostics | Honesty is decent; still too technical for non-technical users. |
| `/timetable` | `fetchPublicSettings()` through `useTimetableData` | No reliable degraded bootstrap | Not yet | Too dependent on EnrollPro to satisfy outage objective. |
| `/room-schedules` | `fetchPublicSettings()` | No reliable degraded bootstrap | Not yet | No meaningful degraded explanation. |
| `/map` | ATLAS-owned map data | Yes | Yes | No outage explanation needed beyond shell branding. |
| `/faculty/preferences` | `fetchPublicSettings()` + `fetchSchoolYears()` | No reliable degraded bootstrap | Not yet | Offline submission language exists, but page bootstrap still depends on EnrollPro. |
| `/my/preferences` | `fetchPublicSettings()` + `fetchSchoolYears()` | No reliable degraded bootstrap | Not yet | Same contradiction: some offline language, but first load still depends on EnrollPro. |
| `/faculty/room-preferences` | `fetchPublicSettings()` + `fetchSchoolYears()` | No reliable degraded bootstrap | Partial local outbox exists, but bootstrap still blocks | Current UX overpromises offline ability relative to bootstrap reality. |
| `/my/room-preferences` | `fetchPublicSettings()` + `fetchSchoolYears()` | No reliable degraded bootstrap | Partial outbox exists after load | Same core contradiction as officer/faculty preferences. |
| `/my` faculty dashboard | `fetchPublicSettings()` + `fetchSchoolYears()` | No reliable degraded bootstrap | Not yet | Error states are fine, but no degraded continuity path. |
| Shell / sidebar | `resolveActiveSchoolYearContext()` plus `fetchPublicSettings()` | Partially | Year can survive; branding cannot | `No Active Year` is not enough explanation when upstream branding is down. |

## Direct EnrollPro Bootstrap Hotspots

Pages and shared modules still calling `fetchPublicSettings()` directly:

- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/components/RoomScheduleOverlay.tsx`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/pages/FacultyPreferences.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`
- `atlas-client/src/pages/Login.tsx`
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/pages/OfficerPreferences.tsx`
- `atlas-client/src/pages/OfficerRoomPreferences.tsx`
- `atlas-client/src/pages/RoomSchedules.tsx`

Pages already using `resolveActiveSchoolYearContext()` instead:

- `Dashboard`
- `Subjects`
- `Teachers`
- `Teaching Load`
- `Sections`
- `Audit`
- `AppShell`

This is the clearest current split in the product.

## What Is Working Well

### 1. Runtime context is now real

`/api/v1/runtime/context` is a legitimate ATLAS-side bootstrap contract now. It is the correct path for active-school-year continuity.

### 2. Teaching Load is the strongest degraded page

`Teaching Load` now has:

- cached bootstrap
- degraded source-state handling
- partially enabled degraded write behavior
- local-first section-source behavior for staffing and auto-fill controls

It is still not perfect, but it is currently the best model for outage-capable scheduler work.

### 3. Sections has a real ATLAS mirror model now

The live section summary currently reports `source="atlas-mirror"`, which is exactly the right shape for outage survival.

### 4. Audit now fails more honestly

The audit page no longer needs every upstream dependency to succeed at once. It can load partial evidence and tell the operator what is missing.

## Main Failures

### 1. Shell branding is still not outage-ready

The sidebar school name, logo, and favicon still come from EnrollPro settings. When EnrollPro is down:

- school identity can disappear or go stale
- the shell can look broken even if ATLAS-owned data is still usable

This is one of the most visible remaining product gaps.

### 2. Preference and room-request flows still bootstrap from EnrollPro

Both officer and faculty preference flows still begin with:

- `fetchPublicSettings()`
- sometimes `fetchSchoolYears()`

So even where there is later offline logic or an outbox, the page cannot reliably reach that state if EnrollPro is unavailable during bootstrap.

### 3. Timetable review is still outage-fragile

`useTimetableData.ts` still calls `fetchPublicSettings()` to determine the school year. That keeps the main review workspace tied to EnrollPro availability even when ATLAS already knows the active year.

### 4. Room schedules is still outage-fragile

`RoomSchedules.tsx` still uses `fetchPublicSettings()` as its first bootstrap dependency. It does not yet behave like an ATLAS-owned review surface.

### 5. Sections still does not have full degraded write parity

`Sections` is better than before, but it still does not match the intended “use safely now, sync cleanly later” model as strongly as `Teaching Load`.

## Source-State Copy Audit

Current source-state labels across the app are not yet plain-language enough.

Problem labels still in use:

- `Live data`
- `Cached snapshot`
- `ATLAS Mirror`
- `Live upstream-backed`
- `Connected: Live Data`
- `Review Only: Backup`
- `No Active Year`

These are accurate only for technical readers.

Better plain-language direction:

- `Verified with EnrollPro`
- `Working from saved ATLAS data`
- `Saved data only`
- `School year could not be verified live`
- `You can keep working; changes will sync after EnrollPro returns`
- `You can view saved data, but this action needs a live connection`

The next copy pass should normalize this across:

- shell
- sections
- teachers
- teaching load
- audit
- any future timetable degraded banners

## Page-By-Page Readiness Summary

### Ready enough for degraded read

- `Subjects`
- `Teachers`
- `Teaching Load`
- `Sections`
- `Dashboard`
- `Audit`
- `Map`

### Not ready enough for degraded write

- `Sections`

### Not ready enough for degraded bootstrap

- `Timetable`
- `Room Schedules`
- `Officer Preferences`
- `Faculty Preferences`
- `Officer Room Requests`
- `Faculty Room Requests`
- `My Dashboard`

## Recommended Next Work

### Priority 1 - Shell and bootstrap independence

- Cache school branding and active year display metadata in ATLAS-owned client/runtime continuity.
- Make the shell render a clear saved-data state instead of falling back to weak “No Active Year” semantics.

### Priority 2 - Remove direct EnrollPro bootstrap from scheduler/faculty pages

Replace `fetchPublicSettings()` first-load dependence with:

- `resolveActiveSchoolYearContext()`
- ATLAS-owned persisted page data
- optional EnrollPro refresh/verification after the page is already usable

Targets:

- `useTimetableData.ts`
- `RoomSchedules.tsx`
- `OfficerPreferences.tsx`
- `FacultyPreferences.tsx`
- `OfficerRoomPreferences.tsx`
- `FacultyRoomPreferences.tsx`
- `MyDashboard.tsx`

### Priority 3 - Finish degraded write parity

- Bring `Sections` to the same safe local-write model already emerging in `Teaching Load`.
- Keep destructive or upstream-dependent actions clearly separated from ATLAS-owned local edits.

### Priority 4 - Normalize layman copy

Create one source-state language system across all EnrollPro-dependent pages so users always know:

- whether they are looking at verified live data
- whether they are looking at saved ATLAS data
- whether they can keep working
- whether their work will sync later

## Final Conclusion

ATLAS has made real progress on outage resilience, especially in:

- runtime school-year continuity
- teaching-load continuity
- section mirror continuity
- degraded audit behavior

But the offline/PWA objective is still not complete because too many pages still treat EnrollPro as a required first bootstrap dependency.

The remaining work is now less about raw persistence and more about:

- routing every page through the ATLAS-owned runtime model first
- enabling safe degraded writes where ATLAS owns the data
- speaking plainly about what is live, what is saved, and what will sync later
