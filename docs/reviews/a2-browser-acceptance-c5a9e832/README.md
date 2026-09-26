# Browser acceptance — release `c5a9e832`, 2026-09-27 05:46–05:51 +08

**Session: available.** `NEEDS_SESSION(space-bunny/opencode-default)` cleared — `/timetable` loaded instead of
redirecting to `/login`. Authenticated as the operator/QA actor, **Active Term T2, year 2031-2032**, GR7 - Luna,
159 warnings. This closes the blocker that had held these rows across five prior cycles.

**No live data was written.** The swap preview was opened and **cancelled**; the Change room form was opened and
**not submitted**. Zero rows created. Ordinary UI *reads* only, per `AGENTS.md` §12.

## Rows performed

| Row | Result | Evidence |
|---|---|---|
| **D9 — "Change room" on MAPEH** | **PASS** | The MAPEH class summary opened with all five actions (Move time / Change room / Swap / Change owner / Expert details) and **no router error boundary**. "Change room" opened the form: Edit Type selector (Timeslot / **Room** / Faculty), **Target Room combobox reading `G7 Room 103 · Floor 1 · CLASSROOM`**, and a Preview Changes button. MAPEH is the subject with `requiredFeatures: []` — the exact input that originally crashed on `selectedRoom?.features.length`. Screenshot: `a2-d9-change-room-c5a9e832.png`. |
| **D8-browser — swap preview renders** | **PASS** | Swap drawer opened: *"Swap class times: Class A selected. Choose Class B on the grid."* Selecting ESP Wed 8:15 produced a full preview with **"Safe to review"** and *"No blocking conflict · Other warnings stay unchanged"*. **No 500.** |
| **D9 — amber icon on the auto-move row** | **PASS** | `svg.lucide-move.mt-px.size-3\\.5.shrink-0.**` **`text-amber-600`** with `aria-hidden="true"`, inside the swap preview. Screenshot: `a2-d9-swap-preview-c5a9e832.png`. |
| **D9 — "Swap + move 1 class" label** | **PASS** | Commit button reads **"Swap + move 1 class"**. It previously read "Swap sessions" in every state, including this one. Dialog buttons are exactly `["Cancel", "Swap + move 1 class", "Close"]`. |
| **Public page DOM** | **PASS** | `/public/schedules` renders **20 sections** (Aguinaldo GR7 40, Bonifacio GR7 50 STE, Luna GR7 40, Mabini GR7 50 Sports, …), term **TERM 2**, *"40 published classes are shown"*, heading "Find your class schedule", and **no "Unable to load public schedule"**. |

## Row NOT performed, with the reason

**"This undo cannot be undone." statement — `UNPERFORMED`, not assumed.**

The statement renders on a `REVERT` row, and the current schedule has none: **More → Expert tools → Schedule history
is disabled** and says *"Nothing to show yet: no class has been moved, swapped or given a new room in this
schedule."* Producing a `REVERT` row requires **committing a swap and then reverting it** — a live production-data
write, which this packet does not authorise (`docs/prompts/a2-release-c5a9e832-2026-09-27.md` §8). The row is
therefore **blocked on authority, not on capability**: a session is available and a capable agent could produce it
under a separate, explicit live-write authorisation.

The disabled state itself is truthful and correctly worded, which is worth recording — a disabled control that
explains *why* is the behaviour this lane has been removing the opposite of.

## Console

**3 errors, all EnrollPro proxy 502s** — `/enrollpro-api/settings/public` and `/enrollpro-uploads/…png`. **None
from the swap, Change room, or public-schedule surfaces.** This is the separate, already-registered
`ENROLLPRO-PROXY-RECOVERY` stream, not a defect of this release.

## Honest observation, recorded rather than glossed

The auto-fix target offered for the original reproduction pair (MAPEH Mon 7:30 ↔ ESP Wed 8:15) is
**WEDNESDAY 12:15 PM–1:00 PM** — the same slot the original bug used. Two things are true at once and both belong
in the record:

1. **The adopted contract is satisfied.** The move is now **named exactly** before commit
   (*"Class B leaves WEDNESDAY 8:15 AM–9:00 AM and goes to WEDNESDAY 12:15 PM–1:00 PM. Class A then takes Class B's
   original time"*), and the button states that a class will move. Under *"a commit must apply exactly what its
   preview showed, or refuse"* this is correct behaviour — previously this same move was **silent**.
2. **The bound is still worth a second look.** Grade 7 REGULAR is `06:00–12:15`, so a session **starting** exactly at
   `12:15` satisfies a window whose end is `12:15`, while running 45 minutes past it. The window check bounds the
   **start**, not the whole span. That is a **narrowing opportunity, not a regression**, and not a blocker for this
   release. Filed as a dated successor: decide whether the shift bound should require
   `start >= windowStart && end <= windowEnd`.
