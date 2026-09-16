# WF-C10-TRANSITION-GUARD-HARDENING — executor packet (revision R1)

Status: authored 2026-09-17 (Asia/Manila); **R1 revised 2026-09-17 by the primary
planner before dispatch**, folding in the five required deltas A1–A5 and
correcting two false premises in R0 (§3.3 root cause for A3; §3.7 already-landed
attribute). The stream is registered and `RUNNING` before this packet is
dispatched; see §8 for the exact registration record.

## 0. Immutable identity

- Directive: `origin/main:AGENTS.md`, blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`.
  Reproduce it from Git bytes only (never a PowerShell `>` redirect, which
  recodes):
  `node -e "const{execFileSync}=require('child_process');const b=execFileSync('git',['cat-file','blob','051ad26a07509e3af4f1c1762e1ccfff8bb6cc88']);console.log(require('crypto').createHash('sha256').update(Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'),'utf8')).digest('hex'))"`
  Do not use `D:/ATLAS/AGENTS.md`: it is two mandatory rules stale and
  normalizes to `c1e05ab0aac280b9c335a0ea7fe41ccd9250b42ac5add9960f69508f566dcca7`.
- Base: the exact dispatch tip recorded in the register at registration (see §8).
  Do not assume a tip; read `git.baseSha` from the stream record or the §8 value.
- Worktree: `E:/ATLAS-worktrees/wf-c10-transition-guards`
- Branch: `work/wf-c10-transition-guard-hardening`
- Risk tier: MEDIUM. Disposition: `RETIRE_AFTER_INTEGRATION`.
- Recommended executor reasoning: `high` (do not use `max`).

## 1. Objective

Make the machine register able to record HIGH gates and stale directives
truthfully, so no planner ever again has to choose between hand-editing machine
state and under-reporting a completed HIGH action — and close the four
register-integrity defect classes found during the R0 review (a reservation that
lapses mid-cycle, an unproven RUNNING claim, a non-hermetic mandatory gate, and
a directive bump that would invalidate already-queued pins).

Owned contract: `ops/workflow/**` plus the two OpenCode package-root files in
§2. No product source, no runtime, no database, no login, no companion change.

## 2. Owned and forbidden paths

**Owned (may be created or edited):**

- `ops/workflow/**` — transition CLI and `lib/`, `schema/`, `__tests__/`,
  `__fixtures__/`, `README.md`, and any new `ops/workflow/*.mjs` entry point.
- `.opencode/package.json` — **new, tracked** (A3). See §3.3.
- `.opencode/.gitignore` — **only** if required to stop a local ignore rule from
  hiding the tracked `.opencode/package.json`. Prefer tracking only
  `.opencode/package.json`; do not delete or rewrite the local untracked copy.

**Forbidden:**

- `atlas-server/**`, `atlas-client/**`, `prisma/**`, any product source.
- `docs/prompts/**` — planner-owned. The two R0-cited mispins are already
  corrected by the planner at the pre-dispatch commit (§3.5); do not re-edit.
- `docs/plans/**` — **including `docs/plans/atlas-delivery-cycles.json` and the
  generated register.** The real register is written only by the planner through
  transitions. Every fixture you build for `record-approval`, `record-execution`
  and `withdraw-approval` must run against a **disposable temp repository**, not
  the live register.
- `CHANGELOG.md`, `docs/plans/receipts/**`, the runtime source-of-truth map.
- Companions, any runtime/task/env/port/DB surface, any login or browser action.

`ops/workflow/schema/cycle-state.schema.json` **is** owned (the window
`toRevision` widening in A1 needs it).

## 3. Required capabilities

### 3.1 `record-approval` — the missing HIGH gate writer (blocking)

No transition currently writes `approval.*`, so `approval.granted` can never be
set through the sanctioned path while `lib/verify.mjs` already enforces
`HIGH_EXECUTION_WITHOUT_APPROVAL`, `HIGH_BOUNDARY_EXCEEDED` (reads
`approval.execution`) and `HIGH_APPROVAL_INCOMPLETE` (reads `approval.granted`,
`operatorIdentity`, `approvedAt`, `boundary`). Add a stream-scoped transition:

- Flags: required `--packet-path` (repo-relative), `--packet-sha256` (64-hex),
  `--operator-identity`, `--boundary`, `--approved-actions` (JSON array of
  non-empty strings); the tool owns `approvedAt` from `--now`/wall clock.
- Effects: set `approval.granted = true`, `approval.operatorIdentity`,
  `approval.approvedAt`, `approval.boundary`, `approval.approvedActions`.
  **Leave `state`, `blocker`, `running`, `awaited`, `nextAction` and
  `approval.execution` unchanged.**
- **Do not set `approval.presentedReady`.** Leaving it `false` is deliberate:
  `presentedReady: true` activates the `HIGH_DEPENDENCY_MISSING` observation
  rules, which are a separate concern and would make a plain grant
  unsatisfiable. Document this.
- Refusals, all zero-mutation, render byte-identical, no receipt:
  - `TRANSITION_APPROVAL_ALREADY_GRANTED` when `approval.granted` is already
    `true` (replay is idempotent, never additive);
  - `TRANSITION_APPROVAL_PACKET_REQUIRED` when either packet flag is absent;
  - `TRANSITION_APPROVAL_PACKET_UNRESOLVED` when the path escapes the repo root
    (absolute, drive-qualified, `..`, or symlink escape) or names no file;
  - `TRANSITION_APPROVAL_PACKET_HASH_MISMATCH` when the LF-normalized SHA-256 of
    the resolved bytes differs from `--packet-sha256`;
  - `TRANSITION_APPROVAL_NOT_REQUIRED` when the stream's `approval.required` is
    not `true`;
  - `TRANSITION_APPROVAL_STATE_FORBIDDEN` from a terminal state (`COMPLETE`,
    `CLOSED`, `SUPERSEDED`);
  - `TRANSITION_STALE_REVISION` and `TRANSITION_UNKNOWN_STREAM` as usual.
- Reuse the existing artifact-path resolver from `refresh-artifact-pin` for the
  repo-relative containment and 64-hex validation instead of writing a second
  path parser.

### 3.2 `record-execution` — record the outcome without erasing the approval

- Flags: required `--actions-performed` (JSON array of non-empty strings),
  `--outcome` (non-empty string).
- Effects: set `approval.execution = { performed: true, actionsPerformed,
  outcome, executedAt, recordedBy }` where `executedAt` is tool-owned.
  Leave `state` and the granted fields unchanged.
- Refusals, all zero-mutation:
  - `TRANSITION_EXECUTION_WITHOUT_APPROVAL` unless the grant is **complete** by
    the verifier's own definition (`required === true && granted === true &&
    non-empty operatorIdentity && approvedAt !== null && non-empty boundary &&
    non-empty approvedActions`);
  - `TRANSITION_EXECUTION_OUTSIDE_APPROVAL` when **any** performed action is
    absent from `approval.approvedActions`;
  - `TRANSITION_EXECUTION_ALREADY_RECORDED` when
    `approval.execution.performed` is already `true` (replay is idempotent);
  - `TRANSITION_EXECUTION_STATE_FORBIDDEN` from a terminal state.
- Must satisfy the existing verifier rules without weakening them:
  `HIGH_EXECUTION_WITHOUT_APPROVAL` and `HIGH_BOUNDARY_EXCEEDED` must stay
  reachable for a hand-crafted document, and the sanctioned path must never trip
  them.

### 3.3 A documented exit from `HIGH_APPROVAL_REQUIRED` (blocking)

Verified at R0: **no transition currently declares `HIGH_APPROVAL_REQUIRED` in a
`from` list**, so the state is a dead end — `TERM-CACHE-CATCHUP-APPLY` is stuck
in it in the live register today. Add `withdraw-approval`:

- `from: ["HIGH_APPROVAL_REQUIRED"]`, `fromErrorCode:
  "TRANSITION_WITHDRAW_STATE_FORBIDDEN"`.
- Required: `--to-state` ∈ {`INTEGRATION_READY`, `PLANNED`, `SUPERSEDED`,
  `CLOSED`}, `--reason`, `--next-action`. Optional `--replacement`, **required
  when `--to-state` is `SUPERSEDED`**, naming a different existing stream (mirror
  the `resolve-decision` precedent).
- Effects: set the state, set `approval.presentedReady = false`, clear
  `approval.requiredObservationIds` to `[]`. Refuse
  `TRANSITION_APPROVAL_ALREADY_GRANTED` when `approval.granted` is `true`, and
  `TRANSITION_WITHDRAW_TARGET_INVALID` for a `--to-state` outside the allowed set.
- Single-step, literal `--expect-revision` CAS, zero mutation on any failure, and
  it must honour the same window/`--by` holder semantics as the C09 machinery.

### 3.4 Directive-copy fail-closed

Add a shared resolver (new `lib/directive.mjs`) exposing the directive pin for a
given tip (`{ blob, lfSha256 }` computed from raw `git cat-file blob` bytes) and
the operating copy's LF-SHA-256. Enforcement point: **the registration path**
(`create-stream`). When the operating `AGENTS.md` at the repo root does not match
the directive blob at the submitter's `--observed-origin-main` tip, fail closed
with `DIRECTIVE_COPY_STALE` and mutate nothing. Positive control: equal hashes
proceed. If the tip cannot be resolved for `AGENTS.md`, fail closed with
`DIRECTIVE_REMOTE_UNRESOLVED` — never silently skip the check.

Live evidence for the rule: `D:/ATLAS/AGENTS.md` is two mandatory rules stale
(missing production-shape gate rule 13, producer-to-consumer parity and
unknown-value conservation, and the unguarded sibling-feed scope-epoch rule).
Consequence to document in the README: a register write must run from a checkout
whose `AGENTS.md` matches the observed tip.

### 3.5 Packet-artifact pin lint, and A4 — a directive bump must not invalidate queued pins

Add `ops/workflow/pins.mjs` with `check --packet <repo-relative>` and
`check --all` (sweep `docs/prompts/**`), exit `0/1/2`.

Two distinct rules, and the distinction is the A4 requirement:

1. **Directive-pin reproducibility.** On a line carrying a directive marker
   (`origin/main:AGENTS.md` or the word `Directive`), every 40-hex token must
   resolve as a Git object and every 64-hex token must equal the LF-normalized
   SHA-256 of the directive blob at **some** tip in reachable history — the
   current tip **or any historical one**. Codes:
   `PIN_BLOB_UNRESOLVED`, `PIN_DIRECTIVE_HASH_UNKNOWN`.
   A historical-but-reproducible pin therefore **passes**: an already-queued
   packet is never invalidated by a later directive bump. A pin that reproduces
   at no tip fails closed. This is exactly what catches the R0 misprint below.
2. **Declared pin-pair recomputation.** The documented pin form
   `blob <40-hex> + LF-SHA-256 <64-hex> + the exact reproducing command` is
   recomputed from raw blob bytes; a disagreement is `PIN_HASH_MISMATCH`.
3. **Scope discipline.** Hashes that are not directive pins (for example a
   `liveSemanticRevision` or a fixture fingerprint on a line with no directive
   marker) must never fire. Prove both directions with fixtures.

Enforcement: `create-stream` accepts an optional `--packet-path` and lints the
registering stream's own packet; `record-approval` lints its `--packet-path`
through the same resolver. `--all` is the repo sweep.

**Already-corrected R0 mispins (planner, pre-dispatch — do not re-edit):**
`docs/prompts/published-immutability-c08-2026-09-16.md` and
`...-c08r1-2026-09-16.md` cited `ffd1452004753aa0f2b7ef21d990cb1df6e540c2850155b30dece990b8b82bd5`.
The planner mechanically proved that value equals the LF-SHA-256 of **none** of
the 12 distinct `AGENTS.md` blobs in reachable history, while the directive at
both packets' own bases (`c950e694`, `f84e43c3`) was already
`051ad26a… = 76631646…`. Both packets are corrected to the truthful pin with a
dated correction note. `pins.mjs check --all` must pass on the committed tree
after that correction — that is acceptance row 16.

### 3.6 Dependency-tree identity by LF-normalized lockfile hash

Add `ops/workflow/deps.mjs` exposing `identity <path>` and `compare <a> <b>`
(exit `0` equal, `1` different, `2` usage), so junction/reuse identity is decided
by the LF-normalized `package-lock.json` SHA-256 and never by raw checkout bytes
(the CRLF form produced a false mismatch). Document it in the README worktree
section as the sanctioned command for the dependency-reuse rule.

### 3.7 Packet-pin checkout stability — verify, do not add

`origin/main:.gitattributes` **already** contains `docs/prompts/** text eol=lf`
(verified by the planner at R1; the R0 wording that "the 2026-09-17 decisions
commit adds" it is obsolete). Required work is the *proof*, not the attribute:
add a materialization regression in the WF-C01 R1 pattern — pin a
`docs/prompts/**` blob hash, re-materialize that file with CRLF bytes in a
scratch copy, and assert the pinned LF-normalized hash and the blob hash are
unchanged. Keep the pin convention
`blob <git-sha1> + LF-SHA-256 <hash> + the exact reproducing command`.

### 3.8 A1 — the reservation must span to the holder's terminal transition

`registry.windows[]` landed (WF-C09 §R2.10) but is **bounded by a required
integer `toRevision`**. The C09 reservation was `218..227` while C09's own
closure transitions ran at 228–233: protection **lapsed mid-cycle** and two
foreign pushes landed in the gap. Landed code to verify, not re-implement:
`lib/transition.mjs` `assertRevisionWindowFree` / `releaseWindowsForTerminalHolders`,
`create-stream --register-window-to/--register-window-holder`,
`lease-update --window-declare/--window-from/--window-to/--window-holder/--release-window`,
verifier `WINDOW_INVALID` / `WINDOW_UNKNOWN_STREAM`, and the auto-release of a
window in the same candidate in which its holder reaches
`INTEGRATED|COMPLETE|CLOSED|SUPERSEDED`.

Add exactly two things:

- **Through-terminal declaration.** `create-stream
  --register-window-through-terminal` and `lease-update --window-declare <id>
  --window-through-terminal` write `toRevision: null`, meaning "from the
  declaration revision until the holder's terminal transition". The membership
  test becomes `fromRevision <= revision && (toRevision === null || revision <=
  toRevision)`; release is unchanged (the terminal transition still removes the
  window in the same candidate). `--register-window-to` and
  `--register-window-through-terminal` are mutually exclusive
  (`TRANSITION_WINDOW_FLAG_CONFLICT`); `--register-window-holder` requires one of
  them. Schema: `revisionWindow.toRevision` becomes
  `"type": ["integer", "null"]`. Document the through-terminal form as the
  default reservation for a cycle, and name the C09 lapse as the reason.
- **Lapse detection.** A *bounded* window whose `toRevision` is below the current
  register revision while its holder is not terminal is no longer protection:
  the verifier must fail closed with a new `WINDOW_LAPSED`. A through-terminal
  window (`toRevision === null`) can never lapse. Keep `WINDOW_INVALID` for
  `toRevision < fromRevision` only when `toRevision` is a number.

The escape hatch for a stuck holder stays `lease-update --release-window`, and a
second window for the same stream is still refused
(`TRANSITION_WINDOW_DUPLICATE`) — to re-declare, release first, then declare.

### 3.9 A2 — settle the RUNNING-without-live-evidence rule

R0 asked whether the rule survived the R2 substitution. **Settled: it did.**
`938e3063` ("fix(workflow): type the reconcile-stream RUNNING refusal") touched
only `ops/workflow/README.md`, `ops/workflow/__tests__/terminal-reconcile.test.mjs`
and `ops/workflow/lib/transition.mjs`; `lib/verify.mjs` was untouched, and the
rule is live at `verify.mjs:30,39,103-187,774-781` with coverage at
`__tests__/coverage.test.mjs:416-455` and `terminal-reconcile.test.mjs:1115`.
Record that settling evidence in the README next to the rule.

Add the missing negative fixture: a stream in `RUNNING` state whose `running[]`
prose is non-empty **and** whose `owners.executor.sessionId` names a plausible
session, but with **zero ACTIVE lease and no heartbeat in window**, must still
fail closed with `RUNNING_WITHOUT_LIVE_EVIDENCE` — prose and a declared session
id are never evidence. Existing coverage only clears `leases[]`; the new row must
additionally populate `owners.*.sessionId` so the claim/evidence boundary is
pinned.

### 3.10 A5 — `record-executor-return --base <dispatch tip>`

The flag already exists (`optional: [... "base" ...]`, `const base = flags.base
|| stream.git.baseSha`). Verify it in a fixture with a disposable repo (an
explicit `--base` different from the spec's `git.baseSha` is honoured and
recorded), and **use it**: this stream's own executor return passes
`--base <the dispatch tip named in §8>` so the recorded range is the true
dispatch boundary rather than the spec's authoring-time base.

## 4. Acceptance matrix (each row a mandatory source gate)

| # | Control | Expected |
|---|---|---|
| 1 | `record-approval` grants a HIGH stream with a reviewed packet pin | granted fields complete; `workflow:verify` clean |
| 2 | `record-approval` replay | `TRANSITION_APPROVAL_ALREADY_GRANTED`; state/render byte-identical |
| 3 | `record-approval` without a packet pin | `TRANSITION_APPROVAL_PACKET_REQUIRED`; zero mutation |
| 4 | `record-approval` with a path-escaping / absent packet | `TRANSITION_APPROVAL_PACKET_UNRESOLVED`; zero mutation |
| 5 | `record-approval` with a resolving path but wrong hash | `TRANSITION_APPROVAL_PACKET_HASH_MISMATCH`; zero mutation |
| 6 | `record-approval` on `approval.required: false` | `TRANSITION_APPROVAL_NOT_REQUIRED`; zero mutation |
| 7 | `record-approval` from a terminal state | `TRANSITION_APPROVAL_STATE_FORBIDDEN`; zero mutation |
| 8 | `record-execution` before any grant | `TRANSITION_EXECUTION_WITHOUT_APPROVAL`; zero mutation |
| 9 | `record-execution` with an action outside `approvedActions` | `TRANSITION_EXECUTION_OUTSIDE_APPROVAL`; zero mutation |
| 10 | `record-execution` after a complete grant, within bounds | execution recorded, state and grant intact, `workflow:verify` clean |
| 11 | `record-execution` replay | `TRANSITION_EXECUTION_ALREADY_RECORDED`; byte-identical |
| 12 | `withdraw-approval` from `HIGH_APPROVAL_REQUIRED` to each allowed target | state set, `presentedReady` false, observations cleared; verifier clean |
| 13 | `withdraw-approval` invalid target / wrong from-state / granted stream | `TRANSITION_WITHDRAW_TARGET_INVALID` / `TRANSITION_WITHDRAW_STATE_FORBIDDEN` / `TRANSITION_APPROVAL_ALREADY_GRANTED`; zero mutation |
| 14 | Stale revision on every new transition | `TRANSITION_STALE_REVISION`; zero mutation |
| 15 | Directive-copy equal | registration proceeds |
| 16 | **A4** pin lint `--all` over the committed `docs/prompts/**` | exit 0 (the C08 repair holds; no historical pin is invalidated) |
| 17 | **A4** pin lint on a non-current but reproducible directive pin | passes — a queued packet is not invalidated by a directive bump |
| 18 | Pin lint on a non-reproducing directive hash | `PIN_DIRECTIVE_HASH_UNKNOWN`; nonzero exit |
| 19 | Pin lint on an unresolvable blob / a mismatched pin pair | `PIN_BLOB_UNRESOLVED` / `PIN_HASH_MISMATCH`; nonzero exit |
| 20 | Pin-lint scope discipline | a non-directive hash on a marker-free line fires nothing |
| 21 | Directive-copy stale (synthetic) | `DIRECTIVE_COPY_STALE`; zero mutation |
| 22 | **A1** through-terminal window: foreign write after the holder's last bounded step and before its terminal transition | `TRANSITION_REVISION_WINDOW_HELD`; zero mutation |
| 23 | **A1** bounded-window lapse with a non-terminal holder | `WINDOW_LAPSED`; a through-terminal window never lapses |
| 24 | **A1** §R2.10 landed verification (do not duplicate) | foreign write inside a numeric span refused; holder's own steps pass; auto-release at terminal; explicit `--release-window`; `TRANSITION_WINDOW_DUPLICATE` on re-declare |
| 25 | **A2** RUNNING with prose + owner session id, zero lease/heartbeat | `RUNNING_WITHOUT_LIVE_EVIDENCE` |
| 26 | **A2** settling evidence recorded (R2 did not weaken the rule) | README names `938e3063`'s scope and the surviving `verify.mjs` sites |
| 27 | **A3** fresh-checkout plugin load | in a checkout with no local `.opencode/package.json`, `plugin-load.test.mjs` is fully green (6/6) |
| 28 | **A3** load-bearing mutant | removing `"type": "module"` from the tracked file makes that row fail (proves the fix is causal, not incidental) |
| 29 | **A3** full suite baseline | `npm run workflow:test` = 327/327 pass, 0 fail (was 324/327 with the 3 plugin-load failures) — see §6 |
| 30 | **A5** `record-executor-return --base` | an explicit `--base` differing from the spec's `git.baseSha` is honoured and recorded |
| 31 | §3.6 LF-normalized lockfile identity | CRLF and LF materializations compare equal; a real difference is still detected |
| 32 | §3.7 `docs/prompts/**` materialization regression | LF-normalized pin and blob hash unchanged under a CRLF re-materialization |
| 33 | Render determinism on every rejection | render output byte-identical for every refusal above |
| 34 | `workflow:verify` on the committed tree | exit 0 |
| 35 | `workflow:render:check` | exit 0 |
| 36 | `git diff --check` | clean |

Rows 22–30 and 16–17 are the A1–A5 deltas and are **not** satisfiable by
re-running existing tests: each needs a new fixture. No row needs a credential,
session, runtime, database, or network beyond the local Git object store.

## 5. Gates

`ops/workflow` suite with one negative fixture per capability; `workflow:verify`
exit 0; `workflow:render:check` exit 0; `git diff --check`; the A3
fresh-checkout proof; fresh independent QA over the frozen candidate; clean
current-main integration with exact candidate-tree parity; fresh Wave Completion
Audit.

## 6. Baselines that must be quantified, not asserted

- `npm run workflow:test` in a genuine fresh checkout (no local
  `.opencode/package.json`) is **327 tests / 324 pass / 3 fail**, and all three
  failures are `plugin-load.test.mjs` rows failing with
  `SyntaxError: Cannot use import statement outside a module` at
  `.opencode/plugins/atlas-observability.ts:21`. The planner measured this in
  `E:/ATLAS-worktrees/wf-c10-planner`.
- Root `package.json` is `"type": "commonjs"`, so with no nearer package root the
  plugin's ESM `import` syntax is parsed as CommonJS. Tracking
  `.opencode/package.json` as `{"type": "module", "dependencies":
  {"@opencode-ai/plugin": "1.18.21"}}` makes all 6 plugin-load rows pass; the
  planner also confirmed `{"type": "module"}` alone is sufficient. `"type"` is
  the load-bearing field — the R0 claim that the missing *dependency* caused the
  failure is wrong and must not be repeated.
- Report the after-fix count and the delta. If the delta is more than the three
  named rows, stop and report rather than adjusting expectations.

## 7. Boundaries

No product source; no runtime/port/task/env change; no database action; no login;
no companion edit; no browser session. Register writes only through transitions,
CAS-guarded, and **only by the planner** — every fixture uses a disposable temp
repository. Never hand-edit register JSON. `D:/ATLAS/AGENTS.md` is stale: read the
directive from Git bytes.

## 8. Registration record (filled by the planner at registration)

- Base (dispatch tip) / observed `origin/main`: recorded below and in
  `streams[WF-C10-TRANSITION-GUARD-HARDENING].git`.
- Reservation: `registry.windows[]` holds a bounded reservation from the
  registration revision to a revision with a wide margin, because the
  through-terminal form this packet adds does not exist until the candidate
  lands. It auto-releases when this stream reaches a terminal state. The
  through-terminal form is proven by fixtures so successors use it.
- Lease: one `ACTIVE` lease bound to this stream, role `executor`, created
  atomically with the record (a `RUNNING` spec without lease flags fails closed).

## 9. Return contract

Base/candidate/integration/final-main SHAs, changed paths, per-capability fixture
results including A1–A5 and the plugin-load fresh-checkout proof, the quantified
suite counts, QA and audit tallies, push state, worktree disposition, single next
action, safe parallel work, locked successors. Additive commits only; never
amend, rebase, or force-push. `REVIEW_REQUIRED` only; the executor never
self-accepts.
