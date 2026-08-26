# Codex Self-Audit Prompt — Older-User Session Validation

Run a disciplined self-audit using the shared protocol in `older-user-session-validation-shared-protocol-2026-07-28.md`.

## Required work

1. Read `ATLAS_AGENT_KI.md`, `phasePlan.md`, the shared protocol, and the current closure report.
2. Run the live Tailnet browser suites already established for the setup-first stream and timetable.
3. Use Playwright on the live Tailnet to execute T01–T12 as a browser proxy. Capture screenshots, visible text, focus order, local/global overflow, and timings. Do not commit a placement or swap.
4. Perform a click-path audit of each critical action: Dashboard repair links, Room readiness repair path, Simple/Advanced toggle, unresolved-session placement, swap review, cancel, and save boundary. Trace handler calls in order and flag sequential undo, stale closure, async race, dead path, or useEffect interference.
5. Check accessibility behavior: keyboard reachability, visible focus, target size, dialog focus containment/Escape, disclosure state, accessible names, status announcements, and color-independent meaning.
6. Compare the observed task outcomes to the former cockpit capability list. Do not award a UX pass when a feature simply disappeared.

## Output

Write `docs/verification/older-user-session-validation-codex-2026-07-28.md` with:

- Evidence classification for every result.
- T01–T12 score table and timings per viewport.
- Findings using `OUSER-NNN` IDs.
- Capability-parity matrix.
- Automated proxy limitations versus real participant evidence.
- `Product GO`, `GO WITH FIXES`, or `NO-GO` decision.
- Exact next fixes, if any; do not implement speculative changes during the audit.
