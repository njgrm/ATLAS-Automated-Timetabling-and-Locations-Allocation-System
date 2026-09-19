# SMART direct federation handoff

**Reference mirror:** `D:/smart-final-capstone` at `79b182c2d8fd7162393bb1a75aebe0be48d63e88` (clean, read-only).

## Goal

Implement direct SMART ↔ ATLAS SSO without routing identity through EnrollPro. Preserve SMART's existing EnrollPro flows.

## ATLAS contract

- ATLAS start: `GET https://njgrm.buru-degree.ts.net/api/v1/auth/sso/smart/start`.
- SMART authorize target configured in ATLAS as `SMART_SSO_AUTHORIZE_URL`.
- ATLAS callback: `GET /api/v1/auth/smart/callback`; exact URL configured as `ATLAS_SMART_SSO_CALLBACK_URL`.
- SMART calls ATLAS `POST /api/v1/auth/sso/exchange` with `clientId: "smart"`, its exact registered callback, and `Authorization: Bearer <ATLAS_SMART_SSO_REVERSE_CLIENT_SECRET>`.
- ATLAS calls SMART's equivalent exchange with `SMART_SSO_CLIENT_SECRET` and `SMART_BASE_URL`.
- ATLAS client link is enabled only by `VITE_SMART_SSO_START_URL`.

## SMART changes required

Generalize the EnrollPro-only implementation in `server/src/routes/sso.ts`, `server/src/services/enrollproSsoService.ts`, `server/src/services/enrollproReverseSsoService.ts`, and `server/src/lib/companionSso.ts` into a closed peer registry that includes `atlas`. Add a SMART client start link pointing to the ATLAS start route. Keep the current one-time hashed code, atomic consume, exact callback, active-year, and no-secret-logging invariants.

Role mapping into ATLAS must emit only `SYSTEM_ADMIN`, `HEAD_REGISTRAR`, `CLASS_ADVISER`, or `TEACHER`. ATLAS maps only an existing active account by exact employee ID/account name; it never provisions.

## Acceptance

Mounted tests must cover both directions, exact callback/audience/client binding, wrong-peer secret, state tamper/expiry/replay, concurrent code consumption, inactive/ambiguous identity, denied role, active-year mismatch, and zero writes/audits on rejection. Deployment acceptance must exercise SMART → ATLAS and ATLAS → SMART on their Tailnet origins, assert the origin after each transition, and prove a single session per direction without exposing codes, JWTs, or secrets.

