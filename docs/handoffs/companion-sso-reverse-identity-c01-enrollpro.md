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
