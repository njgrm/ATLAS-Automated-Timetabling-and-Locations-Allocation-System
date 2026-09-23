# Ceremony-over-class coexistence — capability finding, contract, and bounded packet

Planner artifact, 2026-09-23. Read-only audit; **no product source was edited**.
Base `5e8eef6b` (`origin/main` at authoring). Branch `work/ceremony-class-coexistence-c01`,
worktree `E:/ATLAS-worktrees/ceremony-class-coexistence-c01`.
Custody: this lane has **no** runtime and **no** authenticated browser. Source-only.

## 0. Verdict in one line

**SUPPORTED at the data / generation / conflict layer — proven live.** ATLAS already represents a
class and a ceremony in one slot: the ceremony is a day-scoped *overlay* on one canonical CLASS row,
it consumes no period, and the generator keeps the displaced subject in that slot. The only real
residuals are **(R1) live configuration** (the ceremony is rendered on the wrong period) and
**(R2) display truthfulness** (the ceremony cell hides the underlying class and its teacher). Neither
needs `atlas-server/src` or `prisma/schema.prisma`, so the suspected collision with Planner B does
not materialise.

## 1. Evidence read (both stakeholder patterns confirmed on all five images)

The five images were read this session. The pattern is stronger than the handoff stated: in every
sheet the Monday 06:00–06:45 ceremony cell carries the name of the teacher who teaches the
**displaced** subject at that slot Tue–Fri — never the adviser.

| Image | Section | Monday 06:00–06:45 | Tue–Fri 06:00–06:45 | Teacher printed on the row |
|---|---|---|---|---|
| `GRADE7_STE.jpg` | G7 STE-RAYMUNDO SANTIAGO | Flag Ceremony / HGP | Science | JOHN PAUL FARIS (Science) |
| `GRADE7_STE_EVIDENCE.jpg` | G7 TANDANG SORA | HGP / PEACE CAMPAIGN | TLE | MS. PINEDA (TLE) |
| `GRADE8_STE.jpg` | G8 STE-William Padolina | Flag Ceremony/HGP | Science | GLORY GRACE YAP (Science) |
| `GRADE8-STE2.jpg` | G8 STE-DIOSCORO UMALI | Flag Ceremony/HGP | Mathematics | TUBONGBANUA (Math) |
| `GRADE8_REGULAR.jpg` | G8 MATIYAGA | Flag Ceremony/HGP | Science | TALAUGON (Science) |

Two independent template families (official DepEd "Class Program" with letterhead/signatures, and a
plain section schedule with the footnote "Inclusive of HGP and PEACE Campaign") encode the same
contract: the ceremony is layered on a real class, and the daily total (450 / 360 mins) includes it.
The adviser is *not* the ceremony teacher in any sheet, which proves the cell is the displaced
subject's period, not a separate homeroom block.

## 2. The four questions, answered from the code and the live data

### (a) Does the conflict detector permit a CLASS concurrent with a non-CLASS ceremony row at the same start without a HARD violation? — **Yes.**

The ceremony is a `PolicySpecialEvent`, never a `ScheduledEntry`, so it is absent from every conflict
index. The one place it could become a block is the day-scoped capacity-window path, and Flag/HGP is
explicitly excluded there:

- `atlas-server/src/services/schedule-constructor.ts:676-681` — `isCapacityBlockingSpecialEvent()`
  returns `false` for Flag/HGP.
- `atlas-server/src/services/schedule-constructor.ts:704-734` — `buildDayScopedEventWindows()` skips
  Flag/HGP (`if (!isCapacityBlockingSpecialEvent(...)) continue;`); the synthetic global flag window is
  "intentionally retired".
- `atlas-server/src/services/constraint-validator.ts:511-539, 949-956, 1164-1172` — Flag ceremony is a
  configured break window (non-teaching time), never counted as idle and never a violation source.
- Proof: `atlas-server/src/__tests__/generation-authority-realism-c07.test.ts:302-308` asserts
  `buildDayScopedEventWindows(...)` is `[]` for the flag overlay and the underlying CLASS period stays
  schedulable.

There **is** a deliberate client-side placement guard: `atlas-client/src/lib/timetable-live-conflict.ts:250-252,356-363`
returns `kind: 'hard'` / `SPECIAL_EVENT` for the overlay cell, and
`atlas-client/src/lib/__tests__/timetable-day-scope-c03r.test.ts:35` asserts it. That blocks *placing a
new session* into the ceremony interval on Monday; it is not a coexistence violation and does not
touch the class already scheduled there. It is, however, part of residual R2 (see §4).

### (b) Does the generator treat the slot as unavailable and relocate the displaced subject? — **No.**

The overlay never removes a teaching slot. `atlas-server/src/services/schedule-constructor.ts:843-893`
builds `periodSlots` from the canonical CLASS rows (including the overlay's row) and merges the
overlay into `displaySlots` as a *separate* `isSpecialEvent` entry at the **same** interval — no extra
period, demand, or minutes. Live proof (run 317 / revision 43, `GET /api/v1/schools/1/schedules/published?termIndex=1`):

- G7 REGULAR **Luna**: a complete 5-day grid. Monday `06:00–06:45 TLE_ICT_EXP`; Monday
  `06:45–07:30 SCI_BIO`. The ceremony overlay sits at Monday `06:45–07:30` and the class is still
  registered there.
- G9 SPA **Sampaguita**: Monday `12:15–13:00 SPA_SPEC` under the afternoon overlay at the same interval.

So the scheduler never sees a false gap and never relocates the subject.

### (c) Is the ceremony modelled per-day or per-section? — **Per-day (Monday-only) and per grade-group/program scope; not per-section.**

`atlas-server/src/lib/policy-special-events.ts:44-106` is the single identity + day authority:
`isFlagCeremonyEvent` (eventType `FLAG_OR_HGP` or label `/FLAG|HGP/i`) and
`resolveFlagCeremonyDayAuthority` (absent day ⇒ Monday; explicit non-Monday ⇒ rejected authority).
Scoping is by grade group/program through `getEffectiveEvents` (`policy-special-events.ts:139-202`).
Note: `PolicySpecialEvent` (`prisma/schema.prisma:749-766`) has **no day column**, so "per-day" is
derived from identity and is Monday only — a non-Monday ceremony would need a schema decision.

### (d) Are morning/afternoon shifts modelled at all? — **Yes.**

`atlas-server/src/services/class-program-slot.service.ts:189-253`: `GRADE_7_8_REGULAR` (morning
06:00–13:00) and `GRADE_9_10_REGULAR` (afternoon 11:30–18:30, shift-based lunch), selected by
`getExpectedCanonicalSlots`. The preflight comment at
`generation-preflight.service.ts:1024-1031` records that the global morning default was previously
tested against the afternoon grid (an 8-blocker false positive) and is now treated as an
inapplicable default that never blocks. Live: both shifts carry the overlay at a period that still
contains a class.

## 3. The coexistence contract (the authority an implementation must preserve)

1. A ceremony is a **day-scoped overlay** on exactly one canonical CLASS row. It never consumes a
   period, demand line, or teaching minute.
2. The underlying CLASS row stays schedulable; the generator MUST place a real subject there, and the
   daily total includes it.
3. The overlay interval MUST equal the single canonical CLASS row that fully contains the configured
   window. Zero or multiple containing rows is a typed fail-closed blocker
   (`FLAG_CEREMONY_SCOPE_INVALID`), never a silent drop
   (`generation-preflight.service.ts:1035-1061`; `schedule-constructor.ts:741-754`).
4. The ceremony is Monday-only by identity; an explicit non-Monday row is rejected authority
   (`policy-special-events.ts:68-78`; `timetable-shape-policy.service.ts:225-227`).
5. The ceremony is scoped by grade-group/program (not per-section) and applies to every section in
   scope.
6. Morning (G7/G8) and afternoon (G9/G10) are distinct grids. A window a shift's grid cannot contain
   simply does not apply to that shift — never a blocker, never a synthesized interval.
7. Every consumer (grid, conflict index, exports, publication snapshot) resolves identity/day/interval
   from the one shared authority (`lib/policy-special-events.ts`).
8. **The ceremony day's display MUST NOT erase the underlying class identity.** The cell must still
   convey that a class occupies the period — and, per the confirmed requirement, its subject teacher.

Rule 8 is the only rule the current product does not fully meet (§4, R2).

## 4. Residuals

**R1 — live configuration (data, HIGH, separate).** Live run 317 renders the morning overlay at
`06:45–07:30` (period 2), not the sheets' `06:00–06:45` (period 1). The live global window is
`07:00–07:30` (`generation-stakeholder-shape-genc02r.test.ts:659-670` encodes this as the live
active-year state), which snaps to the containing row `06:45–07:30`. This is a policy-data mismatch,
not a code defect; fixing it means setting `flagCeremonyStartTime/EndTime` to `06:00/06:45` (or
persisting a per-scope row), a **separate gated data action**. The afternoon overlay is already on the
shift's first period (`12:15–13:00`).

**R2 — display truthfulness (client-only).** On the ceremony weekday the grid cell renders the event
label **only** and hides the underlying class and teacher:
`atlas-client/src/components/timetable/TimetableGrid.tsx:200-243` early-returns the event cell; the
current contract is asserted at `timetable-day-scope-c03r.test.ts:70` (Monday entries length 0) and
`:104-106` (Monday cell shows only `FLAG CEREMONY`). This is exactly the failure mode the requirement
warns about — a scheduler reading Monday sees no class registered — even though the data is correct.
It is also why the printed sheet's teacher name is absent. The fix is client-only and disjoint from
Planner B.

**R3 — per-day schema (observation, NON_BLOCKING).** `policy_special_events` has no day column; a
non-Monday ceremony cannot be persisted. Not required by the evidence (all Monday).

## 5. Boundary and collision statement

Planner B (`feat/scheduler-collaboration-c01`, base `a7fb238c`) touches these product files:
`atlas-client/src/{types.ts,components/AppShell.tsx,components/app-shell/AppSidebar.tsx,components/app-shell/navigation.ts,components/timetable/ScheduleReviewWorkspaceSummaryStats.tsx,hooks/useTimetableCollaboration.ts,lib/roomPreferenceCollaboration.ts,pages/FacultyRoomPreferences.tsx,pages/OfficerRoomPreferences.tsx}`
plus `atlas-server/src/**` and `prisma/`-adjacent runtime files.

This lane's packet touches **none** of them. Target files are:
`atlas-client/src/components/timetable/TimetableGrid.tsx`,
`atlas-client/src/lib/timetable-live-conflict.ts`,
`atlas-client/src/lib/timetable-grid-slots.ts`,
`atlas-client/src/hooks/useTimetableData.ts` (only if needed),
and their tests under `atlas-client/src/lib/__tests__/` and
`atlas-client/src/components/timetable/__tests__/`.

**No `atlas-server/src` change and no `prisma/schema.prisma` change is required.** `types.ts` is
explicitly **out of scope** (Planner B touches it). No boundary transfer is needed because the
required change is client-only.

## 6. Packet — `CEREMONY-OVER-CLASS-TRUTHFULNESS-C01` (bounded, MEDIUM, client-only)

**Objective.** Make the ceremony day truthful: keep the underlying class and its teacher visible in
the ceremony cell, while the ceremony remains a non-consuming overlay. No data-model, generator, or
conflict-authority change.

**Paths (exact).**
- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- `atlas-client/src/lib/timetable-live-conflict.ts`
- `atlas-client/src/lib/timetable-grid-slots.ts`
- `atlas-client/src/hooks/useTimetableData.ts` (only if the row model must carry the class identity)
- Tests: `atlas-client/src/lib/__tests__/timetable-day-scope-c03r.test.ts`,
  `atlas-client/src/lib/__tests__/timetable-grid-shape-authority.test.ts`

**Explicitly out of scope.** `atlas-server/src/**`, `prisma/schema.prisma`,
`atlas-client/src/types.ts`, and the live policy window (R1 — separate HIGH data action).

### Acceptance rows (each names the harness that decides it)

| # | Claim | Harness | Owner |
|---|---|---|---|
| P1 | The ceremony day cell renders the ceremony **and** the underlying subject/teacher; the non-ceremony weekdays are unchanged; the ceremony still renders exactly once | `cd atlas-client; npx tsx --test src/lib/__tests__/timetable-day-scope-c03r.test.ts src/lib/__tests__/timetable-grid-shape-authority.test.ts` (amended contract; failing-first on base) | executor + fresh QA |
| P2 | The overlay day cell is classified as "ceremony overlay over a class" (class present), not a bare `hard/blocked`; the interval stays usable for the existing class; other weekdays stay `clean` | `cd atlas-client; npx tsx --test src/lib/__tests__/timetable-day-scope-c03r.test.ts` (live-conflict rows) | executor + fresh QA |
| P3 | Client type-checks and builds | `cd atlas-client; npm run typecheck; npm run build` | executor |
| P4 | Server authority is untouched — overlay is not a capacity block, containment fail-closed holds, shift grids unchanged | `cd atlas-server; npm run test:server-suite` (covers `generation-authority-realism-c07`, `generation-stakeholder-shape-genc02r`, `timetable-shape-diagnostic-c02`) | fresh QA |
| P5 | Deployed Monday cell shows the ceremony **and** the teacher; Tue–Fri show the class; no global scrollbar | live browser, named Tailnet origin, 1366×768 + 390×844 | **not this lane** — elevated OpenCode (browser/runtime custodian) |
| P6 | Live ceremony window aligned to `06:00–06:45`; overlay snaps to period 1; every section keeps a complete 5-day grid | live policy read-back + `GET /api/v1/schools/1/schedules/published?termIndex=1` entry scan | **not this lane** — separate HIGH data action |

### Risks

- **BLOCKING (for P1/P2).** The current display is an explicit committed contract
  (`timetable-day-scope-c03r.test.ts:70,104`). The packet deliberately amends it; the executor must
  record the operator's confirmation that the ceremony cell should show the class/teacher (the
  confirmed requirement implies yes). Without that, do not start.
- **NON_BLOCKING.** The public `specialEvents` projection lists one flag overlay (`06:45–07:30`) while
  the frozen `timeSlots` carry two (`06:45–07:30` and `12:15–13:00`). Re-verify the persisted
  `policy_special_events` rows read-only before executing R1/P6.
- **NON_BLOCKING.** Per-day is identity-derived Monday only (R3); a non-Monday ceremony is a separate
  schema decision.

## 7. Evidence commands actually run (2026-09-23)

- `git merge-base --is-ancestor ec2430ab origin/main` → the in-period-overlay fix
  (`ec2430ab fix(timetable): treat Flag/HGP as in-period overlay, not a capacity block`,
  2026-09-18) **is** in `origin/main` **and** in the live release `4893cbde`.
- `GET http://127.0.0.1:5001/api/v1/health` → 200 (read-only).
- `GET http://127.0.0.1:5001/api/v1/schools/1/schedules/published?termIndex=1` → 200, 673,433 B,
  runId 317 / revision 43 / FROZEN; overlay rows as quoted in §2; per-section entry scans for G7 Luna
  and G9 Sampaguita as quoted in §2(b).
- `git diff --name-only a7fb238c..feat/scheduler-collaboration-c01` → Planner B footprint quoted in §5
  (no overlap with this packet).

No live mutation, no browser, no deployment, no runtime/listener action occurred.
