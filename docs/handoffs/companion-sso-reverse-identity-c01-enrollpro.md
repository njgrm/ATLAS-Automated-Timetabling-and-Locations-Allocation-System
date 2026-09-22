# Handoff: EnrollPro reverse-SSO — prefer `employeeId`, surface the companion's 403 code

To: EnrollPro owners. From: ATLAS stream `COMPANION-SSO-REVERSE-IDENTITY-C01`
(executor handoff; ATLAS-side candidate unmerged at time of writing).
Status: **developer-facing note only — no companion repo was touched** (EnrollPro/SMART/AIMS are READ_ONLY per ATLAS directive §4).

## 1. Upstream pin and exact source paths (READ_ONLY references)

- EnrollPro @ `7b6231ee`:
  - `server/src/features/auth/companion-sso-reverse.service.ts:383` — a companion
    exchange HTTP **403** becomes `COMPANION_REVERSE_SSO_ACCESS_DENIED`.
  - `server/src/features/auth/companion-sso-reverse.service.ts:411-419` —
    `assertUserCanEnterEnrollPro` checks only `user.isActive` (never the name).
  - `server/src/features/auth/companion-sso-reverse.service.ts:421-434` —
    `resolveUserById` prefers `userId`, falls back to `employeeId`.
  - `shared/src/schemas/companion-sso.schema.ts:62-76` — reverse-response
    `identity`: `userId` optional, `subject` `min(1).max(191)` optional,
    `employeeId` nullable optional, **`firstName`/`lastName`
    `z.string().min(1).optional()`** — a present-but-empty name FAILS
    validation (`502 COMPANION_REVERSE_SSO_RESPONSE_INVALID`).
- ATLAS (this lane): `atlas-server/src/services/companion-sso.service.ts`
  (`buildAssertion`) now asserts `subject: ATLAS_USER:<id>` + `employeeId`,
  never a numeric `userId`, and **omits** `firstName`/`lastName` when empty.

## 2. Required contract (two asks)

**(a) Prefer `employeeId` over a caller-supplied `userId`, or reject a `userId`
that does not correspond to the asserted `employeeId`.** Today `resolveUserById`
trusts any caller-supplied numeric `userId` first. A companion that asserts its
own local account id (as ATLAS historically did for non-faculty roles) silently
logs the user into an **unrelated EnrollPro account** when the id spaces
coincide. SMART sidesteps this by never sending `userId`; EnrollPro should not
rely on every companion doing so.

Acceptance: an exchange response carrying `userId` of an unrelated EnrollPro
user plus a valid `employeeId` resolves to the `employeeId` owner (or is
rejected with a typed mismatch error) — never to the `userId` row.

**(b) Surface the companion's distinct 403 code instead of collapsing to one
opaque `ACCESS_DENIED`.** ATLAS now fails typed
(`COMPANION_SSO_ROLE_UNMAPPABLE`,
`COMPANION_SSO_IDENTITY_EMPLOYEE_ID_UNAVAILABLE`), but EnrollPro's
`COMPANION_REVERSE_SSO_ACCESS_DENIED` hides which one fired; the cause is only
findable in the companion's source. Forward the companion's `code` (e.g. as
`ssoError` detail) so operators need not read ATLAS source to triage.

Acceptance: a denied reverse login exposes the originating companion code
alongside `COMPANION_REVERSE_SSO_ACCESS_DENIED`.

## 3. §5 B correction (recorded as required by the packet)

The click-through findings'
(`docs/reviews/companion-sso-reverse-clickthrough-20260921/findings.md` §3)
"Defect B" is a **misattribution**. Its cited line —
`userId: role === 'faculty' && facultyExternalId ? facultyExternalId :
account.id` — occurs once, in the **Flow A local session** (`sessionUser`,
`companion-sso.service.ts:571`), which is the local JWT's identity, not the
cross-system assertion. The reverse assertion has always used
`subject: ATLAS_USER:<account.id>` (`CompanionSsoAssertion`,
`companion-sso.service.ts:826-841`; emitted at `:1027`) and has **never** sent
a local numeric `userId` (`git log -S 'userId: account.role'` returns only the
Flow A line). Packet R1 was therefore verified, not re-implemented; this
handoff's ask (a) stands on the general contract risk (any companion *could*
send an arbitrary `userId` and EnrollPro would trust it), not on a current
ATLAS defect.

---

## 4. ADDED 2026-09-22 — `ATLAS_SSO_CALLBACK_URL` points at ATLAS's **result** path, so EnrollPro → ATLAS cannot complete

Found by the live click-through after ATLAS's reverse fix shipped. **This is now the blocking defect
for the normal (EnrollPro → ATLAS) direction**; the reverse direction (ATLAS → EnrollPro) is
confirmed working.

### Observed

From an authenticated EnrollPro session, EnrollPro's ATLAS entry issued
`POST https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/launch → 201` and the client
navigated to:

```
GET https://njgrm.buru-degree.ts.net/auth/sso/callback?code=-AcXi5ghJMH8J4N3Y5Vu_hrGLYFB8VxSrprVRlxnYpo  → 200
```

That path is ATLAS's **SPA result page**, which reads only the URL **fragment** `atlasToken` (and the
query `ssoError`). It never handles a `code`, so it rendered *"No sign-in token was provided. Start
again from EnrollPro."* and ATLAS was not authenticated. No ATLAS audit row or session was created.

### Root cause

EnrollPro's `${system}_SSO_CALLBACK_URL` is the URL it appends `?code=` to:

- `server/src/features/auth/companion-sso.service.ts:63-69` —
  `configurationNames(system)` → `callback: \`${system}_SSO_CALLBACK_URL\``.
- `:91-112` — `readCompanionConfiguration` reads `process.env[names.callback]` (must be https).
- `:353-354` — `const launchUrl = new URL(configuration.callbackUrl); launchUrl.searchParams.set("code", code);`

ATLAS's Flow A contract is a **server** callback, not the SPA result page:

- `atlas-server/src/routes/auth.router.ts:106` — `router.get('/enrollpro/callback', …)` (mounted at
  `/api/v1/auth/enrollpro/callback`) validates the code, exchanges it server-to-server, and
  302-redirects to the result page.
- `:30` — `COMPANION_SSO_RESULT_PATH = '/auth/sso/callback'`; `:46-54` — `redirectToCompanionSsoResult`
  sends `302 Location: /auth/sso/callback#atlasToken=<jwt>`.
- `atlas-client/src/pages/SsoCallback.tsx` + `lib/companion-sso-client.ts:36-44` — the SPA consumes
  **only** the fragment `atlasToken` / query `ssoError`.

The live value is the *result* path (`…/auth/sso/callback`) where the *callback* path belongs — the
two ATLAS paths differ by `/api/v1/auth/enrollpro/callback`.

### Required contract

```
ATLAS_SSO_CALLBACK_URL = https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback
```

(For symmetry: SMART's equivalent must likewise point at SMART's server callback; SMART is reported
working, so it is the ATLAS value that is wrong.)

### Acceptance tests

1. From an authenticated EnrollPro session, opening the ATLAS handoff must make the browser request
   **`/api/v1/auth/enrollpro/callback?code=…`** (the ATLAS server), which 302s to
   `/auth/sso/callback#atlasToken=…`, and the SPA must land on an authenticated ATLAS surface
   (`https://njgrm.buru-degree.ts.net`, `window.location.origin` asserted).
2. A malformed/expired code must produce `/auth/sso/callback?ssoError=COMPANION_SSO_CODE_INVALID`
   (or another typed `ssoError`), never the bare *"No sign-in token was provided."* message.
3. Negative control: with the wrong (result-path) value, the flow must reproduce the observed
   *"No sign-in token was provided"* dead end — proving the test discriminates.

**Do not fix this on the ATLAS side.** ATLAS cannot serve `?code=` at its SPA path without colliding
with the client route; the configuration value is EnrollPro's.
