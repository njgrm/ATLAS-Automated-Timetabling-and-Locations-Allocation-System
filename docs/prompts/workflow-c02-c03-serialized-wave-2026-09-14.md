# CYCLE ON: WF-C02 → WF-C03 serialized workflow-hardening wave

## Operating role

ROLE: PRIMARY PLANNER. Continue end to end without asking the operator to relay
executor or QA reports. Use one bounded executor at a time, fresh independent QA
for each frozen candidate, and a fresh Wave Completion Auditor after each lane.
Route deterministic in-scope corrections yourself. Stop only for a genuine
product/authority decision, an unresolvable external blocker, or after two
material correction rounds in the same lane.

This is one serialized two-lane wave:

1. `WF-C02` — workflow state, role, permission, compaction, and closure
   hardening.
2. `WF-C03` — local status/heartbeat plugin and exclusive browser-custody lease.

WF-C03 is locked until WF-C02 is accepted, integrated, and wave-audited. Do not
run the two workflow executors concurrently. The existing
`TT-SOURCE-FRESHNESS-C04` stream may continue in parallel in its existing
`D:/ATLAS-worktrees/tt-source-freshness-c04` checkout; never touch, reset,
rebase, clean, stage, commit, or represent that stream. Reconcile its register
state only from verified Git/session evidence and serialize any shared-register
integration with its owning planner.

## Dispatch boundary

- Repository: `D:/ATLAS`
- Authored from `origin/main`:
  `b6b2fe64e5fda1a13ae2a88c2618fcf5008be446`
- Refresh `origin/main` before dispatch. Use the refreshed tip if it still
  contains WF-C01 and this packet; record the actual base.
- Current directive at authorship, LF-normalized SHA-256:
  `5F9206708A4763376DDA1943C1EAD28F49427ED1B1F0532AD25661F74ED3EBB5`
- New worktree root: `E:/ATLAS-worktrees` only.
- Lane A worktree/branch:
  `E:/ATLAS-worktrees/workflow-hardening-c02` /
  `work/workflow-hardening-c02`.
- Lane B worktree/branch after C02 integration:
  `E:/ATLAS-worktrees/workflow-observability-c03` /
  `work/workflow-observability-c03`.
- Integration worktree:
  `E:/ATLAS-worktrees/integration-workflow-c02-c03-20260914` /
  `integration/workflow-c02-c03-20260914`.
- Worktree disposition for all three new worktrees:
  `RETIRE_AFTER_INTEGRATION` after clean pushed closure and post-action audit.

Before creating any worktree, verify E-drive free space is at least 15 GiB and
record it. Do not install dependencies: WF-C01 uses Node built-ins. Do not make
new D-drive worktrees. Read current `origin/main:AGENTS.md`, WF-C01 README,
schema, verifier, renderer, fixtures, tests, receipt, machine register, and
generated register.

## Shared forbidden boundaries

No lane may modify `atlas-server/**`, `atlas-client/**`, `prisma/**`,
`ops/runtime/**`, runtime releases/configuration, Windows tasks, ports,
Tailnet/Tailscale, live browser profiles, credentials, databases, migrations,
Teaching Load data, generation, publication, companion repositories, or the
existing TT worktree. No deployment, login, network mutation, branch deletion,
force push, reset, rebase, stash, recursive deletion, or package installation.

The historical prose register is context only. Machine state is authoritative
after WF-C01, but every transition must keep the deterministic generated view
current. Do not edit the generated Markdown by hand.

---

# Lane A — WF-C02

## Objective

Make the WF-C01 foundation efficient and operational for real OpenCode planner
cycles: remove self-referential closure bookkeeping, provide atomic validated
state transitions, detect concurrent writers, define the four project roles
with least privilege, enable verified automatic compaction, migrate current
register truth, and make the full suite fast enough to run after every state
transition.

## Owned paths

- `ops/workflow/**`
- `.opencode/agents/**` or the current officially supported project-agent path
- the smallest required `.opencode/plugins/**` shared type/adapter surface for
  C03, but no live plugin behavior yet
- `opencode.json`
- `package.json`
- `.gitattributes`
- `docs/plans/atlas-delivery-cycles.json`
- `docs/plans/atlas-active-delivery-streams.generated.md` (renderer output only)
- `docs/plans/receipts/**`
- `docs/handoffs/wf-c02-executor.md`
- `docs/reviews/workflow-hardening-c02/**`
- `AGENTS.md` only for concise normative rules proven by this lane
- `CHANGELOG.md` only at integration

## Mandatory production corrections

### A1. Non-self-referential Git identity

Redesign closure identity so no committed state field is required to equal the
commit that contains that field. Distinguish immutable candidate SHA,
integration SHA, closure/receipt commit, and a post-push remote observation.
A remote observation may attest a named ref and observed SHA, but recording it
must not create an infinite “new final SHA” chain. Existing WF-C01 records must
migrate without losing their historical identities.

Required negative controls:

- the former `remoteSha == containing HEAD` interpretation cannot be expressed
  as a required closure invariant;
- stale candidate/integration ancestry still fails closed;
- a forged remote observation fails;
- one closure operation reaches a stable state without a follow-up SHA-fix
  commit.

### A2. Atomic transition command

Provide one repository-owned CLI that performs:

`read → schema/semantic verify → expected-state/CAS check → mutate one stream →
render → verify rendered bytes → optionally mint/verify receipt → atomic replace`

The command shall expose narrow named transitions rather than arbitrary JSON
patching. It must fail without modifying state, rendered output, or receipt on
invalid input, stale expected revision, invalid transition, ambiguous stream,
failed render, failed receipt, or lock contention. Output remains one
deterministic JSON object with `status`, `summary`, `nextActions`, `artifacts`,
and `errors`.

Use an exclusive repository-common-dir lock with owner metadata and bounded
stale-lock inspection. Never delete a lock merely because it is old; require
proof that its owning process/session is absent. Two concurrent writers must
produce exactly one committed transition and one typed loser with zero partial
files.

### A3. Real active-work detection contract

Add a machine-readable stream/worktree lease shape sufficient for C03. A stream
cannot be `PLANNED` with `running: []` when a verified lease names a live
planner/executor or the owned worktree is dirty under an active session.
Conversely, directory existence alone is not proof of activity. Add the exact
regression revealed by `TT-SOURCE-FRESHNESS-C04`: dirty owned worktree + live
lease + register `PLANNED/no running` must fail verification.

Lease transitions must support `ACTIVE`, `RETURNED`, `IDLE`, `ERROR`, and
`STALE_UNCONFIRMED`. Expiry alone must never grant destructive cleanup or
replacement authority.

### A4. OpenCode roles and permissions

Using the installed OpenCode configuration schema—not guessed keys—define:

- `atlas-planner` (`mode: primary`): may read, run bounded commands, update
  workflow state, and invoke only the named ATLAS executor/QA/auditor roles;
- `atlas-executor` (`mode: subagent`): may edit only its assigned ATLAS
  worktree and may not merge, push, alter live/runtime/database boundaries, or
  invoke planner/auditor roles;
- `atlas-qa` (`mode: subagent`): read/command verification only; edit/write and
  task delegation denied;
- `atlas-wave-auditor` (`mode: subagent`): read/command audit only; edit/write,
  integration, push, successor execution, and task delegation denied.

Task allowlists must be fail-closed and account for OpenCode’s last-matching-rule
semantics. A QA or auditor must not be able to self-promote through the Task
tool. Preserve the user’s ability to invoke roles directly, while the role
itself remains bounded after invocation.

Do not assume that a `max` reasoning variant is subagent-spawnable. Detect
available models/variants from the installed harness. Use the configured
primary planner model/variant where supported and a capable available reviewer
variant otherwise; disclose fallbacks in the handoff without weakening gates.

### A5. Compaction and recovery

Enable automatic compaction and tool-output pruning using keys accepted by the
installed OpenCode version. Maintain enough reserved output headroom to finish
the current atomic step. A compaction checkpoint must carry only the stream ID,
role, worktree/branch, base/candidate/integration SHAs, current state/revision,
lease ID, directive hash, last completed gate, next atomic action, forbidden
boundaries, and pending approval—never raw transcripts, credentials, or large
tool output.

Prove configuration with the installed OpenCode config/debug command. If the
installed version uses `reserved` rather than proposed v2 `buffer/keep`, use the
installed supported form and test it. Do not commit an unrecognized config key.

### A6. Performance and residual closure

Refactor the fixture harness so the 24-fixture verification does not spawn a
fresh Node process or disposable Git repository per assertion when in-process
validation provides the same production logic. Preserve at least one true CLI
process test and the real Git checkout portability tests. On this host, target:

- ordinary semantic/fixture suite: under 20 seconds;
- complete `npm run workflow:test`: under 45 seconds;

If the complete target cannot be met without reducing proof strength, report
the measured blocker; never delete controls just to meet time.

Close or explicitly retain every WF-C01 residual: README base-path fallback,
six un-fixtured error codes, receipt artifact staleness, coverage matching,
`--stream` behavior, renderer receipt-pin surfacing, and machine-vs-prose
authority wording.

## Required Lane A gates

1. Failing-first/mutant controls for A1–A6.
2. Schema and every positive/negative fixture.
3. Atomic transition success, stale CAS, invalid transition, lock contention,
   simulated mid-write failure, and crash-recovery tests with byte-identical
   before/after assertions on every failure.
4. Role config resolution and permission-matrix tests using the installed
   OpenCode configuration parser/debug surface.
5. Compaction config resolution plus checkpoint redaction/size tests.
6. Real Git ancestry, line-ending portability, deterministic render, receipt,
   and remote-observation tests.
7. `npm run workflow:test`, `workflow:verify`, render `--check`, diff-check,
   and a clean frozen candidate.
8. Fresh independent QA over the exact range with a mandatory tally; then a
   fresh Wave Completion Auditor. Both require passed == total, blocked == 0,
   unperformed == 0.

Executor returns `REVIEW_REQUIRED`. QA and auditor never edit or integrate.
After `ACCEPT_READY` + `AUDIT_CLEAR`, integrate Lane A from a clean E-drive
integration boundary and push. Re-run the complete suite after every committed
machine-state/receipt mutation, including closure.

---

# Lane B — WF-C03

## Entry gate

Start only after WF-C02 is integrated and pushed with fresh QA
`ACCEPT_READY`, Wave Completion Auditor `AUDIT_CLEAR`, stable closure identity,
and a valid receipt. Create the C03 worktree from that exact refreshed
`origin/main` tip.

## Objective

Implement a repository-owned OpenCode observability plugin and CLI that keeps
compact restart-safe session/worktree heartbeats and enforces exclusive browser
profile custody without turning monitoring into execution authority.

## Owned paths

- `.opencode/plugins/**`
- the smallest required `.opencode/agents/**` prompt additions
- `ops/workflow/**`
- `opencode.json`
- `package.json`
- machine/generated register and C03 receipt/evidence
- `docs/handoffs/wf-c03-executor.md`
- `docs/reviews/workflow-observability-c03/**`
- `AGENTS.md` only for concise installed behavior
- `CHANGELOG.md` only at integration

## Mandatory production behavior

### B1. Local status and heartbeat

Use supported OpenCode plugin/session events (`session.created`,
`session.updated`, `session.status`, `session.compacted`, `session.idle`,
`session.error`, and relevant tool/permission events) to maintain compact local
runtime state under the repository common Git directory, not in a worktree and
not as committed data. Each record binds session ID, configured role, stream,
worktree, branch, current HEAD, lease ID, status, timestamps, last atomic action,
and sanitized next action.

Never store prompts, responses, credentials, tokens, environment contents,
browser storage, command output, or source diffs. Writes must be atomic and
bounded. Plugin failure must not corrupt the repository or silently mark a
cycle complete.

### B2. Truthful liveness

Expose `npm run workflow:status -- --json` and a concise human view. Reconcile
plugin heartbeats with Git worktree state and machine-register ownership.
Classify `ACTIVE`, `IDLE`, `RETURNED`, `ERROR`, `STALE_UNCONFIRMED`, and
`UNKNOWN`; never call a session dead solely because a heartbeat expired.
Return explicit recovery instructions and exact observed artifacts.

### B3. Browser custody lease

Provide narrow `acquire`, `renew`, `transfer`, `release`, and `status` operations
for the configured persistent Playwright profile. Exactly one active controller
may exist. The lease binds session, role, stream, profile, origin, authorized
login budget, expected audit delta, issued/renewed/expiry times, and cleanup
owner. A transfer requires acknowledgement by both owners. Release records
logout/cleanup status.

Fail closed on overlap, wrong owner, stale expected revision, wrong origin,
missing login authorization, exhausted login budget, or incomplete cleanup.
Expiry becomes `STALE_UNCONFIRMED`, not automatically free. Only a verified
owner release or explicit operator recovery action may clear uncertain custody.
The plugin must never navigate, log in, copy a token, or control the browser.

### B4. Permission and compaction observations

Record permission requests/replies and compaction events as sanitized state
transitions. A permission grant does not broaden the active packet. After
compaction, the role must recover from the compact checkpoint plus machine
state, not from private chat claims.

### B5. Notifications without automation authority

An optional local notification may announce `RETURNED`, `ERROR`, lease conflict,
or operator decision required. It may not spawn another agent, send a message,
edit product state, approve a HIGH action, retry a mutation, or create a
scheduled heartbeat automatically. Monitoring is not orchestration authority.

## Required Lane B gates

1. Fake-event tests for every subscribed event and redaction rules.
2. Concurrent heartbeat and atomic-write tests.
3. Active/idle/error/returned/stale classification with process-presence and
   worktree evidence.
4. Browser acquire/renew/transfer/release positive controls and mutants for
   overlap, expiry auto-release, wrong origin, unauthorized login, exhausted
   budget, and incomplete cleanup.
5. Compaction recovery from the minimal checkpoint.
6. Plugin/config load through the installed OpenCode debug/config surface.
7. No live browser, login, database, runtime, or network mutation.
8. Full WF-C01/C02 regression suite, performance budget, verify/render checks,
   diff-check, and clean frozen candidate.
9. Fresh independent QA over the exact range and a fresh Wave Completion
   Auditor, both with passed == total, blocked == 0, unperformed == 0.

Executor returns `REVIEW_REQUIRED`. After accepted QA and audit, integrate and
push from the clean E-drive integration worktree. Re-run the machine verifier,
renderer check, receipt verification, plugin/config load, and full workflow
suite after the final state transition.

## Final wave return contract

Return one terminal consolidated report containing:

- refreshed bases, candidate, integration, closure, and pushed SHAs for both
  lanes;
- exact changed paths and worktree dispositions;
- executor, QA, and auditor session IDs and complete tallies;
- correction rounds and load-bearing mutants;
- before/after workflow-suite duration;
- resolved OpenCode roles/models/variants, task/edit permission matrix, and
  compaction keys accepted by the installed version;
- atomic-transition and concurrent-writer proof;
- heartbeat/status storage path and redaction proof;
- browser custody lease matrix and proof that no browser/login occurred;
- current truth for the independently running TT stream without claiming its
  work as this wave's;
- confirmation that no HIGH/live/product/database/runtime/companion action
  occurred;
- final `origin/main`, valid receipt(s), generated-register parity, and remote
  verification;
- remaining risks and exactly one next action.

End in `MANUAL`. Retire the three clean E-drive workflow worktrees after final
post-action audit while preserving their branch refs. Do not retire or modify
the existing D-drive TT worktree.
