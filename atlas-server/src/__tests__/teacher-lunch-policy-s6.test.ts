/**
 * TEACHER-LUNCH-POLICY-C01 (S6) - focused suite.
 *
 * Covers the D9 deliverable through the real production paths:
 *  - policy defaults/validation and the PUT surface for the two additive
 *    teacher-lunch switches
 *  - the validator teacher-lunch constraint (SOFT by default, HARD switchable),
 *    its grade-scoped lunch-window resolution, and its policy fallback
 *  - the publication gate blocks only the HARD form
 *  - the Teacher Program export renders the canonical lunch band (regression)
 *  - the policy pane exposes truthful soft/hard copy
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import { buildTeacherProgramExportShape } from '../services/teacher-program-export.service.js';
import { generateTeacherProgramDocx } from '../services/docx-export.service.js';
import {
	POLICY_DEFAULTS,
	PROMOTABLE_CONSTRAINT_CODES,
	isPromotableConstraintCode,
	upsertPolicy,
	validatePolicyInput,
} from '../services/scheduling-policy.service.js';
import { VIOLATION_CODES, VIOLATION_COPY, validateHardConstraints } from '../services/constraint-validator.js';
import { countBlockingHardViolations } from '../services/publication-contract.service.js';

const SCHOOL_ID = 71;
const SCHOOL_YEAR_ID = 11;
const RUN_ID = 42;

// ---------------------------------------------------------------------------
// A. Policy defaults, validation, and the PUT surface
// ---------------------------------------------------------------------------

test('A1: teacher-lunch defaults are enabled and SOFT', () => {
	assert.equal(POLICY_DEFAULTS.enableTeacherLunchWindow, true, 'teacher lunch window is enabled by default');
	assert.equal(POLICY_DEFAULTS.enforceTeacherLunchWindow, false, 'teacher lunch window is SOFT by default');

	const { data, errors } = validatePolicyInput({});
	assert.deepEqual(errors, []);
	assert.equal(data.enableTeacherLunchWindow, true);
	assert.equal(data.enforceTeacherLunchWindow, false);
});

test('A2: validation accepts the two booleans and coerces a dead hard gate off', () => {
	const enabledHard = validatePolicyInput({ enableTeacherLunchWindow: true, enforceTeacherLunchWindow: true });
	assert.deepEqual(enabledHard.errors, []);
	assert.equal(enabledHard.data.enableTeacherLunchWindow, true);
	assert.equal(enabledHard.data.enforceTeacherLunchWindow, true);

	// Enforcement without the window is inert; it must never persist as a dead
	// hard gate.
	const disabled = validatePolicyInput({ enableTeacherLunchWindow: false, enforceTeacherLunchWindow: true });
	assert.deepEqual(disabled.errors, []);
	assert.equal(disabled.data.enableTeacherLunchWindow, false);
	assert.equal(disabled.data.enforceTeacherLunchWindow, false);
});

test('A3: validation rejects non-boolean teacher-lunch switches', () => {
	const badEnable = validatePolicyInput({ enableTeacherLunchWindow: 'yes' });
	assert.ok(badEnable.errors.some((message) => message.includes('enableTeacherLunchWindow must be a boolean')), badEnable.errors.join(' '));

	const badEnforce = validatePolicyInput({ enforceTeacherLunchWindow: 1 });
	assert.ok(badEnforce.errors.some((message) => message.includes('enforceTeacherLunchWindow must be a boolean')), badEnforce.errors.join(' '));
});

test('A4: the PUT surface persists both switches', async () => {
	const captured: { create?: Record<string, unknown>; update?: Record<string, unknown> } = {};
	const client = {
		$executeRawUnsafe: async () => undefined,
		gradeShiftWindow: { findMany: async () => [] },
		schedulingPolicy: {
			upsert: async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
				captured.create = args.create;
				captured.update = args.update;
				return { id: 1, ...args.create };
			},
		},
	};
	await withDataContext(client, () => upsertPolicy(SCHOOL_ID, SCHOOL_YEAR_ID, {
		enableTeacherLunchWindow: true,
		enforceTeacherLunchWindow: true,
	}));
	assert.ok(captured.create, 'upsert create payload was captured');
	assert.equal(captured.create?.enableTeacherLunchWindow, true);
	assert.equal(captured.create?.enforceTeacherLunchWindow, true);
	assert.equal(captured.update?.enableTeacherLunchWindow, true);
	assert.equal(captured.update?.enforceTeacherLunchWindow, true);
});

// ---------------------------------------------------------------------------
// B. Validator teacher-lunch constraint
// ---------------------------------------------------------------------------

const GRADE7_SCOPE = new Map([[701, { gradeLevel: 7, programType: 'REGULAR' }]]);
const LUNCH_WINDOW = {
	eventType: 'LUNCH_BREAK', label: 'Lunch Break', startTime: '12:15', endTime: '13:00',
	gradeLevel: 7, programType: 'REGULAR', dayOfWeek: null,
};

function entry(overrides: Record<string, unknown> = {}) {
	return {
		entryId: 'e1', facultyId: 501, roomId: 601, subjectId: 11, sectionId: 701,
		day: 'MONDAY', startTime: '12:00', endTime: '13:00', durationMinutes: 60, termIndex: 1,
		...overrides,
	};
}

function makeValidatorCtx(options: {
	entries?: ReturnType<typeof entry>[];
	breakWindows?: unknown[];
	policy?: Record<string, unknown>;
} = {}) {
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		runId: RUN_ID,
		entries: options.entries ?? [entry()],
		faculty: [{ id: 501, maxHoursPerWeek: 30 }],
		facultySubjects: [{ facultyId: 501, subjectId: 11, sectionIds: [701] }],
		rooms: [{ id: 601, type: 'CLASSROOM' as const, capacity: 60, floor: 1 }],
		subjects: [{ id: 11, preferredRoomType: 'CLASSROOM' as const }],
		sectionScope: GRADE7_SCOPE,
		breakWindows: options.breakWindows ?? [LUNCH_WINDOW],
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 135,
			periodLengthMinutes: 45,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480,
			earliestStartTime: '06:00',
			latestEndTime: '18:30',
			enforceConsecutiveBreakAsHard: false,
			enableTeacherLunchWindow: true,
			enforceTeacherLunchWindow: false,
			lunchStartTime: '12:15',
			lunchEndTime: '13:00',
			enableLunchWindow: true,
			...options.policy,
		},
	} as any;
}

function lunchViolations(ctx: any) {
	return validateHardConstraints(ctx).violations.filter((violation) => violation.code === 'FACULTY_LUNCH_WINDOW_VIOLATION');
}

test('B1: a teacher scheduled across the grade-band lunch window is a SOFT violation (failing-first)', () => {
	// The teacher is in class 12:00-13:00, so no free block covers the
	// grade-7 lunch window 12:15-13:00.
	const violations = lunchViolations(makeValidatorCtx());
	assert.equal(violations.length, 1, 'exactly one lunch violation');
	assert.equal(violations[0].severity, 'SOFT', 'the default is a SOFT warning');
	assert.equal(violations[0].entities.facultyId, 501);
	assert.equal(violations[0].entities.day, 'MONDAY');
	assert.deepEqual(violations[0].meta?.overlappingEntryIds, ['e1']);
});

test('B2: a teacher with a free lunch block passes', () => {
	const violations = lunchViolations(makeValidatorCtx({
		entries: [entry({ entryId: 'morning', startTime: '10:00', endTime: '10:45', durationMinutes: 45 })],
	}));
	assert.deepEqual(violations, [], 'a free lunch block is never a violation');
});

test('B3: enforceTeacherLunchWindow promotes the violation to HARD', () => {
	const violations = lunchViolations(makeValidatorCtx({ policy: { enforceTeacherLunchWindow: true } }));
	assert.equal(violations.length, 1);
	assert.equal(violations[0].severity, 'HARD', 'the explicit hard switch blocks publication');
});

test('B4: the constraint is inert when the window is disabled', () => {
	const violations = lunchViolations(makeValidatorCtx({ policy: { enableTeacherLunchWindow: false } }));
	assert.deepEqual(violations, []);
});

test('B5: with no grade-scoped lunch row the policy lunch window is the fallback', () => {
	const violations = lunchViolations(makeValidatorCtx({ breakWindows: [] }));
	assert.equal(violations.length, 1, 'the policy lunch window is used when no scoped row exists');
	assert.equal(violations[0].severity, 'SOFT');

	// A disabled policy lunch window leaves no fallback window at all.
	const noWindow = lunchViolations(makeValidatorCtx({ breakWindows: [], policy: { enableLunchWindow: false } }));
	assert.deepEqual(noWindow, []);
});

test('B6: a grade-scoped lunch row only applies to its grade band', () => {
	// The only lunch window is scoped to grade 9, and the policy fallback is
	// disabled, so a grade-7 section must not inherit any lunch window.
	const grade9Window = { ...LUNCH_WINDOW, gradeLevel: 9 };
	const violations = lunchViolations(makeValidatorCtx({ breakWindows: [grade9Window], policy: { enableLunchWindow: false } }));
	assert.deepEqual(violations, [], 'a grade-9 lunch window does not apply to a grade-7 teacher');
});

test('B7: every canonical violation code carries operator copy', () => {
	assert.ok(VIOLATION_CODES.includes('FACULTY_LUNCH_WINDOW_VIOLATION'));
	const copy = VIOLATION_COPY.FACULTY_LUNCH_WINDOW_VIOLATION;
	assert.ok(copy && copy.title.length > 0 && copy.meaning.length > 0 && copy.action.length > 0);
});

// ---------------------------------------------------------------------------
// C. Publication gate
// ---------------------------------------------------------------------------

test('C1: only the HARD teacher-lunch violation blocks publication', () => {
	assert.equal(isPromotableConstraintCode('FACULTY_LUNCH_WINDOW_VIOLATION'), true, 'the code is on the publication allowlist');
	assert.equal(PROMOTABLE_CONSTRAINT_CODES.has('FACULTY_LUNCH_WINDOW_VIOLATION'), true);

	const soft = [{ code: 'FACULTY_LUNCH_WINDOW_VIOLATION', severity: 'SOFT' }];
	assert.equal(countBlockingHardViolations(soft), 0, 'a SOFT lunch warning does not block publication');

	const hard = [{ code: 'FACULTY_LUNCH_WINDOW_VIOLATION', severity: 'HARD' }];
	assert.equal(countBlockingHardViolations(hard), 1, 'the HARD switch blocks publication');
});

// ---------------------------------------------------------------------------
// D. Teacher Program export regression
// ---------------------------------------------------------------------------

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

type ExportEntry = {
	entryId: string; sectionId: number; subjectId: number; facultyId: number | null; roomId: number;
	day: string; startTime: string; endTime: string; durationMinutes: number; termIndex: number;
};

const SECTIONS = [{ id: 1, externalId: 701, name: '7-Rizal', gradeLevelId: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR' }];
const FACULTY = {
	id: 501, firstName: 'Juan', lastName: 'Dela Cruz', employeeId: 'E-501', plantillaPosition: 'Teacher I',
	designationTitle: null, undergraduateDegree: null, postgraduateDegree: null, avatarUrl: null,
	ancillaryRoles: [], ancillaryMinutesPerWeek: 0, ancillaryLoadSource: 'NONE',
	isClassAdviser: false, advisedSectionId: null, advisedSectionName: null, isStale: false,
};
const SUBJECTS = [{ id: 11, name: 'Mathematics', code: 'MATH' }];
const ROOMS = [{ id: 601, name: '101', type: 'CLASSROOM', floor: 1, building: { id: 1, name: 'Building A' } }];

// Canonical shift templates, mirroring `class-program-slot.service.ts`.
// The morning shift (Grades 7-8) classes 11:30-12:15 and lunches 12:15-13:00;
// the afternoon shift (Grades 9-10) lunches 11:30-12:15 and classes 12:15-13:00.
const GRADE_7_SLOTS = [
	{ gradeLevel: 7, startTime: '06:00', endTime: '06:45', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null },
	{ gradeLevel: 7, startTime: '06:45', endTime: '07:30', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null },
	{ gradeLevel: 7, startTime: '07:30', endTime: '08:15', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null },
	{ gradeLevel: 7, startTime: '09:00', endTime: '09:15', rowKind: 'BREAK', subjectLabel: 'Health Break', dayOfWeek: null },
	{ gradeLevel: 7, startTime: '11:30', endTime: '12:15', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null },
	{ gradeLevel: 7, startTime: '12:15', endTime: '13:00', rowKind: 'BREAK', subjectLabel: 'Lunch Break', dayOfWeek: null },
];
const GRADE_9_SLOTS = [
	{ gradeLevel: 9, startTime: '11:30', endTime: '12:15', rowKind: 'BREAK', subjectLabel: 'Lunch Break', dayOfWeek: null },
	{ gradeLevel: 9, startTime: '12:15', endTime: '13:00', rowKind: 'CLASS', subjectLabel: 'Class', dayOfWeek: null },
	{ gradeLevel: 9, startTime: '15:15', endTime: '15:30', rowKind: 'BREAK', subjectLabel: 'Health Break', dayOfWeek: null },
];
const UNION_SLOTS = [...GRADE_7_SLOTS, ...GRADE_9_SLOTS];

const SPECIAL_EVENTS = [
	{ eventType: 'HEALTH_BREAK', label: 'Health Break', gradeGroup: '7-8', programType: null, startTime: '09:00', endTime: '09:15', sortOrder: 2, dayOfWeek: null },
	{ eventType: 'LUNCH_BREAK', label: 'Lunch Break', gradeGroup: '7-8', programType: null, startTime: '12:15', endTime: '13:00', sortOrder: 3, dayOfWeek: null },
	{ eventType: 'LUNCH_BREAK', label: 'Lunch Break', gradeGroup: '9-10', programType: null, startTime: '11:30', endTime: '12:15', sortOrder: 4, dayOfWeek: null },
	{ eventType: 'HEALTH_BREAK', label: 'Health Break', gradeGroup: '9-10', programType: null, startTime: '15:15', endTime: '15:30', sortOrder: 5, dayOfWeek: null },
];

const ENTRIES: ExportEntry[] = WEEKDAYS.map((day) => ({
	entryId: `math-1-${day}`, sectionId: 701, subjectId: 11, facultyId: 501, roomId: 601, day,
	startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1,
}));

function runSummaryDisplaySlots() {
	return UNION_SLOTS.map((slot) => ({
		startTime: slot.startTime,
		endTime: slot.endTime,
		...(slot.rowKind === 'BREAK' ? { isSpecialEvent: true, eventName: slot.subjectLabel ?? 'Break' } : {}),
		...(slot.dayOfWeek ? { dayOfWeek: slot.dayOfWeek } : {}),
	}));
}

function frozenSlotRows() {
	return GRADE_7_SLOTS.map((slot, index) => ({
		id: index + 1, gradeLevel: slot.gradeLevel, programType: 'REGULAR', dayOfWeek: slot.dayOfWeek,
		startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind,
		subjectFamily: null, subjectLabel: slot.subjectLabel, sourceLabel: 'test', sourceNote: null,
	}));
}

function frozenDisplaySlots() {
	return UNION_SLOTS.map((slot, index) => ({
		key: `${slot.startTime}-${slot.endTime}`,
		label: slot.rowKind === 'BREAK' ? (slot.subjectLabel ?? 'Break') : `${slot.startTime}-${slot.endTime}`,
		startTime: slot.startTime, endTime: slot.endTime, order: index,
		kind: slot.rowKind === 'BREAK' ? 'SPECIAL_EVENT' : 'PERIOD', dayOfWeek: slot.dayOfWeek ?? null,
	}));
}

function makeExportClient(summary: Record<string, unknown>) {
	return {
		generationRun: { findFirst: async () => ({ id: RUN_ID, status: 'COMPLETED', summary, draftEntries: ENTRIES }) },
		school: { findUnique: async () => ({ name: 'ATLAS National High School' }) },
		enrollProSchoolYearMirror: { findFirst: async () => ({ yearLabel: '2026-2027' }) },
		sectionMirror: { findMany: async () => SECTIONS },
		facultyMirror: { findFirst: async () => FACULTY },
		subject: { findMany: async () => SUBJECTS },
		room: { findMany: async () => ROOMS },
		building: { findMany: async () => [{ id: 1, name: 'Building A' }] },
		schedulingPolicy: { findFirst: async () => ({ enableRecess: false, enableFlagCeremony: false, advisoryCreditMinutes: 0 }) },
		classProgramSlot: { findMany: async () => GRADE_7_SLOTS },
		policySpecialEvent: { findMany: async () => SPECIAL_EVENTS },
	};
}

function makeSnapshot() {
	return {
		schemaVersion: 1, capturedAt: '2026-09-24T00:00:00.000Z', inputFingerprint: 'fixture',
		orderedTermContract: { format: 'TRIMESTER', terms: [{ identity: 'T1', displayLabel: 'T1', order: 1 }], activeTermOrder: 1 },
		subjects: { '11': { code: 'MATH', name: 'Mathematics' } },
		faculty: { '501': { externalId: '501', employeeId: 'E-501', displayName: 'Dela Cruz, Juan', firstName: 'Juan', lastName: 'Dela Cruz', isPlaceholder: false, advisedSectionId: null } },
		sections: {}, buildings: {}, rooms: {}, specializations: {}, cohorts: {}, advisers: {},
		displaySlots: frozenDisplaySlots(), specialEvents: SPECIAL_EVENTS,
		policy: { advisoryCreditMinutes: 0, enableFlagCeremony: false }, classProgramSlots: frozenSlotRows(),
	};
}

function publishedEntries() {
	return ENTRIES.map((entry) => ({
		entryId: entry.entryId, day: entry.day, startTime: entry.startTime, endTime: entry.endTime, durationMinutes: entry.durationMinutes,
		subject: { id: entry.subjectId, code: 'MATH', name: 'Mathematics' },
		section: { id: 1, externalId: 701, name: '7-Rizal', gradeLevel: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR' },
		faculty: { id: entry.facultyId },
		room: { id: entry.roomId, name: '101', buildingName: 'Building A' },
		termIndex: entry.termIndex,
	}));
}

test('D1: a published Teacher Program renders the lunch band even when the run union carries the other shift CLASS row', async () => {
	const summary = { isPublished: true, publishedAt: '2026-09-24T00:00:00.000Z', timetableDisplaySlots: runSummaryDisplaySlots() };
	const client = makeExportClient(summary);
	const shape = await withDataContext(client, () => buildTeacherProgramExportShape({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, facultyId: 501, termIndex: 1, client,
		publishedScheduleResolver: async () => ({ source: { runId: RUN_ID }, entries: publishedEntries(), snapshot: makeSnapshot() }),
	}));
	const breaks = shape.rows.filter((row) => row.kind === 'BREAK').map((row) => row.label);
	assert.ok(breaks.includes('Lunch Break'), `the grade-7 lunch band renders (got ${JSON.stringify(breaks)})`);
	assert.equal(breaks.filter((label) => label === 'Lunch Break').length, 1, 'exactly one lunch band, not the other shift duplicate');
});

test('D2: the draft Teacher Program renders the lunch band from the same union run summary', async () => {
	const summary = { isPublished: false, timetableDisplaySlots: runSummaryDisplaySlots() };
	const client = makeExportClient(summary);
	const shape = await withDataContext(client, () => buildTeacherProgramExportShape({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, facultyId: 501, termIndex: 1, client,
	}));
	assert.ok(shape.rows.some((row) => row.kind === 'BREAK' && row.label === 'Lunch Break'), 'the draft lunch band renders');
});

test('D3: the produced Teacher Program DOCX contains the Lunch Break band', async () => {
	const summary = { isPublished: false, timetableDisplaySlots: runSummaryDisplaySlots() };
	const client = makeExportClient(summary);
	const shape = await withDataContext(client, () => buildTeacherProgramExportShape({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: RUN_ID, facultyId: 501, termIndex: 1, client,
	}));
	const buffer = await generateTeacherProgramDocx(shape);
	const { default: JSZip } = await import('jszip');
	const zip = await (JSZip as any).loadAsync(buffer);
	const xml: string = await zip.file('word/document.xml').async('string');
	const labels = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((match) => match[1]);
	assert.ok(labels.includes('Lunch Break'), 'the DOCX renders the Lunch Break band');
	assert.ok(labels.includes('Health Break'), 'the DOCX still renders the Health Break band');
});

// ---------------------------------------------------------------------------
// E. Policy pane copy contract
// ---------------------------------------------------------------------------

test('E1: the policy pane exposes both switches with truthful soft/hard copy', () => {
	const source = readFileSync(new URL('../../../atlas-client/src/components/SchedulingPolicyPane.tsx', import.meta.url), 'utf8');
	assert.match(source, /enableTeacherLunchWindow/, 'the enable switch is wired');
	assert.match(source, /enforceTeacherLunchWindow/, 'the enforce switch is wired');
	assert.match(source, /Teacher Lunch Window/, 'the enable control is labelled');
	assert.match(source, /Block Publication on Teacher Lunch Violation/, 'the hard switch is labelled');
	assert.match(source, /SOFT warning/, 'the copy names the soft behaviour');
	assert.match(source, /blocks publishing/, 'the copy names the hard publication block');
});
