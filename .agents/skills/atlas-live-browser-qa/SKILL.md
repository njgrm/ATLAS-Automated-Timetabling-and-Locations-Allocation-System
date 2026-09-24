---
name: atlas-live-browser-qa
description: Rules for live browser, UX/UI, responsive, authenticated or cross-app (EnrollPro/SMART/AIMS) evidence on the ATLAS Tailnet origin. Use before driving any browser against ATLAS or a companion app, or before citing browser evidence.
metadata:
  short-description: ATLAS live browser QA custody and evidence rules
---

# ATLAS live browser QA

Authority: `AGENTS.md` §12. Full rules: `docs/reference/agent-live-browser-qa.md` — read it.

## Before opening the browser

- **Custody.** Exactly one agent controls the shared browser profile. Confirm no other lane
  holds it (check the lanes in `docs/plans/live-state.md`); take and release custody by name.
- **What it can prove.** Live Tailnet evidence proves the *deployed* release only — never
  undeployed source bytes. Confirm the live SHA first (`atlas-deploy` step 0).
- **Read-only by default.** Save, Apply, Generate, Publish, Delete or any persisted action
  needs exact authorization for that action.
- **Login is a mutation.** Prefer an existing session. A fresh login writes
  `LOCAL_LOGIN_SUCCESS` and changes `last_login_at`; it needs explicit authorization and
  disclosure. Without a session and without authorization, report
  `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`.

## Credentials

Read inside the process that uses them; never print, commit, paste into prompts/docs, show in
screenshots/traces/logs, or store in env artifacts or live-state. The credential file wraps
values in markdown backticks — strip them in-process. Unavailable →
`EXTERNALLY_BLOCKED(QA_CREDENTIALS_UNAVAILABLE)`. Never recreate faculty ID `2000056`.

## Evidence to record

- Origin asserted via `window.location.origin`: ATLAS `https://njgrm.buru-degree.ts.net`;
  EnrollPro starts at `https://dev-jegs.buru-degree.ts.net/personnel/login`. One origin never
  proves the other. Localhost only for a labelled isolated check.
- Exact route, accessibility snapshot, console errors, relevant network statuses, viewports
  (`1366x768` and `390x844` for responsive work).
- Rendered truth beats status codes: a 200 with stale or contradictory UI is a finding; a 404
  on latest-run or room-preference-summary can mean "none yet" if the page renders correctly.
