import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveLoadStatus, deriveWorkloadCapacity, getFacultyLoadSortRank } from '../faculty-assignment-helpers';

test('deriveLoadStatus treats exactly 30 credited hours as at standard', () => {
	assert.deepEqual(deriveLoadStatus(30), { status: 'compliant', label: 'At standard' });
});

test('deriveWorkloadCapacity counts advisory and ancillary credits toward the 30h standard', () => {
	const workload = deriveWorkloadCapacity(25, 5);

	assert.equal(workload.creditedTotalHours, 30);
	assert.equal(workload.toStandardHours, 0);
	assert.equal(workload.toCapHours, 10);
	assert.equal(workload.status, 'compliant');
	assert.equal(workload.statusLabel, 'At standard');
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
	assert.equal(workload.overStandardHours, 10);
	assert.equal(workload.overCapHours, 0);
	assert.equal(workload.status, 'overload-allowed');
	assert.equal(workload.statusLabel, 'Above standard - approval needed');
});

test('deriveWorkloadCapacity flags 36 teaching plus 5 credit as over cap', () => {
	const workload = deriveWorkloadCapacity(36, 5);

	assert.equal(workload.creditedTotalHours, 41);
	assert.equal(workload.overCapHours, 1);
	assert.equal(workload.status, 'over-cap');
	assert.equal(workload.statusLabel, 'Over cap - must fix');
});

test('getFacultyLoadSortRank puts urgent workload states first', () => {
	const cases = [
		{ isActiveForScheduling: true, policyCreditedHours: 41, subjectCount: 2 },
		{ isActiveForScheduling: true, policyCreditedHours: 35, subjectCount: 2 },
		{ isActiveForScheduling: true, policyCreditedHours: 30, subjectCount: 2 },
		{ isActiveForScheduling: true, policyCreditedHours: 20, subjectCount: 2 },
		{ isActiveForScheduling: true, policyCreditedHours: 0, subjectCount: 0 },
		{ isActiveForScheduling: false, policyCreditedHours: 30, subjectCount: 2 },
	];

	assert.deepEqual(cases.map((item) => getFacultyLoadSortRank(item)), [0, 1, 2, 3, 4, 5]);
});