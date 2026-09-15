# EnrollPro ↔ ATLAS SSO contract corrections — developer handoff (2026-09-15)

Owner: ATLAS (handoff author). **Companion repositories are READ_ONLY.** This
document requests corrections; it does not implement them. No file in
`D:/EnrollPro` (or any companion repository) was edited, staged, migrated, or
otherwise modified while producing it.

Produced by: `COMPANION-SSO-LIVE-PREP-C02` (executor, `REVIEW_REQUIRED`).
Evidence base: `docs/handoffs/companion-sso-live-prep-c02-evidence.md`.
Upstream commit inspected: **EnrollPro `5887d685b834db31600be258e96be3bdd0bccacb`**
(clean, branch `main`).
ATLAS commit inspected: **`6409a2a8c2977a7e96db114b1d1a2d84a0d01afb`** (worktree
`work/companion-sso-live-prep-c02`, base of the preparation candidate; the SSO
product surface is integrated at `c989f03d`).

---

## D1 — BLOCKING: reverse-assertion role vocabulary and assertion names

### Observed defect

The ATLAS → EnrollPro reverse flow (Flow B) cannot complete in production: the
ATLAS identity assertion is rejected by EnrollPro's response schema before any
EnrollPro session is created.

**EnrollPro side (authority):**

- `shared/src/schemas/companion-sso.schema.ts:63-80` —
  `companionSsoReverseExchangeResponseSchema` requires:
  - `identity.roles: z.array(RoleEnum).min(1)` (line 73)
  - `identity.firstName: z.string().min(1)` (line 70)
  - `identity.lastName: z.string().min(1)` (line 72)
  - `identity.lrn: z.string().regex(/^\d{12}$/).nullable()` (line 69)
- `shared/src/constants/index.ts:4-11` — `RoleEnum` is
  `["SYSTEM_ADMIN","HEAD_REGISTRAR","CLASS_ADVISER","TEACHER","LEARNER","MRF"]`
  (uppercase; Zod enum matching is case-sensitive).
- `server/src/features/auth/companion-sso-reverse.service.ts:351-365` —
  `safeParse(...)` failure throws
  `502 COMPANION_REVERSE_SSO_RESPONSE_INVALID`.
- `server/src/features/auth/companion-sso-reverse.service.ts:373-389` —
  `assertIdentityMatchesUser` also compares `firstName`/`lastName`
  (uppercase-normalized) and `employeeId`, so a role fix alone is not sufficient
  if the names are empty.

**ATLAS side (producer):**

- `atlas-server/src/services/companion-sso.service.ts:784` —
  `roles: [account.role]` (the raw `atlas_auth_accounts.role` value).
- `atlas-server/src/services/companion-sso.service.ts:801-818` —
  `resolveAccountNameParts` returns `{ firstName: '', lastName: '' }` when the
  account has neither a `faculty` row nor an `accountName`.
- `atlas-server/src/services/companion-sso.service.ts:617-631` — the
  `CompanionSsoAssertion` type also declares `lrn: null` and `middleName: null`.

**Live data proof (read-only, 2026-09-15):**

- Database `atlas_recovery_clean_rebuild_20260905`,
  `SELECT role, count(*) FROM atlas_auth_accounts GROUP BY role` →
  **`faculty` = 42, `officer` = 2**. No uppercase role value exists. ATLAS
  `middleware/authorize.ts:3` authorizes Flow B for `admin`, `officer`,
  `SYSTEM_ADMIN`; the only live privileged accounts are `officer`.
- Therefore the Flow B assertion in production is
  `identity.roles: ["officer"]`, which fails EnrollPro's case-sensitive enum.

**Why the ATLAS suite does not catch it:** the mounted test creates its fixture
account with role `'SYSTEM_ADMIN'`
(`atlas-server/src/__tests__/companion-sso-http.test.ts:163`) and asserts
`assertion.identity.roles[0] === 'SYSTEM_ADMIN'` (`:521`). The committed test
encodes an uppercase role the real producer never emits — a production-shape
parity gap, not a passing control.

### Required contract (choose one; both sides must agree)

**Option A — ATLAS normalizes to EnrollPro's vocabulary (ATLAS-owned change).**
Before responding from `POST /api/v1/auth/sso/exchange`, ATLAS maps the local
role to the EnrollPro `RoleEnum` vocabulary and guarantees non-empty
`firstName`/`lastName`:
- `officer`/`admin` → `SYSTEM_ADMIN` (or a documented, agreed mapping);
- `faculty` → `TEACHER`;
- any role not representable in `RoleEnum` → fail closed with a typed 4xx and no
  assertion (never emit an unmappable role);
- name fallback: derive a non-empty `firstName`/`lastName` from persisted
  identity (`faculty` row, else `accountName`, else a defined deterministic
  fallback), or fail closed if none exists;
- add a failing-first test using a lowercase `officer` fixture that reproduces
  the current 502 and passes after the fix.

**Option B — EnrollPro accepts the ATLAS vocabulary (EnrollPro-owned change).**
Widen `companionSsoReverseExchangeResponseSchema.identity.roles` to accept
ATLAS's role tokens (`officer`, `admin`, `faculty`, plus the existing enum) and
document the name-fallback contract, updating
`assertUserCanEnterEnrollPro` (`companion-sso-reverse.service.ts:391-421`) if the
mapping must differ. This change is committed **in the EnrollPro repository by
its owner**; ATLAS must not implement it.

Whichever option is chosen must be recorded as the single authority for the
reverse role/name contract, and both packets that depend on it must cite it.

### Negative controls (mandatory)

1. A lowercase-role ATLAS account asserts a role the consumer accepts;
   mutating the mapping back to raw `account.role` makes the end-to-end reverse
   exchange fail with `COMPANION_REVERSE_SSO_RESPONSE_INVALID` (failing-first).
2. An account with no faculty row and no `accountName` must not emit `""` names;
   the producer fails closed or emits the agreed deterministic fallback.
3. An unmappable role must produce a typed failure and **zero** EnrollPro
   `companion_identity_links`/`users.lastLoginAt` writes and **zero** ATLAS
   success audit rows.

### Acceptance matrix

| # | Case | Pass condition |
| --- | --- | --- |
| D1-1 | Lowercase `officer` ATLAS account, Flow B | EnrollPro `safeParse` succeeds; reverse login completes |
| D1-2 | Lowercase `faculty` ATLAS account, Flow B | Same (or a typed, documented denial — never a schema 502) |
| D1-3 | Account with no name source | Fails closed or uses the documented fallback; never an empty name reaching EnrollPro |
| D1-4 | Mutant: mapping reverted to raw role | End-to-end reverse exchange fails (`COMPANION_REVERSE_SSO_RESPONSE_INVALID`); mutant test asserts it |
| D1-5 | Zero-write on denial | No `companion_identity_links`/session/ATLAS audit writes on any rejection |

---

## D2 — BLOCKING for configuration: contradictory and incorrect `.env.example` values

### Observed defect

`D:/EnrollPro/server/.env.example` declares the ATLAS reverse block **twice**
with different values, and `ATLAS_SSO_CALLBACK_URL` is missing `/api/v1`:

| EnrollPro path:line | Key | Value | Real ATLAS contract | Class |
| --- | --- | --- | --- | --- |
| `server/.env.example:36` | `ATLAS_SSO_CALLBACK_URL` | `https://njgrm.buru-degree.ts.net/auth/enrollpro/callback` | `https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback` (`atlas-server/src/routes/auth.router.ts:82`, mount `atlas-server/src/app.ts:103`) | MISMATCH |
| `server/.env.example:38` | `ATLAS_SSO_REVERSE_AUTHORIZE_URL` | `https://configured-atlas-host/auth/enrollpro/authorize` | `https://njgrm.buru-degree.ts.net/auth/enrollpro/authorize` (`atlas-client/src/App.tsx:66`) | UNPROVEN (placeholder host) |
| `server/.env.example:39` | `ATLAS_SSO_REVERSE_EXCHANGE_URL` | `https://configured-atlas-host/api/auth/enrollpro/exchange` | `https://njgrm.buru-degree.ts.net/api/v1/auth/sso/exchange` (`auth.router.ts:150`) | MISMATCH |
| `server/.env.example:40` | `ATLAS_SSO_REVERSE_CLIENT_ID` | `enrollpro` | `enrollpro` (`companion-sso.service.ts:42,556`) | MATCH |
| `server/.env.example:66` (duplicate block) | `ATLAS_SSO_REVERSE_AUTHORIZE_URL` | `https://njgrm.buru-degree.ts.net/auth/sso/authorize` | `https://njgrm.buru-degree.ts.net/auth/enrollpro/authorize` | MISMATCH |
| `server/.env.example:67` (duplicate block) | `ATLAS_SSO_REVERSE_EXCHANGE_URL` | `https://njgrm.buru-degree.ts.net/auth/sso/exchange` | `https://njgrm.buru-degree.ts.net/api/v1/auth/sso/exchange` | MISMATCH |
| `server/.env.example:68` (duplicate block) | `ATLAS_SSO_REVERSE_CLIENT_ID` | `enrollpro_client_id` | `enrollpro` | MISMATCH |

Related documentation defects in the same file: `ATLAS_API_KEY` is declared
twice with different values, and the reverse examples for AIMS/SMART repeat the
same wrong paths (only the ATLAS block is in scope for this handoff).

Do not accept `/api/auth/enrollpro/exchange`, `/auth/sso/authorize`, or
`/auth/sso/exchange` as ATLAS contracts; they exist only in these examples.

### Required correction

Replace the two contradictory ATLAS blocks in `server/.env.example` with exactly
one block whose values match §4 of
`docs/prompts/companion-sso-runtime-activation-c02-2026-09-15.md`
(`ATLAS_SSO_CALLBACK_URL=https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback`,
`ATLAS_SSO_REVERSE_AUTHORIZE_URL=https://njgrm.buru-degree.ts.net/auth/enrollpro/authorize`,
`ATLAS_SSO_REVERSE_EXCHANGE_URL=https://njgrm.buru-degree.ts.net/api/v1/auth/sso/exchange`,
`ATLAS_SSO_REVERSE_CLIENT_ID=enrollpro`), and remove the duplicate `ATLAS_API_KEY`.
Keep placeholder secret markers where a secret is required.

### Negative controls

1. A reverse flow configured from the corrected example completes the Flow B
   handshake; configured from the pre-correction `/auth/sso/exchange` value it
   fails at the EnrollPro→ATLAS exchange (404/typed error), proving the example
   was load-bearing.
2. `authorizeUrl.origin === exchangeUrl.origin` must hold for the corrected
   values (`https://njgrm.buru-degree.ts.net`); EnrollPro already enforces this
   at `companion-sso-reverse.service.ts:120-128`.

### Acceptance matrix

| # | Case | Pass condition |
| --- | --- | --- |
| D2-1 | Exactly one ATLAS reverse block in `server/.env.example` | `git grep -c 'ATLAS_SSO_REVERSE_AUTHORIZE_URL'` counts the intended occurrences only; no contradictory duplicate |
| D2-2 | Corrected values used end to end | Flow B reaches ATLAS `/auth/enrollpro/authorize` → `/api/v1/auth/sso/exchange` |
| D2-3 | `client_id` value | Equals `enrollpro`; `enrollpro_client_id` no longer appears |
| D2-4 | `ATLAS_SSO_CALLBACK_URL` includes `/api/v1` | The Flow A browser callback resolves to the mounted ATLAS route (not a SPA 404) |

---

## D3 — NON-BLOCKING: ATLAS-owned environment documentation gap

`atlas-server/.env.example` documents none of the four ATLAS SSO server keys
(`ENROLLPRO_BASE_URL`, `ENROLLPRO_SSO_CLIENT_SECRET`,
`ENROLLPRO_SSO_CALLBACK_URL`, `ATLAS_SSO_REVERSE_CLIENT_SECRET`, or their legacy
aliases). This is an ATLAS-side follow-up (a bounded documentation change in the
ATLAS repository), not an EnrollPro request.

## Constraints and notes for the implementer

- Do not edit ATLAS product source from this handoff; ATLAS-side Option A (D1)
  and the D3 documentation gap require their own ATLAS change with fresh QA.
- Do not edit any companion repository from an ATLAS task; D1 Option B and D2
  are EnrollPro-owned changes committed by the EnrollPro repository owner.
- The preparation candidate that produced this handoff performed zero companion
  mutations (`D:/EnrollPro` clean at `5887d685…` before and after).
- The live EnrollPro Tailnet host `dev-jegs` was offline at evidence capture; the
  end-to-end acceptance rows above can only be exercised once it is reachable and
  the migration + activation preconditions are met.
