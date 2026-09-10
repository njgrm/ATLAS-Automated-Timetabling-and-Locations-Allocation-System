import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { deriveSimpleLifecycleAction } from '../simple-timetable-state';
import { isHomeroomGuidanceCode, placementSaveAvailability } from '../timetable-ttc02-insertion';
import { deriveSimplePublishReadiness } from '../../components/timetable/simplePublishReadiness';
import { buildBlockerGroups } from '../../components/timetable/simple/SimpleTaskDrawerHelpers';
import { readinessLabel } from '../../components/timetable/simple/SimpleHeaderHelpers';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function headerContext(overrides: Record<string, unknown> = {}) {
	return {
		schoolYearContext: { activeSchoolYearLabel: 'SY 2029-2030' },
		isPreGenerationWorkspace: false,
		draft: null,
		summary: null,
		hardCount: 0,
		softCount: 0,
		...overrides,
	} as unknown as Parameters<typeof readinessLabel>[0];
}

function generatedDraft(overrides: Record<string, unknown> = {}) {
	return {
		runId: 7,
		unassignedItems: [],
		summary: {},
		...overrides,
	};
}

const label = (prefix: string) => (id: number) => `${prefix} ${id}`;

// --- TT-C04 unified operator lifecycle: exactly one primary next action ---

test('lifecycle legacy matrix is preserved when new inputs are omitted', () => {
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: false }).kind, 'start-draft');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: false, generating: true }).kind, 'generating');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: false, isPreGeneration: true }).kind, 'generate');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true, hardCount: 2 }).kind, 'fix-blockers');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true, unassignedCount: 3 }).kind, 'fix-blockers');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true, softCount: 1 }).kind, 'review-warnings');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true }).kind, 'publish');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true, isPublished: true }).kind, 'published');
	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: true, isPublished: true, unassignedCount: 2 }).kind,
		'review-follow-ups',
	);
});

test('lifecycle unresolved scope is non-interactive and wins over everything', () => {
	const action = deriveSimpleLifecycleAction({ hasGeneratedRun: false, scopeResolved: false });
	assert.equal(action.kind, 'resolve-scope');
	assert.equal(action.disabled, true);
	assert.equal(action.interactive, false);

	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: true, generating: true, scopeResolved: false }).kind,
		'resolve-scope',
	);
	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: true, hardCount: 5, scopeResolved: false }).kind,
		'resolve-scope',
	);
});

test('lifecycle blocked setup routes to repair, never generation or publish', () => {
	const action = deriveSimpleLifecycleAction({ hasGeneratedRun: false, curriculumState: 'blocked' });
	assert.equal(action.kind, 'fix-setup');
	assert.equal(action.label, 'Fix Curriculum Requirements');
	assert.equal(action.interactive, true);

	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: true, hardCount: 4, unassignedCount: 9, curriculumState: 'blocked' }).kind,
		'fix-setup',
	);
	// An in-flight generation keeps its own state; setup repair resumes after it.
	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: false, generating: true, curriculumState: 'blocked' }).kind,
		'generating',
	);
});

test('lifecycle failed newest run with no reviewable run offers retry, never publish', () => {
	const action = deriveSimpleLifecycleAction({ hasGeneratedRun: false, latestRunFailed: true });
	assert.equal(action.kind, 'retry-generate');
	assert.equal(action.interactive, true);

	// Negative: a failed flag must not hijack a reviewable generated run.
	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: true, latestRunFailed: true, hardCount: 1 }).kind,
		'fix-blockers',
	);
	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: true, latestRunFailed: true }).kind,
		'publish',
	);
});

test('lifecycle fails closed while readiness is unresolved or unavailable', () => {
	const checking = deriveSimpleLifecycleAction({ hasGeneratedRun: false, curriculumState: 'loading' });
	assert.equal(checking.kind, 'retry-readiness');
	assert.equal(checking.label, 'Checking setup…');
	assert.equal(checking.disabled, true);
	assert.equal(checking.interactive, false);

	for (const curriculumState of ['unavailable', 'failed'] as const) {
		const retry = deriveSimpleLifecycleAction({ hasGeneratedRun: false, curriculumState });
		assert.equal(retry.kind, 'retry-readiness');
		assert.equal(retry.label, 'Retry setup check');
		assert.equal(retry.disabled, false);
		assert.equal(retry.interactive, true);
	}
});

test('production no-run header consumes the lifecycle action and has no hidden generate bypass', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const noRunStart = header.indexOf('{!hasGeneratedRun && !context.isPreGenerationWorkspace ? (');
	const generatedBranch = header.indexOf('\n\t\t\t) : (', noRunStart);
	assert.ok(noRunStart >= 0 && generatedBranch > noRunStart, 'production no-run branch must exist');
	const noRunBranch = header.slice(noRunStart, generatedBranch);

	assert.match(noRunBranch, /data-testid="timetable-simple-primary-action"/);
	assert.match(noRunBranch, /onClick=\{handleLifecycleAction\}/);
	assert.match(noRunBranch, /\{lifecycleAction\.label\}/);
	assert.doesNotMatch(noRunBranch, /data-testid="timetable-empty-generate-action"/);
	assert.doesNotMatch(noRunBranch, /className="hidden"[\s\S]{0,180}handleTriggerGenerate/);
	assert.equal((noRunBranch.match(/data-testid="timetable-simple-primary-action"/g) ?? []).length, 2,
		'the two conditional render forms must identify the same sole primary action');
});

test('removed hidden generation bypasses are gone from the full header', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	// Neither removed control may exist anywhere in the production header.
	assert.doesNotMatch(header, /timetable-simple-mobile-lifecycle-action/);
	assert.doesNotMatch(header, /timetable-simple-generate-action/);
	// No hidden control may carry a direct generation call.
	assert.doesNotMatch(header, /onClick=\{context\.handleTriggerGenerate\}/);
	assert.doesNotMatch(header, /className="hidden"[\s\S]{0,300}context\.handleTriggerGenerate/);
	// The only direct generation calls left are the visible lifecycle
	// dispatcher and the explicitly gated More-menu item.
	assert.match(header, /case 'retry-generate': context\.handleTriggerGenerate\(\); break;/);
	assert.match(header, /disabled=\{!canPlanOrGenerate\}[\s\S]{0,200}context\.handleTriggerGenerate\(\)/);

	// No-run branch: sole primary is the lifecycle dispatcher, secondary stays
	// preview-only, and no control bypasses the dispatcher.
	const noRunStart = header.indexOf('{!hasGeneratedRun && !context.isPreGenerationWorkspace ? (');
	const generatedBranch = header.indexOf('\n\t\t\t) : (', noRunStart);
	assert.ok(noRunStart >= 0 && generatedBranch > noRunStart, 'production no-run branch must exist');
	const noRunBranch = header.slice(noRunStart, generatedBranch);
	assert.doesNotMatch(noRunBranch, /handleTriggerGenerate/);
	assert.match(noRunBranch, /data-testid="timetable-unassigned-insertion-action"/);
	assert.match(noRunBranch, /Preview demand/);
	assert.match(noRunBranch, /setInsertionOpen\(true\)/);
});

// --- TT-C04 honest readiness copy ---

test('readiness chip never reports generated counts without a run', () => {
	const labelText = readinessLabel(headerContext());
	assert.match(labelText, /No SY 2029-2030 timetable yet/);
	assert.doesNotMatch(labelText, /\d+ blocker|\d+ unresolved|\d+ warning/);
});

test('readiness chip reports unresolved sessions instead of ready to publish', () => {
	const draft = generatedDraft();
	const unresolvedOnly = readinessLabel(headerContext({ draft, summary: { unassignedCount: 3 } }));
	assert.equal(unresolvedOnly, '3 unresolved');
	assert.doesNotMatch(unresolvedOnly, /Ready to publish/);

	// Negative: unresolved wins over softer warnings, never the reverse.
	const unresolvedPlusWarnings = readinessLabel(
		headerContext({ draft, summary: { unassignedCount: 1 }, softCount: 2 }),
	);
	assert.equal(unresolvedPlusWarnings, '1 unresolved');
});

test('readiness chip keeps blockers first and stays honest when clean', () => {
	const draft = generatedDraft();
	assert.equal(
		readinessLabel(headerContext({ draft, hardCount: 2, summary: { unassignedCount: 5 }, softCount: 9 })),
		'2 blockers',
	);
	assert.equal(
		readinessLabel(headerContext({ draft, summary: { unassignedCount: 0 }, softCount: 2 })),
		'2 warnings',
	);
	assert.equal(readinessLabel(headerContext({ draft, summary: { unassignedCount: 0 } })), 'Ready to publish');
});

test('readiness chip distinguishes published follow-ups from clean published', () => {
	const draft = generatedDraft({ summary: { isPublished: true } });
	assert.equal(
		readinessLabel(headerContext({ draft, summary: { unassignedCount: 2 } })),
		'Published with 2 follow-up items',
	);
	assert.equal(readinessLabel(headerContext({ draft, summary: { unassignedCount: 0 } })), 'Published');
	assert.equal(readinessLabel(headerContext({ isPreGenerationWorkspace: true })), 'Planning draft');
});

// --- TT-C04 publish readiness: no run is never clean ---

test('publish readiness without a run is not clean and shows no generated counts', () => {
	const readiness = deriveSimplePublishReadiness(null, [], label('Section'), label('Subject'), label('Teacher'));
	assert.equal(readiness.hasGeneratedRun, false);
	assert.equal(readiness.isClean, false);
	assert.equal(readiness.hasBlockers, false);
	assert.equal(readiness.hasWarnings, false);
	assert.equal(readiness.totalUnresolved, 0);
	assert.equal(readiness.totalHardBlockers, 0);
	assert.match(readiness.summaryText, /No timetable generated yet/);
});

test('publish readiness groups unassigned blockers with a repair destination', () => {
	const draft = generatedDraft({
		unassignedItems: [
			{ sectionId: 1, subjectId: 2, gradeLevel: 8, session: 1, facultyId: 9, reason: 'NO_AVAILABLE_SLOT' },
			{ sectionId: 3, subjectId: 4, gradeLevel: 8, session: 2, facultyId: null, reason: 'NO_AVAILABLE_SLOT' },
		],
	});
	const readiness = deriveSimplePublishReadiness(
		draft as never,
		[],
		label('Section'),
		label('Subject'),
		label('Teacher'),
	);
	assert.equal(readiness.hasGeneratedRun, true);
	assert.equal(readiness.isClean, false);
	assert.equal(readiness.totalUnresolved, 2);
	assert.equal(readiness.blockerGroups.length, 1);
	assert.equal(readiness.blockerGroups[0].plainLabel, 'No allowed time slot was found');
	assert.equal(readiness.blockerGroups[0].actionLabel, 'Place manually');
	assert.ok(readiness.blockerGroups[0].items[0].nextStep.length > 0);
});

test('publish readiness clean run stays publishable; warnings-only is not clean', () => {
	const clean = deriveSimplePublishReadiness(
		generatedDraft() as never,
		[],
		label('Section'),
		label('Subject'),
		label('Teacher'),
	);
	assert.equal(clean.isClean, true);
	assert.match(clean.summaryText, /Ready to publish/);

	const warned = deriveSimplePublishReadiness(
		generatedDraft() as never,
		[{ severity: 'SOFT', code: 'ROOM_TYPE_MISMATCH', entities: {} } as never],
		label('Section'),
		label('Subject'),
		label('Teacher'),
	);
	assert.equal(warned.isClean, false);
	assert.equal(warned.hasWarnings, true);
	assert.equal(warned.hasBlockers, false);
});

// --- TT-C04 Homeroom Guidance can never read as placeable demand ---

test('homeroom guidance codes are detected across spellings', () => {
	assert.equal(isHomeroomGuidanceCode('HG'), true);
	assert.equal(isHomeroomGuidanceCode('hg'), true);
	assert.equal(isHomeroomGuidanceCode('Homeroom Guidance'), true);
	assert.equal(isHomeroomGuidanceCode('MATH'), false);
	assert.equal(isHomeroomGuidanceCode(null), false);
	assert.equal(isHomeroomGuidanceCode(''), false);
});

test('homeroom guidance line is save-blocked even when mislabeled previewable', () => {
	const blocked = placementSaveAvailability({
		state: 'INDIVIDUALLY_PREVIEWABLE',
		hasCandidates: true,
		allowApply: true,
		subjectCode: 'HG',
	});
	assert.equal(blocked.canSave, false);
	assert.equal(blocked.label, 'Save blocked');
	assert.match(blocked.detail, /Homeroom Guidance is never timetable demand/);

	// Control: an ordinary subject keeps the normal preview-only contract.
	const previewOnly = placementSaveAvailability({
		state: 'INDIVIDUALLY_PREVIEWABLE',
		hasCandidates: true,
		allowApply: false,
		subjectCode: 'MATH',
	});
	assert.equal(previewOnly.canSave, false);
	assert.match(previewOnly.label, /preview only/);
});

// --- TT-C04 structural guardrails (repo source-text style) ---

test('blocker repair actions keep 44px targets and screen-reader names', () => {
	const sheet = source('src/components/timetable/SimplePublishReadinessSheet.tsx');
	const drawer = source('src/components/timetable/simple/SimpleTaskDrawerHelpers.tsx');
	assert.doesNotMatch(sheet, /className="h-7 shrink-0 gap-1 text-xs"/);
	assert.doesNotMatch(drawer, /className="h-7 shrink-0 gap-1 text-xs"/);
	assert.doesNotMatch(drawer, /className="h-6 gap-1 text-xs text-red-700"/);
	assert.match(sheet, /sessions affected/);
	assert.match(drawer, /sessions affected/);
});

test('publish stays disabled with unresolved sessions across surfaces', () => {
	const advanced = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	assert.match(advanced, /unassignedCount > 0 \|\| centerView === 'pre-generation'/);
	const dialog = source('src/components/timetable/modals/TimetableWorkflowDialogs.tsx');
	assert.match(dialog, /publishUnassignedCount/);
	assert.match(dialog, /still need placing before this schedule can be published/);
});

test('drawer blocker items carry plain-language next steps, never raw codes', () => {
	const groups = buildBlockerGroups(
		[{ severity: 'HARD', code: 'NO_AVAILABLE_SLOT', entities: { sectionId: 1, subjectId: 2, facultyId: 3 } } as never],
		(id: number) => `Section ${id}`,
		(id: number) => `Subject ${id}`,
		(id: number) => `Teacher ${id}`,
	);
	assert.equal(groups.length, 1);
	assert.equal(
		groups[0].items[0].nextStep,
		'No allowed time slot was found. Try manual placement or review the scheduling policy.',
	);
	assert.doesNotMatch(groups[0].items[0].nextStep, /^[A-Z_]+$/);
});

test('failed newest run is named explicitly instead of looking like no history', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /timetable-last-generation-failed-message/);
	assert.match(header, /The last generation run failed/);
});

test('insertion workflow stays preview-only with zero production apply', () => {
	const workflow = source('src/components/timetable/UnassignedInsertionWorkflow.tsx');
	assert.match(workflow, /allowApply: false/);
});
