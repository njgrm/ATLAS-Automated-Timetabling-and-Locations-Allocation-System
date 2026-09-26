# Lane C QA session handoff — 2026-09-26 (late)

**Role (operator, 2026-09-26):** Lane C (Claude Code) is the system-wide UX/UI, controls and flow QA lane, judging as a
veteran, older, mouse-first scheduler. It does no implementation; Planner A (general) and Planner A2 (timetable
custody) implement. **Grade communication as seriously as function**: word count, visual status cues, less is more,
no walls of text.

## Channels and sources (all on `origin/main`)

- **To A2:** `docs/handoffs/lane-c-to-a2.md`, newest first. A2 adds "A2 ack". Post every verdict and every
  publish/generate there.
- **A2's checklist:** `docs/reviews/timetable-control-inventory-2026-09-26.md` (296 rows; §16a / §16a-bis are about 90
  live questions, not yet run).
- **Findings:** `docs/reviews/timetable-manual-controls-20260926/findings.md` (#1–#28, commit and publish rounds);
  `docs/reviews/timetable-live-walk-20260926/findings.md`; `docs/reviews/system-walk-20260926/` (01–04 + README);
  `docs/reviews/server-log-20260926/findings.md`; A2 handoff §10–10c.

## Operator rulings in force

- Live holds **only test data**: commit, publish and regenerate freely through the UI. Deploys, config and
  credentials keep their normal rules.
- The timetable takes precedence. Room Schedules is unfinished (its term merge is fixed by A2, `e4989b72`).
- `E:` warns below 25 GiB and fails below 15 GiB (`AGENTS.md` §3, `6404c213`).
- Undo in Simple, lunch-window/180-minute severity, and constraint severity D1–D3 are still **operator decisions**.

## Live state (as of 23:25 +08)

Release `0da104f96696aef7de7016e5364f29b50d0ed00f` (chunk `index-Co12IRfI.js`). **Run 319 published** (14:23:48Z), with
one dated revision effective 2026-09-27 (GR7 - Luna Mon SCIENCE ↔ MAPEH, "QA test swap"). **Run 320 is the current
draft.** It carries a TLE↔FIL swap (`AUTO_FIX_MOVE_SOURCE`) whose landing place is **untraced**: warnings went
159 → 69, the grid looked unchanged, and revert did not restore the count. Run 318 keeps its broken swap for A2.

## Top open defects (for A2 unless noted)

1. BLOCKING: swaps commit something other than their preview (`AUTO_FIX_*`), and "Revert this edit" does not restore
   (#8, #9, #20).
2. BLOCKING: publishing takes `/public/schedules` offline for the publish day (409 `PUBLISHED_REVISION_INVALID` for
   today's date) (#12).
3. BLOCKING: "Change room" crashes `/timetable` (`ManualEditPanel` TypeError), confirmed on two runs (#1).
4. HIGH: the public default term is frozen at publication (§10a, #13); Runs never tags "Published" (#14); Change owner
   opens on the wrong teacher (#3); teacher leaving cannot complete for STE/SPS sections, and its picker has no
   qualification signal (#23, #24); the teacher-leaving wizard is dense at every step (#27).
5. Planner A (not started): the "ASS" login heading; Faculty Preferences "Missing 42" over an empty list; outage
   banners; SMART/AIMS links; a suspected notification-stream leak (server log #1).

## Queue for the next QA session

1. **Trace run 320's TLE↔FIL swap** (read-only): Terms 1–3 for GR7 - Luna, teachers CRUZ, PAOLO BENJAMIN and
   AGUILAR, CARLO MIGUEL, Schedule history, Review-issues counts. **Give runners the full origin
   `https://njgrm.buru-degree.ts.net`**: a Codex run went to localhost because the prompt said only `/timetable`.
2. **Communication grading** of the readiness sheet, the Review-issues panel, the drift banner, the generate dialog
   and the publish checklist and confirm (same script as the teacher-leaving run: words, buttons, icons, text under
   14 px, visual-status, verdict + one cut).
3. §16a / §16a-bis of A2's inventory, in chunks of ≤15 rows, commits allowed. Post each chunk to the channel.
4. Re-grade the earlier "worked well" lists (walks 01–04) for communication, not only accuracy.

## Runner notes

- **Claude in Chrome** (`atlas-browser-qa`, Sonnet): drives the operator's njgromea Chrome profile. The ATLAS session
  expires, so ask the operator to re-sign in when a runner hits `/login`. The window cannot go below ~1280 px. Keep
  each run to one flow: a mixed run ran out of budget at about 140k tokens.
- **Codex CLI** (second, independent runner, separate Chrome profile): the invocation is in Claude memory
  `codex-cli-second-browser-runner`. YOLO mode is approved by the operator; check `git -C D:/ATLAS status` after each
  run. About 2.3M input tokens per signed-in run (95% cached). Its session also expires.

## Cost this session (`subagent_tokens`, Claude runners)

Walks and acceptance about 1.25M. Preview + commit + publish rounds: 190,509 + 163,514 + 216,395 + 139,070 + 128,569.
Codex (operator's plan): about 9.5M input, mostly cached.
