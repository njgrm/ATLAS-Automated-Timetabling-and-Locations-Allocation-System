# WF-C02 wave completion audit — round 1 (CORRECTION_REQUIRED)

- Auditor: delegated read-only adversarial context (`atlas-qa-delegate` shell),
  `opencode-go/deepseek-v4.1-flash` (variant `high` per harness frontmatter; the
  task's own runtime variant is not introspectable from inside the task — no
  HIGH action was pending, so no max-tier requirement applied).
- Auditor task/session: `ses_f5f52aa71ffec6h2EfZChMr3ka`
- Reviewed `origin/main`: `719947af41ac4c8ce994d352281e89c376d8a6b5`
- Candidate / integration: `5d902bf42cf009ca28034ed30b7877b8505fca24` /
  `386fdaf1614384da3eecf5d62364ae0c3318c7b0`
- Mandatory tally: 10 / 9 / 0 / 0 — one failed row (A2 concurrent-writer and
  reclaim guarantee).
- Verdict: `CORRECTION_REQUIRED`.

## Blocking finding F1 — lock reclaim TOCTOU

`ops/workflow/lib/lock.mjs`: `acquireLock` classified a dead-owner record
`ABSENT` and then unlinked `lockPath` unconditionally. Two reclaimers could
both classify `ABSENT`, and each unlink the other's freshly published live
record; `runTransition` has no ownership re-check, so both commit. Auditor
evidence (disposable copies, four synchronized acquirers from a dead-owner
lock): 2–3 of 4 processes returned `ok` (`{"2":3,"3":1}` at a 1 MB record;
`{"2":3,"3":2}` at 4 MB); the no-dead-lock control returned exactly one `ok`
(8/8).

Required remedy (prescribed by the auditor): reclaim must be a serialized
claim; never unlink a record whose byte identity was not re-verified as the
classified dead record inside the claim; publish via CAS.

## Resolution

Correction R4 (`cfe3ba93`, `550a2411`, `cf1d360c`) implemented the claim-mutex
protocol (`<lock>.claim` O_EXCL mutex, byte-fingerprint re-verification inside
the claim section, immediate CAS republish via `linkSync`, fail-closed claim
races, bounded dead-owner stampede controls with failing-first proof). It passed
fresh QA round 5 `ACCEPT_READY` 25/25/0/0 (session
`ses_f5f0eb566ffeAE0B0A66kbiNxF`) and was re-integrated at
`6be52b4c2035fc053415b222dec25cbf9b389f14`. A fresh Wave Completion Auditor
(round 2) reviews the corrected integrated tree; this capsule is preserved as
the correction trigger.

## Live-precondition snapshot

None — no deployment, login, browser, database, runtime, network, or HIGH action
was pending or performed by this wave. All probes ran in disposable `%TEMP%`
copies.
