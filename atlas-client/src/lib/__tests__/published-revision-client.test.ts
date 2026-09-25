import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	RevisionWithdrawReasonRequiredError,
	SourceRevisionStaleError,
	buildRevisionCreatePayload,
	buildWithdrawPayload,
	describePublishedRevisionFailure,
	extractServerErrorCode,
	identityOverrideFieldLabel,
	isPublishedRevisionErrorCode,
	isSourceRevisionStaleError,
	normalizeIdentityOverrides,
	parseLatestRevisionToken,
} from '@/lib/published-revision-client';

const readContract = {
	revisions: [{ id: 700 }, { id: 701 }],
	count: 2,
	baseRevisionId: 700,
	latestRevisionId: 701,
};

test('read contract exposes the authoritative latest revision token', () => {
	assert.equal(parseLatestRevisionToken(readContract), 701);
});

test('a read contract without an exposed latest revision token is stale (never substitutes)', () => {
	for (const data of [
		undefined,
		null,
		{ revisions: [], count: 0 },
		{ revisions: [], count: 0, latestRevisionId: 0 },
		{ revisions: [], count: 0, latestRevisionId: -1 },
		{ revisions: [], count: 0, latestRevisionId: 701.5 },
		{ revisions: [], count: 0, latestRevisionId: '701' },
	]) {
		assert.throws(() => parseLatestRevisionToken(data as never), SourceRevisionStaleError, `reject missing/invalid token: ${JSON.stringify(data)}`);
	}
});

test('revision create payload binds the fetched latest revision token as sourceRevisionId', () => {
	const payload = buildRevisionCreatePayload({
		effectiveDate: '2030-01-03',
		reason: 'teacher reassignment',
		sourceRevisionId: 701,
		changes: [{ entryId: 'e-1', changeType: 'CHANGE_FACULTY', previous: { facultyId: 20 }, next: { facultyId: 21 } }],
		changeSummary: { changeCount: 1, entryIds: ['e-1'] },
		metadata: { source: 'TACTICAL_SANDBOX_DOCK' },
	});
	assert.equal(payload.sourceRevisionId, 701);
	assert.deepEqual(payload.changes[0].next, { facultyId: 21 });
	assert.equal(payload.changeSummary?.changeCount, 1);
});

test('SOURCE_REVISION_STALE is recognized from service and transport errors without silent retry', () => {
	assert.equal(isSourceRevisionStaleError({ code: 'SOURCE_REVISION_STALE' }), true);
	assert.equal(isSourceRevisionStaleError({ response: { data: { code: 'SOURCE_REVISION_STALE' } } }), true);
	assert.equal(isSourceRevisionStaleError(new Error('plain failure')), false);
	assert.equal(isSourceRevisionStaleError({ response: { data: { code: 'REVISION_PREVIOUS_VALUES_STALE' } } }), false);
	assert.equal(isSourceRevisionStaleError(null), false);
});

// --- S4-client / D4 — effective-dated identity overrides (create contract) ---

const TERM_OVERRIDE = {
	orderedTermContract: {
		format: 'QUARTERS' as const,
		terms: [
			{ identity: 'Q1', displayLabel: 'Q1', order: 1 },
			{ identity: 'Q2', displayLabel: 'Q2', order: 2 },
			{ identity: 'Q3', displayLabel: 'Q3', order: 3 },
			{ identity: 'Q4', displayLabel: 'Q4', order: 4 },
		],
		activeTermOrder: 1,
	},
};

test('an optional identity override is transported under metadata.identityOverrides', () => {
	const payload = buildRevisionCreatePayload({
		effectiveDate: '2030-01-03',
		reason: 'term authority correction',
		sourceRevisionId: 701,
		changes: [{ entryId: 'e-1', previous: { facultyId: 20 }, next: { facultyId: 21 } }],
		identityOverrides: TERM_OVERRIDE,
	});
	assert.deepEqual(payload.metadata?.identityOverrides, TERM_OVERRIDE);
	assert.deepEqual(Object.keys(payload.metadata ?? {}), ['identityOverrides'], 'nothing else is fabricated');
});

test('no identity override means no metadata delta is attached', () => {
	const payload = buildRevisionCreatePayload({
		effectiveDate: '2030-01-03',
		reason: 'teacher reassignment',
		sourceRevisionId: 701,
		changes: [{ entryId: 'e-1', previous: { facultyId: 20 }, next: { facultyId: 21 } }],
		identityOverrides: null,
	});
	assert.equal(payload.metadata, null);
	assert.equal(normalizeIdentityOverrides(undefined), null);
	assert.equal(normalizeIdentityOverrides({}), null);
	assert.equal(normalizeIdentityOverrides({ policy: undefined }), null);
});

test('identity override field labels are operator sentences, never raw keys', () => {
	assert.equal(identityOverrideFieldLabel('orderedTermContract'), 'Ordered term authority');
	assert.equal(identityOverrideFieldLabel('specialEvents'), 'Special events');
	assert.equal(identityOverrideFieldLabel('displaySlots'), 'Display slots');
	assert.equal(identityOverrideFieldLabel('policy'), 'Scheduling policy');
	assert.equal(identityOverrideFieldLabel('classProgramSlots'), 'Class-program template');
	assert.equal(identityOverrideFieldLabel('somethingElse'), 'somethingElse');
});

// --- S4-client / D4 — bounded reason-required withdraw contract ---

test('a withdrawal reason is required locally before any dispatch', () => {
	for (const reason of [undefined, null, '', '   ']) {
		assert.throws(() => buildWithdrawPayload({ reason }), RevisionWithdrawReasonRequiredError);
	}
	assert.throws(() => buildWithdrawPayload({ reason: 'x'.repeat(501) }), RevisionWithdrawReasonRequiredError);
	assert.deepEqual(buildWithdrawPayload({ reason: '  mis-dated revision  ' }), { reason: 'mis-dated revision' });
});

test('typed server failures surface honest operator sentences', () => {
	assert.equal(
		describePublishedRevisionFailure({ response: { data: { code: 'PUBLISHED_IDENTITY_OVERRIDE_INVALID' } } }),
		'The identity change is not in a supported shape. Review it and try again.',
	);
	assert.equal(
		describePublishedRevisionFailure({ code: 'PUBLISHED_IDENTITY_OVERRIDE_INCONSISTENT' }),
		'The identity change contradicts the frozen published schedule (special events do not match the display slots). Correct it and try again.',
	);
	assert.equal(
		describePublishedRevisionFailure({ code: 'CROSS_SCHOOL_DENIED' }),
		'You can only change your own school\'s published schedule.',
	);
	assert.equal(
		describePublishedRevisionFailure({ code: 'PUBLISHED_REVISION_BASE_IMMUTABLE' }),
		'The original publication cannot be withdrawn or superseded.',
	);
	assert.equal(
		describePublishedRevisionFailure({ code: 'REVISION_REASON_REQUIRED' }),
		'A withdrawal reason is required.',
	);
	assert.equal(extractServerErrorCode(new Error('plain')), null);
	assert.equal(isPublishedRevisionErrorCode({ code: 'FORBIDDEN' }, 'FORBIDDEN'), true);
	assert.equal(isPublishedRevisionErrorCode({ code: 'FORBIDDEN' }, 'CROSS_SCHOOL_DENIED'), false);
});
// LANE-C C05 — the fixtures above are hand-built objects with no axios transport
// `code` (superseded as evidence for the real surface, kept as contract rows).
// A real axios 4xx sets `code: 'ERR_BAD_REQUEST'`; the server code lives in
// `response.data.code`. These rows produce the error through axios itself.
test('server codes are read from a real axios 4xx error, not the transport code', async () => {
	const { default: axios, AxiosError } = await import('axios');
	// A custom adapter settles itself; this is axios/lib/core/settle.js for a non-2xx response.
	const failWith = (status: number, data: Record<string, unknown>) => axios.create({
		adapter: async (config) => {
			const response = { data, status, statusText: 'x', headers: {}, config, request: {} };
			throw new AxiosError(
				`Request failed with status code ${status}`,
				[AxiosError.ERR_BAD_REQUEST, AxiosError.ERR_BAD_RESPONSE][Math.floor(status / 100) - 4],
				config,
				{},
				response as never,
			);
		},
	}).post('/preview', {}).then(() => { throw new Error('expected rejection'); }, (error: unknown) => error);

	const refusal = await failWith(409, { code: 'TEACHING_LOAD_QUALIFICATION_MISSING', message: 'plain msg' });
	assert.equal((refusal as { code?: string }).code, 'ERR_BAD_REQUEST', 'axios sets its own transport code');
	assert.equal(extractServerErrorCode(refusal), 'TEACHING_LOAD_QUALIFICATION_MISSING');

	const stale = await failWith(409, { code: 'SOURCE_REVISION_STALE', message: 'stale' });
	assert.equal(isSourceRevisionStaleError(stale), true);

	const bodyless = await failWith(500, {});
	assert.equal(extractServerErrorCode(bodyless), null, 'an axios ERR_* code is never reported as a server code');
});
