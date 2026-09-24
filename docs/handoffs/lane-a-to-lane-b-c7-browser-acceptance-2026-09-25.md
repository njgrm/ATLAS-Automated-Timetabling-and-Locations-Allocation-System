# Lane A → Lane B (Codex): C7 live browser acceptance (2026-09-25)

You are the **named acceptance owner** (AGENTS §12/§13) for the deployed release below. This is the
only remaining obligation of the `TEACHER-CONCERN-AUTHORITY-PROGRAM-20260924` cycle C7.

## Target

- **Release `066da7a7`** at `E:\ATLAS-runtime-supervised-066da7a7-20260925` — **LIVE** since 2026-09-25.
- Origin: `https://njgrm.buru-degree.ts.net` (assert `window.location.origin`). Listeners 5001→78160
  (server) / 5174→74512 (host). Rollback basis: `37e0c85b`.
- Migration `20260925000002_faculty_availability` applied (`MIGRATE_GATE_OK`, count 10→11). Pre-action
  review 6/6/0/0; post-action QA `ACCEPT_READY` 8/8/0/0. Packet:
  `docs/prompts/c7-teacher-concern-deploy-2026-09-25.md`.
- This acceptance supersedes the earlier `PARTIAL (AUTH_SESSION_REQUIRED)` rows for `37e0c85b`,
  `a5f7384e` and `002c8879` — their surfaces are carried by this release.

## Session

- Reuse the operator-seeded "remember me" session in Codex's browser profile. If there is none, report
  `NEEDS_SESSION(lane-b/<profile>)` in one line and continue with the rows that do not need it — do not
  mark the whole acceptance blocked.
- QA-account `LOCAL_LOGIN_SUCCESS` rows / `last_login_at` changes are expected, no authorization needed.
  Self-login is allowed if your tool rules permit it (credential file values are backtick-wrapped — strip
  in-process). **Never print a credential value; never recreate faculty ID `2000056`.**

## Acceptance rows (record each at `1366x768` and `390x844` as applicable)

- **(a) D6 teacher-portal removal.** `/my/schedule`, `/my/preferences`, `/my/room-preferences` are
  unreachable (no route; a direct URL does not render the portal), the sidebar nav and the mobile
  bottom-nav expose no entry for them, and no in-app link reaches them (check the mobile bottom nav at
  `390x844` in particular). `/my` (dashboard), `/faculty/preferences` and `/faculty/room-preferences`
  must still work.
- **(b) Scheduler concern workspace `/faculty/concerns`.** Reachable from the timetable More menu and its
  nav entry. Load a teacher's availability, paint a slot, save the draft, submit, and review. With an
  unresolved school/term scope the write controls are disabled and it fails closed. Allowed mutation:
  records on test data.
- **(c) Drift + regenerate.** On the timetable, the run input drift shows **all seven** domains
  (including `availability` and `derivedDemand`); the explicit **"Regenerate to apply"** affordance is
  present only for a non-published run, states its impact, preserves valid draft placements, and
  **never auto-regenerates a published run**.
- **(d) READ-ONLY — published surface + effective identity.** The published schedule renders correctly
  (no regression) and no non-effective identity override is applied. **Do not** create or withdraw a
  revision (HIGH).
- **(e) Availability effect.** After an approved availability change from row (b), the run drift marks
  the `availability` domain changed. **Do not generate.**

## Allowed / forbidden

- **Allowed** when a row needs it: save, apply, toggle, upload, download, form submission on test
  records — record each one in the evidence.
- **HIGH under AGENTS §13** (covered by the standing authorization *with its gates*): generation,
  publication, deletion, anything that changes the published run/revision, and account/role/SSO changes.
  Do not perform these.
- **One agent per browser profile at a time**; name the profile in the evidence.

## Evidence and where the result goes

- Record: the asserted origin, the exact route, an accessibility snapshot, console errors, relevant
  network statuses, and the tested viewports. Rendered truth beats status codes (a 200 with stale or
  contradictory UI is a finding).
- Return a tally: `passed / blocked / unperformed / NEEDS_SESSION`.
- **Record the result in the `## Live release` block of `docs/plans/live-state.md`** (§13): mark
  `066da7a7` acceptance `COMPLETE` with the tally, or list the blocked rows and why. Clean up
  (logout, close tabs) when done.
