# S8 — SHIFT-COHERENCE-C01 correction packet (2026-09-25)

Bounded correction over the reviewed candidate. Governing packet:
`docs/prompts/shift-coherence-c01-2026-09-25.md` (this addendum overrides it where they differ).
Program `docs/plans/teacher-concern-authority-plan-2026-09-24.md`, stream **S8**, decision **D11**.

- Prior candidate (must remain an ancestor): `5a47d11457e6287237ed74173a681fe1a67017a4`
- Branch / worktree (single writer): `work/shift-coherence-s8` / `E:/ATLAS-worktrees/shift-coherence-s8`
- Fresh independent QA returned `CORRECTION_REQUIRED` 9/10, blocked 1, unperformed 0.
- Do **not** amend, rebase or force-push. Add one new commit on top of `5a47d114`.

## R1 — BLOCKING: `SchedulingPolicyPane.tsx` exceeds the §8 1000-line cap

`atlas-client/src/components/SchedulingPolicyPane.tsx` is **1060** physical lines by the B5 guard metric
(`base 1021`, already red). AGENTS §8 is mandatory and the candidate touched the file. Extract one or
more cohesive sub-components so that:
- `SchedulingPolicyPane.tsx` is **≤ 1000** physical lines, and every file you add is ≤ 1000;
- no control, copy, prop or behaviour is removed — this is a pure extraction;
- `timetable-relaxed-main-b02.test.tsx` **B5** now passes (it is red at base; record that).

Authorized new/changed client paths for R1: `atlas-client/src/components/SchedulingPolicyPane.tsx` plus
new files under `atlas-client/src/components/`. Do not touch `atlas-client/src/pages/**`.

## R2 — producer→consumer parity (gate 3)

Add the new server rejection reason `SHIFT_COHERENCE_CONFLICT` to the client contract with truthful
scheduler-facing copy:
- `atlas-client/src/types.ts` — `TeachingLoadCandidateRejectionReason` union.
- `atlas-client/src/lib/teaching-load-suggestion-diagnostics.ts` — `CANDIDATE_REJECTION_LABELS`,
  `CANDIDATE_REJECTION_DETAILS`, and `CANDIDATE_REJECTION_ORDER`.

Fix the silently-truncating union extraction in
`atlas-client/src/lib/__tests__/tl-operator-workspace-c05.test.ts`
(`/export type TeachingLoadCandidateRejectionReason =([\s\S]*?);/` stops at the first `;`, so a comment
containing `;` truncates the union and the "every emitted reason has copy" invariant is unenforced).
Make the extraction robust (strip comments and/or anchor to the declaration-terminating `;`). The fixed
test must fail before R2's client additions and pass after — that is your failing-first control.

Residual accepted, do not expand scope: `shiftCoherenceNotices` stays server-only (mirrors the S7
`preferenceNotices` residual); the server `warnings` line names who/why.

## R3 — mandatory runtime row; correct packet §5.4

The original packet §5.4 forbade `migrate` outright, which unintentionally forbade the repository's
sanctioned `test:server-db` disposable harness. Corrected authority:

- `prisma migrate deploy` **is authorized only** against the ephemeral `atlas_restore_drill_*` database
  created and dropped by `atlas-server/src/__tests__/helpers/tt-source-freshness-db.ts` /
  `atlas-server/scripts/run-db-suite.mjs`.
- It remains **forbidden** against `atlas_recovery_clean_rebuild_20260905` or any shared/live database.
  Never `prisma migrate reset`, never `db push --force-reset`.
- No migration is applied to the shared database by this correction.

Add the **real production route on PostgreSQL** row: extend the existing disposable-DB suite
`atlas-server/src/__tests__/teaching-load-suggestion-authority-c03.test.ts` (it already mounts
`POST /api/v1/faculty-assignments/auto-fill` with `previewOnly:true` and asserts `candidateRejections`)
with a shift-window fixture (`gradeShiftWindow` rows: G7/G8 `06:00–15:30`, G9/G10 `09:45–18:30`) and a
teacher assignable across a G7 and a G9 section. Assert through the mounted route:
- `enableShiftCoherenceGuard=true, enforce...=false` → the preview returns the bounded, named
  `shiftCoherenceNotices[]` and a `warnings` line; the assignment still occurs;
- `enforce...=true` → the spanning assignment is prevented and the row is reported with the typed
  `SHIFT_COHERENCE_CONFLICT` reason (via the route's `candidateRejections`), with no thrown error;
- zero write on the preview path and the disposable database is dropped (zero residue).

## Preserve / prove

- `5a47d114` remains an ancestor of the correction commit.
- All previously reviewed paths **not** touched by R1–R3 retain their `5a47d114` blobs. State which
  paths changed and which are unchanged.
- Re-run and record: `npm run test:shift-coherence`, `npm run test:faculty-grade-preference`,
  `npm run test:server-suite`, the disposable-DB row (via `test:server-db` / its runner), server
  `npm run build`, client `typecheck` + `build` (with `VITE_ENROLLPRO_URL`), `git diff --check`.
- Known pre-existing red (reproduced at base, not a regression): 4 failures in
  `atlas-server/src/__tests__/tt-output-c03r.test.ts`. Leave untouched.
- Still forbidden: generation, publication, migration apply to shared data, deployment, login, and any
  companion-repo edit.

## Evidence

One new commit (do not push). Handoff: prior candidate SHA · correction SHA · exact changed paths ·
what changed and why · decisive commands actually run with results · confirmation that `5a47d114` is an
ancestor and unchanged reviewed paths kept their blobs · each risk marked `BLOCKING`/`NON_BLOCKING` ·
verdict `REVIEW_REQUIRED`. Then a fresh independent QA reviews the correction commit and its blast
radius.
