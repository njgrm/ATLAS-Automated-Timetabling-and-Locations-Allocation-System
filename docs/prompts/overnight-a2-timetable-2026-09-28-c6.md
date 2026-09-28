# Packet c6 — Planner A2 — 2026-09-28 09:40 +08

Issued by Lane C. Authority as in c3 (deploys, drafts, publish; every gate). The operator is awake but busy; decide
and record. Background every server. **Planner steps are now 250**, but only after the admin serve restarts; assume
120 if unsure, and delegate.

## Live evidence (Lane C, 09:35, Chrome, live `a1db27d5`, GR7 - Luna, read-only)

- **Term 2 Monday is wrong:** 6:00–6:45 is **empty** (Tue–Fri TLE · P. CRUZ · Room 103); Mon 6:45 shows MAPEH ·
  I. GARCIA (normally 7:30), Mon 7:30 shows SCIENCE · R. Santos (normally 6:45). Terms 1 and 3 have TLE Mon–Fri 6:00.
- **Schedule history on this run reads "Nothing to show yet: no class has been moved, swapped or given a new room in
  this schedule."** Warnings chip reads **48** (draft 321 read 69 after last night's swap/revert). No run number or
  Draft/Published label is visible anywhere on the view (B10/B11 fix expected one; Lane C is running those rows now).
- Header clutter, graded for older users: "Class Schedule" twice (top bar + heading); "Active Term: T2" chip beside an
  independent Term selector; a 26-word drift banner "Schedule information changed … checked 1s ago" with "Preview
  impact"/"Regenerate to apply" still showing (#17/#59 were meant to make it truthful on a fresh run); six separate
  message rows before the grid; a big red "Publish schedule" on a draft with warnings and "1 setup item must be fixed
  first".

## Queue

1. **Find out what happened to Term 2 Monday on the run on screen, and which run that is.** Read the DB (you are
   elevated; read-only): which run the /timetable default resolves to, its manual edits, whether last night's D10/B2
   swaps (and any auto-move) landed on it, and why history is empty. **Two truthfulness possibilities, both HIGH:** (a) the
   screen shows a different run from the one edited, without saying which; (b) edits (incl. auto-moves) happened and the
   history does not show them. Fix the defect. Restore GR7 - Luna Term 2 Monday on the draft (a documented corrective
   edit or revert is authorised; record the before/after) so the demo draft is clean.
2. **Header for older users (P0 for Wednesday):** one page name; show the run's state (Draft/Published) and date in
   plain words in one place; merge or explain the "Active Term" chip against the Term selector (e.g. "Viewing Term 1 ·
   school is in Term 2"); make the drift banner truthful and short (≤ 12 words) or hide it when nothing changed; keep
   ≤ 3 message rows above the grid; make "Publish schedule" say why it is not ready when setup blocks it.
3. **Review gate for A3's c8 delta** (20 paths) as your c5 required; then build and stage the release, **only if E:
   has room**. E: is 26.84 GiB and the operator has been asked for a reclaim decision; if none has arrived, stage the
   packet and stop before the build.
4. Handoff c6 section, acks, live-state. Push.
Final message: ≤ 12 lines.
