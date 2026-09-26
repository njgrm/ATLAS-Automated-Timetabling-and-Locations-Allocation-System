# Deploy packet — `400a6909` (ROOM-SCHEDULES-TERM-C01 term scoping)

Status: **PREPARED, NOT EXECUTED.** Operator granted HIGH authority to deploy (2026-09-26). Steps 0–5 are
**DONE and recorded below**; the cutover (steps 6–9) is not started. The planning session ran out of
context budget, and a HIGH cutover must not begin without budget to finish it and prove it.

## 0a. Build proof — steps 0–5 COMPLETE (2026-09-26)

Do **not** repeat these. Each was executed and verified.

| Step | Result |
| --- | --- |
| 0 — Lane A check | **Incumbent still `26f7c907`** from the scheduled-task action. No competing deploy. |
| 1 — release worktree | `E:\ATLAS-runtime-supervised-400a6909-20260926`, `--detach` at `400a6909`, **clean** |
| 2 — dependencies | `npm ci` in **both** `atlas-server` and `atlas-client`, 97 s, both exit 0. **0 reparse points** — the release owns its tree; no junction anywhere. |
| 3 — prisma generate | `npx prisma generate --schema ../prisma/schema.prisma`, exit 0 (repo-root schema path) |
| 4a — server build | `npm run build` (tsc) exit 0; `dist/server.js` present |
| 4b — client build | `npm run build` with `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`, exit 0, **171 chunks** |
| 5 — server actually starts | `node dist/server.js` on **isolated port 5099** → `GET /api/v1/health` **200**; process stopped; **shared 5001 re-checked 200 and untouched** |

Capacity after the build: `E:` **51.77 GiB free** — still above the 50 GiB warning line, so no reclaim is
owed. `C:` 45.2 GiB.

**What remains is the cutover only** (steps 6–9 in §3 below), and it is now a short mechanical operation
because the release is already built and proven to start.

## 1. Why this SHA and not the tip

`origin/main` is `ea5e12b0`. The deploy target is **`400a6909`**, three commits behind the tip. All three
later commits are excluded on purpose:

| Commit | Content | Why excluded |
| --- | --- | --- |
| `f6a0116d` | live evidence doc | docs only, no behaviour |
| `4dd2ed84` | lifecycle diagnosis doc + register | docs only, no behaviour |
| `ea5e12b0` | shared lifecycle model `schedule-lifecycle.ts` | **has had no independent review, and is deliberately unwired dead code** |

`AGENTS.md` §11: *a release must not ship source that no independent reviewer has seen*. `400a6909` is the
reviewed, corrected candidate and is an ancestor of the tip, so deploying it ships exactly the reviewed
product behaviour and nothing else.

## 2. Packet

| Field | Value |
| --- | --- |
| **Target SHA** | `400a6909` (exists on `origin/main`; verified `merge-base --is-ancestor 400a6909 origin/main` = 0) |
| **Incumbent SHA** | `26f7c907` |
| **Incumbent directory** | `E:\ATLAS-runtime-supervised-26f7c907-20260926` |
| **Release directory to create** | `E:\ATLAS-runtime-supervised-400a6909-20260926` |
| **Migration** | **NONE.** Range `41a2f0f8..400a6909` is **client-only** — verified: `git diff --name-only 41a2f0f8..400a6909` returns 11 paths, **all** under `atlas-client/`, and zero matches for `migration|prisma|schema`. No schema command is authorised by this packet. |
| **Expected delta** | Rooms / Teachers / Sections schedule views become scoped to ONE verified term. The live page reported **10 conflicts for G7 Room 103** and its inspector showed three APs and three Math in one Monday slot linked to T1/T2/T3. After this deploy the Rooms response carries one `termIndex` and one entry per cell. |
| **Rollback basis** | **Primary: the incumbent itself** — a supervised reset to `26f7c907` and its existing directory. The register additionally retains `116a7658` as an older fallback. |
| **Verification** | §5 below. |

### Capacity (checked 2026-09-26, immediately before writing this packet)

- `E:` **52.89 GiB free** — above the 50 GiB warning, so **no reclaim is owed**, but it is close. A release
  directory is ~1.47 GiB, so this deploy fits with room to spare.
- `C:` 45.2 GiB free (20%).
- If `E:` crosses **50 GiB** during execution, stop and run the release-directory retention reclaim in
  `docs/reference/agent-worktree-lifecycle.md` before continuing. Do **not** retire `116a7658` (rollback
  basis) or `861d89a2` (the frozen dependency donor other lanes copy from).

## 3. Execution order

0. **Re-check that Lane A has not deployed.** Confirm the live identity from the **scheduled-task action**
   (`schtasks /query /tn ATLAS-Runtime-Supervisor /fo LIST /v`), not from a directory existing. If the
   incumbent is no longer `26f7c907`, **stop** — the packet's rollback basis and delta are both invalid, and
   a fresh coordination check is required. This is the explicit instruction on HIGH authority granted while
   another planner works alongside.
1. `git worktree add --detach E:/ATLAS-runtime-supervised-400a6909-20260926 400a6909`
2. **The release owns its dependency tree**: `npm ci` inside it. **Never** junction `node_modules` into
   another release or the donor, and never install through a shared junction.
3. `npx prisma generate --schema ../prisma/schema.prisma` from `atlas-server` (repo-root schema path).
4. Server build, then client build **with `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`** — without
   it the client build exits 1 and emits no bundle.
5. **Node must actually start the built server** — not just type-check it (`AGENTS.md` §5).
6. No migration step. Skip §3 of the deploy skill entirely.
7. `ops/runtime/deploy-runner.ps1` with explicit `-TargetSha 400a6909 -TargetSourceDir
   E:\ATLAS-runtime-supervised-400a6909-20260926 -IncumbentSha 26f7c907 -IncumbentSourceDir
   E:\ATLAS-runtime-supervised-26f7c907-20260926 -EnvFile D:\ATLAS-runtime-config\atlas-server.env`.
   **Dry run first** (default) and read the redacted plan under `C:\ProgramData\ATLAS\release-audit`. Then
   the same arguments with `-Execute` in an **elevated** shell (assert `IsInRole(Administrator)`).

## 4. Acceptance rows — the reason for this deploy

These are the rows that cannot be decided without a deployed build. They are **deployment-acceptance**
clauses, not source rows.

| Row | Decided by | Expected |
| --- | --- | --- |
| A1 default term | browser | Room Schedules opens on the **verified active term**, and the header states which term (`Showing TERM n`) |
| A2 term switching | browser | Switching T1/T2/T3 updates the visible grid, the stated term, and the conflict count |
| A3 **no merged week** | browser | **The user never sees an all-term merged weekly schedule** — this is the defect |
| A4 conflict count | browser + API | Room 65 returns `termIndexes [1]` and `entryCount 2`, not `[1,2,3]` / `6` |
| A5 unresolved authority | browser | With the term unverifiable, the page states the term is not verified — and must **not** say "No timetable yet" |
| A6 campus surfaces | browser | Campus readiness card and map show no utilisation figure when the term is unverified, and do not claim a timetable is missing |

## 5. Prove it (all required before calling this done)

- `GET /api/v1/health` **and** `GET /api/v1/health/ready` 200 — liveness only, not sufficient.
- A **DB-backed** read: `GET /api/v1/subjects?schoolId=1` 200.
- Supervisor log clean; machine `ATLAS_RUNTIME_SOURCE_DIR` and `RELEASE_SHA` equal the target.
- **Fetch a chunk that exists only in the new build** from `https://njgrm.buru-degree.ts.net` and compare it
  **byte-for-byte** with the built asset. This is the step that actually proves the new code is being served.
- Re-run the live API probe for room 65 / school 1 / **school_year_id 10** (NOT the EnrollPro id `551` — using
  `551` produces a scope that does not exist and returns misleading 404/409/501s).
- Update the `Live release` block in `docs/plans/live-state.md` **in the same action**: SHA, directory,
  listeners, rollback basis. A deployment is not complete until the register names both.
- `DEPLOYED` is **not** acceptance. Rows A1–A6 go through `atlas-live-browser-qa` afterwards, and the
  register must record a real `passed/blocked/unperformed` tally.

## 6. Known residual, disclosed before execution

- `room-schedule.service.ts:295` projects a missing term as `termIndex: 0`, a fail-open sentinel. It is
  unreachable on the filtered path (the 501 fires first). Not fixed by this packet.
- Unscoped entries do not contribute conflicts in the client grid. Measured: **13,800 draft entries across all
  6 runs, 0 missing `termIndex`, `termIndex === 0` count 0**, so the scenario cannot occur on live data.
- The deployed build will **not** contain the shared lifecycle model, so the four-surface lifecycle
  contradiction is **unchanged** by this deploy. That work is separately blocked on plumbing publication
  facts through `useDashboardData`.
