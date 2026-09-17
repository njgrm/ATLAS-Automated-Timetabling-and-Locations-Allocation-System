# Wave Completion Audit — SLOT-BREAK-AUTHORITY-C11R

Date: 2026-09-17 (Asia/Manila). Role: `WAVE_COMPLETION_AUDITOR` (fresh, read-only,
adversarial second-planner check). Audited wave: `SLOT-BREAK-AUTHORITY-C11R`
(MEDIUM, no approval gate, `auditRequired: true`).

## Verdict

**`PLANNER_DECISION_REQUIRED`** — mandatory tally `total 8 / passed 7 / failed 1 /
blocked 0 / unperformed 0`.

The integrated **product tree is sound** and every C11R product gate that was
reused or independently re-derived passes. The single failed row (A8) is
**successor/HIGH-packet readiness**: the prepared HIGH packet
`G9-G10-CONFIG-CORRECTION-C01` is not executable as written (finding F-A). Per
the mechanical closure invariants the stream therefore remains `INTEGRATED` and
must not be closed `COMPLETE`, and no successor HIGH approval may be presented
as ready.

## Provenance

- Auditor task/session id: `ses_f5223318bffeVh1MWUqACOkrFW` (returned to the
  primary planner by the harness after the delegated task completed; the
  auditor's own capsule could not see it and returned
  `NOT_RETURNED_BY_HARNESS` for its own field — the planner-recorded id above
  satisfies the capsule provenance requirement, so no replacement audit is
  required).
- Model / reasoning variant: `deepseek-v4.1-flash`, `high` (no tier fallback).
- Reviewed `origin/main`: `c37292ca1799632c5bcf347871e7de40eb913acb` (7 docs-only
  commits past the tree that contains the integration; `atlas-server` subtree
  unchanged).
- Candidate: `06319bb038329f93ec79e032cbc502f7d462d7d1`; base
  `4deb9d9cd75dccba6a3bebfe62511a2b54644cac`; integration merge
  `af7824e3b4d954dd7f13f3857a03f87914c1f0fd`.
- Directive: `origin/main:AGENTS.md` blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`.

## Independently verified

1. Ancestry `4deb9d9c → 06319bb0 → af7824e3 → origin/main` intact; candidate is
   exactly 1 commit; merge parents `5649f7b9` + `06319bb0`.
2. Changed paths over both ranges are exactly the 7 claimed paths
   (`4deb9d9c..06319bb0` and `5649f7b9..af7824e3`).
3. Merged product tree byte-identical to the QA'd candidate:
   `git diff 06319bb0 af7824e3 -- atlas-server` = 0 lines; `atlas-server` subtree
   `e53b7636cfcba58897216cf961348de6f6acb3c2` on candidate, merge, and current
   `origin/main`.
4. Directive pin recomputed byte-exact (Node, no BOM contamination) → matches.
5. Superseded local revision-268 commit `b40ee466` is **not** an ancestor of
   `origin/main` and **no ref contains it** — the register's "abandoned, never
   pushed" account is truthful.
6. Register truth: `state=INTEGRATED`, exact `baseSha`/`candidateSha`/
   `integrationSha`, the same 7 `changedPaths`, `gates 10/10/0/0`,
   `qaVerdict=ACCEPT_READY` (`ses_f5246fce5ffeQvdpsJ18vxRUZi`), `auditRequired=true`.
7. Real chain traced end to end:
   `getExpectedCanonicalSlots`/`seedClassProgramSlots` → `classProgramSlot` rows →
   `resolveCanonicalSlotsFromRows` (same function the C11 validator uses) →
   `buildCanonicalDisplayGrid` → `freezeDisplaySlots` →
   `assertSnapshotConsistency` → `getPublishedSchedulePayload` frozen read;
   `workbook-export.service.ts` already renders frozen canonical rows.
8. Sibling-consumer sweep (services + client): `room-schedule`, `locked-session`,
   `published-schedule`, `pre-generation-draft`, `published-identity-snapshot`,
   `constructBaseline` (fallback only; shapes carry `canonicalSlots`),
   `scheduling-policy.service.ts` defaults, `SchedulingPolicyPane`,
   `/period-slots` route, client break derivation. No unguarded reachable path
   renders the retired window for a scope with canonical rows.
9. No client-side break derivation and no `11:55` literal remains on any client
   read path.
10. Production `db()` = `getDataContext()`, so the `classProgramSlot` delegate is
    always present in production (F5's silent fallback is test-double-only).
11. Assertion-removal sweep: no deletions in any pre-existing test file.
12. Always-on rule sweep: no actor/tenant fail-open introduced, no term-identity
    regression, no stale-scope dispatch, every changed path attributable.

## Findings

- **F-A `BLOCKING` (decision-required) — the G9/G10 HIGH packet is not executable
  and contradicts integrated authority.** Three artifacts disagree about the
  G9/G10 REGULAR grid, and the pending HIGH write sits on the seam:
  - `docs/reference/atlas-beneficiary-output-contract.md` §8 D-D
    (operator-`RESOLVED`): G9-10 Regular **8 CLASS rows**, and canonical
    persisted break rows include **G9-10 Lunch Break 12:15-13:00** plus Health
    15:15-15:30; §8.1 asserts live config already matches D-D.
  - `docs/prompts/g9-g10-config-correction-c01-2026-09-17-r3.md` §R3.2/§R3.3:
    the `12:15-13:00 BREAK` row is **the defect**; repair to **8 CLASS + 1 BREAK**
    with first CLASS `12:15-13:00`, shift `12:15-18:30`, lunch banded over the
    CLASS row; §R3.3 itself orders `PLANNER_DECISION_REQUIRED` if the renderer
    cannot express that band.
  - Integrated code + tests: `12:15-13:00` **is** the canonical BREAK for every
    scope; G9 shift = `13:00-18:30` (C11 `C01 control 1`/`C02`; C11R controls 2
    and 4).
  Why blocking: `class-program-slot.service.ts` encodes `GRADE_9_10_REGULAR` as
  the `12:15-13:00 BREAK` row plus 7 CLASS rows (`13:00`→`18:30`), so R3's repair
  cannot be data-only; C11R's display path derives bands only from
  `rowKind === 'BREAK'` and has no lunch-band-over-CLASS mechanism, so after
  R3's repair G9/G10 would render **no lunch band at all**, regressing
  beneficiary-output-contract §3.1; and executing R3 would fail already
  integrated, wave-audited assertions. R3 §R3.0's "D-D needs NO amendment" is
  refuted by D-D §8's persisted G9-10 Lunch BREAK row, and the spec's
  `approval.approvedActions[0]` ("per the canonical template") is unsatisfiable
  as written because the template yields 7 CLASS rows.
  The remedy requires a product/authority choice (which model governs, and how a
  banded lunch over a CLASS row is displayed **and** represented to the
  validator) and crosses a competing stream boundary — hence a real operator
  decision, not a bounded code correction.
- **F-B `NON_BLOCKING`** — C11R controls 2 and 4 pin G9/G10 catalog literals.
  The coupling is real, but product code is unaffected (displayed values always
  come from the rows, so C11R's general claim survives); the test update belongs
  with the F-A decision. Control 1 is already catalog-derived.
- **F-C `NON_BLOCKING`** — parity control 5 is by-design shared-resolver and is
  **not** an independent value anchor; control 4 is. Recorded so the planner does
  not over-credit control 5.
- **F-D `NON_BLOCKING`** — the union-mode display grid is cross-grade by design
  (school-wide/room-wide views); a scope with no rows still falls back to policy.
  Seam: `GET /:schoolId/:schoolYearId/period-slots` returns the union, so a client
  may offer a slot that section-scoped `createLock` then rejects — fail-closed on
  write, cosmetic only.
- **F-E `NON_BLOCKING`** — F3's unscoped admission of frozen canonical BREAK
  intervals can only turn a would-be `SPECIAL_EVENT_SLOT_UNBACKED` failure into a
  pass; it cannot itself produce a wrong publication.
- **F-F `NON_BLOCKING`** — the new no-invented-lunch behaviour could throw typed
  `422 PUBLICATION_SNAPSHOT_INCONSISTENT` for a legacy artifact whose frozen
  policy lacks explicit lunch bounds. Not reachable against real persisted state
  today (the live policy lunch is still `11:55`, so the interval is admitted), and
  if reached it is correct fail-closed behaviour with a clear forward route
  (publish from a canonical-path run).
- **F-G `NON_BLOCKING`** — `scheduling-policy.service.ts` still holds `11:55`/
  `12:55` policy/DDL defaults (unreachable for canonical scopes, outside owned
  paths), and the new `canonical` parameter on `buildPeriodSlots`/
  `buildSpecialEventSlots` is dead (no caller passes it; the canonical path is
  served by `buildCanonicalDisplayGrid`).
- **F-H `NON_BLOCKING`** — F5's delegate probe is not production-reachable.

## Register delta (returned by the auditor; applied by the planner)

- `review.auditorVerdict = PLANNER_DECISION_REQUIRED` with the auditor session id
  above; stream stays `INTEGRATED`; must not close `COMPLETE` until the F-A
  decision is recorded.
- `G9-G10-CONFIG-CORRECTION-C01` must stay `presentedReady=false` /
  `granted=false`; its `approval.approvedActions[0]` must be corrected to name the
  required `class-program-slot.service.ts` catalog change, and R3 §R3.0's
  "D-D needs NO amendment" claim must be amended, before any registration,
  pre-action review, or approval sentence.
- Superseded the stale registration-era `blocker` prose and the stale
  `nextAction` wording.

## Coordination

- Immediate action: return the D-D §8 versus G9/G10 R3 §R3.2/§R3.3 authority
  decision to the operator; keep C11R `INTEGRATED`.
- Still expected: the operator ruling; then the corrected G9/G10 packet/spec,
  its fresh pre-action review, and its exact approval sentence (NOT GRANTED).
- Safe parallel work: lanes disjoint from `class-program-slot.service.ts`,
  `schedule-constructor.ts`, and the five display services — e.g. the
  `SYNC-SECTION-ENROLMENT-C01` pre-action review, and read-only monitoring of the
  live `3d916b26` runtime.
- Locked successors: `G9-G10-CONFIG-CORRECTION-C01` (HIGH), live generation,
  publication, term-cache apply, Teaching Load applies, and any shared-runtime
  change.
