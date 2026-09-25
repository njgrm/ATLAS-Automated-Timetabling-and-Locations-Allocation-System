> **BLOCKED (2026-09-25) — option A is unsatisfiable via this route.** The pre-action review found the
> live and persisted `semanticRevision` byte-identical (`e0dba8dc…`) because `semanticRevisionFor`
> **excludes the active term**, so `applyTermCacheSync` takes the zero-write replay branch and the
> persisted `activeTerm` stays T1; the lone writer `syncActiveTermContractAuthority` is likewise
> idempotent on an unchanged revision. **The persisted active term is frozen by design and cannot be
> refreshed alone.** The preview also exposes no `activeTerm.order`, so the apply gate is undecidable.
> **Do not run the apply.** Revised options: `docs/plans/live-state.md` (Lane A).
# TERM-AUTHORITY-REFRESH-C01 packet (2026-09-25)

Program: `TEACHER-CONCERN-AUTHORITY-PROGRAM-20260924` follow-up. HIGH live-data action (operator chose
option A on 2026-09-25). Procedure: `docs/reference/agent-runtime-deploy-facts.md`; gates
`docs/reference/agent-verification-gates.md`. Standing authorization covers it **with all gates**.

## Why

The concern workspace's write returned `409 TERM_SCOPE_MISMATCH` (UI `termIndex 2` vs persisted active
term `1`). Root cause: the S1 server resolves the active term from the **persisted**
`EnrollProSchoolYearMirror.termContractCache.activeTerm` (`loadVerifiedOrderedTermContract`) = **T1**
(cached 2026-09-18), while the live UI authority resolves **T2**. Refresh the persisted ordered-term
multicast so the persisted authority matches EnrollPro's live contract; then server and client agree.

## Target

- School `1`, school year `10` (mirror row 551); DB `atlas_recovery_clean_rebuild_20260905` @ localhost:5432.
- Routes (JWT, privileged admin/officer/SYSTEM_ADMIN, actor-school scoped):
  `POST /api/v1/runtime/term-authority/preview` → `POST /api/v1/runtime/term-authority/apply`
  (`applyTermCacheSync`; CAS-guarded `updateMany` on `termContractCachedAt`; writes an audit row).
- **Record the before-value** first: the current `termContractCache.activeTerm` / `semanticRevision` /
  `termContractCachedAt` for school 1 / year 10 (read-only).

## Procedure

1. **One custodian login** (QA account, privileged) to obtain a JWT — one `LOCAL_LOGIN_SUCCESS` +
   `last_login_at` audit delta; disclose it; **never print credentials**. Self-login only if your tool
   rules permit entering a password; otherwise report `NEEDS_SESSION` and stop.
2. **Preview (zero-write):** `POST /runtime/term-authority/preview` with `{schoolId:1}`. Capture: ordered
   terms, `activeTerm.order` / `activeTermState.availability`, `semanticRevision`, `fingerprint`,
   `confirmationText`. Verify **zero writes** (mirror `termContractCachedAt` unchanged).
3. **Gate:** APPLY **only if** the preview resolves `activeTerm` = **2** (T2) and the ordered structure is
   valid. If the preview is `UNRESOLVED`/`UNAVAILABLE`/`CONTRACT_INVALID`, or resolves to any term other
   than 2 — **STOP and report** (do not apply). State the literal preview payload.
4. **Apply:** `POST /runtime/term-authority/apply` with the preview's exact `fingerprint` and
   `confirmationText`. Expect `applied:true`, `written:true`, an `auditId`, and a new
   `semanticRevision`/`cachedAt`. A concurrent-change `409 TERM_CACHE_CONCURRENT_UPDATE` means re-preview.
5. **Prove:** the persisted `termContractCache.activeTerm.order` = 2 and `termContractCachedAt` advanced;
   `GET /api/v1/faculty-availability/1/10/faculty/<id>` now resolves without `409 TERM_AUTHORITY_*`; the
   server `loadVerifiedOrderedTermContract` returns `activeTermOrder = 2`. No generation/publication/TL/
   term-cache-of-other-years action.

## Rollback

The apply records `previousSemanticRevision` and writes an audit row; the before-value recorded in step 0
is the restore basis. To revert, re-apply the previous contract or restore the mirror row's
`termContractCache`/`termContractCachedAt` to the recorded before-value (a separate HIGH action).

## Out of scope

Generation, publication, Teaching Load apply, broad rollover apply (`/rollover-sync/apply`), companion
repos. The paired **client alignment** fix (the concern workspace must source its term from the server, not
`resolveActiveSchoolYearContext`) is a separate MEDIUM lane.

## Acceptance / evidence

One executor handoff: before-value · login audit id (if any) · preview payload (fingerprint,
confirmationText, resolved activeTerm) · apply result (applied/written/auditId/semanticRevision) ·
post-checks · each risk `BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`. Then a fresh independent
post-action QA. If a gate fails, STOP at the last safe point and report; do not force.
