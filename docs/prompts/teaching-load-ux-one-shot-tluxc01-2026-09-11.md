# TL-UX-C01 — Teaching Load Operator Workspace One-Shot

## Outcome

Rebuild `/teaching-load` into a calm, accessible, task-first workspace for Scheduler Officers, while closing the unsafe ownership-transfer and partial-save behaviors discovered by the planner audit. The finished page must give the assignment workspace the majority of the usable height, expose one coherent editing model, remove obsolete split-brain/reconciliation controls from daily work, and remain truthful for the dynamically resolved actor school and active year.

This is an overnight-style execution packet suitable for DeepSeek 4.1 Flash. Continue through implementation, focused verification, real browser QA, independent review, bounded corrections, and a committed candidate. Do not stop after the first green type-check or the first review finding. Stop only for a real authority/product blocker, an unavailable required environment after bounded recovery attempts, or completion at `REVIEW_REQUIRED`.

## Git and execution boundary

- Risk: `MEDIUM` source/UI work with `HIGH` interaction guardrails. This prompt does **not** authorize live Teaching Load mutation.
- Refresh `origin/main`. Create or reuse only a clean worktree at `D:/ATLAS-worktrees/teaching-load-ux-c01` on neutral branch `work/teaching-load-ux-c01`. The executor creates the worktree itself. Never ask the user to create it.
- Record the full base SHA before editing. If the named worktree exists and is dirty or points at the wrong branch, stop and report it; do not reset, clean, stash, delete, or absorb unrelated changes.
- Read `AGENTS.md`, `ATLAS_AGENT_KI.md`, `docs/reference/atlas-runtime-source-of-truth-map.md`, `docs/plans/atlas-active-delivery-streams.md`, and `docs/verification/teaching-load-ux-ui-audit-2026-09-11.md` before implementation.
- Maintain one concise ledger: `docs/progress/teaching-load-ux-c01-2026-09-11-progress.md`.
- Use direct edits. Do not create throwaway source-rewrite scripts.
- Commit the bounded candidate after all required gates pass. Do not amend, rebase, merge, or push. Return base SHA, candidate SHA, exact changed paths, decisive evidence, risks, and `REVIEW_REQUIRED`.

## Confirmed starting defects

Treat these as hypotheses to re-prove against the fresh base before changing code. If a defect has already been corrected upstream, retain the correct behavior and add no duplicate implementation.

1. The visible obsolete page-wide split-brain repair control is gone, but `useTeachingLoadData` still issues a background `POST /faculty-assignments/integrity/reconcile-split-brain` with `previewOnly:true`, retains `splitBrainIncident`/`splitBrainLoading` and unused page-level `integrityDiagnostics` state, and feeds a warning into the page/modal. This is dead split-brain UI plumbing. Remove it from the Teaching Load page and prove the page never calls that endpoint. Preserve the server summary's integrity-diagnostic contract and actionable row-level repair behavior for any real consumer. Keep the retired server recovery endpoint unless repository-wide source tracing proves it has no operational/test consumer and planner QA explicitly accepts deletion.
2. The visible `Reconcile teaching load` panel is a current-year demand/ownership operation, not split-brain recovery. It nevertheless does not belong in the everyday assignment workspace: in the audited rollover state it could preview removal of 265 ownerships while upstream term authority was missing. Remove the panel/button/background preview from `/teaching-load`. Keep the protected server reconciliation contract for controlled Year Setup/recovery use; do not weaken its gates.
3. `Change owner` can silently choose the destination teacher's first section and turn an intended transfer into an unrelated two-way exchange. A transfer must move exactly the subject-section pair the operator selected. A swap, if retained anywhere, must require both exact pairs to be explicitly selected and shown before confirmation.
4. The page can save several faculty sequentially, allowing partial persistence when a later request fails. Replace this with one atomic, revision-checked server operation for the complete draft, or constrain the product to one explicitly scoped faculty mutation at a time. Do not leave a UI that claims one save while performing multiple independently committed writes.
5. Draft history, selected teacher, repair target, filters, dialogs, and cached preview state are not comprehensively keyed to `(actorSchoolId, activeSchoolYearId)`. Scope changes must clear stale mutable state before any request or edit is possible.
6. `RolloverGuidanceCard`/coverage plumbing can fall back to school 1. The Teaching Load route must resolve actor scope through `/auth/me`, bind requests/caches to actor school and runtime active year, and dispatch zero Teaching Load requests while either is unresolved.
7. The jump-list label changes but no jump buttons render; Subjects duplicates the Subjects page; Sections duplicates a weaker editor; Staffing Audit contradicts overload state; repair rows expose redundant Details/Skip/Find/advanced actions; reset controls overlap; some components/state are orphaned.
8. HG/Homeroom is detected partly by display-name heuristics. HG must never create Teaching Load minutes or ordinary assignment rows. Adviser credit comes from the configured ATLAS workload policy. Suggested-load logic should prioritize assigning an adviser at least one real, demanded, non-HG subject for the advised section when qualification and scope permit; if no valid pair exists, report that fact instead of inventing authority or bypassing constraints.

## Product decisions to implement

### One coherent workspace

- Keep Teachers as the primary master-detail workflow: searchable/filterable teacher roster on the left, the selected teacher's assignment workspace on the right, and one persistent contextual draft bar.
- Remove Subjects as a top-level Teaching Load mode. Subject configuration remains on `/subjects`; current-year setup/authority belongs to Year Setup.
- Convert Sections to coverage/navigation only if it materially helps operators find an unowned subject-section pair. It must open that exact pair in the authoritative teacher assignment workflow and must not provide a second weaker editor.
- Remove the no-op jump list, duplicate mobile mode switcher, separate Staffing Audit sheet/action, all-page Global Reset, row reset menus, tiny swap icon, duplicate advanced/profile blocks, and other confirmed dead or redundant controls. Delete components/hooks/state only after repository-wide reference checks prove they are orphaned.
- Keep Help only as contextual guidance or a secondary More-menu item. Do not spend permanent primary toolbar space on it.
- Keep exactly one visible Save owner and one visible Discard owner for an active draft. Undo and Redo must both be visible, keyboard reachable, and truthfully disabled when unavailable.
- Do not use the static staffing-needs report as the destination for an overload chip. A chip count, filtered teacher list, and detail view must agree for the active filters.

### Honest state-driven actions

- Derive the primary action from current truth. Examples: resolve scope, repair year setup, choose a teacher, assign a subject-section pair, review a draft, or save a valid draft. Do not show Reconcile or Suggest as evergreen competing primaries.
- Keep suggestion proposals as a clearly named, secondary guided workflow such as `Preview suggested assignments`, shown only when current truth makes it useful. Do not silently apply a proposal.
- Remove `Review manually` if it merely cancels a proposal. If retained, it must load the exact proposed changes into the same local draft and make no server write until the operator presses the single Save action.
- Put staffing/coverage strategy inside suggestion preview as progressive disclosure, not as a permanent page-wide mode selector.
- Prefer local actions over separate explanatory dialogs. Each blocker or repair item gets one plain-language reason and one action. Remove redundant Details/Skip/Find buttons when the row itself and its primary action already provide the route.
- No selection control may imply a scope larger than its effect. Replace an all-grades `Select all` with exact-grade actions or explicit counts.

### Assignment and ownership integrity

- An occupied subject-section row must identify the current owner before transfer.
- `Change owner` means transfer the one exact selected pair. It must never select another pair using array position, first-section fallback, display order, or stale cached state.
- If two-way exchange remains, require explicit donor pair and recipient pair, show both before/after states, validate both, and commit both atomically.
- Validate actor school, sole runtime active year, faculty revisions, current ownership, qualification, subject/program scope, section existence, and protected HG behavior again inside the write transaction.
- A complete draft save must be all-or-nothing. On stale revision, ownership conflict, validation failure, or transaction conflict, persist none of the draft and return one typed actionable error. Idempotent replay must create no additional changes or audit entries.
- Do not change assignment authority, qualification policy, workload-policy formulas, rotation semantics, curriculum demand, or department mappings merely to make the UI pass.

### Homeroom and adviser behavior

- Exclude canonical subject code `HG` and any authoritative reference-only/non-scheduling disposition from ordinary Teaching Load demand, suggestions, assignment creation, minutes, utilization, filters, and save payloads. Do not infer exclusion from a localized/display name.
- Preserve EnrollPro as the source of adviser-to-section identity. Do not create or edit adviser identity in this stream.
- Preserve the configured ATLAS advisory credit policy; do not let mirror-provided hours override it.
- In suggestion ranking, when an adviser has no real subject for the advised section, prefer one valid demanded pair for that exact section before equally eligible non-advisory-section pairs. This preference must never bypass qualification, program/scope, rotation/term, uniqueness, capacity, or workload limits.
- Add explicit negative controls for: no qualified advised-section pair; advised section outside subject scope; pair already owned; HG/reference-only candidate; adviser already owns a real pair for the advised section; and multiple equally valid candidates with deterministic ordering.

## Layout and accessibility acceptance

- Preserve the fixed application shell and local scrolling. The page itself must not become a long document scroll on normal desktop.
- At 1366x768 and 1280x720, the assignment workspace must receive at least 45% of the post-shell content height and must not collapse below 320px width for the active detail pane.
- At 1024x768, the master-detail workflow remains usable without horizontal page overflow.
- At 390x844 and 360x800, use a clear list-to-detail mobile flow; the operator must not manage two crushed panes simultaneously.
- At a 640x360 landscape viewport and a 320px-wide 400%-zoom-equivalent reflow check, the active work area must retain at least 140px local scroll height, all actions must remain reachable, and there must be no global horizontal overflow.
- Interactive targets are at least 44x44 CSS px where space permits; compact table affordances still need an equivalent 44px hit area.
- All controls have accessible names, visible keyboard focus, non-color status text, sensible focus return after sheets/dialogs, and announced save/error state through a single `aria-live` owner.
- Use shadcn/Radix primitives, lucide icons, existing tokens, and Motion only where it clarifies transitions. Do not introduce raw native replacements or ornamental animation.
- No mojibake, clipped menus, nested unbounded scroll traps, or hover-only instructions.

## Authorized source boundary

The executor may edit:

- `atlas-client/src/pages/TeachingLoad.tsx`;
- Teaching Load hooks, libs, types, and components under the existing faculty-assignment/Teaching Load surfaces;
- focused client tests and a dedicated Playwright spec/config if needed;
- the smallest required `faculty-assignment.router.ts` and Teaching Load service changes/tests to implement atomic exact-pair transfer or atomic draft save and adviser-section suggestion priority;
- `CHANGELOG.md`, the one progress ledger, and the runtime source-of-truth map if authority behavior changes.

Do not edit term schema/migrations, derived-demand/term-authority implementation, timetable/generation/publication, Subjects CRUD, dashboard, authentication, recovery, rollover, global shell/design tokens, or companion-system repositories. EnrollPro, AIMS, and SMART are `READ_ONLY`. If a required behavior belongs to EnrollPro, record a developer handoff under `docs/` rather than editing the clone.

## Live safety boundary

- Live Tailnet validation is mandatory and observation-only except for the disclosed login audit/`lastLoginAt` effect.
- Do not press or dispatch Save, Apply, Reset, Reconcile, Suggest/Create Proposal, auto-fill, capability override, generation, publication, or any other write action against live school data.
- Do not restart or replace the shared server on port 5001, change `.env`, apply a migration, modify Tailscale, or change companion-system state.
- Before and after live QA, capture a read-only signature covering active school/year, faculty/ownership/cycle counts and revisions, curriculum/term state, generation runs, and published revisions. Login/audit effects must be separately disclosed. Any other difference is a failure.

## Execution passes

### Pass A — preflight and failing-first contract

1. Refresh `origin/main`, establish the clean worktree/base, inventory the real route/component/hook/service call graph, and reproduce every confirmed defect still present.
2. Add focused failing-first tests for the actual production entry points, not helper-only predicates. Record the meaningful RED failures in the ledger; do not preserve deliberately broken code.
3. Record baseline screenshots and dimensions before the visual refactor.

### Pass B — remove dead and split authority

1. Remove Teaching Load's split-brain preview request, state, warnings, and unused diagnostic plumbing.
2. Remove the current-year reconciliation surface from the daily page without weakening the server's protected recovery contract.
3. Remove or merge the dead/duplicate controls listed above, after proving whether each component has another consumer.
4. Bind all mutable client state and request caches to actor school plus runtime active year, with zero requests while unresolved and complete cleanup on scope change.

### Pass C — rebuild the operator workflow

1. Implement the responsive master-detail layout and single authoritative draft action surface.
2. Make row actions explicit, progressive, keyboard-operable, and truthful about current ownership and downstream effect.
3. Correct filter/chip/detail consistency and the no-op/contradictory navigation paths.
4. Integrate suggestion preview as a secondary workflow without creating a competing editor.

### Pass D — close mutation integrity

1. Implement exact-pair transfer and remove implicit array-index swaps.
2. Implement one atomic save boundary for the advertised draft scope, or narrow the advertised draft scope to match the existing single-faculty transaction. The UI and API wording must match the actual atomicity.
3. Revalidate scope, revisions, current ownership, qualification, and HG/reference-only exclusion inside the transaction.
4. Add real mounted-route/service tests for success, stale revision, conflicting owner, cross-school/year, partial-failure rollback, idempotent replay, and audit cardinality.

### Pass E — Homeroom/adviser suggestion policy

1. Remove name-based HG authority from the touched path; use canonical persisted identity/disposition.
2. Prove HG creates no demand/minutes/assignment row through the real suggestion and save paths.
3. Add the bounded advised-section preference without bypassing any hard eligibility rule.

### Pass F — browser QA and refinement

Run Playwright against both the real Tailnet environment and the isolated candidate UI:

1. **Live Tailnet truth:** authenticate at `https://njgrm.buru-degree.ts.net`, resolve `/auth/me` and runtime context dynamically, visit `/teaching-load`, and exercise every read-only control at 1440x900, 1280x720, 1024x768, 390x844, 360x800, 640x360, and 320px reflow. Capture screenshots, console errors, failed requests, overflow/scroll measurements, focus order, accessible names, and visible state/copy. Use a network mutation guard that fails on every non-login `POST`, `PUT`, `PATCH`, or `DELETE`.
2. **Candidate interaction matrix:** serve the candidate client on an isolated port bound to `0.0.0.0` and access it through the Tailnet IP/hostname. Proxy only to the existing live server; do not restart port 5001. For write-capable UI interactions, intercept the APIs with deterministic fixtures and assert exact request intent without forwarding a live mutation. Cover teacher selection, filters, list-to-detail mobile navigation, exact occupied-pair transfer confirmation, draft undo/redo/discard, stale/error presentation, suggestion preview, and scope-change cleanup.
3. If Tailnet cannot reach the isolated candidate port, perform bounded diagnosis of binding/firewall/proxy configuration without changing persistent system configuration. Do not substitute a localhost-only screenshot and claim Tailnet PASS. Stop at `RUNTIME_ROUTE_BLOCKED` with exact evidence if the mandatory Tailnet candidate route remains unreachable.
4. Compare before/after screenshots yourself. Fix clipped, contradictory, inaccessible, or overly dense states before review.

### Pass G — independent review and correction loop

- Commission one fresh independent reviewer after the candidate implementation and browser evidence are complete. Give it the exact base/candidate range, source boundary, audit findings, screenshots, decisive gates, and live no-write signature.
- The reviewer must inspect source and independently rerun the decisive tests; it must not accept the executor's report alone.
- If it finds material defects, fix them in an additive correction commit and commission one fresh changed-scope reviewer. Repeat until zero material findings or a genuine planner decision is required.
- Review artifacts are advisory evidence. The executor must still return `REVIEW_REQUIRED`, never formal GO.

## Decisive gates

Run the smallest affected set, but all of the following categories are mandatory:

- new production-path Teaching Load workspace/ownership tests;
- `npm run test:ux-guardrails` plus affected Teaching Load canonical, route-intent, suggestion, reconciliation-authority, and assignment-security suites;
- mounted-route tests for any changed server contract;
- client and server `npx tsc --noEmit`;
- client and server production builds when server source changes, otherwise client build plus built-server startup/import proof for any touched runtime module;
- `git diff --check` and staged `git diff --cached --check`;
- reference/dead-control scans proving no Teaching Load call to `reconcile-split-brain`, no daily reconciliation panel, no implicit `sectionIds[0]` ownership exchange, no school-1 fallback, no name-based HG decision in the touched flow, and no orphaned imports;
- mandatory live Tailnet and isolated-candidate Playwright matrices described above;
- read-only before/after live signature equality, excluding disclosed login effects.

Do not run broad historical recovery, timetable, generation, or publication suites unless a changed dependency makes one directly relevant and the reason is recorded.

## Completion handoff

Return one compact, verifiable report containing:

1. `REVIEW_REQUIRED` or the exact blocker state;
2. worktree/branch, full base SHA, full candidate SHA, clean status, and exact changed paths;
3. before/after control inventory and explicit split-brain/reconciliation removal proof;
4. exact transfer/save atomicity contract and transaction behavior;
5. Homeroom/adviser suggestion behavior and negative controls;
6. test names/counts/exit codes and RED-to-GREEN evidence;
7. Playwright route, viewport matrix, screenshots, accessibility/overflow/network results, and confirmation that the candidate was reached through Tailnet;
8. live before/after data signature and permitted login effects;
9. reviewer verdict, every finding, correction commits, and remaining risks;
10. confirmation of no merge, push, migration, live Teaching Load mutation, generation, publication, or companion edit;
11. one exact next action for planner/QA.

Suggested commit:

```text
fix(teaching-load): unify the assignment workspace and ownership workflow
```
