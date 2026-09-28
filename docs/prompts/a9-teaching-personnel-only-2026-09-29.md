# A9 packet — fetch TEACHING personnel only from EnrollPro (operator 2026-09-29)

Fresh session, new small lane A9. Source of truth: `docs/reference/enrollpro-teaching-personnel-api-2026-09-29.md`
(EnrollPro contract, reviewed 2026-09-29). ATLAS must request `?personnelType=TEACHING` on the faculty feed; without it
EnrollPro returns non-teaching staff too. Live proof: faculty_mirrors id 3 Melchora Aquino (ext 3), 20 Apolinario Mabini
(ext 2), 33 Jose Rizal (ext 1) are non-teaching personnel, have no department, and are counted as active teachers in
S.Y. 2022-2023 (23 "teachers" = 20 real + 3 non-teaching; Faculty shows 20). Lane C's temporary department injection on
them was reverted at 01:50 (live-state.md). They have 0 ownerships in year 1; old years 8-10 keep history (do not delete).

1. Every EnrollPro faculty fetch (`/api/integration/v1/default/faculty`, `/api/integration/v1/faculty`, alias
   `/teachers`) sends `personnelType=TEACHING`. Find all call sites (server; also any client/companion fetch).
2. After a sync, mirrors no longer in the feed are marked stale/inactive by the existing path — verify with a test that a
   NON-TEACHING row present before is inactive after, keeps its history, and is not counted in capacity, Teaching Load,
   Faculty, generation readiness or the 23-vs-20 count.
3. Tests failing-first (URL carries the param; non-teaching excluded). Server suite green. atlas-qa MEDIUM.
4. Do NOT touch live data. After release, Lane C runs Sync now with the operator and verifies the 3 go inactive.
Push to main; post ready-for-release. Do not end the run to wait for Lane C.
