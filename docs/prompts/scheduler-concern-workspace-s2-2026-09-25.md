# S2 — SCHEDULER CONCERN WORKSPACE (client) + D6 packet (2026-09-25)

Program: `docs/plans/teacher-concern-authority-plan-2026-09-24.md` — stream **S2**, decisions **D6** (and
the concern-workspace surface), cycle **C6** (lane A of two; parallel with S4-client). Read the plan doc,
`docs/reference/agent-verification-gates.md`, and `docs/reference/agent-live-browser-qa.md` before editing.

- Base SHA: `48100126fe26f4a53365e3e8ad41039a5e739fa9`
- Worktree / branch (single writer): `E:/ATLAS-worktrees/scheduler-concern-s2` / `work/scheduler-concern-s2`
- Tier: **MEDIUM UI**. Source and focused tests only. No deployment, generation, publication, login, or
  live-data action; `published-schedule`/server files are not yours.

## 1. Objective

(a) Give the **scheduler** one concern workspace that records a teacher's availability grid, notes and
room requests, reviews/approves them through the integrated S1 authority, and shows the effect via the
run's input-freshness drift — reachable from the timetable and its own nav entry. (b) **D6:** remove the
ATLAS teacher portal (`/my/schedule`, `/my/preferences`, `/my/room-preferences`) and their nav/bottom-nav
entries, repoint or remove every in-app link to them, and delete the dead notification deep links
(`/preferences`, `/rooms`). SMART is view-only for teachers; the scheduler-side `/faculty/preferences`
review surface **stays**.

## 2. Owned paths (edit only these)

- `atlas-client/src/App.tsx` — remove the three `my/*` route registrations; add the concern-workspace route
- `atlas-client/src/pages/**` — new concern-workspace page; delete the now-unreferenced `MySchedule`,
  `FacultyPreferences`, `FacultyRoomPreferences` page components (keep `OfficerPreferences` /
  `OfficerRoomPreferences` / `MyDashboard` and the `/faculty/*` routes)
- `atlas-client/src/components/faculty-shared/**` — reuse/repair `AvailabilityPicker.tsx` (currently zero
  importers) and add concern-workspace components
- `atlas-client/src/components/app-shell/navigation.ts` and `FacultyMobileBottomNav.tsx` — nav removal
- `atlas-client/src/components/faculty-dashboard/ActionQueue.tsx`, `DesktopDashboardLayout.tsx`,
  `MobileDashboardLayout.tsx` — repoint/remove links to `/my/*`
- `atlas-client/src/components/timetable/simple/SimpleMoreMenuContent.tsx` — concern entry point
- `atlas-client/src/hooks/useNotificationInbox.ts` — remove the `/preferences` and `/rooms` deep links
- `atlas-client/src/lib/auth.ts` — remove `/my/room-preferences` from the faculty route list
- `atlas-client/src/types.ts` — additive types only (never reorder/remove existing)
- `atlas-client/package.json` — add only your own `test:scheduler-concern` line
- tests: new concern-workspace suite + additive updates to `lib/__tests__/scheduler-navigation-c01.test.ts`
  and `components/__tests__/ux-r03d-outlet-keying.test.ts`

## 3. Acceptance rows

1. **D6 removal:** the three `my/*` routes, their nav and bottom-nav entries, and every in-app link are
   gone or repointed; no dangling `/my/schedule|/my/preferences|/my/room-preferences` reference remains
   outside historical tests; `/faculty/preferences` and `/faculty/room-preferences` (scheduler review) and
   `/my` are intact. `useNotificationInbox` no longer emits `/preferences` or `/rooms`.
2. **Concern workspace:** a scheduler can open it from the timetable More menu **and** a nav entry, load a
   teacher's current availability via `GET /api/v1/faculty-availability/:schoolId/:schoolYearId/faculty/:facultyId`,
   edit a grid (`AvailabilityPicker`), add notes and room requests, `PUT` as draft, `POST .../submit`, and
   (as reviewer) `PATCH .../review` — exercising the real client API functions, not fixtures only.
3. **Effect visibility:** after a change, the surface renders the run's `availability` drift status using
   the shared `describeRunInputDrift` (import it read-only from
   `components/timetable/timetableDriftRouting.ts` — **do not edit that file**, it is S4-client's) and routes
   to the regenerate/revision paths. If the seven-domain mapping is a hard dependency, state it in the
   handoff; do not fork a second mapping.
4. **Authority:** no client-side school defaulting; the actor school/year come from the session; missing
   scope fails closed (no `?? 1`).
5. **Frontend constraints (AGENTS §8):** no-scroll architecture preserved; no raw `<details>`/`title`/native
   `<select>`; `@/ui` primitives; every touched React component file ≤ 1000 physical lines (the B5 metric).
6. **Tests:** new suite registered as `test:scheduler-concern`; `test:client-suite` and
   `gate-reachability` green; existing assertions updated additively only.

## 4. Do NOT touch

- S4-client files: `components/timetable/timetableDriftRouting.ts`, `simple/SimpleDriftBanner.tsx`,
  `PublishedRevisionDialog.tsx`, `TimetableSimpleHeader.tsx`, `lib/published-revision-client.ts`.
- Any `components/timetable/simple/**` file other than `SimpleMoreMenuContent.tsx`.
- Any `atlas-server/**` file; `docs/plans/**`; `CHANGELOG.md`; other worktrees; runtime dirs; `D:\ATLAS`.
- The other C5/S8 lanes' files. No deployment, generation, publication, or live-data action.

## 5. Evidence

Commit only the owned paths on `work/scheduler-concern-s2`. Do not push; do not touch `main`. If you
approach your step limit, commit a coherent candidate and report its exact state. Handoff: base SHA ·
candidate SHA · changed paths · what changed and why · decisive commands with results · the D6
greppable no-dangling-link proof · each risk `BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`. Then a
fresh independent `atlas-qa` reviews the immutable range, and only then does the planner integrate.
`atlas-client/src/types.ts` and `atlas-client/package.json` are shared with S4-client and are resolved by
union at integration — keep edits additive and small.
