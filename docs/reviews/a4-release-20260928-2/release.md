# A4 release 2026-09-28 #2 — deployment record

Packet: `docs/prompts/a4-release-2026-09-28-2.md` (Lane C), corrected at `e4fc259b` on `docs/a4-release-20260928-2`.
Planner: **A4**, release lane, ELEVATED, fresh session.
Live before: **`7590d485974337f834aa3972bb128090e6067b8d`** (rollback basis, **retained**).
Live after: **`9ca7f629a7e43a0e31c6b9fada97152541c2a877`**.

## 1. What shipped

| | |
|---|---|
| **Pinned release SHA** | `9ca7f629a7e43a0e31c6b9fada97152541c2a877` (branch `release/2026-09-28-2`, tree `4c984561`) |
| **Release dir / live dir** | `E:\ATLAS-worktrees\lane-a4-release-20260928-2` — **detached at the pin exactly**, `git status --short` empty |
| **Tree parity with staging** | `4c9845610545afba7c915ca885319e1c0e2d5cf6` — **byte-identical** to the staging pin's tree |
| **Train contents** | A2 `e910811b`, A5 `c5aba703`, A6 `6498c322`, A3 `13d75ce6` |
| **Docs commit above the pin** | `f964eb46` — **NOT shipped**; the release dir is detached at the pin |
| **Re-merge / re-base** | **None.** `origin/main` advanced to `5481dcccf` mid-deploy; deliberately not merged |

## 2. Range enumeration (§13 — enumerated, not described)

`git diff --name-only 7590d485..9ca7f629` = **159 files**, **+24,499 / −2,452**.

| Area | Count |
|---|---|
| `atlas-client/src` | 114 |
| `docs/reviews` | 14 |
| `docs/prompts` | 8 |
| `ops/staging` | 6 |
| `docs/handoffs` | 5 |
| `.opencode/agents` | 3 |
| everything else (singletons) | 9 |

**Client-only release.** `git diff --name-only 7590d485..9ca7f629 -- atlas-server prisma` → **EMPTY**.
No auth, JWT, role, permission or session delta; no migration; no seed; no `.env`.
`ops/staging/*` is present in the live tree and is **inert**: `ops/runtime/lib/contract.mjs` resolves the live
contract to `../runtime-contract.json` relative to the module, and `ops/runtime/{cli,host}.mjs` contain zero
references to staging, 5101 or 5274 (proved by reading them, not by grep alone).

## 3. Gates

| Gate | Result |
|---|---|
| Pre-action review `ses_f17ece6d8` | **GATE A 7/7/0/0** (source range sound), **GATE B 5/7/0/0** → `CORRECTION_REQUIRED` **on packet documentation only**; 12/14 overall. Three D-rows added (discriminator, zero-write, session custody) and step 5's "retire release-1" corrected — it is the rollback basis. Applied by the planner per §11; **no source byte changed.** |
| `prisma generate` (repo-root schema) | exit 0 |
| server build (`npm run build`) | exit 0 |
| client build (`VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`) | exit 0, guard satisfied |
| Post-action QA `ses_f17d771a1ffepZisHXGqij42kC` | **10/11, 0 blocked, 0 unperformed**, `PLANNER_DECISION_REQUIRED` — **no BLOCKING defect** |

## 4. Deploy discriminator — verified non-vacuous BEFORE the cutover, then over HTTPS

`atlas-client/dist/index.html` is **3,838 bytes on both sides** and `atlas-server/dist/server.js` is
**3,070 bytes on both sides** — and post-action QA established `server.js` is not merely same-size but
**byte-identical (same SHA-256) across both builds**. Both asset dirs hold **169 `.js` chunks**. So an
entry-stub compare, a chunk count, or `Refresh roster` would all have been **vacuous**. Used instead:

| Marker | New build | Old build | Over HTTPS after cutover |
|---|---|---|---|
| `Discard your changes?` | `Subjects-Cr9LiLFz.js` | absent from all 169 chunks | **served, 91,379 b, marker present** |
| `Pick a class on the grid, then choose Move, Change room or Swap.` | `TimetableSimpleHeader-CPRshG2N.js` | absent from all 169 chunks | **served, 179,760 b, marker present** |
| entry chunk hash | `index-D940J6sv.js` | `index-D-9pvysa.js` | **served entry == new build; old entry now 404s** |

Supporting: **49 of 169** chunk filenames differ (content-hashed).
**Struck on review (F1):** `Refresh roster` was claimed to be in the old build. It is in **0** old chunks —
the same as the new build. That sub-marker is vacuous and is removed from the packet. The inverted `/teachers`
label observed live is the new `Update teacher list`, which is **not** a discriminator claim.

## 5. Zero-write — PROVEN, closing release #1's unrecoverable D7

Baseline captured **before** the supervisor was killed (release #1 had no such baseline, so its D7 was
permanently PARTIAL):

| Metric | Baseline (pre-quiesce) | Post-cutover | Verdict |
|---|---|---|---|
| `max(audit_logs.id)` | 1018 | 1018 | UNCHANGED |
| `count(audit_logs)` | 467 | 467 | UNCHANGED |
| `count(_prisma_migrations)` | 11 | 11 | UNCHANGED |
| public tables | 51 | 51 | UNCHANGED |

Independently re-derived by post-action QA with its own query: `max_audit=1018, cnt_audit=467, cnt_mig=11,
unfinished_mig=0, cnt_public=51`. **No write occurred.**

**F3 — one non-GET in the new supervisor log, and it is not a deploy write.**
`atlas-supervisor.log:31` records `POST /api/v1/room-preferences/collaboration/ticket` at `13:14:19Z`, raised
as an `event-loop-stall` warning. Attributed, not assumed: `timetable-collaboration.router.ts:12` →
`timetable-collaboration-ticket.service.ts`, which imports only `node:crypto` and holds tickets in an
in-memory `const tickets = new Map()` — **no Prisma, no persistence**. It was ordinary browser traffic from
the acceptance walk at 13:14Z, and all four DB signatures are unchanged. The packet's "no non-GET" wording was
**inaccurate**; recorded as corrected rather than waived.

## 6. Cutover — literal steps, deviations recorded not substituted

1. Zero-write baseline captured (§5) **before** any quiesce.
2. Supervisor tree identified from the process table: supervisor **2988**, children **12560** (5001) and
   **12628** (5174). `taskkill /PID 2988 /T /F` → 6 processes terminated, **0 listeners** on 5001/5174,
   **0** residual processes from the old release, task state `Ready`. (An out-of-process `cli.mjs stop` does
   not quiesce the resident supervisor.)
3. Machine scope: `ATLAS_RUNTIME_SOURCE_DIR` → `…lane-a4-release-20260928-2`; `ATLAS_RUNTIME_RELEASE_SHA` →
   `9ca7f629…`. Read back and proven equal to `git -C <sourceDir> rev-parse HEAD`.
4. Task XML exported, the two occurrences of the old release path replaced (2 → 0 old, 2 new), re-registered
   with `/create … /f` → **SUCCESS**, and the registered action re-read to confirm the repoint.
5. `schtasks /run` → both listeners up by **attempt 4** (~20 s).
6. **§6 stale-env trap avoided:** every identity decision came from machine scope, the task action, the
   listener command lines, and `cli.mjs status` with env **injected explicitly** — never from `Env:`.

## 7. Deployment acceptance

Post-action QA, live Tailnet origin asserted on every browser row (`https://njgrm.buru-degree.ts.net`):

| Row | Result |
|---|---|
| Identity | PASS — machine env, task action, and all three listener command lines name the new release |
| Liveness + DB readiness | PASS — health 200, ready 200 `checks.database: ok`, subjects read 200 |
| Production host | PASS 200, `artifact` names the new `atlas-client\dist` |
| Discriminator | PASS — non-vacuous on both chunk-hash halves and both new-only markers |
| Zero-write | PASS — 1018/467/11/51 unchanged |
| Rollback | PASS — `7590d485` exists, clean, HEAD correct, all dep trees and built dist present |
| **Browser (6 routes)** | **PASS 6/6** — real `browser_navigate` per route, **zero** React errors, **zero** error boundaries. `/timetable` grid literal: `Time, Mon, Tue, Wed, Thu, Fri` with **9 populated rows**. |
| Global scrollbar | classified — only `/` scrolls (1958 > 768); other five 768 = 768 |
| Public matrix | PASS — no 5xx; `/faculty?schoolId=1` 401 and `/rooms?schoolId=1` 404 both unchanged pre/post |
| **Codex smoke** | **FAIL — non-conforming, NOT acceptance evidence. See §8.** |

## 8. The Codex smoke is struck as evidence — recorded, not laundered

A fresh `codex exec` smoke was launched per packet step 4. It ran, but its output is **not usable as
acceptance evidence for this release**:

- It emitted **no `SMOKE:` tally** — the exact line it was asked to produce is absent from the 563,807-byte
  transcript.
- It answered a **stale, different packet** ("the nine-row browser packet"), citing `/sections` room-card
  zoom findings and a "packet's projected 273" that are not in this packet.
- Two of its claims are **contradicted by live truth** (F5): it reports "console errors/warnings were empty"
  where a typed **409** was observed, and it reports Teaching Load counts as "Unknown / Not available" where
  real values render (`% STAFFED 100%`, `CLASSES WITHOUT A TEACHER 0`).

**The browser acceptance for this release is the post-action QA's own six rows**, performed independently on
the live origin. The smoke artifact is retained on disk as a record of the attempt and is **superseded**, not
deleted (§16: corrections are additive to evidence, never subtractive).

## 9. Findings carried forward (all NON_BLOCKING; A4 does not edit product code)

- **F1 — vacuous marker, struck.** `Refresh roster` is absent from the old build too; it never discriminated.
- **F2 — stronger than stated.** `dist/server.js` is byte-identical across releases, not merely same-size.
- **F3 — one non-GET in the log**, attributed to an in-memory collaboration ticket, no persistence. See §5.
- **F4 — pre-existing §8 violation.** `/` document scroll 1958 > 768. `Dashboard.tsx`, `ui/sidebar.tsx` and
  `AppShell` are **not** in the 159-file range ⇒ **pre-existing, not a regression**. Needs a product-lane owner.
- **F5 — smoke output factually unreliable**, contradicted by live truth. See §8.
- **F6 — a second supervised instance is live.** Staging `E:\ATLAS-staging\9ca7f629…` runs its own supervisor
  (PID 23972, children 19756/31608) on **5101/5274**. Cleanly separated from 5001/5174; recorded so a future
  reviewer does not read it as a duplicate holding live ports.
- **F7 — live data blocks generation (context, not a deploy defect).** Both `/timetable` 409s carry
  `DERIVED_DEMAND_BLOCKED` with **24 × `ROTATION_ORDER_DUPLICATE`** (`SCI_BIO` and `AP` both at
  `rotationOrder 1` in family `SCIENCE`, grades 7/9/10). The app fails closed correctly. This will block
  LIVE-GENERATION and needs a data owner.
- **F8 — §8 size limits, non-blocking for a release:** `useScheduleReviewWorkspaceState.ts` 2,343 lines (a
  hook, pre-existing), `TeachingLoad.tsx` 998 (2 from the limit), and two new test files over 1,000 lines
  (`a2-c11-draft-actions-correction.test.tsx` 1,220; `a6-teaching-load-surface.test.tsx` 1,076).

## 10. Capacity and worktrees

- **E: was 24.09 GiB — below the packet's 25 GiB build gate.** Reclaimed **5** clean A2 release worktrees
  (`lane-a2-release-{0da104f9,4c35cc8f,a1db27d5,c0d91827,d31bfacb}`): each detached, `git status --short`
  empty, **0 reparse points**, no process using it, no junction on any root pointing into it, and each an
  ancestor of the live release. Removed with **non-forced** `git worktree remove` + `git worktree prune`;
  **no branch deleted**. E: → **31.75 GiB**, and **30.21 GiB** after the build.
- Dependency trees were **copied** into the release directory, **not junctioned**, per release hygiene.
  Sound for this delta: `dependencies` and `devDependencies` compare equal and all three lockfiles are
  byte-identical across the pins, so no fresh `npm ci` was required.
- `lane-a3-release-f426f465` = **PRESERVE_FOR_DECISION** — `d11304e8` is **not** an ancestor of `origin/main`.
  Left untouched.
- **Worktree disposition:** `lane-a4-release-20260928-2` = **`KEEP_ACTIVE`** (live runtime source directory).
  `lane-a4-release-20260928-1` = **`KEEP_ACTIVE`** (rollback basis `7590d485`, clean and startable).
  `lane-a4-docs-20260928-2` = `RETIRE_AFTER_INTEGRATION` (this record, once pushed).
