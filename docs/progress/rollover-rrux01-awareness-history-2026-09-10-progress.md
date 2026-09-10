# RR-UX01 Progress — Rollover Awareness and Historical Teaching Load

- Governing prompt: `docs/prompts/rollover-rrux01-awareness-history-2026-09-10.md`
- Worktree: `C:\Users\njgro\.codex\worktrees\992e\ATLAS`
- Branch: `work/rollover-rrux01`
- Base: `00488bbf0a9b9ac377036ae81f4f6504813939a0`
- Risk: `MEDIUM` source/UI; no live mutation
- Status: `REVIEW_REQUIRED`

## Tasks

- [x] Actor-school-scoped rollover notification delivery and client rebinding.
- [x] Durable rollover awareness plus focus/visibility/online/reconnect recovery.
- [x] Year Setup consolidation and archived-year links into Teaching Load history.
- [x] ATLAS-owned, read-only Teaching Load history service/router and UI (GET only).
- [x] Focused tests, typechecks, builds, isolated runtime startup, browser QA, zero-write proof.
- [ ] Formal independent planner/QA review.

## Implementation summary

- `notification-events.service.ts`: added a `school`-scoped subscriber that only
  receives `PRIVILEGED` `integration` events, plus school-scoped replay. Year-scoped
  delivery is unchanged and exact.
- `notification.router.ts`: new privileged `GET /api/v1/notifications/:schoolId/events`
  with actor-school enforcement (401 no token, 403 non-privileged, 403 missing school
  scope, 403 cross-school, 400 invalid param). The year stream now also enforces actor
  school scope.
- `useNotificationStream.ts`: subscribes to both the active-year and school-level
  scopes, dedupes deliveries by `schoolId:eventId`, and exposes pure
  `isRolloverCompletionEvent`, `parseSseFrames`, and `createEventDeduper` helpers.
- `AppShell.tsx`: derives actor school from the session (no fallback), on rollover
  completion invalidates only that school's cache, force-verifies upstream, and only
  when `evaluateRolloverTransition` reports a real year change persists the notice,
  rebinds the year subscription, and remounts the route once. Focus/visibility/online
  handlers re-verify to recover missed events.
- `rollover-awareness.ts`: school-scoped durable notice plus the pure transition gate.
- `enrollpro-public-settings.ts`: runtime-year cache and in-flight dedup are keyed by
  school; `invalidateActiveSchoolYearContext(schoolId)` is school-scoped.
- `AdminYearSetup.tsx` / `RolloverResetPanel.tsx`: one `RolloverGuidanceCard` status
  card (single status request) plus archived-year links; the destructive reset is
  demoted behind an advanced `aria-expanded` disclosure rendered only for
  `canResetDummyYear`.
- `TeachingLoadHistoryView.tsx` + `TeachingLoadRoute` (App.tsx): read-only archived view
  reachable at `/teaching-load/history` and `/teaching-load?view=history`.
- `teaching-load-history.service.ts` / `.router.ts`: ATLAS-owned, same-school archived
  years and preserved assignments, privileged + authenticated, GET only, no EnrollPro.

## Evidence

- Client tests: `tsx --test` on `rollover-awareness`, `rollover-notification`,
  `active-school-year-scope`, `rollover-ui-guardrails` → 15 tests pass.
- Server test: `tsx src/__tests__/rr-ux01-rollover-history.test.ts` → PASS
  (event scoping, cross-school/faculty rejection, missed-event replay, mounted history
  actor/school/year scoping, archived-year guards, and zero injected writes).
- Regression: `tsx src/__tests__/teaching-load-write-authority.test.ts` → PASS
  (GEN-owned zero-write authority intact; no GEN path edited).
- TypeScript: `atlas-server` and `atlas-client` `tsc --noEmit` → exit 0.
- Builds: `atlas-server` `tsc` and `atlas-client` `vite build` → exit 0.
- Isolated runtime: built `dist/server.js` started with `ROLLOVER_AUTO_SYNC_ENABLED=false`
  and an unreachable `DATABASE_URL`; `/api/v1/health` → `200 {"status":"ok","service":"atlas"}`,
  process stayed alive, no live data touched.
- Hermetic Playwright QA: 52/52 checks at 1280x720, 390x844, and 200% reflow (640x360);
  no horizontal overflow, no mojibake, read-only history (no mutation controls), one
  Year Setup status card, reset hidden for real data and revealed only behind the
  advanced disclosure for dummy data, **zero POST/PUT/PATCH/DELETE requests**.
- `git diff --check 00488bbf...HEAD` clean.

## Sensitivity controls

- Old-year school-year replay does not surface the new-year rollover (prior stale
  session would not refresh); the school-level stream does.
- A stale cached runtime year is served until `invalidateActiveSchoolYearContext`
  removes it; invalidation is school-scoped and never writes a school-1 default key.
- `evaluateRolloverTransition` returns no change for the first verified read or a
  duplicate event, and fires once for a genuine year change.

## Boundaries held

- GEN-owned paths (`faculty-assignment.router/service`, `generation.service`,
  `teaching-load-automation`, `teaching-load-suggestion-proposal`, their tests,
  and the GEN progress record) untouched.
- No TERM, external repository, live data, generation, publication, migration,
  rollover, reset, or Teaching Load apply/carry-forward action performed.
- Hermetic/disposable fixtures only; no carry-forward implemented.

## Remaining risks

- `resolveActiveSchoolYearContext` still defaults to school 1 for legacy callers
  outside this wave; the changed awareness path, Teaching Load, Year Setup, and the
  new history/notification routes never omit the actor school.
- The optional `?view=history` alias is additive; existing links use
  `/teaching-load/history`.
- Formal independent planner/QA review remains required before integration.
