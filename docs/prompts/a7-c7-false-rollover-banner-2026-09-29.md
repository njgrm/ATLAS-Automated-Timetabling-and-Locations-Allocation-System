# A7 packet c7 — DEMO BLOCKER: false "School year changed" banner on live

Issued by Lane C, 13:20. Start right after the palette-pins job. New branch/worktree from the main tip. Risk MEDIUM
(client). Deadline: on main by **15:30** (train 10). Browser proof with REAL staging data (staging QA login).

## What the operator saw on live `3216d383` (Tailnet)
"School year changed to **2029-2030**. **2022-2023** is archived and read-only. This page refreshed with the new
active year." — EnrollPro did NOT roll over.

## Facts Lane C measured (13:15)
- Live DB `enrollpro_school_year_mirrors`: row **id 564, ext 1, 2022-2023, active**; row **id 1, ext 8, 2029-2030,
  archived**. Nothing changed today.
- `/api/v1/runtime/context?schoolId=1&verifyUpstream=true` (staging, same build) returns `activeSchoolYearId: 1`,
  label `2022-2023`, source `enrollpro-verified`, term `T1` — i.e. an **EnrollPro** id. ATLAS mirror **row id 1** is
  **2029-2030**. Suspected id-space collision: some path puts a mirror row id (or an EnrollPro id) into
  `runtimeYearRef` / `evaluateRolloverTransition` (`components/AppShell.tsx:167-200`, `lib/rollover-awareness.ts`),
  or resolves the label for id 1 from the mirror table. Candidates: the past-year "Open timetable" link
  (A7 c3), Year Setup, Teaching Load history, any `?schoolYearId=` route.
- The notice is persisted in localStorage with a **14-day TTL** (`ROLLOVER_NOTICE_TTL_MS`) and re-shown on every load.

## Fix
1. Find the exact path that produced previous=2022-2023 -> next=2029-2030; fix the id space at the source.
2. A transition notice may only be raised when the server itself reports a different active year **and** the new
   year is active and not archived; an archived year can never become "the new active year".
3. Stale/invalid persisted notices are dropped on load (e.g. the named active year is archived, or it disagrees with
   the verified context). Operators with the bad notice already saved must stop seeing it after the fix ships.
4. Regression test for each path found.

## Addendum 13:35 — School Year Setup, same family (operator asked to check it)
`/api/v1/runtime/rollover-status?schoolId=1` on staging (same build, DB copied from live):
- `atlasSchoolYearId: 1` while the mirror row for 2022-2023 is **id 564** and row id 1 is 2029-2030 — the same id-space
  mix-up; name every field that means "EnrollPro year id" vs "ATLAS mirror row id" and fix the misnamed ones.
- `schoolYears` lists **2031-2032, 2030-2031** as "past, not yet kept" and 2029-2030 archived. These are leftover
  rollover-drill years (created 09-10 / 09-17), not real history, and future-dated labels shown as "past" confuse a
  scheduler. Show them as test years (there is `/runtime/rollover-recovery/mark-test-data`; a live write needs Lane C's
  go with a backup) or hide years whose label is later than the active year; your call, state it.
- Verify the Year Setup page shows 2022-2023 as the one active year with no false change message.
- The operator plans an EnrollPro rollover soon. After your fix, a real change must produce a correct banner
  (new year active, old year archived), exactly once.
