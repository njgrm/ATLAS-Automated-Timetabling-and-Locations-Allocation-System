# TERM-CACHE-CATCHUP-PREVIEW — Delegated QA verdict (2026-09-13)

**Verdict: `ACCEPT_READY` — mandatory 6 / passed 6 / blocked 0 / unperformed 0.**

## Reviewed range

- Worktree `D:/ATLAS-worktrees/integration-term-cache-preview-20260913`, branch
  `integration/term-cache-preview-20260913`.
- Base `e0a10ebcd8efa0d4fa248b2c5948ed53a6c33c54` → candidate
  `28617cab04cba2571b932285f6b3d4b2aa2d2496` (docs-only, one added file:
  `docs/reviews/term-cache-catchup-preview-20260913/preview-capture-attempt.md`).
- QA task: `ses_f65151c6effe15Q5F87iA2FUmm` (fresh independent `atlas-qa-delegate`
  context; no login performed; login budget already consumed by the custodian).

## Independently reproduced checks (6/6)

1. **Immutable identity** — worktree clean; base ancestor; `git diff
   --name-status e0a10ebc...28617cab` = exactly one added docs file; no
   product/test/config change.
2. **Live DB truth** — mirror 223 active/not-archived, year 9 `2030-2031`,
   `termContractCachedAt` NULL; `TERM_CACHE_SYNC_APPLIED` 0; exactly one audit
   row `id > 773` = `LOCAL_LOGIN_SUCCESS` actor 46 school 1
   `2026-09-13T13:13:33.460Z`; actor 46 `lastLoginAt` `2026-09-13T13:13:31.799Z`,
   `failedLoginCount` 0, `lockedUntil` null, `facultyId` null;
   `183 / 1 / 0`; DB `atlas_recovery_clean_rebuild_20260905`.
3. **External-dependency truth** — `tailscale status`: `100.120.169.123
   dev-jegs … offline, last seen 1h ago`; `Test-NetConnection` TCP False, Ping
   False; raw `GET <ENROLLPRO_API>/integration/v1/school-year` (credential used
   in-process, never printed) → `WebException: The operation has timed out`
   (12119 ms), no HTTP status/body.
4. **Server-side corroboration** — supervisor log line
   `2026-09-13T13:14:14.513Z … 503 on POST /api/v1/runtime/term-authority/preview:
   ENROLLPRO_UNREACHABLE EnrollPro school-year authority is unreachable.`
5. **Source-trace classification** — `fetchEnrollProTermContract` maps an
   unreachable school-year fetch to `ENROLLPRO_UNREACHABLE` (503) at
   `atlas-server/src/services/enrollpro-term-contract.service.ts:397–407`; the
   preview route is JWT-only, privileged, actor-school-scoped, and rejects
   before any dispatch (`runtime.router.ts:441–480`). Packet §7 defines the
   ATLAS defect only when a raw upstream probe succeeds while the preview
   fails; here the raw probe also fails, so the record's external-outage
   classification is correct.
6. **Zero-write closure** — the only observable mutation is the single
   authorized login delta; no term-cache/apply/rollover/TL/generation/
   publication/migration/companion/listener action.

## Findings

- **Candidate defects: none.**
- **BLOCKING (cycle objective):** the successful preview (ordered terms,
  semantic revision, fingerprint, `confirmationText`) was not captured — the
  EnrollPro host is offline. ATLAS fail-closed behavior is correct.
- **NON_BLOCKING (N1, evidence limitation):** the custodian's browser-origin and
  session assertions cannot be re-driven in this QA pass without a login; they
  are corroborated by the server 503 log line, the DB login delta, and the raw
  upstream probe, with no contrary evidence.
- **NON_BLOCKING (N2, coordination):** `origin/main` had advanced to
  `1ccd2e63`; `e0a10ebc` is an ancestor and the candidate's parent is exactly
  the stated base. Integration was performed from the current tip (`23ad9d71`
  merge on `1ccd2e63`).

## Required planner action

Integrate the accepted truthful external-blocker record; keep the objective
blocked on EnrollPro host restoration plus a fresh explicit one-login
authorization for re-capture. The term-cache apply remains locked and unbound
(no fingerprint exists yet).
