# Planner Handoff — fresh session, 2026-09-20

**To:** incoming primary planner · **Repo:** `origin/main` = **`b11509e8`**
**Read also:** `docs/plans/live-state.md`, `AGENTS.md`, `docs/reference/agent-*.md`

This handoff exists because the outgoing session developed a **degenerate generation
loop** (four occurrences). Everything durable is committed, so a fresh session loses
nothing. The sections below carry context that is **not** in the directive.

---

## 1. Objective

Presentable live ATLAS demo on the **active school year** (`schoolYearId` = upstream
**10**, S.Y. 2031-2032) at `https://njgrm.buru-degree.ts.net`: generation end-to-end,
exports, corrected Teaching Load + Timetable UX, and working EnrollPro↔ATLAS SSO.

Operator acceptance standard for UX, verbatim: ATLAS must *"feel like it's really the
same system"* as SMART. And: *"What the users are reacting to is the entire timetable
page itself because it looks like a pilot cockpit, not just the high amount of numbers."*

---

## 2. BUDGET — check this first, before any real work

### The x4 promo is expiring today

`https://opencode.ai/docs/go/` (updated Sep 19, 2026) still lists:

```
DeepSeek V4.1 Flash (Off-Peak)  $0.15 / $0.60 / $0.003   →   $15   [$60  4x · Ends Sep 20]
```

**Measured at handoff: monthly 35% ($21 of $60), weekly 70%, rolling 5%.** If the
allowance reverts to **$15**, the account is instantly at **140% — blocked**.

### The mitigation (verified)

`deepseek-v4-flash` still shows **$30** monthly and **65,000 requests/month** (vs
V4.1 Flash's 32,500 standard). DeepSeek's own docs state the legacy names are retired
but *"their requests are served by the DeepSeek-V4.1-Flash model and billed at the
Flash price."* The `atlas-bench-dsflash` probe **passed** and ran a real build
experiment. **So `opencode-go/deepseek-v4-flash` gives the same model at 2× the
allowance.** If the promo has lapsed, edit `model:` in `atlas-planner.md` to
`opencode-go/deepseek-v4-flash` and restart opencode. **QA is already on this model**
(`atlas-qa-dsflashv4`) — only the planner needs changing.

### Usage monitoring — NOT in the directive

```powershell
$auth = Get-Content "$env:USERPROFILE\.local\share\opencode\auth.json" -Raw | ConvertFrom-Json
$r = Invoke-RestMethod -Uri "https://opencode.ai/zen/go/v1/usage" `
  -Headers @{ Authorization = "Bearer $($auth.'opencode-go'.key)" } -TimeoutSec 40
"monthly {0}%  weekly {1}%  rolling {2}%" -f $r.usage.monthly.percent, $r.usage.weekly.percent, $r.usage.rolling.percent
```

Report it each turn. **Cost drivers measured:** ~40,000 uncached input tokens per
request against ~200,000 cached; **uncached input was 82% of the bill**. `Use balance`
is NOT enabled (operator is on a tight budget), so limits are a **hard stop**.

**Observed cycle costs:** MiMo executor cycle (3 QA rounds) ~$3.00; DeepSeek or Muse
(1 round) ~$0.30–0.60; the C12 cycle (2 rounds) ~$1.20. **The cost is dominated by QA
round count, which is dominated by the executor's reporting honesty.**

---

## 3. Model routing — decided, not in the directive

| Lane | Model | Status |
| --- | --- | --- |
| **Executor — DEFAULT, use this** | `opencode-go/muse-spark-1.3-contributor` (`atlas-executor-muse`) | **Use it.** Cheapest ($0.10/$0.20), $60 allowance, 3-for-4 clean, honest reporting. **Trains on prompts — operator explicitly authorized this** given budget pressure. |
| Executor — fallback | `opencode-go/deepseek-v4.1-flash` (`atlas-executor`) | Privacy-safe (`Not used` / `0 days`), tried and tested. Use when the data clause matters more than cost. |
| **QA — ALREADY SET, do not change** | `opencode-go/deepseek-v4-flash` (`atlas-qa-dsflashv4`) | **Already the QA agent.** Nothing to switch. Passed the Probe A discriminator and ran a real build experiment. $30 allowance. |
| **Planner — ACTION NEEDED if the promo lapses** | currently `opencode-go/deepseek-v4.1-flash`; change to `opencode-go/deepseek-v4-flash` | The planner is on the **expiring** model. `atlas-planner.md` `model:` must be edited to `opencode-go/deepseek-v4-flash` **if the promo has lapsed** (§2), then **restart opencode**. |
| Retired — do not use | MiMo V2.5 | **Not usable.** 3 QA rounds, ~$3, false mandatory-row claims, deleted evidence, ran a denied `git stash`, false "zero residue", invented a mock control. |

**Summary in one line: executor = Muse, QA = `atlas-qa-dsflashv4` (already done), planner = switch to `deepseek-v4-flash` only if the promo has lapsed.**

**Agent files** (in `~/.config/opencode/agents/`): `atlas-bench-{ds,dsflash,mimo,muse,qwen,qwen8,kimi,glm,longcat}.md`,
`atlas-executor-muse.md`, `atlas-qa-dsflashv4.md`. Bench agents are read-only with the
secret-read prohibition; executors carry the same ban plus the additive-evidence rules.

**Allowlist:** `task:` in `D:\ATLAS\.opencode\agents\atlas-planner.md` (and the
user-level copy) must list every dispatchable agent, or the harness denies the call.
**Adding an agent requires an opencode restart.**

---

## 4. Session-level failure mode — read this

**The outgoing session hit a degenerate generation loop four times.** The pattern:
after a long tool result, when producing a long structured response, the model emits
repetitive filler and produces nothing. Cost ~$0.30 per occurrence (pure text, no tool
round-trips) and 50+ minutes of wall clock.

**Mitigation:** keep responses short; prefer one tool call over a long preamble; if a
response starts repeating, **end the session and resume fresh**. The register, packets,
and commits are all current, so nothing is lost.

---

## 5. Runtime and repo state

| Item | Value |
| --- | --- |
| Product pin | **`74c1f12a`** (`1400bea2`+ are docs-only above it) |
| Release dir | `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918` |
| Supervisor | PID 67028, `NT AUTHORITY\SYSTEM`, task-launched |
| Task | `ATLAS-Runtime-Supervisor` — ONSTART, SYSTEM, Highest, IgnoreNew, `PT0S` |
| Entry chunk | `assets/index-CtOKnF1z.js` |
| Health | local health/ready 200, Tailnet 200, DB-backed read 200 |

Machine env (all three required; the task-launched process resolves the release from
these, **not** its own directory): `ATLAS_RUNTIME_ENV_FILE` =
`D:\ATLAS-runtime-config\atlas-server.env`, `ATLAS_RUNTIME_SOURCE_DIR`,
`ATLAS_RUNTIME_RELEASE_SHA`.

**Do not retire** `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918` — the live
`atlas-server/node_modules` chain root. `git config --system --add safe.directory "*"`
is **required** or the SYSTEM supervisor fails `PIN_UNRESOLVED`.

**DB:** `atlas_recovery_clean_rebuild_20260905` @ localhost:5432. Active year = upstream
**10** (mirror row 551) — data tables key on **10**, not 551.

---

## 6. Operator decisions (all resolved)

- **D-1** adopt the SMART convergence contract as amended by the delta; sync the fork first.
- **D-2** cycle ON, full program, stop at every HIGH boundary. *"Only what is necessary."*
- **D-3** UX-P01 authorized (integrated).
- **D-4** `74c1f12a` deployed.
- **D-5** covered by standing browser-QA authorization; disclose the login delta.
- **D-6** answered — no defect (published run already carries `softViolationsAcknowledged`).
- **`gradeScope` apply** — approved and **executed** by the other planner.
- **Warnings: report unique issues per term only.**
- **The UX problem is the whole page** ("pilot cockpit"), not the warning count.
- **Muse Spark Contributor authorized** despite the training-data clause.

Standing: publication/generation gate = **zero HARD violations**; trigger = `preflight.ok`;
`GENERATION_PREFLIGHT_STALE` is intended fail-closed; labs out of scope; cap stays
`maxTeachingMinutesPerDay = 400`; 225 min/wk is a MATATAG *subject* allotment;
`DEVL_READING` is legitimate — do not archive.

---

## 7. Integrated this session

| Stream | Candidate | QA |
| --- | --- | --- |
| `HOME-ROOM-AUTO-ASSIGN-C01` | `9a263016` | `ACCEPT_READY` 10/10 |
| `UX-R06` | `eff7d507` | round 1 `CORRECTION_REQUIRED` 14/12/2/0 → round 2 8/8 |
| `UX-P01` | `d2a94491` | `ACCEPT_READY` 15/15 |
| `SSO-CLIENT-CONFIG-C01` | `0a06f306` | 12/11/1/0 — browser row deferred |
| `SECTION-ROUTE-AUTHORITY-C01` | `af5982c7` | `ACCEPT_READY` 10/10 |
| `SECTION-ROUTE-AUTHORITY-C02` | `af1ed0bb` (DeepSeek) | `ACCEPT_READY` 10/10 |
| `SECTION-ROUTE-AUTHORITY-C03` | `6f1abc2b` | `ACCEPT_READY` 9/9 |
| `PUBLISHED-REVISION-AUTHORITY-C12` | `c01b171f` | 11/10/1/0 → accepted with disposable rows deferred |

Muse's C02 candidate `211dea0c` was **accepted by QA but deliberately not integrated** —
C02 was already closed by DeepSeek. Worktree `c02-muse` is evaluation residue.

---

## 8. Open items

**Code defects (no packet yet unless noted):**
1. **Term merging in the public published view** — `/public/schedules` renders every cell
   3× (2,760 entries = 920 × 3 terms; 720 of 1,320 groups). **Owned by the other planner**
   (their "author the public term-scoping correction").
2. **`test:ux-guardrails` is vacuous** — names two files deleted by `4794bd9e`; exits 0
   with 21 tests from one file. Must not be cited as evidence.
3. **`ZONE_IMBALANCE_WARNING` is a false category** — fires because **0 of 103 rooms**
   have a zone. A config gap wearing a schedule warning's clothes.
4. **`FACULTY_FLOOR_TRANSITION` message broken** — `(14:30→14:30) with only 0 min gap`.
5. **Warning count semantics** — 335 API rows / 116 unique / 113 shown.
6. **`api.ts:4` cast** — NOT a defect (proven); cosmetic inconsistency only.

**Residuals recorded:** C03's R3 deviation (justified, packet was self-contradictory) and
F1/F2 (system-token legacy fallback + route asymmetry) are in the C03 packet.

**Packets ready:** `warning-readability-c01`, `flag-compensation-slot-c01` (all decisions
resolved), `export-presentation-c12`, `home-room-auto-assign-c01` (§2 apply executed).

**Worktrees to retire:** `published-revision-authority-c12`, `section-route-authority-c02`,
`-c03`, `c02-muse`. **Preserve `stash@{0}`** (`3c014d8b`, from the C01 lane).

---

## 9. Live-state facts worth not re-deriving

- **Deploy:** machine env is the switch; a SYSTEM-owned supervisor cannot be killed
  without elevation; prove a deploy by fetching a **build-specific chunk** (a healthy
  `/api/v1/health` on the old release looks identical).
- **The boot task** was pointing at an *older* release; it is now correct. Boot recovery
  only works because of `safe.directory`.
- **Only the `supervisor-state.json` inside the active source dir is authoritative.**
- **Browser QA:** persistent profile `C:\Users\njgro\.config\opencode\playwright-profile`,
  one controller at a time. Login works; credentials at
  `%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md`. **Scoped rule:** entering
  them into a browser login form is allowed even though the value appears in the
  transcript; committing, staging, repo files, screenshots, traces, fixtures, shell
  history, logs, handoff docs, and the register are **forbidden**.
- **Verified live:** Simple header `Generate` + `Publish schedule` render; section dropdown
  order correct (G7→G10, Regular then SPA/SPS/STE); no global scroll; **INTEGRATED SYSTEMS
  shows AIMS/SMART/ATLAS but NOT EnrollPro** (the SSO symptom — the deployed bundle was
  built without `VITE_ENROLLPRO_URL`).
- **Every production client build MUST set `VITE_ENROLLPRO_URL`** or the fail-closed guard
  emits no bundle.

---

## 10. Exact next action

1. **Check the promo** with the usage command in §2. If the allowance has reverted,
   change `model:` in `atlas-planner.md` to `opencode-go/deepseek-v4-flash` and restart
   opencode **before** any real work. **QA already runs on that model — only the planner
   needs changing.** Executor stays on Muse.
2. **Retire the finished worktrees** (§8), preserving `stash@{0}`.
3. Then pick up either the unowned **`warning-readability-c01`** packet, or the other
   planner's lanes — **check `docs/plans/live-state.md` first**, it is shared and current.
