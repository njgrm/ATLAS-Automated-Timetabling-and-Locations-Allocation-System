# TERM-CACHE-CATCHUP — the apply: persist ordered term authority for the ACTIVE school year

Status: **PREPARED (r1 — re-baselined to the live active year)**. Risk: **HIGH** (live-data write
on the shared database) + **HIGH** (one authorized login). Executes under the operator's standing
authorization with every gate retained.

**Why r1 exists.** The r0 draft was bound to `schoolYearId 9 / mirror 223 / 2030-2031`, taken from
the 2026-09-14 capture. That year is now **`isActive:false`** — the mirror table carries two
identifiers and the active row is **`id 551 / enrollProSchoolYearId 10 / 2031-2032`**
(`docs/handoffs/resume-2026-09-18-active-year-demo-path.md`; `resolveSoleActiveNonArchivedYear`
elects by the upstream value). The route always acts on the **server-elected** active row, so an
apply bound to year 9 is unreachable and its `confirmationText` is rejected `400
CONFIRMATION_REQUIRED` with zero writes. The r0 binding was therefore unsatisfiable, and its
recorded fingerprint was a **stale computed artifact**. Independent pre-action review
(`atlas-qa`, 2026-09-21) returned `CORRECTION_REQUIRED` on exactly this and cleared the underlying
contract 9/9.

**The rule this earns:** a preview fingerprint (or any computed artifact) is valid only for the
session and revision that produced it. This packet therefore **never binds a stored fingerprint** —
it derives the confirmation text and fingerprint from a live preview in the same session.

## 0. Preconditions — fail closed

1. Read `docs/reference/agent-runtime-deploy-facts.md`. Elevated shell is not needed unless a
   runtime/env/task step is touched (none should be).
2. **Live release identity.** The runtime must still be pin `80acdc25`
   (`D:\ATLAS-runtime-supervised-80acdc25-20260921`). Record `releaseSha` from the **active** state
   file, the listeners, and local + Tailnet health. If it is not `80acdc25`, stop and re-read §2 —
   this packet is bound to that source.
3. **Source contract check.** `git diff --name-only 80acdc25 origin/main -- atlas-server` must be
   empty.
4. **Elected target — the decisive check.** The server elects the active-year row; the packet does
   not choose it. The elected target **must be** `schoolId 1` / `schoolYearId 10` /
   `mirror id 551` / `yearLabel 2031-2032` / `format TRIMESTER`, with `persistedSemanticRevision:
   null`. **`schoolYearId 9` / mirror `223` / `2030-2031` is an inactive historical year — never
   apply to it.** If the election differs in any field, **stop and report**: the basis has moved
   again and the packet needs re-baselining, not improvisation.
5. **Pre-state record (read-only).** Record before any write: mirror **551**'s persisted cache
   value (expected `null`), `TERM_CACHE_SYNC_APPLIED` audit count (expected `0`), `audit_logs` max
   id, `FacultySubject` / `GenerationRun` / `PublishedScheduleRevision` counts, and actor 46
   `lastLoginAt`. These are the delta baseline and the rollback basis.
6. **EnrollPro reachability.** The apply fetches upstream authority; if EnrollPro is unreachable the
   route returns `503` and **nothing is written**.

## 1. What this does, and what it does not

- **Does:** persists ONLY the active school year's ordered term authority (school, year, format, the
  exact ordered terms) into the active-year mirror's cache — **one mirror row update plus one audit
  row**.
- **Does not:** no faculty/section/Teaching Load sync; no rollover sync/archive; no Teaching Load
  action; no generation; no publication; no schema/migration; no runtime/task/env change; no
  companion mutation; no other school and no other year.
- **Idempotent by construction:** if the persisted revision already equals the live revision the
  preview reports `ALREADY_CURRENT` and no write is required (§3 step 4).

## 2. The exact contract (pinned source, `atlas-server/src`)

- `POST /api/v1/runtime/term-authority/preview` body `{"schoolId":1}` — `authenticate` **plus**
  `authorizeTermAuthorityCaller`: **JWT-only** (no system-token branch), privileged role
  (admin/officer/SYSTEM_ADMIN), actor school must equal the target, `schoolId` a present positive
  integer that **never defaults**. Returns `{state, format, terms[], liveSemanticRevision,
  persistedSemanticRevision, cachedAt, fingerprint, confirmationText, zeroWrite:true}`.
- `POST /api/v1/runtime/term-authority/apply` body
  `{"schoolId":1,"confirmationText":"SAVE_TERM_AUTHORITY_1_10","fingerprint":"<64-hex>"}`.
- **Fingerprint composition (verbatim):**
  `sha256(JSON.stringify({ schemaVersion: 'RR-TERM-CACHE-C01.1', schoolId, schoolYearId, mirrorId,
  format, liveSemanticRevision, persistedSemanticRevision }))`.
- **Confirmation text:** `SAVE_TERM_AUTHORITY_${schoolId}_${schoolYearId}` → for the elected target,
  `SAVE_TERM_AUTHORITY_1_10`.
- **Full rejection order, all before any write.** Route: `403 FORBIDDEN` → `403
  ACTOR_USER_REQUIRED` → `400 INVALID_PARAM` → `403 SCHOOL_SCOPE_REQUIRED` → `403
  CROSS_SCHOOL_DENIED`. Service: `400 INVALID_PARAM` → `403 ACTOR_USER_REQUIRED` → `409
  ACTIVE_YEAR_UNAVAILABLE` / `409 ACTIVE_YEAR_AMBIGUOUS` → `400 CONFIRMATION_REQUIRED` → `400
  FINGERPRINT_REQUIRED` → upstream `503` (unreachable) / `409` (typed contract failure) → **`409
  FINGERPRINT_MISMATCH`** → then the `$transaction`, which itself can fail closed with `409
  ACTIVE_YEAR_CHANGED`, an in-transaction `409 FINGERPRINT_MISMATCH`, or `409
  TERM_CACHE_CONCURRENT_UPDATE`.
- **The only writes in the entire path** are the mirror `updateMany` (cache + `cachedAt`) and one
  `auditLog` row — both inside that transaction. A stale fingerprint, a stale confirmation, a
  changed election, or an unreachable upstream therefore writes **nothing**.

## 3. Execution plan

1. **Preflight (read-only, no login):** §0 items 2–6; record every literal.
2. **One authorized login** at `https://njgrm.buru-degree.ts.net` in the persistent profile (the
   single browser controller). Disclose the `LOCAL_LOGIN_SUCCESS` `audit_logs` row id and the actor
   `last_login_at` delta. No extra login.
3. **Fresh zero-write preview** — `POST …/term-authority/preview {"schoolId":1}`, **exactly once**.
   Record the literal body. Then assert, before any apply:
   - elected identity is `1 / 10 / 551 / 2031-2032 / TRIMESTER` (§0 item 4) — otherwise **stop**;
   - `state` is **`READY`** or **`ALREADY_CURRENT`** — anything else, stop and report;
   - `confirmationText` equals **`SAVE_TERM_AUTHORITY_1_10`**;
   - `terms[]` are the ordered `T1/T2/T3` for the elected year, `format` `TRIMESTER`;
   - **recompute the fingerprint yourself** from the response's own fields using the §2 composition
     and assert it equals the returned `fingerprint`. This is the check that would have caught the
     r0 wrong-year binding.
4. **Apply** — `POST …/term-authority/apply` using the **`fingerprint` and `confirmationText` from
   this session's preview**, exactly once. Never reuse a fingerprint from any earlier cycle or
   capture. Record the literal status and body.
   - If the preview returned `ALREADY_CURRENT`, **do not apply**: report the cycle as `NOT_REQUIRED`
     with the preview as proof (a pass, not an omission).
5. **Verify (post-state):** re-run the preview — expect `state: ALREADY_CURRENT`,
   `persistedSemanticRevision == liveSemanticRevision`, `cachedAt` non-null. Record the DB delta: it
   must be **exactly** the one login audit row + actor `last_login_at`, one `TERM_CACHE_SYNC_APPLIED`
   audit row (count 0 → 1), and mirror **551**'s cache value.
6. **Cleanup:** close tabs, release the browser context, log out, and confirm `GET
   /api/v1/auth/me` → `401 NO_TOKEN`. Leave no remembered token.

## 4. Acceptance — 6 mandatory rows

**A1 preflight identity and baseline.** §0 items 2–6 with literals: release `80acdc25`, source
contract diff empty, elected target `1 / 10 / 551 / 2031-2032 / TRIMESTER`, mirror 551's
`persistedSemanticRevision` null, `TERM_CACHE_SYNC_APPLIED` 0, audit max id, the other count
baselines.

**A2 fresh preview.** HTTP 200, `zeroWrite:true`, `state` `READY` or `ALREADY_CURRENT`,
`format TRIMESTER`, ordered `T1/T2/T3` for the elected year, `confirmationText
SAVE_TERM_AUTHORITY_1_10`, and **the returned fingerprint independently recomputed from the
response's own fields and found equal**. A mismatch, a different elected year, or a different
confirmation is `BLOCKED` with both values reported — never forced.

**A3 apply.** `READY` → HTTP 200 from `…/apply`, called exactly once with this session's values,
body recorded. `ALREADY_CURRENT` → reported `NOT_REQUIRED` with the A2 proof (a **pass**).

**A4 post-state truth.** Re-preview `state=ALREADY_CURRENT` with `persistedSemanticRevision ==
liveSemanticRevision` and `cachedAt` non-null; the persisted structure matches the previewed terms
field-for-field.

**A5 write isolation.** DB delta exactly as §3 step 5 — one login row, one `TERM_CACHE_SYNC_APPLIED`
row, mirror 551's cache value — and nothing else, in particular no write to mirror 223 or any other
year. Any other delta is an **incident stop**.

**A6 downstream unblock.** The canonical readiness diagnostic no longer fails with
`TERM_STRUCTURE_UNAVAILABLE` for school 1 / year 10, and the TT/TL acceptance rows previously
blocked on a missing persisted term snapshot can be re-run. Record the literal response; if it still
fails, report the typed blocker rather than calling the row passed.

`ACCEPT_READY` requires **6/6 passed, blocked 0, unperformed 0**. An unperformable row is
`BLOCKED`/`UNPERFORMED` with its reason, never "not applicable".

## 5. Rollback

The pre-state is **no cache** (`persistedSemanticRevision: null`), so the functional revert is to
restore mirror **551**'s persisted cache column to its recorded pre-apply value and leave both audit
rows in place as the record. That revert is itself a HIGH data write needing its own approval, and
it is only needed if A4/A5 fail. Record the exact pre value in A1 so the revert is mechanical.
Nothing here touches source, the runtime, the schema, or any other year.

## 6. Gates and return

- Source/contract review is **closed** (independent pre-action review 9/9, `ACCEPT_READY` for the
  contract; the packet defects above are the r1 correction of that same review — no second review
  round, per `AGENTS.md` §11).
- **One fresh independent post-action QA** over A3–A6, reproduced from the database and the live
  API after the write.
- Return **one handoff and one evidence artifact**
  (`docs/reviews/term-cache-catchup-20260921/apply-evidence.md`): the pin, the literal preflight, the
  preview and apply bodies, the recomputed-vs-returned fingerprint comparison, the post-state, the
  full DB delta with audit row ids, the login disclosure, the rollback basis, and risks marked
  `BLOCKING`/`NON_BLOCKING`. No credentials, tokens, or unrelated database rows.
