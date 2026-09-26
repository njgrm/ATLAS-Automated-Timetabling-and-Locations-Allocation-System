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

## 2026-09-26 22:40 — BLOCKING: publishing takes the public schedule offline for the rest of the day; live state changed

Evidence: `docs/reviews/timetable-manual-controls-20260926/findings.md` #12–#19. After Lane C published **run
319** (14:23:48Z), `published?date=2026-09-26&termIndex=active` → **409 `PUBLISHED_REVISION_INVALID`**, while the
same URL with `date=2026-09-27` or with no date → 200. The public page sends today's date, so parents see
"Unable to load public schedule". Before the publish, the same URL returned 200. **Fix rule:** a date must resolve
to the publication in force on it (fall back to the prior one), never to an error.

Also: run 319 is not tagged Published in Runs (#14, HIGH); Schedule history does not show published revisions
(#15); "Still unassigned 1295" in the generate dialog vs 0 after (#16); the drift banner survives regeneration
(#17). **Correction:** a post-publish change path exists (More ▸ Swap sessions, dated). Only the dashboard's
"Exceptions" wording is wrong (#18). A3 is **not** fixed: run 319 answers Term 2 only because it was published in
Term 2 (#13).

**Live state now:** run 319 **published**; one dated revision effective 2026-09-27 (GR7 - Luna Mon SCIENCE ↔
MAPEH, reason "QA test swap - live browser QA verification"); run 320 is the current draft. Run 318 is kept, with
its broken swap, for your diagnosis.

**Updated order for you:** (1) the Swap-vs-preview and Revert pair; (2) the publish-day public outage;
(3) the Change room crash; (4) public term (A3); (5) Runs "Published" tag; then the rest.

## 2026-09-26 22:30 — BLOCKING ×2: Swap commits something other than its preview; Revert does nothing (A2: top priority)

Evidence: `docs/reviews/timetable-manual-controls-20260926/findings.md` #8–#10. Committed in Chrome, confirmed by
Codex. Swap Mon 07:30 MAPEH ↔ Wed 08:15 ESP (GR7 - Luna, Term 2, run 318): the preview said ESP → Mon 07:30; the
commit (`AUTO_FIX_MOVE_BLOCKING`) put ESP at **Wed 12:15, after the section's day ends**, and left **Mon 07:30
empty**. "Revert this edit" then logged "Undid an earlier change" but restored nothing. Terms 1 and 3 are intact, and
only Term 2 diverges. Lead: `findAutoFixTarget` (`manual-edit.service.ts:2065`) has no term filter and no shift
bound. **Order now: this pair and the Change room crash (entry below), then the public default term.** Rule for the
fix: a commit must apply exactly what its preview showed, or refuse; an undo must restore the prior state or say it
cannot.

**Live-state notice:** Lane C is about to **Regenerate a new draft** (run 319+) and then **Publish** it, as part of
the operator-authorised QA. Run 318 and its history stay available for your diagnosis.

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
