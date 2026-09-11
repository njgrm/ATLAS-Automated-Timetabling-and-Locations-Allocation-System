/**
 * RR-TERM-CACHE-C01 — persisted term authority is a SEPARATE state from year
 * drift. Hermetic proofs via the injected dependency seam (no database, no
 * network): the resolver must distinguish persisted-current, missing, stale,
 * upstream-unavailable, invalid-upstream-contract, year-not-mirrored, and
 * invalid-cache, and must bind staleness to the semantic revision rather than a
 * count-only comparison.
 *
 * Run (server workspace): `npx tsx src/__tests__/term-authority-status-rrtc01.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	normalizeEnrollProTermStructure,
	resolveTermAuthorityStatus,
	type VerifiedTermContract,
} from '../services/enrollpro-term-contract.service.js';

const SCHOOL_ID = 41;
const YEAR_ID = 77;

function structurePayload(options?: { rename?: boolean; reorder?: boolean }) {
	const terms = [
		{ identity: 'T1', displayLabel: 'First Trimester', startDate: '2030-06-03', endDate: '2030-09-13' },
		{ identity: 'T2', displayLabel: options?.rename ? 'Second Cycle (renamed)' : 'Second Trimester', startDate: '2030-09-16', endDate: '2031-01-10' },
		{ identity: 'T3', displayLabel: 'Third Trimester', startDate: '2031-01-13', endDate: '2031-04-04' },
	];
	return {
		data: {
			id: YEAR_ID,
			schoolId: SCHOOL_ID,
			yearLabel: '2030-2031',
			termFormat: 'TRIMESTER',
			terms: options?.reorder ? [terms[1], terms[0], terms[2]] : terms,
		},
	};
}

function contractFrom(payload: unknown): VerifiedTermContract {
	const result = normalizeEnrollProTermStructure({ schoolId: SCHOOL_ID, schoolYearId: YEAR_ID, schoolYearPayload: payload });
	assert.equal(result.ok, true, 'fixture payload must normalize');
	if (!result.ok) throw new Error('fixture payload invalid');
	return {
		...result.structure,
		activeTerm: null,
		activeTermState: {
			availability: 'UNRESOLVED',
			code: 'ACTIVE_TERM_UNRESOLVED',
			message: 'no term contains today',
			reachable: true,
			identity: null,
		},
	};
}

function mirrorRow(contract: VerifiedTermContract | null) {
	return {
		id: 5,
		isArchived: false,
		termContractCache: contract,
		termContractCachedAt: contract ? new Date('2030-01-01T00:00:00Z') : null,
	};
}

function resolve(contract: VerifiedTermContract | null, live: unknown, flags?: { upstreamReachable?: boolean; aligned?: boolean }) {
	return resolveTermAuthorityStatus(
		{
			schoolId: SCHOOL_ID,
			schoolYearId: YEAR_ID,
			upstreamReachable: flags?.upstreamReachable ?? true,
			aligned: flags?.aligned ?? true,
		},
		{
			loadMirror: async () => mirrorRow(contract),
			fetchLive: async () => live as never,
		},
	);
}

test('aligned year with no saved snapshot reports MISSING with exactly one preview repair action', async () => {
	const live = contractFrom(structurePayload());
	const result = await resolve(null, { ok: true, contract: live });
	assert.equal(result.state, 'MISSING');
	assert.equal(result.needsRepair, true);
	assert.equal(result.repairAction, 'PREVIEW_TERM_CACHE_SYNC');
	assert.equal(result.canPreview, true);
	assert.equal(result.persisted, false);
});

test('aligned year with a matching saved snapshot reports PERSISTED_CURRENT and no repair', async () => {
	const live = contractFrom(structurePayload());
	const result = await resolve(live, { ok: true, contract: live });
	assert.equal(result.state, 'PERSISTED_CURRENT');
	assert.equal(result.needsRepair, false);
	assert.equal(result.repairAction, 'NONE');
});

test('same year IDs and term count but a semantically different structure is STALE (count-only comparison must fail)', async () => {
	const cached = contractFrom(structurePayload());
	const live = contractFrom(structurePayload({ rename: true }));
	// Control: a naive count-only / identity-list comparison would call this current.
	assert.equal(cached.terms.length, live.terms.length, 'term counts match');
	assert.deepEqual(cached.terms.map((t) => t.identity), live.terms.map((t) => t.identity), 'identities match');
	assert.notEqual(cached.semanticRevision, live.semanticRevision, 'semantic revisions differ');
	const result = await resolve(cached, { ok: true, contract: live });
	assert.equal(result.state, 'PERSISTED_STALE');
	assert.equal(result.needsRepair, true);
	assert.equal(result.repairAction, 'PREVIEW_TERM_CACHE_SYNC');
	assert.equal(result.persistedSemanticRevision, cached.semanticRevision);
	assert.equal(result.liveSemanticRevision, live.semanticRevision);
});

test('reordered upstream terms are STALE even with the same term count', async () => {
	const cached = contractFrom(structurePayload());
	const live = contractFrom(structurePayload({ reorder: true }));
	assert.equal(cached.terms.length, live.terms.length);
	const result = await resolve(cached, { ok: true, contract: live });
	assert.equal(result.state, 'PERSISTED_STALE');
});

test('unreachable upstream with no saved snapshot reports UPSTREAM_UNAVAILABLE and a retry action', async () => {
	const result = await resolveTermAuthorityStatus(
		{ schoolId: SCHOOL_ID, schoolYearId: YEAR_ID, upstreamReachable: false, aligned: false },
		{ loadMirror: async () => mirrorRow(null), fetchLive: async () => { throw new Error('must not fetch'); } },
	);
	assert.equal(result.state, 'UPSTREAM_UNAVAILABLE');
	assert.equal(result.needsRepair, true);
	assert.equal(result.repairAction, 'RETRY_ENROLLPRO');
	assert.equal(result.canPreview, false);
});

test('unreachable upstream with a valid saved snapshot does not demand repair', async () => {
	const cached = contractFrom(structurePayload());
	const result = await resolveTermAuthorityStatus(
		{ schoolId: SCHOOL_ID, schoolYearId: YEAR_ID, upstreamReachable: false, aligned: false },
		{ loadMirror: async () => mirrorRow(cached), fetchLive: async () => { throw new Error('must not fetch'); } },
	);
	assert.equal(result.state, 'UPSTREAM_UNAVAILABLE');
	assert.equal(result.needsRepair, false);
	assert.equal(result.repairAction, 'NONE');
	assert.equal(result.persisted, true);
});

test('an invalid upstream contract is distinguished from unreachable', async () => {
	const result = await resolve(null, { ok: false, error: { code: 'TERM_COUNT_MISMATCH', message: 'bad terms' } });
	assert.equal(result.state, 'INVALID_UPSTREAM_CONTRACT');
	assert.equal(result.code, 'TERM_COUNT_MISMATCH');
	assert.equal(result.needsRepair, true);
});

test('a malformed persisted snapshot is reported as CACHE_INVALID', async () => {
	const live = contractFrom(structurePayload());
	// JSONB round-trips cannot preserve the order-sensitive hash, so persisted
	// validation is structural: an out-of-order term is the malformed signal.
	const tampered = { ...live, terms: [live.terms[1], live.terms[0], live.terms[2]] };
	const result = await resolve(tampered, { ok: true, contract: live });
	assert.equal(result.state, 'CACHE_INVALID');
	assert.equal(result.needsRepair, true);
	assert.equal(result.repairAction, 'PREVIEW_TERM_CACHE_SYNC');
});

test('a structurally valid but revision-mismatched snapshot is conservatively STALE', async () => {
	const live = contractFrom(structurePayload());
	const forged = { ...live, semanticRevision: 'f'.repeat(64) };
	const result = await resolve(forged, { ok: true, contract: live });
	assert.equal(result.state, 'PERSISTED_STALE');
	assert.equal(result.needsRepair, true);
});

test('a year with no active mirror is reported as YEAR_NOT_MIRRORED without claiming a live check', async () => {
	const result = await resolveTermAuthorityStatus(
		{ schoolId: SCHOOL_ID, schoolYearId: YEAR_ID, upstreamReachable: true, aligned: true },
		{ loadMirror: async () => null, fetchLive: async () => { throw new Error('must not fetch'); } },
	);
	assert.equal(result.state, 'YEAR_NOT_MIRRORED');
	assert.equal(result.needsRepair, false);
});

test('year drift with a reachable upstream reports PERSISTED_UNVERIFIED and leaves the year action authoritative', async () => {
	const cached = contractFrom(structurePayload());
	const result = await resolve(cached, { ok: true, contract: cached }, { upstreamReachable: true, aligned: false });
	assert.equal(result.state, 'PERSISTED_UNVERIFIED');
	assert.equal(result.needsRepair, false);
	assert.equal(result.repairAction, 'NONE');
});
