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

## 4. The working reference — copy SMART (operator: "EnrollPro and SMART have admin SSO working both ways")

All four systems are configured on the companion; each redirects to its own authorize endpoint
(`smart` → `laptop-pfvh73qk…/auth/enrollpro/authorize`, `aims` → `tfrog…`, `atlas` → `njgrm…`,
`mrf` → `mrf…/auth/sso/authorize`). SMART uses the **same machinery** (`server/src/lib/companionSso.ts`,
the same `COMPANION_SSO_*` codes), so its shape is the intended contract.

SMART's assertion (`D:/smart-final-capstone` @ `75057cc`,
`server/src/services/enrollproReverseSsoService.ts:214-230`):

```ts
identity: {
  subject: `SMART_USER:${user.id}`,   // no local numeric id is asserted as the cross-system id
  employeeId,                          // from user.teacher?.employeeId ?? username — FAILS CLOSED if empty
  accountName: user.username,
  firstName: user.firstName ?? "",     // EMPTY NAME IS ACCEPTED
  lastName:  user.lastName  ?? "",
  roles,                               // ADMIN→SYSTEM_ADMIN, REGISTRAR→HEAD_REGISTRAR, TEACHER→TEACHER
}
```

| | SMART (works) | ATLAS (fails) |
| --- | --- | --- |
| Cross-system key | `subject` string + **`employeeId`** | asserts its **local numeric account id** as `userId` |
| Name | `firstName ?? ""`, `lastName ?? ""` — optional | **requires** a two-token or faculty name → 403 |
| Fails closed on | missing **`employeeId`** | missing name |

Because SMART sends **no `userId`**, EnrollPro falls through to its `employeeId` lookup — which is
exactly why SMART works and ATLAS does not. **Defects A and B are therefore one bounded fix, copied
from the working implementation, not a new design.**

## 5. Fix plan

**ATLAS-side (this repo) — mirror SMART's assertion shape:**

1. **Stop asserting a local numeric id as the cross-system id.** Send a `subject` string (or omit
   `userId`) so EnrollPro resolves by `employeeId`. Keep `facultyExternalId` handling if it is still
   the right key for faculty — but never `account.id`.
2. **Make the name optional** — `firstName ?? ""`, `lastName ?? ""`, as SMART does. Drop the
   two-token/faculty requirement. This is *not* "fabricating a name": it is sending what we have.
3. **Fail closed on a missing `employeeId`** for the reverse path, as SMART does — that is the real
   reconciliation key, and the correct guard.
4. Re-run the click-through; the next expected gate is EnrollPro's `employeeId` lookup
   (`COMPANION_REVERSE_SSO_USER_NOT_FOUND` / `ACCOUNT_UNAVAILABLE`) if no EnrollPro user carries
   employeeId `1234501`.

**EnrollPro-side (handoff — READ_ONLY, do not edit):**

5. **Prefer `employeeId` over a caller-supplied `userId`**, or reject a `userId` that does not
   correspond to the asserted `employeeId`. SMART sidesteps this by never sending one; EnrollPro
   should not trust an arbitrary id from any companion.
6. EnrollPro collapses the companion's distinct 403 reasons into one opaque `ACCESS_DENIED`, so the
   cause is only findable from the companion's source. Surface the companion's error code.

**Not yet run:** EnrollPro → ATLAS. It needs an EnrollPro session; the operator has confirmed the
EnrollPro credentials are the same universal admin credentials, so this leg can now be completed.
