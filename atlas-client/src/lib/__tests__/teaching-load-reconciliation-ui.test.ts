import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	deriveReconciliationSummaries,
	formatStatusLabel,
	formatTeachingMinutes,
	readinessChipState,
	reconciliationActionLabel,
	reconciliationApplyDisabledReason,
} from '@/lib/teaching-load-reconciliation-helpers';
import type { TeachingLoadReconciliationPreview } from '@/types';

function basePreview(overrides: Partial<TeachingLoadReconciliationPreview> = {}): TeachingLoadReconciliationPreview {
	return {
		schemaVersion: 'TL-C02.1',
		schoolId: 1,
		schoolYearId: 8,
		fingerprint: 'A'.repeat(64),
		sourceRevision: 'B'.repeat(64),
		generatedAt: '2026-09-09T00:00:00.000Z',
		before: {
			ownershipCount: 10,
			demandCount: 12,
			activeFacultyCount: 42,
			activeSectionCount: 20,
			distribution: { zeroLoad: 5, adviserOnly: 5, belowStandard: 30, atStandard: 3, excess: 7, overCap: 1 },
		},
		demand: [],
		actions: [
			{ action: 'RETAIN', subjectId: 1, subjectCode: 'MATH', sectionId: 101, classification: 'CORE', weeklyMinutes: 240, termMode: 'ALL', termIdentities: [], rotationFamily: null, currentOwnerId: 10, proposedFacultyId: 10, currentOwnershipId: 1, diagnostics: ['VALID_RETAIN'], reason: 'kept', unresolvedReason: null, adviserPreferenceApplied: false },
			{ action: 'INSERT', subjectId: 1, subjectCode: 'MATH', sectionId: 102, classification: 'CORE', weeklyMinutes: 240, termMode: 'ALL', termIdentities: [], rotationFamily: null, currentOwnerId: null, proposedFacultyId: 11, currentOwnershipId: null, diagnostics: ['MISSING_OWNER'], reason: 'added', unresolvedReason: null, adviserPreferenceApplied: true },
			{ action: 'MOVE', subjectId: 2, subjectCode: 'ENG', sectionId: 102, classification: 'CORE', weeklyMinutes: 240, termMode: 'ALL', termIdentities: [], rotationFamily: null, currentOwnerId: 10, proposedFacultyId: 12, currentOwnershipId: 2, diagnostics: ['UNQUALIFIED_OWNER'], reason: 'moved', unresolvedReason: null, adviserPreferenceApplied: false },
			{ action: 'RETIRE', subjectId: 99, subjectCode: 'HG', sectionId: 101, classification: 'UNKNOWN', weeklyMinutes: 300, termMode: 'ALL', termIdentities: [], rotationFamily: null, currentOwnerId: 10, proposedFacultyId: null, currentOwnershipId: 3, diagnostics: ['HG_FORBIDDEN'], reason: 'hg', unresolvedReason: null, adviserPreferenceApplied: false },
			{ action: 'UNRESOLVED', subjectId: 3, subjectCode: 'SCI_BIO', sectionId: 103, classification: 'CORE', weeklyMinutes: 180, termMode: 'ROTATING_FAMILY_MEMBER', termIdentities: ['Term 1'], rotationFamily: 'SCIENCE', currentOwnerId: null, proposedFacultyId: null, currentOwnershipId: null, diagnostics: ['MISSING_OWNER'], reason: 'no candidate', unresolvedReason: 'NO_QUALIFIED_CANDIDATE', adviserPreferenceApplied: false },
		],
		actionTotals: { RETAIN: 1, INSERT: 1, MOVE: 1, RETIRE: 1, UNRESOLVED: 1 },
		classificationTotals: { VALID_RETAIN: 1, MISSING_OWNER: 2, UNQUALIFIED_OWNER: 1, HG_FORBIDDEN: 1 },
		perFaculty: [
			{ facultyId: 10, name: 'Math, Mara', isClassAdviser: true, isActiveForScheduling: true, isPlaceholder: false, beforeMinutes: 1560, afterMinutes: 1440, beforeStatus: 'below-standard', afterStatus: 'below-standard' },
		],
		after: { distribution: { zeroLoad: 6, adviserOnly: 5, belowStandard: 30, atStandard: 4, excess: 4, overCap: 0 } },
		adviserPreference: [
			{ facultyId: 10, sectionId: 101, satisfied: true, reason: 'SATISFIED' },
			{ facultyId: 11, sectionId: 102, satisfied: false, reason: 'NO_SAFE_CANDIDATE_SLOT' },
		],
		hgRows: { found: 1, removed: 1, removedRows: [{ ownershipId: 3, subjectId: 99, sectionId: 101, facultyId: 10 }] },
		departmentAuthority: { status: 'EMPTY', aliasRows: 0, labelRows: 0, revisionHash: 'C'.repeat(64) },
		workloadPolicy: { teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400, status: 'CONFIGURED' },
		cycleImpact: { stateBefore: 'POPULATED', stateAfter: 'POPULATED' },
		effectiveContractImpact: { hgRowsExcluded: true, stableExternalIdentifiers: true, rotationAndTermMetadataPreserved: true },
		zeroWriteProof: { preview: true, writes: 0 },
		confirmationText: 'APPLY TEACHING LOAD RECONCILIATION',
		authorizesMutation: false,
		...overrides,
	};
}

test('reconciliation action labels are plain and stable', () => {
	assert.equal(reconciliationActionLabel('RETAIN'), 'Stays');
	assert.equal(reconciliationActionLabel('INSERT'), 'Added');
	assert.equal(reconciliationActionLabel('MOVE'), 'Moved');
	assert.equal(reconciliationActionLabel('RETIRE'), 'Removed');
	assert.equal(reconciliationActionLabel('UNRESOLVED'), 'Needs review');
});

test('deriveReconciliationSummaries counts actions and distributions', () => {
	const preview = basePreview();
	const summaries = deriveReconciliationSummaries(preview);
	assert.deepEqual(summaries.actionCounts, { RETAIN: 1, INSERT: 1, MOVE: 1, RETIRE: 1, UNRESOLVED: 1 });
	assert.equal(summaries.before.zeroLoad, 5);
	assert.equal(summaries.after.excess, 4);
	assert.equal(summaries.adviserSatisfied, 1);
	assert.equal(summaries.adviserUnsatisfied, 1);
	assert.deepEqual(summaries.unresolvedReasons, [{ reason: 'NO_QUALIFIED_CANDIDATE', count: 1 }]);
	assert.equal(summaries.departmentState.status, 'EMPTY');
});

test('workload status and minutes formatting never render negative or ambiguous', () => {
	assert.equal(formatTeachingMinutes(0), '0.0h');
	assert.equal(formatTeachingMinutes(1560), '26.0h');
	assert.equal(formatTeachingMinutes(2400), '40.0h');
	assert.equal(formatStatusLabel('zero-load', true), 'No teaching load');
	assert.equal(formatStatusLabel('adviser-only', true), 'Adviser only');
	assert.equal(formatStatusLabel('below-standard', true), 'Below standard');
	assert.equal(formatStatusLabel('at-standard', true), 'At standard');
	assert.equal(formatStatusLabel('excess', true), 'Excess teaching');
	assert.equal(formatStatusLabel('over-cap', true), 'Over hard cap');
});

test('apply disabled reason: confirmation gate and fingerprint binding', () => {
	const preview = basePreview();
	const base = { preview, applyDisabled: false, applyLoading: false, confirmation: 'APPLY TEACHING LOAD RECONCILIATION', online: true, writable: true };
	assert.equal(reconciliationApplyDisabledReason(base), null, 'enabled when exact confirmation present');
	assert.equal(
		reconciliationApplyDisabledReason({ ...base, confirmation: 'APPLY TEACHING LOAD RECONCILIATIO' }),
		'Type the exact confirmation to enable Apply.',
		'wrong confirmation blocks apply',
	);
	assert.equal(reconciliationApplyDisabledReason({ ...base, online: false }), 'Applying is disabled while ATLAS is offline.', 'offline blocks apply');
	assert.equal(reconciliationApplyDisabledReason({ ...base, writable: false }), 'ATLAS must verify writable Teaching Load data before applying.', 'read-only blocks apply');
	assert.equal(
		reconciliationApplyDisabledReason({ ...base, applyDisabled: true }),
		'The preview did not change; there is nothing to apply.',
		'no-op preview blocks apply',
	);
});

test('readiness chip reflects coverage truth, not cycle state alone', () => {
	assert.deepEqual(readinessChipState({ ready: true, demandCount: 12, ownedDemandCount: 12, unresolvedDemandCount: 0, validOwnershipCount: 12, blockers: [], acceptedExceptions: 0 } as never, false), { label: 'Coverage ready (12/12)', tone: 'ok' });
	assert.deepEqual(
		readinessChipState({ ready: false, demandCount: 12, ownedDemandCount: 8, unresolvedDemandCount: 4, validOwnershipCount: 8, blockers: [{ code: 'TL_UNRESOLVED_COVERAGE', message: '4 demanded subject-section pairs have no valid qualified owner.' }], acceptedExceptions: 0 } as never, false),
		{ label: '4 demanded subject-section pairs have no valid qualified owner.', tone: 'warn' },
	);
	assert.equal(readinessChipState(null, true).label, 'Checking coverage…');
	assert.equal(readinessChipState(null, false).label, 'Coverage unavailable');
});