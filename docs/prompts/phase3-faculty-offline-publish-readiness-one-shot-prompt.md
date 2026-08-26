# Copilot Execution Prompt: Phase 3 Faculty Offline Publish Readiness One-Shot

## Objective

Complete the biggest remaining paper-alignment gap for the faculty experience:

- ATLAS-owned faculty login that remains valid without EnrollPro at runtime
- PWA/offline baseline for faculty-facing reopening
- faculty published schedule page at `/my/schedule`
- honest degraded/offline behavior with sync recovery when EnrollPro returns

This is not a greenfield auth build.
ATLAS already has local auth and EnrollPro-assisted account provisioning.
This pass must complete and harden that system into a true faculty-facing offline-capable workflow.

## Out of Scope

Do not:

- rebuild the scheduler/admin shell
- reopen Teaching Load truth work
- redesign faculty UX from scratch
- add native mobile app work
- add push notifications unless needed only as a contract placeholder for the new schedule page
- change the existing EnrollPro-to-ATLAS account provisioning ownership model
- implement student/public publish UI in this pass

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-paper-alignment-audit-2026-05-24.md`
- `docs/analysis/phase3-offline-capability-and-outage-ui-audit-2026-05-25.md`
- `docs/progress/objectives-priority-progress-check-2026-05-07.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-server/src/services/local-auth.service.ts`
- `atlas-server/src/routes/auth.router.ts`
- `atlas-client/src/pages/Login.tsx`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/pages/MyPreferences.tsx` or current faculty-preferences page files
- `atlas-client/src/pages/MyRoomPreferences.tsx` or current faculty room-request page files
- current published schedule APIs and related controllers/services
- current PWA/client bootstrap files (`vite`, app entry, manifest/service-worker related files if present)

Use Context7 first if you need version-sensitive guidance for:

- Vite PWA patterns
- service worker caching strategies
- React Router route guards
- Workbox or equivalent PWA runtime guidance if already present in the stack

## Facts To Treat As Settled

- standalone local ATLAS login already exists
- faculty and admin accounts are already provisioned or seeded from EnrollPro-linked data into `AtlasAuthAccount`
- current faculty routes already exist:
  - `/my`
  - `/my/preferences`
  - `/my/room-preferences`
- the missing major faculty-facing surface is `/my/schedule`
- the paper audit already concluded that objective `1.3` is only partially aligned
- the offline audit already concluded that faculty pages still bootstrap through EnrollPro too often
- the next major objective stream is faculty offline publish readiness, not more scheduler-only polish

## Main Problems To Solve

### 1. Faculty auth exists, but the product does not yet feel complete as a standalone faculty portal

What is already real:

- local `/auth/login`
- faculty accounts tied to ATLAS auth
- EnrollPro-assisted account creation/provisioning

What is still missing:

- a completed faculty published schedule destination at `/my/schedule`
- a clean faculty offline/open-from-cache story
- an honest degraded shell and faculty self-service workflow when EnrollPro is unavailable

### 2. Faculty pages are still too dependent on EnrollPro bootstrap

Current faculty-facing pages still rely on:

- `fetchPublicSettings()`
- direct school-year bootstrap through EnrollPro-owned paths

That breaks the paper’s offline-capable teacher-facing story.

### 3. There is still no true faculty published-schedule experience

The paper claims synchronized teacher-facing finalized schedules.
Current API readiness is ahead of the client experience.

This pass must close that gap with a real `/my/schedule` page and its supporting data path.

### 4. Offline/degraded behavior is still inconsistent and too implicit

When EnrollPro is down but ATLAS already has:

- local auth
- active school-year runtime context
- published schedules
- cached faculty-facing data

faculty should still be able to:

- sign in
- open their dashboard
- view their published schedule
- review saved preferences/request state where local evidence exists

with clear limits and sync recovery messaging.

## Required Product Outcomes

By the end of this pass:

1. faculty can sign into ATLAS through the existing local auth path without depending on live EnrollPro runtime reachability
2. faculty can open `/my/schedule`
3. `/my/schedule` is powered by the published schedule truth, not draft/officer-only data
4. the faculty shell and core faculty pages reopen from ATLAS-owned runtime evidence and saved data when EnrollPro is down
5. the app has a real PWA/offline baseline for these faculty surfaces
6. when EnrollPro returns, sync/refresh behavior is honest and recoverable

## Required Implementation Scope

### A. Auth hardening, not auth replacement

Required:

- preserve the current local auth contract
- preserve EnrollPro-assisted admin and faculty account provisioning into `AtlasAuthAccount`
- verify the runtime login flow does not require live EnrollPro availability once the local account exists
- harden account resolution so faculty/admin identities created from EnrollPro remain stable across syncs

Do not:

- replace this with bridge-only auth again
- make faculty login depend on a live EnrollPro roundtrip

### B. Add `/my/schedule`

Required:

- implement a real faculty published schedule page at `/my/schedule`
- use the published schedule truth, not draft teaching-load data
- support the faculty mobile/responsive shell
- surface enough context for a faculty member to understand:
  - their classes
  - day/time
  - section
  - room
  - relevant term/day distinctions already present in published truth

If a published schedule does not exist, the page must handle that honestly.

### C. PWA/offline baseline for faculty reopening

Required:

- add or complete the missing PWA baseline needed for faculty-facing continuity:
  - manifest
  - service worker/runtime caching strategy
  - app-shell caching suitable for faculty routes
- cache the minimum faculty-critical runtime data needed after one successful connected session:
  - shell branding and school identity where allowed
  - active school-year runtime context
  - faculty auth/session continuity primitives allowed by existing architecture
  - faculty published schedule payload(s)
  - faculty dashboard bootstrap payload(s) where safe
  - latest faculty preference/request state where safe

The goal is not “offline everything.”
The goal is “faculty can still open and use core published/self-service pages after ATLAS has synced once.”

### D. Remove EnrollPro-first bootstrap from faculty pages

Required:

- migrate faculty page bootstrap away from EnrollPro-first `fetchPublicSettings()` dependency
- use ATLAS runtime context and persisted local evidence first
- treat EnrollPro refresh as verification/enrichment, not the initial gate to page usability

Minimum pages in scope:

- `/login`
- `/my`
- `/my/schedule`
- `/my/preferences`
- `/my/room-preferences`
- shell branding/runtime state affecting faculty flows

### E. Honest degraded/offline behavior

Required:

- clearly distinguish:
  - verified live state
  - working from saved ATLAS data
  - saved data only / action temporarily limited
- allow continued read access where ATLAS has enough local evidence
- allow continued write or queued write only where the action is ATLAS-owned and safe
- make sync recovery explicit when EnrollPro returns

### F. Sync recovery when EnrollPro returns

Required:

- when upstream becomes reachable again, faculty-facing pages should recover cleanly
- stale branding/year-label state should refresh
- cached published schedule should refresh if the published truth changed
- queued/self-service changes should reconcile through the existing safe sync path where applicable

## Runtime and Data Rules

- controllers remain transport-only
- business logic stays in `/services`
- no shared database with external systems
- all new or changed endpoints remain under `/api/v1/...`
- if page dependency or fallback behavior changes, update:
  - `docs/reference/atlas-runtime-source-of-truth-map.md`

## Verification Gates

Required:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- targeted tests for:
  - local faculty login still works
  - EnrollPro-provisioned faculty/admin account stability is preserved
  - `/my/schedule` published-schedule read path
  - outage reopen behavior for faculty pages after one successful sync
- live Tailnet verification

### Required Tailnet proofs

1. Faculty local login succeeds without needing a live EnrollPro runtime roundtrip.
2. `/my/schedule` loads from published truth.
3. With EnrollPro unreachable or simulated degraded mode:
   - faculty shell still opens honestly
   - `/my` still opens if local evidence exists
   - `/my/schedule` still opens from saved ATLAS data if already cached
   - preferences/room-requests communicate what is still usable vs limited
4. After reconnect, faculty pages recover and refresh source-state honestly.

Do not return `GO` on builds alone.

## Required Output

Return:

1. files changed
2. auth hardening results
3. `/my/schedule` implementation summary
4. PWA/offline baseline changes
5. faculty degraded/offline behavior changes
6. EnrollPro-provisioned account preservation summary
7. verification results
8. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- local faculty auth remains working and clearly independent from live EnrollPro runtime availability after provisioning
- `/my/schedule` exists and reads from published schedule truth
- faculty core pages reopen from ATLAS-owned/runtime-cached data after one successful connected session
- degraded/offline messaging is honest
- sync recovery is verified when EnrollPro returns
