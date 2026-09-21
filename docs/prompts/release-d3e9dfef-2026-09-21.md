# RELEASE — WARNING-READABILITY-C01 + ACTOR-SCHOOL-RESIDUAL (pin `d3e9dfef`)

Status: **PREPARED**. Risk: **HIGH** deployment (shared runtime) carrying a **MEDIUM** client delta
and a **MEDIUM** server authority delta.

## 0. Preconditions — fail closed

1. Read `docs/reference/agent-runtime-deploy-facts.md` before any deployment/runtime/task/env action.
2. **Capacity:** `D:` free **35.82 GiB** at packet time. Re-measure; projected footprint
   1.43–1.86 GiB; **fail closed below 15 GiB**.
3. **Pin (immutable):** `d3e9dfef5790142f659e6def39aa19fe2ab08077`. Release directory:
   `D:\ATLAS-runtime-supervised-d3e9dfef-20260921`, created as a **registered detached worktree**
   (`AGENTS.md` §10.12 — never a clone).
4. **Elevated** shell (the machine-scope env write requires it).
5. **Custody:** the delta spans two lanes' files. This release ships both; it edits **neither**.
   If the build reveals a needed source edit, **stop and report**.
6. **Gate:** the source review in §3 must be `ACCEPT_READY` before execution. The executor shell
   cannot create worktrees — the planner provisions it.

## 1. The delta (exactly these 16 paths versus the live `80acdc25`)

**Client — `WARNING-READABILITY-C01`** (reviewed `ACCEPT_READY` 7/7 on the bounded re-review;
candidate `b6b4033f` + correction `f13d4cb9`): `atlas-client/src/lib/violation-presentation.ts`,
`ExplainabilityDrawer.tsx`, `ManualEditPanel.tsx`, `components/timetable/{LeftRailContent,
ScheduleReviewWorkspaceOverlays,TimetableShared,buildScheduleReviewWorkspaceContexts}.tsx`,
`hooks/{useScheduleReviewWorkspaceState,useTimetableLookupHelpers}.ts`,
`lib/__tests__/warning-readability-c01.test.ts`, `atlas-client/package.json`.

**Server — `ACTOR-SCHOOL-RESIDUAL`** (`7e4bc8f2`, **integrated by its own lane without committed
review evidence** — see §3): `atlas-server/src/routes/runtime.router.ts`,
`atlas-server/src/__tests__/runtime-router-actor-school-residual.test.ts`.

**Server — hygiene + copy:** `atlas-server/src/services/constraint-validator.ts` (copy map + one
message template), `atlas-server/src/__tests__/warning-readability-c01.test.ts`,
`atlas-server/package.json` (32 orphaned scripts removed; two script entries added).

The client tree **does** change in this release, so the served entry chunk must now **differ** from
the incumbent's `index-C6LTCXSf.js` — record the new chunk. The server source also changes, so D5
applies.

## 2. Deployment

Reuse `CURRENT-SOURCE-LIVE-DEPLOY-C02` §4–§8 (frozen boundary, authorized mutations, rollback) with
the corrections learned since, which override it where a literal has moved:

1. **Dependency trees:** the harness deny-list blocks `npm ci` for the server; copy the
   junction-free trees from the incumbent and record the literal commands and provenance. Isolated,
   no junction, never an install through a shared tree.
2. **`prisma generate`** from `atlas-server` with `--schema` pointing at the **repo-root** schema.
3. **Builds:** server `tsc` build **and** client `vite build` with exactly
   `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` and the SMART/AIMS start URLs unset.
4. **`schtasks` encoding: measure, do not assume.** Try the bytes `/query /xml` returns first.
5. **Zero-write method — the corrected form.** The C01 addendum's literal SQL/serialization with
   `SET LOCAL TIME ZONE 'UTC'` executed **inside the same transaction** as the enumeration and
   per-table queries. Record the literal statement **and its scope**; a standalone `SET LOCAL` is a
   no-op and must never be reported as a pin.
6. **Every `cli.mjs` invocation gets explicit env overrides** — an agent shell inherits a stale
   process-scope `ATLAS_RUNTIME_SOURCE_DIR`/`…_RELEASE_SHA` that shadows machine scope.
7. Capture the incumbent's task XML and both machine-scope values **before** any mutation.

## 3. Source review gate (one batched dispatch — `AGENTS.md` §11)

The client delta is already independently reviewed and accepted. The **`ACTOR-SCHOOL-RESIDUAL`
server delta has no committed review evidence** — its own lane integrated it. One fresh reviewer
must, in a single pass: (a) audit that delta against the same authority contract
`ACTOR-SCHOOL-MUTATIONS-C01` shipped (missing/malformed/zero/negative/fractional target school
rejected with a typed error **before** any dispatch; JWT must match the target school; no write on
rejection; scope limited to its two paths; no assertion weakened); and (b) lint this packet. The
deployment must not execute on a `CORRECTION_REQUIRED` source review.

## 4. Acceptance — 6 mandatory rows

**D1 — release identity.** Installed HEAD equals the pin with a clean status (declare the expected
dirty set); both machine-scope values, the task action/arguments/working directory and the state
file's `releaseSha` all identify the pin and the new release directory.

**D2 — ownership.** Exactly one listener on `5001` and one on `5174`, both descending from the
task-launched supervisor; task keeps SYSTEM / ONSTART / `PT0S` / IgnoreNew.

**D3 — health, public truth, warning protection.** Local health + readiness, production host,
Tailnet health, and a DB-backed public subjects read all 200; a public published-schedule read with
an explicit valid `termIndex` is non-5xx and term-scoped, malformed input returns typed `400
INVALID_TERM_INDEX`; unauthenticated latest and run-specific violation-report routes return 401
before dispatch.

**D4 — served-artifact identity, configuration, zero write.** Served HTML and every referenced JS
asset match the built dist manifest; **the client entry chunk differs from the incumbent's
`index-C6LTCXSf.js`** and is recorded; the EnrollPro origin is present and no SMART/AIMS start URL
is; env bytes and key set unchanged; SMART/AIMS `/start` return typed `503
COMPANION_SSO_NOT_CONFIGURED` with no `Location` and no `Set-Cookie`; the schema-wide signature map
is **byte-identical** to the pre value under §2.5.

**D5 — server artifact identity.** The running `atlas-server` entry resolves **inside** the release
directory; its `dist/server.js` SHA-256 equals the build output recorded before the cutover; the
process start postdates the cutover; and **both** committed harnesses pass on the release tree
(`test:actor-school-mutations`, `test:warning-readability`). The live mutation routes are
deliberately **not** probed — a live `POST` can write if a guard is not loaded; state that
limitation rather than implying a live behavioural proof.

**D6 — the deferred browser row (`WARNING-READABILITY-C01` §5), now decidable because the change is
deployed.** On the Tailnet origin with a `window.location.origin` assertion, at desktop `1366x768`
and mobile `390x844`, show the rendered warning list for a run with real violations (run 316:
335 rows / 116 unique / 113 shown) and assert: **no raw code or enum name** in operator-visible
text; **no bare number without units**; **no `Faculty <digits>` identity** (a name, or the plain
fallback, instead); the count label states its basis; and no global scrollbar. **Read-only — do not
press Generate/Publish/Apply, and do not click a timetable cell.** One authorized login is allowed;
disclose its `audit_logs` row id and the actor `last_login_at` delta. If the harness cannot drive a
browser, report `BLOCKED(harness)` — never simulate it.

`ACCEPT_READY` requires **6/6 passed, blocked 0, unperformed 0**. An unperformable row is
`BLOCKED`/`UNPERFORMED` with its reason, never "not applicable".

## 5. Rollback

Incumbent `80acdc25` is **startable in place** at `D:\ATLAS-runtime-supervised-80acdc25-20260921`.
Restore its captured task XML and both machine-scope values, start once via the registered task,
then re-prove ownership, health, artifact identity and an unchanged signature map. `a02884ff`,
`4c7c0bd9` and `4c7c0bd9`'s predecessors remain available behind it. Remove every temporary
artifact.

## 6. Return

One handoff and one evidence artifact
(`docs/reviews/release-d3e9dfef-20260921/deployment-evidence.md`): pin and candidate SHAs, the
decisive commands with results, D1–D6 each with its own result, the literal signature-map values
with the transaction scope, the `D:` figures, PIDs and listeners before/after, the browser row's
literal rendered strings, the login disclosure, rollback status, and risks marked
`BLOCKING`/`NON_BLOCKING`. No transcripts, secrets or database rows.
