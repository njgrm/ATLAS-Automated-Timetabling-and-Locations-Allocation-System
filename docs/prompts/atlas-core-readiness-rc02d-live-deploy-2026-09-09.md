# Prompt RC-02D — Live Deployment and Tailnet Acceptance

Date: 2026-09-09
Risk: MEDIUM operational; production-data mutation forbidden
Required base: `4559eb13bbd371dd7945b39128f8c0dcdacd430a`

## Goal

Serve the merged RC-02 code through the existing ATLAS Tailnet runtime and
prove the Subjects/Curriculum, Teaching Load, Timetable, and Dashboard paths are
the reviewed implementation. This prompt does not configure curriculum,
allocate Teaching Load, generate a timetable, or publish anything.

## Required reading

Read completely before acting:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/prompts/atlas-core-readiness-next-sequence-2026-09-09.md`
- `docs/progress/atlas-core-readiness-next-sequence-2026-09-09-progress.md`

## Git and tracking contract

- Work in a fresh isolated worktree on `work/core-rc02d` from current
  `origin/main`; stop if the worktree is dirty at entry.
- Record base SHA. It must contain `4559eb13`; if `origin/main` has advanced,
  inspect the intervening commits and stop on a conflicting product change.
- Do not edit product source in this deployment prompt. A product defect becomes
  a reproducible finding for a separate correction branch.
- Commit only the concise ledger update and one useful live-acceptance report.
- Return base SHA and candidate SHA; do not push or merge.

## Authorized operational boundary

You may:

- inspect current ATLAS port/process topology;
- build server and client from the required commit;
- stop only the exact ATLAS server supervisor/process tree owning port 5001;
- start exactly one hidden built ATLAS server on port 5001 with
  `ROLLOVER_AUTO_SYNC_ENABLED=false` supplied in process environment only;
- leave the existing ATLAS Vite client running if healthy, or restart only its
  exact process tree when required to serve the merged client;
- perform read-only Tailnet API/browser checks and the documented QA login.

You must not:

- edit `.env`, database configuration, schema, migrations, or companion repos;
- stop unrelated Node/PHP/IMSCCA processes;
- run seed, sync, cleanup, generation, publication, curriculum apply, Teaching
  Load suggestion/apply, or CRUD fixture actions;
- expose credentials or tokens in logs/artifacts.

Expected login effects (`lastLoginAt` and login audit rows) are permitted and
must be disclosed. No other database writes are permitted.

## Tasks

1. **Preflight** — record sanitized database name, active school/year, port
   owners for 5001/5174, process ancestry, current health, and a read-only census
   of term configs, curriculum requirements, ownerships, department authority,
   generation runs, and published revisions.
2. **Build** — run server/client TypeScript and production builds once. Stop on
   failure; do not substitute a dev watcher for the built-server gate.
3. **Bounded restart** — stop the exact ATLAS server tree, verify 5001 is free,
   start one built server with rollover automation disabled, require the
   `Disabled` log and absence of the `Starting` log, then verify one listener.
4. **API acceptance** — through Tailnet, verify health, login, `/auth/me`, runtime
   context, subjects, curriculum requirements/readiness, Teaching Load summary
   and effective contract, timetable readiness/run list, and dashboard. Confirm
   actor school 1 and active year 8 are resolved dynamically.
5. **Browser acceptance** — at desktop 1280x720 and mobile 390x844 verify login,
   Dashboard, Subjects, Curriculum Requirements, Teaching Load, and Timetable.
   Check navigation, loading/empty/blocked copy, keyboard access, overflow,
   console errors, failed requests, and mojibake. Do not click any mutating
   action.
6. **Mutation check** — repeat the census. Apart from documented login effects,
   before/after setup and schedule signatures must be identical.
7. **Package** — update the shared ledger, write
   `docs/verification/atlas-core-readiness-rc02d-live-acceptance-2026-09-09.md`,
   stage only those two documents, verify the staged diff, and commit with a
   conventional message.

## Decisive gates

- Server/client `tsc --noEmit`: pass.
- Server/client production build: pass.
- Built Node server owns 5001 and `/api/v1/health` returns 200.
- Rollover automation is demonstrably disabled.
- All named Tailnet routes return their expected authenticated or truthful
  blocked state; no reviewed route is 404.
- Desktop/mobile pages render without horizontal overflow, mojibake, or uncaught
  errors.
- Zero unexpected database mutations.

Run no historical broad suite; RC-02 already passed 499 focused assertions.

## Verdict

Return `REVIEW_REQUIRED` with the immutable commit range when all gates pass.
Return `NO-GO` with one reproducible defect if a gate fails. Do not repair source
inside this prompt and do not begin SCA-04A.

Suggested commit:

```text
docs(core): record RC-02D live Tailnet acceptance
```
