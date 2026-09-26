/**
 * A2-TIMETABLE-CUSTODY — a swap commits exactly what its preview showed, and an
 * undo restores the prior state or says it cannot.
 *
 * Reproduction (browser run 318, Grade 7 / Luna, Term 2): swapping
 * Mon 07:30 MAPEH <-> Wed 08:15 ESP previewed `ESP -> Mon 07:30`, but the
 * `AUTO_FIX_MOVE_BLOCKING` commit placed ESP at **Wed 12:15 — after the section's
 * day ends** — and left Mon 07:30 without ESP. "Revert this edit" then logged
 * "Undid an earlier change" and restored nothing.
 *
 * Three defects, one contract: `a commit applies exactly what its preview showed,
 * or refuses. An undo restores the prior state, or says it cannot.`
 *
 *   D1a the auto-fix candidate pool has no TERM filter, so a target slot occupied
 *       only in a DIFFERENT ordered term looks free to the term-scoped validator
 *       (AGENTS.md §7 fail-closed breach: a missing term identity must never
 *       become Term 1, and an auto-fix may only move a session within its term).
 *   D1b the auto-fix candidate pool has no SHIFT-WINDOW bound. The canonical grid
 *       says 12:15-13:00 is grade 7's own LUNCH BREAK row and grade 9's first
 *       CLASS row, so a grade 7 section (06:00-12:15) was parked at 12:15 — a
 *       slot that is legal for a DIFFERENT grade and a DIFFERENT term.
 *   D2   `previewManualSwapEntries` computes and returns the auto-fix target, but
 *       the client's "Before -> After" panel hard-codes the DIRECT swap, so a
 *       green "Safe to review" banner sat above a move description that was not
 *       the move. The commit also trusted the client's `autoFixTarget` verbatim.
 *   D3   `swapManualEntries` writes ONE `SWAP_ENTRIES` row with a MULTI-entry
 *       payload ({entryIdA, entryIdB, entryA, entryB}; no `entryId`), while
 *       `revertLastEdit` has a single-entry `else` branch whose
 *       `if (idx !== -1)` guard silently SKIPS the restore and then bumps the
 *       version, writes a REVERT row, writes an audit row, and publishes
 *       `TIMETABLE_REVERTED`. Reported success; restored nothing.
 *
 * Mounted on a real disposable PostgreSQL database, driving the REAL exported
 * service functions. No mock of the code under test.
 *
 * Run: `npm run test:timetable-swap-custody-a2` (wired in `atlas-server/package.json`).
 */

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import {
	isDisposableHarnessAvailable,
	provisionDisposableDatabase,
	psql,
	teardownCanonicalFixture,
	type DisposableDatabase,
} from './helpers/tt-source-freshness-db.js';

process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';
process.env.ENROLLPRO_CLIENT_URL = 'http://127.0.0.1:1';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'a2-timetable-custody-secret';
process.env.ATLAS_SYSTEM_TOKEN = process.env.ATLAS_SYSTEM_TOKEN ?? 'a2-timetable-custody-system-token';

const RUNNABLE = isDisposableHarnessAvailable();

// ─── Fixture identity ───
const FIXTURE_TAG = 'A2SWAP';
const SCHOOL_YEAR_EXTERNAL_ID = 9_200_001;
const G7_A = 9_201; // grade 7, REGULAR — the section the operator edited
const G7_B = 9_202; // grade 7, REGULAR
const G9_A = 9_301; // grade 9, REGULAR
const G9_B = 9_302; // grade 9, REGULAR
const TEACHER = 701; // owns both swapped sessions
const OTHER_G7_TEACHER = 702;
const G9_TEACHER = 703;

/** The persisted stakeholder shift windows, exactly as the live run carries them. */
const LIVE_SHIFT_WINDOWS = [
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '12:15' },
	{ gradeLevel: 9, programType: 'REGULAR', startTime: '12:15', endTime: '18:30' },
	{ gradeLevel: 7, programType: 'STE', startTime: '06:00', endTime: '14:30' },
	{ gradeLevel: 7, programType: 'SPS', startTime: '06:00', endTime: '14:30' },
	{ gradeLevel: 7, programType: 'SPA', startTime: '06:00', endTime: '14:30' },
] as const;

const G7_REGULAR_DAY = LIVE_SHIFT_WINDOWS.find((w) => w.gradeLevel === 7 && w.programType === 'REGULAR')!;

/** The slot the live run wrongly chose: grade 7's LUNCH BREAK row, grade 9's first CLASS row. */
const OUT_OF_SHIFT_SLOT = { day: 'WEDNESDAY', startTime: '12:15', endTime: '13:00' };
/** A legal grade 7 CLASS row: inside the day, occupied in Term 2. */
const IN_SHIFT_SLOT = { day: 'THURSDAY', startTime: '07:30', endTime: '08:15' };

type EntrySeed = {
	entryId: string;
	day: string;
	startTime: string;
	endTime: string;
	sectionExternalId: number;
	subjectCode: string;
	facultyExternalId: number;
	roomName: string;
	termIndex: 1 | 2 | 3;
};

/** The sessions the operator actually saw and swapped: two classes, two teachers. */
const SWAP_PAIR: EntrySeed[] = [
	// A — the session leaving the blocked slot. Grade 7 / teacher 701 / R-G7A.
	{ entryId: 'A-G7-MAPEH-MON0730', day: 'MONDAY', startTime: '07:30', endTime: '08:15', sectionExternalId: G7_A, subjectCode: 'MAPEH', facultyExternalId: TEACHER, roomName: 'R-G7A', termIndex: 2 },
	// B — the "blocking" session the auto-fix relocates. Grade 7 / teacher 702 /
	// R-G7B. A takes B's slot, so B is the session that must move out of the way.
	{ entryId: 'B-G7-ESP-WED0815', day: 'WEDNESDAY', startTime: '08:15', endTime: '09:00', sectionExternalId: G7_B, subjectCode: 'ESP', facultyExternalId: OTHER_G7_TEACHER, roomName: 'R-G7B', termIndex: 2 },
];

/**
 * The third parties that make the two scenarios distinct.
 *
 *   BLOCKER    holds teacher 702 at A's slot, so the DIRECT swap is hard-blocked:
 *              it would put ESP into a slot its own teacher already teaches. The
 *              pre-swap draft is CLEAN (0 hard), so every later hard count is
 *              attributable to the swap under test. This is the only shape
 *              `AUTO_FIX_MOVE_BLOCKING` can relieve, because that strategy parks A
 *              on B's slot and relocates B.
 *   CROSS_TERM holds **ESP's own room** at the out-of-shift slot, but only in
 *              **Term 3**, while the moved entry is Term 2. A term-scoped
 *              validator therefore reports that room FREE — so nothing but the
 *              candidate-pool term filter can reject the slot.
 *   IN_SHIFT  occupies a legal grade 7 CLASS row in **Term 2**.
 */
const BLOCKER: EntrySeed = { entryId: 'X-G9A-BLOCKER-MON0730', day: 'MONDAY', startTime: '07:30', endTime: '08:15', sectionExternalId: G9_A, subjectCode: 'FILER', facultyExternalId: OTHER_G7_TEACHER, roomName: 'R-G9A', termIndex: 2 };
const CROSS_TERM: EntrySeed = { entryId: 'Y-G9A-FILLER-WED1215', day: 'WEDNESDAY', startTime: '12:15', endTime: '13:00', sectionExternalId: G9_A, subjectCode: 'FILER', facultyExternalId: G9_TEACHER, roomName: 'R-G7B', termIndex: 3 };
const IN_SHIFT: EntrySeed = { entryId: 'Z-G9A-FILLER-THU0730', day: 'THURSDAY', startTime: '07:30', endTime: '08:15', sectionExternalId: G9_A, subjectCode: 'FILER', facultyExternalId: G9_TEACHER, roomName: 'R-G9A', termIndex: 2 };

let harness: DisposableDatabase | null = null;
let prisma: any = null;
let fixture: any = null;
let service: any = null;

function toMinutes(value: string): number {
	const [h, m] = value.split(':').map(Number);
	return h * 60 + m;
}

function slotKey(slot: { day: string; startTime: string; endTime: string }): string {
	return `${slot.day}|${slot.startTime}|${slot.endTime}`;
}

async function readEntry(runId: number, entryId: string): Promise<any> {
	const run = await prisma.generationRun.findUnique({ where: { id: runId } });
	return ((run.draftEntries as any[]) ?? []).find((entry) => entry.entryId === entryId) ?? null;
}

async function runVersion(runId: number): Promise<number> {
	const run = await prisma.generationRun.findUnique({ where: { id: runId }, select: { version: true } });
	return run.version;
}

async function editRows(runId: number): Promise<any[]> {
	return prisma.manualScheduleEdit.findMany({ where: { runId }, orderBy: { id: 'asc' } });
}

async function auditCount(schoolId: number): Promise<number> {
	return prisma.auditLog.count({ where: { schoolId } });
}

before(async () => {
	if (!RUNNABLE) return;
	harness = provisionDisposableDatabase('a2swap');
	if (!harness) return;
	process.env.DATABASE_URL = harness.targetUrl;

	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });
	await prisma.$connect();

	fixture = await seedFixture();

	// The service reads the Prisma singleton's datasource at import time, so the
	// dynamic import must come after DATABASE_URL points at the disposable DB.
	service = await import('../services/manual-edit.service.js');
});

after(async () => {
	if (prisma) {
		if (fixture) await teardownCanonicalFixture(prisma, fixture.schoolId);
		await prisma.$disconnect().catch(() => undefined);
	}
	if (harness) {
		harness.drop();
		harness.assertDropped();
	}
});

/**
 * Seed the smallest real world in which the live reproduction is possible: the
 * canonical class-program grid for grades 7 and 9 (the real source of the
 * 06:00-12:15 / 12:15-18:30 envelopes), the five persisted stakeholder shift
 * windows, four sections across two grades, three teachers, four rooms, and TWO
 * COMPLETED draft runs over the same reference data:
 *
 *   reproRun  the live shape — the only conflict-free slot the unbounded pool can
 *             reach is the out-of-shift, other-term one.
 *   legalRun  the same, plus a legal in-shift/in-term slot, so the fix cannot be
 *             satisfied by simply disabling the auto-fix.
 */
async function seedFixture() {
	const { getExpectedCanonicalSlots } = await import('../services/class-program-slot.service.js');

	const school = await prisma.school.create({
		data: { name: `${FIXTURE_TAG} — DISPOSABLE, SAFE TO DELETE`, shortName: FIXTURE_TAG },
		select: { id: true },
	});
	const schoolId = school.id as number;
	const schoolYearId = SCHOOL_YEAR_EXTERNAL_ID;

	await prisma.enrollProSchoolYearMirror.create({
		data: {
			schoolId,
			enrollProSchoolYearId: schoolYearId,
			yearLabel: '2026-2027',
			isActive: true,
			isArchived: false,
			termContractCache: {
				schoolId,
				schoolYear: { id: schoolYearId },
				format: 'TRIMESTER',
				terms: [
					{ identity: 'T1', displayLabel: 'First Trimester', order: 1 },
					{ identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
					{ identity: 'T3', displayLabel: 'Third Trimester', order: 3 },
				],
			},
			termContractCachedAt: new Date(),
		},
	});

	// Policy tuned so the decisive variable is the term/shift boundary and never
	// an unrelated warning-preference accident.
	await prisma.schedulingPolicy.create({
		data: {
			schoolId,
			schoolYearId,
			periodLengthMinutes: 45,
			periodsPerDay: 9,
			earliestStartTime: '06:00',
			latestEndTime: '18:30',
			maxTeachingMinutesPerDay: 480,
			avoidEarlyFirstPeriod: false,
			avoidLateLastPeriod: false,
			enableTravelWellbeingChecks: false,
			enableVacantAwareConstraints: false,
			enableFlagCeremony: false,
			enableRecess: false,
		} as any,
	});

	// The canonical grid IS the real surface: grade 7's rows are 06:00-12:15
	// CLASS plus a 12:15-13:00 LUNCH BREAK; grade 9's first CLASS row is 12:15.
	for (const gradeLevel of [7, 9]) {
		const rows = getExpectedCanonicalSlots(gradeLevel, 'REGULAR') as any[];
		await prisma.classProgramSlot.createMany({
			data: rows.map((row) => ({
				schoolId,
				schoolYearId,
				gradeLevel,
				programType: 'REGULAR' as const,
				startTime: row.startTime,
				endTime: row.endTime,
				rowKind: row.rowKind as any,
				subjectFamily: row.subjectFamily ?? null,
				subjectLabel: row.subjectLabel ?? null,
				isActive: true,
			})),
		});
	}

	await prisma.gradeShiftWindow.createMany({
		data: LIVE_SHIFT_WINDOWS.map((window) => ({
			schoolId,
			schoolYearId,
			gradeLevel: window.gradeLevel,
			programType: window.programType as any,
			startTime: window.startTime,
			endTime: window.endTime,
		})),
	});

	const buildingG7 = await prisma.building.create({ data: { schoolId, name: 'B-G7', gradeScope: [7] } });
	const buildingG9 = await prisma.building.create({ data: { schoolId, name: 'B-G9', gradeScope: [9] } });
	const rooms: Record<string, number> = {};
	for (const [name, buildingId] of [
		['R-G7A', buildingG7.id], ['R-G7B', buildingG7.id],
		['R-G9A', buildingG9.id], ['R-G9B', buildingG9.id],
	] as const) {
		const room = await prisma.room.create({
			data: { buildingId, name, type: 'CLASSROOM' as const, capacity: 50, isTeachingSpace: true, isSharedFacility: false, buildingZoneId: 'Z1' },
		});
		rooms[name] = room.id as number;
	}

	const subjects: Record<string, number> = {};
	for (const [code, name] of [['MAPEH', 'MAPEH'], ['ESP', 'Espanol'], ['FILER', 'Filler']] as const) {
		const subject = await prisma.subject.create({
			data: {
				schoolId, code, name,
				minMinutesPerWeek: 240,
				preferredRoomType: 'CLASSROOM' as const,
				gradeLevels: [7, 9],
				programScopes: ['REGULAR' as const],
				isActive: true,
			},
		});
		subjects[code] = subject.id as number;
	}

	const sectionDefs = [
		{ id: G7_A, name: '7-A', grade: 7 },
		{ id: G7_B, name: '7-B', grade: 7 },
		{ id: G9_A, name: '9-A', grade: 9 },
		{ id: G9_B, name: '9-B', grade: 9 },
	] as const;
	for (const section of sectionDefs) {
		await prisma.sectionMirror.create({
			data: {
				externalId: section.id,
				schoolId, schoolYearId,
				name: section.name,
				gradeLevelId: 10 + section.grade,
				gradeLevelName: `Grade ${section.grade}`,
				displayOrder: section.grade,
				maxCapacity: 50,
				enrolledCount: 40,
				programType: 'REGULAR',
				isActiveForScheduling: true,
				isStale: false,
			},
		});
	}
	await prisma.sectionSnapshot.create({
		data: {
			schoolId, schoolYearId,
			payload: [7, 9].map((gradeLevel) => ({
				gradeLevelId: 10 + gradeLevel,
				gradeLevelName: `Grade ${gradeLevel}`,
				displayOrder: gradeLevel,
				sections: sectionDefs
					.filter((section) => section.grade === gradeLevel)
					.map((section) => ({
						id: section.id,
						name: section.name,
						displayOrder: gradeLevel,
						gradeLevelId: 10 + gradeLevel,
						gradeLevelName: `Grade ${gradeLevel}`,
						maxCapacity: 50,
						enrolledCount: 40,
						programType: 'REGULAR',
					})),
			})),
		},
	});

	const faculty: Record<number, number> = {};
	for (const externalId of [TEACHER, OTHER_G7_TEACHER, G9_TEACHER]) {
		const member = await prisma.facultyMirror.create({
			data: {
				externalId, schoolId,
				firstName: `Teacher${externalId}`,
				lastName: `S${externalId}`,
				department: 'REGULAR',
				maxHoursPerWeek: 40,
				isActiveForScheduling: true,
				isStale: false,
			},
		});
		faculty[externalId] = member.id as number;
		// Every teacher owns every subject for every section, so qualification is
		// never the reason a candidate is rejected — only the term/shift boundary.
		// `loadRunContext` reads qualification from `facultySubject.sectionIds`.
		for (const code of ['MAPEH', 'ESP', 'FILER']) {
			await prisma.facultySubject.create({
				data: {
					facultyId: member.id,
					subjectId: subjects[code],
					schoolId, schoolYearId,
					gradeLevels: [7, 9],
					sectionIds: [G7_A, G7_B, G9_A, G9_B],
					assignedBy: 1,
				},
			});
		}
	}

	const toEntry = (seed: EntrySeed) => ({
		entryId: seed.entryId,
		facultyId: faculty[seed.facultyExternalId],
		roomId: rooms[seed.roomName],
		subjectId: subjects[seed.subjectCode],
		sectionId: seed.sectionExternalId,
		day: seed.day,
		startTime: seed.startTime,
		endTime: seed.endTime,
		durationMinutes: toMinutes(seed.endTime) - toMinutes(seed.startTime),
		termIndex: seed.termIndex,
		entryKind: 'SECTION' as const,
		programType: 'REGULAR' as const,
	});

	const createRun = async (seeds: EntrySeed[]) => {
		const draftEntries = seeds.map(toEntry);
		const run = await prisma.generationRun.create({
			data: {
				schoolId, schoolYearId,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: 1,
				startedAt: new Date(),
				finishedAt: new Date(),
				draftEntries,
				unassignedItems: [],
				violations: [],
				summary: { draft: draftEntries.length, unassigned: 0 },
				version: 1,
			},
		});
		return run.id as number;
	};

	// The live shape: no legal in-shift/in-term slot exists for ESP, so the only
	// conflict-free slot the unbounded pool can reach is the out-of-shift one.
	const reproRun = await createRun([...SWAP_PAIR, BLOCKER, CROSS_TERM]);
	// The same plus a legal in-shift/in-term slot, so closing the boundary cannot
	// be satisfied by disabling the auto-fix outright.
	const legalRun = await createRun([...SWAP_PAIR, BLOCKER, CROSS_TERM, IN_SHIFT]);

	return { schoolId, schoolYearId, reproRun, legalRun, rooms, subjects, faculty };
}

const previewSwap = (runId: number) => service.previewManualSwapEntries(
	runId, fixture.schoolId, fixture.schoolYearId,
	'A-G7-MAPEH-MON0730', 'B-G7-ESP-WED0815',
);

// ────────────────────────────────────────────────────────────────────────────
// D1 — the auto-fix candidate pool must respect the ordered term and the shift window
// ────────────────────────────────────────────────────────────────────────────

test('D1-W: the resolved shift authority is the live stakeholder window set', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const refData = await service.loadRunContext(fixture.reproRun, fixture.schoolId, fixture.schoolYearId);
	const authority = service.resolveManualWindowAuthority(refData);
	const windows: string[] = (authority.shiftWindows as any[]).map((w) => `${w.gradeLevel}:${w.programType}:${w.startTime}-${w.endTime}`).sort();
	for (const expected of LIVE_SHIFT_WINDOWS) {
		assert.ok(
			windows.includes(`${expected.gradeLevel}:${expected.programType}:${expected.startTime}-${expected.endTime}`),
			`the live stakeholder window ${expected.gradeLevel}/${expected.programType} ${expected.startTime}-${expected.endTime} is the resolved authority (resolved: ${windows.join(', ')})`,
		);
	}
	assert.equal(authority.sectionScope.get(G7_A)?.gradeLevel, 7, 'G7-A resolves to grade 7');
	assert.equal(authority.sectionScope.get(G7_A)?.programType, 'REGULAR', 'G7-A resolves to REGULAR');
	// The canonical grid places grade 7's lunch break exactly on the slot the live
	// run wrongly chose, and makes it grade 9's first class slot.
	assert.deepEqual(
		windows.filter((w) => w.startsWith('7:REGULAR') || w.startsWith('9:REGULAR')).sort(),
		['7:REGULAR:06:00-12:15', '9:REGULAR:12:15-18:30'],
		'grade 7 REGULAR ends at 12:15 and grade 9 REGULAR begins at 12:15 — the overlap seam the pool walked through',
	);
});

test('D1: the auto-fix never offers a slot outside the moved section\'s day, nor a slot held only in another term', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const preview = await previewSwap(fixture.reproRun);
	const target = preview.autoFixBlockingTarget;
	console.log(
		`[A2-D1] reproRun strategy=${preview.recommendedStrategy}`
		+ ` blockingTarget=${target ? slotKey(target) : 'null'}`
		+ ` sourceTarget=${preview.autoFixSourceTarget ? slotKey(preview.autoFixSourceTarget) : 'null'}`
		+ ` directHard=${preview.direct.hardViolations.length} directSoft=${preview.direct.softViolations.length}`,
	);
	assert.ok(preview.direct.hardViolations.length > 0, 'precondition: the direct swap is hard-blocked, which is why an auto-fix is reached for at all');

	for (const [label, candidate] of [['blocking', preview.autoFixBlockingTarget], ['source', preview.autoFixSourceTarget]] as const) {
		if (!candidate) continue;
		const key = slotKey(candidate);
		assert.ok(
			toMinutes(candidate.startTime) >= toMinutes(G7_REGULAR_DAY.startTime)
				&& toMinutes(candidate.endTime) <= toMinutes(G7_REGULAR_DAY.endTime),
			`D1b SHIFT: the ${label} target ${key} lies inside the moved section's day ${G7_REGULAR_DAY.startTime}-${G7_REGULAR_DAY.endTime}`,
		);
		// (a) proved against persisted rows, not a predicate: the target must be a
		// slot occupied in the moved entry's OWN ordered term (Term 2), so a slot
		// that exists only in Term 3 can never be drawn.
		const run = await prisma.generationRun.findUnique({ where: { id: fixture.reproRun } });
		const occupantTerms = (run.draftEntries as any[])
			.filter((entry) => slotKey(entry) === key)
			.map((entry) => entry.termIndex);
		assert.ok(occupantTerms.length > 0, `the ${label} target ${key} is a real persisted slot in the run`);
		assert.ok(
			occupantTerms.includes(2),
			`D1a TERM: the ${label} target ${key} is occupied in the moved entry's own ordered term (Term 2); its persisted occupants are terms ${JSON.stringify(occupantTerms)}`,
		);
	}
	// The blocking strategy had exactly ONE conflict-free slot in this run — the
	// out-of-shift, other-term one — so with the boundary in place there is no
	// blocking auto-fix at all. That is the "or there is no auto-fix" outcome,
	// never an illegal offer.
	assert.equal(
		preview.autoFixBlockingTarget, null,
		'the only conflict-free BLOCKING slot was the out-of-shift, other-term one, so no blocking auto-fix is offered',
	);
	assert.notEqual(
		preview.autoFixSourceTarget ? slotKey(preview.autoFixSourceTarget) : null, slotKey(OUT_OF_SHIFT_SLOT),
		'the out-of-shift, other-term slot is never offered by either strategy',
	);
});

test('D1-ALT: a legal in-shift/in-term auto-fix still exists, and the illegal slot is never offered', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const preview = await previewSwap(fixture.legalRun);
	const target = preview.autoFixBlockingTarget;
	console.log(
		`[A2-D1] legalRun strategy=${preview.recommendedStrategy}`
		+ ` blockingTarget=${target ? slotKey(target) : 'null'}`
		+ ` sourceTarget=${preview.autoFixSourceTarget ? slotKey(preview.autoFixSourceTarget) : 'null'}`,
	);
	assert.ok(target, 'the auto-fix is NOT disabled by the boundary: a legal target is offered');
	assert.equal(slotKey(target), slotKey(IN_SHIFT_SLOT), `the offered target is the legal in-shift, in-term slot ${slotKey(IN_SHIFT_SLOT)} (got ${slotKey(target)})`);
	assert.notEqual(slotKey(target), slotKey(OUT_OF_SHIFT_SLOT), 'the out-of-shift, other-term slot is never offered');
	assert.equal(preview.recommendedStrategy, 'AUTO_FIX_MOVE_BLOCKING', 'the recommended strategy is the auto-fix that the preview discloses');
});

test('D1-NEG: the term boundary is load-bearing — the validator cannot see a Term 3 occupancy', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	// Establishes that D1a is a genuine hole and not a redundant belt: with the
	// Term 3 occupant of WEDNESDAY 12:15-13:00 in place, a Term 2 grade 7 entry
	// moved there produces ZERO hard violations, because the validator groups by
	// term. Removing the candidate-pool term filter therefore reproduces the live
	// placement, and only that filter closes it.
	const { validateHardConstraints } = await import('../services/constraint-validator.js');
	const refData = await service.loadRunContext(fixture.reproRun, fixture.schoolId, fixture.schoolYearId);
	const entries = refData.entries as any[];
	const esp = entries.find((e: any) => e.entryId === 'B-G7-ESP-WED0815');

	const moved = entries.map((entry) => (entry.entryId === esp.entryId
		? { ...entry, day: OUT_OF_SHIFT_SLOT.day, startTime: OUT_OF_SHIFT_SLOT.startTime, endTime: OUT_OF_SHIFT_SLOT.endTime }
		: entry));
	const validation = validateHardConstraints(service.buildValidatorCtx(fixture.schoolId, fixture.schoolYearId, fixture.reproRun, moved, refData));
	const hard = validation.violations.filter((v: any) => v.severity === 'HARD');
	assert.equal(hard.length, 0, 'a Term 2 grade 7 entry at WEDNESDAY 12:15-13:00 creates ZERO hard violations — the validator cannot catch it, so the pool must');

	// And the same placement in the entry's OWN term is caught, proving the term
	// scoping is real in both directions rather than inert.
	const sameTermMoved = entries.map((entry) => (entry.entryId === esp.entryId
		? { ...entry, day: OUT_OF_SHIFT_SLOT.day, startTime: OUT_OF_SHIFT_SLOT.startTime, endTime: OUT_OF_SHIFT_SLOT.endTime, termIndex: 3 }
		: entry));
	const sameTermHard = validateHardConstraints(service.buildValidatorCtx(fixture.schoolId, fixture.schoolYearId, fixture.reproRun, sameTermMoved, refData))
		.violations.filter((v: any) => v.severity === 'HARD');
	assert.ok(sameTermHard.length > 0, `the same placement in Term 3 IS caught (${sameTermHard.length} hard) — the term scoping discriminates, so its absence in the pool is a real hole`);
});

// ────────────────────────────────────────────────────────────────────────────
// D2 — a commit applies exactly what its preview showed, or refuses
// ────────────────────────────────────────────────────────────────────────────

test('D2: the commit applies the previewed target and refuses any other', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const preview = await previewSwap(fixture.legalRun);
	const previewed = preview.autoFixBlockingTarget;
	assert.ok(previewed, 'a previewed auto-fix target exists');

	// Refuse: a target the preview never named. Zero writes.
	const beforeVersion = await runVersion(fixture.legalRun);
	const beforeEdits = (await editRows(fixture.legalRun)).length;
	let refusal: any = null;
	try {
		await service.swapManualEntries(
			fixture.legalRun, fixture.schoolId, fixture.schoolYearId, 1,
			'A-G7-MAPEH-MON0730', 'B-G7-ESP-WED0815', beforeVersion,
			'AUTO_FIX_MOVE_BLOCKING', OUT_OF_SHIFT_SLOT,
		);
	} catch (error) {
		refusal = error;
	}
	assert.ok(refusal, 'a commit to a target the preview never named is REFUSED');
	assert.equal(refusal.code, 'AUTO_FIX_TARGET_DRIFT', `the refusal is typed (got ${refusal.code})`);
	assert.equal(await runVersion(fixture.legalRun), beforeVersion, 'the refused commit wrote no version bump');
	assert.equal((await editRows(fixture.legalRun)).length, beforeEdits, 'the refused commit wrote no edit row');

	// Apply: exactly the previewed target.
	const committed = await service.swapManualEntries(
		fixture.legalRun, fixture.schoolId, fixture.schoolYearId, 1,
		'A-G7-MAPEH-MON0730', 'B-G7-ESP-WED0815', beforeVersion,
		'AUTO_FIX_MOVE_BLOCKING', previewed,
	);
	assert.equal(committed.newVersion, beforeVersion + 1, 'the accepted commit advanced the run version once');

	const esp = await readEntry(fixture.legalRun, 'B-G7-ESP-WED0815');
	const mapeh = await readEntry(fixture.legalRun, 'A-G7-MAPEH-MON0730');
	assert.equal(slotKey(esp), slotKey(previewed), `the committed ESP slot is EXACTLY the previewed slot ${slotKey(previewed)} (got ${slotKey(esp)})`);
	assert.equal(mapeh.day, 'WEDNESDAY', 'MAPEH took the slot ESP vacated, as the preview showed');
	assert.equal(mapeh.startTime, '08:15', 'MAPEH took the slot ESP vacated, as the preview showed');
	assert.notEqual(slotKey(esp), slotKey(OUT_OF_SHIFT_SLOT), 'the live defect placement is gone');

	// The recorded history names the move that actually happened.
	const swapRow = (await editRows(fixture.legalRun)).find((row: any) => row.editType === 'SWAP_ENTRIES');
	assert.equal(swapRow.afterPayload.entryB.day, previewed.day, 'the SWAP_ENTRIES row records the committed target day');
	assert.equal(swapRow.afterPayload.entryB.startTime, previewed.startTime, 'the SWAP_ENTRIES row records the committed target start');
});

// ────────────────────────────────────────────────────────────────────────────
// D3 — an undo restores the prior state exactly, or says it cannot and writes nothing
//
// These rows continue the narrative D2 started (node:test runs top-level `test()`
// in declaration order): D2 committed a real swap on `legalRun`, so D3 reverts
// that committed swap rather than a hand-planted fixture.
// ────────────────────────────────────────────────────────────────────────────

test('D3: reverting a SWAP_ENTRIES edit restores BOTH entries of the pair exactly', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const swapRow = (await editRows(fixture.legalRun)).find((row: any) => row.editType === 'SWAP_ENTRIES');
	assert.ok(swapRow, 'the swap recorded exactly ONE SWAP_ENTRIES row — the revert target is not ambiguous');
	assert.equal(
		(await editRows(fixture.legalRun)).filter((row: any) => row.editType === 'SWAP_ENTRIES').length,
		1,
		'the history records ONE entry for the pair, not two',
	);
	assert.equal(swapRow.beforePayload.entryId, undefined, 'the multi-entry payload carries no single `entryId` — this is the shape mismatch');
	assert.equal(swapRow.afterPayload.entryId, undefined, 'the afterPayload carries no single `entryId` either');

	const versionBeforeUndo = await runVersion(fixture.legalRun);
	const editsBeforeUndo = (await editRows(fixture.legalRun)).length;
	const auditsBeforeUndo = await auditCount(fixture.schoolId);
	const draftBeforeUndo = JSON.stringify((await prisma.generationRun.findUnique({ where: { id: fixture.legalRun } })).draftEntries);

	// The undo must have real work to do: the committed draft differs from the
	// pre-swap draft, so a no-op cannot masquerade as a restore.
	const committedEsp = await readEntry(fixture.legalRun, 'B-G7-ESP-WED0815');
	assert.notEqual(
		slotKey(committedEsp), slotKey(swapRow.beforePayload.entryB),
		`precondition: the committed draft differs from the pre-swap draft (ESP is at ${slotKey(committedEsp)}, pre-swap ${slotKey(swapRow.beforePayload.entryB)})`,
	);

	const result = await service.revertLastEdit(
		fixture.legalRun, fixture.schoolId, fixture.schoolYearId, 1, swapRow.id, versionBeforeUndo,
	);
	const draftAfterUndo = JSON.stringify((await prisma.generationRun.findUnique({ where: { id: fixture.legalRun } })).draftEntries);
	// The literal "reported success, restored nothing" evidence, printed on every
	// revision so the pre-fix behaviour is on the record and not only in a diff.
	console.log(
		`[A2-D3] revert reported newVersion=${result.newVersion} (versionBeforeUndo=${versionBeforeUndo})`
		+ ` draftUnchanged=${draftAfterUndo === draftBeforeUndo}`
		+ ` revertRowsWritten=${(await editRows(fixture.legalRun)).length - editsBeforeUndo}`
		+ ` auditRowsWritten=${(await auditCount(fixture.schoolId)) - auditsBeforeUndo}`,
	);
	assert.equal(result.newVersion, versionBeforeUndo + 1, 'a genuine revert advances the version once');

	for (const [entryId, beforeSlot] of [
		['B-G7-ESP-WED0815', swapRow.beforePayload.entryB],
		['A-G7-MAPEH-MON0730', swapRow.beforePayload.entryA],
	] as const) {
		const restored = await readEntry(fixture.legalRun, entryId);
		assert.equal(restored.day, beforeSlot.day, `${entryId} day restored to ${beforeSlot.day} (got ${restored.day})`);
		assert.equal(restored.startTime, beforeSlot.startTime, `${entryId} startTime restored to ${beforeSlot.startTime} (got ${restored.startTime})`);
		assert.equal(restored.endTime, beforeSlot.endTime, `${entryId} endTime restored to ${beforeSlot.endTime} (got ${restored.endTime})`);
		assert.equal(
			restored.durationMinutes, toMinutes(beforeSlot.endTime) - toMinutes(beforeSlot.startTime),
			`${entryId} durationMinutes recomputed to match the restored slot`,
		);
	}

	const run = await prisma.generationRun.findUnique({ where: { id: fixture.legalRun } });
	const untouched = (run.draftEntries as any[]).filter((e: any) => !['A-G7-MAPEH-MON0730', 'B-G7-ESP-WED0815'].includes(e.entryId));
	assert.equal(untouched.length, 3, `the revert touched only the two swapped entries, leaving the run's other 3 (got ${untouched.length})`);
	assert.equal((await editRows(fixture.legalRun)).length, editsBeforeUndo + 1, 'the genuine revert wrote its REVERT row');
	assert.ok((await auditCount(fixture.schoolId)) > auditsBeforeUndo, 'the genuine revert wrote its audit row');
});

test('D3-FAILCLOSED: an edit type with no correct restore strategy refuses and writes NOTHING', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	// The real-world shape: a row whose editType is a single-entry type but whose
	// payload is not single-entry. Pre-fix, `findIndex` returns -1 and the
	// `if (idx !== -1)` guard skips the restore while the function carries on and
	// reports success.
	const versionBefore = await runVersion(fixture.legalRun);
	const auditsBefore = await auditCount(fixture.schoolId);
	const draftBefore = JSON.stringify((await prisma.generationRun.findUnique({ where: { id: fixture.legalRun } })).draftEntries);

	const mismatched = await prisma.manualScheduleEdit.create({
		data: {
			runId: fixture.legalRun,
			schoolId: fixture.schoolId,
			schoolYearId: fixture.schoolYearId,
			actorId: 1,
			editType: 'CHANGE_TIMESLOT',
			// A SWAP-shaped payload under a single-entry edit type: no `entryId`.
			beforePayload: { entryIdA: 'A-G7-MAPEH-MON0730', entryB: { day: 'MONDAY', startTime: '07:30', endTime: '08:15' } } as object,
			afterPayload: { entryIdA: 'A-G7-MAPEH-MON0730', entryB: { day: 'TUESDAY', startTime: '10:00', endTime: '10:45' } } as object,
			validationSummary: {} as object,
		},
	});
	// Baseline taken AFTER the planted row exists, so the count below is exactly
	// "the refused revert wrote nothing".
	const editsBefore = (await editRows(fixture.legalRun)).length;

	let refusal: any = null;
	try {
		await service.revertLastEdit(
			fixture.legalRun, fixture.schoolId, fixture.schoolYearId, 1, mismatched.id, versionBefore,
		);
	} catch (error) {
		refusal = error;
	}

	assert.ok(refusal, 'a payload shape with no correct restore strategy is REFUSED, not silently skipped');
	assert.equal(refusal.code, 'UNDO_RESTORE_UNAVAILABLE', `the refusal is typed (got ${refusal.code})`);

	// The zero-write property, asserted literally.
	assert.equal(await runVersion(fixture.legalRun), versionBefore, 'ZERO WRITE: no run version bump');
	assert.equal((await editRows(fixture.legalRun)).length, editsBefore, 'ZERO WRITE: no REVERT row');
	assert.equal(await auditCount(fixture.schoolId), auditsBefore, 'ZERO WRITE: no audit row');
	assert.equal(
		JSON.stringify((await prisma.generationRun.findUnique({ where: { id: fixture.legalRun } })).draftEntries),
		draftBefore,
		'ZERO WRITE: the draft is byte-identical',
	);
});

// ────────────────────────────────────────────────────────────────────────────
// Zero-residue proof
// ────────────────────────────────────────────────────────────────────────────

test('Z: nothing was written to the configured (non-disposable) database', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, () => {
	// The disposable database is dropped by `after()`. This row proves the
	// stronger property: the configured source database never received a row for
	// this fixture identity. Literal SQL, one count per statement.
	const sourceDb = decodeURIComponent(harness!.source.pathname.replace(/^\//, ''));
	const sql = (query: string): string => psql(
		['-h', harness!.source.hostname, '-p', harness!.source.port || '5432', '-U', decodeURIComponent(harness!.source.username), '-d', sourceDb, '-tAc', query],
		harness!.adminEnv,
	);

	assert.equal(
		sql(`SELECT count(*) FROM schools WHERE "shortName" = '${FIXTURE_TAG}'`),
		'0',
		`ZERO WRITE: no fixture school row in the configured database ${sourceDb}`,
	);
	assert.equal(
		sql(`SELECT count(*) FROM generation_runs gr JOIN schools s ON s.id = gr.school_id WHERE s."shortName" = '${FIXTURE_TAG}'`),
		'0',
		'ZERO WRITE: no generation run for the fixture identity in the configured database',
	);
	assert.equal(
		sql(`SELECT count(*) FROM manual_schedule_edits mse JOIN schools s ON s.id = mse.school_id WHERE s."shortName" = '${FIXTURE_TAG}'`),
		'0',
		'ZERO WRITE: no manual schedule edit for the fixture identity in the configured database',
	);
});
