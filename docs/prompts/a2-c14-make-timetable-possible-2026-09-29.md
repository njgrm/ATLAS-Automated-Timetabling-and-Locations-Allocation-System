# A2 packet c14 — DEMO BLOCKER: the active year must be able to make a timetable, and know its term

Base: `origin/main` at launch. New branch `work/a2-c14-generate-ready`, new worktree
`E:/ATLAS-worktrees/lane-a2-c14-generate-ready` (never write in `D:\ATLAS`). Deadline: root cause posted to
`lane-a-to-c.md` by **13:00**, fix integrated by **16:00**; demo Wed 2026-09-30. Risk: MEDIUM for client; any server
or data change is HIGH (one `atlas-reviewer-high` pass). Top priority of all lanes.

Evidence: `docs/reviews/codex-staging-train7-e9ddda71/report.md` (staging = copy of live, build `e9ddda71`, S.Y.
2022-2023 active):
- `/timetable`: "Generate schedule — Setup inputs for the active school year are not ready yet.", "468 setup items to
  fix", "No timetable yet". Generation, move, swap, lock, clash warning and undo could not be exercised at all.
- `/faculty/concerns`: "Active ordered term unresolved", "Writes stay disabled rather than defaulting to Term 1",
  "Active term verification not requested".
- `/room-schedules`: "Term not verified", term picker disabled.

The demo story ends in a generated timetable, reviewed and printed. Today that is impossible on the active year.

## Part 1 — root cause (post by 13:00, one short post)
1. **Term:** why is the active ordered term unresolved on the active year? `resolveVerifiedActiveTermIndex`
   (`lib/timetable-data/timetablePrefetch`) and the A5 c2 "one active-term source" are the suspects; "verification
   not requested" suggests callers never ask. Name the one fix and every page it unblocks (Teacher Concerns, Room
   Schedules, Timetable).
2. **468 setup items:** group them by kind with counts. For each kind: is it real missing data (then which page and
   which click fixes it, and can ATLAS fill it automatically), or an over-strict gate (then relax it with a reason)?

## Part 2 — fix, then prove it
- Product fixes in code. Data that is genuinely missing on the active year may be filled **through ATLAS's own UI
  flows** on staging first, then on live (live data is test data; UI flows are allowed; no direct SQL on live without
  Lane C). Record every UI action taken.
- "468 setup items to fix" becomes: the count of real problems, the first one named in plain words, and one button
  that opens that exact fix. Never a bare total.
- Proof on staging (after A4 deploys, Lane C runs it) and in your own preview against the staging API: Generate is
  enabled, a timetable is made for the active term, and move / swap / lock / clash warning / undo each work once.
- Coordinate, don't collide: A3 c13 owns the Teacher Concerns page and A5 c5 owns Room Schedules; you own the shared
  term resolution they consume. Post the fixed API/hook name to `lane-c-to-a2.md` so they rebase on it.

## Rules
- Shell calls are force-killed at 20 min: run builds, suites and generation measurements detached and poll.
- Previews only via `scripts/dev/start-preview.ps1`; stop only processes you started.
