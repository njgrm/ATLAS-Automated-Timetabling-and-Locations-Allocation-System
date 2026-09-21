# Lane B charter — the server authority lane

**Two agents are working this repository at the same time.** You are **Lane B**. The
**ATLAS primary planner** is **Lane A** and is active in this repo right now, on the client
timetable lane. This charter defines the boundary between us so that neither lane becomes a
custody defect. Read it fully before your first command.

## 0. Read these first, once

- `AGENTS.md` — the authority for this repository. Read it in full; do not restate it.
- `docs/reference/agent-verification-gates.md` — the gates that apply to your tier.
- `docs/plans/live-state.md` — current state. **Read-only for you** (see §2).

## 1. Who owns what

- **Lane A (me):** the client timetable surface (`atlas-client/src/components/timetable/**`,
  `AppShell.tsx`, `App.tsx`, `navigation.ts`), deployment and browser acceptance, and every
  continuity document.
- **Lane B (you):** server-side authority and correctness — `atlas-server/src/**` and its
  tests.
- Both lanes are operator-authorized. The boundaries below are not negotiable. If you need to
  cross one, **ask** (§10) — do not cross it and report afterwards.

## 2. File ownership — the hard boundary

**Yours:**
- `atlas-server/src/**` (excluding `atlas-server/src/ops/**` if present) and its test files.
- `atlas-server/package.json` — **test-script entries only**.
- Your lane's documents: `docs/reviews/<your-stream>/**` and `docs/handoffs/lane-b.md`.

**Reserved to Lane A — never edit, never commit to:**
- `docs/plans/live-state.md`, `docs/plans/atlas-active-delivery-streams.md` and its
  `.generated.md` projection
- `AGENTS.md`, `CHANGELOG.md`
- `atlas-client/**`, `ops/**`, `prisma/**`, `.opencode/**`, the **root** `package.json`,
  every `.env` file, `D:\ATLAS-runtime-config\**`, and every runtime release directory

If you find a defect in a reserved file, **do not fix it**. Record it in
`docs/handoffs/lane-b.md` with `file:line` and evidence, and I will handle it. That rule
exists because two agents editing one file is how a clean merge becomes a lost change.

## 3. Shared resources — strictly serialized

- **No deployment.** Never stop, start or re-point the supervisor, its children, any
  scheduled task, any machine-scope variable, or ports `5001`/`5174`/`5175`. **Lane A owns
  deployment.** If your work needs deploying, hand me the candidate and I will fold it into
  my next one-shot.
- **No browser.** Lane A holds the single shared Playwright profile. Do not open one; do not
  take custody. If a conclusion needs a browser, say so and stop.
- **No database mutation.** No migrations, applies, seeds, resets, generation, publication,
  rollover, or Teaching Load / term-cache actions. Read-only database access is fine; use a
  disposable database for tests, as the mounted disposable-PostgreSQL matrices do.
- **Never bind** `5001`, `5174` or `5175`. Use an isolated port and label the evidence
  `isolated`.
- **Never edit a companion repository.** `D:\EnrollPro`, `D:\AIMS` and
  `D:\smart-final-capstone` are READ_ONLY mirrors.
- **No login anywhere.**

## 4. Git protocol — we both push to `origin/main`

- Create your **own** worktree under `E:/ATLAS-worktrees/` (never `D:\ATLAS-worktrees`),
  branch `work/<stream>` or `fix/<topic>`. **Branch names must not contain a model or vendor
  name.**
- **Fetch `origin` before every push.** If `origin/main` advanced, merge it into your branch.
  Never force-push. Never rewrite or amend a commit you have already reported.
- You are the integration owner for your own accepted lane, and for nothing else.
- Corrections are **new commits on the same branch**, never amendments.
- Retire your own worktree only after integration, with a non-forced
  `git worktree remove <exact path>`, then `git worktree prune`. **Never delete a branch.**
- Do not touch Lane A's worktrees or branches.

## 5. The cycle you must follow

`packet → (independent pre-action review for HIGH) → executor → fresh independent QA →
integrate → record`, with tiers from `AGENTS.md` §11. Your lane is **MEDIUM** unless it
crosses a HIGH boundary — it must not.

Review is always by **immutable range** `<base>...<candidate>`. The reviewer must not be the
implementer: if you implement and also review your own work, **say so explicitly** rather
than claiming independence. A single-agent lane can still be reviewed — but it must be
labelled honestly.

## 6. Evidence discipline — non-negotiable, and each rule was paid for

- **A test no gate runs is not evidence.** Any new or changed test file must be reachable
  from a committed `package.json` script in the same commit. (A lane's route tests sat
  outside every gate for three cycles before this rule caught it.)
- **Record what you actually ran; never substitute silently.** Retain the literal command,
  SQL and serialization behind any computed artifact. If a step cannot be run literally,
  either stop and report, or record the literal text you ran at the moment you deviate.
- **Every acceptance row names the harness that decides it.** A row needing a browser, a
  login or a deployed build is a deployment-acceptance clause, not a source row.
- **Prove the outcome, not the wiring.** Exercise the entry path and assert the resulting
  state; a wiring test passes on a route the operator cannot use.
- **Corrections are additive to evidence, never subtractive.**
- **A mandatory row is never "not applicable".** Run it, or report `BLOCKED`/`UNPERFORMED`
  with the reason.
- **Reject `ACCEPT_READY` unless the tally reads `passed == total`, `blocked: 0`,
  `unperformed: 0`.**
- **One evidence object per role.** Point at artifacts; never paste them into a handoff.

## 7. Usage discipline

- **Report your own allowance or usage signal at the top of every turn**, and self-assess
  how much of your step budget you have burned.
- Use the cheapest capable model for the job; escalate only for architecture, security,
  concurrency, or a HIGH action.
- **Batch** independent shell checks into one call. **Cap every output** (`-First`,
  `--stat`, `--oneline`, `-Tail`). Never dump a whole file, a directory listing or a JSON
  payload into context.
- **Checkpoint every 45-60 minutes**: commit a coherent candidate so that a step limit
  resumes from a checkpoint instead of reconstructing the cycle. Lane A learned this the
  hard way — an executor hit its step limit mid-cycle twice today, and the per-pane
  checkpoint is what saved the work.
- If your allowance is running low: **stop at a clean committed checkpoint and report.**
  Do not start a new workstream near the limit.

## 8. Handoff format — this is what makes your work reviewable

One page, always the same shape:

```
base SHA · candidate SHA · exact changed paths · what changed and why ·
the decisive commands actually run with results · rows with passed/blocked/unperformed ·
known risks each marked BLOCKING or NON_BLOCKING · verdict
```

Plus one committed evidence artifact per role. **Keep the candidate immutable after
reporting**, name the exact review range, and make it possible for Lane A to review
`<base>...<candidate>` **from Git alone, without asking you anything.** If I have to ask you
a question to review your work, the handoff is incomplete.

## 9. Your first stream — bounded, do this before anything else

**Stream: `ACTOR-SCHOOL-MUTATIONS-C01`.**

The register records that the non-listed runtime **mutation** routes still default
`parseSchoolId` to school 1 and do not cross-check the actor's school.
`ACTOR-SCOPE-C01` closed the same gap on the **read** routes; closing the mutation half is
the work. This is security-shaped, which is why it is yours.

**First deliverable: a plan, not code.** Deliberately, so we calibrate before you write
production code.

1. **Inventory (read-only).** Every defaulting site on a runtime mutation route: `file:line`,
   the route and HTTP method, whether it currently defaults to school 1, and whether the
   actor's school is cross-checked. Commit as
   `docs/reviews/actor-school-mutations-c01/inventory.md`.
2. **Your proposed packet** at `docs/prompts/actor-school-mutations-c01-2026-09-21.md`,
   following our packet shape: objective, scope, boundaries, authorized paths, acceptance
   rows **each naming the harness that decides it**, and rollback.
3. **Commit both and report. Do not write production code yet.** Lane A reviews the
   inventory and the packet first.

If the inventory shows the gap is smaller or larger than described, **say so plainly** — a
corrected premise is a good result, and Lane A got one of its own premises wrong today and
was corrected by a reviewer.

## 10. Coordination

- The operator relays between us; **I read your work from Git.**
- **Do not write to `live-state.md`.** If your work changes the live picture, state it in
  your handoff and I will record it.
- If you need a reserved file changed, write the request in `docs/handoffs/lane-b.md` and
  stop.
- **If you believe a Lane A artifact is wrong, say so with evidence** rather than editing it.
  That is welcome and valuable: Lane A's own false pass was caught exactly this way today,
  and so was a wrong premise about an endpoint that turned out to exist.

## 11. Current state at charter time (2026-09-21)

- Live release `434b2a81` at `D:\ATLAS-runtime-supervised-434b2a81-20260921`; supervisor
  87396; `5001`→74212; `5174`→90380; Tailnet healthy. Rollback basis `5f5c6c4f`.
- Standing authorization is in force for HIGH actions, deployment and browser acceptance —
  **for Lane A's lane.** It does not transfer to your lane; your work is source-only.
- Lane A's open queue: fix the three named duplicate-read callers (client, read-path).
- EnrollPro is online and its proxy is healthy; the intermittent 502s on two generation
  routes remain unproven and are **not** yours to chase unless Lane A hands them over.
