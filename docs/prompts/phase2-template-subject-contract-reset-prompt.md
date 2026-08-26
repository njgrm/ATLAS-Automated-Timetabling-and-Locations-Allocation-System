# Copilot Execution Prompt: Phase 2 Template + Subject Contract Reset

Run this after:
- `docs/prompts/phase2-timetable-shape-refactor-prompt.md`
- `docs/prompts/phase2-policy-window-reconciliation-prompt.md`

This prompt exists because the live template bindings, subject inventory, workbook-derived structure, and EnrollPro upstream contract are no longer aligned.

## Goal
Realign class templates, subject bundles, and subject-program scope rules so ATLAS simulates the stakeholder timetable structure using the correct source of truth:
- EnrollPro decides which special programs and TLE specializations are actually offered,
- ATLAS decides how those offerings become schedulable subjects, templates, and generation rules.

This pass must no longer rely on workbook access by the implementing agent. The workbook is a structural reference only. The live EnrollPro contract is authoritative for current special-program and TLE offering state.

## Scope

In scope:
- subject inventory cleanup
- class-template subject bundle cleanup
- subject-program scope rules for regular and special programs
- EnrollPro-driven activation/materialization rules for special-program and TLE subject rows
- special-program assumptions needed to simulate workbook-style output when upstream detail is still incomplete

Out of scope:
- final KPI closure claim
- broad publish/faculty UX work
- unrelated schema expansion not needed for the contract reset

## Required Inputs
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/analysis/phase2-shift-window-workbook-gap-report-2026-05-16.md`
- `docs/phases/refactor-implementation-phases-2026-05-15.md`
- `docs/verification/evidence-log.md`
- `prisma/seed.js`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/class-template.service.ts`
- `atlas-server/src/services/subject-program-scope.service.ts`
- `atlas-server/src/services/cohort.service.ts`
- `atlas-server/src/services/section-adapter.ts`
- `atlas-client/src/components/subjects/*`
- `SSE-PLAN/CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx`
- `EnrollPro/docs/features/integration/ENROLLPRO-API.md`

## Validated Standards To Treat As Fact
- `DepEd Order No. 46, s. 2012`:
  - special curricular programs replace `TLE` in the core curriculum,
  - all other core subjects remain part of the learner load,
  - schools may enrich the curriculum with advanced/specialized subjects after the core + special-program requirements are met.
- `DepEd Order No. 25, s. 2015`:
  - SPS subject nomenclature should be modeled as `Special Program in Sports: (Specialization)`,
  - SPS is a four-year program layered on the regular JHS curriculum with sports specialization.
- DepEd TLE / TVL standards:
  - Grades 7-8 TLE is exploratory and should cover the four exploratory areas `ICT`, `AFA`, `FCS`, `IA`,
  - Grades 9-10 TLE may branch into specialization choices aligned to TVL strands.
- DepEd SPA references:
  - SPA art forms include `Music`, `Visual Arts`, `Theater Arts`, `Media Arts`, `Creative Writing`, `Dance`, and `Traditional Arts`.

## Live EnrollPro Contract Facts To Treat As Fact
These findings were validated against the live `dev-jegs` Tailnet environment on `2026-05-17`.

- Public SCP offering feed:
  - `GET /api/settings/scp-config`
  - currently returns offered program flags for:
    - `SCIENCE_TECHNOLOGY_AND_ENGINEERING`
    - `SPECIAL_PROGRAM_IN_THE_ARTS`
    - `SPECIAL_PROGRAM_IN_SPORTS`
  - this feed does not expose `artFields`, `sportsList`, or strand-level scheduling detail.
- Public section feed:
  - `GET /api/integration/v1/sections`
  - currently exposes:
    - `programType`
    - `gradeLevel`
    - `tleProgramId`
    - `tleSpecialization`
    - `tleProgramCategory`
  - therefore EnrollPro is already the authoritative live source for which grade-level sections currently carry a TLE specialization.
- Protected curriculum feed:
  - `GET /api/curriculum/:ayId/scp-config`
  - can expose:
    - `artFields`
    - `languages`
    - `sportsList`
    - SCP steps/rubrics
  - but the current live dataset still returns empty arrays for `artFields` and `sportsList`.
- Protected admin TLE catalog:
  - `GET /api/admin/tle-programs`
  - currently returns a real active TLE specialization catalog such as:
    - `ICT`
    - `HE - Cookery`
    - `HE - Baking and Pastry Arts`
    - `HE - Caregiving`
    - `IA - Carpentry`
    - `IA - Electrical Installation`
    - `IA - Electronics`
    - `IA - Shielded Metal Arc Welding`
    - `AFA - Crop Production`
    - `AFA - Fishery Arts`
    - `AFA - Swine Production`
- Current live section mix:
  - regular and STE sections exist in the live section feed,
  - no live SPA or SPS sections are currently surfaced in the active section list even though both are offered in SCP config,
  - TLE specialization is already attached to some Grade 9 and Grade 10 regular sections.

## Source-of-Truth Rules
Use these rules instead of assuming every possible SPA/SPS/TLE subject should be permanently seeded and toggled manually.

- EnrollPro is the source of truth for:
  - which SCP program types are offered this school year,
  - which sections belong to which upstream program type,
  - which grade-level sections currently own a TLE specialization,
  - which TLE programs exist in the active catalog.
- ATLAS is the source of truth for:
  - schedulable subject rows,
  - weekly minutes,
  - room requirements,
  - template membership,
  - generation behavior.
- Therefore:
  - ATLAS should keep core baseline subjects locally,
  - ATLAS should activate/materialize special-program and TLE rows based on EnrollPro offerings and catalog data,
  - ATLAS should not blindly hard-seed all hypothetical SPA/SPS/TLE variants as always-active rows.

## Workbook-Derived Facts To Treat As Fact
- The available workbook is only Grade 8, but it is the best current structural sample and should be treated as representative unless newer stakeholder data in this repo contradicts it.
- Grade 8 `REGULAR/BEC` sample sections show the weekly core load as:
  - `FILIPINO` = `240`
  - `ENGLISH` = `240`
  - `MATH` = `240`
  - `SCIENCE` = `240`
  - `AP` = `240`
  - `ESP/GMRC` = `240`
  - `MAPEH` = `240`
  - `TLE` = `240`
- Grade 8 `STE` sample sections show a different program shape:
  - core academic subjects appear at `90` minutes/week each in the sample,
  - specialized overlays appear at `45` minutes/week each in the sample,
  - observed overlay subjects include `RESEARCH`, `ICT`, `BIOTECH`, and `DEVL READING`.
- Grade 8 `SPA` sample sections show:
  - core academic subjects still present,
  - `SPA SPECIALIZATION` and `DEVL READING` overlays,
  - the workbook is old-state and may still show local legacy practice such as `TLE` appearing in a special-program section even though current DepEd policy direction says SCPs replace TLE.

## Stakeholder Subject Matrix To Implement
Use this matrix as the ATLAS translation layer between EnrollPro offerings and schedulable subject rows. Do not treat it as a command to permanently activate every row regardless of upstream state.

### 1. Core academic bundle
Seed and keep active these core rows:
- `FIL` = `Filipino`
- `ENG` = `English`
- `MATH` = `Mathematics`
- `AP` = `Araling Panlipunan`
- `ESP` = `ESP/GMRC`
- `MAPEH` = `MAPEH`
- `HG` = `Homeroom Guidance`

Core bundle rules:
- `FIL`, `ENG`, `MATH`, `AP`, `ESP`, `MAPEH`, and `HG` are not regular-only in practice; special programs inherit them too.
- Do not rely on `programScopes=['REGULAR']` plus hardcoded program exceptions as the long-term contract.
- Make the data contract explicit enough that `STE`, `SPA`, and `SPS` can consume the core bundle without heuristic fallback.
- Keep these rows as ATLAS-owned local baseline data even when special-program offerings come from EnrollPro.

### 2. Regular science contract
Regular science must stop binding to legacy `SCI`.

Target regular science contract:
- `SCI_BIO` = `Science - Biology`
- `SCI_CHEM` = `Science - Chemistry`
- `SCI_ES` = `Science - Earth Science`

Transition rule:
- `SCI` must not remain in active template bindings.
- `SCI_PHYS` must not remain silently treated as part of the regular tri-sem bundle.
- If `SCI_PHYS` is still needed for backward compatibility, isolate it as transitional and log it explicitly.

### 3. STE specialized subjects
Replace the old mixed STE rows with grade-specific stakeholder-aligned rows.

Required STE rows:
- Grade 7:
  - `STE_ENV_SCI` = `Environmental Science`
  - `STE_RESEARCH` = `Research`
- Grade 8:
  - `STE_BIOTECH` = `Biotechnology`
  - `STE_RESEARCH` = `Research`
  - `STE_ICT` = `ICT`
- Grade 9:
  - `STE_APPLIED_CHEM` = `Applied Chemistry`
  - `STE_RESEARCH` = `Research`
- Grade 10:
  - `STE_APPLIED_PHYS` = `Applied Physics`
  - `STE_ROBOTICS` = `Robotics`
  - `STE_RESEARCH` = `Research`

STE transition rules:
- Deactivate or clearly retire conflicting legacy rows such as:
  - `ADVANCED_CHEMISTRY`
  - `ADVANCED_PHYSICS`
  - `ADVANCED_STATISTICS`
  - `BASIC_STATISTICS`
  - `ELECTRONICS`
  - `ENVIRONMENTAL_SCIENCE`
  - `CONSUMERS_CHEMISTRY`
  - `ELECTRONICS_ROBOTICS`
- Do not reactivate plain legacy `ICT` as a broad regular row.
- If the system still needs an ICT-related STE subject, use a dedicated scoped row such as `STE_ICT`.

### 4. SPA specialized subjects
SPA specialization rows must be driven by EnrollPro availability, not permanently activated by seed alone.

Required SPA rows:
- `SPA_SPEC` = `Special Program in the Arts: Specialization`
- `DEVL_READING` = `Developmental Reading`

SPA contract rules:
- If EnrollPro only says SPA is offered, but does not provide populated `artFields`, keep SPA on an umbrella specialization model.
- If EnrollPro later provides populated `artFields`, materialize or activate only the supported SPA specialization variants from that upstream list.
- Do not hardcode a permanent all-strands-active SPA inventory unless the live upstream contract actually exposes those strands.

Fallback assumptions when upstream detail is missing:
- `allowedSpecializations` should support at least:
  - `MUSIC`
  - `VISUAL_ARTS`
  - `THEATER_ARTS`
  - `MEDIA_ARTS`
  - `CREATIVE_WRITING`
  - `DANCE`
  - `TRADITIONAL_ARTS`
- Do not create seven separate mandatory SPA subjects unless the current runtime truly requires per-art-form rows.
- Prefer one umbrella SPA specialization subject plus specialization metadata over hardcoding one school's strand list into the template bundle.

### 5. SPS specialized subjects
SPS specialization rows must be driven by EnrollPro availability, not permanently activated by seed alone.

Required SPS rows:
- `SPS_SPEC` = `Special Program in Sports: Specialization`

SPS contract rules:
- If EnrollPro only says SPS is offered, but does not provide populated `sportsList`, keep SPS on an umbrella specialization model.
- If EnrollPro later provides populated `sportsList`, materialize or activate only the supported SPS specialization variants from that upstream list.
- Do not hardcode a permanent all-sports-active SPS inventory unless the live upstream contract actually exposes those sports.

Fallback assumptions when upstream detail is missing:
- `allowedSpecializations` should support at least common DepEd-approved sports such as:
  - `ATHLETICS`
  - `SWIMMING`
  - `BASKETBALL`
  - `VOLLEYBALL`
  - `FOOTBALL`
  - `SEPAK_TAKRAW`
  - `SOFTBALL`
  - `BASEBALL`
  - `BADMINTON`
  - `TABLE_TENNIS`
  - `TAEKWONDO`
  - `TENNIS`
  - `CHESS`
  - `GYMNASTICS`
  - `ARCHERY`
  - `ARNIS`

### 6. TLE exploratory + specialization subjects
Do not treat all TLE behavior as one monolithic `TLE` forever.

Grades 7-8 exploratory TLE areas to seed as explicit rows:
- `TLE_ICT_EXP` = `TLE Exploratory - ICT`
- `TLE_AFA_EXP` = `TLE Exploratory - Agriculture and Fishery Arts`
- `TLE_FCS_EXP` = `TLE Exploratory - Family and Consumer Science`
- `TLE_IA_EXP` = `TLE Exploratory - Industrial Arts`

Grades 9-10 specialization choices should be materialized from the live EnrollPro TLE catalog rather than from a frozen hardcoded list.

Examples currently visible in the live EnrollPro TLE catalog:
- `ICT`
- `HE - Cookery`
- `HE - Baking and Pastry Arts`
- `HE - Caregiving`
- `IA - Carpentry`
- `IA - Electrical Installation`
- `IA - Electronics`
- `IA - Shielded Metal Arc Welding`
- `AFA - Crop Production`
- `AFA - Fishery Arts`
- `AFA - Swine Production`

TLE modeling rules:
- The active TLE specialization catalog must be sourced from EnrollPro, not hardcoded only from this prompt.
- Section ownership of TLE specializations must be sourced from EnrollPro section data because those sections are created there.
- Keep the existing generic `TLE` row only if it is still needed as a transitional regular-template placeholder.
- Do not bind every exploratory and specialization TLE subject to every regular template.
- Grades 7-8 exploratory rows should be available for exploratory rotation logic.
- Grades 9-10 specialization rows should be modeled as cohort/specialization-driven rows tied to upstream `tleProgramId` / `tleSpecialization`, not blanket whole-section requirements unless the section is explicitly specialization-specific.
- If EnrollPro already provides a live TLE program that differs from this prompt's older assumption list, prefer the live EnrollPro catalog.

## Required Sync Direction
Implement an upstream-driven contract instead of a static seed-only contract.

### EnrollPro-driven activation
- Use EnrollPro `scp-config` to decide whether `STE`, `SPA`, `SPS`, and other SCP templates/subject families should be active.
- Use EnrollPro `integration/v1/sections` to understand section ownership by:
  - `gradeLevel`
  - `programType`
  - `tleProgramId`
  - `tleSpecialization`
  - `tleProgramCategory`
- Use EnrollPro `admin/tle-programs` or equivalent protected catalog access to drive the active TLE specialization inventory.

### ATLAS translation layer
- ATLAS should translate upstream offerings into schedulable subject rows and template bindings.
- ATLAS should not require EnrollPro to expose scheduling-only fields like room type or minutes/week.
- ATLAS should not auto-activate SPA/SPS detail rows when upstream only exposes program-level on/off flags.

## Required Seed Attributes
When seeding or cleaning up rows, use the available subject fields deliberately instead of defaulting everything.

Interpret "seed" here as:
- keep baseline local rows for core/regular scheduling,
- create or update translation rows that ATLAS needs,
- activate/deactivate special rows according to upstream offerings,
- preserve enough local defaults for offline or fallback behavior.

For each target subject row, explicitly decide and set:
- `code`
- `name`
- `minMinutesPerWeek`
- `preferredRoomType`
- `gradeLevels`
- `isSeedable`
- `programScopes`
- `allowedSpecializations`
- `requiredFeatures`
- `modularGroupId` / `modularOrder` / `termGroupId` / `termCount` when applicable
- `interSectionEnabled` / `interSectionGradeLevels` when applicable

Use these defaults unless the codebase already provides a stronger contract:
- Core regular/BEC subjects:
  - `240` minutes/week for regular sections
- `HG`:
  - keep non-seedable and non-core-template by default unless the current runtime already depends on it
- STE / SPA / SPS specialized overlays:
  - use the workbook-observed `45` minute overlay assumption as the initial default
- Special-program core rows:
  - do not fake them with the regular `240` value if the template/binding model can now support differentiated minutes

## Structural Limitation You Must Resolve Or Escalate
The current model is not sufficient if all of the following remain true:
- one `Subject.minMinutesPerWeek` value applies globally,
- one `ClassTemplate` exists per `programType`,
- subject bindings do not carry grade-specific or template-specific minute overrides.

That model cannot represent:
- Grade 8 regular core at `240` minutes/week,
- Grade 8 STE core at `90` minutes/week,
- grade-specific STE bundles for Grades 7, 8, 9, and 10,
- SPA/SPS overlays that differ from regular sections,
- TLE specialization ownership that changes by section and grade.

Therefore, before claiming success, do one of these:
1. Add a binding-level or template-level mechanism that can represent per-template/per-grade subject load; or
2. Expand the template model so grade-specific program bundles are real, explicit data; or
3. Return `NO-GO` and state exactly why the current schema cannot model the stakeholder schedule truthfully.

## Incidental Error Recovery Rule
If you discover a concrete compile error, type drift, contract mismatch, or adjacent regression while executing this prompt:
- fix it in the same pass when the fix is local and low-risk,
- do not defer it just because it sits slightly outside the named template/subject scope,
- explicitly log it in the final response and evidence update as:
  - `discovered out-of-scope issue`
  - `why it blocked or threatened the scoped work`
  - `how it was fixed`
  - `what verification was rerun`

If the discovered issue is too large to fix safely in the same pass:
- stop and return `NO-GO`,
- list it explicitly as a blocker with file references.

## Workbook Assumption
Use the Grade 8 workbook as representative of stakeholder structure for program load:
- regular sections carry the core bundle,
- special programs carry the regular core plus specialized overlays,
- special programs may have differentiated minutes or subject families.

Do not treat quarter-era sheet names as proof that next-school-year science must remain quarter-based.

## Mandatory First Step
Before editing:
1. Audit the live mismatch between:
   - active subject rows
   - seed/default subject rows
   - live class-template subject bindings
   - workbook-observed subject families
   - live EnrollPro offering feeds
2. List the mismatches grouped as:
   - stale active subject rows
   - broken template bindings
   - special-program scope gaps
   - EnrollPro-to-ATLAS sync gaps
   - tri-sem/quarter transition ambiguities
   - any compile-time or contract regressions uncovered while touching this area
3. Then implement the reset.

As part of the audit, explicitly answer these questions in the implementer response before writing "done":
- Can the current schema represent different weekly minutes for the same subject between `REGULAR` and `STE`?
- Can the current template model represent different STE specialized bundles for Grades `7`, `8`, `9`, and `10`?
- Are current subject-program scope rules sufficient for `SPS`, or are they still effectively `REGULAR`-only?
- Are TLE exploratory and specialization subjects modeled as real data rows, or still collapsed into one generic `TLE`?
- Which parts of SPA/SPS/TLE detail are actually available from live EnrollPro data today?

## Required Direction

### A. Clean up template subject bundles
- Remove template bindings that still point at legacy subject codes like `SCI` and `RESEARCH_I`.
- Ensure templates reference the active subject contract.
- Do not keep one generic `STE` template if that still forces all grades to share the same specialized subject bundle.

### B. Clarify core-vs-special scope rules
- Regular core subjects must remain usable for special-program sections where stakeholder structure requires it.
- SPS and similar programs must not be reduced to regular-only behavior if they are supposed to carry specialized overlays.
- If `programScopes` remain too narrow, widen the data contract or update the matching logic so `STE`, `SPA`, and `SPS` inherit the core bundle intentionally rather than accidentally.

### C. Reduce live subject ambiguity
- Resolve stale active subject rows that conflict with the intended simulation model.
- Keep only the subject inventory needed for the current stakeholder-aligned timetable model, or clearly isolate transitional rows.
- Deactivate conflicting legacy STE rows instead of leaving multiple competing subject names active for the same grade/program slot.

### D. Keep configurability explicit
- The result must support future school-specific template tuning without hardcoding one workbook forever.
- Use umbrella specialization rows plus metadata where the current upstream contract does not yet expose a final strand list.

### E. Make the prompt executable without Excel access
- Encode the subject matrix directly in code/data changes and evidence so a future implementer does not need to reopen the workbook to understand what was intended.

### F. Prefer live upstream context over static assumptions
- TLE specialization ownership should come from EnrollPro because TLE sections and TLE program assignment are already managed there.
- SPA and SPS should also become upstream-driven once EnrollPro starts supplying populated specialization lists.
- Until then, keep SPA/SPS as umbrella models and log the missing upstream detail explicitly rather than pretending it exists.

## Hard Rules
- Do not leave template bundles referencing dead or legacy codes.
- Do not treat special programs as regular-only unless stakeholder rules explicitly say so.
- Do not overclaim tri-sem completion if science transition remains unresolved.
- Do not ignore the grade-specific STE bundle problem.
- Do not claim workbook alignment if the runtime still cannot represent program-specific weekly minutes.
- Do not ignore live EnrollPro offering data in favor of stale local assumptions.
- Do not auto-activate SPA/SPS specialization variants that EnrollPro has not actually populated.

## Verification Gates
- affected server typecheck/build
- relevant template/subject tests
- data checks showing template bundles now reference valid active subjects
- evidence that special-program sections can inherit regular core plus their allowed special overlays
- data checks proving the new subject rows exist with the intended grades, scopes, and specialization metadata
- explicit proof that deprecated conflicting rows were deactivated or isolated
- explicit explanation of how per-grade/per-template subject minutes are modeled after this pass
- explicit proof of which upstream EnrollPro feeds were used to decide activation/materialization
- explicit proof that active TLE specialization rows match the current EnrollPro catalog and section ownership data
- explicit statement whether SPA/SPS upstream specialization arrays were populated or still empty
- rerun any verification needed for incidental out-of-scope fixes discovered during the pass

## Evidence Update
Append a narrow evidence entry recording:
- subject/template contract changes
- commands run
- any discovered out-of-scope issue fixed during this pass, including why it was repaired here
- what transitional ambiguities remain
- which upstream EnrollPro fields were authoritative
- whether SPA/SPS detail is still blocked by empty upstream specialization arrays
- whether science transition is still a stakeholder decision point

## GO / NO-GO
Return `GO` only if:
- template bundles reference valid active subject rows,
- subject-program scope rules match the workbook-derived structural model,
- live subject ambiguity is materially reduced,
- upstream EnrollPro offerings are reflected correctly in activation/materialization behavior,
- the model can represent the stakeholder's grade/program subject truth without relying on hidden manual assumptions.

Return `NO-GO` if legacy bundle drift remains.
