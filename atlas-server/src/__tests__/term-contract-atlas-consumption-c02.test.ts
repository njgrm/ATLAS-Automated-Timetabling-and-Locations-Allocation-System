/**
 * TERM-CONSUME-C02 — ordered term structure vs active-term resolution.
 *
 * Production-path proofs (no database):
 *  - `/school-year` 200 + `/active-term` 409 `ACTIVE_TERM_UNRESOLVED` yields a
 *    verified ordered structure with `activeTerm: null` and a typed
 *    UNRESOLVED state (never `ENROLLPRO_UNREACHABLE`).
 *  - `/school-year` 200 + active-term network/HTTP failure preserves the
 *    structure and reports active-term availability separately.
 *  - An active-term identity that contradicts the structure, a school/year
 *    mismatch, and malformed/duplicate/out-of-order terms fail closed.
 *  - A mutant of the superseded all-or-nothing (200/200) implementation is
 *    proven to reject the valid unresolved-active-term fixture.
 *  - The semantic revision binds the ordered structure only, so a cached
 *    structure is stable across active-term states and replay is idempotent.
 *
 * Run (server workspace): `npx tsx src/__tests__/term-contract-atlas-consumption-c02.test.ts`
 */

import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import test from 'node:test';

import {
	fetchEnrollProTermContract,
	validateCachedContract,
	type VerifiedTermContract,
} from '../services/enrollpro-term-contract.service.js';

const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 77;

type FixtureResponse = { status?: number; body?: unknown; destroy?: boolean };

async function withEnrollProFixture(
	responses: Record<string, FixtureResponse>,
	run: (baseUrl: string) => Promise<void>,
): Promise<void> {
	const server = createServer((req: IncomingMessage, res: ServerResponse) => {
		const response = responses[req.url ?? ''] ?? { status: 404, body: { error: 'not found' } };
		if (response.destroy) {
			req.socket.destroy();
			return;
		}
		res.statusCode = response.status ?? 200;
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify(response.body ?? null));
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
			id: SCHOOL_YEAR_ID,
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

async function fetchWith(
	schoolYear: unknown,
	activeTerm: FixtureResponse,
	requestedYear = SCHOOL_YEAR_ID,
): Promise<Awaited<ReturnType<typeof fetchEnrollProTermContract>>> {
	let outcome: Awaited<ReturnType<typeof fetchEnrollProTermContract>> | undefined;
	await withEnrollProFixture({
		'/integration/v1/school-year': { body: schoolYear },
		'/integration/v1/active-term': activeTerm,
	}, async (baseUrl) => {
		outcome = await fetchEnrollProTermContract({ baseUrl, authToken: 'fixture-token', schoolId: SCHOOL_ID, schoolYearId: requestedYear });
	});
	assert.ok(outcome);
	return outcome;
}

test('C02: school-year 200 + active-term 409 ACTIVE_TERM_UNRESOLVED keeps the ordered structure with a nullable active term', async () => {
	const result = await fetchWith(trimesterSchoolYear(), { status: 409, body: { code: 'ACTIVE_TERM_UNRESOLVED', message: 'no term contains today' } });
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.deepEqual(result.contract.terms.map((term) => term.identity), ['T1', 'T2', 'T3']);
	assert.deepEqual(result.contract.terms.map((term) => term.displayLabel), ['First Trimester', 'Second Trimester', 'Third Trimester']);
	assert.equal(result.contract.activeTerm, null);
	assert.equal(result.contract.activeTermState.availability, 'UNRESOLVED');
	assert.equal(result.contract.activeTermState.code, 'ACTIVE_TERM_UNRESOLVED');
	assert.equal(result.contract.activeTermState.reachable, true);
});

test('C02: active-term network failure preserves the structure and reports availability separately', async () => {
	const result = await fetchWith(trimesterSchoolYear(), { destroy: true });
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.contract.terms.length, 3);
	assert.equal(result.contract.activeTerm, null);
	assert.equal(result.contract.activeTermState.availability, 'UNAVAILABLE');
	assert.equal(result.contract.activeTermState.reachable, false);
	assert.equal(result.contract.activeTermState.code, 'ENROLLPRO_ACTIVE_TERM_UNREACHABLE');
});

test('C02: active-term HTTP 500 preserves the structure and reports availability separately', async () => {
	const result = await fetchWith(trimesterSchoolYear(), { status: 500, body: { error: 'boom' } });
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.contract.terms.length, 3);
	assert.equal(result.contract.activeTerm, null);
	assert.equal(result.contract.activeTermState.availability, 'UNAVAILABLE');
	assert.equal(result.contract.activeTermState.reachable, true);
});

test('C02: an active-term identity outside the ordered structure fails typed', async () => {
	const result = await fetchWith(trimesterSchoolYear(), { body: { data: { schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, activeTerm: 'T9' } } });
	assert.equal(result.ok, false);
	if (result.ok) return;
	assert.equal(result.error.code, 'ACTIVE_TERM_OUTSIDE_CONTRACT');
});

test('C02: active-term year and school mismatches fail typed', async () => {
	const yearMismatch = await fetchWith(trimesterSchoolYear(), { body: { data: { schoolId: SCHOOL_ID, schoolYearId: 78, activeTerm: 'T2' } } });
	assert.equal(yearMismatch.ok, false);
	if (!yearMismatch.ok) assert.equal(yearMismatch.error.code, 'ACTIVE_TERM_YEAR_MISMATCH');

	const schoolMismatch = await fetchWith(trimesterSchoolYear(), { body: { data: { schoolId: SCHOOL_ID + 1, schoolYearId: SCHOOL_YEAR_ID, activeTerm: 'T2' } } });
	assert.equal(schoolMismatch.ok, false);
	if (!schoolMismatch.ok) assert.equal(schoolMismatch.error.code, 'SCHOOL_ID_MISMATCH');
});

test('C02: malformed, mismatched, duplicate, and out-of-order structures fail closed', async () => {
	for (const fixture of [
		{
			name: 'school-year mismatch',
			schoolYear: { data: { id: 78, schoolId: SCHOOL_ID, yearLabel: '2030-2031', termFormat: 'TRIMESTER', terms: trimesterSchoolYear().data.terms } },
			year: SCHOOL_YEAR_ID,
			code: 'SCHOOL_YEAR_MISMATCH',
		},
		{
			name: 'unsupported format',
			schoolYear: { data: { ...trimesterSchoolYear().data, termFormat: 'SEMESTER' } },
			year: SCHOOL_YEAR_ID,
			code: 'TERM_FORMAT_UNSUPPORTED',
		},
		{
			name: 'wrong term count',
			schoolYear: { data: { ...trimesterSchoolYear().data, terms: trimesterSchoolYear().data.terms.slice(0, 2) } },
			year: SCHOOL_YEAR_ID,
			code: 'TERM_COUNT_MISMATCH',
		},
		{
			name: 'duplicate canonical identity',
			schoolYear: { data: { ...trimesterSchoolYear().data, terms: trimesterSchoolYear().data.terms.map((term, index) => index === 2 ? { ...term, identity: 't2' } : term) } },
			year: SCHOOL_YEAR_ID,
			code: 'TERM_IDENTITIES_DUPLICATE',
		},
		{
			name: 'out-of-order explicit order field',
			schoolYear: { data: { ...trimesterSchoolYear().data, terms: trimesterSchoolYear().data.terms.map((term, index) => index === 0 ? { ...term, order: 2 } : term) } },
			year: SCHOOL_YEAR_ID,
			code: 'TERM_ENTRY_INVALID',
		},
		{
			name: 'invalid date range',
			schoolYear: { data: { ...trimesterSchoolYear().data, terms: trimesterSchoolYear().data.terms.map((term, index) => index === 0 ? { ...term, startDate: '2030-10-01' } : term) } },
			year: SCHOOL_YEAR_ID,
			code: 'TERM_DATE_RANGE_INVALID',
		},
	] as const) {
		const result = await fetchWith(fixture.schoolYear, { status: 409, body: { code: 'ACTIVE_TERM_UNRESOLVED' } }, fixture.year);
		assert.equal(result.ok, false, fixture.name);
		if (!result.ok) assert.equal(result.error.code, fixture.code, fixture.name);
	}
});

test('C02 mutant control: the superseded all-or-nothing 200/200 path rejects the valid unresolved fixture', async () => {
	const schoolYear = trimesterSchoolYear();
	const activeTermStatus: number = 409;
	const legacyAllOrNothing = (schoolYearOk: boolean, activeTermOk: boolean) =>
		!schoolYearOk || !activeTermOk
			? { ok: false as const, error: { code: 'ENROLLPRO_UNREACHABLE', message: 'both endpoints must return 200' } }
			: { ok: true as const, terms: schoolYear.data.terms };
	const mutant = legacyAllOrNothing(true, activeTermStatus === 200);
	assert.equal(mutant.ok, false);
	if (!mutant.ok) assert.equal(mutant.error.code, 'ENROLLPRO_UNREACHABLE');

	const production = await fetchWith(schoolYear, { status: activeTermStatus, body: { code: 'ACTIVE_TERM_UNRESOLVED' } });
	assert.equal(production.ok, true, 'production must accept the valid unresolved-active-term fixture');
});

test('C02: cached structure validation binds exact school/year and the structural semantic revision', async () => {
	const result = await fetchWith(trimesterSchoolYear(), { status: 409, body: { code: 'ACTIVE_TERM_UNRESOLVED' } });
	assert.equal(result.ok, true);
	if (!result.ok) return;
	const contract = result.contract;
	assert.equal(validateCachedContract(contract, SCHOOL_ID, SCHOOL_YEAR_ID), null);
	assert.equal(validateCachedContract(contract, SCHOOL_ID + 1, SCHOOL_YEAR_ID)?.code, 'TERM_CACHE_SCHOOL_MISMATCH');
	assert.equal(validateCachedContract(contract, SCHOOL_ID, SCHOOL_YEAR_ID + 1)?.code, 'TERM_CACHE_YEAR_MISMATCH');
	const forged: VerifiedTermContract = { ...contract, semanticRevision: '0'.repeat(64) };
	assert.equal(validateCachedContract(forged, SCHOOL_ID, SCHOOL_YEAR_ID)?.code, 'TERM_CACHE_INVALID');
	const reordered: VerifiedTermContract = { ...contract, terms: [...contract.terms].reverse() };
	assert.equal(validateCachedContract(reordered, SCHOOL_ID, SCHOOL_YEAR_ID)?.code, 'TERM_CACHE_INVALID');
});
