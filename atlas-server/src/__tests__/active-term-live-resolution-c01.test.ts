/**
 * ACTIVE-TERM-LIVE-RESOLUTION-C01 (option C1) — server proof.
 *
 * The persisted `EnrollProSchoolYearMirror.termContractCache.activeTerm` is
 * frozen by design (it is excluded from the semantic revision), so it can be
 * stale at T1 while EnrollPro's live active term is T2. The availability
 * authority resolves the active ordered term live-first and falls back to the
 * SAME date-derived persisted term the client runtime context uses; the
 * generation read stays on the persisted/network-free path.
 *
 * Run: `npm run test:active-term-live-resolution`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
	loadVerifiedOrderedTermContract,
	resolveActiveOrderedTermIndexLive,
	resolvePreResolvedActiveTermAuthority,
	type ActiveOrderedTermProvider,
	type PersistedTermBoundary,
} from '../services/academic-term.service.js';
import type { TermContractFetchResult } from '../services/enrollpro-term-contract.service.js';
import {
	getFacultyAvailability,
	loadReviewedAvailabilityForActiveTerm,
	resolveActiveAvailabilityTermIndex,
	saveAvailabilityDraft,
	type AvailabilitySlotInput,
} from '../services/faculty-availability.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;
/** T2 contains 2026-09-24; T1 ended 2026-09-19 (the stale snapshot names T1). */
const NOW = new Date('2026-09-24T12:00:00');

const TERMS: PersistedTermBoundary[] = [
	{ identity: 'T1', order: 1, startDate: '2026-04-02', endDate: '2026-09-19' },
	{ identity: 'T2', order: 2, startDate: '2026-09-20', endDate: '2026-10-22' },
	{ identity: 'T3', order: 3, startDate: '2026-10-30', endDate: '2027-06-01' },
];

// ─── Fixtures ───

function persistedCache(order: number | null): unknown {
	return {
		schoolId: SCHOOL_ID,
		schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2030-2031' },
		format: 'TRIMESTER',
		terms: TERMS.map((term) => ({ identity: term.identity, displayLabel: `${term.identity} label`, order: term.order, startDate: term.startDate, endDate: term.endDate })),
		...(order == null ? {} : { activeTerm: { identity: `T${order}`, displayLabel: `T${order} label`, order } }),
	};
}

function liveContract(activeOrder: number | null, availability: 'RESOLVED' | 'UNRESOLVED' | 'CONTRACT_INVALID' | 'UNAVAILABLE' = 'RESOLVED', reachable = true): TermContractFetchResult {
	const activeTerm = activeOrder == null ? null : { identity: `T${activeOrder}`, displayLabel: `T${activeOrder} label`, order: activeOrder };
	return {
		ok: true,
		contract: {
			schoolId: SCHOOL_ID,
			schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2030-2031' },
			format: 'TRIMESTER',
			terms: TERMS.map((term) => ({ identity: term.identity, displayLabel: `${term.identity} label`, order: term.order, startDate: term.startDate ?? null, endDate: term.endDate ?? null })),
			semanticRevision: 'fixture-revision',
			activeTerm,
			activeTermState: {
				availability,
				code: availability === 'UNRESOLVED' ? 'ACTIVE_TERM_UNRESOLVED' : availability === 'CONTRACT_INVALID' ? 'ACTIVE_TERM_CONFLICT' : null,
				message: 'fixture',
				reachable,
				identity: activeTerm?.identity ?? null,
			},
		},
	};
}

const UNREACHABLE: TermContractFetchResult = { ok: false, error: { code: 'ENROLLPRO_UNREACHABLE', message: 'offline fixture' } };

type FakeRow = {
	id: number;
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
	termIndex: number;
	status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'REJECTED';
	version: number;
	notes: string | null;
	submittedAt: Date | null;
	reviewedBy: number | null;
	reviewedAt: Date | null;
	reviewerNotes: string | null;
	slots: AvailabilitySlotInput[];
};

function row(id: number, termIndex: number, status: FakeRow['status'] = 'DRAFT'): FakeRow {
	return {
		id, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: 71, termIndex, status, version: 1,
		notes: null, submittedAt: null, reviewedBy: null, reviewedAt: null, reviewerNotes: null, slots: [],
	};
}

function createFakeClient(options: { persistedOrder: number | null; contractPresent?: boolean; rows?: FakeRow[] }) {
	const store = new Map<number, FakeRow>();
	for (const entry of options.rows ?? []) store.set(entry.id, entry);
	const writes: string[] = [];
	const project = (entry: FakeRow) => ({ ...entry, slots: entry.slots.map((slot) => ({ ...slot })) });
	const client: any = {
		enrollProSchoolYearMirror: {
			findUnique: async () => (options.contractPresent === false ? null : {
				isActive: true,
				isArchived: false,
				termContractCachedAt: new Date('2026-09-01T00:00:00Z'),
				termContractCache: persistedCache(options.persistedOrder),
			}),
		},
		facultyMirror: { findFirst: async () => ({ id: 71 }) },
		facultyAvailability: {
			findUnique: async ({ where }: any) => {
				const key = where.schoolId_schoolYearId_facultyId_termIndex;
				const found = [...store.values()].find((entry) =>
					entry.schoolId === key.schoolId && entry.schoolYearId === key.schoolYearId
					&& entry.facultyId === key.facultyId && entry.termIndex === key.termIndex);
				return found ? project(found) : null;
			},
			findMany: async ({ where }: any) => [...store.values()]
				.filter((entry) => (where?.schoolId == null || entry.schoolId === where.schoolId)
					&& (where?.termIndex == null || entry.termIndex === where.termIndex)
					&& (where?.status == null || entry.status === where.status))
				.map(project),
			create: async ({ data }: any) => {
				writes.push('create');
				const created: FakeRow = {
					id: [...store.keys()].reduce((max, id) => Math.max(max, id), 0) + 1, schoolId: data.schoolId, schoolYearId: data.schoolYearId,
					facultyId: data.facultyId, termIndex: data.termIndex, status: data.status ?? 'DRAFT', version: 1,
					notes: data.notes ?? null, submittedAt: null, reviewedBy: null, reviewedAt: null, reviewerNotes: null,
					slots: data.slots?.createMany?.data ?? [],
				};
				store.set(created.id, created);
				return project(created);
			},
			update: async ({ where, data }: any) => {
				writes.push('update');
				const entry = store.get(where.id)!;
				if (data.version !== undefined) entry.version = data.version;
				if (data.status !== undefined) entry.status = data.status;
				if (data.slots?.createMany?.data) entry.slots = data.slots.createMany.data;
				return project(entry);
			},
		},
		facultyAvailabilitySlot: {
			deleteMany: async () => { writes.push('slot.deleteMany'); },
			createMany: async () => { writes.push('slot.createMany'); },
		},
	};
	return { client, writes, store };
}

// ─── 1. Failing-first: persisted T1 + live T2 → availability is T2 (base: T1) ───

test('failing-first: persisted activeTerm T1 + live T2 resolves the availability authority to T2', async () => {
	const { client } = createFakeClient({ persistedOrder: 1, rows: [row(1, 1), row(2, 2)] });
	const liveT2: ActiveOrderedTermProvider = async () => liveContract(2);

	// The BASE authority (still the persisted, network-free read) names the stale T1.
	const persisted = await loadVerifiedOrderedTermContract(SCHOOL_ID, SCHOOL_YEAR_ID, client as never);
	assert.equal(persisted?.activeTermOrder, 1, 'base/persisted authority is stale at T1');

	// The new live-first resolver returns the live T2, not the persisted T1.
	assert.equal(await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: liveT2, now: NOW }), 2);
	assert.equal((await resolveActiveAvailabilityTermIndex(SCHOOL_ID, SCHOOL_YEAR_ID, client, { provider: liveT2, now: NOW })).termIndex, 2);

	// The read and the WRITE both land on T2 — the client's T2 no longer 409s.
	const read = await getFacultyAvailability(SCHOOL_ID, SCHOOL_YEAR_ID, 71, client, { provider: liveT2, now: NOW });
	assert.equal(read?.termIndex, 2, 'the availability read resolves the live term');
	const saved = await saveAvailabilityDraft(
		{ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: 71, termIndex: 2, slots: [] },
		client,
		{ provider: liveT2, now: NOW },
	);
	assert.equal(saved.termIndex, 2, 'the T2 draft write succeeds (no TERM_SCOPE_MISMATCH)');
});

test('mutant control: a live T1 leaves the availability authority at T1 and the T2 save fails', async () => {
	const { client, writes } = createFakeClient({ persistedOrder: 1, rows: [row(1, 1), row(2, 2)] });
	const liveT1: ActiveOrderedTermProvider = async () => liveContract(1);

	assert.equal(await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: liveT1, now: NOW }), 1);
	assert.equal((await getFacultyAvailability(SCHOOL_ID, SCHOOL_YEAR_ID, 71, client, { provider: liveT1, now: NOW }))?.termIndex, 1);
	await assert.rejects(
		() => saveAvailabilityDraft({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: 71, termIndex: 2, slots: [] }, client, { provider: liveT1, now: NOW }),
		(error: any) => error?.code === 'TERM_SCOPE_MISMATCH',
	);
	assert.deepEqual(writes, [], 'a scope mismatch writes nothing');
});

// ─── 2. Live + degraded: same T2; no term → null → TERM_AUTHORITY_UNRESOLVED ───

test('live and degraded both resolve T2; reachable unresolved/invalid are authoritative nulls', async () => {
	const { client } = createFakeClient({ persistedOrder: 1, rows: [row(1, 1), row(2, 2)] });
	const liveT2: ActiveOrderedTermProvider = async () => liveContract(2);
	const offline: ActiveOrderedTermProvider = async () => UNREACHABLE;
	const unresolved: ActiveOrderedTermProvider = async () => liveContract(null, 'UNRESOLVED');
	const invalid: ActiveOrderedTermProvider = async () => liveContract(null, 'CONTRACT_INVALID');
	const networkUnavailable: ActiveOrderedTermProvider = async () => liveContract(null, 'UNAVAILABLE', false);

	// Live T2.
	assert.equal(await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: liveT2, now: NOW }), 2);
	// EnrollPro unreachable → the DATE-DERIVED persisted T2 (not the stale snapshot T1).
	assert.equal(await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: offline, client, now: NOW }), 2);
	assert.equal((await getFacultyAvailability(SCHOOL_ID, SCHOOL_YEAR_ID, 71, client, { provider: offline, now: NOW }))?.termIndex, 2);
	// A network-unreachable active-term response is the same degraded fallback.
	assert.equal(await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: networkUnavailable, client, now: NOW }), 2);
	// Reachable UNRESOLVED / CONTRACT_INVALID are authoritative: null, never Term 1.
	assert.equal(await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: unresolved, now: NOW }), null);
	assert.equal(await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: invalid, now: NOW }), null);
	await assert.rejects(
		() => getFacultyAvailability(SCHOOL_ID, SCHOOL_YEAR_ID, 71, client, { provider: unresolved, now: NOW }),
		(error: any) => error?.code === 'TERM_AUTHORITY_UNRESOLVED',
	);

	// No persisted contract and no live term → null (never Term 1).
	const absent = createFakeClient({ persistedOrder: 1, contractPresent: false });
	assert.equal(await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: offline, client: absent.client, now: NOW }), null);
	await assert.rejects(
		() => resolveActiveAvailabilityTermIndex(SCHOOL_ID, SCHOOL_YEAR_ID, absent.client, { provider: offline, now: NOW }),
		(error: any) => error?.code === 'TERM_AUTHORITY_UNRESOLVED',
	);
});

// ─── 3. Zero writes on read ───

test('availability reads dispatch zero writes', async () => {
	const { client, writes } = createFakeClient({ persistedOrder: 1, rows: [row(2, 2)] });
	const liveT2: ActiveOrderedTermProvider = async () => liveContract(2);
	await getFacultyAvailability(SCHOOL_ID, SCHOOL_YEAR_ID, 71, client, { provider: liveT2, now: NOW });
	await loadReviewedAvailabilityForActiveTerm(SCHOOL_ID, SCHOOL_YEAR_ID, client);
	assert.deepEqual(writes, [], 'no read path writes');
});

// ─── 4. Bounded single-flight + short TTL memo ───

test('the live provider is single-flighted and TTL-memoized per provider + (school, year)', async () => {
	let calls = 0;
	const provider: ActiveOrderedTermProvider = async () => {
		calls += 1;
		await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
		return liveContract(2);
	};
	const [first, second] = await Promise.all([
		resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider, now: NOW }),
		resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider, now: NOW }),
	]);
	assert.equal(first, 2);
	assert.equal(second, 2);
	assert.equal(calls, 1, 'concurrent resolutions share one in-flight request');
	// The completed result is memoized within the TTL window.
	assert.equal(await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider, now: NOW }), 2);
	assert.equal(calls, 1, 'a sequential resolution reuses the TTL memo');
	// A different provider owns its own bounded bucket.
	let otherCalls = 0;
	const other: ActiveOrderedTermProvider = async () => { otherCalls += 1; return liveContract(1); };
	assert.equal(await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: other, now: NOW }), 1);
	assert.equal(otherCalls, 1);
	assert.equal(calls, 1, 'a distinct provider does not consume the first provider memo');
});

// ─── 5. N1 / N3 / no-`?? 1` source controls ───
//
// SUPERSESSION NOTE (ACTIVE-TERM-LIVE-RESOLUTION-C02, 2026-09-25):
// The N1 divergence asserted below was real at Stage 1 and was disclosed as the
// successor's job. Stage 2 closed it: generation, readiness, and publication now
// pre-resolve the SAME live-first term at their non-transaction entry points, so
// the generation-side availability read consumes the availability WRITE
// authority's term. Both N1 controls are RETAINED UNAMENDED as the historical
// evidence of that divergence — `loadReviewedAvailabilityForActiveTerm` is still
// the persisted/network-free fallback used only when a caller pre-resolves no
// term — and the parity replacement sits immediately beside them. Nothing was
// deleted.

test('N1: the generation read stays persisted/network-free while the availability authority uses the live resolver', () => {
	const availabilitySource = readFileSync(resolve(here, '..', 'services', 'faculty-availability.service.ts'), 'utf8');
	const generationRead = availabilitySource.slice(
		availabilitySource.indexOf('export async function loadReviewedAvailabilityForActiveTerm'),
		availabilitySource.indexOf('export async function loadReviewedAvailabilityForTerm'),
	);
	assert.ok(generationRead.includes('loadVerifiedOrderedTermContract'), 'generation read uses the persisted contract');
	assert.equal(generationRead.includes('resolveActiveOrderedTermIndexLive'), false, 'generation read does NOT use the live resolver');
	assert.ok(availabilitySource.includes('resolveActiveOrderedTermIndexLive'), 'the availability authority uses the live resolver');
	assert.equal(/(\?\?|\|\|)\s*1\b/.test(availabilitySource), false, 'no school/term default to 1');

	const runtimeContextSource = readFileSync(resolve(here, '..', 'services', 'runtime-context.service.ts'), 'utf8');
	assert.ok(runtimeContextSource.includes("export { derivePersistedActiveTerm }"), 'N3: runtime-context re-exports the extracted derivation');
	assert.equal(runtimeContextSource.includes('function dayStamp'), false, 'dayStamp is extracted from runtime-context');
});

test('N1 controls (SUPERSEDED by ACTIVE-TERM-LIVE-RESOLUTION-C02 parity, retained as divergence evidence): the generation read resolves the persisted T1 while the availability read resolves live T2', async () => {
	const { client } = createFakeClient({ persistedOrder: 1, rows: [row(1, 1, 'REVIEWED'), row(2, 2, 'REVIEWED')] });
	const liveT2: ActiveOrderedTermProvider = async () => liveContract(2);

	const generationRead = await loadReviewedAvailabilityForActiveTerm(SCHOOL_ID, SCHOOL_YEAR_ID, client);
	assert.equal(generationRead.ok, true);
	assert.equal(generationRead.termIndex, 1, 'N1: generation still reads the persisted T1');
	const availabilityRead = await getFacultyAvailability(SCHOOL_ID, SCHOOL_YEAR_ID, 71, client, { provider: liveT2, now: NOW });
	assert.equal(availabilityRead?.termIndex, 2, 'the availability read resolves live T2');
});

test('N1 replacement (ACTIVE-TERM-LIVE-RESOLUTION-C02): the generation entry point and the availability write authority now resolve the SAME term', async () => {
	const { client } = createFakeClient({ persistedOrder: 1, rows: [row(1, 1, 'REVIEWED'), row(2, 2, 'REVIEWED')] });
	const liveT2: ActiveOrderedTermProvider = async () => liveContract(2);

	// The superseded N1 divergence: the persisted-only generation read lands on T1.
	const supersededGenerationRead = await loadReviewedAvailabilityForActiveTerm(SCHOOL_ID, SCHOOL_YEAR_ID, client);
	assert.equal(supersededGenerationRead.termIndex, 1, 'the superseded persisted-only path still reads T1 (retained as evidence)');

	// The Stage-2 entry-point pre-resolution closes the divergence: generation and
	// the availability write authority both land on the live T2, never Term 1.
	const generationEntry = await resolvePreResolvedActiveTermAuthority(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: liveT2, now: NOW, client });
	assert.equal(generationEntry.termIndex, 2, 'the generation entry point resolves the live T2');
	const availabilityWriteAuthority = await resolveActiveAvailabilityTermIndex(SCHOOL_ID, SCHOOL_YEAR_ID, client, { provider: liveT2, now: NOW });
	assert.equal(generationEntry.termIndex, availabilityWriteAuthority.termIndex, 'generation and the availability write authority agree (parity)');
	assert.notEqual(generationEntry.termIndex, supersededGenerationRead.termIndex, 'the divergence the superseded control recorded is closed at the entry point');
});
