# A6 packet c5 — real teacher outage: Guided mode, hidden teachers, placeholders (Codex staging ce1257c8)

Fresh session, right after the TL header run. Evidence: `docs/reviews/codex-staging-train5-ce1257c8/report.md`.
Priority order (demo Wednesday 2026-09-30):
1. **Guided mode is still live.** `TeachingLoadGuidedModePlaceholder.tsx` ("Guided mode is active") is rendered at
   `pages/TeachingLoad.tsx:895`. The operator asked for removal on 2026-09-28; c3 did not do it. Remove it and every
   Guided toggle/wording; the page leads with choosing a teacher or section. Test: no "Guided" text reachable.
2. **Three teachers are hidden.** Faculty shows 20 active; the year has 23 linked. The 3 missing are the ones with no
   department (#3, #20, #33 in the Lane C diagnosis, ddc13dc7) — so the scheduler cannot even fix them. Show them, with a
   plain `Needs a department` cue and a one-click way to set it. This is your known 23-vs-20 item: fix the cause.
   Lane C set SCI/SCI/MAPEH on live at 01:05 (live-state.md), but faculty sync overwrites `department` with EnrollPro's
   null (`faculty.service.ts` ~L604-647): a local department must survive a sync when EnrollPro sends none.
3. **Placeholders for a real outage.** The TL suggestion's "Temporary substitute" rows are never saved, so generation
   still sees 438 blockers after Apply. The saved path is Faculty → `CreatePlaceholderDialog` ("Add a temporary record…").
   Make the outage path findable from Teaching Load: when the suggestion leaves classes without a real teacher, offer
   `Add a teacher to be hired` (prefilled subject, e.g. "MAPEH teacher — to be hired"), then assign. Placeholders are
   labelled `to be hired — not a real person yet` everywhere they appear (TL, timetable, teacher views).
4. The substitute preview did not show "N classes still need a real teacher" (hotfix 5bccb65d) — find which path Codex
   hit (strategy "Real teachers first, then substitutes") and make the note appear there.
Tests failing-first per item. Rendered proof 1366x768. Push to main after QA; post ready-for-release. Do not end to wait.
