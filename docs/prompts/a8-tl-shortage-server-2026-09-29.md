# A8 packet c2 — Teaching Load shortage: server truth (operator priority 2026-09-29)

Fresh session. You audited this (`docs/reviews/a8-tl-shortage-audit-2026-09-29.md`); now fix the SERVER half. A6 owns the
client UX in parallel (`docs/prompts/a6-outage-placeholders-2026-09-29.md`); coordinate via the API contract only, do not
edit `atlas-client/src/pages/TeachingLoad.tsx` or `components/faculty-assignments/*` (A6's). Browser evidence:
`docs/reviews/codex-staging-shortage-ce1257c8/report.md` (4/10; Apply failed twice with the ownership 409).
Operator: "what use is our system if we can't lessen the work of schedulers and take the mental and tedious burden from them?"

In order, failing-first tests each:
1. 40h mode honours the teacher: `min(maxHoursPerWeek*60, HARD_CAP_MIN)` (TLA:671); one rule shared with proposal service :683-686.
2. Teacher-X mode reports the truth: no forced `finalUnresolved = 0` (TLA:3116); return `stillNeedRealTeacher` count.
3. **Saved placeholders are assignable** (correcting your item 4: do NOT exclude them from generation — the generator
   accepting them is right). The suggestion engine assigns saved `isPlaceholder` teachers LAST, only after every real
   teacher is at cap, and only for their subjects. Placeholder creation writes the `facultySubject` row(s) for the chosen
   subject(s). Expose one endpoint for A6: create a to-be-hired teacher for subject S + hours H and assign the uncovered
   pairs of S to it in one call (reuse/replace `coverage/repair`), returning what was assigned.
4. Apply 409 names the changed classes (section + subject), and a stale `KEPT_EXISTING→INSERT` flip re-previews instead
   of failing — Codex could not apply a fresh preview twice; find why and fix it.
5. One load definition: `computeEffectiveWeeklyTeachingMinutes` used by generator validator, TL truth panel, auto-fill,
   rebalance; TL and generation must agree on who is over limit (live: generator 5 over, TL 0).
6. Policy save must not reset 1800/300/2400 (`policyPaneModel.ts:20-60`) — carry the fields through (small client touch allowed).
Server suite green; atlas-qa (MEDIUM) before merge; items 3 and 5 touch generation → atlas-reviewer-high pre-merge.
Push to main; post ready-for-release with the API contract for A6. Do not end the run to wait for Lane C.
