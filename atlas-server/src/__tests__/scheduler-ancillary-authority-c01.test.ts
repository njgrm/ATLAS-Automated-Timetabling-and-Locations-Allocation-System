import assert from 'node:assert/strict';
import test from 'node:test';

import {
	isSchedulerEligibleByAncillaryRoles,
	validateSchedulerAncillaryFeed,
	resolveSchedulerAncillaryAuthority,
} from '../services/scheduler-ancillary-authority.service.js';

import { mapEnrollProRoles } from '../services/scheduler-capabilities.js';

const NOW = Date.parse('2026-09-24T04:00:00.000Z');
const YEAR_ID = 12;
const EMPLOYEE_ID = '1234506';

function feed(overrides: Record<string, unknown> = {}) {
	return {
		data: [{
			teacherId: 6,
			employeeId: EMPLOYEE_ID,
			isActive: true,
			ancillaryRoles: ['GRADE 7 COORDINATOR'],
		}],
		meta: {
			sourceSystem: 'ENROLLPRO',
			generatedAt: new Date(NOW - 60_000).toISOString(),
			scopeSchoolYearId: YEAR_ID,
			totalRows: 1,
		},
		...overrides,
	};
}

test('only the four exact normalized grade-coordinator ancillary roles grant scheduler', () => {
	for (const role of [
		'GRADE 7 COORDINATOR', 'GRADE 8 COORDINATOR',
		'GRADE 9 COORDINATOR', 'GRADE 10 COORDINATOR',
	]) {
		assert.equal(isSchedulerEligibleByAncillaryRoles([`  ${role.toLowerCase()}  `]), true, role);
	}
	for (const role of [
		'GRADE_LEVEL_COORDINATOR', 'ASSISTANT GRADE 7 COORDINATOR',
		'GRADE 7 COORDINATOR ASSISTANT', 'GRADE 11 COORDINATOR', 'TEACHER',
	]) {
		assert.equal(isSchedulerEligibleByAncillaryRoles([role]), false, role);
	}
	assert.equal(isSchedulerEligibleByAncillaryRoles(null), false);
	assert.equal(isSchedulerEligibleByAncillaryRoles(['GRADE 7 COORDINATOR', 4]), false);
});

test('only one active, well-formed employee match in the current fresh feed can grant scheduler', () => {
	assert.deepEqual(validateSchedulerAncillaryFeed(feed(), EMPLOYEE_ID, YEAR_ID, NOW), {
		valid: true, eligible: true, schoolYearId: YEAR_ID,
	});
	assert.equal(validateSchedulerAncillaryFeed(feed({ data: [] }), EMPLOYEE_ID, YEAR_ID, NOW).eligible, false);
	assert.equal(validateSchedulerAncillaryFeed(feed({ data: [
		{ teacherId: 6, employeeId: EMPLOYEE_ID, isActive: true, ancillaryRoles: ['GRADE 7 COORDINATOR'] },
		{ teacherId: 7, employeeId: EMPLOYEE_ID, isActive: true, ancillaryRoles: [] },
	] }), EMPLOYEE_ID, YEAR_ID, NOW).valid, false);
	assert.equal(validateSchedulerAncillaryFeed(feed({ data: [{
		teacherId: 6, employeeId: EMPLOYEE_ID, isActive: false, ancillaryRoles: ['GRADE 7 COORDINATOR'],
	}] }), EMPLOYEE_ID, YEAR_ID, NOW).eligible, false);
	assert.equal(validateSchedulerAncillaryFeed(feed({ data: [{
		teacherId: 6, employeeId: EMPLOYEE_ID, isActive: true, ancillaryRoles: null,
	}] }), EMPLOYEE_ID, YEAR_ID, NOW).valid, false);
	assert.equal(validateSchedulerAncillaryFeed(feed({ meta: { ...feed().meta, scopeSchoolYearId: YEAR_ID + 1 } }), EMPLOYEE_ID, YEAR_ID, NOW).valid, false);
	assert.equal(validateSchedulerAncillaryFeed(feed({ meta: { ...feed().meta, generatedAt: new Date(NOW - 6 * 60_000).toISOString() } }), EMPLOYEE_ID, YEAR_ID, NOW).valid, false);
	assert.equal(validateSchedulerAncillaryFeed(feed({ meta: { ...feed().meta, generatedAt: new Date(NOW + 60_000).toISOString() } }), EMPLOYEE_ID, YEAR_ID, NOW).valid, false);
	assert.equal(validateSchedulerAncillaryFeed(feed({ meta: { ...feed().meta, totalRows: 2 } }), EMPLOYEE_ID, YEAR_ID, NOW).valid, false);
});

test('upstream application roles never grant scheduler; teacher identity remains faculty', () => {
	assert.deepEqual(mapEnrollProRoles(['TEACHER', 'GRADE_LEVEL_COORDINATOR']), {
		role: 'faculty', capabilities: ['faculty:self-service'],
	});
	assert.deepEqual(mapEnrollProRoles(['GRADE_LEVEL_COORDINATOR']), { role: null, capabilities: [] });
});

test('active-year endpoint and faculty ancillary feed are fetched server-side with strict scope and no logging', async () => {
	const calls: Array<{ url: string; headers?: HeadersInit }> = [];
	const fetchImpl: typeof fetch = async (input, init) => {
		const url = String(input);
		calls.push({ url, headers: init?.headers });
		if (url.endsWith('/integration/v1/school-year')) {
			return new Response(JSON.stringify({ data: { id: YEAR_ID, yearLabel: '2030-2031' } }), { status: 200 });
		}
		return new Response(JSON.stringify(feed()), { status: 200 });
	};
	const result = await resolveSchedulerAncillaryAuthority(EMPLOYEE_ID, {
		baseUrl: 'https://enrollpro.test/api',
		serviceToken: 'test-only-secret',
		fetchImpl,
		now: () => NOW,
	});
	assert.deepEqual(result, { verified: true, eligible: true, schoolYearId: YEAR_ID });
	assert.deepEqual(calls.map(({ url }) => url), [
		'https://enrollpro.test/api/integration/v1/school-year',
		`https://enrollpro.test/api/integration/v1/default/faculty?schoolYearId=${YEAR_ID}`,
	]);
	assert.ok(calls.every(({ headers }) => new Headers(headers).get('Authorization') === 'Bearer test-only-secret'));
});

