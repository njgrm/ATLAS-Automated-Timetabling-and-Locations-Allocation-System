import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import test from 'node:test';

import { fetchEnrollProActiveTerm } from '../services/active-term-adapter.service.js';
import {
	fetchEnrollProTermContract,
	resolveTermContractWithDependencies,
	type CachedTermContractRecord,
	type VerifiedTermContract,
} from '../services/enrollpro-term-contract.service.js';
import {
	buildSubjectSchedulingAuthorityView,
	projectSubjectSchedulingDemand,
	resolveSubjectRotationIssues,
} from '../services/subject-scheduling-authority.service.js';
import { createSubject, validateAndFilterPatchFields } from '../services/subject.service.js';

const SCHOOL_ID = 41;

async function withEnrollProFixture(
	responses: Record<string, { status?: number; body: unknown }>,
	run: (baseUrl: string) => Promise<void>,
): Promise<void> {
	const server = createServer((req: IncomingMessage, res: ServerResponse) => {
		const response = responses[req.url ?? ''] ?? { status: 404, body: { error: 'not found' } };
		res.statusCode = response.status ?? 200;
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify(response.body));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address === 'object');
	try {
		await run(`http://127.0.0.1:${address.port}`);
	} finally {
		await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
}

function trimesterSchoolYear() {
	return {
		data: {
			id: 77,
			schoolId: SCHOOL_ID,
			yearLabel: '2030-2031',
			termFormat: 'TRIMESTER',
			terms: [
				{ identity: 'T1', displayLabel: 'First Trimester', startDate: '2030-06-03', endDate: '2030-09-13' },
				{ identity: 'T2', displayLabel: 'Second Trimester', startDate: '2030-09-16', endDate: '2031-01-10' },
				{ identity: 'T3', displayLabel: 'Third Trimester', startDate: '2031-01-13', endDate: '2031-04-04' },
			],
		},
	};
}

test('real adapter fixture preserves the ordered three-term EnrollPro contract', async () => {
	await withEnrollProFixture({
		'/integration/v1/school-year': { body: trimesterSchoolYear() },
		'/integration/v1/active-term': { body: { data: { schoolId: SCHOOL_ID, schoolYearId: 77, activeTerm: 'T2' } } },
	}, async (baseUrl) => {
		const result = await fetchEnrollProTermContract({ baseUrl, authToken: 'fixture-token', schoolId: SCHOOL_ID, schoolYearId: 77 });
		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.contract.format, 'TRIMESTER');
		assert.deepEqual(result.contract.terms.map((term) => term.identity), ['T1', 'T2', 'T3']);
		assert.deepEqual(result.contract.terms.map((term) => term.displayLabel), ['First Trimester', 'Second Trimester', 'Third Trimester']);
		assert.equal(result.contract.terms[0].startDate, '2030-06-03');
		assert.equal(result.contract.activeTerm.identity, 'T2');
		assert.equal(result.contract.activeTerm.order, 2);
		assert.match(result.contract.semanticRevision, /^[a-f0-9]{64}$/);
	});
});

test('mixed authoritative identities and labels remain exact through active resolution, cache, revision, and Subject view', async () => {
	const expectedTerms = [
		{ identity: 'Term-A', displayLabel: 'Launch / Foundations', order: 1, startDate: null, endDate: null },
		{ identity: 'term-b', displayLabel: 'Studio Cycle β', order: 2, startDate: null, endDate: null },
		{ identity: 'term_C', displayLabel: 'Capstone + Defense', order: 3, startDate: null, endDate: null },
	];
	await withEnrollProFixture({
		'/integration/v1/school-year': { body: { data: {
			id: 77,
			schoolId: SCHOOL_ID,
			yearLabel: '2030-2031',
			termFormat: 'TRIMESTER',
			terms: expectedTerms.map(({ identity, displayLabel }) => ({ identity, displayLabel })),
		} } },
		'/integration/v1/active-term': { body: { data: { schoolId: SCHOOL_ID, schoolYearId: 77, activeTerm: 'TERM-B' } } },
	}, async (baseUrl) => {
		const live = await fetchEnrollProTermContract({ baseUrl, authToken: 'fixture-token', schoolId: SCHOOL_ID, schoolYearId: 77 });
		assert.equal(live.ok, true);
		if (!live.ok) return;
		assert.deepEqual(live.contract.terms, expectedTerms);
		assert.equal(live.contract.activeTerm.identity, 'term-b');
		assert.equal(live.contract.activeTerm.displayLabel, 'Studio Cycle β');

		const expectedSemantic = {
			schoolId: SCHOOL_ID,
			schoolYear: { id: 77, yearLabel: '2030-2031' },
			format: 'TRIMESTER',
			terms: expectedTerms,
			activeTerm: { identity: 'term-b', displayLabel: 'Studio Cycle β', order: 2 },
		};
		assert.equal(
			live.contract.semanticRevision,
			createHash('sha256').update(JSON.stringify(expectedSemantic)).digest('hex'),
		);

		const cacheWrites: CachedTermContractRecord[] = [];
		const resolved = await resolveTermContractWithDependencies(
			{ schoolId: SCHOOL_ID, schoolYearId: 77, authToken: 'fixture-token' },
			{
				fetchLive: async () => live,
				loadCache: async () => null,
				saveCache: async (record) => { cacheWrites.push(record); },
			},
		);
		assert.equal(resolved.state, 'VERIFIED_LIVE');
		assert.equal(cacheWrites.length, 1);
		assert.deepEqual(cacheWrites[0].contract, live.contract);

		const view = buildSubjectSchedulingAuthorityView([
			{ id: 42, code: 'SCI_MIXED', rotationFamily: 'SCIENCE', modularOrder: 2, schedulingDisposition: 'SCHEDULED_TEACHING' as const },
		], resolved);
		assert.equal(view.subjects[0].rotationTermIdentity, 'term-b');
		assert.equal(view.subjects[0].rotationTermLabel, 'Studio Cycle β');
	});
});

test('real adapter fixture supports four ordered terms without a T1-T3 ceiling', async () => {
	await withEnrollProFixture({
		'/integration/v1/school-year': {
			body: {
				data: {
					id: 88,
					schoolId: SCHOOL_ID,
					yearLabel: '2031-2032',
					termFormat: 'QUARTERS',
					term1Identity: 'Q-A', term1Label: 'Opening Cycle',
					term1Start: '2031-06-02', term1End: '2031-08-08',
					term2Identity: 'Q-B', term2Label: 'Development Cycle',
					term2Start: '2031-08-11', term2End: '2031-10-17',
					term3Identity: 'Q-C', term3Label: 'Integration Cycle',
					term3Start: '2031-10-20', term3End: '2032-01-09',
					term4Identity: 'Q-D', term4Label: 'Fourth Quarter / Capstone',
					term4Start: '2032-01-12', term4End: '2032-03-27',
				},
			},
		},
		'/integration/v1/active-term': { body: { data: { schoolId: SCHOOL_ID, schoolYearId: 88, activeTerm: 'Q-D' } } },
	}, async (baseUrl) => {
		const result = await fetchEnrollProTermContract({ baseUrl, authToken: 'fixture-token', schoolId: SCHOOL_ID, schoolYearId: 88 });
		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.contract.format, 'QUARTERS');
		assert.equal(result.contract.terms.length, 4);
		assert.deepEqual(result.contract.terms.map((term) => term.identity), ['Q-A', 'Q-B', 'Q-C', 'Q-D']);
		assert.equal(result.contract.terms[3].displayLabel, 'Fourth Quarter / Capstone');
		assert.equal(result.contract.terms[3].endDate, '2032-03-27');
		assert.equal(result.contract.activeTerm.identity, 'Q-D');
		assert.equal(result.contract.activeTerm.order, 4);
		const view = buildSubjectSchedulingAuthorityView([
			{ id: 41, code: 'SCI_Q4', rotationFamily: 'SCIENCE', modularOrder: 4, schedulingDisposition: 'SCHEDULED_TEACHING' as const },
		], { state: 'VERIFIED_LIVE', source: 'enrollpro', degraded: false, code: null, message: 'verified', contract: result.contract });
		assert.equal(view.subjects[0].rotationTermLabel, 'Fourth Quarter / Capstone');
	});
});

test('flat live contracts fail closed when ordered identities or labels are missing and never write cache', async () => {
	const complete = {
		id: 88,
		schoolId: SCHOOL_ID,
		yearLabel: '2031-2032',
		termFormat: 'QUARTERS',
		term1Identity: 'Q-A', term1Label: 'Opening Cycle',
		term2Identity: 'Q-B', term2Label: 'Development Cycle',
		term3Identity: 'Q-C', term3Label: 'Integration Cycle',
		term4Identity: 'Q-D', term4Label: 'Fourth Quarter / Capstone',
	};
	for (const [name, schoolYear, activeTerm] of [
		['sparse flat payload', { id: 88, schoolId: SCHOOL_ID, yearLabel: '2031-2032', termFormat: 'QUARTERS', termCount: 4 }, 'T4'],
		['missing one identity', { ...complete, term4Identity: undefined }, 'T4'],
		['missing one label', { ...complete, term4Label: undefined }, 'Q-D'],
	] as const) {
		await withEnrollProFixture({
			'/integration/v1/school-year': { body: { data: schoolYear } },
			'/integration/v1/active-term': { body: { data: { schoolId: SCHOOL_ID, schoolYearId: 88, activeTerm } } },
		}, async (baseUrl) => {
			const live = await fetchEnrollProTermContract({ baseUrl, authToken: 'fixture-token', schoolId: SCHOOL_ID, schoolYearId: 88 });
			assert.equal(live.ok, false, name);
			if (live.ok) return;
			assert.equal(live.error.code, 'TERM_ENTRY_INVALID', name);
			let cacheWrites = 0;
			const resolved = await resolveTermContractWithDependencies(
				{ schoolId: SCHOOL_ID, schoolYearId: 88, authToken: 'fixture-token' },
				{
					fetchLive: async () => live,
					loadCache: async () => null,
					saveCache: async () => { cacheWrites += 1; },
				},
			);
			assert.equal(resolved.state, 'BLOCKED', name);
			assert.equal(resolved.contract, null, name);
			assert.equal(cacheWrites, 0, name);
		});
	}
});

test('normalization fails closed for unsupported formats and duplicate identities by canonical comparison key', async () => {
	for (const fixture of [
		{
			name: 'unsupported format',
			code: 'TERM_FORMAT_UNSUPPORTED',
			schoolYear: { ...trimesterSchoolYear(), data: { ...trimesterSchoolYear().data, termFormat: 'SEMESTER' } },
		},
		{
			name: 'duplicate canonical identities make active resolution ambiguous',
			code: 'TERM_IDENTITIES_DUPLICATE',
			schoolYear: {
				...trimesterSchoolYear(),
				data: {
					...trimesterSchoolYear().data,
					terms: trimesterSchoolYear().data.terms.map((term, index) => ({ ...term, identity: index === 2 ? 't2' : term.identity })),
				},
			},
		},
	]) {
		await withEnrollProFixture({
			'/integration/v1/school-year': { body: fixture.schoolYear },
			'/integration/v1/active-term': { body: { data: { schoolId: SCHOOL_ID, schoolYearId: 77, activeTerm: 'T2' } } },
		}, async (baseUrl) => {
			const result = await fetchEnrollProTermContract({ baseUrl, authToken: 'fixture-token', schoolId: SCHOOL_ID, schoolYearId: 77 });
			assert.equal(result.ok, false, fixture.name);
			if (result.ok) return;
			assert.equal(result.error.code, fixture.code, fixture.name);
		});
	}
});

test('active-term/year mismatches fail closed with typed outcomes', async () => {
	for (const fixture of [
		{ active: { schoolId: SCHOOL_ID, schoolYearId: 78, activeTerm: 'T2' }, code: 'ACTIVE_TERM_YEAR_MISMATCH' },
		{ active: { schoolId: SCHOOL_ID, schoolYearId: 77, activeTerm: 'T4' }, code: 'ACTIVE_TERM_OUTSIDE_CONTRACT' },
		{ active: { schoolId: SCHOOL_ID + 1, schoolYearId: 77, activeTerm: 'T2' }, code: 'SCHOOL_ID_MISMATCH' },
	]) {
		await withEnrollProFixture({
			'/integration/v1/school-year': { body: trimesterSchoolYear() },
			'/integration/v1/active-term': { body: { data: fixture.active } },
		}, async (baseUrl) => {
			const result = await fetchEnrollProTermContract({ baseUrl, authToken: 'fixture-token', schoolId: SCHOOL_ID, schoolYearId: 77 });
			assert.equal(result.ok, false);
			if (result.ok) return;
			assert.equal(result.error.code, fixture.code);
		});
	}
});

test('generic active-term adapter resolves T4 and rejects a mismatched year', async () => {
	await withEnrollProFixture({
		'/integration/v1/active-term': { body: { data: { schoolYearId: 88, activeTerm: 'T4' } } },
	}, async (baseUrl) => {
		const previousApi = process.env.ENROLLPRO_API;
		const previousToken = process.env.ENROLLPRO_SERVICE_TOKEN;
		process.env.ENROLLPRO_API = baseUrl;
		process.env.ENROLLPRO_SERVICE_TOKEN = 'fixture-token';
		try {
			const valid = await fetchEnrollProActiveTerm(undefined, 88, ['T1', 'T2', 'T3', 'T4']);
			assert.equal(valid.verified, true);
			assert.equal(valid.termIndex, 4);
			const mismatch = await fetchEnrollProActiveTerm(undefined, 87, ['T1', 'T2', 'T3', 'T4']);
			assert.equal(mismatch.verified, false);
			assert.equal(mismatch.code, 'ACTIVE_TERM_YEAR_MISMATCH');
			const outside = await fetchEnrollProActiveTerm(undefined, 88, ['T1', 'T2', 'T3']);
			assert.equal(outside.verified, false);
			assert.equal(outside.code, 'ACTIVE_TERM_CONTRACT_DRIFT');
		} finally {
			if (previousApi === undefined) delete process.env.ENROLLPRO_API; else process.env.ENROLLPRO_API = previousApi;
			if (previousToken === undefined) delete process.env.ENROLLPRO_SERVICE_TOKEN; else process.env.ENROLLPRO_SERVICE_TOKEN = previousToken;
		}
	});
});

test('matching verified cache is degraded, while cross-year cache blocks', async () => {
	const live = await withResolvedFixtureContract();
	const matchingCache: CachedTermContractRecord = {
		contract: live,
		cachedAt: '2030-08-01T00:00:00.000Z',
	};
	const degraded = await resolveTermContractWithDependencies(
		{ schoolId: SCHOOL_ID, schoolYearId: 77, authToken: 'fixture-token' },
		{
			fetchLive: async () => ({ ok: false, error: { code: 'ENROLLPRO_UNREACHABLE', message: 'offline' } }),
			loadCache: async () => matchingCache,
			saveCache: async () => assert.fail('degraded fallback must not rewrite cache'),
		},
	);
	assert.equal(degraded.state, 'VERIFIED_CACHED');
	assert.equal(degraded.degraded, true);
	assert.match(degraded.message, /saved term contract/i);

	const crossYear = await resolveTermContractWithDependencies(
		{ schoolId: SCHOOL_ID, schoolYearId: 77, authToken: 'fixture-token' },
		{
			fetchLive: async () => ({ ok: false, error: { code: 'ENROLLPRO_UNREACHABLE', message: 'offline' } }),
			loadCache: async () => ({ ...matchingCache, contract: { ...live, schoolYear: { ...live.schoolYear, id: 78 } } }),
			saveCache: async () => assert.fail('invalid cache must not be rewritten'),
		},
	);
	assert.equal(crossYear.state, 'BLOCKED');
	assert.equal(crossYear.code, 'TERM_CACHE_YEAR_MISMATCH');

	const tampered = await resolveTermContractWithDependencies(
		{ schoolId: SCHOOL_ID, schoolYearId: 77, authToken: 'fixture-token' },
		{
			fetchLive: async () => ({ ok: false, error: { code: 'ENROLLPRO_UNREACHABLE', message: 'offline' } }),
			loadCache: async () => ({ ...matchingCache, contract: { ...live, semanticRevision: '0'.repeat(64) } }),
			saveCache: async () => assert.fail('tampered cache must not be rewritten'),
		},
	);
	assert.equal(tampered.state, 'BLOCKED');
	assert.equal(tampered.code, 'TERM_CACHE_INVALID');
});

test('only a verified live contract is cached', async () => {
	const live = await withResolvedFixtureContract();
	let saved = 0;
	const result = await resolveTermContractWithDependencies(
		{ schoolId: SCHOOL_ID, schoolYearId: 77, authToken: 'fixture-token' },
		{
			fetchLive: async () => ({ ok: true, contract: live }),
			loadCache: async () => null,
			saveCache: async (record) => {
				saved += 1;
				assert.equal(record.contract.semanticRevision, live.semanticRevision);
			},
		},
	);
	assert.equal(result.state, 'VERIFIED_LIVE');
	assert.equal(saved, 1);
});

test('rotation resolution reports missing, duplicate, and out-of-range family order', async () => {
	const contract = await withResolvedFixtureContract();
	const subjects = [
		{ id: 1, code: 'SCI_BIO', rotationFamily: 'SCIENCE', modularOrder: 1, schedulingDisposition: 'SCHEDULED_TEACHING' as const },
		{ id: 2, code: 'SCI_CHEM', rotationFamily: 'SCIENCE', modularOrder: 2, schedulingDisposition: 'SCHEDULED_TEACHING' as const },
		{ id: 3, code: 'SCI_DUP', rotationFamily: 'SCIENCE', modularOrder: 2, schedulingDisposition: 'SCHEDULED_TEACHING' as const },
		{ id: 4, code: 'SCI_BAD', rotationFamily: 'SCIENCE', modularOrder: 4, schedulingDisposition: 'SCHEDULED_TEACHING' as const },
		{ id: 5, code: 'TLE_MISSING', rotationFamily: 'TLE_ROTATION', modularOrder: null, schedulingDisposition: 'SCHEDULED_TEACHING' as const },
		{ id: 6, code: 'ORPHAN_ORDER', rotationFamily: null, modularOrder: 1, schedulingDisposition: 'SCHEDULED_TEACHING' as const },
	];
	const issues = resolveSubjectRotationIssues(subjects, contract);
	assert.deepEqual(new Set(issues.map((issue) => issue.code)), new Set([
		'ROTATION_ORDER_DUPLICATE',
		'ROTATION_ORDER_OUT_OF_RANGE',
		'ROTATION_ORDER_MISSING',
		'ROTATION_FAMILY_MISSING',
	]));
	const view = buildSubjectSchedulingAuthorityView(subjects, {
		state: 'VERIFIED_LIVE', source: 'enrollpro', degraded: false, code: null,
		message: 'verified', contract,
	});
	assert.equal(view.subjects.find((subject) => subject.id === 2)?.resolvedTerm?.displayLabel, 'Second Trimester');
	assert.ok((view.subjects.find((subject) => subject.id === 3)?.schedulingIssues.length ?? 0) > 0);
});

test('reference-only subjects produce zero projected timetable and Teaching Load demand rows', () => {
	const rows = projectSubjectSchedulingDemand([
		{ id: 1, code: 'HG', schedulingDisposition: 'REFERENCE_ONLY' },
		{ id: 2, code: 'MATH', schedulingDisposition: 'SCHEDULED_TEACHING' },
	]);
	assert.deepEqual(rows.map((row) => row.code), ['MATH']);
	assert.equal(rows.some((row) => row.code === 'HG'), false);
});

test('blocked term authority reports an issue and does not infer a term from modular order', () => {
	const view = buildSubjectSchedulingAuthorityView([
		{ id: 9, code: 'SCI_BIO', rotationFamily: 'SCIENCE', modularOrder: 1, schedulingDisposition: 'SCHEDULED_TEACHING' as const },
	], {
		state: 'BLOCKED', source: 'none', degraded: false, code: 'ENROLLPRO_UNREACHABLE',
		message: 'No matching saved term contract exists.', contract: null,
	});
	assert.equal(view.subjects[0].rotationTermLabel, null);
	assert.equal(view.subjects[0].rotationTermRank, null);
	assert.equal(view.subjects[0].schedulingIssues[0]?.code, 'TERM_CONTRACT_UNAVAILABLE');
});

test('ordinary Subject CRUD accepts disposition and rejects EnrollPro term authority fields', async () => {
	const accepted = validateAndFilterPatchFields({ schedulingDisposition: 'REFERENCE_ONLY' });
	assert.equal(accepted.ok, true);
	const invalidDisposition = validateAndFilterPatchFields({ schedulingDisposition: 'SOMETIMES' });
	assert.equal(invalidDisposition.ok, false);
	if (!invalidDisposition.ok) assert.equal(invalidDisposition.error.code, 'INVALID_SCHEDULING_DISPOSITION');
	for (const field of ['termCount', 'termFormat', 'termIdentities', 'termLabels', 'term1Start', 'term4End']) {
		const rejected = validateAndFilterPatchFields({ [field]: field === 'termCount' ? 4 : 'hostile' });
		assert.equal(rejected.ok, false, field);
		if (rejected.ok) continue;
		assert.equal(rejected.error.code, 'PROTECTED_TERM_AUTHORITY', field);
	}
	await assert.rejects(
		() => createSubject(SCHOOL_ID, {
			code: 'HOSTILE_TERM', name: 'Hostile term authority', minMinutesPerWeek: 225,
			preferredRoomType: 'CLASSROOM', gradeLevels: [7], termCount: 4,
		}),
		(error: unknown) => (error as { code?: string }).code === 'PROTECTED_TERM_AUTHORITY',
	);
});

async function withResolvedFixtureContract() {
	let contract: VerifiedTermContract | undefined;
	await withEnrollProFixture({
		'/integration/v1/school-year': { body: trimesterSchoolYear() },
		'/integration/v1/active-term': { body: { data: { schoolId: SCHOOL_ID, schoolYearId: 77, activeTerm: 'T2' } } },
	}, async (baseUrl) => {
		const result = await fetchEnrollProTermContract({ baseUrl, authToken: 'fixture-token', schoolId: SCHOOL_ID, schoolYearId: 77 });
		assert.equal(result.ok, true);
		if (result.ok) contract = result.contract;
	});
	assert.ok(contract);
	return contract;
}
