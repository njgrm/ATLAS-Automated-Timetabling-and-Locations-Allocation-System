# A3 c15 — item 45: rename the one teacher page to "Teacher Preferences"

Authority: `docs/prompts/fix-3-2026-09-29.md` (Lane C, 15:10 + 15:55 addendum), row **#45**.
Worktree: `E:/ATLAS-worktrees/lane-a3-c15-20260929` · branch `work/a3-c15-teacher-preferences` ·
base `8a550b26151a7b0e09e801615b61e38f758c78ce` (`origin/main` at packet authoring).
Risk: MEDIUM (route-target change; client only). Owner: this worktree only.

## Intent (design gate, AGENTS.md "Design judgement gate")

The user is an older, mouse-first scheduler. They asked for one word: the page called **Teacher Concerns**
is now called **Teacher Preferences**. What must feel different: the sidebar, the breadcrumb, the page title
and every link that names it all say the same new name, and the old name appears **nowhere a scheduler can read it**.
This is a rename, so **subtract, never add**: no new chips, banners, sentences or controls. Nothing on the page may
grow. One destination, one name (AGENTS.md §8; `a2-c13-one-place-name`).

## 1. Route: `/faculty/preferences` is now the real page

`atlas-client/src/App.tsx`:
- line ~272-274: `path: 'faculty/preferences'` → change `element: <OfficerPreferences />` to `<TeacherConcerns />`.
- line ~276-278: keep the existing lazy import named `TeacherConcerns` (line 23). Change
  `path: 'faculty/concerns'` → `path: 'faculty/concerns'` with `element: <TeacherConcernsAlias />`.
- Add ONE new file `atlas-client/src/pages/TeacherConcernsAlias.tsx`, default-exporting a component that renders
  exactly `<Navigate to='/faculty/preferences' replace />`, with a 3-line comment saying `/faculty/concerns` is the
  retired alias and the consolidated page is Teacher Preferences. (Do **not** repurpose `OfficerPreferences` for this —
  its own header comment records a real history; adding one 6-line alias file is less churn.)

`atlas-client/src/pages/OfficerPreferences.tsx` and `OfficerRoomPreferences.tsx`:
- line ~16 / ~22: `<Navigate to='/faculty/concerns' replace />` → `<Navigate to='/faculty/preferences' replace />`.
- Their header comments: "folded into Teacher Concerns" → "folded into Teacher Preferences". Nothing else changes.

`atlas-client/src/components/app-shell/navigation.ts`:
- line 86: `{ label: 'Teacher Preferences', to: '/faculty/preferences', icon: HeartHandshake, adminOnly: true, schedulerAccess: true }`
- line 163 stays the `/faculty/preferences` key with `title: 'Teacher Preferences'`.
- line 208 (`/faculty/preferences`) → `title: 'Teacher Preferences'` (it is now the real route).
- line 209 (`/faculty/room-preferences`) → `title: 'Teacher Preferences'`.
- ADD a chrome entry for `'/faculty/concerns'` with `title: 'Teacher Preferences'` so the retired deep link shows
  truthful chrome for the instant before its redirect.
- Icon `HeartHandshake` stays (do not churn the visual identity).
- Comments at lines 53, 55, 200: say "Teacher Preferences".

## 2. Visible wording that means preferences

| File | Line | Change |
|---|---|---|
| `pages/TeacherConcerns.tsx` | 496 | `title='Teacher Concerns'` → `title='Teacher Preferences'` |
| `pages/TeacherConcerns.tsx` | 422 | `'This teacher\'s concerns were not saved.'` → `'This teacher\'s preferences were not saved.'` |
| `pages/TeacherConcerns.tsx` | 558 | `'…no teacher concern can be loaded or written.'` → `'…no teacher preferences can be loaded or saved.'` |
| `pages/TeacherConcerns.tsx` | 584 | `'…ATLAS will not record a concern until an ordered term is verified.'` → `'…ATLAS will not save this teacher\'s preferences until an ordered term is verified.'` |
| `components/timetable/simple/SimpleMoreMenuContent.tsx` | 409 | `Teacher concerns` → `Teacher preferences` |
| `components/timetable/ScheduleReviewWorkspaceHeader.tsx` | 697 | tooltip `…teacher's concerns — when they can teach…` → `…teacher's preferences — when they can teach…` |
| `components/timetable/timetableDriftRouting.ts` | 89 | `href: '/faculty/concerns'` → `'/faculty/preferences'` (label `Teacher availability` is domain language — leave it) |
| `components/faculty-dashboard/ActionQueue.tsx` | 115 | `'…The scheduler records and reviews concerns for you.'` → `'…The scheduler records and reviews preferences for you.'` |
| `lib/active-term-authority.ts` | 63-64, and `pages/Dashboard.tsx` | 514-515 | comments only: `TeacherConcerns` → `Teacher Preferences` |

**Keep** `ScheduleReviewWorkspaceHeader.tsx:691` label text "Teachers you have talked to" (line 693) — it is a calmer
phrase than the page name and contains no "concern". Only its `href` (691) and tooltip (697) change. Say so in the
handoff.

`ScheduleReviewWorkspaceHeader.tsx:691` href `/faculty/concerns` → `/faculty/preferences`;
`SimpleMoreMenuContent.tsx:407` href `/faculty/concerns` → `/faculty/preferences`.

Then sweep for anything left: `grep -rn "concern" atlas-client/src --include=*.ts --include=*.tsx` and confirm every
remaining hit is a comment, an identifier, a `data-testid`, a persisted string constant, or a test file — and list the
categories in the handoff.

## 3. DO NOT rename (BLOCKING if changed)

- `teacher-concern-helpers.ts:12-13` — `CONCERN_NOTES_HEADING = 'Notes for the scheduler'` and
  `CONCERN_ROOM_REQUESTS_HEADING = 'Room requests'` are a **persisted wire format** inside the frozen `notes`
  column. Renaming either value breaks parsing of every already-saved teacher record. Values stay byte-identical.
- No file renames. No exported identifier/type/helper renames (`fetchConcernFaculty`, `ConcernRoomDraft`,
  `FacultyConcernReviewDecision`, `describeSavedConcern`, …), no API path changes, no server files, no Prisma.
- No `data-testid` renames (`teacher-concerns-header`, `concern-*`, `timetable-teacher-concerns-link`,
  `timetable-more-teacher-concerns`). They are stable test hooks, not user-visible.
- No new chip, banner, sentence or control anywhere. The visible word count must not grow.

## 4. Tests — update ON PURPOSE, name every file in the handoff

These assert the old label/route in source text and **must** be updated to the new truth (do not delete an
assertion to make it pass; rewrite it, and add rather than remove):
- `src/lib/__tests__/a2-c13-one-place-name.test.tsx:43` → `['Teacher Preferences', '/faculty/preferences']`
- `src/lib/__tests__/scheduler-navigation-c01.test.ts:10,25` (scheduler path list)
- `src/lib/__tests__/ux-r01-shared-chrome.test.tsx:29` (route list)
- `src/components/__tests__/ux-r03d-outlet-keying.test.ts:52` (non-timetable surface list)
- `src/components/__tests__/a3-c6-reachable-route-hygiene.test.tsx:229`
- `src/components/faculty-shared/__tests__/scheduler-concern-s2.test.ts` (route pattern ~96, nav entry 116-119,
  chrome 123-126; keep the file name and the `npm run test:scheduler-concern` script entry)
- `src/components/faculty-shared/__tests__/a3-c6-concerns-truthfulness.test.tsx` (`CONCERN_ROUTE` constant and
  every route literal)
- `src/components/app-shell/__tests__/a3-c8-room-preferences-reachability.test.tsx` (`CONCERNS_ROUTE`, `CONCERNS_LABEL`,
  and the `<Navigate … replace />` assertions at ~440-455)
- `src/lib/__tests__/timetable-dynamic-workspace-drift.test.ts:79,91,92,100`
- `src/lib/__tests__/timetable-dynamic-workspace-rendered.test.ts:144,146`

**Add (additive, never subtractive)** in the file that already owns folded-route redirects
(`src/components/app-shell/__tests__/a3-c8-room-preferences-reachability.test.tsx`):
1. `/faculty/preferences` is the mounted page route (not a redirect), `/faculty/concerns` redirects to it with
   `replace`, and `/faculty/room-preferences` still redirects with `replace`.
2. Exactly ONE sidebar item points at `/faculty/preferences` and its label is `Teacher Preferences`; no sidebar item
   points at `/faculty/concerns` or `/faculty/room-preferences`.
3. No user-visible string on the page, in the More menu, in the timetable header link or in the drift card says
   "concern" or "Concern" (case-insensitive) — with `CONCERN_NOTES_HEADING`/`CONCERN_ROOM_REQUESTS_HEADING`
   explicitly excepted, since they are persisted data, not copy.

Do **not** change: `lib/__tests__/a3-c8-warning-token.test.ts:90`, `lib/__tests__/a5-c2a-term-truth.test.ts`
(it names the file `TeacherConcerns.tsx`, which is not being renamed) — those hits are identifiers.

## 5. Gates — run literally, record the commands and the tallies

```
cd atlas-client
npm run typecheck
npm run build
npm run test:scheduler-concern
npm run test:a3-c6-concerns
npm run test:a3-c6-route-hygiene
npm run test:a3-c8-room-preach
npm run test:ux-a2-c13-calm-loading
npm run test:timetable-route-keys
npm run test:publish-drift-revision-s4-client
npm run test:timetable-ux-rehaul
npm run test:scheduler-collaboration
npm run test:client-suite
```
All must be green. `test:client-suite` is the long one — if it can exceed 10 minutes, run it through
`scripts/dev/start-detached.ps1` with a log and poll, never as a foreground call.

## 6. Rendered proof (done means seen) — 1366x768, REAL staging data

Never read, cat or navigate to `D:\ATLAS-runtime-config\atlas-staging-qa.env`. Never run a relay or token server.
Never point a preview at live (`:5001` / `:5174`).

```
cd E:/ATLAS-worktrees/lane-a3-c15-20260929
powershell -File scripts/dev/start-preview.ps1 -ClientDir <this worktree> -Port 5261
```
Then drive the Playwright MCP at `http://127.0.0.1:5261/__dev/staging-login` (the dev server signs in to STAGING
server-side and redirects to `/`). If that route 404s, `git merge origin/main` and restart — no other fix. If login
fails, run `node scripts/dev/ensure-staging-qa-account.cjs` once. Set the viewport to 1366x768 and capture:
1. Sidebar → "Teacher Preferences" (one item, under Teachers and Rooms).
2. `/faculty/preferences` renders the page: title **Teacher Preferences**, breadcrumb **Teachers and Rooms › Teacher
   Preferences**, with REAL teacher names/availability from staging (say whose data you saw).
3. Deep link `http://127.0.0.1:5261/faculty/concerns` → lands on `/faculty/preferences` (redirect), same content.
4. `/timetable` → `More` menu row reads "Teacher preferences"; the header button "Teachers you have talked to"
   navigates to `/faculty/preferences`; its tooltip mentions preferences.
5. Clickable-looks-clickable judgement: the sidebar item, the More row and the header button all read as buttons or
   links (visible shape, chevron or verb, hover/focus), and nothing read-only looks pressable.
6. No console error and no error boundary on `/faculty/preferences` or `/timetable`.
Screenshots to `docs/reviews/a3-c15-teacher-preferences-20260929/`. Quote before/after text for the rename.

## 7. Return

Base `8a550b26` · candidate SHA · exact changed paths · what changed and why · the decisive commands with their
tallies · the test files you rewrote and why, one line each · the sweep categories (§2) · known risks marked
`BLOCKING`/`NON_BLOCKING` · screenshot paths. Worktree disposition: `RETIRE_AFTER_INTEGRATION`.
Commit a `wip(...)` checkpoint every 30 minutes and push the branch. Conventional commit: `fix(faculty): …`.
