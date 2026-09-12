# TERM-CACHE-CATCHUP-PREVIEW-2026-09-13 — Reviewed preview packet (preparation only)

Status: **PREPARED — AWAITING ONE BOUNDED-LOGIN AUTHORIZATION.** This packet
authorizes **no mutation**. The only side effect it requests is exactly one
bounded local login (see §4), whose only expected database delta is one
`LOCAL_LOGIN_SUCCESS` audit row plus that actor's `last_login_at`. The preview
call itself is zero-write. The term-cache **apply** remains a later, separate
HIGH action with its own fingerprinted packet, independent QA, and explicit
approval.

Prepared: 2026-09-13 (Asia/Manila) by the primary planner under cycle
`companion-sso-and-term-cache-prep-20260913`, Phase 3.

Risk: **Authorized portion = LOW (login audit delta + zero-write preview).**
The follow-on apply is **HIGH** (live data write) and is not authorized here.

## 1. Objective

Capture the live zero-write term-authority preview for school 1 against the
live supervised release `3d916b26`, so that the later apply packet can bind the
exact ordered-term fingerprint and confirmation string, and so the blocked
TT-TL acceptance rows (4–5, `TERM_STRUCTURE_UNAVAILABLE`) have a reviewed path
to closure after an approved apply.

## 2. Verified target identity and evidence

Captured by the post-action wave audit 2026-09-13 00:05–00:55 +08
(`docs/reviews/tt-tl-runtime-acceptance-20260912/wave-completion-audit-postaction.md`);
re-verify read-only immediately before the bounded session (§3).

- **Runtime:** supervised release `3d916b26` (`D:\ATLAS-runtime-supervised-3d916b26-20260912`),
  supervisor PID 44336; server `5001→30032`, production host `5174→27408`;
  local `/api/v1/health` + `/api/v1/health/ready` 200; Tailnet
  `https://njgrm.buru-degree.ts.net` health 200; `ROLLOVER_AUTO_SYNC_ENABLED=false`;
  boot task re-pointed; rollback = supervised reset to `9d293879` (plus the
  documented non-supervised `d44f29e0` manual fallback).
- **Active-year mirror (read-only DB evidence):** exactly one active
  non-archived mirror for school 1 — mirror id `223`, EnrollPro year
  `9 / 2030-2031`; `termContractCache = NULL`, `termContractCachedAt = NULL`;
  year 8 archived.
- **Source contract (origin/main; integrated, served by `3d916b26`):**
  `POST /api/v1/runtime/term-authority/preview` `{ schoolId }` is JWT-only,
  privileged, actor-school-scoped (`403 FORBIDDEN` / `ACTOR_USER_REQUIRED` /
  `SCHOOL_SCOPE_REQUIRED` / `CROSS_SCHOOL_DENIED`; `400 INVALID_PARAM`), and
  returns `{ schoolId, schoolYearId, yearLabel, mirrorId, state: 'READY' | 'ALREADY_CURRENT', code, message, format, terms[], liveSemanticRevision, persistedSemanticRevision, cachedAt, activeTermAvailability, fingerprint, confirmationText, zeroWrite: true }`.
  `confirmationText` is `SAVE_TERM_AUTHORITY_<schoolId>_<schoolYearId>`; the
  fingerprint is a 64-char SHA-256 over the school/year/mirror/format/revisions.
  `terms[]` carries the ordered identity/label/order/dates.
- **EnrollPro contract evidence:** the authoritative ordered three-term contract
  for year 9 / `2030-2031` is served live; while the host date remains in 2026 a
  reachable `409 ACTIVE_TERM_UNRESOLVED` is expected and is a **valid**
  structure state (`activeTermAvailability: 'UNRESOLVED'`), not a contract
  failure and not "unreachable". A preview that returns terms with an
  unresolved active term is acceptable; a preview that fails while a raw
  ordered-contract probe succeeds is a finding (§7).

## 3. Read-only preflight (before any login; no mutation)

1. `GET http://localhost:5001/api/v1/health` and `/health/ready` = 200; Tailnet
   health = 200.
2. Supervisor status shows `releaseSha=3d916b26…` and `ROLLOVER_AUTO_SYNC_ENABLED=false`;
   installed HEAD of the release directory = `3d916b26…`; listeners are the
   recorded PIDs (or re-recorded exact owner PIDs). If any precondition
   diverges, STOP and return the state — do not log in.
3. Read-only DB signatures (sanitized, no secrets): `schools` count; active
   mirror row `(id, enrollProSchoolYearId, yearLabel, isActive, isArchived,
   termContractCachedAt)`; `auditLog` count where
   `action='TERM_CACHE_SYNC_APPLIED'` (expect 0); actor's `last_login_at`;
   custodian actor row's `failed_login_count` / `locked_until` / `faculty_id`
   (expected no-ops on the login path); `auditLog` max id;
   `facultySubject`/`generationRun`/`publishedScheduleRevision` counts. These
   are the before-signatures.

## 4. Exact authorization sentence (copy-ready)

> I authorize exactly one bounded local login at the ATLAS Tailnet origin
> https://njgrm.buru-degree.ts.net for a privileged QA custodian context, whose
> only expected database mutation is one `LOCAL_LOGIN_SUCCESS` audit row plus
> that actor's `last_login_at`, to execute the zero-write term-authority
> catch-up preview `POST /api/v1/runtime/term-authority/preview {"schoolId":1}`
> against live release `3d916b26` and record its ordered terms, semantic
> revisions, fingerprint, confirmation text, and before/after zero-write
> signatures. No term-cache apply, rollover sync, Teaching Load mutation,
> generation, publication, migration, schema, companion-repository, or
> runtime-listener action is authorized.

Not granted by this sentence: the apply; row re-runs of TT-TL acceptance;
generation; publication; any companion change. Those remain separately gated.

## 5. Bounded session plan (after the sentence is returned)

- **Role:** one privileged QA custodian context (same conventions as prior
  approved logins; local credential source per `AGENTS.md`; never written into
  artifacts). One login only. The executor does not log in.
- **Expected audit delta:** exactly one `LOCAL_LOGIN_SUCCESS` row with a higher
  id than the max id recorded in §3, plus that actor's `last_login_at`
  transition. The login update also re-asserts `failedLoginCount=0`,
  `lockedUntil=null`, and `facultyId` on the same actor row; for the intended
  custodian these are verified no-ops, and they are covered by the extended §3
  signature set. Any other delta is an incident stop.
- **Session use:** at the Tailnet origin, call the preview with the
  authenticated browser session (`schoolId: 1`). Record the full JSON response
  (no tokens): `terms[]` (identity, displayLabel, order, startDate, endDate),
  `format`, `liveSemanticRevision`, `persistedSemanticRevision` (expect null),
  `cachedAt` (expect null), `activeTermAvailability` (accept `UNRESOLVED`),
  `state` (expect `READY`), 64-char `fingerprint`, and exact
  `confirmationText` (expected shape `SAVE_TERM_AUTHORITY_1_<schoolYearId>`).
- **Custody/cleanup:** logout, confirm `GET /api/v1/auth/me` returns 401
  `NO_TOKEN`, close the context, and leave no new untracked artifacts.
- **Zero-write proof after:** re-read the §3 signatures; assert
  `termContractCache` still NULL, `termContractCachedAt` still NULL, zero
  `TERM_CACHE_SYNC_APPLIED` audits, and no FacultySubject / GenerationRun /
  PublishedScheduleRevision delta. The only delta must be the login.

## 6. What follows (separate actions; nothing here authorizes them)

1. Independent QA of the preview evidence and fingerprint (fresh, read-only).
2. A separate **apply** packet binding the exact `fingerprint` +
   `confirmationText`, with its own explicit HIGH approval. The apply writes
   ONLY the active mirror's `termContractCache`/`termContractCachedAt` plus one
   `TERM_CACHE_SYNC_APPLIED` audit; its rollback is restoring those two columns
   to their recorded prior values (NULL/NULL) with the audit row retained.
3. After an approved apply: re-run TT-TL acceptance rows 4–5 and the canonical
   readiness diagnostic for school 1 / year 9-2030-2031.
4. Generation and publication remain locked behind their own previews,
   QA, and explicit approvals.

## 7. Stop conditions and failure taxonomy

- Any request to write (including the apply) before the separate approval: STOP.
- Preview returns `UPSTREAM_UNAVAILABLE`/`INVALID_UPSTREAM_CONTRACT` while a raw
  EnrollPro ordered-contract probe shows the three-term contract reachable:
  treat as a **defect finding**, do not apply, return the typed evidence.
- `ACTIVE_TERM_UNRESOLVED` in `code`/`activeTermAvailability` with `terms[]`
  present: acceptable — record it; it must not block the apply decision by
  itself.
- Unexpected listener/PID/release divergence, any non-login DB delta, or any
  secret exposure: incident stop; preserve evidence; report.
- Unrecoverable session loss before the preview: return
  `AUTH_SESSION_REQUIRED` again with the same sentence; do not substitute
  credentials or reuse a code.

## 8. Mutation exclusions (hard stop)

No `term-authority/apply`; no rollover sync/archive; no Teaching Load
carry-forward/suggestion apply; no generation; no publication; no
schema/migration; no shared-runtime restart/cutover; no companion mutation. The
sole authorized write across this packet is the single login audit delta.
