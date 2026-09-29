# A6 packet c9 — Teaching Load header: one staffing figure you can click, one quiet note at most

Issued by Lane C, 14:20. Start right after A6 c8 lands; new branch/worktree from the main tip (rebase on c7 + c8).
Client only unless the "last saved roster" claim needs a server truth fix (then say so and keep it minimal).
Risk MEDIUM. Deadline: on main by **17:00**. **Browser proof with REAL staging data** (staging QA login; staging
carries 2023-2024 with the saved Teaching Load after A4 train 9's re-stream). Shell calls are force-killed at 20 min.

## Operator direction (14:15, live 3216d383, S.Y. 2023-2024) — verbatim intent
"The 50 classes still need a teacher is barely noticeable. We need the percentage of staffing and to make it
clickable to see who still needs assigning — that's what the load summary should be, not a bunch of numbers that no
one cares about. And there are two banners that say saved data, that's too much — two sentences the scheduler
shouldn't be troubled with; it's overwhelming."

Today's header (screenshot): an amber pill "ATLAS is showing the last saved roster, not the current one." AND a second
amber strip "Next step Last saved data — Assign teachers to open classes. These numbers come from the last saved
roster, not the current one." + "Review subject coverage"; below, small grey "50 classes still need a real teacher."

## Target
1. **One staffing figure, prominent, in the header:** "**84% staffed** · 50 classes need a teacher" (computed from saved
   coverage; the percentage = classes with a real teacher / all classes). It is the most visible thing on the page
   after the title. It is a **button**: clicking opens the **Load summary** as the list of *who still needs
   assigning* — grouped by subject, each class by name ("MAPEH — 7-A, 7-B, 8-C"), each row with its one action
   ("Assign teacher" / "Cover these classes"). That list IS the load summary; the old table of totals nobody reads
   goes (or behind "More detail" at the bottom of that window).
2. **Saved-data notice: at most one, and quiet.** Delete both amber banners. If ATLAS truly cannot reach the current
   roster, one small grey line under the figure: "From the saved roster (29 Sept)". No amber, no "Next step", no
   repetition. If the roster IS current, show nothing.
3. **Check the claim itself:** live was synced to 2023-2024 at 13:50 and its roster fetched; find why the page still
   says "last saved roster, not the current one". If the flag is wrong, fix the flag, not just the words.
4. One main button stays ("Suggest assignments" or the figure itself — pick one primary; the other is secondary).
5. Keep c7's per-subject shortage content, but inside the figure's window, not as another header line.

## Rules
- Subtract: header ends shorter than today (count words before/after).
- 1366x768: header in at most 2 rows, nothing cut off.
- Browser rows for Lane C: the % figure visible and clickable at 1366; the window lists classes by name with an action;
  zero amber banners on a healthy roster; one grey line when offline.

## Addendum 15:05 — operator rulings (binding)
- **Keep both.** (1) The staffing figure opens **who still needs a teacher**. (2) The header **"Load summary"** opens the
  **Staff workload audit** per fix-1.2 item **38.1** (`D:\ATLAS\fix-1.2.docx`): TOTAL / UNDERLOADED / BALANCED /
  OVERLOADED badges, roster rows (name, dept, ADVISER, OVER CAP, "37.5h · 125% of standard ›"), a row click drills
  into that teacher; each card's **Review load** opens straight into that teacher with "< All teachers" back to the
  roster without closing the dialog.
- **The staffing figure must LOOK like a button**, not a metric: button shape (border or fill), a verb in the label
  ("84% staffed — **See who needs a teacher** ›"), pointer cursor, hover and focus states, and it sits where buttons
  sit. Operator: "some buttons are not obvious as clickable and can just be passed on as a read-only metric" — this
  is a recurring problem; QA must judge it on the render.
- Also fold in fix-1.2 **16.2** (Teaching Load cards): card body opens nothing by accident; Review load and Edit
  assignments each do only their own thing (stopPropagation); order Name -> Hours/Subjects/Sections (fixed-width
  right-aligned columns) -> actions pinned far right, same height on every row.
