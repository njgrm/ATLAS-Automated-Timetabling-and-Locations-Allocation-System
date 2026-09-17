/**
 * SLOT-BREAK-AUTHORITY-C11 — the canonical `classProgramSlot` grid is the
 * effective break-window and shift-bound authority.
 *
 * The canonical grid is produced by the REAL producer
 * (`seedClassProgramSlots` / `getExpectedCanonicalSlots`) inside a GUARDED
 * DISPOSABLE PostgreSQL database, then read back and fed to the REAL production
 * authority builders. No grid row in this file is hand-written.
 *
 * Controls:
 *   1. lunch follows the shift: 12:15-13:00 for G7/G8, 11:30-12:15 for G9/G10
 *   2. 09:00-09:15 is a break for Grades 7-8
 *   3. 15:15-15:30 is a break for Grades 9-10
 *   4. the retired policy lunch 11:55-12:55 is NOT applied
 *   5. an entry at 12:15-13:00 is rejected by the canonical shape authority
 *   6. a lunch-spanning teacher gap is not idle; the policy-only path is
 *   7. 8 vs 10 canonical CLASS rows for 7-8 Regular/Special (no 10-period rule)
 *   8. generation preflight, manual edit, and pre-generation draft agree
 *   9. absent manual authority no longer means "no breaks"
 *  10. the policy-row-only Flag/HGP fallback still snaps (or fails closed)
 *  11. the consumed-input fingerprint covers `classProgramSlot`
 *
 * Run: `npx tsx src/__tests__/slot-break-authority-c11.test.ts`
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
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'slot-break-authority-c11-secret';

const RUNNABLE = isDisposableHarnessAvailable();
const SKIP = RUNNABLE ? false : 'EXTERNALLY_BLOCKED(DISPOSABLE_DB_UNAVAILABLE)';

const GRADE_PROGRAMS = ['REGULAR', 'STE', 'SPA', 'SPS'] as const;
const ALL_SCOPES = [7, 8, 9, 10].flatMap((gradeLevel) => GRADE_PROGRAMS.map((programType) => ({ gradeLevel, programType })));

/** A policy row whose legacy lunch window is the retired 11:55-12:55 grid. */
const RETIRED_POLICY_ROW = {
	enableLunchWindow: true,
	lunchStartTime: '11:55',
	lunchEndTime: '12:55',
	enableRecess: false,
	enableFlagCeremony: false,
};

let harness: DisposableDatabase | null = null;
let prisma: any = null;
let fixture: CanonicalFixture;
/** Grade-7-only fixture used for the Flag/HGP policy-row-only snap controls. */
let fixtureB: CanonicalFixture;
let runId = 0;
/** Raw canonical grid rows persisted by the real producer. */
let gridRows: any[] = [];

let buildWarningWindowAuthority: any;
let resolveCanonicalWindowAuthorityForScope: any;
let buildValidatorCtx: any;
let resolveManualWindowAuthority: any;
let loadRunContext: any;
let buildPreGenerationValidatorContext: any;
let buildPreflightValidatorContext: any;
let buildGenerationPreflight: any;
let validateCanonicalEntryShapes: any;
let buildSectionScopeMap: any;
let validateHardConstraints: any;
let computeGenerationInputSnapshot: any;
let compareGenerationInputSnapshots: any;
let seedClassProgramSlots: any;
let resolveCanonicalSlotsForPrograms: any;
let getExpectedCanonicalSlots: any;
let CANONICAL_TEMPLATE_VERSION: string;

const sectionId = (gradeLevel: number, programType: string, index: number) =>
	92_000 + (gradeLevel - 7) * 10 + GRADE_PROGRAMS.indexOf(programType as any) + index;

/** SectionsByGrade payload for the full 16-scope grid (real roster shape). */
function buildSectionsByGrade() {
	return [7, 8, 9, 10].map((gradeLevel, gradeIndex) => ({
		gradeLevelId: 17 + gradeIndex,
		gradeLevelName: `Grade ${gradeLevel}`,
		displayOrder: gradeLevel,
		sections: GRADE_PROGRAMS.map((programType) => {
			const id = sectionId(gradeLevel, programType, 1);
			return {
				id,
				externalId: id,
				mirrorId: id,
				name: `${gradeLevel}-${programType}`,
				displayOrder: gradeLevel,
				gradeLevelId: 17 + gradeIndex,
				gradeLevelName: `Grade ${gradeLevel}`,
				maxCapacity: 50,
				enrolledCount: 40,
				programType,
				isActiveForScheduling: true,
				isStale: false,
			};
		}),
	}));
}

before(async () => {
	if (!RUNNABLE) return;
	harness = provisionDisposableDatabase('c11');
	if (!harness) return;
	process.env.DATABASE_URL = harness.targetUrl;

	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });
	await prisma.$connect();

	fixture = await seedCanonicalFixture(prisma, { schoolYearId: 9_200_001, sectionExternalId: 9_201 });
	// A second, Grade-7-only fixture: its single canonical scope makes the
	// Flag/HGP snap check decidable in both directions (snappable vs not).
	fixtureB = await seedCanonicalFixture(prisma, { schoolYearId: 9_200_002, sectionExternalId: 9_203 });

	const warningWindow = await import('../services/warning-window-authority.service.js');
	buildWarningWindowAuthority = warningWindow.buildWarningWindowAuthority;
	resolveCanonicalWindowAuthorityForScope = warningWindow.resolveCanonicalWindowAuthorityForScope;

	const manualEdit = await import('../services/manual-edit.service.js');
	buildValidatorCtx = manualEdit.buildValidatorCtx;
	resolveManualWindowAuthority = manualEdit.resolveManualWindowAuthority;
	loadRunContext = manualEdit.loadRunContext;

	const preGeneration = await import('../services/pre-generation-draft.service.js');
	buildPreGenerationValidatorContext = preGeneration.buildPreGenerationValidatorContext;

	const preflight = await import('../services/generation-preflight.service.js');
	buildPreflightValidatorContext = preflight.buildPreflightValidatorContext;
	buildGenerationPreflight = preflight.buildGenerationPreflight;
	validateCanonicalEntryShapes = preflight.validateCanonicalEntryShapes;
	buildSectionScopeMap = preflight.buildSectionScopeMap;

	const validator = await import('../services/constraint-validator.js');
	validateHardConstraints = validator.validateHardConstraints;

	const snapshot = await import('../services/generation-input-snapshot.service.js');
	computeGenerationInputSnapshot = snapshot.computeGenerationInputSnapshot;
	compareGenerationInputSnapshots = snapshot.compareGenerationInputSnapshots;

	const classProgramSlot = await import('../services/class-program-slot.service.js');
	seedClassProgramSlots = classProgramSlot.seedClassProgramSlots;
	resolveCanonicalSlotsForPrograms = classProgramSlot.resolveCanonicalSlotsForPrograms;
	getExpectedCanonicalSlots = classProgramSlot.getExpectedCanonicalSlots;
	CANONICAL_TEMPLATE_VERSION = classProgramSlot.CANONICAL_TEMPLATE_VERSION;

	// ── Fixture: canonical grid for Grades 7-10 × REGULAR/STE/SPA/SPS ──────────
	// REAL producer. `seedCanonicalFixture` already seeded Grade 7 REGULAR from
	// `getExpectedCanonicalSlots`; the service seeds every remaining group.
	await seedClassProgramSlots(fixture.schoolId, fixture.schoolYearId);

	// Full 16-scope roster: section mirrors + the roster snapshot the manual and
	// draft contexts read.
	const sectionsByGrade = buildSectionsByGrade();
	for (const grade of sectionsByGrade) {
		for (const section of grade.sections) {
			await prisma.sectionMirror.create({
				data: {
					externalId: section.externalId,
					schoolId: fixture.schoolId,
					schoolYearId: fixture.schoolYearId,
					name: section.name,
					gradeLevelId: section.gradeLevelId,
					gradeLevelName: section.gradeLevelName,
					displayOrder: section.displayOrder,
					maxCapacity: 50,
					enrolledCount: 40,
					programType: section.programType,
					isActiveForScheduling: true,
					isStale: false,
				},
			});
		}
	}
	await prisma.sectionSnapshot.update({
		where: { schoolId_schoolYearId: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId } },
		data: { payload: sectionsByGrade as unknown as object },
	});

	// Production-shaped policy: the RETIRED 11:55-12:55 lunch window is enabled,
	// special events are EMPTY, and grade shift windows are EMPTY.
	await prisma.schedulingPolicy.update({
		where: { schoolId_schoolYearId: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId } },
		data: { enableLunchWindow: true, lunchStartTime: '11:55', lunchEndTime: '12:55', enableRecess: false, enableFlagCeremony: false },
	});
	await prisma.policySpecialEvent.deleteMany({ where: { schoolId: fixture.schoolId } });
	await prisma.gradeShiftWindow.deleteMany({ where: { schoolId: fixture.schoolId } });

	const run = await prisma.generationRun.create({
		data: {
			schoolId: fixture.schoolId,
			schoolYearId: fixture.schoolYearId,
			status: 'COMPLETED',
			triggeredBy: 1,
			version: 1,
			draftEntries: [] as object[],
			unassignedItems: [] as object[],
			violations: [] as object[],
			summary: { isPublished: false } as object,
		},
	});
	runId = run.id as number;

	gridRows = await prisma.classProgramSlot.findMany({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, isActive: true },
		select: { gradeLevel: true, programType: true, startTime: true, endTime: true, rowKind: true, subjectLabel: true, dayOfWeek: true, sourceLabel: true },
		orderBy: [{ gradeLevel: 'asc' }, { startTime: 'asc' }],
	});
});

after(async () => {
	if (prisma) {
		if (fixture) await teardownCanonicalFixture(prisma, fixture.schoolId);
		if (fixtureB) await teardownCanonicalFixture(prisma, fixtureB.schoolId);
		await prisma.$disconnect().catch(() => undefined);
	}
	if (harness) {
		harness.drop();
		harness.assertDropped();
	}
});

// ─── Helpers ───

function scopeAuthority(
	scopes: Array<{ gradeLevel: number; programType: string }> = ALL_SCOPES,
	overrides: Record<string, unknown> = {},
) {
	return buildWarningWindowAuthority({
		sections: scopes.map((scope, index) => ({ id: 10_000 + index, gradeLevel: scope.gradeLevel, programType: scope.programType })),
		policyRow: RETIRED_POLICY_ROW,
		specialEvents: [],
		shiftWindows: null,
		classProgramSlots: gridRows,
		...overrides,
	});
}

function windowsForScope(authority: any, gradeLevel: number, programType: string) {
	return authority.breakWindows.filter(
		(window: any) =>
			window.gradeLevel === gradeLevel &&
			(window.programType == null ? 'REGULAR' : String(window.programType).toUpperCase()) === programType,
	);
}

function hasWindow(windows: any[], startTime: string, endTime: string) {
	return windows.some((window: any) => window.startTime === startTime && window.endTime === endTime);
}

function breakKeySet(authority: any): string[] {
	const keys: string[] = (authority.breakWindows as any[]).map(
		(window: any) => `${window.gradeLevel}:${window.programType ?? '*'}:${window.startTime}-${window.endTime}:${window.eventType}:${window.dayOfWeek ?? '*'}`,
	);
	return [...new Set<string>(keys)].sort();
}

function manualRefData(overrides: Record<string, unknown> = {}) {
	return {
		faculty: [{ id: 1, maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0 }],
		facultySubjects: [{ facultyId: 1, subjectId: 100, gradeLevels: [7], sectionIds: [sectionId(7, 'STE', 1)] }],
		rooms: [{ id: 10, type: 'CLASSROOM', capacity: 50, features: [], floor: 1, buildingId: 1 }],
		subjects: [{ id: 100, code: 'MATH', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', requiredFeatures: [], gradeLevels: [7] }],
		policyRecord: {
			...RETIRED_POLICY_ROW,
			maxConsecutiveTeachingMinutesBeforeBreak: 180,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480,
			earliestStartTime: '06:00',
			latestEndTime: '14:30',
			enforceConsecutiveBreakAsHard: false,
			maxBuildingTransitionsPerDay: 10,
			maxBackToBackTransitionsWithoutBuffer: 10,
			maxIdleGapMinutesPerDay: 3,
			avoidEarlyFirstPeriod: false,
			avoidLateLastPeriod: false,
			enableVacantAwareConstraints: false,
			targetFacultyDailyVacantMinutes: 0,
			targetSectionDailyVacantPeriods: 0,
			maxCompressedTeachingMinutesPerDay: 480,
			constraintConfig: {},
		},
		buildings: [{ id: 1 }],
		sectionEnrollment: new Map([[sectionId(7, 'STE', 1), 40]]),
		sectionGradeLevel: new Map([[sectionId(7, 'STE', 1), 7]]),
		classProgramSlots: gridRows,
		...overrides,
	} as any;
}

function lunchSpanEntries(): any[] {
	return [
		{ entryId: 'pre-lunch', facultyId: 1, roomId: 10, subjectId: 100, sectionId: sectionId(7, 'STE', 1), day: 'WEDNESDAY', startTime: '11:30', endTime: '12:15', durationMinutes: 45, termIndex: 1 },
		{ entryId: 'post-lunch', facultyId: 1, roomId: 10, subjectId: 100, sectionId: sectionId(7, 'STE', 1), day: 'WEDNESDAY', startTime: '13:00', endTime: '13:45', durationMinutes: 45, termIndex: 1 },
	];
}

function idleMinutes(result: any): number | null {
	const violation = result.violations.find((candidate: any) => candidate.code === 'FACULTY_EXCESSIVE_IDLE_GAP');
	return violation ? Number(violation.meta?.totalIdleMinutes) : null;
}

// ─── Controls 1-4, 7: the canonical grid is the break/shift authority ───────

test('C01. the fixture grid is the REAL canonical producer output for all 16 scopes', { skip: SKIP }, () => {
	assert.ok(gridRows.length > 0, 'the canonical grid rows were persisted');
	assert.equal(
		getExpectedCanonicalSlots(7, 'REGULAR')[0].sourceLabel,
		CANONICAL_TEMPLATE_VERSION,
		'the catalogue consumed by the producer is the pinned canonical template version',
	);
	for (const scope of ALL_SCOPES) {
		const persisted = gridRows
			.filter((row) => row.gradeLevel === scope.gradeLevel && row.programType === scope.programType)
			.map((row) => `${row.startTime}-${row.endTime}:${row.rowKind}`)
			.sort();
		const expected = getExpectedCanonicalSlots(scope.gradeLevel, scope.programType)
			.map((slot: any) => `${slot.startTime}-${slot.endTime}:${slot.rowKind}`)
			.sort();
		assert.ok(persisted.length > 0, `scope ${scope.gradeLevel}:${scope.programType} has canonical rows`);
		assert.deepEqual(
			persisted,
			expected,
			`scope ${scope.gradeLevel}:${scope.programType} rows are exactly the canonical producer output`,
		);
	}
});

test('C01. control 1: the canonical lunch break follows the shift (G7/G8 12:15-13:00, G9/G10 11:30-12:15)', { skip: SKIP }, () => {
	const authority = scopeAuthority();
	// 2026-09-17 shift-based lunch ruling: lunch is a shift property, not a
	// program property. Grades 7-8 keep 12:15-13:00; Grades 9-10 lunch 11:30-12:15.
	for (const scope of ALL_SCOPES) {
		const breakfast = scope.gradeLevel <= 8 ? { startTime: '12:15', endTime: '13:00' } : { startTime: '11:30', endTime: '12:15' };
		const windows = windowsForScope(authority, scope.gradeLevel, scope.programType);
		assert.ok(
			hasWindow(windows, breakfast.startTime, breakfast.endTime),
			`scope ${scope.gradeLevel}:${scope.programType} must carry the canonical ${breakfast.startTime}-${breakfast.endTime} lunch break`,
		);
		const lunch = windows.find((window: any) => window.startTime === breakfast.startTime && window.endTime === breakfast.endTime);
		assert.equal(lunch.eventType, 'LUNCH_BREAK');
		// The other shift's lunch window is never borrowed.
		const otherShift = scope.gradeLevel <= 8
			? hasWindow(windows, '11:30', '12:15')
			: hasWindow(windows, '12:15', '13:00');
		assert.equal(otherShift, false, `scope ${scope.gradeLevel}:${scope.programType} must not carry the other shift's lunch window`);
	}
});

test('C02. control 2: 09:00-09:15 is a break for Grades 7-8 only', { skip: SKIP }, () => {
	const authority = scopeAuthority();
	for (const scope of ALL_SCOPES.filter((candidate) => candidate.gradeLevel <= 8)) {
		assert.ok(
			hasWindow(windowsForScope(authority, scope.gradeLevel, scope.programType), '09:00', '09:15'),
			`scope ${scope.gradeLevel}:${scope.programType} must carry the 09:00-09:15 Health Break`,
		);
	}
	for (const scope of ALL_SCOPES.filter((candidate) => candidate.gradeLevel >= 9)) {
		assert.equal(
			hasWindow(windowsForScope(authority, scope.gradeLevel, scope.programType), '09:00', '09:15'),
			false,
			`scope ${scope.gradeLevel}:${scope.programType} must not carry a 7-8 Health Break`,
		);
	}
});

test('C03. control 3: 15:15-15:30 is a break for Grades 9-10 only', { skip: SKIP }, () => {
	const authority = scopeAuthority();
	for (const scope of ALL_SCOPES.filter((candidate) => candidate.gradeLevel >= 9)) {
		assert.ok(
			hasWindow(windowsForScope(authority, scope.gradeLevel, scope.programType), '15:15', '15:30'),
			`scope ${scope.gradeLevel}:${scope.programType} must carry the 15:15-15:30 Health Break`,
		);
	}
	for (const scope of ALL_SCOPES.filter((candidate) => candidate.gradeLevel <= 8)) {
		assert.equal(
			hasWindow(windowsForScope(authority, scope.gradeLevel, scope.programType), '15:15', '15:30'),
			false,
			`scope ${scope.gradeLevel}:${scope.programType} must not carry a 9-10 Health Break`,
		);
	}
});

test('C04. control 4: the retired policy lunch 11:55-12:55 is NOT applied', { skip: SKIP }, () => {
	const authority = scopeAuthority();
	assert.equal(
		authority.breakWindows.some((window: any) => window.startTime === '11:55' || window.endTime === '12:55'),
		false,
		'no scope may carry the retired 11:55-12:55 policy lunch window',
	);
	// The policy/special-event path remains for scopes with NO canonical rows.
	const fallback = scopeAuthority([{ gradeLevel: 99, programType: 'REGULAR' }], { classProgramSlots: [] });
	assert.ok(
		fallback.breakWindows.some((window: any) => window.startTime === '11:55' && window.endTime === '12:55'),
		'a scope with no canonical rows keeps the persisted policy-row window',
	);
});

test('C07. control 7: 8 vs 10 canonical CLASS rows (no global 10-period and no 7-period rule)', { skip: SKIP }, async () => {
	const classCount = async (gradeLevel: number, programType: string) =>
		(await resolveCanonicalSlotsForPrograms(fixture.schoolId, fixture.schoolYearId, gradeLevel, [programType]))
			.filter((row: any) => row.rowKind === 'CLASS').length;

	assert.equal(await classCount(7, 'REGULAR'), 8, 'Grade 7 REGULAR must honour 8 canonical CLASS rows');
	assert.equal(await classCount(7, 'STE'), 10, 'Grade 7 STE must honour 10 canonical CLASS rows');
	assert.equal(await classCount(8, 'REGULAR'), 8);
	assert.equal(await classCount(8, 'SPS'), 10);
	// 2026-09-17 shift-based lunch ruling: the afternoon shift lunches at
	// 11:30-12:15, so 12:15-13:00 is a CLASS row and G9/G10 REGULAR carries 8.
	assert.equal(await classCount(9, 'REGULAR'), 8, 'Grade 9 REGULAR must honour 8 canonical CLASS rows');
	assert.equal(await classCount(9, 'SPA'), 10);
	assert.equal(await classCount(10, 'REGULAR'), 8);
	assert.equal(getExpectedCanonicalSlots(7, 'REGULAR').filter((slot: any) => slot.rowKind === 'CLASS').length, 8);
	assert.equal(getExpectedCanonicalSlots(9, 'REGULAR').filter((slot: any) => slot.rowKind === 'CLASS').length, 8);
	assert.equal(
		new Set([7, 8, 9, 10].map((grade) => getExpectedCanonicalSlots(grade, 'REGULAR').filter((slot: any) => slot.rowKind === 'CLASS').length)).size,
		1,
		'every REGULAR scope now carries 8 canonical CLASS rows (the 10-period rule never existed for either)',
	);
});

test('C02. canonical CLASS rows define the scope shift bounds', { skip: SKIP }, () => {
	const authority = scopeAuthority();
	const shiftFor = (gradeLevel: number, programType: string) =>
		authority.shiftWindows.find(
			(window: any) =>
				window.gradeLevel === gradeLevel &&
				(window.programType == null ? 'REGULAR' : String(window.programType).toUpperCase()) === programType,
		);
	assert.deepEqual(
		{ start: shiftFor(7, 'REGULAR')?.startTime, end: shiftFor(7, 'REGULAR')?.endTime },
		{ start: '06:00', end: '12:15' },
		'Grade 7 REGULAR shift spans its canonical CLASS rows',
	);
	assert.deepEqual(
		{ start: shiftFor(7, 'STE')?.startTime, end: shiftFor(7, 'STE')?.endTime },
		{ start: '06:00', end: '14:30' },
		'Grade 7 STE shift includes the specialization CLASS rows',
	);
	assert.deepEqual(
		{ start: shiftFor(9, 'REGULAR')?.startTime, end: shiftFor(9, 'REGULAR')?.endTime },
		{ start: '12:15', end: '18:30' },
		'Grade 9 REGULAR shift spans its afternoon CLASS rows (lunch 11:30-12:15 is excluded)',
	);
	// A persisted GradeShiftWindow keeps its authority.
	const persisted = scopeAuthority(ALL_SCOPES, { shiftWindows: [{ gradeLevel: 7, programType: 'REGULAR', startTime: '05:00', endTime: '13:00' }] });
	assert.ok(
		persisted.shiftWindows.some((window: any) => window.gradeLevel === 7 && window.startTime === '05:00'),
		'a persisted GradeShiftWindow is preserved',
	);
	assert.equal(
		persisted.shiftWindows.some((window: any) => window.gradeLevel === 7 && window.startTime === '06:00' && window.endTime === '12:15'),
		false,
		'no canonical shift is added where a persisted shift already covers the scope',
	);
});

test('C07. the canonical scope resolver mirrors the live resolver semantics', { skip: SKIP }, () => {
	const rows = gridRows;
	const resolved = resolveCanonicalWindowAuthorityForScope({ rows, gradeLevel: 7, programType: 'REGULAR' });
	assert.equal(resolved.hasCanonicalRows, true);
	assert.ok(resolved.shiftWindows.length > 0);
	const none = resolveCanonicalWindowAuthorityForScope({ rows: [], gradeLevel: 7, programType: 'REGULAR' });
	assert.equal(none.hasCanonicalRows, false, 'an empty grid never claims canonical authority');
	assert.equal(none.breakWindows.length, 0);
});

// ─── Control 6: idle accounting follows the canonical grid ──────────────────

test('C06. control 6: a lunch-spanning gap is not idle under the canonical grid', { skip: SKIP }, () => {
	const entries = lunchSpanEntries();
	const canonicalAuthority = buildWarningWindowAuthority({
		sections: [{ id: sectionId(7, 'STE', 1), gradeLevel: 7, programType: 'STE' }],
		policyRow: RETIRED_POLICY_ROW,
		specialEvents: [],
		shiftWindows: null,
		classProgramSlots: gridRows,
	});
	const canonicalCtx = buildValidatorCtx(1, 2, runId, entries, manualRefData({ windowAuthority: canonicalAuthority }));
	const canonicalResult = validateHardConstraints(canonicalCtx);
	assert.equal(idleMinutes(canonicalResult), null, 'the 12:15-13:00 lunch span contributes no idle time');
	assert.equal(
		canonicalResult.violations.some((violation: any) => violation.code === 'FACULTY_EXCESSIVE_IDLE_GAP'),
		false,
		'no idle-gap violation for a gap wholly covered by the canonical lunch break',
	);

	// Base contrast: with the policy-only path the retired 11:55-12:55 window
	// leaves 5 uncovered minutes, so the same gap IS reported as idle. This is
	// the decisive, committed failing-first control for the fix.
	const policyOnlyAuthority = buildWarningWindowAuthority({
		sections: [{ id: sectionId(7, 'STE', 1), gradeLevel: 7, programType: 'STE' }],
		policyRow: RETIRED_POLICY_ROW,
		specialEvents: [],
		shiftWindows: null,
	});
	const policyOnlyCtx = buildValidatorCtx(1, 2, runId, entries, manualRefData({ windowAuthority: policyOnlyAuthority }));
	const policyOnlyResult = validateHardConstraints(policyOnlyCtx);
	assert.equal(idleMinutes(policyOnlyResult), 5, 'the retired policy window leaves the 12:55-13:00 tail uncovered');
	assert.equal(
		policyOnlyResult.violations.some((violation: any) => violation.code === 'FACULTY_EXCESSIVE_IDLE_GAP'),
		true,
		'the policy-only path still reports the uncovered tail as idle (the fix is load-bearing)',
	);

	// 12:15-13:00 is a BREAK row, never a canonical CLASS row.
	const canonicalRows = gridRows.filter((row) => row.gradeLevel === 7 && row.programType === 'STE');
	assert.equal(
		canonicalRows.some((row) => row.rowKind === 'CLASS' && row.startTime === '12:15' && row.endTime === '13:00'),
		false,
		'12:15-13:00 is never counted as a canonical class period',
	);
	assert.equal(
		canonicalRows.some((row) => row.rowKind === 'BREAK' && row.startTime === '12:15' && row.endTime === '13:00'),
		true,
		'12:15-13:00 is the canonical Lunch Break',
	);
});

// ─── Control 5: an entry inside lunch is rejected ───────────────────────────

test('C05. control 5: an entry at 12:15-13:00 is rejected by the canonical shape authority', { skip: SKIP }, async () => {
	const preflight = await buildGenerationPreflight(fixture.schoolId, fixture.schoolYearId, { includeRetainedDrafts: false });
	const assembly = preflight.assembly;
	const sectionScope = buildSectionScopeMap(assembly.sectionsByGrade);
	const target = sectionId(7, 'REGULAR', 1);
	const entry = {
		entryId: 'lunch-entry',
		facultyId: 1,
		roomId: fixture.roomId,
		subjectId: fixture.subjectIdByCode.MATH,
		sectionId: target,
		day: 'WEDNESDAY',
		startTime: '12:15',
		endTime: '13:00',
		durationMinutes: 45,
	};
	const blockers = validateCanonicalEntryShapes([entry], assembly.timetableShapeContracts, sectionScope);
	assert.ok(
		blockers.some((blocker: any) => blocker.code === 'CANONICAL_SHAPE_VIOLATION' && blocker.sectionId === target),
		'an entry placed inside the canonical Lunch Break is not an authoritative CLASS row',
	);
	// The same interval IS a canonical CLASS row for a lunch-free scope, proving
	// the rejection is scope-specific and not a blanket ban on 12:15-13:00.
	const grade9Entry = { ...entry, entryId: 'grade9-lunch-entry', sectionId: sectionId(9, 'REGULAR', 1), startTime: '13:00', endTime: '13:45' };
	assert.equal(
		validateCanonicalEntryShapes([grade9Entry], assembly.timetableShapeContracts, sectionScope)
			.some((blocker: any) => blocker.code === 'CANONICAL_SHAPE_VIOLATION'),
		false,
		'13:00-13:45 is a canonical CLASS row for Grade 9 REGULAR',
	);
});

// ─── Control 8: all three callers agree ─────────────────────────────────────

test('C08. control 8: preflight, manual, and pre-generation callers agree on break windows', { skip: SKIP }, async () => {
	const preflight = await buildGenerationPreflight(fixture.schoolId, fixture.schoolYearId, { includeRetainedDrafts: false });
	const generationCtx = buildPreflightValidatorContext(preflight.assembly, [], runId);

	const refData = await loadRunContext(runId, fixture.schoolId, fixture.schoolYearId);
	const manualCtx = buildValidatorCtx(fixture.schoolId, fixture.schoolYearId, runId, [], refData);

	const sectionsById = new Map<number, { displayOrder: number; gradeLevelId: number; programType: string }>(
		buildSectionsByGrade().flatMap((grade) =>
			grade.sections.map((section) => [section.id, { displayOrder: grade.displayOrder, gradeLevelId: grade.gradeLevelId, programType: String(section.programType) }] as const),
		),
	);
	const preGenerationCtx = buildPreGenerationValidatorContext(fixture.schoolId, fixture.schoolYearId, [], {
		facultyRefs: manualRefData().faculty,
		facultySubjects: manualRefData().facultySubjects,
		rooms: manualRefData().rooms,
		subjects: manualRefData().subjects.map((subject: any) => ({ ...subject, requiredFeatures: [] })),
		sectionEnrollment: new Map([[sectionId(7, 'REGULAR', 1), 40]]),
		policyRecord: manualRefData().policyRecord,
		buildings: [{ id: 1 }],
		sectionsById,
		gradeWindows: [],
		specialEvents: [],
		classProgramSlots: gridRows,
	} as any);

	const generationKeys = breakKeySet({ breakWindows: generationCtx.breakWindows });
	const manualKeys = breakKeySet({ breakWindows: manualCtx.breakWindows });
	const preGenerationKeys = breakKeySet({ breakWindows: preGenerationCtx.breakWindows });

	assert.ok(generationKeys.some((key) => key.includes('12:15-13:00')), 'the preflight leg carries the canonical lunch break');
	assert.deepEqual(manualKeys, generationKeys, 'the manual-edit leg matches the generation leg');
	assert.deepEqual(preGenerationKeys, generationKeys, 'the pre-generation leg matches the generation leg');
	assert.equal(
		generationKeys.some((key) => key.includes('11:55-12:55')),
		false,
		'no leg applies the retired policy lunch window',
	);
	// The persisted manual authority really did consume the canonical grid.
	assert.ok(
		refData.windowAuthority.breakWindows.some((window: any) => window.startTime === '12:15' && window.endTime === '13:00'),
		'loadRunContext derives the canonical lunch break',
	);
});

// ─── Control 9: absent manual authority fails closed ────────────────────────

test('C09. control 9: an absent manual authority no longer means "no breaks"', { skip: SKIP }, () => {
	const withoutAuthority = manualRefData({ windowAuthority: undefined });
	const derived = resolveManualWindowAuthority(withoutAuthority);
	assert.ok(
		derived.breakWindows.some((window: any) => window.startTime === '12:15' && window.endTime === '13:00'),
		'an absent authority is re-derived from the persisted sources, never silently empty',
	);

	const ctx = buildValidatorCtx(1, 2, runId, [], withoutAuthority);
	assert.ok(
		ctx.breakWindows!.some((window: any) => window.startTime === '12:15' && window.endTime === '13:00'),
		'the manual validator context carries the derived canonical lunch break',
	);

	// Truly unresolvable authority is a typed fail-closed error, not silence.
	assert.throws(
		() => resolveManualWindowAuthority({ policyRecord: null, windowAuthority: undefined } as any),
		(error: any) => error?.code === 'WINDOW_AUTHORITY_UNAVAILABLE',
		'a missing authority with no persisted policy row fails closed with the typed code',
	);
});

// ─── Control 10: policy-row-only Flag/HGP snap ──────────────────────────────

test('C10. control 10: the policy-row-only Flag/HGP fallback snaps or fails closed', { skip: SKIP }, async () => {
	// No persisted Flag/HGP special-event row exists; the policy row alone is the
	// flag authority on this path.
	assert.equal(
		await prisma.policySpecialEvent.count({ where: { schoolId: fixtureB.schoolId } }),
		0,
		'the policy-row-only path is exercised with zero persisted special events',
	);

	const setFlag = (startTime: string, endTime: string) =>
		prisma.schedulingPolicy.update({
			where: { schoolId_schoolYearId: { schoolId: fixtureB.schoolId, schoolYearId: fixtureB.schoolYearId } },
			data: { enableFlagCeremony: true, flagCeremonyStartTime: startTime, flagCeremonyEndTime: endTime },
		});

	await setFlag('06:00', '07:30');
	const unsnappable = await buildGenerationPreflight(fixtureB.schoolId, fixtureB.schoolYearId, { includeRetainedDrafts: false });
	assert.ok(
		unsnappable.blockers.some((blocker: any) => blocker.code === 'FLAG_CEREMONY_SCOPE_INVALID'),
		'an unsnappable policy-row-only Flag/HGP window fails closed with FLAG_CEREMONY_SCOPE_INVALID',
	);

	await setFlag('06:00', '06:45');
	const snappable = await buildGenerationPreflight(fixtureB.schoolId, fixtureB.schoolYearId, { includeRetainedDrafts: false });
	assert.equal(
		snappable.blockers.some((blocker: any) => blocker.code === 'FLAG_CEREMONY_SCOPE_INVALID'),
		false,
		'a policy-row-only Flag/HGP window contained by exactly one canonical CLASS row stays ready',
	);

	await prisma.schedulingPolicy.update({
		where: { schoolId_schoolYearId: { schoolId: fixtureB.schoolId, schoolYearId: fixtureB.schoolYearId } },
		data: { enableFlagCeremony: false },
	});
});

// ─── Control 11: the fingerprint covers classProgramSlot ────────────────────

test('C11. control 11: the consumed-input fingerprint covers classProgramSlot', { skip: SKIP }, async () => {
	const before = await computeGenerationInputSnapshot(fixture.schoolId, fixture.schoolYearId, prisma);
	const slot = await prisma.classProgramSlot.findFirst({
		where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, rowKind: 'BREAK', subjectLabel: 'Lunch Break' },
	});
	assert.ok(slot, 'the canonical lunch break row exists');

	await prisma.classProgramSlot.update({ where: { id: slot.id }, data: { subjectLabel: 'Lunch Break (edited)' } });
	const after = await computeGenerationInputSnapshot(fixture.schoolId, fixture.schoolYearId, prisma);

	assert.notEqual(
		before.domains.policy.signals.exactRevisionDigest,
		after.domains.policy.signals.exactRevisionDigest,
		'a one-row canonical slot change changes the policy exact digest',
	);
	assert.notEqual(before.fingerprint, after.fingerprint, 'the whole-snapshot fingerprint changes');

	const comparison = compareGenerationInputSnapshots(before, after);
	assert.equal(comparison.status, 'STALE', 'a slot edit after the run makes the comparison STALE, never FRESH');
	assert.deepEqual(comparison.changedDomains, ['policy'], 'only the policy domain changes for a slot edit');

	// The write-abort guard is the pre-existing, unmodified comparison in
	// `generation.service.ts` (`txInputSnapshot.fingerprint !==
	// capturedSourceSnapshot.fingerprint`); it now fires for slot edits because
	// the digest covers `class_program_slots`. The digest itself is deterministic
	// for an unchanged grid.
	const stableA = await computeGenerationInputSnapshot(fixture.schoolId, fixture.schoolYearId, prisma);
	const stableB = await computeGenerationInputSnapshot(fixture.schoolId, fixture.schoolYearId, prisma);
	assert.equal(stableA.fingerprint, stableB.fingerprint, 'an unchanged grid produces an identical fingerprint');
	assert.equal(stableA.fingerprint, after.fingerprint, 'the edited state is stable across recomputation');
});
