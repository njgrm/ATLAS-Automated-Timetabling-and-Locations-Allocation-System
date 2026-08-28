# Prompt 4 — Cross-Role Trust and Usability Closure

## Objective

Make save, sync, recovery, confirmation, and terminology behavior predictable across scheduler, faculty, and public surfaces, then capture final evidence.

## Tasks

1. Introduce shared visible status primitives for Saved, Unsaved, Saving, Queued, Syncing, Synced, Failed, Offline, and Saved copy.
2. Normalize error states to: what happened, whether work is safe, what to do next.
3. Normalize success receipts to identify what changed and what happens next.
4. Use confirmation only for destructive or schedule-changing actions; preserve before/after details.
5. Complete terminology and `text-xs` audits across active routes.
6. Run keyboard-only, screen-reader landmark, reduced-motion, 200% zoom, 400% reflow, and required viewport checks.
7. Run five moderated sessions with representative low-confidence users and record completion/error/hesitation results.

## Exit Gate

GO only with zero critical accessibility blockers, no page-level horizontal overflow, complete live faculty journeys, and the moderated-session thresholds defined in UX-06.
