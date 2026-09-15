# WF-C03 executor handoff — local observability and browser custody

## STATE

`REVIEW_REQUIRED` — one bounded additive candidate, frozen. Not merged, not
pushed, not self-accepted.

- Worktree: `E:/ATLAS-worktrees/workflow-observability-c03`
- Branch: `work/workflow-observability-c03`
- Accepted base: `3a1a175997463c16d6e6c2c2eaca8165539166bb` (F0 checkpoint, adopted
  by planner decision; unamended)
- Product candidate: `a4ca89c53a6f925c0ee58add5ec49886c95401cb`
- Frozen tip: the R1 correction commit at the end of this file's commit table
  (its SHA is reported by the executor in its return message; verify with
  `git rev-parse HEAD`)

Commits on top of the base:

| SHA | Subject |
| --- | --- |
| `eeee4823` | `feat(workflow): add local observability heartbeat store and OpenCode plugin` |
| `89f67575` | `feat(workflow): add exclusive browser-profile custody lease` |
| `a4ca89c5` | `feat(workflow): add truthful liveness, workflow:status, and recovery controls` |
| `a8467490` | `docs(workflow): add WF-C03 executor handoff` |
| _(R1)_ | `fix(workflow): fail closed on an unreadable custody record` |

### Adoption protocol

The working tree was dirty when the first dispatch arrived (an interrupted
WF-C03 session). The planner authorized adoption of that residual as this lane's
interrupted draft. The dirty-path list was re-recorded unchanged before editing
(`git update-index --refresh` + `git status --porcelain=v1`), every residual file
was read and re-derived, and defects found in it were fixed (see Risks R5/R6).
Nothing from the interrupted session is treated as evidence.

## R1 correction (after fresh QA returned `CORRECTION_REQUIRED` 20/19/1/0)

**Finding F1 (single blocking).** `lib/custody.mjs` conflated "lease file absent"
with "lease file present but unreadable": `readLease` returned `null` for any
read/parse/schema failure, `acquire` treated `null` as free custody and
overwrote the bytes, and `listLeases` silently dropped the unparseable record.
This violated B3 — only a verified owner release or an explicit operator recovery
may clear uncertain custody.

**Failing-first evidence against the pre-fix bytes (`a8467490`).** A probe using
only the pre-fix API on a profile seeded with `{ this is not json` printed:

```
outcome: ACQUIRE_SUCCEEDED (defect: corrupt bytes treated as free custody)
corruptBytesOverwritten: true
readLeaseReturns: null (absent and corrupt conflated)
```

**Fix (one reader, no conflation).**

- `readLeaseResult(paths, profile)` returns `ABSENT` | `OK` | `UNREADABLE`.
  `ENOENT` is the only absent case; any other read error, JSON parse failure, or
  failed structural validation is `UNREADABLE`.
- `parseLeaseStrict` validates `schema`, `leaseId`, `revision`, `sessionId`,
  `profile`, and `state`, and never repairs a malformed record into a lease.
- `loadForMutation` and `acquire` throw `CUSTODY_UNREADABLE` (with the path and
  reason) for an unreadable record; the conflating `readLease` accessor is
  removed, so no production path can mistake corruption for free custody.
- `listLeases` now returns `{ leases, unreadable }`, so an unreadable record is
  reported instead of dropped.
- `workflow:custody --op status` exits `1` with `CUSTODY_UNREADABLE` and names
  the path, reason, and manual-recovery instruction. `workflow:status` (read-only
  liveness) reports `summary.custodyUnreadable` + `summary.unreadableLeases` + a
  `custody` next action + a `custody-unreadable` artifact, and never reports "no
  lease" for that profile.
- No auto-clear anywhere, including `recover --confirm`, which fails closed on an
  unreadable record. The documented recovery is manual: after proving no custody
  is live, remove that single file by hand and re-acquire (README invariant list).
- `lib/observability.mjs` documents that heartbeat/notification records are
  advisory and intentionally reset — no behavior change.

**New controls.** Five custody rows (unparseable JSON and foreign-schema matrices
covering all seven operations with byte-identical before/after assertions and no
`.tmp`/`.lock` residue; read-model classification; no-auto-clear plus a
manual-removal positive control; the CLI status row) and one `workflow:status`
surfacing row.

## Changed paths (`git diff --name-only 3a1a1759..a4ca89c5`)

```
.opencode/plugins/atlas-observability.ts
ops/workflow/README.md
ops/workflow/__tests__/compaction-recovery.test.mjs
ops/workflow/__tests__/custody.test.mjs
ops/workflow/__tests__/harness.mjs
ops/workflow/__tests__/liveness-status.test.mjs
ops/workflow/__tests__/observability-atomicity.test.mjs
ops/workflow/__tests__/observability.test.mjs
ops/workflow/__tests__/plugin-load.test.mjs
ops/workflow/__tests__/render-controls.test.mjs
ops/workflow/custody.mjs
ops/workflow/lib/args.mjs
ops/workflow/lib/custody.mjs
ops/workflow/lib/liveness.mjs
ops/workflow/lib/lock.mjs
ops/workflow/lib/observability.mjs
ops/workflow/lib/redact.mjs
ops/workflow/lib/util.mjs
ops/workflow/status.mjs
package.json
```

20 files, `+3829 / -13`. No forbidden path was touched: no `AGENTS.md`,
`CHANGELOG.md`, `docs/plans/**`, `atlas-server/**`, `atlas-client/**`,
`prisma/**`, `ops/runtime/**`, runtime release, task, or companion file.

## Requirement trace

| # | Requirement | Production path | Negative control | Verification command | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | F0 seed pin repair | `ops/workflow/__tests__/seed.test.mjs` (`:17`, `:45`, `:52`) | Base asserts 6 streams against the committed 7-stream register | `npm run workflow:test` | PASS |
| 2 | B1 atomic bounded heartbeat store | `ops/workflow/lib/observability.mjs` (`recordEvent`, `writeHeartbeat`, `stageHeartbeat`) | crash between stage and publish; truncated/foreign-schema record; 250-write burst; 4-writer storm | `node --test ops/workflow/__tests__/observability-atomicity.test.mjs` | PASS |
| 3 | B1/B4 OpenCode plugin | `.opencode/plugins/atlas-observability.ts` | hostile hook input (`null`, missing session, missing tool); module-level import | `node --test ops/workflow/__tests__/plugin-load.test.mjs` | PASS |
| 4 | B1 redaction / closed allowlist | `ops/workflow/lib/redact.mjs`, `buildHeartbeat` projection | secrets injected into every free-text field; hostile foreign keys | `observability-atomicity.test.mjs`, `observability.test.mjs` | PASS |
| 5 | B2 truthful liveness | `ops/workflow/lib/liveness.mjs` (`classifySession`, `buildSessionView`) | expiry alone; directory existence alone; absent pid; custody stale | `node --test ops/workflow/__tests__/liveness-status.test.mjs` | PASS |
| 6 | B2 `workflow:status` | `ops/workflow/status.mjs` (reads the register through `lib/verify.mjs`) | `--common-dir` temp routing; register bytes unchanged; malformed `--now`/`--active-window-ms` | `node --test .../liveness-status.test.mjs`; `npm run workflow:status -- --json` | PASS |
| 7 | B3 custody lease | `ops/workflow/lib/custody.mjs`, `ops/workflow/custody.mjs` | 19-row matrix; expiry auto-release attempt; two-process acquire race | `node --test ops/workflow/__tests__/custody.test.mjs` | PASS |
| 8 | B4 permission/compaction observations | `applyEvent` in `lib/observability.mjs`; `lib/checkpoint.mjs` | permission payload scan; identity retention across compaction | `node --test ops/workflow/__tests__/compaction-recovery.test.mjs` | PASS |
| 9 | B5 notifications, no authority | `pushNotification`, `status.mjs --notify-kind` | unknown kind; filesystem delta is the ring buffer only | `observability.test.mjs`, `liveness-status.test.mjs` | PASS |
| 10 | B6 read-only register + renderer | `status.mjs`/`custody.mjs` read via `verify.mjs`; `render-register.mjs --check` | one-byte register drift; byte-mutated receipt; mapped fixtures | `node --test ops/workflow/__tests__/render-controls.test.mjs`; `npm run workflow:render:check` | PASS |
| 11 | Gate 6 plugin discovery | installed OpenCode 1.18.21 `debug config` | probe variant markers in a temp project | `node --test ops/workflow/__tests__/plugin-load.test.mjs` (installed-version row) | PASS |

No row is BLOCKED or DEFERRED.

## Test tally (frozen clean tree)

| Gate | Result |
| --- | --- |
| `npm run workflow:test` | **224 / 224 pass, 0 fail, 0 skipped, exit 0**, `duration_ms 19922` (wall 20.34 s) |
| same suite at the adopted base (residual present) | 162 / 162 pass, exit 0, wall 19.84 s |
| `npm run workflow:verify -- --state docs/plans/atlas-delivery-cycles.json` | exit 0, `status: ok`, 7 streams, 0 errors |
| `npm run workflow:render:check` | exit 0 |
| `git diff --check` | clean |
| `npm run workflow:status -- --json` (production smoke) | exit 0, revision 11, mode `MANUAL`, 0 sessions |
| `npm run workflow:custody -- --op status` | exit 0, no lease |

Performance budget: 20.34 s wall against the 45 s ceiling.

**F0 failing-first honesty:** the pre-fix failure is evidenced by the committed
base-vs-fix diff (`53a781a4:seed.test.mjs` asserts `streams.total === 6` and a
6-id list against the committed 7-stream register, revision 11) plus the
planner's captured base run. My own "before" run was taken at the adopted base
`3a1a1759`, where the F0 fix is already committed, so it passed 162/162; I did
not check out `53a781a4` (that would require a reset, which is forbidden).
`npm run workflow:verify` bare exits 2 (`USAGE_MISSING_STATE`); the documented
invocation forwards `--state`.

## Proof summaries

- **Lease concurrency:** two concurrent `custody.mjs --op acquire` processes over
  one common dir commit exactly one lease (revision 1, winner's session) and one
  typed loser (`CUSTODY_HELD` or `LOCK_CONTENTION`), with exactly one `.json` and
  no `.lock`/`.tmp` residue. The pre-existing 12-round × 6-worker lock stampede
  suite is unchanged and green.
- **Stale recovery:** expiry yields `STALE_UNCONFIRMED`; a second `acquire` is
  refused with `CUSTODY_HELD`/`detail.state = STALE_UNCONFIRMED`; `renew` and
  `transfer-request` are refused with `CUSTODY_NOT_ACTIVE`; the recorded owner can
  still `release` (with complete-cleanup ack) and an operator can `recover` only
  with `--confirm` plus operator identity and reason. The recovery text states the
  lease is "NOT free".
- **Redaction:** credential-shaped values injected into `worktree`, `branch`,
  `leaseId`, `nextAction`, `lastAtomicAction`, and `lastEventType` are absent from
  the record, the stored file, and every `listHeartbeats` projection, and
  `[REDACTED:` markers are present. Hostile extra keys (prompt, messages, command,
  output, diff, env, storage) are dropped by the closed allowlist.
- **Plugin discovery:** OpenCode 1.18.21 resolves
  `file:///<repo>/.opencode/plugins/atlas-observability.ts` into `plugin` and
  `plugin_origins` (`scope: local`). A probe plugin written to a temp
  `.opencode/plugins/` was evaluated during `opencode debug config` (startup
  marker written); the same holds for the singular `.opencode/plugin/` path, so
  the plural path is confirmed supported. `plugin-load.test.mjs` re-runs this
  resolution against the committed file and skips cleanly if the CLI is absent.
- **Checkpoint/compaction recovery:** `session.compacted` is recorded as a
  sanitized transition, preserves role/stream/worktree/branch/head/leaseId, and
  increments the revision. `checkpoint.mjs` returns the stream state, revision,
  SHAs, and next atomic action from the committed register (never chat), and an
  unknown stream is refused with `CHECKPOINT_STREAM_UNKNOWN`. Permission
  ask/reply events are stored as `{at, type, status}` only.

## Known risks

| # | Risk | Class |
| --- | --- | --- |
| R1 | Several processes renaming onto the *same* session file can still lose an update after the bounded retry (`EPERM`), which is the documented one-writer-per-session model being violated. The failure is a dropped update: the staged bytes are discarded, the prior record survives, no residue remains, and the plugin's guarded hooks never propagate it. | NON_BLOCKING |
| R2 | `.opencode/**` is not covered by the root `.gitattributes` `eol=lf` policy, so the plugin materializes CRLF on checkout while Git stores LF. The plugin is not a pinned artifact and its behavior is line-ending independent. Fixing it needs a `.gitattributes` change outside this lane's owned paths. | NON_BLOCKING |
| R3 | `lib/util.mjs` and `lib/args.mjs` are shared with the WF-C01/C02-reviewed engine. The changes are strictly additive (accept a numeric epoch, unique temp names, bounded rename retry, boolean flag declaration) and every pre-existing test is unchanged and green. | NON_BLOCKING |
| R4 | `safeSessionFileId` maps `:` to `_`, so two exotic session ids could share a file. OpenCode session ids are `ses_<hex>`; not reachable in practice. | NON_BLOCKING |
| R5 | **Fixed residual defect:** `status.mjs` passed the ISO string as `now` into the epoch-arithmetic liveness engine, so a live session could never classify `ACTIVE`. Now passes an epoch and validates `--now`/`--active-window-ms` as usage errors. Covered by `liveness-status.test.mjs`. | Resolved |
| R6 | **Fixed residual defect:** `custody.nowMs`/`observability.nowIso` ignored a numeric epoch and silently fell back to the wall clock, so a lease could look expired for no requested reason; `writeFileAtomicSync` could collide on a same-millisecond temp name and could throw `EPERM` on a concurrent publish. Both fixed with a failing-first control (`observability-atomicity.test.mjs`, `custody.test.mjs`). | Resolved |
| R7 | The committed machine register has no `WF-C03` stream row, so a WF-C03 heartbeat reconciles as `HEARTBEAT_UNKNOWN_STREAM`. This is expected and asserted; register transitions belong to the planner at integration. | NON_BLOCKING |

No BLOCKING risk.

## Confirmations

- No push, no merge, no rebase, no amend, no branch deletion; `origin/main` is
  untouched. Integration and any register transition belong to the planner.
- No browser, Playwright, login, credential, database, runtime, network, or
  companion action. No `opencode run` and no model/session invocation.
- `docs/plans/atlas-delivery-cycles.json`,
  `docs/plans/atlas-active-delivery-streams.generated.md`, receipts, `CHANGELOG.md`,
  and `AGENTS.md` are untouched; `D:/ATLAS`, other worktrees, and the TT worktree
  are untouched.
- `D:/ATLAS/.git/atlas-observability` does not exist after all probing: the real
  repository Git common directory was never written.
- Tests are hermetic (disposable repos/temp dirs under `os.tmpdir()`); no
  dependency installs.
- Worktree clean at the candidate: `git update-index --refresh`,
  `git status --porcelain` empty, `git status --porcelain=v2` empty; all four
  gates re-run from that clean committed tree.

## Worktree disposition

`PRESERVE_FOR_DECISION` — frozen unintegrated candidate; an active concurrent lane
owns `main`.
