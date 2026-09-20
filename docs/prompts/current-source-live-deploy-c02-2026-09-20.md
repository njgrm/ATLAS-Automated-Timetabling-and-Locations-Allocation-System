# CURRENT-SOURCE-LIVE-DEPLOY-C02 — one-shot source + deployment + browser acceptance

Status: **PREPARED — AUTHORIZED.** The operator granted standing authorization on
2026-09-20 for this program's HIGH actions, deployment, and browser acceptance, with
the full verification chain retained. The approval round-trip is waived; **no gate is**:
independent pre-action review, one executor, one fresh independent post-action QA,
browser rows labelled as browser rows, and a real tally all still apply.

Risk: **HIGH** — supervised shared-runtime replacement, plus an authorized browser
acceptance pass with one login.

Target source: `d50dde642c10b1ea6fdc9097266ace53cdba2063` (`origin/main` tip at authoring)

Target release: `D:\ATLAS-runtime-supervised-d50dde64-20260920`

Incumbent and rollback basis: `7499916886707c35ea708a17ef7a87e791a6bade` at
`D:\ATLAS-runtime-supervised-74999168-20260920` — startable and proven on 2026-09-20
by `PRISMA-CLIENT-REPAIR-C01`. Rollback was not executed for `C01`; the same
task-XML-plus-machine-variable restore path applies here.

Worktree disposition: `RETIRE_AFTER_INTEGRATION`.

## 1. Objective

Deploy the accepted client-source delta and, against that deployed build, close the
deferred deployment-acceptance clauses from `UX-R03a` and `UX-R03b`: route round-trip
identity and requests plus the `1366x768` viewport for **all six** `/timetable*` routes,
the live guard dialog, and the policy anchor. This is the first one-shot packet: the
source is already independently accepted, so this packet carries deployment **and** the
browser acceptance that closes its deferrals, in one cycle.

## 2. Delta being deployed — client-only

- Source (7): `atlas-client/src/App.tsx`,
  `atlas-client/src/components/app-shell/navigation.ts`,
  `atlas-client/src/components/timetable/{CenterWorkspace,ScheduleReviewWorkspace,TimetableRouteViewSync}.tsx`,
  `atlas-client/src/components/timetable/simple/SimpleMoreMenuContent.tsx`,
  `atlas-client/src/pages/ScheduleReview.tsx`.
- Tests (4): the two new timetable route suites, the updated capabilities-guard suite,
  and the narrowed `uxc01-derived-setup-surface` suite.
- **No server, schema, `ops/runtime`, dependency, or environment change.** Every
  `origin/main` commit above the pin is docs-only.

## 3. Deferred clauses this packet must close (browser rows 9-12)

1. **Route round trip — all six routes.** For each of `/timetable`,
   `/timetable/policies`, `/timetable/pre-generation`, `/timetable/map`,
   `/timetable/manual-edit` and `/timetable/building`: a round trip away from and back
   to the route keeps the review workspace mounted — the workspace container must be the
   **same DOM element instance** across the round trip — and issues **zero** new data
   requests.
2. **Viewport — all six routes.** No global scrollbar at `1366x768` on any of the six
   routes.
3. **Live guard dialog.** With a guarded (unsaved-change) state, cancelling from
   `pre-generation` settles both the URL and the shown view and does **not** re-open the
   dialog for the same cancelled navigation.
4. **More-menu anchor.** Clicking the policy item navigates to `/timetable/policies`.
   Also confirm the four new routes render their panes and that the two
   selection-dependent panes show their truthful empty states.

## 4. Frozen boundary

- **Do not change a byte of** `D:\ATLAS-runtime-config\atlas-server.env` (read key
  names and hash only). Do not define SMART or AIMS start URLs, secrets, or origins;
  both companions stay intentionally inactive.
- Ports: server `5001`, production host `5174`. Port `5175`, unrelated processes,
  companion runtimes, and Tailscale Serve are forbidden.
- Build dependencies must be isolated inside the target release. No dependency junction,
  no install through a shared tree, and never retire or mutate
  `0eb3b67fe94c-20260918` (repaired shared client), `8eb0511baa53-20260917`,
  `E:\ATLAS-worktrees\ux-quickfix-c01`, or any existing release.
- No migration, schema command, login outside the authorized browser pass, generation,
  publication, rollover, Teaching Load or term-cache action, and no companion edit.
- The browser pass is read-only: no Save, Apply, Generate, Publish, Delete, and no
  timetable cell click (a cell click places a session).

## 5. Preconditions — fail closed

1. Elevated Administrator executor; re-read `origin/main:AGENTS.md`.
2. Re-fetch `origin/main`; require the pin above to exist. Record the incumbent
   release's HEAD, `git status --short`, supervisor state (`releaseSha`, `sourceDir`,
   `ownedPids`), listener owners, and local/Tailnet health. Capture the incumbent task
   XML before any mutation.
3. Prove the incumbent is startable (rollback basis): `atlas-server/dist/server.js`,
   `atlas-client/dist/index.html`, `ops/runtime/cli.mjs`, and
   `atlas-server/node_modules/.prisma/client` loadable with its query engine present.
   **The release is junction-free** — it was built with its own dependency trees; do not
   look for, expect, or create a dependency-junction chain.
4. Disk: `D:` free space before, the projected release footprint, and the free space
   after — fail closed below 15 GiB.
5. `safe.directory` at system scope contains the wildcard `*`: satisfy this gate with
   the wildcard and add nothing.
6. **Zero-write evidence, using the C01 method verbatim.** Use the SQL and
   serialization **exactly as recorded in the C01 evidence addendum**
   (`docs/reviews/current-source-live-deploy-c01/evidence.md`) — quote its text verbatim
   rather than retyping a paraphrase, because the bare single-quoted form fails on this
   database with `42883`/`42846` and only the addendum's dollar-quoted form runs. Do not
   re-derive a variant; if it does not run, stop and report.
7. Record the durable env file's key-name set and SHA-256 (no values).
8. Record the served client entry chunk name and SHA-256 of the incumbent, for the
   artifact-identity comparison.

## 6. Authorized mutations

1. construct the isolated release at the pin (checkout, locked installs, `prisma
   generate` from `atlas-server` against the repo-root schema, server and client builds
   with `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` and SMART/AIMS URLs
   unset);
2. alternate-port smoke of the built server and the production host, then stop those
   processes;
3. quiesce the incumbent supervisor tree, re-point `ATLAS_RUNTIME_SOURCE_DIR` and
   `ATLAS_RUNTIME_RELEASE_SHA`, register the replacement task XML, and start once via
   `schtasks /run /tn "ATLAS-Runtime-Supervisor"`. **Known hazard from C01:** `schtasks`
   rejects the bytes its own `/query /xml` returns (UTF-8 body with a UTF-16
   declaration); C01 had to re-declare the encoding before registration succeeded. If
   registration fails, fix the declaration and record the literal repair — never
   substitute silently;
4. the browser acceptance pass, including **one** authorized login (disclose its audit
   row and `last_login_at` delta);
5. remove every temporary XML, scratch script, and probe artifact this action created.

## 7. Acceptance — 12 mandatory rows

1. **Release.** Installed HEAD and clean status, both machine-scope values, the task
   action/arguments/working directory, and supervisor-state `releaseSha` all identify
   the pin and the new release directory. Read `releaseSha`; `productPin` is historical.
2. **Ownership.** Exactly one listener owns `5001` and one owns `5174`; both descend
   from the task-launched supervisor; the task keeps SYSTEM, ONSTART, `PT0S`, IgnoreNew.
3. **Health.** Local health and readiness, production-host live/ready, Tailnet health,
   and a DB-backed public subjects read are all 200.
4. **Public term truth.** A public published-schedule read with an explicit valid
   `termIndex` is non-5xx and term-scoped; malformed term input returns typed
   `400 INVALID_TERM_INDEX`.
5. **Warning protection.** Unauthenticated latest and run-specific violation-report
   routes return 401 before dispatch.
6. **Served-artifact identity.** Served HTML and every referenced JS asset match the
   built dist manifest; the entry chunk **differs** from the incumbent's recorded chunk
   and the served bundle contains the new route marker `/timetable/policies`; the
   EnrollPro origin is present and neither SMART nor AIMS start URL is; the shell
   renders without a React crash.
7. **Configuration.** The env file's bytes and key set are unchanged; rollover stays
   disabled; no SMART/AIMS key or URL was invented.
8. **Inactive SMART/AIMS and zero write.** Both `/start` routes return typed
   `503 COMPANION_SSO_NOT_CONFIGURED` with no redirect and no `Set-Cookie`, and the
   schema-wide signature map is byte-identical to precondition 6.
9. **Route round trip (browser).** As §3 item 1, with the workspace element instance
   asserted identical and the round-trip request count asserted zero.
10. **Viewport (browser).** As §3 item 2.
11. **Guard dialog (browser).** As §3 item 3. **Read-only entry condition:** the guard
   fires only while `centerView === 'pre-generation'` and a pre-generation draft is
   pending or a draft placement exists, and the only producers of that state are draft
   placements, which persist. Therefore: first check read-only whether the live year
   already holds such a draft (counts > 0). If it does, exercise the cancel path. **If it
   does not, mark this row `BLOCKED` with that reason — never place a session to create
   the state**, because a placement persists and would break row 8.
12. **Policy anchor and new panes (browser).** As §3 item 4.

Fresh independent post-action QA must reproduce rows 1-8, and the browser rows 9-12
must be executed by the authorized browser pass and reported with their own results.
`ACCEPT_READY` requires 12/12 passed, 0 blocked, 0 unperformed.

## 8. Rollback

Restore the captured incumbent task XML and both machine-scope values, then start once
via the registered task and re-prove ownership, health, the artifact identity, and an
unchanged signature map. The incumbent `74999168` is startable and proven. Remove every
temporary artifact. Rollback does not need to undo the browser pass beyond the login
already disclosed.

## 9. Return

One evidence artifact: preconditions, the built-versus-served manifest, rows 1-12 with
their own results and the browser rows labelled, the signature-map comparison, the login
disclosure, PIDs/listeners before and after, rollback status, and an immutable evidence
SHA. One page for the handoff; no transcripts, secrets, or database rows.
