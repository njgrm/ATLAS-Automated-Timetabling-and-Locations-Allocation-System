# ATLAS Core Readiness — Next Sequence Progress

Authoritative sequence: `docs/prompts/atlas-core-readiness-next-sequence-2026-09-09.md`

## Current state

| Stage | Status | Evidence / blocker |
|---|---|---|
| RC-02 integration | DONE | `main` and `origin/main` at `4559eb13bbd371dd7945b39128f8c0dcdacd430a`; 499 focused assertions, both type-checks/builds, isolated built-server health passed |
| RC-02D live deployment | REVIEW_REQUIRED | Built server served on Tailnet port 5001 with rollover automation disabled; all decisive gates pass. Deployment evidence commit `cd5d71809b94dbb2e5a0ba02ce84d608655ca6f5`; review range `396a7275..HEAD`; final candidate SHA reported in the executor handoff. See `docs/verification/atlas-core-readiness-rc02d-live-acceptance-2026-09-09.md` |
| SCA-04A decision preview | LOCKED | Requires planner-accepted RC-02D |
| SCA-04B curriculum apply | LOCKED | Requires complete decisions, fresh fingerprint, and exact user approval |
| TL-C02 allocation/rebalance | LOCKED | Requires verified SCA-04B authority |
| TT-C02 unassigned insertion | LOCKED | Requires verified SCA-04B and canonical TL contract |
| EVAL-C02 integrated UX/objectives QA | LOCKED | Runs after TL-C02 and TT-C02 source candidates integrate |
| RC-03 generation/readiness | LOCKED | Requires accepted SCA/TL/TT and explicit generation approval |

## RC-02 integration evidence

- Integration branch: `integration/core-readiness-20260909`
- Commit: `4559eb13bbd371dd7945b39128f8c0dcdacd430a`
- Fast-forwarded and pushed to `origin/main` on 2026-09-09.
- Commit contains exactly 98 reviewed payload/control files.
- Focused assertions: 499/499.
- Server/client TypeScript and production builds: pass.
- Isolated built server: port 5998, rollover disabled, health 200, stopped cleanly.
- No live Tailnet process, database, curriculum, Teaching Load, generation, or
  publication mutation occurred during integration.

## RC-02D live deployment evidence

- Executor worktree: `D:\ATLAS-worktrees\core-rc02d` on branch `work/core-rc02d`.
- Base SHA: `396a72754854f2a1016661438d7fbfb31fb6b644` (`origin/main` HEAD;
  contains required base `4559eb13bbd371dd7945b39128f8c0dcdacd430a`; the only
  intervening commit `396a7275` is docs-only — inspected, no product conflict).
- Deployment evidence commit: `cd5d71809b94dbb2e5a0ba02ce84d608655ca6f5`.
- Review range: `396a72754854f2a1016661438d7fbfb31fb6b644..HEAD`. The final
  candidate SHA is reported by Git in the executor handoff; it is not embedded
  in this commit because this commit creates that SHA.
- Build: server/client `tsc --noEmit` pass; server/client production builds pass.
- Restart: exact ATLAS server tree owning port 5001 stopped (tsx watch + node
  child); one built `node dist/server.js` started hidden on port 5001 with
  `ROLLOVER_AUTO_SYNC_ENABLED=false` (process env only). Log shows the
  `Disabled` line; the `Starting` line is absent. `/api/v1/health` returns 200.
- Live Vite client (port 5174) left running; serves the merged RC-02 client.
- API acceptance (Tailnet): all named routes return 200 with truthful
  authenticated/blocked/empty content; runtime context resolves school 1 and
  active year 8 (`2029-2030`) dynamically; curriculum readiness truthfully
  blocked on `OFFERING_TERM_CONFIG_MISSING`; Teaching Load `POPULATED` (265
  ownerships) with effective contract v2; generation gate open with zero runs;
  dashboard reports year 8 with `using_saved_data`.
- Generation state: `/api/v1/generation/1/8/runs/gate` returning `blocked=false`
  proves only that no existing run-level lock is active. It does not prove
  curriculum or generation readiness. Generation remains process-locked because
  Curriculum Requirements reports `OFFERING_TERM_CONFIG_MISSING`. SCA-04A is the
  next stage after planner acceptance; no generation is authorized.
- Browser acceptance: desktop 1280x720 and mobile 390x844 — login, Dashboard,
  Subjects, Curriculum Requirements, Teaching Load, and Timetable render with
  no horizontal overflow, no mojibake, no uncaught page errors, working
  keyboard focus, and truthful empty/blocked copy. Observed 404s are
  intentional no-data responses (`runs/latest`, `room-preferences/latest/summary`);
  no reviewed named route 404s.
- Mutation check: read-only census before/after identical for all setup and
  schedule signatures. Only expected login effects occurred: 7
  `LOCAL_LOGIN_SUCCESS` audit rows (actor 46) added and admin `lastLoginAt`
  updated; `failedLoginCount` unchanged; zero `LOCAL_LOGIN_FAILED` rows added.
- No seed, sync, cleanup, generation, publication, curriculum apply, Teaching
  Load apply, or CRUD fixture action was performed.

## Next action

Planner/QA reviews the immutable `396a72754854f2a1016661438d7fbfb31fb6b644..HEAD`
commit range on `work/core-rc02d`, then SCA-04A becomes runnable. Do not start
SCA-04A concurrently with the deployment review. No generation is authorized;
generation remains process-locked until SCA-04B establishes persisted term
configuration (Curriculum Requirements currently reports
`OFFERING_TERM_CONFIG_MISSING`).
