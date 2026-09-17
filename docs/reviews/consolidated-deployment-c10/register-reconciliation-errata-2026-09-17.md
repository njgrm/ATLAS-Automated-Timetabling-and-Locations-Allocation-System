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
| Provenance | **explicitly instructed** in the planner's dispatched executor prompt for the C10 cutover, conditional on the dubious-ownership failure, and **not transcribed** into the stream's recorded `approvedActions` — a **record gap**, not an unauthorized act (operator ratification, 2026-09-17) |
| Recorded `approvedActions` retroactively modified | **no** — the granted approval stands exactly as recorded |
| Load-bearing for the elevated session | no (an empty-global test still resolves the pin while elevated) |
| Load-bearing for the SYSTEM-run supervisor | operationally required, but **not independently tested as `SYSTEM`** — the supervisor runs as `SYSTEM` via Task Scheduler, and the incumbent release directory carries the same class of entry |

**Why it matters.** The packet's install requirement (`verifyProductPin` →
`git -C <sourceDir> rev-parse HEAD`) fails with `detected dubious ownership`
unless the directory is owner-matched or allowlisted, because the release
directory is owned by `BUILTIN\Administrators` while the interactive user is
`njgro`. The entry is therefore operationally required for the **SYSTEM**-run
supervisor to resolve the release pin, and it grants no access beyond suppressing
the ownership warning for a release directory ATLAS itself created. The defect was
therefore a **recording** gap — the instruction existed in the dispatched prompt
but was never transcribed into the recorded boundary — compounded by the cutover
evidence's contrary claims. The auditor correctly blocked closure until both were
reconciled.

**Evidence claims corrected in this pass** (`cutover-evidence-2026-09-17.md`):
the zero-mutation statement, the "no config entry was added or changed" heading,
and the before/after table row that read "3 entries | identical | 0".

**Operator decision (recorded 2026-09-17): retention ratified, with the
provenance corrected.** The operator ratified retention and recorded that the
addition "was explicitly instructed in my dispatched executor prompt for the C10
cutover, conditional on the dubious-ownership failure, but was not transcribed
into the stream's recorded approvedActions — a record gap, not an unauthorized
act." Retention is required for the `SYSTEM`-run supervisor to resolve the release
pin, and the entry grants no access beyond suppressing the ownership warning for a
release directory ATLAS itself created. The granted `approvedActions` were **not**
retroactively modified. No removal action is pending; no other global Git setting,
runtime, task, env-file, login, or database change is approved.

**Lesson for the next HIGH install.** A Git trust-allowlist or ownership
prerequisite belongs in the recorded boundary at approval time. When a dispatch
introduces such a step mid-cycle, it must be transcribed into the register
immediately rather than left only in the dispatch text.

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

## Closure bar

This cycle is **not** `COMPLETE`. B1 is resolved (retention ratified; the
instruction and the record gap are both recorded) and B2 is fixed. Closure
requires, in order: this reconciliation committed, one **fresh** independent QA
over the correction range, and one **fresh** Wave Completion Auditor over the
corrected final tree. **No operator decision remains.** The deployed runtime is
healthy on PIN40 throughout and is not in question; no runtime, task, env, login,
or database action belongs to this reconciliation.
