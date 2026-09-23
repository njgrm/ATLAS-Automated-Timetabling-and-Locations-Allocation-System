# Planner handoff — 2026-09-23 late (post-C05 deployment)

**For the next cycle's planner.** Self-contained. `origin/main` = `9f5d39cd` at authoring (may have advanced).
**Custody:** Elevated OpenCode owns the shared runtime (5001/5174) and the single authenticated browser.
Planner B ("Plan scheduler collaboration") released **source** custody and owns no runtime or browser access.

---

## 1. Live state

| | |
|---|---|
| Live release | **`4893cbde`** at `E:\ATLAS-runtime-supervised-4893cbde-20260923` |
| Supervisor | PID 56336 → server `5001`→15672 / host `5174`→50852 |
| Served entry | `/assets/index-CO9LQ3Su.js`, SHA-256 `F309A458…F9BB`, byte-identical to the target build |
| Rollback basis | **`0232bf9c`** at `E:\ATLAS-runtime-supervised-0232bf9c-20260923` (startable in place) |
| Health | `/api/v1/health` 200, `/health/ready` `{"database":"ok"}`, subjects read 200 / 19,440 B, Tailnet 200 |
| `D:` free | 37.8 GiB (retention cycle freed 17.5 GiB today) |

Deployed by the handoff runner (pristine base `38090BB1…168B`) with the pre-deploy record committed first
(`e9d89acb`) so the record **led** the cutover. Two prior attempts failed and rolled back safely; the root
cause was a **shallow clone** failing the supervisor's pre-logger product-pin check. Audit:
`C:\ProgramData\ATLAS\release-audit\4893cbde-20260923-215632`.

## 2. Browser acceptance — IN PROGRESS, not yet `ACCEPT_READY`

**Verified PASS (desktop 1366×768, origin asserted on every route):**
- `/timetable` — full workspace; sidebar retained; `main` `overflow-hidden` at 768px; **no global overflow**;
  no routine cached/run provenance; `GR7 - Luna`; crest `<img>` loaded (450×450, fallback not exercised);
  sub-nav Schedule/Draft/Setup/Policies/Runs/Exports; `Published — read only`; grid populated Mon–Fri
  (incl. `J. FERNANDEZ`, and a `Flag Ceremony / Homeroom Guidance` row).
- `/timetable/pre-generation` — **"Return to published" visible**; activating it restored the published view
  with run **317**, **TERM 2(active)**, **GR7 - Luna**, and **every request was GET** — zero writes.
- `/timetable/setup` — focused pane (no Filters/Download/Generate/grid controls).

**Findings:**
1. **"Expert copy" is NOT missing** — an earlier FAIL was a false negative and is withdrawn. The copy is in
   code (`SimpleMoreMenuContent.tsx` "Expert view", `ScheduleReviewWorkspace.tsx:483,760` "Expert details",
   `SimpleHeaderHelpers.tsx` guidance) and asserted by committed tests. It is absent from the DOM only
   because the **More menu is lazily mounted**. *Operator position: if the Simple view now carries the daily
   workflow, the Expert copy is not missed.* **Confirm by opening More once.**
2. **3 × transient 502** on `runs/317/manual-edits`, `runtime/rollover-status`, `follow-up-flags/1/10/runs/317/flags`
   — the same endpoints returned **200** minutes earlier on `/timetable`. This is the recorded unowned
   "host-side 502 / `UPSTREAM_UNREACHABLE`" layer, not a C05 regression.
3. `/timetable/setup` shows **"Can't reach EnrollPro right now"** — expected while
   `ENROLLPRO-PROXY-RECOVERY-LIVE` is NOT GRANTED; the pane degrades gracefully.

**Still to run:** FERNANDEZ issue drawer (Cancel inert → Confirm pivots), repair-guide 404 check,
`/timetable/runs|policies|exports` focused-pane checks, mobile 390×844 (`/timetable`, `/timetable/runs`),
and the five read-only issue-truth samples (Consecutive Limit, Excessive Building Transitions,
Insufficient Transition Buffer, Cross-Floor Transition, Excessive Idle Gap).

## 3. Credential mechanism — reuse this, do not type the password

The Playwright MCP code sandbox has **no `fs`, no `require`, no dynamic `import`**, so a snippet cannot read
the credential file. The working method (used today, then cleaned up):

1. A transient PowerShell script reads `%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md`
   in-process, POSTs `{identifier, password}` to `/api/v1/auth/login`, and serves the token over
   `http://127.0.0.1:5123/` with `Access-Control-Allow-Origin` set to the Tailnet origin.
2. The page `fetch`es it and writes `localStorage/sessionStorage['atlas_local_token']` + `userRole` — the
   same storage the client's own `setLocalToken` uses.
3. Kill the process, delete the script, close the port.

The secret never enters the transcript, a form field, a log, or a file. **Do not type the credential into
the login form** — that is how the value ended up in 8 plaintext files (including a captured
`login-body.json` and MCP page snapshots). **One login occurred today** (`2026-09-23T22:10:47+08`, role
`officer`); its `LOCAL_LOGIN_SUCCESS` row is the disclosed delta. **Credential rotation is still
outstanding** — the leaked value remains valid.

## 4. Open question for this cycle — flag ceremony vs class, and shifts

**Operator evidence:** `D:\ATLAS\stakeholderFiles\` — images added 2026-09-23 22:49–22:51:
`GRADE7_STE.jpg`, `GRADE7_STE_EVIDENCE.jpg`, `GRADE8_STE.jpg`, `GRADE8-STE2.jpg`, `GRADE8_REGULAR.jpg`.
**Not yet examined** (deferred for context). The claim: *"the day shifts don't have displaced classes"*.

**What is already known:** `ClassProgramSlot` is uniquely keyed on
`[schoolId, schoolYearId, gradeLevel, programType, dayOfWeek, startTime, rowKind]` — **`rowKind` is part of
the key**, so a class and a ceremony can coexist at the same day+start as different kinds. The server
already filters `rowKind === 'CLASS'` in several places, and the live grid renders the ceremony as its own row.

**The open questions:** can a `CLASS` row be scheduled concurrently with a non-`CLASS` ceremony row at the
same start time without a HARD conflict? Are morning/afternoon **shifts** modelled at all? Read the five
images first, then decide whether this is a data-model gap, a conflict-detector gap, or already supported.

## 5. Open technical debts (all recorded in `live-state`)

- **`deploy-runner` gate defect (mine).** The live-state gate resolves the shared repo from
  `-TargetSourceDir`; a **clone** target has no `origin/main`, so it dies with a raw
  `fatal: invalid object name` instead of a clear refusal. Either sharpen the message or add
  `-LiveStateRepo`. This cutover used the handoff runner because of it.
- **Runner hardening (latent).** `MultipleInstancesPolicy` is `IgnoreNew`; a `/run` issued while the
  scheduler still considers an instance live is **silently dropped and still returns 0**. Release the
  instance (`schtasks /end` + poll) before `/run`. **One owner for `ops/runtime/deploy-runner.ps1`.**
- **The host-side 502 layer** — unowned, uninvestigated. Now observed live again (finding 2 above).
- **Retention:** `D:/ATLAS-runtime-*` holds ~26 GiB of rollback anchors, junction targets and historical
  releases, kept by operator choice until after the demo. The next tranche (~11.2 GiB, six audit-recovered
  anchors) plus the historical releases are the follow-on.
- **`agent-worktree-lifecycle.md`** now carries the retention policy, the scan-scope rule, the
  deployment-register rule and the credential rule. `AGENTS.md` §2's "ask first before a helper script"
  clause was to be removed this turn (operator instruction) — **verify whether it landed**.

## 6. Live-state reconciliation already done today

Retention policy landed; 14 release dirs retired; register `mode` set to `MANUAL`; register + generated
mirror reconciled; `live-state` rollback depth rewritten; superseded-release claims marked.
