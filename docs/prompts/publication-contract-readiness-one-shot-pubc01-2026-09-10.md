# PUB-C01 — Publication Contract Readiness One-Shot

## Objective

Harden the ATLAS publication boundary and downstream published-schedule contracts before any live schedule is generated. This pass is source, hermetic-test, and read-only runtime work only; it must not publish or mutate a schedule.

## Workflow and Git boundary

- Risk tier: `MEDIUM` source implementation. Actual publication remains `HIGH` and excluded.
- Start from current `origin/main` in a clean worktree `D:/ATLAS-worktrees/publication-pubc01` on branch `work/publication-pubc01`. The executor creates the worktree and records the full base SHA.
- Read `AGENTS.md`, `ATLAS_AGENT_KI.md`, `phasePlan.md`, `docs/reference/atlas-runtime-source-of-truth-map.md`, and the existing AIMS/SMART handoffs first.
- Maintain `docs/progress/publication-pubc01-2026-09-10-progress.md` only.
- Use the commit-based workflow. Obtain one fresh advisory review; after material fixes, obtain one changed-scope review.
- Commit the candidate; do not amend, rebase, merge, or push. Return base/candidate SHAs, exact paths, decisive tests, consumer impact, risks, and `REVIEW_REQUIRED`.

## Publication authority to enforce

A schedule may become published only when the selected run belongs to the authenticated actor’s exact school and runtime-active year, is `COMPLETED`, is current against the authoritative curriculum/term configuration, Teaching Load cycle/ownership, scheduling policy, faculty/section/room inputs, has zero hard violations, and has zero required unassigned sessions. A FAILED, stale, historical, cross-school, partial, preview-only, or missing run must never publish.

Published reads must expose only the exact current published revision and its ordered three-term schedule. Public/student routes remain unauthenticated; privileged publication mutation remains authenticated and school-scoped. AIMS and SMART are read-only consumers of ATLAS contracts and their repositories must not be edited.

## Authorized work

1. Trace production publish command, revision creation, current published-run resolution, public school/section/faculty/room reads, SSE/notification emission, and downstream contract serialization.
2. Consolidate the publication eligibility decision into one server-owned service contract used by the real publish route. Remove divergent truth checks without weakening any existing guard.
3. Bind publication to exact actor school, runtime active year, run identity/version, current source revisions, zero hard violations, and zero required unassigned sessions. Fail closed with typed errors for unavailable, stale, ambiguous, malformed, or cross-scope inputs.
4. Make the write atomic and idempotent: publication marker, immutable published revision, audit/event metadata, and notification occur only after all in-transaction revalidation succeeds. If existing architecture cannot guarantee atomic notification delivery, preserve database atomicity and record the exact post-commit delivery limitation rather than claiming otherwise.
5. Preserve query-shaping rules: select lightweight candidate metadata first and load only the resolved published payload; never scan every heavy `draftEntries`/`violations`/`unassignedItems` JSON blob. Preserve effective revision ordering.
6. Verify public endpoints and AIMS/SMART-facing payloads remain school/year/term scoped and backward compatible. Produce ATLAS-owned developer handoff updates if consumers need changes; do not edit companion clones.
7. Keep the live zero-run state truthful: read-only runtime probes must return no published current-year schedule and must not fabricate readiness.

## Source boundary

May edit only published-schedule/revision services and routers, the narrow publish portion of generation service/router when unavoidable, publication events/notification adapter, focused server tests, ATLAS-owned AIMS/SMART handoff documents, the ledger/review artifact, `CHANGELOG.md`, and runtime source-of-truth map.

Do not edit Teaching Load, curriculum, Subjects, timetable client UI, dashboard client/server, auth implementation, schema/migrations, backup/recovery, or companion repositories. If schema change appears necessary, stop and report it; do not create a migration.

## Mutation boundary

- School 1/year 8 and port 5001 are read-only. Do not publish, generate, create a revision, restart services, change configuration, or emit a real notification.
- Use hermetic/in-memory tests or uniquely scoped disposable fixtures with guaranteed `finally` cleanup and zero residue. No credential or personal-data copies.
- External repositories are `READ_ONLY`; no install, format, generated-file update, commit, or pull of a dirty clone.

## Decisive gates

- Failing-first production-route tests for: no run, FAILED run with stale publish markers, historical year, cross-school actor, stale source revision, hard violation, unassigned required session, concurrent publish, duplicate replay, and notification failure boundary.
- Positive disposable fixture: exact active-year COMPLETED current run with zero hard/unassigned becomes one immutable revision; replay creates no second revision/event/audit.
- Query-shape test proving the resolver does not load heavy payloads while choosing a candidate and preserves entry ordering.
- Public route contract tests for school, term, section, faculty external ID, and room; unauthenticated reads versus privileged write auth.
- Relevant publication/event tests; server `tsc --noEmit`; server production build; built runtime smoke; `git diff --check`.
- Read-only Tailnet matrix confirming zero current-year published schedule and no mutation.
- Do not run broad recovery or unrelated UI suites.

## Completion contract

Return `PUBLICATION_SOURCE_READY` only if the source and hermetic route contract is closed; this is not authorization to publish. Otherwise return `PUBLICATION_BLOCKED` with exact gaps. Final status is always `REVIEW_REQUIRED`; actual publication requires a later fingerprinted preview, independent pre-action review, and explicit operator approval.

Suggested commit:

```text
fix(publication): enforce exact current-run publish authority
```
