# UX-C01 — Derived Setup Operator UX One-Shot

## Objective

Remove the superseded annual Curriculum Requirements/Decision Workspace from
the normal operator journey. Present one understandable setup sequence based on
EnrollPro year/terms, ATLAS Subject scheduling metadata, derived demand,
Teaching Load, generation, review, and publication. An older scheduler must not
be asked to re-enter terms or approve hundreds of duplicated curriculum rows.

## Git and safety boundary

- Create/reuse an isolated worktree and neutral branch from current
  `origin/main`; record the exact base SHA and require a clean worktree.
- Do not amend, rebase, merge, or push. Commit one immutable candidate and
  return `REVIEW_REQUIRED`.
- Own client navigation/routes, Subjects setup guidance, Dashboard setup copy,
  Timetable readiness presentation, narrowly required read-only Dashboard
  aggregation, focused tests, progress/handoff docs, and `CHANGELOG.md`.
- Do not edit generation algorithms, Teaching Load write paths, carry-forward,
  Prisma schema/migrations, authentication, publication writes, or companion
  repositories.
- No live writes, generation, publication, migration, deploy, or port-5001
  restart.

## Required product behavior

1. Remove Curriculum Requirements and Decision Workspace from navigation,
   action menus, cards, empty states, onboarding, and routine links.
2. For one compatibility release, legacy client URLs such as
   `/subjects/requirements` and its decision route must replace-redirect to the
   Subjects scheduling view with concise context; they must not mount mutation
   UI or dispatch legacy requirement requests.
3. Keep the historical server tables/routes untouched unless a read-only
   compatibility response is strictly necessary. Do not delete historical data
   or silently redirect write APIs.
4. Make Subjects the setup surface for ATLAS-owned metadata: participation,
   scope, minutes, rotation, and room needs. Clearly label EnrollPro-owned year
   and ordered terms as read-only source data.
5. Dashboard and Timetable readiness must use derived-demand authority, not
   `evaluateCurriculumReadiness`, annual offerings, or term-config rows. Show:
   EnrollPro structure, Subject metadata exceptions, derived demand totals,
   Teaching Load coverage, then generation state.
6. Replace every operator-facing “Curriculum Requirements” blocker/repair link
   with the smallest true repair action: refresh/sync EnrollPro terms, fix a
   named Subject metadata exception, reconcile Teaching Load, or generate.
7. A blocked or unavailable derived-demand read must remain blocked/unavailable;
   never present zero demand, readiness, or a generation action.
8. Keep one primary action per state, progressive disclosure for technical
   details, plain language, 44px touch targets, mobile usability, no mojibake,
   and no wall-of-text setup page.
9. Preserve historical deep links as non-mutating redirects and preserve all
   actor-school/no-fallback behavior.

## Required controls and QA

- Failing-first scans proving no normal client route/link/copy dispatches or
  advertises Curriculum Requirements/Decision Workspace.
- Mounted/production-path checks proving Dashboard and Timetable consume the
  same derived revision/blockers as generation and Teaching Load.
- Negative controls for unresolved actor school, missing/invalid term cache,
  Subject metadata gaps, derived-demand drift, and EnrollPro unavailability.
- Client route/navigation, Dashboard lifecycle, Timetable capability, Subjects,
  server derived-demand/readiness, both TypeScript checks, both builds, and
  complete-range diff-check.
- Isolated browser QA at 1280x720 and 390x844: login/redirect/setup navigation,
  every visible action, overflow, concise explanations, and zero mutation
  requests. Use Tailnet only if the accepted source is already deployed;
  otherwise label isolated evidence honestly.
- One fresh independent changed-scope review; correction findings become
  additive commits and fresh QA.

Return the base/candidate SHAs, exact changed paths, before/after operator
journey, test/browser evidence, remaining risks, and zero-live-mutation
statement.
