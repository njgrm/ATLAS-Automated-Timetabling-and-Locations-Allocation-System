# ATLAS Rollover, Derived Demand, and Generation Readiness Sequence

Status: `READY_FOR_WAVE_1`

## Product decision

The operator-facing Curriculum Requirements workflow is retired as a required
annual task. EnrollPro owns the active school year and its ordered term
contract. ATLAS Subjects own reusable scheduling metadata. ATLAS derives the
current-year subject-section-term demand deterministically and stores only
internal evidence needed for concurrency, audit, and reproducibility.

Schedulers shall not re-enter EnrollPro term identities, classify hundreds of
annual requirement rows, or approve a second copy of curriculum authority.
Actual metadata gaps shall appear as focused Subject exceptions.

## Final authority model

| Domain | Authority |
|---|---|
| Active year, term format, ordered terms, labels, dates, active term | EnrollPro |
| Sections, programs, enrollment, advisers | EnrollPro, mirrored by ATLAS |
| Subject code/name, scope, minutes, room needs, rotation family/order, scheduling participation | ATLAS Subject catalog |
| Current-year demand | Deterministic derivation from the two authorities above |
| Faculty ownership | ATLAS Teaching Load |
| Generated schedule and publication | ATLAS immutable run/revision evidence |
| Existing SchoolYearTermConfig and SchoolYearOffering rows | Historical evidence during transition, never current operator authority |

Homeroom Guidance remains visible in the Subject catalog but is explicitly
`REFERENCE_ONLY`. It creates no timetable demand and no Teaching Load rows;
advisory credit remains the workload representation.

## Dependency graph

```text
Wave 1 (parallel)
  RR-UX01 ───────────────────────────┐
  TERM-SUBJ-C01 ──┬── DEMAND-C01 ───┼── TL-RR01 ──┐
  GEN-ZW01 ───────┘                  │             ├── GEN-C02 ── live generation gate
                                     └── UX-C01 ───┘

After zero-hard-blocker generation
  publication preview -> independent QA -> explicit HIGH approval -> publish
```

## Wave 1: start concurrently from fresh origin/main

### RR-UX01 — rollover awareness and historical Teaching Load

Make rollover visible, refresh active-year context, consolidate Year Setup,
and expose archived Teaching Load as a local read-only history view. Do not
copy or reconcile Teaching Load. Do not edit the existing faculty-assignment
router/service in this parallel wave; use a new read-only history service and
router so GEN-ZW01 owns the mutation/audit surface exclusively.

Prompt: `docs/prompts/rollover-rrux01-awareness-history-2026-09-10.md`

### TERM-SUBJ-C01 — EnrollPro term and Subject scheduling authority

Normalize EnrollPro terms, add explicit Subject scheduling disposition, and
make Subject rotation resolve against the verified term contract. Do not yet
switch every demand consumer or remove the legacy UI; that follows after the
authority contract is accepted. A migration may be authored and tested only
against a disposable database. Live migration remains separately `HIGH`.

Prompt: `docs/prompts/term-subject-c01-enrollpro-authority-2026-09-10.md`

### GEN-ZW01 — generation purity and Teaching Load audit closure

Remove every generation-time Teaching Load repair/write. Retire direct
mutating auto-fill and make affected Teaching Load writes actor-bound,
transactional, and durably audited. No live apply or generation.

Prompt: `docs/prompts/generation-zw01-passive-authority-2026-09-10.md`

## Wave 2: after Wave 1 acceptance and integration

### DEMAND-C01 — one derived demand contract

Create one set-based current-year demand service using the verified EnrollPro
term contract, active section mirrors, and scheduled Subjects. ALL subjects
occur in every term; rotating subjects occur only in their configured family
term; reference-only subjects never occur.

Teaching Load reconciliation, allocation, Timetable preview, and generation
shall consume the same semantic demand revision and agree on totals. Current
year generation shall ignore manually authored SchoolYearOffering rows.
Passive reads shall perform zero writes. This cycle supersedes the stale
`work/generation-genc01` implementation rather than rebasing it blindly.

### UX-C01 — remove redundant Curriculum Requirements workflow

Remove Curriculum Requirements and Decision Workspace from normal navigation.
Redirect their legacy URLs to the Subjects scheduling view for one compatibility
release. Remove manual term/requirement mutation UI. Dashboard and Timetable
shall distinguish Subject configuration, derived demand, Teaching Load, and a
generated schedule without contradictory counts or status language.

UX-C01 begins only after DEMAND-C01 makes the replacement workflow real.

## Wave 3: after derived demand is authoritative

### TL-RR01 — audited prior-year Teaching Load carry-forward

Allow an officer to select a same-school archived source year and preview a
fill-empty-only mapping into the sole active year. Match sections by canonical
grade + program + normalized section name, never old external IDs. Match
faculty by stable external identity. Intersect with current derived demand,
exclude reference-only subjects, reject stale/inactive/cross-school faculty,
preserve occupied targets, and recheck qualification and hard caps.

Preview is zero-write. Apply requires an exact revision/fingerprint,
confirmation, one Serializable transaction, one audit, idempotent replay, and
a separate `HIGH` approval. Source history is immutable.

### GEN-C02 — canonical generation readiness and dry run

Wire the shared derived demand into input assembly and close the GEN-C01 split
(`catalog computeDemand` versus persisted offering demand). Resolve grade-window
and class-program-slot data gaps without inventing rules. Run only a read-only
canonical dry-run until the resulting preview has zero hard blockers.

## Wave 4: live high-risk actions

1. Produce a fresh generation preview bound to the active school, year, term
   revision, Subject revision, section revision, Teaching Load cycle, rooms,
   policies, and current source commit.
2. Obtain independent QA and explicit operator approval.
3. Generate once; classify and correct every hard blocker without publishing.
4. Repeat until a completed run has zero hard violations and zero unresolved
   sessions.
5. Produce a publication preview, obtain independent QA and separate explicit
   approval, then publish.

## Parallel source ownership

| Stream | Exclusive source ownership in Wave 1 | Must not touch |
|---|---|---|
| RR-UX01 | notification delivery/client rebinding, AppShell, Year Setup, new history read service/router, Teaching Load history UI | Subject/term adapters, generation, TL mutators |
| TERM-SUBJ-C01 | Prisma Subject disposition migration, EnrollPro term normalization, Subject service/router/form | AppShell, Year Setup, generation, TL, Dashboard/Timetable workflow |
| GEN-ZW01 | generation purity, TL auto-fill/proposal/manual-save audit paths | Subject schema/form, rollover/UI/history, demand convergence |

`CHANGELOG.md` and the runtime source-of-truth map are expected integration
conflicts and are resolved once by the integration owner. No executor resolves
cross-stream conflicts or pushes main.

## Worktree and QA policy

- Create each worktree from freshly fetched `origin/main`.
- Use branches `work/rollover-rrux01`, `work/term-subject-c01`, and
  `work/generation-zw01`.
- Each executor commits an immutable candidate and returns base/candidate SHAs.
- A separate QA task reviews the exact range and returns `ACCEPT_READY`,
  `CORRECTION_REQUIRED`, or `PLANNER_DECISION_REQUIRED`.
- Corrections are new commits; never amend reviewed history.
- The integration owner merges accepted candidates on an integration branch,
  runs cross-stream gates once, and pushes main.
- Database migrations, live Teaching Load apply, generation, and publication
  remain separate `HIGH` approvals.

## Coordination model

One Codex planner can supervise three workers at once, but end-to-end execution
is more reliable as three user-visible Codex tasks, one per Wave-1 stream. The
current task remains the integration planner and can inspect, message, and wait
for those tasks directly, eliminating manual report relay. External OpenCode
sessions cannot be observed by Codex; if they are used, the user must return at
least the worktree, branch, base SHA, and candidate SHA.

