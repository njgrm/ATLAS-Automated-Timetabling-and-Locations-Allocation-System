# Advisory Review 02 (Changed Scope) — PUB-C01R Publication Authority Correction

- **Review artifact:** `docs/reviews/publication-pubc01-2026-09-10/advisory-review-pubc01r-02-changed-scope.md`
- **Reviewer context ID:** `REVIEW_BLOCKED`
  - No verifiable execution-system session/context identifier was exposed to this reviewer or relayed by the spawner. Environment inspection returned only `OPENCODE_CLIENT=desktop` (a client label), `OPENCODE_SERVER_PASSWORD` (a secret, not an identity), and `SESSIONNAME=Console` (an OS terminal session name). None is a verifiable agent/session/context identifier. Per `AGENTS.md` (Reviewer Identity, Advisory Evidence, And Session Boundaries) this artifact therefore records `REVIEW_BLOCKED` for identity and is **advisory evidence only**. It must not be counted as a formal independent review, must not unlock any successor, and does not authorize any mutation.
- **Worktree:** `D:\ATLAS-worktrees\publication-pubc01` (branch `work/publication-pubc01`)
- **Base commit:** `63a7935407c6aee2c54a70c667372192a4ff63ee`
- **Prior review:** `advisory-review-pubc01r-01.md` (same worktree, same base commit)
- **Review type:** CHANGED-SCOPE review after the P-1/P-2/P-3 fixes. The reviewer did not implement the work and did not perform the prior review.
- **Scope constraints honored:** no live DB, server, publish, generation, or companion-repo action was performed. No source file was modified. Only this artifact was written.

---

## 1. Reviewed Scope

The prior review found zero product/runtime defects and zero safety-gate defects, plus three process findings. This changed-scope review verifies only the fixes for those three findings and confirms no semantic regression to the five PUB-C01R defects.

| Finding | Required fix | Verified state |
|---------|--------------|----------------|
| P-1 | Delete scratch probe `atlas-server/src/__tests__/_advisory_pubc01r_probe.ts` before staging | **FIXED** — probe absent from `git status --porcelain` and from a `_advisory*` glob of `atlas-server/src/__tests__` |
| P-2 | Restore tab indentation at `published-revision.service.ts` `throw err(409, 'PUBLISHED_REVISION_TERM_CONTRACT_INVALID', ...)` and `generation.router.ts` `const result = await genService.publishRun(...)` | **FIXED** — both lines carry leading tabs matching surrounding lines (service:301 = 3 tabs; router:163 = 3 tabs) |
| P-3 | Wire `published-revision-client.test.ts` into a client npm script | **FIXED** — `atlas-client/package.json` adds `"test:published-revision": "tsx --test src/lib/__tests__/published-revision-client.test.ts"` (exactly one inserted line, no other change) |

### "Only functional change since prior review" determination

The prior-review snapshot was uncommitted, so a byte-exact delta against it is not directly obtainable. Evidence that the only functional change since the prior review is the added npm script:

1. `git diff --stat -- atlas-client/package.json` = `1 file changed, 1 insertion(+)` — the sole package.json change is the new script.
2. The current diff is against the **same base commit** (`63a79354`) the prior review used, and the prior review's requirement-to-enforcement matrix line anchors (defect 1: service 76–80/215/282–415/488–503; defect 2: 330–332; defect 3: 315–328/435; defect 4: 333–338; defect 5: router 163–177) match the current file contents exactly. No new functional hunk appears beyond the previously reviewed PUB-C01R work.
3. P-1 and P-2 are removals/whitespace only and introduce no behavior change (tsc and both decisive tests pass unchanged).

---

## 2. Commands Rerun (with results)

| # | Command (workdir) | Result |
|---|-------------------|--------|
| 1 | `git -C D:\ATLAS-worktrees\publication-pubc01 status --porcelain` | 11 modified + 3 untracked; **no `_advisory_pubc01r_probe.ts`**. Untracked = `published-revision-client.ts`, `published-revision-client.test.ts`, `docs/reviews/publication-pubc01-2026-09-10/` |
| 2 | `git -C D:\ATLAS-worktrees\publication-pubc01 ls-files --others --exclude-standard` | Confirms the three untracked paths above; probe absent |
| 3 | `Get-ChildItem atlas-server/src/__tests__ -Filter "_advisory*"` | No output — probe deleted |
| 4 | `git -C D:\ATLAS-worktrees\publication-pubc01 diff -- atlas-server/src/services/published-revision.service.ts atlas-server/src/routes/generation.router.ts atlas-client/package.json` | Diff shows the previously reviewed PUB-C01R work + the single added npm script; no new functional change |
| 5 | Raw tab inspection of `published-revision.service.ts:298-302` | `299: <TAB><TAB>if (...)`, `300: <TAB><TAB><TAB>|| ...`, `301: <TAB><TAB><TAB>throw err(409, 'PUBLISHED_REVISION_TERM_CONTRACT_INVALID', ...)`, `302: <TAB><TAB>}` — tab style restored |
| 6 | Raw tab inspection of `generation.router.ts:160-166` | `163: <TAB><TAB><TAB>const result = await genService.publishRun(...)` — tab style restored |
| 7 | `npx tsx src/__tests__/publication-contract-readiness.test.ts` (`atlas-server`) | **PASS** — "publication contract readiness: all checks passed" (DATABASE_URL warning expected; hermetic fixtures) |
| 8 | `npm run test:published-revision` (`atlas-client`) | **PASS** — 4 pass / 0 fail / 0 skipped (the new script itself resolves and runs the test) |
| 9 | `npx tsc --noEmit` (`atlas-server`) | **PASS** — EXIT=0, no output |
| 10 | `npx tsc --noEmit` (`atlas-client`) | **PASS** — EXIT=0, no output |
| 11 | `git -C D:\ATLAS-worktrees\publication-pubc01 diff --check` | **PASS** — EXIT=0; only LF→CRLF advisory warnings, no whitespace errors |

---

## 3. Adversarial Spot-Check — Five PUB-C01R Defects Remain Enforced

Production paths re-inspected after the fixes (no live execution):

| # | Defect | Enforcement point (current) | Status |
|---|--------|-----------------------------|--------|
| 1 | Exact published-source truth (strict `isPublished === true`; stale `publishedAt`/`publishedBy` never publish) | `published-revision.service.ts:76-80` — `isPublishedSummary` returns `asSummaryRecord(summary).isPublished === true` only; consumed by `resolveAuthoritativeLatestRevision` (:207-243) used by both write (:304) and read (:497) paths | **ENFORCED** |
| 2 | Real revision-client source token (typed `SOURCE_REVISION_STALE`, never silent retry/substitute) | Server write `:330-332` throws `409 SOURCE_REVISION_STALE` with `expectedSourceRevisionId`; read contract `resolveLatestPublishedSourceRevision` `:488-503`; client `published-revision-client.ts` `parseLatestRevisionToken`/`SourceRevisionStaleError`/`isSourceRevisionStaleError` | **ENFORCED** |
| 3 | Replay-before-staleness (idempotent retry returns committed record; no duplicate write/notification) | Replay lookup `:315-328` (actor binding `:319-321`, audit integrity `:322-326`, returns `replayed:true`) executes **before** source-token check `:330-332` and previous-value check `:363-368`; notification suppressed on replay `:435`; guarded by `pg_advisory_xact_lock` `:283` + `Serializable` `:415` | **ENFORCED** |
| 4 | Causal effective-date order (`REVISION_EFFECTIVE_DATE_BEFORE_SOURCE`) | `:333-338` — `sourceEffectiveDate = resolved.latestRevision?.effectiveDate ?? resolved.baseRevision.effectiveDate`; `effectiveDate < sourceEffectiveDate` → typed 409 with details | **ENFORCED** |
| 5 | Publish outcome transparency (envelope + `FAILED_AFTER_COMMIT`) | `generation.router.ts:163-177` returns `{ run: result.run, publication: { revisionId, auditId, replayed, notificationDelivery } }`; `published-revision.service.ts:434-457` sets `FAILED_AFTER_COMMIT` on post-commit notification throw; `publication-contract.service.ts:390` same handling | **ENFORCED** |

The decisive server gate (`publication-contract-readiness.test.ts`) passed and includes negative fixtures for all five defects (`PUBLISHED_SOURCE_REQUIRED` for stale markers, `SOURCE_REVISION_STALE` for missing/stale tokens, replay ordering, `REVISION_EFFECTIVE_DATE_BEFORE_SOURCE`, and the publish envelope / `FAILED_AFTER_COMMIT`).

---

## 4. Findings

### Product / runtime defects
- **None.** All five PUB-C01R controls remain wired to real production entry points and are unchanged by the fixes. No semantic regression introduced by P-1/P-2/P-3.

### Safety-gate defects
- **None.** No authority, mutation, or live-data boundary was touched. Publication remains a separately fingerprinted `HIGH` action outside this pass.

### Process / documentation inconsistencies
- **None remaining.** P-1, P-2, and P-3 from the prior review are all resolved and independently verified. (Informational, non-defect, carried forward from review 01: revision *creation* concurrency for two simultaneous identical POSTs is not exercised by a test fixture; production serializes via `pg_advisory_xact_lock` + `Serializable`. Not blocking and unchanged by this scope.)

### Required fixes
- **None.**

---

## 5. Verdict

- **zeroFix: true** — no findings in the changed scope; all three prior process fixes verified; no product/runtime or safety-gate defect.
- **Verdict: ACCEPT** (content) with **reviewer identity `REVIEW_BLOCKED`** (authority).
- **Identity caveat:** Because no verifiable execution-system context ID was available, this artifact is advisory evidence only. It does not satisfy a formal prompt/phase review, does not unlock a successor, and does not authorize commit, integration, push, database/schema apply, generation, or publication. Formal acceptance still requires a SHA-256-pinned, orchestrator-issued review receipt with a verifiable reviewer ID.
