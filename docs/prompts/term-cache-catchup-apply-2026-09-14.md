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
school-year mirror so that:

- mirror `223.termContractCache` receives the captured ordered-term contract;
- mirror `223.termContractCachedAt` becomes non-null;
- exactly one school/year-scoped `TERM_CACHE_SYNC_APPLIED` audit row is created
  for actor = the authorized login actor.

Nothing else is in scope. This is one bounded live-data write, executed by one
apply request over the deployed runtime. It is not a rollover, not a Teaching
Load action, not a timetable edit/sync, and not generation or publication.

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
| Mirror 223 | school 1, EnrollPro year `9`, label `2030-2031`, `is_active=true`, `is_archived=false`, `term_contract_cache = NULL`, `term_contract_cached_at = NULL` |
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
   re-capture the §2 database table. If mirror 223 is no longer
   `NULL`/`NULL`, or a `TERM_CACHE_SYNC_APPLIED` row now exists, stop for
   replanning (possible unapproved apply or competing writer).
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
- mirror `223.term_contract_cached_at` = a new non-null timestamp;
- exactly one new `TERM_CACHE_SYNC_APPLIED` audit row: `schoolId=1`,
  `schoolYearId=9`, `actorId` = the authorized login actor,
  `targetIds=[9]`, metadata
  `{source:"enrollpro-term-cache-catchup", yearLabel:"2030-2031",
  semanticRevision:"a51b62a2…", previousSemanticRevision:null, termCount:3,
  format:"TRIMESTER", activeTermAvailability:"UNRESOLVED", completedAt:<ISO>}`;
- no other table or row changes (see §8.3).

## 8. Mandatory post-apply verification

1. **Read-back and semantic parity.** Re-read mirror `223` and compare the
   persisted contract field-for-field with §3/§7 (school, year, format,
   identity/order/label/dates of all three terms, `semanticRevision`).
   A JSONB round-trip comparison may trust the stored `semanticRevision` as the
   opaque revision token only after structural validation of the stored shape.
2. **Exact audit row.** Confirm exactly one new `TERM_CACHE_SYNC_APPLIED` row
   with id above the §2 baseline max, actor = login actor, school 1, year 9,
   `targetIds=[9]`, and the §7 metadata. Report the raw id and `createdAt`.
3. **Immutability proof.** Confirm unchanged: `faculty_subjects` 183,
   `generation_runs` 1, `published_schedule_revisions` 0,
   `teaching_load_cycles` 2, `_prisma_migrations` 2; mirror 1 untouched;
   no rollover/sync/Teaching Load/generation/publication/migration audit rows;
   the only new audit rows attributable to this action are the one login row
   (§5) and the one apply row. Any other new row must be attributed and
   disclosed, or the action stops as an incident.
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
     the active year; when derived demand is otherwise resolvable,
     `derivedDemand.revision` equals `a51b62a2…` and
     `derivedDemand.termStructure` carries the persisted TRIMESTER T1/T2/T3.
     If other derived-demand blockers remain, the response is
     `available:true, ready:false` with `termStructure`/`revision` possibly
     null — record those blockers truthfully as still-blocked; never report a
     row as passing on a missing snapshot.
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

## 9. Failure handling and rollback

If the apply **committed** but any mandatory §8 verification fails:

1. The live executor restores mirror `223` in one transaction/statement:
   `term_contract_cache = NULL`, `term_contract_cached_at = NULL`, guarded by a
   precondition that the current persisted `semanticRevision` equals
   `a51b62a2…` (fail closed to the planner otherwise). Implement it as a
   reviewed, single-purpose script or reviewed SQL — never an ad-hoc wildcard
   update.
2. The immutable `TERM_CACHE_SYNC_APPLIED` audit row is **retained**; it is
   never deleted, edited, or hidden.
3. The rollback is recorded separately and truthfully (timestamp, actor,
   before/after values, reason) in the execution evidence. Do not claim the
   operation never happened.
4. Stop for replanning. No retry, no second apply, no compensating extra writes
   beyond the exact mirror-223 restore above.

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
> write if any runtime, database, mirror, audit-baseline, upstream-contract, or
> fingerprint check differs from the packet's captured values; (2) authorize
> exactly ONE fresh local browser login at `https://njgrm.buru-degree.ts.net`
> for the named QA/session custodian (expected delta: exactly one
> `LOCAL_LOGIN_SUCCESS` audit row plus that actor's `last_login_at`, and no
> other authentication side effect), whose authenticated actions are exactly
> the single `POST /api/v1/runtime/term-authority/apply` with
> `{"schoolId":1,"confirmationText":"SAVE_TERM_AUTHORITY_1_9","fingerprint":"d4cd7cc4466eb3390c802934204fca2fe01b8f80782478c7a6927b3041633f81"}`
> — expected successful write being mirror `223` receiving the captured
> ordered-term contract, `termContractCachedAt` becoming non-null, and exactly
> one scoped `TERM_CACHE_SYNC_APPLIED` audit row — plus the authenticated
> read-only acceptance GETs of §8.4 (TT-TL rows 4–5), and, only if that apply
> commits but the mandatory post-write verification fails, the single §9
> rollback restoring mirror 223 `termContractCache`/`termContractCachedAt` to
> NULL/NULL while retaining the immutable audit row; (3) forbid every action in
> §10 (no second login, no second apply or replay request, no
> rollover/sync/archive, no Teaching Load action, no timetable
> edit/sync/generation/publication, no migration/schema operation, no runtime
> deployment/restart/task/env change, no Tailscale or companion mutation);
> (4) require the post-apply acceptance matrix in §8 (read-back semantic
> parity, exact audit row, immutability proof, TT-TL runtime-acceptance rows 4–5
> re-run, canonical readiness diagnostic read-only with an honest typed
> blocker list); and (5) return the evidence to the head planner, who must
> obtain a fresh post-action Wave Completion Auditor before closing TT-TL
> runtime acceptance or unlocking generation or publication.

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
