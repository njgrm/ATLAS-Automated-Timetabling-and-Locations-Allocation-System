# Running space-bunny-free planners (read with MANAGER.md)

## p06c r2 layout note — before code

For the older, mouse-first scheduler, keep the current warning and publish summary footprints. Replace the placeholder warning's raw code/identity details with one short title and actionable plain meaning in the existing violation presentation map. In the blocked summary, replace the unresolved-count clause with `N classes need a time slot before this schedule can be published`; retain the existing Must-fix clause when hard problems also block publication. Add no visible lines, chips, or controls. Leave run/term authority and the zero-HARD publication gate untouched.

### p06c r2 handoff

Base `05ba2078e302414bed004c442b6bd4635d709fb2`; branch `work/lane-timetable-p06c`; disposition `RETIRE_AFTER_INTEGRATION`. The placeholder warning now has a plain title, meaning, and action in the existing presentation map; warning rows without a supplied formatter use the existing identity and weekday cleanup. Publish readiness now reuses `classesNeedingTime` for unresolved counts in unresolved-only and mixed hard/unresolved states. No term, run, or publication authority changed.

Checks: `npx tsx --test src/lib/__tests__/warning-readability-c01.test.ts src/lib/__tests__/tt-warning-surface-realism-c07b.test.ts` — 64/64; `npm run test:a2-timetable-truth-labels` — 35/35; `npm run build` — passed with `ISOLATED_LOCAL_BROWSER=1`, `VITE_ATLAS_API=http://127.0.0.1:5101`, and the required `VITE_ENROLLPRO_URL`. `git diff --check` — passed. Typecheck was attempted and reported the map key error (fixed afterward) plus missing `playwright` modules in three pre-existing test files and one implicit-any diagnostic caused by that missing module; it was not rerun.

Rendered component tests assert the changed warning and unresolved-only/mixed publish sentences. **BLOCKING:** the required 1366×768 loopback screenshot was not captured: the local headless-browser launch was rejected by command execution policy. No screenshot is claimed. Independent visual judgement remains outstanding. Candidate is committed additively; do not integrate until that visual evidence is available.

### p06c r3 rendered evidence correction — 2026-10-02

Candidate `154a19f8b11016940146011bcd6a752e67a6bdb6`; base `fdae67ec64a4713d7c5c2446e03c25c29ddf704f`; worktree disposition `KEEP_ACTIVE`.

No product behavior or source changed. E: free space was 30.04 GiB before dependency preparation and 30.03 GiB before/after the client build. Restored the locked client dependency tree with `npm ci --prefer-offline`; the final baseline-aware run was `node ops/lane-c/codex/typecheck-baseline.mjs`, pinned to `fdae67ec64a4713d7c5c2446e03c25c29ddf704f`. Client `npm run typecheck` exited 2 with four diagnostics outside the one-error baseline allowance: three `TS2307` missing `playwright` declarations at `timetable-post-deploy-c04.test.ts:7`, `timetable-post-deploy-c05.test.ts:7`, and `timetable-scheduling-quality-c03.test.tsx:9`, plus the consequent `TS7006` implicit `route` type at `timetable-scheduling-quality-c03.test.tsx:101`. These test files exist unchanged at the base; the client manifest changes in this range only add scripts and do not alter dependencies. Classify these four as the existing test-dependency gap, unexpected by the pinned diagnostic matcher, not as p06c source regressions. The wrapper's server build also exited 2 with `TS2688` (missing Node type definitions); the server dependency tree was not prepared, so this is an environment result, not a client or p06c diagnostic. Baseline additions: 0.

`npm run build` passed (2,895 modules; 40.25 s) with `ISOLATED_LOCAL_BROWSER=1`, `VITE_ATLAS_API=http://127.0.0.1:5101`, and `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`. The requested 1366×768 isolated browser capture was attempted with a full-viewport headless-Chrome launcher and API interception, but command execution policy rejected the launch command before it ran. No preview/browser process started, no API request or write occurred, and no screenshot dimensions or browser-console result are available. No PNG is claimed. `git diff --check` passed.

**Verdict: BLOCKING —** rendered evidence and independent visual judgement remain outstanding; this report does not clear the review finding.

Planners, executors and QA in `.opencode/agents` pin `opencode-go/space-bunny-free` (variant high; steps 400/300/150).
The `opencode.json` default is `deepseek-v4.1-flash`: ALWAYS pass `-Agent atlas-planner` or `-Agent atlas-executor`.
No agent, or a `-ds` agent, silently runs DeepSeek; the default `build` agent is refused by the provider.
`opencode run` exits 0 even on model or transport errors: only the report block counts.

## Tiers (workflow v2)
| Tier | What | Path |
|---|---|---|
| T1 | Wording, layout, styling, one component, <=50 lines, no data/generation/publish logic | One executor, short packet: focused tests + tsc + 1366x768 screenshot; the named integration owner lands it after checking the report. No separate QA round. |
| T2 | One page or behaviour | One executor; Codex verifies live against the quoted operator words. At most 1 fix-up round, then decide. |
| T3 | Generator, publish, deploy path, migrations, live-data writes, auth | Executor on a branch; a second model reviews before landing (Codex high effort). Staging walk. Never self-graded. |

Owners: **Timetable** (/timetable, header, grid, draft/swap/unassigned, generator UI), **Setup** (Teachers, Teaching Load,
Subjects, Sections, Policies, Year Setup), **Reports** (Print Reports, exports, docx, Dashboard). Shared files (app shell,
navigation, shared header helpers) belong to the manager. At most 3 feature planners plus A4.
Releases follow decision 16a: at most 2 per day, none 22:00-06:00 unless the operator writes `ship`; the live-use
gate, artifact checks, screenshots, post-cutover smoke, automatic rollback, and migration reviewer rules are mandatory.
Pre-existing failures are compared against the pinned base and recorded; they are never silently accepted as green.

## Launch recipe (one packet)
1. Write the packet to `docs/prompts/v2/<id>.md` on the manager's docs branch; the named integration owner commits and
   integrates it. Never write directly to `main`.
2. `powershell -File ops/lane-c/new-worktree.ps1 -Name lane-<owner>-<id>` (pinned to origin/main).
3. `powershell -File ops/lane-c/launch.ps1 -Name <id> -Agent atlas-executor -Dir E:\ATLAS-worktrees\lane-<owner>-<id> -Prompt 'Read docs/prompts/v2/<id>.md and execute it. End with the report block.'`
4. Next ticks: `bash ops/lane-c/status.sh`; read the log tail in `D:/ATLAS-lane-c/runs/<id>.log`.
5. After the integration owner lands it: `powershell -File ops/lane-c/remove-worktree.ps1 -Path E:\ATLAS-worktrees\lane-<owner>-<id>`.

## Design (UI packets)
- `DESIGN.md` (repo root) is the design system: SMART-family chrome, teacher/registrar patterns, ATLAS tokens, layout
  and voice rules. `PRODUCT.md` is the product brief. Both load automatically in the Impeccable skill.
- Impeccable is installed for OpenCode (`.opencode/skills/impeccable`, command `/impeccable`). Allowed in packets:
  `audit`, `critique`, `polish`, `clarify`, `distill`, `quieter`, `harden`, `adapt`, `layout`. Never `bolder`,
  `delight`, `overdrive`, `animate`, `colorize` or `shape`/new-work: ATLAS is calm product UI.
- DESIGN.md and operator decisions beat Impeccable's taste rules (e.g. its "avoid Inter" rule: ATLAS keeps Inter).
- The engine binary downloads on first run into the skill's `scripts/bin` (git-ignored). Static `impeccable detect` on
  .tsx source finds nothing useful; use the agent `audit` with screenshots.

## Known failure modes and the rule for each
1. **It stops after stating intent** (exit 0, no report block). Mark it NEEDS_TRIAGE and resume the SAME session once:
   `launch.ps1 -Name <id>-r -Session <ses_id> -Dir <wt> -Prompt 'Continue. Finish and print the report block.'`
   (`opencode session list` gives the id). A second silent exit means kill it, split the packet and start fresh.
2. **It narrows the requirement and grades itself PASSED.** On 09-28, 15 of 34 claimed passes met the operator's
   words. Its verdict is advisory only; Codex checks each quoted item live.
3. **It decays over long sessions.** One fix per packet, fresh session per packet. No commit after 90 min: kill and split.
4. **It hangs on foreground servers** (vite preview, `node dist/server.js`). Packets say "start servers in the
   background with a timeout; stop them before reporting". Keep the reaper armed; a run idle over 60 min is hung.
5. **It hangs on a denied .env read**, and multi-line prompts killed runs. The prompt is one line pointing at the
   packet file; packets forbid reading any .env or runtime-config file.
6. **It leaves dirty worktrees.** Before any exit it commits `wip: <id>` to its branch. If the executor is denied push,
   it reports the SHA and the manager performs the permitted push; no worktree stays dirty.
7. **It makes confident wrong diagnoses.** Every cause claim carries evidence (a read-only DB query, a log line or a
   failing test) or is labelled HYPOTHESIS.
8. **It hits transport or free-tier errors** ("Cannot connect to API", uv_spawn EUNKNOWN). Retry once after 2 min,
   then queue it and tell the operator.
9. **Typecheck must show no error outside `ops/lane-c/tsc-baseline.json`; the wrappers enforce it.**

## Packet template (`docs/prompts/v2/<id>.md`)
```
TIER: T1|T2|T3   OWNER: Timetable|Setup|Reports   BASE: <sha>   WORKTREE: E:\ATLAS-worktrees\lane-<owner>-<id>   BRANCH: work/lane-<owner>-<id>
ACCEPTANCE (operator's words, verbatim; do not restate): "..."
CONTEXT: <files, decisions N from docs/plans/operator-decisions.md, known causes with evidence>
OWNED FILES: <list>. Editing any other file = stop and report NEEDS_DECISION.
TESTS PIN BEHAVIOUR, NOT WORDING: assert roles, data-testid, counts and state; import user-facing sentences from the
  page's strings module (e.g. `SimpleChangeNotice` exports `changeNoticeSentence`) instead of repeating literals.
  A wording change must be a one-file edit (30 Sep: 3 header tests pinned old copy and blocked train 22).
FORBIDDEN: reading .env/runtime-config files, deploy, publish, generation or writes on live, other lanes' files,
  adding baseline errors automatically.
DONE MEANS: failing test first -> fix -> focused tests + full client/server suite + tsc -> 1366x768 screenshot of the
  changed screen (servers in background with a timeout, stopped after) -> UI packets: follow DESIGN.md, run
  `/impeccable audit <changed files>` and fix what it finds, tick the DESIGN.md section 7 checklist in the report
  -> commit -> report candidate SHA.
  The designated integration owner merges T1/T2; T3 receives independent review first. Before ANY exit, commit
  `wip: <id>` if anything is uncommitted and report the SHA for a manager-owned push.
REPORT BLOCK (print exactly, last):
RESULT: LANDED <sha> | PUSHED <branch>@<sha> | BLOCKED <reason> | NEEDS_DECISION <question>
TESTS: <names and pass counts>   SCREENSHOT: <path>   EVIDENCE: <for any diagnosis>   WORKTREE: clean|wip@<sha>
```

## Packet queue (30 Sep 19:26; live is train 21 `fdae67ec`)
| # | Packet | Owner | Tier | Note |
|---|---|---|---|---|
| 1 | Update the 3 header tests pinning pre-hotfix wording: a2-c12-header-rows2 (+2), draft-ux-c01 (+3), a2-c11-s2-header-banners (+1). Match the c82b8636 hotfix wording; do not change product code. | Timetable | T1 | Blocks train 22 (gate: no red tests) |
| 2 | Train 22: A2 move-swap c2 `8c1b9218`, A5 unassigned panel `22b34170`, A6 placement feasibility `8766c084`/`fffa830c`| A4 | Release | After #1 is green, in a window, with the operator's OK |
| 3 | Triage the 3 dirty worktrees (lane-a4-fast-deploy 1 file, lane-a7-relaxed-header 19 files, lane-a6-docx-tl 1 file): read each diff, then commit to its branch or record a discard for the operator | Manager | Triage | Before relaunching #4, #6, #8 |
| 4 | A4 fast deploy: `release-live.ps1`, package reuse, `-ClientOnly`, rule 19 as a hard gate | Release | T3 | Salvage from lane-a4-fast-deploy |
| 5 | Makabansa generator repair (decision 14): when a class has no free slot, move one blocking class | Timetable | T3 | Cause: greedy placement, only 11:30 free, every rotation teacher booked then |
| 6 | Relaxed header: one row above the grid | Timetable | T2 | Salvage from lane-a7-relaxed-header, or restart |
| 7 | Regenerate run 359 on live to clear the 156 pre-decision-15 lunch warnings | Timetable | Live action | Lunch fix `0df8dd76` is already live (train 21): can run now, with operator approval |
| 8 | Teaching Load docx items | Setup | T2 | lane-a6-docx-tl |
| 9 | Old branches: `work/a8-g1-spread-sessions`, `fix/a5-c8b-row-menu-fit`, `work/a9-m1-campus-background`. Decide keep or drop against decisions 2-15 | Manager | Triage | Deleting unmerged work needs the operator |
| 10 | After-demo backlog, one T1 packet each: Year Setup wrong-year link; "See what would be copied" dead; (i) help icons click-to-open; Teacher Preferences "Load the roster first" on entry; Room Schedules 11x6/13x6 | Setup | T1 | |
| 11 | Click sweeps re-run: Teachers (0 clicks) and Teaching Load (3 clicks) | QA | Codex walk | |

### p06c r4 visual fixture executor report — 2026-10-02

- **Layout note:** an older, mouse-first scheduler sees one plain placeholder warning beside two short readiness examples. No navigation, controls, API calls, or authentication are involved.
- **Base:** `3bd20ae9a2ea6b6cdf75dc07307ee8a30f407b65`; branch `work/lane-timetable-p06c`; disposition `KEEP_ACTIVE`.
- **Changed paths:** `atlas-client/vite.config.ts`; `atlas-client/package.json`; `atlas-client/src/dev/P06cR4VisualFixture.tsx`; `atlas-client/src/dev/P06cR4VisualFixtureEntry.tsx`; `atlas-client/src/dev/__tests__/p06c-r4-visual-fixture.test.tsx`; `ops/lane-c/codex/PLANNERS.md`.
- **Result:** a GET-only `/__dev/p06c-r4-visual-fixture` entry exists only in Vite's development server. It mounts production `ViolationGroup`, the placeholder presentation map, production message formatters, and `deriveSimplePublishReadiness` with synthetic in-memory data. No auth or production routing changed.
- **Focused test:** `npm run test:p06c-r4-visual-fixture` — 1/1 passed; confirms the warning title/meaning/action, unresolved-only sentence, mixed Must-fix sentence, and absence of `SYNTHETIC_PLACEHOLDER_OWNED`, `Faculty 16`, and `MONDAY` from rendered text.
- **Build:** `$env:ISOLATED_LOCAL_BROWSER='1'; $env:VITE_ATLAS_API='http://127.0.0.1:5101'; $env:VITE_ENROLLPRO_URL='https://dev-jegs.buru-degree.ts.net'; npm run build` — passed (2,895 modules; 31.58 s). `rg -l --fixed-strings '__dev/p06c-r4-visual-fixture' dist` — no match, confirming the development route was not emitted in production assets.
- **Diff check:** `git diff --check` — passed.
- **Rendered evidence:** not captured by executor; packet assigns the post-commit 1366×768 browser capture to the manager. No browser, preview, API, or staging process was launched. Independent visual judgement remains pending.
- **Candidate:** `644dc286d44850e1178df3cd42f2be42e0c7dc18` (`feat(timetable): add isolated p06c visual fixture`).
- **Verdict:** fixture and required automated/build checks are ready for manager capture and independent review. Browser evidence remains pending under the packet's named manager owner.

## p06b executor report (2026-10-02)

### p06b r2 layout note

- **User/task:** an older, mouse-first scheduler changes school, year, run, or term and should land in a calm workspace with no detail from the prior scope still selected.
- **Before JSX:** keep the existing scope-change clear boundary and all current clearers; add the selected-entry reset inside that boundary. Nothing visible moves or changes, and no new control or copy is needed. This follows the existing workspace pattern and preserves term authority and server data ownership.
- **Base:** `cecb7125fde9f518986f898d6ef0bd516b17ec4b`.
- **Changed paths:** `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`; `ops/lane-c/codex/PLANNERS.md`.
- **Result:** scope changes now clear the selected entry through the existing component-local clear boundary. No API, persistence, term default, generation, or publication behavior changed.
- **Commands:** `npm exec -- tsx --test src/lib/__tests__/timetable-dynamic-workspace-scope-links.test.ts` — 6/6 pass (confirmed failing first: 5/6); `npm run test:a2-timetable-custody` — 54/60 pass, six failures all in `timetable-drift-banner-390-a2.test.tsx`; `git diff --check` — pass.
- **Rendered evidence:** unavailable in the existing surface. `timetable-dynamic-workspace-r2-consumers.test.ts` documents that mounting this workspace is infeasible in its harness because it invokes the network hook and mounts browser-dependent, heavy DOM/dnd sub-surfaces. No visible output changed.
- **Known risk:** NON_BLOCKING — the custody suite remains red on six drift-banner assertions in an untouched file; the other five custody files pass.
- **Verdict:** correction implemented and focused behavior passes; commit candidate ready for independent review.

- **Base:** `b25fc99b5365330e8b957cd118743e61fd47aee2`; **candidate:** `79ab5b01`.
- **Changed paths:** only the five packet-owned tests under `atlas-client/src/lib/__tests__/`.
- **Result:** stale swap-reset, Expert publish-control, change-notice, and direct-header export pins now follow the current implementations. Selected-term-only beneficiary downloads remain asserted against the print-dialog request path.
- **Focused tests:** four files pass individually; `timetable-dynamic-workspace-scope-links.test.ts` is 5/6 because the new R5 selection-clear assertion fails. The scope-change clearers reset task/sheets/swap state but omit `state.headerContext?.setSelectedEntry(null)`. **Product defect; not superseded:** scope changes can retain a selection from the prior run/term. Fix in a separate production packet.
- **Batch:** `npm run test:client-suite` cannot start on Windows because its 145-file script exceeds the command-line limit. Its files were run in nine sequential 18-file-or-smaller batches: 1,419 tests, 1,381 pass, 38 fail across 7 batches. The failures include the R5 selection defect and assertions in files outside this packet; those were not baseline-checked, so no claim that they are pre-existing or that the aggregate is green.
- **Disposition:** `RETIRE_AFTER_INTEGRATION`.
