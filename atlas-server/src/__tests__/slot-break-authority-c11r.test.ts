/**
 * SLOT-BREAK-AUTHORITY-C11R — the canonical `classProgramSlot` grid is the
 * DISPLAY authority too.
 *
 * `SLOT-BREAK-AUTHORITY-C11` made the VALIDATION authority canonical. This suite
 * proves the DISPLAY surfaces were migrated with it: when canonical
 * `classProgramSlot` rows exist for a `(gradeLevel, programType)` scope, they
 * define the displayed period grid, break bands, and shift bounds, and the
 * retired policy lunch window (11:55-12:55) is never rendered.
 *
 * The fixture is produced by the REAL producer (`seedCanonicalFixture` /
 * `seedClassProgramSlots` / `getExpectedCanonicalSlots`,
 * `CANONICAL_TEMPLATE_VERSION`) inside a GUARDED DISPOSABLE PostgreSQL database
 * plus a persisted policy row carrying the legacy 11:55-12:55 lunch window. No
 * grid row in this file is hand-written.
 *
 * Controls:
 *   1. G7-8 scope with canonical rows -> display bands carry Health 09:00-09:15
 *      and Lunch 12:15-13:00
 *   2. G9-10 scope with canonical rows -> display bands carry Lunch 12:15-13:00
 *      and Health 15:15-15:30
 *   3. any canonical scope -> 11:55 / 12:55 appear NOWHERE in the built slots
 *   4. shift bounds come from the canonical CLASS grid, not policy start/end
 *   5. display break set == the C11 validator break-window set for the scope
 *   6. a scope with NO canonical rows keeps the policy fallback unchanged
 *   7. published immutability: the frozen artifact renders the frozen slots even
 *      after the LIVE grid changes (real publication + real read path)
 *   8. the public/published read renders canonical-derived frozen slots and
 *      never the retired window
 *   9. missing policy + canonical rows present -> no silent retired-window
 *      fallback; the grid still comes from the canonical slots
 *  10. MUTANT (run manually, not committed): restoring the policy/hardcoded-only
 *      display path must fail controls 1-5
 *
 * Run: `npx tsx src/__tests__/slot-break-authority-c11r.test.ts`
 * Skips (EXTERNALLY_BLOCKED) when no disposable PostgreSQL harness is available.
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
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'slot-break-authority-c11r-secret';

const RUNNABLE = isDisposableHarnessAvailable();
const SKIP = RUNNABLE ? false : 'EXTERNALLY_BLOCKED(DISPOSABLE_DB_UNAVAILABLE)';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
/** The retired window the canonical grid supersedes. */
const RETIRED_LUNCH = '11:55-12:55';
const CANONICAL_LUNCH = '12:15-13:00';
const G7_HEALTH = '09:00-09:15';
const G9_HEALTH = '15:15-15:30';

let harness: DisposableDatabase | null = null;
let prisma: any = null;
let fixture: CanonicalFixture;
let runId = 0;

let withDataContext: any;
let publishSchedule: any;
let computeGenerationInputSnapshot: any;
let getPublishedSchedulePayload: any;
let readPublishedIdentitySnapshot: any;
let getEffectivePeriodSlots: any;
let buildCanonicalDisplayGrid: any;
let buildPeriodSlots: any;
let buildSpecialEventSlots: any;
let resolveCanonicalWindowAuthorityForScope: any;
let getExpectedCanonicalSlots: any;
let seedClassProgramSlots: any;
let CANONICAL_TEMPLATE_VERSION: string;
let inputSnapshotRef: any;

/** Interval keys of a slot list, order-insensitive. */
function intervals(slots: any[]): string[] {
	return slots.map((slot) => `${slot.startTime}-${slot.endTime}`).sort();
}

function hasInterval(slots: any[], interval: string): boolean {
	return slots.some((slot) => `${slot.startTime}-${slot.endTime}` === interval);
}

/** The persisted canonical rows the DISPLAY path consumes (real DB read). */
async function liveCanonicalRows() {
	return prisma.classProgramSlot.findMany({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, isActive: true },
		select: { gradeLevel: true, programType: true, startTime: true, endTime: true, rowKind: true, subjectLabel: true, dayOfWeek: true },
		orderBy: [{ gradeLevel: 'asc' }, { startTime: 'asc' }],
	});
}

/** The persisted policy projected into the constructor `PolicyInput` shape. */
async function persistedPolicyInput() {
	const row = await prisma.schedulingPolicy.findUnique({
		where: { schoolId_schoolYearId: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId } },
	});
	const flagRows = await prisma.policySpecialEvent.findMany({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, enabled: true },
	});
	return {
		maxConsecutiveTeachingMinutesBeforeBreak: row.maxConsecutiveTeachingMinutesBeforeBreak,
		minBreakMinutesAfterConsecutiveBlock: row.minBreakMinutesAfterConsecutiveBlock,
		maxTeachingMinutesPerDay: row.maxTeachingMinutesPerDay,
		earliestStartTime: row.earliestStartTime,
		latestEndTime: row.latestEndTime,
		lunchStartTime: row.lunchStartTime,
		lunchEndTime: row.lunchEndTime,
		enableLunchWindow: row.enableLunchWindow,
		enforceLunchWindow: row.enforceLunchWindow,
		enableFlagCeremony: row.enableFlagCeremony,
		flagCeremonyStartTime: row.flagCeremonyStartTime,
		flagCeremonyEndTime: row.flagCeremonyEndTime,
		enableRecess: row.enableRecess,
		recessStartTime: row.recessStartTime,
		recessEndTime: row.recessEndTime,
		showSpecialEventsInGrid: row.showSpecialEventsInGrid,
		specialEvents: flagRows.map((se: any) => ({
			eventType: se.eventType,
			label: se.label,
			startTime: se.startTime,
			endTime: se.endTime,
			dayOfWeek: null,
			gradeGroup: se.gradeGroup,
			programType: se.programType,
		})),
	};
}

async function readPublished() {
	return withDataContext(prisma, () => getPublishedSchedulePayload(fixture.schoolId, fixture.schoolYearId));
}

before(async () => {
	if (!RUNNABLE) return;
	harness = provisionDisposableDatabase('c11r');
	if (!harness) return;
	// MUST precede the first import of ../lib/prisma.js.
	process.env.DATABASE_URL = harness.targetUrl;

	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });

	fixture = await seedCanonicalFixture(prisma, { schoolYearId: 9_200_101, sectionExternalId: 9_201 });

	const slotsService = await import('../services/class-program-slot.service.js');
	getExpectedCanonicalSlots = slotsService.getExpectedCanonicalSlots;
	seedClassProgramSlots = slotsService.seedClassProgramSlots;
	CANONICAL_TEMPLATE_VERSION = slotsService.CANONICAL_TEMPLATE_VERSION;

	// Real producer: seed every remaining grade/program scope (only missing
	// groups are written; the fixture's G7 REGULAR group already exists).
	await seedClassProgramSlots(fixture.schoolId, fixture.schoolYearId);

	// The persisted policy carries the RETIRED 11:55-12:55 lunch window, so a
	// display that still derives from policy would render it.
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
	// The Monday Flag/HGP overlay is policy-row owned; it must be backed by a
	// persisted event row for the frozen-artifact consistency gate.
	await prisma.policySpecialEvent.createMany({
		data: [{ schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony / HGP', startTime: '07:00', endTime: '07:30', gradeGroup: null, programType: null, enabled: true, sortOrder: 1 }],
	});

	withDataContext = (await import('../lib/data-context.js')).withDataContext;
	publishSchedule = (await import('../services/publication-contract.service.js')).publishSchedule;
	computeGenerationInputSnapshot = (await import('../services/generation-input-snapshot.service.js')).computeGenerationInputSnapshot;
	getPublishedSchedulePayload = (await import('../services/published-schedule.service.js')).getPublishedSchedulePayload;
	readPublishedIdentitySnapshot = (await import('../services/published-identity-snapshot.service.js')).readPublishedIdentitySnapshot;
	getEffectivePeriodSlots = (await import('../services/locked-session.service.js')).getEffectivePeriodSlots;
	const constructor = await import('../services/schedule-constructor.js');
	buildCanonicalDisplayGrid = constructor.buildCanonicalDisplayGrid;
	buildPeriodSlots = constructor.buildPeriodSlots;
	buildSpecialEventSlots = constructor.buildSpecialEventSlots;
	const windowAuthority = await import('../services/warning-window-authority.service.js');
	resolveCanonicalWindowAuthorityForScope = windowAuthority.resolveCanonicalWindowAuthorityForScope;

	// ── Real publication fixture ──
	// The run summary deliberately carries NO persisted `timetableDisplaySlots`
	// (a legacy run shape), so the publication must FREEZE canonical-derived slots
	// through the display path itself.
	const firstClassSlot = await prisma.classProgramSlot.findFirst({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, gradeLevel: 7, programType: 'REGULAR', rowKind: 'CLASS', isActive: true },
		orderBy: { startTime: 'asc' },
		select: { startTime: true, endTime: true },
	});
	const classInterval = `${firstClassSlot.startTime}-${firstClassSlot.endTime}`;
	const [startTime, endTime] = classInterval.split('-');
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

	// Signatory revision effective at publication time (the frozen published
	// program must keep rendering it after later edits).
	await prisma.teacherProgramPresentationRevision.create({
		data: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, revision: 1, schoolHeadName: 'Frozen Head', createdBy: 1, createdAt: new Date(Date.now() - 86_400_000) },
	});

	const inputSnapshot = await computeGenerationInputSnapshot(fixture.schoolId, fixture.schoolYearId, prisma);
	inputSnapshotRef = inputSnapshot;
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
	runId = run.id;
});

after(async () => {
	if (!RUNNABLE) return;
	if (prisma) {
		if (fixture) await teardownCanonicalFixture(prisma, fixture.schoolId).catch(() => undefined);
		await prisma.$disconnect().catch(() => undefined);
	}
	harness?.drop();
	harness?.assertDropped();
});

test('C11R control 1: G7-8 canonical scope displays Health 09:00-09:15 and Lunch 12:15-13:00', { skip: SKIP }, async () => {
	const rows = await liveCanonicalRows();
	const policy = await persistedPolicyInput();
	const grid = buildCanonicalDisplayGrid({ rows, scopes: [{ gradeLevel: 7, programType: 'REGULAR' }], policy });
	assert.equal(grid.hasCanonicalRows, true, 'the G7 REGULAR scope must resolve canonical rows');
	const bands = grid.specialEventSlots;
	assert.equal(hasInterval(bands, G7_HEALTH), true, `G7-8 break bands must carry Health ${G7_HEALTH}`);
	assert.equal(hasInterval(bands, CANONICAL_LUNCH), true, `G7-8 break bands must carry Lunch ${CANONICAL_LUNCH}`);

	// Real production service entry point (locked-session canonical period grid).
	const serviceSlots = await getEffectivePeriodSlots(fixture.schoolId, fixture.schoolYearId, { gradeLevel: 7, programType: 'REGULAR' });
	const expectedClass = getExpectedCanonicalSlots(7, 'REGULAR').filter((slot: any) => slot.rowKind === 'CLASS');
	assert.deepEqual(intervals(serviceSlots), intervals(expectedClass), 'locked-session period slots must equal the canonical CLASS grid');
});

test('C11R control 2: G9-10 canonical scope displays Lunch 12:15-13:00 and Health 15:15-15:30', { skip: SKIP }, async () => {
	const rows = await liveCanonicalRows();
	const policy = await persistedPolicyInput();
	const grid = buildCanonicalDisplayGrid({ rows, scopes: [{ gradeLevel: 9, programType: 'REGULAR' }], policy });
	assert.equal(grid.hasCanonicalRows, true, 'the G9 REGULAR scope must resolve canonical rows');
	assert.equal(hasInterval(grid.specialEventSlots, CANONICAL_LUNCH), true, `G9-10 break bands must carry Lunch ${CANONICAL_LUNCH}`);
	assert.equal(hasInterval(grid.specialEventSlots, G9_HEALTH), true, `G9-10 break bands must carry Health ${G9_HEALTH}`);
	assert.equal(hasInterval(grid.specialEventSlots, G7_HEALTH), false, 'G9-10 must not borrow the G7-8 health window');
});

test('C11R control 3: the retired 11:55-12:55 window appears nowhere in a canonical grid', { skip: SKIP }, async () => {
	const rows = await liveCanonicalRows();
	const policy = await persistedPolicyInput();
	// Both the persisted policy (with the Flag/HGP row) and the policy-row-only
	// shape must be superseded by the canonical grid for a canonical scope.
	const policyOnly = { ...policy, specialEvents: [] };
	for (const scopedPolicy of [policy, policyOnly]) {
		for (const scope of [{ gradeLevel: 7, programType: 'REGULAR' }, { gradeLevel: 10, programType: 'SPA' }]) {
			const grid = buildCanonicalDisplayGrid({ rows, scopes: [scope], policy: scopedPolicy });
			const built = intervals([...grid.periodSlots, ...grid.specialEventSlots, ...grid.displaySlots]);
			assert.equal(built.includes(RETIRED_LUNCH), false, `scope ${scope.gradeLevel}:${scope.programType} must never render ${RETIRED_LUNCH}: ${built.join(', ')}`);
			const text = JSON.stringify(grid);
			assert.equal(text.includes('11:55'), false, 'no built slot may carry 11:55');
			assert.equal(text.includes('12:55'), false, 'no built slot may carry 12:55');
		}
	}
});

test('C11R control 4: shift bounds derive from the canonical CLASS grid, not policy start/end', { skip: SKIP }, async () => {
	const rows = await liveCanonicalRows();
	const policy = await persistedPolicyInput();
	const g7 = buildCanonicalDisplayGrid({ rows, scopes: [{ gradeLevel: 7, programType: 'REGULAR' }], policy });
	assert.deepEqual(g7.shiftWindow, { startTime: '06:00', endTime: '12:15' }, 'G7 shift bounds must be the canonical CLASS min/max');
	assert.notEqual(g7.shiftWindow?.startTime, policy.earliestStartTime, 'shift start must not come from the policy row');

	const g9 = buildCanonicalDisplayGrid({ rows, scopes: [{ gradeLevel: 9, programType: 'REGULAR' }], policy });
	// The G9 canonical grid's 12:15-13:00 row is a BREAK, so the CLASS shift
	// starts at 13:00 (the shift bound excludes break rows, exactly like the C11
	// validator authority's canonical shift window).
	assert.deepEqual(g9.shiftWindow, { startTime: '13:00', endTime: '18:30' }, 'G9 shift bounds must be the canonical CLASS min/max');
	assert.notEqual(g9.shiftWindow?.endTime, policy.latestEndTime, 'shift end must not come from the policy row');
});

test('C11R control 5: display break set equals the C11 validator break-window set for the scope', { skip: SKIP }, async () => {
	const rows = await liveCanonicalRows();
	const policy = await persistedPolicyInput();
	for (const scope of [{ gradeLevel: 7, programType: 'REGULAR' }, { gradeLevel: 9, programType: 'SPA' }]) {
		const grid = buildCanonicalDisplayGrid({ rows, scopes: [scope], policy });
		const validator = resolveCanonicalWindowAuthorityForScope({ rows, gradeLevel: scope.gradeLevel, programType: scope.programType });
		assert.equal(validator.hasCanonicalRows, true, `validator must resolve canonical rows for ${scope.gradeLevel}:${scope.programType}`);
		assert.deepEqual(
			intervals(grid.canonicalBreakSlots),
			intervals(validator.breakWindows),
			`display break bands must equal the validator break windows for ${scope.gradeLevel}:${scope.programType}`,
		);
	}
});

test('C11R control 6: a scope with no canonical rows keeps the policy fallback unchanged', { skip: SKIP }, async () => {
	const rows = await liveCanonicalRows();
	const policy = await persistedPolicyInput();
	// Grade 12 has no canonical rows in this fixture.
	const grid = buildCanonicalDisplayGrid({ rows, scopes: [{ gradeLevel: 12, programType: 'REGULAR' }], policy });
	assert.equal(grid.hasCanonicalRows, false, 'a canonical-free scope must not claim canonical rows');
	assert.equal(grid.shiftWindow, null, 'a canonical-free scope has no canonical shift bounds');
	assert.deepEqual(
		intervals(grid.specialEventSlots),
		intervals(buildSpecialEventSlots(policy)),
		'the fallback break bands are exactly the persisted policy derivation, unchanged',
	);
	assert.deepEqual(intervals(grid.periodSlots), intervals(buildPeriodSlots(policy)), 'the fallback period grid is the policy grid');

	// With NO persisted special-event rows the pure policy path applies the
	// persisted lunch window verbatim — the fallback semantics are unchanged.
	const policyOnly = { ...policy, specialEvents: [] };
	const policyOnlyGrid = buildCanonicalDisplayGrid({ rows, scopes: [{ gradeLevel: 12, programType: 'REGULAR' }], policy: policyOnly });
	assert.equal(policyOnlyGrid.hasCanonicalRows, false, 'grade 12 must remain a policy-fallback scope');
	assert.equal(hasInterval(policyOnlyGrid.specialEventSlots, RETIRED_LUNCH), true, 'the unchanged policy path still applies the persisted lunch window');
	assert.deepEqual(intervals(policyOnlyGrid.periodSlots), intervals(buildPeriodSlots(policyOnly)), 'the fallback period grid is the policy grid');
});

test('C11R control 9: missing policy with canonical rows present never invents the retired window', { skip: SKIP }, async () => {
	const rows = await liveCanonicalRows();
	// No policy at all: the canonical grid must still be the authority.
	const grid = buildCanonicalDisplayGrid({ rows, scopes: [{ gradeLevel: 7, programType: 'REGULAR' }], policy: undefined });
	assert.equal(grid.hasCanonicalRows, true, 'canonical rows must resolve without any policy');
	assert.equal(JSON.stringify(grid).includes('11:55'), false, 'a missing policy must never invent 11:55');
	assert.equal(JSON.stringify(grid).includes('12:55'), false, 'a missing policy must never invent 12:55');
	assert.equal(hasInterval(grid.periodSlots, '06:00-06:45'), true, 'the period grid still comes from the canonical CLASS rows');
	// And the policy-less fallback for a canonical-free scope invents nothing either.
	const emptyFallback = buildPeriodSlots(undefined);
	assert.equal(JSON.stringify(emptyFallback).includes('11:55'), false, 'the default fallback must not carry the retired window');
});

test('C11R control 7/8: the published read renders canonical-derived frozen slots and never the retired window', { skip: SKIP }, async () => {
	const published = await withDataContext(prisma, () => publishSchedule(
		{ schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, runId, actorId: 1, actorSchoolId: fixture.schoolId },
		{ now: () => new Date(), computeInputSnapshot: async () => inputSnapshotRef, publishEvent: () => undefined },
	));
	assert.equal(published.replayed, false, 'initial publication must commit');

	const revision = await prisma.publishedScheduleRevision.findFirst({
		where: { schoolId: fixture.schoolId, sourceRunId: runId },
		orderBy: { id: 'asc' },
		select: { metadata: true },
	});
	const frozen = readPublishedIdentitySnapshot(revision?.metadata);
	assert.ok(frozen, 'publication must persist a valid frozen snapshot');
	assert.equal(intervals(frozen.displaySlots).includes(CANONICAL_LUNCH), true, `the frozen artifact must carry the canonical lunch ${CANONICAL_LUNCH}`);
	assert.equal(JSON.stringify(frozen.displaySlots).includes('11:55'), false, 'the frozen artifact must never carry 11:55');
	assert.equal(frozen.classProgramSlots.length > 0, true, 'the frozen artifact must carry the canonical grid rows');

	const before = await readPublished();
	assert.equal(before.source.snapshotState, 'FROZEN', 'the published read must resolve the frozen snapshot');
	const beforeSlots = intervals(before.timeSlots as any[]);
	const beforeEvents = intervals(before.specialEvents as any[]);
	assert.equal(beforeEvents.includes(RETIRED_LUNCH), false, `the published read must never render ${RETIRED_LUNCH}`);
	assert.equal(beforeSlots.includes(CANONICAL_LUNCH), true, `the published read must render the canonical lunch ${CANONICAL_LUNCH}`);

	// ── Genuine post-freeze LIVE grid change ──
	await prisma.classProgramSlot.deleteMany({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, gradeLevel: 7, programType: 'REGULAR', rowKind: 'BREAK' },
	});
	await prisma.classProgramSlot.create({
		data: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, gradeLevel: 7, programType: 'REGULAR', startTime: '11:00', endTime: '11:45', rowKind: 'BREAK', subjectLabel: 'Lunch Break', subjectFamily: null, sourceLabel: CANONICAL_TEMPLATE_VERSION, sourceNote: 'post-freeze live edit', isActive: true },
	});
	const liveAfter = await liveCanonicalRows();
	const liveGrid = buildCanonicalDisplayGrid({ rows: liveAfter, scopes: [{ gradeLevel: 7, programType: 'REGULAR' }], policy: await persistedPolicyInput() });
	assert.equal(hasInterval(liveGrid.specialEventSlots, '11:00-11:45'), true, 'the LIVE grid really changed (precondition for the immutability control)');
	assert.equal(hasInterval(liveGrid.specialEventSlots, CANONICAL_LUNCH), false, 'the LIVE G7 lunch band really moved');

	const after = await readPublished();
	assert.deepEqual(intervals(after.timeSlots as any[]), beforeSlots, 'a published read must still render the FROZEN display slots');
	assert.deepEqual(intervals(after.specialEvents as any[]), beforeEvents, 'a published read must still render the FROZEN special events');
	assert.equal(intervals(after.specialEvents as any[]).includes(CANONICAL_LUNCH), true, 'the frozen canonical lunch survives the live change');
	assert.equal(JSON.stringify(after.specialEvents).includes('11:55'), false, 'the frozen read never renders the retired window');
});
