# Advisory Review 08 — TL-C01R4B Department-Authority Apply Boundary Normalization (Fresh Changed-Scope Review)

- Reviewer: FRESH advisory reviewer context (did NOT implement TL-C01R4B; no shared state with the
  implementer). No reviewer spawn ID was supplied by the parent for this review (same standing caveat
  as P-04 / review-06 / review-07). Independence basis is recorded instead: this reviewer implemented
  nothing in this pass, disregarded prior reviews 01–07 as covering prior scopes only, reviewed ONLY the
  R4B delta against the R4A review-07 snapshot, and re-verified every claim below from source with an
  independently rerun command and a zero-DB adversarial probe.
- Plan/ledger: `D:\ATLAS\docs\progress\teaching-load-corrective-parallel-2026-09-08-progress.md`
  (TL-C01R4A section, R4 inventory, T7.6/T7.7 log). Note: the ledger does not yet contain an R4B section;
  this artifact is the durable R4B evidence (see Observation O-1).
- Date (UTC): 2026-09-08. Scope: TL-C01R4B delta ONLY — normalize-once in the apply route handler
  (`faculty-assignment.router.ts`) + real-route HTTP proofs for the numeric-string boundary
  (`department-authority-gates.test.ts`), plus confirmation that the R4A semantic preview remains valid.
- Authority: advisory only. This artifact does NOT mark formal GO and does NOT unlock any successor.
  The reviewer edited NO source files and wrote NO database rows except the suites' own disposable
  fixture cycles (created and removed by the suites themselves, zero-residue proven).

## Authorized edit scope and verified file hashes (recomputed by reviewer via Get-FileHash SHA-256)

| File | Full SHA-256 (reviewer) | Authorized prefix | Match |
|---|---|---|---|
| `atlas-server/src/routes/faculty-assignment.router.ts` | `1BD576C8DA4D6617EF5CA66C4DADB907FFFD60DA4DEAB37BBE73C853B720AAC2` | `1BD576C8` | YES |
| `atlas-server/src/__tests__/department-authority-gates.test.ts` | `9E2DC26E1BCC751D6B04A2D82363683A1D4AD1FE8F8D13FA89E584E30FA3C16C` | `9E2DC26E` | YES |

Review-07 snapshot references: router `129BF3C6…B6491`, gates `228BE876…FE5` (383 lines). Gates file is
now 446 lines; the delta is the R4B real-route proof block (lines 360–419) plus ±3 lines of header
context that cannot be byte-reconstructed because `**/__tests__/` is git-ignored and reviews store only
hashes (Observation O-2; no impact on the verdict).

## Change isolation (nothing else moved vs the R4A review-07 snapshot)

Reviewer recomputed SHA-256 for every other R4A-inventory TL-owned file — all identical to the recorded
inventory:

| File | R4A inventory / review-07 | Current (reviewer) | Match |
|---|---|---|---|
| `atlas-server/src/services/department-authority.service.ts` | `27495D68` | `27495D688CE656E6DB5E9C192FA360914DD29D9C1A5D2B25C3079D0C79FFF930` | YES |
| `atlas-server/src/__tests__/department-authority-apply.test.ts` | `488C3B54` | `488C3B54DFE9C2E0270D7D83A9C5B18C7004800F1DA5696FC1E22D25166990C1` | YES |
| `atlas-server/src/__tests__/teaching-load-effective-workload-policy.test.ts` | `EB3056BE` | `EB3056BE…` | YES |
| `atlas-server/src/__tests__/teaching-load-summary-zero-write-route.test.ts` | `0189A318` | `0189A318…` | YES |
| `atlas-server/src/services/faculty-assignment.service.ts` | `B613EBC2` | `B613EBC2…` | YES |
| `atlas-server/src/services/scheduling-policy.service.ts` | `F8935A57` | `F8935A57…` | YES |
| `atlas-server/src/services/teaching-load-cycle.service.ts` | `AB0AB52D` | `AB0AB52D…` | YES |
| `docs/verification/department-authority-apply-r4a.json` | `D1D8E74E…BBCF` | `D1D8E74E2FA18D3BBFC10E8A169FB1786F879C94805BD8A5D27B929937FFBBCF` | YES |

- SCA-03E untouched: reviewer made zero edits; worktree `M`/`??` entries (client timetable surfaces,
  `curriculum-requirements.router.ts`, `curriculum-decision-candidates.service.ts`, decision-workspace
  files, `tmp/pdfs`, PDFs/DOCX) are pre-existing concurrent-stream state recorded in review-06 O-03 and
  review-07, untouched here.
- Nothing staged (`git diff --name-only --cached` empty), stash empty, no probe/tmp `.ts` files left
  (`tmp/` contains only the pre-existing `pdfs/` subdirectory; reviewer probe deleted and verified).

## 1. Router normalize-once (from source, `faculty-assignment.router.ts`)

- GET `:46-60` — `schoolId = parseStrictPositiveInt(req.query.schoolId)` (`:50`); passes the parsed
  value positionally: `listDepartmentAuthority(schoolId)` (`:56`). Never the raw query value.
- POST preview `:63-81` — `schoolId = parseStrictPositiveInt(req.body?.schoolId)` (`:67`); passes the
  parsed value positionally as the first argument: `previewDepartmentAuthority(schoolId, {…})` (`:73`).
- POST apply `:85-108` — `schoolId = parseStrictPositiveInt(req.body?.schoolId)` (`:89`); passes the
  parsed value into the service: `applyDepartmentAuthority({ … schoolId, … })` (`:98`) with the explicit
  comment `Pass the already validated/normalized positive integer, never the raw body value.` The apply
  handler never forwards `req.body?.schoolId` to the service.
- Only-R4B-source-change: every other R4A-inventory file is byte-identical (table above); the router's
  department-authority section matches every R4A structural description recorded in review-06 (JWT-only
  preview/apply at `:63/:85`, `authenticateWithSystemToken` GET at `:46`, `parseStrictPositiveInt` wired
  at `:50/:67/:89`). The observable R4B behavioral delta is the apply handler's normalized schoolId
  passing, which the gates suite now proves (see §2).

## 2. Gates-suite real-route HTTP proofs (from source + independent rerun)

R4B block at `department-authority-gates.test.ts:360-419` boots the real Express app on an ephemeral
port (`app.listen(0)`, `:292-295`, closed in `finally`, `:420-422`) and drives it with hand-signed JWTs
and the real service path:

- **Numeric-string schoolId** (`:360-377`): `schoolId: String(fixtureSchoolId)` preview → 200, identical
  fingerprint to numeric-ID preview (`:364`), both scoped to the fixture school (`:365`); string-ID apply
  → 200 with `created.length === 8` (`:373`) and `schoolId === fixtureSchoolId` (`:374`).
- **Empty/idempotent apply** (`:378-392`): empty preview → 200; empty apply → 200, `replayed:true`
  (`:390`), `before === 0 && after === 0` (`:391`) — zero writes proven on the route.
- **Typed 4xx matrix on apply** (`:393-413`): fractional/`Infinity`/`abc`/`0`/`-4`/`''` → 400
  `INVALID_PARAM` (`:403-408`); missing schoolId → 400 (`:409`); cross-school JWT → 403 `SCHOOL_MISMATCH`
  (`:410`); missing-actor JWT → 403 `ACTOR_SCHOOL_REQUIRED` (`:411`); system-token → 401 (`:412`).
- **Fixture/live residue** (`:414-419`): live school-1 `departmentAlias=0` and `departmentLabel=0`;
  cleanup (`:423-431`) proves `aliases=0, labels=0, school=0`.

### RED→GREEN reasoning for the numeric-string apply test (independent of the suite)

Service contract (source, `department-authority.service.ts`, hash `27495D68` unchanged):
- `previewDepartmentAuthority(schoolId, …)` `:313-314` — `if (!Number.isInteger(schoolId) || schoolId <= 0) throw 400` **before any read**.
- `applyDepartmentAuthority({schoolId, …})` `:369-374` — requires `typeof schoolId === 'number'`; a non-number sets `schoolId = null` → `throw 400 INVALID_PARAM` **before any write/read**.
- `parseStrictPositiveInt('N')` → numeric `N` (`:50-56`).

RED (raw-pass defect): a client sending the valid numeric string `String(fixtureSchoolId)` is forwarded
verbatim by the broken route; the service rejects the string form with a typed 400 on both preview and
apply, so the R4B test's expectations (preview 200, apply 200, `created.length === 8`) FAIL.

GREEN (normalize-once fix): the route parses the string to a number and passes that number; the service
guard passes, actor-school comparison (`23 === 23`) holds, and apply returns 200 with exactly the eight
scoped label rows.

Reviewer proved the RED side independently with a **zero-DB probe** (temp script `r4b-review-probe.tmp.ts`,
imported the production service, executed, then deleted and verified absent):
`parseStrictPositiveInt(String(30)) === 30`; `previewDepartmentAuthority(String(30), {actorSchoolId: 30})`
→ 400 `INVALID_PARAM` pre-read; `applyDepartmentAuthority({schoolId: String(30), …})` → 400
`INVALID_PARAM` pre-read. Exit 0. This confirms the R4B assertion genuinely discriminates and is not a
tautology.

## 3. Independently rerun results (exact commands from the brief, by this reviewer)

| Command (workdir `D:\ATLAS\atlas-server`) | Result |
|---|---|
| `npx tsx src/__tests__/department-authority-gates.test.ts` | **82/82 PASS**, exit 0 (fixture school id=30; ephemeral route server port 50610, closed in `finally`; zero-residue + live 0/0 proof PASS) |
| `npx tsx src/__tests__/department-authority-apply.test.ts` | **63/63 PASS**, exit 0 (zero-residue proof PASS) |
| `npx tsc --noEmit` | clean, exit 0 |
| `npm run build` (`tsc` emit) | success, exit 0 |
| `git diff --check` (workdir `D:\ATLAS`) | exit 0 (LF→CRLF notices only, pre-existing) |

The 82/82 decomposition includes all R4B assertions above (`string-ID preview succeeds`,
`numeric-ID preview succeeds`, `share one fingerprint`, `both previews scope to the fixture school`,
`string-ID apply succeeds`, `created the eight labels`, `apply response scoped`, `empty apply replays`,
`replayed:true`, `zero rows`, the 6 malformed-apply 400s, `missing schoolId`, `cross-school`,
`missing-actor`, `system-token`, `live school department tables unchanged`, `zero residue`).

## 4. Semantic preview / artifact validity

- **Service unchanged**: `department-authority.service.ts` is byte-identical to the R4A inventory
  (`27495D68`) — fingerprint, source-revision, and apply transaction logic untouched by R4B.
- **Preview route behavior unchanged**: the preview handler still calls
  `previewDepartmentAuthority(schoolId, {actorSchoolId, aliases, labels})` with the normalized positive
  integer; normalization cannot alter the semantic inputs (`String(1)`→`1`, `1`→`1`), so the preview
  fingerprint the endpoint accepts is unchanged.
- **Artifact unchanged**: `department-authority-apply-r4a.json` byte SHA `D1D8E74E…BBCF` matches
  (pre-run and post-run). Preview fingerprint `D99894F169FD556C3379CFA7B404EF5105B40F6C8A15F062932A8982ED56F32A`,
  semantic hash `EAF49D08141E9B2F37E685D1B94A93BEA1B66E7D620755C37CFAAC6E352950BE`, and byte SHA remain
  the recorded values.
- **Re-proven by execution**: gates E9 (byte recompute vs sidecar, no self-hash) and E10
  (production `buildDepartmentAuthorityFingerprint` recompute === artifact preview fingerprint; approval
  binds it; `authorizesMutation:false`) both PASS in the rerun.
- **Regeneration required: NO.** The R4A artifact remains the authoritative, service-accepted preview.

## 5. Boundary verification (reviewer-checked)

- Zero SCA-03E contact: reviewer edited nothing; SCA-03E files are pre-existing concurrent-stream state.
- No schema/migration: only the baseline `prisma/migrations/0000_clean_baseline` exists (repo-root
  `prisma/`); none created, touched, or applied.
- Nothing staged/committed/stashed/reset: `git diff --name-only --cached` empty; `git stash list` empty.
- No live mutation beyond disposable fixture cycles: gates fixture school id=30 and the apply suite's
  fixture were created and removed by the suites with zero-residue assertions; live school-1 tables read
  0/0 after all runs; reviewer's probe performed zero DB access.
- No port-5001 restart: only the gates suite's ephemeral listener (port 50610) started and closed.
- No TL-C02: no TL-C02 code, migration, or apply executed.
- No live label rows applied: live `department_alias`/`department_label` = 0/0 confirmed by the suite.

## Findings

- No material product, runtime, or safety-gate defects in the R4B delta. `zeroFix: true`.

### Observations (NOT findings, no fix required)

- O-1 (process/docs follow-up, not a defect): the progress ledger has no TL-C01R4B section yet; per the
  ledger protocol the implementer should append one (RED→GREEN record, two-file delta, 82/82 + 63/63 +
  tsc + build + diff-check evidence, artifact reference). This review artifact stands as the R4B
  evidence until then.
- O-2: gates file line delta is 383→446 (+63) against an R4B block of ~60 lines; the residual ~3 lines
  cannot be byte-reconstructed because `**/__tests__/` is git-ignored and prior reviews stored hashes
  only. The authorized hash `9E2DC26E` matches, all R4B assertions are present and passing, and no other
  file moved — no impact on the verdict.
- O-3: `git status` still shows the pre-existing concurrent-stream modifications (timetable surfaces,
  SCA-03E files, decision-workspace files, `tmp/pdfs`, PDFs/DOCX). Not R4B, not this reviewer's, left
  untouched — recorded so formal QA does not attribute that delta to this pass.

## Required fixes

None.

## Verdict

- `zeroFix: true` — for the TL-C01R4B delta scope only. All five brief items verified from source with
  independently rerun commands; numeric-string boundary proven RED-capable and GREEN by execution;
  semantic preview R4A artifact confirmed VALID with no regeneration required; boundary intact.
- Advisory only: no formal GO is marked by this artifact. Formal planner/QA review decides GO.
