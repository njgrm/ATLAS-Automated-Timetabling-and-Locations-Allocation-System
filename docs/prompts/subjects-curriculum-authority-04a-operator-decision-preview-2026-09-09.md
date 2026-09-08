# Prompt SCA-04A — Operator Decisions and Current-Year Apply Preview

Date: 2026-09-09
Risk: HIGH authority preview; this prompt authorizes zero data mutation
Entry gate: planner-accepted RC-02D live acceptance

## Goal

Use the deployed Curriculum Requirements workflow to capture explicit operator
decisions for the active school year and produce one fresh, complete,
fingerprinted apply preview. Stop before writing term configuration or
curriculum requirements.

## Required reading

- `AGENTS.md`, `ATLAS_AGENT_KI.md`, `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/prompts/atlas-core-readiness-next-sequence-2026-09-09.md`
- `docs/progress/atlas-core-readiness-next-sequence-2026-09-09-progress.md`
- `docs/progress/subjects-curriculum-authority-2026-09-07-progress.md`
- the SCA-03E/R/R2/R3 prompt and review artifacts committed in RC-02

## Git and tracking contract

- Start a fresh clean worktree on `work/curriculum-sca04a` from the
  planner-accepted RC-02D base.
- Do not work on, merge, or push `main`.
- Use the existing shared core ledger plus the Subjects/Curriculum ledger; keep
  updates concise and non-duplicative.
- This is an interactive decision prompt. Do not infer missing choices from
  catalog codes, templates, historical year 7, ownership, or current teacher
  assignments.
- Commit only source changes that are strictly necessary to make the reviewed
  decision workflow function, their focused tests, and concise ledger/report
  updates. Ordinary evidence is identified by the commit SHA, not per-file hash
  inventories.

## Fixed authority rules

- Actor school and active year come from authenticated runtime context. Never
  hardcode school 1 or year 8 in product logic.
- EnrollPro owns school-year, section, and faculty identities; it no longer
  supplies subject offerings.
- ATLAS owns the subject catalog, term configuration, and active-year Curriculum
  Requirements.
- Existing Teaching Load ownership is suggestion evidence only.
- The current setup may contain two specialization subjects for a class, but no
  exact-two rule may exist in code, schema, validation, or generation.
- Preserve the six explicit decisions already recorded: G10 Silver Applied
  Physics and Robotics specialization; G10 Silver Research excluded; G7-G9 STE
  Research preserved. Revalidate these against current source revision rather
  than silently importing a historical fingerprint.

## Operator decisions required

Capture, without guessing:

1. term count and ordered term identities for active year 2029-2030;
2. rotation behavior for each rotating family;
3. confirm or reject each candidate requirement, using bounded bulk actions only
   when the operator explicitly selects the scope;
4. classification and applicability for every confirmed requirement;
5. any section/cohort override and its exact scope.

If any decision is missing, finish safe validation and return
`DECISION_REQUIRED` with the smallest actionable list. Do not manufacture a
default.

## Tasks

1. Verify RC-02D acceptance and current runtime/source identity.
2. Reproduce the live decision workspace at desktop and mobile sizes. Confirm
   saved-draft import is bound to school, year, exact candidate row set, and
   semantic `sourceRevisionHash`.
3. Guide the operator through the five decision groups above. Treat ownership-
   derived suggestions as unapproved until explicitly confirmed.
4. Build a read-only preview through the production service/route. It must bind
   all semantic rows, before values, term ordering, classifications,
   applicability, source revision, expected versions, exact creates/updates/
   retires, rollback, and downstream demand totals.
5. Re-read the source domain and prove the preview is unchanged. Any drift makes
   it non-applicable.
6. Verify zero writes to term configs, requirements, term assignments, Teaching
   Load, generation runs, revisions, catalog, sections, and faculty authority.
7. Run only focused curriculum decision/preview tests, server/client TypeScript,
   affected build, and real-route negative controls for missing decisions,
   cross-school/year scope, stale revision, duplicate identities, and malformed
   drafts.
8. Write one canonical preview JSON plus sidecar SHA-256 because the next action
   is a HIGH-risk data apply. The fingerprint must authorize no mutation until
   the user sends the exact approval sentence printed by this prompt.
9. Commit the bounded candidate and return its base/candidate SHAs.

## Stop boundary and verdict

- With incomplete decisions: `DECISION_REQUIRED`; offer no approval sentence.
- With complete decisions and stable preview: `APPROVAL_REQUIRED`; print exactly
  one approval sentence binding the semantic fingerprint, actor school, active
  year, and `curriculum term/configuration apply only` scope.
- Never apply rows, start TL-C02/TT-C02, generate, or publish in SCA-04A.

Suggested commit:

```text
docs(curriculum): prepare active-year authority apply preview
```
