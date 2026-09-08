# Advisory Review — SCA-03E-R3 Narrow Semantic-Hardening Closure

REVIEWER_SPAWN_ID: `ses_f7e0f63d5ffeoEGJteGc8UiZre`
Relayed verbatim by the parent; this is the execution-system-issued reviewer identity for this review.
Reviewer: independent advisory reviewer (did NOT implement SCA-03E-R3).
Date: 2026-09-09

## Reviewer context note

REVIEWER_SPAWN_ID: `ses_f7e0f63d5ffeoEGJteGc8UiZre` — repeated verbatim per capture→relay→write ordering.
This is advisory review only: it does not authorize SCA-04, does not unlock any
successor, and issues no formal GO. I am a fresh reviewer context that did not
implement the R3 correction; I reviewed the changed source and tests from the
authoritative working tree and reran the required gates independently.

## Pins

The R3 correction is an inline instruction with no separate prompt file (as
noted in the assignment). The pin to verify is the SCA-03E-R2 manifest, which
this review recomputed independently:

- `D:/ATLAS/docs/verification/sca-03e-r2-semantic-revision-planner-manifest-2026-09-08.json`
  SHA-256 (certutil) = `a0eaffab992395a115a1dae3335c494de345ad6c1632f3f6e1c88038bd422903`
  (uppercase `A0EAFFAB…2903`). Sidecar `.sha256` = `A0EAFFAB992395A115A1DAE3335C494DE345AD6C1632F3F6E1C88038BD422903`. **MATCH.**
- `D:/ATLAS/docs/prompts/subjects-curriculum-authority-03e-r2-semantic-revision-closure-2026-09-08.md`
  SHA-256 (certutil) = `da17adf5f9c66aee5e489aa610d81ed5f83d90cff950714372e4cb4c2701fe9b`
  (uppercase `DA17ADF5…FE9B`) — matches the SCA-03E-R2 ledger pin. **MATCH.**
- HEAD observed `f4ec1e76`; dirty worktree matches the concurrent-stream
  inventory recorded in the ledger (Teaching Load / timetable / dashboard M-hunks,
  untracked SCA files + tests + docs). No stash/commit/reset performed.

## Scope verified

Changed files reviewed (R3 scope per ledger):
- `atlas-client/src/lib/decision-draft.ts` — escape-decoding duplicate scanner (`decodeJsonString`, `findFirstDuplicateJsonKey`), 64-hex `sourceRevisionHash` gate, exact saved-row-set equality.
- `atlas-server/src/services/curriculum-decision-candidates.service.ts` — canonical sort of `gradeLevels` (numeric asc) and `programScopes` (lexicographic) before hashing; ordered `termIdentities` preserved.
- `atlas-client/src/lib/__tests__/decision-draft.test.ts` (D8 + D6 hash assertions).
- `atlas-server/src/__tests__/curriculum-decision-candidates.test.ts` (R8).

No SCA-04 work, no deploy/restart, no schema/migration, no live-data mutation,
no external-repo edit. Server test used disposable schools 99960/99961 with
exact cleanup; residue-0 proven in the rerun.

## Requirement-to-enforcement matrix

| # | R3 requirement | Real code site (production path) | Rerunnable evidence (this review) | Verdict |
|---|---|---|---|---|
| 1a | Duplicate-key scanner decodes JSON escapes so raw-equivalent keys (`schoolId` vs `\u0073choolId`) reject BEFORE `JSON.parse` | `decision-draft.ts:252-285` `decodeJsonString` + `findFirstDuplicateJsonKey` (string token followed by `:` is a key of the innermost open object; `decodeJsonString` handles `\uXXXX` + standard escapes); invoked in `restoreDraftText` `:352-355` before `JSON.parse` | client D8 (top-level `\u0073choolId`, row-key `\u004d` both throw `/duplicate key/`); reviewer adversarial probes (nested, escaped-first, multi-escape `\u0073\u0063hoolId`, value-string immunity, distinct-prefix non-false-positive) | PASS |
| 1b | Escape text inside a string value is never a key (no false positives) | `findFirstDuplicateJsonKey`: a value string is never followed by `:` in an object-key position; only a string token followed by `:` is recorded | client D6 `keyLikeInString`; reviewer probes (escape text in value, value ending in colon, distinct decoded keys) | PASS |
| 2 | `sourceRevisionHash` must be exactly 64 hex chars before equality; absent/blank/wrong-type/short/non-hex/mismatch reject | `decision-draft.ts:385-391`: `typeof draftHash !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(draftHash)` throws `/hexadecimal/`; then strict `!==` for mismatch `/source revision/` | client D8 (short `'ABC'`, non-hex `'z'*64`, lowercase-64 mismatch) + D6 (blank, wrong-type 42); reviewer probes (absent, null, boolean, 63-char, 65-char, valid 64-hex passes) | PASS |
| 3 | Saved row-key set must EXACTLY equal current candidate group-key set: missing reject, additional reject, duplicate-equivalent reject; failure applies nothing, UI draft unchanged | `decision-draft.ts:400-407`: `assertOnlyKeys('Draft rows', rowsRaw, new Set(groups.map(g=>g.groupKey)))` rejects additional/unknown rows; loop `:403-407` rejects missing rows `/missing candidate row/`; duplicate-equivalent rows rejected at text level by scanner; failure throws before `draft` is returned/changed | client D8 (missing row throws; `preFailure` row stays `UNDECIDED`); reviewer probes (missing, additional `G9:STE:GHOST` `/unknown field/`, duplicate-equivalent row `/duplicate key/`, UI unchanged) | PASS |
| 4 | Canonical set sort: reordered `gradeLevels`/`programScopes` hash identically; ordered `termIdentities` still order-sensitive | `curriculum-decision-candidates.service.ts:176-177` `[...s.gradeLevels].sort((a,b)=>a-b)`, `[...s.programScopes].sort()` before hashing; `termConfig.termIdentities` at `:193` passed through order-preserved (not sorted) | server R8 (reorder gradeLevels `[10,9,8,7]`/programScopes `[SPS,SPA,STE,REGULAR]` with pinned updatedAt → hash identical; restore original → hash stable); R7 `#4` term identity ORDER change `['Q2','Q1']` → hash changes (order-sensitivity retained) | PASS |

## Adversarial bypass attempts (this reviewer, temp probe files, deleted)

1. **Escape-equivalent duplicates (Fix 1):** top-level `\u0073choolId` (dup of `schoolId`) → rejected `/duplicate key/` pre-parse ✓; row-key `G7:REGULAR:DW_MATH` with `\u004d` → rejected ✓; nested `\u0063ountText` inside `termDraft` → rejected ✓; escaped-FIRST `\u0073choolId` then raw `schoolId` → rejected ✓; multi-escape `\u0073\u0063hoolId` (= `schoolId`) → rejected `/duplicate key/` pre-parse ✓. Non-bypasses correctly NOT flagged: escape text inside a string value, and a genuinely distinct decoded key (`scchoolId` — see note) rejected fail-closed as `/unknown field/`.
   - **Reviewer probe note (not a finding):** one intermediate probe used `\u0073\u0063choolId`, which decodes to `scchoolId` (distinct from `schoolId`), so the scanner correctly did not flag it and `restoreDraft` correctly rejected it as an unknown field — demonstrating fail-closed behavior on a genuinely distinct key. The corrected multi-escape `\u0073\u0063hoolId` was confirmed flagged. This was a probe literal error, not a code defect.
2. **64-hex hash gate (Fix 2):** absent, `null`, blank `''`, number `42`, boolean `true`, 63-char, 65-char, 64-char non-hex `'z'*64`, lowercase-64 mismatch — ALL reject (`/hexadecimal/` or `/source revision/`); exact valid 64-hex passes. ✓
3. **Row-set exact equality (Fix 3):** missing row → `/missing candidate row/`; additional unknown row `G9:STE:GHOST` → `/unknown field/`; duplicate-equivalent row in raw text → `/duplicate key/`; failed restore leaves the current UI draft unchanged (`UNDECIDED`). ✓
4. **Canonical set sort / term order (Fix 4):** exercised via server R8 (reordered set-like arrays hash identically) and R7 `#4` (reordered ordered `termIdentities` still changes hash — order-sensitivity not regressed). ✓

## RED/GREEN

The ledger records RED (pre-fix: client suite failed on `/hexadecimal/` and
escape-equivalent-duplicate assertions; server suite failed 2 R8 assertions on
reordered arrays) and GREEN (post-fix 38/38 + 61/61). I independently confirmed
GREEN. RED is corroborated by code inspection: the D8 assertions
(`/duplicate key/`, `/hexadecimal/`) and R8 assertions (reordered arrays hash
identically) directly target the new decode/64-hex/sort code sites, so removing
any of the fixes makes those exact assertions fail. I did not revert the fixes
(no production-source modification permitted), so RED was not re-executed; it is
accepted on the ledger record + direct code-site mapping.

## Commands run (this reviewer, exit codes + timestamps, local time +08:00)

| Command | Result | Timestamp |
|---|---|---|
| `certutil -hashfile <sca-03e-r2 manifest> SHA256` | `a0eaffab…2903` == sidecar `A0EAFFAB…` MATCH | 2026-09-09 ~00:50 |
| `certutil -hashfile <sca-03e-r2 prompt> SHA256` | `da17adf5…9b` == ledger pin MATCH | 2026-09-09 ~00:50 |
| `git -C D:/ATLAS log --oneline -3` / `git status --short` | HEAD `f4ec1e76`; dirty inventory matches ledger | 2026-09-09 ~00:50 |
| `npx tsx src/lib/__tests__/decision-draft.test.ts` (atlas-client) | **38 passed / 0 failed**, exit 0 | 2026-09-09 ~00:52 |
| `npx tsx --env-file=.env src/__tests__/curriculum-decision-candidates.test.ts` (atlas-server) | **61 passed / 0 failed**, exit 0, zero residue, query-shape 8/14 | 2026-09-09 ~00:53 |
| `npx tsc --noEmit` (atlas-client) | exit 0 | 2026-09-09 ~00:55 |
| `npx tsc --noEmit` (atlas-server) | exit 0 | 2026-09-09 ~00:55 |
| `git -C D:/ATLAS diff --check` | exit 0 (CRLF warnings only) | 2026-09-09 ~00:56 |
| Adversarial probe (temp files `sca-r3-review-probe.ts`, `sca-r3-probe2.ts`, deleted) | 23/24 then corrected multi-escape confirmed; all 4 fixes hold | 2026-09-09 ~00:56 |

## Findings classification

- **Product/runtime:** none material. All four fixes map to live code sites and
  pass independently rerun gates plus reviewer adversarial bypasses. Escape
  decoding handles `\uXXXX` and the standard escape set; multi-escape and
  nested duplicates are rejected pre-parse; string-value content is never
  misread as a key; the 64-hex gate rejects every malformed/mismatched form;
  exact row-set equality holds for missing/additional/duplicate-equivalent
  rows with zero UI mutation on failure; canonical set sorting hashes reordered
  sets identically while ordered `termIdentities` remain order-sensitive.
- **Safety-gate:** none. SCA-04 stays LOCKED; `authorizesNoMutation: true`;
  no apply/term/Teaching Load/generation/publication/schema/migration/restart/
  deployment/external-repo mutation performed or evidenced. Server test used
  disposable schools 99960/99961 only, residue 0.
- **Process/documentation:** none material. Ledger records R3 scope, changed
  files, RED/GREEN, and the review-artifact path. One reviewer-side probe
  literal error (see adversarial note) was adjudicated as non-material and is
  not a finding against the implementation.

## Verdict

`zeroFix: true` — no material product, safety-gate, or process finding requires
a fix before advisory closure; all four R3 fixes map to live code sites with
independently rerun gates (client 38/38, server 61/61, tsc ×2, diff-check) and
survive reviewer adversarial bypasses, and SCA-04 stays LOCKED. Advisory only:
no formal GO, no SCA-04 unlock.
