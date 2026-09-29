/**
 * A2 C13 (item 2, "One name") — THE place name, in ONE constant.
 *
 * ── THE RULING ─────────────────────────────────────────────────────────────────
 * Lane C's staging walk: *"The nav says 'Class Schedule' but the page is
 * 'Timetable'. Pick one familiar name."* The ruling is **"Class Schedule" wins.**
 *
 * "Class Schedule" is already what the product calls the place everywhere a
 * scheduler actually reads it: the nav item (`app-shell/navigation.ts`), the
 * sidebar group divider, the breadcrumb group, the page `<h1>`
 * (`resolveRouteChrome` → `TimetableSubNav`) and the product's own cross-page
 * links. "Timetable" is the INTERNAL name leaking into user-visible text, so
 * the fix is to close the leak — not to rename five already-committed, already
 * familiar surfaces onto a less familiar word.
 *
 * ── WHY A CONSTANT AND NOT A STRING ───────────────────────────────────────────
 * The lesson already recorded at `PUBLISHED_GENERATE_LABEL` in
 * `simple/SimpleHeaderHelpers.tsx`: when a name lives as a literal in five
 * places, the fifth rename is the one that gets missed. Every place-name surface
 * imports THIS, so a future rename is one edit and cannot leave a surface behind.
 *
 * ── SCOPE RULE (A2 C13, operator adjudication 2026-09-29) ────────────────────
 * §2a place-name surfaces take THIS constant. The carve-out class — a string
 * naming a person's own weekly schedule, or a revision's own schedule — takes the
 * plain word "schedule" instead, and does NOT come here. Sending a scheduler to a
 * place called "Class Schedule" when they mean their own timetable is the mistake
 * this rule exists to prevent. That is why `TimetableFacultyIssuePivotDialog`,
 * `TimetableUndoRedoControl` and the `PublishedRevisionDialog` badge say
 * "schedule" and not "Class Schedule".
 *
 * ── WHAT IS NOT HERE ──────────────────────────────────────────────────────────
 * ROUTES. `/timetable` and every `/timetable/*` path, every `to=`, every
 * redirect and every `routeChromeOverrides` KEY stay byte-identical. Only the
 * display strings change. `navigation.ts` is the authority for the route table
 * and it is unchanged; this module only supplies the words.
 */
export const CLASS_SCHEDULE_LABEL = 'Class Schedule';
