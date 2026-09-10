# Timetable operator-readiness audit — 2026-09-11

## Outcome

The live Tailnet Timetable is not yet suitable for an older scheduler without
guidance. The integrated TT-C04 work improves lifecycle wording, and candidate
`aa38d784` closes several visible no-run defects, but the candidate still has
material split-brain controls and a superseded repair destination. It must not
be integrated until TT-UX01R is accepted.

This audit is read-only. No draft, generation, save, publication, or database
mutation was triggered.

## Environment truth

- Live route: `https://njgrm.buru-degree.ts.net/timetable`.
- Actor scope observed: school 1.
- Active year observed: year 9 / 2030-2031.
- Live state observed: no current-year run and no published schedule.
- Live client divergence: the Tailnet page served the older `D:/ATLAS` tree at
  `f6c86e06`, while reviewed source was based on `origin/main` at `aab8fb00`.
- Candidate reviewed: `aab8fb00...aa38d784` on
  `D:/ATLAS-worktrees/timetable-ux-01`.

## Click-path findings

| ID | Severity | Surface | Finding | Candidate state |
|---|---|---|---|---|
| TTX-01 | HIGH | No-run repair | The primary action and dispatcher still point to `/curriculum-requirements`, which is not the mounted route (`/subjects/requirements`) and is also the superseded operator workflow. A blocked operator can be sent to a dead or obsolete process. | OPEN |
| TTX-02 | HIGH | Advanced generation | Advanced `Generate` and `Regenerate Draft` call the generation trigger with drift/year checks only. They do not consume the same actor-scope and setup-readiness decision used by Simple mode. | OPEN |
| TTX-03 | MEDIUM | Advanced no-run state | With no run, Advanced mode still defaults to `Review schedule` and leaves Review, Place, Switch, and Requests task modes usable. This presents run-derived work before a run exists. | OPEN |
| TTX-04 | MEDIUM | Teacher departure | `Teacher leaving / Reassign load` remains enabled with no run and opens a multi-step recovery sheet whose draft/run inputs are null. | OPEN |
| TTX-05 | MEDIUM | Capability model | `runToolsAvailable = hasGeneratedRun || isPreGenerationWorkspace` is too broad. Generated-session actions and pre-generation actions need separate capabilities. | OPEN |
| TTX-06 | MEDIUM | Tutorial | Missing targets now show an error, but the no-run tutorial still leads users through run-only features. The tutorial must be state-aware rather than teaching unavailable controls. | OPEN |
| TTX-07 | LOW | Empty selector | The entity selector is disabled when empty, but its reason is largely encoded as an accessible name. The visible surface should explain why switching is unavailable. | OPEN |
| TTX-08 | HIGH | Live no-run truth | The deployed page showed duplicate draft starts, false clean/fully-placed claims, and `Generated Run #-`. Candidate `aa38d784` corrects these source paths, but the fix is not deployed. | FIXED IN CANDIDATE, PENDING INTEGRATION/DEPLOY |
| TTX-09 | MEDIUM | No-run menu | Live Place, Swap, Review issues, Filters, room requests, and advanced tools were reachable despite no run. Candidate disables only part of this set. | PARTIAL |
| TTX-10 | MEDIUM | Room requests | Live loading emitted duplicate no-active-draft 404s. Candidate gates the read on a completed run and treats no active draft as empty. | FIXED IN CANDIDATE |
| TTX-11 | MEDIUM | Mobile/readability | Live readiness copy was hidden or clipped and compact triggers missed the 44px target. Candidate wraps the copy and fixes the tested mobile targets. | FIXED IN CANDIDATE |
| TTX-12 | MEDIUM | False clean claims | Live violations and unresolved drawers reported a clean/fully-placed schedule with no run. Candidate gates these claims on run existence. | FIXED IN CANDIDATE |
| TTX-13 | LOW | How-it-works | The help page mixes current behavior with future derived-demand and notification promises. It must not claim operational authority that DEMAND-C01 or deployment has not yet supplied. | DEFER CONTENT TRUTH TO DEMAND-C01/UX-C01, KEEP LINK HONEST |

## Candidate verification

- Commit boundary and changed-path inventory matched the executor handoff.
- `npm run test:timetable-operator-ux`: 34/34 pass.
- All 18 tracked client test files: 155/155 pass.
- Client `tsc --noEmit`: pass.
- Client production build: pass.
- `git diff --check aab8fb00...aa38d784`: pass.

The green suites do not cover TTX-01 through TTX-07 above. Several assertions
are source-text pins around the originally enumerated defects, so they cannot
substitute for a complete control-capability audit.

## Required correction boundary

TT-UX01R must keep the existing candidate history, add one correction commit,
and make Simple and Advanced mode consume one fail-closed capability model. It
must not implement DEMAND-C01, call generation, save a draft, publish, restart
the shared runtime, or edit server/Teaching Load/EnrollPro source.
