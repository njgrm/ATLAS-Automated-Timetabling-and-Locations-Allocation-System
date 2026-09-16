# TERM-CACHE-CATCHUP-APPLY-2026-09-14 — execution evidence (HIGH action executed)

- **Cycle:** WF-SEED-TERM-CACHE-TL-C06-20260916 / stream TERM-CACHE-CATCHUP-APPLY-REFRESH-C01
- **Approval:** the operator returned the exact HIGH approval sentence verbatim (2026-09-16).
- **Outcome:** **APPLIED — SUCCESS.** Zero unauthorized writes. No rollback required (the apply's §8 verification passed).
- **Custodian/session:** the browser portion ran in the primary planner context; **no harness session identifier was exposed to the custodian** (disclosed, not invented).
- **Post-action Wave Completion Auditor:** required and commissioned by the planner.

## 1. §4.0 atomic execution-window pre-state capture (all apply bindings MATCH)

| Item | Captured value | Verdict |
|---|---|---|
| Registered task | `\ATLAS-Runtime-Supervisor` EXISTS, `Status: Running`, `SYSTEM`, `At system start up`, `Enabled`; action `C:\Program Files\nodejs\node.exe "D:\ATLAS-runtime-supervised-54dce67b-20260914\ops\runtime\cli.mjs" start`; start dir `D:\ATLAS-runtime-supervised-54dce67b-20260914` | MATCH |
| Known-absent control | `schtasks /query /tn "ATLAS-NoSuchTask-XYZ"` exit **1**, `ERROR: The system cannot find the file specified.` | MATCH |
| Supervisor state | `state=running`, `releaseSha=54dce67b8392cbce09aa810813c37f9c87a67159`, `sourceDir=D:\ATLAS-runtime-supervised-54dce67b-20260914`, `ownedPids` 13244/13260, `previous` non-null (same release) | MATCH |
| Listeners | 5001 → 13244, 5174 → 13260, exactly one owner each | MATCH |
| Health / readiness | local health 200, local readiness 200 (`database: ok`), Tailnet health 200 | MATCH |
| Rollover automation | `ROLLOVER_AUTO_SYNC_ENABLED=false` | MATCH |
| EnrollPro | direct `https://dev-jegs.buru-degree.ts.net/api/settings/public` 200; ATLAS proxy `/enrollpro-api/settings/public` 404 (documented execution-window state) | MATCH |
| Mirror 223 | school 1 / year 9 / `2030-2031`, `is_active=true`, `is_archived=false`, `term_contract_cache=NULL`, `term_contract_cached_at=NULL`, `updated_at=2026-09-10T11:18:14.634Z`; exactly one active non-archived mirror for school 1 | MATCH |
| Live contract (recomputed in-process via the deployed producer) | `format=TRIMESTER`; `liveSemanticRevision=a51b62a26e27416c3d1295697f144d7ae5de5c56bb6a5e0d25bcb0c24dd8abb9`; T1 `2030-06-08..2030-09-15`, T2 `2030-09-16..2030-12-18`, T3 `2030-12-19..2031-04-08` | MATCH |
| Fingerprint (recomputed) | `d4cd7cc4466eb3390c802934204fca2fe01b8f80782478c7a6927b3041633f81` — equals the reviewed fingerprint | MATCH |
| Confirmation text | `SAVE_TERM_AUTHORITY_1_9` | MATCH |
| `TERM_CACHE_SYNC_APPLIED` | 0 | MATCH |
| Audit pre-state | high-water 795, total 244 | **DIVERGENT (benign, attributed)** |

**Benign divergence, read and attributed:** rows 794 (`2026-09-15T13:48:05.862Z`) and 795
(`2026-09-16T01:40:01.097Z`) are unrelated prior-session `LOCAL_LOGIN_SUCCESS` rows (actor 46,
Chrome 153 / Chrome 152), not caused by this action. The audit high-water is a measurement
baseline that §4.0/§4.4 require to be re-measured in the execution window, not an apply input;
no apply binding differed. The delta proof is bound to the re-measured 795 baseline and holds exactly.

## 2. The single authorized login

- One login only: `POST /api/v1/auth/login` → **200** (one occurrence).
- `Remember me` verified unchecked; identity confirmed via `GET /api/v1/auth/me` with the in-page bearer token → 200, `actorId 46`, `role "officer"`, `schoolId 1`.
- Origin invariant asserted `window.location.origin === "https://njgrm.buru-degree.ts.net"` pre-login, post-login and post-logout; no localhost page origin was used.
- Credential handling: read from the local credential source at execution time; never printed, echoed, quoted, logged, screenshotted, or persisted; clipboard cleared immediately after form fill.

## 3. The single authorized apply

`POST https://njgrm.buru-degree.ts.net/api/v1/runtime/term-authority/apply`

Body (exact): `{"schoolId":1,"confirmationText":"SAVE_TERM_AUTHORITY_1_9","fingerprint":"d4cd7cc4466eb3390c802934204fca2fe01b8f80782478c7a6927b3041633f81"}`

**HTTP 200** — exactly one POST to this path, no retry, no replay.

```json
{"schoolId":1,"schoolYearId":9,"yearLabel":"2030-2031","mirrorId":223,"applied":true,"replayed":false,
 "written":true,"semanticRevision":"a51b62a26e27416c3d1295697f144d7ae5de5c56bb6a5e0d25bcb0c24dd8abb9",
 "previousSemanticRevision":null,"activeTermAvailability":"UNRESOLVED","auditId":797,
 "cachedAt":"2026-09-16T03:59:21.236Z",
 "terms":[{"identity":"T1","displayLabel":"TERM 1","order":1,"startDate":"2030-06-08","endDate":"2030-09-15"},
          {"identity":"T2","displayLabel":"TERM 2","order":2,"startDate":"2030-09-16","endDate":"2030-12-18"},
          {"identity":"T3","displayLabel":"TERM 3","order":3,"startDate":"2030-12-19","endDate":"2031-04-08"}]}
```

## 4. Independent database verification (planner-performed, §8.1–8.3) — PASS

**Immutability — mirror 223 changed exactly the three declared fields:**

| Field | Before | After |
|---|---|---|
| `term_contract_cache` | `NULL` | JSONB: `semanticRevision=a51b62a2…`, `format=TRIMESTER`, 3 terms |
| `term_contract_cached_at` | `NULL` | `2026-09-16T03:59:21.236Z` (equals the response `cachedAt`) |
| `updated_at` | `2026-09-10T11:18:14.634Z` | `2026-09-16T03:59:21.249Z` (engine-managed `@updatedAt`) |

Unchanged: `id`, `school_id=1`, `enrollpro_school_year_id=9`, `year_label=2030-2031`,
`is_active=true`, `is_archived=false`, `created_at`, `last_verified_at`, `faculty_count=42`,
`section_count=20`, `sync_status`.

**Audit delta — exactly two new rows, both authorized:**

| id | action | actor | school | year |
|---|---|---|---|---|
| 796 | `LOCAL_LOGIN_SUCCESS` | 46 | 1 | — |
| 797 | `TERM_CACHE_SYNC_APPLIED` | 46 | 1 | 9 |

High-water `795 → 797`, total `244 → 246` (+2 exactly). `TERM_CACHE_SYNC_APPLIED` total = 1.
No other audit row was created.

**Signatures unchanged:** `faculty_subjects` 183, `generation_runs` 1,
`published_schedule_revisions` 0, `teaching_load_cycles` 2, `_prisma_migrations` 2.

## 5. Acceptance GETs (§8.4 — TT-TL runtime-acceptance rows 4–5)

**Row 4 — `GET /api/v1/generation/1/9/readiness/diagnostic` → 200.** The previously blocked
condition is GONE: `derivedDemandBlockers: []` and `termStructure {format:"TRIMESTER", terms:[T1,T2,T3]}`
now resolve (the former `TERM_STRUCTURE_UNAVAILABLE` / `DERIVED_DEMAND_BLOCKED` is absent).
`generateAllowed` is still `false` with 273 truthful blockers
(`WORKLOAD_POLICY_BLOCK` 218, `SEARCH_LIMIT_UNRESOLVED` 24, `ROOM_RESOURCE_UNAVAILABLE` 15,
`CANONICAL_SHAPE_CAPACITY_EXCEEDED` 15, `TERM_AUTHORITY_STALE` 1). Violations hard 0, soft 853.
Row 4 therefore remains **not accepted**; TT-TL acceptance stays `ACCEPTANCE_INCOMPLETE`.

**Row 5 — `GET /api/v1/dashboard/readiness-summary` → 200 — PASS.** `derivedDemand.available: true`,
`ready: true`, canonical revision `902B914DC2A115368AAE4A6905341E42C23E65A95F7F3E9ACC1B69580FB57F1D`,
`termStructure` TRIMESTER T1/T2/T3, `blockers: []`.

## 6. MATERIAL DEFECT DISCOVERED (not a rollback trigger) — `TERM_AUTHORITY_STALE`

A blocker that **could not exist before this apply** now appears, because the check it depends on
was previously unreachable while `termContractCache` was `NULL`:

- `atlas-server/src/services/generation-preflight.service.ts:631-650` compares the persisted
  `enrollProSchoolYearMirror.termContractCache.semanticRevision` — produced by
  `semanticRevisionFor` (`enrollpro-term-contract.service.ts:168-170`): **lowercase** sha256 over
  school + year + format + terms **including** `displayLabel`/`startDate`/`endDate` — against
  `derived.termStructure.semanticRevision` — `canonicalTermStructureRevision`
  (`derived-demand.service.ts:930-936, 1061`): **uppercase** sha256 over
  `{schoolId, schoolYearId, format, [{identity, order}]}` only.

These are different revision namespaces, so equality can never hold once the cache is populated.
Derived demand itself resolved correctly (`derivedDemandBlockers: []`; row 5 `ready: true`), so this
is a **false blocker in a downstream consumer**, not a bad write.

**Adjudication:** the apply's own §8.1–8.3 verification PASSED, so §9 rollback is neither required
nor authorized (it is available only when mandatory post-write verification fails). Rolling back
would merely re-hide the defect. A **bounded source correction** is required as a successor.

## 7. Cleanup and custody

Logged out via the application control; `GET /api/v1/auth/me` without an authorization header
returned **401 `NO_TOKEN`**; `sessionStorage` 0 keys; no `atlas_local_token` in `localStorage`;
`document.cookie` empty; tabs closed. No remembered token remains in the shared profile.

## 8. Explicitly not done

No second login; no second apply or replay request; no rollover sync/archive; no Teaching Load
carry-forward/suggestion/redistribution/apply; no timetable sync/edit/generation/publication; no
migration or schema operation; no runtime deployment/restart/task/env change; no Tailscale or
companion-repository mutation; no other database write; no source, test or product change; no commit
of product code; no worktree creation/removal.

## 9. Successor obligations

1. **Bounded source correction** for the `TERM_AUTHORITY_STALE` revision-namespace mismatch (one
   shared revision authority across `generation-preflight.service.ts`, `timetable-shape-policy.service.ts`
   and `derived-demand.service.ts`), with a failing-first control and fresh independent QA.
2. **TT-TL runtime-acceptance rows 4–5** remain `ACCEPTANCE_INCOMPLETE`; re-run after that correction.
3. Generation and publication remain **locked** and require their own reviewed HIGH packets.
4. A fresh **post-action Wave Completion Auditor** is required before closing TT-TL runtime
   acceptance or unlocking generation or publication.
