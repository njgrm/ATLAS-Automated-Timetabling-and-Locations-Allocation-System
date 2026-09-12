# TT/TL runtime acceptance R3 — final pre-action audit

Role: `WAVE_COMPLETION_AUDITOR`

This is one fresh, read-only audit of the final HIGH packet. It is not an
executor task and authorizes no deployment, login, listener, environment, task,
database, generation, publication, or source mutation.

## Audit boundary

- Refresh `origin/main` and bind the review to the commit containing this file.
- Review the complete final packet:
  `docs/prompts/tt-tl-runtime-acceptance-2026-09-12.md`.
- Read `AGENTS.md`, `ops/runtime/README.md`, `ops/runtime/cli.mjs`, and the
  relevant row in `docs/plans/atlas-active-delivery-streams.md`.
- Recheck the live incumbent read-only: supervisor identity, exact listeners,
  health/readiness, Tailnet health, rollover-disabled state, and rollback
  artifact availability. Do not open or print the durable environment file.

## Mandatory findings matrix

Return a tally with every row PASS, BLOCKED, or UNPERFORMED:

1. The R3 target, durable release switch, boot-task update, and rollback match
   the real supervisor production contract.
2. Unknown listeners and target/build/pin mismatch fail closed before adoption.
3. The fresh QA/session custodian starts before the executor, owns one exact
   browser context throughout the cutover, and performs all authenticated rows.
4. Existing-session authority is zero-login and zero-mutation, actor/school
   scoped, has a 90-minute action budget plus 15-minute expiry margin, and is
   rechecked immediately before listener interruption.
5. An absent, wrong-school, unreadable-expiry, or insufficient-lifetime session
   stops before every listener/environment/task mutation.
6. Health and release identity evidence are separated correctly: health
   payloads do not claim `releaseSha`; supervisor status and installed Git HEAD
   do.
7. Executor, QA, and cleanup ownership are explicit; no second login or token
   transfer is implied.
8. The approval sentence authorizes every expected side effect exactly once and
   no forbidden Teaching Load, generation, publication, rollover, term-cache,
   migration, schema, companion, port-5175, or unrelated-process action.
9. The living register describes the same target, state, rollback, preflight,
   awaited return, and next action everywhere.
10. Current live preconditions have not drifted in a way that makes the packet
    unsafe or unsatisfiable.

## Verdict and return

Return exactly `AUDIT_CLEAR`, `CORRECTION_REQUIRED`, or
`EXTERNALLY_BLOCKED(<reason>)`, plus `mandatory total/passed/blocked/unperformed`,
the exact reviewed commit, checks actually run, reused evidence, findings by
severity, and the current live-precondition snapshot.

Do not edit files or propose integration. If `AUDIT_CLEAR`, return the exact R3
approval sentence from the packet to the primary planner. If correction is
required, return one bounded correction specification to the primary planner;
do not correct the packet yourself and do not start a recursive auditor.

`RETURN_TO_PRIMARY_PLANNER: validate this audit capsule and only then present or
withhold the R3 HIGH approval sentence.`
