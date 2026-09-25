# Lane A browser acceptance — c5e167d7 incident stop (2026-09-25)

**Outcome: `BLOCKED_UNEXPECTED_MUTATION`; no acceptance verdict.** Deployment QA was already
`ACCEPT_READY 8/8/0/0`. This file records the first post-deployment browser attempt only.

## Observed surface

- Origin: `https://njgrm.buru-degree.ts.net`; route `/timetable`; viewport `1366x768`; seeded Lane A session.
- After the required 15-second session wait, the page rendered `Class Schedule`, active term T2, and the timetable.
- The document and body had no horizontal/vertical overflow (`scrollWidth=1366`, `scrollHeight=768`,
  viewport `1366x768`); the main region was contained. This is partial evidence only, not acceptance.
- R1 rendered-size assertions were not completed at both required viewports.

## Incident stop

While loading the page, the client issued:

```text
POST https://njgrm.buru-degree.ts.net/api/v1/room-preferences/collaboration/ticket
status: 201
body: {"schoolId":1,"schoolYearId":10,"runId":318}
response: opaque one-time ticket returned (value intentionally not recorded)
```

The client source requests this ticket automatically from `roomPreferenceCollaboration.ts` before opening the
collaboration WebSocket. Because this was an unexpected write during a read-only acceptance attempt, the browser
was closed and no further browser action was taken. The 390x844 pass, complete pixel row, and no-scrollbar
acceptance remain **UNPERFORMED** pending a separately reviewed decision about this collaboration-ticket behavior.

Two additional console errors were observed and preserved without credentials:

- `GET /enrollpro-api/settings/public` -> 502
- `GET /enrollpro-uploads/55a414b8-4b4c-4de3-8ce8-aa137fdf34a7.png` -> 502

No login, generation, publication, or deliberate UI mutation was performed. The collaboration ticket is the
only observed POST; its one-time value is not recorded here.

## Disposition

- Browser profile/context: closed; Lane A retains custody.
- `E:\ATLAS-runtime-supervised-c5e167d7-20260925`: `KEEP_ACTIVE` (verified live release).
- `E:\ATLAS-runtime-supervised-ad8f9717-20260925`: `PRESERVE_FOR_DECISION` (rollback basis).
- Next safe action: review the collaboration-ticket contract and decide whether a ticket-issuing read-only route
  is an allowed browser prerequisite or must be changed/disabled before a fresh acceptance attempt.
