# Phase 4 Priority Realignment - 2026-05-07

## Context
Phase 4 has delivered substantial timetable review functionality. However, objective-level tracking now shows that the highest-risk gaps are no longer primarily timetable UI polish. The major blockers are objective completion gaps in authentication, offline capability, publish/dissemination, and faculty/student published schedule access.

## Decision
During the remainder of Phase 4, only accept timetable UI/UX work that is objective-blocking. Redirect primary engineering effort to objective-critical backlog items that prepare Phase 5 execution.

## In-Scope For Remaining Phase 4 Work
- Generated-view functional parity defects that block scheduling actions.
- Runtime/performance defects that block normal operation on low-end devices.
- Defect-level fixes needed to keep review workflows stable for publish readiness.
- API/read model prep that directly enables publish/dissemination implementation.

## Out of Scope For Remaining Phase 4 Work
- New non-critical visual redesign tasks in timetable workspace.
- Cosmetic-only polish with no objective impact.
- Additional interaction embellishments not tied to objective acceptance.

## Priority Bridge Into Phase 5
1. Standalone faculty auth implementation plan finalized and started.
2. PWA baseline plan finalized and started (service worker + manifest + caching policy).
3. Publish lifecycle backend/API contract finalized.
4. Faculty and student published schedule read models finalized.

## Exit Signal To Transition Toward Phase 5
Phase 4 should be considered ready to close once:
- objective-blocking generated-view defects are resolved,
- publish pipeline implementation is unblocked by review-state stability,
- phase-5 implementation slices are documented and ready for execution.
