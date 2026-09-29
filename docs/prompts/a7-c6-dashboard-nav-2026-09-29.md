# A7 packet c6 — the first screen and the side menu tell the demo story

Base: `origin/main` at launch. New branch `work/a7-c6-dashboard-nav`, new worktree
`E:/ATLAS-worktrees/lane-a7-c6-dashboard-nav` (never write in `D:\ATLAS`). Client only. Risk MEDIUM. Deadline:
integrated on main by **2026-09-29 16:00**; demo Wed 2026-09-30. Loop: executor -> one fresh QA with REJECT_UX
authority -> integration -> post `lane-a-to-c.md` with browser rows.

Evidence: `docs/reviews/codex-staging-untouched-24e268fb/report.md` (Part A Dashboard, Part D, fixes 6 and 8).

## The demo story, in side-menu order
Set up the school year -> Subjects -> Teachers -> Teacher Concerns -> Teaching Load -> make the Timetable -> look up
and print schedules. Today a first-time user cannot find School Year Setup (no menu entry; the Dashboard links a raw
"/admin/year-setup"), and "Class Schedule" vs "Room Schedules" compete for "review".

1. **Side menu:** add "School Year" (to `/admin/year-setup`) in story order; the lookup/print page reads as
   "Look up & print schedules" (A5 c5 is redesigning that page; you own only its menu label). The Timetable's own
   label is A2 c13's (in QA now) — rebase on it, do not fight it. Menu labels are plain nouns an older teacher uses.
   Pages that are only redirects (Faculty/Room Preferences after A3 c13) are not in the menu.
2. **Dashboard:** it is the first screen at the demo.
   - "6 OF 10 READY" -> name what is not ready beside the count, each a link to the page that fixes it.
   - "Hard-violation count unavailable" / "Derived demand prepared (input milestone)" -> plain words ("Classes
     needed are worked out"), or say what is unavailable and what to check.
   - One obvious next step at the top, in the story order above.
   - Subtract: calmer, fewer words than today.
3. **How Scheduling Works:** plain words ("how many preferences the draft could not meet", "Apply this change");
   technical tuning (constraint weights 0–100) moves under an "Advanced" fold.

## Rules
- Browser proof via the Playwright MCP at 1366x768 on a preview from `scripts/dev/start-preview.ps1` against the
  staging API; before/after renders committed.
- Shell calls are force-killed at 20 min: run suites and builds detached and poll.
- Browser rows for Lane C: a first-time user finds every story step from the menu; Dashboard names what is not ready.
