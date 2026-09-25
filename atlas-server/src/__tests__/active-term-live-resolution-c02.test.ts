/**
 * ACTIVE-TERM-LIVE-RESOLUTION-C02 (Stage 2) — entry-point pre-resolution proof.
 *
 * This cycle closes the Stage-1 divergence left by
 * `active-term-live-resolution-c01.test.ts`: availability resolved live-first
 * (T2) while generation/publication still read the persisted, frozen snapshot
 * (T1). The active ordered term is now pre-resolved ONCE at each non-transaction
 * entry point and threaded through the existing preflight, input-snapshot, and
 * publication-identity contracts.
 *
 * This file is the fast, database-free half: the resolver policy reuse, the
 * structure binding, the fail-closed semantics, the snapshot null/`-1` contract,
 * and the source-ordering controls that no live fetch happens inside a
 * Serializable/advisory-locked transaction. The real-path, disposable-PostgreSQL
 * half (real `triggerGenerationRun`, real `buildGenerationReadiness`, real
 * `publishSchedule`, observed transaction options, and the zero-write stale
 * interleave) is `active-term-live-resolution-c02-postgres.test.ts`.
 *
 * Run: `npm run test:active-term-live-resolution-c02`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
	resolveActiveOrderedTermIndexLive,
	resolvePreResolvedActiveTermAuthority,
	type ActiveOrderedTermProvider,
	type PersistedTermBoundary,
} from '../services/academic-term.service.js';
import type { TermContractFetchResult } from '../services/enrollpro-term-contract.service.js';
import { resolveActiveAvailabilityTermIndex } from '../services/faculty-availability.service.js';
import {
	GENERATION_INPUT_SNAPSHOT_SCHEMA_VERSION,
	compareGenerationInputSnapshots,
	type GenerationInputSnapshot,
} from '../services/generation-input-snapshot.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const servicePath = (...parts: string[]) => resolve(here, '..', 'services', ...parts);
const readService = (...parts: string[]) => readFileSync(servicePath(...parts), 'utf8');

const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;
/** T2 contains 2026-09-24; the persisted frozen snapshot names T1. */
const NOW = new Date('2026-09-24T12:00:00');

/** Dated boundaries: the date-derived fallback is meaningful only with them. */
const TERMS: PersistedTermBoundary[] = [
	{ identity: 'T1', order: 1, startDate: '2026-04-02', endDate: '2026-09-19' },
	{ identity: 'T2', order: 2, startDate: '2026-09-20', endDate: '2026-10-22' },
	{ identity: 'T3', order: 3, startDate: '2026-10-30', endDate: '2027-06-01' },
];

function persistedCache(order: number | null): unknown {
	return {
		schoolId: SCHOOL_ID,
		schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2030-2031' },
		format: 'TRIMESTER',
		terms: TERMS.map((term) => ({
			identity: term.identity,
			displayLabel: `${term.identity} label`,
			order: term.order,
			startDate: term.startDate,
			endDate: term.endDate,
		})),
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

/** Minimal persisted-mirror read seam for the structure binding. */
function persistedClient(order: number | null, options: { contractPresent?: boolean } = {}) {
	return {
		enrollProSchoolYearMirror: {
			findUnique: async () => (options.contractPresent === false ? null : {
				isActive: true,
				isArchived: false,
				termContractCachedAt: new Date('2026-09-01T00:00:00Z'),
				termContractCache: persistedCache(order),
			}),
		},
	};
}

/** Persisted-mirror read seam whose structure carries no active term and no dates. */
function undatedClient() {
	return {
		enrollProSchoolYearMirror: {
			findUnique: async () => ({
				isActive: true,
				isArchived: false,
				termContractCachedAt: new Date('2026-09-01T00:00:00Z'),
				termContractCache: {
					schoolId: SCHOOL_ID,
					schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2030-2031' },
					format: 'TRIMESTER',
					terms: [
						{ identity: 'T1', displayLabel: 'First', order: 1 },
						{ identity: 'T2', displayLabel: 'Second', order: 2 },
						{ identity: 'T3', displayLabel: 'Third', order: 3 },
					],
				},
			}),
		},
	};
}

// ─── 1. The existing resolver is reused; the three-way policy is unchanged ───

test('C02-1. the entry-point pre-resolution reuses the live-first resolver and binds the persisted structure', async () => {
	const liveT2: ActiveOrderedTermProvider = async () => liveContract(2);

	// Failing-first: the persisted frozen snapshot names T1 while the live term is T2.
	// The pre-resolution returns the live T2 — the Stage-1 divergence value.
	const preResolved = await resolvePreResolvedActiveTermAuthority(SCHOOL_ID, SCHOOL_YEAR_ID, {
		provider: liveT2,
		now: NOW,
		client: persistedClient(1),
	});
	assert.equal(preResolved.termIndex, 2, 'the pre-resolved term is the LIVE term, not the frozen persisted T1');
	assert.equal(
		preResolved.termIndex,
		await resolveActiveOrderedTermIndexLive(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: liveT2, now: NOW }),
		'the pre-resolution returns exactly the existing resolver value (no second policy)',
	);

	// The bound structure is the persisted, network-free verified contract, and its
	// active term IS the pre-resolved term — never the frozen persisted snapshot.
	assert.equal(preResolved.contract?.activeTermOrder, 2, 'the bound contract carries the pre-resolved term');
	assert.equal(preResolved.contract?.terms.length, 3, 'the bound contract keeps the verified ordered structure');
	assert.equal(preResolved.contract?.format, 'TRIMESTER');
});

test('C02-2. persisted/date-derived fallback: unreachable EnrollPro resolves the dated T2, never the frozen T1', async () => {
	const offline: ActiveOrderedTermProvider = async () => UNREACHABLE;
	const preResolved = await resolvePreResolvedActiveTermAuthority(SCHOOL_ID, SCHOOL_YEAR_ID, {
		provider: offline,
		now: NOW,
		client: persistedClient(1),
	});
	assert.equal(preResolved.termIndex, 2, 'the date-derived persisted T2 wins over the frozen snapshot T1');
	assert.equal(preResolved.contract?.activeTermOrder, 2);
});

test('C02-3. missing authority stays null: never Term 1, never a clamped term', async () => {
	const offline: ActiveOrderedTermProvider = async () => UNREACHABLE;

	// Reachable-but-unresolved / invalid are authoritative nulls.
	assert.equal((await resolvePreResolvedActiveTermAuthority(SCHOOL_ID, SCHOOL_YEAR_ID, {
		provider: async () => liveContract(null, 'UNRESOLVED'), now: NOW, client: persistedClient(1),
	})).termIndex, null, 'a reachable UNRESOLVED active term is an authoritative null');
	assert.equal((await resolvePreResolvedActiveTermAuthority(SCHOOL_ID, SCHOOL_YEAR_ID, {
		provider: async () => liveContract(null, 'CONTRACT_INVALID'), now: NOW, client: persistedClient(1),
	})).termIndex, null, 'a reachable CONTRACT_INVALID active term is an authoritative null');

	// No persisted verified structure at all.
	assert.equal((await resolvePreResolvedActiveTermAuthority(SCHOOL_ID, SCHOOL_YEAR_ID, {
		provider: offline, now: NOW, client: persistedClient(1, { contractPresent: false }),
	})).termIndex, null, 'no verified structure resolves to null, not Term 1');
	// A verified structure with no active term AND no date boundaries: neither arm
	// of the three-way policy can name a term, so the authority is unresolved.
	assert.equal((await resolvePreResolvedActiveTermAuthority(SCHOOL_ID, SCHOOL_YEAR_ID, {
		provider: offline, now: NOW, client: undatedClient(),
	})).termIndex, null, 'a structure with neither an active term nor dated boundaries resolves to null, not Term 1');
});

// ─── 2. Stage-2 parity: the generation entry and the availability authority agree ───

test('C02-4. parity: the generation entry-point pre-resolution and the availability WRITE authority resolve the same term', async () => {
	const liveT2: ActiveOrderedTermProvider = async () => liveContract(2);
	const client = persistedClient(1);

	// The availability write authority (Stage 1) resolves live T2.
	const availabilityWriteAuthority = await resolveActiveAvailabilityTermIndex(SCHOOL_ID, SCHOOL_YEAR_ID, client, { provider: liveT2, now: NOW });
	// The Stage-2 generation/publication entry point resolves the same T2.
	const generationEntry = await resolvePreResolvedActiveTermAuthority(SCHOOL_ID, SCHOOL_YEAR_ID, { provider: liveT2, now: NOW, client });

	assert.equal(generationEntry.termIndex, availabilityWriteAuthority.termIndex, 'generation and the availability write authority agree on T2');
	assert.equal(generationEntry.termIndex, 2, 'both moved off the frozen persisted T1');

	// SUPERSEDES the Stage-1 N1 divergence. The old control (retained, unamended, in
	// active-term-live-resolution-c01.test.ts) proved generation read the persisted
	// T1 while availability read live T2. The entry-point pre-resolution is what
	// closes that divergence: both now read the live T2.
	assert.notEqual(generationEntry.termIndex, 1, 'the frozen persisted T1 is no longer the generation-side authority');
});

test('C02-5. the preflight consumes the pre-resolved term for its availability read (the Stage-2 parity seam)', () => {
	const source = readService('generation-preflight.service.ts');
	const span = source.slice(
		source.indexOf('async function buildGenerationPreflightWithContext('),
		source.indexOf('export function buildPreflightConstructorInput('),
	);
	assert.ok(span.includes('hasPreResolvedActiveTerm'), 'the preflight branches on the pre-resolved authority');
	assert.ok(
		span.includes('loadReviewedAvailabilityForTerm(schoolId, schoolYearId, preResolvedActiveTermOrder, client)'),
		'the generation-side availability read consumes the PRE-RESOLVED term, so it matches the availability write authority',
	);
	// The pre-resolved value is never replaced by the frozen persisted snapshot.
	assert.ok(
		span.includes('!hasPreResolvedActiveTerm && resolvedActiveTermOrder == null'),
		'an explicit pre-resolved term is never overwritten by the persisted frozen snapshot',
	);
	// The preflight itself must stay network-free: only the revalidation recheck may
	// consult the live resolver, and only before any transaction.
	const preflightOnly = source.slice(
		source.indexOf('export function buildGenerationPreflight('),
		source.indexOf('export async function revalidateGenerationPreflight('),
	);
	assert.equal(preflightOnly.includes('resolveActiveOrderedTermIndexLive('), false, 'buildGenerationPreflight performs no live resolution');
	assert.equal(/(\?\?|\|\|)\s*1\b/.test(span), false, 'no default-to-Term-1 in the preflight term path');
});

test('C02-6. a pre-resolved term outside the verified structure is a typed TERM_AUTHORITY_STALE blocker, never clamped', () => {
	const source = readService('generation-preflight.service.ts');
	assert.ok(source.includes('isTermIndexWithinContract(preResolvedActiveTermOrder, derived.termStructure.terms)'), 'the pre-resolved term is validated against the verified structure');
	assert.ok(source.includes("code: 'TERM_AUTHORITY_STALE'"), 'the divergence surfaces as the existing typed TERM_AUTHORITY_STALE blocker');
	assert.equal(source.includes('Math.min(preResolvedActiveTermOrder'), false, 'the term is never clamped');
	assert.equal(source.includes('Math.max(preResolvedActiveTermOrder'), false, 'the term is never cycled');
});

test('C02-7. an explicit unresolved pre-resolved term keeps the TERM_AUTHORITY_UNRESOLVED fail-closed path', () => {
	const source = readService('generation-preflight.service.ts');
	assert.ok(
		source.includes("loadReviewedAvailabilityForTerm(schoolId, schoolYearId, preResolvedActiveTermOrder, client)"),
		'an unresolved (null) pre-resolved term still goes through the term-scoped availability read, which returns zero rows',
	);
	assert.ok(source.includes("code: 'TERM_AUTHORITY_UNRESOLVED'"), 'the existing unresolved-authority blocker is preserved');
	assert.equal(/resolvedActiveTermOrder\s*=\s*1\b/.test(source), false, 'no assignment of Term 1');
});

// ─── 3. Snapshot contract: availabilityTermIndex threading and the null/-1 semantics ───

test('C02-8. the input snapshot accepts a pre-resolved term and keeps the unchanged null/-1 fail-closed semantics', () => {
	const source = readService('generation-input-snapshot.service.ts');
	assert.ok(source.includes('options.availabilityTermIndex !== undefined'), 'an explicit pre-resolved term overrides the persisted resolution');
	assert.ok(source.includes(': await resolveAvailabilityTermIndexForSnapshot('), 'omitting the option keeps the historical persisted/network-free resolution');
	// The unchanged fail-closed contract: a null term scopes the read to a
	// non-matching sentinel and records `availabilityTermIndex: null`.
	assert.ok(source.includes('const availabilityTermFilter = availabilityTermIndex ?? -1;'), 'the -1 non-matching sentinel is preserved verbatim');
	assert.ok(source.includes('availabilityTermIndex,'), 'the domain still records availabilityTermIndex');
	// The snapshot module must never become network-aware: no call and no import,
	// only a prose mention of the resolver that resolves at the entry point.
	assert.equal(source.includes('resolveActiveOrderedTermIndexLive('), false, 'the snapshot module performs no live resolution');
	assert.equal(/import[^;]*resolveActiveOrderedTermIndexLive/.test(source), false, 'the snapshot module does not import the live resolver');
	assert.equal(source.includes('fetchEnrollProTermContract'), false, 'the snapshot module imports no live contract fetcher');
	assert.equal(source.includes('enrollpro-term-contract.service'), false, 'the snapshot module has no live-contract dependency at all');
});

test('C02-9. a changed active term makes the run snapshot compare STALE, and an unresolved term never compares FRESH', () => {
	const domain = (availabilityTermIndex: number | null) => ({
		fingerprint: `fp-term-${String(availabilityTermIndex)}`,
		signals: { availabilityTermIndex },
	});
	const snapshot = (availabilityTermIndex: number | null): GenerationInputSnapshot => {
		const availability = domain(availabilityTermIndex);
		return {
			schemaVersion: GENERATION_INPUT_SNAPSHOT_SCHEMA_VERSION,
			schoolId: SCHOOL_ID,
			schoolYearId: SCHOOL_YEAR_ID,
			computedAt: NOW.toISOString(),
			fingerprint: `root-${availability.fingerprint}`,
			domains: {
				teachingLoad: { fingerprint: 'a', signals: {} },
				policy: { fingerprint: 'a', signals: {} },
				rooms: { fingerprint: 'a', signals: {} },
				sections: { fingerprint: 'a', signals: {} },
				subjects: { fingerprint: 'a', signals: {} },
				derivedDemand: { fingerprint: 'a', signals: {} },
				availability,
			},
		};
	};

	// Same pre-resolved term on both sides: the snapshot stays FRESH, so the run
	// bound to the term it was built for is publishable.
	assert.equal(compareGenerationInputSnapshots(snapshot(2), snapshot(2)).status, 'FRESH');

	// A different pre-resolved term is a changed availability domain: STALE, never
	// silently reinterpreted.
	const changed = compareGenerationInputSnapshots(snapshot(2), snapshot(3));
	assert.equal(changed.status, 'STALE', 'a term change after pre-resolution compares STALE');
	assert.deepEqual(changed.changedDomains, ['availability']);

	// The unresolved sentinel can never compare FRESH against a resolved term.
	assert.equal(compareGenerationInputSnapshots(snapshot(2), snapshot(null)).status, 'STALE');
	assert.equal(compareGenerationInputSnapshots(snapshot(null), snapshot(2)).status, 'STALE');
	assert.equal(compareGenerationInputSnapshots(snapshot(null), snapshot(null)).status, 'FRESH', 'two unresolved runs agree with each other');
});

// ─── 4. No live fetch inside Serializable / advisory-locked transactions ───

test('C02-10. generation pre-resolves before the first transaction and never re-fetches inside it', () => {
	const source = readService('generation.service.ts');
	// Scope the ordering control to the trigger itself: the module has unrelated
	// transactions in other functions.
	const triggerSpan = source.slice(source.indexOf('export async function triggerGenerationRun('));
	const preResolveIndex = triggerSpan.indexOf('resolvePreResolvedActiveTermAuthority(schoolId, schoolYearId, {');
	const firstTransactionIndex = triggerSpan.indexOf('db().$transaction(');
	assert.ok(preResolveIndex > 0, 'the trigger pre-resolves the active term');
	assert.ok(firstTransactionIndex > 0, 'the trigger opens a transaction');
	assert.ok(preResolveIndex < firstTransactionIndex, 'the pre-resolution happens BEFORE the first transaction');

	// The captured snapshot and the in-transaction recomputation both receive the
	// same explicit frozen term, and neither passes a provider.
	assert.equal(
		(triggerSpan.match(/\{ availabilityTermIndex: preResolvedActiveTerm\.termIndex \}/g) ?? []).length,
		2,
		'BOTH the captured snapshot and the in-transaction recomputation thread the pre-resolved term',
	);
	const transactionSpan = triggerSpan.slice(firstTransactionIndex);
	assert.equal(transactionSpan.includes('resolvePreResolvedActiveTermAuthority'), false, 'no pre-resolution inside the transaction');
	assert.equal(transactionSpan.includes('fetchEnrollProTermContract'), false, 'no live contract fetch inside the transaction');
});

test('C02-11. the preflight revalidation rechecks the term BEFORE any transaction and reuses the one resolver', () => {
	const source = readService('generation-preflight.service.ts');
	const revalidateSpan = source.slice(source.indexOf('export async function revalidateGenerationPreflight('));
	assert.ok(revalidateSpan.includes('resolveActiveOrderedTermIndexLive('), 'the recheck reuses the existing live resolver (never a second one)');
	assert.ok(revalidateSpan.includes("changed.push('activeTermOrder')"), 'a term change is reported as a changed revision');
	assert.equal(revalidateSpan.includes('?? 1'), false, 'a changed term never falls back to Term 1');
	// Still outside any transaction: the preflight/revalidation modules open none.
	assert.equal(revalidateSpan.includes('$transaction'), false, 'the revalidation opens no transaction');
});

test('C02-12. publication pre-resolves before the advisory lock and passes the contract through the existing seams', () => {
	const source = readService('publication-contract.service.ts');
	const preResolveIndex = source.indexOf('resolvePreResolvedActiveTermAuthority(input.schoolId, input.schoolYearId, {');
	const transactionIndex = source.indexOf('runSerializablePublicationTransaction(client, async (tx) =>');
	const advisoryLockIndex = source.indexOf('pg_advisory_xact_lock');
	assert.ok(preResolveIndex > 0, 'publication pre-resolves the active term');
	assert.ok(transactionIndex > 0, 'publication opens the serializable transaction');
	assert.ok(preResolveIndex < transactionIndex, 'the pre-resolution happens BEFORE the serializable transaction');
	assert.ok(preResolveIndex < advisoryLockIndex, 'the pre-resolution happens BEFORE the publication advisory lock');

	// The existing identity-snapshot seam carries the pre-resolved contract.
	assert.ok(source.includes('termContract: preResolvedTermContract,'), 'the frozen identity snapshot binds the pre-resolved term contract');
	assert.ok(source.includes('{ availabilityTermIndex: preResolvedActiveTerm.termIndex }'), 'the publication input snapshot digests the pre-resolved term');

	const transactionSpan = source.slice(transactionIndex);
	assert.equal(transactionSpan.includes('resolvePreResolvedActiveTermAuthority'), false, 'no pre-resolution inside the publication transaction');
	assert.equal(transactionSpan.includes('fetchEnrollProTermContract'), false, 'no live contract fetch inside the publication transaction');
	// The preserved publication fail-closed codes.
	for (const code of ['PUBLICATION_INPUTS_STALE', 'PUBLICATION_TERM_CONTRACT_INVALID', 'HISTORICAL_YEAR_PUBLICATION_DENIED', 'ACTIVE_SCHOOL_YEAR_AMBIGUOUS']) {
		assert.ok(source.includes(`'${code}'`), `publication preserves ${code}`);
	}
});

test('C02-13. the preserved typed fail-closed codes are all still present, and no default-to-Term-1 was added', () => {
	const files = [
		'academic-term.service.ts',
		'generation-preflight.service.ts',
		'generation.service.ts',
		'generation-input-snapshot.service.ts',
		'publication-contract.service.ts',
		'faculty-availability.service.ts',
		'school-year-drift-guard.service.ts',
	];
	const combined = files.map((file) => readService(file)).join('\n');
	for (const code of [
		'TERM_SCOPE_MISMATCH',
		'TERM_AUTHORITY_UNRESOLVED',
		'TERM_STRUCTURE_UNAVAILABLE',
		'TERM_AUTHORITY_STALE',
		'SOURCE_AUTHORITY_STALE',
		'PUBLICATION_INPUTS_STALE',
		'PUBLICATION_TERM_CONTRACT_INVALID',
		'ACTIVE_YEAR_DRIFT',
	]) {
		assert.ok(combined.includes(`'${code}'`), `the typed code ${code} is preserved`);
	}
	// No new default-to-Term-1 anywhere in the touched term-authority surface.
	for (const file of files) {
		assert.equal(
			/(\?\?|\|\|)\s*1\s*(;|,|\))/m.test(readService(file)),
			false,
			`${file} introduces no \`?? 1\` / \`|| 1\` term default`,
		);
	}
});
