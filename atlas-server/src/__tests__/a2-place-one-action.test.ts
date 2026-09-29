/**
 * A2 place-one-action — the SERVER half: a draft placement commit persists and
 * returns the ordered term it was placed into, and an out-of-contract term is
 * rejected rather than silently stored as the schema default (`@default(1)`).
 *
 * TWO LAYERS.
 *
 *  1. PURE — `resolvePlacementTermIndex` is the one boundary both the commit and
 *     the queue replacement run through. It is exercised directly for the
 *     fail-closed rows, so the rejection contract is provable without a database.
 *
 *  2. MOUNTED — the REAL `commitPlacement` service against a guarded disposable
 *     `atlas_restore_drill_*` database: `termIndex: 2` is persisted and returned;
 *     an out-of-contract term is rejected and writes nothing. This is the row the
 *     packet names. It runs through the same harness the source-freshness suites
 *     use and skips (never falls back to another database) when no disposable
 *     PostgreSQL is available.
 *
 * Run (server workspace, the ONLY sanctioned entry point):
 *   npm run test:a2-place-one-action
 */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import {
	MAX_PLACEMENT_TERM_INDEX,
	resolvePlacementTermIndex,
} from '../services/pre-generation-draft.service.js';
import {
	isDisposableHarnessAvailable,
	provisionDisposableDatabase,
	seedCanonicalFixture,
	teardownCanonicalFixture,
	type CanonicalFixture,
	type DisposableDatabase,
} from './helpers/tt-source-freshness-db.js';

const THREE_TERM_CONTRACT = ['T1', 'T2', 'T3'];

// ─── 1. PURE — the fail-closed boundary ──────────────────────────────────────

test('pure: an explicit ordered term inside the contract resolves unchanged', () => {
	assert.equal(resolvePlacementTermIndex(1, THREE_TERM_CONTRACT), 1);
	assert.equal(resolvePlacementTermIndex(2, THREE_TERM_CONTRACT), 2);
	assert.equal(resolvePlacementTermIndex(3, THREE_TERM_CONTRACT), 3);
});

test('pure: no requested term resolves to null (create keeps the default, update leaves the stored term)', () => {
	assert.equal(resolvePlacementTermIndex(undefined, THREE_TERM_CONTRACT), null);
	assert.equal(resolvePlacementTermIndex(null, THREE_TERM_CONTRACT), null);
});

test('pure: a term outside 1..MAX is rejected, never coerced to Term 1', () => {
	for (const bad of [0, -1, MAX_PLACEMENT_TERM_INDEX + 1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
		assert.throws(
			() => resolvePlacementTermIndex(bad, THREE_TERM_CONTRACT),
			(error: { code?: string }) => error.code === 'INVALID_TERM_INDEX',
			`termIndex ${String(bad)} must fail closed with INVALID_TERM_INDEX`,
		);
	}
});

test('pure: a term inside 1..MAX but OUTSIDE the school year ordered contract is rejected', () => {
	// 4 is a valid 1..4 value but this year is a 3-term contract.
	assert.throws(
		() => resolvePlacementTermIndex(4, THREE_TERM_CONTRACT),
		(error: { code?: string; message?: string }) => error.code === 'TERM_INDEX_OUTSIDE_CONTRACT' && /3-term/.test(error.message ?? ''),
	);
	// With no verified contract the range check alone applies, so 4 resolves.
	assert.equal(resolvePlacementTermIndex(4, []), 4);
});

// ─── 2. MOUNTED — the real commit against a disposable database ──────────────

process.env.ENROLLPRO_API = process.env.ENROLLPRO_API ?? 'http://127.0.0.1:1/api';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'a2-place-one-action-draft-secret';

const RUNNABLE = isDisposableHarnessAvailable();
const SKIP = RUNNABLE ? false : 'EXTERNALLY_BLOCKED(DISPOSABLE_DB_UNAVAILABLE)';

let harness: DisposableDatabase | null = null;
let prisma: any = null;
let fixture: CanonicalFixture;

before(async () => {
	if (!RUNNABLE) return;
	harness = provisionDisposableDatabase('a2place');
	if (!harness) return;
	process.env.DATABASE_URL = harness.targetUrl;
	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });
	fixture = await seedCanonicalFixture(prisma, { sectionExternalId: 9_201 });
}, { timeout: 600000 });

after(async () => {
	try {
		if (prisma && fixture) await teardownCanonicalFixture(prisma, fixture.schoolId);
	} catch { /* the database is dropped regardless */ }
	try {
		await prisma?.$disconnect();
	} catch { /* ignore */ }
	if (harness) {
		harness.drop();
		harness.assertDropped();
	}
}, { timeout: 300000 });

/** A commit input on a real canonical slot for the fixture section/subject. */
async function fixturePlacementInput(termIndex: number | undefined) {
	const { listDraftBoardState } = await import('../services/pre-generation-draft.service.js');
	const board = await listDraftBoardState(fixture.schoolId, fixture.schoolYearId);
	const slot = board.classPeriodSlots[0];
	assert.ok(slot, 'the canonical fixture must expose a schedulable class period slot');
	return {
		entryKind: 'SECTION' as const,
		sectionId: fixture.sectionExternalId,
		subjectId: fixture.subjectIdByCode.MATH,
		facultyId: fixture.facultyId,
		roomId: fixture.roomId,
		day: 'MONDAY',
		startTime: slot.startTime,
		endTime: slot.endTime,
		termIndex,
	};
}

test('mounted: commit with termIndex 2 persists termIndex 2 and returns it', { skip: SKIP }, async () => {
	const { commitPlacement } = await import('../services/pre-generation-draft.service.js');
	const result = await commitPlacement(
		fixture.schoolId,
		fixture.schoolYearId,
		9_411,
		await fixturePlacementInput(2),
	);

	assert.equal(result.placement.termIndex, 2, 'the committed placement row carries the ordered term');
	const boardRow = result.board.placements.find((row: { id: number }) => row.id === result.placement.id);
	assert.ok(boardRow, 'the returned board must contain the committed placement');
	assert.equal(boardRow.termIndex, 2, 'the board projection must return the persisted ordered term');

	// The database itself stored 2 — not the schema default 1.
	const stored = await prisma.lockedSession.findUnique({ where: { id: result.placement.id } });
	assert.equal(stored.termIndex, 2, 'the stored column is the requested term, never the @default(1)');
});

test('mounted: an out-of-contract term is rejected and writes nothing', { skip: SKIP }, async () => {
	const { commitPlacement } = await import('../services/pre-generation-draft.service.js');
	const beforeCount = await prisma.lockedSession.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId } });
	const aboveCeiling = await fixturePlacementInput(MAX_PLACEMENT_TERM_INDEX + 1);
	// A term that is inside 1..4 but outside the 3-term contract.
	const outsideContract = await fixturePlacementInput(4);

	await assert.rejects(
		() => commitPlacement(fixture.schoolId, fixture.schoolYearId, 9_411, aboveCeiling),
		(error: { code?: string }) => error.code === 'INVALID_TERM_INDEX',
		'a term above the ordered ceiling must fail closed',
	);
	await assert.rejects(
		() => commitPlacement(fixture.schoolId, fixture.schoolYearId, 9_411, outsideContract),
		(error: { code?: string }) => error.code === 'TERM_INDEX_OUTSIDE_CONTRACT',
		'a term outside the ordered contract must fail closed',
	);

	const afterCount = await prisma.lockedSession.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId } });
	assert.equal(afterCount, beforeCount, 'a rejected term must write no placement');
});
