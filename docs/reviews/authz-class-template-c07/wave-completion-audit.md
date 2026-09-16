# AUTHZ-CLASS-TEMPLATE-C07 — Wave Completion Audit capsule (round 1, reconstruction)

> **Provenance:** this capsule is a **planner-committed reconstruction**. The round-1
> audit ran and its findings were recorded in the machine register, but its capsule
> file was never committed (wave-auditor finding N-12 of the corrected round). The
> content below is reproduced from the round-1 auditor return and the register
> transition it drove (commit `e3455c36`). No fact is invented; anything the
> reconstruction cannot attest is marked `NOT RECORDED`.

## Identity

| Field | Value |
| --- | --- |
| Role | `WAVE_COMPLETION_AUDITOR` (fresh, read-only, adversarial) |
| Auditor task/session id (returned to the planner) | `ses_f58b9c3ecffe4gjMsMO3g8sB7O` |
| Model / reasoning variant | `opencode-go/deepseek-v4.1-flash` / `max` |
| Stream audited | `AUTHZ-CLASS-TEMPLATE-C07` |
| Base / candidate | `917da8be1c0dea13e2a5062f3883cce82c829384` → `19f217294c5224d62e33c4d29e7d7cde26ca9a1e` |
| Integration merge | `f5731fc79c71140a34609eea4221022f9ccfd416` |
| `origin/main` at dispatch | `76b2536f6743564cce0e2296aaa80e920f7fb205` |
| `origin/main` observed at audit | `3317289995d3bc5c76353821afe9f00a12e1488f` (advanced mid-audit by `EXPORT-PRESENTATION-SCHEMA-GUARD-C06B`; `f5731fc7` contained in both) |
| Changed paths | 5/5 — `atlas-server/src/routes/class-template.router.ts`, `atlas-server/src/services/class-template.service.ts`, `atlas-server/src/__tests__/class-template-authority-c07-guard.test.ts`, `atlas-server/src/__tests__/class-template-authority-c07.test.ts`, `docs/handoffs/authz-class-template-c07-executor.md` |

## Verdict

**`CORRECTION_REQUIRED`** — auditor area tally `14 / 10 / 4 / 0 / 0`
(IDENTITY 3/3, PRODUCTION_PATH 7/7, CROSS_LAYER_CONSUMER 0/2, LIVE 0/1,
REGISTER_CONTINUITY 0/1). Reused (not rerun) the round-1 QA `ACCEPT_READY`
18/18/0/0/0 (`ses_f58c2d108ffeOLCxB5fDoWojBI`).

## Findings

| Id | Severity | Finding | Planner adjudication |
| --- | --- | --- | --- |
| F1 | BLOCKING (live) | The deployed release `54dce67b` still serves the pre-fix unauthenticated cross-tenant write-on-read `class-template` router; no packet closed it. | **Accepted as a disclosure obligation, not a product defect of this cycle.** The activator explicitly forbade deployment/login/live-data action, so the live exposure is recorded as an open, locked HIGH successor (`AUTHZ-CLASS-TEMPLATE-LIVE`, NOT granted) and nothing in the register claims the deployed boundary is corrected. Independently re-confirmed twice (deployed router blob `2b77bbee` == base `917da8be`). |
| F2 | BLOCKING (tenant isolation) | `subjectIds` were never bound to the actor school: a school-A officer could bind a school-B `subjectId` and read that foreign subject's `code`/`name` back through their own `GET /class-templates?schoolId=<actor>`. | **Accepted** → corrected in `AUTHZ-CLASS-TEMPLATE-C07R1` (R2). |
| F3 | BLOCKING (rendered truth) | Removing the write-on-read seeding made `templates: []` reachable while `atlas-client/src/pages/Audit.tsx` still rendered a green "Sections have required coverage" claim. | **Accepted** → corrected in `AUTHZ-CLASS-TEMPLATE-C07R1` (R3). |
| F4 | BLOCKING (register continuity) | The `AUTHZ-CLASS-TEMPLATE-C07` row's `nextAction` instructed steps its own structured fields recorded as done. | **Accepted** → rewritten at register revision 136. |

Non-blocking observations recorded by that audit: concurrent `POST /class-templates/initialize`
can surface Prisma `P2002` (zero residue, no fail-open; the `@@unique([schoolId, programType])`
constraint covers the invariant); create + audit share one transaction; `PATCH` cannot retarget a
row across schools; the `GET /:id` 403/404 discrimination is identifier-only; the retained
`ensureTemplatesForProgramTypes` writer is unreachable (zero production callers).

## Live-precondition snapshot (round 1, read-only)

Release `54dce67b` (dir HEAD, clean); supervisor PID 4020; server PID 13244 → 5001; host PID 13260 →
5174; `dist/server.js` serves the pre-fix router. No mutation performed.

## Required planner action (as issued)

Adjudicate the four blocking findings, amend the packet, dispatch the bounded correction, and
prepare the R1 HIGH packet for exact operator approval.

## Disposition

Findings F2/F3/F4 were closed by the bounded correction round `AUTHZ-CLASS-TEMPLATE-C07R1`
(candidate `dd8faf6b`, merge `d15be919`), audited `AUDIT_CLEAR` — see
`docs/reviews/authz-class-template-c07r1/wave-completion-audit.md`. F1 remains an open, locked,
NOT-granted HIGH successor.
