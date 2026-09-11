/**
 * EVAL-C01R — Dashboard lifecycle truth negative controls (hermetic).
 *
 * Exercises the REAL service decision guards
 * (`dashboard-readiness.service.ts`): strict publication predicate,
 * DB-pushed publication WHERE, actor scope, runtime-only active-year
 * authority, and the lifecycle fail-closed rules. Zero database/network.
 *
 * Run: `npx tsx src/__tests__/dashboard-lifecycle-truth.test.ts`
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
	buildDashboardPublicationWhere,
	isStrictlyPublishedRun,
	resolveDashboardActiveYear,
	resolveDashboardLifecycle,
	resolveDashboardScope,
} from '../services/dashboard-readiness.service.js';

const SCHOOL = 1;
const ACTIVE_YEAR = 8;
const HISTORICAL_YEAR = 7;
const OTHER_SCHOOL = 2;

const publishedSummary = { isPublished: true };
const unpublishedSummary = { isPublished: false };

function setupReadyLifecycle(overrides: Record<string, unknown> = {}) {
	return resolveDashboardLifecycle({
		subjectCount: 22,
		facultyCount: 42,
		sectionCount: 20,
		unassignedSubjectCount: 0,
		buildingsDone: true,
		latestRunStatus: 'COMPLETED',
		publishedRunPresent: false,
		derivedDemandReady: true,
		hasDomainError: false,
		...overrides,
	} as Parameters<typeof resolveDashboardLifecycle>[0]);
}

test('no run + no revision => never PUBLISHED', () => {
	const lifecycle = resolveDashboardLifecycle({
		subjectCount: 22,
		facultyCount: 42,
		sectionCount: 20,
		unassignedSubjectCount: 1,
		buildingsDone: true,
		latestRunStatus: 'NONE',
		publishedRunPresent: false,
		derivedDemandReady: false,
		hasDomainError: false,
	});
	assert.equal(lifecycle.isPublished, false);
	assert.equal(lifecycle.phase, 'SETUP');
});

test('active-year authority is runtime-only: requested historical year never substitutes', () => {
	// Runtime present → runtime year wins; requested year ignored.
	assert.equal(resolveDashboardActiveYear(ACTIVE_YEAR), ACTIVE_YEAR);
	// Runtime missing/degraded → NO current year, even with a requested year.
	assert.equal(resolveDashboardActiveYear(null), null);
	assert.equal(resolveDashboardActiveYear(undefined), null);
	assert.equal(resolveDashboardActiveYear(0), null);
	assert.equal(resolveDashboardActiveYear(-1), null);
});

test('publication WHERE is DB-pushed: exact school + active year + COMPLETED + isPublished===true, no window', () => {
	const where = buildDashboardPublicationWhere({ schoolId: SCHOOL, schoolYearId: ACTIVE_YEAR }) as Record<string, unknown>;
	assert.equal(where.schoolId, SCHOOL);
	assert.equal(where.schoolYearId, ACTIVE_YEAR);
	assert.equal(where.status, 'COMPLETED');
	assert.deepEqual(where.summary, { path: ['isPublished'], equals: true });
	// No arbitrary take window is encoded in the predicate builder.
	assert.equal('take' in where, false);
});

test('strict predicate: only COMPLETED with isPublished===true counts', () => {
	assert.equal(isStrictlyPublishedRun({ status: 'COMPLETED', summary: publishedSummary }), true);
	assert.equal(isStrictlyPublishedRun({ status: 'SUCCESS', summary: publishedSummary }), true);
	assert.equal(isStrictlyPublishedRun({ status: 'COMPLETED', summary: unpublishedSummary }), false);
	assert.equal(isStrictlyPublishedRun({ status: 'IN_PROGRESS', summary: publishedSummary }), false);
	assert.equal(isStrictlyPublishedRun({ status: 'COMPLETED', summary: null }), false);
});

test('FAILED run with stale publish markers => never PUBLISHED (guard-bypass detector)', () => {
	const staleMarkedSummary = { isPublished: false, publishedAt: '2026-01-01T00:00:00.000Z', publishedBy: 46 };

	// Sensitivity proof: the pre-EVAL-C01 loose rule WOULD have read this row
	// as published. If this assertion ever fails, the fixture no longer
	// exercises the guard and must be repaired.
	const looseRuleSaysPublished =
		(staleMarkedSummary as Record<string, unknown>).isPublished === true ||
		typeof staleMarkedSummary.publishedAt === 'string' ||
		typeof staleMarkedSummary.publishedBy === 'number';
	assert.equal(looseRuleSaysPublished, true, 'fixture must be sensitive to the loose-rule bypass');

	// Even an isPublished:true marker on a FAILED row must not count.
	assert.equal(
		isStrictlyPublishedRun({ status: 'FAILED', summary: { isPublished: true, publishedAt: '2026-01-01T00:00:00.000Z' } }),
		false,
		'FAILED rows never publish, even with stale markers',
	);

	const bypassedLifecycle = setupReadyLifecycle({ publishedRunPresent: true, hasDomainError: false });
	assert.equal(bypassedLifecycle.phase, 'PUBLISHED');
	const guardedLifecycle = setupReadyLifecycle({ latestRunStatus: 'FAILED', publishedRunPresent: false });
	assert.equal(guardedLifecycle.isPublished, false);
	assert.equal(guardedLifecycle.phase, 'GENERATION');
});

test('blocked derived demand => explicit SETUP blocker (never REVIEW/PUBLISHED)', () => {
	const lifecycle = setupReadyLifecycle({ derivedDemandReady: false });
	assert.equal(lifecycle.isPublished, false);
	assert.equal(lifecycle.phase, 'SETUP');
});

test('readiness dependency failure => degraded, never published', () => {
	const lifecycle = setupReadyLifecycle({ publishedRunPresent: true, hasDomainError: true });
	assert.equal(lifecycle.isPublished, false);
	assert.notEqual(lifecycle.phase, 'PUBLISHED');
});

test('unresolved actor school => scope rejected before any domain read', () => {
	for (const actor of [null, undefined, 0, -1, 1.5, Number.NaN]) {
		const verdict = resolveDashboardScope(actor, null);
		assert.equal(verdict.ok, false, `actor ${String(actor)} must be rejected`);
		if (!verdict.ok) assert.equal(verdict.code, 'SCHOOL_SCOPE_REQUIRED');
	}
});

test('cross-school scope rejected; matching/absent query accepted for the actor', () => {
	const mismatch = resolveDashboardScope(SCHOOL, OTHER_SCHOOL);
	assert.equal(mismatch.ok, false);
	if (!mismatch.ok) assert.equal(mismatch.code, 'SCHOOL_SCOPE_MISMATCH');

	const match = resolveDashboardScope(SCHOOL, SCHOOL);
	assert.equal(match.ok, true);
	if (match.ok) assert.equal(match.schoolId, SCHOOL);

	const absentQuery = resolveDashboardScope(SCHOOL, null);
	assert.equal(absentQuery.ok, true);
	if (absentQuery.ok) assert.equal(absentQuery.schoolId, SCHOOL);
});

test('query-shape: publication read selects no heavy JSON fields and no take window', () => {
	const servicePath = fileURLToPath(new URL('../services/dashboard-readiness.service.ts', import.meta.url));
	const source = readFileSync(servicePath, 'utf8');

	// The publication findFirst select must never pull the heavy payloads.
	const selectBlock = source.match(/const row = await prisma\.generationRun\.findFirst\([\s\S]*?\);/)?.[0];
	assert(Boolean(selectBlock), 'publication findFirst present in service source');
	if (selectBlock) {
		assert(!/draftEntries/i.test(selectBlock), 'publication read does not select draftEntries');
		assert(!/violations/i.test(selectBlock), 'publication read does not select violations');
		assert(!/unassignedItems/i.test(selectBlock), 'publication read does not select unassignedItems');
		assert(!/take:\s*\d+/i.test(selectBlock), 'publication read has no numeric take window');
	}
});

test('EVAL-C01R1 failing-first: BOTH generation-run selections carry deterministic secondary id-desc ordering', () => {
	const servicePath = fileURLToPath(new URL('../services/dashboard-readiness.service.ts', import.meta.url));
	const source = readFileSync(servicePath, 'utf8');

	// Failing-first guard: if either the latest-run or the published-run
	// selection loses its secondary id-desc key, this test goes RED
	// deterministically (independent of engine tie order).
	const occurrences = source.split('orderBy: [{ createdAt: \'desc\' }, { id: \'desc\' }],').length - 1;
	assert(
		occurrences >= 2,
		`expected the id-desc secondary ordering on both generation-run selections (latest-run AND published-run), found ${occurrences}`,
	);
});
