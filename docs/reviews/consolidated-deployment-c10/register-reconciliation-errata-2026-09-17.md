# CONSOLIDATED-DEPLOYMENT-C10 — reconciliation errata (2026-09-17)

Author: primary planner. Trigger: Wave Completion Auditor
`ses_f4fd7eefeffeYuPtVH3Xq5ThcU` returned `CORRECTION_REQUIRED` against the
integrated wave and the proposed `COMPLETE` closure. This file records the
truthful reconciliation. It does **not** close the cycle.

## B1 — undisclosed in-cycle global Git trust-allowlist addition

**Finding (confirmed).** Git's global `safe.directory` list gained the entry
`D:/ATLAS-runtime-supervised-8eb0511baa53-20260917` inside this cycle's window,
and the cutover evidence asserted the opposite.

**Established facts.**

| Fact | Value |
|---|---|
| Entry present | yes — `git config --global --get-all safe.directory` returns `E:/ATLAS-worktrees/*`, `D:/ATLAS-runtime-supervised-54dce67b-20260914`, `D:/ATLAS-runtime-supervised-8eb0511baa53-20260917` |
| Release directory created | 2026-09-17 22:46:57 +08 (by the first executor's `git worktree add --detach`) |
| Global git config last written | 2026-09-17 23:46:31 +08 — inside the cutover window, after register revision 333 (23:43:29 +08) and before the supervisor start (23:57:06 +08) |
| In the recorded `approvedActions` | **no** — the seven recorded actions do not include any global Git configuration change |
| Added by this cycle's executor | no (the fresh executor explicitly recorded that it added no entry); the actor is **not determinable** from committed evidence |
| Load-bearing for the elevated session | no (an empty-global test still resolves the pin while elevated) |
| Load-bearing for the SYSTEM-run supervisor | **not established** — the supervisor runs as `SYSTEM` via Task Scheduler, and the incumbent release directory carries the same class of entry |

**Why it matters.** The packet's install requirement (`verifyProductPin` →
`git -C <sourceDir> rev-parse HEAD`) fails with `detected dubious ownership`
unless the directory is owner-matched or allowlisted, because the release
directory is owned by `BUILTIN\Administrators` while the interactive user is
`njgro`. The entry is therefore operationally motivated — but it is a global
trust-allowlist mutation outside the approved boundary, and the project's own
precedent (`docs/handoffs/wf-c04-executor.md:109`) records deliberately *not*
making such a change. Undisclosed, it is a boundary and evidence-integrity
defect; the auditor correctly blocked closure on it.

**Evidence claims corrected in this pass** (`cutover-evidence-2026-09-17.md`):
the zero-mutation statement, the "no config entry was added or changed" heading,
and the before/after table row that read "3 entries | identical | 0".

**Decision required (operator).** The entry was **retained** in this pass because
removing it could make the `SYSTEM`-run supervisor fail its pin check on the next
restart or boot — a runtime outage risk that cannot be tested without a restart,
which is itself a separate HIGH action. Retention therefore needs explicit
ratification, or removal needs authorization plus a proven restart test:

> "I authorize the bounded remediation of the CONSOLIDATED-DEPLOYMENT-C10 record:
> remove the cycle-added `safe.directory` entry
> `D:/ATLAS-runtime-supervised-8eb0511baa53-20260917` from the global Git
> configuration, restoring the list to its pre-cycle contents, and record the
> addition and its removal as a truthful errata in the C10 evidence and register;
> no other global Git setting, runtime, task, env-file, login, or database change
> is approved."

Alternative (recommended on operational-safety grounds): ratify retention —

> "I ratify the retention of the `safe.directory` entry
> `D:/ATLAS-runtime-supervised-8eb0511baa53-20260917` in the global Git
> configuration, on the record that it was added inside the C10 cutover window
> outside the approved actions, that it is required for the SYSTEM-run supervisor
> to resolve the release pin, and that it grants no access beyond suppressing the
> ownership warning for a release directory ATLAS itself created. No other
> global Git setting, runtime, task, env-file, login, or database change is
> approved."

## B2 — stale register coordination snapshot and git fields (planner miss)

Corrected at revisions 336–338:

- `coordination.globalNextAction` no longer describes the pre-approval state or
  the retired `54dce67b` release; it now records that the cutover **is** executed
  and the runtime serves `8eb0511b` (PIN40) on 5001/5174.
- `git.candidateSha` was `21222a66` (the preflight STOP evidence) with
  `changedPaths` omitting the cutover evidence. The correction round
  (`record-correction`, revision 336) re-pointed the candidate at `3771cced`
  (the deployment evidence commit) and rebuilt `changedPaths` across
  `PIN40..3771cced`, which includes `cutover-evidence-2026-09-17.md`.
- `blocker` moved from `NONE` to `INTERNAL` with the audit findings named, and
  `awaited`/`nextAction` re-pointed at this reconciliation.

Candidate lineage, stated explicitly to avoid ambiguity:

| Commit | Meaning |
|---|---|
| `8eb0511b` | PIN40 — the frozen, approved, deployed release |
| `3771cced` | deployment evidence candidate (the accepted cutover record) |
| revision 336–338 commits | the reconciliation / errata candidate |

## Non-blocking findings — dispositions

- **N1** Row 9's authenticated matrix and the review's login disclosures exist
  only as register and commit-message summaries. The deployment is not in
  question; a durable per-row review artifact is queued for the next
  documentation touch.
- **N2** No successor stream row/owner is registered yet for `DATA-CORRECTION-C01`
  (the live grid reseed; generation remains `CANONICAL_TEMPLATE_INCOMPLETE`
  fail-closed until then) or for the four companion-SSO env keys. Queued.
- **N3** The operator satisfied the env file's protected read-only DACL without
  altering its final ACL or ownership; the mechanism is undisclosed though the
  action and actor are disclosed. Recorded here.
- **N4** The review's 14-gate tally versus the register's 16 (3 source + 13 live)
  is a counting-scope difference, not a defect.

## Closure bar (unchanged)

This cycle is **not** `COMPLETE`. Closure requires, in order: the operator's B1
decision, this reconciliation committed, one **fresh** independent QA over the
correction range, and one **fresh** Wave Completion Auditor over the corrected
final tree. The deployed runtime is healthy on PIN40 throughout and is not in
question; no runtime, task, env, login, or database action belongs to this
reconciliation.
