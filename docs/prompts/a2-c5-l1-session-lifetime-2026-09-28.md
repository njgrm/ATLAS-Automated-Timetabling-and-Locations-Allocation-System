# Packet c5-L1 — A2 — the cutover sign-out: diagnosis and bounded fix — 2026-09-28

Lane C finding **L1** (`docs/reviews/lane-c-overnight-20260928/findings.md`, HIGH, demo risk): "a cutover appears
to sign every browser out". Both profiles lost their session across the `a1db27d5` cutover. c5 item 1 asks for the
mechanism, a proof, and a fix if a restart invalidates remember-me sessions.

**Tier: HIGH (auth boundary).** Loop per §11: independent packet review → executor → independent post-action QA.
Authority: Lane C c5 item 1 (Lane C holds the operator's overnight delegation) + the standing 2026-09-20
authorization. **No gate is waived.** The operator sleeps; this packet is written so that nothing here waits on a
human, and so that a reviewer can falsify it.

---

## 1. Verdict on L1's premise: FALSIFIED, with a different real defect found

**A release or a server restart does NOT invalidate a remember-me session.** Three independent sources prove it:

1. **There is no session store to lose.** `atlas-server/src/middleware/authenticate.ts:100-114` verifies the
   credential with `jwt.verify(token, process.env.JWT_SECRET)` and maps the failure to `TOKEN_EXPIRED` or
   `INVALID_TOKEN`. No in-memory session map, no revocation list, no per-user session row. A restart forgets nothing,
   because nothing was remembered server-side.
2. **The signing secret is release-independent.** `JWT_SECRET` is supplied through the machine-scope
   `ATLAS_RUNTIME_ENV_FILE` → `D:\ATLAS-runtime-config\atlas-server.env`, which lives **outside every release
   worktree**. Measured 2026-09-28: that file exists and carries a `JWT_SECRET` key; **neither**
   `E:\ATLAS-worktrees\lane-a2-release-a1db27d5\atlas-server\.env` nor
   `E:\ATLAS-worktrees\lane-a2-release-d31bfacb\atlas-server\.env` exists. So the secret is byte-stable across
   releases and a cutover cannot rotate it. (`ops/runtime/lib/contract.mjs:194` `loadEnvironmentReference` is the
   loader; the release dir is not an input to the secret.)
3. **The client persists the credential three ways, all origin-scoped.** `atlas-client/src/lib/auth.ts:140-190`:
   `localStorage` when "remember me" is checked, `sessionStorage` always, and the `atlasAuthToken` cookie with
   `Max-Age=2592000` (30 days). None of the three is keyed to a release, a build hash, or a process.

**The real cause is the credential's lifetime, which contradicts the UI's promise.**

- `atlas-server/src/services/local-auth.service.ts`: `const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h'`
  and `createToken` signs with `expiresIn: JWT_EXPIRES_IN`.
- **`JWT_EXPIRES_IN` is absent from the durable env file** (its key list was read 2026-09-28: `DATABASE_URL`,
  `JWT_SECRET`, `PORT`, `ENROLLPRO_API`, `ENROLLPRO_PROXY_ORIGIN`, `CLIENT_URL`, `ENROLLPRO_CLIENT_URL`,
  `CORS_EXTRA_ORIGINS`, `FACULTY_ADAPTER`, `SECTION_SOURCE_MODE`, `ATLAS_AUTH_DISABLE_RATE_LIMIT`,
  `ATLAS_SYSTEM_TOKEN`, `ENROLLPRO_SSO_CLIENT_SECRET`, `ATLAS_SSO_REVERSE_CLIENT_SECRET`,
  `ENROLLPRO_SSO_CALLBACK_URL`, `ENROLLPRO_BASE_URL`, `ENROLLPRO_SERVICE_TOKEN`). So the effective TTL is
  **exactly 8 hours**.
- **There is no refresh credential.** `atlas-server/src` contains no `refreshToken` / `REFRESH_TOKEN` / `rememberMe`
  symbol at all, and `auth.router.ts` mounts only `POST /login`, the SSO flows, and `GET /me`. Nothing can renew a
  token.

**Therefore "remember me" is a misnomer.** It durably stores a credential that dies after 8 hours. At the 8-hour
cliff the next request 401s, `expireAtlasSession()` runs `clearAtlasAuthStorage()` (`auth.ts:15-19, 223-227`), and
the remembered session is destroyed — a typed login is the only recovery, exactly as the operator observed when
re-seeding. Both profiles were seeded the previous evening, which puts the cliff at roughly 07:00; the `a1db27d5`
cutover was 06:41. **The cutover coincided with the cliff; it did not cause it.** This is recorded as the finding,
and it is the more serious defect: it signs the presenter out on a schedule, every day, deploy or no deploy.

**One thing that is already correct and must not be "fixed".** A transient failure during a cutover does **not**
clear the session: `atlas-client/src/hooks/useDashboardData.ts:192-204` sets `expireSession: true` only for
`errorKind === 'auth'`, so a 5xx/transport error takes the `retainSnapshot` path. DASH-RESILIENCE-C01 got this
right. Any proposed change that widens session clearing is a regression.

---

## 2. The fix (bounded, migration-free, no new store, no new endpoint)

The packet's suggested remedies are already half-present: the stable secret exists (row 2 above) and a persistent
store is unnecessary because verification is stateless. What is missing is that the credential's lifetime does not
match the promise. So:

**Mint a genuinely long-lived credential, only when the user asks to be remembered, and claim-gate it.**

| | |
|---|---|
| `auth.router.ts` `POST /login` | Read a boolean `rememberMe` from the body and pass it to `login()`. Absent/false keeps today's behaviour exactly. |
| `local-auth.service.ts` | `login({ …, rememberMe })` signs with `ATLAS_REMEMBER_ME_EXPIRES_IN ?? '30d'` and adds `rememberMe: true` to the payload when the flag is set; otherwise the existing `JWT_EXPIRES_IN ?? '8h'` path, byte-identical, is used. |
| Client | **No change required.** `Login.tsx:157` already calls `setLocalToken(response.data.token, rememberMe)`, and `setLocalToken` already writes `localStorage` only when `remember` is true. The client was asking for persistence and receiving an 8-hour token. |

**Why this shape and not a refresh-token flow.** A refresh token needs a persistent store, which needs a table, so
it needs a **migration** — a separate HIGH gate that cannot be executed inside this cycle, and one that would leave
the demo on an 8-hour cliff anyway until it is applied. The claim-gated long-lived token needs no schema, no new
route, no new table, and no client change, and it is revocable on exactly the same terms as today (rotate
`JWT_SECRET`). It is the smallest change that makes the shipped promise true.

**The security trade, stated plainly and for the reviewer to rule on.** A remembered token becomes valid for 30
days instead of 8 hours, so a stolen remembered cookie is worth ~9× more. This is the trade the 30-day cookie
already advertises in the UI; today the product simply does not honour what it offers. The mitigation is that the
long-lived form is **opt-in per login** and carries an explicit claim, so a non-remembered session is unaffected and
auditable. If the reviewer judges the trade unacceptable, the correct outcome is `CORRECTION_REQUIRED` naming the
refresh-token design as the successor — not a silent reversion to 8 hours.

**Prohibited:** no secret value in any file, log, prompt, commit or test. Tests must use a synthetic
`process.env.JWT_SECRET`, and must never read or print the durable file's value. §16.

---

## 3. Acceptance rows — every row names the harness that decides it

| # | Row | Harness | Decides |
|---|---|---|---|
| L1-A | A `rememberMe: true` login yields a token whose `exp - iat` is the remember TTL, and it **verifies** against the secret | `npx tsx --test` new `atlas-server/src/__tests__/remember-me-token-lifetime.test.ts`, synthetic secret | the fix works |
| L1-B | A login **without** the flag yields a token whose `exp - iat` is the 8-hour default, unchanged | same test | no regression to the default path |
| L1-C | **Failing-first:** at base `bd789d86` rows A and B cannot both pass — A fails because the payload carries no `rememberMe` claim and the TTL is 8h | same test run on a worktree at base | the test discriminates |
| L1-D | A request bearing a remembered token returns 200 from `GET /api/v1/auth/me`; an expired one returns 401 `TOKEN_EXPIRED` | same test, via `authenticate` middleware | end-to-end authority |
| L1-E | The client sends `rememberMe` on the wire only when the box is checked | existing client harness / a focused new test | wiring, not just server |
| L1-F | **Regression guard:** `resolveDashboardLoadFailure` still sets `expireSession` only for `errorKind === 'auth'` | `atlas-client/src/hooks/__tests__/dashboard-lifecycle-truth.test.ts`, unchanged, must stay green | the good behaviour is preserved |
| L1-G | **Secret-stability proof (the packet's own question):** the resolved signing secret is byte-identical for two different release `sourceDir`s | NEW `ops/runtime/__tests__/` test driving `loadEnvironmentReference` with a **synthetic** env file and two source dirs, comparing a SHA-256 of the value — never printing it | the premise is falsified in a committed, runnable test rather than only in prose |
| L1-H | Zero residue: `git status --short` empty, `git stash list` empty, no untracked helper script left behind | reviewer | §16 |

L1-G is the row that makes this verdict durable. Without it, L1's falsification is a claim in a handoff; with it, it
is a test that fails if someone reintroduces a per-release secret.

**Server-side tier:** HIGH. Client L1-F is a preservation row, not a change. **Every changed test file must be
reachable from a committed `package.json` script in the same commit** (§11).

## 4. Out of scope for this packet

- The refresh-token design (named successor: a migration plus a `/auth/refresh` route). Recorded, dated, not started.
- `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_SYSTEM_TOKEN` rotation, and any edit to the durable env file. **No env value
  is changed by this packet** — the TTL is a source default, not a machine setting, deliberately, so that a
  cutover cannot depend on an undeclared machine state.
- Any deployment. The release is a separate packet, gated separately.
