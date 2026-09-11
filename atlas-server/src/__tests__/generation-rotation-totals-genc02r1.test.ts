/**
 * GEN-C02R1 Finding F4 — exact nonuniform rotating-family totals.
 *
 * Run: `npx tsx src/__tests__/generation-rotation-totals-genc02r1.test.ts`
 *
 * Proves, through the shared production preflight assembly and the scheduler
 * projection, that a rotating family whose members have UNEQUAL weekly minutes
 * and session counts keeps each member's exact ordered term, weekly minutes,
 * session count, canonical owner, and room requirement for BOTH the three-term
 * (TRIMESTER) and four-term (QUARTERS) contracts. The scheduler projection must
 * fail closed with ROTATION_DEMAND_INCONSISTENT and produce zero writes. A
 * negative-control family-maximum collapse passes identity-only coverage while
 * producing wrong per-term totals, and the corrected assertion fails it.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	assertPerTermDemandParity,
	buildDerivedDemand,
	deriveCanonicalDemand,
	toPerTermDemandLines,
	toSchedulerDemandOverride,
	type DerivedDemandInput,
	type DerivedDemandSuccess,
	type DerivedPerTermDemandLine,
	type DerivedSubjectInput,
} from '../services/derived-demand.service.js';
import { getExpectedCanonicalSlots } from '../services/class-program-slot.service.js';
import { buildGenerationPreflight } from '../services/generation-preflight.service.js';
import type { SectionsByGrade } from '../services/section-adapter.js';
import type { ConstructorInput } from '../services/schedule-constructor.js';

const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;
const PERIOD_LENGTH = 45;

// Unequal rotating-family members: BIO 135m (3), CHEM 225m (5), PHY 180m (4),
// EARTH 90m (2). No two members share a weekly minutes/session total.
const ROTATION_MEMBERS: Array<{ id: number; code: string; order: number; minutes: number }> = [
	{ id: 13, code: 'SCI_BIO', order: 1, minutes: 135 },
	{ id: 14, code: 'SCI_CHEM', order: 2, minutes: 225 },
	{ id: 15, code: 'SCI_PHY', order: 3, minutes: 180 },
	{ id: 16, code: 'SCI_EARTH', order: 4, minutes: 90 },
];

function termContract(format: 'TRIMESTER' | 'QUARTERS') {
	const count = format === 'TRIMESTER' ? 3 : 4;
	return Array.from({ length: count }, (_, index) => ({
		identity: `T${index + 1}`,
		displayLabel: `Term ${index + 1}`,
		order: index + 1,
		startDate: `2029-0${index + 1}-01`,
		endDate: `2029-0${index + 1}-28`,
	}));
}

function rotationSubjects(format: 'TRIMESTER' | 'QUARTERS', editor?: (subject: DerivedSubjectInput) => DerivedSubjectInput): DerivedSubjectInput[] {
	const count = format === 'TRIMESTER' ? 3 : 4;
	const base = (overrides: Partial<DerivedSubjectInput> & Pick<DerivedSubjectInput, 'id' | 'code'>): DerivedSubjectInput => ({
		name: overrides.code,
		schedulingDisposition: 'SCHEDULED_TEACHING',
		gradeLevels: [7],
		programScopes: ['REGULAR'],
		rotationFamily: null,
		modularOrder: null,
		minMinutesPerWeek: 180,
		isActive: true,
		preferredRoomType: 'LABORATORY',
		requiredFeatures: ['SINK'],
		...overrides,
	});
	const subjects = [
		base({ id: 11, code: 'MATH', minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', requiredFeatures: [] }),
		...ROTATION_MEMBERS.slice(0, count).map((member) => base({
			id: member.id,
			code: member.code,
			rotationFamily: 'SCIENCE',
			modularOrder: member.order,
			minMinutesPerWeek: member.minutes,
		})),
	];
	return editor ? subjects.map(editor) : subjects;
}

function derivedInput(format: 'TRIMESTER' | 'QUARTERS', editor?: (subject: DerivedSubjectInput) => DerivedSubjectInput): DerivedDemandInput {
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		yearLabel: '2029-2030',
		termFormat: format,
		termStructureRevision: 'A'.repeat(64),
		terms: termContract(format),
		sections: [{ sectionMirrorId: 501, externalId: 9001, gradeLevel: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false }],
		subjects: rotationSubjects(format, editor),
		periodLengthMinutes: PERIOD_LENGTH,
	};
}

function sectionsByGrade(): SectionsByGrade[] {
	return [{
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		sections: [{ mirrorId: 501, id: 9001, name: '7-A', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' }],
	}];
}

function asSubjectInputs(format: 'TRIMESTER' | 'QUARTERS'): ConstructorInput['subjects'] {
	return rotationSubjects(format).map((s) => ({
		id: s.id, code: s.code, name: s.name, minMinutesPerWeek: s.minMinutesPerWeek,
		preferredRoomType: s.preferredRoomType as ConstructorInput['subjects'][number]['preferredRoomType'],
		gradeLevels: s.gradeLevels, programScopes: s.programScopes, requiredFeatures: s.requiredFeatures,
	}));
}

function assertPerTermTotals(format: 'TRIMESTER' | 'QUARTERS', result: DerivedDemandSuccess, lines: DerivedPerTermDemandLine[]): void {
	const termCount = format === 'TRIMESTER' ? 3 : 4;
	const members = ROTATION_MEMBERS.slice(0, termCount);
	for (const member of members) {
		const line = lines.find((entry) => entry.subjectId === member.id);
		assert.ok(line, `${format} must project ${member.code}`);
		assert.equal(line?.termIdentity, `T${member.order}`, `${member.code} must bind its own ordered term`);
		assert.equal(line?.termIndex, member.order);
		assert.equal(line?.weeklyMinutes, member.minutes, `${member.code} must keep its own weekly minutes`);
		assert.equal(line?.sessionsPerWeek, Math.ceil(member.minutes / PERIOD_LENGTH), `${member.code} must keep its own session count`);
		assert.equal(line?.durationPerSession, Math.ceil(member.minutes / Math.ceil(member.minutes / PERIOD_LENGTH)));
		assert.equal(line?.rotationFamily, 'SCIENCE');
		assert.equal(line?.ownerFacultyId, 71, `${member.code} must bind the exact canonical owner`);
	}
	// No duplicate and no dropped effective sessions: exactly one line per member term.
	const rotationKeys = lines.filter((line) => line.rotationFamily === 'SCIENCE').map((line) => `${line.subjectId}:${line.sectionExternalId}:${line.termIdentity}`);
	assert.equal(new Set(rotationKeys).size, rotationKeys.length, 'no duplicate rotation term lines');
	assert.equal(rotationKeys.length, termCount, 'one rotation term line per ordered term');
	assertPerTermDemandParity(result, lines);
}

test('F4. TRIMESTER nonuniform rotation keeps exact per-term totals through the production projection', () => {
	const result = deriveCanonicalDemand(derivedInput('TRIMESTER'));
	assert.equal(result.ok, true);
	if (!result.ok) return;

	const ownerByPair = { '13:9001': 71, '14:9001': 71, '15:9001': 71, '11:9001': 71 };
	const lines = toPerTermDemandLines(result, ownerByPair);
	assertPerTermTotals('TRIMESTER', result, lines);

	// The collapsed scheduler lane must fail closed rather than use the family maximum.
	assert.throws(
		() => toSchedulerDemandOverride(result, sectionsByGrade(), asSubjectInputs('TRIMESTER')),
		(error: unknown) => (error as { code?: string }).code === 'ROTATION_DEMAND_INCONSISTENT',
	);
});

test('F4. QUARTERS nonuniform rotation keeps exact per-term totals through the production projection', () => {
	const result = deriveCanonicalDemand(derivedInput('QUARTERS'));
	assert.equal(result.ok, true);
	if (!result.ok) return;

	const ownerByPair = { '13:9001': 71, '14:9001': 71, '15:9001': 71, '16:9001': 71, '11:9001': 71 };
	const lines = toPerTermDemandLines(result, ownerByPair);
	assertPerTermTotals('QUARTERS', result, lines);

	assert.throws(
		() => toSchedulerDemandOverride(result, sectionsByGrade(), asSubjectInputs('QUARTERS')),
		(error: unknown) => (error as { code?: string }).code === 'ROTATION_DEMAND_INCONSISTENT',
	);
});

test('F4. changing one rotation member changes only that term projection and the source revision', () => {
	const before = deriveCanonicalDemand(derivedInput('QUARTERS'));
	const after = deriveCanonicalDemand(derivedInput('QUARTERS', (subject) => subject.id === 14 ? { ...subject, minMinutesPerWeek: 270 } : subject));
	assert.equal(before.ok, true);
	assert.equal(after.ok, true);
	if (!before.ok || !after.ok) return;

	assert.notEqual(after.revision, before.revision, 'a member change must change the derived revision');
	const beforeLines = toPerTermDemandLines(before);
	const afterLines = toPerTermDemandLines(after);
	const changedKeys: string[] = [];
	for (const member of ROTATION_MEMBERS.slice(0, 4)) {
		const beforeLine = beforeLines.find((line) => line.subjectId === member.id)!;
		const afterLine = afterLines.find((line) => line.subjectId === member.id)!;
		if (beforeLine.weeklyMinutes !== afterLine.weeklyMinutes) changedKeys.push(member.code);
	}
	assert.deepEqual(changedKeys, ['SCI_CHEM'], 'only the edited member term may change');
	assert.equal(afterLines.find((line) => line.subjectId === 14)?.sessionsPerWeek, 6);
	// Other terms are untouched and remain exact.
	assertPerTermDemandParity(before, beforeLines);
	assertPerTermDemandParity(after, afterLines);
});

test('F4 mutant control. Family-maximum collapse passes identity coverage but fails exact per-term totals', () => {
	const result = deriveCanonicalDemand(derivedInput('QUARTERS'));
	assert.equal(result.ok, true);
	if (!result.ok) return;

	const canonical = toPerTermDemandLines(result);
	const familyMaxMinutes = Math.max(...ROTATION_MEMBERS.slice(0, 4).map((member) => member.minutes));
	const familyMaxSessions = Math.ceil(familyMaxMinutes / PERIOD_LENGTH);
	// The former loophole: every ordered term takes the family maximum.
	const mutant: DerivedPerTermDemandLine[] = canonical.map((line) =>
		line.rotationFamily === 'SCIENCE'
			? { ...line, weeklyMinutes: familyMaxMinutes, sessionsPerWeek: familyMaxSessions, durationPerSession: familyMaxMinutes }
			: line,
	);

	// Identity-only coverage still matches the canonical (subject, section, term) set.
	const canonicalKeys = new Set(canonical.map((line) => `${line.subjectId}:${line.sectionExternalId}:${line.termIdentity}`));
	const mutantKeys = new Set(mutant.map((line) => `${line.subjectId}:${line.sectionExternalId}:${line.termIdentity}`));
	assert.equal(mutantKeys.size, canonicalKeys.size, 'the mutant preserves identity coverage');
	assert.deepEqual([...mutantKeys].sort(), [...canonicalKeys].sort());

	// The corrected per-term assertion rejects the wrong totals.
	assert.throws(
		() => assertPerTermDemandParity(result, mutant),
		(error: unknown) => (error as { code?: string }).code === 'PER_TERM_DEMAND_PARITY_MISMATCH',
	);
});

// ─── Zero-write proof through the shared preflight assembly ────────────────

function buildRotationClient(format: 'TRIMESTER' | 'QUARTERS') {
	const writes: string[] = [];
	const recordWrite = (name: string) => (..._args: unknown[]) => { writes.push(name); return Promise.resolve({}); };

	const termCount = format === 'TRIMESTER' ? 3 : 4;
	const subjects = rotationSubjects(format).map((subject) => ({
		id: subject.id, code: subject.code, name: subject.name, schedulingDisposition: subject.schedulingDisposition,
		gradeLevels: subject.gradeLevels, programScopes: subject.programScopes, rotationFamily: subject.rotationFamily,
		modularOrder: subject.modularOrder, minMinutesPerWeek: subject.minMinutesPerWeek, preferredRoomType: subject.preferredRoomType,
		requiredFeatures: subject.requiredFeatures, isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST',
		interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: subject.rotationFamily,
	}));

	const sectionMirrors = [{
		id: 501, externalId: 9001, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, name: '7-A', gradeLevelId: 17, gradeLevelName: 'Grade 7',
		displayOrder: 7, maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular',
		isSpecialProgram: false, tleProgramId: null, tleSpecialization: null, tleProgramCategory: null, homeRoomId: null, buildingZoneId: null,
		isActiveForScheduling: true, isStale: false,
	}];

	const policy = {
		id: 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, periodLengthMinutes: PERIOD_LENGTH, periodsPerDay: 8,
		maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00', latestEndTime: '18:30', enforceConsecutiveBreakAsHard: false,
		enableTravelWellbeingChecks: false, maxWalkingDistanceMetersPerTransition: 120, maxBuildingTransitionsPerDay: 4,
		maxBackToBackTransitionsWithoutBuffer: 2, maxIdleGapMinutesPerDay: 60, avoidEarlyFirstPeriod: false, avoidLateLastPeriod: false,
		enableVacantAwareConstraints: false, targetFacultyDailyVacantMinutes: 60, targetSectionDailyVacantPeriods: 1,
		maxCompressedTeachingMinutesPerDay: 300, lunchStartTime: '12:00', lunchEndTime: '13:00', enforceLunchWindow: false,
		showSpecialEventsInGrid: false, enableFlagCeremony: false, flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30',
		enableRecess: false, recessStartTime: '09:45', recessEndTime: '10:00', enableLunchWindow: false,
		enableTleTwoPassPriority: true, allowFlexibleSubjectAssignment: false, allowConsecutiveLabSessions: false, constraintConfig: null,
	};

	const slotRows = getExpectedCanonicalSlots(7, 'REGULAR').map((slot, index) => ({
		id: index + 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, gradeLevel: 7, programType: 'REGULAR',
		startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind, isActive: true,
		subjectFamily: slot.subjectFamily ?? null, subjectLabel: slot.subjectLabel ?? null, dayOfWeek: null,
	}));

	const ownership = subjects.map((subject, index) => ({ id: index + 1, subjectId: subject.id, sectionId: 9001, facultyId: 71, facultySubjectId: index + 1 }));
	const facultySubjects = subjects.map((subject) => ({ facultyId: 71, subjectId: subject.id, gradeLevels: [7], sectionIds: [9001] }));

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
			findUnique: async () => ({
				isActive: true, isArchived: false,
				termContractCache: { schoolId: SCHOOL_ID, schoolYear: { id: SCHOOL_YEAR_ID }, format, terms: termContract(format) },
				termContractCachedAt: new Date('2029-01-01'),
			}),
		},
		sectionMirror: { findMany: async () => sectionMirrors, count: async () => sectionMirrors.length },
		subject: { findMany: async () => subjects },
		facultyMirror: { findMany: async () => [{ id: 71, department: 'SCIENCE', maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false }] },
		facultySubject: { findMany: async () => facultySubjects },
		room: { findMany: async () => [{ id: 201, type: 'LABORATORY', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: ['SINK'], buildingId: 301, buildingZoneId: 'Z1', building: { gradeScope: [7] } }] },
		building: { findMany: async () => [{ id: 301, name: 'Building 1', x: 0, y: 0 }] },
		facultyPreference: { findMany: async () => [] },
		policySpecialEvent: { findMany: async () => [] },
		gradeShiftWindow: { findMany: async () => [] },
		classProgramSlot: { findMany: async (args: any) => {
			const where = args?.where ?? {};
			return slotRows.filter((row) => (where.gradeLevel == null || row.gradeLevel === where.gradeLevel) && (where.programType === undefined || row.programType === where.programType));
		} },
		classTemplate: { findMany: async () => [{ programType: 'REGULAR', periodLengthMinutes: PERIOD_LENGTH, periodsPerDay: 8 }] },
		instructionalCohort: { findMany: async () => [] },
		sectionSnapshot: { findUnique: async () => null },
		publishedScheduleRevision: { count: async () => 0 },
		create: recordWrite('create'), update: recordWrite('update'), updateMany: recordWrite('updateMany'),
		delete: recordWrite('delete'), deleteMany: recordWrite('deleteMany'), upsert: recordWrite('upsert'),
		$transaction: recordWrite('$transaction'), $executeRaw: recordWrite('$executeRaw'), $queryRaw: async () => [],
	};
	return { client, writes };
}

for (const format of ['TRIMESTER', 'QUARTERS'] as const) {
	test(`F4. ${format} nonuniform rotation is a typed preflight blocker with zero writes`, async () => {
		const { client, writes } = buildRotationClient(format);
		const preflight = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client, enforceShiftWindows: false });
		assert.equal(preflight.ok, false);
		assert.ok(preflight.blockers.some((blocker) => blocker.code === 'ROTATION_DEMAND_INCONSISTENT'), `${format} must fail closed with ROTATION_DEMAND_INCONSISTENT`);
		assert.equal(preflight.assembly.schedulerCanRun, false);
		assert.deepEqual(writes, [], `${format} preflight must produce zero writes`);
		assert.ok(preflight.assembly.derived, 'the canonical derived demand is still available for per-term assertions');

		// Exact owner + room requirements are bound into the shared assembly.
		for (const member of ROTATION_MEMBERS.slice(0, format === 'TRIMESTER' ? 3 : 4)) {
			assert.equal(preflight.assembly.pairOwners[`${member.id}:9001`], 71, `${member.code} must have an exact canonical owner`);
		}
		const bio = preflight.assembly.schedulableSubjects.find((subject: any) => subject.id === 13);
		assert.equal(bio?.preferredRoomType, 'LABORATORY');
		assert.deepEqual(bio?.requiredFeatures, ['SINK']);
		assertPerTermDemandParity(preflight.assembly.derived!, preflight.assembly.perTermDemandLines);
	});
}

test('F4. the live buildDerivedDemand loader preserves exact nonuniform per-term totals', async () => {
	const { client } = buildRotationClient('TRIMESTER');
	const derived = await buildDerivedDemand(SCHOOL_ID, SCHOOL_YEAR_ID, { client });
	assert.equal(derived.ok, true);
	if (!derived.ok) return;
	const lines = toPerTermDemandLines(derived, { '13:9001': 71, '14:9001': 71, '15:9001': 71, '11:9001': 71 });
	assertPerTermTotals('TRIMESTER', derived, lines);
});
