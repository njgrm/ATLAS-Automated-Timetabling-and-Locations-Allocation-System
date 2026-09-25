# Lane C planner handoff: 2026-09-25

**Read this, then `git show origin/main:AGENTS.md` (sections 10, 11, 14) and the Lane C section of
`docs/plans/live-state.md`.** You are Lane C (Claude Code); Lane A is opencode (primary, deploys) and Lane B is
Codex (server work and browser acceptance). You do not deploy. Work in `E:/ATLAS-worktrees/lane-c-*`, never in
`D:/ATLAS`.

## State: three candidates, QA returned 2026-09-25

| Candidate | Range (reviewed) | Handoff | QA verdict |
|---|---|---|---|
| C1 post-publish changes | `af3bb594...50b8077c` (+ handoff `e3621214`) | `docs/handoffs/lane-c-post-publish-c01.md` | **BLOCKED(environment)**: source sound; 12/12 client, server authority test, builds pass; the built-server **startup row was not run** (the reviewer's process launch was denied) |
| C2 Teaching Load clarity | `e475c673...d66510ea` (+ `577f138f`) | `docs/handoffs/lane-c-teaching-load-clarity-c02.md` | **ACCEPT_READY** (8/8, preservation 34/34, build) |
| C3 schedule clarity | `61f57a39...07a3e5f7` (+ `2d3b7ec9`) | `docs/handoffs/lane-c-schedule-clarity-c03.md` | **ACCEPT_READY** (21/21, 54/54, suite 947/962 with the same 15 known failures); depends on C1 |

Branches: `work/lane-c-post-publish-c01`, `work/lane-c-teaching-load-clarity-c02`,
`work/lane-c-schedule-clarity-c03`, all pushed. `61f57a39` is `main` `e475c673` with C1's `e3621214` merged in, so
C3 stacks on C1.

## Next actions, in order

1. **Close C1's startup row.** It needs one independent run, not by Lane C. Paste to Codex (with process launch
   allowed) or opencode:
   > One row only, for the Lane C candidate `work/lane-c-post-publish-c01` (`50b8077c`): build `atlas-server` and prove
   > Node starts it on an isolated port (e.g. 5198). An unauthenticated `POST
   > /api/v1/generation/1/10/runs/1/published-revisions/preview` answering 401 is enough. Stop the server by the
   > PID listening on the port. Report the result as C1's verdict update: ACCEPT_READY or CORRECTION_REQUIRED.
2. **Integrate**, one `integration/lane-c-*` worktree off current `origin/main`, merging `--no-ff` in this order:
   C2 (now), then C1 (after row 1), then C3.
   - Expect one conflict: `atlas-client/package.json` `test:client-suite` (C2 and C3 both append). Keep both.
   - Before pushing: `git cat-file -t` each candidate SHA, confirm the pushed range holds only accepted commits
     plus this docs branch, run `test:client-suite` once on the merged tree (expect the known 15 failures only),
     and run the client production build with `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`.
   - Push `main` only when no other lane has announced an integration (§14).
3. **Also push this docs branch** (`docs/lane-c-planner-handoff`, docs only: the audit report, this handoff, the
   Lane C live-state section and the context-economy note). Integrate it with the first batch.
4. **Ask Lane A to deploy.** Name the release SHA and the browser acceptance owner (Lane B). The acceptance rows
   are in each handoff's Risks section.
5. **Retire** the three candidate worktrees and the integration worktree after the push. They are clean and
   non-forced (`atlas-worktree-reclaim` skill).

## Open, dated 2026-09-25

- Server stall: once a release containing `a5550fa6` is live, read the `[event-loop-stall]` and `[slow-request]`
  lines in `<sourceDir>/ops/runtime/logs/atlas-supervisor.log` after loading `/timetable` once, then fix the
  roughly 8 s stall. (`89295c27` carries it and is live per `live-state.md`.)
- A3: Teaching Load shows 0 class advisers. Check whether EnrollPro sends adviser assignments for
  SY 2031-2032 (read-only).
- NON_BLOCKING follow-ups, listed in the C3 handoff:
  - the Draft view's duplicate Generate buttons;
  - the Expert right-panel Move on a published run;
  - Schedule history not listing dated changes.
- Three unregistered leftover directories in `E:/ATLAS-worktrees` (`flag-window-per-scope-c01`,
  `rollover-year-identity-c01`, `warning-readability-c01`), untouched.

## Operator rules carried over

- G7AW (a building) and SPA/SPS (programs) are familiar names; keep them.
- opencode runs QA on DeepSeek on purpose; do not change opencode's config.
- Never read or print `~/.config/opencode/atlas-qa-credentials.local.md`; Lane C never types passwords.
- Companion repos are read-only.
