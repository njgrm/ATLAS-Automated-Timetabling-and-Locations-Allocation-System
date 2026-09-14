# TERM-CACHE-CATCHUP-APPLY — reviewed HIGH-action packet (2026-09-14)

**Status: `PREPARED — HIGH APPROVAL NOT GRANTED.`**

**Nothing in this packet has been executed.** No login, no apply request, no
database write, no deployment, and no runtime change occurred during
preparation.

- Cycle: `term-cache-apply-packet-c01` (operator `CYCLE ON`, 2026-09-14
  Asia/Manila), prepared end to end by the primary planner.
- Worktree / branch: `E:/ATLAS-worktrees/term-cache-apply-packet-c01` /
  `work/term-cache-apply-packet-c01`.
- Base `origin/main`: `84dd537bb2a2c045b8518c35b3a5372142e0080c`.
- Directive LF-SHA-256 at preparation:
  `5F9206708A4763376DDA1943C1EAD28F49427ED1B1F0532AD25661F74ED3EBB5`
  (unchanged from the cycle instruction; `origin/main:AGENTS.md` is LF-only).
- Pre-action audit: a fresh independent Wave Completion Auditor reviewed this
  packet before any approval request (see §11). Approval may be requested only
  after that audit returns `AUDIT_CLEAR` with a 14/14 tally.
- Capture authority (already integrated on `origin/main`):
  `docs/reviews/term-cache-catchup-preview-20260914/live-capture.md`,
  `.../qa-verdict.md`, `docs/prompts/term-cache-catchup-preview-2026-09-13.md`.

## 1. Objective and one-shot boundary

Apply the already captured ordered term authority for school 1 / EnrollPro
school year 9 (`2030-2031`, TRIMESTER, T1/T2/T3) to the single active ATLAS
school-year mirror so that exactly this declared change set occurs:

- mirror `223.termContractCache` receives the captured ordered-term contract;
- mirror `223.termContractCachedAt` becomes non-null;
- mirror `223.updatedAt` advances to a new engine-managed timestamp, because
  `EnrollProSchoolYearMirror.updatedAt` is declared `@updatedAt` in
  `prisma/schema.prisma` and Prisma sets it on the apply's non-empty
  `updateMany`;
- exactly one school/year-scoped `TERM_CACHE_SYNC_APPLIED` audit row is created
  for actor = the authorized login actor.

The separately authorized login delta (exactly one `LOCAL_LOGIN_SUCCESS` audit
row plus that actor's `last_login_at`) is the only other write in the whole
action. Nothing else is in scope. This is one bounded live-data write, executed
by one apply request over the deployed runtime. It is not a rollover, not a
Teaching Load action, not a timetable edit/sync, and not generation or
publication.

## 2. Exact identities (re-verified read-only on 2026-09-14, ~13:32–13:49 UTC)

### Runtime (registered supervisor boundary)

| Item | Verified value |
|---|---|
| Scheduled task | `ATLAS-Runtime-Supervisor`, principal `SYSTEM`, trigger At system startup, status Running, last run 2026-09-14 12:57:09 +08 |
| Task action | `C:\Program Files\nodejs\node.exe "D:\ATLAS-runtime-supervised-3d916b26-20260912\ops\runtime\cli.mjs" start` |
| Working directory | `D:\ATLAS-runtime-supervised-3d916b26-20260912` |
| Supervisor process | PID `3132` (`node ...\ops\runtime\cli.mjs start`), created 2026-09-14 12:57:09 +08 |
| Release checkout | HEAD `3d916b261d6a2db71b153558ac8c2d151e2fccd0`; tracked tree clean (only untracked `ops/runtime/logs/`) |
| Supervisor state | `state=running`, `releaseSha=3d916b26…`, `ownedPids` server `19448` / client `10880` |
| Listeners | 5001 → PID `19448` (`...\atlas-server\dist\server.js`), 5174 → PID `10880` (`...\ops\runtime\host.mjs`), created 2026-09-14 12:57:27 +08, one owner per port |
| Automation invariant | `ROLLOVER_AUTO_SYNC_ENABLED=false` (supervisor status + runtime contract) |
| Liveness / readiness | local `http://127.0.0.1:5001/api/v1/health` 200; `/api/v1/health/ready` 200 (`database: ok`); `https://njgrm.buru-degree.ts.net/api/v1/health` 200; Tailnet root 200 |

Telemetry note (non-blocking, observed): the `cli.mjs status` snapshot reports
`live:false` and a stale `startedAt`/`uptimeMs` even while direct probes return
200. Direct listener ownership and health probes above are authoritative.

### Database

| Item | Verified value |
|---|---|
| Target | `atlas_recovery_clean_rebuild_20260905` on `localhost:5432` (PostgreSQL) |
| Schools | 2 rows: id `1` `HINIGARAN NATIONAL HIGH SCHOOL`; id `261` (test fixture) |
| Active mirror set (school 1) | exactly **one** active, non-archived mirror: id `223` |
| Mirror 223 | school 1, EnrollPro year `9`, label `2030-2031`, `is_active=true`, `is_archived=false`, `term_contract_cache = NULL`, `term_contract_cached_at = NULL`, `updated_at = 2026-09-10T11:18:14.634Z` (bound; see §3), `created_at = 2026-09-10T11:18:14.634Z` |
| Mirror 1 | school 1, year `8`, `2029-2030`, archived (read-only history) |
| `TERM_CACHE_SYNC_APPLIED` audit count | `0` (no row has ever existed) |
| Audit baseline | max `audit_logs.id` = `793`; total rows `242`; zero rows with id > 793 |
| Actor baseline | actor `46`: role `officer`, school 1, active, `last_login_at = 2026-09-14T09:27:55.967Z`, `failed_login_count = 0`, `locked_until = NULL` |
| Signatures | `faculty_subjects` 183; `generation_runs` 1; `published_schedule_revisions` 0; `teaching_load_cycles` 2; `_prisma_migrations` applied 2 (latest finished `2026-09-10T18:01:29Z`) |

### Upstream (EnrollPro) and origin handling

- The deployed server reads its integration origin from the durable env key
  `ENROLLPRO_API` (`D:\ATLAS-runtime-config\atlas-server.env`, outside every
  Git worktree; 13 keys; loaded verbatim into the server child process).
- Current configured value at preparation: host `100.120.169.123:5002`, path
  `/api` (raw Tailnet EnrollPro integration origin, HTTP). This is the origin
  the live server actually calls today.
- The HTTPS companion origin `https://dev-jegs.buru-degree.ts.net/api` was
  independently probed this session and serves the **identical** school-year
  contract and semantic revision.
- A separately prepared, **NOT GRANTED** HIGH action
  (`docs/prompts/enrollpro-proxy-recovery-live-2026-09-14.md`) would change
  `ENROLLPRO_API` to the HTTPS origin and restart the supervisor. This packet
  is origin-agnostic but binding: the preflight in §4 must probe through
  whichever `ENROLLPRO_API` value the deployed server currently reads, and the
  fingerprint recomputation must equal the captured fingerprint exactly. A
  changed or conflicting contract stops the apply and requires a fresh
  zero-write preview.

## 3. Binding capture values

- Confirmation text: `SAVE_TERM_AUTHORITY_1_9`
- Fingerprint: `d4cd7cc4466eb3390c802934204fca2fe01b8f80782478c7a6927b3041633f81`
- Fingerprint version and canonical field order (`RR-TERM-CACHE-C01.1`,
  producer `termCacheFingerprint`, `enrollpro-term-contract.service.ts:854-871`):
  `sha256(JSON.stringify({schemaVersion:"RR-TERM-CACHE-C01.1", schoolId:1, schoolYearId:9, mirrorId:223, format:"TRIMESTER", liveSemanticRevision:"a51b62a2…", persistedSemanticRevision:null}))`
- Live semantic revision: `a51b62a26e27416c3d1295697f144d7ae5de5c56bb6a5e0d25bcb0c24dd8abb9`
  (independent recomputation this session from the live contract, production
  normalization path + independent canonicalization; both matched)
- Persisted semantic revision / cachedAt before apply: `NULL` / `NULL`
- Mirror 223 pre-apply `updated_at` (bound exact value; engine-managed Prisma
  `@updatedAt` and expected to advance on the apply): `2026-09-10T11:18:14.634Z`
- Ordered terms (exact, order-sensitive):

| identity | displayLabel | order | startDate | endDate |
|---|---|---|---|---|
| T1 | TERM 1 | 1 | 2030-06-08 | 2030-09-15 |
| T2 | TERM 2 | 2 | 2030-09-16 | 2030-12-18 |
| T3 | TERM 3 | 3 | 2030-12-19 | 2031-04-08 |

- Format: `TRIMESTER`; EnrollPro year id `9`, label `2030-2031`;
  `active-term` resolves `409 ACTIVE_TERM_UNRESOLVED` (valid; the ordered
  structure is verified independently of active-term resolution).

## 4. Mandatory read-only preflight (ordered; before any login or write)

All steps below are read-only. Run them in order. If any step fails or differs,
stop, record the exact disagreement, and return to the planner **without a
login and without an apply request**.

1. **Runtime identity.** Query `schtasks /query /tn ATLAS-Runtime-Supervisor
   /fo LIST /v`; resolve the action and start-in directory from the task, not
   from memory. Run `node ops/runtime/cli.mjs status` from that directory.
   Confirm `state=running`, `releaseSha`, `ROLLOVER_AUTO_SYNC_ENABLED=false`,
   and owned PIDs; confirm listeners on 5001/5174 with exactly one owner per
   port and process command lines pointing into the same release directory.
2. **Health.** Confirm `GET /api/v1/health` 200, `GET /api/v1/health/ready` 200
   (dependency readiness, not just liveness), and Tailnet
   `https://njgrm.buru-degree.ts.net/api/v1/health` 200.
3. **Deployment equivalence for the apply path.** Confirm the live checkout
   HEAD is contained in `origin/main` and that
   `git diff --stat 3d916b26..<live HEAD> --` the seven apply-path files
   (`atlas-server/src/routes/runtime.router.ts`,
   `atlas-server/src/services/enrollpro-term-contract.service.ts`,
   `atlas-server/src/services/rollover-automation.service.ts`,
   `atlas-server/src/middleware/authenticate.ts`,
   `atlas-server/src/middleware/upstream-auth.ts`,
   `atlas-server/src/lib/data-context.ts`,
   `atlas-server/src/lib/prisma.ts`) is empty. If it is not empty, stop for
   replanning: the apply contract changed.
4. **Database target and signatures.** Connect read-only through the durable
   env (`DATABASE_URL`), printing only host/database/sanitized values.
   Confirm `current_database() = atlas_recovery_clean_rebuild_20260905` and
   re-capture the §2 database table, including mirror 223 `updated_at`. If
   mirror 223 is no longer `NULL`/`NULL`, if its `updated_at` differs from the
   §3 bound value, or if a `TERM_CACHE_SYNC_APPLIED` row now exists, stop for
   replanning (possible unapproved apply, competing writer, or row touch).
5. **Active-year election.** Confirm exactly one active, non-archived school-1
   mirror and that it is id `223` / EnrollPro year `9` / `2030-2031`.
6. **Upstream contract.** Through the currently configured `ENROLLPRO_API`
   origin (server-side read; service credential used read-only and never
   printed or committed), fetch `GET {ENROLLPRO_API}/integration/v1/school-year`
   and `GET {ENROLLPRO_API}/integration/v1/active-term`. Confirm year id `9`,
   label `2030-2031`, format `TRIMESTER`, the exact T1/T2/T3 matrix in §3, and
   active-term `409 ACTIVE_TERM_UNRESOLVED`.
7. **Fingerprint recomputation (binding gate).** From that fresh read,
   recompute `liveSemanticRevision` (ordered structure only) and the §3
   `RR-TERM-CACHE-C01.1` fingerprint with `persistedSemanticRevision = null`.
   Both must equal the §3 values exactly. Any difference stops the apply and
   requires a **new authorized zero-write preview capture**; never silently
   refresh the fingerprint.
8. **Deployed write-path inspection.** Confirm the deployed release still
   contains the reviewed apply controls: route registration for
   `POST /api/v1/runtime/term-authority/apply`; JWT-only `authenticate`;
   privileged actor-school gate; `CONFIRMATION_REQUIRED` / `FINGERPRINT_REQUIRED`
   / `FINGERPRINT_MISMATCH` / `ACTIVE_YEAR_AMBIGUOUS` / `ACTIVE_YEAR_CHANGED` /
   `TERM_CACHE_CONCURRENT_UPDATE` / `TRANSACTION_CONFLICT` handling; the
   `Serializable` transaction; the guarded compare-and-set on
   `termContractCachedAt`; and the `TERM_CACHE_SYNC_APPLIED` audit insert.
9. **Login-side preconditions (no login yet).** Confirm the persistent browser
   profile holds no reusable session and no remembered token (nothing to clear
   or inherit). Confirm the QA credential source resolves
   (`%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md`); if absent,
   return `EXTERNALLY_BLOCKED(QA_CREDENTIALS_UNAVAILABLE)`.

Only after all nine steps pass may the single authorized login be performed.

## 5. Roles, session budget, and custody

- **Live executor** (fresh executor session, no browser, no login): owns §4
  preflight, before/after database signature captures, post-apply database
  verification, the §8 immutability assertions, and — only if the approved
  apply commits but mandatory post-write verification fails — the §9 rollback.
- **QA/session custodian** (fresh `atlas-qa-delegate`), sole controller of the
  persistent Playwright profile for this action: owns the **one** authorized
  login, the single apply request in §6, and the authenticated post-apply rows
  (TT-TL rows 4–5; §8). Exactly one controller may issue browser actions at a
  time; no other role touches the profile.
- **Login budget: exactly one (1) fresh local login**, only if the §12 approval
  sentence is granted. Expected delta: one `LOCAL_LOGIN_SUCCESS` audit row
  (actor = the authorized operator, expected actor `46`, school 1) plus that
  actor's `last_login_at`. Nothing else attributable to authentication.
  No second login; no "Remember me"; no token export or handoff; no session
  reuse across roles beyond the custodian's own retained tab.
- **Post-action audit**: after execution, a fresh independent Wave Completion
  Auditor reviews the executed state before the cycle may close (see §8 end).
- The custodian performs the apply as the authenticated operator proxy; the
  independent verification of the result is owned by the executor (database
  read-back, audit row, immutability), the §8 authenticated rows, and the
  post-action auditor. The custodian never self-declares acceptance.

## 6. The single apply request

After §4 passes and the login is authorized, the custodian asserts browser
origin `https://njgrm.buru-degree.ts.net`, logs in once, and asserts
`GET /api/v1/auth/me` resolves to the authorized privileged actor with school 1
(expected actor `46`, role `officer`). Then, exactly once:

```http
POST /api/v1/runtime/term-authority/apply
Authorization: Bearer <custodian session JWT, read in-page only; never printed, logged, or copied>
Content-Type: application/json

{"schoolId":1,"confirmationText":"SAVE_TERM_AUTHORITY_1_9","fingerprint":"d4cd7cc4466eb3390c802934204fca2fe01b8f80782478c7a6927b3041633f81"}
```

Exactly one request. Do not retry, re-send, or replay. If the request fails at
the transport level (timeout/aborted), do **not** issue a second request;
determine the outcome from `§8` steps 1–3 (database read-back and audit row).
If the server returns a typed `4xx/5xx`, record it verbatim and stop for
replanning. A second apply or replay request requires a new explicit approval.

## 7. Expected successful write

Response (HTTP 200) — `TermCacheApplyResult`:
`{schoolId:1, schoolYearId:9, yearLabel:"2030-2031", mirrorId:223,
applied:true, replayed:false, written:true,
semanticRevision:"a51b62a2…", previousSemanticRevision:null,
activeTermAvailability:"UNRESOLVED", auditId:<new id>, cachedAt:<ISO>,
terms:[T1,T2,T3 exact matrix]}`.

Database (verify in §8):
- mirror `223.term_contract_cache` = the captured contract (school 1, school
  `{id:9, yearLabel:"2030-2031"}`, format `TRIMESTER`, exact ordered terms,
  `semanticRevision=a51b62a2…`, `activeTermState.availability=UNRESOLVED`);
- mirror `223.term_contract_cached_at` = a new non-null timestamp (record the
  exact value; it is the §9 rollback guard slot `${POST_APPLY_CACHED_AT}` and
  must equal the response `cachedAt`);
- mirror `223.updated_at` = a new engine-managed timestamp that advanced from
  the §3 bound pre-apply value (record the exact value; equality with
  `term_contract_cached_at` is neither required nor excluded);
- exactly one new `TERM_CACHE_SYNC_APPLIED` audit row: `schoolId=1`,
  `schoolYearId=9`, `actorId` = the authorized login actor,
  `targetIds=[9]`, metadata
  `{source:"enrollpro-term-cache-catchup", yearLabel:"2030-2031",
  semanticRevision:"a51b62a2…", previousSemanticRevision:null, termCount:3,
  format:"TRIMESTER", activeTermAvailability:"UNRESOLVED", completedAt:<ISO>}`;
- no changes beyond this declared four-part set plus the login delta (§8.3).

## 8. Mandatory post-apply verification

1. **Read-back and semantic parity.** Re-read mirror `223` and compare the
   persisted contract field-for-field with §3/§7 (school, year, format,
   identity/order/label/dates of all three terms, `semanticRevision`).
   A JSONB round-trip comparison may trust the stored `semanticRevision` as the
   opaque revision token only after structural validation of the stored shape.
2. **Exact audit row.** Confirm exactly one new `TERM_CACHE_SYNC_APPLIED` row
   with id above the §2 baseline max, actor = login actor, school 1, year 9,
   `targetIds=[9]`, and the §7 metadata. Report the raw id and `createdAt`.
3. **Immutability and exact-delta proof.** Re-read mirror `223` and confirm it
   changed only in `term_contract_cache`, `term_contract_cached_at`, and the
   engine-managed `updated_at` (advanced from the §3 bound value); record the
   exact post-apply values of `term_contract_cached_at` (the §9 rollback guard
   slot `${POST_APPLY_CACHED_AT}`) and `updated_at`. Confirm every other
   mirror-223 column is unchanged (school, year, label, active/archived flags,
   archive metadata) and mirror 1 is untouched. Confirm the global set is
   unchanged: `faculty_subjects` 183, `generation_runs` 1,
   `published_schedule_revisions` 0, `teaching_load_cycles` 2,
   `_prisma_migrations` 2. The only new audit rows attributable to this action
   are the one login row (§5) and the one apply row. Any other change must be
   attributed and disclosed, or the action stops as an incident.
4. **TT-TL runtime-acceptance rows 4–5 re-run** with the custodian's retained
   session (these were the two mandatory rows blocked on the missing term
   snapshot; see the `TT-TL-RUNTIME-ACCEPTANCE` register row):
   - Row 4: `GET /api/v1/generation/1/9/readiness/diagnostic` (privileged JWT,
     actor school 1). Pass condition: HTTP 200 structured diagnostic in which
     the missing-persisted-term-snapshot condition
     (`TERM_STRUCTURE_UNAVAILABLE` / `DERIVED_DEMAND_BLOCKED`, previously
     caused by the absent cache) no longer occurs, and the persisted TRIMESTER
     T1/T2/T3 authority resolves for the diagnostic. Every remaining typed
     blocker must be reported honestly; a still-blocked row keeps TT-TL
     acceptance `ACCEPTANCE_INCOMPLETE` with the new truthful blocker list.
   - Row 5: `GET /api/v1/dashboard/readiness-summary` (privileged read; JWT or
     scoped system token). Pass condition: the missing-snapshot blocker
     (`TERM_STRUCTURE_UNAVAILABLE`, "no persisted verified EnrollPro term
     snapshot", `derived-demand.service.ts:1042-1046`) no longer appears for
     the active year, and `derivedDemand.available` is `true` (the read
     completed; a typed remaining blocker is still "available"). When
     `derivedDemand.ready` is `true`, `derivedDemand.termStructure` carries the
     persisted TRIMESTER T1/T2/T3 and `derivedDemand.revision` is a non-null
     canonical derived-demand revision (an UPPERCASE sha256 over the
     derived-demand payload; it is NOT the contract `semanticRevision` — that
     `a51b62a2…` binding is proven separately by §8.1 on mirror 223). When
     `ready` is `false`, record the remaining blockers truthfully as
     still-blocked; never report a row as passing on a missing snapshot.
5. **Canonical readiness diagnostic, read-only.** Same call as row 4; record
   the complete typed blocker list. **Do not generate and do not publish.**
6. **Custodian cleanup.** Log out; assert `GET /api/v1/auth/me` without an
   Authorization header returns `401 NO_TOKEN`; close tabs; confirm no
   remembered token remains in the shared profile.
7. **Post-action audit.** A fresh independent Wave Completion Auditor (read-only)
   verifies 1–6 against this packet before the cycle may close. Until it returns
   `AUDIT_CLEAR` with `passed == total`, `blocked 0`, `unperformed 0`, the cycle
   stays open (`DEPLOYED`-style compound state where applicable), and no
   generation or publication may be prepared.

## 9. Failure handling and rollback (exact, pre-reviewed)

If the apply **committed** but any mandatory §8 verification fails, the live
executor executes **exactly one** run of the pre-reviewed rollback transaction
below, then stops for replanning.

- Raw SQL is mandatory for the restore: it returns `updated_at` to its exact
  bound pre-apply value. An ORM `update`/`updateMany` would re-bump
  `updated_at` implicitly and is **not** authorized for the rollback.
- Substitution slots (the only two permitted edits before execution):
  - `${PRE_APPLY_UPDATED_AT}` = `2026-09-10T11:18:14.634Z` (bound in §3; a
    literal, already reviewed).
  - `${POST_APPLY_CACHED_AT}` = the exact `term_contract_cached_at` value
    recorded in the §8 read-back (ISO-8601 UTC with milliseconds; must equal
    the apply response `cachedAt`; if they differ, record both and stop —
    never guess).
- The immutable `TERM_CACHE_SYNC_APPLIED` audit row is **retained**; the
  transaction never touches `audit_logs`.
- Run with `ON_ERROR_STOP` inside one transaction; any guard failure raises and
  aborts with **zero changes**.

```sql
BEGIN;

-- One guarded, single-purpose rollback of mirror 223 only.
DO $$
DECLARE affected integer;
BEGIN
  UPDATE enrollpro_school_year_mirrors
     SET term_contract_cache = NULL,
         term_contract_cached_at = NULL,
         updated_at = TIMESTAMPTZ '${PRE_APPLY_UPDATED_AT}'
   WHERE id = 223
     AND school_id = 1
     AND enrollpro_school_year_id = 9
     AND is_active = TRUE
     AND is_archived = FALSE
     AND term_contract_cache IS NOT NULL
     AND term_contract_cached_at IS NOT NULL
     AND term_contract_cache ->> 'semanticRevision' = 'a51b62a26e27416c3d1295697f144d7ae5de5c56bb6a5e0d25bcb0c24dd8abb9'
     AND term_contract_cached_at = TIMESTAMPTZ '${POST_APPLY_CACHED_AT}';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'TERM_CACHE_ROLLBACK_GUARD_FAILED affected=%', affected;
  END IF;
END $$;

-- Post-restore assertion inside the same transaction.
DO $$
DECLARE ok boolean;
BEGIN
  SELECT (term_contract_cache IS NULL
          AND term_contract_cached_at IS NULL
          AND updated_at = TIMESTAMPTZ '${PRE_APPLY_UPDATED_AT}')
    INTO ok
    FROM enrollpro_school_year_mirrors
   WHERE id = 223
     AND school_id = 1
     AND enrollpro_school_year_id = 9
     AND is_active = TRUE
     AND is_archived = FALSE;
  IF ok IS NOT TRUE THEN
    RAISE EXCEPTION 'TERM_CACHE_ROLLBACK_VERIFY_FAILED';
  END IF;
END $$;

COMMIT;
```

Rollback rules:

1. Target: **only** mirror id `223`, school 1, EnrollPro year 9, with
   `is_active = true` and `is_archived = false`; exactly one affected row is
   required or the whole transaction aborts with zero changes.
2. Guards: persisted `semanticRevision = a51b62a2…` **and** the exact
   post-apply `term_contract_cached_at` must both hold at execution time.
3. Restore: `term_contract_cache = NULL`, `term_contract_cached_at = NULL`,
   `updated_at = 2026-09-10T11:18:14.634Z` (the exact bound pre-apply value).
4. After a committed rollback, verify read-only that mirror 223 is
   `NULL`/`NULL` with the bound `updated_at`, that the audit row is retained,
   and record the rollback truthfully (timestamp, executor, before/after
   values, reason) in the execution evidence. Do not claim the operation never
   happened.
5. On any guard failure, exception, or `affected <> 1`: the transaction aborts
   with zero changes; **stop for replanning** — never retry the rollback
   without a new review.

If the apply did **not** commit (typed `4xx/5xx`, or DB read-back shows
`NULL`/`NULL` and no audit row), no rollback is needed; record the typed error
and stop for replanning.

## 10. Explicit exclusions

This approval authorizes only the §6 request, its §8 verification, and the §9
rollback when required. It does **not** authorize: a second login; a second
apply or replay request; any rollover sync/archive; any Teaching Load
carry-forward, suggestion, redistribution, or apply; any timetable
sync/edit/generation/publication; any migration or schema operation; any runtime
deployment/restart/task/env change; any Tailscale or companion-repository
mutation; any other database write; any source/test/product change; or any push
of this packet's evidence beyond the reviewed docs commit described in §11.

## 11. Evidence workflow and return contract

- Execution evidence is committed docs-only under
  `docs/reviews/term-cache-catchup-apply-20260914/` (preflight, before/after
  signatures, apply result, audit-row proof, immutability proof, rows 4–5
  results, readiness blocker list, cleanup proof, rollback record if any).
  No credentials, tokens, or connection strings may appear in any artifact.
- The executor returns one compact handoff with: preflight result, exact apply
  response (typed fields only), the new audit row id, the immutability deltas,
  rows 4–5 outcomes, the readiness blocker list, cleanup result, and any
  rollback. The custodian returns the authenticated-row evidence.
- The head planner then commissions the fresh post-action Wave Completion
  Auditor (§8.7) and only afterwards may update the register, close the TT-TL
  runtime-acceptance cycle, or prepare generation/publication.
- Rollback remains available (supervised runtime reset paths and the term-cache
  restore above) but is exercised only as authorized.

## 12. Copy-ready HIGH approval sentence (NOT GRANTED)

> I approve HIGH action TERM-CACHE-CATCHUP-APPLY-2026-09-14 against the live
> supervised ATLAS runtime (release checkout
> `D:\ATLAS-runtime-supervised-3d916b26-20260912`, HEAD
> `3d916b261d6a2db71b153558ac8c2d151e2fccd0`) and database
> `atlas_recovery_clean_rebuild_20260905` only, as follows: (1) let the live
> executor re-run the read-only preflight in §4 and stop before any login or
> write if any runtime, database, mirror, audit-baseline, `updated_at`,
> upstream-contract, or fingerprint check differs from the packet's captured
> values; (2) authorize exactly ONE fresh local browser login at
> `https://njgrm.buru-degree.ts.net` for the named QA/session custodian
> (expected delta: exactly one `LOCAL_LOGIN_SUCCESS` audit row plus that
> actor's `last_login_at`, and no other authentication side effect), whose
> authenticated actions are exactly the single
> `POST /api/v1/runtime/term-authority/apply` with
> `{"schoolId":1,"confirmationText":"SAVE_TERM_AUTHORITY_1_9","fingerprint":"d4cd7cc4466eb3390c802934204fca2fe01b8f80782478c7a6927b3041633f81"}`
> — the authorized apply changing exactly mirror `223.term_contract_cache`,
> mirror `223.term_contract_cached_at`, mirror `223.updated_at` (the
> engine-managed Prisma `@updatedAt` timestamp advancing on the non-empty
> `updateMany`), and exactly one scoped `TERM_CACHE_SYNC_APPLIED` audit row —
> plus the authenticated read-only acceptance GETs of §8.4 (TT-TL rows 4–5);
> and authorize the live executor to perform, only if that apply commits but
> the mandatory post-write verification fails, exactly one execution of the
> pre-reviewed guarded rollback transaction in §9 (raw SQL; targeting only
> mirror id `223` / school 1 / EnrollPro year 9 with `is_active = true` and
> `is_archived = false`; requiring the persisted `semanticRevision`
> `a51b62a2…` and the exact post-apply `term_contract_cached_at`; restoring
> `term_contract_cache = NULL`, `term_contract_cached_at = NULL`, and the
> exact bound pre-apply `updated_at` `2026-09-10T11:18:14.634Z`; requiring
> exactly one affected row and self-verifying inside the same transaction;
> retaining the immutable audit row; and aborting with zero changes and
> stopping on any guard failure); (3) forbid every action in
> §10 (no second login, no second apply or replay request, no
> rollover/sync/archive, no Teaching Load action, no timetable
> edit/sync/generation/publication, no migration/schema operation, no runtime
> deployment/restart/task/env change, no Tailscale or companion mutation);
> (4) require the post-apply acceptance matrix in §8 (read-back semantic
> parity, exact audit row, immutability proof that the only changed mirror-223
> fields are the declared three plus the one audit row, TT-TL
> runtime-acceptance rows 4–5 re-run, canonical readiness diagnostic read-only
> with an honest typed blocker list); and (5) return the evidence to the head
> planner, who must obtain a fresh post-action Wave Completion Auditor before
> closing TT-TL runtime acceptance or unlocking generation or publication.

## Appendix A — Zero-write failure matrix (reviewed source + committed tests)

Reviewed implementation: `atlas-server/src/routes/runtime.router.ts:415-497`,
`atlas-server/src/services/enrollpro-term-contract.service.ts:854-1212`
(unchanged between the deployed release `3d916b26` and `origin/main`
`84dd537b`; deployed `dist` inspected and matching). Mounted-route coverage:
`atlas-server/src/__tests__/term-cache-catchup-rrtc01.test.ts`.

| Failure | Typed result | Write before rejection |
|---|---|---|
| Missing/invalid JWT | `401 NO_TOKEN` / `401 INVALID_TOKEN` | none (route middleware) |
| System token on apply | `401` (apply is JWT-only; system tokens rejected) | none |
| Non-privileged role | `403 FORBIDDEN` | none |
| Missing actor id / actor school | `403 ACTOR_USER_REQUIRED` / `403 SCHOOL_SCOPE_REQUIRED` | none |
| Cross-school actor or wrong `schoolId` | `403 CROSS_SCHOOL_DENIED` / `400 INVALID_PARAM` | none (no default school) |
| Wrong confirmation text | `400 CONFIRMATION_REQUIRED` | none (before upstream) |
| Wrong/stale fingerprint | `409 FINGERPRINT_MISMATCH` (pre-transaction and in-transaction) | none |
| Changed EnrollPro contract | new revision ⇒ fingerprint mismatch `409` | none |
| Changed cache state | in-transaction fingerprint mismatch / `409 TERM_CACHE_CONCURRENT_UPDATE` / CAS `updateMany.count = 0` | none (guarded compare-and-set) |
| Zero or multiple active mirrors | `409 ACTIVE_YEAR_UNAVAILABLE` / `409 ACTIVE_YEAR_AMBIGUOUS` (pre and in-transaction) | none |
| Active mirror changed between read and write | `409 ACTIVE_YEAR_CHANGED` | none |
| Upstream unreachable / invalid | `503 ENROLLPRO_UNREACHABLE` / typed `409` | none |
| Serializable conflict (P2034) | `409 TRANSACTION_CONFLICT` ("no partial writes occurred") | none |
| Already-current replay with a fresh preview fingerprint | `200 {applied:false, replayed:true, written:false, auditId:null}` | no write, no second audit row |

Concurrency note (honest limitation): the route's `withSchoolLock` is an
in-process mutex only; cross-process safety relies on the `Serializable`
transaction, the complete-set active-year re-election inside the transaction,
and the guarded compare-and-set on `termContractCachedAt`. This packet performs
a single request with no competing writer expected; any `409` is recorded and
stops the action without a retry.

Successful-write note (implicit ORM-managed mutation): the applied `updateMany`
is the only write to mirror 223, and Prisma's `@updatedAt` semantics set
`updated_at` on that non-empty update — which is why the declared write set
(§1/§7) and the §9 rollback include `updated_at` explicitly. An already-current
replay performs no write and changes neither the cache, the cached-at
timestamp, nor `updated_at`.
