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
	// C04/F2: readiness copy reads the allowlist-filtered blocking count; default
	// it to the total so existing fixtures keep their meaning unless overridden.
	const hardCount = typeof overrides.hardCount === 'number' ? overrides.hardCount : 0;
	return {
		schoolYearContext: { activeSchoolYearLabel: 'SY 2029-2030' },
		isPreGenerationWorkspace: false,
		draft: null,
		summary: null,
		hardCount,
		blockingHardCount: hardCount,
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
	assert.equal(action.label, 'Open Year Setup');
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
	assert.equal(checking.label, 'Checking schedule information…');
	assert.equal(checking.disabled, true);
	assert.equal(checking.interactive, false);

	for (const curriculumState of ['unavailable', 'failed'] as const) {
		const retry = deriveSimpleLifecycleAction({ hasGeneratedRun: false, curriculumState });
		assert.equal(retry.kind, 'retry-readiness');
		assert.equal(retry.label, 'Retry schedule check');
		assert.equal(retry.disabled, false);
		assert.equal(retry.interactive, true);
	}
});

test('production header mounts the lifecycle-derived primary cluster and the visible gated Generate control', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	// A3 — one action cluster. The primary identifies the same sole action in
	// each of its four conditional render forms (in-place retry, external
	// fix-setup Link, task-href Link, lifecycle dispatcher).
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): the lifecycle primary is no
	// longer a visible control. Its warning steps are the merged warnings
	// control; its other steps (in-place retry, external fix-setup link,
	// lifecycle dispatcher) are ONE More ▸ "Next step" entry.
	// assert.equal((header.match(/data-testid="timetable-simple-primary-action"/g) ?? []).length, 4,
	// 	'the four conditional render forms must identify the same sole primary action');
	// assert.match(header, /onClick=\{\(\) => activeTask \? void startTask\(activeTaskDefinition\.id\) : handleLifecycleAction\(\)\}/);
	assert.equal((header.match(/data-testid="timetable-simple-primary-action"/g) ?? []).length, 0);
	assert.match(header, /onSelect: \(\) => context\.handleRefresh\(\)/, 'in-place retry');
	assert.match(header, /href: setupRepair\.href \?\? YEAR_SETUP_HREF/, 'external fix-setup link');
	assert.match(header, /onSelect: handleLifecycleAction/, 'lifecycle dispatcher');
	assert.doesNotMatch(header, /data-testid="timetable-empty-generate-action"/);
	// UX-QUICKFIX-C01 supersedes the "Generate exists only in More" contract: the
	// action row mounts the visible, gate-guarded Generate control. Dispatch still
	// flows through the guarded handler, never inline.
	assert.match(header, /<SimpleGenerateAction/);
	assert.match(header, /onClick=\{handleGenerateClick\}/);
	assert.doesNotMatch(header, /onClick=\{context\.handleTriggerGenerate\}/);
});

test('the hidden generation bypasses are superseded by the visible, gated action cluster', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	// The removed hidden control may never return anywhere in the header.
	assert.doesNotMatch(header, /timetable-simple-mobile-lifecycle-action/);
	// UX-QUICKFIX-C01 deliberately reintroduces Generate as a VISIBLE, gated
	// control. The old grep guarded a hidden control that bypassed the lifecycle
	// dispatcher; the replacement lives in the extracted action module, is always
	// visible, and reads the shared readiness decision before it dispatches.
	assert.match(header, /<SimpleGenerateAction/);
	assert.match(helpers, /data-testid="timetable-simple-generate-action"/);
	// No hidden control may carry a direct generation call.
	assert.doesNotMatch(header, /onClick=\{context\.handleTriggerGenerate\}/);
	assert.doesNotMatch(header, /className="hidden"[\s\S]{0,300}context\.handleTriggerGenerate/);
	// The direct generation calls left are the gate-guarded visible handler and
	// the visible lifecycle retry.
	assert.match(header, /if \(!shouldDispatchSimpleGenerate\(canPlanOrGenerate\)\) return;/);
	assert.match(header, /case 'retry-generate': context\.handleTriggerGenerate\(\); break;/);
	// A3 — the duplicate Generate entry was removed from More; the visible header
	// control is the single Generate surface.
	const moreMenu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.doesNotMatch(moreMenu, /Generate schedule/, 'More no longer duplicates the header Generate control');
	assert.doesNotMatch(moreMenu, /context\.handleTriggerGenerate/, 'More dispatches no generation request');

	// A3 — the preview-demand control stays a preview-only action in the single
	// action row, and the NEXT STEP names the primary action.
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): Preview demand moved into
	// More ▸ Schedule actions with the same gate and the same dispatch.
	// assert.match(header, /data-testid="timetable-unassigned-insertion-action"/);
	// assert.match(header, /Preview demand/);
	const actions = source('src/components/timetable/simple/SimpleHeaderActions.tsx');
	assert.match(actions, /data-testid="timetable-unassigned-insertion-action"/);
	assert.match(actions, /Preview demand/);
	assert.match(header, /visible: generationReady && !hasGeneratedRun,\s*disabled: !canPlanOrGenerate,/);
	assert.match(header, /setInsertionOpen\(true\)/);
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
	// SUPERSEDED BY WORD (LANE-C-PLAIN-LANGUAGE-C03 J1, 2026-09-26). This row's
	// intent is unchanged and still fully asserted: a run-wide blocking HARD
	// takes precedence over unassigned sessions and over warnings, and the count
	// 2 is still carried. Only the noun changed — the 2026-09-26 audit finding 3
	// found this concept under four names in one viewport and J1 makes
	// "Must fix" the single plain word. Original retained verbatim:
	//   assert.equal(readinessLabel(headerContext({ draft, hardCount: 2, summary: { unassignedCount: 5 }, softCount: 9 })), '2 blockers');
	assert.equal(
		readinessLabel(headerContext({ draft, hardCount: 2, summary: { unassignedCount: 5 }, softCount: 9 })),
		'2 Must fix',
		'blocking HARD still outranks unassigned sessions and warnings',
	);
	// The precedence itself is still proven, not just the wording: a blocking
	// count still wins even when a larger unassigned count is present.
	assert.notEqual(
		readinessLabel(headerContext({ draft, hardCount: 2, summary: { unassignedCount: 5 }, softCount: 9 })),
		'5 classes still to place (whole year)',
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
	assert.equal(readinessLabel(headerContext({ isPreGenerationWorkspace: true })), 'Working schedule draft');
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
	assert.match(header, /The last schedule build did not finish/);
});

test('insertion workflow stays preview-only with zero production apply', () => {
	const workflow = source('src/components/timetable/UnassignedInsertionWorkflow.tsx');
	assert.match(workflow, /allowApply: false/);
});

// --- TT-UX01 operator readiness honesty (2026-09-11) ---

test('TTX-01 no-run center has no write CTA and defers to the header action', () => {
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	assert.doesNotMatch(center, /timetable-empty-primary-actions/);
	assert.doesNotMatch(center, /Start Pre-Generation Draft/);
	assert.doesNotMatch(center, /handleStartNewPreGenerationDraft\(\)/);
	assert.match(center, /primary action above/);
});

test('TTX-02 run-derived clean claims are gated on run existence', () => {
	const rail = source('src/components/timetable/GeneratedRunRailPanels.tsx');
	assert.match(rail, /const hasGeneratedRun = Boolean\(context\.summary\)/);
	assert.match(rail, /hasGeneratedRun && hardViolationCount === 0 && violations\.length === 0/);
	assert.match(rail, /No generated run yet/);
	const drawer = source('src/components/timetable/TimetableTaskDrawer.tsx');
	assert.match(drawer, /if \(!context\.summary\)/);
});

test('TTX-03 advanced run badge never renders a null run as #-', () => {
	const advanced = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	assert.doesNotMatch(advanced, /Generated Run #\$\{activeGeneratedRunId \?\? '-'/);
	assert.match(advanced, /No generated run yet/);
});

test('TTX-04 deciding readiness copy is visible on mobile and not hard-truncated', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.doesNotMatch(header, /hidden max-w-xl truncate text-xs text-muted-foreground sm:block/);
	assert.doesNotMatch(header, /hidden max-w-xl truncate text-xs font-medium text-red-700 sm:block/);
	assert.match(header, /data-testid="timetable-curriculum-readiness-message"/);
	assert.match(header, /data-testid="timetable-last-generation-failed-message"/);
});

test('TTX-05 run-dependent More items are disabled with an accessible reason', () => {
	// C04: the More menu was extracted into SimpleMoreMenuContent.
	const header = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(header, /runToolsAvailable/);
	assert.equal((header.match(/disabled=\{!runToolsAvailable\}/g) ?? []).length, 4);
	assert.match(header, /timetable-more-place-unresolved/);
	assert.match(header, /timetable-more-swap-sessions/);
	assert.match(header, /timetable-more-review-issues/);
	assert.match(header, /teacher-departure-trigger/);
	assert.match(header, /Unavailable: no generated run yet/);
});

test('TTX-06 empty entity selector is disabled with a reason', () => {
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.match(helpers, /entityOptionsAvailable/);
	assert.match(helpers, /disabled=\{!entityOptionsAvailable\}/);
	assert.match(helpers, /No schedule options are available yet/);
	const select = source('src/ui/searchable-select.tsx');
	assert.match(select, /disabled\?: boolean/);
});

test('TTX-07 tutorial reports an unavailable target instead of a silent no-op', () => {
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.match(helpers, /timetable-simple-tutorial-unavailable/);
	assert.match(helpers, /if \(!target\)/);
});

test('TTX-08 tutorial trigger has an accessible name and 44px mobile target', () => {
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.match(helpers, /aria-label="Open timetable tutorial"/);
	assert.match(helpers, /min-h-11/);
	assert.match(
		helpers,
		/data-testid="timetable-simple-schedule-sheet-trigger"[\s\S]{0,80}min-h-11 min-w-11|min-h-11 min-w-11[\s\S]{0,200}data-testid="timetable-simple-schedule-sheet-trigger"/,
	);
});

test('TTX-11 room-request no-run 404 is empty, deduplicated, and gated on a completed run', () => {
	const useData = source('src/hooks/useTimetableData.ts');
	assert.match(useData, /getTimetableApiErrorCode\(err\) === 'NO_ACTIVE_DRAFT'/);
	// UX-P01: the load sequencing (and therefore the completed-run gate) moved to
	// the production orchestration module; assert the gate there, and assert it
	// is the only path that reaches the room-request read.
	const orchestration = source('src/lib/timetable-data/timetableLoadOrchestration.ts');
	assert.match(orchestration, /hasCompletedRun/);
	assert.match(orchestration, /hasCompletedRun\s*\?\s*ports\.loadRoomRequestSummary/);
	assert.doesNotMatch(
		useData,
		/if \(!schoolYearId\) return;\s*void loadRoomRequestSummary\(schoolYearId, requestStatusFilter, requestDecisionFilter\);/,
	);
});

test('TTX-12 a visible, gated publish control replaces the permanently hidden one', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	// UX-QUICKFIX-C01 deliberately reintroduces Publish as a VISIBLE, gated
	// control; the permanently hidden control is superseded.
	assert.match(header, /<SimplePublishAction/);
	assert.match(helpers, /data-testid="timetable-simple-publish-action"/);
	assert.doesNotMatch(header, /className="hidden"[\s\S]{0,300}timetable-simple-publish-action/);
});
