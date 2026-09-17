# FLAG-WINDOW-PER-SCOPE-C01 — make the flag-overlay gate agree with the constructor's per-scope contract

ROLE: EXECUTOR. Recommended reasoning variant: `high`. Risk tier: **MEDIUM** — server source that gates generation. It performs no generation, publication, deployment, migration, or live-data mutation.

## Objective

Remove the false `FLAG_CEREMONY_SCOPE_INVALID` blockers for the afternoon shift (G9/G10) by making the preflight's flag-overlay validation agree with the constructor's already-shipped per-scope resolution, while keeping the fail-closed blocker for an **explicitly configured** scoped flag row that cannot snap.

## Why this exists

On the live active year (`schoolYearId=10`, 2031-2032) the readiness diagnostic reports **8 `FLAG_CEREMONY_SCOPE_INVALID` blockers** — G9 and G10 across all four programs. They are false.

Evidence (read-only, this cycle):

- `policy_special_events` for school 1 / year 10: **0 rows**. There is no per-scope flag configuration at all.
- `scheduling_policy` (id 225): `enableFlagCeremony=true`, `flagCeremonyStartTime=07:00`, `flagCeremonyEndTime=07:30`.
- Canonical grids are shift-specific: G7/G8 are morning (`06:00`–`12:15`, so `07:00-07:30` is contained by `06:45-07:30`); G9/G10 are afternoon (REGULAR `12:15`–`18:30`, STE/SPA/SPS `09:45`–`18:30`), so **no** canonical CLASS row contains `07:00-07:30`.
- `generation-preflight.service.ts:1040-1064` already resolves the overlay **per scope** (`G9G10-FLAG-SOURCE-LANE §3.2`): each shape consumes its own `getEffectiveEvents` flag authority and falls back to the global policy window only when no scoped rows exist. With 0 persisted rows every shape falls back to the global window, and the afternoon shapes then fail the containment test.
- `schedule-constructor.ts:538-559` `resolvePolicyFlagOverlaySlots` resolves the same overlay **permissively**: an unsnappable window yields **no overlay**, silently (`if (!snapped) continue` / no push). The constructor therefore renders no afternoon flag and never complains — while the preflight blocks.

**The defect is the disagreement.** The preflight is stricter than the only consumer it guards. The afternoon shift legitimately has no flag overlay under the current (morning) global default, and the school configures a per-scope flag through `PolicySpecialEvent` rows (`gradeGroup`/`programType`) when it wants one — that mechanism already exists and already wins over the global field.

## Required behaviour (the contract to implement)

For each timetable shape, resolve the flag authority exactly as the preflight already does, then classify:

| Case | Required outcome |
| --- | --- |
| Scoped flag rows exist for the shape, and at least one snaps to a containing canonical CLASS row | No blocker; the overlay renders (unchanged) |
| Scoped flag rows exist for the shape, and **none** snaps | **Blocker** — explicit per-scope misconfiguration stays fail-closed |
| No scoped rows; the global policy window snaps | No blocker; the overlay renders (unchanged) |
| No scoped rows; the global policy window does **not** snap | **No blocker, no overlay** — the global window is a morning default and does not apply to a shape whose grid cannot contain it |

The distinction that matters: **explicit configuration fails closed; an inapplicable global default does not.**

Do not change `resolvePolicyFlagOverlaySlots`. The constructor is already correct and is the parity reference.

## Immutable identity

- Base: the current `origin/main` at dispatch. Record the exact full SHA. (At authoring: `eaefc840`, containing the deployed product tip `131baab7`.)
- Worktree: `E:/ATLAS-worktrees/flag-window-per-scope-c01` (new worktree root per the directive). Branch `work/flag-window-per-scope-c01`.
- Directive: read `origin/main:AGENTS.md` and record its blob + LF-SHA-256.
- Production entry point: `GET /api/v1/generation/1/10/readiness/diagnostic` (the canonical readiness diagnostic consumed by the Timetable UI).

## Owned and forbidden paths

- **Owned:** `atlas-server/src/services/generation-preflight.service.ts`, its focused tests, and one concise handoff/progress file.
- **Forbidden:** `schedule-constructor.ts` (parity reference — do not "fix" it), the schema, migrations, any client file, `docs/plans/atlas-delivery-cycles.json`, the living register, `CHANGELOG.md`, and every live action (no generation, publication, deployment, restart, login, or database write). Do not touch the shared runtime.

## Preconditions

1. The worktree is clean at the recorded base and the base is an ancestor of `origin/main`.
2. Reproduce the defect first, read-only, on the live diagnostic: 8 `FLAG_CEREMONY_SCOPE_INVALID`, all `Grade 9|10 × REGULAR|STE|SPA|SPS`, and confirm `policy_special_events` for year 10 is empty and the policy window is `07:00-07:30`.
3. Confirm `schedule-constructor.ts:538-559` is unmodified from base (parity reference).

## Execution

1. In `generation-preflight.service.ts` (the block at ~1040-1064), keep the existing per-scope `scopedFlagEvents` / `shapeFlagWindows` resolution. Then apply the contract above: emit `FLAG_CEREMONY_SCOPE_INVALID` **only** when the shape has its own scoped flag rows and none of them snaps. When the list came from the global-policy fallback, skip the shape instead of blocking.
2. Keep the blocker's message, `entity`, `owningSurface`, and `nextAction` semantics, but make them truthful for the remaining case — it now only fires for a **configured** scoped row, so the next action should say to align the configured per-scope Flag/HGP window with a single canonical CLASS row.
3. Preserve every other blocker code and ordering. `flagScopeRejected` handling and `validateTimetableShapePolicy`'s `flagCeremony` input must remain correct for the scoped case.

## Decisive gates

| # | Row | Pass condition | Failing-first / negative control |
| --- | --- | --- | --- |
| 1 | **Production positive** | On the live active year, the canonical readiness diagnostic reports `FLAG_CEREMONY_SCOPE_INVALID` **0** (was 8), with the other blocker classes unchanged in kind | Reproduce 8 on the base first |
| 2 | **Fail-closed preserved** | A persisted scoped `PolicySpecialEvent` flag row (e.g. `gradeGroup`=G9, window that no canonical CLASS row contains) still yields exactly one `FLAG_CEREMONY_SCOPE_INVALID` | Mutant: make the scoped case permissive and confirm this row fails |
| 3 | **Scoped row that snaps** | A persisted scoped row with a snapping window yields no blocker | — |
| 4 | **Morning unchanged** | G7/G8 with the global `07:00-07:30` window yields no blocker, and the constructor still emits the overlay for those shapes | — |
| 5 | **Constructor parity** | For every shape, the preflight's blocker decision matches `resolvePolicyFlagOverlaySlots`'s overlay decision: a shape gets an overlay iff the preflight emits no blocker for it (scoped-and-snapping, or global-and-snapping) | Assert the two resolutions agree over the 16 scopes × the three authority cases |
| 6 | **Zero-write** | The diagnostic is read-only: before/after row counts for `policy_special_events`, `scheduling_policy`, `class_program_slots`, `subject_section_ownerships`, and `faculty_subjects` are identical | — |
| 7 | **Test preservation** | Every existing `FLAG_CEREMONY_SCOPE_INVALID` assertion in the tracked suites still passes or is deliberately updated with justification; no assertion is silently removed | Inventory the assertions by name before and after |

Run the focused suites that already cover this surface — at minimum `generation-stakeholder-shape-genc02r.test.ts`, `timetable-shape-diagnostic-c02.test.ts`, `slot-break-authority-c11.test.ts`, and `generation-authority-realism-c07*.test.ts` — plus `tsc --noEmit`.

## Product note for the reviewer

If the school wants an **afternoon** flag ceremony, it configures a `PolicySpecialEvent` row scoped to that `gradeGroup`/`programType` with a window inside one of that grid's CLASS rows; the existing per-scope mechanism then applies it and this packet's fail-closed case protects it. This packet does not decide whether an afternoon flag should exist — it only stops the *global morning default* from being reported as an invalid configuration for a shift it was never meant to cover.

## Return contract

Commit the bounded candidate on `work/flag-window-per-scope-c01`, run the decisive gates, and return one compact handoff: base SHA, candidate SHA, exact changed paths, the requirement→production-path→negative-control→verification trace table with every row PASS/BLOCKED/DEFERRED, the gate tally, the `production-shape parity` row (real producer `schedule-constructor.resolvePolicyFlagOverlaySlots` → real consumer `generation-preflight` blocker decision), and known risks. Then return `REVIEW_REQUIRED`. Do not self-approve, merge, push, deploy, generate, or publish.
