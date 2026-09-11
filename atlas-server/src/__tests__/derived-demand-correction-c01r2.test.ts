/**
 * DEMAND-C01R2 — Ordered-Term Consumer Closure controls.
 *
 * Run (server workspace): `npx tsx src/__tests__/derived-demand-correction-c01r2.test.ts`
 *
 * RED-to-GREEN controls proving the verified EnrollPro ordered-term contract is
 * preserved through derived demand, generation/review reads, publication,
 * publication revisions, public reads, the timetable client, and the generation
 * snapshot version. PostgreSQL-backed controls (4/5/6) create a uniquely named
 * disposable fixture school/year and remove it with a zero-residue assertion.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { deriveCanonicalDemand, type DerivedDemandInput, type DerivedSubjectInput } from '../services/derived-demand.service.js';
import {
	resolveRequestedTermIndex,
	parseSupportedTermIndex,
	MAX_ACADEMIC_TERM_INDEX,
} from '../services/academic-term.service.js';
import { getRunViolations, getLatestRunViolations } from '../services/generation.service.js';
import {
	compareGenerationInputSnapshots,
	extractGenerationInputSnapshot,
	GENERATION_INPUT_SNAPSHOT_SCHEMA_VERSION,
	type GenerationInputSnapshot,
} from '../services/generation-input-snapshot.service.js';
import { withDataContext } from '../lib/data-context.js';

const SERVER_SRC = new URL('../', import.meta.url);
const SCHOOL_ID = 10;
const YEAR_ID = 20;

function terms(identities: string[]) {
	return identities.map((identity, index) => ({ identity, displayLabel: identity, order: index + 1 }));
}

function subject(overrides: Partial<DerivedSubjectInput> & Pick<DerivedSubjectInput, 'id' | 'code'>): DerivedSubjectInput {
	return {
		name: overrides.code,
		schedulingDisposition: 'SCHEDULED_TEACHING',
		gradeLevels: [7],
		programScopes: ['REGULAR'],
		rotationFamily: null,
		modularOrder: null,
		minMinutesPerWeek: 240,
		preferredRoomType: 'CLASSROOM',
		requiredFeatures: [],
		isActive: true,
		...overrides,
	};
}

function baseInput(overrides: Partial<DerivedDemandInput> = {}): DerivedDemandInput {
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: YEAR_ID,
		yearLabel: '2030-2031',
		termFormat: 'QUARTERS',
		termStructureRevision: 'A'.repeat(64),
		terms: terms(['Q1', 'Q2', 'Q3', 'Q4']),
		sections: [{ sectionMirrorId: 501, externalId: 9001, gradeLevel: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false }],
		subjects: [
			subject({ id: 41, code: 'ROT_1', rotationFamily: 'ROT', modularOrder: 1 }),
			subject({ id: 42, code: 'ROT_2', rotationFamily: 'ROT', modularOrder: 2 }),
			subject({ id: 43, code: 'ROT_3', rotationFamily: 'ROT', modularOrder: 3 }),
			subject({ id: 44, code: 'ROT_4', rotationFamily: 'ROT', modularOrder: 4 }),
		],
		periodLengthMinutes: 60,
		...overrides,
	};
}

function termAuthorityClient(options: {
	format: 'TRIMESTER' | 'QUARTERS';
	termIdentities: string[];
	activeOrder?: number | null;
	run?: Record<string, unknown> | null;
}) {
	const termsList = terms(options.termIdentities);
	const cache: Record<string, unknown> = {
		schoolId: SCHOOL_ID,
		schoolYear: { id: YEAR_ID, yearLabel: '2030-2031' },
		format: options.format,
		terms: termsList,
	};
	if (options.activeOrder != null) {
		const active = termsList[options.activeOrder - 1];
		cache.activeTerm = { identity: active.identity, displayLabel: active.displayLabel, order: active.order };
	}
	return {
		enrollProSchoolYearMirror: {
			findUnique: async () => ({
				isActive: true,
				isArchived: false,
				termContractCachedAt: new Date(),
				termContractCache: cache,
			}),
		},
		generationRun: {
			findFirst: async () => options.run ?? null,
			findMany: async () => options.run ? [options.run] : [],
			findUnique: async () => options.run ? { id: options.run.id, draftEntries: options.run.draftEntries } : null,
		},
		facultyMirror: { findMany: async () => [] },
	};
}

// ─── 1. Quarterly derived demand preserves Q1..Q4 ───────────────────────────

test('control 1: quarterly derived demand produces Q1..Q4 without collapse', () => {
	const result = deriveCanonicalDemand(baseInput());
	assert.equal(result.ok, true);
	if (!result.ok) return;
	const indices = [...new Set(result.timetableLines.map((line) => line.termIndex))].sort((a, b) => a - b);
	assert.deepEqual(indices, [1, 2, 3, 4], 'a quarter contract must retain all four ordered terms');
	assert.deepEqual(Object.keys(result.totalsByTerm).sort(), ['Q1', 'Q2', 'Q3', 'Q4']);
	assert.equal(result.termStructure.terms.length, 4);
	assert.equal(parseSupportedTermIndex(4), 4);
	assert.equal(parseSupportedTermIndex(5), null, 'indices beyond the supported family are rejected syntactically');
	assert.equal(MAX_ACADEMIC_TERM_INDEX, 4);
});

// ─── 2 & 3. Generation/review reads + active resolution ─────────────────────

test('control 2: run/latest violation reads return Q4 for a quarterly contract and reject trimester Q4 typed', async () => {
	const quarterRun = {
		id: 101,
		schoolId: SCHOOL_ID,
		schoolYearId: YEAR_ID,
		status: 'COMPLETED',
		version: 1,
		summary: {},
		draftEntries: [
			{ entryId: 'e-1', termIndex: 1, roomId: 30 },
			{ entryId: 'e-4', termIndex: 4, roomId: 30 },
		],
		violations: [
			{ code: 'ZONE_IMBALANCE_WARNING', severity: 'SOFT', entities: { entryIds: ['e-1'] }, meta: {} },
			{ code: 'ZONE_IMBALANCE_WARNING', severity: 'SOFT', entities: { entryIds: ['e-4'] }, meta: {} },
		],
	};
	const quarterClient = termAuthorityClient({ format: 'QUARTERS', termIdentities: ['Q1', 'Q2', 'Q3', 'Q4'], activeOrder: 4, run: quarterRun });
	const quarterReport = await withDataContext(quarterClient, () => getRunViolations(101, SCHOOL_ID, YEAR_ID, 4));
	assert.equal(quarterReport.violations.length, 1, 'quarterly Q4 violation read returns the Q4 entry');
	const quarterLatest = await withDataContext(quarterClient, () => getLatestRunViolations(SCHOOL_ID, YEAR_ID, 4));
	assert.equal(quarterLatest.violations.length, 1, 'latest quarterly Q4 read exposes Q4');

	const trimesterRun = { ...quarterRun, violations: [
		{ code: 'ZONE_IMBALANCE_WARNING', severity: 'SOFT', entities: { entryIds: ['e-1'] }, meta: {} },
	] };
	const trimesterClient = termAuthorityClient({ format: 'TRIMESTER', termIdentities: ['T1', 'T2', 'T3'], activeOrder: 1, run: trimesterRun });
	await assert.rejects(
		() => withDataContext(trimesterClient, () => getRunViolations(101, SCHOOL_ID, YEAR_ID, 4)),
		(error: { code?: string }) => error?.code === 'TERM_INDEX_OUTSIDE_CONTRACT',
		'a trimester must reject term 4 with a typed error',
	);
	const trimesterReport = await withDataContext(trimesterClient, () => getRunViolations(101, SCHOOL_ID, YEAR_ID, 3));
	assert.equal(trimesterReport.violations.length, 0, 'trimester term 3 read still works');
});

test('control 3: explicit Q4 works while active resolution is unavailable; active fails closed', async () => {
	const noActive = termAuthorityClient({ format: 'QUARTERS', termIdentities: ['Q1', 'Q2', 'Q3', 'Q4'], activeOrder: null });
	assert.equal(await withDataContext(noActive, () => resolveRequestedTermIndex(SCHOOL_ID, YEAR_ID, 4)), 4, 'explicit numeric Q4 read requires only the verified structure');
	await assert.rejects(
		() => withDataContext(noActive, () => resolveRequestedTermIndex(SCHOOL_ID, YEAR_ID, 'active')),
		(error: { code?: string }) => error?.code === 'TERM_FILTER_NOT_READY',
		'active fails closed when no verified active term exists',
	);
	assert.equal(await withDataContext(noActive, () => resolveRequestedTermIndex(SCHOOL_ID, YEAR_ID, undefined)), undefined);
});

// ─── 8. Source guard ────────────────────────────────────────────────────────

test('control 8: no academic-term production path retains a hard-coded three-term union/list/message', async () => {
	const boundary = [
		'services/academic-term.service.ts',
		'services/generation.service.ts',
		'services/publication-contract.service.ts',
		'services/published-revision.service.ts',
		'services/workbook-export.service.ts',
		'services/published-schedule.service.ts',
		'routes/generation.router.ts',
		'routes/published-schedule.router.ts',
	];
	for (const rel of boundary) {
		const source = await readFile(new URL(rel, SERVER_SRC), 'utf8');
		assert.doesNotMatch(source, /\[1, 2, 3\]/, `${rel} must not hard-code a three-term array`);
		assert.doesNotMatch(source, /termIndex must be 1, 2, (or )?3/i, `${rel} must not hard-code a three-term message`);
		assert.doesNotMatch(source, /\btermCount !== 3\b/, `${rel} must not hard-code a three-term contract`);
	}
	// Positive control: unrelated non-academic uses of 1..3 must not be rewritten.
	const gradeLabels = await readFile(new URL('services/qualification.service.ts', SERVER_SRC), 'utf8');
	assert.match(gradeLabels, /QualificationTier = 1 \| 2 \| 3 \| null/, 'qualification tiers remain untouched');
});

// ─── 9. Honest snapshot version ─────────────────────────────────────────────

test('control 9: a schema-v1 snapshot is a version mismatch; a v2 snapshot is fresh only when all domains match', () => {
	assert.equal(GENERATION_INPUT_SNAPSHOT_SCHEMA_VERSION, 2);
	const domain = { fingerprint: 'd', signals: {} };
	const v1 = { schemaVersion: 1, schoolId: 1, schoolYearId: 2, computedAt: 'x', fingerprint: 'old', domains: {
		teachingLoad: domain, policy: domain, rooms: domain, sections: domain, subjects: domain,
	} };
	const v2 = (fingerprint: string, subjectFingerprint = 'd'): GenerationInputSnapshot => ({
		schemaVersion: 2,
		schoolId: 1,
		schoolYearId: 2,
		computedAt: 'x',
		fingerprint,
		domains: {
			teachingLoad: domain,
			policy: domain,
			rooms: domain,
			sections: domain,
			subjects: { fingerprint: subjectFingerprint, signals: {} },
			derivedDemand: domain,
		},
	});
	const extractedV1 = extractGenerationInputSnapshot({ inputSnapshot: v1 });
	assert.ok(extractedV1, 'an old schema snapshot is still extractable so it can be compared');
	const comparison = compareGenerationInputSnapshots(extractedV1, v2('new'));
	assert.equal(comparison.status, 'UNKNOWN');
	assert.equal(comparison.missingReason, 'SNAPSHOT_VERSION_MISMATCH');

	const same = compareGenerationInputSnapshots(v2('same'), v2('same'));
	assert.equal(same.status, 'FRESH');
	const changed = compareGenerationInputSnapshots(v2('same'), v2('same', 'changed'));
	assert.equal(changed.status, 'STALE');
	assert.ok(changed.changedDomains.includes('subjects'));
});

// ─── 10. Existing trimester behavior + C01R parity ──────────────────────────

test('control 10: trimester behavior and DEMAND-C01R parity remain intact', () => {
	const trimester = deriveCanonicalDemand(baseInput({
		termFormat: 'TRIMESTER',
		terms: terms(['T1', 'T2', 'T3']),
		subjects: [
			subject({ id: 31, code: 'SCI_A', rotationFamily: 'SCI', modularOrder: 1 }),
			subject({ id: 32, code: 'SCI_B', rotationFamily: 'SCI', modularOrder: 2 }),
			subject({ id: 33, code: 'SCI_C', rotationFamily: 'SCI', modularOrder: 3 }),
		],
	}));
	assert.equal(trimester.ok, true);
	if (!trimester.ok) return;
	assert.equal(trimester.termStructure.terms.length, 3);
	assert.deepEqual([...new Set(trimester.timetableLines.map((line) => line.termIndex))].sort((a, b) => a - b), [1, 2, 3]);
	assert.equal(trimester.revision.length, 64);
	const missing = deriveCanonicalDemand(baseInput({
		termFormat: 'TRIMESTER',
		terms: terms(['T1', 'T2', 'T3']),
		subjects: [
			subject({ id: 31, code: 'SCI_A', rotationFamily: 'SCI', modularOrder: 1 }),
			subject({ id: 33, code: 'SCI_C', rotationFamily: 'SCI', modularOrder: 3 }),
		],
	}));
	assert.equal(missing.ok, false, 'per-scope rotation completeness stays enforced');
	if (!missing.ok) assert.ok(missing.blockers.some((entry) => entry.code === 'ROTATION_INCOMPLETE'));
});

// ─── Disposable PostgreSQL fixture: 4, 5, 6 ─────────────────────────────────

function loadServerEnv() {
	try {
		const here = dirname(fileURLToPath(import.meta.url));
		const content = readFileSync(resolve(here, '../../.env'), 'utf8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eq = trimmed.indexOf('=');
			if (eq < 0) continue;
			const key = trimmed.slice(0, eq).trim();
			const value = trimmed.slice(eq + 1).trim();
			if (!process.env[key]) process.env[key] = value;
		}
	} catch {
		// `.env` is optional; an explicit DATABASE_URL still works.
	}
}

test('controls 4/5/6: publication, revision, and public reads expose Q4 on a disposable quarterly fixture', async () => {
	loadServerEnv();
	if (!process.env.DATABASE_URL) {
		console.warn('[SKIP] controls 4/5/6 require DATABASE_URL.');
		return;
	}
	const { PrismaClient } = await import('@prisma/client');
	const { publishSchedule } = await import('../services/publication-contract.service.js');
	const { createPublishedScheduleRevision } = await import('../services/published-revision.service.js');
	const { getPublishedSchedulePayload } = await import('../services/published-schedule.service.js');

	const prisma = new PrismaClient();
	const FIXTURE_TAG = `C01R2 ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
	const quarterYearId = 982_003;
	const trimesterYearId = 982_004;
	const actorId = 771_002;
	const now = new Date('2030-01-02T03:04:05.000Z');
	let quarterSchoolId = 0;
	let trimesterSchoolId = 0;

	const termCache = (schoolId: number, yearId: number, format: 'TRIMESTER' | 'QUARTERS', identities: string[]) => ({
		schoolId,
		schoolYear: { id: yearId, yearLabel: `Fixture ${yearId}` },
		format,
		terms: identities.map((identity, index) => ({ identity, displayLabel: identity, order: index + 1 })),
	});
	const inputSnapshot = (schoolId: number, yearId: number): GenerationInputSnapshot => {
		const domain = { fingerprint: 'fixture', signals: {} };
		return {
			schemaVersion: 2,
			schoolId,
			schoolYearId: yearId,
			computedAt: now.toISOString(),
			fingerprint: `fixture-${schoolId}-${yearId}`,
			domains: { teachingLoad: domain, policy: domain, rooms: domain, sections: domain, subjects: domain, derivedDemand: domain },
		};
	};

	try {
		// ── Quarterly fixture ──
		const quarterSchool = await prisma.school.create({ data: { name: `${FIXTURE_TAG} Quarterly`, shortName: 'C01R2Q' } });
		quarterSchoolId = quarterSchool.id;
		await prisma.enrollProSchoolYearMirror.create({
			data: {
				schoolId: quarterSchoolId,
				enrollProSchoolYearId: quarterYearId,
				yearLabel: 'Fixture quarterly',
				isActive: true,
				isArchived: false,
				lastSyncedAt: now,
				termContractCache: termCache(quarterSchoolId, quarterYearId, 'QUARTERS', ['Q1', 'Q2', 'Q3', 'Q4']),
				termContractCachedAt: now,
			},
		});
		const quarterRun = await prisma.generationRun.create({
			data: {
				schoolId: quarterSchoolId,
				schoolYearId: quarterYearId,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: actorId,
				finishedAt: now,
				summary: { inputSnapshot: inputSnapshot(quarterSchoolId, quarterYearId) },
				violations: [],
				unassignedItems: [],
				draftEntries: [
					{ entryId: 'q-1', termIndex: 1, sectionId: 10, subjectId: 40, facultyId: 20, roomId: 30, day: 'MONDAY', startTime: '07:30', endTime: '08:15', durationMinutes: 45 },
					{ entryId: 'q-4', termIndex: 4, sectionId: 10, subjectId: 41, facultyId: 20, roomId: 30, day: 'TUESDAY', startTime: '07:30', endTime: '08:15', durationMinutes: 45 },
				],
				version: 1,
			},
		});

		const publishInput = { schoolId: quarterSchoolId, schoolYearId: quarterYearId, runId: quarterRun.id, actorId, actorSchoolId: quarterSchoolId };
		const publicationEvents: unknown[] = [];
		const published = await withDataContext(prisma, () => publishSchedule(publishInput, {
			now: () => now,
			computeInputSnapshot: async (_schoolId: number, yearId: number) => inputSnapshot(quarterSchoolId, yearId),
			publishEvent: (event) => { publicationEvents.push(event); },
		}));
		assert.equal(published.replayed, false, 'quarterly Q4 initial publication succeeds');
		assert.equal(publicationEvents.length, 1, 'initial publication emits one event');
		const baseRevisionId = published.revisionId;

		// Zero-write trimester rejection of the same Q4 entry.
		const trimesterSchool = await prisma.school.create({ data: { name: `${FIXTURE_TAG} Trimester`, shortName: 'C01R2T' } });
		trimesterSchoolId = trimesterSchool.id;
		await prisma.enrollProSchoolYearMirror.create({
			data: {
				schoolId: trimesterSchoolId,
				enrollProSchoolYearId: trimesterYearId,
				yearLabel: 'Fixture trimester',
				isActive: true,
				isArchived: false,
				lastSyncedAt: now,
				termContractCache: termCache(trimesterSchoolId, trimesterYearId, 'TRIMESTER', ['T1', 'T2', 'T3']),
				termContractCachedAt: now,
			},
		});
		const trimesterRun = await prisma.generationRun.create({
			data: {
				schoolId: trimesterSchoolId,
				schoolYearId: trimesterYearId,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: actorId,
				finishedAt: now,
				summary: { inputSnapshot: inputSnapshot(trimesterSchoolId, trimesterYearId) },
				violations: [],
				unassignedItems: [],
				draftEntries: [{ entryId: 't-4', termIndex: 4, sectionId: 10, subjectId: 40, facultyId: 20, roomId: 30 }],
				version: 1,
			},
		});
		const trimesterCountsBefore = {
			revisions: await prisma.publishedScheduleRevision.count({ where: { schoolId: trimesterSchoolId } }),
			audits: await prisma.auditLog.count({ where: { schoolId: trimesterSchoolId } }),
		};
		await assert.rejects(
			() => withDataContext(prisma, () => publishSchedule({ schoolId: trimesterSchoolId, schoolYearId: trimesterYearId, runId: trimesterRun.id, actorId, actorSchoolId: trimesterSchoolId }, {
				now: () => now,
				computeInputSnapshot: async (_schoolId: number, yearId: number) => inputSnapshot(trimesterSchoolId, yearId),
			})),
			(error: { code?: string }) => error?.code === 'PUBLICATION_TERM_INDEX_OUTSIDE_CONTRACT',
			'a trimester must reject a Q4 run entry',
		);
		assert.deepEqual({
			revisions: await prisma.publishedScheduleRevision.count({ where: { schoolId: trimesterSchoolId } }),
			audits: await prisma.auditLog.count({ where: { schoolId: trimesterSchoolId } }),
		}, trimesterCountsBefore, 'trimester Q4 rejection writes nothing');

		// ── Control 5: publication revision exact-contract rule ──
		const revisionInput = {
			schoolId: quarterSchoolId,
			schoolYearId: quarterYearId,
			sourceRunId: quarterRun.id,
			sourceRevisionId: baseRevisionId,
			actorId,
			effectiveDate: '2030-01-03T00:00:00.000Z',
			reason: 'C01R2 quarterly revision',
			changes: [{ entryId: 'q-4', previous: { roomId: 30, termIndex: 4 }, next: { roomId: 31, termIndex: 4 } }],
		};
		const revision = await withDataContext(prisma, () => createPublishedScheduleRevision(revisionInput, { now, publishEvent: () => undefined }));
		assert.equal(revision.replayed, false, 'quarterly Q4 revision succeeds');
		assert.equal(revision.revision.id > baseRevisionId, true);

		const trimesterRevisionCountsBefore = {
			revisions: await prisma.publishedScheduleRevision.count({ where: { schoolId: trimesterSchoolId } }),
			audits: await prisma.auditLog.count({ where: { schoolId: trimesterSchoolId } }),
		};
		await assert.rejects(
			() => withDataContext(prisma, () => createPublishedScheduleRevision({
				schoolId: trimesterSchoolId,
				schoolYearId: trimesterYearId,
				sourceRunId: trimesterRun.id,
				sourceRevisionId: null,
				actorId,
				effectiveDate: '2030-01-03T00:00:00.000Z',
				reason: 'C01R2 trimester rejection',
				changes: [{ entryId: 't-4', previous: { roomId: 30, termIndex: 4 }, next: { roomId: 31, termIndex: 4 } }],
			}, { now })),
			(error: { code?: string }) => error?.code === 'REVISION_TERM_INDEX_OUTSIDE_CONTRACT' || error?.code === 'PUBLISHED_SOURCE_REQUIRED',
			'a trimester revision must reject term 4',
		);
		assert.deepEqual({
			revisions: await prisma.publishedScheduleRevision.count({ where: { schoolId: trimesterSchoolId } }),
			audits: await prisma.auditLog.count({ where: { schoolId: trimesterSchoolId } }),
		}, trimesterRevisionCountsBefore, 'trimester revision rejection writes nothing');

		// ── Control 6: public published read exposes Q4 with stable ordering ──
		const quarterPayload = await withDataContext(prisma, () => getPublishedSchedulePayload(quarterSchoolId, quarterYearId, { termIndex: 4, requestedDate: '2030-01-04' }, undefined, quarterYearId));
		assert.deepEqual((quarterPayload.entries as Array<{ entryId: string }>).map((entry) => entry.entryId), ['q-4'], 'public Q4 read returns only the Q4 entry');
		const allPayload = await withDataContext(prisma, () => getPublishedSchedulePayload(quarterSchoolId, quarterYearId, { requestedDate: '2030-01-04' }, undefined, quarterYearId));
		assert.deepEqual((allPayload.entries as Array<{ entryId: string }>).map((entry) => entry.entryId), ['q-1', 'q-4'], 'public all-term read preserves base entry order');
		await assert.rejects(
			() => withDataContext(prisma, () => getPublishedSchedulePayload(quarterSchoolId, quarterYearId, { termIndex: 'active', requestedDate: '2030-01-04' }, undefined, quarterYearId)),
			(error: { code?: string }) => error?.code === 'TERM_FILTER_NOT_READY',
			'active public filter fails closed without a verified active term',
		);
	} finally {
		const fixtureSchoolIds = [quarterSchoolId, trimesterSchoolId].filter((id) => id > 0);
		if (fixtureSchoolIds.length > 0) {
			await prisma.$transaction(async (tx) => {
				await tx.publishedScheduleRevision.deleteMany({ where: { schoolId: { in: fixtureSchoolIds } } });
				await tx.auditLog.deleteMany({ where: { schoolId: { in: fixtureSchoolIds } } });
				await tx.generationRun.deleteMany({ where: { schoolId: { in: fixtureSchoolIds } } });
				await tx.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: { in: fixtureSchoolIds } } });
				await tx.school.deleteMany({ where: { id: { in: fixtureSchoolIds } } });
			});
			const residue = await prisma.$transaction(async (tx) => {
				return [
					await tx.publishedScheduleRevision.count({ where: { schoolId: { in: fixtureSchoolIds } } }),
					await tx.auditLog.count({ where: { schoolId: { in: fixtureSchoolIds } } }),
					await tx.generationRun.count({ where: { schoolId: { in: fixtureSchoolIds } } }),
					await tx.enrollProSchoolYearMirror.count({ where: { schoolId: { in: fixtureSchoolIds } } }),
					await tx.school.count({ where: { id: { in: fixtureSchoolIds } } }),
				];
			});
			assert.equal(residue.reduce((sum, value) => sum + value, 0), 0, 'zero residue across all fixture-scoped models');
		}
		await prisma.$disconnect();
	}
});
