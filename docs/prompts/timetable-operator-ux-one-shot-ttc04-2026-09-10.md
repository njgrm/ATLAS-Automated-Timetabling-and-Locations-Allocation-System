# TT-C04 — Timetable Operator UX One-Shot

## Objective

Make `/timetable` understandable and safe for older Scheduler Officers from pre-generation through review, without changing scheduling truth or performing a live generation/publication. The page must clearly distinguish input readiness, generation in progress, generated hard blockers, unassigned sessions, review, and published state.

## Workflow and Git boundary

- Risk tier: `MEDIUM` UI/source work; all timetable mutations are excluded.
- Start from current `origin/main` in a new clean worktree `D:/ATLAS-worktrees/timetable-ttc04` on branch `work/timetable-ttc04`. The executor creates the worktree and records the full base SHA.
- Read `AGENTS.md`, `ATLAS_AGENT_KI.md`, `phasePlan.md`, and the runtime source-of-truth map first.
- Maintain `docs/progress/timetable-ttc04-2026-09-10-progress.md` only.
- Use the commit-based workflow. Obtain one fresh advisory UX/accessibility review; if it finds material issues, fix them and obtain one changed-scope review.
- Commit the candidate; do not amend, rebase, merge, or push. Return the base SHA, candidate SHA, paths, evidence, risks, and `REVIEW_REQUIRED`.

## Current truth the UI must preserve

- Curriculum and Teaching Load inputs are ready for year 8, but no generated run exists.
- “552 individually previewable” is not “552 globally schedulable.”
- Hard violations and generated unassigned counts are unknown until the canonical generator runs.
- HG/Homeroom Guidance must not appear as timetable demand or teaching load.
- Generation, manual-save actions, and publication remain separate high-risk actions; this prompt authorizes none.

## Authorized work

1. Audit the real `/timetable` route and its production hooks/components at desktop 1280x720 and mobile 390x844.
2. Unify the operator-facing state model so exactly one primary next action is emphasized:
   - unresolved actor/year;
   - setup inputs blocked;
   - inputs ready but generation not started;
   - generation running/failed;
   - generated with hard blockers or unassigned sessions;
   - generated clean and ready for review;
   - published.
3. Replace misleading copy such as “all placeable” or “ready to publish” when only preview/readiness evidence exists. Explain the difference between individual previewability and a generated schedule in plain language.
4. Preserve the preview-only TT-C02 workflow: searchable/paginated access to all demand lines, no apply/save endpoint or enabled save control.
5. Make blockers actionable without overwhelming users: grouped plain-language issue, count, why it matters, and one repair destination. Keep advanced diagnostics progressively disclosed.
6. Preserve the no-scroll architecture, local scroll regions, existing three-panel review workspace, task-first SMART-family patterns, DepEd grade colors, keyboard behavior, touch targets of at least 44px, visible focus, screen-reader names, and non-color status text.
7. Ensure all state transitions clear stale selected run, collaboration, preview, error, and dialog state when actor school/year/run changes.

## Source boundary

May edit only `atlas-client/src/pages/ScheduleReview.tsx`, timetable client components/hooks/libs and their focused tests, a new browser test/config only if it does not collide with shared configuration, the ledger/review artifact, `CHANGELOG.md`, and the runtime source-of-truth map when warranted.

Server source is read-only. Do not edit generator, Teaching Load, curriculum, Subjects, dashboard, publication, auth, schema/migrations, recovery, or companion repositories. Do not touch shared `App.tsx` or global shell/design tokens unless a concrete blocker is reported to planner QA first.

## Mutation boundary

- Tailnet and localhost runtime checks are observation-only. Login audit/last-login effects may be disclosed; no other database write is allowed.
- Do not trigger generation, save a draft/manual edit, publish, restart port 5001, change `.env`, or mutate Tailscale.
- External repositories are `READ_ONLY`.

## Decisive gates

- Focused state-machine tests through the real page/hook path, including stale-state cleanup and zero-request behavior while actor scope is unresolved.
- Negative controls proving: no-run does not show generated counts; previewability does not become joint feasibility; failed/stale/historical runs cannot look reviewable/published; hard blockers and unassigned sessions cannot enable publish; HG never appears as demand.
- Client timetable/conflict/UX tests affected by the diff; client `tsc --noEmit`; client production build; `git diff --check`.
- Browser QA at 1280x720 and 390x844 using the isolated built candidate or an isolated preview port: login flow, keyboard-only primary path, 200% zoom-equivalent reflow, no horizontal/global overflow, no mojibake, no application errors, and no write request dispatch.
- Do not run broad unrelated suites.

## Completion contract

Return `REVIEW_REQUIRED` with before/after state matrix, exact browser evidence, accessibility findings, source/runtime boundary proof, and remaining product risks. Never declare a schedule generated, clean, or publishable without a real generated-run response.

Suggested commit:

```text
fix(timetable): clarify generation and review workflow states
```
