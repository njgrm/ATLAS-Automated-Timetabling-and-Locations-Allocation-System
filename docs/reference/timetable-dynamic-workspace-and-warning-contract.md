# Timetable dynamic-workspace and warning contract

Status: durable product memory and target operating model
Owner: primary planner (TT-DYNAMIC-AUDIT-C04)
Date: 2026-09-13 (Asia/Manila)
Source baseline: product tree `f3ac4809002dfc0a78eb4834e86400e702a10421`;
cycle worktree `D:\ATLAS-worktrees\planner-tt-dynamic-audit-c04`
(`codex/tt-dynamic-audit-c04`); docs tip at authoring `e0a10ebc` (docs-only above
the product baseline). Evidence basis: three read-only audit lanes
(`ses_f6542af30ffekz7dBallM2PtL9`, `ses_f6542960bffe0TFEV47qvtiilR`,
`ses_f65427af3ffeK1z3rFBsZQQ1iY`), planner independent verification, and the
audit document `docs/audits/timetable-dynamic-workspace-audit-2026-09-13.md`.

This file records direction. It does not authorize implementation, deployment,
generation, publication, migration, or live mutation.

## 1. Target operating model

- **One Timetable workspace** with lifecycle modes: **Plan** (pre-generation
  draft placement), **Review** (generated run under review/repair), **Published**
  (immutable published revision with effective-dated revisions), and **Archived**
  (read-only history). Pre-generation and post-generation are not two
  disconnected operator products.
- **Authorities remain distinct under one shell.** Plan writes through the
  pre-generation draft authority (`LockedSession` DRAFT placements, preview →
  commit). Review writes through the generated-run revision/edit contracts
  (manual-edit CAS, quick-place, sync, TL repair). The shell may share state and
  navigation; it must not collapse the two mutation contracts into one
  client-only state model.
- **Simple is the primary operator experience.** Advanced may keep expert
  diagnostics/panels, but **no material workflow may be reachable only from
  Advanced** unless it has an explicit, documented owner surface. Current
  Advanced-only material gaps are enumerated in §2 and assigned to stream S1.
- **No ambiguous global Save button.** Each mode exposes truthful per-action
  persistence status (§4). "Save" as a single global command is prohibited
  because the underlying authorities are preview/commit and edit/revision, not
  a document save.
- **No silent refresh may make stale data appear current.** Every consumer of a
  run or draft must reconcile against the same freshness authority
  (`GenerationInputSnapshot` domains + ordered-term authority) and must show
  the operator a typed stale state with a repair destination (§3).

### Stakeholder schedule semantics already accepted (governing)

- ARAL Program creates **no** timetable demand, workload credit, or official
  export. Araling Panlipunan (AP) remains an ordinary scheduled subject.
- HG (Homeroom Guidance) is not a standalone load/demand row. Flag
  Ceremony/HGP is a **Monday-only overlay** on the underlying advisory period;
  it must never become a five-day event or extra load.
- Three ordered terms are the beneficiary contract. An academic term is the
  authoritative scope/version of a schedule; day, time, section, teacher, and
  room are rendering dimensions within it. Every export, room/teacher/section
  view, public read, and published revision preserves
  `(termIndex, day, interval, section, subject, faculty, room)` and proves
  parity from one source run (AGENTS.md §Ordered-term timetable invariants).
- All-terms exports must not masquerade as a beneficiary-facing program; one
  selected term governs official downloads when `All terms` is not authorized.

## 2. Simple/Advanced capability matrix (current vs required)

Evidence from lane A; line references are the current worktree.

| Capability | Simple today | Advanced today | Required target | Owner |
|---|---|---|---|---|
| View by section/teacher/room, term switcher, filters, run selector | Yes | Yes | Keep parity | — |
| Generate / plan draft / publish / review issues / place unresolved | Yes | Yes | Keep parity | — |
| Selected-class Move / Change room / Change owner / Teacher departure | Yes (strip; but Swap mis-wired) | Yes (plus duplicate panel) | One consistent action set; fix Swap arming; drop duplicate surface | S1 |
| Official exports (summary/class/teacher) | Yes | Absent | Keep Simple as owner; Advanced keeps none (no loss) | S1 |
| Undo + edit history | Auto-save strip + More>History | Header Undo (label hidden); "visible undo" is `sr-only` | Truthful, visible Undo per mode; history with actor/reason; Redo contract (§4) | S1 |
| Redo | Absent | Absent | Bounded, authoritative-workflow Redo only (§4); never client-only re-apply | S1 |
| Room requests review/approve/deny/appeals | No path (`LeftRail.tsx:189-209`) | Yes | Simple reaches request review when requests block the current task | S1 |
| Policy editor | No | Yes | Stays Advanced (expert); Simple shows policy impact status + link | S1 |
| Map/building workspace | No | Yes | Stays Advanced | — |
| Setup sync impact / Preview Impact / Regenerate / input staleness / rollover drift | No consumer of `inputState`/drift | Yes (`ScheduleReviewWorkspaceHeader.tsx:220-222,226,247,869-938`) | Simple must see stale-input and term/drift state before publish or sync; one shared capability model | S1 |
| Matrix / grid presentation | No | Yes | Stays Advanced | — |
| Teaching Load owner repair for a selected class | Deep-link with identity (`ScheduleReviewWorkspace.tsx:185-196`) | Sandbox dock + panel | Focused modules reusing canonical TL authority (§5) | S1 + S3 (locked) |
| Archived years (read-only) | Absent (`timetable-capabilities.ts:11-22` has no archived state) | Absent | Read-only archived mode contract or explicit exclusion (§6 D4) | S1 |
| Publication truth on superseded runs | Headers strict `isPublished===true` | Center/sandbox/departure sheet loose markers (`ScheduleReviewWorkspace.tsx:130-137`, `CenterWorkspace.tsx:360-367`) | One strict predicate everywhere; superseded runs are not published | S1 (client) + S2/S3/S4 (server predicates) |

## 3. Lifecycle-mode/state-transition contract

### 3.1 Implemented lifecycle states (source of truth today)

`timetable-capabilities.ts:11-27,102-127` derives:
`resolve-scope, setup-loading, setup-blocked, setup-unavailable, ready-no-run,
pre-generation, generating, failed-run, generated-issues, generated-reviewable,
published`. There is no archived state.

### 3.2 Required mode definitions

| Mode | Entry evidence | Mutations | Required operator response to source change |
|---|---|---|---|
| **Plan** | `centerView='pre-generation'`; DRAFT placements; no reviewable run | Pre-gen preview/commit | Re-validate draft placements before commit; show demand/term changes that invalidate planning inputs; disclose that prior-run anchors are one-shot at generation time |
| **Review** | `hasGeneratedRun && !isPublished` | manual edit (CAS), quick place, TL repair, sync, revert | Per-domain impact preview → targeted repair / sync / regenerate; publish blocked while inputs stale; typed version-stale recovery |
| **Published** | strict `summary.isPublished === true` | effective-dated revisions only | Published row immutable; source drift surfaces as "published snapshot; create revision"; no Sync/Repair affordances that always 409 |
| **Archived** | non-active school year | none | Read-only published history; no mutation affordances (or explicit exclusion, see D4) |

### 3.3 Change-impact response (per source) — current vs required

Evidence from lane B. `GenerationInputSnapshot` domains:
`teachingLoad, policy, rooms, sections, subjects, derivedDemand`
(`generation-input-snapshot.service.ts:8-20`), compared by
`compareCurrentInputsForRun` (`:359-378`), consumed by run status
(`generation.service.ts:1455-1478`) and publication
(`publication-contract.service.ts:262-272`).

| Source change | Freshness today | Current signal | Required response | Owner |
|---|---|---|---|---|
| Constraint policy / shift windows | policy digest | generic stale banner, one generic action set | Impact preview (which constraint families changed) + targeted policy action; run-invalidation decision documented | S2 (server) + S1 (UI) |
| Ordered terms (EnrollPro contract) | persisted cache only; preflight check compares cache to itself (`generation-preflight.service.ts:631-651`) | none in Timetable | Hard signal that the term authority revision changed; block repair/regeneration until re-synced; surface `termAuthority` state | S4 (binding) + S1 (UI) |
| Subjects / class templates | subjects digest | stale banner; sync imports/retires | Sync + guided replacement for retired subject ownership | S2 + S4 |
| Sections + enrollment | sections digest | whole-domain stale, no per-field reason | Per-field explanation; enrollment-only delta must not visually invalidate placements | S2 |
| Rooms / buildings | rooms digest | stale banner; sync cannot relocate | Targeted relocation repair for deleted/changed rooms | S2 |
| Faculty availability | **not an input at all** (`generation-preflight.service.ts:698,1138` passes `timeSlots: []`) | none | Product decision required (D1) before any repair module | DECISION |
| Teaching Load ownership | teachingLoad digest | stale on next read; TL page has own preview | Owner repair shows timetable impact before commit; actor/school/CAS guards | S3 |
| Qualification/department/program | inside teachingLoad/subjects digests | none specific | Qualification-repair module reusing canonical evaluator | S3 |
| Added/retired demand / setup drift | derivedDemand digest + sync | stale banner + Sync with Setup | Per-domain routing; truthful anchor-displacement report | S1 (routing) + S4 (server truth) |

## 4. Save / Saved / Undo / Redo / history semantics (target)

Truthful vocabulary, per mode. Every mutation surface must be able to render:
`Idle`, `Previewing`, `Preview-ready`, `Saving`, `Saved` (+ timestamp),
`Save failed` (with retry and no silent data loss), and `Version-stale`
(with refresh + re-preview). No automatic commit may be undisclosed.

| Mode | Save contract | Undo | Redo | History |
|---|---|---|---|---|
| Plan (pre-generation) | Explicit preview → `Save placement` (`CenterWorkspace.tsx:707-717`); swap review path; nothing silent | Per-commit Undo bound to the placement commit (server revert), visible while the placement is the latest change | Redo re-commits the reverted placement through the same preview/commit authority with fresh CAS; refused as `Version-stale` otherwise | Draft-placement history list (placement, actor, time); no run-edit history |
| Review (generated) | Clean placements/moves auto-commit by design (one-click); soft-warning paths force review; hard paths block. Pre-click copy must say auto-commit occurs; post-commit shows `Saved … Undo` strip | Undo targets a specific edit id with `expectedVersion` CAS (`useTimetableMutations.ts:923-946`); must be actor-labelled and must not silently revert another operator's latest edit without warning | Redo = re-apply the last reverted edit through the same preview/commit with fresh CAS; if any precondition changed, typed stale — never a client-only re-apply | Edit history with type, actor, time, counts; per-row revert affordance |
| Published | No direct save; changes are effective-dated revisions (`published-revision.service.ts`) | "Revise again" (append-only); no destructive undo | n/a (append-only) | Revision list (actor, reason, effective date, previous values) |
| Archived | None (read-only) | None | None | Published history only |

Cross-cutting requirements:
1. Redo must never be a client-only replay. It dispatches the same
   preview/commit/revision endpoint and fails closed on CAS/revision mismatch.
2. Undo/redo state must clear on school/year/run/term change (invariant #6 of
   the ordered-term rules) — currently component-local sheets and tasks survive
   scope changes (`ScheduleReviewWorkspace.tsx:62-93`; finding A-08).
3. Superseded runs are **not published** for affordance purposes; the only
   publication truth is `summary.isPublished === true`
   (`publication-contract.service.ts:240-242,295-305`). Loose
   `publishedAt`/`publishedBy` marker checks are defects (A-04, B-11).

## 5. Teaching Load mini-module boundary

Canonical authorities (do not duplicate):
`teaching-load-suggestion-proposal.service.ts` (persisted proposal; actor
school/active year guards `:217-221,300-304`; policy revision binding
`:369-373`; qualification check `:617-625`) and
`teaching-load-reconciliation.service.ts` (fingerprinted preview/apply;
confirmation phrase `:2117-2119`; source revision + fingerprint revalidated in
one Serializable transaction `:2128-2170`).

| # | Repair class | Current control | Required module (no duplication) | Guards to add | Owner |
|---|---|---|---|---|---|
| 1 | Change owner of one subject-section pair | Tactical "Fix Teaching Load Owner" (`TacticalSandboxDock.tsx:544-940`); TL deep link (`ScheduleReviewWorkspace.tsx:185-195`); server `teaching-load-repairs/preview|apply` | Keep as the Timetable entry point; route ownership writes through `assertTeachingLoadWriteAuthority` (`faculty-assignment.service.ts:34-74`) | actor school/active year (missing today), input-snapshot binding | S3 |
| 2 | Teacher departure / long-term absence | `TeacherDepartureRecoverySheet.tsx:90-98,456-761` | Keep sheet; add absence window/reason; revision mode for Published | same as #1 | S3 |
| 3 | Overload/underload redistribution | TL page suggestion + over-cap queue + reconciliation panel; Timetable deep-links only | Keep TL page as home; Timetable shows summary card reusing `autoFill` preview + proposal apply | reuse canonical; no run/revision binding invented | S3 |
| 4 | Qualification / department / program authority | None client-side; server-only endpoints (`faculty-assignment.router.ts:68-113,769-840`) | Focused Qualification/Authority module calling `evaluateTeachingLoadReceiverQualification` (`teaching-load-automation.service.ts:1248`) and department-authority preview/apply | block owner repair on unmet authority; Timetable repair currently bypasses (B-07) | S3 |
| 5 | Availability change moving sessions w/o ownership change | None; no availability authority is consumed | Blocked on D1; then reuse placement/repair authority + persisted availability source | D1 decision | DECISION |
| 6 | Added/retired demand / setup drift | "Sync with Setup" (`ScheduleReviewWorkspaceHeader.tsx:903-912`) | Keep canonical sync; targeted per-domain routing; truthful copy about pin re-binding | none new (sync already binds snapshot `timetable-sync-setup.service.ts:689-731`) | S1 (routing) + S4 (copy/behavior) |

Rules: a time-slot swap is never labeled a teacher swap; do not duplicate the
full Teaching Load editor inside Timetable; every module shows timetable impact
before commit; published runs route to revisions.

## 6. Warning provenance and retirement/replacement decisions

Full matrix: `docs/audits/timetable-dynamic-workspace-audit-2026-09-13.md` §C
and lane C's warning matrix. Governing decisions:

1. **Retire** `FACULTY_EXCESSIVE_TRAVEL_DISTANCE` as an operator warning and
   remove its operator-facing policy control
   (`scheduling-policy.service.ts:75,138`; `SchedulingPolicyPane.tsx:950-957`;
   `PolicyPanePrimitives.tsx:34-37`). Canvas `Building.x/y`
   (`prisma/schema.prisma:141-144`; fixed `920x580` canvas stage in
   `CampusMapEditor.tsx:41-42`) have no verified physical scale; the
   `~Nm`/`estimatedDistanceMeters` label (`constraint-validator.ts:658-673`)
   is false precision. DB fields remain as deprecated compatibility data.
2. **Replace** with auditable identity-based checks:
   - `FACULTY_FLOOR_TRANSITION` (new): same-building
     `|floorDelta| >= 3` with inter-class gap below the transition buffer;
     authority = `Room.floor` only (`schema.prisma:176`); `floorNumber` is
     excluded unless it equals `floor` (see C-14). Recommended default buffer:
     warn when `floorDelta >= 3` and gap < 5 min; 1–2 floor moves inside one
     building must not warn on their own.
   - Keep `FACULTY_EXCESSIVE_BUILDING_TRANSITIONS` (identity-based, default
     4/day) and `FACULTY_INSUFFICIENT_TRANSITION_BUFFER` (cross-building,
     gap ≤ 5 min hardcoded at `constraint-validator.ts:680` → promote to a
     policy field if promoted).
3. **Decouple** the master switch. `enableTravelWellbeingChecks` currently
   gates six codes (`constraint-validator.ts:619,719`). Idle gap gets its own
   flag (or only its per-code override); early/late are gated only by their
   own flags and per-code config.
4. **No unreliable warning may be promotable to a hard publication blocker.**
   Server policy validation currently accepts any `treatAsHard:true`
   (`scheduling-policy.service.ts:586-603`) and promotion is unconditional
   (`constraint-validator.ts:905-914`). Add a server-side code allowlist for
   promotable codes limited to trustworthy structural checks; distance-derived
   codes are never promotable.
5. **Soft warnings stay non-blocking by default**, including after the term
   grouping correction: building transitions, transition buffer, idle gap,
   early/late, vacant, overcompressed, zone imbalance.
6. **Room capacity asymmetry is intentional and must be documented, not
   "fixed" by promotion:** generation warns (SOFT), manual candidate placement
   hard-blocks (`manual-edit.service.ts:311` + `timetable-candidate-domain.ts:113`).
   Align the client default (`PolicyPanePrimitives.tsx:22` says
   `treatAsHard:true`) with the server default (`false`) and stop the
   normalizer/raw-read divergence (`scheduling-policy.service.ts:715-739` runs
   only on `getOrCreatePolicy`; `generation-preflight.service.ts:586` reads the
   raw row).
7. **Term-aware grouping is mandatory** for every faculty/day and section/day
   calculation. Current soft checks sum all ordered terms
   (`constraint-validator.ts:534-541,625-632,723-730,799-806,836-844`), which
   fabricates HARD `FACULTY_DAILY_MAX_EXCEEDED` and false SOFT
   daily/consecutive/vacant/compressed violations for year-long entries
   expanded per term (`per-term-schedule-resolution.service.ts:184-195`).
8. **One warning context per surface.** Manual edits and pre-generation
   previews must consume the same authoritative inputs as generation
   (features/requiredFeatures, effective hours, term identity); see audit
   findings C-08/C-09/C-11.
9. **Client contract completeness**: `ROOM_FEATURE_MISMATCH` must be added to
   the client union and both label maps; `useTimetableData.ts:525` must not
   index the label map unguarded (unknown code → TypeError today).

## 7. Successor stream registry and dependency graph

### Active wave streams (this audit's recommended stream set)

| Stream | Scope | Packet | State | Depends on |
|---|---|---|---|---|
| S1 `TT-DYNAMIC-WORKSPACE-C04` | Unified Simple-first workspace shell; capability model consumption; publish-gate parity (client); source-drift visibility; truthful save/undo/redo/history; Advanced capability migration; deep-link/state hygiene; archived read-only contract | `docs/prompts/timetable-dynamic-workspace-one-shot-c04-2026-09-13.md` | INTEGRATED; wave-audited | live/browser acceptance remains separately gated |
| S2 `TT-WARNING-AUTHORITY-C04` | Retire false metric travel; add cross-building/cross-floor semantics; split policy families; term-aware grouping; promotion allowlist; context-builder parity; client label contract; warning tests; strict publication predicate for `manual-edit.service.ts` (B-11 server half) | `docs/prompts/timetable-warning-authority-one-shot-c04-2026-09-13.md` | INTEGRATED; wave-audited | live publication remains separately gated |
| S3 `TT-TL-MODULES-C04` | Focused owner/departure/redistribution/qualification/availability/setup-drift modules; TL repair authority guards; strict publication predicate for the TL repair service; reconciliation endpoint cleanup | `docs/prompts/timetable-teaching-load-modules-one-shot-c04-2026-09-13.md` | DISPATCHABLE for non-D1 modules | D1 still blocks class 5 availability-driven repair |
| S4 `TT-SOURCE-FRESHNESS-C04` | Generation snapshot binding (B-03); quick-place/sync freshness (B-04/B-09); term-authority binding (B-06 server); sync pin behavior (B-13 server); carries strict-predicate alignment for `timetable-quick-place.service.ts:447` and `timetable-sync-setup.service.ts:283,667` (B-11 server half) | (packet not yet authored; scope defined here and in the audit) | PLANNED (successor) | S2 (shared validator-context ownership) and S3 (TL repair file) |

### Unresolved decisions (operator/planner)

- **D1** Faculty availability authority: adopt `PreferenceTimeSlot` as a
  generation input + fingerprint domain + repair module, or formally exclude
  availability-driven moves. Blocks S3 class 5.
- **D2** Retained manual anchors: should prior-run manual anchors be
  re-applicable/reported at regeneration, or one-shot with explicit
  disclosure? Affects S1 copy and S4 behavior.
- **D3** `applyRunReconciliation`: retire the endpoint (typed failure +
  remove from public surface) or implement real reconciliation. An
  audit-only "APPLIED" with a phantom version is not acceptable (B-02).
- **D4** Archived mode scope: bind non-active years read-only in the
  workspace, or explicitly exclude and keep the current active-year binding.
- **D5** Sync teacher-pin semantics: preserve reviewed teacher pins with a
  conflict report, or keep re-binding and correct the dialog copy (S4 + S1).
- **D6** Room-capacity asymmetry: documented intentional (generation soft,
  manual hard) with aligned defaults; confirm no promotion.

### Dependency graph

```
S1 (workspace) ──────────────┐
S2 (warning authority) ──┐   │
                         │   ▼
                         ├─ S3 (TL modules; LOCKED until S1 integrated; class 5 blocked by D1)
                         └─ S4 (source freshness; after S2 for validator-context boundary, after/with S3 for TL-repair binding)
HIGH actions (generation, publication, deployment, term-cache apply, TL apply) remain separately gated and are not part of any packet.
```

## 8. Evidence boundary

- Browser rows for all three lanes are
  `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`: the persistent Playwright
  profile holds no reusable session (planner probe 2026-09-13 20:27 +08:
  origin asserted `https://njgrm.buru-degree.ts.net`, `/timetable` redirect to `/login`,
  `/api/v1/auth/me` 401, zero cookies/tokens). No login was performed and none
  is authorized by this cycle.
- All findings above are source-traced against the frozen product tree with
  path:line anchors; runtime/data-conditioned uncertainties are listed in the
  audit document §8.

## 9. Durable planner memory — accepted dynamic Timetable target

This section is the compact product checkpoint for future planners. It records
the operator experience being built and must not be weakened by a later packet.
The living delivery register remains authoritative for current SHAs and stream
states.

### 9.1 One continuous workspace

- Timetable is one Simple-first workspace with `Plan`, `Review`, `Published`,
  and `Archived` modes. Pre-generation and post-generation are modes, not
  disconnected products.
- The visual shell, term switcher, section/teacher/room views, filters, and run
  selection remain coherent across modes. Server write authorities remain
  distinct and fail closed.
- Advanced contains expert policy, map, matrix, and raw diagnostic tools only.
  No routine operator workflow may be reachable exclusively from Advanced.

### 9.2 Complete ordered-term truth

- Each selected term is a complete schedule. A five-session weekly subject has
  five sessions in every applicable term; sessions are never distributed
  `2/2/1` across three terms.
- Ordinary subjects persist across applicable terms. Rotating families resolve
  the term-specific subject, teacher, and room.
- Grid, unresolved and violation rails, section/teacher/room projections,
  official exports, and published reads consume the same selected-term entries.
- Switching term clears stale selection, previews, dialogs, swap state, repair
  drawers, pending confirmations, inline status, and term-scoped Undo/Redo,
  while retaining the run and chosen layout.
- ARAL Program and standalone HG create no ordinary demand, workload credit, or
  official export. Araling Panlipunan remains scheduled. Flag Ceremony/HGP is a
  Monday-only overlay on the underlying advisory period.

### 9.3 Dynamic change response

- Policy or shift-window changes show the affected constraint families and a
  reviewed sync/regenerate decision; they never silently make a stale run look
  current.
- Ordered-term changes hard-block repair/generation until authority is synced.
- Teaching Load owner changes show affected timetable sessions before commit.
- Subject/template, section/enrollment, room/building, qualification, and
  added/retired-demand changes receive typed, domain-specific impact and repair
  routes rather than one generic stale banner.
- Enrollment-only changes must not visually invalidate placements unless the
  governed scheduling contract actually changes.
- Generation, quick-place, setup sync, Teaching Load repair, and publication
  must bind to the exact source snapshot and run version they evaluated.

### 9.4 Direct manipulation and recovery

- Routine actions include Move, Change room, armed two-session Swap, Change
  owner, Teacher departure, unresolved placement, and setup synchronization.
- Swap means exchanging timetable placements; it is never mislabeled or routed
  as a teacher/Teaching Load swap.
- Every consequential action shows a visual before/after preview, affected
  sessions, resolved/new warnings, blocking conflicts, save semantics, and Undo
  availability. Invalid targets are highlighted in the grid, not explained only
  by a wall of text.
- Plan mode uses explicit preview then `Save placement`. Review mode may
  one-click save clean moves only when the control says so; warning-bearing
  moves require review and hard conflicts block.
- Undo targets an exact committed edit and expected version. Redo re-enters the
  authoritative preview/commit workflow; it is never a client-only replay.
  History records actor, time, reason, action type, and affected sessions.

### 9.5 Focused Teaching Load modules

Timetable embeds focused repair entry points, not a duplicate Teaching Load
editor:

1. change one subject-section owner;
2. teacher departure or long-term absence with reason/effective window;
3. overload/underload summary and redistribution impact, with Teaching Load as
   the full-workflow home;
4. qualification/department/program authority with typed reasons;
5. availability-driven session movement only after D1 establishes a persisted
   authority; and
6. added/retired demand and setup drift with truthful pin/anchor effects.

Every module previews timetable impact, enforces actor school/active year/CAS
and source freshness, routes published changes through revision authority, and
leaves archived schedules read-only.

### 9.6 Warning and publication truth

- Retire false metric travel distance and its operator policy. Use auditable
  cross-building identity and cross-floor transition checks instead.
- Warning families are independently configured and term-aware. Generation,
  pre-generation, and manual-edit paths use one warning authority.
- Unreliable warnings cannot be promoted to hard publication blockers.
- Room capacity remains intentionally asymmetric: generation warns; manual
  placement into an undersized room rejects.
- Publication requires a completed generated run, zero run-wide blocking hard
  violations, zero unassigned/unresolved sessions, fresh source authority, and
  valid output parity. A clean selected term cannot hide another term's blocker.
- Only `isPublished === true` is publication truth. Published changes are
  append-only revisions; archived schedules expose history without mutations.

### 9.7 Older-scheduler usability and outputs

- Present one obvious primary action, visible lifecycle mode and term, concise
  issue cards, highlighted cells, icons plus text, and optional detail
  disclosure. Avoid duplicate controls, hidden mutation buttons, and cold
  diagnostic walls.
- Keep official selected-term class, teacher, room, summary, workbook, and DOCX
  outputs aligned with the same resolved timetable truth and beneficiary
  templates.
- The end-to-end acceptance target is a realistic three-term morning/afternoon
  schedule with correct rotations and resource views, zero hard blockers and
  unresolved sessions, export parity, and a separately reviewed publication.

### 9.8 Remaining named work at this checkpoint

- `TT-TL-MODULES-C04`: implement and verify the non-D1 focused modules.
- `TT-SOURCE-FRESHNESS-C04`: complete snapshot/version binding and targeted
  source-change behavior after the module surface freezes.
- Resolve D1 availability authority and the retained-anchor, archived-mode, and
  teacher-pin decisions without inventing hidden defaults.
- Deploy accepted source, restore live ordered-term authority, run authenticated
  browser acceptance, execute the canonical generation diagnostic, correct
  real-data blockers, and obtain separate HIGH approvals for generation and
  publication.
