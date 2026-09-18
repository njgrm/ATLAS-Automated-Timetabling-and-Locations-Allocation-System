# PUBLISHED-REVISION-AUTHORITY-C12 — enforce the publication contract on the published-revision path

- Stream: `PUBLISHED-REVISION-AUTHORITY-C12`
- Kind: `CYCLE`, source-only. Risk: `MEDIUM` source. Live publication, live revision
  apply, generation, and deployment remain separately gated `HIGH` and are NOT
  authorized by this packet.
- Base: `2e20e8a6` (current `origin/main`)
- Writable worktree: `E:/ATLAS-worktrees/published-revision-authority-c12` (planner-provisioned)
- Branch: `work/published-revision-authority-c12`
- Additive commits only — do not amend, rebase, or force-push a handed-off candidate.
- Recommended executor reasoning: `high` (cross-layer authority + concurrency).
- Directive: read `origin/main:AGENTS.md` directly. Do not trust a stale worktree copy.

## 0. Why this packet exists

Operator ruling (standing): **the publication gate is zero HARD violations.** A
published revision is a schedule change that becomes beneficiary-visible, so the
same contract must hold on the revision path. It currently does not.

### Proven defects (verified by the planner at `2e20e8a6`)

| ID | Defect | Evidence |
| --- | --- | --- |
| D1 | The published-revision path performs **no hard-constraint validation**. It validates shape only. A revision can introduce a HARD violation into a published schedule. | `atlas-server/src/services/published-revision.service.ts` (494 lines) — zero occurrences of `violation`, `conflict`, `hard`, or `detectConflicts`. Validation present is shape-only: `EFFECTIVE_DATE_*`, `REVISION_REASON_*`, `REVISION_CHANGES_REQUIRED`, `REVISION_CHANGE_FIELD_INVALID`, `REVISION_TERM_INDEX_INVALID`, `REVISION_PREVIOUS_VALUES_INCOMPLETE`, `REVISION_CHANGE_DUPLICATE_ENTRY`, `PUBLISHED_SOURCE_REQUIRED`, `PUBLISHED_REVISION_STATE_AMBIGUOUS`. |
| D2 | There is **no published-safe swap**. A direct swap on a published run fails closed and offers no supported alternative. | Zero `swap` references in `published-revision.service.ts`; `manual-edit.service.ts` `assertRunIsEditable` throws 409 `RUN_ALREADY_PUBLISHED`. |
| D3 | The 409 copy leaks an internal workflow name to operators. | `atlas-server/src/services/manual-edit.service.ts:461` — `'This schedule is already published. Published repairs require the Prompt 6 revision workflow before changes can take effect.'` |

## 1. Required outcomes

**R1 — Revision-time hard-constraint validation (D1).**
Before any write, validate the **merged** entry set — the published run's
currently effective entries with the requested revision changes applied — against
the same hard-constraint authority the publication gate uses. If any HARD
violation results, fail closed with a typed 4xx and **zero writes** to
`PublishedScheduleRevision`, the run summary, or any audit row.

- Reuse the existing canonical violation authority. Do **not** author a second
  constraint engine; a parallel implementation is a defect, not a fix.
- Validation must run **inside** the existing
  `runSerializablePublicationTransaction` (`published-revision.service.ts:5`)
  against the transaction client, not on a pre-transaction read.
- A soft/warning violation must not block; only HARD blocks. Name the exact
  classification you consume and prove it with a control.

**R2 — Bind the revision to the snapshot that produced it.**
The revision must fail closed with a typed stale-source error and zero writes
when a covered input changed between validation and commit. Cover at minimum:
room capacity/type, faculty qualification/ownership, grade-shift windows,
scheduling policy, and special events. A deterministic interleave control must
change one non-demand input and prove the write aborts atomically.

**R3 — Published-safe swap (D2).**
Provide the supported path for a swap on a published run. Either route the swap
through the revision workflow or expose an explicit typed alternative. Whatever
you choose, the direct-swap 409 must remain truthful and must point to the real
supported action. Do not silently mutate a published run.

**R4 — Operator-facing copy (D3).**
Remove the internal `Prompt 6` reference. The message must state the actual
operator action, not an internal packet name. Check for sibling leaks of the same
class across the touched services.

## 2. Production-path proof required

Every row below is mandatory. A helper-only or source-string assertion is not
evidence.

| # | Requirement | Negative control |
| --- | --- | --- |
| 1 | A revision that introduces a HARD violation is rejected with a typed error | Construct the conflicting change; assert zero `PublishedScheduleRevision` rows and zero audit writes |
| 2 | A revision that introduces only a soft violation is accepted | Assert the soft classification is preserved and surfaced, not dropped |
| 3 | A clean revision still succeeds on the real route | `POST /:schoolId/:schoolYearId/runs/:runId/published-revisions` returns success and exactly one revision row |
| 4 | Stale-source interleave fails closed | Mutate one covered input after validation; assert typed stale error + zero writes |
| 5 | Actor-school / actor-year authority | Missing JWT, non-privileged role, cross-school actor, malformed scope → zero downstream dispatch and zero writes |
| 6 | Published swap path | Assert the swap succeeds through the supported path, or the typed refusal is truthful and actionable |

## 3. Forbidden

- No live publication, no live revision apply, no generation, no deployment, no
  data mutation, no migration.
- Do not weaken or bypass the existing shape validations in R1's file.
- Do not edit `docs/plans/live-state.md`, the machine register, or `CHANGELOG.md`.
- Do not author a second constraint/violation engine.
- Companion repositories remain READ_ONLY.

## 4. Return contract

Commit the bounded candidate and return `REVIEW_REQUIRED` with: base SHA,
candidate SHA, exact changed paths, the requirement → production path → negative
control → result table, decisive commands actually run, known risks, and
`BLOCKED`/`DEFERRED` rows named explicitly. Executors do not self-accept, merge,
or push.

## 5. Browser evidence

Any change that can alter a rendered surface requires live Tailnet browser
evidence against `https://njgrm.buru-degree.ts.net` with a
`window.location.origin` assertion. Absence is `CORRECTION_REQUIRED`, not a
non-blocking note. Read-only inspection only; the write deny-list still applies.
