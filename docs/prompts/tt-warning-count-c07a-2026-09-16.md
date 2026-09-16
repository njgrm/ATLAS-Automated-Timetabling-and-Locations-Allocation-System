# TT-WARNING-COUNT-C07A — Server warning authority and count realism

ROLE: EXECUTOR (Lane A of the parent cycle `TT-WARNING-REALISM-C07R1`).

## 0. Immutable boundary

- Base SHA (frozen): `c950e6944f148343b8c864bea5aa080bd6a19426`
- Worktree: `E:/ATLAS-worktrees/tt-warning-count-c07a` (already created, clean)
- Branch: `work/tt-warning-count-c07a`
- Directive: read `AGENTS.md` in this worktree (it is byte-identical to
  `origin/main:AGENTS.md`; LF-normalized SHA-256
  `FFD1452004753AA0F2B7EF21D990CB1DF6E540C2850155B30DECE990B8B82BD5`).
- Dependency tree: `atlas-server/node_modules` and `atlas-client/node_modules`
  are junctions to the verified read-only shared install
  `E:/ATLAS-worktrees/.deps-c950e694/<pkg>/node_modules` (lockfile identity
  verified: all three cycle worktrees are at the same commit). Never run an
  install through the junction.
- Risk tier: `MEDIUM` (source + tests only).

## 1. Settled product policy (authoritative, do not relitigate)

1. Distance-between-buildings is retired. Use only cross-building,
   insufficient transition buffer, and cross-floor checks.
2. Laboratory scheduling is optional configuration. For the primary
   beneficiary, ordinary Science uses CLASSROOM and must produce zero lab
   warnings. LABORATORY/feature requirements apply only when explicitly
   configured by a future beneficiary.
3. Health Break and Lunch are configured break windows, not idle time.
4. Ancillary Work is not Teaching Load.
5. Warnings displayed as publication blockers must use the same server-owned
   promotion allowlist as publication.
6. Selected-term issue lists may be term-scoped, but publish readiness is
   always run-wide.

## 2. Objective

Make the server-side timetable warning authority and its counts
stakeholder-realistic and truthful, with no producer/config/display residue for
retired behavior, and preserve identical results across every real production
path.

## 3. Required outcomes

### A1. `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED` — once per block, period-aligned default
Current defect: `atlas-server/src/services/constraint-validator.ts` §6b
(lines ~665-711) pushes the violation *inside* the per-entry loop at line ~700,
so a contiguous block longer than the limit emits one violation per member
period.
- Emit exactly **one** violation per violating contiguous teaching block. The
  `entities.entryIds` set must name every member of that block.
- Make the default threshold **period/slot-aligned and configurable**, not a
  school-specific constant. Derive it from the authoritative slot/period
  authority (`periodLengthMinutes`, default 45) times an allowed number of
  consecutive periods, exposed through the policy surface.
- Canonical primary-beneficiary shape (45-minute periods): **three consecutive
  periods (135 minutes) are allowed before warning**. Two or three contiguous
  45-minute periods produce zero warnings; four produce exactly one warning for
  the block.
- Keep honoring an explicit configured threshold when one is persisted.

### A2. `FACULTY_EXCESSIVE_IDLE_GAP` — break-aware, in-shift only
Current defect: §8a (lines ~855-877) sums **every** positive gap between
same-day/term classes and never consults the configured break windows.
- Exclude configured **Health Break and Lunch** windows (and the other
  configured non-teaching windows already modeled in the policy: recess, flag
  ceremony, and `PolicySpecialEvent` break rows such as `HEALTH_BREAK`) from
  counted idle time.
- Count only genuine unscheduled gaps **inside the teacher's applicable shift**.
  Never count cross-shift time or outside-shift time.
- Use a stakeholder-realistic **configurable** threshold.
- Satisfy this by threading a break-window + shift-window authority into
  `ValidatorContext` and wiring it in every real validator-context builder:
  - `atlas-server/src/services/generation-preflight.service.ts`
    `buildPreflightValidatorContext` (used by `generation.service.ts:735` and
    `generation-readiness.service.ts:252`)
  - the manual-edit validator context (`atlas-server/src/services/manual-edit.service.ts`)
  - the pre-generation draft validator context
    (`atlas-server/src/services/pre-generation-draft.service.ts`)
  Derive the windows from the same authoritative sources already available on
  the assembly/policy/special-event data (do not invent a new store).

### A3. Remove duplicate or unreachable warning behavior
- Reconcile `FACULTY_BREAK_REQUIREMENT_VIOLATED` with the consecutive rule so a
  **canonical break equality resets the block** (a gap exactly equal to the
  configured break satisfies the requirement and must not extend the block or
  emit a violation).
- Retire unreachable vacant/overcompressed families (`FACULTY_INSUFFICIENT_DAILY_VACANT`,
  `SECTION_OVERCOMPRESSED`) **unless** a real operator control and a real
  production consumer exist. Record a reachability verdict with source
  evidence; if retired, remove the producer, the config default, and the
  display residue.
- `FACULTY_EARLY_START_PREFERENCE` / `FACULTY_LATE_END_PREFERENCE` must either
  become functional opt-in policies (with a real operator control and
  production consumer) or be retired. Record the verdict with evidence.
- Remove **every** producer/config/display residue of
  `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`: the `VIOLATION_CODES` entry, the
  `DEFAULT_CONSTRAINT_CONFIG` entry, and every server display/label site. It
  has no producer today.

### A4. Keep truthful adjacency rules
Keep `FACULTY_EXCESSIVE_BUILDING_TRANSITIONS`, `FACULTY_INSUFFICIENT_TRANSITION_BUFFER`,
and `FACULTY_FLOOR_TRANSITION` based on building identity, floors, chronological
adjacency, and available transition time — never on geographic distance or
canvas coordinates.

### A5. Reclassify or correct misleading warnings
- Missing subject / missing qualified faculty must **not** become
  `SPECIALIZED_ROOM_UNAVAILABLE`. Today `generation.service.ts:751-775` selects
  that code from `roomAssignmentReason === 'SPECIALIZED_ROOM_UNAVAILABLE'`
  regardless of whether the real cause is a missing subject or missing
  qualified faculty. Make the code truthful to the actual cause.
- `ROOM_CAPACITY_EXCEEDED` stays **SOFT** and must never appear as a hard
  publication blocker.
- `LACKING_FACULTY` and `INCOMPLETE_MODULAR_GROUP` must carry truthful severity
  and actionable authority (a real consumer can resolve them), consistent with
  the promotion allowlist.
- `ZONE_IMBALANCE_WARNING` must either carry resolvable entities/actions in its
  `entities`/`meta`, or be retired with its producer and residue. Today
  `generation.service.ts:781-801` emits it with `entities: {}`.

### A6. Production-path parity
Equivalent generation, manual edit, Quick Place, pre-generation placement,
sync/setup, and publication-readiness recomputation inputs must produce
identical code/severity/entity results. No path may silently keep an old
threshold, an old emission multiplicity, or a retired code.

## 4. Failing-first controls (mandatory; these are the decisive gates)

Create/own one decisive suite at
`atlas-server/src/__tests__/tt-warning-realism-c07a.test.ts` (real
`validateHardConstraints` over a real three-term fixture using canonical
45-minute slots) that proves:

1. Two contiguous 45-minute periods → zero `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED`.
2. Three contiguous 45-minute periods (135 min) → zero warnings.
3. Four contiguous 45-minute periods → exactly one warning for the block, and
   its `entities.entryIds` name all four members.
4. A configured Health Break and a Lunch window reset consecutive blocks and
   add **zero** idle minutes; a genuine single unscheduled free period inside
   the shift is counted **once**.
5. Same-time overlaps still produce HARD conflicts; cross-term overlaps do not.
6. Ordinary Science in a CLASSROOM produces zero laboratory/lab-derived
   warnings; an explicit LABORATORY requirement with an unsuitable/missing room
   produces the correct typed, truthful warning.
7. No coordinate/distance field affects any warning (assert no
   distance/coordinate consumer exists on the warning path).
8. Equivalent generation / manual-edit / pre-generation inputs produce
   identical code/severity/entity multisets for the same schedule.

Every control must fail on the unmodified base behavior where the base is
wrong (run the control against `git stash`-free base reasoning or a mutant).

### Mutants (each must be caught by a decisive test)
- Per-entry consecutive emission (old loop behavior).
- Legacy 120-minute consecutive threshold.
- Break window counted as idle time.
- Distance/coordinate dependency in a warning.
- Implicit Science → LABORATORY inference.
- Missing subject → `SPECIALIZED_ROOM_UNAVAILABLE` (or whatever room warning).

Do not weaken or delete an existing assertion to make a mutant pass. Existing
suites must keep passing.

## 5. Combined gates (run and report exact results)

- `npx tsx src/__tests__/tt-warning-realism-c07a.test.ts`
- `npx tsx src/__tests__/timetable-warning-authority-c04.test.ts`
- `npx tsx src/__tests__/generation-authority-realism-c07.test.ts`
- `npx tsx src/__tests__/generation-authority-realism-c07-trigger.test.ts`
- `npx tsx src/__tests__/generation-authority-realism-c07-term-authority.test.ts`
- `npx tsx src/__tests__/timetable-candidate-domain.test.ts`
- `npx tsx src/__tests__/publication-contract-readiness.test.ts`
- `npx tsx src/__tests__/generation-canonical-readiness-genc02.test.ts`
- `npx tsc --noEmit` (or `npm run build`) for the server
- production build (`npm run build` → `dist/`)
- built-server startup smoke (start the built server on an isolated port; it
  must bind and answer, then stop). Do not touch 5001/5174.
- `git diff --check`
- Any existing suite that references a code you retire must be updated truthfully
  (never deleted to hide a defect). Inventory every updated assertion.

## 6. Boundaries (forbidden)

- No live data mutation, database/schema/migration action, generation,
  publication, deployment, runtime restart/task/env change, companion edit.
- No edits outside `atlas-server/**` and the docs you are explicitly asked for.
  Do **not** edit `atlas-client/**` (Lane B owns it) and do not edit
  `docs/plans/atlas-delivery-cycles.json` or the generated register.
- No `git push`, merge, rebase, reset, or stash. Commit only on
  `work/tt-warning-count-c07a`.
- Do not touch ports 5001/5174 or the running supervisor.

## 7. Deliverables and return contract

Commit the candidate with a conventional commit on `work/tt-warning-count-c07a`,
then return `REVIEW_REQUIRED` with:

- base SHA and candidate SHA;
- exact changed-path list;
- old vs new canonical warning counts for the fixture (per code);
- the policy-default derivation for the consecutive threshold;
- the retired-code inventory with the reachability verdict and evidence for
  each candidate family;
- promotion-allowlist parity confirmation (server set unchanged unless a
  justified change is evidenced);
- the requirement → production path → negative control → verification command
  trace table with each row PASS / BLOCKED / DEFERRED;
- mutant results;
- gates tally (total / passed / failed / blocked / unperformed);
- known risks classified BLOCKING or NON_BLOCKING.

Stop after the candidate commit; do not self-approve and do not integrate.
