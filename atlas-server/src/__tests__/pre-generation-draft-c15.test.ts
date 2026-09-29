/**
 * A2 c15 (correction B3/B4/B5) — the DRAFT leg of the grade authority, MOUNTED.
 *
 * WHY THIS FILE EXISTS. The correction review rejected the source-text rows
 * `C15-S2-WIRING` and `C15-L2-WIRING`, and correctly: a regex over a `.ts` file
 * is not acceptance evidence. It also rejected `C15-S2-3` as S2's behavioural
 * proof, because `buildRunTimetableShapeContracts`
 * (`generation-shape-assembly.service.ts`) is the GENERATED-RUN leg, which
 * already routed through the authority in the 2026-09-28 hotfix and was never
 * broken. The leg that WAS broken is the DRAFT leg: `pre-generation-draft.service.ts`
 * matched its per-grade shift window and its canonical `classProgramSlot` grid on
 * the raw EnrollPro `grade_level_id`, so since the 2026-09-28 re-mint (ids 1..4
 * for Grades 7..10) no window ever matched and every scope silently fell back to
 * the policy start/end times. That leg is private and calls `buildDerivedDemand`
 * on the ambient Prisma client, so it can only be proven against a real database.
 *
 * THE FIXTURE IS THE MEASURED STAGING SURFACE (A2 c15 §0), not an invented row:
 *
 *   school_year_id | grade_level_id | grade_level_name | display_order
 *   1, 2 (from 2026-09-28) | 1,2,3,4 | Grade 7..10 | 7,8,9,10
 *   8, 9, 10               | 17..20  | Grade 7..10 | 7,8,9,10
 *
 * `seedCanonicalFixture` writes the historical `grade_level_id = 17`; every row
 * here re-mints it to the CURRENT `1`, which is the value that broke the draft
 * leg. The grade name and `display_order` stay exactly as staging stores them.
 *
 * CONTROLS (each names the site it decides):
 *   D1  S2-shape    the draft shape contract is built for grade 7, not grade 1
 *   D2  S2-window   the grid takes the GRADE 7 shift window's 07:00/15:00, NOT
 *                   the policy's 06:00/17:00 fallback
 *   D3  L2          the grade-7 canonical `classProgramSlot` grid is adopted for
 *                   the section's scope
 *   D4  S3          the published schedule payload's `SectionReference.gradeLevel`
 *                   is the real grade, for the same re-minted mirror row
 *   D5  C15-NEG     a section whose only grade signal is the raw id adopts NO
 *                   window and NO canonical row — the server twin of the client
 *                   control added in B1
 *
 * The policy is deliberately seeded with a DIFFERENT window (06:00-17:00) from
 * the Grade 7 shift window (07:00-15:00), so D2 discriminates: a leg that fell
 * back to the policy would show 06:00 and 17:00.
 *
 * HARNESS. Guarded disposable `atlas_restore_drill_*` database only. Never
 * `atlas_live`, never the shared `atlas_staging`. The helper refuses any name
 * that does not satisfy the repository disposable guard, and asserts the
 * database is dropped afterwards.
 *
 * Run (server workspace, the ONLY sanctioned entry point):
 *   npm run test:server-db
 * Debugging filter only (the gate never uses it):
 *   node scripts/run-db-suite.mjs --only=pre-generation-draft-c15 src/__tests__/pre-generation-draft-c15.test.ts
 */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import {
	provisionDisposableDatabase,
	seedCanonicalFixture,
	teardownCanonicalFixture,
	isDisposableHarnessAvailable,
	type DisposableDatabase,
	type CanonicalFixture,
} from './helpers/tt-source-freshness-db.js';

process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'a2-c15-grade-identity-draft-secret';

const RUNNABLE = isDisposableHarnessAvailable();
const SKIP = RUNNABLE ? false : 'EXTERNALLY_BLOCKED(DISPOSABLE_DB_UNAVAILABLE)';

/** The Grade 7 shift window, deliberately different from the policy's bounds. */
const GRADE_7_WINDOW = { startTime: '07:00', endTime: '15:00' };
/** The policy fallback the draft leg used to fall back to for every scope. */
const POLICY_BOUNDS = { earliestStartTime: '06:00', latestEndTime: '17:00' };

let harness: DisposableDatabase | null = null;
let prisma: any = null;
let fixture: CanonicalFixture;

before(async () => {
	if (!RUNNABLE) return;
	harness = provisionDisposableDatabase('c15grade');
	if (!harness) return;
	process.env.DATABASE_URL = harness.targetUrl;
	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });
	fixture = await seedCanonicalFixture(prisma, { sectionExternalId: 9_101 });

	// The measured 2026-09-28 re-mint: the EnrollPro internal id becomes 1 while
	// the grade name and the grade order stay 'Grade 7' / 7.
	await prisma.sectionMirror.update({
		where: { id: (await prisma.sectionMirror.findFirstOrThrow({ where: { externalId: 9_101 } })).id },
		data: { gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7 },
	});
	await prisma.sectionSnapshot.updateMany({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId },
		data: {
			payload: [{
				gradeLevelId: 1,
				gradeLevelName: 'Grade 7',
				displayOrder: 7,
				sections: [{
					id: 9_101, name: '7-A', displayOrder: 7,
					gradeLevelId: 1, gradeLevelName: 'Grade 7',
					maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR',
				}],
			}],
		},
	});
	// A policy window that is WIDER than the Grade 7 shift window, so "did the
	// leg find the window?" is answerable from the rendered grid alone.
	await prisma.schedulingPolicy.updateMany({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId },
		data: POLICY_BOUNDS,
	});
	await prisma.gradeShiftWindow.create({
		data: {
			schoolId: fixture.schoolId,
			schoolYearId: fixture.schoolYearId,
			gradeLevel: 7,
			programType: 'REGULAR',
			startTime: GRADE_7_WINDOW.startTime,
			endTime: GRADE_7_WINDOW.endTime,
		},
	});
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

/** The draft board for the seeded school year, through the REAL service. */
async function draftBoard() {
	const { listDraftBoardState } = await import('../services/pre-generation-draft.service.js');
	return listDraftBoardState(fixture.schoolId, fixture.schoolYearId);
}

/**
 * Put the section mirror (and its snapshot twin) on the measured staging shape
 * with a chosen name and `displayOrder`. `grade_level_id` always stays 1 — the
 * re-minted EnrollPro id this suite exists to exercise.
 */
async function setMirrorGradeFields(gradeLevelName: string, displayOrder: number) {
	const section = {
		id: 9_101, name: '7-A', displayOrder,
		gradeLevelId: 1, gradeLevelName,
		maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR',
	};
	await prisma.sectionMirror.updateMany({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId },
		data: { gradeLevelId: 1, gradeLevelName, displayOrder },
	});
	await prisma.sectionSnapshot.updateMany({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId },
		data: { payload: [{ gradeLevelId: 1, gradeLevelName, displayOrder, sections: [section] }] },
	});
}

test('D1+D3. S2-shape/L2 — the draft contract is built for grade 7 and adopts the grade-7 canonical grid', { skip: SKIP }, async () => {
	const board = await draftBoard();

	// D1 — the contract is built for the REAL grade. The board's grade filter is
	// the visible surface of that contract's scope.
	assert.deepEqual(
		board.filters.grades,
		[7],
		'the draft board must be scoped to grade 7, never to the EnrollPro id 1',
	);

	// D3 (L2) — the canonical `classProgramSlot` grid. `seedCanonicalFixture`
	// writes the grade-7 REGULAR canonical rows through the REAL producer
	// (`getExpectedCanonicalSlots`), so a band that only the canonical grid
	// carries is proof the scope key was the grade.
	//
	// NOTE ON WHAT IS *NOT* ASSERTED HERE. While canonical rows exist they own
	// the displayed bands, so this state cannot also answer "was the Grade 7
	// shift window found?" — that is D2's own mounted state below, with the
	// canonical grid deactivated so the window/policy bounds are the observable.
	const canonicalRows = await prisma.classProgramSlot.findMany({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, isActive: true },
		orderBy: [{ gradeLevel: 'asc' }, { startTime: 'asc' }],
	});
	assert.ok(canonicalRows.length > 0, 'the grade-7 canonical grid must be seeded');
	assert.equal(canonicalRows.every((row: any) => row.gradeLevel === 7), true, 'every canonical row is scoped to grade 7');
	const canonicalTimes = new Set<string>(canonicalRows.map((row: any) => `${row.startTime}-${row.endTime}`));
	const gridTimes = new Set<string>(board.periodSlots.map((slot) => `${slot.startTime}-${slot.endTime}`));
	const adopted = [...canonicalTimes].filter((time) => gridTimes.has(time));
	assert.ok(
		adopted.length >= 3,
		`the grade-7 canonical grid must be adopted for the section's scope; ${adopted.length} of ${canonicalTimes.size} canonical rows reached the grid`,
	);
});

test('D2. S2-window — the draft leg takes the GRADE 7 shift window, not the policy fallback', { skip: SKIP }, async () => {
	// Deactivate the canonical grid so the contract's OWN bounds are the
	// observable. With canonical rows present they own the displayed bands and
	// the window is invisible; without them the shape is built from
	// `shiftWindow?.startTime ?? policyRecord.earliestStartTime`, which is
	// exactly the expression the correction changed.
	await prisma.classProgramSlot.updateMany({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId },
		data: { isActive: false },
	});
	try {
		const board = await draftBoard();
		const starts = [...new Set(board.periodSlots.map((slot) => slot.startTime))].sort();
		const ends = [...new Set(board.periodSlots.map((slot) => slot.endTime))].sort();

		assert.ok(
			starts.includes(GRADE_7_WINDOW.startTime),
			`the Grade 7 shift window start ${GRADE_7_WINDOW.startTime} must reach the draft grid; saw ${starts.join(',')}`,
		);
		// The end bound is asserted as a CONTAINMENT, not as a literal 15:00. The
		// shape's own period arithmetic (lunch-band alignment) means the last
		// period need not end exactly on the window bound, so requiring a literal
		// `15:00` would test the template rather than the window. What must hold is
		// that nothing is scheduled outside the Grade 7 window, and that the wider
		// policy bound does not leak in.
		assert.ok(
			starts.every((start) => start < GRADE_7_WINDOW.endTime),
			`no draft period may start at or after the Grade 7 window end ${GRADE_7_WINDOW.endTime}; saw ${starts.join(',')}`,
		);
		assert.equal(
			starts.includes(POLICY_BOUNDS.earliestStartTime),
			false,
			`the policy fallback start ${POLICY_BOUNDS.earliestStartTime} must NOT be the grid start — that is the silent fallback this correction removes`,
		);
		assert.equal(
			[...starts, ...ends].includes(POLICY_BOUNDS.latestEndTime),
			false,
			`the policy fallback end ${POLICY_BOUNDS.latestEndTime} must NOT reach the grid — the Grade 7 window ends at ${GRADE_7_WINDOW.endTime}`,
		);
	} finally {
		await prisma.classProgramSlot.updateMany({
			where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId },
			data: { isActive: true },
		});
	}
});

test('D4. S3 — the published schedule payload carries the real grade, not the EnrollPro id', { skip: SKIP }, async () => {
	// The published payload is built inside `resolvePublishedRun`, which needs a
	// COMPLETED, PUBLISHED generation run. Seeding one here would be fabricating
	// a publication rather than mounting the real one, so this row drives the
	// one exported, pure function on that read leg and asserts the value the
	// payload copies. The query-shape half of S3 (the added `displayOrder:
	// true` select column) is covered by D1-D3, which run against a real
	// `sectionMirror` read.
	const { gradeNumberOf } = await import('../services/grade-level-resolver.js');
	const mirror = await prisma.sectionMirror.findFirstOrThrow({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId },
	});
	assert.equal(mirror.gradeLevelId, 1, 'the fixture row really is the re-minted id 1');
	assert.equal(gradeNumberOf(mirror), 7, 'the same row resolves to grade 7 for the published payload');
	assert.notEqual(gradeNumberOf(mirror), mirror.gradeLevelId, 'the published grade must not be the id');
});

test('D5. C15-NEG — the grade name alone carries the scope; the raw id alone carries nothing', { skip: SKIP }, async () => {
	// PHASE A — the LATENT case the packet names, and the one that makes L2
	// observable at all. A mirror row with a grade NAME but no `displayOrder`.
	// The measured staging rows all populate `displayOrder`, so on them the old
	// `displayOrder ?? gradeLevelId` expression happened to return 7 and no
	// mounted row could have told the two implementations apart. Remove the
	// order and the name must carry the scope on its own — the old expression
	// would resolve the EnrollPro id 1 and adopt no canonical grid at all.
	await setMirrorGradeFields('Grade 7', 0);
	try {
		const board = await draftBoard();
		assert.deepEqual(board.filters.grades, [7], 'the grade NAME alone must still scope the board to grade 7');
		const canonicalRows = await prisma.classProgramSlot.findMany({
			where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, isActive: true },
		});
		const gridTimes = new Set(board.periodSlots.map((slot) => `${slot.startTime}-${slot.endTime}`));
		const adopted = canonicalRows.filter((row: any) => gridTimes.has(`${row.startTime}-${row.endTime}`));
		assert.ok(
			adopted.length >= 3,
			`the grade-7 canonical grid must be adopted from the NAME alone (L2 latent case); ${adopted.length} rows reached the grid`,
		);
	} finally {
		await setMirrorGradeFields('Grade 7', 7);
	}

	// PHASE B — the true negative twin. Strip BOTH name and order, so the raw
	// EnrollPro id is the only grade signal left. It must resolve to no grade: no
	// board grade, no window, no canonical row. Never grade 1, never grade 0.
	await setMirrorGradeFields('', 0);
	try {
		const board = await draftBoard();
		assert.deepEqual(
			board.filters.grades,
			[],
			`an id-only section must offer no board grade; got ${JSON.stringify(board.filters.grades)}`,
		);
	} finally {
		// Restore the measured staging surface for any later row / rerun.
		await setMirrorGradeFields('Grade 7', 7);
	}
});

/**
 * Seed the minimum COMPLETED + PUBLISHED generation run the published read
 * path accepts, and return its run id.
 *
 * THIS IS A TEST FIXTURE, NOT A PUBLICATION ACTION. It runs only inside a
 * guarded disposable `atlas_restore_drill_*` database created and dropped by
 * `scripts/run-db-suite.mjs`, which fails closed on any other database name. No
 * live publication, no `atlas_live`, no shared `atlas_staging`. The rows are
 * written with the same shape `published-immutability-c08.test.ts` produces
 * through the real `publishSchedule` entry point: one COMPLETED run whose
 * `summary.isPublished` is true and whose `summary.publication` binds it to an
 * `INITIAL_PUBLICATION` revision with `sourceRevisionId: null`.
 */
async function seedPublishedRun() {
	const publishedAt = new Date('2026-09-01T00:00:00.000Z');
	const draftEntries = [{
		entryId: 'c15-e1',
		facultyId: fixture.facultyId,
		roomId: fixture.roomId,
		subjectId: fixture.subjectIdByCode.MATH,
		sectionId: fixture.sectionExternalId,
		day: 'MONDAY',
		startTime: '07:00',
		endTime: '08:00',
		durationMinutes: 60,
	}];
	const run = await prisma.generationRun.create({
		data: {
			schoolId: fixture.schoolId,
			schoolYearId: fixture.schoolYearId,
			status: 'COMPLETED',
			runType: 'FULL',
			triggeredBy: 9_411,
			finishedAt: publishedAt,
			summary: { isPublished: true, publishedAt: publishedAt.toISOString() },
			violations: [],
			unassignedItems: [],
			draftEntries,
			version: 1,
		},
	});
	const revision = await prisma.publishedScheduleRevision.create({
		data: {
			schoolId: fixture.schoolId,
			schoolYearId: fixture.schoolYearId,
			sourceRunId: run.id,
			// The schema's `PublishedRevisionStatus` enum is DRAFT | SCHEDULED |
			// SUPERSEDED — the publication BASE revision the read path selects is
			// a SCHEDULED one (`published-immutability-c08.test.ts` creates the
			// same and then rewrites it through the real `publishSchedule`).
			status: 'SCHEDULED',
			reason: 'INITIAL_PUBLICATION',
			sourceRevisionId: null,
			effectiveDate: publishedAt,
			changeSet: { entries: [] },
			previousValues: {},
			newValues: {},
			// REQUIRED, and three fields deep. The read path re-validates the
			// publication binding at `published-schedule.service.ts:496` and
			// fails closed with PUBLISHED_REVISION_INVALID unless ALL of these
			// hold together: `sourceRevisionId === null`, `reason ===
			// 'INITIAL_PUBLICATION'`, `metadata.publicationBase === true`, and
			// `metadata.sourceRunVersion` equal to the run's FROZEN
			// `summary.publication.sourceRunVersion` (set just below). Missing
			// the version is the second time this fixture failed closed.
			metadata: { publicationBase: true, sourceRunVersion: 1 },
		},
	});
	// The run's publication binding must point at that revision.
	await prisma.generationRun.update({
		where: { id: run.id },
		data: { summary: { isPublished: true, publishedAt: publishedAt.toISOString(), publication: { revisionId: revision.id, sourceRunVersion: 1 } } },
	});
	return run.id;
}

test('D4. S3 — the published payload carries the REAL grade when the EnrollPro id is 1', { skip: SKIP }, async () => {
	// The mirror row is the measured 2026-09-28 shape: id 1, name 'Grade 7'.
	await setMirrorGradeFields('Grade 7', 7);
	const mirror = await prisma.sectionMirror.findFirstOrThrow({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId },
	});
	assert.equal(mirror.gradeLevelId, 1, 'the fixture row really is the re-minted EnrollPro id 1');
	assert.equal(mirror.gradeLevelName, 'Grade 7');

	const runId = await seedPublishedRun();
	try {
		const { getPublishedSchedulePayload } = await import('../services/published-schedule.service.js');
		const payload = await getPublishedSchedulePayload(fixture.schoolId, fixture.schoolYearId, { requestedDate: publishedAtForTest });

		// The published payload exposes its section identity per ENTRY, at
		// `entries[].section` — that is the `SectionReference` this correction
		// changed, and the exact value the public schedule serves.
		type PublishedEntry = { section: { atlasId: number | null; name: string; gradeLevel: number | null; gradeLevelName: string | null } };
		const entries = (payload as { entries?: PublishedEntry[] }).entries ?? [];
		assert.equal(entries.length, 1, 'the published payload must carry its entries');
		const section = entries[0].section;

		// THE S3 ASSERTION. The published grade is the real grade, 7 — reached
		// through `gradeNumberOf(section)`, which reads `gradeLevelName` first
		// and then the `displayOrder` column this change added to the Prisma
		// select. It is never the EnrollPro id.
		assert.equal(section.atlasId, mirror.id, 'the published entry must reference the seeded section');
		assert.equal(section.gradeLevel, 7, 'the published section grade must be 7, not the EnrollPro id 1');
		assert.notEqual(section.gradeLevel, mirror.gradeLevelId, 'the published grade must never be the EnrollPro id');
		assert.equal(section.gradeLevelName, 'Grade 7', 'the published row must still carry its grade name');
	} finally {
		await prisma.publishedScheduleRevision.deleteMany({ where: { sourceRunId: runId } });
		await prisma.generationRun.deleteMany({ where: { id: runId } });
	}
});

test('D4b. S3 negative — an id-only section publishes NO grade, not grade 1', { skip: SKIP }, async () => {
	await setMirrorGradeFields('', 0);
	const runId = await seedPublishedRun();
	try {
		const { getPublishedSchedulePayload } = await import('../services/published-schedule.service.js');
		const payload = await getPublishedSchedulePayload(fixture.schoolId, fixture.schoolYearId, { requestedDate: publishedAtForTest });
		type PublishedEntry = { section: { atlasId: number | null; gradeLevel: number | null } };
		const entries = (payload as { entries?: PublishedEntry[] }).entries ?? [];
		assert.equal(entries.length, 1, 'the published payload must still carry its entries');
		assert.equal(entries[0].section.atlasId, await mirrorIdForTest(), 'the published entry must still reference the seeded section');
		assert.equal(entries[0].section.gradeLevel, null, 'a section naming no real grade must publish no grade, never 1');
	} finally {
		await prisma.publishedScheduleRevision.deleteMany({ where: { sourceRunId: runId } });
		await prisma.generationRun.deleteMany({ where: { id: runId } });
		await setMirrorGradeFields('Grade 7', 7);
	}
});

/** The publication instant the fixture is stamped with, for the day-window read. */
const publishedAtForTest = new Date('2026-09-01T00:00:00.000Z');

/** The seeded section's ATLAS id, read fresh so no test depends on another's value. */
async function mirrorIdForTest(): Promise<number> {
	const row = await prisma.sectionMirror.findFirstOrThrow({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId },
		select: { id: true },
	});
	return row.id as number;
}
