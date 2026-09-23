/**
 * TIMETABLE-TRUTHFULNESS-C01 — D1/D2/D3 real-route controls.
 *
 * Every case exercises the REAL mounted route (or the REAL publication write)
 * against a synthetic sandbox school on this suite's own disposable PostgreSQL
 * database. The `test:server-db` runner gives each file a fresh
 * `atlas_restore_drill_<yyyymmdd>_<suffix>` database and drops it afterwards;
 * this file asserts the disposable name before the first query and never
 * assumes any other database.
 *
 *  D1 — `GET /api/v1/generation/:schoolId/:schoolYearId/runs` must let a
 *       consumer tell a published run from an unpublished one from the list
 *       alone (`summary.isPublished` + `activePublishedRunId`).
 *  D2 — `GET /api/v1/dashboard/readiness-summary` must report the CANONICAL
 *       projected HARD/SOFT counts, never the raw stored violation-array length
 *       in a field consumers read as blockers.
 *  D3 — the publication write must not store the raw persisted SOFT row count
 *       under a name that reads as the canonical count.
 *
 * Failing-first: on the pre-correction tree, D1's `activePublishedRunId` is
 * absent and every list row has no `summary`; D2's response carries the raw
 * `generation.violationCount` (6 here) with no `blockingHardCount`; D3's stored
 * summary carries `publishedSoftViolationCount` (raw 6) with no
 * `publishedRawSoftViolationCount`.
 *
 * Run: `node scripts/run-db-suite.mjs src/__tests__/timetable-truthfulness-c01.test.ts`
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { PrismaClient, type Prisma } from '@prisma/client';

import app from '../app.js';
import { withDataContext } from '../lib/data-context.js';
import type { GenerationInputSnapshot } from '../services/generation-input-snapshot.service.js';
import { buildViolationReport } from '../services/generation.service.js';
import { publishSchedule } from '../services/publication-contract.service.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const DATABASE_NAME = DATABASE_URL ? new URL(DATABASE_URL).pathname.replace(/^\//, '') : '';

const SCHOOL_LIST = 7799501;
const SCHOOL_COUNTS = 7799502;
const SCHOOL_HARD = 7799503;
const SCHOOL_PUBLISH = 7799504;
const YEAR_LIST = 2101;
const YEAR_COUNTS = 2102;
const YEAR_HARD = 2103;
const YEAR_PUBLISH = 2104;
const ACTOR_ID = 7799500;
const NOW = new Date('2031-06-01T00:00:00.000Z');

const prisma = new PrismaClient();

let server: http.Server | null = null;
let baseUrl = '';

function privilegedToken(schoolId: number): string {
	return jwt.sign(
		{ userId: ACTOR_ID, role: 'officer', authSource: 'local', accountId: ACTOR_ID, schoolId },
		process.env.JWT_SECRET as string,
		{ expiresIn: '1h' },
	);
}

async function requestJson(path: string, bearer?: string): Promise<{ status: number; json: any }> {
	const response = await fetch(`${baseUrl}${path}`, {
		headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
	});
	let json: any = null;
	try { json = await response.json(); } catch { json = null; }
	return { status: response.status, json };
}

/**
 * SOFT fixture: three byte-identical rows (projected to one), two distinct rows,
 * and one retired UNSPECIFIED-zone warning (projected away entirely). The raw
 * stored length is 6; the canonical projection the operator sees is 3.
 */
function softFixture(runId: number, schoolId: number, schoolYearId: number): Array<Record<string, unknown>> {
	const base = { severity: 'SOFT', message: 'TT-TRUTHFULNESS fixture', schoolId, schoolYearId, runId };
	const duplicate = {
		...base,
		code: 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED',
		entities: { facultyId: 9001, day: 'MONDAY', startTime: '07:30', endTime: '08:15', entryIds: ['fixture-entry-1'] },
		meta: { termIndex: 1 },
	};
	return [
		{ ...duplicate },
		{ ...duplicate },
		{ ...duplicate },
		{
			...base,
			code: 'FACULTY_EXCESSIVE_IDLE_GAP',
			entities: { facultyId: 9002, day: 'TUESDAY', startTime: '09:00', endTime: '10:00', entryIds: ['fixture-entry-1'] },
			meta: { termIndex: 1 },
		},
		{
			...base,
			code: 'FACULTY_EXCESSIVE_IDLE_GAP',
			entities: { facultyId: 9003, day: 'WEDNESDAY', startTime: '10:00', endTime: '11:00', entryIds: ['fixture-entry-1'] },
			meta: { termIndex: 1 },
		},
		{
			...base,
			code: 'ZONE_IMBALANCE_WARNING',
			entities: { entryIds: ['fixture-entry-1'] },
			meta: { termIndex: 1, zone: 'UNSPECIFIED' },
		},
	];
}

async function seedSchool(schoolId: number, yearId: number, yearLabel: string): Promise<void> {
	await prisma.school.create({ data: { id: schoolId, name: `TT-TRUTHFULNESS ${schoolId}`, shortName: `TTT${schoolId}` } });
	await prisma.enrollProSchoolYearMirror.create({
		data: {
			schoolId,
			enrollProSchoolYearId: yearId,
			yearLabel,
			isActive: true,
			isArchived: false,
			syncStatus: 'synced',
			lastSyncedAt: NOW,
		},
	});
}

async function seedCountSchool(
	schoolId: number,
	yearId: number,
	yearLabel: string,
	violationsFactory: (runId: number) => Array<Record<string, unknown>>,
): Promise<{ id: number; violations: unknown }> {
	await seedSchool(schoolId, yearId, yearLabel);
	const run = await prisma.generationRun.create({
		data: {
			schoolId,
			schoolYearId: yearId,
			status: 'COMPLETED',
			runType: 'FULL',
			triggeredBy: ACTOR_ID,
			finishedAt: NOW,
			summary: { hardViolationCount: 0 },
			violations: [],
			draftEntries: [{ entryId: 'fixture-entry-1', termIndex: 1 }],
			unassignedItems: [],
		},
	});
	await prisma.generationRun.update({
		where: { id: run.id },
		data: { violations: violationsFactory(run.id) as unknown as Prisma.InputJsonValue },
	});
	const stored = await prisma.generationRun.findUniqueOrThrow({ where: { id: run.id } });
	return { id: stored.id, violations: stored.violations };
}

function inputSnapshot(schoolId: number, schoolYearId: number): GenerationInputSnapshot {
	const domain = { fingerprint: 'tt-truthfulness-domain-v1', signals: {} };
	return {
		schemaVersion: 3,
		schoolId,
		schoolYearId,
		computedAt: NOW.toISOString(),
		fingerprint: `tt-truthfulness-${schoolId}-${schoolYearId}`,
		domains: {
			teachingLoad: domain,
			policy: domain,
			rooms: domain,
			sections: domain,
			subjects: domain,
			derivedDemand: domain,
			availability: domain,
		},
	};
}

async function seedPublishableSchool(): Promise<{ runId: number; snapshot: GenerationInputSnapshot }> {
	await seedSchool(SCHOOL_PUBLISH, YEAR_PUBLISH, 'Disposable 2103-2104');
	await prisma.enrollProSchoolYearMirror.update({
		where: { schoolId_enrollProSchoolYearId: { schoolId: SCHOOL_PUBLISH, enrollProSchoolYearId: YEAR_PUBLISH } },
		data: {
			termContractCache: {
				schoolId: SCHOOL_PUBLISH,
				schoolYear: { id: YEAR_PUBLISH, yearLabel: 'Disposable 2103-2104' },
				format: 'TRIMESTER',
				terms: [
					{ identity: 'T1', displayLabel: 'T1', order: 1 },
					{ identity: 'T2', displayLabel: 'T2', order: 2 },
					{ identity: 'T3', displayLabel: 'T3', order: 3 },
				],
			},
			termContractCachedAt: NOW,
		},
	});
	await prisma.schoolYearTermConfig.create({
		data: { schoolId: SCHOOL_PUBLISH, schoolYearId: YEAR_PUBLISH, termCount: 3, termIdentities: ['T1', 'T2', 'T3'], isActive: true, createdBy: ACTOR_ID },
	});
	const subject = await prisma.subject.create({
		data: {
			schoolId: SCHOOL_PUBLISH,
			code: 'TTTFIX',
			name: 'TT-TRUTHFULNESS Fixture Subject',
			minMinutesPerWeek: 45,
			preferredRoomType: 'CLASSROOM',
			gradeLevels: [7],
			programScopes: ['REGULAR'],
			isActive: true,
		},
	});
	const faculty = await prisma.facultyMirror.create({
		data: { schoolId: SCHOOL_PUBLISH, externalId: 7799500, firstName: 'TT', lastName: 'Truth', maxHoursPerWeek: 40, isActiveForScheduling: true },
	});
	await prisma.sectionSnapshot.create({
		data: {
			schoolId: SCHOOL_PUBLISH,
			schoolYearId: YEAR_PUBLISH,
			payload: [{ gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, sections: [{ id: 10, name: 'Fixture 10', enrolledCount: 30 }] }],
		},
	});
	const qualification = await prisma.facultySubject.create({
		data: { schoolId: SCHOOL_PUBLISH, schoolYearId: YEAR_PUBLISH, facultyId: faculty.id, subjectId: subject.id, gradeLevels: [7], sectionIds: [10], assignedBy: ACTOR_ID },
	});
	await prisma.subjectSectionOwnership.create({
		data: { schoolId: SCHOOL_PUBLISH, schoolYearId: YEAR_PUBLISH, facultySubjectId: qualification.id, facultyId: faculty.id, subjectId: subject.id, sectionId: 10 },
	});
	const snapshot = inputSnapshot(SCHOOL_PUBLISH, YEAR_PUBLISH);
	const run = await prisma.generationRun.create({
		data: {
			schoolId: SCHOOL_PUBLISH,
			schoolYearId: YEAR_PUBLISH,
			status: 'COMPLETED',
			runType: 'FULL',
			triggeredBy: ACTOR_ID,
			finishedAt: NOW,
			summary: { inputSnapshot: snapshot },
			violations: [],
			unassignedItems: [],
			draftEntries: [{
				entryId: 'fixture-entry-1',
				termIndex: 1,
				sectionId: 10,
				subjectId: subject.id,
				facultyId: faculty.id,
				roomId: 30,
				day: 'MONDAY',
				startTime: '07:30',
				endTime: '08:15',
				durationMinutes: 45,
			}],
			version: 1,
		},
	});
	return { runId: run.id, snapshot };
}

before(async () => {
	assert.match(DATABASE_NAME, /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/, 'DATABASE_URL must point at the runner-approved disposable database');
	assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be configured (the runner supplies a test value)');
	server = http.createServer(app);
	await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
	const address = server.address();
	assert.ok(address && typeof address !== 'string', 'mounted app must listen on an ephemeral port');
	baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
});

after(async () => {
	server?.close();
	await prisma.$disconnect();
});

test('D1 — the runs list exposes publication state from the list alone', async () => {
	await seedSchool(SCHOOL_LIST, YEAR_LIST, 'S.Y. 2101-2102');
	const published = await prisma.generationRun.create({
		data: {
			schoolId: SCHOOL_LIST,
			schoolYearId: YEAR_LIST,
			status: 'COMPLETED',
			triggeredBy: ACTOR_ID,
			createdAt: NOW,
			summary: { isPublished: true, publishedAt: NOW.toISOString(), publishedBy: ACTOR_ID, heavySecret: 'x'.repeat(64) },
			violations: [],
			draftEntries: [],
			unassignedItems: [],
		},
	});
	const unpublished = await prisma.generationRun.create({
		data: {
			schoolId: SCHOOL_LIST,
			schoolYearId: YEAR_LIST,
			status: 'COMPLETED',
			triggeredBy: ACTOR_ID,
			createdAt: new Date(NOW.getTime() + 60_000),
			summary: { isPublished: false },
			violations: [],
			draftEntries: [],
			unassignedItems: [],
		},
	});

	const response = await requestJson(`/generation/${SCHOOL_LIST}/${YEAR_LIST}/runs?limit=20`, privilegedToken(SCHOOL_LIST));
	assert.equal(response.status, 200, 'runs list is readable by a privileged actor');
	assert.equal(response.json.count, 2);
	assert.equal(response.json.runs.length, 2);
	assert.equal(response.json.activePublishedRunId, published.id, 'the active publication is named even though a newer run exists');
	assert.equal(response.json.runs[0].id, unpublished.id, 'newest run first');
	assert.deepEqual(response.json.runs[0].summary, { isPublished: false }, 'an unpublished run reads as unpublished');
	assert.deepEqual(response.json.runs[1].summary, { isPublished: true }, 'a published run reads as published from the list alone');
	assert.deepEqual(Object.keys(response.json.runs[1].summary), ['isPublished'], 'no other summary payload leaks into the list');
});

test('D2 — readiness reports canonical HARD/SOFT counts, never the raw stored total', async () => {
	const seeded = await seedCountSchool(SCHOOL_COUNTS, YEAR_COUNTS, 'S.Y. 2102-2103', (runId) => softFixture(runId, SCHOOL_COUNTS, YEAR_COUNTS));
	const rawLength = (seeded.violations as unknown[]).length;
	assert.equal(rawLength, 6, 'the raw persisted snapshot holds 6 SOFT rows (3 duplicates + 2 distinct + 1 retired zone)');

	const response = await requestJson(`/dashboard/readiness-summary?schoolId=${SCHOOL_COUNTS}`, privilegedToken(SCHOOL_COUNTS));
	assert.equal(response.status, 200);
	assert.equal(response.json.generation.latestRunId, seeded.id);
	assert.equal(response.json.generation.blockingHardCount, 0, 'HARD/blocking gate count is 0');
	assert.equal(response.json.generation.softViolationCount, 3, 'canonical projected SOFT count');
	assert.equal(response.json.generation.violationCount, undefined, 'the raw combined total is no longer exposed at all');
	assert.equal(response.json.generation.softViolationCount === rawLength, false, 'the raw stored length is NOT presented as the canonical count');
});

test('D2 positive control — a promotable HARD violation is counted, not hardcoded to zero', async () => {
	const seeded = await seedCountSchool(SCHOOL_HARD, YEAR_HARD, 'S.Y. 2103-2104', (runId) => ([
		{
			code: 'FACULTY_TIME_CONFLICT',
			severity: 'HARD',
			message: 'TT-TRUTHFULNESS fixture hard',
			schoolId: SCHOOL_HARD,
			schoolYearId: YEAR_HARD,
			runId,
			entities: { facultyId: 9101, day: 'MONDAY', startTime: '07:30', endTime: '08:15', entryIds: ['fixture-entry-1'] },
			meta: { termIndex: 1 },
		},
		{
			code: 'FACULTY_EXCESSIVE_IDLE_GAP',
			severity: 'SOFT',
			message: 'TT-TRUTHFULNESS fixture soft',
			schoolId: SCHOOL_HARD,
			schoolYearId: YEAR_HARD,
			runId,
			entities: { facultyId: 9102, day: 'TUESDAY', startTime: '09:00', endTime: '10:00', entryIds: ['fixture-entry-1'] },
			meta: { termIndex: 1 },
		},
	]));

	const response = await requestJson(`/dashboard/readiness-summary?schoolId=${SCHOOL_HARD}`, privilegedToken(SCHOOL_HARD));
	assert.equal(response.status, 200);
	assert.equal(response.json.generation.blockingHardCount, 1, 'the allowlisted HARD row is counted');
	assert.equal(response.json.generation.softViolationCount, 1, 'soft stays separated from blockers');
	assert.equal(response.json.generation.latestRunId, seeded.id, 'the seeded run is the latest run for the active year');
});

test('D3 — the publication write does not store the raw SOFT count as the canonical count', async () => {
	const { runId, snapshot } = await seedPublishableSchool();
	const violations = softFixture(runId, SCHOOL_PUBLISH, YEAR_PUBLISH);
	await prisma.generationRun.update({ where: { id: runId }, data: { violations: violations as unknown as Prisma.InputJsonValue } });

	await withDataContext(prisma, () => publishSchedule(
		{ schoolId: SCHOOL_PUBLISH, schoolYearId: YEAR_PUBLISH, runId, actorId: ACTOR_ID, actorSchoolId: SCHOOL_PUBLISH, acknowledgeSoftViolations: true },
		{ now: () => NOW, computeInputSnapshot: async () => snapshot, publishEvent: () => undefined },
	));

	const stored = await prisma.generationRun.findUniqueOrThrow({ where: { id: runId } });
	const storedSummary = stored.summary as Record<string, unknown>;
	assert.equal(storedSummary.isPublished, true, 'the run really published');
	assert.equal(storedSummary.publishedRawSoftViolationCount, 6, 'the raw acknowledged SOFT count is stored under an explicitly raw name');
	assert.equal('publishedSoftViolationCount' in storedSummary, false, 'the misleading canonical-sounding key is no longer written');

	const canonical = buildViolationReport(
		{ id: runId, status: 'COMPLETED', violations: stored.violations, summary: stored.summary, draftEntries: stored.draftEntries },
		undefined,
	);
	assert.equal(canonical.counts.runWide.soft, 3, 'the canonical operator count is the projected one');
	assert.notEqual(storedSummary.publishedRawSoftViolationCount, canonical.counts.runWide.soft, 'raw and canonical genuinely differ and are now distinguishable');
});
