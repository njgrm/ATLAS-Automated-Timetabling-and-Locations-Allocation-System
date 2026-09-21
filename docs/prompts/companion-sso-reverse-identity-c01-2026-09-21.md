# COMPANION-SSO-REVERSE-IDENTITY-C01 — make ATLAS's reverse assertion resolvable by EnrollPro

Status: **PREPARED — ready to dispatch.** Risk: **MEDIUM** server source; the release that carries it
is **HIGH** (Lane A's boundary). Author: Lane A, 2026-09-21.

Evidence and the full diagnosis: `docs/reviews/companion-sso-reverse-clickthrough-20260921/findings.md`.
Read it first — it contains the live click-through, the two defects, and the working reference.

## 0. Why

The operator's requirement is that a signed-in ATLAS user reaches EnrollPro **through the SSO** —
without a second EnrollPro login. Today that is impossible for every non-faculty account:

1. **Defect A (blocker):** `resolveReverseSsoNameParts` requires a faculty first+last name or a
   **two-token** `accountName`. The universal admin's `accountName` is its own identifier
   (`"1234501"`) → one token → ATLAS 403s → EnrollPro shows
   `COMPANION_REVERSE_SSO_ACCESS_DENIED`. EnrollPro never compares the name
   (`assertUserCanEnterEnrollPro` checks only `isActive`).
2. **Defect B (authorization defect):** `buildAssertion` sets
   `userId: role === 'faculty' && facultyExternalId ? facultyExternalId : account.id` — so every
   **non-faculty** account asserts ATLAS's **local** account id. EnrollPro's `resolveUserById`
   prefers `userId` and looks it up in **its own** user table: it cannot resolve for staff, and **if
   the id spaces coincide it silently logs the user into an unrelated EnrollPro account.**

**The fix is copied from a working implementation, not designed.** SMART's admin SSO works both ways
through the same machinery (`D:/smart-final-capstone` @ `75057cc`,
`server/src/services/enrollproReverseSsoService.ts:214-230`): it asserts `subject` + **`employeeId`**
(failing closed only when `employeeId` is empty), sends **no** local numeric `userId`, and allows
empty names (`firstName ?? ""`, `lastName ?? ""`). Because no `userId` is present, EnrollPro falls
through to its `employeeId` lookup — which is exactly why SMART works.

## 1. Required outcomes

**R1 — stop asserting a local id as the cross-system id.** For the reverse assertion, do not send
`account.id` as `userId`. Send a `subject` string in SMART's shape (e.g. `ATLAS_USER:<account.id>`)
or omit `userId`, so EnrollPro resolves by `employeeId`. Keep the faculty path only if
`facultyExternalId` is genuinely the EnrollPro-side key — verify that claim against the code, and if
it is unproven, treat faculty the same way (subject + employeeId).

**R2 — make the name optional.** Mirror SMART: `firstName ?? ""`, `lastName ?? ""`. Remove the
two-token/faculty requirement from `resolveReverseSsoNameParts` (or stop gating on it). This is not
fabricating an identity — it sends what is persisted, and EnrollPro demonstrably accepts it.

**R3 — fail closed on a missing `employeeId`.** `employeeId` is the reconciliation key. When it is
absent, throw the typed failure that the exchange maps to 403
(`COMPANION_SSO_ACCOUNT_UNAVAILABLE` or a new typed code) **before** building the assertion —
mirroring SMART's guard.

**R4 — the assertion type and the EnrollPro contract stay compatible.** EnrollPro validates the
exchange response; SMART's shape is proof that `subject` + `employeeId` + optional names validate.
Do not remove fields EnrollPro reads. Record the exact assertion body in the evidence.

**R5 — prove it without deploying first.** An isolated, DB-free mounted test that builds the
assertion for (a) a staff account with a single-token `accountName` and a valid `employeeId` →
assertion contains `employeeId`, contains **no** local `userId`, and has empty-or-partial names; and
(b) an account with **no** `employeeId` → the typed fail-closed error. Plus one preservation suite.

**R6 — the live click-through is the deployment-acceptance clause.** After the release:
**ATLAS → EnrollPro** must complete to an authenticated EnrollPro surface (assert
`window.location.origin === 'https://dev-jegs.buru-degree.ts.net'`), and **EnrollPro → ATLAS** must
complete back to an authenticated ATLAS surface. Use the universal admin credentials for both
(`%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md`; the operator confirmed the same
credentials serve both). Disclose every login's `audit_logs` row and `last_login_at` delta. If it
now fails at EnrollPro's `employeeId` lookup, that is a **companion-side data matter** — report the
typed error, do not work around it.

## 2. Files and boundaries

- **Writable:** `atlas-server/src/services/companion-sso.service.ts`,
  `atlas-server/src/services/companion-sso-identity.ts`, the reverse-assertion type, and one new
  test file (+ its `package.json` script entry). Name every path in the return.
- **Do not touch:** `atlas-server/src/routes/runtime.router.ts` (another lane is live there),
  `docs/plans/live-state.md`, the machine register, `CHANGELOG.md`, any client file, or any
  companion repo — EnrollPro/SMART/AIMS are **READ_ONLY**.
- **No deployment, no login, no browser** in the source phase; the release and the click-through are
  separate, later, and Lane A's.
- Do not weaken an existing control: `companion-sso-reverse.test.ts` and
  `companion-sso.test.ts` must keep passing. Corrections are additive.

## 3. EnrollPro-side handoff (write it, do not implement it)

Add to `docs/handoffs/` a developer-facing note for the companion owners (`AGENTS.md` §4): (a)
**prefer `employeeId` over a caller-supplied `userId`**, or reject a `userId` that does not
correspond to the asserted `employeeId` — SMART sidesteps the risk by never sending one, but
EnrollPro should not trust an arbitrary id from any companion; (b) EnrollPro collapses the
companion's distinct 403 reasons into one opaque `ACCESS_DENIED`, so the cause is only findable in
the companion's source — surface the companion's error code. Include the upstream commit
(`7b6231ee`), the exact source paths/lines, the required contract and acceptance tests.

## 4. Gates and return

One batched pre-action review (source range **and** this packet, in one dispatch — `AGENTS.md` §11),
one executor, then the release with one fresh post-action QA. The release packet opens with the
unreviewed-delta gate if this lane integrates its own work.

Return one handoff and one evidence artifact
(`docs/reviews/companion-sso-reverse-identity-c01/evidence.md`): base/candidate SHA, changed paths,
the R1–R5 results with literal output (including the exact assertion body for the staff account and
the fail-closed case), the suites re-run, the companion handoff path, and risks marked
`BLOCKING`/`NON_BLOCKING`. No secrets, tokens or credential values anywhere.
