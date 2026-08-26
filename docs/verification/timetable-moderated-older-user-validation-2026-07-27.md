# Timetable Moderated Older-User Validation - 2026-07-27

## Status

`Pending participant evidence`

This document is the executable validation script for moving the timetable page from `Technical GO` to `Product GO` for older non-technical scheduler users.

## Participant Profile

Use at least `5` participants who resemble the target operator profile:

- scheduler officer, school registrar, department head, or admin assistant;
- comfortable with basic web browsing;
- not expected to understand scheduling-engine terms;
- at least `2` participants should be older or low-technical-confidence users.

## Setup

Environment:

- `https://njgrm.buru-degree.ts.net`

Role:

- Admin/scheduler account.

Preflight:

```powershell
cd D:\ATLAS
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-tailnet-preflight.spec.ts --project=desktop --workers=1
```

Moderator rules:

- Do not explain where controls are before a task starts.
- Do not use engineering terms.
- Ask the participant to think aloud.
- Help only if the participant is stuck for more than `90` seconds.
- Record exact confusion phrases.

## Tasks

| Task | Prompt To Participant | Pass Condition |
|---|---|---|
| 1 | "Look at this page. Is the schedule ready, or does it still need work?" | Participant uses the Simple header/readiness chip or next-step prompt to answer. |
| 2 | "Start placing sessions that are not yet scheduled." | Participant opens the unresolved-session drawer. |
| 3 | "What does a green slot mean?" | Participant answers that it can be placed or is safe to use. |
| 4 | "What does a blocked slot mean?" | Participant answers that it cannot be used until the issue is fixed. |
| 5 | "Choose one unresolved session and start placing it, but do not save." | Participant opens the review sheet and stops before saving. |
| 6 | "Cancel safely and return to the timetable." | Participant closes the review without committing. |
| 7 | "Start switching two sessions." | Participant opens swap guidance or selects two occupied sessions and sees the swap review. |
| 8 | "Find the advanced tools." | Participant opens Advanced view. |
| 9 | "Return to the simple view." | Participant returns to Simple view. |

## Scoring

| Metric | Product GO Threshold |
|---|---|
| Tasks 1-6 completed without direct coaching | `>= 80%` of participants |
| Task 9 completed after being told Advanced exists | `100%` of participants |
| Participant thinks timetable is where teachers are assigned | `0` participants |
| Participant requires drag instead of click/tap to proceed | `0` participants |
| Participant says page is too crowded to know where to start | `<= 1` participant |

## Observation Sheet

Create one copy per participant:

```markdown
## Participant [ID]

- Date:
- Role/profile:
- Device:
- Browser:

| Task | Result | Time | Notes |
|---|---|---:|---|
| 1 | Pass / Coach / Fail | | |
| 2 | Pass / Coach / Fail | | |
| 3 | Pass / Coach / Fail | | |
| 4 | Pass / Coach / Fail | | |
| 5 | Pass / Coach / Fail | | |
| 6 | Pass / Coach / Fail | | |
| 7 | Pass / Coach / Fail | | |
| 8 | Pass / Coach / Fail | | |
| 9 | Pass / Coach / Fail | | |

Confusing words or labels:

- 

Crowding or visual-overload comments:

- 

Must-fix issue:

- Yes / No
- Details:
```

## Product GO Decision

After sessions are complete:

- If every scoring threshold passes, mark timetable `Product GO`.
- If any scoring threshold fails, convert the issue into an implementation task before final release.
- If stakeholders accept deferring this test, record the decision in `docs/verification/evidence-log.md` and keep the timetable at `Technical GO / Product validation deferred`.

