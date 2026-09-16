# WF-TRANSITION-TERMINAL-RECONCILE-C09 — packet REVISION 2 (authoritative delta)

ROLE: EXECUTOR. Variant `high`. Risk MEDIUM (ops/workflow delivery-cycle authority).

Revision 1 is `docs/prompts/wf-transition-terminal-reconcile-c09-2026-09-16.md`.
**Sections replaced or added by R2 are authoritative over R1.** Everything else in
R1 stays in force unchanged and must still be implemented: §2 owned/forbidden
paths, §3.1 `reconcile-stream`, §3.2 `resolve-decision`, §3.3 `abandon-stream`,
§3.4 `RUNNING_WITHOUT_LIVE_EVIDENCE` + `create-stream` atomic lease, §3.6
determinism plumbing, §3.7 optional `resolution`, §3.8 renderer, §6 evidence and
cleanup, §7 commit workflow and return contract, §8 session routing.

## R2.0 Why revision 2 exists

1. **C1 — blocking defect in R1.** `WF-C01` (COMPLETE) pins
   `ops/workflow/schema/cycle-state.schema.json` at `af435c56…`. The R1 §3.7 edit
   invalidates that pin and **no existing transition can refresh an artifact
   pin**. Left unfixed the register can never verify exit `0`, and because
   `abandon-stream`'s repair-read tolerates only the liveness code, every one of
   the seven register repairs fails `TRANSITION_STATE_INVALID`. Hand-editing the
   register is forbidden and splitting §3.7 out of this stream is forbidden, so
   R2 adds the missing sanctioned mechanism: §R2.9 `refresh-artifact-pin`.
2. **C2 — R1 §5 was over-constrained.** `__fixtures__/pass-ordinary.json` declares
   `ORD-1` RUNNING with `leases: []`, so the R1 §3.4 rule forces a minimal fixture
   change. See §R2.5b.
3. **R1 §3.5 deadlocked.** Once two independent repairable defect classes coexist
   (`RUNNING_WITHOUT_LIVE_EVIDENCE` and `ARTIFACT_HASH_MISMATCH`), a per-class
   "strict subset of offending stream ids" rule blocks each class with the other
   and the document becomes unrecoverable. §R2.5 replaces it.
4. **Operator capability ADD.** §R2.10 register revision-window reservation.

Register base is `registry.revision` **218**. Worktree
`E:/ATLAS-worktrees/wf-transition-terminal-reconcile-c09`, branch
`work/wf-transition-terminal-reconcile-c09`. Accepted base = the commit that
contains this file (`git rev-parse HEAD`); pass that SHA as `--base` when the
return is recorded. Register the directive from the worktree `AGENTS.md`
(LF-normalized SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`).
Budget 150 minutes; report at 112 and freeze scope.

## R2.1 Residual adoption (this session continues prior work)

A previous executor session hit its step limit with **uncommitted** work in the
worktree: 15 modified files under `ops/workflow/**` plus the new
`ops/workflow/__tests__/terminal-reconcile.test.mjs`. The planner inspected it and
adopted it (all paths are inside the owned set; no product file is touched). Adopt
it as your starting point, but **re-verify every claim yourself** — it is adopted
on inspection, not on trust. It is not a frozen candidate and no commit exists.

Its measured state: `terminal-reconcile.test.mjs` 27/27, `coverage.test.mjs`
40/40, full suite 306 tests / 293 pass / 13 fail, where 11 failures are the C1 pin
mismatch and 2 are the traversal update. Treat all of that as unverified.

## R2.5 Replaces R1 §3.5 — the sanctioned repair-read

- **Closed repairable-class set** (exact verifier codes):
  `REPAIRABLE = { "RUNNING_WITHOUT_LIVE_EVIDENCE", "ARTIFACT_HASH_MISMATCH" }`.
- **Current-document read:** allowed if and only if every error reported for the
  current document is in `REPAIRABLE`. Any other current error still fails
  `TRANSITION_STATE_INVALID` with zero mutation.
- **Candidate:** must contain no error outside `REPAIRABLE`, and its multiset of
  repairable errors must be a **sub-multiset** of the current document's — compare
  sorted `code|path` tuples with multiplicity. If the current document has no
  repairable errors, the candidate must have none. Violation is typed
  `TRANSITION_REPAIR_NOT_MONOTONE` with zero mutation.
- Do **not** implement this as a CLI flag, and do **not** special-case a
  transition name. One engine-level rule, one closed set.
- Consequences to prove with tests: no transition can *introduce* a repairable
  defect (a `create-stream` with a `RUNNING` spec and no lease is refused because
  it would add a liveness defect the current document does not have); a transition
  that neither reduces nor introduces is allowed on a defective document and
  publishes it unchanged in that respect (`verify-cycle.mjs` still exits `1`); the
  document is always eventually repairable because `abandon-stream` and
  `refresh-artifact-pin` strictly reduce; and with zero repairable errors the
  behaviour is exactly as before.
- The README must carry the safety argument: why a fully clean candidate is no
  longer required (two independent defect classes must coexist during repair) and
  why nothing can be hidden (no new class, no introduced defect, `verify-cycle`
  stays red until the count reaches zero).

## R2.9 New transition `refresh-artifact-pin` (mandatory satisfiability repair)

Refreshes exactly one stale artifact attestation on a settled stream. It exists
because the packeted schema edit invalidates `WF-C01`'s pin and no sanctioned
mechanism could repair an attestation.

- Stream-scoped. `from: ["COMPLETE", "INTEGRATED", "CLOSED"]`.
- Required flags: `--artifact-path <repo-relative path>` (resolved against the
  repository root exactly as artifact verification resolves it),
  `--artifact-sha256 <lowercase 64-hex>`, `--reason <text>`.
- Guards, each typed, fail-closed, zero mutation:
  1. the stream must already carry an `artifacts[]` entry for exactly that path →
     `TRANSITION_ARTIFACT_NOT_PINNED` (you may not pin a new file);
  2. the file must exist and its current working-tree bytes must hash to exactly
     `--artifact-sha256` → `TRANSITION_ARTIFACT_HASH_MISMATCH` (you cannot invent a
     hash and cannot pin bytes you do not have);
  3. the state must be one of the three allowed → else
     `TRANSITION_ARTIFACT_STATE_FORBIDDEN`.
- Effect: exactly one `artifacts[i].sha256` changes; path unchanged; no artifact
  added or removed; no receipt; nothing else changes except `stateUpdatedAt` and
  `registry`.
- Must be exercised in the lifecycle traversal and added to the transition
  coverage map.

## R2.10 New capability — register revision-window reservation

`registry.windows[]` entries are
`{ streamId, fromRevision, toRevision, holder, declaredAt }` (schema shape is in
R2.10b).

- **Declaration.** `create-stream` gains `--register-window-to <revision>` and
  `--register-window-holder <identity>` (required when the `to` flag is present;
  default holder = the created stream's id); `fromRevision` = the register
  revision at declaration. `lease-update` gains the symmetric path for an
  already-created stream: `--window-declare <streamId> --window-to <revision>`
  with optional `--window-from <revision>` (default: current revision) and
  `--window-holder <identity>` (default: the named stream's id).
- **Check, in every transition before any mutation.** If a window satisfies
  `fromRevision <= registry.revision <= toRevision` and it is not the invoking
  holder's, fail closed with `TRANSITION_REVISION_WINDOW_HELD`, zero mutation, no
  receipt, render byte-identical. A transition is the holder's own when either
  `--by` equals the window's `holder`, or the transition's target stream id equals
  the window's `streamId`. Document that `holder` is an attestation at the same
  trust level as the existing `--by` flag, and that document-scoped transitions
  are subject to the same check (so a holder passes `--by <holder>` for its own
  pre-integration `coordination-update`).
- **Release.** Automatic: the window is removed in the same candidate when its
  holder stream reaches `INTEGRATED`, `COMPLETE`, `CLOSED`, or `SUPERSEDED`.
  Explicit: `lease-update --release-window <streamId>`, which is the holder's own
  step. Because a stuck holder would otherwise lock the span, explicit release is
  always available and is the documented remedy. Never delete a window by hand.
  The exact `--release-window` name is fixed.
- **Declare C09's own window as `fromRevision` 218, `toRevision` 227**, holder
  `WF-TRANSITION-TERMINAL-RECONCILE-C09`, as literal step 0 of §R2.4. Every step
  passes `--by WF-TRANSITION-TERMINAL-RECONCILE-C09` so all steps are the holder's
  own and remain legal inside the span. For the record: the operator's steer named
  `218 -> 225` for a seven-step plan; the mandatory §R2.9 pin refresh makes the
  honest plan nine steps with window `218 -> 227`. State this in the handoff.
- **Mandatory negative fixture.** A second `create-stream` attempted at a revision
  inside a held window, with a `--by` other than the holder, must exit non-zero
  with `TRANSITION_REVISION_WINDOW_HELD` and leave the register, the generated
  register, and every receipt byte-identical. Also prove the self-holder path
  succeeds inside the same span.

### R2.10b Schema additions (extends R1 §3.7 — no `contractVersion` bump)

Use only keywords the engine already supports; `findUnsupportedKeywords` must stay
empty.

- `$defs.stream.resolution`: `type: ["object","null"]`, declared in `properties`,
  **not** in `required`. `$defs.resolution` with `additionalProperties: false` and
  `required: ["disposition","resolver","text","resolvedAt","supersededBy"]`:
  `disposition` enum `["SUPERSEDED","CLOSED"]`; `resolver` string `minLength: 3`;
  `text` string `minLength: 1`; `resolvedAt` `$ref: "#/$defs/isoRequired"`;
  `supersededBy` `type: ["string","null"]`.
- `registry.windows`: `type: "array"`, declared in `registry.properties`, **not**
  in `registry.required`, items `$ref: "#/$defs/revisionWindow"`.
  `$defs.revisionWindow` with `additionalProperties: false` and
  `required: ["streamId","fromRevision","toRevision","holder","declaredAt"]`:
  `streamId` string `minLength: 1`; `fromRevision`/`toRevision` integer
  `minimum: 1`; `holder` string `minLength: 1`; `declaredAt`
  `$ref: "#/$defs/isoRequired"`.
- `resolution === null` and a missing `windows` key both mean "absent" — no rule
  fires; readers treat missing `windows` as `[]`.
- New typed verifier errors: `RESOLUTION_INCONSISTENT` (`resolution` non-null and
  `resolution.disposition !== stream.state`, or `supersededBy` null while the
  disposition is `SUPERSEDED`); `RESOLUTION_SUPERSEDED_BY_UNKNOWN`;
  `WINDOW_INVALID` (`toRevision < fromRevision`); `WINDOW_UNKNOWN_STREAM`.
- **No `contractVersion` bump and no migration step.** Reason for the handoff:
  both properties are optional and lazily materialized, so every historical
  record, fixture, and `specs/register/*.json` spec stays byte-identical and no
  historical identity is rewritten. Document this once in the README as the named
  pattern for *optional, declared, lazily-materialized* properties, and state why
  a required key (a version bump plus a mechanical rewrite of roughly 45 files)
  buys no truth here.

## R2.4 Replaces R1 §4 — the mandatory ordered sequence

Facts you must not design against:

- The register inherits exactly one unjustified `RUNNING` declaration:
  `TERM-CACHE-CATCHUP-APPLY-REFRESH-C01` (no lease at all, no heartbeat naming it).
  Its owned worktree
  `E:/ATLAS-worktrees/integration-wf-seed-term-cache-tl-c06-20260916` currently
  exists and is clean, which is what lets the `PLANNED` outcome pass
  `PLANNED_WITH_DIRTY_WORKTREE`. Re-check that immediately before step 1.
- `WF-C01` pins the schema file, so from the moment the §3.7/R2.10b edit is in the
  working tree the register also carries `ARTIFACT_HASH_MISMATCH` until step 2.
- After the sequence the register has no unjustified `RUNNING` stream and no stale
  pin, so `verify-cycle.mjs` exit `0` and `render:check` exit `0` are achievable.
  Your own stream is `RUNNING` **with** an `ACTIVE` lease, so it is justified.
- Known, bounded staleness you must **not** repair: the committed C09 record's
  `nextAction` and `blocker.safeWorkItems` still say "seven-step ... 218-225". The
  planner corrects those at the executor return; the record is `RUNNING`, and
  `reconcile-stream` deliberately cannot touch `RUNNING`. Do not add a step.

Run these **nine** transitions from revision 218, in this order, with these literal
`--expect-revision` values and `--by WF-TRANSITION-TERMINAL-RECONCILE-C09` on every
one:

| # | transition | stream | rev | target |
|---|---|---|---|---|
| 0 | `lease-update --window-declare WF-TRANSITION-TERMINAL-RECONCILE-C09 --window-from 218 --window-to 227 --window-holder WF-TRANSITION-TERMINAL-RECONCILE-C09` | — | 218 → 219 | declares the reservation span |
| 1 | `abandon-stream --reason <text> --next-action <text>` | `TERM-CACHE-CATCHUP-APPLY-REFRESH-C01` | 219 → 220 | `PLANNED`, `running: []`, `awaited: []`, orphaned next action |
| 2 | `refresh-artifact-pin --artifact-path ops/workflow/schema/cycle-state.schema.json --artifact-sha256 <current file hash> --reason <text>` | `WF-C01` | 220 → 221 | refreshes the schema pin |
| 3 | `reconcile-stream --blocker-safe-work-remaining false --blocker-safe-work-items []` | `TERM-CACHE-CATCHUP-APPLY-REFRESH-C01` | 221 → 222 | stale safe-work list cleared |
| 4 | `resolve-decision --disposition SUPERSEDED --superseded-by TT-WARNING-COUNT-C07A-R1 --resolver <identity> --resolution <text> --next-action <text>` | `TT-WARNING-COUNT-C07A` | 222 → 223 | `SUPERSEDED` + `resolution`, `awaited: []` |
| 5 | `reconcile-stream --blocker-safe-work-remaining false --blocker-safe-work-items []` | `TT-WARNING-COUNT-C07A` | 223 → 224 | blocker normalized |
| 6 | `reconcile-stream --blocker-safe-work-remaining false --blocker-safe-work-items []` | `TL-DIAGNOSTICS-LOADING-C06` | 224 → 225 | `safeWorkRemaining false`, items `[]` |
| 7 | `reconcile-stream --next-action <text>` | `WF-C02` | 225 → 226 | stale forward-looking next action replaced |
| 8 | `reconcile-stream --next-action <text>` | `WF-SEED-PIN-C01` | 226 → 227 | stale forward-looking next action replaced |

Final register revision **227**. Step 1 must precede any transition that needs a
clean document; steps 0–2 are the ones permitted while the two repairable defects
exist. If any `--expect-revision` disagrees, stop and report the actual revision —
a concurrent write is a coordination event, not a retry.

## R2.5b Correction to R1 §5

Replace R1 §5's extra control "No historical churn: ... no fixture byte changes"
with: **the only permitted fixture change is the minimum evidence change needed to
satisfy §3.4 for existing `RUNNING` declarations, enumerated path-by-path in the
handoff.** The known required instance is
`ops/workflow/__fixtures__/pass-ordinary.json`: `ORD-1` is `RUNNING` and must gain
an `ACTIVE` lease (`lease-ord-1`, `streamId: "ORD-1"`), which is the preferred
deterministic proof. `__fixtures__/expected.json` must not change; no expectation
may be weakened. Every other fixture must stay byte-identical. All other R1 §5
controls stand, and the matrix gains two rows: one for `refresh-artifact-pin`
(positive refresh plus its three guarded refusals) and one for the revision-window
negative fixture and self-holder control. Raise `--gates-plan MANDATORY_SOURCE` to
the resulting total at acceptance; it may only increase.
