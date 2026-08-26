# ATLAS UX Overhaul Prompt Sequence

## Purpose

These prompts convert the 2026-07-11 system audit into bounded implementation phases. Run them in order. Do not combine phases into one patch.

| Order | Prompt | Outcome |
|---:|---|---|
| 0 | `00-governance-and-baseline.md` | Reconcile phase ownership and establish measurable UX baselines. |
| 1 | `01-smart-foundation-and-accessibility.md` | Normalize shell, page framing, typography, targets, help, and status patterns. |
| 2 | `02-scheduler-setup-simplification.md` | Simplify Dashboard, Teachers, Subjects, Sections, Teaching Load, and Campus Map. |
| 3 | `03-timetable-review-and-queues.md` | Make timetable review, audit, room schedules, and request queues safer and clearer. |
| 4 | `04-faculty-foolproof-mobile.md` | Rebuild faculty tasks around guided, mobile-first completion. |
| 5 | `05-public-and-cross-role-consistency.md` | Simplify public lookup and close cross-role identity drift. |
| 6 | `06-live-verification-and-closure.md` | Capture Tailnet, accessibility, responsive, and older-user evidence. |

## Mandatory Rules for Every Phase

- Read `ATLAS_AGENT_KI.md`, `AGENTS.md`, `phasePlan.md`, `docs/DESIGN.md`, and the runtime source-of-truth map first.
- Confirm the active phase before implementation; stop on scope conflict.
- Preserve EnrollPro-sourced branding and auth behavior.
- Preserve the no-scroll root and use `flex-1 min-h-0 overflow-auto` for intended scroll regions.
- Use only project `@/ui/*` interaction primitives, `motion/react`, and `lucide-react`.
- Keep G7 green, G8 yellow, G9 red, and G10 blue only when grade meaning is encoded.
- Do not allow any React component file to exceed 1,000 lines.
- Treat `text-xs` as metadata, not instructions, errors, primary labels, or actions.
- Verify behavior at the exact route changed and record evidence in `docs/verification/evidence-log.md`.
- Do not mark a phase GO without live Tailnet proof unless the stakeholder explicitly accepts source-only evidence.
