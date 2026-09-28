# Frozen reclaim manifest — A2 packet c10 (E: capacity, 2026-09-28)

> **R2 IS THE OPERATIVE SCOPE. R1 (rows R1–R7) IS SUPERSEDED AND RETAINED AS EVIDENCE.**
> An independent pre-action audit of R1 returned **`CORRECTION_REQUIRED`** on row **A9** with two
> **BLOCKING** findings. **Do not execute R1.** The corrections are **R2**, recorded additively at the
> end of this file. Nothing in R1 has been deleted, per `AGENTS.md` §16.

Frozen by Planner A2 **before** any removal. Authorised scope is the operator-approved
"old releases + `4893cbde`" named in `docs/prompts/a2-release-2026-09-28-c10.md` step 3.
Every row below was measured in this session. Procedure: `docs/reference/agent-worktree-lifecycle.md`.

- Planner: A2 (timetable lane), elevated, session 2026-09-28.
- Shared repo root: `D:/ATLAS` @ `a17a813f` = `origin/main` (fast-forwarded this session).
- Worktree for this manifest: `E:/ATLAS-worktrees/lane-a2-c10-docs`, branch `docs/a2-c10-20260928`.
- Capacity **before**: `E:` **26.25 GiB** free (905.25 GiB used) — **8.75 GiB short of the packet's
  ≥ 35 GiB pre-build target**. `D:` 39.16 GiB free.
- Capacity **expected after**: 26.25 + 10.23 = **≈ 36.5 GiB**, clearing the 35 GiB target.
  Measured, not projected: every row's GiB is a `Get-ChildItem -Recurse -File` sum.

## Scope correction — `4893cbde` is already retired

The packet names `4893cbde` in the approved scope. **That scope item no longer exists.**
`E:\ATLAS-runtime-supervised-4893cbde-20260923` was **RETIRED 2026-09-26** per
`docs/plans/live-state.md:110` (manifest `docs/reviews/reclaim-4893cbde-20260926/frozen-manifest.md`),
and a directory enumeration of `E:\` in this session returns no such path. Nothing to do for that row;
recorded so the next cycle does not re-plan a reclaim of a directory that is gone.

## RETIRE — 7 rows, 10.23 GiB

Every row: **registered worktree** (`.git` is a link file, not a standalone clone) ⇒ the documented
non-forced `git worktree remove` + `git worktree prune` applies. **No raw recursive deletion, no
`--force`, no glob, no computed path. No branch or ref is deleted by this reclaim.**

| # | Exact path | HEAD | Branch state | `git status --short` | Re-parse points inside | Inbound dependents | Size |
|---|---|---|---|---|---|---|---|
| R1 | `E:\ATLAS-runtime-supervised-26f7c907-20260926` | `26f7c907a37185e036e71cf0d82423794689b318` | detached | **empty (clean)** | 0 | none | 1.47 GiB |
| R2 | `E:\ATLAS-runtime-supervised-400a6909-20260926` | `400a6909a9642703e3891861c40d5f49f85c7cd9` | detached | **empty (clean)** | 0 | none | 1.46 GiB |
| R3 | `E:\ATLAS-runtime-supervised-e4989b72-20260926` | `e4989b725394204898ebcd429db74daaf7316323` | detached | **empty (clean)** | 0 | none | 1.46 GiB |
| R4 | `E:\ATLAS-worktrees\lane-a2-release-9b28c572` | `9b28c57291ff6c34f33a434d097753b8ce16b118` | detached | **empty (clean)** | 0 | none | 1.46 GiB |
| R5 | `E:\ATLAS-worktrees\lane-a2-release-c0d91827` | `c0d91827311e247ac0f2073a83cc50f5a5efcdb2` | detached | **empty (clean)** | 0 | none | 1.46 GiB |
| R6 | `E:\ATLAS-worktrees\lane-a2-release-d31bfacb` | `d31bfacbfeadb8e90bf9cf1f7a8ddcad62ab129a` | detached | **empty (clean)** | 0 | none | 1.46 GiB |
| R7 | `E:\ATLAS-worktrees\lane-a3-release-c4a9960e` | `c4a9960e0fccaab4a324c97e42eb56cfa10c1fa4` | detached | **empty (clean)** | 0 | none | 1.46 GiB |

**Integrated-content evidence (run in the SHARED repo, never inside a target — the documented
`2026-09-23` lesson).** For all 7 rows, in `D:/ATLAS`:
`cat-file -t <sha>` ⇒ `commit` (the object exists in the shared repo), and
`merge-base --is-ancestor <sha> origin/main` ⇒ **true**, and
`merge-base --is-ancestor <sha> a1db27d5a9c270c875868436988f5d8cef38af04` ⇒ **true**.
Each tip is therefore already an ancestor of both `origin/main` and the live release: retiring the
checkout discards no unintegrated history, and a rebuild from the shared repo remains possible.

## PRESERVE — 5 rows, with the reason each survives the scope

| Exact path | HEAD | Why preserved |
|---|---|---|
| `E:\ATLAS-worktrees\lane-a2-release-a1db27d5` | `a1db27d5a9c270c875868436988f5d8cef38af04` | **THE LIVE RELEASE.** Machine-scope `ATLAS_RUNTIME_SOURCE_DIR`, machine-scope `ATLAS_RUNTIME_RELEASE_SHA`, the scheduled task action, and both live listeners (5001→54908 `atlas-server\dist\server.js`, 5174→56752 `ops\runtime\host.mjs`) all name it. Also the packet's rollback basis. Never touched. |
| `E:\ATLAS-runtime-supervised-861d89a2-20260925` | `861d89a2bc2682c5f875dde0b4b1d8ffc079b1fe` | **DEPENDENCY DONOR.** 3 worktrees junction `atlas-client/node_modules` into it: `lane-a-room-affordance-20260926`, `lane-a-s8-cap-guard-20260926`, `lane-a-violation-label-guard-20260926`. This is the "one real dependency source" in the retention keep set. Retiring it would break `@prisma/client` for all three — the exact failure the lifecycle doc records taking the live runtime down. |
| `E:\ATLAS-worktrees\lane-a2-release-0da104f9` | `0da104f96696aef7de7016e5364f29b50d0ed00f` | **DEPENDENCY DONOR.** `lane-a2-timetable-custody\atlas-server\node_modules` junctions into it. |
| `E:\ATLAS-runtime-supervised-116a7658-20260726` | `116a765814bf56fdd30aec02c611869aaff42190` | **UNINTEGRATED CANDIDATE.** `merge-base --is-ancestor` is **false** against both `origin/main` and `a1db27d5` in the shared repo. It is the oldest release dir by date (commit 2026-09-26T03:35) and is not in the live lineage. Rule: preserve every unintegrated candidate. `PRESERVE_FOR_DECISION`. |
| `E:\ATLAS-worktrees\lane-a3-release-f426f465` | `d11304e8135715783455ca4cb6cfd7a9e39222e8` (branch `release/a3-f426f465`) | **UNINTEGRATED CANDIDATE.** `merge-base --is-ancestor` **false** against both `origin/main` and `a1db27d5`. Clean and 0 re-parse points, but it is A3's release branch head and not proven integrated. `PRESERVE_FOR_DECISION`. |

## Closure proof — scoped to every root a dependent could live in

Per the documented `2026-09-23` defect, the dependent scan was **not** scoped to the targets' own
root. Inbound re-parse-point scan (`Get-ChildItem -Recurse -Attributes ReparsePoint`) across
**`E:\ATLAS-worktrees`**, **`D:\ATLAS-worktrees`**, **`D:\ATLAS-runtime-config`**, **`E:\ATLAS-scratch`**
and **`D:\ATLAS`**, matching each of the 8 candidate keys. Complete result:

- `861d89a2` — 3 dependents, all in `E:\ATLAS-worktrees` (listed above) ⇒ **PRESERVE**.
- `0da104f9` — 1 dependent, in `E:\ATLAS-worktrees` (listed above) ⇒ **PRESERVE**.
- `26f7c907`, `400a6909`, `e4989b72`, `9b28c572`, `c0d91827`, `d31bfacb`, `c4a9960e` — **0 dependents each.**

## Active-process check

`Win32_Process.CommandLine` scanned for all 7 retire keys: the only matches were **this session's own
scanning `powershell.exe` self-matching its own pattern string**. **No supervisor, server, host, or
watcher process holds any candidate.** The live runtime is unaffected by every row above.

## Retention keep set, accounted (counted across **both** volumes, 5 protected slots)

| Slot | Satisfied by | Note |
|---|---|---|
| live release | `E:\ATLAS-worktrees\lane-a2-release-a1db27d5` | preserved |
| rollback basis | `a1db27d5` (the live tree itself) | the packet's rollback target; no separate dir consumed |
| recent accepted release 1 | `E:\ATLAS-runtime-supervised-861d89a2-20260925` | preserved; also the dependency donor |
| recent accepted release 2 | `E:\ATLAS-worktrees\lane-a2-release-0da104f9` | preserved; also a dependency donor |
| named last-resort artifact 1 | `D:\ATLAS-runtime-supervised-20260912` (supervisor reset baseline) | **untouched — on `D:`, outside this reclaim** |
| named last-resort artifact 2 | `D:\ATLAS-runtime-fallback-d44-20260912` (manual fallback) | **untouched — on `D:`, outside this reclaim** |
| one real dependency source | `861d89a2` (client `node_modules`) + `0da104f9` (server `node_modules`) | both preserved |
| unintegrated candidates | `116a7658`, `lane-a3-release-f426f465` | preserved, not consumed by the keep set |

All 5 protected slots are satisfied **without** touching any row in R1–R7.

## Reversibility

Each retired row is a *clean, fully-integrated* worktree of a commit already contained in
`origin/main` and in the live release. Restoring one is
`git worktree add --detach <sha>` → `npm ci` → `prisma generate` (repo-root `--schema`) → builds.
That is a **rebuild, not an instant re-point** — recorded here so no row is mistaken for a fast rollback.

## What this reclaim does NOT do

No branch or ref is deleted. No file outside the 7 exact R1–R7 paths is touched. No runtime, task,
environment, database, generation, or publication action. No credential is read or printed. No server
is started. The live release is not stopped, restarted, or re-pointed.

---

# R2 - CORRECTIVE SCOPE. **This is the operative reclaim. R1 is superseded.**

R1 was audited independently and returned **`CORRECTION_REQUIRED`**, 8/9, blocked 0, unperformed 0.
The single failed row was **A9**, blocking on two independent counts. Both are corrected here. The
audit's *method* findings (A1-A8) all passed, so the removal technique is unchanged: non-forced
`git worktree remove` + `git worktree prune` on registered worktrees only. **R1 remains above as
evidence; nothing in it is deleted** (`AGENTS.md` §16).

## B1 correction - R6 and R5 are rollback depth and are withdrawn from scope

The audit is right, and I was wrong. R1 filled the "two most recent accepted releases" keep-set slots
with rank-6 (`861d89a2`) and rank-10 (`0da104f9`) directories while retiring the two that actually
occupy them. `docs/plans/live-state.md:172`, the **current** LIVE block, reads:

> **Rollback basis** | **`d31bfacbfeadb8e90bf9cf1f7a8ddcad62ab129a`**, dir
> `E:\ATLAS-worktrees\lane-a2-release-d31bfacb` - retained, clean, startable, one-step supervised
> reset. One step further back: `c0d91827`.

So `d31bfacb` (R6) is the **live release's named rollback basis** and `c0d91827` (R5) is its named
one-step-back. Two independent reasons forbid retiring them:

1. **The packet's own words.** `a2-release-2026-09-28-c10.md` step 3 authorises "old releases" but
   says "**never the live `a1db27d5` or the rollback target**". The rollback target *is* `d31bfacb`.
2. **`AGENTS.md` §13 - a reserved decision reserves exactly what it says.**
   `live-state.md:70-75` records an **explicitly reserved operator decision**: "**STILL OWED - operator
   decision, deliberately not self-resolved by deleting keep-set rollback depth**", whose option
   (a) is "drop the second-most-recent-accepted rollback basis **with a recorded exception**", and
   which states "**The next release build needs a fresh manifest and its own pre-action audit.**"
   That exception has **not** been granted. c10's general phrase "old releases" does not name
   `d31bfacb` or `c0d91827`, and per §13 I may not reinterpret a narrower grant as covering a broader act.

**I also checked the two lines the audit cited as further support and they do NOT apply.**
`live-state.md:309` names `9b28c572` as `c0d91827`'s rollback basis, and `live-state.md:231` names
`c0d91827` as `d31bfacb`'s. Both sit inside **superseded historical LIVE blocks** (the live release
was `c0d91827`, then `d31bfacb`, then `a1db27d5`). They are history, not a current requirement. The
**current** requirement is exactly the three-deep chain `a1db27d5` -> `d31bfacb` -> `c0d91827`, which is
live + the two most recent accepted releases - precisely the retention keep set. `9b28c572` is
therefore **beyond** the keep set and stays retirable.

## B2 correction - the capacity premise is re-derived and re-bound live

The audit is right again. R1's `26.25 GiB` was a number measured at session start and bound to that
moment; `AGENTS.md` §16 says a computed artifact is valid only for the revision and moment that
produced it. Re-derived live during the audit, three tools agreeing, stable over 12 s:
`Get-PSDrive` **24.49**, `Get-Volume` **24.49**, `fsutil volume diskfree` 26,291,429,376 bytes, three
samples **24.486 / 24.486 / 24.486**. The drop is real: this session's own three new worktrees
(`lane-a2-c10-docs`, `lane-a2-c10-b2`, `lane-a2-c10-base`) consumed the difference. **R1's arithmetic
is void; every figure below is re-measured in this session.**

## R2 RETIRE - 5 release rows, 7.31 GiB (was 10.23)

All re-verified in this session, same method, same result as R1's audit: registered worktree
(`.git` link file), `git status --short` empty under `--untracked-files=all`, 0 re-parse points
inside, integrated in the **shared** repo against both `origin/main` and `a1db27d5`, **0** inbound
dependents, **0** process holders.

| # | Exact path | HEAD | Size |
|---|---|---|---|
| R2-1 | `E:\ATLAS-runtime-supervised-26f7c907-20260926` | `26f7c907a37185e036e71cf0d82423794689b318` | 1.47 GiB |
| R2-2 | `E:\ATLAS-runtime-supervised-400a6909-20260926` | `400a6909a9642703e3891861c40d5f49f85c7cd9` | 1.46 GiB |
| R2-3 | `E:\ATLAS-runtime-supervised-e4989b72-20260926` | `e4989b725394204898ebcd429db74daaf7316323` | 1.46 GiB |
| R2-4 | `E:\ATLAS-worktrees\lane-a2-release-9b28c572` | `9b28c57291ff6c34f33a434d097753b8ce16b118` | 1.46 GiB |
| R2-5 | `E:\ATLAS-worktrees\lane-a3-release-c4a9960e` | `c4a9960e0fccaab4a324c97e42eb56cfa10c1fa4` | 1.46 GiB |

**Withdrawn from R1's scope: R5 `lane-a2-release-c0d91827` and R6 `lane-a2-release-d31bfacb`** - named
rollback depth, per B1 above.

## R2 also retires 2 non-release worktrees (authorised by c10, not part of the reclaim scope)

`a2-release-2026-09-28-c10.md` step 2 says to use the preserved `lane-gate3-a3c8-*` worktrees and
"**retire them after**". Gate 3 has now returned `ACCEPT_READY`, so they are disposable. Both are
**clean** (`git status --short` empty) and carry **no** `node_modules` junction of their own.

| # | Exact path | HEAD | Size |
|---|---|---|---|
| R2-6 | `E:\ATLAS-worktrees\lane-gate3-a3c8-review` | `6b1ec722` (branch `review/gate3-a3c8-2026-09-28`) | 0.58 GiB |
| R2-7 | `E:\ATLAS-worktrees\lane-gate3-a3c8-base` | `a1db27d5` (detached) | 0.58 GiB |

`lane-a2-docs-c9` (c9's docs worktree, `RETIRE_AFTER_INTEGRATION`) is **already absent** - verified
`Test-Path` false, so c9's recorded retirement did happen and needs no action.

## R2 PRESERVE - 7 rows, every slot accounted

| Exact path | HEAD | Why preserved |
|---|---|---|
| `E:\ATLAS-worktrees\lane-a2-release-a1db27d5` | `a1db27d5a9c270c875868436988f5d8cef38af04` | **THE LIVE RELEASE.** Machine-scope `ATLAS_RUNTIME_SOURCE_DIR` + `ATLAS_RUNTIME_RELEASE_SHA`, task action, and both listeners (5001->54908, 5174->56752) all name it. |
| `E:\ATLAS-worktrees\lane-a2-release-d31bfacb` | `d31bfacbfeadb8e90bf9cf1f7a8ddcad62ab129a` | **Named rollback basis**, `live-state.md:172`. Withdrawn from scope per B1. |
| `E:\ATLAS-worktrees\lane-a2-release-c0d91827` | `c0d91827311e247ac0f2073a83cc50f5a5efcdb2` | **One step further back**, `live-state.md:172`. Withdrawn from scope per B1. |
| `E:\ATLAS-runtime-supervised-861d89a2-20260925` | `861d89a2bc2682c5f875dde0b4b1d8ffc079b1fe` | **Dependency donor** (`atlas-client/node_modules`). The audit measured **5** borrowers, not R1's 3 - it also counts this cycle's own `lane-a2-c10-b2` and `lane-a2-c10-base`. Also a recent accepted release. |
| `E:\ATLAS-worktrees\lane-a2-release-0da104f9` | `0da104f96696aef7de7016e5364f29b50d0ed00f` | **Dependency donor** (`atlas-server/node_modules`). The audit measured **11** borrowers (1 direct + 10 chained through `lane-a2-timetable-custody`), not R1's 1. |
| `E:\ATLAS-runtime-supervised-116a7658-20260726` | `116a765814bf56fdd30aec02c611869aaff42190` | **Unintegrated candidate** - not an ancestor of `origin/main` or live. |
| `E:\ATLAS-worktrees\lane-a3-release-f426f465` | `d11304e8135715783455ca4cb6cfd7a9e39222e8` | **Unintegrated candidate** - not an ancestor of `origin/main` or live. |

## R2 capacity outcome - the >= 35 GiB packet target is NOT met, and here is the honest arithmetic

> **SUPERSEDED BY R3.** This section's numbers were themselves bound to a moment that has passed, and
> its margin sentence was **arithmetically false**. An independent audit caught it. R2's *scope* was
> validated 7/7 and stands; only this arithmetic section is void. See **R3** at the end of this file.

| Quantity | Value | Source |
|---|---|---|
| `E:` free, re-measured now | **24.49 GiB** | `Get-PSDrive`, `Get-Volume`, `fsutil`, stable over 12 s |
| R2-1...R2-5 releases | **+7.31 GiB** | measured, `Get-ChildItem -Recurse -File` sum / 2^30 |
| R2-6, R2-7 gate3 worktrees | **+1.16 GiB** | measured |
| **`E:` free after R2** | **~32.96 GiB** | 24.49 + 7.31 + 1.16 |
| Packet target | 35 GiB | **NOT MET - short by ~2.04 GiB** |

**Decision: proceed at ~32.96 GiB.** Reasoning, recorded so the next cycle does not re-derive it:

- `AGENTS.md` §3's *binding* gates are satisfied: **warn below 25 GiB** (we are ~8 GiB above it) and
  **fail closed below 15 GiB** (we are ~18 GiB above it). Neither is triggered.
- The packet's "**Target** >= 35 GiB free before the build" is worded as a target, not a fail-closed
  gate, and the two bindings above are the ones the directive actually defines.
- The remaining ~2.04 GiB **cannot** be reached inside the authorised scope. It sits in `d31bfacb`
  and `c0d91827` (named rollback depth, forbidden by the packet's own exclusion and by the §13
  reserved operator decision) and in `861d89a2` / `0da104f9` / `116a7658` / `f426f465` (donors and
  unintegrated candidates). Widening further would require the explicit operator exception that
  `live-state.md:70-75` **reserves and does not grant**, and `AGENTS.md` §13 forbids me from
  self-resolving it.
- The build itself needs ~1.46 GiB (the measured cost of a release tree with real `node_modules`,
  matching the 1.46 GiB Lane C recorded 2026-09-26). At ~32.96 GiB there is ample headroom.

This is a **narrow, documented deviation from a target, taken to stay inside a reserved decision**,
not a silent shortfall.

## R2 - what is unchanged from R1

Registered-worktree method only: non-forced `git worktree remove` then one `git worktree prune`. No
`--force`, no glob, no computed path, no raw recursive deletion, no branch or ref deleted. No runtime,
task, environment, database, generation or publication action. No credential read or printed. The live
release is not stopped, restarted, or re-pointed. Reversibility is unchanged: every retired row is a
clean, fully-integrated worktree, so restoring one is a **rebuild**, never an instant re-point - with
the single improvement that R2 leaves the live release's one-step supervised reset intact.

---

# R3 - capacity re-bound live. **Operative. R2's scope stands; its arithmetic is void.**

`AGENTS.md` §16: "A computed artifact is valid only for the revision and moment that produced it. Never
bind a later cycle's action to a stored hash, fingerprint or count." R2's own B2 correction voided
R1's arithmetic for exactly that reason. **R2's arithmetic is now void for the identical reason**, and
I am not going to repeat the same error a third time. This is the correction.

An independent audit of R2 returned `CORRECTION_REQUIRED` on its row B7, blocking on arithmetic alone.
Every other row of that audit passed, including the one that mattered most: **B3 confirmed that
withdrawing `d31bfacb`/`c0d91827` was not merely defensible but mandatory**, verified from
`live-state.md` itself. **R2's scope is therefore final and unchanged. Only the capacity evidence moves.**

## Why the volume moved under us - a parallel cycle, correctly scoped

`E:` fell from R2's frozen 24.49 GiB to **19.797 GiB** while the audit was running. Cause, verified:
packet `docs/prompts/a2-timetable-2026-09-28-c11.md` was written at **13:23:33** and a c11 cycle created
three worktrees at **13:32:15-16** - `lane-a2-c11-integ`, `lane-a2-c11-s1-exec`, `lane-a2-c11-s1-qa` -
consuming ~4.7 GiB in an install burst.

**This is not a custody defect and c11 is not usurping c10.** c11's own packet states: *"Runs in
parallel with your elevated c10 release: do not touch c10's worktrees, `live-state.md` c10 lines or the
release. Branch from origin/main."* Verified: c11 sits on `integration/a2-c11-20260928`,
`work/a2-c11-s1-draft-actions` and `qa/a2-c11-s1-20260928`, all branched from `origin/main` at
`0fd9e3ef`, disjoint from every c10 worktree and branch. `lane-a2-c11-s1-exec` is **dirty** (untracked
`_scratch-m1-repro.test.tsx`) and is therefore **PRESERVED - never touched**. One writer per stream
holds: c10 owns the release, c11 owns its own source slices and is released later through its own
elevated packet. The live release is still `a1db27d5` and no listener moved.

## R3 capacity - measured and timestamped, corrected

| Quantity | Value | Source / time |
|---|---|---|
| **`E:` free, live** | **19.797 GiB** | `Get-PSDrive` and `Get-Volume` agreeing; re-read +10 s, unchanged, so not a transient |
| §3 warn line | **25 GiB** | we are **5.20 GiB BELOW** it - we are **in the warn band** |
| §3 fail-closed line | **15 GiB** | we are **4.80 GiB above** it |
| R2-1...R2-5 releases | **+7.307 GiB** | audit re-measure reproduced this exactly |
| R2-6, R2-7 gate3 worktrees | **+1.155 GiB** | audit re-measure reproduced this exactly |
| **Total reclaim** | **+8.462 GiB** | |
| **`E:` free after R3** | **~28.26 GiB** | 19.797 + 8.462 |
| Packet "Target >= 35 GiB" | **NOT MET - short by ~6.74 GiB** | |

**Correction to my own false statement.** R2 asserted we were "~8 GiB above" the 25 GiB warn line and
"~18 GiB above" fail-closed. On R2's own 24.49 GiB figure that was already wrong in **direction**
(24.49 is 0.51 GiB *below* 25, not 8 above). On the live figure it is worse: we are **5.20 GiB below**
the warn line. The number is retracted and replaced above.

## R3 decision - the reclaim is now MANDATORY, and proceeding is authorised

The audit asked me squarely whether `>= 35 GiB` is a fail-closed gate. Answer, which I adopt: **it is
not.** `AGENTS.md` §3 defines exactly two volume gates - **warn below 25 GiB** and **fail closed below
15 GiB**. It does not define 35. The 35 GiB figure is a **planner-authored packet *Target***, not a
directive gate. So the correct reading inverts the risk:

- We are **in the §3 warn band** (19.797 GiB, 5.20 GiB below 25). §3 says: *"When either volume crosses
  its warning, run the release-directory retention reclaim before the next release build."* The reclaim
  is therefore **mandated by the directive**, not merely permitted by the packet.
- Post-reclaim `E:` ~= **28.26 GiB** clears the warn line by 3.26 GiB and sits ~13.3 GiB above
  fail-closed, against a build cost of ~1.46 GiB. Both binding gates are satisfied.
- **Not** reclaiming would move us toward the 15 GiB fail-closed line while a parallel cycle is
  actively installing. The reclaim is the *risk-reducing* action, which is the opposite of the
  "proceed at 32.96 GiB" framing R2 used.
- The ~6.74 GiB shortfall against the 35 GiB target remains unreachable inside the authorised scope:
  it lives in `d31bfacb`/`c0d91827` (named rollback depth, forbidden by the packet's own exclusion and
  by the §13 reserved operator decision at `live-state.md:70-75`) and in the two donors plus the two
  unintegrated candidates. Reaching it needs an operator exception that is **reserved, not granted**.

**Residual risk, stated rather than hidden:** c11 may consume `E:` again. This is why the reclaim runs
**now**, before the build, and why the post-action figure is re-measured immediately afterwards rather
than trusted from this table. If `E:` is again below 25 GiB at build time, the build is a §3 decision
for the planner, not an assumption.

## R3 - also correcting two NON_BLOCKING findings from the R2 audit

- **N1 - the `0da104f9` donor claim was false.** R2 said it had 11 borrowers via
  `lane-a2-timetable-custody`. Measured: its `atlas-client`/`atlas-server` `node_modules` are **real
  directories, not junctions**, with **0** borrowers across 27 roots. It stays a PRESERVE row -
  preserving it is conservative and costs nothing - but the "one real dependency source" keep-set slot
  is carried **solely by `861d89a2`** (5 borrowers, verified by two independent scans).
- **N2 - unaccounted directory.** `E:\ATLAS-worktrees\lane-a2-timetable-custody` exists on disk with
  content but is **no longer a registered worktree** (no `.git`, absent from `git worktree list`). It is
  **PRESERVE_FOR_DECISION - uncertain owner** (`agent-worktree-lifecycle.md`: preserve every worktree
  of uncertain owner). No R2/R3 row touches it.

## R3 - final operative scope: retire exactly these 7, preserve everything else

**RETIRE** (non-forced `git worktree remove`, then one `git worktree prune`):
`E:\ATLAS-runtime-supervised-26f7c907-20260926` (R2-1) ·
`E:\ATLAS-runtime-supervised-400a6909-20260926` (R2-2) ·
`E:\ATLAS-runtime-supervised-e4989b72-20260926` (R2-3) ·
`E:\ATLAS-worktrees\lane-a2-release-9b28c572` (R2-4) ·
`E:\ATLAS-worktrees\lane-a3-release-c4a9960e` (R2-5) ·
`E:\ATLAS-worktrees\lane-gate3-a3c8-review` (R2-6) ·
`E:\ATLAS-worktrees\lane-gate3-a3c8-base` (R2-7)

**PRESERVE — never touch:** `lane-a2-release-a1db27d5` (live) · `lane-a2-release-d31bfacb` (rollback
basis) · `lane-a2-release-c0d91827` (one step back) · `ATLAS-runtime-supervised-861d89a2-20260925`
(client dependency donor) · `lane-a2-release-0da104f9` · `ATLAS-runtime-supervised-116a7658-20260726`
(unintegrated) · `lane-a3-release-f426f465` (unintegrated) · `lane-a2-timetable-custody` (unregistered,
uncertain owner) · **all three `lane-a2-c11-*` worktrees** (parallel cycle, one is dirty) ·
`D:\ATLAS-runtime-supervised-20260912` and `D:\ATLAS-runtime-fallback-d44-20260912` (named
last-resort artifacts, on `D:`, outside this reclaim entirely).

No `--force`. No glob. No computed path. No raw recursive deletion. **No branch or ref deleted.**
No runtime, task, environment, database, generation or publication action. The live release is not
stopped, restarted or re-pointed. No credential is read or printed.

