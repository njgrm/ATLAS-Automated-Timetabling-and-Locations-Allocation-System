# A3 packet c13 — Teacher Concerns becomes the ONE page a scheduler fills while talking to a teacher

Base: `origin/main` at launch. New branch `work/a3-c13-concerns-one-page`, new worktree
`E:/ATLAS-worktrees/lane-a3-c13-concerns` (never write in `D:\ATLAS`). Deadline: candidate integrated on main by
**2026-09-29 17:00** for the evening release; the demo is Wed 2026-09-30. Risk: **HIGH** if you add a server write
route (auth boundary) — then one `atlas-reviewer-high` pass closes it; otherwise MEDIUM. Loop: executor -> one
fresh QA/review -> integration -> post `lane-a-to-c.md` with browser rows for Lane C.

## Operator direction (09:45)
"Room preferences should not be a different page, it should be folded into teacher concerns so there is only one
page the scheduler will fill out when speaking to a teacher." Older, mouse-first schedulers; never dense, never
intimidating, never leave guesswork or tedium to the user.

## What exists today (mapped by Lane C; verify before relying on it)
- `/faculty/concerns` — `pages/TeacherConcerns.tsx` + `components/faculty-shared/TeacherConcernWorkspace.tsx`:
  teacher picker, availability grid (Preferred/Unavailable), notes, room requests as FREE TEXT only, reviewer
  decision. API `/faculty-availability/{school}/{sy}/faculty/{id}` (GET/PUT, `/submit`, `/review`); models
  `FacultyAvailability` + `FacultyAvailabilitySlot` (prisma/schema.prisma ~346-400).
- `/faculty/room-preferences` — `pages/OfficerRoomPreferences.tsx` (side nav, navigation.ts:57): review queue of
  `FacultyRoomPreference` (currentRoomId -> requestedRoomId per generation run), with a zero-write `preview` and a
  `review` (APPROVED/REJECTED/NEEDS_FOLLOW_UP) that applies the move to the active draft. Requests came from the
  retired faculty portal (and `seed-qa-room-requests.ts`).
- `/faculty/preferences` — `pages/OfficerPreferences.tsx` ("Faculty Preferences"): review list of the legacy
  `FacultyPreference` (wellbeing toggles: pregnancy, mobility, travel, floors). preference.router.ts says it is
  replaced by `FacultyAvailability` for generation input.

## The target: one form, top to bottom, for one teacher
1. **Pick the teacher** (search by name; the list shows who is done and who has not been talked to yet).
2. **When they cannot teach / prefer to teach** — the existing grid, behaviour unchanged.
3. **Rooms** — "Does this teacher need a particular room?" For each of the teacher's classes (class names, not
   ids), an optional room picker showing room names, plus the reason in one short line. When a generated draft
   exists, show the current room beside it and a preview line from the existing zero-write `preview` ("Moves 7-A
   English from Room 104 to Room 101 — no clashes", or the clash in plain words), then one button that applies it
   through the existing review/apply path. When no draft exists yet, save the room need and apply it when the
   timetable is built — only claim what the code really does; if generation cannot read it, say plainly "This is
   applied after the timetable is built" and make that true. Never pretend.
4. **Anything else** — the notes box. Any wellbeing need the generator actually honours (check whether the
   `FacultyPreference` wellbeing fields feed generation; if they do, add them here as plain checkboxes such as
   "Ground floor only"; if they do not, do not add them).
5. **One Save** at the bottom with a plain confirmation naming what was saved. No separate submit/review ceremony
   for the scheduler's own entries: the scheduler is the reviewer. Keep the reviewer decision only if a second
   person really uses it; otherwise remove it from this screen.

Then `/faculty/room-preferences` and `/faculty/preferences` redirect to `/faculty/concerns` (any pending portal
requests appear on that teacher's form, not lost), and the side nav shows only "Teacher Concerns".

## Rules
- Subtract, do not add: the page ends shorter than today's three pages combined, with no "draft / submitted /
  run id" words on screen.
- Reuse server paths first. A new officer-create route for a room need is allowed only if none exists; it uses the
  normal session auth, the actor's school scope, and the HIGH review.
- Browser proof via the Playwright MCP at 1366x768 on a preview from `scripts/dev/start-preview.ps1` against the
  staging API: one teacher filled top to bottom; before/after renders committed.
- Shell calls are force-killed at 20 min: run suites and builds detached (`scripts/dev/start-detached.ps1`) and
  poll the log.
- Browser rows for Lane C in the handoff: (1) fill one teacher's concerns including a room, save, reload, still
  there; (2) the old room-preferences URL lands on the teacher form; (3) the preview line shows before apply.
