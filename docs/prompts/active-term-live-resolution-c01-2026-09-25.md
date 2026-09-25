# ACTIVE-TERM-LIVE-RESOLUTION-C01 packet — CORRECTED (2026-09-25)

Program: `TEACHER-CONCERN-AUTHORITY-PROGRAM-20260924` follow-up — option **C1** (operator choice).
Tier **MEDIUM-HIGH server authority**; no migration, no live-data action. This version supersedes the
first packet after the pre-action review returned `CORRECTION_REQUIRED` (B1/B2/B3).

## Root cause

The persisted `EnrollProSchoolYearMirror.termContractCache.activeTerm` is frozen by design
(`semanticRevisionFor` excludes the active term; both sync writers are idempotent on an unchanged
revision), so it is stale at `T1` while EnrollPro's live active term is `T2`. `GET /runtime/context`
already resolves the active term live-first with a **date-derived** persisted fallback
(`derivePersistedActiveTerm`: `activeOrder=1` at 2026-09-24 → T2). The shared
`academic-term.service.ts` reads the frozen value, so the S1 availability write 409s.

## Corrected design (staged, network-safe)

**B1 — no network inside server transactions.** `loadVerifiedOrderedTermContract` is called inside
Serializable/advisory-locked transactions (`published-revision.service.ts`, `publication-contract.service.ts`,
`generation-input-snapshot.service.ts` via `computeGenerationInputSnapshot`, `manual-edit.service.ts`,
`timetable-sync-setup.service.ts`, `timetable-teaching-load-repair.service.ts`). It **stays network-free
and unchanged**. Add a **separate** exported resolver and call it only at non-transaction entry points.

**B2 — one date-derived fallback.** The new resolver's fallback is the same **date-derived** active term
the client uses, not raw persisted `order`. Extract `derivePersistedActiveTerm` into
`academic-term.service.ts` and have `runtime-context.service.ts` import it (single implementation), so
client and server agree in both live and degraded states.

**Resolver:** `resolveActiveOrderedTermIndexLive(schoolId, schoolYearId, { provider?, now? })`:
1. live verified contract (reuse `fetchEnrollProTermContract`, with **bounded single-flight + a short
   TTL memo** and an injectable provider seam) → its `activeTerm.order`;
2. else the date-derived persisted active term;
3. else `null` → callers keep `TERM_AUTHORITY_UNRESOLVED` (never Term 1). Mirror runtime-context's
   authoritative semantics for reachable `ACTIVE_TERM_UNRESOLVED`/`CONTRACT_INVALID` (null, not a number).

**Stage 1 (this lane):** use the resolver in the **availability authority**
(`faculty-availability.service.ts` read/write, both non-transaction) so the concern-workspace write no
longer 409s against the client's T2. **Stage 2 (successor, disclosed):** pre-resolve at the
generation/publication entry points and thread the value into their transactions so generation/readiness
also move to T2 — not done here. **Disclosed divergence:** after Stage 1, availability resolves T2 while
generation/publication transactions still resolve the persisted T1. That is an improvement, not a
regression, but it is a divergence the successor must close.

## Owned paths

- `atlas-server/src/services/academic-term.service.ts` — the resolver + the extracted date derivation
- `atlas-server/src/services/runtime-context.service.ts` — import the extracted derivation only
- `atlas-server/src/services/faculty-availability.service.ts` — use the resolver in read/write
- `atlas-server/src/__tests__/**` — additive fixtures/assertions for the new source
- `atlas-server/package.json` — only your own `test:active-term-live-resolution` line

Do NOT touch the transaction services listed above, `prisma/**`, `atlas-client/**`, or the sync writers.

## Acceptance rows

1. **Failing-first:** persisted activeTerm `T1` + live contract `T2` → the resolver returns **2**; on base
   the availability term is `1`. A mutant returning the persisted value fails.
2. **Live + degraded (both T2):** live `T2` → 2; EnrollPro unreachable with persisted `T1` at 2026-09-24 →
   the **date-derived T2** (not 1); no contract → `null` → `TERM_AUTHORITY_UNRESOLVED`.
3. **The 409 is gone on the real path:** `saveAvailabilityDraft` with the client's term `2` succeeds and
   the availability GET resolves the same term — disposable PostgreSQL or a controlled client; zero
   writes on any rejection.
4. **Zero writes on read** (instrument the client write counter).
5. **Enumeration (gate 9):** list every `loadVerifiedOrderedTermContract` caller; state for each whether it
   uses the new resolver (availability only, Stage 1) or keeps the persisted/network-free path, and that
   **derived demand reads the persisted structure directly and does not consume `activeTermOrder`**.
6. Actor scope unchanged; no `?? 1`; fail-closed codes preserved.

## Evidence

One commit + short handoff: base SHA · candidate SHA · changed paths · what changed and why · the
failing-first control · the corrected caller enumeration · decisive commands with results · the disclosed
Stage-1 divergence · each risk `BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`. Then a fresh
independent `atlas-qa`. `package.json` is resolved by union at integration.
