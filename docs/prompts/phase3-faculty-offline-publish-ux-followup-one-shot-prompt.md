# Gemini Execution Prompt: Phase 3 Faculty Offline Publish UX Follow-Up One-Shot

## Objective

Close the remaining faculty offline publish UX gaps left after the main faculty offline publish pass.

This is a narrow cleanup pass.
Do not reopen backend/runtime work.
Do not redesign the faculty portal again.

The goal is to make the current faculty offline publish experience fully closure-grade by fixing the remaining labeling, copy, and text-quality misses.

## Out of Scope

Do not:

- rewrite backend auth, caching, or published-schedule logic
- redesign `/my/schedule` from scratch
- revisit scheduler/admin pages
- start student/public publish work
- add new feature scope beyond the specific cleanup items below

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-paper-alignment-audit-2026-05-24.md`

Specifically review:

- `# 2026-05-26 - Phase 3 Faculty Offline Publish Readiness One-Shot` in `docs/verification/evidence-log.md`
- the latest verification finding that the faculty UX pass is only a partial GO

Inspect directly:

- `atlas-client/src/pages/MySchedule.tsx`
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/pages/FacultyPreferences.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/pages/Login.tsx`

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui`
- `Badge`
- `Tooltip`
- `motion`

## Facts To Treat As Settled

- `/my/schedule` already exists
- service worker + manifest baseline already exist
- ATLAS-first faculty runtime bootstrap already exists
- offline/degraded faculty continuity is already materially real
- this pass is only about closure-quality UX cleanup

## Verified Remaining Problems To Fix

### 1. `MySchedule` school-year badge is wrong

Current problem:

- the page currently displays the numeric `schoolYearId`
- that is not a teacher-friendly school-year badge

Required:

- show a readable school-year label, not a numeric internal ID
- use the best available display label already present in runtime context or schedule-facing context
- if only saved/offline context is available, keep the fallback honest and readable

### 2. Source-state wording is still slightly muddled

Current examples that still need cleanup:

- `Verified with saved school year data`
- `Working from saved school year data`
- `Using your last saved faculty account link while offline`

Required:

- make these phrases more natural and teacher-friendly
- keep the distinction between:
  - verified live state
  - working from saved data
  - offline identity/account fallback
- do not use system-oriented wording like `account link`

### 3. Shell text quality still has mojibake

Current issue:

- `AppShell` still shows broken text around the active indicator

Required:

- remove any mojibake or broken glyphs
- verify all changed faculty-facing copy renders cleanly

### 4. Copy family still needs final normalization

Required:

- keep one consistent plain-language vocabulary across:
  - shell
  - `/my`
  - `/my/schedule`
  - `/my/preferences`
  - `/my/room-preferences`
- make sure the wording feels intentional and professional, not partially technical

## Required Product Outcome

After this pass:

1. the faculty schedule page shows a real readable school-year badge
2. saved/live/offline states are distinguishable in simple teacher-facing language
3. no faculty-facing mojibake remains
4. the faculty portal feels polished enough to close this stream

## Implementation Direction

- keep the current structure
- prefer small targeted fixes
- preserve all current backend/runtime behavior
- do not add new explanatory clutter
- optimize for clarity and polish

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify `/my/schedule` no longer shows numeric school-year ID as the main school-year badge
- verify remaining faculty source-state copy is plain-language and consistent
- verify no mojibake remains in `AppShell` or touched faculty pages
- verify no raw HTML interactive controls were introduced

## Required Output

Return:

1. files changed
2. school-year label fix summary
3. source-state copy cleanup summary
4. mojibake cleanup summary
5. verification results
6. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the faculty portal no longer exposes internal numeric school-year identity as user-facing schedule context
- faculty offline/live copy is consistent and natural
- all touched text renders cleanly
- the faculty offline publish UX is closure-grade for this stream
