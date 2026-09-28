# A6 packet c5 — real teacher outage: Guided mode, hidden teachers, placeholders (Codex staging ce1257c8)

Fresh session, right after the TL header run. Evidence: `docs/reviews/codex-staging-train5-ce1257c8/report.md`.
Priority order (demo Wednesday 2026-09-30):
1. **Guided mode is still live.** `TeachingLoadGuidedModePlaceholder.tsx` ("Guided mode is active") is rendered at
   `pages/TeachingLoad.tsx:895`. The operator asked for removal on 2026-09-28; c3 did not do it. Remove it and every
   Guided toggle/wording; the page leads with choosing a teacher or section. Test: no "Guided" text reachable.
2. **Three teachers are hidden.** Faculty shows 20 active; the year has 23 linked. The 3 missing are the ones with no
   department (#3, #20, #33 in the Lane C diagnosis, ddc13dc7) — so the scheduler cannot even fix them. Show them, with a
   plain `Needs a department` cue and a one-click way to set it. This is your known 23-vs-20 item: fix the cause.
   **CORRECTION 01:50:** those 3 are NON-TEACHING personnel (EnrollPro contract, A9 packet) — they must not appear at all;
   A9 removes them at the fetch. Your item 2 is now: make sure the count/cue logic is right once they are gone (20 = 20).
3. **Placeholders for a real outage.** The TL suggestion's "Temporary substitute" rows are never saved, so generation
   still sees 438 blockers after Apply. The saved path is Faculty → `CreatePlaceholderDialog` ("Add a temporary record…").
   Make the outage path findable from Teaching Load: when the suggestion leaves classes without a real teacher, offer
   `Add a teacher to be hired` (prefilled subject, e.g. "MAPEH teacher — to be hired"), then assign. Placeholders are
   labelled `to be hired — not a real person yet` everywhere they appear (TL, timetable, teacher views).
4. The substitute preview did not show "N classes still need a real teacher" (hotfix 5bccb65d) — find which path Codex
   hit (strategy "Real teachers first, then substitutes") and make the note appear there.
Tests failing-first per item. Rendered proof 1366x768. Push to main after QA; post ready-for-release. Do not end to wait.

## Update 01:40 — merged with the shortage evidence (operator priority)
Evidence: Codex `docs/reviews/codex-staging-shortage-ce1257c8/report.md` (4/10) + A8 audit
`docs/reviews/a8-tl-shortage-audit-2026-09-29.md`. **A8 c2 does the server half** (40h cap, truthful counts, assignable
placeholders + one create-and-assign endpoint, 409 naming, one load definition). You do the scheduler-facing half:
5. **Shortage first:** the first screen says `25 classes have no teacher` and a hiring plan by SUBJECT (`MAPEH: hire 2`),
   using saved data with its date — never "this figure is withheld". Fix `Subjects Affected` counting departments.
6. **One step to cover it:** beside each short subject, `Add a teacher to be hired` → prefilled dialog → one
   `Assign this teacher now` (A8's endpoint). No side-nav detour. Placeholders labelled `to be hired` in TL, Faculty,
   timetable cards.
7. **Choices with trade-offs in plain words:** 30 h / stretch to 40 h / teach outside department / leave open — each one
   line of consequence and a preview number before apply.
8. After Apply, the page says what is still open and the next step, not "complete".
Judge by §11 Design judgement gate: how much thinking and clicking it removes. Rendered before/after at 1366x768.

## Server contract is on main (Lane C, 03:50) — A8 c2 at 9a614c8b

Build the client against it; do not re-derive it. The handoff lists every field.
- The count of what still needs a teacher comes from `applyResult.stillNeedRealTeacher` and `teacherXResolution.unsavedSubstituteRows`. `created` and `assignmentsCreated` now count only saved rows, so never show them as work done.
- "Cover these classes" uses `POST /faculty-assignments/coverage/repair`. Preview first with `apply:false` (writes nothing and returns the exact plan), then apply. Show `assignedPairs` and `stillUncoveredPairs` as class names, not ids.
- Apply 409: `details.changedPairs` names the classes that changed. Say which classes changed, in plain words, and offer "Review again".
- The 40h cap now follows each teacher's max hours; moves and over-cap checks use one cap.
