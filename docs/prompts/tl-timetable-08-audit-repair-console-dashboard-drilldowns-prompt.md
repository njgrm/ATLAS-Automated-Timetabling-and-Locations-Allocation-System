# Prompt 8: Audit Repair Console And Dashboard Drilldowns

## Mission

Turn `/audit` and `/dashboard` from passive readiness displays into repair-oriented workflow surfaces.

This prompt should run after the exact repair targets exist, especially Teaching Load semantics, Teachers table clarity, timetable stale state, and Tactical Dock repair paths.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/reports/crud-teaching-load-timetable-audit-2026-05-31.md`
- `docs/prompts/teaching-load-timetable-repair-sequence-2026-05-31.md`

Apply:

- `atlas-21st-dev-frontend`
- `atlas-design-system-enforcer`
- `atlas-ux-audit-gate`
- `atlas-copy-and-microcopy`

Inspect before editing:

- `/audit` page and components
- `/dashboard` page and data hooks
- setup/fix routes: `/teaching-load`, `/teachers`, `/sections`, `/subjects`, `/map`, `/timetable`
- existing readiness/audit data payloads

## Product Decisions

- Audit should become a repair console.
- Each blocker must say what it blocks, why it matters, and where to fix it.
- Dashboard cards should drill into exact repair targets when enough context exists.
- Avoid generic routing when subject/teacher/section/room/timetable context is known.

## Scope

In scope:

- `/audit` action groups and blocker CTAs.
- `/dashboard` drilldowns and refresh/readiness cues.
- Plain-language blocker copy.
- Links/deep links into exact fix contexts.
- Evidence-log/source-map updates.

Out of scope:

- New readiness summary endpoint. That is Prompt 9b.
- Full backend audit logic rewrite.
- Tactical Dock implementation.
- Faculty `/my/*` changes.

## Mandatory Outcomes

### 1. Audit blocker action contract

For each major blocker group, show:

- what is blocked
- why it matters for scheduling/publish
- one primary fix action
- optional secondary inspect action

Use plain copy. Do not lead with `gate`, `run`, `split-brain`, or unexplained violation names.

### 2. Exact fix routing

Route to exact repair contexts when known:

- teacher/load issue -> `/teaching-load` or `/teachers` with context
- section issue -> `/sections` with context
- subject issue -> `/subjects` with context
- room issue -> `/map` with context
- timetable/manual repair issue -> `/timetable` with context

### 3. Dashboard drilldowns

Dashboard readiness/status cards should:

- have refresh/check-for-updates affordance where useful
- open the same fix targets used by Audit
- explain why the item blocks generation or publish

### 4. Preserve page performance and no-scroll behavior

Do not add large always-expanded details to the top of dashboard or audit. Use progressive disclosure and concise action groups.

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-client run build`
- line-count and primitive scans for touched React files
- route smoke for `/audit` and `/dashboard`

Browser/Tailnet smoke:

- sample at least one blocker from each available action group
- verify action opens intended fix context
- confirm no horizontal overflow on shared browser viewport
- confirm copy avoids unexplained jargon in primary messages

Self-correction requirement:

- If routing, build, primitive scan, or browser smoke fails, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- blocker-to-fix routing map
- copy changes
- smoke evidence
- build result
- evidence-log/source-map updates
- prompt-scope `GO` or `NO-GO`