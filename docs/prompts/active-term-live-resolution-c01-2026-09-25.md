# ACTIVE-TERM-LIVE-RESOLUTION-C01 packet (2026-09-25)

Program: `TEACHER-CONCERN-AUTHORITY-PROGRAM-20260924` follow-up — option **C1** (operator choice).
Tier: **MEDIUM-HIGH server authority**; no migration, no live-data action in this lane. Gates:
`docs/reference/agent-verification-gates.md`.

## Root cause (verified)

The persisted `EnrollProSchoolYearMirror.termContractCache.activeTerm` is **frozen by design**: both
writers (`applyTermCacheSync`, `syncActiveTermContractAuthority`) are idempotent on `semanticRevision`,
and `semanticRevisionFor` **excludes the active term** — so the persisted active term can only change when
the ordered structure changes. It went stale at `T1` on 2026-09-18 while EnrollPro's live active term is
`T2`. `GET /api/v1/runtime/context` already resolves the active term **live-first**
(`runtime-context.service.ts:452-486`), which is why the client shows T2; the shared
`academic-term.service.ts` (`loadVerifiedOrderedTermContract`) reads the frozen persisted value, which is
why the S1 availability write `409 TERM_SCOPE_MISMATCH`es.

## Objective

Make the shared ordered-term authority resolve `activeTermOrder` from the **live verified EnrollPro active
term** (live-first, persisted fallback, fail-closed), so every consumer of that one authority
(availability, generation snapshot, derived demand, readiness, published identity/schedule) agrees with
the client on the current term — without any live-data write.

## Design (bounded)

In `atlas-server/src/services/academic-term.service.ts`, change `loadVerifiedOrderedTermContract` (or add
a resolver it delegates to) so `activeTermOrder` comes from:
1. the **live** verified contract's `activeTerm.order` when EnrollPro is reachable (reuse
   `fetchEnrollProTermContract` / `resolveTermContractWithDependencies`); else
2. the persisted `termContractCache.activeTerm.order` (degraded fallback); else
3. `null` → callers keep their existing fail-closed `TERM_AUTHORITY_UNRESOLVED` (never Term 1).

Reads stay **non-persisting**. The ordered structure (terms/format) still comes from the persisted
verified cache when live is unreachable; a live contract that is `CONTRACT_INVALID`/unreachable must not
invalidate the persisted ordered structure.

**No client change is expected:** the client (`resolveActiveSchoolYearContext`) is already live-first via
`runtime/context` and shares the same persisted fallback, so the two agree in both the live and degraded
cases. If the executor proves a residual disagreement, report it — do not fork a second client resolver.

## Owned paths

- `atlas-server/src/services/academic-term.service.ts`
- additive fixture/assertion updates in `atlas-server/src/__tests__/**` for the changed active-term source
- `atlas-server/package.json` — only your own `test:active-term-live-resolution` line

Do **not** touch `runtime-context.service.ts` (already correct), generations/publication services beyond
importing the authority, `prisma/**`, or `atlas-client/**`.

## Acceptance rows

1. **Failing-first (gate 2):** with persisted activeTerm `T1` and a live contract returning `T2`,
   `loadVerifiedOrderedTermContract(...).activeTermOrder` = **2**; on base it is `1`. A mutant returning the
   persisted value must fail.
2. **Live-first + fallback + fail-closed:** live `T2` → 2; live unreachable → persisted fallback (`1`,
   degraded); no contract/`activeTerm` absent → `null`, and `resolveActiveAvailabilityTermIndex` throws
   `TERM_AUTHORITY_UNRESOLVED` (never Term 1).
3. **The 409 is gone on the real path:** `saveAvailabilityDraft` with the client's term (`2`) no longer
   throws `TERM_SCOPE_MISMATCH`, and the availability GET resolves the same term — prove on a disposable
   PostgreSQL DB or a controlled client, zero writes on rejection.
4. **No new persistence:** the authority read path performs **zero writes** (instrument the DB client).
5. **Blast radius (gate 9):** enumerate every `loadVerifiedOrderedTermContract` / `activeTermOrder`
   consumer and report, per consumer, that it now resolves the live term; state that generation and
   publication are **not run**. Report the `availability` freshness-digest consequence honestly (a move
   T1→T2 stales existing runs; no auto-regenerate).
6. Actor scope unchanged; no `?? 1`; existing fail-closed codes preserved.

## Evidence

One commit + short handoff: base SHA · candidate SHA · changed paths · what changed and why · the
failing-first control · the consumer enumeration · decisive commands with results · each risk
`BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`. Then a fresh independent `atlas-qa` over the
immutable range. `atlas-server/package.json` is resolved by union at integration.
