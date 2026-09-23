import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSectionLearnerCounts, LearnerReconciliationError } from '../services/export-learner-count.service.js';

const mirrors = [
	{ externalId: 701, enrolledCount: 3 },
	{ externalId: 702, enrolledCount: 1 },
];

function client(rows = mirrors) {
	return { sectionMirror: { findMany: async () => rows } };
}

function response(data: unknown[], total: number, totalPages: number): Response {
	return new Response(JSON.stringify({ data, meta: { total, totalPages } }), { status: 200 });
}

test('aggregates paginated M/F counts transiently and reconciles to the mirror totals', async () => {
	const calls: string[] = [];
	const fetchImpl = async (input: RequestInfo | URL) => {
		const url = String(input);
		calls.push(url);
		if (url.includes('/701/learners')) {
			return url.includes('page=1')
				? response([{ learner: { sex: 'M' } }, { learner: { sex: 'F' } }], 3, 2)
				: response([{ learner: { sex: 'M' } }], 3, 2);
		}
		return response([{ learner: { sex: 'F' } }], 1, 1);
	};
	const result = await aggregateSectionLearnerCounts({
		schoolId: 9, schoolYearId: 12, sectionIds: [701, 702, 701], authToken: 'test-only', client: client(), fetchImpl,
	});
	assert.deepEqual([...result.entries()], [[701, { male: 2, female: 1, total: 3 }], [702, { male: 0, female: 1, total: 1 }]]);
	assert.equal(calls.length, 3);
	assert.match(calls[0], /schoolYearId=12&page=1&limit=200/);
	assert.ok(calls.every((url) => url.includes('/api/integration/v1/sections/')));
});

test('fails closed on unknown sex, pagination drift, and M/F/T mismatch', async () => {
	const cases: Array<{ name: string; fetchImpl: typeof fetch }> = [
		{ name: 'unknown sex', fetchImpl: async () => response([{ learner: { sex: 'X' } }], 1, 1) },
		{ name: 'unreconciled mirror total', fetchImpl: async () => response([{ learner: { sex: 'M' } }], 1, 1) },
		{ name: 'missing pagination metadata', fetchImpl: async () => new Response(JSON.stringify({ data: [{ learner: { sex: 'M' } }] }), { status: 200 }) },
	];
	for (const item of cases) {
		await assert.rejects(
			() => aggregateSectionLearnerCounts({ schoolId: 9, schoolYearId: 12, sectionIds: [701], authToken: 'test-only', client: client(), fetchImpl: item.fetchImpl }),
			(error: unknown) => error instanceof LearnerReconciliationError,
			item.name,
		);
	}
});

test('fails closed when any section lacks a fresh mirror total or upstream auth', async () => {
	await assert.rejects(
		() => aggregateSectionLearnerCounts({ schoolId: 9, schoolYearId: 12, sectionIds: [701, 702], authToken: 'test-only', client: client([mirrors[0]]), fetchImpl: async () => response([], 0, 0) }),
		(error: unknown) => error instanceof LearnerReconciliationError,
	);
	await assert.rejects(
		() => aggregateSectionLearnerCounts({ schoolId: 9, schoolYearId: 12, sectionIds: [701], client: client(), fetchImpl: async () => response([], 0, 0) }),
		(error: unknown) => error instanceof LearnerReconciliationError,
	);
});
