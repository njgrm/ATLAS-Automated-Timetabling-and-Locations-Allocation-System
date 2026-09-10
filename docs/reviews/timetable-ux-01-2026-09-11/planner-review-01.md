# TT-UX01 planner review 01

## Verdict

`CORRECTION_REQUIRED`

Reviewed range:
`aab8fb002fb54d0f009525fd68ddc99b9baa5f88...aa38d7845ed7fafa79638b9512b584c29400d48e`

## Material findings

1. The no-run repair action uses `/curriculum-requirements` in both the
   dispatcher and rendered link. That route is not mounted, and Curriculum
   Requirements is no longer the intended operator authority. This is a
   dead/superseded recovery path.
2. Advanced-mode `Generate` and `Regenerate Draft` do not consume the Simple
   lifecycle's actor-scope and readiness gate. This preserves a split-brain
   generation bypass.
3. Advanced mode still exposes run-derived task modes and defaults its next
   task to `Review schedule` when no generated run exists.
4. The teacher-departure recovery action remains enabled with null run/draft
   inputs.
5. `runToolsAvailable` conflates a generated run with a pre-generation draft,
   leaving generated-session actions eligible in the wrong state.
6. The tutorial reports absent targets but is not lifecycle-aware; it still
   teaches run-only actions in the no-run state.

## Independent checks

- Candidate ancestry and clean worktree: pass.
- Exact changed paths: matched handoff.
- Focused Timetable operator suite: 34/34 pass.
- All tracked client test files: 155/155 pass.
- Client TypeScript: pass.
- Client production build: pass.
- Committed-range diff check: pass.

The candidate is directionally useful and its fixes should be retained, but it
is not accepted and must not be merged or pushed to `main` yet.
