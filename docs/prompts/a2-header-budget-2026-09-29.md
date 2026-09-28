# A2 packet — /timetable header to the Header budget (operator 2026-09-29, screenshot)

Fresh session. Read AGENTS.md §8 (new rules **One look per control**, **Header budget**) and the post
`docs/handoffs/lane-c-to-a2.md` 2026-09-29 00:10. Operator: the header "has regressed … messy … we need a less is more
approach and relaxed view so users don't get overwhelmed."

Target at 1366x768, on a year with no schedule (2022-2023 live state) and on a year with a draft:
- Row 1: title, tabs, ONE status chip (no duplicate of "No schedule yet"/"No 2022-2023 timetable yet"), Generate, More.
- Row 2: Term, Show, Schedule for — same `@/ui` picker as Teaching Load.
- Setup blockers: one short link `468 setup items to fix` (live count) opening the existing detail. No truncated sentence
  anywhere (`Term: Viewi…`, `school is i…` are gone or said fully elsewhere).
- No helper sentence under Edit draft / Discard draft (Tooltip instead). Discard draft, Undo, Redo, History hidden or
  under More when there is nothing to act on.
- Keep past-year read-only view (c1a04411) intact; P stays parked.
Tests failing-first on the rules above (row count, single status chip, no ellipsis text, hidden idle actions). Rendered
proof: screenshots at 1366x768 and 1920x1080, both year states, committed under docs/reviews/. One background server,
stopped when done. Push to main after QA and post ready-for-release to Lane C. Do not end the run to wait for Lane C.
