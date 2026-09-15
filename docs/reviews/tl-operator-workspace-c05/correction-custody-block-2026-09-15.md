# TL-OPERATOR-WORKSPACE-C05 — correction custody block (2026-09-15)

Status: **BLOCKED ON OPERATOR DECISION** — two planner sessions are concurrently
driving corrections on the same stream/one shared writable worktree.

## Timeline (Asia/Manila, 2026-09-15)

- 16:46 — operator activates `CYCLE ON — TL-OPERATOR-WORKSPACE-C05-INTEGRATION`
  in session `ses_f5bc14c53ffec2NDfci3Z9fUOY` (this cycle).
- 17:5x — current-main integration pushed: merge `87aa24a3` (parents `387a1f6d`
  + `05bb8e51`), register records `7b7e9b8b`.
- 18:0x — fresh post-integration Wave Completion Auditor
  `ses_f5b8c0d99ffezvYYAlXQ5os1sv` returns `CORRECTION_REQUIRED` (1 blocking
  finding: F2 cold-load guard self-invalidation; capsule committed at
  `docs/reviews/tl-operator-workspace-c05/wave-completion-audit-r1.md`).
- ~18:12 — the bounded F2 correction is dispatched to the existing C05 executor
  `ses_f5caea1cdffeI2a78f3OZ52hkw` in `E:/ATLAS-worktrees/tl-operator-workspace-c05`.
- 18:14–18:24 — a **second, concurrent writer** stages an unrelated
  "effective load / advisory credit" correction set into the SAME worktree
  (mtimes interleaved with the executor's own edits).
- ~18:26 — the C05 executor stops without any commit: `PLANNER_DECISION_REQUIRED`
  (HEAD still `05bb8e51`; branch `work/tl-operator-workspace-c05` unmoved).

## Second writer identification

- Parent planner session: `ses_f5d0337c7ffeu2szn5tUUpX3vU` ("Beneficiary export
  parity C05 recovery").
- Child executor session (active): `ses_f5b76c347ffecz1IE8yBbqzLNq` ("TL-C05
  correction: ancillary zero in load", `@atlas-executor-delegate`).
- Its new test header declares: `TL-OPERATOR-WORKSPACE-C05 correction C-4 —
  effective-load parity` under an operator-settled contract ("Total Teaching
  Load = Actual Teaching Load + effective Class Advising credit; Ancillary Work,
  ARAL, HG/HGP, and scheduled breaks contribute ZERO credit").
- Foreign files staged in the C05 worktree (left untouched by this cycle):
  - `atlas-client/src/hooks/useTeachingLoadUI.ts` (staged, +10/−?)
  - `atlas-client/src/lib/__tests__/teaching-load-effective-load-parity.test.ts`
    (new, 357 lines)
  - `atlas-client/src/lib/faculty-assignment-helpers.ts` (staged, +22)
  - `atlas-client/src/pages/TeachingLoad.tsx` (staged, +4/−?)

## Preserved F2-correction artifacts (not committed, not lost)

Copied byte-exact out of the shared worktree before further custody risk:

- `%TEMP%\opencode\c05-f2-artifacts\tl-authority-diagnostics-cold-load.test.ts`
  - SHA-256 `56FEA3C5A1AA25C59A1D01F4387DF1D340EFE99A15E8B4223CD47BBBB9095B53`
  - git blob `f51c4b869e863460a95c8200ed37bef4d38cab47`
- `%TEMP%\opencode\c05-f2-artifacts\tl-operator-workspace-c05.test.ts.worktree-1827`
  - SHA-256 `B2B68EDC8F332114E5B7EC001A1FF2D5E04F56B33A77A0BE4B126457B3B16E29`
  - git blob `3ed811cfdb3c658aacaab341aba54022e58cec48`

The executor also disclosed (session `ses_f5caea1cdffeI2a78f3OZ52hkw`) the
proved failing-first mutant for the F2 hook fix: pre-mutant hook blob
`657a7fab7d7bd6b037d65dc1630420b5ec80fb02`, mutant blob
`81a81a0dd9e7bb7fee6ac1f8c009bfac5ba9bfd8` (5 tests, 2 pass / 3 fail), with a
green 65/65 combined run before its uncommitted fix was accidentally discarded
by its own `git checkout` restore. The fix is re-appliable from that session.

Harness constraint to carry into any re-dispatch: `jsdom`,
`react-test-renderer`, `happy-dom`, `linkedom`, and `@testing-library/react`
are all absent and `package.json`/lockfiles are out of scope, so the correction
control drives the real exported production seam and renders the real
`TeachingLoadTruthPanel` through the existing `renderToStaticMarkup` harness
(the r3-truth pattern), not a DOM-mounted hook.

## Why this cycle stopped

Per the standing rules, two planner sessions may not control the same stream or
writable worktree concurrently, and this planner may not stash, reset, clean,
or absorb another stream's edits. The F2 correction cannot proceed in the
shared worktree while the second writer is active, and the combined correction
set (effective-load C-4 + F2 cold-load) must have exactly one owner and one
final candidate before QA/audit/closure.

## Decision requested from the operator

1. **Single owner for the combined correction (recommended):** designate one
   owner for both corrections. If this cycle keeps ownership, the second lane
   commits its four files (only) onto `work/tl-operator-workspace-c05` or hands
   over its patch/tip and stands down; the F2 fix is then layered on top in a
   fresh single-writer worktree; one fresh QA and one fresh post-correction
   Wave Completion Auditor cover the combined candidate before closure.
2. **Second lane owns it:** this cycle stands down from correction/closure and
   hands over the F2 finding, the preserved artifacts, the executor session
   reference, and the audit capsule to `ses_f5d0337c7ffe`, which then owns
   serialization of both corrections, fresh QA, a fresh audit, closure, and
   worktree retirement.
3. **Other explicit sequencing** from the operator.

Until a decision is recorded, do not dispatch further TL-OPERATOR-WORKSPACE-C05
corrections and do not touch either worktree's suspended edits.
