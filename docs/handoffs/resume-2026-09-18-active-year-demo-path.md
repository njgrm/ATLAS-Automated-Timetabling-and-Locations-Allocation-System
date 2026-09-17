# RESUME — active-year demo path (2026-09-18)

**Read this first after a compaction or in a fresh session.** It is the strategic
state; the machine register (`docs/plans/atlas-delivery-cycles.json`, revision 366)
and Git are the authority for details.

## The objective

Get to a presentable live demo: the **export surfaces** (class / teacher / room /
summary) and the corrected **Teaching Load + dynamic-timetable UX**, working on the
**active school year 551 (2031-2032)** at `https://njgrm.buru-degree.ts.net`.
**Never the archived year 223 (2030-2031).** In parallel: SSO with EnrollPro.

## Live state (verified this session)

| Item | Value |
| --- | --- |
| Live release | `78be1b760e4059a4c0d0ea227579eaeb731cdf6d` at `D:\ATLAS-runtime-supervised-78be1b760e40-20260918` |
| Listeners | 5001→42904, 5174→27044 (task-launched `\ATLAS-Runtime-Supervisor`, SYSTEM) |
| Rollback | `8eb0511baa537d4212f24a007ac40e2dded38c0e` — proven by execution, intact |
| `origin/main` | `df90552f`; register rev **366**; mode `CYCLE_ACTIVE` = `DATA-CORRECTION-C01` |
| **The `/timetable` React #310 crash is FIXED** | 30-route crawl clean, verified twice independently |

## What was achieved this session

1. **Client-quality wave COMPLETE** — `CLIENT-QUALITY-C01` (source) + `CLIENT-QUALITY-RELEASE-SWAP-01` (HIGH deploy). The deploy fixed the live `/timetable` crash, the `remainingHours` null deref, and four UX findings (Run Health card removed, archived load in-page, truth panel collapsed, banner dismissible), and added the three missing gates (ESLint `react-hooks` + `no-explicit-any` ratchet via a scoped lockfile toolchain, client `tsc --noEmit`, route smoke spec).
2. **Directive ceremony cut applied** (increments 1–2): browser QA normalized (no per-instance login approval), Tier A exempted from receipts/leases/auditors, prose register retired, Wave Auditor narrowed to Tier B. Staged rules R1–R19 live in `docs/plans/directive-revision-proposal-2026-09-17.md`.
3. **Durable finding:** a SYSTEM-run supervisor cannot resolve a release pinned in a worktree owned by the interactive user — `safe.directory` is per-user and does **not** help. The release root, its `.git`, and `D:\ATLAS\.git\worktrees\<release>` must be owned by `BUILTIN\Administrators`.

## The NEW blocker discovery — the active year is not set up

`GET /api/v1/generation/1/551/readiness/diagnostic` → **`status: BLOCKED`, `generateAllowed: false`**, with four blockers:

| Blocker | Meaning | Owning surface |
| --- | --- | --- |
| `SECTION_SETUP_REQUIRED` | No active, non-stale section mirrors for year 551 | Sections / EnrollPro sync |
| `TEACHING_LOAD_REVIEW_REQUIRED` | No Teaching Load owner rows for year 551 | Teaching Load |
| `INACTIVE_HISTORICAL_YEAR` | "not the sole active, non-archived year" — **yet 551 IS `is_active=true` and the only active year**, so this fires for another reason (likely the unresolved ordered-term contract; `termStructure: null`) | Term contract / subject authority |
| `POLICY_UNINITIALIZED` | Policy not initialised | Policy |

Totals all zero (`lines: 0`, `pairs: 0`, `sessionsByTerm: {}`). The active year's
`classProgramSlots` grid is **incomplete**: G9/G10 REGULAR are canonical (10 rows,
8 CLASS, lunch 11:30–12:15) but **G7/G8 are absent** (`classRowCount: 0`).

**Therefore `DATA-CORRECTION-C01` is NOT on the demo's critical path** — it targets
the archived year and its 4 blocking findings (below) make it unapprovable.

## Immediate next action

**Investigate `INACTIVE_HISTORICAL_YEAR` against year 551 (read-only).** It is the
one blocker that may be a small authority fix rather than an operational setup
task, and it determines whether the demo is hours or days away. If 551 is genuinely
the sole active year, find why the demand-authority check rejects it (start at
`generation-preflight.service.ts` / the derived-demand year-authority path and the
ordered-term contract resolution).

Then, in order: sync sections for 551 → assign Teaching Load owners → initialise
policy → generation → exports browser QA.

## Stream states

| Stream | State | Note |
| --- | --- | --- |
| `CONSOLIDATED-DEPLOYMENT-C10` | `COMPLETE` | deployed PIN40, receipt pinned |
| `CLIENT-QUALITY-RELEASE-SWAP-01` | `COMPLETE` | receipt pinned, `AUDIT_CLEAR` 9/9 |
| `CLIENT-QUALITY-C01` | source accepted/integrated | its own closure needs a fresh QA to record the now-unblocked live gate L2 |
| `DATA-CORRECTION-C01` | `CORRECTION_REQUIRED` | **4 blocking findings**: (F1) the heading says 21 ownership rows but the body authorizes "10 pairs to 5 peers", and only 21 rows yields the stated effect; (F2) `SubjectSectionOwnership.facultySubjectId` (required FK) is omitted and the five zero-ownership peers have no year-9 `faculty_subjects` row; (F3) acceptance rows 4/8 rest on a pre-lane 123/308 baseline that no longer exists (the preflight now fails closed on `CANONICAL_TEMPLATE_INCOMPLETE`); (F4) no verified backup and no single-transaction requirement |
| `SSO-ENV-ACTIVATION-C01` | registered, not approved | independent of the demo; one restart |
| Generation / publication / term-cache / TL applies | locked | separate HIGH approvals |

## Outstanding register-truth fix

The `DATA-CORRECTION-C01` stream text still claims `8eb0511b` "is serving 5001/5174
(verified: listeners 18348/48244)" — that release is **stopped**. Reconcile it, and
correct the stream's `nextAction`, before the next dispatch. The four blocking
findings also mean the packet and its `approvedActions` need re-authoring (or the
lane should be re-scoped to the active year).

## Durable references

- Register: `docs/plans/atlas-delivery-cycles.json` (rev 366) + generated projection.
- Packets: `docs/prompts/client-quality-release-swap-01-2026-09-17.md`, `docs/prompts/data-correction-c01-2026-09-17.md`.
- Evidence: `docs/reviews/client-quality-c01/` (execution evidence + release-swap evidence + wave audit capsule).
- Reform staging: `docs/plans/directive-revision-proposal-2026-09-17.md` (R1–R19) and `docs/prompts/directive-revision-r1-2026-09-17.md`.
- Live runtime map: `docs/reference/atlas-runtime-source-of-truth-map.md`.
- Runtime contract: `ops/runtime/runtime-contract.json` (`productPin d44f29e0`, machine vars `ATLAS_RUNTIME_SOURCE_DIR` / `_RELEASE_SHA` / `_ENV_FILE`).
