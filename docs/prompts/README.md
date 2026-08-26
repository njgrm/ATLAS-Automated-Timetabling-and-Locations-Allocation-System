# Prompt Templates and Required Gates

Use this folder for reusable implementation prompts that enforce quality gates.

## Required Sections (for non-trivial tasks)
- Goal and scope (include out-of-scope).
- Required references (`docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, phase docs).
- Context7 preflight summary (library IDs + 2-3 references + applied pattern).
- Execution steps.
- Verification gates (automated + manual + evidence).
- GO/NO-GO rubric.

## Suggested Templates
- `ui-refactor-template.md`
- `manual-qa-template.md`
- `phase-gate-template.md`
- `algorithm-benchmark-template.md`
- `special-class-subject-schedule-config-execution-prompt.md` (school-configurable special class bundles + Subjects page binding)
- `faculty-ux-ui-refactor-execution-prompt.md`
- `faculty-ux-expert-hardening-pass.md` (**high bar**: Playwright faculty matrix, map/building, live conflict inspector, Context7)
- `faculty-ux-gate-closure-prompt.md`
- `faculty-ux-post-go-polish-prompt.md`
- `class-program-matrix-execution-prompt.md` (MCP-verified stakeholder workbook familiarity mode)
- `occupancy-form-export-execution-prompt.md` (MCP-verified `11x6`/`13x6` occupancy export parity)
- `class-program-and-occupancy-gate-closure-prompt.md` (combined strict closure gate for both deliverables)
- `enrollpro-source-truth-reset-execution-prompt.md` (stale mirror wipe + deterministic source-of-truth sync)
- `hybrid-algorithm-refactor-execution-prompt.md` (formal hybrid generation refactor execution)
- `phase2-refactor-recovery-mega-prompt.md` (broad recovery prompt; useful for human review, too broad for Auto by itself)
- `phase2-trisem-contract-reset-prompt.md` (focused tri-sem replacement and quarter-contract purge)
- `phase2-home-room-kpi-recovery-prompt.md` (focused home-room KPI and fallback recovery)
- `phase2-refactor-closure-gate-prompt.md` (strict final closure audit)
- `phase2-refactor-auto-sequence.md` (recommended low-request Auto run order)
- `phase2-timetable-shape-refactor-prompt.md` (first-class timetable-shape refactor based on workbook gap audit)
- `phase2-policy-window-reconciliation-prompt.md` (scheduler UX and guided policy/window conflict resolution)
- `phase2-template-subject-contract-reset-prompt.md` (template/subject/program-scope contract cleanup)
- `phase2-template-subject-tailnet-repair-prompt.md` (strict live-runtime repair loop for subject/template parity after reset)
- `phase2-workbook-gap-refactor-sequence.md` (recommended sequence before returning to KPI recovery and closure)
- `phase3-generator-readiness-sequence.md` (recommended run order for Teacher X, timetable-math repair, control readiness, and KPI rerun)
- `phase3-template-capacity-and-controls-prompt.md` (template-minute math repair with explicit control-adjustment allowance)
- `phase3-policy-persistence-fix-prompt.md` (narrow fix for live scheduling policy write-path and DB persistence drift)
- `phase3-policy-cohort-room-readiness-prompt.md` (persisted policy, cohort, room-readiness, and shared-state repair)
- `phase3-schoolwide-day-shape-alignment-prompt.md` (align control model to stakeholder schoolwide final class-program shape)
- `phase3-special-program-placement-contract-prompt.md` (repair null home-room/building-zone state for SPA/SPS sections)
- `phase3-schedule-output-normalization-prompt.md` (normalize stakeholder-facing schedule labels without removing internal subject granularity)
- `phase3-placement-normalization-kpi-one-shot-prompt.md` (strong-model one-shot that merges placement fidelity repair, stakeholder-facing label normalization, and the KPI rerun gate)
- `phase3-campus-feasibility-and-room-topology-one-shot-prompt.md` (strong-model one-shot for stakeholder-faithful campus topology, room ownership assumptions, and topology-driven run blockers)
- `phase3-room-demand-contract-and-master-schedule-one-shot-prompt.md` (strong-model one-shot for classroom-default room-demand reset and teacher-visibility contract)
- `phase3-generation-feasibility-and-term-distribution-one-shot-prompt.md` (strong-model one-shot for remaining generator contract blockers after placement/output fixes)
- `phase3-cohort-packing-and-kpi-one-shot-prompt.md` (strong-model one-shot for post-run64 cohort fallback, packing, travel/idle feasibility, and KPI rerun)
- `phase3-faculty-qualification-and-coverage-depth-one-shot-prompt.md` (strong-model one-shot for the remaining faculty feasibility blocker cluster after run68)
- `phase3-final-feasibility-contraction-and-gate-one-shot-prompt.md` (strong-model broad final contraction pass before a real closure attempt)
- `phase3-faculty-feasibility-and-final-contraction-one-shot-prompt.md` (merged strong-model pass for post-run68 faculty feasibility repair plus final blocker contraction)
- `phase3-slot-fit-fallback-and-preclosure-one-shot-prompt.md` (strong-model pass for post-run72 slot scarcity, unresolved fallback, cohort completion, and final pre-closure contraction)
- `phase3-matatag-tle-reset-and-faculty-baseline-one-shot-prompt.md` (strong-model reset of stale TLE cohort logic plus faculty-baseline audit after the 2026-05-21 MATATAG change)
- `phase3-post-tle-reset-generation-gate-one-shot-prompt.md` (first honest generator gate after the TLE reset lands)
- `phase3-matatag-tle-reset-and-generation-gate-one-shot-prompt.md` (merged strong-model pass for the MATATAG TLE reset, faculty-baseline audit, and first honest post-reset generator gate)
- `phase3-subject-domain-reset-and-ux-one-shot-prompt.md` (subject-contract, delete-cleanup, department-ownership, and teaching-load UX reset after the MATATAG/TLE baseline shift)
- `phase3-subject-contract-followup-one-shot-prompt.md` (follow-up repair for persisted ownership contract, TLE family operator model, delete/archive remediation, and subject-page density after the first subject reset pass)
- `phase3-subject-page-post-gemini-fix-one-shot-prompt.md` (post-Gemini repair pass for remaining subject-page workflow bugs, discoverability, contract visibility, and scheduler-first UX)
- `phase3-subject-qualification-reset-one-shot-prompt.md` (broad contract reset removing specialization-based qualification from the normal workflow and making department ownership plus Teaching Load authority the baseline)
- `phase3-faculty-modernization-one-shot-prompt.md` (focused Faculty page modernization to match the newer Subjects standard while keeping Faculty roster-first)
- `phase3-faculty-modernization-followup-blockers-prompt.md` (narrow follow-up for concrete Faculty runtime, contract, type, and verification blockers left by the first modernization pass)
- `phase3-faculty-followup-accuracy-and-ux-prompt.md` (targeted Faculty follow-up for credited-load truth, assignment-detail completeness, teacher targeting, pagination, and remaining UX cleanup)
- `phase3-teaching-load-department-first-simplification-one-shot-prompt.md` (focused Teaching Load simplification pass that removes scheduler-facing specialization complexity and reduces workspace overload)
- `phase3-post-qualification-reset-generation-gate-one-shot-prompt.md` (first honest generator gate after the qualification reset lands)
- `phase3-shell-process-ia-one-shot-prompt.md` (sidebar and shell information-architecture cleanup to reflect the real chronological scheduler workflow after Faculty and Teaching Load boundaries are cleaned up)
- `phase3-placeholder-faculty-and-coverage-prompt.md` (Teacher X placeholders and active subject coverage repair)
- `phase3-kpi-rerun-root-cause-gate-prompt.md` (strict rerun gate after Phase 3 repairs)

## Rule
- If a prompt does not include required sections above, revise it before running implementation.

## 2026-05-27

- `phase3-timetable-baseline-truth-and-building-parity-one-shot-prompt.md`
  - first executable Copilot pass for timetable re-entry
  - targets latest-run summary truth, live building-list parity, missing-`G9` diagnosis, and timetable/map consumption drift

- `phase3-timetable-room-demand-and-home-room-reconcile-one-shot-prompt.md`
  - second executable Copilot pass for timetable re-entry
  - targets broad building-hard-constraint relaxation, retained real room/resource collisions, and section home-room reconciliation if topology changes

- `phase3-timetable-term-aware-master-schedule-output-one-shot-prompt.md`
  - third executable Copilot pass for timetable re-entry
  - targets stakeholder-honest SCIENCE/TLE umbrella master schedule presentation plus separate term-detail visibility for rotating subject and teacher identity

- `phase3-timetable-day-shape-and-qualification-authority-followup-one-shot-prompt.md`
  - follow-up Copilot pass after the first timetable contract cleanup
  - targets real 45-minute day-shape restoration, policy-level block control, Teaching Load qualification authority, and demotion of manual unassigned placement as the normal workflow

- `phase3-timetable-day-shape-live-closure-and-qualification-authority-one-shot-prompt.md`
  - corrective Copilot follow-up after the partial day-shape pass
  - targets live Tailnet policy payload closure, proven 45-minute generation behavior, actual Teaching Load qualification-authority reconciliation, and explicit rejection of local-only/partial closure

- `phase3-timetable-g9-placement-and-room-mismatch-followup-one-shot-prompt.md`
  - first strict follow-up for G9 placement, HG exclusion, room-mismatch semantics, and SPA qualification contradiction cleanup

- `phase3-timetable-g9-slot-starvation-and-special-program-plotting-followup-one-shot-prompt.md`
  - next strict Copilot follow-up after the G9/room-mismatch pass narrowed the remaining blockers
  - targets G9 whole-day slot starvation, system-managed subject/template resurrection against manual operator intent, and SPA/SPS blocked-slot plus specialization-plotting truth

- `phase3-timetable-swap-regression-repair-one-shot-prompt.md`
  - strict Copilot interaction-repair pass for the current swap regression
  - targets missing post-timetable swap entry points, pre-generation occupied-slot fallback into overlap behavior, and regression coverage for both paths
  - follow-up Copilot pass for residual timetable placement truth after the first cleanup and homeroom-first passes
  - targets deferred room-mismatch noise, regular Grade 9 placement baseline audit, and generator repair for zero-entry `G9` runs

- `phase3-timetable-reentry-building-parity-and-master-schedule-one-shot-prompt.md`
  - umbrella master brief for timetable re-entry after Teaching Load data closure
  - keep as the planning/reference document, but execute the three split timetable prompts above instead of using this directly as a single one-shot

- `phase3-teaching-load-granular-ux-hardening-gemini-one-shot-prompt.md`
  - one-shot Gemini prompt for the current authoritative `/teaching-load` workspace only
  - targets micro-text cleanup, raw-control replacement, subject-code unboxing, calmer section-allocation density, jump-list ambiguity, hit-target enlargement, and crash-checked inspector/sheet hardening

- `phase3-teaching-load-autofill-route-contract-fix-gemini-one-shot-prompt.md`
  - narrow Gemini prompt for the remaining Teaching Load auto-fill failure after read/write unblock
  - targets the `TeachingLoad.tsx` route mismatch (`/faculty-assignments/autofill` vs `/faculty-assignments/auto-fill`) and payload-field mismatch (`mode` vs `coverageMode`)

- `defense-pdf-cross-page-ui-ux-hardening-gemini-prompt.md`
  - cross-page Gemini prompt derived from `question_prompt.pdf`
  - targets Faculty, Sections, Dashboard, Map Editor, global sidebar, and avatar-initials hardening while explicitly preserving ATLAS `Gx` grade-label convention

- `phase3-teaching-load-grade-scope-and-section-allocation-workflow-fix-one-shot-prompt.md`
  - corrective Gemini prompt for the latest Teaching Load table workflow after live audit
  - targets grade-scope leakage, false read-only state, missing section-mode save flow, teacher-only inspector leakage, adviser-aware regression, sticky-gap cleanup, redundant removal affordance, and dishonest swap behavior

- `phase3-teaching-load-section-mode-truth-and-workflow-repair-one-shot-prompt.md`
  - corrective Gemini prompt for the newest Teaching Load table pass
  - targets grade-level demand-shaping bugs, false read-only state, missing section-mode save flow, teacher-only inspector leakage, adviser-aware UI regression, sticky-gap cleanup, and dishonest swap behavior

- `phase3-teaching-load-coverage-contract-and-burndown-ux-correction-one-shot-prompt.md`
  - corrective Gemini prompt for the latest Teaching Load table workflow pass
  - targets coverage-versus-allocation contract mismatch, false read-only gating, staffing-audit modal regression, sticky expanded-teacher actions, honest teacher metrics, load-severity color semantics, and actionable cleanup of dead or vague controls

## 2026-05-28

- `phase3-runtime-context-live-promotion-and-cache-honesty-fix-one-shot-prompt.md`
  - focused Copilot follow-up for the stale-while-revalidate source-label regression after the runtime timeout recovery pass
  - targets false persistent cached/atlas-mirror/offline-style state in `Faculty` and `Sections` after successful live verification while preserving fast cache-first reopen

- `phase3-runtime-context-timeout-and-stale-while-revalidate-one-shot-prompt.md`
  - focused Copilot resilience pass for recurring 502/slow-verification regressions on runtime-year bootstrap
  - targets bounded EnrollPro timeout in runtime-context resolution, removal of `navigator.onLine` blocking refresh bootstrap, stale-while-revalidate cache-first page reopen behavior, and lightweight warm-navigation memory for Faculty, Sections, and timetable bootstrap

- `phase3-faculty-identity-source-reconcile-and-assignment-bearing-linkage-one-shot-prompt.md`
  - focused Copilot backend/runtime pass for duplicate faculty-mirror resolution and correct assignment-bearing linkage for live faculty accounts
  - targets EnrollPro/local-auth faculty identity drift, blank faculty portal data for loaded teachers, and stale faculty regression harness assumptions

- `phase3-faculty-portal-rotation-parity-and-objective-surface-one-shot-prompt.md`
  - focused Copilot faculty-surface pass for honest dashboard/objective state and term-aware rotation communication
  - targets faculty portal emptiness ambiguity, Science/TLE rotation meaning, and clearer distinction between teaching identity, active-draft plotting, and room-request readiness

- `phase3-faculty-preferences-room-request-acknowledgement-mobile-hardening-one-shot-prompt.md`
  - focused Copilot repair prompt from the 2026-05-28 faculty preferences and room-request audit
  - targets removal of time preferences, canonical preference identity, well-being preference enforcement/labeling, latest-draft room-request consistency, teacher-scheduler acknowledgement history, and mobile UX hardening

- `phase3-faculty-runtime-source-honesty-and-event-auth-fix-one-shot-prompt.md`
  - focused Copilot repair prompt from the live Tailnet faculty/runtime audit
  - targets false saved-data labeling on healthy faculty pages, unauthorized `school-years` and policy background fetches, broken faculty preference/room-request event transport, and faculty room-request self-route identity parity

- `phase3-published-schedule-family-and-stakeholder-table-parity-gemini-one-shot-prompt.md`
  - focused Gemini published-schedule family pass for stakeholder-style table parity across section, teacher, and room views
  - targets the current section-only public schedule UI, card-heavy published layouts, and missing teacher/room parity on top of existing published endpoints

- `phase3-published-schedule-refresh-and-stale-cache-fix-gemini-one-shot-prompt.md`
  - narrow Gemini prompt for stale published-run display after successful publish
  - targets service-worker published-endpoint caching, honest saved-snapshot fallback labeling, and real refresh revalidation on `/public/schedules`

## 2026-05-22

- `phase3-teachers-followup-structure-and-teaching-load-prompt.md`
  - corrective Gemini prompt for the renamed `Teachers` page and connected `Teaching Load` flow
  - targets table/header mismatch, advisory visibility, grade-badge parity, dead contact UI, exclusion clarity, and visible specialization-heavy drift

- `phase3-teaching-load-runtime-fix-and-teachers-followup-prompt.md`
  - corrective Gemini prompt for the still-fragile `Teaching Load` runtime surface after the renamed `Teachers` follow-up pass
  - targets likely runtime/render fragility, incomplete department-first simplification, advisory section visibility, and remaining readability drift

- `phase3-faculty-teaching-load-performance-and-offline-one-shot-prompt.md`
  - focused Gemini prompt for `Teachers` and `Teaching Load` runtime performance, summary-bootstrap resilience, and first honest offline/cached-read baseline
  - targets repeated public-settings bootstrap, heavy `faculty-assignments/summary` dependency, degraded-state handling, and PWA/offline-read gap

- `phase3-teaching-load-truth-and-integrity-reset-one-shot-prompt.md`
  - focused repair prompt for `Teaching Load` truthfulness before redistribution
  - targets program-scope denominator accuracy, empty seeded row handling, and current-year ownership reconciliation

- `phase3-teaching-load-rotation-and-redistribution-one-shot-prompt.md`
  - focused operational repair prompt after the truth reset lands
  - targets rotation-family load accounting, current active coverage gaps, and SPA/SPS distribution balance

- `phase3-teaching-load-runtime-and-placeholder-truth-one-shot-prompt.md`
  - corrective Copilot prompt for the post-rotation live regression on `Teaching Load`
  - targets the live runtime crash, stale cache-shape safety, synthetic Teacher X segregation, and honest real-vs-placeholder coverage metrics

- `phase3-teaching-load-specialization-assignment-contract-one-shot-prompt.md`
  - follow-on Copilot prompt for fixing specialization identity at the assignment layer instead of exploding the subject catalog
  - targets SPA/SPS umbrella-subject preservation, assignment-level specialization identity, TLE dynamic specialization remnants, and teacher-facing specialization detail

- `phase3-teaching-load-real-faculty-recovery-and-rotation-gate-one-shot-prompt.md`
  - final follow-on Copilot prompt for recovering real teacher ownership after placeholder truth is fixed
  - targets zero-load teachers, placeholder-heavy Science/TLE/HG recovery, and a runtime-backed verdict on whether Science and TLE tri-term rotation are actually working

- `phase3-subjects-teachers-uniformity-one-shot-prompt.md`
  - focused Gemini prompt for rebuilding semantic identity and visual-language uniformity across `Subjects` and `Teachers`
  - targets restrained semantic badges, shared department-color language, typography hierarchy, and stronger section-overview treatment in the `Subjects` coverage drawer

- `phase3-teaching-load-strict-ux-ui-recovery-one-shot-prompt.md`
  - focused Gemini prompt for recovering `Teaching Load` as a scheduler-facing page after the recent truth-model passes
  - targets calmer overview hierarchy, teacher-rail readability, durable load explanation, staffing-modal usability, and reduction of diagnostic clutter without losing truth

- `phase3-subject-contract-tle-retirement-one-shot-prompt.md`
  - focused Copilot prompt for retiring stale protected-core treatment of the umbrella `TLE` subject and aligning the `Subjects` workflow with the current MATATAG TLE contract

- `phase3-teaching-load-staffing-reconciliation-one-shot-prompt.md`
  - focused Copilot prompt for real staffing reconciliation after placeholder removal
  - targets science-family ownership failure, TLE family-member distribution, Filipino leakage, integrity cleanup, and blocker-classifier repair

- `phase3-teaching-load-staffing-live-parity-fix-one-shot-prompt.md`
  - narrow Copilot prompt for the remaining live staffing mismatches after the staffing reconciliation pass
  - targets Robotics multi-department ownership, staffing-needs parity with live uncovered coverage, teacher identity/copy cleanup, and mandatory post-change Tailnet proof

- `phase3-teaching-load-term-aware-truth-closure-one-shot-prompt.md`
  - closure-oriented Copilot prompt for finalizing Teaching Load truth and operator trust
  - targets summary-vs-coverage parity, term-aware staffing-needs math, and clear UI separation between raw uncovered rows and concurrent weekly shortage

- `phase3-teaching-load-staffing-truth-and-autofill-fix-one-shot-prompt.md`
  - narrow Copilot prompt that isolates remaining Teaching Load staffing truth and automation blockers
  - targets the live Auto-Fill transaction failure, qualification-aware recovery guidance, and cleaner staffing-report truth without reopening UX scope

- `phase3-teaching-load-scheduler-workspace-ux-one-shot-prompt.md`
  - strict Gemini prompt that isolates Teaching Load scheduler-workspace recovery from staffing math
  - targets the cramped Subject Assignments area, oversized selected-teacher panel, card-heavy section cells, rail readability, and no-scroll-friendly density recovery

- `phase3-teaching-load-stale-ownership-reconciliation-one-shot-prompt.md`
  - focused Copilot prompt for the final backend truth repair in Teaching Load
  - targets stale current-year ownership rows, active-vs-raw truth alignment, explicit stale-ownership diagnostics, and live reconciliation proof on Tailnet

- `phase3-teaching-load-active-vs-stale-and-term-clarity-ux-one-shot-prompt.md`
  - focused Gemini prompt for the final scheduler-facing clarity pass on top of the current Teaching Load rehaul
  - targets active-vs-stale ownership distinction, clearer term/rotation meaning, and continued use of the current compact workspace rather than another redesign

- `phase3-teaching-load-section-first-read-model-one-shot-prompt.md`
  - focused Copilot prompt for implementing the missing section-first live teaching-load API contract
  - targets dedicated per-section assigned-class endpoints, active-truth parity with summary and coverage, direct teacher identity in section rows, and live Tailnet verification without reopening stale-ownership logic

## 2026-05-24

- `phase3-enrollpro-outage-runtime-independence-one-shot-prompt.md`
  - focused Copilot prompt for removing runtime dependence on EnrollPro during scheduler-critical degraded reads
  - targets ATLAS-owned active-school-year bootstrap, mirror-first reopen behavior, cached `Sections` continuity, and honest degraded-source reporting

- `phase3-teaching-load-special-program-redistribution-one-shot-prompt.md`
  - focused Copilot prompt for smarter `SPA_SPEC` / `SPS_SPEC` redistribution after stale-ownership cleanup
  - targets assignment-level specialization identity as a redistribution signal, underutilized `MAPEH` candidate surfacing, and preservation of current special-program coverage truth

- `phase3-teaching-load-rotation-clarity-and-operator-view-ux-one-shot-prompt.md`
  - focused Gemini prompt for the final scheduler-facing clarity layer on top of the current `Teaching Load` rehaul
  - targets clearer `SCIENCE` / `TLE_ROTATION` meaning, a cleaner split between shortage versus underutilized teachers versus redistributable ownership, and term-aware manual-assignment guidance without losing workspace density

- `phase3-teaching-load-degraded-write-and-specialization-slots-one-shot-prompt.md`
  - focused Copilot prompt for making `Teaching Load` safely writable during EnrollPro outage when ATLAS has enough local evidence
  - targets degraded writable-mode gating, `SPA_SPEC` / `SPS_SPEC` specialization-aware section slots, ATLAS-owned capability overrides, and broader MAPEH candidate discovery

- `phase3-teaching-load-degraded-write-and-specialization-slots-ux-one-shot-prompt.md`
  - focused Gemini prompt that exposes degraded writable mode and specialization-aware section-slot assignment cleanly on top of the current `Teaching Load` workspace
  - targets honest writable-state communication, specialization slot clarity, and explicit capability-override treatment without regressing density

- `phase3-teaching-load-runtime-decoupling-and-rotation-truth-one-shot-prompt.md`
  - focused Copilot prompt for the remaining `Teaching Load` backend/runtime closure after degraded write and stale-ownership repair
  - targets EnrollPro-first timeout removal from staffing and auto-fill controls, mirror-first section sourcing, and explicit rotation-lane preview semantics for manual assignment

- `phase3-teaching-load-control-clarity-ux-one-shot-prompt.md`
  - focused Gemini prompt for final scheduler control clarity on top of the current calmer `Teaching Load` workspace
  - targets clearer control labels, stronger `SCIENCE` / `TLE_ROTATION` operator meaning, and better separation of shortage, underutilization, and special-program redistribution

- `phase3-teaching-load-scheduler-friendly-closure-ux-one-shot-prompt.md`
  - stricter Gemini prompt for turning the current `Teaching Load` page from a technically honest but still model-heavy surface into a scheduler-first workspace
  - targets point-of-action rotation-term clarity, practical adjusted-load interpretation, special-program slot usability, and confident degraded writable-state communication without regressing the compact layout

- `phase3-sections-page-uniformity-and-completeness-one-shot-prompt.md`
  - focused Gemini prompt for bringing `Sections` up to the current `Subjects` and `Teachers` standard
  - targets section-first assigned-class drilldown, stronger row identity, richer section completeness, and more polished live/cached source-state communication without bloating the page

- `phase3-sections-degraded-write-and-sync-recovery-one-shot-prompt.md`
  - focused Copilot prompt for making `Sections` usable during EnrollPro outage when ATLAS already has local evidence
  - targets degraded writable home-room behavior, cached/mirror-backed bootstrap, honest source-state communication, and clean sync recovery once upstream returns

- `phase3-teaching-load-unassigned-department-stale-roster-fix-one-shot-prompt.md`
  - narrow Copilot prompt for removing zombie null-department faculty mirror rows from the scheduler-facing Teaching Load roster without hiding real assignment-bearing edge cases
  - targets backend summary quarantine plus integrity diagnostics, not a UI-only hide

- `phase3-teaching-load-zombie-advisory-mapping-fix-one-shot-prompt.md`
  - narrower Copilot prompt for the remaining Teaching Load zombie teacher case caused by an old-school-year adviser mapping leaking advisory credit into the live roster
  - targets active-year adviser validation, HG/advisory truth, and diagnostic preservation

- `phase3-teaching-load-rotation-calculation-clarity-one-shot-prompt.md`
  - focused Gemini prompt for making the existing rotation-aware weekly load math visibly understandable to schedulers
  - targets a worked calculation view, per-family overlap arithmetic, and clearer assignment-time load impact without changing the underlying model

## 2026-05-25

- `phase3-offline-runtime-closure-multi-page-one-shot-prompt.md`
  - focused Copilot prompt for closing the remaining EnrollPro-first bootstrap gaps across the shell, timetable, room schedules, preferences, room requests, faculty dashboard, and `Sections`
  - targets ATLAS-first school-year runtime bootstrap, shell continuity, degraded write parity for `Sections`, and outage-proof opening of lagging pages when local ATLAS evidence already exists

- `phase3-offline-source-state-and-layman-copy-one-shot-prompt.md`
  - focused Gemini prompt for normalizing outage-state communication across the main EnrollPro-dependent surfaces
  - targets plain-language source-state labels, calmer shell outage messaging, and consistent explanations of what users can still do when EnrollPro is down

- `phase3-teaching-load-zero-overlap-clarity-ux-one-shot-prompt.md`
  - narrow Gemini prompt for the remaining Teaching Load trust gap after the broader rotation-calculation and scheduler-clarity passes
  - targets plain-language explanation of valid `0h` overlap states, clearer non-zero overlap meaning, and more visible same-lane-across-terms assignment cues without regressing compactness

- `phase3-teaching-load-readability-recovery-one-shot-prompt.md`
  - narrow Gemini prompt for the post-clarity readability regression in Teaching Load
  - targets selected-teacher trust-surface decompression, larger readable text hierarchy, calmer section-chip density, and preservation of the current compact no-scroll workspace

- `phase3-faculty-offline-publish-readiness-one-shot-prompt.md`
  - focused Copilot prompt for the next major objective stream after the paper audit
  - targets faculty offline publish readiness through local-auth hardening, `/my/schedule`, PWA/offline runtime baseline, ATLAS-first faculty bootstrap, and reconnect recovery while preserving current EnrollPro-backed account provisioning

- `phase3-faculty-offline-publish-ux-and-degraded-state-one-shot-prompt.md`
  - focused Gemini prompt for the faculty-facing UX layer on top of the offline publish readiness backend/runtime pass
  - targets `/my/schedule` as a first-class destination plus plain-language degraded/offline messaging across login, shell, dashboard, preferences, and room requests

- `phase3-faculty-offline-publish-ux-followup-one-shot-prompt.md`
  - narrow Gemini cleanup prompt for the remaining faculty offline publish UX misses after the main faculty UX pass
  - targets readable school-year labeling on `/my/schedule`, final source-state copy normalization, and mojibake cleanup without reopening the broader faculty runtime or layout scope

- `phase3-student-public-published-schedule-runtime-and-public-page-one-shot-prompt.md`
  - focused Copilot prompt for implementing the real no-login student/public published schedule surface
  - targets latest-published-only public viewing, section-first browsing, public route/runtime continuity, and useful filter/navigation support

- `phase3-student-public-published-schedule-ux-one-shot-prompt.md`
  - focused Gemini prompt for turning the new public published schedule surface into an easy mobile-friendly student/guardian experience
  - targets section-first lookup, plain-language public copy, filters, and readable public schedule navigation

- `phase3-publish-dissemination-closure-one-shot-prompt.md`
  - focused Copilot prompt for closing the publish/dissemination stream after faculty and public schedule views exist
  - targets strict publish guards, user-facing publish readiness, and consistency of published truth across scheduler, faculty, public, and API surfaces

- `phase3-objective-1-4-honesty-gate-one-shot-prompt.md`
  - strict Copilot evidence gate for reassessing Objective 1.4 and the paper’s “conflict-free timetable” framing after dissemination lands
  - targets a live-truth verdict on whether the next stream is still generator-readiness closure

- `phase3-published-run-integrity-reconciliation-one-shot-prompt.md`
  - narrow Copilot prompt for fixing the live contradiction where public published-schedule endpoints return no valid published run while the DB still contains `FAILED` runs marked as published
  - targets published-run source-of-truth repair before relying on faculty/public dissemination closure

- `phase3-teaching-load-absolute-coverage-and-teacher-x-one-shot-prompt.md`
  - focused Copilot prompt for the final absolute-coverage control layer in Teaching Load
  - targets explicit manual `Teacher X` placement, auto-fill strategy modes (real-faculty standard, hard-cap saturation, real-faculty then Teacher X), and honest staffing truth for real versus synthetic closure

- `phase3-teaching-load-credited-load-and-summary-ux-one-shot-prompt.md`
  - focused Gemini prompt for the remaining Teaching Load trust/readability pass
  - targets credited-policy-load-first presentation, demotion of inline arithmetic into secondary disclosure, raw-teaching display repair, and a clean in-page teacher assignment summary without regressing the compact workspace

## 2026-05-27

- `phase3-teaching-load-refactor-stabilization-and-regression-closure-one-shot-prompt.md`
  - narrow Gemini stabilization prompt for closing the regressions left by the major Teaching Load frontend refactor
  - targets restored rotation term-bucket truth, global reset reachability, honest coverage-mode handling, lighter prop fan-out, and calmer scheduler wording without reopening the whole redesign

- `phase3-teaching-load-post-stabilization-ui-refactor-one-shot-prompt.md`
  - post-stabilization Gemini UI refactor prompt for turning the now-stable modular Teaching Load page into a calmer scheduler-first workspace
  - targets toolbar/identity/workspace hierarchy, SubjectRow density cleanup, tooltip-standard compliance, lighter render-loop shaping, and readiness for future SPA/SPS breakout lanes without reopening backend truth

- `phase3-teaching-load-dual-mode-grid-and-inspector-refactor-one-shot-prompt.md`
  - stakeholder-aligned Gemini workflow-model refactor prompt for replacing the current Teaching Load dashboard surface with a dual-mode grid (`By Teacher` and `By Section / Shortage`) plus a persistent workload inspector drawer
  - targets the real transcription-versus-allocation operator split, direct inline unassign, calmer master-detail structure, and continued compatibility with future SPA/SPS breakout-lane truth

- `phase3-teaching-load-table-familiarity-and-shortage-semantics-correction-one-shot-prompt.md`
  - corrective Gemini prompt for the first landed table refactor after audit showed missing teacher filters, outside-department overexposure, misleading shortage semantics, and incomplete section-mode assignment behavior
  - targets familiar table controls, hidden-by-default cross-department content, honest section-mode naming/data scope, and reduced scroll burden while preserving the persistent inspector

- `phase3-teaching-load-split-brain-repair-and-special-program-approval-one-shot-prompt.md`
  - strict Copilot incident-repair prompt for the current Teaching Load split-brain state
  - targets summary/detail/coverage/staffing contradiction repair, manual dry-run reconcile tooling, rotational science recovery distribution, contradictory-row quarantine, and explicit blocked-by-approval `MAPEH` special-program surfacing without auto-mutating live Tailnet data

- `phase3-teaching-load-scheduler-surface-recovery-ux-one-shot-prompt.md`
  - strict Gemini follow-up prompt for the final scheduler-facing recovery after the split-brain repair lands
  - targets calmer selected-teacher hierarchy, secondary per-term disclosure, visible integrity-repair states, blocked `MAPEH` candidate clarity, and reduced microtext without redesigning the compact workspace

- `phase3-teaching-load-readwrite-unblock-and-scope-reconcile-one-shot-prompt.md`
  - strict Copilot follow-up for the current Teaching Load lock after valid subject-scope corrections
  - targets split-brain quarantine reclassification, safe reconcile handling for scope-drift rows like `DEVL_READING`, and restoring real manual save plus auto-fill behavior without hiding remaining recovery warnings

- `phase3-teaching-load-closure-readwrite-ste-and-mapeh-redistribution-one-shot-prompt.md`
  - strict Copilot closure prompt for the remaining Teaching Load blockers before returning focus to timetabling
  - targets false read-only gating, STE section-allocation denominator drift, real section-mode save/swap closure, and special-program redistribution so active eligible MAPEH teachers do not remain at zero load without explicit justification

- `phase3-teaching-load-post-reconcile-count-basis-and-faculty-row-fix-one-shot-prompt.md`
  - narrow Copilot follow-up for the remaining live Teaching Load contradiction after split-brain hardening
  - targets the post-reconcile pair-count basis mismatch (`962` vs `1044`), the impossible `PERLA MARCOS` rotational science row, and quarantine severity staying blocking for false mismatches while preserving approval-needed `MAPEH` surfacing

- `phase3-teaching-load-residual-integrity-and-outlier-fix-one-shot-prompt.md`
  - narrower Copilot follow-up for the remaining live Teaching Load blockers after pair-count parity was restored
  - targets the residual `16 / 16` integrity counters, the persistent `PERLA MARCOS` science outlier row, the remaining real-faculty blockers, and readiness for a controlled Tailnet apply test without using reset as a shortcut

- `phase3-teaching-load-saved-truth-and-peak-term-ui-reconciliation-one-shot-prompt.md`
  - strict Copilot prompt for the remaining Teaching Load closure blockers after the term-awareness backend pass and Gemini follow-up
  - targets saved-coverage versus staffing-truth reconciliation, credited-load-based status/progress, true peak-term-aware manual assignment preview, and honest staffing source-state messaging in the same backend+frontend iteration

- `phase3-sections-room-picker-followup-and-map-modal-one-shot-prompt.md`
  - narrow Gemini follow-up for the remaining `Sections` home-room workflow regressions after the first optimization pass
  - targets viewport-safe internal picker scrolling, honest reconnect-versus-saved source-state messaging on page re-entry, and an in-page map modal for room selection instead of route-out campus-map browsing

- `phase3-sections-home-room-behavior-and-swap-followup-one-shot-prompt.md`
  - narrow Gemini follow-up for the remaining behavioral gaps after the map-modal pass
  - targets confirmed unassign, real building-view room selection, synchronized sidebar-and-map state, occupied-room swap confirmation, persisted save behavior, and false saved-data regression on normal page re-entry

- `phase3-sections-home-room-e2e-repair-and-evidence-one-shot-prompt.md`
  - strict Gemini follow-up for the still-untrusted `Sections` home-room workflow after the previous pass overclaimed completion
  - targets reuse of the existing `BuildingView`, true end-to-end assign/unassign/swap validation, truthful route re-entry state handling, and mandatory evidence-log updates before `GO`

- `phase3-enrollpro-recovery-source-honesty-multi-page-one-shot-prompt.md`
  - focused Copilot prompt for repairing live-versus-saved source-state recovery once EnrollPro comes back online
  - targets the runtime-context helper, multi-page source-state truth, and honest recovery behavior across `Teachers`, `Sections`, `Teaching Load`, `Audit`, `Dashboard`, and shared shell framing

- `phase3-sections-home-room-control-optimization-and-uniformity-one-shot-prompt.md`
  - focused Gemini prompt for fixing `Sections` pagination drag and weak home-room picking without reopening the page architecture
  - targets a lighter searchable grouped room picker, better parity with existing timetable room-selection patterns, and calmer Teachers/Sections UX language alignment

- `phase3-teaching-load-term-aware-rotation-model-one-shot-prompt.md`
  - focused Copilot prompt for the remaining backend truth gap in rotating-subject weekly load
  - targets explicit term-aware `SCIENCE` / `TLE_ROTATION` crediting, staffing and hard-cap parity under the corrected model, and live proof on whether the Science shortage is still real after fixing cross-term load inflation

- `phase3-rotational-subject-term-awareness-full-stack-one-shot-prompt.md`
  - strict Copilot full-stack prompt for the rotational-subject term-awareness correction
  - targets backend term-aware load truth plus visible term-rank communication across `Subjects`, `Teaching Load`, and `Sections` so the system stops treating different-term rotational assignments like simultaneous weekly load

- `phase3-rotational-subject-term-awareness-ux-followup-one-shot-prompt.md`
  - narrow Gemini follow-up prompt for finalizing the scheduler-facing UX after the Copilot term-awareness pass lands
  - targets calm, uniform, readable term-label treatment and term-aware assignment language across `Subjects`, `Teaching Load`, and `Sections`

- `phase3-rotational-subject-peak-term-capacity-correction-one-shot-prompt.md`
  - strict Copilot correction prompt for the remaining rotational load bug after the first term-awareness pass
  - targets the true school rule of peak single-term rotational crediting plus normal year-round stacking, per-term hard-cap behavior, and exact `Term 1 / Term 2 / Term 3` visibility across affected surfaces

- `phase3-runtime-active-school-year-truth-and-scheduler-alignment-one-shot-prompt.md`
  - strict Copilot runtime/source-of-truth recovery prompt for the current wrong-school-year bootstrap bug
  - targets backend active-school-year evidence ranking, client runtime source typing, wrong-year cached first-paint suppression, and direct Tailnet verification that scheduler pages stop opening on the `190 / 794` year when a different year is the real active scheduler workspace

- `phase3-teaching-load-tle-scope-autofill-distribution-and-quarantine-lift-one-shot-prompt.md`
  - strict Copilot closure prompt for the current post-runtime Teaching Load blocker cluster
  - targets the remaining `TLE_ICT_EXP` out-of-subject-scope truth rows, anti-concentration science auto-fill distribution, honest overload-versus-outlier classification, and quarantine downgrade/lift once only approval workflow or legitimate overload review remains

- `phase3-teaching-load-rotation-semantics-and-load-labeling-ux-one-shot-prompt.md`
  - narrow Gemini follow-up for the remaining rotational load presentation confusion after backend closure
  - targets honest `Credited Weekly Load` versus concurrent teaching labeling, non-additive `Term 1 / Term 2 / Term 3` visualization, and cleaner peak-term explanation without reopening backend math

- `phase3-teaching-load-nonadditive-term-presentation-ux-one-shot-prompt.md`
  - narrower Gemini follow-up for the remaining duplicate-term-surface confusion after the first rotation semantics pass
  - targets removal or demotion of competing header term totals, one authoritative rotational term breakdown surface, and faithful non-additive weekly-load presentation for Science and TLE teachers

- `phase3-teaching-load-helper-shadow-and-warning-state-fix-one-shot-prompt.md`
  - strict Copilot frontend-truth cleanup prompt for the current post-Gemini Teaching Load contradiction
  - targets stale helper shadowing in the client bundle, selected-teacher strip drift versus live API truth, removal or downgrade of the non-blocking data-truth warning banner, and honest tied-peak rotational presentation on Tailnet

- `phase3-teaching-load-review-and-rotation-surface-compaction-ux-one-shot-prompt.md`
  - narrow Gemini compaction prompt for the remaining Teaching Load presentation clutter after truth alignment
  - targets moving warning-only review state and rotational family breakdown out of the primary workspace into secondary disclosure while preserving truthful top-line teacher metrics

- `phase3-teaching-load-major-frontend-refactor-and-workflow-clarity-one-shot-prompt.md`
  - strict Gemini frontend-refactor prompt for the current Teaching Load god-component and workflow-density problem
  - targets structural extraction, calmer hierarchy, direct assignment-removal UX, reduced prop-drilling pressure, and a dual-workflow layout that stays ready for upcoming SPA/SPS breakout-lane truth

- `phase3-spa-sps-breakout-dissemination-and-homeroom-model-one-shot-prompt.md`
  - focused Copilot full-stack correction prompt for the real `SPA/SPS` staffing model
  - targets explicit breakout specialization lanes, default `MAPEH` staffing eligibility, cohort-style concurrent subgroup truth, downstream specialization-lane API exposure, and the homeroom-centric scheduling assumption

- `phase3-timetable-spa-sps-materialization-and-capacity-softening-one-shot-prompt.md`
  - strict Copilot timetable-closure prompt for the remaining `SPA/SPS` blocker cluster after `G9` recovery
  - targets specialization-demand materialization from Teaching Load and `/sections` truth, preservation of `SPA_SPEC` / `SPS_SPEC` timetable identity, softening of `ROOM_CAPACITY_EXCEEDED` for this phase, and reduction of the remaining `150` live unassigned rows

- `phase3-timetable-wellbeing-soft-hard-semantics-alignment-one-shot-prompt.md`
  - strict Copilot semantics-correction prompt for the current residual timetable blocker after the historical zero-unassigned run regressed
  - targets constructor-versus-validator alignment on soft/review wellbeing rules, realistic-policy rerun closure under `480 / 120 / 15`, honest residual blocker taxonomy, and removal of policy inflation as the primary closure mechanism

- `phase3-timetable-performance-and-load-path-hardening-gemini-one-shot-prompt.md`
  - focused Gemini performance-hardening prompt for the current `/timetable` cold-on-every-navigation problem
  - targets repeated bootstrap fetch reuse, critical-first loading, lazy conflict computation, stable memoized context objects, and reduced rail render cost without redesigning the workspace

- `tl-timetable-02b-teachers-admin-data-table-followup-fix-prompt.md`
  - narrow follow-up prompt for the implemented Teachers AdminDataTable pilot after review
  - targets the broken `/teachers` -> `/teaching-load` query-param handoff, load-state sort semantics, and approval-needed versus over-cap summary truth

- `tl-timetable-05b-sandbox-draft-commit-closure-prompt.md`
  - narrow follow-up prompt for the implemented sandbox draft commit path after review
  - targets explicit soft-warning acknowledgement, revision-oriented published-run blocking copy, and the missing authenticated valid/invalid Tailnet commit proof needed to promote Prompt 5 to full GO

- `tl-timetable-05c-sandbox-browser-closure-and-ui-hardening-prompt.md`
  - final closure prompt for the timetable sandbox commit path after API-level proof lands
  - targets true browser end-to-end valid save capture from the Tactical Dock plus calmer, more intentional dock UI hierarchy before Prompt 6 begins
