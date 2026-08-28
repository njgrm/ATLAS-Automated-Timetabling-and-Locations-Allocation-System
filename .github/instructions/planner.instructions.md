---
applyTo: "**"
---

# Planner Instructions (Codex + Copilot Alignment)

## Purpose
- Use this file when preparing plans, QA checklists, implementation prompts, and execution handoffs.
- Treat it as the shared planning contract so Codex and Copilot reason from the same active-phase context.

## Authority Order
1. `AGENTS.md`
2. `phasePlan.md`
3. The active detailed phase/refactor document in `docs/phases/`
4. `docs/verification/phase-gates.md`
5. `docs/verification/evidence-log.md`

If two detailed docs conflict, prefer the one that matches the current active stream in `phasePlan.md`.
If `phasePlan.md` and a detailed doc conflict, `phasePlan.md` wins unless the user explicitly re-points the active stream.

## Current Planning Mode
- Current active stream: Phase 3 generator-readiness stream under `phasePlan.md`.
- Refactor Option 1 is closed for local execution scope and should be treated as a prerequisite already satisfied.
- The current planner goal is to execute Phase 3 in the dependency order defined by the latest prompt map, not to start unrelated roadmap work.
- Do not treat older historical phase numbers with the same label as the active stream if the current refactor docs supersede them.
- As of `2026-05-21`, treat the old TLE cohort/split contract as obsolete; new planning should assume section-scoped TLE term rotation unless a newer stakeholder correction overrides it.

## Phase 3 Working Set
- Read these first before drafting plans or implementation prompts:
  - `phasePlan.md`
  - `docs/reference/atlas-runtime-source-of-truth-map.md`
  - `docs/prompts/phase3-generator-readiness-sequence.md`
  - `docs/prompts/phase3-template-capacity-and-controls-prompt.md`
  - `docs/prompts/phase3-policy-cohort-room-readiness-prompt.md`
  - `docs/prompts/phase3-placeholder-faculty-and-coverage-prompt.md`
  - `docs/prompts/phase3-kpi-rerun-root-cause-gate-prompt.md`
  - `docs/verification/evidence-log.md`
- Use `docs/phases/refactor-implementation-phases-2026-05-15.md` for background on why the refactor happened and what it unblocked.

## Planner Goals For The Current Stream
- Drive Phase 3 to closure with evidence, not assumptions.
- Focus on discrepancies still visible in the running system before declaring the phase complete.
- Prefer validation on the Tailnet environment unless the user explicitly asks for isolated localhost work.
- When a code path appears complete but live behavior disagrees, treat the live discrepancy as the source of truth for planning.

## Prompt-Scope Discipline
- Distinguish `prompt GO` from `phase closure GO`.
- A focused prompt may pass its own scope while the overall phase remains open.
- Never translate a successful repair-loop prompt directly into a phase-closure recommendation unless the phase gates themselves are satisfied.

## Closure Criteria Discipline
- A phase is not closed because code landed.
- A phase is closed only when all relevant gates in `phasePlan.md` and `docs/verification/phase-gates.md` have matching evidence.
- If a document claims a phase is complete but live QA still shows discrepancies, treat the phase as open and log the mismatch explicitly.

## Prompt Construction Rules
- Every implementation prompt should identify:
  - active phase/stream
  - exact scope boundary
  - required evidence for closure
  - files/documents that define acceptance
  - known blockers or discrepancies to resolve
- Every implementation prompt should, when appropriate, explicitly allow control adjustment if feasibility depends on operator-tunable values.
- Every implementation prompt should tell the implementer:
  - do not drift into Phase 5+ work unless explicitly approved
  - preserve MVC/service-layer boundaries
  - keep controllers transport-only
  - update verification artifacts when behavior changes
  - use a repair loop when live verification is required: audit, fix, verify, self-correct once if needed, then return GO/NO-GO

## Copilot Session Discipline
- Prefer a new Copilot chat/thread for each prompt file execution.
- Reuse the same chat only for a direct follow-up repair loop on that same prompt.
- Do not carry one long chat across multiple prompt files when the subsystem focus changes.
- Keep prompt files and repository instructions as the persistent context layer; keep individual chat history narrow.

## QA And Verification Rules
- Prefer direct ATLAS login evidence for protected-route QA unless bridge-auth itself is the thing under test.
- Direct ATLAS admin QA credential for current Tailnet validation:
  - `1000001` / `AdminSY2026!`
- For generator-readiness validation, capture:
  - generation duration
  - home-room success metrics
  - violation counts and categories
  - visible UI discrepancies versus documented expectations
  - whether the discrepancy is backend data, API contract, or UI presentation
- When a prompt requires live Tailnet verification, local build success is insufficient for GO.
- If Tailnet behavior contradicts local test results, document both and keep the issue open.

## Context7 / MCP Guidance
- If Context7 MCP is available in the active runtime, use it for version-sensitive docs before writing implementation prompts.
- If the repo contains `.vscode/mcp.json` but the runtime does not expose the MCP server, note that limitation and fall back to official docs via web.
- Reading `.vscode/mcp.json` from disk is not the same as having live MCP tool access.

## Expected Planner Outputs
- High-signal execution plans
- QA checklists
- discrepancy triage summaries
- implementation prompts for Copilot/Claude/Codex
- phase closure recommendations with explicit pass/fail reasoning
- source-of-truth map updates when page/data ownership or fallback behavior changes

## Source-of-Truth Maintenance
- Keep `docs/reference/atlas-runtime-source-of-truth-map.md` aligned with live reality.
- Update it whenever:
  - a page changes its primary APIs
  - a data domain changes source-of-truth ownership
  - a persisted path replaces a fallback/synthesized path
  - EnrollPro integration changes what ATLAS syncs versus derives
  - a newly proven generator blocker changes how a page should be interpreted during QA

## Anti-Patterns
- Do not mark a phase closed from code inspection alone.
- Do not let a future-dated doc silently override the active stream without user confirmation.
- Do not turn unresolved live discrepancies into backlog items if they block the current phase gate.
- Do not write implementation details into requirements documents unless the user explicitly asked for a technical execution prompt instead of a PRD.
