# Advisory Review — SCA-03E-R2 Semantic Source-Revision Closure (Prompt/Manifest Pins Verified)

Date: 2026-09-09
REVIEWER_SPAWN_ID: ses_f7e296099ffeUVD2s2UDBOskRN
Reviewer: independent advisory reviewer (did NOT implement SCA-03E-R2)

## Reviewer context note

Execution-system context identifier: NONE_EXPOSED (no reviewer-spawn operation is
available in this execution environment; the parent is relaying the spawn ID
after this artifact is written, and line 3 will be updated verbatim when relayed).
REVIEWER_SPAWN_ID: ses_f7e296099ffeUVD2s2UDBOskRN (relayed verbatim by the parent;
this is the execution-system-issued reviewer identity for this review).
This is advisory review only: it does not authorize SCA-04 and does not unlock
any successor. No formal GO is issued.

## Pins recomputed by this reviewer (independent)

- Prompt `D:/ATLAS/docs/prompts/subjects-curriculum-authority-03e-r2-semantic-revision-closure-2026-09-08.md`
  SHA-256 = `da17adf5f9c66aee5e489aa610d81ed5f83d90cff950714372e4cb4c2701fe9b`
  (uppercase `DA17ADF5…FE9B`) → equals manifest `promptSha256` (`DA17ADF5F9C66AEE5E489AA610D81ED5F83D90CFF950714372E4CB4C2701FE9B`). MATCH.
- Manifest `D:/ATLAS/docs/verification/sca-03e-r2-semantic-revision-planner-manifest-2026-09-08.json`
  SHA-256 = `a0eaffab992395a115a1dae3335c494de345ad6c1632f3f6e1c88038bd422903`
  (uppercase `A0EAFFAB…03`) → equals `.sha256` sidecar content and the SCA-03E-R2 ledger claim. MATCH.
- Manifest asserts `authorizesNoMutation: true`, `risk: MEDIUM`, and
  `successor.promptId = SCA-04`, `status = LOCKED` with unlock requiring formal
  planner acceptance, persisted operator decisions, a fresh post-decision
  preview + fingerprint approval, and the Teaching Load stream frozen. The
  `forbidden` list covers curriculum apply, term write, Teaching Load mutation,
  generation/publication, schema/migration, port-5001 restart, external-repo
  edit. This review honored all: no writes other than this artifact; no apply,
  term write, Teaching Load/generation/publication/schema/migration/restart/
  external-repo contact. **SCA-04 remains LOCKED and no mutation is authorized.**

## Changed-file boundary verification

Executor-scope files (SCA-03E-R2), confirmed present and reviewed:
- `atlas-server/src/services/curriculum-decision-candidates.service.ts` (untracked; read)
- `atlas-server/src/__tests__/curriculum-decision-candidates.test.ts` (untracked; read)
- `atlas-client/src/lib/decision-draft.ts` (untracked; read)
- `atlas-client/src/lib/__tests__/decision-draft.test.ts` (untracked; read)
- `atlas-client/src/pages/DecisionWorkspace.tsx` (untracked; read)
- `atlas-client/src/components/decision-workspace/DraftPreviewPanel.tsx` (untracked; read)

Forbidden files NOT changed by this pass:
- `curriculum-requirements.router.ts` diff = exactly the +18 SCA-03E carryover
  hunk (decisionCandidatesService import + read-only GET
  `/:schoolYearId/decision-candidates`). Signature of
  `getDecisionCandidates(schoolId, schoolYearId)` is unchanged, so no router
  hunk was required.
- `App.tsx` diff = +5 (lazy DecisionWorkspace import + `subjects/decision-workspace` route);
  `CurriculumRequirements.tsx` diff = +3 (Decision-workspace nav link). Together
  these three files total exactly the +26 lines recorded at SCA-03E as tracked
  carryover; no additional R2 hunk is present.
- No `schema.prisma`/migration/`.env`/auth/TL/TT/EVAL/companion file is modified
  in `git status` by this stream.
- Grep over `atlas-server/src` and `atlas-client/src` for
  `ESTABLISHED_SPECIALIZATION_DECISIONS|PRE_RESOLVED_SPECIALIZATION|preResolved|
  establishedDecisions|lockedEstablishedDecision` returns matches ONLY in the
  test file as disavowing assertions. SCA-03E-R constant removal is intact.

Verification limitation (recorded, not a finding): because the whole SCA stream
is uncommitted working-tree state (no pre-R2 snapshot), "not edited in R2
specifically" cannot be proven by an inter-commit diff. It is evidenced by (a)
the three forbidden-file diffs being exactly the recorded +26-line carryover and
(b) the unchanged service signature. This is consistent with the executor's
attribution.

## Requirement-to-enforcement matrix

| # | Prompt requirement | Real code site (production path) | Rerunnable evidence (this review) | Verdict |
|---|---|---|---|---|
| R2.1 | Server-owned `sourceRevisionHash` via existing canonical JSON + SHA-256, NO duplicated hash logic | `curriculum-decision-candidates.service.ts:34` imports `canonicalHash, sortByKey` from `lib/canonical-json.js`; hash built at `:167-203`, `canonicalHash` at `:203`. `canonical-json.ts:71-78` is the sole SHA-256. | server suite 59/59 (R7: 64-hex hash asserted) | PASS |
| R2.1 | Domain includes school+year identity; stably ordered semantic rows (subjects, sections, ownerships, term config, active requirements, term assignments) | `hashInput` at `:167-202`: `schoolId`, `schoolYearId`, subjects/sections/ownerships/requirements each `sortByKey(..., id)`, term assignments `sortByKey(offeringId\|termIdentity)`, `termConfig` object with order-preserved `termIdentities`. | R7 "#8 cross-school"/"#8 same school different year"; "#4 term identity ORDER change" | PASS |
| R2.1 | Counts/timestamps diagnostic-only, NOT the equality gate | `sourceRevisions` (`:97-104`) carries counts + updatedAt maxima; hashInput contains none of them. | R7 `#1` mutant control asserts old count/timestamp gate UNCHANGED → suite fails on count-equality fallback | PASS |
| R2.1 | Reads batched/set-based, no per-row DB loop | 6 batched `findMany`/`getTermConfig` in one `Promise.all` (`:120-161`) + one `buildExpectedScopes` (`:318`). | R7 query-shape proxy: **8 queries for 14 groups** (per-row would be ≥14), asserted `4..14` | PASS |
| R2.2 | Envelope versioned forward (v3) | `decision-draft.ts` `SerializedDraft.version: 3` (`:231`), `serializeDraft` (`:395-412`), `doc.version !== 3` reject (`:334`). | client D5 (v3 round-trip), D6 (v2 rejects) | PASS |
| R2.2 | Export/restore bound to exact hash string + school + year | `restoreDraft` strict compares `doc.schoolId !== context.schoolId`, `schoolYearId`, and `draftHash !== context.sourceRevisionHash` (`:337-349`); `DraftPreviewPanel.tsx:107` passes exact hash/scope from payload. | client D6 (wrong school/year/mismatch/blank/wrong-type hash all throw) | PASS |
| R2.2 | Reject absent/null/blank/malformed/wrong-type/mismatched hash | `:343-349`: non-string or blank hash throws; mismatch throws; absent (undefined) throws via `typeof !== 'string'`. | client D6 | PASS |
| R2.2 | Reject unknown top-level, source-revision, term-draft, row fields | `assertOnlyKeys` with `ENVELOPE_KEYS`/`TERM_DRAFT_KEYS`/`ROW_KEYS`/group-key set (`:243-245, 288-297, 333, 354, 359, 367`). | client D6 (top-level `sneakyField`, term-draft `bogus`, row `rogue` all throw) | PASS |
| R2.2 | Reject duplicate JSON keys BEFORE `JSON.parse`, string values never treated as keys | `findFirstDuplicateJsonKey` (`:254-285`) runs in `restoreDraftText` (`:310-313`) before `JSON.parse`; per-object key stack; only a string token followed by `:` is a key. | client D6 (dup row + dup top-level throw); `no false duplicate on string values`; this reviewer's independent adversarial probe (below) | PASS |
| R2.2 | Validate numbers/strings/enums/rotation/term identities without coercion | `restoreDraft`: `schoolId`/`schoolYearId` strict `!==` (string `"1"` rejects); enums via `DRAFT_DECISIONS`/`DRAFT_CLASSIFICATIONS`/`DRAFT_TERM_MODES` includes; rotation fields typed as strings; no `Number()`/`String()` coercion on the restore/validation path. | client D6 (hostile decision value `AUTO_APPROVE` throws) | PASS |
| R2.2 | Apply restored state only after full validation; failure leaves UI unchanged + one actionable error | `restoreDraftText` throws before returning; `DraftPreviewPanel.tsx:101-113` calls `onRestore` only when `restoreDraftText` does not throw; on throw a single toast error is shown. `DecisionWorkspace.tsx:156-160` applies draft+term atomically. | client D5/D6; source inspection | PASS |
| R2.3 | 8 same-count negative-control classes | server `R7` (`:307-403`): #1 section name, #2 ownership faculty, #3 subject minutes, #4 term-config create + identity order, #5 requirement classification, #6 term-assignment replacement, #7 delete-and-recreate equal counts, #8 cross-school + cross-year. | server suite 59/59, each `hash !== h0` + mutant gate | PASS |
| R2.3 | Unknown/duplicate fields fail closed | client D6 + `findFirstDuplicateJsonKey`. | client 35/35 | PASS |
| R2.3 | Semantically identical reordered result hashes identically | `sortByKey` stable ordering; R7 stability assertion (`:321`). | server suite | PASS |
| R2.3 | No code-matched subject gains authority; mutant on count/timestamp fallback | `forbiddenCodeMatchRegression` negative fixture (`:104-109, 223-225`); R7 `#1` old-gate control; final authority assertion (`:438-440`). | server suite | PASS |
| R2.4 | Preserve bulk/preview/export/restore | `applyBulkDecision` (every row + `{applied,skipped}`) `decision-draft.ts:420-446`; `DraftPreviewPanel` preview via read-only `POST …/requirements/preview`, export/copy/download, restore; `DecisionWorkspace` bulk handler + toast both counts. | client D4/D5/D7 | PASS |
| R2.4 | Short source-revision identifier + explanation | `DecisionWorkspace.tsx:203-216` (`Source rev <8>` + tooltip); `DraftPreviewPanel.tsx:148-159` (`<8-char>…` + tooltip explaining invalidation). | source inspection | PASS |
| R2.4 | Desktop + 390px Tailnet read-only; `PENDING_DEPLOY` if watcher freshness unproven; no restart | Not independently reproducible in this read-only review. Ledger labels the rendered proof `PENDING_DEPLOY` (watcher may already serve corrected source; no restart). Consistent with prompt. | ledger record | PASS (PENDING_DEPLOY) |
| R2.4 | Before/after signatures identical (term/req/assignments/ownership/TL/runs/publication) | This reviewer's independent read-only census (below) matches the SCA-03D reference exactly. | census `1/22/20/88/265/0/0/0/0` | PASS |
| R2.5 | Ledger RED/GREEN; fresh advisory review; `REVIEW_REQUIRED`; reviewer cannot unlock SCA-04 | Ledger SCA-03E-R2 section records RED/GREEN evidence + commands + query shape; returns `REVIEW_REQUIRED`; this artifact is the advisory review; no SCA-04 unlock. | ledger; manifest LOCKED | PASS |

## Adversarial findings (this reviewer's own probes)

1. **Duplicate-key scanner (independent probe, temp file deleted).** Crafted cases:
   - `{"a":1,"b":2,"a":3}` → detected (`a`). ✓
   - `{"termDraft":{"identitiesText":"Q1: Core: G7:REGULAR:DW_MATH"},"rows":{}}` → **not flagged** (string value with key-looking colon text is correctly immune). ✓ (the required adversarial bypass)
   - `{"x":"a:b:c:","y":1}` → not flagged (value string ending in colon then `,`). ✓
   - `{"rows":{"k":{"decision":"CONFIRMED","note":"has { and } braces"},"k":{"decision":"REJECTED"}}}` → detected (`k`) — braces inside string values do not confuse the scanner. ✓
   - `{"a" : 1}` → not flagged (whitespace before colon fine). ✓
   - `{"list":["x:y","z"],"k":1}` → not flagged (array string values immune). ✓
   - **O1 (informational, zero-fix required):** `{"a":1,"\\u0061":2}` (escape-obfuscated duplicate) → **not flagged**, because the scanner compares raw escape forms and `JSON.parse` collapses `\u0061` to `a` (last-wins) silently. **Not a material defect:** `restoreDraft` validates the *parsed* (collapsed) object, so an escape-obfuscated duplicate collapses to a single key whose single value is then type/enum/unknown-field validated normally; it cannot bypass `assertOnlyKeys`, type checks, or the hash gate, and cannot grant authority. The stated R2.2 requirement (reject duplicate keys before `JSON.parse` without treating key-looking text in strings as fields) is fully met for all raw-identical duplicates and all string-content cases. Optional hardening: decode JSON escape sequences before comparison — not required for this prompt.

2. **Hash gate rejects a same-count-mutated old draft.** Reran server R7 in the full suite: every mutation class flips the hash while counts stay equal, and the `#1` mutant control proves the old count/max-timestamp gate is unchanged so the suite fails if it regresses to count/timestamp equality. PASS.

3. **No code-matched subject gains authority.** R7 final assertion + `forbiddenCodeMatchRegression` negative fixture hold across all mutations. PASS.

## Commands run (this reviewer, with exit codes + timestamps, local time +08:00)

| Command | Result | Timestamp |
|---|---|---|
| `git -C D:/ATLAS diff --check` | exit 0 (clean; only CRLF warnings on concurrent-stream files) | 2026-09-09 ~00:26 |
| `git -C D:/ATLAS status --short`, `git log --oneline -3` | HEAD `f4ec1e76`; dirty worktree matches concurrent-stream ledger | 2026-09-09 ~00:26 |
| `certutil -hashfile <prompt>` / `<manifest>` | prompt `DA17ADF5…FE9B`, manifest `A0EAFFAB…03` (both MATCH) | 2026-09-09 ~00:26 |
| `npx tsc --noEmit` (atlas-client) | exit 0 | 2026-09-09 |
| `npx tsc --noEmit` (atlas-server) | exit 0 | 2026-09-09 |
| `npx tsx src/lib/__tests__/decision-draft.test.ts` (atlas-client) | **35 passed / 0 failed**, exit 0 | 2026-09-09T00:26:59 |
| `npx tsx --env-file=.env src/__tests__/curriculum-decision-candidates.test.ts` (atlas-server) | **59 passed / 0 failed**, exit 0, zero residue; query-shape 8 queries / 14 groups | 2026-09-09T00:27:26 |
| Duplicate-scanner adversarial probe (temp file, deleted) | exit 0; results above | 2026-09-09 ~00:28 |
| Read-only live census (temp file, deleted) | exit 0; `1/22/20/88/265/0/0/0/0`, subject max `2026-09-06T15:34:50.103Z` — identical to SCA-03D reference | 2026-09-09T00:30:45 |

## Findings classification

- **Product/runtime:** none material. All code paths verified; hash gate, strict
  fail-closed restore, batched reads, and no-code-authority all hold on
  independently rerun evidence.
- **Safety-gate:** none. SCA-04 remains LOCKED; `authorizesNoMutation: true`;
  no apply/term/Teaching Load/generation/publication/schema/restart/external
  mutation performed by this review or evidenced by the executor.
- **Process/documentation:** O1 (informational, escape-obfuscated duplicate-key
  scanner gap) — zero-fix required; optional hardening only, no reachable
  bypass. Verification-limitation note on forbidden-file non-edit proof is
  recorded above (evidence-based, consistent, not a finding).

## Verdict

`zeroFix: true` — no material product, safety-gate, or process finding requires
a fix before advisory closure; every mandated control maps to a live code site
and an independently rerun gate, live data is byte-identical to reference, and
SCA-04 stays LOCKED. Advisory only: no formal GO, no SCA-04 unlock.
