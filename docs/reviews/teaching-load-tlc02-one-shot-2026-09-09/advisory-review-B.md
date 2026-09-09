# Advisory Review B — TL-C02 Teaching Load Reconciliation

- **Reviewer identity:** `REVIEWER_B_ADVISORY` (harness exposed no distinct agent/thread identifier for this reviewer lane; model context `opencode-go/deepseek-v4-flash`). Per the review instructions this is the recorded fallback handle.
- **Role:** Independent advisory reviewer (Reviewer B lane). Non-authoritative — cannot approve, mutate, unlock, or authorize any apply. **No source file was modified during this review.**
- **Reviewed worktree:** `D:\ATLAS-worktrees\teaching-load-tlc02`
- **Reviewed diff identity:** Working-tree changes vs base `HEAD 330fb91b7daa28299520272b1e258cc49395af04` on branch `work/teaching-load-tlc02`. Changes are **not yet committed** (candidate commit pending). `git status --porcelain` shows only `atlas-client/…` and `atlas-server/…` paths — no `D:\EnrollPro`, `D:\AIMS`, or `D:\smart-final-capstone` path appears anywhere in the diff.
- **Files inspected (in scope):**
  - `atlas-client/src/pages/TeachingLoad.tsx` (modified)
  - `atlas-client/src/components/faculty-assignments/TeachingLoadReconciliationPanel.tsx` (new)
  - `atlas-client/src/lib/teaching-load-reconciliation-helpers.ts` (new)
  - `atlas-client/src/types.ts` (modified — reconciliation types)
  - `atlas-client/src/lib/__tests__/teaching-load-reconciliation-ui.test.ts` (new)
  - `atlas-server/src/routes/faculty-assignment.router.ts` (modified — readiness/preview/apply routes)
  - `atlas-server/src/services/teaching-load-reconciliation.service.ts` (new)
  - `atlas-server/src/services/faculty-assignment.service.ts` (modified — HG exclusion in summary/effective path)
  - Supporting context: `atlas-server/src/__tests__/teaching-load-reconciliation.test.ts`, `src/middleware/authenticate.ts`, `src/middleware/authorize.ts`, `src/services/local-auth.service.ts`, `src/ui/button-variants.ts`, `src/hooks/useTeachingLoadData.ts`, `docs/progress/teaching-load-tlc02-one-shot-2026-09-09-progress.md`
- **Review date:** 2026-09-09

## Commands run (read-only, current session) — recorded results

| Command | CWD | Exit | Result |
|---------|-----|------|--------|
| `npx tsc --noEmit` | `atlas-client` | 0 | PASS, no diagnostics |
| `npx tsx --test src/lib/__tests__/teaching-load-reconciliation-ui.test.ts` | `atlas-client` | 0 | PASS — 5/5 tests passed (0 fail, 0 skip) |
| `npx tsc --noEmit` | `atlas-server` | 0 | PASS, no diagnostics (router + new service compile) |
| `git status --porcelain` + `git diff --name-only` + `git diff --stat HEAD` | worktree root | 0 | Confirms only ATLAS repo files changed; no external repository touched |

Server ESM-safety: new service imports carry explicit `.js` endings (`'../lib/data-context.js'`, `'../services/faculty-assignment.service.js'`, `'./hg-advisory.service.js'`), and the router imports the new service with a `.js` ending — consistent with the Server Runtime Safety Rule.

---

## Area-by-area verification (against the 7 review points)

### 1. Real UI → route → canonical-service wiring (CONFIRMED)
- Readiness chip: `TeachingLoad.tsx:86` → `GET /faculty-assignments/reconciliation/readiness` (params `schoolId`, `schoolYearId`); route `faculty-assignment.router.ts:115-126` → `getTeachingLoadReconciliationReadiness` (service `:1784`). Re-fetched when `schoolId`/`activeSchoolYearId` change (`TeachingLoad.tsx:81-101`).
- Reconcile button → preview: `TeachingLoad.tsx:782-793` (`data-testid="teaching-load-open-reconciliation"`) opens the panel; panel Preview button (`Panel:174-183`, `data-testid="teaching-load-reconciliation-preview"`) → `POST /faculty-assignments/reconciliation/preview` (`Panel:85`) → `previewTeachingLoadReconciliation` (service `:1379`) → `buildReconciliationPlan` (service `:717`).
- **Exactly ONE primary reconciliation apply control:** grep across the client confirms a single `POST /faculty-assignments/reconciliation/apply` call site (`Panel:121`), gated by the single destructive Apply button `data-testid="teaching-load-reconciliation-apply"` (`Panel:365-375`). The `ReconciliationDialog` in `SchedulingPolicyPane.tsx:187` is a **different** feature (scheduling-policy bound reconciliation) and is not a teaching-load apply control. Confirmed.
- Auth wiring verified end-to-end: local-auth JWTs carry `schoolId` (`local-auth.service.ts` `LocalAuthUser` at `:24-29`, token signs the whole user at `:96-100`), so `actorSchoolIdOf(req)` (router `:33-36`) returns the operator school for the JWT-protected preview/apply routes; `authenticateWithSystemToken` on readiness also accepts the operator JWT and `requirePrivilegedRole` accepts `admin`/`officer`/`SYSTEM_ADMIN` (`authorize.ts:3`). School-scope conflict is enforced (`rejectSchoolScopeConflict`, router `:38-45`; service `assertActorScope` `:1502-1509`).

### 2. Workload language / filters (CONFIRMED)
- "No teaching load" includes every active, non-stale, non-placeholder faculty with zero teaching minutes (`computeWorkloadDistribution`, service `:526-553`).
- "Adviser only" is a strict subset: `adviserOnly` is incremented only inside the `zero-load` branch and only when the member is a class adviser of an active advised section (`:544-546`).
- Actual teaching vs credited workload distinct: distribution block is explicitly labeled "actual teaching only" (`Panel:231`); advisory credit is never added into teaching minutes (service doc `:14-16`), and statuses derive from teaching minutes only (`workloadStatusOf` `:515-524`).
- Remaining capacity never negative: the panel renders no raw remaining-capacity figure; `formatTeachingMinutes` (`helpers:26-29`) and all status math emit only non-negative values; candidate selection gates on hard cap and never below zero (`pickCandidate` `:663-692`).
- Positive "Excess teaching" above standard: `workloadStatusOf` returns `excess` only when `minutes > teachingStandardMinutes` (`:521`), labeled "Excess teaching" (`helpers:41`).
- Department/status/load filters on the page are pre-existing and unaffected; panel summary derives purely from preview data (`deriveReconciliationSummaries`, `helpers:50-88`).

### 3. Adviser preference explanation (CONFIRMED)
- Panel Accordion "Adviser-own-section preference (… satisfied / … not satisfied)" (`Panel:301-324`) enumerates every outcome: satisfied shows a green check and "has one demanded subject in the advisory section"; unsatisfied shows an amber shield plus the **typed reason text** (`outcome.reason`), e.g. `ADVISER_NOT_QUALIFIED_FOR_DEMANDED_SUBJECTS`, `CAPACITY_OR_RANKING`, `ALL_SECTION_PAIRS_ALREADY_OWNED` (service `:1003-1033`).
- Per-action `adviserPreferenceApplied` is also surfaced in the change list (`Panel:275-277`).

### 4. Older-scheduler usability and apply safety (CONFIRMED, with informational notes P-2/P-3)
- One clear workflow: readiness chip → "Preview reconciliation" → summary cards (RETAIN/INSERT/MOVE/RETIRE/UNRESOLVED counts, before/after distribution) → "Every proposed change" list → "Per-teacher workload" → adviser outcomes → exact-phrase confirmation + fingerprint → single Apply. Nothing is applied without the exact confirmation; the disabled-reason is surfaced as the Apply button label (`Panel:374`).
- Apply requires the exact confirmation phrase (`reconciliationApplyDisabledReason`, `helpers:90-106`) **and** the preview fingerprint + source revision (`Panel:124-126`). The server re-reads every source revision and recomputes the canonical revision and fingerprint **inside** one `Serializable` transaction, aborting with typed 409s (`SOURCE_DRIFT`/`FINGERPRINT_MISMATCH`/`TRANSACTION_CONFLICT`) and zero partial writes, with idempotent replay and an audit event (`service:1698-1768`). This is the strongest part of the implementation.
- Stale preview is rejected visibly: on a 409 the panel sets a visible error banner (`data-testid="teaching-load-reconciliation-error"`) with "Re-run the preview to get a fresh plan." plus a toast (`Panel:131-137`). The banner is at the top of the sheet; see P-3 for the retained-stale-state nuance.

### 5. Mobile / keyboard / a11y / overflow / native-select / mojibake (PARTIAL — finding P-1)
- Keyboard accessibility: Radix primitives only — `Sheet` (focus trap + Escape), `Accordion`, `Button`, `Input` bound to `Label htmlFor="tl-recon-confirmation"`, `Tooltip`, `ScrollArea`. No raw native `<select>` anywhere in the new code. Confirmed.
- No global horizontal overflow: page root `overflow-hidden` + `flex-1 min-h-0` scroll containers; the toolbar strip uses `flex flex-wrap` (`TeachingLoad.tsx:772`); the sheet is `w-full sm:max-w-lg overflow-hidden` with `ScrollArea flex-1 min-h-0`; per-faculty rows use `truncate` + `shrink-0`; fingerprint uses `break-all`. Safe at desktop and 390px. Confirmed by inspection.
- No mojibake: all new UI strings are ASCII English (the `…` ellipses are valid UTF-8). Confirmed.
- **44px touch targets NOT met** — see finding P-1.

### 6. Readiness semantics — POPULATED cycle alone is insufficient (CONFIRMED)
- `getTeachingLoadReconciliationReadiness` (service `:1784-1828`) derives everything from the demand/plan snapshot and **never consults cycle state**. `ready` is true only when blockers are empty: term config present, demand non-empty, zero `UNRESOLVED` (blocker `TL_UNRESOLVED_COVERAGE` `:1805-1810`), and zero pending `INSERT`/`MOVE` (blocker `TL_RECONCILIATION_PENDING` `:1811-1816`). A POPULATED cycle with unresolved or unapplied pairs is therefore **not ready**. Confirmed. (The "deliberately accepted typed exception" alternative is not implemented — see P-4.)

### 7. Consumer boundaries — HG exclusion (CONFIRMED, with note P-5)
- `faculty-assignment.service.ts` adds `loadHgSubjectIds` (`:1291-1300`, case-insensitive code match) and filters HG subject rows out of `activeOwnershipRows` (`:5153-5159`) before building `ownershipIndex` (`:5161`) and the coverage pair sets. `ownershipIndex` feeds both the external effective contract (`getEffectiveTeachingLoad` `:5626-5642` → `GET /faculty-assignments/effective`, router `:826-849`) and the page summary (`GET /faculty-assignments/summary`, router `:273-340`).
- Stable external identifiers and term/rotation metadata are preserved: the enrichment path (`enrichEffectiveAssignments` `:5662+`) is untouched; only the HG filter was added upstream.
- **No external repository is touched by the ATLAS diff.** Confirmed (see P-5 for a scope note).

---

## Findings

### Product / runtime defects
- **None material.** Wiring, apply-safety, readiness semantics, and HG consumer exclusion are correct and pass typecheck + the client unit suite. The server integration test (`teaching-load-reconciliation.test.ts`) covers demand expansion, rotating-term demand, HG exclusion, adviser preference (satisfied and unsatisfied-reason), sequential simulated load, zero-load inclusion, rebalance + hard-cap, fingerprint/source-drift/confirmation/concurrency negative controls, idempotent replay, and disposable-fixture zero-residue cleanup.

### Safety-gate findings
- **None.** The apply boundary is correctly guarded: exact confirmation + fingerprint + source revision revalidated inside a `Serializable` transaction, typed 409 with zero partial writes, idempotent replay, school/actor scope enforcement, preview zero-write negative control, and a `TEACHING_LOAD_RECONCILIATION` audit event. No mutation-gate bypass found.

### Process / documentation inconsistencies

#### [B-1] (a11y — REQUIRED MINOR) Primary reconcile controls are below 44px touch height
Review scope criterion is 44px touch targets. Measured against `atlas-client/src/ui/button-variants.ts` (`default: h-8` = 32px, `sm: h-10` = 40px, `lg: h-9` = 36px):
- `TeachingLoadReconciliationPanel.tsx:174-183` (Preview) and `:365-375` (Apply) use **default** size → **32px** tall (full-width `w-full`, so horizontal target is large).
- `TeachingLoad.tsx:782-793` "Reconcile teaching load" uses `size="sm"` plus `className="h-9"` → **36px** tall.
None reach 44px (WCAG 2.5.5 AAA / stated criterion). Note the app's compact theme makes 32px the app-wide default, so this is a design-system-wide posture rather than a defect introduced only here. **Required per the review's stated criterion; UI-only, low risk, non-blocking for functional correctness.** Recommend a min-height bump on these three controls (e.g. `min-h-11` or a 44px touch size), keeping the compact look elsewhere.

#### [B-2] (UX — INFORMATIONAL) Confirmation trim inconsistency between client gate and server
The client enables Apply when `confirmation.trim() === preview.confirmationText` (`helpers:104`) but sends the **untrimmed** value (`Panel:126`); the server requires exact equality (`service:1702-1704`). A pasted phrase with surrounding whitespace enables the button yet yields a 400 `CONFIRMATION_REQUIRED`. Recommend sending `confirmation.trim()` (or trimming before the equality check on the server).

#### [B-3] (UX — INFORMATIONAL) Stale preview retained after a drift rejection
On `SOURCE_DRIFT`/`FINGERPRINT_MISMATCH`/`TRANSACTION_CONFLICT` the panel shows the error banner (`Panel:134-136`) but keeps the stale `preview` in state, so Apply stays enabled if the typed confirmation still matches and repeated clicks produce repeated 409s (server remains the safety authority). The banner already says "Re-run the preview"; consider clearing the preview or adding a stale flag on these codes so the workflow forces a fresh preview.

#### [B-4] (CONTRACT — INFORMATIONAL) `acceptedExceptions` is a dead field; the "accepted typed exception" path is unimplemented
`TeachingLoadReconciliationReadiness.acceptedExceptions` is declared (service `:1772`, `:1818`) but hardcoded to `0` and never consumed; readiness has no "deliberately accepted typed exception" branch — `ready` requires full valid ownership only. This is **conservative** (never a false-ready), so it is not a correctness defect, but the scope's alternative readiness path is absent. Decide to remove the field or implement the exception mechanism.

#### [B-5] (PROCESS — INFORMATIONAL) HG exclusion lands on the shared summary path, affecting the ATLAS page too
The HG filter in `getAssignmentSummary` (`faculty-assignment.service.ts:5153-5159`) modifies the single `ownershipIndex` consumed by both the external effective contract and the ATLAS Teaching Load page itself (`useTeachingLoadData.ts:171/223/244` reads `/faculty-assignments/summary`). HG ownership will no longer appear in the page's assignment index/coverage either. This is consistent with the declared "HG is never Teaching Load ownership/output" contract and the page already excludes HG from completion math (`TeachingLoad.tsx:136`), but it is a UI-behavior change beyond the literal "consumer boundary" and should be confirmed against the live page before the commit. Not a defect as implemented.

---

## Adversarial / boundary checks performed
- **Confirmation gate:** wrong/missing/padded phrase → blocked client-side and server-side (`CONFIRMATION_REQUIRED`, `service:1702-1704`). Verified by reading plus the B3 fixture test.
- **Fingerprint / source-revision:** server recomputes both inside the transaction (`:1714-1723`); mismatch → typed 409, zero writes (fixture B4 asserts `writes().length === 0`). Verified.
- **Zero-write preview:** `previewTeachingLoadReconciliation` performs no writes; `zeroWriteProof: { preview: true, writes: 0 }` (`:1457`); fixture B2 asserts zero write operations and bounded set-based reads. Verified.
- **School / actor scope:** preview and apply require `actorSchoolId === schoolId` (`SCHOOL_MISMATCH`, `:1390-1395`, `:1502-1509`); router enforces `rejectSchoolScopeConflict`. Fixture B3 asserts cross-school rejection. Verified.
- **Replay idempotence:** matching fingerprint after a successful apply → zero writes (`replayed: true`, `:1726-1744`; fixture B6). Verified.
- **No external-repo mutation:** the ATLAS diff contains zero edits to `D:\EnrollPro`, `D:\AIMS`, `D:\smart-final-capstone`. Verified.

---

## Verdict

**`zeroFix: false`**

The implementation is functionally correct: UI→route→service wiring, apply-safety, readiness semantics, adviser-preference surfacing, and HG consumer exclusion all pass static review, typecheck (client + server), and the 5/5 client unit suite. No material product or safety-gate defect was found.

`zeroFix` is **false** only because the review's stated acceptance criterion for **44px touch targets is not met** (finding B-1, REQUIRED MINOR, UI-only, low risk). Findings B-2…B-5 are informational and do not block. Once B-1 is resolved and the informational items are triaged, this advisory lane can be re-run for a zero-fix pass. This review is advisory evidence only — it does not authorize any GO, apply, merge, or successor unlock.

### Suggested commit (for the implementing stream, when authorized)
```
feat(faculty): add fingerprinted Teaching Load reconciliation preview/apply + readiness
```