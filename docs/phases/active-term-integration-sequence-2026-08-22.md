# Active Term Integration Sequence — 2026-08-22

## Purpose

This sequence integrates EnrollPro's active term state into ATLAS without weakening existing school-year, timetable, Teaching Load, or publish contracts. EnrollPro remains the master configuration node for the current term; ATLAS consumes that state to improve defaults, warnings, filters, exports, notifications, and downstream handoff clarity.

Run these prompts one at a time. After each prompt, stop and report back to Codex QA before continuing.

## Current confirmed evidence

Observed on 2026-08-22 against the configured EnrollPro API using the env-only `ENROLLPRO_SERVICE_TOKEN`:

- `GET /api/integration/v1/active-term` returned `200`.
- Response data was `activeTerm=T1`.
- Response data was `schoolYearId=2`.
- The integration key is stored in `.env` and `atlas-server/.env`, both gitignored.
- Tailnet ATLAS runtime verification works after server restart:
  - `/api/v1/runtime/context?schoolId=1&verifyUpstream=true`
  - `source=enrollpro-verified`
  - `upstream.reachable=true`
  - `upstream.verified=true`
  - `activeYearDrift.status=aligned`

Treat `T1` and `schoolYearId=2` as live evidence, not permanent constants. Every implementation and test must resolve active term and active school year dynamically.

## Sequence and gates

| Iteration | Prompt file | Scope | Gate to proceed |
|---:|---|---|---|
| 01 | `docs/prompts/active-term-01-runtime-contract-2026-08-22.md` | Backend active-term adapter and runtime context payload | Runtime context exposes normalized active term and safe fallback state |
| 02 | `docs/prompts/active-term-02-client-runtime-consumption-2026-08-22.md` | Client session/module pull through ATLAS runtime context | App shell and critical modules consume ATLAS runtime context instead of direct EnrollPro calls |
| 03 | `docs/prompts/active-term-03-timetable-defaults-and-guards-2026-08-22.md` | Timetable active-term defaults, filters, and edit warnings | Timetable defaults to active term without hiding all-term review |
| 04 | `docs/prompts/active-term-04-teaching-load-dashboard-readiness-2026-08-22.md` | Teaching Load and dashboard current-term focus | Current-term load/readiness is visible without changing saved Teaching Load truth |
| 05 | `docs/prompts/active-term-05-published-export-notification-contracts-2026-08-22.md` | Published schedule filters, workbook export defaults, and notification metadata | External-facing and export contracts can safely identify active-term scope |
| 06 | `docs/prompts/active-term-06-release-proof-and-doc-handoff-2026-08-22.md` | Documentation handoff and release proof | Tailnet evidence proves active-term behavior end to end |

## Global executor rules

- Do not write to EnrollPro.
- Do not let the frontend call EnrollPro directly; ATLAS server owns the integration-key call.
- Do not store the integration key in source, docs, browser storage, test artifacts, or screenshots.
- Do not hard-code active term or school-year IDs.
- Do not replace persisted `termIndex` schedule truth with EnrollPro's current active term.
- Do not resurrect the legacy `/schedules/published/:termId` ambiguity as the new term contract.
- Treat EnrollPro active term as a runtime default/current-state signal, not as historical schedule truth.
- Keep generated/published entries' own `termIndex` as the durable schedule field.
- If EnrollPro is unreachable, ATLAS must keep using saved school-year context and clearly mark active-term verification as unavailable.
- Preserve memory-sensitive latest-run and published-schedule read paths.
- Keep server runtime imports ESM-safe with explicit `.js` endings.

## Required final report format for each prompt

Executor must report:

1. `GO` or `NO-GO`.
2. Files changed.
3. Exact commands run and results.
4. Tailnet endpoint outputs used as proof.
5. Whether active term came from EnrollPro live verification or ATLAS fallback.
6. Any created artifacts and cleanup proof.
7. Remaining caveats.
8. Whether Codex QA can proceed to the next prompt.

## Suggested commit after all prompts

```text
feat(runtime): integrate EnrollPro active term across ATLAS
```
