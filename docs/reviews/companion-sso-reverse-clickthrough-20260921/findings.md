# COMPANION-SSO reverse click-through — findings (2026-09-21)

Operator-authorized live click-through, **ATLAS → EnrollPro**, one ATLAS login, read-only, browser
context closed and the session cleared afterwards. Two defects found: one demo blocker, one
authorization defect.

## 1. What was observed

All four hops executed — the wiring is correct:

| Hop | Result |
| --- | --- |
| `dev-jegs /api/auth/companion-sso/atlas/reverse/start` | **303** |
| `njgrm /auth/enrollpro/authorize?…&state=<signed>` | **200** (ATLAS minted a one-time code) |
| `dev-jegs …/atlas/reverse/callback?code=…&state=…` | **303** |
| `dev-jegs /personnel/login?ssoError=COMPANION_REVERSE_SSO_ACCESS_DENIED&source=ATLAS` | failure |

**The 403 is ATLAS's, not EnrollPro's.** EnrollPro raises `COMPANION_REVERSE_SSO_ACCESS_DENIED` only
when its server-to-server exchange call receives **HTTP 403** from the companion
(`D:/EnrollPro` @ `7b6231ee`, `server/src/features/auth/companion-sso-reverse.service.ts:383`).
ATLAS's `/sso/exchange` deliberately maps four producer-side failures to 403
(`atlas-server/src/services/companion-sso.service.ts:123-126`).

## 2. Defect A — the account cannot produce a name (demo blocker, ATLAS-side data)

Live row for the QA/officer account:

```
id 46 · role "officer" · accountName "1234501" · employeeId "1234501" · facultyId null · faculty null
```

`mapLocalRoleToEnrollProRoles('officer')` → `['SYSTEM_ADMIN']`, so the **role passes**.
`resolveReverseSsoNameParts` (`companion-sso-identity.ts:73`) then requires a faculty mirror with
non-empty first+last, **or** an `accountName` of **≥2 whitespace-separated tokens**. The account's
display name **is its own numeric identifier** — one token — so it returns null and the exchange
403s with `COMPANION_SSO_IDENTITY_NAME_UNAVAILABLE`.

**The name requirement is ATLAS-side only.** EnrollPro never compares the asserted name:
`assertUserCanEnterEnrollPro` checks only `isActive`
(`companion-sso-reverse.service.ts:411`). ATLAS's comment citing a "linked-user name comparison" is
stale. The fail-closed rule is still right (never fabricate a name) — the **data** is the gap.

## 3. Defect B — ATLAS asserts a LOCAL id as an EnrollPro user id (authorization defect, code)

`buildAssertion` in `companion-sso.service.ts`:

```ts
userId: account.role === 'faculty' && facultyExternalId ? facultyExternalId : account.id,
```

- A **faculty** account asserts `facultyExternalId` — the EnrollPro-side identifier. Correct.
- **Every other role asserts ATLAS's own local account id.** For account 46 that is `46`.

EnrollPro's `resolveUserById` **prefers `userId`** and looks it up in **its own** user table
(`companion-sso-reverse.service.ts:421-434`), falling back to `employeeId` only when `userId` is
absent. Two consequences:

1. **It cannot resolve reliably for a staff account** unless the two id spaces happen to coincide —
   which is why the operator's "log in from ATLAS" expectation fails.
2. **If the id spaces do coincide, the ATLAS user is logged into an unrelated EnrollPro account**
   whose id matches, silently. That is a wrong-account login — an authorization defect, not a demo
   blocker — and it is reachable by any non-faculty account.

`employeeId` (the shared personnel key, `"1234501"`) **is** asserted, but only as a fallback.

## 4. Fix plan

**ATLAS-side (this repo):**

1. **Do not assert a local id as an EnrollPro id.** For a non-faculty account with no EnrollPro-side
   identifier, assert `userId: null` so EnrollPro resolves by `employeeId` — the correct
   cross-system key. Keep `facultyExternalId` for faculty accounts.
2. **Make the name assertion satisfiable for staff accounts** — give the account a real display
   name, or derive first/last from a persisted source that is not the identifier. **Do not** relax
   the rule into accepting a fabricated name.
3. Re-run the click-through; the next expected gate is EnrollPro's `employeeId` lookup or
   `isActive` (`COMPANION_REVERSE_SSO_USER_NOT_FOUND` / `ACCOUNT_UNAVAILABLE`).

**EnrollPro-side (handoff — READ_ONLY, do not edit):**

4. **Prefer `employeeId` over a caller-supplied `userId`**, or reject a `userId` that does not
   correspond to the asserted `employeeId`. Otherwise any companion can assert an arbitrary id.
5. EnrollPro collapses ATLAS's four distinct 403 reasons into one opaque `ACCESS_DENIED`, so the
   cause is only findable from our source. Surface the companion's error code.

**Not yet run:** EnrollPro → ATLAS. It needs an EnrollPro session; the credentials file has no
EnrollPro section. (The operator has since confirmed the EnrollPro credentials are the same
universal admin credentials, so this leg can be completed.)
