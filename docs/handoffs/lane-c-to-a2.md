# Lane C → A2: QA results and instructions (single channel)

**A2: read this file at the start of every cycle and before every integration or release.** Lane C (Claude
Code, system UX QA) posts every verdict and instruction for timetable work **here**, newest first. Each
entry says what to do, the priority, and where the evidence is. When you act on an entry, add
`**A2 ack:** <commit or decision>` under it. Do not delete entries; mark them `CLOSED <sha>` instead.

Operator rulings that bind both lanes (2026-09-26):
- **Live holds only test data.** QA commits, publishes and regenerates through the UI to find bugs, so live
  state can change under you. Lane C posts here whenever it publishes or regenerates.
- The timetable takes precedence. Room Schedules is unfinished and will be redesigned later.
- **E: capacity** (`AGENTS.md` §3): warn below 25 GiB, fail closed below 15 GiB, the same as D:. No reclaim is
  owed at ~49.8 GiB.

---

## 2026-09-26 22:xx — Capacity threshold changed (operator): a release build may start

`E:` now **warns below 25 GiB and fails closed below 15 GiB** (`AGENTS.md` §3, `6404c213`). At the recorded
49.80 GiB **no reclaim is owed**. Update your Capacity section, and measure before each build as before.

## 2026-09-26 22:xx — Priority order for your next candidates (Lane C recommendation)

1. **BLOCKING — "Change room" crashes `/timetable`** ("Cannot read properties of undefined (reading 'length')",
   `ManualEditPanel` chunk; first suspect `aa7f6f67`). Evidence:
   `docs/reviews/timetable-manual-controls-20260926/findings.md` #1.
2. **HIGH — public default term** (your A3): the server returns a verified Term 1 while Term 2 is active.
   Handoff §10a.
3. **HIGH — the daily-load cap preview** ("11.3h (max 8h)" on a same-day swap), probably summed across terms.
   It is also labelled "Safe to review" under "Must fix". Findings #2.
4. **HIGH — "Change owner"** lands on Teaching Load showing a different teacher. Findings #3.
5. **HIGH — "Use Exceptions for in-term changes"** (dashboard) points at nothing. Findings #4.
6. Then your items 2–3 (lifecycle wiring; one label per code).

## 2026-09-26 22:xx — Inventory received; Lane C verification plan (FYI)

`docs/reviews/timetable-control-inventory-2026-09-26.md` (296 rows) is the shared checklist. Lane C runs
§16a/§16a-bis live, in chunks, **with commits allowed**, and posts each chunk here as `row → matches / differs —
release lag / differs — live defect`. Order: (1) the committed manual-edit run in progress; (2) publish run
318 + post-publish change + new version; (3) §16a in chunks, starting with rows 248, 260, 266 and 249.
§16b-1 (public `source.termIndex`) and §16b-2 (acceptance of `0da104f9`) are **done**: handoff §10a/§10b.
