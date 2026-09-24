/**
 * GEN-C02R Correction 1 â€” executable 2026-2027 stakeholder-shape parity.
 *
 * Run: `npx tsx src/__tests__/generation-stakeholder-shape-genc02r.test.ts`
 *
 * Source evidence (read-only, not committed):
 *  - D:/ATLAS/stakeholderFiles/DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx
 *  - D:/ATLAS/docs/verification/class-program-policy-baseline-2026-08-29.md
 *
 * These assert the committed canonical class-program contract matches the
 * accepted shift frames and break/lunch exclusions, and that a cross-shift
 * substitution mutant would fail.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { getExpectedCanonicalSlots, validateCanonicalTemplateRows, KNOWN_PROGRAM_TYPES } from '../services/class-program-slot.service.js';
import { buildGenerationPreflight, buildPreflightConstructorInput, buildPreflightValidatorContext, buildSectionScopeMap, validateCanonicalEntryShapes, STAKEHOLDER_DECISION_NOTES } from '../services/generation-preflight.service.js';
import { buildGenerationReadiness } from '../services/generation-readiness.service.js';
import { runHybridScheduler } from '../services/hybrid-scheduler.js';
import { validateHardConstraints, type ScheduledEntry } from '../services/constraint-validator.js';
import { buildSpecialEventSlots, buildUnionDisplaySlots, resolveCanonicalDisplayScope, resolveTimetableShapeContract } from '../services/schedule-constructor.js';
import { getEffectiveEvents, isFlagCeremonyEvent, isRejectedFlagCeremonyRow } from '../lib/policy-special-events.js';
import type { SectionsByGrade } from '../services/section-adapter.js';
import type { VerifiedTermContract } from '../services/enrollpro-term-contract.service.js';
import type { ProgramType } from '@prisma/client';

function minutes(value: string): number {
	const [h, m] = value.split(':').map(Number);
	return h * 60 + m;
}

function slots(grade: number, program: ProgramType) {
	return getExpectedCanonicalSlots(grade, program);
}

test('C1-1. Grade 7 and Grade 8 use only the morning frame and never the afternoon-only rows', () => {
	for (const grade of [7, 8]) {
		for (const program of KNOWN_PROGRAM_TYPES) {
			for (const row of slots(grade, program)) {
				assert.ok(minutes(row.startTime) >= minutes('06:00'), `G${grade} ${program} row ${row.startTime} starts before 06:00`);
				assert.ok(minutes(row.endTime) <= minutes('15:30'), `G${grade} ${program} row ends after the 15:30 morning frame`);
				// The afternoon-only rows (15:15-18:30) never appear in the morning contract.
				assert.ok(minutes(row.startTime) < minutes('15:15'), `G${grade} ${program} uses an afternoon-only row at ${row.startTime}`);
			}
		}
	}
});

test('C1-2. Grade 9 and Grade 10 use only the 09:45â€“18:30 frame and never the morning rows', () => {
	for (const grade of [9, 10]) {
		for (const program of KNOWN_PROGRAM_TYPES) {
			for (const row of slots(grade, program)) {
				assert.ok(minutes(row.startTime) >= minutes('09:45'), `G${grade} ${program} row ${row.startTime} starts before the 09:45 afternoon frame`);
				assert.ok(minutes(row.endTime) <= minutes('18:30'), `G${grade} ${program} row ends after 18:30`);
			}
		}
	}
});

test('C1-3. Every active grade/program scope has canonical base + specialization rows, stably ordered', () => {
	for (const grade of [7, 8, 9, 10]) {
		for (const program of KNOWN_PROGRAM_TYPES) {
			const rows = slots(grade, program);
			assert.ok(rows.length > 0, `G${grade} ${program} must have canonical rows`);
			assert.ok(rows.some((row) => row.rowKind === 'CLASS'), `G${grade} ${program} must have CLASS rows`);
			const ordered = [...rows].sort((a, b) => minutes(a.startTime) - minutes(b.startTime));
			assert.deepEqual(rows.map((row) => row.startTime), ordered.map((row) => row.startTime), `G${grade} ${program} rows must be start-time ordered`);
		}
	}
	// Special programs extend the base with specialization rows.
	for (const program of ['STE', 'SPA', 'SPS'] as ProgramType[]) {
		for (const grade of [7, 8, 9, 10]) {
			assert.ok(slots(grade, program).length > slots(grade, 'REGULAR').length, `G${grade} ${program} must add specialization rows`);
		}
	}
});

test('C1-4. Lunch and health breaks follow the shift: G7/G8 lunch 12:15-13:00, G9/G10 lunch 11:30-12:15, never teachable time', () => {
	// 2026-09-17 shift-based lunch ruling: lunch is a SHIFT property, not a
	// program property. The morning shift (Grades 7-8, all programs) lunches at
	// 12:15-13:00; the afternoon shift (Grades 9-10, all programs) lunches at
	// 11:30-12:15, so 12:15-13:00 is a CLASS row there, never a break.
	for (const grade of [7, 8]) {
		for (const program of KNOWN_PROGRAM_TYPES) {
			const rows = slots(grade, program);
			const lunch = rows.filter((row) => row.startTime === '12:15' && row.endTime === '13:00');
			assert.ok(lunch.length >= 1, `G${grade} ${program} must block morning-shift lunch at 12:15-13:00`);
			assert.ok(lunch.every((row) => row.rowKind === 'BREAK'), `G${grade} ${program} 12:15-13:00 must be BREAK`);
			// No CLASS row may occupy the blocked morning-shift lunch window.
			const classAtLunch = rows.filter((row) => row.rowKind === 'CLASS' && minutes(row.startTime) < minutes('13:00') && minutes(row.endTime) > minutes('12:15'));
			assert.equal(classAtLunch.length, 0, `G${grade} ${program} must not schedule a class over lunch`);
			assert.equal(
				rows.some((row) => row.rowKind === 'BREAK' && row.startTime === '11:30' && row.endTime === '12:15'),
				false,
				`G${grade} ${program} must not carry the afternoon-shift lunch`,
			);
		}
	}
	for (const grade of [9, 10]) {
		for (const program of KNOWN_PROGRAM_TYPES) {
			const rows = slots(grade, program);
			const lunch = rows.filter((row) => row.startTime === '11:30' && row.endTime === '12:15');
			assert.equal(lunch.length, 1, `G${grade} ${program} must block afternoon-shift lunch at 11:30-12:15`);
			assert.ok(lunch.every((row) => row.rowKind === 'BREAK' && row.subjectLabel === 'Lunch Break'), `G${grade} ${program} 11:30-12:15 must be the Lunch Break`);
			// No CLASS row may occupy the blocked afternoon-shift lunch window.
			const classAtLunch = rows.filter((row) => row.rowKind === 'CLASS' && minutes(row.startTime) < minutes('12:15') && minutes(row.endTime) > minutes('11:30'));
			assert.equal(classAtLunch.length, 0, `G${grade} ${program} must not schedule a class over the afternoon lunch`);
			const health = rows.filter((row) => row.startTime === '15:15' && row.endTime === '15:30');
			assert.ok(health.length >= 1 && health.every((row) => row.rowKind === 'BREAK'), `G${grade} ${program} 15:15-15:30 must be BREAK`);
			// 12:15-13:00 is a CLASS row on the afternoon shift.
			assert.ok(
				rows.some((row) => row.rowKind === 'CLASS' && row.startTime === '12:15' && row.endTime === '13:00'),
				`G${grade} ${program} must teach 12:15-13:00 on the afternoon shift`,
			);
		}
	}
});

test('C1-6 mutant control. A cross-shift substitution would violate the frame bounds', () => {
	const grade7Base = slots(7, 'REGULAR');
	const grade9Base = slots(9, 'REGULAR');
	// A morning row smuggled into the afternoon contract is out of frame.
	const smuggledMorning = { ...grade7Base[0], gradeLevel: 9 };
	assert.ok(minutes(smuggledMorning.startTime) < minutes('09:45'), 'the smuggled morning row must be out of the afternoon frame');
	// The authoritative afternoon contract contains no such row.
	assert.equal(grade9Base.some((row) => row.startTime === smuggledMorning.startTime), false);
	// Conversely an afternoon-only row must not appear in the morning contract.
	assert.equal(grade7Base.some((row) => row.startTime === '15:30' || row.startTime === '16:15'), false);
});

test('C8. duplicate canonical rows are detected; set de-duplication cannot hide them', () => {
	const rows = slots(7, 'REGULAR').map((slot, index) => ({
		id: index + 1, gradeLevel: 7, programType: 'REGULAR' as const, dayOfWeek: null,
		startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind, subjectFamily: null, subjectLabel: null, sourceLabel: 'x', sourceNote: null, isActive: true,
	}));
	assert.equal(validateCanonicalTemplateRows(rows, 7, 'REGULAR').some((issue) => issue.startsWith('duplicate-rows:')), false);
	const duplicated = [...rows, { ...rows[0], id: 999 }];
	const issues = validateCanonicalTemplateRows(duplicated, 7, 'REGULAR');
	assert.ok(issues.some((issue) => issue.startsWith('duplicate-rows:')), 'a duplicated canonical row must be reported');
});

// ─── G9G10-FLAG-SOURCE-LANE §3.1: exact canonical-grid tables (controls 2-5) ───

function slotKey(rows: Array<{ startTime: string; endTime: string; rowKind: string; subjectLabel?: string | null }>): string[] {
	return rows.map((row) => `${row.startTime}-${row.endTime}:${row.rowKind}:${row.subjectLabel ?? ''}`);
}

// Control 2: G7/G8 are byte-identical to the pre-ruling contract (morning shift).
const G7_REGULAR_EXPECTED = [
	'06:00-06:45:CLASS:Class',
	'06:45-07:30:CLASS:Class',
	'07:30-08:15:CLASS:Class',
	'08:15-09:00:CLASS:Class',
	'09:00-09:15:BREAK:Health Break',
	'09:15-10:00:CLASS:Class',
	'10:00-10:45:CLASS:Class',
	'10:45-11:30:CLASS:Class',
	'11:30-12:15:CLASS:Class',
	'12:15-13:00:BREAK:Lunch Break',
];
const G7_SPECIAL_EXPECTED = [
	...G7_REGULAR_EXPECTED,
	'13:00-13:45:CLASS:Specialization',
	'13:45-14:30:CLASS:Specialization',
];

// Controls 3/4/5: the two G9/G10 families are pinned independently. Because this
// expected table is a literal, a re-introduced `...GRADE_9_10_REGULAR` spread
// that carried a REGULAR edit into the specialized scopes would fail it.
const G9_REGULAR_EXPECTED = [
	'11:30-12:15:BREAK:Lunch Break',
	'12:15-13:00:CLASS:Class',
	'13:00-13:45:CLASS:Class',
	'13:45-14:30:CLASS:Class',
	'14:30-15:15:CLASS:Class',
	'15:15-15:30:BREAK:Health Break',
	'15:30-16:15:CLASS:Class',
	'16:15-17:00:CLASS:Class',
	'17:00-17:45:CLASS:Class',
	'17:45-18:30:CLASS:Class',
];
const G9_SPECIAL_EXPECTED = [
	'09:45-10:30:CLASS:Specialization',
	'10:30-11:15:CLASS:Specialization',
	...G9_REGULAR_EXPECTED,
];

test('G9G10 control 1/2. all 16 scopes match the producer; G7/G8 stay byte-identical to the morning contract', () => {
	// Control 1: every scope equals the real producer exactly.
	for (const grade of GRADES) {
		for (const program of KNOWN_PROGRAM_TYPES) {
			assert.deepEqual(slotKey(slots(grade, program)), slotKey(getExpectedCanonicalSlots(grade, program)), `G${grade} ${program} must equal the producer output`);
		}
	}
	// Control 2: G7/G8 REGULAR and SPECIAL are unchanged (all four programs).
	for (const grade of [7, 8]) {
		assert.deepEqual(slotKey(slots(grade, 'REGULAR')), G7_REGULAR_EXPECTED, `G${grade} REGULAR must stay byte-identical`);
		for (const program of ['STE', 'SPA', 'SPS'] as ProgramType[]) {
			assert.deepEqual(slotKey(slots(grade, program)), G7_SPECIAL_EXPECTED, `G${grade} ${program} must stay byte-identical`);
		}
	}
});

test('G9G10 control 3/4/5. G9/G10 REGULAR and special scopes carry the shift-based lunch and independent literals', () => {
	for (const grade of [9, 10]) {
		// Control 3: 8 CLASS + 2 BREAK, lunch BREAK 11:30-12:15, first CLASS 12:15-13:00, span 420 minutes.
		const regular = slots(grade, 'REGULAR');
		assert.deepEqual(slotKey(regular), G9_REGULAR_EXPECTED, `G${grade} REGULAR must equal the ruling table`);
		assert.equal(regular.filter((row) => row.rowKind === 'CLASS').length, 8);
		assert.equal(regular.filter((row) => row.rowKind === 'BREAK').length, 2);
		assert.equal(regular[0].startTime, '11:30');
		assert.equal(regular[regular.length - 1].endTime, '18:30');
		const span = minutes(regular[regular.length - 1].endTime) - minutes(regular[0].startTime);
		assert.equal(span, 420, 'G9/G10 REGULAR full-grid span must be 420 minutes (8x45 + 45 lunch + 15 health)');
		const classShift = minutes(regular.filter((row) => row.rowKind === 'CLASS')[0].startTime);
		assert.equal(minutes('18:30') - classShift, 375, 'G9/G10 REGULAR CLASS shift window is 12:15-18:30 = 375 minutes');

		// Control 4/5: 10 CLASS + 2 BREAK, lunch 11:30-12:15, CLASS shift 09:45-18:30, two pre-lunch rows.
		for (const program of ['STE', 'SPA', 'SPS'] as ProgramType[]) {
			const special = slots(grade, program);
			assert.deepEqual(slotKey(special), G9_SPECIAL_EXPECTED, `G${grade} ${program} must equal the ruling table`);
			assert.equal(special.filter((row) => row.rowKind === 'CLASS').length, 10);
			assert.equal(special.filter((row) => row.rowKind === 'BREAK').length, 2);
			const preLunch = special.filter((row) => row.rowKind === 'CLASS' && minutes(row.startTime) < minutes('11:30'));
			assert.equal(preLunch.length, 2, `G${grade} ${program} pre-lunch specialization block must be two rows`);
			assert.deepEqual(preLunch.map((row) => `${row.startTime}-${row.endTime}`), ['09:45-10:30', '10:30-11:15']);
			assert.equal(
				special.some((row) => row.startTime === '11:15' && row.endTime === '12:00'),
				false,
				'the removed third pre-lunch specialization row must never reappear',
			);
			const classRows = special.filter((row) => row.rowKind === 'CLASS');
			assert.equal(minutes(classRows[0].startTime), minutes('09:45'));
			assert.equal(minutes(classRows[classRows.length - 1].endTime), minutes('18:30'), `G${grade} ${program} CLASS shift window is 09:45-18:30`);
		}
	}
});


const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;
const PROGRAMS: ProgramType[] = ['REGULAR', 'STE', 'SPA', 'SPS'];
const GRADES = [7, 8, 9, 10];

const TERM_CONTRACT: VerifiedTermContract = {
	schoolId: SCHOOL_ID,
	schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2029-2030' },
	format: 'TRIMESTER',
	terms: [
		{ identity: 'T1', displayLabel: 'First Trimester', order: 1, startDate: '2029-06-01', endDate: '2029-09-01' },
		{ identity: 'T2', displayLabel: 'Second Trimester', order: 2, startDate: '2029-09-02', endDate: '2030-01-01' },
		{ identity: 'T3', displayLabel: 'Third Trimester', order: 3, startDate: '2030-01-02', endDate: '2030-04-01' },
	],
	semanticRevision: 'A'.repeat(64),
	activeTerm: { identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
	activeTermState: { availability: 'RESOLVED', code: null, message: 'resolved', reachable: true, identity: 'T2' },
};

const ALL_PROGRAMS = ['REGULAR', 'STE', 'SPA', 'SPS'];
const FACULTY_IDS = [71, 72, 73, 74, 75, 76, 77, 78];

function sectionIdFor(grade: number, programIndex: number): number {
	return grade * 100 + programIndex;
}

function buildStakeholderClient(options: { specialEvents?: Array<Record<string, unknown>>; enableFlagCeremony?: boolean } = {}) {
	const writes: string[] = [];
	const recordWrite = (name: string) => (..._args: unknown[]) => { writes.push(name); return Promise.resolve({}); };

	const sections = GRADES.flatMap((grade) => PROGRAMS.map((programType, programIndex) => {
		const id = sectionIdFor(grade, programIndex);
		return {
			mirrorId: id, externalId: id, id, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID,
			name: `${grade}-${programType}`, gradeLevelId: 17 + (grade - 7), gradeLevelName: `Grade ${grade}`, displayOrder: grade,
			maxCapacity: 50, enrolledCount: 40, programType, programCode: programType, programName: programType,
			isSpecialProgram: programType !== 'REGULAR', tleProgramId: null, tleSpecialization: null, tleProgramCategory: null,
			homeRoomId: null, buildingZoneId: null, isActiveForScheduling: true, isStale: false,
		};
	}));
	const sectionExternalIds = sections.map((section) => section.id);

	const subjects = [
		{ id: 11, code: 'MATH', name: 'Mathematics', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: GRADES, programScopes: ALL_PROGRAMS, rotationFamily: null, modularOrder: null, minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null },
		{ id: 12, code: 'ENG', name: 'English', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: GRADES, programScopes: ALL_PROGRAMS, rotationFamily: null, modularOrder: null, minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null },
		{ id: 13, code: 'SCI_BIO', name: 'Science Biology', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: GRADES, programScopes: ['REGULAR'], rotationFamily: 'SCIENCE', modularOrder: 1, minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: 'SCIENCE' },
		{ id: 14, code: 'SCI_CHEM', name: 'Science Chemistry', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: GRADES, programScopes: ['REGULAR'], rotationFamily: 'SCIENCE', modularOrder: 2, minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: 'SCIENCE' },
		{ id: 15, code: 'SCI_PHY', name: 'Science Physics', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: GRADES, programScopes: ['REGULAR'], rotationFamily: 'SCIENCE', modularOrder: 3, minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: 'SCIENCE' },
		{ id: 99, code: 'HG', name: 'Homeroom Guidance', schedulingDisposition: 'REFERENCE_ONLY', gradeLevels: GRADES, programScopes: ALL_PROGRAMS, rotationFamily: null, modularOrder: null, minMinutesPerWeek: 0, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null },
	];

	const faculty = FACULTY_IDS.map((id, index) => ({ id, externalId: id, firstName: 'F', lastName: `${index}`, department: 'REGULAR', maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false, canTeachOutsideDepartment: true }));
	const schedulableSubjectIds = [11, 12, 13, 14, 15];
	const facultySubjects = FACULTY_IDS.flatMap((facultyId) => schedulableSubjectIds.map((subjectId, index) => ({ facultyId, subjectId, gradeLevels: GRADES, sectionIds: sectionExternalIds, id: facultyId * 100 + index })));

	// One exact canonical owner per (subject, section) pair.
	const ownership: any[] = [];
	for (const section of sections) {
		const applicable = section.programType === 'REGULAR' ? schedulableSubjectIds : [11, 12];
		for (const subjectId of applicable) {
			ownership.push({
				id: ownership.length + 1, subjectId, sectionId: section.id,
				facultyId: FACULTY_IDS[(section.id + subjectId) % FACULTY_IDS.length], facultySubjectId: ownership.length + 1,
			});
		}
	}

	const rooms = Array.from({ length: 8 }, (_, index) => ({ id: 200 + index, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: [], buildingId: 301, buildingZoneId: 'Z1', building: { gradeScope: GRADES } }));
	const buildings = [{ id: 301, name: 'Building 1', x: 0, y: 0 }];

	const policy = {
		id: 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, periodLengthMinutes: 45, periodsPerDay: 8,
		maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00', latestEndTime: '18:30', enforceConsecutiveBreakAsHard: false,
		enableTravelWellbeingChecks: false, maxWalkingDistanceMetersPerTransition: 120, maxBuildingTransitionsPerDay: 4,
		maxBackToBackTransitionsWithoutBuffer: 2, maxIdleGapMinutesPerDay: 60, avoidEarlyFirstPeriod: false, avoidLateLastPeriod: false,
		enableVacantAwareConstraints: false, targetFacultyDailyVacantMinutes: 60, targetSectionDailyVacantPeriods: 1,
		maxCompressedTeachingMinutesPerDay: 300, lunchStartTime: '12:15', lunchEndTime: '13:00', enforceLunchWindow: false,
		showSpecialEventsInGrid: true, enableFlagCeremony: options.enableFlagCeremony ?? false, flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30',
		enableRecess: false, recessStartTime: '09:00', recessEndTime: '09:15', enableLunchWindow: false,
		enableTleTwoPassPriority: true, allowFlexibleSubjectAssignment: false, allowConsecutiveLabSessions: false, constraintConfig: null,
	};

	const slotRows = GRADES.flatMap((grade) => PROGRAMS.flatMap((programType) =>
		getExpectedCanonicalSlots(grade, programType).map((slot, index) => ({
			id: grade * 1000 + PROGRAMS.indexOf(programType) * 100 + index + 1,
			schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, gradeLevel: grade, programType,
			startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind, isActive: true,
			subjectFamily: slot.subjectFamily ?? null, subjectLabel: slot.subjectLabel ?? null, dayOfWeek: null,
		})),
	));

	const client: any = {
		generationRun: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
		lockedSession: { count: async () => 0, findFirst: async () => null, findMany: async () => [], updateMany: recordWrite('lockedSession.updateMany') },
		lockedSessionAction: { count: async () => 0 },
		auditLog: { count: async () => 0, create: recordWrite('auditLog.create') },
		teachingLoadCycle: { findMany: async () => [] },
		subjectSectionOwnership: { count: async () => ownership.length, findMany: async () => ownership },
		schedulingPolicy: { findUnique: async () => policy },
		enrollProSchoolYearMirror: {
			findMany: async () => [{ enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: '2029-2030' }],
			findFirst: async () => ({ enrollProSchoolYearId: SCHOOL_YEAR_ID }),
			findUnique: async () => ({ isActive: true, isArchived: false, termContractCache: { schoolId: SCHOOL_ID, schoolYear: { id: SCHOOL_YEAR_ID }, format: 'TRIMESTER', terms: TERM_CONTRACT.terms }, termContractCachedAt: new Date('2029-01-01') }),
		},
		sectionMirror: { findMany: async () => sections, count: async () => sections.length },
		subject: { findMany: async () => subjects },
		facultyMirror: { findMany: async () => faculty },
		facultySubject: { findMany: async () => facultySubjects },
		room: { findMany: async () => rooms },
		building: { findMany: async () => buildings },
		facultyPreference: { findMany: async () => [] },
		// TEACHER-AVAILABILITY-AUTHORITY-C01: generation reads the reviewed
		// term-scoped availability authority.
		facultyAvailability: { findMany: async () => [] },
		policySpecialEvent: { findMany: async () => options.specialEvents ?? [] },
		gradeShiftWindow: { findMany: async () => [] },
		classProgramSlot: { findMany: async (args: any) => {
			const where = args?.where ?? {};
			return slotRows.filter((row) =>
				(where.gradeLevel == null || row.gradeLevel === where.gradeLevel)
				&& (where.programType === undefined || row.programType === where.programType)
				&& (where.isActive === undefined || row.isActive === where.isActive));
		} },
		classTemplate: { findMany: async () => PROGRAMS.map((programType) => ({ programType, periodLengthMinutes: 45, periodsPerDay: 8 })) },
		instructionalCohort: { findMany: async () => [] },
		sectionSnapshot: { findUnique: async () => null },
		publishedScheduleRevision: { count: async () => 0 },
		create: recordWrite('create'), update: recordWrite('update'), updateMany: recordWrite('updateMany'),
		delete: recordWrite('delete'), deleteMany: recordWrite('deleteMany'), upsert: recordWrite('upsert'),
		$transaction: recordWrite('$transaction'), $executeRaw: recordWrite('$executeRaw'), $queryRaw: async () => [],
	};
	return { client, writes, sections, ownership, rooms };
}

async function loadProductionAssembly(options: { specialEvents?: Array<Record<string, unknown>>; enableFlagCeremony?: boolean } = {}) {
	const built = buildStakeholderClient(options);
	const preflight = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client: built.client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(preflight.ok, true, `preflight must be ready: ${preflight.blockers.map((blocker) => blocker.code).join(', ')}`);
	assert.deepEqual(built.writes, [], 'the production preflight must be zero-write');
	const constructorInput = buildPreflightConstructorInput(preflight.assembly, {});
	const result = runHybridScheduler(constructorInput);
	return { ...built, preflight, assembly: preflight.assembly, result, constructorInput };
}

test('G9G10 control 6. per-scope Flag/HGP resolution readies all 16 scopes x 3 terms with zero FLAG_CEREMONY_SCOPE_INVALID', async () => {
	// Two SCOPED persisted rows, morning first (the order that made the old
	// single-global-window resolution report 8 G9/G10 blockers):
	//   - G7/G8   06:00-06:45 -> the first canonical morning CLASS row
	//   - G9/G10  12:15-13:00 -> the first canonical afternoon CLASS row
	const scopedFlagRows = [
		{ eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony / HGP', startTime: '06:00', endTime: '06:45', dayOfWeek: null, gradeGroup: '7-8', programType: null, enabled: true, sortOrder: 1 },
		{ eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony / HGP', startTime: '12:15', endTime: '13:00', dayOfWeek: null, gradeGroup: '9-10', programType: null, enabled: true, sortOrder: 2 },
	];
	const { preflight, assembly } = await loadProductionAssembly({ specialEvents: scopedFlagRows, enableFlagCeremony: true });
	assert.equal(
		preflight.blockers.some((blocker) => blocker.code === 'FLAG_CEREMONY_SCOPE_INVALID'),
		false,
		`no scope may fail the per-scope snap: ${preflight.blockers.map((blocker) => `${blocker.code}@${blocker.entity}`).join(', ')}`,
	);
	assert.equal(assembly.timetableShapeContracts.length, 16, 'the fixture must expose all 16 grade/program scopes');
	assert.equal(assembly.derived?.termStructure.terms.length, 3, 'the fixture runs the ordered three-term contract');

	// Every shape's own scoped flag window snaps onto exactly one of its own CLASS rows.
	for (const shape of assembly.timetableShapeContracts) {
		const classRows = (shape.canonicalSlots ?? []).filter((slot) => slot.rowKind === 'CLASS');
		const expectedWindow = shape.gradeLevel <= 8 ? '06:00-06:45' : '12:15-13:00';
		assert.ok(
			classRows.some((row) => `${row.startTime}-${row.endTime}` === expectedWindow),
			`Grade ${shape.gradeLevel} ${shape.programType} must own the scoped flag row ${expectedWindow}`,
		);
	}
});

test('G9G10 control 7. the Flag/HGP overlay adds no demand, no Teaching Load minutes, and no period', async () => {
	const baseline = await loadProductionAssembly();
	const withFlag = await loadProductionAssembly({
		specialEvents: [
			{ eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony / HGP', startTime: '06:00', endTime: '06:45', dayOfWeek: null, gradeGroup: '7-8', programType: null, enabled: true, sortOrder: 1 },
			{ eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony / HGP', startTime: '12:15', endTime: '13:00', dayOfWeek: null, gradeGroup: '9-10', programType: null, enabled: true, sortOrder: 2 },
		],
		enableFlagCeremony: true,
	});
	assert.deepEqual(withFlag.assembly.demand, baseline.assembly.demand, 'the Monday overlay must add no demand line');
	assert.deepEqual(withFlag.assembly.derived?.totalsByTerm, baseline.assembly.derived?.totalsByTerm, 'the Monday overlay must add no Teaching Load minutes');
	assert.deepEqual(withFlag.assembly.pairOwners, baseline.assembly.pairOwners, 'the Monday overlay must add no ownership pair');
	assert.equal(withFlag.preflight.ok, true, 'the flagged assembly must stay ready');

	// No added period: each shape keeps exactly its canonical CLASS period grid.
	for (const shape of withFlag.assembly.timetableShapeContracts) {
		const canonicalClass = (shape.canonicalSlots ?? []).filter((slot) => slot.rowKind === 'CLASS');
		assert.equal(shape.periodSlots.length, canonicalClass.length, `Grade ${shape.gradeLevel} ${shape.programType} must not gain a period from the overlay`);
	}
});

test('F2. production readiness assembly + scheduler conform to the exact grade/program canonical CLASS rows', async () => {
	const { assembly, result, sections } = await loadProductionAssembly();
	const scope = buildSectionScopeMap(assembly.sectionsByGrade);
	const sectionById = new Map(sections.map((section) => [section.id, section]));
	assert.ok(result.entries.length > 0, 'the production scheduler must place entries');

	for (const entry of result.entries as ScheduledEntry[]) {
		const entryScope = scope.get(entry.sectionId);
		assert.ok(entryScope, `entry section ${entry.sectionId} must resolve to a grade/program scope`);
		const shape = resolveTimetableShapeContract(assembly.timetableShapeContracts, entryScope!.gradeLevel, entryScope!.programType);
		assert.ok(shape, `grade ${entryScope!.gradeLevel} ${entryScope!.programType} must have a shape contract`);
		const canonicalClass = new Set((shape!.canonicalSlots ?? []).filter((slot) => slot.rowKind === 'CLASS').map((slot) => `${slot.startTime}-${slot.endTime}`));
		const key = `${entry.startTime}-${entry.endTime}`;
		assert.ok(canonicalClass.has(key), `entry ${key} for grade ${entryScope!.gradeLevel} ${entryScope!.programType} must be a canonical CLASS row`);

		// Break rows can never host a class.
		const breakRows = new Set((shape!.canonicalSlots ?? []).filter((slot) => slot.rowKind === 'BREAK').map((slot) => `${slot.startTime}-${slot.endTime}`));
		assert.equal(breakRows.has(key), false, `break row ${key} must not host a class`);
		// Wrong row-kind slots are never class candidates.
		const candidateKeys = new Set(shape!.periodSlots.map((slot) => `${slot.startTime}-${slot.endTime}`));
		assert.ok(candidateKeys.has(key), 'every placed entry must come from the shape period slots');

		if (entryScope!.gradeLevel <= 8) {
			assert.ok(minutes(entry.startTime) >= minutes('06:00'), `G${entryScope!.gradeLevel} entry must not start before 06:00`);
			assert.ok(minutes(entry.endTime) <= minutes('15:30'), `G${entryScope!.gradeLevel} entry must stay in the morning frame`);
		} else {
			assert.ok(minutes(entry.startTime) >= minutes('09:45'), `G${entryScope!.gradeLevel} entry must not start before 09:45`);
			assert.ok(minutes(entry.endTime) <= minutes('18:30'), `G${entryScope!.gradeLevel} entry must stay in the afternoon frame`);
		}
		assert.ok(sectionById.has(entry.sectionId));
	}
});

test('F2. the display/export resolver equals the generated canonical rows with stable ordering', async () => {
	const { assembly } = await loadProductionAssembly();
	for (const shape of assembly.timetableShapeContracts) {
		const canonical = (shape.canonicalSlots ?? []).map((slot) => `${slot.startTime}-${slot.endTime}`).sort((a, b) => minutes(a.split('-')[0]) - minutes(b.split('-')[0]));
		const displayed = shape.displaySlots.map((slot) => `${slot.startTime}-${slot.endTime}`);
		assert.deepEqual(displayed, canonical, `grade ${shape.gradeLevel} ${shape.programType} display rows must equal canonical rows`);
		// Display order is start-time stable.
		const ordered = [...shape.displaySlots].sort((a, b) => minutes(a.startTime) - minutes(b.startTime));
		assert.deepEqual(shape.displaySlots.map((slot) => slot.startTime), ordered.map((slot) => slot.startTime));
	}
	const union = buildUnionDisplaySlots(assembly.timetableShapeContracts);
	const unionKeys = new Set(union.map((slot) => `${slot.startTime}-${slot.endTime}`));
	for (const shape of assembly.timetableShapeContracts) {
		for (const slot of shape.displaySlots) {
			assert.ok(unionKeys.has(`${slot.startTime}-${slot.endTime}`), 'the display/export union must include every generated canonical row');
		}
	}
});

test('F2. HG stays reference-only and unscheduled; rotation terms stay explicit', async () => {
	const { assembly } = await loadProductionAssembly();
	assert.equal(assembly.schedulableSubjects.some((subject: any) => subject.code === 'HG'), false, 'HG must not be a schedulable subject');
	assert.equal(assembly.demand.some((item) => item.subjectId === 99), false, 'HG must not appear in scheduler demand');
	assert.equal((assembly.derived?.timetableLines ?? []).some((line) => line.subjectCode === 'HG'), false, 'HG must not appear in canonical demand');
	const rotation = assembly.perTermDemandLines.filter((line) => line.rotationFamily === 'SCIENCE');
	const bio = rotation.find((line) => line.subjectId === 13);
	const chem = rotation.find((line) => line.subjectId === 14);
	const phy = rotation.find((line) => line.subjectId === 15);
	assert.equal(bio?.termIdentity, 'T1');
	assert.equal(chem?.termIdentity, 'T2');
	assert.equal(phy?.termIdentity, 'T3');
	const termCount = assembly.derived!.termStructure.terms.length;
	const mathLines = assembly.perTermDemandLines.filter((line) => line.subjectId === 11);
	assert.ok(mathLines.length > 0);
	for (const line of mathLines) {
		assert.equal(line.termMode, 'ALL');
	}
	for (const sectionExternalId of new Set(mathLines.map((line) => line.sectionExternalId))) {
		assert.equal(mathLines.filter((line) => line.sectionExternalId === sectionExternalId).length, termCount, 'non-rotation subjects run in every ordered term');
	}
});

test('F2. readiness exposes the same revisions, demand totals, owners, shapes, and validator policy as the shared preflight', async () => {
	const { client, preflight, assembly } = await loadProductionAssembly();
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(readiness.schedulerExecuted, true, 'readiness must run the real scheduler');
	assert.equal(readiness.databaseSignature.zeroWrite, true, 'readiness must be zero-write');
	assert.equal(readiness.preflight.sourceRevision, assembly.revisions.sourceRevision, 'readiness and preflight must bind the same source revision');
	assert.equal(readiness.preflight.derivedDemandRevision, assembly.derivedDemandRevision);
	assert.equal(readiness.preflight.termStructureRevision, assembly.termStructure?.semanticRevision);
	assert.deepEqual(readiness.preflight.demandByTerm, assembly.derived?.totalsByTerm);
	assert.deepEqual(readiness.preflight.pairOwners, assembly.pairOwners);
	assert.deepEqual(readiness.preflight.shapeSignatures, assembly.timetableShapeContracts.map((shape) => ({
		gradeLevel: shape.gradeLevel,
		programType: shape.programType,
		classRows: (shape.canonicalSlots ?? []).filter((slot) => slot.rowKind === 'CLASS').map((slot) => `${slot.startTime}-${slot.endTime}`),
		displayRows: shape.displaySlots.map((slot) => `${slot.startTime}-${slot.endTime}${slot.isSpecialEvent ? ':event' : ''}`),
	})));
	assert.deepEqual(readiness.preflight.validatorPolicy, {
		periodLengthMinutes: assembly.policy.periodLengthMinutes,
		periodsPerDay: assembly.policy.periodsPerDay,
		maxTeachingMinutesPerDay: (assembly.policyRow as any)?.maxTeachingMinutesPerDay ?? null,
		enforceConsecutiveBreakAsHard: (assembly.policyRow as any)?.enforceConsecutiveBreakAsHard ?? null,
	});
	assert.ok(readiness.decisionNotes.some((note) => note.includes('ARAL') && note.includes('Friday')), 'the Friday ARAL/TLE note must remain an explicit unresolved decision');
	assert.equal(STAKEHOLDER_DECISION_NOTES.some((note) => note.includes('ARAL')), true);
});

test('F3. a wrong-shift entry with zero generic hard violations is still a typed HARD canonical-shape blocker', async () => {
	const { assembly, sections, rooms, ownership } = await loadProductionAssembly();
	const grade9 = sections.find((section) => section.gradeLevelId === 19 && section.programType === 'REGULAR')!;
	const grader9Scope = buildSectionScopeMap(assembly.sectionsByGrade).get(grade9.id)!;
	assert.equal(grader9Scope.gradeLevel, 9);

	const owner = ownership.find((row) => row.sectionId === grade9.id && row.subjectId === 11)!.facultyId;
	const smuggled: ScheduledEntry = {
		entryId: 'mutant-wrong-shift',
		facultyId: owner,
		roomId: rooms[0].id,
		subjectId: 11,
		sectionId: grade9.id,
		day: 'MONDAY',
		startTime: '06:00',
		endTime: '06:45',
		durationMinutes: 45,
		termIndex: 1,
		entryKind: 'SECTION',
	};

	// The generic hard-constraint validator reports zero violations for this entry.
	const generic = validateHardConstraints(buildPreflightValidatorContext(assembly, [smuggled], 0));
	assert.equal(generic.violations.filter((violation) => violation.severity === 'HARD').length, 0, 'the generic validator must report zero hard violations');

	// The canonical shape resolver must still reject it with an exact explanation.
	const shapeBlockers = validateCanonicalEntryShapes([smuggled], assembly.timetableShapeContracts, buildSectionScopeMap(assembly.sectionsByGrade));
	const blocker = shapeBlockers.find((entry) => entry.code === 'CANONICAL_SHAPE_VIOLATION');
	assert.ok(blocker, 'the wrong-shift entry must produce CANONICAL_SHAPE_VIOLATION');
	assert.equal(blocker?.category, 'POLICY_BLOCKER');
	assert.equal(blocker?.sectionId, grade9.id);
	assert.ok(blocker?.entity.includes('grade 9') && blocker?.entity.includes('06:00-06:45'), `explanation must name grade/program/row: ${blocker?.entity}`);
});

test('F3 control. The old helper-only assertion would not detect the injected entry', () => {
	// The helper knows the row is not a Grade 9 CLASS row...
	assert.equal(getExpectedCanonicalSlots(9, 'REGULAR').some((row) => row.startTime === '06:00' && row.rowKind === 'CLASS'), false);
	// ...but the helper only inspects its own catalog: it never consumes a
	// scheduled entry, so it cannot fail on the injected wrong-shift entry.
	let helperDetectedEntry = false;
	for (const row of getExpectedCanonicalSlots(9, 'REGULAR')) {
		if (row.startTime === '06:00' && row.endTime === '06:45') helperDetectedEntry = true;
	}
	assert.equal(helperDetectedEntry, false, 'the helper-only catalog check never sees the smuggled entry and reports no violation for it');
});

// ─── FLAG-WINDOW-PER-SCOPE-C01: authority-source discrimination ────────────
//
// The preflight blocker decision and the constructor's `resolvePolicyFlagOverlaySlots`
// must agree per scope. Explicit per-scope configuration fails closed when it
// cannot snap; the school-wide global policy window is a default that simply does
// not apply to a grid it cannot fit (the live G9/G10 afternoon defect).
//
// `resolvePolicyFlagOverlaySlots` is module-private and must not be edited, so it
// is exercised through its real exported production callers
// (`buildSpecialEventSlots` / `resolveCanonicalDisplayScope`) — the exact code
// path `schedule-constructor.ts:346` uses.

type FlagRow = {
	eventType: string;
	label: string;
	startTime: string;
	endTime: string;
	dayOfWeek: string | null;
	gradeGroup: string | null;
	programType: string | null;
	enabled: boolean;
	sortOrder?: number;
};

function flagRow(overrides: Partial<FlagRow> = {}): FlagRow {
	return {
		eventType: 'FLAG_OR_HGP',
		label: 'Flag Ceremony / HGP',
		startTime: '07:00',
		endTime: '07:30',
		dayOfWeek: null,
		gradeGroup: null,
		programType: null,
		enabled: true,
		sortOrder: 1,
		...overrides,
	};
}

function canonicalDisplayRows() {
	return GRADES.flatMap((grade) => PROGRAMS.flatMap((program) =>
		getExpectedCanonicalSlots(grade, program).map((slot) => ({
			gradeLevel: grade,
			programType: program as string,
			startTime: slot.startTime,
			endTime: slot.endTime,
			rowKind: slot.rowKind,
			subjectLabel: slot.subjectLabel ?? null,
			dayOfWeek: null,
		})),
	));
}

function flagEvents(rawEvents: FlagRow[]): FlagRow[] {
	return rawEvents
		.filter((event) => isFlagCeremonyEvent(event.eventType, event.label))
		.filter((event) => !isRejectedFlagCeremonyRow(event.eventType, event.dayOfWeek, event.label));
}

async function loadFlagPreflight(options: { specialEvents?: FlagRow[]; enableFlagCeremony?: boolean }) {
	const built = buildStakeholderClient(options as { specialEvents?: Array<Record<string, unknown>>; enableFlagCeremony?: boolean });
	const preflight = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client: built.client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(preflight.assembly.timetableShapeContracts.length, 16, 'the fixture must expose all 16 grade/program scopes');
	return { ...built, preflight };
}

function flagBlockers(preflight: { blockers: Array<{ code: string; entity: string; category: string; owningSurface: string; nextAction: string }> }) {
	return preflight.blockers.filter((blocker) => blocker.code === 'FLAG_CEREMONY_SCOPE_INVALID');
}

/** The producer's overlay for one scope, through the real exported caller of `resolvePolicyFlagOverlaySlots`. */
function producerFlagOverlay(rows: ReturnType<typeof canonicalDisplayRows>, policy: unknown, rawEvents: FlagRow[], gradeLevel: number, programType: string) {
	const scoped = getEffectiveEvents(flagEvents(rawEvents), gradeLevel, programType);
	const canonical = resolveCanonicalDisplayScope({ rows, gradeLevel, programType });
	const slots = buildSpecialEventSlots({ ...(policy as Record<string, unknown>), specialEvents: scoped } as never, canonical);
	return slots.filter((slot) => slot.isSpecialEvent && /flag|hgp/i.test(slot.eventName ?? ''));
}

test('FLAG-WINDOW-PER-SCOPE-C01 control A. the live-shape state (0 scoped rows + global 07:00-07:30) blocks no scope', async () => {
	// Exact live active-year state: `policy_special_events` empty, `enableFlagCeremony`
	// true, `flagCeremonyStartTime/EndTime` 07:00/07:30, and 16 scope grids whose
	// afternoon (G9/G10) CLASS rows start at 09:45/12:15 and never contain 07:00-07:30.
	//
	// Failing-first: on the unmodified base this fixture reports exactly 8 blockers
	// (Grade 9/10 x REGULAR|STE|SPA|SPS); the global morning default must not apply
	// to a grid that cannot contain it.
	const { preflight, writes } = await loadFlagPreflight({ specialEvents: [], enableFlagCeremony: true });
	assert.equal(preflight.assembly.policyRow?.enableFlagCeremony, true);
	assert.equal(preflight.assembly.policyRow?.flagCeremonyStartTime, '07:00');
	assert.equal(preflight.assembly.policyRow?.flagCeremonyEndTime, '07:30');
	const blockers = flagBlockers(preflight as never);
	assert.deepEqual(blockers, [], `the inapplicable global morning default must block no scope: ${blockers.map((b) => b.entity).join(', ')}`);
	// The morning scopes still resolve their unchanged overlay.
	const rows = canonicalDisplayRows();
	for (const grade of [7, 8]) {
		for (const program of PROGRAMS) {
			assert.equal(producerFlagOverlay(rows, preflight.assembly.policy, [], grade, program).length, 1, `G${grade} ${program} keeps the global overlay`);
		}
	}
	assert.deepEqual(writes, [], 'control A is zero-write');
});

test('FLAG-WINDOW-PER-SCOPE-C01 control B. an explicit scoped flag row that cannot snap stays fail-closed, exactly one blocker per affected scope', async () => {
	// A persisted row scoped to Grade 9-10 STE only. `getEffectiveEvents` resolves it
	// for G9 STE and G10 STE; every other scope has NO scoped row and stays
	// unblocked. 07:00-08:00 is contained by no afternoon CLASS row.
	const rawEvents = [flagRow({ gradeGroup: '9-10', programType: 'STE', startTime: '07:00', endTime: '08:00' })];
	const { preflight, writes } = await loadFlagPreflight({ specialEvents: rawEvents, enableFlagCeremony: true });
	const blockers = flagBlockers(preflight as never);
	assert.equal(blockers.length, 2, `only the two explicitly configured scopes may block: ${blockers.map((b) => b.entity).join(', ')}`);
	assert.deepEqual(blockers.map((blocker) => blocker.entity).sort(), ['Flag Ceremony/HGP · Grade 10 STE', 'Flag Ceremony/HGP · Grade 9 STE']);
	for (const blocker of blockers) {
		assert.equal(blocker.category, 'POLICY_BLOCKER');
		assert.equal(blocker.owningSurface, 'Scheduling policy / special events');
		assert.match(blocker.nextAction, /configured per-scope Flag\/HGP window/);
	}
	assert.equal(preflight.ok, false, 'an explicit scoped misconfiguration keeps the preflight blocked');
	// The constructor agrees: neither scoped shape renders an overlay.
	const rows = canonicalDisplayRows();
	for (const grade of [9, 10]) {
		assert.equal(producerFlagOverlay(rows, preflight.assembly.policy, rawEvents, grade, 'STE').length, 0, `G${grade} STE renders no overlay`);
	}
	assert.deepEqual(writes, [], 'control B is zero-write');
});

test('FLAG-WINDOW-PER-SCOPE-C01 control B mutant discriminator. the scoped fail-closed blocker is load-bearing', async () => {
	// Mutant: making the scoped case permissive (treating an unsnapped explicit
	// scoped row like the inapplicable global default) makes control B report zero
	// blockers. The real production decision is fail-closed (2), so control B fails
	// under the mutant. The executed source mutation is recorded in the handoff.
	const rawEvents = [flagRow({ gradeGroup: '9-10', programType: 'STE', startTime: '07:00', endTime: '08:00' })];
	const { preflight } = await loadFlagPreflight({ specialEvents: rawEvents, enableFlagCeremony: true });
	assert.equal(flagBlockers(preflight as never).length, 2, 'the real production decision is fail-closed');
	const permissiveMutantBlocked = 0;
	assert.notEqual(flagBlockers(preflight as never).length, permissiveMutantBlocked, 'the permissive mutant would report zero blockers');
});

test('FLAG-WINDOW-PER-SCOPE-C01 control C. production-shape parity over 16 scopes x 3 authority cases', async () => {
	const cases: Array<{ name: string; events: FlagRow[]; enableFlagCeremony: boolean }> = [
		{ name: 'global-only', events: [], enableFlagCeremony: true },
		{ name: 'scoped-snapping', events: [flagRow({ gradeGroup: '7-8', startTime: '06:00', endTime: '06:45' }), flagRow({ gradeGroup: '9-10', startTime: '12:15', endTime: '13:00' })], enableFlagCeremony: true },
		{ name: 'scoped-non-snapping', events: [flagRow({ gradeGroup: '9-10', programType: 'STE', startTime: '07:00', endTime: '08:00' })], enableFlagCeremony: true },
	];
	const rows = canonicalDisplayRows();
	let parityRows = 0;
	let blockerTotal = 0;
	let overlayTotal = 0;
	for (const authorityCase of cases) {
		const { preflight, writes } = await loadFlagPreflight({ specialEvents: authorityCase.events, enableFlagCeremony: authorityCase.enableFlagCeremony });
		assert.deepEqual(writes, [], `${authorityCase.name}: zero writes`);
		const blockerEntities = new Set(flagBlockers(preflight as never).map((blocker) => blocker.entity));
		for (const shape of preflight.assembly.timetableShapeContracts as Array<{ gradeLevel: number; programType: string }>) {
			const scoped = getEffectiveEvents(flagEvents(authorityCase.events), shape.gradeLevel, shape.programType);
			const overlay = producerFlagOverlay(rows, preflight.assembly.policy, authorityCase.events, shape.gradeLevel, shape.programType);
			const entity = `Flag Ceremony/HGP · Grade ${shape.gradeLevel} ${shape.programType}`;
			const blocked = blockerEntities.has(entity);
			const hasScoped = scoped.length > 0;
			const context = `${authorityCase.name} G${shape.gradeLevel} ${shape.programType}`;
			// Conservation: the constructor emits at most one overlay per shape.
			assert.ok(overlay.length <= 1, `${context}: the producer emits at most one overlay`);
			// Parity: explicit scoped authority blocks iff the producer renders
			// nothing; an inapplicable global default never blocks.
			assert.equal(blocked, hasScoped && overlay.length === 0, `${context}: blocker=${blocked} hasScoped=${hasScoped} overlays=${overlay.length}`);
			if (authorityCase.name === 'global-only' && shape.gradeLevel <= 8) {
				assert.equal(overlay.length, 1, `${context}: the morning scope keeps the global overlay`);
			}
			if (authorityCase.name === 'global-only' && shape.gradeLevel > 8) {
				assert.equal(overlay.length, 0, `${context}: the inapplicable global default renders no overlay`);
			}
			parityRows += 1;
			if (blocked) blockerTotal += 1;
			overlayTotal += overlay.length;
		}
	}
	assert.equal(parityRows, 48, '16 scopes x 3 authority cases');
	// global-only 0 blockers / 8 morning overlays; scoped-snapping 0 blockers / 16
	// overlays; scoped-non-snapping 2 blockers (G9/G10 STE) / 8 morning fallbacks.
	assert.equal(blockerTotal, 2, 'only the explicitly misconfigured scoped shapes block across all 48 rows');
	assert.equal(overlayTotal, 32, 'overlay conservation across the three authority cases');
});
