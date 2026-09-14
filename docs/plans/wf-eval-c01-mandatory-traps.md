# WF-EVAL-C01 mandatory traps (operator steering 2026-09-14)

Provenance: operator steering issued during the `workflow-c02-c03-serialized-wave-2026-09-14`
cycle. The WF-C02 candidate was already frozen, integrated, and pushed
(`5d902bf4` -> merge `386fdaf1` -> closure-record `719947af`) when the steering
arrived. Per its freeze rule, these safeguards are recorded here as mandatory
WF-EVAL-C01 evaluation traps (and, where operational, WF-C03 follow-up items)
instead of mutating the frozen WF-C02 candidate. The failing fixtures/mutants
required for each trap belong to WF-EVAL-C01's evaluation suite; they must not
be retro-fitted into an already-frozen candidate.

## Trap 1 — HIGH packets must enumerate implicit mutations

A HIGH packet's mutation/expected-delta section must enumerate implicit writes in
addition to the fields present in the application write object, including at
minimum:

- Prisma `@updatedAt` and other ORM-managed timestamps/fields;
- database triggers and generated/derived columns;
- sequence, counter, or row-count side effects;
- authentication/audit effects (login rows, `last_login_at`, session/token
  rows, and any other write performed by the authentication path itself).

Acceptance: a packet that lists only explicit write-object fields must fail
packet verification. Required failing fixture: a HIGH packet whose expected
delta omits an `@updatedAt`, trigger, or auth/audit effect is rejected; the
corrected fixture that enumerates them passes.

## Trap 2 — HIGH rollback must be execution-ready before approval

A HIGH packet is not approval-ready unless the exact executable rollback
SQL/script/command already exists (in the repository or as an approved,
pinned artifact), is guarded (target/environment checks; fail-closed on
mismatch), and has independent pre-action review. "Create the rollback during
execution" must fail packet verification.

Acceptance: a fixture with an absent/placeholder/to-be-authored rollback fails;
a fixture whose rollback artifact is executable, guarded, independently
reviewed, and pinned by path + SHA-256 passes. The packet must carry that pin.

## Trap 3 — settled operator decisions are immutable planning inputs

Recorded operator decisions (for example the D1-D6 contract decisions) are
immutable planning inputs. Historical stakeholder artifacts may be reported as
conflicts, but no stream may reopen, reinterpret, or silently bypass a settled
decision without new explicit operator direction.

Acceptance: a fixture in which a task's acceptance contradicts a recorded
settled decision must fail verification unless it cites a new operator
authorization that changes that decision; the corrected fixture referencing the
decision id and the new operator direction passes.

## Trap 4 — large one-shot executors must checkpoint before expensive final gates

Before running the final expensive verification battery (long suites, browser
matrices, stress runs, exhaustive probes), a large one-shot executor must commit
a checkpoint commit of the coherent work so far. Final gates then run against
the committed checkpoint plus only additive follow-up commits.

Acceptance: an evaluation fixture (or verifier rule) in which a large one-shot
executes its expensive final gates with uncommitted work fails; the corrected
flow (checkpoint commit -> expensive gates -> additive finalize) passes.

## Trap 5 — candidate and final reports must mechanically enumerate every changed path

Candidate and terminal reports must include a mechanically generated changed-path
inventory (`git diff --name-only <base>...<candidate>`) and assert exact set
equality with the declared inventory: no missing, extra, or duplicate entries.
A hand-typed list that only happens to match is insufficient; the enumeration
must be produced by the same mechanical derivation the verifier uses.

Acceptance: a fixture whose declared inventory omits or adds a path fails (this
defect occurred in WF-C02 itself and required a docs-only correction round
before acceptance); the mechanically derived, exactly equal inventory passes.

## Application notes

- WF-C03 (in-flight follow-up): its executor/report contract must apply Trap 4
  (checkpoint commit before the expensive final gates) and Trap 5 (mechanical
  changed-path enumeration of its candidate range).
- This file is the durable record of the steering. It does not modify,
  reopen, or invalidate the frozen WF-C02 candidate or its immutable ranges.
