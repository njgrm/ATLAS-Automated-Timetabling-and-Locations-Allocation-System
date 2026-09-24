---
name: atlas-timetable-invariants
description: Fail-closed rules for ATLAS timetable work. Load before planning, editing or reviewing timetable generation, term scope, schedule views, exports, publication, latest-run reads, public schedules, or timetable query shaping.
metadata:
  short-description: ATLAS timetable fail-closed invariants
---

# ATLAS timetable invariants

The full rule text is `docs/reference/agent-timetable-invariants.md` — **read it now**; it is
short and it is the authority. This skill adds the checks to run against a change.

## Checklist for a timetable change

1. **Term identity.** Find every place a term index/id is read or defaulted. Missing term
   identity must fail closed (e.g. `TERM_SELECTION_REQUIRED`) and never become Term 1.
   Grep the diff for `?? 1`, `|| 1`, `termIndex = 1`, `terms[0]`.
2. **One selected term.** A switcher selects one verified ordered term. No merging of terms
   into one view, no rotation encoded as a badge, no all-term export presented as a
   beneficiary-facing program. A rotating family keeps subject, teacher, room and full
   weekly sessions within the selected term.
3. **Breaks.** `LUNCH_BREAK` and `HEALTH_BREAK` block placement. Flag/HGP behaviour follows the
   stakeholder class program — never assume overlay or displacement.
4. **Parity from one run.** Exports, room/teacher/section views, public reads and published
   revisions preserve `(termIndex, day, interval, section, subject, faculty, room)` and are
   proven equal from **one** source run (count, identity and order).
5. **Publication.** Zero HARD violations; SOFT warnings need explicit acknowledgement.
   Generation and publication are HIGH actions (`AGENTS.md` §13).
6. **Latest-run memory.** Select candidates with light metadata, read the minimum heavy row,
   no loading of all completed runs with full JSON payloads, no cloning large arrays without
   a demonstrated need.
7. **Query shape.** Prove behaviour *and* query shape. Preserve JSON-array order explicitly
   (PostgreSQL `WITH ORDINALITY`). A probe does not count if it selects a different run,
   compares non-revision-effective entries, only prints samples, or still loads the
   prohibited heavy field.
