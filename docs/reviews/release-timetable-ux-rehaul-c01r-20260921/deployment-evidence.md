# Deployment evidence — RELEASE `d92facfa` (TIMETABLE-UX-REHAUL-C01R)

- **Pin:** `d92facfa14b1d33b6da04f0c169cd73f7221e713` (registered detached worktree
  `D:\ATLAS-runtime-supervised-d92facfa-20260921`).
- **Incumbent / rollback basis:** `ecff1d7e6050f89aff9906221ab614a5e8132c9c` at
  `D:\ATLAS-runtime-supervised-ecff1d7e-20260921` — **not executed**.
- **Date:** 2026-09-21/22 (Asia/Manila). Executed by Lane A under the operator's standing
  authorization (2026-09-20); every gate retained.
- **Verdict:** `ACCEPT_READY` — D1–D7 **7/7 passed, blocked 0, unperformed 0**; D6 U1–U6 **6/6**.

## Gates before execution

| Gate | Range | Result |
| --- | --- | --- |
| Client source review (pre-action) | `f2ea0d4a...6d0aab46` | `ACCEPT_READY` **18/18/0/0**, no blocking finding |
| Release opening gate — unreviewed server delta + packet lint + built-artifact identity | `ecff1d7e..128a1c8f -- atlas-server` | `ACCEPT_READY` **22/22/0/0**, no blocking finding |
| Post-action QA (deployment + U1–U6) | live `d92facfa` | `ACCEPT_READY` **7/7**, U1–U6 **6/6**, blocked 0, unperformed 0 |

The release would have carried `ROLLOVER-YEAR-IDENTITY-C01` (merge `a2c5205c`) with no committed
review verdict; the opening gate reviewed it alone before any runtime action, per `AGENTS.md` §11.

## Delta versus the live `ecff1d7e` (product paths)

- **Client `TIMETABLE-UX-REHAUL-C01R`** (reviewed 18/18): `TimetableSubNav.tsx` (new),
  `simple/SimpleDayOptions.tsx` (new), `TimetableSimpleHeader.tsx`, `TimetableGrid.tsx`,
  `simple/SimpleDriftBanner.tsx`, `simple/SimpleHeaderHelpers.tsx`, `ScheduleReviewWorkspace.tsx`,
  `lib/__tests__/timetable-ux-rehaul-c01.test.ts` (new), `atlas-client/package.json`.
- **Client test-only gate repair `0758075e`:** the three false-green `test:*` entries and
  `lib/__tests__/gate-reachability.test.ts` (+ the one-assertion `timetable-cell-info.test.ts` update
  inside the reviewed client delta). No product effect.
- **Server `ROLLOVER-YEAR-IDENTITY-C01`:** `atlas-server/src/routes/runtime.router.ts`,
  `src/__tests__/rollover-year-identity-c01.test.ts`, `atlas-server/package.json`.

## Build

Dependency trees copied junction-free from the incumbent (robocopy, exit 1 = copied; no reparse
points); `npx prisma generate --schema ..\prisma\schema.prisma` from `atlas-server` → generated to
`atlas-server\node_modules\.prisma\client`; server `tsc` build; client `vite build` with exactly
`VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` and SMART/AIMS unset. Both builds exit 0.

- **New client entry chunk:** `index-DgF0ZSEz.js` — **456,064 B** (incumbent `index-CbCvgFxw.js`,
  456,046 B → differs).
- **`atlas-server/dist/server.js` SHA-256:** `367B7B40D8BF84BE9937F13CABD00C6277B3543448833389A4D7DFCB950C4623` (2,998 B).

## Rows

**D1 — release identity: PASS.** Worktree HEAD = pin; `git status --short` = `?? ops/runtime/logs/`
only. Machine scope `ATLAS_RUNTIME_SOURCE_DIR`/`…_RELEASE_SHA` = the new dir/pin; task
action/arguments/working directory re-pointed; active state file
(`<sourceDir>/ops/runtime/logs/supervisor-state.json`) `releaseSha=d92facfa…`,
`sourceDir=` new dir. Task XML captured pre-mutation
(SHA-256 `67B900EB2CAB496EDD3A1289CB6A903A7F65EF7915CC5B9F1C75B5093D7C3CF9`); re-registered from
the captured XML with the two path occurrences replaced (schtasks `/create /xml … /f`, exit 0).

**D2 — ownership: PASS.** Exactly one listener each: `5001 → 34964` (`node …d92facfa…\atlas-server\dist\server.js`),
`5174 → 344` (`node …d92facfa…\ops\runtime\host.mjs`), both children of supervisor **17828**
(`node …cli.mjs start`, `NT AUTHORITY\SYSTEM`, SessionId 0). Task keeps SYSTEM (`S-1-5-18`) /
BootTrigger / `PT0S` / IgnoreNew.

**D3 — health and public truth: PASS.** Local health, readiness, host, Tailnet health and Tailnet
root all 200; `GET /api/v1/subjects?schoolId=1` 200 (19,440 B); published schedule with explicit
`termIndex=1` 200 and term-scoped (`source.termScope="explicit"`); `termIndex=0`/`abc` →
`400 INVALID_TERM_INDEX`; unauthenticated violation-report routes → `401 NO_TOKEN` before dispatch.

**D4 — served-artifact identity, configuration, zero write: PASS** (one disclosed limitation).
Served HTML text-identical to `atlas-client/dist/index.html`; **34/34** referenced assets
byte-identical to the built dist; entry chunk `index-DgF0ZSEz.js` 456,064 B (differs from the
incumbent); EnrollPro origin present, SMART/AIMS start URLs `void 0`; SMART/AIMS `/start` → `503
COMPANION_SSO_NOT_CONFIGURED` with no `Location`/`Set-Cookie`; durable env
`D:\ATLAS-runtime-config\atlas-server.env` mtime 2026-09-18 (predates the cutover), SHA-256
`BC7921A782141DA3819262FD7E2008B6FD7E256A067BFFF018D197430AED565C`, 17-key set.
*Limitation:* no pre-cutover signature map existed in this session; the current map was derived
twice (before and after logout) as **identical** — 46 tables, serialization `table=count\n`, UTF-8,
LF, trailing newline, no BOM, SHA-256 `368f66f765454de741f67be794d47b416ef07c1d31a53d04ec44a263ebdb1005`.
Byte-identity to a pre value is therefore decided on a stable map plus the pre-cutover env mtime and
cutover timestamp, not on a captured pre map.

**D5 — server artifact identity and harnesses: PASS.** Running entry resolves inside the release
dir; `dist/server.js` SHA-256 matches the build output and its mtime precedes the process start;
harnesses on the release tree, each literal: `test:rollover-year-identity-c01` **1/1**
(load-bearing), `test:actor-school-mutations-c02` **1/1**, `test:actor-school-residual` **1/1**,
`test:actor-school-mutations` **1/1**, `test:warning-readability` **9/9**. The live mutation routes
were deliberately **not** probed.

**D6 — U1–U6 on the live page: PASS 6/6.** Tailnet origin asserted, `1366x768`, run 316 (284 SOFT,
0 HARD), active T2 / 2031-2032.
- **U1 PASS** — no enum/code token in operator-visible text; **0** leaf text nodes < 12 px;
  screenshot `C:\Users\njgro\AppData\Local\Temp\opencode\pw-mcp-output\U1-timetable-1366x768.png`.
- **U2 PASS** — exactly **1** solid primary (`timetable-simple-primary-action`, `rgb(134,19,19)`;
  Generate/Publish white outline; `svgCount=0` → F-18 closed); exactly one status surface; the
  hidden-row strip is gone; cell detail renders `P. CRUZ · Room 103 · G7AW` → F-07 closed.
- **U3 PASS** — sub-nav on the index and on `/timetable/{setup,policies,runs,exports}` with correct
  `aria-current`; after 3 sub-pages and back the header DOM node is identical (no remount) and the
  grid is not refetched; breadcrumb renders (`Class Schedule / Setup`).
- **U4 PASS** — clean `/timetable` load **20 GETs, 0 non-GET** (baseline 19; +1); each sub-page move
  **1 GET** (baseline 0–3). Navigation is not slower.
- **U5 PASS** — e.g. `FERNANDEZ, JANELLA MARIE has 180 consecutive teaching minutes on Monday,
  exceeds limit 135 minutes.` and `VALDEZ, GABRIELA LUZ has 90 minutes idle gaps on Friday, exceeds
  limit of 60 minutes.`, each with an action; repair path from the status region
  (`Fix Rooms` → /map, `Preview impact`, `Sync with setup`); no bare `min`/`h`; no `Faculty <digits>`.
- **U6 PASS** — `documentElement.scrollHeight == clientHeight == 768`; `window.scrollY = 0`.
- Reviewer caveats: **N1 PASS** — closed header has no duplicate day controls, the toggle is absent
  while closed and the panel testids appear on open. **N2 PASS** — the tutorial's "Show full day"
  step renders the honest message `"Show full day" is not available in the current view.`

**D7 — session disclosure and cleanup: PASS.** **Zero logins by the QA session** — it reused the
pre-authenticated profile. Session origin: `audit_logs` row **862** `LOCAL_LOGIN_SUCCESS`, actor
**46**, school 1, `2026-09-21T17:21:28.725Z` (Lane A's single authorized login for this program);
actor 46 `last_login_at` `2026-09-21T17:21:28.163Z`. Delta from the QA session: **0 rows, 0
`last_login_at` change**. Logout proven: token cleared, `GET /api/v1/auth/me` → `401 NO_TOKEN`;
post-session DB re-read unchanged (`audit_logs` count 311, max id 862); browser context closed.

## Environment

`D:` free 32.83 → **31.33 GiB** (warn line 25, fail-closed 15 — never approached). `E:` 60.45 GiB.
Listeners before: 5001→26724 / 5174→31148 under supervisor 26972. After: 5001→34964 / 5174→344
under supervisor 17828.

## Findings

**BLOCKING: none.**

**NON_BLOCKING** — clean-load GETs 20 vs 19 (+1, no waterfall); transient 502s in console for
notification SSE and `runs/316/manual-edits` (host-proxy, observation O1; decisive requests 200);
Review-issues panel renders uppercase `SOFT`/`HARD` severity badges (pre-existing, plain-English
severity, not an enum-code leak); the status region still draws three visual lines inside one
region (F-03 materially reduced, not a single row); sub-nav links are 24 px high (WCAG 2.2 AA
minimum, below the 44 px "generous" ideal); React Router element-less-children console warnings on
every `/timetable*` route (pre-existing).

**Stated limitations** — U2's no-run / publish-ready / published lifecycle states are not reachable
read-only on the live page (covered by the committed component harness, 35/35); D4's "env bytes
unchanged" and "signature map byte-identical to the pre value" rest on the pre-cutover mtime plus a
stable current map, because no pre-cutover capture existed in this session.

## Rollback

Not executed. Incumbent `ecff1d7e` remains startable in place at
`D:\ATLAS-runtime-supervised-ecff1d7e-20260921` with its captured task XML and both machine-scope
values. `80acdc25`, `a02884ff` and `4c7c0bd9` remain behind it.
