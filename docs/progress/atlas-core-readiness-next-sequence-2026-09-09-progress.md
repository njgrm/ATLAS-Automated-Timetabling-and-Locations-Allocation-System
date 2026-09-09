# ATLAS Core Readiness — Next Sequence Progress

Authoritative sequence: `docs/prompts/atlas-core-readiness-next-sequence-2026-09-09.md`

## Current state

| Stage | Status | Evidence / blocker |
|---|---|---|
| RC-02 integration | DONE | `main` and `origin/main` at `4559eb13bbd371dd7945b39128f8c0dcdacd430a`; 499 focused assertions, both type-checks/builds, isolated built-server health passed |
| RC-02D live deployment | DONE | Planner accepted `396a7275..6d537148`; integrated and pushed through `7d5142c0`. Built server is live on Tailnet port 5001 with rollover automation disabled. |
| SCA-04B curriculum apply | DONE | Term config id 71 and 216 approved requirements are persisted; readiness is 16/16 CONFIGURED with zero blockers |
| TL-C02 allocation/rebalance | IN PROGRESS | Executor correction stream remains active in `work/teaching-load-tlc02`; await its immutable handoff before review or integration |
| TT-C02 unassigned insertion | DONE | Accepted through `7f7aa814`; preview-only workflow, dead apply path removed, canonical room-capacity predicate shared with construction |
| TT-C03 shared candidate domain | READY | May run from current `origin/main`; must remain source/test-only and must not touch TL-C02-owned files or generate a timetable |
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

Run `docs/prompts/timetable-corrective-03-shared-candidate-domain-2026-09-09.md`
in a fresh isolated executor worktree from current `origin/main`, in parallel
with the already-running TL-C02 correction. TT-C03 must consume the canonical
persisted curriculum and annual ownership contracts without editing TL-owned
files. EVAL-C02 remains locked until TL-C02 and TT-C03 are accepted and
integrated. TT-C04/RC-03 remain locked because timetable generation is a
separate HIGH-risk action requiring explicit operator approval.

## SCA-04A operator decisions + apply preview (2026-09-09, executor)

- Worktree `D:\ATLAS-worktrees\curriculum-sca04a` (branch
  `work/curriculum-sca04a`), base HEAD `43c3a83833758fdd4bd947eeba261800de016d55`
  (origin/main), clean.
- Live Tailnet: health 200; runtime context school 1 / active year 8
  (`2029-2030`), drift aligned; decision-candidates 200 with 233 groups all
  unresolved, `sourceRevisionHash 8B3932BD…E740F`; readiness blocked on
  `OFFERING_TERM_CONFIG_MISSING`; requirements snapshot 0 rows, termConfig null.
- Operator decisions (recorded in preview artifact, no inference):
  1. Terms: 3, ordered `Term 1, Term 2, Term 3` for year 2029-2030.
  2. Rotation: SCIENCE `T1 SCI_BIO, T2 SCI_CHEM, T3 SCI_ES`;
     TLE_ROTATION `T1 TLE_ICT_EXP, T2 TLE_AFA_EXP, T3 TLE_FCS_EXP`.
  3. Candidate policy: CORE/ALL for standard academics (AP, ENG, ESP, FIL,
     MAPEH, MATH); CORE/ROTATING for SCIENCE; EXPLORATORY/ROTATING for
     TLE_ROTATION; SPECIALIZATION for program-specific SPA/SPS/STE;
     OTHER/ALL for DEVL_READING (8); HG rejected (16). Six preserved decisions
     unchanged (G10 Silver AP/ROB SPECIALIZATION; Silver Research excluded;
     G7-G9 STE Research preserved).
- Preview: 216 creates (144 CORE, 48 EXPLORATORY, 16 SPECIALIZATION, 8 OTHER;
  120 ALL-mode + 96 ROTATING_FAMILY_MEMBER), 17 excluded, 0 updates/retires,
  projected demand 59,400 min/wk, rollback = 216 DELETE_BY_IDENTITY.
- Fingerprint: `CURR_REQ_2025F58FF3B49FA527AB9655A4E6D6E7DBAB2ECD4CEFEB580223481D14285EBF`
  (replication of `computeRequirementFingerprint` verified byte-identical to
  the live preview route for the 120 ALL-mode subset and single-row probe).
  Artifact: `docs/verification/subjects-curriculum-active-year-apply-preview-2026-09-09.json`
  + `.sha256` sidecar `9DD199F4…79319`. Authorizes no mutation.
- Zero-write: source domain re-read unchanged (sourceRevisionHash stable, 233
  unresolved, 0 requirements, termConfig null); negative controls typed
  (cross-year 404, duplicate 409, malformed 400, cross-school 400). Rotating-row
  preview is term-gated by design (SCA-02 contract) and validates in SCA-04B
  after terms persist.
- Verdict: `APPROVAL_REQUIRED` — SCA-04B may proceed only on the exact approval
  sentence in the SCA-04A report. No apply, no term write, no Teaching Load,
  no generation, no publish.

## SCA-04A-R staged approval correction (2026-09-09, executor)

Documentation-only authority correction. The combined SCA-04A approval sentence
(terms + requirements in one apply) is marked `NON_APPLICABLE` in the SCA-04A
artifact (kept as the zero-write decision record). New Stage 1 artifact
`docs/verification/subjects-curriculum-stage1-term-config-apply-preview-2026-09-09.json`
(+ sidecar `8D0CA107…218AEF`, fingerprint
`CURR_TERMS_2F2AFA2775944DD2E5EE3DA3570484532C2C0AC5A33901E5F892377662EAAEC7`)
authorizes only the term-configuration create (school 1, year 8, 3 terms Term
1/2/3, precondition absent) with zero requirement authority. Stage 2 (the 216
requirements) stays LOCKED; its approval requires a fresh production preview
route call after Stage 1 applies. No apply, no tests/builds. Verdict:
`REVIEW_REQUIRED`.

## SCA-04A Stage 1 apply + Stage 2 preview (2026-09-09, executor)

Operator approved Stage 1 (exact fingerprint
`CURR_TERMS_2F2AFA…EAAEC7`, byte SHA `8D0CA107…218AEF`). Precondition
verified (term config absent, 0 requirements). Applied the single
term-configuration row: `PUT /api/v1/curriculum-requirements/8/terms`
`{schoolId:1, termCount:3, termIdentities:["Term 1","Term 2","Term 3"], isActive:true}`
→ 200, termConfig id=71 (createdAt=updatedAt=2026-09-08T20:43:57.400Z).
Verified: id=71 present, requirements 0, readiness termConfigPresent true.
Stage 2 real production preview over all 216 rows → 200, termConfigValid
true, fingerprint `CURR_REQ_2025F58F…85EBF` (matches SCA-04A computed),
termConfigRevision `{id:71, …}`, sourceVersions `{}`. Fresh source revision
`ECAFCA77…69A1C7`. Stage 2 artifact +
sidecar `0E1CEFEF…21B36C` written; Stage 2 apply LOCKED pending its exact
approval sentence. No requirements applied, no Teaching Load, no generation,
no publication.

## SCA-04A Stage 2 apply (2026-09-09, executor — HIGH data apply, approved)

Operator approved Stage 2 (exact fingerprint `CURR_REQ_2025F58F…85EBF`,
source revision `ECAFCA77…69A1C7`, corrected artifact byte SHA
`0E1CEFEF…21B36C`, expectedSourceVersions `{}`; the earlier malformed hash
was rejected fail-closed with zero writes). Revalidated live term config
id=71 / updatedAt `2026-09-08T20:43:57.400Z` and source revision — both
matched. Applied the 216 requirements through
`POST /api/v1/curriculum-requirements/8/requirements/apply` → 200,
`{applied:216, retired:0, fingerprint:CURR_REQ_2025F58F…85EBF}`.
Verified: 216 rows (CORE/ALL 96, CORE/ROT 48, EXPLORATORY/ROT 48, SPEC/ALL 16,
OTHER/ALL 8); readiness ready=true 16/16 CONFIGURED 0 blockers; idempotent
replay (fresh preview unchanged=216; replay 200; signature byte-identical,
versions all 1); Teaching Load 265 v2 / runs 0 / drift aligned unchanged.
Source revision now `8785DB9E…1569` (requirements in hash domain).
Stop for planner verification (`REVIEW_REQUIRED`).

## Planner acceptance — RC-02D

- Reviewed immutable executor range:
  `396a72754854f2a1016661438d7fbfb31fb6b644..6d53714806b9a5088d0f2bed4e95754deca2b846`.
- Range contains only the required progress ledger and live-acceptance report.
- Correction commit preserves the deployment evidence commit, removes all
  unresolved placeholders, clarifies the run-gate limitation, and passes Git
  diff hygiene.
- Independent current-state check: exactly one listener owns port 5001, it is
  `node dist/server.js`, no ATLAS dev watcher remains, and Tailnet health is 200.
- Accepted verdict: GO for RC-02D deployment evidence. This unlocks only the
  zero-write SCA-04A decision/preview prompt; it does not authorize curriculum
  apply, Teaching Load apply, timetable generation, or publication.
