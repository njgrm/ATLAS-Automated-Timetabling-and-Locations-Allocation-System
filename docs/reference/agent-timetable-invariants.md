# Timetable Invariants

Read this file for timetable generation, term scope, schedule views, exports,
publication, latest-run reads, or timetable query shaping.

- Term authority is separate from cell rendering. A term switcher selects one
  verified ordered term; it must not merge terms, encode rotation as a badge, or
  let an all-term export masquerade as a beneficiary-facing program.
- The current beneficiary has three ordered terms. Missing term identity is
  unresolved authority and must never become Term 1. A rotating family resolves
  its subject, teacher, room, and full weekly sessions within the selected term.
- `LUNCH_BREAK` and `HEALTH_BREAK` block placement. Flag/HGP behavior must follow
  the stakeholder class program; never assume overlay or displacement.
- Every export, room view, teacher view, section view, public read, and published
  revision must preserve `(termIndex, day, interval, section, subject, faculty,
  room)` and prove parity from one source run.
- Publication requires zero HARD violations. Soft warnings require explicit
  acknowledgement.
- Latest-run endpoints are memory-sensitive. Select candidates with light
  metadata, read the minimum heavy row, and normalize in place when safe. Do not
  load all completed runs with full JSON payloads or clone large arrays without a
  demonstrated need.
- Query-shaping changes must prove behavior and query shape. Preserve JSON-array
  order explicitly, for example with PostgreSQL `WITH ORDINALITY`. A probe is not
  proof if it selects a different run, compares against non-revision-effective
  entries, merely prints samples, or still loads the prohibited heavy field.
