# Changed-Scope Advisory Review — D-1 Fix (Adviser-Transfer Hard-Cap Gate)

- **Reviewer identity:** `REVIEWER_E_CHANGED_SCOPE_ADVISORY` (no execution-system context handle exposed by the harness to this reviewer; independent of the implementation executor and of advisory reviewers A/B/C/D).
- **Artifact role:** Fresh changed-scope advisory review of the D-1 fix only. Advisory evidence only; not formal planner/QA acceptance, no GO, no unlock authority.
- **Reviewed diff identity:** Working tree vs HEAD `3d210335c8eee7f39efbfbf21d326649289bee34` (branch `work/teaching-load-tlc02`, worktree `D:\ATLAS-worktrees\teaching-load-tlc02`). The D-1 fix is the uncommitted working-tree change at `atlas-server/src/services/teaching-load-reconciliation.service.ts` plus the A14 fixture in `atlas-server/src/__tests__/teaching-load-reconciliation.test.ts`.
- **Review boundary:** ONLY the changed scope enumerated in the review prompt. Pre-existing candidate behavior outside this scope (already covered by `advisory-review-D-whole.md`) is not re-adjudicated. Whole-candidate finding **D-1 (HIGH)** was the single material defect; no new whole-candidate findings were carried forward into this changed-scope pass.

## Changed-Scope Inventory

1. `atlas-server/src/services/teaching-load-reconciliation.service.ts` — adviser-own-section transfer pass (step 4, lines ~1044–1051): the hard-cap gate now computes `gateMinutes` from `subjectById.get(pair.subjectId).minMinutesPerWeek` (falling back to `pair.weeklyMinutes` only when the subject row is missing), and refuses the transfer when `adviserMinutes + gateMinutes > hardCap`. Pre-fix gate was `adviserMinutes + pair.weeklyMinutes > hardCap` (D-1 evidence, old `:1045`).
2. `atlas-server/src/__tests__/teaching-load-reconciliation.test.ts` — new section A14 (`:539–584`): offering minutes (120) < credited minutes (240), adviser already carries 60, hardCap 240 → asserts no transfer, adviser outcome unsatisfied with `HARD_CAP_CONFLICT_OR_NO_SAFE_TRANSFER`, and adviser stays at 60 (never over cap).

## Gates Inspected (Item 1 — no other un-credited gate)

All hard-cap gates in `buildReconciliationPlan` now use the credited minutes (`subject.minMinutesPerWeek`), consistent with the simulated-load credit path `minutesForAssignedPairs` → `computeTeachingLoadMinutes` (subject catalog minutes, `teaching-load-reconciliation.service.ts:491–530`):

| Gate | Location | Minutes source |
|---|---|---|
| Fill `pickCandidate` | `:673–694` | `gateMinutes = gateSubject ? Math.max(0, gateSubject.minMinutesPerWeek) : pair.weeklyMinutes` (`:686`), `currentMinutes + gateMinutes > hardCap` (`:694`) |
| Rebalance | `:979` | `recipientMinutes + pair.subject.minMinutesPerWeek > hardCap` (donor pair carries the subject object; credited minutes) |
| Adviser-own-section transfer | `:1048–1051` | `gateMinutes = gateSubject ? Math.max(0, gateSubject.minMinutesPerWeek) : pair.weeklyMinutes` (`:1049`), `adviserMinutes + gateMinutes > hardCap` (`:1051`) |

No other hard-cap comparison exists in the reconciliation service (grep for `hardCap` confirms only `:694`, `:979`, `:1051` are gates; `:548–549` is post-hoc classification over credited minutes; `:1287`, `:1457` are reporting). The adviser pass contains exactly one gate and it is credited-minutes-based; the section-pair scan order (by offering `weeklyMinutes`, `:1034`) does not bypass the gate because the loop `continue`s past pairs that fail the credited gate and picks the first pair that passes (`:1038–1053`). The `pair.weeklyMinutes` fallback (`:1049`) is defensive-only: demand pairs are derived from subject-bearing offerings, and the simulated-load credit also skips subject-missing pairs (`:513–514`), so the fallback cannot create an over-cap adviser in any reachable state.

## Commands Independently Rerun (read-only)

| Command | Result |
|---|---|
| `npx tsx src/__tests__/teaching-load-reconciliation.test.ts` (server, worktree) | **134 passed, 0 failed** (includes new A14 section) |
| `npx tsc --noEmit` (server) | exit 0 |

## Adversarial Probes (adviser-transfer path)

Scratch probe `advisory-probe-E.ts` created OUTSIDE the repository (`C:\Users\njgro\AppData\Local\Temp\opencode\`), importing the service via `pathToFileURL`, run with `npx tsx` from the worktree server dir, then deleted. **21/21 assertions passed, exit 0.** No source file in the repository was created, edited, or deleted; `git status --short` after cleanup matches the pre-review state exactly.

- **E-P1 — adviser exactly at cap boundary; offering minutes > credited minutes.** ENG credited 120 with offering 300; hardCap 120, standard 120; adviser carries 0. Result: transfer GRANTED (0+120 = 120, boundary inclusive — gate uses `>`, not `>=`), adviser lands exactly at 120, `at-standard`, never over. Discriminator proven: an offering-minute gate (0+300=300 > 120) would have refused (over-conservative) — probe fails on pre-fix/offering logic.
- **E-P2 — multiple qualified pairs; scan must skip offering-small/credited-large and pick the credited-fit pair.** ENG credited 240 with offering 120 (owned by faculty 3); MATH credited 120 with offering 240 (owned by faculty 1); hardCap 200; adviser carries 0. Scan order (offering asc) = ENG first. Result: ENG correctly skipped (0+240 > 200), MATH transferred (0+120 ≤ 200), adviser at 120 ≤ cap, ENG remains with its qualified owner. Discriminator proven: a pre-fix offering gate (0+120 ≤ 200) would grant ENG and push the adviser to 240 > 200 — exactly the D-1 defect class.
- **E-P3 — A14 discriminator confirmation.** Replicated the A14 fixture against the fixed code: no transfer, adviser stays at 60, `HARD_CAP_CONFLICT_OR_NO_SAFE_TRANSFER`. Pre-fix math recomputed from the same snapshot: `60 + offering(120) = 180 ≤ 240` → the pre-fix gate WOULD grant MATH:101, after which the credited load is `60 + 240 = 300 > 240`. A14's `assert(!transfer)` and `afterMinutes === 60` assertions therefore fail on the pre-fix code — the fixture is a genuine negative control for D-1 (it discriminates pre-fix vs fixed, not merely exercising the new code path).

## Findings

- **New material findings in the changed scope: none.** The D-1 gate fix is correct, matches both sibling gates, and is covered by a discriminating negative fixture (A14) plus the three probes above.
- Informational (no action required, pre-existing/non-blocking):
  - I-1: The `pair.weeklyMinutes` fallback at `:1049` is unreachable in any state where the pair is demanded (demand derives from subject-bearing offerings) and the credit path also skips subject-missing pairs, so it cannot reintroduce D-1. Noted for completeness only.
  - I-2: The adviser pass sorts section pairs by offering `weeklyMinutes` before scanning (`:1034`); selection is still gated on credited minutes, so ordering is an optimization only and does not affect cap safety. Noted for completeness only.

## Verdict

**`zeroFix: true`**

The changed scope satisfies the D-1 requirement: the adviser-own-section transfer gate uses the credited `subject.minMinutesPerWeek`, no hard-cap gate in the adviser pass or anywhere else in the reconciliation service uses the un-credited offering minutes, A14 is a genuine pre-fix-failing negative control, and the three adversarial probes confirm boundary inclusivity, credited-minutes selection across multiple qualified pairs, and A14's pre-fix discriminator. Required commands pass (134/0; `tsc` exit 0). No repository source files were modified by this review.