import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	CARRY_FORWARD_APPLY_BLOCKED_MESSAGE,
	CARRY_FORWARD_REASON_META,
	carryForwardApplyBlockedReason,
	carryForwardPreviewIsZeroWrite,
	carryForwardPreviewRequest,
	carryForwardReasonCounts,
	describeCarryForwardOverload,
	formatCarryForwardError,
	groupCarryForwardRowsByReason,
	pickDefaultSourceYear,
	summarizeCarryForwardPreview,
	type CarryForwardPreview,
	type CarryForwardReason,
	type CarryForwardRow,
} from '../teaching-load-carry-forward-helpers';

function row(reason: CarryForwardReason, overrides: Partial<CarryForwardRow> = {}): CarryForwardRow {
	return {
		sourceOwnershipId: Math.floor(Math.random() * 1_000_000),
		sourceFacultyExternalId: 7001,
		sourceSubjectCode: 'MATH',
		sourceSectionExternalId: 1101,
		reason,
		action: reason === 'EXACT_CARRY' ? 'CARRY' : 'SKIP',
		targetSubjectCode: 'MATH',
		targetSectionExternalId: 2101,
		targetSectionKey: '7:REGULAR:SAMPAGUITA',
		targetFacultyId: 11,
		targetFacultyName: 'Cruz, Ana',
		targetDepartment: 'MATH',
		weeklyMinutes: 240,
		detail: null,
		...overrides,
	};
}

function preview(overrides: Partial<CarryForwardPreview> = {}): CarryForwardPreview {
	const base: CarryForwardPreview = {
		schoolId: 1,
		fingerprint: 'F',
		sourceRevision: 'S',
		targetRevision: 'T',
		derivedDemandRevision: 'D',
		sourceYear: { enrollProSchoolYearId: 8, yearLabel: '2028-2029', cycle: { state: 'POPULATED', version: 3, ownershipCount: 4 } },
		targetYear: { enrollProSchoolYearId: 9, yearLabel: '2029-2030', cycle: { state: 'EMPTY', version: 0, ownershipCount: 0 } },
		totals: {
			EXACT_CARRY: 2,
			ALREADY_OCCUPIED: 1,
			MISSING_FACULTY: 0,
			MISSING_SECTION: 0,
			NO_CURRENT_DEMAND: 0,
			UNQUALIFIED: 0,
			CAP_BLOCKED: 0,
			AMBIGUOUS: 0,
			OTHER: 0,
		},
		totalsSummary: { sourceRows: 3, carried: 2, skipped: 1 },
		before: { ownershipCount: 0, demandCount: 10, distribution: { zeroLoad: 0, adviserOnly: 0, belowStandard: 0, atStandard: 0, excess: 0, overCap: 0 } },
		after: { distribution: { zeroLoad: 0, adviserOnly: 0, belowStandard: 0, atStandard: 0, excess: 0, overCap: 0 }, overloadChanges: [] },
		perDepartment: [{ department: 'MATH', carry: 2, skipped: 1 }],
		adviserCoverage: { satisfied: 0, unsatisfied: 0 },
		rows: [row('EXACT_CARRY'), row('EXACT_CARRY'), row('ALREADY_OCCUPIED')],
		confirmationText: 'APPLY TEACHING LOAD CARRY-FORWARD',
		zeroWriteProof: { preview: true, writes: 0 },
		authorizesMutation: false,
	};
	return { ...base, ...overrides };
}

test('every carry-forward reason has operator-facing metadata', () => {
	const reasons = Object.keys(CARRY_FORWARD_REASON_META);
	assert.deepEqual(
		reasons.sort(),
		['ALREADY_OCCUPIED', 'AMBIGUOUS', 'CAP_BLOCKED', 'EXACT_CARRY', 'MISSING_FACULTY', 'MISSING_SECTION', 'NO_CURRENT_DEMAND', 'OTHER', 'UNQUALIFIED'].sort(),
	);
	for (const reason of reasons) {
		assert.ok(CARRY_FORWARD_REASON_META[reason as CarryForwardReason].label.length > 0);
		assert.ok(CARRY_FORWARD_REASON_META[reason as CarryForwardReason].description.length > 0);
	}
});

test('summary reports the source and target years with the carried/skipped split', () => {
	const summary = summarizeCarryForwardPreview(preview());
	assert.equal(summary.sourceYearLabel, '2028-2029');
	assert.equal(summary.targetYearLabel, '2029-2030');
	assert.equal(summary.carried, 2);
	assert.equal(summary.skipped, 1);
	assert.equal(summary.tone, 'ready');
	assert.ok(summary.headline.includes('2 of 3'));
});

test('empty and preserved summaries never imply a carry', () => {
	const empty = summarizeCarryForwardPreview(preview({ totalsSummary: { sourceRows: 0, carried: 0, skipped: 0 } }));
	assert.equal(empty.tone, 'empty');
	const preserved = summarizeCarryForwardPreview(preview({ totalsSummary: { sourceRows: 3, carried: 0, skipped: 3 } }));
	assert.equal(preserved.tone, 'preserved');
	assert.equal(preserved.carried, 0);
});

test('reason counts drop zero entries and keep descriptive ordering', () => {
	const counts = carryForwardReasonCounts(preview());
	assert.deepEqual(counts.map((entry) => entry.reason), ['EXACT_CARRY', 'ALREADY_OCCUPIED']);
});

test('rows group by reason with deterministic ordering', () => {
	const groups = groupCarryForwardRowsByReason([row('ALREADY_OCCUPIED'), row('EXACT_CARRY', { targetSectionKey: '7:REGULAR:B' }), row('EXACT_CARRY', { targetSectionKey: '7:REGULAR:A' })]);
	assert.equal(groups[0].reason, 'EXACT_CARRY');
	assert.equal(groups[0].rows[0].targetSectionKey, '7:REGULAR:A');
	assert.equal(groups[1].reason, 'ALREADY_OCCUPIED');
});

test('the apply path is unreachable from the client and explains approval', () => {
	assert.equal(carryForwardApplyBlockedReason(), CARRY_FORWARD_APPLY_BLOCKED_MESSAGE);
	assert.ok(CARRY_FORWARD_APPLY_BLOCKED_MESSAGE.toLowerCase().includes('approval'));
});

test('preview request only carries the three strict scope fields', () => {
	assert.deepEqual(carryForwardPreviewRequest(1, 9, 8), { schoolId: 1, targetSchoolYearId: 9, sourceSchoolYearId: 8 });
});

test('errors surface the server message or action hint', () => {
	assert.equal(formatCarryForwardError({ response: { data: { message: 'typed drift' } } }), 'typed drift');
	assert.equal(formatCarryForwardError({ response: { data: { actionHint: 'refresh first' } } }), 'refresh first');
	assert.ok(formatCarryForwardError(null).length > 0);
});

test('overload description names changed faculty only', () => {
	const text = describeCarryForwardOverload(preview({
		after: {
			distribution: { zeroLoad: 0, adviserOnly: 0, belowStandard: 0, atStandard: 0, excess: 0, overCap: 0 },
			overloadChanges: [
				{ facultyId: 11, name: 'Cruz, Ana', beforeMinutes: 0, afterMinutes: 240, beforeStatus: 'zero-load', afterStatus: 'below-standard', changed: true },
				{ facultyId: 12, name: 'Reyes, Bo', beforeMinutes: 240, afterMinutes: 240, beforeStatus: 'below-standard', afterStatus: 'below-standard', changed: false },
			],
		},
	}));
	assert.ok(text.includes('Cruz, Ana'));
	assert.ok(!text.includes('Reyes, Bo'));
});

test('zero-write preview guard rejects any mutating or non-zero contract', () => {
	assert.equal(carryForwardPreviewIsZeroWrite(preview()), true);
	assert.equal(carryForwardPreviewIsZeroWrite(preview({ authorizesMutation: true })), false);
	assert.equal(carryForwardPreviewIsZeroWrite(preview({ zeroWriteProof: { preview: true, writes: 1 } })), false);
});

test('default source year prefers an archived year with preserved Teaching Load', () => {
	const years = [
		{ enrollProSchoolYearId: 7, preservedCounts: { teachingLoadOwnerships: 0 } },
		{ enrollProSchoolYearId: 8, preservedCounts: { teachingLoadOwnerships: 12 } },
	];
	assert.equal(pickDefaultSourceYear(years)?.enrollProSchoolYearId, 8);
	assert.equal(pickDefaultSourceYear([]), null);
});
