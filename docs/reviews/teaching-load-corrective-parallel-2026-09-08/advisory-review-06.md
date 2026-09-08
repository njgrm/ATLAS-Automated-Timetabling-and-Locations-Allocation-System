# Advisory Review 06 — TL-C01R4A Department Authority Apply Integrity Gaps (Fresh Changed-Scope Review)

- Reviewer: FRESH advisory reviewer context (did NOT implement TL-C01R4A; no shared state with the implementer).
  No reviewer spawn ID was supplied by the parent for this review (same caveat as T7.4/P-04 and T7.5);
  independence basis is recorded instead: this reviewer implemented nothing, disregarded prior reviews
  01–05 as SUPERSEDED per the brief, and re-verified every claim below from source with independently
  rerun commands.
- Plan/ledger: `D:\ATLAS\docs\progress\teaching-load-corrective-parallel-2026-09-08-progress.md`
  (TL-C01R4A section, cumulative inventory, boundary).
- Date (UTC): 2026-09-08. Scope: TL-C01R4A only (defects 1–7 + sections A–E + replacement artifact triple).
- Authority: advisory only. This artifact does NOT mark formal GO and does NOT unlock any successor.
  The reviewer edited NO source files and wrote NO database rows except the suites' own disposable
  fixture cycles (created and removed by the suites themselves, zero-residue proven).

## Reviewed file hashes (recomputed by reviewer via Get-FileHash SHA-256)

| File | Full SHA-256 (reviewer) | Ledger prefix | Match |
|---|---|---|---|
| `atlas-server/src/services/department-authority.service.ts` | `27495D688CE656E6DB5E9C192FA360914DD29D9C1A5D2B25C3079D0C79FFF930` | `27495D68` | YES |
| `atlas-server/src/routes/faculty-assignment.router.ts` | `129BF3C666023C26255ECB8C95E063C64D7A8B33457808959B3610BB5E6B6491` | `129BF3C6` | YES |
| `atlas-server/src/__tests__/department-authority-apply.test.ts` | `488C3B54DFE9C2E0270D7D83A9C5B18C7004800F1DA5696FC1E22D25166990C1` | `488C3B54` | YES |
| `atlas-server/src/__tests__/department-authority-gates.test.ts` | `EB2893B6470AAD95E0F9CB73C6D921CF980D451CC889D821D3D85FCB543F95F4` | `EB2893B6` | YES |
| `docs/verification/department-authority-apply-r4a.json` | `D1D8E74E2FA18D3BBFC10E8A169FB1786F879C94805BD8A5D27B929937FFBBCF` | `D1D8E74E…BBCF` (sidecar) | YES |

Unchanged-but-covered files (scheduling-policy / faculty-assignment / cycle services, prior suites) were
not rehashed individually; no-regression is evidenced by the rerun gates below (effective-policy 56/56,
workload-policy 8/8, server `tsc` clean) and by the reviewer confirming zero R4A edits outside the four
files above (R4A inventory statement consistent with `git status`: the only untracked service file is
`department-authority.service.ts`; all other deltas are pre-existing concurrent-stream changes).

## Independently rerun results (all by this reviewer, exact commands from the brief)

| Command (workdir `D:\ATLAS\atlas-server`) | Result |
|---|---|
| `npx tsx src/__tests__/department-authority-gates.test.ts` | **54/54 PASS**, exit 0 (fixture school id=20, zero-residue proven; ephemeral route server on port 51895, closed after) |
| `npx tsx src/__tests__/department-authority-apply.test.ts` | **63/63 PASS**, exit 0 (fixture school id=21, zero-residue proven) |
| `npx tsx src/__tests__/teaching-load-effective-workload-policy.test.ts` | **56/56 PASS**, exit 0 (hermetic; the `[prisma] DATABASE_URL is not set` line is pre-existing benign output — this suite performs no DB I/O) |
| `npx tsx src/__tests__/workload-policy.test.ts` | **8/8 PASS**, exit 0 |
| `npx tsc --noEmit` | clean, no output, exit 0 |

## Requirement-to-enforcement matrix (defects 1–7 + sections A–E)

Defect numbering is reconstructed from the ledger's RED record and sections A–E (the ledger does not
enumerate defects 1–7 in one list; each row below names the enforcement and its production call site).

| ID | Requirement | Enforcement (production call site) | Executable proof (rerun by reviewer) |
|---|---|---|---|
| D1 (A) | POST preview/apply reject system tokens with 401 (JWT-only operator mutation; no machine-mutation contract) | `faculty-assignment.router.ts:63,85` — preview/apply use JWT-only `authenticate`; GET alone keeps `authenticateWithSystemToken` (`:46`) with an explicit read-only comment (`:42-45`) | Gates E1/E1b route probes → 401/INVALID_TOKEN; officer JWT preview → 200. 54/54 suite green |
| D2 (A) | Missing actor school fails closed with 403 ACTOR_SCHOOL_REQUIRED (not 409/SOURCE_DRIFT) | `department-authority.service.ts:338-345` `assertSchoolScope`: null actor → 403 before any read; router `actorSchoolIdOf` (`faculty-assignment.router.ts:28-31`) yields null unless a positive integer JWT school exists | Gates E2 service + route probes → 403/ACTOR_SCHOOL_REQUIRED with zero writes. RED-record fail-open confirmed fixed |
| D3 (A) | Cross-school JWT fails closed with 403 SCHOOL_MISMATCH; GET keeps tested school isolation | Service `:342-344` integer+mismatch → 403; router `:33-40` `rejectSchoolScopeConflict` pre-check on all three routes; GET read is single-school (`listDepartmentAuthority`) | Gates E3 service (implied via preview/apply 403 paths) + route E3 → 403/SCHOOL_MISMATCH; system-token GET returns only the requested school scope. 54/54 green |
| D4 (A) | Strict school-ID parsing: fractional/Infinity/junk/zero/negative/empty/non-numeric → typed 400, no floor coercion | `department-authority.service.ts:45-59` exported `parseStrictPositiveInt` (regex `^[1-9]\d*$` for strings; `Number.isInteger` for numbers); wired into all three routes (`faculty-assignment.router.ts:50,67,89`) | Gates E4: 12 service-level 400s + 12 route-level 400s (`3.5`/`Infinity`/`abc`/`''`/`0`/`-4`). Legacy `parsePositiveQueryInteger` floor-coercion (`:123-129`) untouched and NOT used on these routes |
| D5 (B) | `revisionHash` covers every scoped semantic row; counts/dates diagnostic-only; in-place change flips it | `department-authority.service.ts:175-199` `buildDepartmentAuthoritySourceRevision` (canonicalHash over schemaVersion `TL-C01R4A.1` + schoolId + normalized sorted alias/department + code/label pairs); `assertSourceRevision` (`:347-357`) compares ONLY `revisionHash` | Gates E5: in-place `FIL`→`Wikang Filipino` flips hash with identical counts; stale revision → 409 SOURCE_DRIFT zero-write. Apply suite proves count-only tampering does NOT gate (hash authority) |
| D6 (C) | Single Serializable tx: re-read → revision → fingerprint → classify → abort/create → receipt; replay only after in-tx checks with `revalidatedInTransaction:true`, zero writes; P2034 → typed 409; no invented retry | `department-authority.service.ts:386-470` one `$transaction` (`isolationLevel: Serializable`, `:470`); replay returns inside the tx (`:423-437`) with `revalidatedInTransaction:true`; `catch` maps `isTransactionConflictError` (P2034, `:165-167`) → 409 TRANSACTION_CONFLICT (`:471-475`). No retry/attempt/sleep/backoff constructs exist in this file (reviewer grepped: `for` loops at `:270,:280,:439` are data iteration/creation only; "retry" appears solely in user-facing 409 message strings) | Gates E6/E7/E8: drifted replay → 409 zero-write; clean replay `replayed:true` + `revalidatedInTransaction:true` + zero writes. Apply suite §7/§8/§10 + P2034-mapper unit section. 63/63 green |
| D7 (D) | Replacement artifact distinguishes preview fp / semantic hash / byte SHA with explicit sidecar meanings; approval binds the service-accepted preview fp (`D99894F1…`); `3978787D` superseded with reasons; no self-referential hashing; tables still empty (NOT applied) | Sidecar `docs/verification/department-authority-apply-r4a.sha256` documents all three meanings; supersede marker `department-authority-apply-3978787df101.SUPERSEDED_NON_APPLICABLE` records both reasons (wrong authority binding; semantic-vs-byte SHA ambiguity); superseded JSON preserved unmodified | Reviewer independent read-only probe (TEMP script, deleted after): live school-1 `aliases=0 labels=0`; live preview fp `D99894F1…` == artifact (exact); live revision `00353932…` == artifact; byte recompute `D1D8E74E…` == sidecar; semantic recompute `EAF49D08…` == embedded; approval contains live fp (`true`); file carries no self-hash (`true`); 8 labels / 0 aliases; `authorizesMutation:false`. NOTE: E9/E10 are NOT suite-asserted — see finding F-01 |
| E (E) | All 10 negative controls hold; recorder sensitivity + zero-residue fixture proven | Gates suite header (`department-authority-gates.test.ts:1-21`) + apply suite validation edges (`department-authority-apply.test.ts`, blank/duplicate/overlong/non-array/non-string + empty-preview fp) | 54/54 + 63/63 green; recorder flags direct `DepartmentLabel:create` in both suites; both fixtures removed with `aliases=0, labels=0, school=0` residue proof |

## Adversarial probes re-derived by this reviewer (minimum set from the brief)

Each was executed by rerunning the suites from source (the suites ARE the adversarial fixtures) plus the
independent live read-only probe. No probe was inherited from a prior review's verdict.

- System-token apply → 401 (gates E1, rerun PASS).
- Null-actor apply → 403 ACTOR_SCHOOL_REQUIRED, zero writes (gates E2 service+route, rerun PASS).
- Cross-school apply → 403 SCHOOL_MISMATCH, zero writes (apply suite §5 + gates E3 route, rerun PASS).
- `'3.5'` / `'Infinity'` / `''` (+ `abc`/`0`/`-4`/null/NaN/2.5) school IDs → typed 400, no floor coercion (gates E4, rerun PASS).
- In-place label edit with same counts → hash flips; stale apply → 409 SOURCE_DRIFT, zero writes (gates E5, rerun PASS).
- Unrelated alias insert invalidating a labels-only apply → 409, zero writes (gates E6/E7 drift, rerun PASS).
- Blank/duplicate/overlong rows (+ non-array/non-string) → typed 400 pre-read, zero writes (apply suite validation edges, rerun PASS).
- Replay-after-success → `replayed:true`, `revalidatedInTransaction:true`, zero writes (gates E8 + apply §10, rerun PASS).

## Boundary verification (reviewer-checked)

- Zero SCA-03E contact: reviewer edited nothing; `git status` shows no staged entries (`git diff --name-only --cached` empty, `git stash list` empty). Modified/untracked SCA-03E and timetable/client files are pre-existing concurrent-stream state, untouched by this review.
- No schema/migration: none created, touched, or applied.
- Nothing staged/committed/stashed/reset: confirmed above.
- No live mutation beyond disclosed fixture cycles: suites created disposable fixture schools (ids 20, 21 in this run) and removed them with zero-residue assertions; reviewer probe was SELECT + pure-preview only (counts + `previewDepartmentAuthority`, which is side-effect-free by construction at `department-authority.service.ts:309-326`); live school-1 tables read 0/0 after all runs.
- No port-5001 restart: no server started except the gates suite's own ephemeral listener (port 51895, closed in `finally`).
- No TL-C02: no TL-C02 code, migration, or apply executed; replacement artifact carries `authorizesMutation:false`.
- Temp hygiene: reviewer TEMP probe scripts (`C:\…\opencode\r4a-review-probe.ts`, `atlas-server\r4a-review-probe.tmp.ts`) both executed and deleted (verified `Test-Path False` for both).

## Findings

### F-01 (process/docs — REQUIRED FIX, no product defect): ledger overclaims E9/E10 as suite coverage

- Evidence: the ledger (§E, line ~508) states the gates suite covers "E9 byte/sidecar match, E10
  approval==preview-fp" within "54/54 PASS". The gates file
  (`atlas-server/src/__tests__/department-authority-gates.test.ts`, full 352-line read) contains ZERO
  executable E9/E10 assertions — reviewer keyword scan for `E9|E10|r4a|semanticHash|approvalSentence|sha256`
  returns only 3 incidental hits (header comment line 2, fixture name line 108, shortName `TLR4AX` line 112).
  The 54 passes decompose exactly to E1–E8 + recorder-sensitivity + route gates + zero-residue proof.
  E9/E10 exist only as aspirations in the header docstring (lines 9–10).
- Product impact: NONE — this reviewer independently verified every E9/E10 claim from source (see D7 row:
  byte/semantic recomputes match, approval binds the live service-accepted fp, 8/0 rows, 0/0 live tables,
  no self-hash). The risk the gates were meant to mitigate is closed by evidence; the defect is ledger
  accuracy, and formal QA must not rely on "suite-verified E9/E10" as written.
- Required fix (docs-only, either option closes it; NO source change needed):
  (i) add executable E9 (byte recompute vs sidecar + semantic recompute vs embedded) and E10
  (approval-contains-preview-fp, fp obtained from a live read-only `previewDepartmentAuthority` call)
  assertions to `department-authority-gates.test.ts`, OR (ii) correct the ledger §E to state that E9/E10
  were reviewer-verified from source (cite this artifact) rather than suite-verified.
- Suggested commit (docs): `docs(teaching-load): correct E9-E10 coverage claim for department-authority gates`

### Observations (NOT findings, no fix required)

- O-01: Fingerprint schema version (`TL-C01R4.1` at `department-authority.service.ts:226`) vs revision schema
  version (`TL-C01R4A.1` at `:183`) naming is inconsistent but both are pinned constants hashed into their
  respective digests; harmless.
- O-02: `P2002` unique violations inside the apply tx propagate unmapped (only P2034 is typed). Acceptable:
  conflicts are pre-classified to 409 before any write, so P2002 can only arise from a true race; raw
  propagation on a race is fail-closed.
- O-03: `git status` shows extensive pre-existing concurrent-stream modifications (client timetable surfaces,
  SCA-03E files, `tmp/`, `capstonePaperchapt1-424.pdf`). Not TL-C01R4A, not this reviewer's, left untouched —
  recorded here only so formal QA does not attribute that delta to this pass.

## Required fixes

1. F-01: align the E9/E10 coverage claim (add suite assertions OR correct the ledger) — docs-only.

## Verdict

- `zeroFix: false` — exactly one open item (F-01, process/docs). Product/runtime verification is fully
  green: all defects 1–7 enforced at the cited production call sites, all rerun gates pass (54/54, 63/63,
  56/56, 8/8, `tsc` clean), all minimum adversarial probes hold, replacement-artifact triple independently
  verified, boundary intact (zero SCA-03E contact, no schema/migration, nothing staged, no live mutation,
  no restart, no TL-C02).
- Advisory only: no formal GO is marked by this artifact. After F-01 is closed, one fresh changed-scope
  review of that docs delta (per the risk-tiered model, LOW) is sufficient; no product re-verification is
  implied by F-01.
