# Prompt UX-03 — Timetable Review and Decision Queues

## Objective

Preserve expert scheduling power while making review and correction safe for non-technical operators.

## Target Routes

- `/timetable`, `/audit`, `/room-schedules`, `/faculty/preferences`, `/faculty/room-preferences`, `/timetabling/how-it-works`.

## Implementation Directive

1. Preserve the existing timetable three-panel architecture and selected-run truth.
2. Add a beginner-safe default review mode centered on: what needs attention, why it matters, and the next safe action. Keep expert controls available without making them primary.
3. Keep one command row: selected run, refresh, eligible publish, and `More`. Do not restore secondary command clutter.
4. Convert technical labels such as `Hard Δ`, `Soft Δ`, candidate scoring, and generator codes into plain language. Technical codes may appear in expandable evidence.
5. Standardize every schedule-changing flow as Select → Preview → Confirm → Result, with before/after state and explicit saved status.
6. In Audit, default to a ranked “Fix these first” list and progressively disclose domain evidence.
7. In Room Schedules, use search-first selection, a clear grade/status legend, and mobile day cards rather than a compressed desktop grid.
8. In preference queues, present one decision per request with the affected class, requested change, consequences, and approve/decline actions.
9. Rewrite How It Works around five short operator tasks and a plain-language glossary. Provide a replayable in-product walkthrough entry point.
10. Preserve published-revision-only behavior and all validation gates.

## Exit Gate

GO when representative review, room change, request decision, and publish-readiness tasks succeed without hidden state changes, and no critical action relies on color, icons, drag-only input, or technical vocabulary alone.
