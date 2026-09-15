import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { TooltipProvider } from '@/ui/tooltip';
import { WorkspaceToolbar } from '@/components/faculty-assignments/WorkspaceToolbar';
import {
	matchesOwnershipDepartment,
	ownershipDepartmentEligibility,
	selectEligibleOwnerCandidates,
	normalizeDepartmentCode,
} from '@/lib/faculty-assignment-helpers';
import {
	CANDIDATE_REJECTION_LABELS,
	CANDIDATE_REJECTION_DETAILS,
	CANDIDATE_REJECTION_ORDER,
	describeCandidateRejection,
	summarizeCandidateRejections,
} from '@/lib/teaching-load-suggestion-diagnostics';
import {
	resolveSuggestionPreviewState,
	SAFE_SUGGESTION_STATES,
	UNSAFE_SUGGESTION_STATES,
} from '@/lib/teaching-load-suggestion-presentation';
import { COVERAGE_MODE_CONFIG } from '@/lib/teaching-load-helpers';
import type { AutoFillSummaryResult, FacultySummary, Subject, TeachingLoadCandidateRejectionReason } from '@/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
function source(relativePath: string): string {
	return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

/* ================================================================== *
 * R4 — zero-load / blank-department qualified teachers stay candidates
 * ================================================================== */

function subject(overrides: Partial<Subject> = {}): Subject {
	return {
		id: 1,
		code: 'FIL',
		name: 'Filipino',
		isActive: true,
		gradeLevels: [7, 8, 9, 10],
		programScopes: [],
		allowedSpecializations: [],
		...overrides,
	} as unknown as Subject;
}

function faculty(overrides: Partial<FacultySummary> = {}): FacultySummary {
	return {
		id: 1,
		firstName: 'Test',
		lastName: 'Teacher',
		department: 'FIL',
		isActiveForScheduling: true,
		isPlaceholder: false,
		actualTeachingHours: 0,
		maxHoursPerWeek: 40,
		...overrides,
	} as unknown as FacultySummary;
}

const FIL_SUBJECT = subject({ id: 21, code: 'FIL', name: 'Filipino', ownerDepartment: 'FIL', allowedOwnerDepartments: ['FIL'] });
const ESP_SUBJECT = subject({ id: 22, code: 'ESP', name: 'Edukasyon sa Pagpapakatao', ownerDepartment: 'ESP', allowedOwnerDepartments: ['ESP'] });

test('R4 ownership eligibility is tri-state: a blank department is UNKNOWN, never ineligible', () => {
	assert.equal(ownershipDepartmentEligibility('FIL', FIL_SUBJECT), 'eligible');
	assert.equal(ownershipDepartmentEligibility('fil ', FIL_SUBJECT), 'eligible');
	assert.equal(ownershipDepartmentEligibility('ESP', FIL_SUBJECT), 'ineligible');
	assert.equal(ownershipDepartmentEligibility(null, FIL_SUBJECT), 'unknown');
	assert.equal(ownershipDepartmentEligibility('', FIL_SUBJECT), 'unknown');
	assert.equal(ownershipDepartmentEligibility('   ', FIL_SUBJECT), 'unknown');
	assert.equal(ownershipDepartmentEligibility(undefined, FIL_SUBJECT), 'unknown');
});

test('R4 the eligibility boolean only hides a proven ineligible candidate', () => {
	assert.equal(matchesOwnershipDepartment('FIL', FIL_SUBJECT), true);
	assert.equal(matchesOwnershipDepartment('ESP', FIL_SUBJECT), false);
	// The regression: a blank department used to be pre-empted to a hard `false`,
	// silently dropping qualified zero-load teachers from every candidate list.
	assert.equal(matchesOwnershipDepartment(null, FIL_SUBJECT), true);
	assert.equal(matchesOwnershipDepartment('', FIL_SUBJECT), true);
});

test('R4 candidate fixture: overloaded FIL/ESP + qualified zero-load teachers in both departments', () => {
	const facultyRows: FacultySummary[] = [
		faculty({ id: 101, lastName: 'Overloaded-FIL', department: 'FIL', actualTeachingHours: 42 }),
		faculty({ id: 102, lastName: 'Overloaded-ESP', department: 'ESP', actualTeachingHours: 42 }),
		faculty({ id: 103, lastName: 'ZeroLoad-FIL', department: 'FIL', actualTeachingHours: 0 }),
		faculty({ id: 104, lastName: 'ZeroLoad-ESP', department: 'ESP', actualTeachingHours: 0 }),
		faculty({ id: 105, lastName: 'ZeroLoad-BlankDept', department: null, actualTeachingHours: 0 }),
	];
	const active = new Set([101, 102, 103, 104, 105]);

	const filCandidates = selectEligibleOwnerCandidates(facultyRows, FIL_SUBJECT, active).map((row) => row.id);
	assert.deepEqual(filCandidates, [101, 105, 103]);
	assert.ok(filCandidates.includes(103), 'qualified zero-load Filipino teacher must be a candidate');
	assert.ok(filCandidates.includes(105), 'blank-department zero-load teacher must stay visible, not be dropped');
	assert.ok(!filCandidates.includes(102), 'ESP teacher is not a Filipino owner');

	const espCandidates = selectEligibleOwnerCandidates(facultyRows, ESP_SUBJECT, active).map((row) => row.id);
	assert.deepEqual(espCandidates, [102, 105, 104]);
	assert.ok(espCandidates.includes(104), 'qualified zero-load ESP teacher must be a candidate');
	assert.ok(espCandidates.includes(105), 'blank-department zero-load teacher stays visible for ESP too');
	assert.ok(!espCandidates.includes(101), 'FIL teacher is not an ESP owner');
});

test('R4 failing-first mutant: the retired null-department pre-emption would hide the candidate', () => {
	// Reconstructs the exact predicate that shipped before this correction
	// (`if (!normalizedFaculty) return false;`). The production predicate must
	// now disagree with it for a blank department, or the regression is unproven.
	const legacyPredicate = (facultyDepartment: string | null | undefined, ownerDepartments: string[]): boolean => {
		const normalizedFaculty = normalizeDepartmentCode(facultyDepartment);
		if (!normalizedFaculty) return false;
		return ownerDepartments.includes(normalizedFaculty);
	};
	assert.equal(legacyPredicate(null, ['FIL']), false, 'mutant reproduces the old exclusion');
	assert.equal(matchesOwnershipDepartment(null, FIL_SUBJECT), true, 'production no longer pre-empts');
});

/* ================================================================== *
 * R5 — every exclusion reason is explained in concise human language
 * ================================================================== */

test('R5 every reason class has scheduler-facing copy and an on-demand detail', () => {
	const expectedReasons: TeachingLoadCandidateRejectionReason[] = [
		'PROGRAM_SCOPE_INCOMPATIBLE',
		'NOT_QUALIFIED',
		'DEPARTMENT_RESTRICTED',
		'HARD_CAP_EXCEEDED',
		'CURRENT_OWNER',
		'INACTIVE_FACULTY',
		'WRONG_SCHOOL',
		'UNAVAILABLE',
		'STALE_AUTHORITY',
		'PLACEHOLDER_FACULTY',
	];
	assert.deepEqual(CANDIDATE_REJECTION_ORDER, expectedReasons);
	for (const reason of expectedReasons) {
		assert.ok(CANDIDATE_REJECTION_LABELS[reason], `${reason} needs a label`);
		assert.ok(CANDIDATE_REJECTION_DETAILS[reason], `${reason} needs a detail`);
	}
});

test('R5 the primary explanation is human copy, never a raw enum code', () => {
	for (const reason of CANDIDATE_REJECTION_ORDER) {
		const label = CANDIDATE_REJECTION_LABELS[reason];
		assert.doesNotMatch(label, /^[A-Z][A-Z_]+$/, `${label} looks like a raw enum code`);
		assert.doesNotMatch(label, /[A-Z]{3,}_[A-Z]/, `${label} leaks a snake_case code`);
		assert.deepEqual(describeCandidateRejection(reason), {
			label: CANDIDATE_REJECTION_LABELS[reason],
			detail: CANDIDATE_REJECTION_DETAILS[reason],
		});
	}
});

test('R5 grouped summary carries the on-demand detail and never a raw code as the primary line', () => {
	const groups = summarizeCandidateRejections([
		{ subjectId: 1, subjectCode: 'FIL', sectionId: 2, sectionName: 'G7-A', facultyId: 9, facultyName: 'Ana', reason: 'INACTIVE_FACULTY' },
		{ subjectId: 1, subjectCode: 'FIL', sectionId: 2, sectionName: 'G7-A', facultyId: 10, facultyName: 'Ben', reason: 'INACTIVE_FACULTY' },
	]);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].reason, 'INACTIVE_FACULTY');
	assert.equal(groups[0].count, 2);
	assert.equal(groups[0].detail, CANDIDATE_REJECTION_DETAILS.INACTIVE_FACULTY);
	assert.deepEqual(groups[0].facultyNames, ['Ana', 'Ben']);
});

test('R5 unknown/legacy reasons never render a raw code', () => {
	const described = describeCandidateRejection('SOME_FUTURE_CODE' as never);
	assert.equal(described.label, 'Not eligible for this class');
	assert.ok(described.detail.length > 0);
});

/* ================================================================== *
 * R7 — an unevaluated proposal is never reported as balanced
 * ================================================================== */

test('R7 an unevaluated distribution resolves to unevaluated, never balanced', () => {
	assert.equal(
		resolveSuggestionPreviewState({ hasResult: true, hasShortage: false, distributionEvaluated: false, balanced: false }),
		'unevaluated',
	);
	// A missing plan (no distribution at all) is unevaluated too.
	assert.equal(
		resolveSuggestionPreviewState({ hasResult: true, hasShortage: false, distributionEvaluated: false, balanced: true }),
		'unevaluated',
	);
	assert.equal(
		resolveSuggestionPreviewState({ hasResult: true, hasShortage: false, distributionEvaluated: true, balanced: true }),
		'balanced',
	);
	assert.equal(
		resolveSuggestionPreviewState({ hasResult: true, hasShortage: false, distributionEvaluated: true, balanced: false }),
		'imbalance',
	);
	assert.equal(
		resolveSuggestionPreviewState({ hasResult: true, hasShortage: true, distributionEvaluated: true, balanced: true }),
		'shortage',
	);
	assert.ok(!SAFE_SUGGESTION_STATES.includes('unevaluated'));
	assert.ok(UNSAFE_SUGGESTION_STATES.includes('unevaluated'));
});

test('R7 failing-first mutant: dropping the evaluated guard would falsely report balanced', () => {
	// The pre-guard shape: `distribution && !distribution.summary.balanced` with no
	// `distributionEvaluated` check. An unevaluated plan carries balanced=false,
	// so it would be mislabelled "rebalance proposed" instead of "not evaluated".
	const mutantState = (balanced: boolean): string => (balanced ? 'balanced' : 'imbalance');
	assert.equal(mutantState(false), 'imbalance', 'mutant diverges from production');
	assert.notEqual(
		mutantState(false),
		resolveSuggestionPreviewState({ hasResult: true, hasShortage: false, distributionEvaluated: false, balanced: false }),
	);
});

test('R7 the modal derives its header from the single preview-state authority', () => {
	const modal = source('src/components/faculty-assignments/AutoFillSummaryModal.tsx');
	assert.match(modal, /resolveSuggestionPreviewState\(/);
	assert.match(modal, /data-preview-state=\{previewState\}/);
	// NEGATIVE CONTROL: the multi-branch inline title that could drift from the
	// branch conditions must be gone.
	assert.doesNotMatch(modal, /\? 'Coverage complete, rebalance proposed'/);
});

/* ================================================================== *
 * R1 — dead, duplicate, and non-interactive controls
 * ================================================================== */

function renderToolbar(overrides: Record<string, unknown> = {}) {
	const props = {
		realAssignedPairs: 10,
		syntheticPlaceholderPairs: 0,
		unassignedPairs: 0,
		totalPairs: 10,
		overCapCount: 0,
		excessTeachingCount: 0,
		policyReady: true,
		onShowExcessTeachingLoad: () => {},
		onShowTemporarySubstitutes: () => {},
		autoFillLoading: false,
		autoFillEnabled: true,
		onAutoFillClick: () => {},
		viewMode: 'teacher',
		onViewModeChange: () => {},
		dataSource: 'live' as const,
		degradedWriteEnabled: false,
		isWorkspaceWritable: true,
		isOnline: true,
		dataSourceNotice: null,
		coverageMode: 'REAL_FACULTY_STANDARD' as const,
		onCoverageModeChange: () => {},
		coverageModeConfig: COVERAGE_MODE_CONFIG,
		workspaceStateLabel: 'EnrollPro roster verified',
		workspaceStateDescription: 'Freshly verified.',
		workspaceStateNextAction: 'Inspect one teacher.',
		activeDraftCount: 0,
		saving: false,
		onSave: () => {},
		onRetrySource: () => {},
		...overrides,
	};
	return renderToStaticMarkup(createElement(TooltipProvider, null, createElement(WorkspaceToolbar, props as never)));
}

test('R1 the Temporary substitutes chip is a real, enabled control', () => {
	const markup = renderToolbar({ syntheticPlaceholderPairs: 3, unassignedPairs: 0 });
	assert.match(markup, /Temporary substitutes: 3/);
	assert.match(markup, /data-testid="teaching-load-alert-teacher-x"/);
	// Rendered as an interactive <button ...> with its handler wired, never a
	// disabled/`cursor-default` decoration.
	assert.match(markup, /<button[^>]*data-testid="teaching-load-alert-teacher-x"/);
	assert.doesNotMatch(markup, /cursor-default/);
});

test('R1 the Temporary substitutes chip renders no button when there are no placeholder rows', () => {
	const markup = renderToolbar({ syntheticPlaceholderPairs: 0 });
	assert.doesNotMatch(markup, /teaching-load-alert-teacher-x/);
});

test('R1 the unreachable suggestion-confirm dialog and its flag are gone', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	const modals = source('src/components/faculty-assignments/TeachingLoadModals.tsx');
	const uiHook = source('src/hooks/useTeachingLoadUI.ts');
	for (const file of [page, modals, uiHook]) {
		assert.doesNotMatch(file, /autoFillDialogOpen/);
		assert.doesNotMatch(file, /setAutoFillDialogOpen/);
	}
	assert.doesNotMatch(modals, /Preview suggested Teaching Load draft\?/);
});

test('R1 the orphaned reconciliation panel has no remaining file or importer', () => {
	assert.ok(!existsSync(resolve(ROOT, 'src/components/faculty-assignments/TeachingLoadReconciliationPanel.tsx')));
	const page = source('src/pages/TeachingLoad.tsx');
	assert.doesNotMatch(page, /TeachingLoadReconciliationPanel/);
});

test('R1 dead props, dead literal, and the clipped candidate list are removed', () => {
	const sectionGrid = source('src/components/faculty-assignments/SectionGridMode.tsx');
	assert.doesNotMatch(sectionGrid, /max-h-75/);
	for (const deadProp of ['savedOwnershipMap', 'pendingOwnershipMap', 'onSelectTeacher', 'onHoverTeacher', 'onClearHover', 'hasDraft']) {
		assert.doesNotMatch(sectionGrid, new RegExp(`\\b${deadProp}\\b`), `${deadProp} should be gone from SectionGridMode`);
	}
	const toolbar = source('src/components/faculty-assignments/WorkspaceToolbar.tsx');
	assert.doesNotMatch(toolbar, /'teacher' \| 'allocation' \| 'subjects'/);
	assert.doesNotMatch(toolbar, /onClick: undefined/);
	const modal = source('src/components/faculty-assignments/AutoFillSummaryModal.tsx');
	assert.doesNotMatch(modal, /onReviewManually/);
	const inspector = source('src/components/faculty-assignments/WorkloadInspector.tsx');
	assert.doesNotMatch(inspector, /onClose/);
});

test('R1 the advanced-grid reveal control exists exactly once across the workspace', () => {
	const repairQueue = source('src/components/faculty-assignments/TeachingLoadRepairQueue.tsx');
	const placeholder = source('src/components/faculty-assignments/TeachingLoadGuidedModePlaceholder.tsx');

	// Both surfaces render in exactly the `!advancedGridVisible` state, so the old
	// copy here was a simultaneously-visible duplicate target with a duplicate id.
	assert.doesNotMatch(repairQueue, /teaching-load-advanced-grid-toggle/);
	assert.doesNotMatch(repairQueue, /Browse all/);
	assert.doesNotMatch(repairQueue, /onToggleAdvancedGrid/);
	assert.match(placeholder, /teaching-load-advanced-grid-toggle/);

	const candidates = [
		'src/components/faculty-assignments/TeachingLoadRepairQueue.tsx',
		'src/components/faculty-assignments/TeachingLoadGuidedModePlaceholder.tsx',
		'src/pages/TeachingLoad.tsx',
	];
	const owners = candidates.filter((file) => source(file).includes('teaching-load-advanced-grid-toggle'));
	assert.deepEqual(owners, ['src/components/faculty-assignments/TeachingLoadGuidedModePlaceholder.tsx']);
});

test('R1 the over-cap and excess chips stay distinct and each is a real control', () => {
	const overcap = renderToolbar({ overCapCount: 2, excessTeachingCount: 0, syntheticPlaceholderPairs: 0 });
	assert.match(overcap, /Above weekly max: 2/);
	assert.match(overcap, /data-testid="teaching-load-alert-over-cap"/);
	assert.doesNotMatch(overcap, /teaching-load-alert-excess/);

	const excess = renderToolbar({ overCapCount: 0, excessTeachingCount: 5, syntheticPlaceholderPairs: 0 });
	assert.match(excess, /Excess teaching load: 5/);
	assert.match(excess, /data-testid="teaching-load-alert-excess"/);
	// One policy threshold at a time; the weekly-max chip always wins when both
	// would qualify, so the operator is never shown two competing alerts.
	assert.doesNotMatch(excess, /teaching-load-alert-over-cap/);
});

test('R1 the page-level retry and the toolbar retry are mutually exclusive, not duplicates', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	// The full-page error state returns early, so the toolbar (and its inline
	// retry) cannot co-render with it.
	assert.match(page, /if \(data\.error && data\.dataSource === 'none'\) \{/);
	assert.match(page, /Retry Connection/);
});

/* ================================================================== *
 * R2 — vertical space and no cramped nested scroll traps
 * ================================================================== */
test('R2 the owner picker grows with the viewport instead of clipping at a fixed 300px', () => {
	const sectionGrid = source('src/components/faculty-assignments/SectionGridMode.tsx');
	assert.match(sectionGrid, /max-h-\[min\(60vh,26rem\)\]/);
	assert.match(sectionGrid, /w-\[min\(22rem,calc\(100vw-1\.5rem\)\)\]/);
});

test('R2 the suggestion-move list grows with the viewport', () => {
	const modal = source('src/components/faculty-assignments/AutoFillSummaryModal.tsx');
	assert.match(modal, /max-h-\[min\(55vh,30rem\)\]/);
	assert.doesNotMatch(modal, /max-h-64/);
});

test('R2 the no-scroll shell contract is preserved', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	assert.match(page, /h-\[calc\(100svh-3\.5rem\)\]/);
	assert.match(page, /flex-1 flex min-h-0/);
	const sectionGrid = source('src/components/faculty-assignments/SectionGridMode.tsx');
	assert.match(sectionGrid, /flex-1 overflow-auto/);
});

/* ================================================================== *
 * R6 — effective workload policy, fail-closed, zero auto-create writes
 * ================================================================== */

test('R6 the Teaching Load data path never calls the auto-creating policy endpoint', () => {
	const dataHook = source('src/hooks/useTeachingLoadData.ts');
	assert.doesNotMatch(dataHook, /policies\/scheduling/);
	// It consumes the persisted effective policy from the summary contract instead.
	assert.match(dataHook, /faculty-assignments\/summary/);
});

test('R6 an unconfigured policy is fail-closed to an unknown state, never an invented default', () => {
	const uiHook = source('src/hooks/useTeachingLoadUI.ts');
	assert.match(uiHook, /const policyReady = workloadPolicyStatus === 'CONFIGURED' && workloadPolicy != null;/);
	const inspector = source('src/components/faculty-assignments/WorkloadInspector.tsx');
	assert.match(inspector, /Teaching standard not configured/);
});

/* ================================================================== *
 * R12 — authority preserved
 * ================================================================== */

test('R12 the suggestion apply path still requires the server proposal and confirmation contract', () => {
	const page = source('src/pages/TeachingLoad.tsx');
	// The preview still dispatches no apply fields, and apply still targets the
	// server-issued proposal id.
	assert.match(page, /suggestion-proposals/);
	assert.match(page, /\$\{suggestionProposalId\}\/apply/);
	assert.doesNotMatch(page, /fingerprint\s*:/);
});

test('R12 HG exclusion still uses the canonical catalog code', () => {
	const uiHook = source('src/hooks/useTeachingLoadUI.ts');
	assert.match(uiHook, /subject\.code === 'HG'/);
});

/* Keep the AutoFillSummaryResult type import meaningful for future fixtures. */
export type _C05FixtureType = AutoFillSummaryResult;
