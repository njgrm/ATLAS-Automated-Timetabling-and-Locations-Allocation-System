import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveLoadStatus, deriveWorkloadCapacity, getFacultyLoadSortRank } from '../faculty-assignment-helpers';

test('deriveLoadStatus treats exactly 30 credited hours as at standard', () => {
	assert.deepEqual(deriveLoadStatus(30), { status: 'compliant', label: 'At standard' });
});

test('deriveLoadStatus with 30h cap: 31.3h is over-cap', () => {
	assert.deepEqual(deriveLoadStatus(31.3, 30), { status: 'over-cap', label: 'Over maximum', instruction: 'Move classes before generating.' });
});

test('deriveLoadStatus with 40h cap: 31.3h is overload-allowed', () => {
	assert.deepEqual(deriveLoadStatus(31.3, 40), { status: 'overload-allowed', label: 'Above standard', instruction: 'Review before generating.' });
});

test('deriveLoadStatus with 30h cap: 30h is compliant', () => {
	assert.deepEqual(deriveLoadStatus(30, 30), { status: 'compliant', label: 'At standard' });
});

test('deriveLoadStatus with 30h cap: 29h is below-standard', () => {
	assert.deepEqual(deriveLoadStatus(29, 30), { status: 'below-standard', label: 'Below standard' });
});

test('deriveLoadStatus defaults to 40h cap when not specified', () => {
	assert.deepEqual(deriveLoadStatus(35), { status: 'overload-allowed', label: 'Above standard', instruction: 'Review before generating.' });
});

test('deriveWorkloadCapacity keeps advisory/ancillary credit out of the 30h teaching standard', () => {
	const workload = deriveWorkloadCapacity(25, 5);

	assert.equal(workload.teachingHours, 25);
	assert.equal(workload.creditHours, 5);
	assert.equal(workload.creditedTotalHours, 30);
	// Canonical TL-C01 semantics: 25h actual teaching stays below the 30h standard
	// even though credited workload reaches 30h.
	assert.equal(workload.toStandardHours, 5);
	assert.equal(workload.overStandardHours, 0);
	assert.equal(workload.toCapHours, 15);
	assert.equal(workload.status, 'below-standard');
	assert.equal(workload.statusLabel, 'Below standard');
});

test('deriveWorkloadCapacity keeps 30 teaching hours and zero credit at standard', () => {
	const workload = deriveWorkloadCapacity(30, 0);

	assert.equal(workload.creditedTotalHours, 30);
	assert.equal(workload.status, 'compliant');
	assert.equal(workload.statusLabel, 'At standard');
});

test('deriveWorkloadCapacity flags 35 teaching plus 5 credit as approval-needed but within cap', () => {
	const workload = deriveWorkloadCapacity(35, 5);

	assert.equal(workload.creditedTotalHours, 40);
	assert.equal(workload.overStandardHours, 5);
	assert.equal(workload.overCapHours, 0);
	assert.equal(workload.status, 'overload-allowed');
	// Phase 3 / Decision 3: plain DepEd label.
	assert.equal(workload.statusLabel, 'Above standard');
	assert.equal(workload.statusInstruction, 'Review before generating.');
});

test('deriveWorkloadCapacity flags 36 teaching plus 5 credit as above standard but within the 40h cap', () => {
	const workload = deriveWorkloadCapacity(36, 5);

	assert.equal(workload.creditedTotalHours, 41);
	assert.equal(workload.overStandardHours, 6);
	assert.equal(workload.overCapHours, 0);
	assert.equal(workload.status, 'overload-allowed');
	// Phase 3 / Decision 3: plain DepEd label.
	assert.equal(workload.statusLabel, 'Above standard');
	assert.equal(workload.statusInstruction, 'Review before generating.');
});

test('deriveWorkloadCapacity with 30h max: 31.3h is over cap', () => {
	const workload = deriveWorkloadCapacity(31.3, 0, 30);

	assert.equal(workload.status, 'over-cap');
	assert.equal(workload.overCapHours, 1.3);
});

test('getFacultyLoadSortRank puts urgent workload states first', () => {
	const cases = [
		{ isActiveForScheduling: true, actualTeachingHours: 41, sectionTeachingHours: 41, policyCreditedHours: 41, subjectCount: 2, maxHoursPerWeek: 40 },
		{ isActiveForScheduling: true, actualTeachingHours: 35, sectionTeachingHours: 35, policyCreditedHours: 35, subjectCount: 2, maxHoursPerWeek: 40 },
		{ isActiveForScheduling: true, actualTeachingHours: 30, sectionTeachingHours: 30, policyCreditedHours: 30, subjectCount: 2, maxHoursPerWeek: 40 },
		{ isActiveForScheduling: true, actualTeachingHours: 20, sectionTeachingHours: 20, policyCreditedHours: 20, subjectCount: 2, maxHoursPerWeek: 40 },
		{ isActiveForScheduling: true, actualTeachingHours: 0, sectionTeachingHours: 0, policyCreditedHours: 0, subjectCount: 0, maxHoursPerWeek: 40 },
		{ isActiveForScheduling: false, actualTeachingHours: 30, sectionTeachingHours: 30, policyCreditedHours: 30, subjectCount: 2, maxHoursPerWeek: 40 },
	];

	assert.deepEqual(cases.map((item) => getFacultyLoadSortRank(item)), [0, 1, 2, 3, 4, 5]);
});

test('getFacultyLoadSortRank with 30h cap: 31.3h is over-cap (rank 0)', () => {
	const rank = getFacultyLoadSortRank({ isActiveForScheduling: true, actualTeachingHours: 31.3, sectionTeachingHours: 31.3, policyCreditedHours: 31.3, subjectCount: 2, maxHoursPerWeek: 30 });
	assert.equal(rank, 0, '31.3h with 30h cap should be over-cap rank 0');
});

test('getFacultyLoadSortRank with 40h cap: 31.3h is above-standard (rank 1)', () => {
	const rank = getFacultyLoadSortRank({ isActiveForScheduling: true, actualTeachingHours: 31.3, sectionTeachingHours: 31.3, policyCreditedHours: 31.3, subjectCount: 2, maxHoursPerWeek: 40 });
	assert.equal(rank, 1, '31.3h with 40h cap should be above-standard rank 1');
});

test('getFacultyLoadSortRank defaults to 40h cap when maxHoursPerWeek is absent', () => {
	const rank = getFacultyLoadSortRank({ isActiveForScheduling: true, actualTeachingHours: 35, sectionTeachingHours: 35, policyCreditedHours: 35, subjectCount: 2 } as any);
	assert.equal(rank, 1, '35h without explicit cap should default to 40h cap and be above-standard');
});
