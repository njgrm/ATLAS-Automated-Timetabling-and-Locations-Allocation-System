# Integrator handoff — ATLAS release train, 2026-10-03

**For:** the next planning session (Sol or equivalent). **Written by:** Hermes, 2026-10-03.
**Read this first, then `docs/handoffs/hermes-checkpoint-20261003.md`, then act.**

You are the **integration owner** for this train. The operator has granted standing authority
for deployment and HIGH actions. The blocking dependency (a GitHub push) is now resolved.

---

## 1. Situation in five lines

- `origin/main` = `c0d2d30e`. Nothing unpushed. `main` is clean.
- Live release = **`a46710d6`**, healthy (5001 health 200). **Do not touch it until the gate passes.**
- A fully verified train is integrated on branch `integration/trains-20261003`, tip **`06a03277`**,
  in worktree `E:/ATLAS-worktrees/lane-int-trains` (clean).
- No schema or migration change in the train. 107 product files.
- The operator removed the deploy-count cap and the 22:00–06:00 blackout (decision 16a, amended,
  commit `7378dbbd`). **Release on evidence, not on a tally.**

---

## 2. Do NOT re-derive these (each was corrected the hard way)

| Fact | Why it matters |
|---|---|
| Auth review verdict is **ACCEPTED, zero blocking findings** | It is not pending. Re-running it wastes a cycle. |
| The §3 worktree cap is on **active** worktrees; 62 *registered* is **not** a violation | `docs/reference/agent-worktree-lifecycle.md` says so explicitly. Retiring on that basis is wrong. |
| Campus building colours are **index-assigned by design** (`CampusMapEditor.tsx:296`) | A subagent claimed a broken grade palette. All five `GRADE_COLORS` maps are correct DepEd. |
| `main` is level with `origin/main` | The earlier "stale token" blocker is resolved. Do not re-diagnose it. |
| `publication-approval.router.ts` and `scheduling-policy.router.ts` were **already guarded** via inline `requestHasCapability` | A grep for `requireCapability(` misses them. Real unguarded scope was 34 routes / 5 routers, not 41 / 8. |
| Run **360** is the published run (not 359), with **108 SOFT** violations, zero HARD | `docs/plans/live-state.md` is stale on this. |

## 3. Environment traps that already cost cycles

- `git push` to `main` is blocked by `D:/ATLAS/.git/hooks/pre-push` unless `ATLAS_INTEGRATOR=1`.
- Any tool in a **background/non-interactive shell** gets `stdin is not a tty` and silently
  produces a 19-byte stub instead of real output. Verify any measurement is >100 bytes.
- Node test tallies are `i`-prefixed (`i pass` / `i fail`), not `#`. A `#` grep matches nothing
  and looks like a red test.
- `git worktree remove` follows a `node_modules` junction and **empties the shared donor**.
  `cmd /c rmdir` the junction first, always.
- ESLint exits 1 when it finds errors, so `execFileSync` throws — read the JSON off the error path.
- Read runtime identity from **machine scope**, never inherited env (`ATLAS_RUNTIME_SOURCE_DIR`).

---

## 4. Train contents and evidence

| Item | SHA | Evidence already gathered |
|---|---|---|
| A6 placement gate | `8766c084`/`fffa830c` | Server-enforced at `faculty-assignment.service.ts:5452`; **zero** write calls in 5321–5451; 409; zero-write control 25/25 residue 0 |
| p06c · p06d · p07 | on main | p07 Flag/HGP verified live at 1366×768 and 390×844 |
| prisma live-DB guard | on main | Proved: refuses `TESTS_NEVER_TOUCH_LIVE` at module load |
| Auth enforcement | `d52f5355` | Independent review ACCEPTED, 0 blocking; 34/34 routes 403; officer **0** denials; mutation 58→51 |
| Tab affordance + break band | `5e31b698` | Contrast measured from built stylesheet; **no rendered screenshot** |
| MR-71 subjects | `5883b4e8` | 99/99; coverage assertion proven to discriminate |
| D6 teacher filters | `3486d895` | 136 tests, 1 pre-existing fail; Substitute deliberately not offered |
| D1 vocabulary (Edit/Save) | `e8bdfbed` | 16 suites, net **0** new failures vs measured baseline; lint 981 = baseline |
| Gate-script fix | `06a03277` | Two new tests had **no** committed script (§11) — planner fix |

**Known non-blocking follow-ups:** `TimetableSubNav.tsx:36` still reads `label: 'Draft'`;
two `Published schedule` strings sit under other lanes' pins; 18 of 34 guarded routes lack a
wiring assertion; `D:/ATLAS/atlas-client/node_modules` is empty; `Faculty.tsx` is at exactly 1000 lines.

---

## 5. What to do, in order

### Step 1 — get the release tree onto the train
```
git -C E:/ATLAS-worktrees/lane-a4-release-20261003-trains fetch origin
git -C E:/ATLAS-worktrees/lane-a4-release-20261003-trains merge --ff-only origin/main
git -C E:/ATLAS-worktrees/lane-a4-release-20261003-trains merge --no-ff 06a03277
```
Confirm the merge tree is clean and record the new release SHA (40 chars).

### Step 2 — build and prove the artifacts
`release-prepare.ps1 -Sha <newsha>` builds in the release tree. It asserts both `dist` entry
artifacts exist (rule 19). Record its real output.

### Step 3 — write the release record (THE GATE)
`release-request.ps1` reads `git show origin/main:docs/plans/live-state.md` and **refuses**
unless `## Live release` names BOTH the new target prefix AND the incumbent/rollback prefix
(`a46710d6`). Edit `docs/plans/live-state.md`, commit, and push:
```
cd D:/ATLAS
$env:ATLAS_INTEGRATOR="1"
git add docs/plans/live-state.md
git commit -m "docs(release): pin <newsha> target and a46710d6 rollback"
git push origin main
```
Do **not** grow that file; the gate needs ~3 lines.

### Step 4 — request the cutover
```
powershell -File ops/runtime/release/release-request.ps1 -Dir E:\ATLAS-worktrees\lane-a4-release-20261003-trains -Mode dry-run
```
Then `-Mode release`. The SYSTEM task polls `C:\ProgramData\ATLAS\release\inbox` and does the
cutover — **no AI holds admin**. Results land in `C:\ProgramData\ATLAS\release\results\<id>.json`
with `status` = `LIVE | ROLLED_BACK | FAILED_*`. Only `FAILED_DOWN` needs the operator at once.

### Step 5 — prove it, then accept it
- Verify the target chunk is actually served (a byte/hash discriminator that **differs** old vs
  new — a proof that cannot distinguish is vacuous).
- `GET /api/v1/health` and a DB-backed read (`/api/v1/subjects?schoolId=1`) both 200.
- **Live Tailnet browser acceptance** at `https://njgrm.buru-degree.ts.net`, asserting
  `window.location.origin`. Use the recipe in the `atlas-live-browser-evidence` skill
  (Hermes `browser_exec` is blocked for private addresses — drive Playwright from the terminal).

### Step 6 — the visual judgement the operator still owes
No packet in this train has rendered before/after proof. After cutover, capture **live Tailnet**
screenshots for: Class Schedule tab bar, HEALTH BREAK band, Subjects name column, Teachers
filter row, and the Edit/Save vocabulary. Score them against the `ux-communication-rubric`:
one primary action, no truncation, no jargon, one status per fact, nothing cramped.

---

## 6. Operator decisions already made

- **16a amended** — deploy-count cap and quiet hours removed. Ship on evidence.
- **D1** — vocabulary is now **Edit** (was Draft) and **Save** (was Published). Display layer only;
  stored keys remain `draft`/`published`; the publication gate is untouched.
- **D2** — parked deliberately. A layout note exists (explain, never silently block). Do not build it.
- **D6** — teacher filters per `forReview/miss-jo-1.docx`. **Substitute was not offered** because
  EnrollPro writes `employmentStatus: 'PERMANENT'` for every synced teacher. If a real field ever
  arrives, `D6-FILTER-2` fails deliberately.
- **MR-71** — fix the clipping, keep the code chip removed (locked test `a5-c3-subjects-calm-surface`).

## 7. Working agreement with the operator

- Operator grants standing authority for deployment/HIGH actions; the approval round-trip is waived.
  Independent review, one executor, one fresh post-action QA, and real tallies still apply.
- **Executor and QA should stay on the cheap model.** The space-bunny QA review was the strongest
  verification of the last session — it found a test gap the planner missed and correctly
  overruled the planner's own measurement. Independence is the point. Escalate beyond it only for
  architecture, conflicting candidates, or a second opinion on an auth boundary.
- Skills written and available: `atlas-live-browser-evidence`, `atlas-running-tests`.
- The operator works away from the machine; work continuously and compact rather than stopping to ask.