# Live Browser QA

Read this file (or load the `atlas-live-browser-qa` skill) before browser, UX/UI,
responsive, authenticated, or cross-app evidence work. `AGENTS.md` §12 is the
authority. The live database is **test data** (operator, 2026-09-25).

## Evidence

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
- Rendered truth beats status codes. A 200 response with stale or contradictory UI
  is a finding. A 404 on latest-run or room-preference-summary routes can simply
  mean no current run or preferences if the page otherwise renders correctly.

## Sessions

- **Seeded sessions.** Each agent's browser profile (Codex's browser, opencode's
  Playwright profile, Claude Code's browser pane) holds a "remember me" session
  that the operator seeds by logging in once per profile; the ATLAS cookie lasts
  30 days (`atlas-client/src/lib/auth.ts`), subject to the upstream token.
  Agents reuse it. QA-account `LOCAL_LOGIN_SUCCESS` rows and `last_login_at`
  changes are expected and need no authorization.
- **No session:** report `NEEDS_SESSION(<agent>/<profile>)` in one line and
  continue with every row that does not need it. Do not mark the whole acceptance
  blocked, and do not stop the cycle for it.
- **Self-login** is allowed for an agent whose own tool rules permit entering a
  password, using the QA account in
  `%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md` (values are
  wrapped in markdown backticks — strip them in-process). An agent whose rules
  forbid entering passwords relies on the seeded session and never asks for those
  rules to be relaxed.
- Never write a credential value into a prompt, log, doc, commit, screenshot,
  trace, fixture, shell history, environment artifact or `live-state.md`. Never
  recreate faculty ID `2000056`.

## Mutations

- **Allowed** when an acceptance row needs them: save, apply, toggle, upload,
  download, form submission on test records. Record each one in the evidence.
- **HIGH under `AGENTS.md` §13** (the standing authorization covers them with its
  gates): generation, publication, deletion, anything that changes the published
  run/revision, and account, role or SSO changes.

## Custody

- One agent per browser profile at a time. Separate profiles per agent may run in
  parallel; name the profile in the evidence.
