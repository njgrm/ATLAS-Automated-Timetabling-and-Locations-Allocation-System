/**
 * A7-C7 — the active-year election must speak ONE id space.
 *
 * THE DEFECT (demo blocker, 2026-09-29). The shell showed
 *   "School year changed to 2029-2030. 2022-2023 is archived and read-only."
 * while EnrollPro was still on 2022-2023. `resolveRuntimeContext` pooled
 * evidence from two different id spaces into one `yearId` number and then ranked
 * them: the EnrollPro mirror contributed a single `school-year-mirror` signal
 * worth 120, while an ATLAS-side surrogate could carry `section-mirror` (100) +
 * `section-snapshot` (90) + `faculty-snapshot` (75) + `generation-run` (60) +
 * `scheduling-policy` (40) plus a consensus bonus, win the election, and be
 * returned in the EnrollPro id slot. The archived-year exclusion was the mirror
 * of that defect: an EnrollPro-space set of archived ids tested against
 * ATLAS-space ids, which removed ATLAS id 8 by integer coincidence and left the
 * genuinely archived ATLAS id 1 eligible.
 *
 * WHY THESE FIXTURES ARE BUILT THE WAY THEY ARE. Every id in them is a real
 * value from the live surface, not an invented one (AGENTS.md §11, "a control's
 * fixture must come from the real surface"). The staging snapshot the planner
 * measured carries ATLAS-side `section_mirrors.school_year_id`,
 * `scheduling_policies.school_year_id` in {1, 8, 9, 10} and
 * `generation_runs.school_year_id` in {8, 10}, while
 * `enrollpro_school_year_mirrors` holds exactly (ext 1 = 2022-2023, active) and
 * (ext 8 = 2029-2030, ARCHIVED). The decisive property these rows pin is the
 * COLLISION itself: the same integer is meaningful in both spaces and the two
 * meanings differ, which is why "ATLAS id 1" and "EnrollPro ext 1" cannot be
 * compared, summed, or substituted for one another.
 *
 * DB-WRITING SUITE, SO IT RUNS ONLY THROUGH THE HARNESS (AGENTS.md §5).
 * `run-db-suite.mjs` gives this file its own disposable
 * `atlas_restore_drill_<yyyymmdd>_<suffix>` database and drops it;
 * `requireDisposableDatabase` fails closed before the first row if the
 * connected database is anything else. Nothing here can reach a live or staging
 * database.
 *
 * SCOPE, STATED PLAINLY. These rows drive the real `resolveRuntimeContext`
 * against a real disposable database, in the exact degraded configuration the
 * defect needs — `{ verifyUpstream: false }`, so the ATLAS-side election is in
 * charge and no network read is attempted. They do NOT render the shell; the
 * rendered proof for this packet is the planner's Lane C staging walk.
 *
 * Run: `npm run test:a7-c7-rollover-banner-db`
 *   = node scripts/run-db-suite.mjs src/__tests__/a7-rollover-banner-id-space-c7.test.ts
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import { prisma } from '../lib/prisma.js';
import { resolveRuntimeContext } from '../services/runtime-context.service.js';
import { requireDisposableDatabase } from './helpers/disposable-database-guard.js';

// Refuses a non-disposable DATABASE_URL at module load, i.e. strictly before the
// first write (§5 / the 2026-09-29 staging-write incident).
requireDisposableDatabase('a7-rollover-banner-id-space-c7.test.ts');

const SCHOOL = 9701;

// EnrollPro id space, exactly as staged.
const EXT_ACTIVE = 1;      // 2022-2023, the live year
const EXT_ARCHIVED = 8;    // 2029-2030, archived and read-only
const EXT_FUTURE = 9;      // 2030-2031, mirrored but not live

const LABEL_ACTIVE = '2022-2023';
const LABEL_ARCHIVED = '2029-2030';
const LABEL_FUTURE = '2030-2031';

async function cleanup(): Promise<void> {
	await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: SCHOOL } });
	await prisma.sectionSnapshot.deleteMany({ where: { schoolId: SCHOOL } });
	await prisma.facultySnapshot.deleteMany({ where: { schoolId: SCHOOL } });
	await prisma.sectionMirror.deleteMany({ where: { schoolId: SCHOOL } });
	await prisma.generationRun.deleteMany({ where: { schoolId: SCHOOL } });
	await prisma.schedulingPolicy.deleteMany({ where: { schoolId: SCHOOL } });
	await prisma.school.deleteMany({ where: { id: SCHOOL } });
}

async function seedSchool(): Promise<void> {
	const existing = await prisma.school.findUnique({ where: { id: SCHOOL } });
	if (existing) {
		throw new Error(`School id ${SCHOOL} already exists (${existing.name}); refusing to clobber.`);
	}
	await prisma.school.create({ data: { id: SCHOOL, name: 'A7-C7 id-space fixture', shortName: 'A7C7' } });
}

async function seedMirrorYears(): Promise<void> {
	await prisma.enrollProSchoolYearMirror.createMany({
		data: [
			{
				schoolId: SCHOOL, enrollProSchoolYearId: EXT_ACTIVE, yearLabel: LABEL_ACTIVE,
				isActive: true, isArchived: false, lastSyncedAt: new Date(), syncStatus: 'OK',
			},
			{
				schoolId: SCHOOL, enrollProSchoolYearId: EXT_ARCHIVED, yearLabel: LABEL_ARCHIVED,
				isActive: false, isArchived: true, archivedAt: new Date(), syncStatus: 'OK',
			},
			{
				schoolId: SCHOOL, enrollProSchoolYearId: EXT_FUTURE, yearLabel: LABEL_FUTURE,
				isActive: false, isArchived: false, lastSyncedAt: new Date(), syncStatus: 'OK',
			},
		],
	});
}

/**
 * Give ATLAS year `atlasYearId` the STRONGEST possible ATLAS-side evidence: a
 * section mirror, both snapshots, a generation run and a scheduling policy, all
 * stamped now. This is the weight pile that beat the mirror's single 120.
 */
async function seedStrongAtlasEvidence(atlasYearId: number, externalBase: number): Promise<void> {
	await prisma.sectionMirror.create({
		data: {
			externalId: externalBase,
			schoolId: SCHOOL,
			schoolYearId: atlasYearId,
			name: `G${atlasYearId}-A7C7`,
			gradeLevelId: 1,
			gradeLevelName: 'Grade 7',
			displayOrder: 1,
			maxCapacity: 40,
			enrolledCount: 30,
			isStale: false,
			lastSyncedAt: new Date(),
		},
	});
	await prisma.sectionSnapshot.create({
		data: { schoolId: SCHOOL, schoolYearId: atlasYearId, fetchedAt: new Date(), source: 'enrollpro', payload: { sections: [] } },
	});
	await prisma.facultySnapshot.create({
		data: { schoolId: SCHOOL, schoolYearId: atlasYearId, fetchedAt: new Date(), source: 'enrollpro', payload: { faculty: [] } },
	});
	await prisma.generationRun.create({
		data: { schoolId: SCHOOL, schoolYearId: atlasYearId, triggeredBy: 1, createdAt: new Date() },
	});
	await prisma.schedulingPolicy.create({
		data: { schoolId: SCHOOL, schoolYearId: atlasYearId, updatedAt: new Date() },
	});
}

/** The exact configuration the defect needs: EnrollPro verification off. */
function degradedContext() {
	return resolveRuntimeContext(SCHOOL, 'fixture-token', { verifyUpstream: false });
}

before(async () => {
	await cleanup();
	await seedSchool();
	await seedMirrorYears();
});

after(async () => {
	await cleanup();
});

beforeEach(async () => {
	await prisma.sectionSnapshot.deleteMany({ where: { schoolId: SCHOOL } });
	await prisma.facultySnapshot.deleteMany({ where: { schoolId: SCHOOL } });
	await prisma.sectionMirror.deleteMany({ where: { schoolId: SCHOOL } });
	await prisma.generationRun.deleteMany({ where: { schoolId: SCHOOL } });
	await prisma.schedulingPolicy.deleteMany({ where: { schoolId: SCHOOL } });
});

describe('A7-C7 — the active-year election speaks only the EnrollPro id space', () => {
	test('C7-1: ATLAS year 1 with the strongest possible evidence does not become the active year', async () => {
		// THE COLLISION. EnrollPro ext 1 is the LIVE 2022-2023. ATLAS year 1 is a
		// different year that happens to share the integer, and it carries
		// section-mirror + section-snapshot + faculty-snapshot + generation-run +
		// scheduling-policy + a four-signal consensus bonus. On the base tree this
		// pile sums past the mirror's 120 and the surrogate is returned in the
		// EnrollPro id slot.
		await seedStrongAtlasEvidence(1, 970_101);

		const context = await degradedContext();
		assert.ok(context, 'a mirrored active year still yields a context');
		assert.equal(
			context!.activeSchoolYearId, EXT_ACTIVE,
			'only the mirrored EnrollPro year may be returned in the EnrollPro id slot',
		);
		assert.equal(context!.activeSchoolYearLabel, LABEL_ACTIVE, 'the label comes from the mirror, like-for-like');
		assert.equal(context!.activeSchoolYear.enrollProSchoolYearId, EXT_ACTIVE);
		assert.equal(context!.activeSchoolYear.isActive, true);
		assert.equal(context!.activeSchoolYear.isArchived, false, 'the elected year is never archived');
	});

	test('C7-2: an ATLAS year matching an ARCHIVED EnrollPro year is excluded, not elected', async () => {
		// EnrollPro ext 8 is ARCHIVED. On the base tree the archived set (built in
		// the EnrollPro space) was tested against ATLAS-space ids, so the exclusion
		// depended entirely on the integers happening to agree.
		await seedStrongAtlasEvidence(EXT_ARCHIVED, 970_201);

		const context = await degradedContext();
		assert.ok(context);
		assert.notEqual(
			context!.activeSchoolYearId, EXT_ARCHIVED,
			'an archived year can never be reported as the active year',
		);
		assert.equal(context!.activeSchoolYear.isArchived, false);
		assert.equal(context!.activeSchoolYearLabel, LABEL_ACTIVE);
	});

	test('C7-3: a non-active mirrored year is never elected over the active mirror', async () => {
		// EnrollPro ext 9 is mirrored and NOT archived, so it is a real year — but
		// it is not the live one. The live year is decided by the mirror's own
		// `isActive`, never by how many ATLAS tables point at the number.
		await seedStrongAtlasEvidence(EXT_FUTURE, 970_301);

		const context = await degradedContext();
		assert.ok(context);
		assert.equal(context!.activeSchoolYearId, EXT_ACTIVE, 'the active mirror decides the active year');
		assert.equal(context!.activeSchoolYear.isActive, true);
		assert.equal(context!.activeSchoolYearLabel, LABEL_ACTIVE);
	});

	test('C7-4: every evidence row names its id space, and only the mirror is EnrollPro-space', async () => {
		await seedStrongAtlasEvidence(EXT_FUTURE, 970_401);

		const context = await degradedContext();
		assert.ok(context);
		const evidence = context!.evidence;
		assert.equal(evidence.length, 6, 'the mirror row plus the five ATLAS signals are all still reported');

		const enrollPro = evidence.filter((row) => row.idSpace === 'enrollpro');
		const atlas = evidence.filter((row) => row.idSpace === 'atlas-surrogate');
		assert.equal(enrollPro.length, 1, 'exactly one EnrollPro-space signal: the mirror row');
		assert.equal(enrollPro[0].type, 'school-year-mirror');
		assert.equal(atlas.length, 5, 'all five ATLAS-side signals are labelled, not silently dropped');
		for (const row of atlas) {
			assert.equal(row.schoolYearId, EXT_FUTURE, 'the raw ATLAS value is reported verbatim');
			assert.equal(
				row.enrollProSchoolYearId, EXT_FUTURE,
				'the diagnostic names the mirrored year that shares the integer, so the collision is visible',
			);
			assert.equal(row.enrollProArchived, false, 'and whether that mirrored year is archived');
		}
	});

	test('C7-5: an unmapped ATLAS year is reported as unmapped, never as a school year', async () => {
		// ATLAS year 77 has no mirror row at all: it names no year this school has
		// verified. The honest answer is a diagnostic row with no EnrollPro id.
		await seedStrongAtlasEvidence(77, 970_501);

		const context = await degradedContext();
		assert.ok(context);
		assert.equal(context!.activeSchoolYearId, EXT_ACTIVE, 'an unmapped ATLAS year cannot be elected');
		const unmapped = context!.evidence.filter((row) => row.schoolYearId === 77);
		assert.equal(unmapped.length, 5);
		for (const row of unmapped) {
			assert.equal(row.idSpace, 'atlas-surrogate');
			assert.equal(row.enrollProSchoolYearId, null, 'no mirrored year carries this id');
			assert.equal(row.enrollProArchived, null, 'and therefore no archive verdict is claimed');
		}
	});

	test('C7-6: a school with no active mirrored year has no active year at all', async () => {
		// Fail closed. ATLAS rows exist, but with no active mirror there is no
		// EnrollPro-space evidence, so no context is produced rather than an
		// ATLAS surrogate dressed as a school year.
		const id = SCHOOL + 1;
		await prisma.school.create({ data: { id, name: 'A7-C7 no-mirror fixture', shortName: 'A7C7B' } });
		try {
			await prisma.sectionMirror.create({
				data: {
					externalId: 970_601, schoolId: id, schoolYearId: 5,
					name: 'G5-A7C7', gradeLevelId: 1, gradeLevelName: 'Grade 7',
					displayOrder: 1, maxCapacity: 40, enrolledCount: 30,
					isStale: false, lastSyncedAt: new Date(),
				},
			});
			const context = await resolveRuntimeContext(id, 'fixture-token', { verifyUpstream: false });
			assert.equal(context, null, 'no mirrored active year means no context, not a surrogate id');
		} finally {
			await prisma.sectionMirror.deleteMany({ where: { schoolId: id } });
			await prisma.school.deleteMany({ where: { id } });
		}
	});

	test('C7-7: the archived mirror row can never win even when it is the newest signal', async () => {
		// The active mirror is archived, i.e. ATLAS has archived its live year and
		// not yet synced the next one. RR-09A stands: an archived year is history.
		const id = SCHOOL + 2;
		await prisma.school.create({ data: { id, name: 'A7-C7 archived-active fixture', shortName: 'A7C7C' } });
		try {
			await prisma.enrollProSchoolYearMirror.create({
				data: {
					schoolId: id, enrollProSchoolYearId: 1, yearLabel: '2022-2023',
					isActive: true, isArchived: true, archivedAt: new Date(), lastSyncedAt: new Date(), syncStatus: 'OK',
				},
			});
			const context = await resolveRuntimeContext(id, 'fixture-token', { verifyUpstream: false });
			assert.equal(context, null, 'the only mirrored year is archived, so it cannot be the active year');
		} finally {
			await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: id } });
			await prisma.school.deleteMany({ where: { id } });
		}
	});

	test('C7-8: the write-shaped negative control — no row is written by resolving the context', async () => {
		await seedStrongAtlasEvidence(EXT_FUTURE, 970_701);
		const before = await prisma.enrollProSchoolYearMirror.findMany({
			where: { schoolId: SCHOOL }, select: { id: true, enrollProSchoolYearId: true, isActive: true, isArchived: true },
			orderBy: { id: 'asc' },
		});
		await degradedContext();
		await degradedContext();
		const afterRows = await prisma.enrollProSchoolYearMirror.findMany({
			where: { schoolId: SCHOOL }, select: { id: true, enrollProSchoolYearId: true, isActive: true, isArchived: true },
			orderBy: { id: 'asc' },
		});
		assert.deepEqual(afterRows, before, 'resolving the context is a pure read');
	});
});
