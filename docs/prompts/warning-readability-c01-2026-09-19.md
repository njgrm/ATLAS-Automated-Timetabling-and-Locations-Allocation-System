# WARNING-READABILITY-C01 — every warning must be readable at a glance

- Stream: `WARNING-READABILITY-C01`
- Kind: `CYCLE`, source. Risk: `MEDIUM` (server copy + client presentation).
  Publication and generation remain separately gated `HIGH`.
- Base: `49c69af5` (re-verify; main is moving)
- Writable worktree: `E:/ATLAS-worktrees/warning-readability-c01` (planner-provisioned)
- Branch: `work/warning-readability-c01`
- Additive commits only.
- Recommended executor reasoning: `high`.

## 0. Origin — measured live, 2026-09-19

An authenticated QA session on run #316 (school 1, year 10) established:

| Fact | Value |
| --- | --- |
| Violation rows returned by the API | **335** |
| Unique issues once term is factored out | **116** |
| Count shown in the Timetable header | **113** |
| Hard / blocking-hard violations | **0 / 0** |
| Distinct warning codes present | 6 |

**The headline number is not trustworthy as presented.** The API returns one row per
term for the same underlying issue (`entry-523::t1`, `::t2`, `::t3` are the same
Faculty 16 Monday problem counted three times), so 116 real issues are reported as
335. The UI silently deduplicates to 113 without saying so. An operator reading
"335" and an operator reading "113" are looking at the same schedule.

### Trustworthiness audit (three of six verified independently)

| Code | Rows / unique | Verdict |
| --- | --- | --- |
| `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED` | 51 / 17 | **CORRECT.** Faculty 16 Monday T1 entries `09:15-10:00`, `10:00-10:45`, `10:45-11:30`, `11:30-12:15` = exactly 4 contiguous periods = 180 min > the 135 limit. The violation's `blockEntryIds` match those four entries exactly. The later `15:30-17:45` block is 135 min and is correctly **not** flagged. |
| `FACULTY_EXCESSIVE_IDLE_GAP` | 101 / ~34 | **CORRECT.** Faculty 39 Friday: `06:00-06:45` then `08:15-09:00` = exactly the reported **90 min** gap. Breaks are properly excluded (`excludedBreakWindows: 12`), so the `10:00-14:30` stretch spanning lunch is not counted. |
| `FACULTY_EXCESSIVE_BUILDING_TRANSITIONS` | 93 / 31 | **CORRECT.** Faculty 12 Tuesday has 6 entries -> exactly the reported **5** transitions. |
| `FACULTY_FLOOR_TRANSITION` | 30 / 10 | **COMPUTATION OK, MESSAGE BROKEN.** Reads `"moves 3 floors in one building on MONDAY (14:30->14:30) with only 0 min gap."` The arrow shows *end time -> start time*, which reads as a zero-length transition. |
| `FACULTY_INSUFFICIENT_TRANSITION_BUFFER` | 57 / 19 | **PLAUSIBLE BUT DUPLICATIVE.** Same faculty (16), same day (Monday), overlapping entry set as `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED`. One real situation generates two warnings. |
| `ZONE_IMBALANCE_WARNING` | 3 / 1 | **NOT TRUSTWORTHY.** Fires because zone metadata is unconfigured: **0 of 103 rooms** have a `buildingZoneId`. Message: `"Term 1 zone UNSPECIFIED has 100% of scheduled entries (920 of 920), exceeding the 50% balancing threshold."` Technically true, operationally meaningless — it is a *configuration* gap wearing a *schedule* warning's clothes. It also carries **920 entry ids**, bloating the payload. |

**Conclusion to act on:** the faculty-comfort warnings are computed correctly from
real data. The problems are **presentation, duplication, term inflation, and one
false category** — not the underlying math.

## 1. Required outcomes

**R1 — Cover EVERY code, not just the visible ones.**
`atlas-server/src/services/constraint-validator.ts` defines the canonical
`VIOLATION_CODES` set (~46 codes), including many that never reach the current UI
(`PREFERRED_ROOM_UNUSABLE_*`, `NO_SAME_ZONE_STANDARD_ROOM`,
`POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE`, `INCOMPLETE_MODULAR_GROUP`,
`FACULTY_SUBJECT_NOT_QUALIFIED`, `HOME_ROOM_OCCUPIED`, and others). Every code must
have operator-facing copy: a plain title, a one-sentence meaning, and a next action
where one exists. A code without copy is a defect even if it is unreachable today.

**R2 — Readable at a glance by someone who does not know the system.**
- No raw codes, no enum names, no internal jargon in the operator surface.
- No bare numbers: `180` must read as `180 minutes (4 consecutive periods)`; `135` as
  `the 135-minute limit`.
- Every warning states **who** (name, not `Faculty 16`), **when** (day, and the times),
  **what**, and **what to do**.
- Prefer one sentence an adviser could read aloud.

**R3 — Honest counts.**
Decide and label the term semantics explicitly. Either report unique issues with a
stated basis, or report per-term rows and say so. The header must not silently
disagree with the detail view. A user must never have to guess why two screens show
113 and 335 for the same run.

**R4 — Collapse duplicates.**
One real situation must produce one readable item. Where
`FACULTY_CONSECUTIVE_LIMIT_EXCEEDED` and `FACULTY_INSUFFICIENT_TRANSITION_BUFFER`
describe the same faculty-day, group them under a single heading with the supporting
detail beneath, rather than listing both as separate problems.

**R5 — Separate configuration gaps from schedule defects.**
`ZONE_IMBALANCE_WARNING` must not present as a schedule warning when no zones are
configured. Either suppress it when the prerequisite configuration is absent, or
present it as a distinct "setup needed" item with a link to the configuration
surface. Do not let an unconfigured feature generate work for the operator.

**R6 — Fix broken message templates.**
`FACULTY_FLOOR_TRANSITION`'s `(14:30->14:30) with only 0 min gap` must become
unambiguous — e.g. *"Finishes on floor 1 at 14:30 and starts on floor 4 at 14:30 —
no time to move."* Audit every template for the same class of defect, not just this
one.

**R7 — No overwhelming wall.**
Group by severity, then by the affected person or place, then by day. Soft
faculty-comfort metrics must not visually compete with hard blockers. Zero hard
violations must read as a clear, calm statement rather than an empty list.

## 2. Production-path proof required

| # | Requirement | Negative control |
| --- | --- | --- |
| 1 | Every code in `VIOLATION_CODES` has copy | A test that enumerates the canonical set and **fails** on any code lacking title/meaning. This is the load-bearing control. |
| 2 | No raw code or enum leaks to the operator surface | Render each warning; assert the raw code string is absent from operator-visible text |
| 3 | Counts agree | Header count and detail count derive from the same computation; assert equality |
| 4 | Term semantics stated | Assert the label states its basis |
| 5 | Duplicates collapse | Faculty-16 Monday produces **one** grouped item, not two |
| 6 | Zone warning suppressed/reframed | With 0 zoned rooms, assert it is not presented as a schedule warning |
| 7 | Message templates are unambiguous | Assert no rendered message contains a zero-length transition phrasing |
| 8 | Real route | The Timetable violations surface renders through the real endpoint, not a fixture |

## 3. Forbidden

- No generation, publication, regenerate, deployment, or data mutation.
- No change to the underlying constraint math or thresholds — this packet changes
  **presentation, grouping, classification and copy only**. If a threshold itself
  looks wrong, report it; do not silently retune it.
- Do not edit `docs/plans/live-state.md`, the machine register, or `CHANGELOG.md`.
- Do not weaken the HARD/SOFT classification or the `treatAsHard` promotion path.
- Companion repositories are READ_ONLY.

## 4. Return contract

Commit the bounded candidate and return `REVIEW_REQUIRED` with: base SHA, candidate
SHA, exact changed paths, the requirement -> production path -> negative control ->
result table, the **complete code inventory** (every code, and whether it now has
copy), any code you could not cover with the reason, and any `BLOCKED`/`DEFERRED`
row named explicitly. Executors do not self-accept, merge, or push.

## 5. Browser evidence

This is a rendered operator surface and the whole point is readability. Live Tailnet
browser evidence is **mandatory**, with a `window.location.origin` assertion, at
desktop `1366x768` and mobile `390x844`. The evidence must include the rendered
warning list for a run with real violations. Read-only; do not press
Generate/Publish/Apply.

## 6. r1 amendment (planner, 2026-09-21) — this supersedes §5 and re-bases the packet

**Satisfiability defect found at the pre-action lint.** §5 makes live Tailnet browser evidence
mandatory while §3 forbids deployment. The deployed bundle cannot contain an undeployed source
change, so that row is **undecidable inside this cycle** — `AGENTS.md` §11: a row needing a browser,
a login or a deployed build is a **deployment-acceptance clause**, not a source row. Corrected:

- **This cycle delivers the source rows only**: R1–R7 as production paths, decided by the eight §2
  controls in an isolated build. **No deployment, no login, no browser.**
- **The §5 browser row is `DEFERRED(DEPLOYMENT_ACCEPTANCE)`** and must be re-run at `1366x768` and
  `390x844` with the `window.location.origin` assertion by the release cycle that carries this
  change. Report it as `DEFERRED` with that reason — never as "not applicable", and never as
  passed.

**Re-base.** The packet's base `49c69af5` is stale; `main` has moved a long way. **Branch from
current `origin/main` and re-locate every source reference** — the line numbers and the `~46`
code count in §0/§1 are from 2026-09-19 and must not be trusted. **Enumerate the live
`VIOLATION_CODES` set and report the true count** in your return.

**Writable files — ownership is by file (two planner lanes are active).** This lane may touch
`atlas-server/src/services/constraint-validator.ts` and the client warning-presentation files it
names in its return. It must **not** touch `atlas-server/src/routes/runtime.router.ts` (another
lane is live in that file), `atlas-server/package.json` (unless adding a script entry for a new
test — name it in the return), `docs/plans/live-state.md`, the machine register, or `CHANGELOG.md`.

**Worktree.** `E:/ATLAS-worktrees/warning-readability-c01` on `work/warning-readability-c01`,
**planner-provisioned and already fast-forwarded to the current base** — do not re-create it, do
not re-point the branch, and commit additively on top of what is there.
