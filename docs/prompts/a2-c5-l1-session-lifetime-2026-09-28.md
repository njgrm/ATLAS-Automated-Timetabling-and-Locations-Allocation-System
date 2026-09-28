# Packet c5-L1 — A2 — the cutover sign-out: **verdict recorded, the HIGH change is DECLINED** — 2026-09-28

> **This packet is superseded in its §2 by a planner decision taken on an independent `CORRECTION_REQUIRED`
> review. Read §1 and §2A as the record; §2 (the proposed fix) was NOT executed and MUST NOT be executed from
> this revision.** The authority it once granted is withdrawn, not exercised. One safe artifact from it — the
> release-invariant signing-secret guard — shipped as a test-only candidate.

Lane C finding **L1** (`docs/reviews/lane-c-overnight-20260928/findings.md`, HIGH, demo risk): "a cutover appears
to sign every browser out". Both profiles lost their session across the `a1db27d5` cutover. c5 item 1 asked for the
mechanism, a proof, a fix *if* a restart invalidates remember-me sessions, and the verdict either way.

**Independent pre-action review: `CORRECTION_REQUIRED`, mandatory 8 / passed 8 → no; 8 passed 3 unperformed, 6 BLOCKING
findings** (diagnosis links D1–D6 all PASS; the causal claim D7 FAIL; acceptance rows L1-A/B/D/E/G FAIL on harness
grounds). The review **declined the proposed fix on security grounds** and the planner accepts that ruling. Verdict
recorded here so the decision is on the record with its evidence, per §13's rule that a superseding decision names the
authority it actually relied on.

**Authority relied on for this decision:** Lane C c5 item 1 (Lane C holds the operator's overnight delegation) plus
the standing 2026-09-20 authorization. The operator is asleep; no question was asked and none was needed. **No gate
was waived**, and the HIGH action is *declined* rather than deferred to an unstated future.

---

## 1. Verdict — the premise is FALSIFIED, and a real but different defect exists

**A release or a server restart does NOT invalidate a remember-me session.** Six links, all independently verified:

| # | Link | Evidence |
|---|---|---|
| D1 | Verification is stateless — no session store, no revocation list | `atlas-server/src/middleware/authenticate.ts:100-114`; `jwt.verify(token, process.env.JWT_SECRET)`, failures mapped to `TOKEN_EXPIRED` / `INVALID_TOKEN` |
| D2 | The signing secret is release-independent | machine `ATLAS_RUNTIME_ENV_FILE=D:\ATLAS-runtime-config\atlas-server.env`; **17 keys**, `JWT_SECRET` present; `ops/runtime/lib/contract.mjs:230` reads values **only** from `refPath`, and `sourceDir` feeds existence plus the `ENV_REFERENCE_INSIDE_REPO` containment check only |
| D3 | Neither live release carries its own env file | `lane-a2-release-a1db27d5\atlas-server\.env` and `lane-a2-release-d31bfacb\atlas-server\.env` do not exist (only `.env.example`) |
| D4 | The client persists the credential three ways, all origin-scoped | `atlas-client/src/lib/auth.ts:140-190` — `sessionStorage` always, the `atlasAuthToken` cookie always with `Max-Age=2592000` when remembered, `localStorage` only when remembered |
| D5 | No refresh credential exists anywhere | zero `refreshToken` / `REFRESH_TOKEN` / `rememberMe` matches in `atlas-server/src`; `auth.router.ts` mounts only `/login`, the SSO flows and `/me` |
| D6 | **The cutover delta touches no auth file at all** | `git diff --name-only d31bfacb a1db27d5` — zero hits in `local-auth.service.ts`, `authenticate.ts`, `auth.router.ts`, `lib/auth.ts`, `Login.tsx`, `useDashboardData.ts` |

**D6 is the strongest form of the falsification and the packet originally lacked it:** the cutover could not have
invalidated a session, because it did not touch the authentication surface.

**The real defect, stated precisely: "remember me" is a misnomer.** `local-auth.service.ts:10` signs with
`JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h'`, and `JWT_EXPIRES_IN` is **absent from the 17-key durable
env**, so the effective TTL is exactly **8 hours** — while the UI offers a 30-day remembered session. At the 8-hour
cliff the next request 401s, `expireAtlasSession()` runs `clearAtlasAuthStorage()` (`auth.ts:15-20`, `:223-227`),
and the remembered credential is destroyed; a typed login is the only recovery. A non-remembered session is
unaffected, which is why the failure looked like a deploy event rather than a clock.

**One thing already correct, and which must not be "fixed".** A transient failure during a cutover does **not**
clear the session: `useDashboardData.ts:197-207` sets `expireSession: true` only for the auth error kind, and
`:213`/`:224` leave it false, so a 5xx or transport error takes the `retainSnapshot` path. DASH-RESILIENCE-C01 got
this right, and `atlas-client/src/hooks/__tests__/dashboard-lifecycle-truth.test.ts` pins it — **19/19 green**,
reachable from 3 committed scripts. Any change that widens session clearing is a regression.

## 1A. The causal claim is **UNPROVEN**, not established (reviewer's D7 FAIL)

The first draft of this packet asserted the 8-hour cliff explains the ~07:00 sign-out. **The independent review
refuted the arithmetic and the planner withdraws that claim.** Recorded rather than smoothed over:

- `findings.md:46` says signed in at **01:35**, redirected to `/login` at **07:00** — that is **5h25m**. A token
  minted at 01:35 on an 8-hour TTL expires at **09:35**, not 07:00.
- The last row of *any* kind in `audit_logs` is `LOCAL_LOGIN_SUCCESS` id 1002, actor 46, school 1, **2026-09-27
  15:08:51**; plus 8 hours that is **23:08 on 09-27**, roughly **2.5 hours before** the profile was demonstrably
  working at 01:35. The audit record contradicts the 8-hour story rather than supporting it.
- **`local-auth.service.ts:775` mints a token and returns success with no `LOCAL_LOGIN_SUCCESS` row** (only the
  branch at `:873` writes one), so the audit log is **not** a complete mint record and the mint time is unrecorded.
- `live-state.md:201-205` records the A2 profile as simply **having no session** (`/auth/me` 401, empty cookie) —
  not as "losing it across the cutover". The first draft's phrasing overstated the record.

**What would decide it:** read the expired token's `exp`/`iat` out of the profile (never the secret) and compare
`exp` to 07:00. `exp` after 07:00 refutes the 8-hour theory; a `clearAtlasAuthStorage` firing without a
`TOKEN_EXPIRED` confirms a release-coupled or token-loss mechanism that is still not excluded. **This needs the
operator's re-seeded session, so it is a named successor, not a claim.**

## 2A. The proposed fix is DECLINED — the reviewer's security ruling, accepted

The first draft proposed minting a 30-day token when the user opts into "remember me" (no migration, no new store,
no new endpoint, claim-gated, `ATLAS_REMEMBER_ME_EXPIRES_IN ?? '30d'`). **The independent review ruled it
unacceptable as a unilateral source change, and the planner accepts that ruling.** Its reasoning, which is
substantively correct:

- There is **no per-session record**, so the only kill switch is rotating `JWT_SECRET` — which invalidates
  **every** session for **every** user, including non-remembered ones. The draft's claim that the long-lived token
  is "revocable on exactly the same terms as today" was **wrong in a way that matters**.
- The credential is **JS-readable** (`auth.ts:143` writes it via `document.cookie`, no `HttpOnly`) **and** is in
  `localStorage`, so a stolen remembered cookie goes from 8 hours of exposure to 30 days.
- "Which sessions are remembered?" becomes **unanswerable** — no audit row, no targeted revocation.

**Decisively, the fix was also not delivered by its own scope:** `Login.tsx:153-156` posts only
`{identifier, password}`, so `rememberMe` never reached the wire. The feature would have been **dead on arrival in
production while its decisive acceptance row still passed** — a vacuous row, which is the §11 failure mode this
directive is built to catch.

**And c5 item 1's own conditional is not met.** It says *"If a restart invalidates remember-me sessions, fix it."*
**A restart does not** (D1–D6). So no auth-boundary source change is required by this packet, and none is made.

**What still ships** is the one safe, zero-risk artifact the packet's question motivated: a committed guard proving
the signing secret cannot become release-dependent (row L1-G, below). It converts L1's falsification from prose in a
handoff into a tripwire.

### L1-G — the guard that shipped (`work/a2-c5-l1g`, `08d95b38`)

New `ops/runtime/__tests__/signing-secret-stability.test.mjs`, **one file, 187 insertions, no production change**.
It drives `loadEnvironmentReference` with a **synthetic** temp env file and asserts the resolved signing secret is
**byte-identical for two different release `sourceDir`s**, compared by **SHA-256 of the UTF-8 bytes of the parsed
value** — never printing the value. Serialization recorded in the file header per §11.

The **negative control is the point**: with **two different synthetic secrets** under the **same** `sourceDir`, the
digests must differ. Without it the test also passes a loader that returns a constant — the reviewer's objection,
now closed. Failing-first was proven with **two** mutants (a `sourceDir`-salted secret, and a constant secret), each
producing a real `AssertionError` with both digests printed, restored byte-exact after (`git diff --stat` empty on
`contract.mjs`). Reachable from the committed root `runtime:test` glob (12 → 13 files, 93 → 95 tests, 0 removed).
Planner-verified independently: `2 pass / 0 fail`, exit 0.

### Named successors (dated 2026-09-28, none started)

1. **The 8-hour remembered-session lifetime — needs an operator decision, not a unilateral widening.** Options are a
   refresh-token design (a persistent store, therefore a **migration**, therefore its own HIGH gate) or an explicit
   recorded operator risk acceptance of a longer-lived claim-gated token. Its UI-truthfulness half — telling the
   scheduler the real session length — is a MEDIUM copy change that could ship alone.
2. **`local-auth.service.ts:775` mints unaudited.** A token-mint audit row would make "when was this session
   issued" answerable from the record, which is what §1A lacks.
3. **L1's own decisive measurement:** read the expired token's `exp`/`iat` from the profile and compare to 07:00.
   Blocked only on the operator's re-seed.
4. **Per-user revocation** for remembered sessions. Named by the review; absent today.

## 2B. Corrections to the first draft, for the record (not re-litigated)

L1-A, L1-B, L1-D, L1-E and L1-G as first written were **unsatisfiable or vacuous** and are superseded by the record
above: `createToken` is unexported and `login()` needs Prisma, so a synthetic secret alone cannot drive L1-A;
`login()` mints at **three** sites (`:771`, `:869`, `:1081`) and the draft pinned one; L1-D's harness was undecided
between a direct middleware call and the mounted app; L1-E's "existing client harness" named no test and no
existing test covered the login body; L1-G as first written passed a constant-returning loader until the negative
control was added. Two clean checks cost nothing and are recorded so no future round repeats them:
`committed-credential-scrub.test.ts:777` uses the `JWT_EXPIRES_IN` line as a **self-contained negative-control
fixture**, so editing it is safe, and **no test anywhere pins the 8-hour TTL**, so the default carries no regression
risk.
