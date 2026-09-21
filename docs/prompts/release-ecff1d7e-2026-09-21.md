# RELEASE r2 — the units fix + `ACTOR-SCHOOL-MUTATIONS-C02` (pin `ecff1d7e`)

Status: **PREPARED**. Risk: **HIGH** deployment. This supersedes `release-d3e9dfef-2026-09-21.md`
as the executable packet; that one stays the reference for the deployment boundary.

**Why r2 exists.** Release `d3e9dfef` is deployed but **not accepted**: its browser row D6 failed
one assertion (the live run-316 surface rendered a bare unit, `...180 consecutive teaching min...`,
×5). The fix is integrated; this release carries it and re-runs D6. A release is not "done" because
it is deployed.

## 0. Preconditions

1. Read `docs/reference/agent-runtime-deploy-facts.md` and, for the browser row,
   `docs/reference/agent-live-browser-qa.md`.
2. **Capacity:** `D:` free **34.32 GiB**. Re-measure; **fail closed below 15 GiB**.
3. **Pin (immutable):** `ecff1d7e6050f89aff9906221ab614a5e8132c9c`. Release directory
   `D:\ATLAS-runtime-supervised-ecff1d7e-20260921`, a **registered detached worktree**
   (`AGENTS.md` §10.12 — never a clone). The planner provisions it and the evidence worktree.
4. **Incumbent / rollback:** `d3e9dfef` at `D:\ATLAS-runtime-supervised-d3e9dfef-20260921`,
   startable in place; capture its task XML and both machine-scope values **before** any mutation.
5. Elevated shell.

## 1. The delta — 5 product paths versus the deployed `d3e9dfef`

- **Client, already reviewed `ACCEPT_READY` 8/8:** `atlas-client/src/lib/violation-presentation.ts`
  and its test. Standalone `min`/`h` normalization, with the control built from the **verbatim live
  string** and a mutant proving the pre-fix pattern leaks it.
- **Server, `ACTOR-SCHOOL-MUTATIONS-C02` (`faculty.router.ts`):**
  `atlas-server/src/routes/faculty.router.ts`, `atlas-server/src/__tests__/faculty-delete-actor-school-c02.test.ts`,
  `atlas-server/package.json` (one script entry).

The client tree changes again, so the served entry chunk must **differ** from the incumbent's
`index-BkDBtkSR.js`; the server tree changes, so D5 applies.

## 2. Deployment

**Reuse `docs/prompts/release-d3e9dfef-2026-09-21.md` §2 unchanged** — the dependency-tree copy,
`prisma generate` from `atlas-server` against the repo-root schema, the two builds with exactly
`VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` and SMART/AIMS unset, the measured
`schtasks` encoding rule, the zero-write method with `SET LOCAL TIME ZONE 'UTC'` **inside the
transaction** (and the literal statement *and its scope* recorded), explicit env overrides for every
`cli.mjs` call, and capture-before-mutation. Do not restate or re-derive it.

## 3. Review gate — one batched dispatch (`AGENTS.md` §11)

The units fix is already reviewed. **`ACTOR-SCHOOL-MUTATIONS-C02` was integrated by its own lane**,
so per the unreviewed-delta rule one fresh reviewer must, in a single pass: audit that delta
(`d3e9dfef..ecff1d7e -- atlas-server`) against its stated purpose — the faculty delete path's
actor-school authority — checking that no route became more permissive, that rejection precedes
dispatch, that no write happens on rejection, that scope is limited to its three paths, and that no
assertion was weakened; and lint this packet. The deployment must not execute on
`CORRECTION_REQUIRED`.

## 4. Acceptance — 6 mandatory rows

**D1–D5** exactly as `release-d3e9dfef-2026-09-21.md` §4 defines them, with these updates:
- **D4:** the entry chunk must **differ** from the incumbent's `index-BkDBtkSR.js` and be
  byte-identical to your freshly built manifest entry.
- **D5:** run **all four** committed harnesses on the release tree, each with its own result —
  `test:actor-school-mutations-c02` (**load-bearing for this delta**), `test:actor-school-residual`,
  `test:actor-school-mutations`, `test:warning-readability` — plus server artifact identity. Do
  **not** probe the live mutation routes; state that limitation.
- **D4's signature map** must be byte-identical to the pre value, and the evidence must record the
  SQL, the serialization **and the byte encoding/line endings** that produced it (`AGENTS.md` §11).

**D6 — the browser row, re-run (this is the row that failed).** At `1366x768` and `390x844` on the
Tailnet origin with a `window.location.origin` assertion, on a run with real violations:
- **no bare `min`/`h`** in operator-visible text — this is the specific assertion that failed;
  expect `...180 consecutive teaching minutes...`;
- no raw code or enum name; no `Faculty <digits>`; the count label states its basis (record the
  counts actually rendered, never a remembered figure);
- **control 5** — one real situation renders as one grouped item;
- **control 6** — with 0 zoned rooms the zone warning is suppressed or reframed as setup;
- no global scrollbar.
**Read-only; do not press Generate/Publish/Apply and do not click a timetable cell.** One
authorized login, disclosed (`audit_logs` row id + actor `last_login_at` delta), with a logout
proven by `401 NO_TOKEN`. If the harness cannot drive a browser, report `BLOCKED(harness)` — a
blocked D6 makes 6/6 unreachable and the release must not be recorded as accepted.

`ACCEPT_READY` requires **6/6 passed, blocked 0, unperformed 0**.

## 5. Rollback

Incumbent `d3e9dfef` startable in place; restore its captured task XML and both machine-scope
values, **quiesce the supervisor tree and clear a stale `supervisor-state.json`** before the start
(`AGENTS.md` §6), then re-prove ownership, health, artifact identity and an unchanged signature map.
`80acdc25` and `a02884ff` remain available behind it. Remove every temporary artifact.

## 6. Return

One handoff and one evidence artifact
(`docs/reviews/release-ecff1d7e-20260921/deployment-evidence.md`): pin and candidate SHAs, the
decisive commands, D1–D6 each with its own result, the signature map with its serialization **and
encoding**, the `D:` figures, PIDs and listeners before/after, the four harness tallies, the new
client chunk, the browser row's literal rendered strings at both viewports, the login disclosure,
rollback status, and risks marked `BLOCKING`/`NON_BLOCKING`. No transcripts, secrets or database
rows.

## 7. r1 amendment (planner, 2026-09-21)

Pre-action review returned **`ACCEPT_READY` 15/15** — Gate 1 (the c02 source) 8/8 with a captured
failing-first control, Gate 2 (this packet) 7/7, **no blocking finding**. The review gate is closed.
These are the two clarity items it raised, plus a pre-computed value:

**A. D5's harness set — qualify the name, and add the client side.** `test:warning-readability`
exists in **both** `atlas-server/package.json` and `atlas-client/package.json`. D5 runs the
**`atlas-server`** one; **also run the `atlas-client` one** (16/16 at this pin) — it is the harness
that actually decides the units fix, so acceptance must not leave that behaviour to D6 alone.
**D5 is now five harnesses**, each with its own literal result: `test:actor-school-mutations-c02`
(load-bearing for this delta), `test:actor-school-residual`, `test:actor-school-mutations`,
`atlas-server` `test:warning-readability`, `atlas-client` `test:warning-readability`.

**B. D6 names its harness and its surface.** Use the single-controller persistent profile per
`docs/reference/agent-live-browser-qa.md`; the surface is the **Timetable run rail's warning list
for run 316** at the Tailnet origin. Everything else in D6 stands unchanged.

**C. D4's expected chunk is known.** The reviewer built the pin: it produces
**`index-CbCvgFxw.js`**, and the incumbent reproduces `index-BkDBtkSR.js`. Assert byte-identity to
*your* freshly built manifest entry (expected `index-CbCvgFxw.js`) **and** difference from the
incumbent.

**D. Authorization basis.** This deployment proceeds under the operator's **standing
authorization (2026-09-20)**, which waives the per-action approval round-trip for HIGH actions in
this program while retaining every gate — independent review, one executor, one fresh independent
post-action QA, real tallies. The operator's current instruction is "proceed".
