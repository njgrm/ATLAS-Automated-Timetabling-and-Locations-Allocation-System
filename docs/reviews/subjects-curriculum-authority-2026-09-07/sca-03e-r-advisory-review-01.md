# Advisory Review — SCA-03E-R Authority Closure (Prompt/Manifest Pins Verified)

Reviewer: independent advisory reviewer (fresh context, did NOT implement SCA-03E-R)
REVIEWER_SPAWN_ID: ses_f7e4cb1e7ffeU8aix81K8kMtPG
Date: 2026-09-08

## Pins verified (computed by this reviewer)

- Prompt `D:/ATLAS/docs/prompts/subjects-curriculum-authority-03e-r-authority-closure-2026-09-08.md`
  SHA-256 = `011055A61DC953C46F26AB44640735467725C0838D6FECE29FBAF18E23659F2A`
  → equals manifest `promptSha256` (`011055A6…9F2A`). MATCH.
- Manifest `D:/ATLAS/docs/verification/sca-03e-r-authority-closure-planner-manifest-2026-09-08.json`
  SHA-256 = `4DDF20587C378CE4EE9E992410746E4518115913E67CA5C5A03E3A6353F978BD`
  → equals `.sha256` sidecar (`4DDF2058…8BD`). MATCH.
- Manifest asserts `authorizesNoMutation: true`; `successor.promptId = SCA-04`,
  `status = LOCKED`; forbidden list includes apply, term write, Teaching Load
  mutation, generation, publication, schema/migration, port-5001 restart,
  external-repo edit. This review honored all: no writes other than this artifact.

## Reviewer context note

Execution-system context identifier: NONE_EXPOSED (no orchestrator/thread/agent
ID was surfaced to this reviewer session). The parent relayed the captured
reviewer spawn ID verbatim: `ses_f7e4cb1e7ffeU8aix81K8kMtPG`; it is recorded
verbatim (no aliases) in header line 3 of this artifact and repeated here near
the top of the body. This is advisory evidence only and does not, by itself,
satisfy formal planner/QA independence requirements; formal review identity must
be established by the planner/orchestrator outside the executor's trust boundary.

## Changed-file inventory reviewed

Executor's SCA-03E-R scope (all read in full):

1. `atlas-server/src/services/curriculum-decision-candidates.service.ts` (read, grep)
2. `atlas-client/src/lib/decision-draft.ts` (read)
3. `atlas-client/src/pages/DecisionWorkspace.tsx` (read)
4. `atlas-client/src/components/decision-workspace/CandidateRow.tsx` (read)
5. `atlas-client/src/components/decision-workspace/CandidateTable.tsx` (read)
6. `atlas-client/src/components/decision-workspace/DraftPreviewPanel.tsx` (read)
7. `atlas-server/src/__tests__/curriculum-decision-candidates.test.ts` (read, ran)
8. `atlas-client/src/lib/__tests__/decision-draft.test.ts` (read, ran)
9. `docs/progress/subjects-curriculum-authority-2026-09-07-progress.md` SCA-03E-R rows (read)

Out-of-scope carryover inspected but NOT changed by this pass (corroborated as
pre-existing by the sca-02 advisory review artifact, which lists
`CurriculumRequirements.tsx` and `App.tsx` route-only wiring as earlier SCA work):
`atlas-server/src/routes/curriculum-requirements.router.ts` (still calls
`getDecisionCandidates(actorSchoolId, schoolYearId)` with unchanged signature),
`atlas-client/src/App.tsx` (lazy route to `subjects/decision-workspace` only),
`atlas-client/src/pages/CurriculumRequirements.tsx` (still carries the legacy
`/terms` PUT + `/requirements/apply` POST surface from SCA-03E — pre-existing,
out of the SCA-03E-R edit boundary, and SCA-04 stays locked so apply is not
unlocked by this pass).

## Requirement-to-enforcement matrix

| SCA-03E-R requirement | Production call site | Command / assertion proving it | Negative-control note |
|---|---|---|---|
| R.1 remove code-owned decisions (no `ESTABLISHED_SPECIALIZATION_DECISIONS`, no pre-resolve/lock/classify from code) | `curriculum-decision-candidates.service.ts` — full rewrite: groups reconstructed mechanically from `subject`/`sectionMirror`/`subjectSectionOwnership`/`getTermConfig`/`schoolYearOffering.count`; every group hard-codes `decisionStatus: 'UNAPPROVED_SUGGESTION'`, `termModeStatus: 'UNAPPROVED_SUGGESTION'`, `unresolvedFields` populated, ownership `evidenceStatus: 'SUGGESTION_ONLY'`; result type ships no `preResolved`/`establishedDecisions`/`unmatchedEstablishedDecisions`; `counts = { total, unresolved }` with unresolved == total. | repo-wide grep for `ESTABLISHED_SPECIALIZATION_DECISIONS\|PRE_RESOLVED_SPECIALIZATION\|preResolved\|establishedDecisions\|unmatchedEstablishedDecisions` → **zero matches**. Server test R2: 9/9 OK, incl. `counts.preResolved === undefined`, `!('establishedDecisions' in result)`, `activeRequirementCount === 0`, every group (incl. AP/ROB/Research codes) `UNAPPROVED_SUGGESTION`. | `forbiddenCodeMatchRegression` (server test L104-109, asserted L223-225): would fail if any code-matched group carried `decisionStatus === 'PRE_RESOLVED_SPECIALIZATION'` again. Confirmed passing now; the assertion fails closed on regression. |
| R.2 prior operator choices only via explicit, validated, visible draft restore | `decision-draft.ts` `restoreDraftText`/`restoreDraft` (schema/format/version + school/year/source-revision + row/unknown-enum/duplicate-key validation, fail-closed, client-side, zero writes); wired in `DraftPreviewPanel.handleRestoreFile` (L101-113) → `onRestore` (page `setDraft`/`setTerm` only, toast "nothing persisted"). Restored state stays a draft; no terms/requirements written; SCA-04 not unlocked. | Client test D5 (11 OK: v2 envelope binds school+year+source revision; six operator choices reproduced with zero server constant / zero DB write) and D6 (8 fail-closed cases). | A hostile/duplicate/stale draft throws and applies nothing (assert.throws cases pass). |
| R.2 bulk actions skip no rows silently, report applied/skipped | `decision-draft.ts` `applyBulkDecision` returns `{ applied, skipped }`; `DecisionWorkspace.handleBulk` (L140-153) toasts both counts (error toast when skipped>0). Applies to every selected row — no code-lock skip. | Client test D4 (bulk rejects ALL selected incl. AP code row; partial action reports the unknown row in `skipped`). | If a code-lock skip returned, `applied.length === groups.length` fails. |
| R.2 no apply/term PUT dispatched by preview/export/restore | Workspace only `atlasApi.get(.../decision-candidates)` and `atlasApi.post(.../requirements/preview)` (read-only preview). `DraftPreviewPanel` export/restore are pure client (`serializeDraft`/`restoreDraftText`, no transport). | Grep of `decision-workspace/**` + `DecisionWorkspace.tsx` for `/apply\|\.put(\|PUT` → matches are comments and preview-result fields only; no dispatch. Client test D7 (compile output carries no `/apply`; serialized draft has no PUT verb). | If preview/export/restore dispatched apply/PUT, D7 or the grep would surface it. |
| R.3 item 1 — AP/ROB/Research get no status from codes alone | service mechanical pass + `DecisionWorkspace` default `UNDECIDED`/unclassified | Server test R2 L216-225; client D1 (special codes default `UNDECIDED`). | `forbiddenCodeMatchRegression` negative control. |
| R.3 item 2 — same codes under another school/year inherit no decision | service scoped by `schoolId`/`schoolYearId`, no cross-school cache | Server test R5 (SCHOOL_B fixture, 3 OK: all unapproved, `total === unresolved`). | — |
| R.3 item 3 — zero persisted requirements → zero pre-approved/locked | `counts.unresolved === counts.total`, no persisted read of decisions | Server test R2 (3 OK) + `activeRequirementCount === 0`. | — |
| R.3 item 4 — ownership stays SUGGESTION_ONLY, never curriculum authority | `currentOwnershipEvidence.evidenceStatus: 'SUGGESTION_ONLY'` on every group; type alias has no other value | Server test R3 (5 OK incl. every-group assertion); route payload assertion L298. | — |
| R.3 item 5 — third/fourth specialization representable | service places no upper bound on specialization subjects (mechanical subject×scope pair loop) | Server test R4 (`DW_ASTRONOMY` + `DW_ASTROBIOLOGY` reconstruct unapproved; set shrinks after delete). | — |
| R.3 item 6 — explicit draft restore reproduces the six choices, no server constant / DB write | `restoreDraft`/`restoreDraftText` on the current candidate set | Client test D5 (six choices reproduced: Research G7/8/9 CONFIRMED SPECIALIZATION, AP G10 + Robotics CONFIRMED, Silver Research REJECTED; 5 offerings compile). Server test R6 zero-write signature (`sigBefore === sigAfter`). | — |
| R.3 item 7 — wrong school/year, stale revision, malformed, unknown row, duplicate row, partial bulk fail closed | `restoreDraft`/`restoreDraftText` fail-closed branches | Client test D6 (8 assert.throws) + D4 partial-bulk report. | — |
| R.3 item 8 — no apply/term PUT by preview/export/restore | see R.2 no-dispatch row | Client D7 + grep. | — |
| R.3 negative control | `forbiddenCodeMatchRegression` | Server test L223-225 OK (43/43). | Would fail on regression. |

## Commands actually run (exit codes + timestamps)

| Command | Exit | Result | Timestamp |
|---|---|---|---|
| `git -C D:/ATLAS rev-parse HEAD` | 0 | `f4ec1e76b4805d9333ce0827692fa1e6086ea77` | 23:44 |
| `Get-FileHash` (prompt) | 0 | `011055A6…9F2A` | 23:44 |
| `Get-FileHash` (manifest) | 0 | `4DDF2058…8BD` (== sidecar) | 23:44 |
| `git -C D:/ATLAS status --porcelain` | 0 | pre-existing dirty inventory + untracked SCA-03E files; no stashes/commits | 23:44 |
| `npx tsc --noEmit` (atlas-server) | 0 | clean | 23:46 |
| `npx tsc --noEmit` (atlas-client) | 0 | clean | 23:47 |
| `npx tsx src/lib/__tests__/decision-draft.test.ts` (atlas-client) | 0 | 32 passed / 0 failed | 23:47 |
| `npx tsx --env-file=.env src/__tests__/curriculum-decision-candidates.test.ts` (atlas-server) | 0 | 43 passed / 0 failed; residue 0 (self-asserted) | 23:49 |
| `git -C D:/ATLAS diff --check` | **2** | `docs/progress/subjects-curriculum-authority-2026-09-07-progress.md:1339: new blank line at EOF` | 23:46 |
| read-only residue probe (PrismaClient on 99960/99961) | 0 | `{"schools":[],"subjects":0,"ownership":0,"termConfigs":0,"offerings":0}` | 23:51 |
| port-5001 listener inspection | 0 | PID 36168 = `tsx watch` **child** (`--require tsx/preflight.cjs --import loader src/server.ts`), parent PID 8476 `tsx watch src/server.ts` created 11:14 AM → auto-respawn, not a manual restart | 23:48 |
| grep forbidden authority tokens repo-wide | 0 | zero matches | 23:52 |
| grep `decision-draft`/`DecisionWorkspace` import sites | 0 | confined to in-scope files + pre-existing App.tsx lazy route | 23:52 |

No source, test, schema, migration, auth, `.env`, companion-repo, or runtime
file was modified by this reviewer. The only write performed was this artifact.

## Findings

### Product / runtime
- None. No code-owned operator/curriculum decisions remain; every
  reconstructed group is `UNAPPROVED_SUGGESTION` with `SUGGESTION_ONLY`
  ownership; zero persisted requirements yields zero pre-approved/locked
  candidates; restore is explicit, validated, non-persisting, and bulk actions
  report applied/skipped. Both suites pass independently (43/43, 32/32).

### Safety-gate
- None. No mutation gate was crossed: no apply, no term PUT, no Teaching Load,
  generation, publication, schema, or migration action was run by this pass or
  by me. Test fixtures (disposable schools 99960/99961) are fully cleaned up
  (independently verified residue 0). Port 5001 was not manually restarted: the
  current listener is a `tsx watch` child that auto-respawned on source edits;
  this is a watcher artifact, not a manifest-forbidden restart. SCA-04 remains
  LOCKED in the manifest and in the ledger.

### Process / documentation
- **Finding P-1 (fix required):** `git diff --check` exits **2**, not 0:
  `docs/progress/…progress.md:1339: new blank line at EOF`. The diff shows the
  trailing blank line is inside the SCA-03E-R appended hunk (this pass's own
  ledger write), yet the ledger claims (L1286) "`git diff --check` clean
  (exit 0)". Fix requirement: remove the trailing blank line at EOF of the
  progress ledger, rerun `git diff --check` to an actual exit 0, and correct the
  gate record in the ledger (also in the 03E-R.4 task-log evidence row). This is
  cosmetic whitespace in a doc file but it is a false gate claim on this pass's
  own output and must be corrected before the ledger can report all focused
  gates green.
- **Finding P-2 (informational, no source fix):** The ledger's runtime-freshness
  statement ("port-5001 serves PID 21944… STALE relative to this correction…
  PENDING_DEPLOY") is outdated as observed at review time: the `tsx watch` child
  on port 5001 respawned at 23:45:12, after the last SCA-03E-R production source
  write (23:43:33). The current backend runtime may therefore reflect the
  corrected source; the `PENDING_DEPLOY` label should be treated as stale for
  the backend. This does not weaken source acceptance and requires no code fix.

## Changed-scope re-review (2026-09-08, post-fix)

- P-1 was fixed: the trailing blank line at EOF of the progress ledger was
  removed. Independently rerun `git -C D:/ATLAS diff --check` → **exit 0**
  (previously exit 2). The ledger now ends at line 1338 with intact SCA-03E-R
  content; only the ledger whitespace changed since the initial review (all 8
  code/test files retain their original LastWriteTime and diff identity, so the
  prior 43/43 server and 32/32 client results are reused unchanged).
- No product, safety-gate, or boundary finding remains open. P-2 remains
  informational only (no fix required).

## Verdict

`zeroFix: true` — the sole material finding (P-1, `git diff --check` trailing
blank line) is fixed and independently confirmed at exit 0, leaving zero
material findings; reviewer spawn ID `ses_f7e4cb1e7ffeU8aix81K8kMtPG` relayed
verbatim. All product and safety-gate checks pass; no code-owned authority
remains; SCA-04 stays LOCKED.