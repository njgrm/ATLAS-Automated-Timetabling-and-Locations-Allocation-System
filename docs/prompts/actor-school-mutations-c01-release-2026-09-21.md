# ACTOR-SCHOOL-MUTATIONS-C01 — release: the first server-carrying release since `4c7c0bd9`

Status: **PREPARED**. Pin `80acdc257cee613418eaa24db4607114b68c2d25`.
Risk: **MEDIUM** source (already integrated) with **HIGH** deployment (shared runtime).

## 0. Preconditions — fail closed

1. **Read `docs/reference/agent-runtime-deploy-facts.md` first** (elevated shell, supervisor tree
   quiesce, stale-state `ALREADY_RUNNING`, the encoding rule, served-artifact proof).
2. Capacity: `D:` free **37.32 GiB** measured at packet time. Re-measure before the build and
   record free-before / projected footprint / free-after; **fail closed below 15 GiB**.
3. **Create the evidence worktree as a *registered* worktree** of the shared repository
   (`git worktree add E:/ATLAS-worktrees/<name> -b <branch> <pin>`). **Do not create a clone**
   (`AGENTS.md` §10.12). Prove the candidate is reachable from the shared repo with
   `git cat-file -t <sha>` before reporting.
4. Elevated Administrator shell (the machine-scope env write requires it).
5. **Custody:** the delta is `atlas-server/**`, which is Lane B's lane. It is already integrated;
   this packet **ships** it and adds no server source. If the build reveals a needed server edit,
   **stop and report** — do not edit.

## 1. Why — what this ships

`ACTOR-SCHOOL-MUTATIONS-C01` closed the mutation half of the actor-school gap that
`ACTOR-SCOPE-C01` closed on the read routes. `parseSchoolId` (`runtime.router.ts:26`) was
`Number(raw ?? 1)`, so each of the eight runtime mutation `POST` routes could be reached by a JWT
actor with a **request-controlled or omitted** school — omitted defaulting to **school 1** — with
no route-level actor-school comparison. Role was checked on most; role is not tenancy.

Integrated on `main` at `07739636` (merge `ad79c2b3`, exactly its seven approved paths). The live
release `a02884ff` predates it, so **the fix is not live**; this is the first release carrying
**server** source since `4c7c0bd9`.

## 2. The delta at the pin

- `atlas-server/src/routes/runtime.router.ts` — the strict school parser plus the per-route
  authority guard.
- `atlas-server/src/__tests__/runtime-router-actor-school-mutations.test.ts` — the mounted
  harness.
- `atlas-server/package.json` — the test-script entry.

**Client delta versus the live `a02884ff` is empty** (`git diff --name-only a02884ff <pin> --
atlas-client`). Therefore this cycle has **no browser rows**: no client behaviour changes, and no
login is consumed. The client bundle is still rebuilt from the same source and its chunk is
compared for identity only.

Authority contract being shipped (from the C01 inventory):
- missing / empty / malformed / zero / negative / fractional target school → **`400
  INVALID_PARAM` before service, upstream, lock, database or notification dispatch**;
- a **system token** may act on an explicit valid target school (that parameter is the system
  caller's auditable target declaration);
- a **JWT** caller must have a positive actor school **matching** the target (missing actor
  school → **`403 SCHOOL_SCOPE_REQUIRED`**, mismatch → **`403 CROSS_SCHOOL_DENIED`**) and must
  additionally be a **privileged** actor on the seven operator routes;
  **`/rollover-sync/preview` deliberately keeps its pre-existing non-privileged, read-only,
  same-school admission** — do not "fix" that into a privilege requirement.

## 3. Part A — the independent source review (a gate, not a tally row)

Lane B implemented and self-reviewed this change; the previous Lane A session verified its scope
and gates at integration. **No fresh independent ATLAS reviewer has examined the diff's
substance.** Before the deployment executes, one fresh independent reviewer must:
1. review the immutable range for the three paths against the contract in §2 — every one of the
   eight routes, the rejection point *before* dispatch, and the system-token/JWT split;
2. reproduce the committed harness on a clean tree (`npm run test:actor-school-mutations` plus the
   server build) and confirm the script is reachable from a committed `package.json` entry;
3. report `ACCEPT_READY`/`CORRECTION_REQUIRED` with its own tally, or `BLOCKED` with the reason.

The deployment must not execute on a `CORRECTION_REQUIRED` source review.

**Review outcome (2026-09-21, fresh independent reviewer): source `ACCEPT_READY` 9/9.** All eight
routes reject before dispatch, the guard being each handler's first statement; the strict parser
rejects `undefined, null, '', '   ', 'abc', true, false, [1], {}, [], 0, -1, 1.5, '1.5', '1e309',
'Infinity', NaN`; the system/JWT split is sound (`setJwtUser` forces a JWT's `authSource` away
from `system`, so only the timing-safe system token yields `'system'`); no assertion was deleted or
relaxed. The reviewer independently reproduced the committed harness (exit 0, `tests 1 / pass 1`)
**and** the failing-first control at `a02884ff` (exit 1, the `400`→`598/AbortError` capture), so
the instrumented counter is load-bearing. Accepted leniencies, recorded rather than hidden:
`'0x10' → 16`, `'1e2' → 100`, `'01' → 1`, `' 1 ' → 1`, `'+1' → 1` — all resolve to a positive
integer, and a JWT actor can only ever produce its own school that way.

## 4. Part B — deployment

Reuse `CURRENT-SOURCE-LIVE-DEPLOY-C02` §4–§8 (frozen boundary, authorized mutations, rollback)
with these corrections, which override it where a literal has moved:

1. **Release directory:** `D:\ATLAS-runtime-supervised-80acdc25-20260921`, created as a
   **registered detached worktree** at the pin (the pre-`4c7c0bd9` norm; the last two releases
   were unregistered clones and that deviation is not to be repeated).
2. **Dependency trees:** the harness deny-list blocks `npm ci`; copy the junction-free dependency
   trees from the incumbent and record the literal commands and provenance. Isolated and
   junction-free — never a junction, never an install through a shared tree.
3. **`prisma generate`** from `atlas-server` with `--schema` pointing at the **repo-root** schema
   (a build step, not HIGH). Confirm the generated client lands in the release's own tree.
4. **Builds:** server `tsc` build **and** client `vite build` with exactly
   `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` and the SMART/AIMS start URLs unset.
5. **`schtasks` encoding: measure, do not assume.** Try the bytes `/query /xml` returns first; if
   registration fails, fix it and record the literal repair.
6. **Zero-write method — the corrected form.** Use the C01 addendum's literal SQL/serialization,
   but pin the timezone **inside the transaction** (`SET LOCAL TIME ZONE 'UTC'` in the same
   transaction as the per-table queries). Record the literal statement *and its scope*. A
   standalone `SET LOCAL` is a no-op and must not be claimed as a pin; record the unpinned and
   pinned values separately if both are taken.
7. **Every `cli.mjs` invocation gets explicit env overrides.** An agent shell inherits a stale
   process-scope `ATLAS_RUNTIME_SOURCE_DIR`/`ATLAS_RUNTIME_RELEASE_SHA` that shadows machine
   scope (measured `c93dd2ee-20260920`) and makes an unqualified `stop`/`status` read the wrong
   state file.

## 5. Acceptance — 5 mandatory rows, all decided by the deployed runtime

**D1 — release identity.** Installed HEAD equals the pin with a clean status (declare the exact
expected dirty set); both machine-scope values, the task action/arguments/working directory, and
supervisor-state `releaseSha` all identify the pin and the new release directory. Read
`releaseSha`; `productPin` is historical.

**D2 — ownership.** Exactly one listener on `5001` and one on `5174`, both descending from the
task-launched supervisor; the task keeps SYSTEM / ONSTART / `PT0S` / IgnoreNew.

**D3 — health, public truth, warning protection.** Local health and readiness, production host,
Tailnet health, and a DB-backed public subjects read all 200; a public published-schedule read
with an explicit valid `termIndex` is non-5xx and term-scoped, malformed term input returns typed
`400 INVALID_TERM_INDEX`; unauthenticated latest and run-specific violation-report routes return
401 before dispatch.

**D4 — served-artifact identity, configuration, zero write.** Served HTML and every referenced JS
asset match the built dist manifest; the client entry chunk is **byte-identical** to the freshly
built manifest entry `index-C6LTCXSf.js` (455,998 bytes) and to the incumbent's — an unchanged
client tree rebuilds deterministically (independently confirmed at this pin), so **inequality is
not required and must not be asserted**; the EnrollPro origin is present and no SMART/AIMS start
URL is; env
bytes and key set unchanged; SMART/AIMS `/start` return typed `503 COMPANION_SSO_NOT_CONFIGURED`
with no redirect and no `Set-Cookie`; the schema-wide signature map is **byte-identical** to the
pre value under the §4.6 pinned-in-transaction method.

**D5 — server artifact identity (new; this release carries server source).** The running
`atlas-server` entry resolves **inside the release directory**; its `dist/server.js` SHA-256
equals the build output recorded before the cutover; the process start postdates the cutover; and
the committed harness `test:actor-school-mutations` passed on the release tree in the build phase.
A server change cannot be observed live without an authenticated request, and a live request to a
mutation route can write if the guard is not in fact loaded — so this cycle deliberately does
**not** probe the live mutation routes. Identity plus the committed harness is the evidence; state
that limitation explicitly rather than implying a live behavioural proof.

`ACCEPT_READY` requires **5/5 passed, blocked 0, unperformed 0**. A row that cannot be performed
is reported `BLOCKED`/`UNPERFORMED` with its reason, never "not applicable".

## 6. Rollback

Incumbent `a02884ff` is **startable in place** at
`D:\ATLAS-runtime-supervised-a02884ff-20260921`. Capture its task XML and both machine-scope
values **before** any mutation; restore them and start once via the registered task, then re-prove
ownership, health, artifact identity and an unchanged signature map. `4c7c0bd9` and `434b2a81`
remain available behind it. Remove every temporary artifact.

## 7. Return

One handoff and one evidence artifact (`docs/reviews/actor-school-mutations-c01/part-b-deployment-evidence.md`):
pin and candidate SHAs, changed paths, the decisive commands with results, D1–D5 each with its own
result, the literal signature-map values **with the method's transaction scope**, the `D:` figures,
PIDs and listeners before/after, rollback status, and risks marked `BLOCKING`/`NON_BLOCKING`. No
transcripts, secrets or database rows.

## 8. Recorded successors — do not absorb into this release

- `GET /rollover-recovery/preview` (`runtime.router.ts:244`) still uses the defaulting
  `parseSchoolId`, so an authenticated JWT can read with a school-1 fallback. Pre-existing,
  unchanged by this delta, explicitly outside the mutation inventory → successor to
  `ACTOR-SCOPE-C01`.
- `parseStrictTermAuthoritySchoolId` (`runtime.router.ts:424`) lacks the new
  non-string/non-number guard (`true → 1`, `[1] → 1`). The term routes are `authenticate`-only and
  actor-matched, so it is not a cross-tenant path → apply the same guard for consistency in a
  later bounded change.
- The harness does not exercise body-vs-query precedence or hex/exponent/padded-string inputs, and
  the script has no aggregate/CI entry beyond D5 → optional hardening, not a blocker.
