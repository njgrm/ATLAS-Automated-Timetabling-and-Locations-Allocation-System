# RELEASE — TIMETABLE-UX-REHAUL-C01R (relaxed Simple shell) — pin `d92facfa`

Status: **PREPARED**. Risk: **HIGH** deployment (shared runtime) carrying a **MEDIUM** client delta
and an **unreviewed server delta** that this packet opens a review gate for.

Under the operator's **standing authorization (2026-09-20)**: HIGH actions, deployment and browser
acceptance proceed without a per-action approval round-trip, with **every gate retained** —
independent pre-action review, one executor, one fresh independent post-action QA, browser rows
labelled as browser rows, and a real `passed/blocked/unperformed` tally.

## 0. Preconditions — fail closed

1. Read `docs/reference/agent-runtime-deploy-facts.md` and, for the browser rows,
   `docs/reference/agent-live-browser-qa.md`.
2. **Capacity:** `D:` free **32.83 GiB**, `E:` **60.45 GiB** at packet time. Re-measure;
   **fail closed below 15 GiB**.
3. **Pin (immutable):** `d92facfa14b1d33b6da04f0c169cd73f7221e713`. Release directory
   `D:\ATLAS-runtime-supervised-d92facfa-20260921`, created as a **registered detached worktree**
   (`AGENTS.md` §10.12 — never a clone).
4. **Incumbent / rollback:** `ecff1d7e6050f89aff9906221ab614a5e8132c9c` at
   `D:\ATLAS-runtime-supervised-ecff1d7e-20260921` (registered worktree, startable in place).
   Capture its task XML and both machine-scope values **before** any mutation. Served incumbent
   entry chunk: **`index-CbCvgFxw.js` (456,046 bytes)**.
5. Elevated shell for any machine-scope env write.
6. **Gate:** §3's source review must be `ACCEPT_READY` before execution. The executor shell cannot
   create worktrees — the planner provisions it.

## 1. The delta versus the live `ecff1d7e`

Product paths only (the full diff also carries `docs/**`; those are not product):

**Client — `TIMETABLE-UX-REHAUL-C01R`** (reviewed **`ACCEPT_READY` 18/18/0/0** over
`f2ea0d4a...6d0aab46`, no blocking finding): `atlas-client/src/components/timetable/TimetableSubNav.tsx`
(new), `simple/SimpleDayOptions.tsx` (new), `TimetableSimpleHeader.tsx`, `TimetableGrid.tsx`,
`simple/SimpleDriftBanner.tsx`, `simple/SimpleHeaderHelpers.tsx`, `ScheduleReviewWorkspace.tsx`,
`lib/__tests__/timetable-ux-rehaul-c01.test.ts` (new), `atlas-client/package.json` (one script entry).

**Client — test-only gate repair `0758075e`** (no product effect): the three false-green `test:*`
entries repaired, `lib/__tests__/gate-reachability.test.ts` added, and one assertion updated in
`lib/__tests__/timetable-cell-info.test.ts` (inside the reviewed client delta).

**Server — `ROLLOVER-YEAR-IDENTITY-C01` (`a2c5205c`), integrated by its own lane with no committed
review verdict — this packet's opening gate (§3):** `atlas-server/src/routes/runtime.router.ts`,
`atlas-server/src/__tests__/rollover-year-identity-c01.test.ts`,
`atlas-server/package.json` (one script entry).

The client tree changes, so the served entry chunk must **differ** from the incumbent's
`index-CbCvgFxw.js`. The server tree changes, so D5 applies.

## 2. Deployment

Reuse `docs/prompts/release-d3e9dfef-2026-09-21.md` §2 unchanged, which in turn reuses
`CURRENT-SOURCE-LIVE-DEPLOY-C02` §4–§8. Do not restate or re-derive it. In particular:

1. **Dependency trees:** copy the junction-free trees from the incumbent; isolated, no junction,
   never an install through a shared tree. Record the literal commands and provenance.
2. **`prisma generate`** from `atlas-server` with `--schema` pointing at the **repo-root** schema.
3. **Builds:** server `tsc` build **and** client `vite build` with exactly
   `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` and the SMART/AIMS start URLs unset.
4. **`schtasks` encoding: measure, do not assume.**
5. **Zero-write method — the corrected form:** the literal SQL/serialization with
   `SET LOCAL TIME ZONE 'UTC'` executed **inside the same transaction** as the enumeration and
   per-table queries; record the literal statement **and its scope**.
6. **Every `cli.mjs` invocation gets explicit env overrides** — an agent shell inherits a stale
   process-scope `ATLAS_RUNTIME_SOURCE_DIR`/`…_RELEASE_SHA` that shadows machine scope.
7. Capture the incumbent's task XML and both machine-scope values **before** any mutation.
8. **Prove the deploy by fetching a chunk that only exists in the new build.**

## 3. Review gate — one batched dispatch (`AGENTS.md` §11)

The client delta is already independently reviewed (`ACCEPT_READY` 18/18). The **server delta has
no committed review evidence** — its own lane integrated it. One fresh reviewer must, in a single
pass:

**(a) Audit `ecff1d7e..d92facfa -- atlas-server`** (the three paths) against the contract in
`docs/reviews/rollover-year-identity-c01/packet.md`: both rollover apply routes must resolve the
active year **read-only before** entering the mutation and return typed `409
ACTIVE_YEAR_UNRESOLVED` when absent; after the mutation, a missing/malformed returned active year
must **not** fabricate year 1, **not** publish a year-scoped notification, and **not** call
`getOrCreateTeachingLoadCycleSource`; a valid canonical year must preserve the existing behaviour
exactly once; the mounted route harness must genuinely instrument the post-result delegates (not
assert); no assertion weakened; scope limited to its three paths; the packet's own boundary ("a
live apply is expressly out of scope") is respected by the source.

**(b) Lint this packet** — every acceptance row decidable by a named harness; the browser rows
labelled as browser rows.

**The deployment must not execute on `CORRECTION_REQUIRED`.**

## 4. Acceptance — mandatory rows

**D1 — release identity.** Installed HEAD equals the pin with a declared clean/dirty set; both
machine-scope values, the task action/arguments/working directory and the active state file's
`releaseSha` all identify the pin and the new release directory.

**D2 — ownership.** Exactly one listener on `5001` and one on `5174`, both descending from the
task-launched supervisor; task keeps SYSTEM / ONSTART / `PT0S` / IgnoreNew.

**D3 — health and public truth.** Local health + readiness, production host, Tailnet health, and a
DB-backed public subjects read all 200; a public published-schedule read with an explicit valid
`termIndex` is non-5xx and term-scoped; malformed input returns typed `400 INVALID_TERM_INDEX`;
unauthenticated violation-report routes return 401 before dispatch.

**D4 — served-artifact identity, configuration, zero write.** Served HTML and every referenced JS
asset match the freshly built dist manifest; **the client entry chunk differs from the incumbent's
`index-CbCvgFxw.js`** and is recorded with its byte size; the EnrollPro origin is present and no
SMART/AIMS start URL is; env bytes and key set unchanged; SMART/AIMS `/start` return typed `503
COMPANION_SSO_NOT_CONFIGURED` with no `Location` and no `Set-Cookie`; the schema-wide signature map
is **byte-identical** to the pre value under §2.5, with the SQL, serialization and byte
encoding/line endings recorded.

**D5 — server artifact identity and harnesses.** The running `atlas-server` entry resolves
**inside** the release directory; its `dist/server.js` SHA-256 equals the build output recorded
before the cutover; the process start postdates the cutover; and these committed harnesses each
pass on the release tree with its own literal result:
`npm run test:rollover-year-identity-c01` (**load-bearing for this delta**),
`npm run test:actor-school-mutations-c02`, `npm run test:actor-school-residual`,
`npm run test:actor-school-mutations`, `atlas-server` `npm run test:warning-readability`.
The live mutation routes are deliberately **not** probed — state that limitation.

**D6 — the program's U1–U6, on the live deployed page.** One post-action QA run. On the Tailnet
origin `https://njgrm.buru-degree.ts.net` with a `window.location.origin` assertion, at
`1366x768`, read-only (no Generate/Publish/Apply/Sync, no timetable cell click), using a run with
real violations (run 316):

| # | Requirement | Decided by |
| --- | --- | --- |
| U1 | Older-user friendly — plain language, no jargon/raw codes, legible type, generous hit targets | rendered text + a 1366x768 screenshot; no code/enum token in operator-visible text; no leaf text below 12px |
| U2 | Not overwhelming — one primary action per state, progressive disclosure | **count of solid/filled primaries per state = 1**; the header renders **one** status surface; the audit's F-03/F-07/F-18 findings closed |
| U3 | Not easy to get lost — breadcrumbs + persistent sub-nav; grid stays mounted | the sub-nav renders on the index and on `/timetable/{setup,policies,runs,exports}`; navigating 3 sub-pages and back issues **no** grid refetch and the workspace does not remount |
| U4 | Good performance — no request waterfall, navigation never slower | record the API request count for a clean `/timetable` load and for a sub-page round trip; compare with the pre-release baseline (19 GETs clean load, 0–3 on sub-page moves) |
| U5 | Most help — every blocker/warning says who/what/when/what-to-do and has a path to its fix | run 316's warning surface: each item carries an identity, a unit-bearing number and an action; a repair path exists from the status region |
| U6 | No-scroll architecture preserved | `documentElement.scrollHeight == clientHeight` at 1366x768; never a global window scroll |

**Carry these reviewer caveats into D6:** **N1** — the Day-options `forceMount` rationale is false
(`PopoverPortal` is unmounted while closed); confirm the closed header shows no duplicate controls
and the panel's testids appear on open. **N2** — the tutorial's "Show full day" step now targets a
control inside that popover; confirm the help path degrades honestly (it may report the target is
not available in the current view) rather than silently failing.

**D7 — session disclosure and cleanup.** One authorized login at most; disclose its `audit_logs`
row id and the actor `last_login_at` delta; prove logout with `401 NO_TOKEN`; close the browser
context.

`ACCEPT_READY` requires **every row passed, blocked 0, unperformed 0**. An unperformable row is
`BLOCKED`/`UNPERFORMED` with its reason, never "not applicable". A healthy deployment never
substitutes for a mandatory runtime row, and a row for an undeployed change is never reported as
passed.

## 5. Rollback

Incumbent `ecff1d7e` is **startable in place** at
`D:\ATLAS-runtime-supervised-ecff1d7e-20260921`. Restore its captured task XML and both
machine-scope values, **quiesce the supervisor tree and clear a stale `supervisor-state.json`**
before the start (`AGENTS.md` §6), then re-prove ownership, health, artifact identity and an
unchanged signature map. `80acdc25`, `a02884ff` and `4c7c0bd9` remain available behind it. Remove
every temporary artifact.

## 6. Return

One handoff and one evidence artifact
(`docs/reviews/release-timetable-ux-rehaul-c01r-20260921/deployment-evidence.md`): pin and
candidate SHAs, the decisive commands with results, D1–D7 each with its own result, the literal
signature-map values with the transaction scope and encoding, the `D:` figures, PIDs and listeners
before/after, the new client chunk, the U1–U6 literal results with the rendered strings and the
screenshot path, the login disclosure, rollback status, and risks marked
`BLOCKING`/`NON_BLOCKING`. No transcripts, secrets or database rows.
