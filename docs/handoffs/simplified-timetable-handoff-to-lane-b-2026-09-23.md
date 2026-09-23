# Simplified timetable — handoff to Planner B

**From:** Lane A (primary planner). **Date:** 2026-09-23. **`origin/main`:** `1cfa31bd`.
**Live release:** `7ac28124` at `E:\ATLAS-runtime-supervised-7ac28124-20260923` (accepted 11/11).
**Custody:** Lane A **releases** the simplified-timetable source stream to Planner B. See §4 for the
boundary and the resources that stay serialised.

Read first: `docs/reference/agent-timetable-invariants.md` (§7 of `AGENTS.md`) and
`docs/reviews/ux-audit-c01/atlas-timetable-relaxed-view-audit.md` — its finding register is the
authority for the `UX-R*` rows below.

---

## 1. What is already delivered — do not redo it

The relaxed Simple workspace shipped and was independently accepted, in order:
`TIMETABLE-RELAXED-SUBPAGES-C01` → `TIMETABLE-RELAXED-MAIN-C01` → `TIMETABLE-HEADER-COLLAPSE-C01` →
`TIMETABLE-TRUTHFULNESS-C01`. Measured live at 1366×768: grid top **332 → 140 px**; header **5 bands → 1
row**; status surfaces **8 → 1**; router element-less warnings **49 → 0**; mobile 390×844 first paint
**0 controls at 8 s → 8 at 91 ms**; SPA-nav refetch **17 → 1 call**; scroll preserved; inline placement
→ **one Confirm, zero modals**, with a working Undo; term authority defaults to the EnrollPro-verified
active term **T2** and fails closed on unknown identity. Audit rows **UX-R00/R01/R02/R03 are delivered.**

## 2. Residuals that are already CLOSED — verified, do not hand them on

These are still listed in older notes and in the session brief; I re-checked each against `origin/main`:

- **Over-cap components: closed.** `ManualEditPanel.tsx` is **957** lines and
  `FacultyRoomPreferences.tsx` is **948** — both under the 1000-line cap (§8). The earlier 1012/1007
  figures are stale.
- **`test:ux-guardrails` is no longer vacuous.** It names four files that all exist
  (`gate-reachability`, `rollover-ui-guardrails`, `public-schedule-term-scope-c01`,
  `useTeachingLoadRouteIntent`).
- **The "untested sources" now have coverage.** `src/lib/timetable-live-conflict.ts` is referenced by
  `timetable-day-scope-c03r`, `timetable-grid-shape-authority` and `timetable-ordered-term-conflict-c03r3`;
  `TacticalSandboxDock.helpers.ts` is referenced by `tl-operator-workspace-c05-blast-radius`.
- **`defaultSchoolId` on the timetable surface is not a school-1 default.** It resolves from
  `buildScheduleReviewWorkspaceContexts.ts` as `args.schoolId` (actor-resolved), so it is not one of the
  defaulting sites in the actor-scope backlog. Do not spend a lane on it.

## 3. What is actually still needed

1. **`UX-R04` (MED) — move the dock's technical modules and raw enum codes off the operator surface.**
   **Correction to the recorded evidence: the dock is NOT Advanced-only.** `CenterWorkspace.tsx:399`
   mounts it when `tacticalSandboxOpen || sandboxFacultyByEntryId.size > 0 || (schedule view && an
   unassigned session is selected)` — so it is reachable from the ordinary operator schedule view.
   **Verify what it renders in each of those three states** (mounted-but-collapsed vs visible) before you
   scope the move; that distinction decides whether this is a copy fix or a surface relocation.
2. **`UX-R05` (LOW) — demote the Advanced view to "Expert"** (entry point only).
3. **A product decision, not a defect — the draft-tray swap modal.** The Simple swap path is inline; the
   draft-tray swap deliberately keeps a modal (`draft-swap-review-dialog`). Decide whether to keep the
   asymmetry or make the draft-tray path inline too. The operator owns this call.
4. **`NON_BLOCKING` cosmetic — 390×844 source line truncates rather than wraps.** The Simple header
   source line (`School year from ATLAS, checked <age> · <year> · Run #N`) is clipped at 390 px
   (`scrollWidth 373 > clientWidth 156`). Single line, no overflow of its box. Decide whether to shorten
   the copy or accept the clip.
5. **Dispose of the stale unreviewed candidate `work/timetable-live-term-authority-c01`** (`b8e2e48e`;
   integration branch `38a94bb0`). **Its outcome is already delivered on `origin/main`** —
   `timetablePrefetch.ts:49` gates prefetch on the canonically verified ordered active term — and it is
   **stale-based**: it diffs as 114 files / 10 042 deletions against `origin/main` because it predates
   later files. It has **no packet and no committed review verdict**. Recommendation: **abandon the
   branch** (it is preserved, not merged); harvest only its added
   `qa-artifacts/.../timetable-scheduler-simplicity-lifecycle.spec.ts` if it covers something the
   committed gates do not. Do not merge or rebase it.
6. **Out of scope for this stream — needs its own cycle.** The **289 soft advisory violations** are
   **scheduling quality** (faculty consecutive limits, building/floor transitions, idle gaps), not UI
   truthfulness. HARD is **0** and publication is unaffected. If you want them, they are a separate
   scheduling-quality cycle with its own preview — not a timetable-surface packet.
7. **Pre-existing, not simplified-timetable-specific.** Transient host-side 502s on
   `runs/317/manual-edits` and `runtime/rollover-status` (all 200 on immediate re-issue; diagnosed as a
   host-proxy `UPSTREAM_UNREACHABLE`/`ECONNRESET`, so the fix is not in the routes); and a stale
   `atlas:session-user:v1` localStorage shell that can render after logout while `/auth/me` is 401.

## 4. Boundary and custody

- **Your file scope:** `atlas-client/src/components/timetable/**`,
  `atlas-client/src/components/timetable/simple/**`, `atlas-client/src/lib/timetable-*/**`,
  `atlas-client/src/hooks/useTimetable*/**`, and the two `package.json` test-script manifests when a new
  test file needs a committed script entry (`AGENTS.md` §11).
- **Do not touch:** the server (`atlas-server/**`), the database or schema, the publication gate, the
  ordered-term identity, actor-school scope, or the strict publication predicate. Preserve everything
  accepted in §1.
- **Shared resources stay serialised.** There is **one** 5001/5174 runtime and **one** browser controller
  (`AGENTS.md` §12/§14). If you need browser evidence before your work is deployed, use **isolated ports**
  and label the evidence `isolated` — do not stop, start, or re-point the supervisor.
- **Do not deploy.** Deploying to the shared runtime is a separate HIGH action with a single owner at a
  time; agree a deploy window with the runtime owner before any cutover. The current rollback basis is
  `d9a6aa53` at `D:\ATLAS-runtime-supervised-d9a6aa53-20260923` (startable in place).
- **Worktrees:** registered worktrees only, under `E:/ATLAS-worktrees` — never a standalone clone
  (`AGENTS.md` §10.12). **Provision the executor's worktree *and its dependencies* yourself before
  dispatch**: the executor cannot run `npm ci`, and a candidate built on junctions has to have them
  removed before its worktree is retired.
- **Continuity documents stay with Lane A** (`docs/plans/live-state.md` is partitioned by lane; write only
  a Lane B section, or your own handoff file). Coordinate through Git, not a shared status file.

## 5. Suggested first action

Verify `UX-R04`'s real rendering scope on the live release (`7ac28124`) — mounted-but-collapsed vs
visible for each of the three mount conditions — then author **one** packet covering `UX-R04` + `UX-R05`,
with a single batched pre-action reviewer that closes the source range and the packet's satisfiability
lint in one dispatch (`AGENTS.md` §11), and put the draft-tray swap decision to the operator in the same
turn.
