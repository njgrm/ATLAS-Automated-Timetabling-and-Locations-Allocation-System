# Live Browser QA

Read this file before browser, UX/UI, responsive, authenticated, or cross-app
evidence work.

- Undeployed source behavior requires component or rendered-interaction proof;
  record live post-deployment acceptance separately.
- ATLAS evidence uses `https://njgrm.buru-degree.ts.net` and asserts
  `window.location.origin`. Localhost is valid only for an explicitly labeled
  isolated check.
- Cite the exact route, accessibility snapshot, console errors, relevant network
  statuses, and tested viewports (`1366x768` and `390x844` for responsive work).
- EnrollPro-owned or cross-app work starts at
  `https://dev-jegs.buru-degree.ts.net/personnel/login` and asserts its origin.
  Evidence from one origin does not prove the other.
- Credentials come from
  `%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md`. They may be
  entered into the browser but never committed, staged, copied into prompts or
  docs, or exposed through screenshots, traces, fixtures, shell history,
  environment artifacts, logs, or live-state records. If unavailable, report
  `EXTERNALLY_BLOCKED(QA_CREDENTIALS_UNAVAILABLE)`. Never recreate faculty ID
  `2000056`.
- Prefer an existing authenticated session. A fresh login creates a
  `LOCAL_LOGIN_SUCCESS` row and changes `last_login_at`; it requires explicit
  authorization and disclosure.
- Exactly one agent controls the shared browser profile. Transfer named custody
  serially and close or hand off the context explicitly.
- Browser work is read-only by default. Save, Apply, Generate, Publish, Delete, or
  any other persisted action requires exact authorization.
- Rendered truth beats status codes. A 200 response with stale or contradictory UI
  is a finding. A 404 on latest-run or room-preference-summary routes can simply
  mean no current run or preferences if the page otherwise renders correctly.
