# AIMS direct federation handoff

**Reference mirror:** `D:/AIMS` at `2332d92ef3395ae65e9a067bd8ef6cce1191940c` (clean, read-only).

## Goal

Implement direct AIMS ↔ ATLAS SSO without routing identity through EnrollPro. Preserve AIMS's existing EnrollPro flows.

## ATLAS contract

- ATLAS start: `GET https://njgrm.buru-degree.ts.net/api/v1/auth/sso/aims/start`.
- AIMS authorize target configured in ATLAS as `AIMS_SSO_AUTHORIZE_URL`.
- ATLAS callback: `GET /api/v1/auth/aims/callback`; exact URL configured as `ATLAS_AIMS_SSO_CALLBACK_URL`.
- AIMS calls ATLAS `POST /api/v1/auth/sso/exchange` with `clientId: "aims"`, its exact registered callback, and `Authorization: Bearer <ATLAS_AIMS_SSO_REVERSE_CLIENT_SECRET>`.
- ATLAS calls AIMS's exact exchange URL from `AIMS_SSO_EXCHANGE_URL` with `AIMS_SSO_CLIENT_SECRET`; `AIMS_BASE_URL` remains the non-secret peer origin.
- ATLAS client link is enabled only by `VITE_AIMS_SSO_START_URL`.

## AIMS changes required

Generalize the EnrollPro-only implementation in `server/src/routes/auth.routes.ts`, `server/src/controllers/auth.controller.ts`, `server/src/services/enrollpro-sso.service.ts`, `server/src/services/enrollpro-reverse-sso.service.ts`, `client/src/pages/auth/EnrollProAuthorize.tsx`, and `client/src/components/layout/Sidebar.tsx` into a closed peer registry that includes `atlas`. Remove the hard-coded EnrollPro start URL from the sidebar in favor of explicit build-time configuration. Keep hashed one-time codes, atomic consume, exact callback, active-year, and no-secret-logging invariants.

Role mapping into ATLAS must deny AIMS `STUDENT`/`LEARNER`; only explicitly mapped staff/teacher roles may pass. ATLAS maps only an existing active account by exact employee ID/account name; it never provisions.

## Security prerequisite

A tracked AIMS documentation file currently contains a literal SSO credential. Treat that credential as compromised: rotate it before direct federation activation, purge or redact it through the AIMS repository's own authorized security process, and configure a newly generated distinct secret on each side. Do not reuse the exposed value, copy it into ATLAS, or print it in tickets, logs, screenshots, tests, or handoffs.

## Acceptance

Mounted tests must cover both directions, exact callback/audience/client binding, wrong-peer secret, state tamper/expiry/replay, concurrent code consumption, inactive/ambiguous identity, student/role denial, active-year mismatch, and zero writes/audits on rejection. Deployment acceptance must exercise AIMS → ATLAS and ATLAS → AIMS on their Tailnet origins, assert the origin after each transition, and prove a single session per direction without exposing codes, JWTs, or secrets.
