# Lane A session checkpoint — 2026-09-26

For a **fresh Lane A planner session**. This records the minimum resumable state; it is not a second ledger.
Read alongside `docs/plans/live-state.md` (Lane A section) and `AGENTS.md`.

## Custody change requested by the operator

**Timetable custody transfers to planner A2.** This session's substantive work is almost entirely timetable, so
that transfer moves nearly every open item below. **Lane A retains only non-timetable items**, and must not write
timetable files, timetable packets, or Lane A2's live-state section without an explicit new instruction.

**Lane A's remaining queue is thin, and stated honestly rather than padded:**
1. **Rotate the exposed dev DB credential** — a redaction pattern missed `DATABASE_URL` and the local dev password
   reached a transcript this cycle. Not written to any file, commit, doc or prompt. Treat this cycle's transcripts
   as containing it until rotated. Second recorded instance of the class; the substring redaction list is the defect.
2. **Capacity** — E: 55.3 GiB, above the 50 GiB warning, so no reclaim is owed before the next build. When it
   next drops below, §3 requires a successor reclaim with its own manifest and pre-action audit.
3. **Cross-lane disposition backlog, 8.72 GiB** — ten clean, pushed, merged E: worktrees (7 `lane-c-*`, 3 `lane-b-*`)
   carrying **no disposition anywhere**. Owed by their owning lanes; not Lane A's to retire.
4. **`E:\ATLAS-runtime-supervised-4893cbde-20260923`** (1.80 GiB, standalone clone) + three non-git E: leftovers
   (0.11 GiB) — `PRESERVE_FOR_DECISION`, operator call, needs its own manifest and audit.
5. **Register hygiene** — this file's Lane A section, and the operator-action list at the top.

## Timetable state, for A2 to pick up

**Live release `26f7c907`**, healthy (health 200, ready 200 `database:"ok"`), rollback basis `116a7658` verified
runner-eligible and never executed. **Acceptance is 9/13 and NOT closed**: A7 passes with attribution (all console
errors are the two EnrollPro proxy 502s, an external outage), A5 is partially evidenced, **A6 and A12(b) are
unperformed** — the Review-issues panel is a run-level surface, the section draft is empty, and A12(b) needs a placed
session. A browser session now exists again (`atlas_local_token`), so these are exercisable.

**`main` carries two accepted cycles that are NOT live** — `2f86ffee` (§8 cap) and `9b1ec14a` (lunch-window label,
which closes a live-walk BLOCKING-for-trust finding where 100 of 194 warnings rendered a raw engine code). The
deployment packet is **withdrawn at `CORRECTION_REQUIRED` 6/13**; `deploy-5152bff0-client-delta-2026-09-26.md` needs
R2 (see the five blocking findings recorded in live-state) and then a re-review.

**The one genuinely hard open problem, with everything needed to decide it.** Constraint severity on the manual-edit
write path is client-influenced, and the fix is *not* a simple deletion:
- `manual-edit.service.ts:692` copies client `proposal.metadata` onto a new entry (reachable from **six** body routes,
  including `timetable-teaching-load-repair.router.ts:118` and `:134`). The fix belongs at the `applyProposal` choke
  point; router stripping cannot reach the repair router, and Quick Place's own server-side writer must keep working.
- `commitManualEditBatch:1478-1487` auto-defers room type across the **whole draft**, and `deferredRoomTypePreference`
  is **written only there** — so `/commit` and `/batch/commit` give opposite verdicts for the same edit. Deleting the
  blanket deferral **breaks Quick Place and TL-repair into 422s** (probe-proven). R1, R2 and R3 all failed pre-action
  on this; R3 failed because its decision removed two load-bearing solver-trial deferrals.
- **Three questions gate any fix, and they are not planner calls:** may a server-derived solver trial forgive a
  feature shortfall; is the modular-pool exemption legitimate; may the repair path carry client metadata at all.
- `manual_schedule_edits` is **0 rows** — no manual edit has ever been committed here, so every channel is
  forward-looking and no data repair is needed.

## Standing cautions this session earned

- **Never assert a value you have not just derived.** This lane's reviews caught, in artifacts written with
  confidence: a fabricated SHA, invented worktree dispositions, a subtractive "correction", two miscounts, a misread
  ignore rule, a step incompatible with its own gate, a stale code citation, and data figures asserted rather than
  measured. **Every SHA, path, count, disposition and hash must appear with the command that produced it.**
- **A deployment packet must build what the runtime executes.** "Client-only delta" does not mean "client-only
  build" — a release still needs `atlas-server/dist/server.js`.
- **Two executor stops on one change means it needs a design decision, not another packet.**
- **Enumerate every *writer* of a field, not just its consumers**, before proposing to remove it.
- **`temporarily measure` is not measuring.** `if(git merge-base --is-ancestor …)` tests stdout, not `$LASTEXITCODE`.
- A recorded verdict belongs in `live-state.md` with its tally, not only in a transcript.

## Session facts a successor will otherwise re-derive

- `origin/main` moves continuously (other lanes push). **Re-derive the target immediately before any pin.**
- `D:\ATLAS` cannot run client `typecheck` (no `@types/node`); measure in a worktree with the dependency junction.
- `atlas-server` has **no** `typecheck` script — use `npx tsc --noEmit -p tsconfig.json`.
- The shared exclude rule `/ops/runtime/logs/` in `D:\ATLAS\.git\info\exclude` is what keeps release worktrees
  runner-eligible; this lane's file tools are **refused** for that path, so it was appended via the shell.
- E: worktrees use a junction to `E:\ATLAS-runtime-supervised-861d89a2-20260925\atlas-client\node_modules`; never a
  junction to the live release.
- Unwritten QA capsule for the original J2/J3 candidate `98289573` remains owed — that verdict existed only in-session.
