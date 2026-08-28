---
name: atlas-react-view-patterns
description: React view-layer patterns for ATLAS role-based portals and public pages. Use when building pages/components and wiring API state into UI.
user-invocable: true
---

# ATLAS React View Patterns Skill

Use this skill for frontend component and page decisions.

## View Layer Responsibilities
- Treat frontend as MVC View layer.
- Keep domain decisions in backend services.
- Focus on UX state, rendering, accessibility, and client-side orchestration.

## Role-Aware UI
- Scheduling Officer: setup, generation, review, publish, manual adjustments.
- Teacher/Faculty: auth, preference submission, personal schedule view.
- Student/Public: unauthenticated section lookup and schedule viewing.

## Data Handling
- Consume only versioned API endpoints (/api/v1/...).
- Separate server state from local UI state.
- Surface optimistic locking conflicts with reload/retry flow.

## Quality Rules
- Mobile-first responsiveness for Android browser support.
- Clear conflict/warning state labels.
- Keep components composable and testable.
