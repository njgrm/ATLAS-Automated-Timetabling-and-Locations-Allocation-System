# TERM-CACHE-CATCHUP — the apply: persist ordered term authority for the active school year

Status: **PREPARED**. Risk: **HIGH** (live-data write on the shared database) + **HIGH** (one
authorized login). Executes under the operator's standing authorization with every gate retained.

Basis: the reviewed zero-write capture `TERM-CACHE-CATCHUP-PREVIEW` (cycle
`term-cache-catchup-preview-20260914`, evidence `docs/reviews/term-cache-catchup-preview-20260914/`,
candidate `9c19b772`, fresh QA `ACCEPT_READY` 8/8). That cycle captured the fingerprint and
confirmation text; **this cycle writes them.** It is the step that unblocks the canonical readiness
diagnostic, generation, and the two TT/TL acceptance rows stalled on `TERM_STRUCTURE_UNAVAILABLE`.

## 0. Preconditions — fail closed

1. Read `docs/reference/agent-runtime-deploy-facts.md`. Elevated shell is **not** required for the
   apply itself; it is required if any runtime/env/task step is touched (none should be).
2. **Live release identity.** The runtime must still be pin `80acdc25`
   (`D:\ATLAS-runtime-supervised-80acdc25-20260921`). Record `releaseSha` from the **active**
   state file, the listeners, and local + Tailnet health. If the release is not `80acdc25`, **stop
   and re-read the route contract** — this packet's §2 is bound to that source.
3. **Source contract check.** The deployed route contract must equal the packet's §2:
   `git diff --name-only 80acdc25 origin/main -- atlas-server` must be empty.
4. **Target election.** The server elects the active-year mirror; the packet does not choose it.
   Preflight must show the elected target is **`schoolId 1` / `schoolYearId 9` / mirror `223` /
   `yearLabel 2030-2031` / `format TRIMESTER`**, with `persistedSemanticRevision: null`. **If the
   election differs, stop and report** — do not apply to a differently elected year.
5. **Pre-state record (read-only).** Capture before any write: the mirror row's persisted cache
   value (expected `null`), `TERM_CACHE_SYNC_APPLIED` audit count (expected `0`), `audit_logs`
   max id, `FacultySubject` / `GenerationRun` / `PublishedScheduleRevision` counts, and actor 46
   `lastLoginAt`. These are the rollback basis and the delta baseline.
6. **EnrollPro reachability.** The apply fetches upstream authority; if EnrollPro is unreachable the
   route returns `503` and **nothing is written**. Confirm reachability in preflight.

## 1. What this does, and what it does not

- **Does:** persists ONLY the active school year's ordered term authority (school, year, format,
  the exact ordered terms) into the active-year mirror's cache. This is a **cache write on one
  mirror row** plus one audit row.
- **Does not:** no faculty, section, or Teaching Load sync; no rollover sync/archive; no Teaching
  Load action; no generation; no publication; no schema/migration; no runtime/task/env change; no
  companion mutation.
- **Idempotent by construction:** if the persisted revision already equals the live revision the
  preview reports `ALREADY_CURRENT` and no write is required (§3 step 3).

## 2. The exact contract (pinned source, `atlas-server/src`)

- `POST /api/v1/runtime/term-authority/preview` body `{"schoolId":1}` — `authenticate` +
  `authorizeTermAuthorityCaller`: **JWT-only**, privileged role (admin/officer/SYSTEM_ADMIN), actor
  school must equal the target, `schoolId` must be a present positive integer (never defaults).
  Returns `{state, format, terms[], liveSemanticRevision, persistedSemanticRevision, cachedAt,
  fingerprint, confirmationText, zeroWrite:true}`.
- `POST /api/v1/runtime/term-authority/apply` body
  `{"schoolId":1,"confirmationText":"SAVE_TERM_AUTHORITY_1_9","fingerprint":"<64-hex>"}`
- Rejection order, all **before any write**: `403 FORBIDDEN` / `403 ACTOR_USER_REQUIRED` /
  `400 INVALID_PARAM` / `403 SCHOOL_SCOPE_REQUIRED` / `403 CROSS_SCHOOL_DENIED` (route);
  then `400 CONFIRMATION_REQUIRED`; `400 FINGERPRINT_REQUIRED`; upstream failure `503`
  (unreachable) or `409 <typed>` (contract invalid); then — after a **fresh** upstream fetch — the
  service recomputes the expected fingerprint from `(schoolId, schoolYearId, mirrorId, format,
  liveSemanticRevision, persistedSemanticRevision)` and rejects a mismatch with
  **`409 FINGERPRINT_MISMATCH` and zero writes**. Only then does it enter the `$transaction` that
  re-elects the complete same-school active/non-archived set before persisting.
- `confirmationText` is derived as `SAVE_TERM_AUTHORITY_<schoolId>_<schoolYearId>`; the captured
  value is `SAVE_TERM_AUTHORITY_1_9`.

## 3. Execution plan

1. **Preflight (read-only, no login):** §0 items 2–6. Record every literal.
2. **One authorized login** at `https://njgrm.buru-degree.ts.net` in the persistent profile (the
   single browser controller). Disclose the `LOCAL_LOGIN_SUCCESS` `audit_logs` row id and the actor
   `last_login_at` delta. No extra login, no session reuse beyond this cycle.
3. **Fresh zero-write preview** — `POST …/term-authority/preview {"schoolId":1}`, exactly once.
   Record the literal response. Then:
   - `state` must be **`READY`** (cache absent) or **`ALREADY_CURRENT`** (cache already matches).
     - If `ALREADY_CURRENT`: **stop, write no apply, report the cycle as a no-op with the
       post-state as proof.** Do not force a write.
     - Any other state → stop and report.
   - `confirmationText` must equal **`SAVE_TERM_AUTHORITY_1_9`**.
   - `terms[]` must be the ordered `T1/T2/T3` with the captured dates, and `format` `TRIMESTER`.
   - `fingerprint` **must equal the captured
     `d4cd7cc4466eb3390c802934204fca2fe01b8f80782478c7a6927b3041633f81`**. If it differs, the live
     or persisted revision moved since the capture: **stop and report** with both fingerprints.
     The server would reject the old one anyway (`409 FINGERPRINT_MISMATCH`) — do not retry with
     the recorded value, and do not apply on a guess.
4. **Apply** — `POST …/term-authority/apply` with the **just-captured** `fingerprint` and the exact
   `confirmationText`. Exactly once. Record the literal status and body.
5. **Verify (post-state):**
   - Re-run the **preview**: expect `state: ALREADY_CURRENT`,
     `persistedSemanticRevision == liveSemanticRevision == a51b62a26e27416c3d1295697f144d7ae5de5c56bb6a5e0d25bcb0c24dd8abb9`,
     and `cachedAt` non-null.
   - DB delta must be **exactly**: the one login audit row + actor `last_login_at`, one
     `TERM_CACHE_SYNC_APPLIED` audit row (count 0 → 1), and the mirror cache value.
     `FacultySubject` / `GenerationRun` / `PublishedScheduleRevision` unchanged.
6. **Cleanup:** close tabs, release the browser context, log out and confirm `GET /api/v1/auth/me`
   → 401 `NO_TOKEN`. Do not leave a remembered token.

## 4. Acceptance — 6 mandatory rows

**A1 preflight identity and baseline.** §0 items 2–6 with literals: release `80acdc25`, source
contract diff empty, elected target `1 / 9 / 223 / 2030-2031 / TRIMESTER`, `persistedSemanticRevision`
null, `TERM_CACHE_SYNC_APPLIED` 0, audit max id, the other count baselines.

**A2 fresh preview.** HTTP 200, `zeroWrite:true`, `state` `READY` **or** `ALREADY_CURRENT` as §3,
`format TRIMESTER`, ordered `T1/T2/T3` with the captured dates, `confirmationText`
`SAVE_TERM_AUTHORITY_1_9`, and fingerprint **equal to `d4cd7cc4…`**. A differing fingerprint is a
`BLOCKED` row with both values reported, not a failure of the packet.

**A3 apply.** `state` was `READY` → HTTP 200 from `…/apply`, called exactly once, body recorded.
`state` was `ALREADY_CURRENT` → reported `NOT_REQUIRED` with the A2 proof (this is a **pass**, not
an unperformed row).

**A4 post-state truth.** Re-preview `state=ALREADY_CURRENT` with
`persistedSemanticRevision == liveSemanticRevision == a51b62a2…` and `cachedAt` non-null.

**A5 write isolation.** DB delta exactly as §3 step 5: one login row, one `TERM_CACHE_SYNC_APPLIED`
row, the mirror cache value — and nothing else. Any other delta is an **incident stop**.

**A6 downstream unblock.** The canonical readiness diagnostic no longer fails with
`TERM_STRUCTURE_UNAVAILABLE` for the elected school/year, and the TT/TL acceptance rows previously
blocked on the missing persisted term snapshot can be re-run. Record the literal response; if the
diagnostic still fails, report the typed blocker rather than calling the row passed.

`ACCEPT_READY` requires **6/6 passed, blocked 0, unperformed 0**. A row that cannot be performed is
`BLOCKED`/`UNPERFORMED` with its reason, never "not applicable".

## 5. Rollback

The pre-state is **no cache** (`persistedSemanticRevision: null`), so the functional revert is to
restore the mirror's persisted cache column to its recorded pre-apply value and leave both audit
rows in place as the record. That revert is itself a HIGH data write and needs its own approval; it
is only needed if A4/A5 fail. Record the exact pre value in A1 so the revert is mechanical. Nothing
in this cycle touches source, the runtime, the schema, or any other year's data.

## 6. Gates and return

- **One batched independent pre-action review** covering the contract and this packet (source range
  + satisfiability lint in a single dispatch), then this cycle executes; **one fresh independent
  post-action QA** over A3–A6 reproduced from the database and the live API.
- Return **one handoff and one evidence artifact**
  (`docs/reviews/term-cache-catchup-20260921/apply-evidence.md`): the pin, the literal preflight,
  the preview and apply request/response bodies, the fingerprint comparison, the post-state, the
  full DB delta with the audit row ids, the login disclosure, the rollback basis, and risks marked
  `BLOCKING`/`NON_BLOCKING`. No credentials, tokens, or unrelated database rows.
