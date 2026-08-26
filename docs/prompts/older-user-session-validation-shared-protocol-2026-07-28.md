# ATLAS Older-User Session Validation — Shared Protocol

Use this protocol for both the Codex self-audit and the independent Antigravity audit. The purpose is to determine whether the simplified ATLAS setup/timetable experience is genuinely easier for older, non-technical schedulers without quietly removing the useful capabilities of the former cockpit.

## Evidence rules

- Target the live Tailnet: `https://njgrm.buru-degree.ts.net`.
- Use Admin QA only: `1000001` / `AdminSY2026!`.
- Do not mutate production timetable data. Use read-only interactions, cancelled dialogs, or a reversible fixture explicitly labelled as disposable.
- Separate evidence into `human participant`, `browser proxy`, `static code`, and `inference`.
- Never claim Product GO from automated browser evidence alone.
- Record exact wording that caused hesitation; do not translate participant language into engineering jargon.

## Surfaces and viewports

Audit these surfaces:

1. `/` Dashboard readiness hub.
2. `/sections`.
3. `/subjects`.
4. `/teachers`.
5. `/teaching-load`.
6. `/map` Campus and Rooms.
7. `/timetable` Simple view, then Advanced view.

Run each critical task on desktop, mobile portrait, and mobile landscape. For a real moderated session, use the participant’s normal device and record the viewport.

## Critical task script

Score every task as `Independent`, `One hint`, `Coached`, or `Failed`, with time to completion.

| ID | Neutral participant prompt | Pass condition |
|---|---|---|
| T01 | “Is this school setup ready to continue? What would you fix first?” | Participant finds Dashboard readiness and names the first incomplete repair step. |
| T02 | “Find the class sections for this school year.” | Participant reaches Sections without moderator navigation. |
| T03 | “Find a subject that still needs attention.” | Participant uses the visible status/search/filter language. |
| T04 | “Find which teachers still need teaching-load work.” | Participant reaches Teachers or Teaching Load and identifies the repair path. |
| T05 | “Check whether rooms are ready for scheduling.” | Participant finds the Room readiness list before interpreting the map. |
| T06 | “Look at the timetable and tell me what should happen next.” | Participant identifies the Simple view next action within 10 seconds. |
| T07 | “Find a session that is not placed yet.” | Participant opens the unresolved/unassigned workflow. |
| T08 | “Start placing one session, but do not save it.” | Participant reaches the review sheet and understands where to cancel. |
| T09 | “What do Can place, Can swap, Blocked, Warning, Occupied, and Current mean?” | Participant explains each state without relying on color alone. |
| T10 | “Switch two occupied sessions, but stop before saving.” | Participant reaches the modern visual swap review, with no teacher-assignment detour. |
| T11 | “Find the advanced tools, then return to the simple view.” | Participant completes both reversible mode transitions. |
| T12 | “You changed your mind. Leave safely without saving.” | Participant cancels/backtracks and returns to a stable timetable state. |

## Cockpit parity check

The simplified UI passes only if it preserves the former cockpit’s useful outcomes:

- Find readiness blockers.
- Inspect unresolved sessions.
- Preview placement and swap outcomes.
- Read grid-wide conflict guidance.
- Cancel risky actions.
- Reach advanced controls when needed.
- Preserve teacher ownership in Teaching Load rather than reintroducing timetable teacher assignment.

If a task is faster because the capability was removed, mark it `Regression — capability removed`, not a UX improvement.

## Older-user quality criteria

- First useful action is identifiable within 10 seconds.
- At least 80% of T01–T08 and T12 are completed independently or with one hint by each participant.
- No participant needs browser page scrolling to reach primary work on normal viewports.
- No participant believes timetable placement is where teachers are assigned.
- No participant must drag when click/tap offers an equivalent path.
- At least 90% correctly interpret all six grid status labels.
- No critical action is communicated by color alone.
- Primary touch targets are at least 44 CSS px where ATLAS marks them as task controls; all interactive targets meet at least WCAG 2.2’s 24 CSS px minimum unless an adjacent target provides the same operation.
- Dialogs move focus inside, keep focus contained, support Escape/cancel, and return focus to the invoking control.
- Disclosures expose `aria-expanded` and, where useful, `aria-controls`.
- Visible focus remains clear at keyboard navigation and 200% zoom.

## Findings format

```markdown
### OUSER-[NNN] — [short finding]
- Surface:
- Task(s):
- Evidence type: Human / Browser proxy / Static / Inference
- Severity: Blocker / High / Medium / Low
- Result: Independent / One hint / Coached / Failed
- Time:
- Exact participant wording or observed UI:
- Expected:
- Actual:
- Cockpit capability preserved?: Yes / No / Unclear
- Root cause or likely cause:
- Recommended fix:
- Regression test needed:
```

## Decision

- `Product GO`: all thresholds pass and no capability-preservation regression exists.
- `GO WITH FIXES`: no blocker, but one or more medium findings require a bounded follow-up.
- `NO-GO`: any critical task is failed by most participants, a core cockpit capability is removed, or a participant cannot safely cancel a risky action.

Authoritative interaction references used for this protocol: W3C [Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/), W3C [Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), and the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/).
