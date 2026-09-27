/**
 * A2-TIMETABLE-CUSTODY (D4) — the ENUMERATION: which entries does a committed
 * swap actually mutate, and does the recorded payload cover every one of them?
 *
 * A live acceptance run on draft run 321 (2026-09-27) recorded:
 *
 *     pre-swap      159 warnings
 *     after swap     68 warnings
 *     after revert   69 warnings   <- NOT 159
 *
 * so the revert restored its recorded pair and still was not a revert. The
 * working hypothesis was that `swapManualEntries` mutates an entry its
 * `SWAP_ENTRIES` payload does not name. THIS FILE EXISTS TO SETTLE THAT, not to
 * assume it. It enumerates, per strategy, the exact set of entry ids whose
 * `day`/`startTime`/`endTime` actually moved, compares that set against the set
 * the payload names, and reports the recomputed warning count at all three
 * stages. If the payload turns out to cover every mutated entry, the hypothesis
 * is wrong and the row says so in its own output.
 *
 * Mounted on a real disposable PostgreSQL database, driving the REAL exported
 * service functions (`previewManualSwapEntries`, `swapManualEntries`,
 * `revertLastEdit`). No mock of the code under test, and no client.
 *
 * Run: `npm run test:timetable-swap-revert-enumeration-a2`.
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
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'a2-swap-enumeration-secret';
process.env.ATLAS_SYSTEM_TOKEN = process.env.ATLAS_SYSTEM_TOKEN ?? 'a2-swap-enumeration-system-token';

const RUNNABLE = isDisposableHarnessAvailable();

const FIXTURE_TAG = 'A2ENUM';
const SCHOOL_YEAR_EXTERNAL_ID = 9_300_001;
const G7_A = 9_301;
const G7_B = 9_302;
const G9_A = 9_303;
const TEACHER = 711;
const OTHER_G7_TEACHER = 712;
const G9_TEACHER = 713;

const LIVE_SHIFT_WINDOWS = [
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '12:15' },
	{ gradeLevel: 9, programType: 'REGULAR', startTime: '12:15', endTime: '18:30' },
	{ gradeLevel: 7, programType: 'STE', startTime: '06:00', endTime: '14:30' },
	{ gradeLevel: 7, programType: 'SPS', startTime: '06:00', endTime: '14:30' },
	{ gradeLevel: 7, programType: 'SPA', startTime: '06:00', endTime: '14:30' },
] as const;

const ENTRY_A = 'A-G7-MAPEH-MON0730';
const ENTRY_B = 'B-G7-ESP-WED0815';

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

const SWAP_PAIR: EntrySeed[] = [
	{ entryId: ENTRY_A, day: 'MONDAY', startTime: '07:30', endTime: '08:15', sectionExternalId: G7_A, subjectCode: 'MAPEH', facultyExternalId: TEACHER, roomName: 'R-G7A', termIndex: 2 },
	{ entryId: ENTRY_B, day: 'WEDNESDAY', startTime: '08:15', endTime: '09:00', sectionExternalId: G7_B, subjectCode: 'ESP', facultyExternalId: OTHER_G7_TEACHER, roomName: 'R-G7B', termIndex: 2 },
];

/** Holds teacher 712 at A's slot, so the DIRECT swap is hard-blocked. */
const BLOCKER: EntrySeed = { entryId: 'X-G9A-BLOCKER-MON0730', day: 'MONDAY', startTime: '07:30', endTime: '08:15', sectionExternalId: G9_A, subjectCode: 'FILER', facultyExternalId: OTHER_G7_TEACHER, roomName: 'R-G9A', termIndex: 2 };
/** ESP's own room, held at the out-of-shift slot but only in Term 3. */
const CROSS_TERM: EntrySeed = { entryId: 'Y-G9A-FILLER-WED1215', day: 'WEDNESDAY', startTime: '12:15', endTime: '13:00', sectionExternalId: G9_A, subjectCode: 'FILER', facultyExternalId: G9_TEACHER, roomName: 'R-G7B', termIndex: 3 };
/** A legal grade 7 CLASS row occupied in Term 2. */
const IN_SHIFT: EntrySeed = { entryId: 'Z-G9A-FILLER-THU0730', day: 'THURSDAY', startTime: '07:30', endTime: '08:15', sectionExternalId: G9_A, subjectCode: 'FILER', facultyExternalId: G9_TEACHER, roomName: 'R-G9A', termIndex: 2 };

let harness: DisposableDatabase | null = null;
let prisma: any = null;
let fixture: any = null;
let service: any = null;

function toMinutes(value: string): number {
	const [h, m] = value.split(':').map(Number);
	return h * 60 + m;
}

type Slot = { day: string; startTime: string; endTime: string };

/**
 * The complete slot state of a run, keyed by entry id. This is the ONLY thing an
 * undo has to put back for the schedule to be identical, so it is also the only
 * thing the enumeration compares. A field the commit never writes is deliberately
 * NOT part of it.
 */
async function slotMap(runId: number): Promise<Map<string, Slot>> {
	const run = await prisma.generationRun.findUnique({ where: { id: runId } });
	const map = new Map<string, Slot>();
	for (const entry of (run.draftEntries as any[]) ?? []) {
		map.set(entry.entryId, { day: entry.day, startTime: entry.startTime, endTime: entry.endTime });
	}
	return map;
}

/** The entry ids whose slot differs between two snapshots — sorted, printable. */
function mutatedBetween(before: Map<string, Slot>, after: Map<string, Slot>): string[] {
	const ids = new Set([...before.keys(), ...after.keys()]);
	return [...ids]
		.filter((id) => {
			const a = before.get(id);
			const b = after.get(id);
			if (!a || !b) return true; // appeared or vanished
			return a.day !== b.day || a.startTime !== b.startTime || a.endTime !== b.endTime;
		})
		.sort();
}

/** The recomputed SOFT warning count, read from the run's OWN stored violations. */
async function softCount(runId: number): Promise<number> {
	const run = await prisma.generationRun.findUnique({ where: { id: runId } });
	return ((run.violations as any[]) ?? []).filter((v: any) => v.severity === 'SOFT').length;
}

async function hardCount(runId: number): Promise<number> {
	const run = await prisma.generationRun.findUnique({ where: { id: runId } });
	return ((run.violations as any[]) ?? []).filter((v: any) => v.severity === 'HARD').length;
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
	harness = provisionDisposableDatabase('a2enum');
	if (!harness) return;
	process.env.DATABASE_URL = harness.targetUrl;

	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });
	await prisma.$connect();

	fixture = await seedFixture();
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
						displayOrder: section.grade,
						gradeLevelId: 10 + section.grade,
						gradeLevelName: `Grade ${section.grade}`,
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
		for (const code of ['MAPEH', 'ESP', 'FILER']) {
			await prisma.facultySubject.create({
				data: {
					facultyId: member.id,
					subjectId: subjects[code],
					schoolId, schoolYearId,
					gradeLevels: [7, 9],
					sectionIds: [G7_A, G7_B, G9_A],
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

	// Three pristine runs, one per strategy, so each enumeration starts from an
	// untouched draft and no strategy can be contaminated by another's history.
	const directRun = await createRun([...SWAP_PAIR]);
	const blockingRun = await createRun([...SWAP_PAIR, BLOCKER, CROSS_TERM, IN_SHIFT]);
	const sourceRun = await createRun([...SWAP_PAIR, BLOCKER, CROSS_TERM]);

	// ── The LOADED family ──────────────────────────────────────────────────
	// The three runs above all score ZERO soft warnings, so on their own they
	// cannot say anything about the live symptom (159 -> 68 -> 69 warnings).
	// Warnings here are per-faculty-per-DAY aggregates, so a swap that moves a
	// session between days changes them in bulk — which is what a 91-warning
	// drop implies. This family reproduces that shape.
	//
	// Teacher TEACHER carries a heavy Monday: 9 x 45 = 405 min, which is one
	// FACULTY_DAILY_STANDARD_EXCEEDED because the soft standard is a hard-coded
	// 360 and the hard max is the policy's 480. A is one of those nine, so any
	// move that takes A off Monday drops that day's total to 360 and removes the
	// warning. That is the mechanism behind the live 159 -> 68.
	//
	// A and B are the live pair, including its two-teacher shape (the acceptance
	// test was MAPEH Mon 07:30 by I. GARCIA and ESP Mon 08:15 by J. Cruz):
	// A belongs to TEACHER, B to OTHER_G7_TEACHER.
	const loadedMonday: EntrySeed[] = [
		{ entryId: 'L-01', day: 'MONDAY', startTime: '06:00', endTime: '06:45', sectionExternalId: G7_A, subjectCode: 'FILER', facultyExternalId: TEACHER, roomName: 'R-G7A', termIndex: 2 },
		{ entryId: 'L-02', day: 'MONDAY', startTime: '06:45', endTime: '07:30', sectionExternalId: G7_A, subjectCode: 'FILER', facultyExternalId: TEACHER, roomName: 'R-G7A', termIndex: 2 },
		// A — the live swap source, and one of TEACHER's nine Monday sessions.
		{ entryId: ENTRY_A, day: 'MONDAY', startTime: '07:30', endTime: '08:15', sectionExternalId: G7_A, subjectCode: 'MAPEH', facultyExternalId: TEACHER, roomName: 'R-G7A', termIndex: 2 },
		{ entryId: 'L-05', day: 'MONDAY', startTime: '09:15', endTime: '10:00', sectionExternalId: G7_B, subjectCode: 'FILER', facultyExternalId: TEACHER, roomName: 'R-G7B', termIndex: 2 },
		{ entryId: 'L-06', day: 'MONDAY', startTime: '10:00', endTime: '10:45', sectionExternalId: G7_B, subjectCode: 'FILER', facultyExternalId: TEACHER, roomName: 'R-G7B', termIndex: 2 },
		{ entryId: 'L-07', day: 'MONDAY', startTime: '10:45', endTime: '11:30', sectionExternalId: G7_B, subjectCode: 'FILER', facultyExternalId: TEACHER, roomName: 'R-G7B', termIndex: 2 },
		{ entryId: 'L-08', day: 'MONDAY', startTime: '11:30', endTime: '12:15', sectionExternalId: G7_B, subjectCode: 'FILER', facultyExternalId: TEACHER, roomName: 'R-G7B', termIndex: 2 },
		{ entryId: 'L-09', day: 'MONDAY', startTime: '12:15', endTime: '13:00', sectionExternalId: G7_B, subjectCode: 'FILER', facultyExternalId: TEACHER, roomName: 'R-G7B', termIndex: 2 },
		// B — the live swap partner: a DIFFERENT teacher, one period later.
		{ entryId: ENTRY_B, day: 'MONDAY', startTime: '08:15', endTime: '09:00', sectionExternalId: G7_B, subjectCode: 'ESP', facultyExternalId: OTHER_G7_TEACHER, roomName: 'R-G7B', termIndex: 2 },
	];

	// A second heavy day for TEACHER, on THURSDAY, deliberately placed in other
	// sections and other rooms so section 7-A and room R-G7A are entirely free
	// there. This is what makes a NET-WARNING-CHANGING move possible: the source
	// auto-fix relocates A into a day TEACHER already teaches, so moving A off
	// Monday drops Monday 405 -> 360 and removes its
	// FACULTY_DAILY_STANDARD_EXCEEDED without inventing a brand-new teaching day
	// (which would trade one warning for two and hide the effect).
	const loadedThursday: EntrySeed[] = [
		{ entryId: 'T-01', day: 'THURSDAY', startTime: '08:15', endTime: '09:00', sectionExternalId: G9_A, subjectCode: 'FILER', facultyExternalId: TEACHER, roomName: 'R-G7B', termIndex: 2 },
		{ entryId: 'T-02', day: 'THURSDAY', startTime: '09:15', endTime: '10:00', sectionExternalId: G9_A, subjectCode: 'FILER', facultyExternalId: TEACHER, roomName: 'R-G7B', termIndex: 2 },
		{ entryId: 'T-03', day: 'THURSDAY', startTime: '10:00', endTime: '10:45', sectionExternalId: G9_A, subjectCode: 'FILER', facultyExternalId: TEACHER, roomName: 'R-G7B', termIndex: 2 },
	];

	// Holds B's OWN teacher at A's slot, so the DIRECT swap is hard-blocked
	// (it would park ESP into a slot its own teacher already teaches) and the
	// blocker is exactly what an auto-fix has to relieve. It is placed in R-G9A
	// so it never competes with the pair for a room.
	const loadedBlocker: EntrySeed = { entryId: 'L-BLOCKER', day: 'MONDAY', startTime: '07:30', endTime: '08:15', sectionExternalId: G9_A, subjectCode: 'FILER', facultyExternalId: OTHER_G7_TEACHER, roomName: 'R-G9A', termIndex: 2 };
	// A Term 2 grade 7 slot on another day, so an auto-fix has somewhere legal
	// to put the session it relocates.
	const loadedTarget: EntrySeed = { entryId: 'L-TARGET', day: 'WEDNESDAY', startTime: '07:30', endTime: '08:15', sectionExternalId: G7_A, subjectCode: 'FILER', facultyExternalId: G9_TEACHER, roomName: 'R-G9A', termIndex: 2 };

	// No blocker: the swap needs no auto-fix, so the day totals cannot move.
	const loadedDirectRun = await createRun([...loadedMonday, ...loadedThursday, loadedTarget]);
	// With the blocker: the DIRECT swap is hard-blocked, so an auto-fix must run.
	const loadedBlockingRun = await createRun([...loadedMonday, ...loadedThursday, loadedBlocker, loadedTarget]);

	// Every run is seeded with its REAL validation, so the pre-swap warning
	// count is read from the database exactly as the product reads it, not
	// assumed from a hand-written expectation. A run left with `violations: []`
	// would make stage 1 read 0 and quietly turn this whole file vacuous.
	const { loadRunContext, buildValidatorCtx, computeSummary, mergePreservedSummaryFields } = await import('../services/manual-edit.service.js');
	const { validateHardConstraints } = await import('../services/constraint-validator.js');
	for (const runId of [directRun, blockingRun, sourceRun, loadedDirectRun, loadedBlockingRun]) {
		const refData = await loadRunContext(runId, schoolId, schoolYearId);
		const validation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, runId, refData.entries, refData));
		const existing = await prisma.generationRun.findUnique({ where: { id: runId } });
		await prisma.generationRun.update({
			where: { id: runId },
			data: {
				violations: validation.violations as unknown as object[],
				summary: mergePreservedSummaryFields(existing.summary, computeSummary(refData.entries, refData.unassignedItems, validation)) as object,
			},
		});
	}

	return {
		schoolId, schoolYearId,
		directRun, blockingRun, sourceRun,
		loadedDirectRun, loadedBlockingRun,
	};
}

/**
 * Commit one swap on a pristine run, revert it, and report the whole story.
 * Returns the enumeration; the caller asserts on it.
 */
async function enumerate(runId: number, label: string) {
	const { schoolId, schoolYearId } = fixture;

	const before = await slotMap(runId);
	const softBefore = await softCount(runId);
	const hardBeforeCount = await hardCount(runId);

	const preview = await service.previewManualSwapEntries(runId, schoolId, schoolYearId, ENTRY_A, ENTRY_B);
	const strategy: string = preview.recommendedStrategy;
	const target = strategy === 'AUTO_FIX_MOVE_BLOCKING'
		? preview.autoFixBlockingTarget
		: strategy === 'AUTO_FIX_MOVE_SOURCE'
			? preview.autoFixSourceTarget
			: null;

	const versionBeforeCommit = await runVersion(runId);
	const commit = await service.swapManualEntries(
		runId, schoolId, schoolYearId, 1, ENTRY_A, ENTRY_B, versionBeforeCommit, strategy, target,
	);

	const afterCommit = await slotMap(runId);
	const mutatedByCommit = mutatedBetween(before, afterCommit);
	const softAfterCommit = await softCount(runId);
	const hardAfterCommit = await hardCount(runId);

	const swapRow = (await editRows(runId)).find((row: any) => row.editType === 'SWAP_ENTRIES');
	assert.ok(swapRow, 'the commit recorded a SWAP_ENTRIES row');

	// The set of entries the recorded payload NAMES. Deliberately derived from
	// the stored JSON rather than from the code that wrote it, so it is a real
	// coverage measurement and not a restatement of the writer's intent.
	const payloadNames = new Set<string>();
	for (const key of ['entryId', 'entryIdA', 'entryIdB']) {
		const value = (swapRow.beforePayload as any)?.[key] ?? (swapRow.afterPayload as any)?.[key];
		if (typeof value === 'string') payloadNames.add(value);
	}
	for (const key of ['entryA', 'entryB', 'entryC', 'entries', 'mutatedEntries']) {
		const value = (swapRow.afterPayload as any)?.[key];
		if (value && typeof value === 'object' && typeof value.entryId === 'string') payloadNames.add(value.entryId);
		if (Array.isArray(value)) {
			for (const item of value) if (typeof item?.entryId === 'string') payloadNames.add(item.entryId);
		}
	}
	const namedSet = [...payloadNames].sort();
	const uncovered = mutatedByCommit.filter((id) => !payloadNames.has(id));

	const versionBeforeRevert = await runVersion(runId);
	const revert = await service.revertLastEdit(runId, schoolId, schoolYearId, 1, swapRow.id, versionBeforeRevert);

	const afterRevert = await slotMap(runId);
	const changedByRevert = mutatedBetween(afterCommit, afterRevert);
	const residual = mutatedBetween(before, afterRevert);
	const softAfterRevert = await softCount(runId);
	const hardAfterRevert = await hardCount(runId);

	console.log(
		`\n[A2-ENUM ${label}] strategy=${strategy} autoFixTarget=${target ? `${target.day}|${target.startTime}|${target.endTime}` : 'none'}\n`
		+ `  stage 1 pre-swap   hard=${hardBeforeCount} soft=${softBefore}\n`
		+ `  stage 2 committed  hard=${hardAfterCommit} soft=${softAfterCommit}  (service reported softAfter=${commit.violationDelta.softAfter})\n`
		+ `  stage 3 reverted   hard=${hardAfterRevert} soft=${softAfterRevert}  (service reported softAfter=${revert.violationDelta.softAfter})\n`
		+ `  MUTATED BY COMMIT (${mutatedByCommit.length}): ${JSON.stringify(mutatedByCommit)}\n`
		+ `  PAYLOAD NAMES    (${namedSet.length}): ${JSON.stringify(namedSet)}\n`
		+ `  MUTATED BUT NOT NAMED: ${JSON.stringify(uncovered)}\n`
		+ `  CHANGED BY REVERT (${changedByRevert.length}): ${JSON.stringify(changedByRevert)}\n`
		+ `  RESIDUAL vs PRE-SWAP (${residual.length}): ${JSON.stringify(residual)}\n`
		+ `  beforePayload keys: ${JSON.stringify(Object.keys(swapRow.beforePayload as any).sort())}\n`
		+ `  afterPayload  keys: ${JSON.stringify(Object.keys(swapRow.afterPayload as any).sort())}\n`
		+ `  auto-fix options offered: blocking=${preview.autoFixBlockingTarget ? `${preview.autoFixBlockingTarget.day}|${preview.autoFixBlockingTarget.startTime}|${preview.autoFixBlockingTarget.endTime} soft=${preview.autoFixBlockingPreview.softViolations.length}` : 'none'}`
		+ ` source=${preview.autoFixSourceTarget ? `${preview.autoFixSourceTarget.day}|${preview.autoFixSourceTarget.startTime}|${preview.autoFixSourceTarget.endTime} soft=${preview.autoFixSourcePreview.softViolations.length}` : 'none'}`
		+ ` directHard=${preview.direct.hardViolations.length} directSoft=${preview.direct.softViolations.length}`,
	);

	return {
		strategy, target, swapRow,
		before, afterCommit, afterRevert,
		mutatedByCommit, namedSet, uncovered,
		changedByRevert, residual,
		softBefore, softAfterCommit, softAfterRevert,
		hardBeforeCount, hardAfterCommit, hardAfterRevert,
	};
}

// ────────────────────────────────────────────────────────────────────────────
// E1 — the enumeration itself, for each of the three strategies
// ────────────────────────────────────────────────────────────────────────────

test('E1-DIRECT: the enumeration, the payload coverage, and the round trip', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const result = await enumerate(fixture.directRun, 'DIRECT');
	assert.equal(result.strategy, 'DIRECT_SWAP', 'the pair needed no auto-fix');
});

test('E1-BLOCKING: the enumeration, the payload coverage, and the round trip', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const result = await enumerate(fixture.blockingRun, 'BLOCKING');
	assert.equal(result.strategy, 'AUTO_FIX_MOVE_BLOCKING', 'the blocker forced the blocking auto-fix');
});

test('E1-SOURCE: the enumeration, the payload coverage, and the round trip', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const result = await enumerate(fixture.sourceRun, 'SOURCE');
	assert.equal(result.strategy, 'AUTO_FIX_MOVE_SOURCE', 'the cross-term room forced the source auto-fix');
});

// ────────────────────────────────────────────────────────────────────────────
// E2 — the LOADED family: the enumeration AND the recomputed warning counts.
//
// The live symptom is a warning count that does not come back (159 -> 68 ->
// 69). Warnings are per-faculty-per-DAY aggregates, so these rows are the only
// ones that can reproduce a count that moves. Each asserts the full contract:
// payload coverage, an exact slot round trip, AND the count returning.
// ────────────────────────────────────────────────────────────────────────────

test('E2-DIRECT-LOADED: a swap that does not move a session between days round trips', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const result = await enumerate(fixture.loadedDirectRun, 'DIRECT-LOADED');
	assert.equal(result.strategy, 'DIRECT_SWAP');
	assert.ok(result.softBefore > 0, `precondition: the loaded fixture actually scores soft warnings (got ${result.softBefore})`);
	assert.deepEqual(result.uncovered, [], 'the payload names every entry the commit mutated');
	assert.deepEqual(result.residual, [], 'every mutated entry is back at its pre-swap slot');
	assert.equal(result.softAfterRevert, result.softBefore, `the recomputed warning count returns (${result.softBefore} -> ${result.softAfterCommit} -> ${result.softAfterRevert})`);
});

test('E2-BLOCKING-LOADED: a forced auto-fix round trips the entry set AND the warning count', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const result = await enumerate(fixture.loadedBlockingRun, 'BLOCKING-LOADED');
	assert.ok(result.softBefore > 0, `precondition: the loaded fixture actually scores soft warnings (got ${result.softBefore})`);
	assert.notEqual(result.strategy, 'DIRECT_SWAP', 'the blocker means an auto-fix was required');
	assert.deepEqual(result.uncovered, [], 'the payload names every entry the commit mutated');
	assert.deepEqual(result.residual, [], 'every mutated entry is back at its pre-swap slot');
	assert.equal(result.softAfterRevert, result.softBefore, `the recomputed warning count returns (${result.softBefore} -> ${result.softAfterCommit} -> ${result.softAfterRevert})`);
});

// ────────────────────────────────────────────────────────────────────────────

test('Z: nothing was written to the configured (non-disposable) database', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, () => {	const sourceDb = decodeURIComponent(harness!.source.pathname.replace(/^\//, ''));
	const sql = (query: string): string => psql(
		['-h', harness!.source.hostname, '-p', harness!.source.port || '5432', '-U', decodeURIComponent(harness!.source.username), '-d', sourceDb, '-tAc', query],
		harness!.adminEnv,
	);
	assert.equal(sql(`SELECT count(*) FROM schools WHERE "shortName" = '${FIXTURE_TAG}'`), '0', `ZERO WRITE: no fixture school row in the configured database ${sourceDb}`);
	assert.equal(sql(`SELECT count(*) FROM generation_runs gr JOIN schools s ON s.id = gr.school_id WHERE s."shortName" = '${FIXTURE_TAG}'`), '0', 'ZERO WRITE: no generation run in the configured database');
	assert.equal(sql(`SELECT count(*) FROM manual_schedule_edits mse JOIN schools s ON s.id = mse.school_id WHERE s."shortName" = '${FIXTURE_TAG}'`), '0', 'ZERO WRITE: no manual schedule edit in the configured database');
});
