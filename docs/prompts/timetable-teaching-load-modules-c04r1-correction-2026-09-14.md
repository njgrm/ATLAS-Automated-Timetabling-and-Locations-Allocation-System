# TT-TL-MODULES-C04R1 — false-authority and omitted-module correction

Status: **CORRECTION_REQUIRED. Do not integrate `6a8f4717` / `a09a4316`.**

Prepared: 2026-09-14 (Asia/Manila) by the head planner after independent
review of the frozen candidate and its external QA report.

Risk: MEDIUM source. Every live Teaching Load/timetable write, deployment,
generation, publication, migration, and companion-system action remains
forbidden.

Canonical directive: read `D:/ATLAS/AGENTS.md` directly. LF-normalized SHA-256
at correction authoring:
`4949C91B5A53A571C5C56C2FCBCEE8C763712CEB838D4D8D8F8E50CCC8EE76B8`.
The candidate handoff's `0F6612BA...` hash reflected an earlier root revision;
the root file now wins. Do not overwrite the tracked worktree-local copy if
that would dirty the frozen worktree.

## 1. Immutable boundary

- Worktree: `D:/ATLAS-worktrees/tt-tl-modules-c04`
- Branch: `work/tt-tl-modules-c04`
- Original base: `d4e9dc8e07869725d4beb55b30c4502650597d24`
- Frozen product candidate: `6a8f471712eb51a6ff83549beb446bd6242dc5de`
- Existing docs tip: `a09a43162c32368f76d6892f4f6ff759d7295de6`
- Current integration boundary at review: `origin/main`
  `d61c38d0f9d38a2bc89ee233164d1dc843b74cc8`

Preserve all existing commits. Continue additively on the same branch and
executor context. Do not amend, rebase, reset, merge, squash, or push the
candidate. Freeze a new product tip and return it to the head planner.

## 2. Blocking findings that QA incorrectly downgraded

### F1 — absence-window false authority

`TeacherDepartureRecoverySheet` labels the start/end window as required and
states that it is recorded on the repair/revision. The callbacks and
`TeachingLoadRepairChange` payload carry no absence window. Non-published apply
does not persist it. Published revision metadata also omits its end date and
`untilFurtherNotice`; only the independent effective date is validated against
the local component state. Closing/reopening loses the supposed authority.

Because decision D1 deliberately defers persisted faculty availability, this
candidate must not invent a finite absence window with no operational or
durable effect. For C04R1:

- remove the fake finite-end/`until further notice` authority and every claim
  that it is recorded;
- for an unpublished run, describe the action truthfully as reassigning the
  affected classes for the current generated run;
- for a published run, use the existing revision `effectiveDate` as the sole
  temporal authority and state that explicitly;
- do not add an availability table, endpoint, automatic reversion, or parallel
  schedule authority under this correction. Those remain D1 work.

Add rendered/interaction controls proving that pre-publish preview/apply no
longer depends on ephemeral dates and published mode cannot imply an end-date
reversion.

### F2 — required capability-override module omitted behind an unsafe API

R4 required qualification/department/program repair entry points. The
candidate intentionally wires no capability-override call, while existing
`GET/PUT/DELETE /faculty-assignments/capability-overrides` routes accept a
requested school without strict actor-school enforcement. This is an unmet
non-D1 requirement, not a non-blocking observation.

Choose the smallest complete, safe contract:

1. Apply strict positive school/year parsing and actor-school equality before
   service dispatch on every capability-override read/write/delete route.
2. Writes must be previewed, fingerprinted, source-revision bound, exact-
   confirmation gated, transactionally revalidated, and auditable, or the
   legacy direct mutation routes must be retired with typed 410 responses and
   replaced by a bounded preview/apply contract. Do not expose direct blind
   PUT/DELETE controls in Timetable.
3. Wire the Timetable qualification module to the safe canonical contract and
   show current scope, proposed effect, conflicts, and typed refusal copy.
4. Preserve the Teaching Load page as the canonical home for broad editing;
   the Timetable module remains focused on the selected teacher/subject repair.
5. Prove missing actor school, malformed IDs, cross-school actor, archived year,
   stale fingerprint/revision, duplicate replay, and concurrent source change
   all fail closed with zero unauthorized writes.

If completing this safe contract would exceed the correction budget, remove
the incomplete capability affordance from this candidate and return
`PLANNER_DECISION_REQUIRED`; do not call R4 complete.

### F3 — client duplicates a supposedly server-issued confirmation

The preview response does not return `confirmationText`, yet the client defines
`DEPARTMENT_AUTHORITY_CONFIRMATION_PHRASE` locally and comments that the phrase
is server-advertised. Return the exact confirmation from the server preview,
bind it into the preview state, render that value, and require that exact value
for apply. Remove the duplicated client authority. Mutating either side alone
must fail a contract test.

### F4 — published drift still exposes direct setup sync

`SimpleDriftBanner.tsx` renders `timetable-simple-sync-setup` / `Sync with
setup` without published-state authority. This leaves an explicitly required
R5 path incomplete. Thread the shared strict published predicate/capability into
the banner. Published schedules must route to revision/review guidance and
must never expose or dispatch the direct sync action. Unpublished drift keeps
the canonical sync route. Add a rendered consumer test and a loose-predicate
mutant.

### F5 — physical component limit exceeded

`TacticalSandboxDock.tsx` has 1,041 physical lines. The mandatory limit is
1,000 physical lines; excluding blank lines is not an accepted alternate
metric. Extract one coherent module/state hook or presentation component so
the file is comfortably below the threshold (target <= 900 physical lines)
without changing behavior. Record both physical and nonblank counts.

## 3. Required verification

Failing-first controls must demonstrate F1–F5 against the frozen candidate.
Then run:

- all `tt-tl-modules-*` client and server suites;
- `tt-tl-authority-guard-c04` on a uniquely named disposable PostgreSQL DB,
  including zero residue;
- department-authority and capability-override mounted route suites;
- timetable operator UX and strict-published/drift consumer suites;
- Teaching Load repair/apply parity relevant to any server contract change;
- server and client `tsc --noEmit` and production builds;
- built-server import/startup and mounted touched-route probes if server source
  changes;
- `git diff --check` and exact cumulative changed-path inventory.

Tests that merely search source strings are insufficient for the rendered
published-mode gate, absence-window behavior, or route zero-dispatch claims.
Use the repository's rendered-component harness and real mounted routes. Include
load-bearing mutants for the actor-school guard, server-issued confirmation,
published sync gate, and ephemeral absence-window removal.

## 4. Fresh QA and return contract

Freeze the additive candidate and commission fresh independent QA over the
full cumulative range
`d4e9dc8e07869725d4beb55b30c4502650597d24...<new-tip>`. QA must review every
changed path mechanically. It may not downgrade an explicit unmet requirement
to NON_BLOCKING merely because the executor previously called its files
"non-owned"; only the planner/operator may change scope.

Return `REVIEW_REQUIRED` with:

- new immutable product/docs SHAs and exact changed paths;
- F1–F5 requirement-to-production-path-to-negative-control mapping;
- fresh QA ID and complete passed/blocked/unperformed tally;
- physical component line counts;
- disposable-DB identity and zero-residue evidence;
- integration conflict forecast against refreshed `origin/main`;
- no live/runtime/data mutation confirmation.

Do not integrate or push. The EnrollPro proxy recovery stream is parallel and
owns runtime/AppShell companion files; stop and return a conflict finding if it
touches any C04R1 path before this candidate freezes.

PLANNER_SESSION_ROUTE: EXISTING TT-TL-MODULES-C04 planner chat
EXECUTOR_SESSION_ROUTE: EXISTING active C04 executor when available; otherwise
fresh executor with this complete packet and immutable recovery boundary
QA_SESSION_ROUTE: FRESH_REQUIRED corrected frozen candidate requires independent
review

Suggested commit:

```text
fix(timetable): close Teaching Load module authority gaps
```
