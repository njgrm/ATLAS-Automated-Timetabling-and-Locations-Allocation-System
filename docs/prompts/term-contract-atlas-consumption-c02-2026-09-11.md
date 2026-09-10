# TERM-CONSUME-C02 — Consume EnrollPro term structure independently of active term

## Objective

Make ATLAS consume and retain EnrollPro's authoritative ordered term structure
for the active mirrored year even when no configured term contains today's
Manila date. Preserve the typed active-term state, keep passive reads
zero-write, and prepare the authoritative input required by DEMAND-C01.

## Current verified truth

- READ_ONLY EnrollPro reference commit: `5887d685b834db31600be258e96be3bdd0bccacb`.
- Live `/api/integration/v1/school-year` returns HTTP 200 for year 9 /
  `2030-2031`, `TRIMESTER`, with ordered `T1`, `T2`, and `T3` entries, display
  labels, and inclusive dates.
- Live `/api/integration/v1/active-term` returns HTTP 409
  `ACTIVE_TERM_UNRESOLVED` because the host date is in 2026 while the configured
  demonstration year is 2030-2031.
- The 409 is a reachable, valid no-current-term state. It must not invalidate
  the ordered school-year term structure.
- Current ATLAS `fetchEnrollProTermContract()` requires both requests to return
  200 and makes `VerifiedTermContract.activeTerm` mandatory. It therefore
  rejects the valid year-9 contract and cannot establish its fallback cache.
- Current authenticated `GET /subjects/scheduling-authority` may refresh the
  mirror cache as a side effect. Passive reads must not be the authority that
  creates or repairs rollover state.

## Git and boundaries

Create a fresh worktree and neutral branch from refreshed `origin/main`.
Record the base SHA. EnrollPro, AIMS, and SMART are READ_ONLY; do not edit,
install dependencies in, migrate, or otherwise mutate them.

Allowed ATLAS paths are the EnrollPro term-contract/active-term adapters,
rollover synchronization integration needed to persist the verified cache,
the Subjects scheduling-authority projection, focused tests, runtime source map,
progress ledger, and changelog. Do not implement derived curriculum demand,
Teaching Load reconciliation, timetable generation, publication, or UI redesign
in this pass. Do not apply a migration or mutate live data.

## Required behavior

1. Model ordered term structure and current active-term resolution as separate
   authority results. The ordered structure is required; the active term may be
   resolved, unresolved, unavailable, or contract-invalid with a typed code.
2. When `/school-year` returns a valid exact-school/year ordered contract and
   `/active-term` returns 409 `ACTIVE_TERM_UNRESOLVED`, return a verified live
   term structure with `activeTerm: null` and the preserved reachable typed
   state. Do not return `ENROLLPRO_UNREACHABLE`.
3. Reject malformed structure, mismatched school/year, unsupported format,
   duplicate/out-of-order terms, invalid dates, or an active-term identity that
   contradicts the ordered structure. Preserve typed upstream errors where
   safe.
4. Persist a verified term-structure cache only through the explicit
   actor-scoped rollover/synchronization write path after the exact active
   mirror is established. Bind the cache to school, year, semantic revision,
   and verification time.
5. Keep `GET /subjects/scheduling-authority` and other passive reads zero-write.
   They may use a verified live structure or an exact-school/year validated
   cache, but they must not create, repair, or update the mirror/cache.
6. If EnrollPro is unreachable after a valid cache exists, return
   `VERIFIED_CACHED` with degraded copy and the exact cached term identities.
   If no valid cache exists, fail closed without synthesizing `T1`, labels,
   counts, or dates.
7. Never copy the EnrollPro term structure into the superseded operator-owned
   Curriculum Requirements workflow. DEMAND-C01 will consume this authority in
   its own successor stream.
8. Keep all school and year scope actor-derived or exact-mirror-bound. No school
   1, year, term-count, or label fallback is permitted.

## Failing-first controls

- School-year 200 plus active-term 409 `ACTIVE_TERM_UNRESOLVED` produces a
  verified three-term structure and nullable active term.
- School-year 200 plus network failure on active-term preserves structure and
  reports active-term availability separately.
- Active-term 200 with an identity outside the ordered structure fails typed.
- School/year mismatch and malformed/duplicate/out-of-order terms fail closed.
- Explicit rollover sync writes exactly one scoped cache revision; replay with
  the same semantic revision is idempotent.
- Passive scheduling-authority GET performs zero Prisma writes, including when
  live verification succeeds.
- Cached fallback is accepted only for the exact school/year and matching
  semantic revision; forged/cross-school/cross-year cache fails closed.
- Mutant controls prove the old all-or-nothing 200/200 implementation rejects
  the valid unresolved-active-term fixture.

## Verification

- Use production services and the mounted scheduling-authority and rollover
  paths; helper-only tests are insufficient.
- Instrument Prisma writes for passive-route zero-write proof and prove the
  detector with a rolled-back positive control.
- Use disposable database fixtures for rollover/cache writes with exact cleanup.
- Run focused term authority, mounted-route, and rollover tests; server/client
  TypeScript checks where contracts changed; server build and built-server
  startup with rollover automation disabled; committed-range diff check.
- Probe the live EnrollPro routes read-only and record the current 200/409
  matrix. Do not restart shared port 5001.
- Obtain one fresh independent QA review. Correct material findings with
  additive commits and repeat QA on the changed range.

## Handoff

Commit the bounded candidate and return base SHA, candidate SHA, exact paths,
term/active-state matrix, cache-write and passive-zero-write evidence, test
counts, live read-only results, known risks, and `REVIEW_REQUIRED`. Do not merge
or push.

Suggested commit:

```text
fix(term): decouple ordered structure from active-term resolution
```
