# Setup-First UI/UX Baseline Audit - 2026-07-28

## Target

Live Tailnet environment: `https://njgrm.buru-degree.ts.net`

## Context

The timetable page is technically stable after the default-layout redesign and finalization pass, but product-level closure is still pending moderated older-user evidence. This audit starts the next UI/UX stream by checking whether setup pages expose useful work early and make source truth understandable.

## Baseline Findings

| Page | Current Technical State | UX Density Verdict | Source-Truth Clarity | Notes |
|---|---|---|---|---|
| `/timetable` | Technical GO | Watch | Visible | First action appears quickly, but grid density and warning count can still feel heavy. Product GO still requires older-user validation. |
| `/sections` | Compact shell exists | Improve | Partially visible | Header is compact, but source explanation is mostly tooltip-driven. Home-room status banner is useful but adds vertical height. |
| `/subjects` | Compact shell exists | Improve | Partially visible | Subject stats are useful, but source state needs visible non-hover explanation. |
| `/faculty` | Compact shell exists | Improve | Partially visible | Roster source chip exists, but saved/live meaning should be visible without hover. |
| `/teaching-load` | Compact command header exists | Improve | Partially visible | Command header is dense. Source state exists, but the explanation is tooltip-first. |
| Campus/Rooms | Pending next stream | NO-GO pending audit | Pending | Needs list-first readiness audit before map/editor work. |
| `/dashboard` | Pending next stream | NO-GO pending audit | Pending | Should become the primary setup-readiness hub after setup pages are simplified. |

## Iteration 0 Decision

Proceed with Iterations 1-2 because the setup pages already have a compact shell foundation, but source-truth clarity is not sufficiently visible for older non-technical users.

## Guardrails For Iterations 1-2

- Do not create a second page-shell pattern.
- Strengthen the existing `AdminWorkspaceFrame`.
- Keep all explanations shadcn/Radix-based; do not introduce raw `title` or `<details>`.
- Preserve local scrolling and prevent global page scrollbars.
- Do not change runtime source ownership or generation behavior.

## Verification Required

- Static client gates: TypeScript, UX guardrails, production build.
- Live Tailnet Playwright gate for `/sections`, `/subjects`, `/faculty`, and `/teaching-load`.
- Timetable regression should remain green after setup shell changes.
