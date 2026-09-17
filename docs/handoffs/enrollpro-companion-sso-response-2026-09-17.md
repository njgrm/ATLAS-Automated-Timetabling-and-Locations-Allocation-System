# ATLAS reply to the EnrollPro companion-SSO configuration note (2026-09-17)

Status: authored 2026-09-17 (Asia/Manila) by the ATLAS head planner. This is a **developer-facing reply**
for the EnrollPro team. It answers the route question in
`ATLAS-ENROLLPRO-SSO.md` and lists exactly what must change on the EnrollPro side before a joint test.
ATLAS does not edit EnrollPro source, configuration, migrations, lockfiles, or Git history.

## 1. Where your work was read from

Your implementation and documents were read **read-only** from the EnrollPro upstream repository
`jegs-sildora/EnrollPro` at `main` = **`2881152e`**
(*"docs: add SSO integration documentation and configuration files for companion systems"*), specifically:

- `server/src/features/auth/companion-sso.controller.ts` (base path `/api/auth/companion-sso`;
  start path `/api/auth/companion-sso/:system/reverse/start`)
- `server/src/features/auth/companion-sso-reverse.service.ts` (reads `client_id` from
  `${SYSTEM}_SSO_REVERSE_CLIENT_ID` and sends it as `client_id`)
- `server/src/features/auth/companion-sso.service.ts`
- `shared/src/schemas/companion-sso.schema.ts`
- `COMPANION-SSO-INTEGRATION-GUIDE.md`, `docs/features/integration/ENROLLPRO-COMPANION-SSO-FLOW.md`

**Note for the fork workflow:** the ATLAS-side mirror of the `njgrm/EnrollPro` fork is still at
`5887d685`; **your push landed on `jegs-sildora/EnrollPro` (`2881152e`), not on our fork.** ATLAS cannot
push to the fork (companion repositories are read-only from an ATLAS task). If you want ATLAS to review a
specific commit, tell us the upstream SHA and we will read it there; if you want it on our fork, your side
must fast-forward `njgrm/EnrollPro` from upstream.

## 2. Answer to your one blocking question: **the `/api/v1` pair is canonical**

ATLAS mounts its auth router at `/api/v1/auth` (`atlas-server/src/app.ts:104`), so the canonical routes are:

| Purpose | Canonical ATLAS URL |
|---|---|
| **Flow A code-accepting entry** (EnrollPro launches the browser here) | `GET https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback?code=<code>` |
| **Flow A browser result page** (post-SSO landing) | `https://njgrm.buru-degree.ts.net/auth/sso/callback` |
| **Flow B reverse authorize** (EnrollPro redirects here) | `POST https://njgrm.buru-degree.ts.net/api/v1/auth/sso/authorize` |
| **Flow B reverse exchange** (EnrollPro exchanges the code here) | `POST https://njgrm.buru-degree.ts.net/api/v1/auth/sso/exchange` |

Evidence: `router.get('/enrollpro/callback')` (`routes/auth.router.ts:82`), `router.post('/sso/authorize')`
(`:109`, JWT-authenticated), `router.post('/sso/exchange')` (`:150`, called by the companion with the paired
bearer secret), all under the `/api/v1/auth` mount. Read-only POST probes of both `/api/v1/auth/sso/*`
routes on the live Tailnet host return **401** (mounted, auth required) rather than 404.

**Your `ATLAS_SSO_CALLBACK_URL=https://njgrm.buru-degree.ts.net/auth/sso/callback` is correct** — that is
the SPA result page. The path in your §"ATLAS Callback Flow" step 1 (`/auth/enrollpro/callback`) is the
**code-accepting server route**, whose canonical form is `/api/v1/auth/enrollpro/callback`.

## 3. Four required changes on the EnrollPro side

| # | Change | Why |
|---|---|---|
| **F1** | Add the `/api/v1` segment to **both** `ATLAS_SSO_REVERSE_AUTHORIZE_URL` and `ATLAS_SSO_REVERSE_EXCHANGE_URL` | The current values point at non-existent paths; the reverse flow would 404. Restart EnrollPro after the change; do not add a client-side fallback between paths |
| **F2** | Set `ATLAS_SSO_REVERSE_CLIENT_ID` to exactly **`enrollpro`** | ATLAS validates `clientId === COMPANION_SSO_REVERSE_CLIENT_ID` (`companion-sso.service.ts:710`, and `:573`), which is the literal `enrollpro`. The current `enrollpro_client_id` would be rejected as a typed client error. Your code sends the configured value verbatim, so this is a value fix, not a code change |
| **F3** | **Rotate** `ATLAS_SSO_CLIENT_SECRET` | The value in the note is `sha256("test")` (`9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08` — verified). It is trivially guessable and authenticates ATLAS to EnrollPro, so it must be replaced with a random value of **>= 32 characters** that is byte-identical to ATLAS's `ENROLLPRO_SSO_CLIENT_SECRET` |
| **F4** | Treat **both** secrets as compromised and re-provision **out of band** | They were transmitted in a plaintext document, contrary to your own rule ("Do not log the callback query, authorization code, Bearer secret, identity payload, or session token"). Rotate `ATLAS_SSO_CLIENT_SECRET` and `ATLAS_SSO_REVERSE_CLIENT_SECRET`, and exchange them over a secure channel — never in a doc, issue, PR, log, or screenshot |

**One clarification to reconcile inside your document:** §"Effective EnrollPro Configuration" and
§"ATLAS Callback Flow" reference two different callback paths (`/auth/sso/callback` vs
`/auth/enrollpro/callback`). The first is the **browser result page**; the second is the **code-accepting
server route**, canonically `/api/v1/auth/enrollpro/callback`.

## 4. The paired-values table (both sides must agree)

| Their key (as published in your configuration block) | Our key | Direction / job | Must be |
|---|---|---|---|
| `ATLAS_SSO_CLIENT_SECRET` | `ENROLLPRO_SSO_CLIENT_SECRET` (ATLAS also accepts `ATLAS_SSO_CLIENT_SECRET` as a legacy fallback) | **ATLAS -> EnrollPro**: ATLAS presents this as the bearer when calling your exchange | identical on both sides, >= 32 chars, never printed |
| **`ATLAS_SSO_REVERSE_CLIENT_SECRET`** | **`ATLAS_SSO_REVERSE_CLIENT_SECRET`** (same name; legacy fallback `ENROLLPRO_REVERSE_CLIENT_SECRET`) | **EnrollPro -> ATLAS**: the bearer you present to `POST /api/v1/auth/sso/exchange`, which ATLAS validates with a constant-time compare | identical on both sides, >= 32 chars, never printed |
| (your registered reverse callback) | `ENROLLPRO_SSO_CALLBACK_URL` | the `redirect_uri` ATLAS sends you | the exact string `https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/reverse/callback` — ATLAS compares the presented `redirect_uri` against this value strictly |
| `<ENROLLPRO_BASE_URL>` | `ENROLLPRO_BASE_URL` | EnrollPro's base URL for ATLAS's outbound calls | your canonical base URL |

**Key-name note:** ATLAS deliberately accepts *your* key names. `ENROLLPRO_SSO_CLIENT_SECRET` is our
canonical outbound name with `ATLAS_SSO_CLIENT_SECRET` as a legacy fallback, and
`ATLAS_SSO_REVERSE_CLIENT_SECRET` is our canonical inbound name with `ENROLLPRO_REVERSE_CLIENT_SECRET` as
the fallback (`atlas-server/src/services/companion-sso.service.ts:131-143`, compared with
`timingSafeEqual` at `:170`). So the two secret **names** and values from your block can be set on our side
verbatim; no renaming is needed on either side. Set one name per direction, not both.

**Correction to §4 as first published:** ATLAS does **not** need you to mint an additional value. Both
directions are already covered by the two secret values in your published block — our durable env simply
takes those two values (plus `ENROLLPRO_SSO_CALLBACK_URL` and `ENROLLPRO_BASE_URL`) at the pending
deployment. Nothing is live on our side yet. The only change we ask for on the values themselves is the
rotation in §3 **F3/F4**; if you rotate, you must send us the new value for the direction you rotated.

## 5. ATLAS-side status (so you can plan the joint session)

| # | ATLAS prerequisite | Status |
|---|---|---|
| 1 | `0002_companion_sso_code` migration (the `companion_sso_codes` table) | **APPLIED** — `companion_sso_codes` and `teacher_program_presentation_revisions` now exist |
| 2 | Deployment carrying the later SSO corrections (`COMPANION-SSO-C03`, `COMPANION-SSO-LIVE-PREP-C02`) | pending — same deployment as #3 |
| 3 | `ENROLLPRO_SSO_CLIENT_SECRET`, `ENROLLPRO_SSO_CALLBACK_URL`, `ENROLLPRO_BASE_URL` in ATLAS's durable env | pending — needs your paired values from §4 |
| 4 | Your four fixes in §3 | **EnrollPro** |

The ATLAS SSO routes are already mounted and reachable on Tailnet, so once #2 and #3 land (and #4 is done)
the joint test can run immediately.

## 6. Joint acceptance tests (unchanged from our earlier handoff)

1. **Flow A happy path** — start in EnrollPro, land in ATLAS authenticated, ATLAS-local session only.
2. **Flow B happy path** — start in ATLAS, land in EnrollPro authenticated.
3. **Replay** — the same one-time code twice: second attempt typed failure, no second session.
4. **Expiry** — a code past its TTL: typed failure, no session.
5. **Wrong secret** — a mutated bearer: typed failure, no session, no code consumed.
6. **Mismatched callback** — an unregistered redirect URI: fail closed.
7. **Unauthorized role** — outside the role intersection: typed denial, no ATLAS session.
8. **Unreachable counterpart** — bounded typed failure, not a hang, no partial session.
9. **Log hygiene** — grep both sides for the secret, the code, and the bearer header: all absent.

## 7. What ATLAS is not asking for

No change to EnrollPro's data model or migrations. No shared database — ATLAS remains an isolated
microservice and SSO is an HTTP contract only. No ATLAS code change is required for anything in this reply.
