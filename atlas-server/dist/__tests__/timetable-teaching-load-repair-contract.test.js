/**
 * Source contract checks for timetable-embedded Teaching Load repairs.
 *
 * Run with: npx tsx atlas-server/src/__tests__/timetable-teaching-load-repair-contract.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const repoRoot = resolve(import.meta.dirname, '../../..');
const service = readFileSync(resolve(repoRoot, 'atlas-server/src/services/timetable-teaching-load-repair.service.ts'), 'utf8');
const router = readFileSync(resolve(repoRoot, 'atlas-server/src/routes/timetable-teaching-load-repair.router.ts'), 'utf8');
const app = readFileSync(resolve(repoRoot, 'atlas-server/src/app.ts'), 'utf8');
const dock = readFileSync(resolve(repoRoot, 'atlas-client/src/components/timetable/TacticalSandboxDock.tsx'), 'utf8');
const timetableData = readFileSync(resolve(repoRoot, 'atlas-client/src/hooks/useTimetableData.ts'), 'utf8');
const appShell = readFileSync(resolve(repoRoot, 'atlas-client/src/components/AppShell.tsx'), 'utf8');
const preGenerationDraftService = readFileSync(resolve(repoRoot, 'atlas-server/src/services/pre-generation-draft.service.ts'), 'utf8');
assert(router.includes('/teaching-load-repairs/preview'), 'Preview endpoint is exposed under generation review scope.');
assert(router.includes('/teaching-load-repairs/apply'), 'Apply endpoint is exposed under generation review scope.');
assert(app.includes("timetableTeachingLoadRepairRouter"), 'Teaching Load repair router is mounted in app.ts.');
assert(service.includes('RUN_ALREADY_PUBLISHED'), 'Published runs are blocked from canonical Teaching Load repair.');
assert(service.includes('expectedRunVersion'), 'Apply contract enforces run version checks.');
assert(service.includes('FACULTY_VERSION_CONFLICT'), 'Apply contract enforces faculty Teaching Load version checks.');
assert(service.includes('targetFacultyIds.has(facultyId)'), 'Repair validation only blocks inactive target/replacement teachers.');
assert(service.includes('The replacement teacher is no longer active for scheduling'), 'Inactive replacement blocker is scheduler-readable.');
assert(service.includes("kind: 'UNASSIGNED'"), 'Repair contract supports unassigned-session Teaching Load changes.');
assert(service.includes('buildUnassignedKey'), 'Repair contract uses a stable unassigned-session identity.');
assert(service.includes('placementProposal'), 'Repair contract supports optional placement after Teaching Load repair.');
assert(service.includes('applyProposalBatch'), 'Placement after Teaching Load repair reuses manual-edit placement logic.');
assert(service.includes('unassignedReadiness'), 'Preview/apply responses expose unassigned readiness feedback.');
assert(service.includes('computeGenerationInputSnapshot'), 'Apply refreshes generation input snapshot trust state after Teaching Load repair.');
assert(service.includes('tx.subjectSectionOwnership.upsert'), 'Apply contract writes normalized SubjectSectionOwnership.');
assert(service.includes('tx.facultySubject.update'), 'Apply contract updates FacultySubject section scopes.');
assert(service.includes('draftEntries: newEntries'), 'Apply contract updates the active generated draft entries.');
assert(service.includes('matchingEntryIndexes'), 'Apply contract updates every generated entry in the selected subject/section scope.');
assert(service.includes('COHORT_REPAIR_UNSUPPORTED'), 'Repair contract blocks cohort entries until section coverage repair is explicit.');
assert(service.includes("action: 'TIMETABLE_TEACHING_LOAD_REPAIR'"), 'Apply contract writes an audit log action.');
assert(!service.includes('generationRun.create'), 'Apply contract does not create a new generation run.');
assert(timetableData.includes('selectedRunIdRef'), 'Timetable data hook preserves explicit run selection without resetting to latest.');
assert(appShell.includes('key={`${crumb.label}-${i}`}'), 'Breadcrumb keys disambiguate duplicate group/item labels.');
assert(preGenerationDraftService.includes('loadSectionSnapshot'), 'Pre-generation draft board can fall back to cached section snapshots when upstream sections are unavailable.');
assert(dock.includes('Timetable and Teaching Load do not match'), 'Dock shows source-honest mismatch copy.');
assert(dock.includes('Use Teaching Load owner'), 'Dock exposes action to trust canonical Teaching Load.');
assert(dock.includes('Save Teaching Load and update timetable'), 'Dock exposes the required unpublished primary action copy.');
assert(dock.includes('Unassigned session'), 'Dock exposes unassigned-session repair context.');
assert(dock.includes('Save Teaching Load'), 'Dock exposes ownership-only save copy for unassigned sessions.');
assert(dock.includes('Teaching Load will not be rewritten from this published repair'), 'Dock explains published revision-only behavior.');
console.log('[timetable-teaching-load-repair-contract] OK');
//# sourceMappingURL=timetable-teaching-load-repair-contract.test.js.map