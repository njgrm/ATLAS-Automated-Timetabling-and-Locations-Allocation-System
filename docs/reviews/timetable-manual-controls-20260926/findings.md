# Timetable manual controls — preview-only walk (live `0da104f9`, 2026-09-26)

**Method:** Claude in Chrome, signed in, `/timetable` Term 2 · Section · GR7 - Luna, draft run 318 (reviewing).
Each control was walked **to its preview and cancelled**. Nothing was saved, published or generated. The one
crash was client-side, and a reload showed the draft unchanged. **Not covered:** what happens after a commit
(the change lands, Undo, what teachers and the public see). That needs a safe environment: see "Next".

## Findings

| # | Control | Finding | Severity |
|---|---|---|---|
| 1 | **Change room** | Clicking "Change room" in the session dialog **crashes the page**: "This page hit an unexpected error / Cannot read properties of undefined (reading 'length')", a TypeError in the `ManualEditPanel` chunk caught by the router error boundary. A scheduler cannot change a room from the dialog at all. The last change to that panel is `aa7f6f67` (the line-cap split that moved the option groups into `manual-edit/useManualEditOptionGroups.ts`). It is the first suspect, not a proven cause. | **BLOCKING** |
| 2 | **Move time → occupied slot** | Moving Mon 07:30 MAPEH (I. GARCIA) onto Mon 10:00 MATH opens "Swap class times" with "Must fix: … Daily load hard cap: I. GARCIA would reach **11.3h (max 8h)**", on a day whose classes run 6:00–12:15. A same-day swap cannot raise one teacher's single-term daily load to 11.3 h, so this looks like **load summed across terms**: the same false-conflict class as the old Room Schedules and published-swap defects. The same preview also says "Safe to review · No blocking conflict", directly under a "Must fix" line. | **HIGH** |
| 3 | **Change owner** | Leaves the dialog and navigates to `/teaching-load?facultyId=19&sectionId=141&subjectId=6&task=missing-load`. That page shows **a different teacher** (AGUILAR, CARLO MIGUEL · FIL), not the class's teacher (GARCIA · MAPEH), and there is no way back to the class. | **HIGH** |
| 4 | **Changes after publishing** | The dashboard tells schedulers "Use Exceptions for in-term changes", but **no "Exceptions" exists** in the sidebar, the tabs, the More menu or Runs. A scheduler with a published schedule has no discoverable way to make an in-term change. (Run 318 is a draft, so a published-only control may exist elsewhere. If it does, it is not findable.) | **HIGH** |
| 5 | **Teacher leaving / Reassign load** | This is a 5-step wizard. The replacement picker (step 3) shows no qualification or load hints, and "Use for all" lets you pick an unqualified teacher. The refusal only comes at preview (step 4). The refusal is correct, but it reads "Target faculty 1 is not qualified for subject 6 in this section program (NOT_QUALIFIED)", using ids and a code instead of names. | MEDIUM |
| 6 | **Swap** | The dialog "Swap" and More ▸ "Swap sessions" open the same flow (a duplicate entry). It accepts a swap that changes nothing visible (Mon MAPEH ↔ Tue MAPEH, same teacher, same time) as "Safe to review". "Checking options…" took ~7 s. | LOW |
| 7 | **Move time** | GR7 - Luna's day is fully booked 6:00–12:15, so "Move time" on this section can only swap. A free-slot move could not be shown here; test it on a section with gaps. | note |

## Keep

- Teacher leaving refuses an unqualified replacement before saving, with the reason: "Choose a qualified receiver, or grant authority first."
- The occupied-slot explanation is specific: section occupied, room occupied, and the teacher's daily cap with hours.
- Every dialog says "Nothing changes until you confirm" / "Safe to review", and Cancel always returned a clean draft.

## Next

1. **A2:** fix #1 (the crash) first, then #2 (verify the cross-term load hypothesis on the server), #3 and #4. Put all
   of them in the control inventory.
2. **Committed-path QA needs an operator decision.** Either (a) a local copy of ATLAS with a snapshot of the
   database, where Lane C can commit, undo, publish and make post-publish changes freely (recommended), or (b)
   commits on live with explicit approval per action. Commits touch real teachers' and the public's schedule.

Cost (`subagent_tokens`): 190,509 (115 tool calls).
