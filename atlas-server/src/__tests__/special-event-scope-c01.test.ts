/**
 * SPECIAL-EVENT-SCOPE-C01 (plan D8) — additive break-window scope.
 *
 * The published `specialEvents[]` array is a flattened union of every
 * grade/shift group's break windows. Before this change a companion could not
 * tell which window belonged to which grade/shift. This suite proves the
 * ADDITIVE contract:
 *
 *   1. every emitted window carries `scope { appliesToAll, gradeLevels,
 *      programTypes, shift }`, accumulated as a SET across the collapsed union —
 *      ONE row per distinct window, never one row per grade;
 *   2. `source.shiftWindows[]` mirrors the school `grade_shift_windows` map;
 *   3. a genuinely school-wide window (the policy Flag/HGP overlay) reports
 *      `appliesToAll: true` with empty arrays;
 *   4. the row COUNT is unchanged and every existing field keeps its value — a
 *      consumer that ignores `scope` sees exactly what it saw before;
 *   5. a scope that cannot be derived reports `appliesToAll:false` with empty
 *      arrays plus the typed `SCOPE_NOT_DERIVABLE` note (never fabricated).
 *
 * The DB fixture is produced by the REAL producer (`seedCanonicalFixture` /
 * `seedClassProgramSlots`) inside a GUARDED DISPOSABLE PostgreSQL database, then
 * published and read through the REAL published-read path. The pure controls use
 * the same exported authorities with no database.
 *
 * Run: `npx tsx src/__tests__/special-event-scope-c01.test.ts` (from atlas-server).
 * Skips the DB controls (EXTERNALLY_BLOCKED) when no disposable harness exists.
 */

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import {
	provisionDisposableDatabase,
	seedCanonicalFixture,
	teardownCanonicalFixture,
	isDisposableHarnessAvailable,
	readSourceDatabaseUrl,
	type DisposableDatabase,
	type CanonicalFixture,
} from './helpers/tt-source-freshness-db.js';

process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'special-event-scope-c01-secret';

const RUNNABLE = isDisposableHarnessAvailable();
const SKIP = RUNNABLE ? false : 'EXTERNALLY_BLOCKED(DISPOSABLE_DB_UNAVAILABLE)';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

const MORNING = { startTime: '06:00', endTime: '15:30' };
const AFTERNOON = { startTime: '09:45', endTime: '18:30' };
const ALL_PROGRAMS = ['REGULAR', 'SPA', 'SPS', 'STE'];

let harness: DisposableDatabase | null = null;
let prisma: any = null;
let fixture: CanonicalFixture;

let withDataContext: any;
let publishSchedule: any;
let computeGenerationInputSnapshot: any;
let getPublishedSchedulePayload: any;
let resolveSpecialEventScope: any;
let buildCanonicalDisplayGrid: any;

async function readPublished() {
	return withDataContext(prisma, () => getPublishedSchedulePayload(fixture.schoolId, fixture.schoolYearId));
}

before(async () => {
	// Bind DATABASE_URL before ANY service import constructs the Prisma singleton.
	if (RUNNABLE) {
		harness = provisionDisposableDatabase('s5');
		if (harness) process.env.DATABASE_URL = harness.targetUrl;
	}
	if (!process.env.DATABASE_URL) {
		process.env.DATABASE_URL = readSourceDatabaseUrl() ?? 'postgresql://localhost:5432/atlas_unused';
	}

	const constructor = await import('../services/schedule-constructor.js');
	resolveSpecialEventScope = constructor.resolveSpecialEventScope;
	buildCanonicalDisplayGrid = constructor.buildCanonicalDisplayGrid;

	if (!RUNNABLE || !harness) return;

	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });

	fixture = await seedCanonicalFixture(prisma, { schoolYearId: 9_500_101, sectionExternalId: 9_501 });

	const { seedClassProgramSlots } = await import('../services/class-program-slot.service.js');
	// Real producer: seed every remaining grade/program scope.
	await seedClassProgramSlots(fixture.schoolId, fixture.schoolYearId);

	// The school grade-to-shift map (live: 7/8 morning, 9/10 afternoon).
	await prisma.gradeShiftWindow.createMany({
		data: [
			{ schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, gradeLevel: 7, programType: null, startTime: MORNING.startTime, endTime: MORNING.endTime },
			{ schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, gradeLevel: 8, programType: null, startTime: MORNING.startTime, endTime: MORNING.endTime },
			{ schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, gradeLevel: 9, programType: null, startTime: AFTERNOON.startTime, endTime: AFTERNOON.endTime },
			{ schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, gradeLevel: 10, programType: null, startTime: AFTERNOON.startTime, endTime: AFTERNOON.endTime },
		],
	});

	// The persisted policy carries the RETIRED 11:55-12:55 lunch window; the
	// canonical grid must supersede it (and its scope must never leak into the
	// payload). The Flag/HGP row is school-wide.
	await prisma.schedulingPolicy.update({
		where: { schoolId_schoolYearId: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId } },
		data: {
			lunchStartTime: '11:55',
			lunchEndTime: '12:55',
			enableLunchWindow: true,
			enforceLunchWindow: true,
			enableRecess: true,
			recessStartTime: '09:45',
			recessEndTime: '10:00',
			enableFlagCeremony: true,
			flagCeremonyStartTime: '07:00',
			flagCeremonyEndTime: '07:30',
			showSpecialEventsInGrid: true,
		},
	});
	await prisma.policySpecialEvent.createMany({
		data: [{ schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony / HGP', startTime: '07:00', endTime: '07:30', gradeGroup: null, programType: null, enabled: true, sortOrder: 1 }],
	});

	withDataContext = (await import('../lib/data-context.js')).withDataContext;
	publishSchedule = (await import('../services/publication-contract.service.js')).publishSchedule;
	computeGenerationInputSnapshot = (await import('../services/generation-input-snapshot.service.js')).computeGenerationInputSnapshot;
	getPublishedSchedulePayload = (await import('../services/published-schedule.service.js')).getPublishedSchedulePayload;

	const firstClassSlot = await prisma.classProgramSlot.findFirst({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, gradeLevel: 7, programType: 'REGULAR', rowKind: 'CLASS', isActive: true },
		orderBy: { startTime: 'asc' },
		select: { startTime: true, endTime: true },
	});
	const [startTime, endTime] = `${firstClassSlot.startTime}-${firstClassSlot.endTime}`.split('-');
	const draftEntries = [1, 2, 3].flatMap((termIndex) => DAYS.map((day) => ({
		entryId: `MATH-T${termIndex}-${day}`,
		subjectId: fixture.subjectIdByCode.MATH,
		facultyId: fixture.facultyId,
		roomId: fixture.roomId,
		sectionId: fixture.sectionExternalId,
		day,
		startTime,
		endTime,
		durationMinutes: 45,
		termIndex,
		entryKind: 'SECTION',
	})));

	await prisma.teacherProgramPresentationRevision.create({
		data: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, revision: 1, schoolHeadName: 'Frozen Head', createdBy: 1, createdAt: new Date(Date.now() - 86_400_000) },
	});

	const inputSnapshot = await computeGenerationInputSnapshot(fixture.schoolId, fixture.schoolYearId, prisma);
	const run = await prisma.generationRun.create({
		data: {
			schoolId: fixture.schoolId,
			schoolYearId: fixture.schoolYearId,
			status: 'COMPLETED',
			runType: 'FULL',
			triggeredBy: 1,
			finishedAt: new Date(),
			summary: { inputSnapshot },
			violations: [],
			unassignedItems: [],
			draftEntries,
			version: 1,
		},
	});
	await withDataContext(prisma, () => publishSchedule(
		{ schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, runId: run.id, actorId: 1, actorSchoolId: fixture.schoolId },
		{ now: () => new Date(), computeInputSnapshot: async () => inputSnapshot, publishEvent: () => undefined },
	));
});

after(async () => {
	if (prisma) {
		if (fixture) {
			await prisma.gradeShiftWindow.deleteMany({ where: { schoolId: fixture.schoolId } }).catch(() => undefined);
			await teardownCanonicalFixture(prisma, fixture.schoolId).catch(() => undefined);
		}
		await prisma.$disconnect().catch(() => undefined);
	}
	harness?.drop();
});

// ─── Pure controls (no database) ────────────────────────────────────────────

test('C01 pure: a shared window accumulates the owning grade SET, one row per distinct window', () => {
	// Grade 7 and grade 9 both break 11:30-12:15; only grade 9 breaks 12:15-13:00.
	const rows = [
		{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '06:45', rowKind: 'CLASS', subjectLabel: 'Class' },
		{ gradeLevel: 7, programType: 'REGULAR', startTime: '11:30', endTime: '12:15', rowKind: 'BREAK', subjectLabel: 'Lunch Break' },
		{ gradeLevel: 9, programType: 'REGULAR', startTime: '09:45', endTime: '10:30', rowKind: 'CLASS', subjectLabel: 'Class' },
		{ gradeLevel: 9, programType: 'REGULAR', startTime: '11:30', endTime: '12:15', rowKind: 'BREAK', subjectLabel: 'Lunch Break' },
		{ gradeLevel: 9, programType: 'REGULAR', startTime: '12:15', endTime: '13:00', rowKind: 'BREAK', subjectLabel: 'Lunch Break' },
	];
	const grid = buildCanonicalDisplayGrid({ rows: rows as never });
	const intervals = grid.specialEventSlots.map((slot: any) => `${slot.startTime}-${slot.endTime}`).sort();
	assert.deepEqual(intervals, ['11:30-12:15', '12:15-13:00'], 'one row per DISTINCT window (not one per grade)');
	assert.equal(grid.specialEventWindowScopes.length, grid.specialEventSlots.length, 'scope list is index-aligned with the slots');
	const shared = grid.specialEventSlots.findIndex((slot: any) => slot.startTime === '11:30');
	assert.deepEqual(grid.specialEventWindowScopes[shared].gradeLevels, [7, 9], 'the shared window accumulates BOTH owning grades (a first-slot-only scope would be [7])');
	assert.deepEqual(grid.specialEventWindowScopes[shared].programTypes, ['REGULAR']);
	const onlyNine = grid.specialEventSlots.findIndex((slot: any) => slot.startTime === '12:15');
	assert.deepEqual(grid.specialEventWindowScopes[onlyNine].gradeLevels, [9]);
});

test('C01 pure: a scoped window resolves its shift; a spanning scope reports no shift', () => {
	const shiftWindows = [
		{ gradeLevel: 7, programType: null, startTime: MORNING.startTime, endTime: MORNING.endTime },
		{ gradeLevel: 8, programType: null, startTime: MORNING.startTime, endTime: MORNING.endTime },
		{ gradeLevel: 9, programType: null, startTime: AFTERNOON.startTime, endTime: AFTERNOON.endTime },
	];
	const morningScope = { appliesToAll: false, gradeLevels: [7, 8], programTypes: ['REGULAR'] };
	const lunch = resolveSpecialEventScope(morningScope, { startTime: '12:15', endTime: '13:00' }, shiftWindows);
	assert.equal(lunch.appliesToAll, false);
	assert.deepEqual(lunch.gradeLevels, [7, 8]);
	assert.deepEqual(lunch.shift, { label: null, ...MORNING }, 'a single distinct shift across the owning grades is emitted');

	const spanning = resolveSpecialEventScope({ appliesToAll: false, gradeLevels: [7, 9], programTypes: [] }, { startTime: '11:30', endTime: '12:15' }, shiftWindows);
	assert.equal(spanning.shift, null, 'a scope spanning two shifts must not guess one');
});

test('C01 pure: a school-wide window takes the single containing shift, never a guess', () => {
	const shiftWindows = [
		{ gradeLevel: 7, programType: null, startTime: MORNING.startTime, endTime: MORNING.endTime },
		{ gradeLevel: 9, programType: null, startTime: AFTERNOON.startTime, endTime: AFTERNOON.endTime },
	];
	const flag = resolveSpecialEventScope({ appliesToAll: true, gradeLevels: [], programTypes: [] }, { startTime: '06:45', endTime: '07:30' }, shiftWindows);
	assert.equal(flag.appliesToAll, true);
	assert.deepEqual(flag.gradeLevels, []);
	assert.deepEqual(flag.programTypes, []);
	assert.deepEqual(flag.shift, { label: null, ...MORNING }, 'the Flag/HGP window is contained only by the morning shift');

	// A window contained by NO shift, or by more than one, is not guessed.
	assert.equal(resolveSpecialEventScope({ appliesToAll: true, gradeLevels: [], programTypes: [] }, { startTime: '11:30', endTime: '12:15' }, shiftWindows).shift, null, 'two containing shifts -> null');
	assert.equal(resolveSpecialEventScope({ appliesToAll: true, gradeLevels: [], programTypes: [] }, { startTime: '20:00', endTime: '21:00' }, shiftWindows).shift, null, 'no containing shift -> null');
});

test('C01 pure: an underivable scope is typed, never fabricated', () => {
	const note = resolveSpecialEventScope(undefined, { startTime: '11:30', endTime: '12:15' }, []);
	assert.deepEqual(note, { appliesToAll: false, gradeLevels: [], programTypes: [], shift: null, note: 'SCOPE_NOT_DERIVABLE' });
	const empty = resolveSpecialEventScope({ appliesToAll: false, gradeLevels: [], programTypes: [] }, { startTime: '11:30', endTime: '12:15' }, []);
	assert.equal(empty.note, 'SCOPE_NOT_DERIVABLE');
	assert.equal(empty.appliesToAll, false);
});

// ─── Real published-read controls (disposable PostgreSQL) ───────────────────

test('C01 DB: each emitted window carries the correct scope.gradeLevels and scope.shift', { skip: SKIP }, async () => {
	const payload = await readPublished();
	const byWindow = new Map<string, any>(payload.specialEvents.map((event: any) => [`${event.startTime}-${event.endTime}`, event]));

	const g7Lunch = byWindow.get('12:15-13:00');
	assert.ok(g7Lunch, 'the G7/8 lunch window is present');
	assert.deepEqual(g7Lunch.scope.gradeLevels, [7, 8]);
	assert.deepEqual(g7Lunch.scope.programTypes, ALL_PROGRAMS);
	assert.deepEqual(g7Lunch.scope.shift, { label: null, ...MORNING });

	const g9Lunch = byWindow.get('11:30-12:15');
	assert.ok(g9Lunch, 'the G9/10 lunch window is present');
	assert.deepEqual(g9Lunch.scope.gradeLevels, [9, 10]);
	assert.deepEqual(g9Lunch.scope.shift, { label: null, ...AFTERNOON });

	const g7Health = byWindow.get('09:00-09:15');
	assert.deepEqual(g7Health.scope.gradeLevels, [7, 8]);
	assert.deepEqual(g7Health.scope.shift, { label: null, ...MORNING });

	const g9Health = byWindow.get('15:15-15:30');
	assert.deepEqual(g9Health.scope.gradeLevels, [9, 10]);
	assert.deepEqual(g9Health.scope.shift, { label: null, ...AFTERNOON });

	assert.notDeepEqual(g7Lunch.scope.gradeLevels, g9Lunch.scope.gradeLevels, 'the two Lunch Break windows are genuinely attributed, not copied');
});

test('C01 DB: the school-wide Flag/HGP window reports appliesToAll with empty arrays', { skip: SKIP }, async () => {
	const payload = await readPublished();
	const flag = payload.specialEvents.find((event: any) => /FLAG|HGP/i.test(event.eventName));
	assert.ok(flag, 'the Flag/HGP overlay is present');
	assert.equal(flag.scope.appliesToAll, true);
	assert.deepEqual(flag.scope.gradeLevels, []);
	assert.deepEqual(flag.scope.programTypes, []);
	assert.deepEqual(flag.scope.shift, { label: null, ...MORNING });
});

test('C01 DB: row count and every existing field are unchanged (a scope-ignoring consumer sees today)', { skip: SKIP }, async () => {
	const payload = await readPublished();
	assert.equal(payload.specialEvents.length, 5, 'the special-event cardinality is unchanged');
	assert.equal(payload.specialEvents.filter((event: any) => event.eventName === 'Lunch Break').length, 2, 'exactly two Lunch Break windows (not one per grade)');
	assert.equal(payload.specialEvents.filter((event: any) => event.eventName === 'Health Break').length, 2, 'exactly two Health Break windows');

	// Strip the additive `scope` and prove the legacy projection is byte-identical.
	const legacy = payload.specialEvents.map(({ scope, ...rest }: any) => rest);
	assert.deepEqual(legacy, [
		{ eventName: 'Flag Ceremony / HGP', startTime: '06:45', endTime: '07:30', dayOfWeek: 'MONDAY', days: ['MONDAY'] },
		{ eventName: 'Health Break', startTime: '09:00', endTime: '09:15', dayOfWeek: null, days: [...DAYS] },
		{ eventName: 'Lunch Break', startTime: '11:30', endTime: '12:15', dayOfWeek: null, days: [...DAYS] },
		{ eventName: 'Lunch Break', startTime: '12:15', endTime: '13:00', dayOfWeek: null, days: [...DAYS] },
		{ eventName: 'Health Break', startTime: '15:15', endTime: '15:30', dayOfWeek: null, days: [...DAYS] },
	]);
});

test('C01 DB: source.shiftWindows mirrors the persisted grade_shift_windows map', { skip: SKIP }, async () => {
	const payload = await readPublished();
	const rows = await prisma.gradeShiftWindow.findMany({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId },
		orderBy: [{ gradeLevel: 'asc' }, { programType: 'asc' }],
		select: { gradeLevel: true, programType: true, startTime: true, endTime: true },
	});
	const expected = rows.map((row: any) => ({ gradeLevel: row.gradeLevel, programType: row.programType ?? null, startTime: row.startTime, endTime: row.endTime }));
	assert.deepEqual(payload.source.shiftWindows, expected, 'source.shiftWindows is the school grade-to-shift map');
	assert.deepEqual(payload.source.shiftWindows, [
		{ gradeLevel: 7, programType: null, ...MORNING },
		{ gradeLevel: 8, programType: null, ...MORNING },
		{ gradeLevel: 9, programType: null, ...AFTERNOON },
		{ gradeLevel: 10, programType: null, ...AFTERNOON },
	]);
});
