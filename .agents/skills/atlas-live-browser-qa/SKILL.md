---
name: atlas-live-browser-qa
description: Rules for live browser, UX/UI, responsive, authenticated or cross-app (EnrollPro/SMART/AIMS) evidence on the ATLAS Tailnet origin. Use before driving any browser against ATLAS or a companion app, or before citing browser evidence.
metadata:
  short-description: ATLAS live browser QA sessions, mutations and evidence
---

# ATLAS live browser QA

Authority: `AGENTS.md` §12. Full rules: `docs/reference/agent-live-browser-qa.md` — read it.
The live database is test data; QA exists to produce acceptance.

## Before opening the browser

- **What it can prove.** Live Tailnet evidence proves the *deployed* release only — never
  undeployed source bytes. Confirm the live SHA first (`atlas-deploy` step 0).
- **Profile.** Use your own browser profile; one agent per profile at a time. Name the profile
  in the evidence.
- **Session.** Reuse the operator-seeded "remember me" session in your profile. If your tool
  rules allow entering a password, you may log in with the QA account (credential file values
  are backtick-wrapped — strip in-process). Otherwise, with no session, report
  `NEEDS_SESSION(<agent>/<profile>)` once and continue with the rows that do not need it.
  Login audit rows are expected; no authorization needed.

## During

- Ordinary UI mutations an acceptance row needs are allowed (save, apply, toggle, upload,
  download) — record each one.
- Generation, publication, deletion, published-run changes, and account/role/SSO changes are
  HIGH (`AGENTS.md` §13; covered by the standing authorization with its gates).
- Never put a credential value into a prompt, log, doc, commit, screenshot or transcript.
  Never recreate faculty ID `2000056`.

## Evidence to record

- Origin asserted via `window.location.origin`: ATLAS `https://njgrm.buru-degree.ts.net`;
  EnrollPro starts at `https://dev-jegs.buru-degree.ts.net/personnel/login`. One origin never
  proves the other. Localhost only for a labelled isolated check.
- Exact route, accessibility snapshot, console errors, relevant network statuses, viewports
  (`1366x768` and `390x844` for responsive work).
- Rendered truth beats status codes: a 200 with stale or contradictory UI is a finding; a 404
  on latest-run or room-preference-summary can mean "none yet" if the page renders correctly.
- A tally: passed / blocked / unperformed / `NEEDS_SESSION`.
