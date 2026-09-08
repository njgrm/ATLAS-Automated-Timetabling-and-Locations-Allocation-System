# Prompt SCA-03E-R2 — Semantic Source-Revision Closure

Date: 2026-09-08  
Risk: MEDIUM  
Execution target: same DeepSeek executor session is acceptable  
Time budget: 30 minutes  
Verdict boundary: `REVIEW_REQUIRED`; never formal `GO`  
Repository: `D:/ATLAS` only

## Objective

Close the remaining stale-draft authority bypass in SCA-03E-R. Keep all
curriculum candidates unapproved by code, but bind exported/restored decision
drafts to a canonical hash of every semantic source value that can change the
candidate set or its meaning.

SCA-04 remains locked. This prompt authorizes no term/configuration write,
requirement apply, Teaching Load mutation, generation, publication, schema
change, migration, service restart, or external-repository edit.

## Mandatory reads

Read `AGENTS.md`, `ATLAS_AGENT_KI.md`, `phasePlan.md`, the runtime
source-of-truth map, the SCA sequence, SCA progress ledger, SCA-03E-R prompt and
manifest, the SCA-03E-R report/review, and every allowed production/test file.
Run `git status --short` first and preserve all concurrent TL/TT/EVAL work.

## Verified defect

The current `DraftSourceRevision` contains only counts and two max timestamps:

- active subject/section/ownership/requirement counts;
- maximum subject and ownership `updatedAt`.

It does not bind section identity/grade/program/name/version, term-config
contents/version, persisted requirement semantics/versions/term assignments,
or a canonical identity-level ownership snapshot. Same-count changes can leave
the revision equal, allowing a stale draft to restore successfully. The current
restore validator also accepts unknown top-level, revision, term, and row
fields despite describing itself as strict.

## Tasks

### SCA-03E-R2.0 — Preflight (LOW)

- Verify the SCA-03E-R production constant removal remains intact.
- Record allowed-file hashes, current listener identity, and a read-only live
  data signature. Do not restart or mutate the runtime.

### SCA-03E-R2.1 — Canonical semantic revision (MEDIUM)

- Produce a server-owned `sourceRevisionHash` using the existing canonical JSON
  and SHA-256 utility; do not duplicate hash logic.
- Canonicalize and stably order every semantic source consumed by candidate or
  draft meaning, including:
  - subject identity, code, name, active state, grade/program scopes, weekly
    minutes, and rotation metadata;
  - active section identity, external identity, name, grade, program fields,
    active/stale state, and version or relevant timestamps;
  - ownership identity, subject, section, faculty, and version/timestamp;
  - current term-config identity, term count, ordered term identities, active
    state, and version/timestamp;
  - active persisted requirement identity and all applicability,
    classification, minutes, rotation, active/version fields;
  - persisted requirement term assignments in deterministic order.
- Include school and school-year identity in the hash domain.
- Keep counts/timestamps as diagnostic fields only. They must not be the
  equality or authorization gate.
- Query shape must be batched/set-based; no per-row database loop.

### SCA-03E-R2.2 — Strict draft envelope (MEDIUM)

- Version the draft format forward if its contract changes.
- Bind export and restore to the exact `sourceRevisionHash` string plus school
  and school year.
- Reject absent, null, blank, malformed, wrong-type, or mismatched hashes.
- Reject unknown top-level, source-revision, term-draft, and row fields; reject
  duplicate JSON keys before `JSON.parse` without treating key-looking text in
  strings as fields.
- Validate all numbers, strings, enums, rotation values, and term identities
  without coercion.
- Apply restored state only after the complete document validates. A failure
  must leave the current UI draft unchanged and display one actionable error.

### SCA-03E-R2.3 — Negative controls (MEDIUM)

Add failing-first coverage proving the hash changes—and an old draft is
rejected—after same-count mutations to each relevant class:

1. section grade/program/name or identity;
2. ownership faculty/subject/section association;
3. subject scopes/minutes/rotation/name;
4. term count or ordered identities;
5. requirement classification/minutes/scope/rotation;
6. requirement term assignment replacement;
7. delete-and-recreate with equal counts;
8. cross-school or cross-year substitution.

Also prove unknown/duplicate fields fail closed, a semantically identical
reordered database result hashes identically, and no code-matched subject gains
authority. Include a mutant demonstrating the suite fails if it falls back to
count/max-timestamp equality.

### SCA-03E-R2.4 — Read-only UX/runtime proof (MEDIUM)

- Preserve bulk decisions, preview, export, and restore.
- Show a short source-revision identifier and explain that source changes
  invalidate saved drafts.
- Verify desktop and 390px Tailnet rendering read-only. If watcher freshness
  cannot be proven, label it `PENDING_DEPLOY`; do not restart.
- Prove before/after signatures for term configs, requirements, term
  assignments, ownership, Teaching Load, runs, and publication are identical.

### SCA-03E-R2.5 — Reconcile and review (MEDIUM)

- Update the SCA ledger with exact RED/GREEN evidence, files, hashes, commands,
  counts, query shape, and zero-write proof.
- Obtain one fresh advisory review. Fix material findings and repeat only after
  fixes. Stop when the newest review reports zero material findings.
- Return `REVIEW_REQUIRED`; the reviewer cannot unlock SCA-04.

## Allowed edit boundary

- `atlas-server/src/services/curriculum-decision-candidates.service.ts`
- `atlas-server/src/__tests__/curriculum-decision-candidates.test.ts`
- `atlas-client/src/lib/decision-draft.ts`
- `atlas-client/src/lib/__tests__/decision-draft.test.ts`
- `atlas-client/src/pages/DecisionWorkspace.tsx`
- `atlas-client/src/components/decision-workspace/DraftPreviewPanel.tsx`
- `docs/progress/subjects-curriculum-authority-2026-09-07-progress.md`
- `docs/reviews/subjects-curriculum-authority-2026-09-07/**`

If a route signature must change, stop and report the exact required router
hunk rather than editing outside this boundary. Do not touch `App.tsx`,
`CurriculumRequirements.tsx`, TL/TT/EVAL/dashboard/generation files, schema,
migrations, auth, backup/recovery, `.env`, or companion repositories.

## Focused gates

Run only the candidate suite, decision-draft suite, server/client TypeScript,
one client build if client production changed, `git diff --check`, one query-
shape assertion, and one bounded read-only Tailnet matrix. Do not run historical
recovery, full Teaching Load, timetable, or broad repository suites.

## Exit criteria

Return `REVIEW_REQUIRED` only when semantic same-count changes invalidate the
draft; equivalent ordering does not; strict unknown/duplicate-field checks
hold; code-owned authority remains absent; all focused gates pass; live data is
unchanged; and the latest fresh advisory review has zero material findings.

At 30 minutes, finish the current atomic check, reconcile honestly, and stop.
Do not begin a new test family or review iteration after the budget.

Suggested commit after planner acceptance:

```text
fix(curriculum): bind decision drafts to semantic source revisions
```
