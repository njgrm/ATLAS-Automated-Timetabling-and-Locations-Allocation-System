# Deployment packet — `main` client-presentation release (client-only, no migration)

Date: 2026-09-26 (Asia/Manila) · Lane: A · Tier: **HIGH** (deployment) · Status: **AWAITING PRE-ACTION REVIEW**

## 1. Exact target

| Field | Value |
| --- | --- |
| Product to build | **`origin/main` = `26f7c907`** (`docs(reclaim): correct the register…`) |
| Product tree is defined by | the commit built; docs-only commits above the product tip change no product byte |
| Live release being replaced | `116a765814bf56fdd30aec02c611869aaff42190` at `E:\ATLAS-runtime-supervised-116a7658-20260726` |
| New release directory | `E:\ATLAS-runtime-supervised-26f7c907-20260726` (created by the executor, never by re-point) |
| Rollback basis | **`116a7658`** (intact, retained, `KEEP_ACTIVE` until acceptance closes), second `861d89a2` |
| Supervisor task | `ATLAS-Runtime-Supervisor`, currently Running on the `116a7658` action |

## 2. Reconciliation proof — why this is a content superset, not a fast-forward

`116a7658` is **not** an ancestor of `main` (`merge-base --is-ancestor` exit 1), so a naive fast-forward is
impossible and the naive assumption "main is newer" is unsafe. The reconciliation was resolved by
enumeration, not by inference:

`git log --oneline origin/main..116a7658` returns **exactly two** commits — `d07cac05` (F2) and `116a7658`
(F1). Because those are the *only* commits live holds that `main` lacks, no live product content can be
missing from `main` once their product footprint is compared blob-by-blob:

| Live-only commit | Path | Blob on live | Blob on `main` | Verdict |
| --- | --- | --- | --- | --- |
| `d07cac05` | `atlas-client/src/components/timetable/timetableDriftRouting.ts` | `664c7b2c` | `664c7b2c` | **identical** |
| `d07cac05` | `atlas-client/src/lib/__tests__/timetable-dynamic-workspace-drift.test.ts` | `8357571` | `8357571` | **identical** |
| `d07cac05` | `atlas-client/src/lib/__tests__/timetable-dynamic-workspace-rendered.test.ts` | `84e11834` | `463c6f1d` | differs — a **test** file, superseded on `main`; no runtime effect |
| `116a7658` | `atlas-server/src/services/published-schedule.service.ts` | `1b46c877` | `1b46c877` | **identical** |
| `116a7658` | `atlas-server/src/__tests__/published-immutability-c08.test.ts` | present | present | test file |

F1 and F2 reached `main` as candidate `b0dee7c6`, integrated at `1dd92647` — both confirmed ancestors of
`main` (exit 0) — so the isolated line re-applied work `main` already carries. **`main` therefore loses no
live product behaviour, and this deployment is additive.**

## 3. Expected delta

| Surface | Delta vs live |
| --- | --- |
| `atlas-server/` | **none** — `git diff --stat 116a7658 origin/main -- atlas-server/` is **empty**; the server tree is byte-identical, so no server behaviour, route, or serialization changes |
| `prisma/migrations/` | **none** — no schema delta, so **no migration is applied and none is authorized** |
| env / `.env` contract | **none** — no `*.env*` path differs |
| `atlas-client/package.json` | **test scripts only** — `test:plain-tokens-c04`, `test:plain-language-j2j3-c01`, `test:draft-ux-c01`, `test:generation-blockers-c02` and the `test:client-suite` list. **No dependency added or removed**, so no new install is required |
| `atlas-client/src/` | **64 files**, all timetable-surface: `components/timetable/**` (incl. `simple/`, `modals/`), `lib/timetable-plain-language`, `lib/violation-presentation`, `lib/plain-rule-degradation` (new), `lib/timetable-*-readiness/inline-placement`, and 4 hooks (`useTimetableData`, `useTimetableState`, `useScheduleReviewWorkspaceState`, `SimpleSessionDetails`) |
| docs | 19 files, no runtime effect |

The client delta is **presentation authority**: plain-language labels for engine tokens and enums, one shared
degradation rule for unmapped rules, and timetable/schedule clarity copy. No new endpoint, no new write path,
no new persistence.

## 4. Authorization and gates

- **Approval:** operator granted HIGH authority for this program across three queued instructions on
  2026-09-26 while asleep. Recorded rather than assumed.
- **Required before execution:** one independent pre-action review covering **this packet and its
  satisfiability lint in the same pass** (§11 batching), returning one verdict with per-row tallies.
- **Required after execution:** one fresh independent post-action QA including a zero-write corroboration
  row. Deployment and acceptance stay **separate outcomes**: a healthy deployed process may be `DEPLOYED`
  while acceptance is incomplete.

## 5. Execution steps (executor, single writer, in this order)

1. Preflight and record: supervisor action, status, `ATLAS_RUNTIME_SOURCE_DIR` (machine),
   `ATLAS_RUNTIME_RELEASE_SHA`, listeners on 5001/5174 with their owning PIDs, `/api/v1/health`,
   `/api/v1/health/ready`, a DB-backed read (`GET /api/v1/subjects?schoolId=1`), the live release HEAD, and
   six-table DB digests as the **zero-write baseline**.
2. Create `E:\ATLAS-runtime-supervised-26f7c907-20260726` as a **registered worktree** at `26f7c907` (never a
   clone — §10.12). Give it **real dependency copies**; never a junction, and never a junction chain to a
   release that can be retired. The donor `5c100ea6` is **retired and empty**; the only intact tree is
   `861d89a2`, so copy from there or install fresh. **No junction to the live release** — that has twice
   written through a release and stalled the supervisor.
3. `prisma generate` from `atlas-server` with `--schema` pointing at the **repo-root** schema. This is a
   build/codegen step, not a HIGH action, and it makes **no database connection**.
4. Build server and client. **Do not run any migration, `db push`, seed, or reset.**
5. Prove the build is the new one by fetching an asset chunk that exists **only** in the new build.
6. Quiesce per `docs/reference/agent-runtime-deploy-facts.md`: the resident SYSTEM supervisor owns 5001/5174
   and an out-of-process `cli.mjs stop` does **not** durably quiesce it — stop the supervisor **process tree**,
   then `cli.mjs stop`, then allow at least a 10-second settle, and re-verify the listeners are actually gone.
7. Re-point the scheduled task action to the new release's `ops/runtime/cli.mjs start`, start it, and wait for
   5001 and 5174 to serve.
8. Post-switch verification: `/api/v1/health` 200, `/api/v1/health/ready` 200 with `database:"ok"`, a DB-backed
   read 200, the new chunk fetchable, and **six-table digests unchanged** from step 1 (zero write).
9. Record the release in `docs/plans/live-state.md` with its rollback basis **in the same cycle** — a
   deployment is not complete until the register names the new release.

**Rollback (any step fails):** stop the new supervisor tree, re-point the task action back to
`E:\ATLAS-runtime-supervised-116a7658-20260726\ops\runtime\cli.mjs start`, start it, confirm 5001/5174 serve
and health/ready are 200. `116a7658` is retained and untouched for exactly this. Rollback is a re-point, not
a rebuild, because the old release directory is intact.

## 6. Acceptance rows (each names its harness — §11)

| # | Row | Harness | Expected |
| --- | --- | --- | --- |
| A1 | Release identity: installed HEAD == `26f7c907`, supervisor action names the new release | `node ops/runtime/cli.mjs status` + `git -C <release> rev-parse HEAD` | PASS |
| A2 | New-build proof: a chunk present only in the new build is served on 5174 | HTTP fetch | PASS |
| A3 | Liveness + readiness + a DB-backed read | HTTP | 200 / 200 `database:"ok"` / 200 |
| A4 | **Zero write:** six-table digests identical to preflight | SQL digests, planner-recorded | PASS |
| A5 | Timetable plain-language surface: no engine token, raw enum, `Run #id`, or de-snake-cased code reaches the operator grid | **Browser** (authenticated, seeded profile) | PASS |
| A6 | An unmapped/unknown rule renders the one honest sentence, and an absent value renders the em dash | **Browser** | PASS |
| A7 | No new console errors and no failed requests on the timetable workspace | **Browser** | PASS |
| A8 | Reservation: client suite at the release SHA, failing-file set identical to `5960cfce`'s 11 files | `npm run test:client-suite` | 16 fails / 11 files, zero new |
| A9 | Reservation: `typecheck` adds zero errors (baseline exactly 4, all pre-existing) | `npm run typecheck` | 4 |
| A10 | Rollback rehearsal: the old release directory still starts | recorded, **not executed** unless a rollback happens | PASS |

A5–A7 are **browser rows** and are labelled as such; they belong to the acceptance owner named in §7. Live
browser evidence never proves undeployed source bytes — it proves the deployed surface.

## 7. Acceptance owner and open items

- **Acceptance owner for A5–A7: Lane A** (holds the seeded browser profile
  `C:\Users\njgro\.config\opencode\playwright-profile`, token key `atlas_local_token`). QA-account login audit
  rows are expected and need no authorization. Use the **Tailnet root origin only**
  (`https://njgrm.buru-degree.ts.net`); never an asset URL or `robots.txt`.
- **Not authorized and not performed by this packet:** any migration, live-data write, generation,
  publication, term-cache apply, Teaching Load apply, availability write, rollover sync, task/env change
  beyond the release re-point, or any companion-repository action.
- **Capacity judgement (§3), recorded because it is a decision:** E: is **48.73 GiB** free, below the 50 GiB
  warning, and reclaim `20260926b` was executed for this build. The E: release set is now **exhausted** — the
  only remaining rows are live `116a7658`, accepted `861d89a2` + `eb0e3038` (keep), and `4893cbde`, which is
  `PRESERVE_FOR_DECISION` and needs the operator's decision. A third reclaim could retire nothing further
  without that decision, so a fresh manifest would be an empty report. The build needs roughly 2 GiB against
  48.73 GiB free, and fail-closed is 25 GiB, so capacity is verified sufficient. **The one E: row that would
  clear the warning still needs you.**
