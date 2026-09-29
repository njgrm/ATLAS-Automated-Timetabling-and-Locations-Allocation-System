# A8 g1 — a subject's weekly classes must spread across the week (generation quality, HIGH) — train 11

Issued by Lane C, 20:38, from live Run 347 (2023-2024 Term 1, train 10, read-only SQL on
`generation_runs.draft_entries`, termIndex 1, entryKind SECTION; 910 entries, 0 teacher overlaps, 0 section overlaps).
**31 section-subject pairs have more than one class of the same subject on the same day: 25 with 2, 5 with 3, 1 with 5.**
Worst: Filipino for Grade 8 - Makatao (section 27, subject 1, faculty 1) has all five weekly classes on Monday (07:30,
08:15, 10:00, 10:45, 11:30). None are modular/rotation groups. Subjects affected include FIL (8 pairs), and subjects 2-6.
A scheduler opening a teacher's program sees "Filipino, Filipino, Filipino … Monday" — the timetable looks broken.
Also 10 classes were left without a slot (NO_AVAILABLE_SLOT: every eligible time double-books a teacher or room).

## Do
1. In the constructor (`atlas-server/src/services/schedule-constructor.ts` and its candidate ranking), a section gets at
   most one class of a subject per day, unless the subject is defined as a double period / block (then the pair is
   consecutive). Treat it as hard when a spread placement exists; if none exists, place it and report it in the run
   receipt as "Filipino for 8-Makatao has 2 classes on Monday (no other day was free)". Never 5 on one day.
2. Spread order: fill days evenly (Mon-Fri) before doubling any day.
3. Keep the 0 teacher / 0 section / 0 room overlap result; do not raise the unplaced count on live-shaped data (910/920
   now) — prove both on a staging copy of live: before/after counts of same-day repeats (target 0 non-block), unplaced,
   hard violations, run time.
4. Unit/golden test on a small fixture with 5 sessions/week × tight rooms: 5 different days.
HIGH: atlas-reviewer-high pre-action on the approach, post-action on the diff. Commit and push wip every 30 min.
Coordinate with A8 c5 (same service area): merge origin/main before each slice.
