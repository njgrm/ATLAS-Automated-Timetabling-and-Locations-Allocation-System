findings 11 · BLOCKER 3 · MAJOR 4 · MINOR 4

Audit basis: `origin/main` at `4c515b01e7fe4ebe60256e16115c60aac87cce77`, after the required fetch. Tests and the known Teachers > Review Load sites were excluded from findings.

## 1. Opaque IDs used as values, labels, or ordering

| Finding and exact code | Why it is wrong and what the user sees | Severity | One-line fix |
|---|---|---|---|
| **`atlas-server/src/services/pre-generation-draft.service.ts:735-739`**<br>`const shiftWindow = gradeWindows.find((window) => window.gradeLevel === grade.gradeLevelId && normalizeProgramType(window.programType) === programType)`<br>`?? gradeWindows.find((window) => window.gradeLevel === grade.gradeLevelId && normalizeProgramType(window.programType) === 'ALL');`<br>`...`<br>`gradeLevel: grade.gradeLevelId,` | `GradeShiftWindow.gradeLevel` is an academic grade, while `grade.gradeLevelId` is EnrollPro's re-minted key. This code misses the grade window for IDs such as 17–20, falls back to school-wide hours, and builds a draft shape keyed to the opaque number. On **Timetable draft / manual scheduling**, users can get the wrong shift and break grid. | **BLOCKER** | Resolve the section/group grade from `gradeLevelName` with `resolveSectionGradeLevel` once, then use that value for window lookup and `buildTimetableShapeContract`. |
| **`atlas-server/src/services/published-schedule.service.ts:709`** `gradeLevel: section.gradeLevelId,`<br>consumed by **`atlas-client/src/lib/public-schedule-grade.ts:12-15`**:<br>`if (gradeLevel != null && Number.isInteger(gradeLevel) && gradeLevel >= 7 && gradeLevel <= 10) { return gradeLevel; }`<br>`return parseJuniorHighGrade(gradeLevelName) ?? parseJuniorHighGrade(sectionName);` | The API sends an opaque ID as `gradeLevel`; the public client trusts any 7–10 value before the authoritative name. The repository's grade resolver explicitly maps legacy ID 7→Grade 9 and 8→Grade 10, so published schedules can show/filter those sections as the wrong grade. On **Public Published Schedule**, users see wrong Grade/GR badges and filter results. | **MAJOR** | Send a resolved academic grade from the server, or make the client resolve `gradeLevelName`/section name before considering a numeric ID. |
| **`atlas-server/src/services/official-program-docx.service.ts:285`**<br>`text(\`GRADE ${section.gradeLevelName ?? section.gradeLevelId}    SECTION ${section.name} ...\`)` | A missing/stale grade name makes an official class-program document print the opaque EnrollPro key (`GRADE 17`, etc.), not the grade. The same unsafe fallback is used to choose grade documents at lines 140 and 212. Users see it in the **official Class Program DOCX export**. | **MAJOR** | Use the shared name-first grade resolver and render `GRADE ${resolvedGrade}`; reject/export a clear unavailable state if it cannot resolve. |
| **`atlas-client/src/pages/Sections.tsx:652`** `cmp = a.gradeLevelId - b.gradeLevelId;`<br>and **`atlas-server/src/services/workbook-export.service.ts:625`** `if (a.gradeLevelId !== b.gradeLevelId) return a.gradeLevelId - b.gradeLevelId;` | Opaque, re-minted IDs determine visible grade order. A rollover can reorder Grades 7–10 even though their labels are correct. Users see unstable ordering in the **Sections table** and the **summary workbook export**. | **MINOR** | Sort by resolved academic grade (then section name), never by `gradeLevelId`. |

## 2. ID-space mixing and school-year identity

| Finding and exact code | Why it is wrong and what the user sees | Severity | One-line fix |
|---|---|---|---|
| **`atlas-server/src/routes/faculty.router.ts:169`**, **`atlas-server/src/routes/section.router.ts:267`**, and **`atlas-server/src/routes/section.router.ts:465`** all use:<br>`schoolYearId = activeYear?.id ?? 1;` | If the EnrollPro active-year request fails or is empty, these write handlers silently treat the literal `1` as an EnrollPro year ID. That is precisely an arbitrary ID-space choice: it can be the old upstream year rather than the intended current/mirror year. The **faculty sync**, **section sync**, and **special-program placement overlay** can report success against the wrong school year and write stale data there. | **BLOCKER** | Require a valid `activeYear.id` (or an explicitly validated EnrollPro ID) and return a typed upstream/identity error instead of defaulting to `1`. |

## 3. JHS domain assumptions and fixed workload limits

| Finding and exact code | Why it is wrong and what the user sees | Severity | One-line fix |
|---|---|---|---|
| **`atlas-server/src/services/teaching-load-automation.service.ts:1209`**<br>`const recommendedNewHires = Math.round((concurrentMissingHoursPerWeek / (STANDARD_CAP_MIN / 60)) * 10) / 10;`<br>where **lines 83-85** set `STANDARD_CAP_MIN = WORKLOAD_DEFAULTS.teachingStandardMinutes` (1,800 minutes / 30h). | The staffing-report function receives neither a persisted workload policy nor a policy standard, so both its capacity logic and its hire estimate fall back to the module's 30-hour default. This contradicts the persisted per-school-year workload contract and produces a wrong denominator whenever the school configures another standard. On **Teaching Load → Auto-fill / staffing needs**, the UI renders the result as `Target ~… full-time hires` (`AutoFillSummaryModal.tsx:556`). | **MAJOR** | Pass the effective persisted workload policy into `buildStaffingReport` and use its teaching-standard minutes for capacity and the hire denominator. |

## 4. Placeholder teachers counted as real staff

| Finding and exact code | Why it is wrong and what the user sees | Severity | One-line fix |
|---|---|---|---|
| **`atlas-server/src/services/generation-preflight.service.ts:801-803`** loads active faculty with only `id`, `maxHoursPerWeek`, `ancillaryMinutesPerWeek`, `department`, `isActiveForScheduling`, and `isStale`.<br>**Lines 541-542** type the map as `Map<number, { isActiveForScheduling: boolean; isStale: boolean }>` and **558** accepts an owner unless `!faculty \|\| faculty.isStale \|\| !faculty.isActiveForScheduling`. | `isPlaceholder` is neither selected nor checked. An active, non-stale “to be hired” owner therefore increments `ownedPairs` rather than becoming missing coverage. On **Timetable generation readiness/preflight**, a shortage can be shown as covered/ready and allow a misleading readiness result. | **BLOCKER** | Select `isPlaceholder`, carry it in the map, and treat it as missing/uncovered wherever preflight validates pair ownership. |

## 5. Units, periods, and denominators

| Finding and exact code | Why it is wrong and what the user sees | Severity | One-line fix |
|---|---|---|---|
| **`atlas-server/src/services/workbook-export.service.ts:1065-1068`**<br>`totalsRow.getCell(1).value = 'TOTAL MINUTES PER DAY';`<br>`const weekTotalMinutes = WEEKDAYS.reduce((sum, day) => sum + dailyMinutes[day], 0);`<br>`totalsRow.getCell(2).value = weekTotalMinutes;`<br>The same pattern is in **`atlas-server/src/services/room-program-export.service.ts:216-219`**. | Column 2 is a five-day weekly total but is labelled “per day.” The source comment itself identifies this as a genuine defect. Users see a misleading total in **Teacher/Class Program XLSX** and **Room Program XLSX** exports, which can be used for staffing decisions. | **MAJOR** | Label column 2 `TOTAL MINUTES PER WEEK` (or replace it with an actual per-day value); retain the individual daily columns. |

## 6. Raw IDs and garbled text rendered to users

| Finding and exact code | Why it is wrong and what the user sees | Severity | One-line fix |
|---|---|---|---|
| **`atlas-client/src/components/SchedulingPolicyPane.tsx:723`** `explanation="Start of the lunch window G�� no classes will overlap this range."`<br>**`:735`** `explanation="End of the lunch window G�� classes resume after this time."`<br>**`:862`** `<span className="font-medium">G��n+� Warning:</span>` | These are rendered strings, not comments. On **Scheduling Policy**, lunch guidance and the flexible-assignment safety warning contain replacement/garbled characters, undermining the meaning of operational settings. | **MINOR** | Replace the corrupted literals with verified UTF-8 text (for example, em dash and warning icon/text) and add a UTF-8 render/string check. |
| **`atlas-client/src/components/faculty-shared/ConflictInspector.tsx:103`** `âš  Please provide a reason to continue.` | The required-reason warning in the **Conflict Inspector** is visibly mojibake rather than a warning icon or clean sentence. | **MINOR** | Replace the literal with a verified UTF-8 warning string/icon and keep source files UTF-8. |
| **`atlas-client/src/components/LockPanel.tsx:108`** `return \`${subject?.code ?? \`Subj #${placement.subjectId}\`} ? ${section?.name ?? \`Section #${placement.sectionId}\`}\`;`<br>and **`:533`** `{activeSectionId ? sections.get(activeSectionId)?.name ?? \`Section #${activeSectionId}\` : 'Select a section'}` | The manual **Timetable Lock/placement panel** exposes internal section/subject IDs whenever its lookup data is incomplete instead of a user-safe unavailable state. This is especially misleading because entries use external section IDs while the lookup is a separate client map. | **MINOR** | Render `Unknown/unavailable section` and block the action until the scoped lookup resolves; keep raw IDs only in developer diagnostics. |

## Top 5 to fix before a demo tomorrow

1. **Pre-generation draft grade resolution** — use academic grade for windows and emitted shape (`pre-generation-draft.service.ts:735-739`).
2. **Generation preflight placeholder exclusion** — a “to be hired” record must never make the timetable look staffed (`generation-preflight.service.ts:801-803, 558`).
3. **Fail closed on missing active EnrollPro year** — remove all `activeYear?.id ?? 1` write-path fallbacks.
4. **Published schedule grade contract** — stop passing `SectionMirror.gradeLevelId` as public `gradeLevel`.
5. **Correct official-export totals** — relabel or recompute the weekly number currently called “per day.”
