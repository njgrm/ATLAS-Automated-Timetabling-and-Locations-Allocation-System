# Wave Completion Audit capsule — CLIENT-QUALITY-C01 + CLIENT-QUALITY-RELEASE-SWAP-01

## Audit provenance

| Field | Value |
| --- | --- |
| Auditor task/session id | `ses_f4eb2fa52ffeRjH9ygi8SiEDzF` |
| Model / reasoning variant | `opencode-go/deepseek-v4.1-flash` |
| Tier fallback | **Disclosed** — `max` (or `high`) is not exposed by this harness; the verdict rests on reproduced evidence, not the tier |
| Reviewed `origin/main` | `e195aef763ad055a6c3c4fb8ad6866472c481d7e` |
| Deployed release pin | `78be1b760e4059a4c0d0ea227579eaeb731cdf6d` at `D:\ATLAS-runtime-supervised-78be1b760e40-20260918` |
| Candidate / integration | `d8ca175f` / `e195aef7` (swap, docs+register only); C01 candidate `1fd4c1a6` (base `11de142b`) |
| Verdict | **`AUDIT_CLEAR`** |
| Mandatory tally | **9 / 9 / 0 / 0** |

## Checks passed

1. Git identity and range scope: swap delta `78be1b76..d8ca175f` = 2 docs paths; the deployed pin's `atlas-client/src` and `atlas-server/src` are byte-identical to the accepted tip `ee5a2bf1` — no unaccounted product byte.
2. Register state and both gates exit 0 at revision 360.
3. Runtime identity from the registry, task XML, listener→parent tree, state file, and health/ready/host/Tailnet all 200; zero previous-release node processes.
4. The central claim: served bundle hashes match the release `dist`; the hook is at line 183, before the early returns; unauthenticated `/timetable` fetches the chunk with zero errors; the authenticated 30-route crawl reused from QA.
5. Durable env unchanged (mtime predates `executedAt`); rollback target intact.
6. No regression: `DashboardCharts*` zero references in source and absent from `dist`; `RouteErrorBoundary` wired on 6 routes; no new fail-open school default; the single removed assertion is inventoried and replaced (1 removed → 5 added).
7. Closure legality confirmed for both lanes.
8. N1 adjudicated as a docs-only planner remedy.
9. Directive pin read from Git bytes and matching.

## Findings

- **BLOCKING: none.**
- **N1 NON_BLOCKING** — the swap's packet-required evidence document was absent; the source lane's doc is not the swap's. Remedied by `release-swap-01-evidence-2026-09-17.md` in this closure.
- **N2 NON_BLOCKING** — the "nonexistent worktree/branch" sub-claim was true of the *seed spec*, not the live register; the seed was reconciled.
- **N3 NON_BLOCKING** — `CLIENT-QUALITY-C01.nextAction` was stale pre-dispatch prose and its acceptance has no durable provenance; a fresh independent QA with the final 13-gate tally is genuinely required before that lane closes.
- **N4 NON_BLOCKING** — the ownership change to `BUILTIN\Administrators` was an unlisted mechanism, disclosed in the execution outcome and recorded as errata in the evidence document.
- **N5 NON_BLOCKING** — `atlas-client/qd.txt` is a pre-existing tracked stray build log, out of this wave.
- **N6 NON_BLOCKING** — the C01 evidence doc contains one stale justification (it blames a live 401 on the `ENROLLPRO-PROXY-RECOVERY-LIVE` lane, which is `COMPLETE` and returns 200 today).

## Live-precondition snapshot at audit

Supervisor 48564 (task-launched) with children 42904 (5001) and 27044 (5174); `releaseSha=78be1b76`; health/ready/db/host/Tailnet 200; durable env unchanged by the swap; previous release `8eb0511b` present and rollback-proven. No login performed by the auditor.

## Required primary-planner action

Apply the docs-only reconciliation (done in this closure), run the swap closure sequence with a refreshed remote observation, then commission `CLIENT-QUALITY-C01`'s fresh independent QA and close that lane.
