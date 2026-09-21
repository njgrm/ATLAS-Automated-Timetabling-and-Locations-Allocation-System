# UX-R03e — one-shot: the Setup sub-page, deployed and browser-accepted

Status: **PREPARED — AUTHORIZED** under the operator's standing authorization
(`AGENTS.md` §13). One cycle: one composed pane, deployment, browser acceptance with QA
custody.

Risk: **MEDIUM** source (a composed pane, no behaviour change to existing controls) with
**HIGH** deployment.

Base: the `origin/main` tip in the dispatch prompt. Incumbent and rollback basis: the
release live when the executor starts (expected `5f5c6c4f…`).

Worktree disposition: `RETIRE_AFTER_INTEGRATION`.

## 1. Why this packet, and why not the Runs page

The remaining timetable sub-pages were `/timetable/runs` and `/timetable/setup`.

**`/timetable/runs` is blocked, not deferred for convenience.** The server exposes no
run-list endpoint — `generation.router.ts` has `POST /:schoolId/:schoolYearId/runs`
(trigger), `GET …/runs/latest`, `…/runs/latest/violations`, `…/runs/latest/draft`, and
per-run sub-resources, but nothing that lists a school year's runs. A Runs page therefore
needs a **new server endpoint plus a product decision** about what the list shows (status,
publication state, entry counts, who may see it). That is a different class of change from
this program's client-only panes, and it will not be invented inside an executor run. It
is recorded as its own future stream.

## 2. The source change

### A1. `/timetable/setup` — the Setup sub-page

Add an `setup` child under the existing mounted `/timetable` parent, exactly as
`UX-R03c` added `exports`, and compose it from the setup-truth surfaces that already exist
on the Simple timetable:

- the sync-with-setup control (`timetable-simple-sync-setup`),
- the input-drift banner (`timetable-simple-input-drift`) and the room-repair affordance
  (`timetable-simple-repair-rooms`),
- the setup-name refresh item currently buried in the More menu
  (`timetable-refresh-setup-names`),
- the readiness chip and publish-readiness sheet (`timetable-simple-readiness-chip`,
  `SimplePublishReadinessSheet`).

**Reuse the existing components, handlers and orchestration; extract shared orchestration
into a unit rather than duplicating it**, exactly as `UX-R03c` did for exports with
`useSimpleExportSurface`. **Every existing control keeps working where it is** — the header
and More-menu entry points must remain, and this route is an additional place to land, not
the only one. **No behaviour change**: do not alter what sync, repair, refresh or the
readiness sheet do, and do not change what any of them emit or persist.

Wiring, as with the previous panes: the `TimetableRoutedView` / `TimetableCenterRoute`
mapping in both directions, the `App.tsx` child, and the `CenterWorkspace` `setup` view.
Add a chrome override for `/timetable/setup` in `navigation.ts` alongside the five added in
`UX-R03c`/`R03d`.

### A2. Do not fix the duplicate-GET lead in this packet

QA observed **eight endpoints issuing concurrent duplicate identical GETs**. That is a
plausible cause of the intermittent host-proxy 502s, but coalescing duplicate requests in
`atlasApi` would touch **every** API call in the client — a broad behavioural change that
does not belong in a pane cycle. It is a **report-only** browser row here (§4) and a
candidate for its own reviewed stream.

## 3. Part B — deployment

**Target pin: the accepted candidate commit of this cycle**, built into
`D:\ATLAS-runtime-supervised-<candidate-sha>-20260921`. Every literal is re-captured at
execution and never copied from an earlier packet: the incumbent is the release live at
start (expected `5f5c6c4f…`), and the artifact marker is the **new** entry chunk, which
must differ from that incumbent's recorded chunk. Otherwise reuse
`CURRENT-SOURCE-LIVE-DEPLOY-C02`'s frozen boundary, preconditions, authorized mutations and
rollback section unchanged in structure: isolated release with its own dependency trees, no
environment byte changed, SMART/AIMS inactive, no migration or database write, ports
5001/5174 only, elevated executor, single start via the registered task, and the
schema-wide signature map byte-identical using the C01 addendum's SQL **verbatim**.

## 4. Part C — browser acceptance (custody with QA)

**Custody goes to the independent QA task.** The planner releases the profile; the QA
session is the single controller and closes it. One authorized login expected; disclose its
audit row. **Read-only: no Save, Apply, Generate, Publish or Delete, and no timetable cell
click** (a click places a session). The export settings dialog and the publish-readiness
sheet both expose actions — open and inspect, persist nothing.

1. **`/timetable/setup` renders** the composed setup surface, and each reused control still
   works from its **original** home (header and More menu) as well.
2. **No remount inside the subtree** still holds after this change: moving between
   `/timetable*` routes via the app's own controls keeps the same workspace element
   instances with zero new `/api/v1/` requests. `history.pushState` is forbidden.
3. **Viewport:** no global horizontal or vertical window scrollbar at `1366x768` on all
   eight `/timetable*` routes.
4. **Report-only diagnosis of the duplicate-GET lead.** Instrument nothing and fix nothing:
   on a clean load of `/timetable` and of `/timetable/setup`, record how many
   concurrent duplicate identical `/api/v1/` GETs occur, on which endpoints, and whether
   any 502 follows. State plainly whether the duplicates reproduce and whether they
   correlate with a 502 — a clean negative is a valid result.
5. **No regression outside the subtree:** one non-timetable nested pair still remounts as
   before.

## 5. Acceptance — 9 mandatory rows

1: the setup route is wired in both mapping directions, with the `App.tsx` child and the
`CenterWorkspace` view — source-proven.
2: the pane composes the named existing controls with shared orchestration extracted and
no behaviour change to them — source-proven.
3: every existing entry point for those controls still works — source-proven.
4: the new test file is **reachable from a committed `package.json` script** in the same
commit (`AGENTS.md` §11), and the client type-check and full client suite pass — source-proven.
5-8: Part B deployment rows — reproduced by post-action QA.
9: Part C browser rows — reproduced by the QA browser pass, with row 4 report-only.

`ACCEPT_READY` requires 9/9 passed, 0 blocked, 0 unperformed. A row that cannot be
performed is reported `BLOCKED`/`UNPERFORMED` with its reason. The deployment must not be
called accepted on rows QA did not reproduce.

## 6. Return

One handoff and one evidence artifact: base and candidate SHAs, changed paths, the decisive
commands, the 9 rows with their own results, the browser element-identity and
request-count values, the duplicate-GET diagnosis, the login disclosure, rollback status,
and risks marked `BLOCKING`/`NON_BLOCKING`. No transcripts, secrets or database rows.
