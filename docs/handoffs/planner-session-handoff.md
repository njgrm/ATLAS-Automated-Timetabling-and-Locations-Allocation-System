# ATLAS planner session handoff (living document)

**Updated at the end of every turn** so a fresh session resumes from this one file.
Last updated: 2026-09-21, after the directive relocation audit.

## 0. How to resume — read in this order

1. **This file.**
2. **`AGENTS.md`** — the authority. It now points to two reference docs it did not before:
   `docs/reference/agent-runtime-deploy-facts.md` (read before any deployment/runtime/task/env
   action) and `docs/reference/agent-worktree-lifecycle.md` (read before creating, retiring or
   cleaning up a worktree, release directory or dependency tree).
3. **`docs/plans/live-state.md`** — live release and SHA, blockers, the single next action.
4. **`docs/handoffs/lane-b-charter-2026-09-21.md`** — a **second agent works this repo
   concurrently**. Read it before touching anything server-side or reserved.

## 1. What is live right now

- Release **`434b2a81`** at `D:\ATLAS-runtime-supervised-434b2a81-20260921`; supervisor 87396;
  `5001`→74212; `5174`→90380; served entry `index-BMgoX99N.js`; Tailnet healthy.
- Rollback basis **`5f5c6c4f`** (startable, junction-free, task-XML capture retained).
- **Budget:** `monthly 41% · weekly 3% · rolling 7%`. The DeepSeek V4.1 Flash **x4 promo was
  extended to Sep 27** (verified on the docs page, updated Sep 21) — so `atlas-qa` (ds4.1flash)
  stays cheaper than `dsflashv4` at identical token rates. Report the budget every turn.

## 2. Two agents, two lanes — custody

- **Lane A (this session):** client timetable surface, `AppShell.tsx`, `App.tsx`,
  `navigation.ts`, `atlas-client/package.json`, **all continuity documents**, deployment, and
  the single browser controller.
- **Lane B (GPT 5.6, ChatGPT harness):** server authority lane — `atlas-server/src/**` and its
  own docs. Charter at `docs/handoffs/lane-b-charter-2026-09-21.md`. Its first stream
  `ACTOR-SCHOOL-MUTATIONS-C01` was **approved for implementation** at
  `docs/handoffs/lane-a-to-lane-b.md` (I verified its count of eight routes independently).
- **Reserved to Lane A:** `docs/plans/live-state.md`, the delivery register and its generated
  projection, `AGENTS.md`, `CHANGELOG.md`, `atlas-client/**`, `ops/**`, `prisma/**`,
  `.opencode/**`, the root `package.json`, every `.env`, `D:\ATLAS-runtime-config\**`.
- **Serialized:** one runtime (no deploy from Lane B), one browser controller, no migrations or
  database mutation, no login.

## 3. Completed this session (newest first)

| Stream | Result | Key SHAs |
|---|---|---|
| Directive relocation | `AGENTS.md` **3,843 → 3,195 words** (~850 tokens/request saved), 133-rule audit, 4 dropped rules restored | `01af8d71`, `1437e137` |
| `DUP-READ-DIAGNOSIS-C01` | Read-only diagnosis: duplicates are **not** StrictMode; per-caller causes named; 502s unproven | `5837a775`, `dbe7fde2` |
| `UX-R03e` | Runs + Setup panes; route split **complete**; QA `ACCEPT_READY` 13/13 | `5acb08b8`, `434b2a81`, `890fa67a` |
| `UX-R03d` | Outlet keying fix (no remount in-subtree); unwired-test correction | `5f5c6c4f`, `fc966a4c` |
| `UX-R03c` | Policy read ownership (duplicate fetch gone); exports pane | `c93dd2ee`, `608573e5` |
| Deploy C02 (one-shot) | 8/8 deploy rows + browser rows | `d50dde64` |
| Deploy C01 | 8/8 | `74999168` |
| `PRISMA-CLIENT-REPAIR-C01` | Restored the live release's restartability; 6/6 | `b63b4a12`, `608573e5` |
| Directive rules added | 4 rules, each from a named defect | `6df7f42f`, `2a5b66a2`, `d50dde64` |

**EnrollPro:** the proxy 502 was a companion outage, never ours; the peer came back on its own
and the proxy is healthy. The superseded `ENROLLPRO-PROXY-RECOVERY-LIVE` packet was correctly
**not** executed — executing it would have downgraded the runtime.

## 4. In flight / open

- **`callers` one-shot — the next action.** Worktree `E:/ATLAS-worktrees/planner-callers-20260921`
  exists with **nothing written**. Fix the three named duplicate-read callers (diagnosis at
  `docs/reviews/dup-read-diagnosis-c01/findings.md`):
  1. `atlas-client/src/lib/settings.ts` — `resolveActorSchoolId` has no in-flight sharing
     (`/auth/me` races).
  2. `atlas-client/src/lib/enrollpro-public-settings.ts` — `forceRefresh` bypasses its own
     `inflightBySchool` dedup (`runtime/context`).
  3. `atlas-client/src/components/runtime/RolloverGuidanceCard.tsx` — undeduped
     `rollover-status` read; two cards can mount.
  **Explicitly not** an `atlasApi` coalesce (would touch every call).
- **Lane B** is implementing; review its range when the operator signals it is done.
- **502 lead:** needs one failing response body (status/body/headers) from a browser lane.
- **UX backlog:** the dashboard tile reporting "335 review blockers" on a zero-HARD published
  run; the advanced policy surface's layout switch + refetch (pre-existing).

## 5. Authorization and working rules that matter here

- **Standing authorization** for HIGH actions, deployment and browser acceptance for this
  program — gates retained, only the approval round-trip waived. Packets bundle source +
  deployment + browser acceptance into one cycle.
- **Per-pane / per-part checkpointing** is load-bearing: executors hit step limits repeatedly,
  and a checkpoint is what saved `UX-R03e`. Split executor runs into Part A (source) and Part B
  (deploy); hand browser custody to QA so browser rows are not self-graded.
- **A negative claim of mine needs the same adversarial check as a positive one.** Three of my
  own claims were falsified this session: the C02 element-identity row, "no run-list endpoint
  exists", and four rules dropped by my own compression. Independent review caught all three.

## 6. Next actions, ordered

1. `callers` one-shot: author packet → pre-action review → executor (Part A) → deploy (Part B) →
   QA with browser custody → integrate → record in `live-state.md`.
2. Review Lane B's implementation range when the operator says it has finished.
3. Then: the dashboard truth issue, or the 502 lead once a failing response body exists.

## 7. Artifact index (paths only — do not paste contents)

- Packets: `docs/prompts/*.md` (one per stream; `current-source-live-deploy-c02-*` is the
  one-shot template).
- Evidence: `docs/reviews/<stream>/`.
- Charters and handoffs: `docs/handoffs/`.
- Continuity: `docs/plans/live-state.md`.
- Gates: `docs/reference/agent-verification-gates.md`; browser: `agent-live-browser-qa.md`;
  context economy: `agent-context-economy.md`; deploy facts: `agent-runtime-deploy-facts.md`;
  worktrees: `agent-worktree-lifecycle.md`.
