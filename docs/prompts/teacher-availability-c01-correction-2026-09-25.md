# S1 — TEACHER-AVAILABILITY-AUTHORITY correction packet (2026-09-25)

Bounded correction over reviewed candidate `deaf181b`. Governing packet:
`docs/prompts/teacher-availability-c01-2026-09-25.md`; this addendum overrides where they differ.
Program `docs/plans/teacher-concern-authority-plan-2026-09-24.md`, stream **S1**, decisions **D1/D2**.

- Prior candidate (must remain an ancestor): `deaf181b0b1bf7dec312a6138b44964f51cec8b8`
- Branch / worktree (single writer): `work/teacher-availability-s1` / `E:/ATLAS-worktrees/teacher-availability-s1`
- Fresh independent QA returned `CORRECTION_REQUIRED` 7/8, blocked 1, unperformed 0.
- Do **not** amend, rebase or force-push. Add one new commit on top of `deaf181b`.

## R1 — BLOCKING: unresolved active term silently drops the HARD authority

`generation-preflight.service.ts:799-802` consumes `availabilityRead.preferences` and **never checks
`availabilityRead.ok`**. The reachable live state *valid ordered structure + `activeTerm: null`* does not
produce a derived-demand blocker, so generation runs with **zero `UNAVAILABLE` exclusions** — the HARD
authority is silently dropped. `loadReviewedAvailabilityForActiveTerm` (the fail-closed helper) has no
production consumer.

Fix one of (prefer the first):
- consume `loadReviewedAvailabilityForActiveTerm` for the active-term read, or
- when `availabilityRead.ok === false`, push a typed preflight blocker (reuse the existing term-authority
  family, e.g. `TERM_AUTHORITY_UNRESOLVED`/`TERM_AUTHORITY_STALE`, or add a code to the same union) so
  generation is refused rather than run without exclusions.

Requirements:
- Distinguish **unresolved term authority** (must block) from **resolved term with zero reviewed rows**
  (legitimate zero exclusions — must NOT block).
- Do not regress the path where a `termContract` is supplied (the term is resolved).
- Failing-first: with reviewed `UNAVAILABLE` rows present and `activeTerm: null`, the real
  `buildGenerationPreflight` (called as production calls it, `termContract` undefined) must include the
  blocker and `generateAllowed` must be false; a mutant that skips the `ok` check must run.

## R2 — scope the `availability` snapshot domain to the active ordered term

Plan §A defines the domain as the digest of reviewed slots **for the active term**; the candidate digests
the whole school year (over-invalidation: another term's edit marks runs STALE). Scope the domain read to
the resolved active ordered term. Keep it fail-closed: an unresolved term must not yield a "fresh"
domain.

## R3 — transactional version CAS on availability writes

`saveAvailabilityDraft` (and `submitAvailability`/`reviewAvailability` if they share it) pre-reads the row
outside the write transaction and then `update`s by id, leaving a lost-update window; an edit can also
reset a REVIEWED authority's version/status non-atomically. Re-read the row + version **inside** the write
transaction and fail `409 VERSION_CONFLICT` on mismatch, with zero writes (AGENTS verification gate 5).
Editing a reviewed authority back to DRAFT/SUBMITTED for re-review stays intended, but must be
CAS-guarded and explicit.

## Accepted residuals (do not expand scope)

- **R4 (NON_BLOCKING):** the infeasibility proxy can over-reject (it queries `facultySubject` without
  `schoolYearId` and sums `minMinutesPerWeek` across qualifications). Conservative, visible, recoverable —
  recorded as a successor, not fixed here.
- **SCHEMA_VERSION stays 3 (accepted):** the QA independently proved every pre-change run compares
  `STALE` (signal key sets differ), so no legacy run can be falsely `FRESH`; the distinct
  `SNAPSHOT_VERSION_MISMATCH` reason is forgone. Keep 3.

## Preserve / prove

- `deaf181b` remains an ancestor; reviewed paths **not** touched by R1–R3 keep their `deaf181b` blobs
  (state which changed and which are unchanged).
- Re-run: `npm run test:faculty-availability`, `npm run test:server-suite`, `npm run build`,
  `prisma validate`, `git diff --check`. The 4 pre-existing `tt-output-c03r` failures stay red and
  untouched.
- Fixture updates stay additive; never weaken or delete an assertion.
- Still forbidden: generation, publication, migration apply, deployment, login, companion-repo edits,
  and the S4-server lane's files.

## Evidence

One new commit (do not push). Handoff: prior candidate SHA · correction SHA · changed paths · what changed
and why · decisive commands with results · confirmation that `deaf181b` is an ancestor and unchanged
reviewed paths kept their blobs · each risk `BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`. Then a
fresh independent QA reviews the correction commit and its blast radius.
