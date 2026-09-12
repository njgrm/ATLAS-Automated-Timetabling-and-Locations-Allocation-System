import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { buildTeacherProgramExportShape, sortTeacherProgramWorkloadRows } from '../services/teacher-program-export.service.js';
import { buildPeriodSlots, buildSpecialEventSlots } from '../services/schedule-constructor.js';
import { loadExportContext } from '../services/workbook-export.service.js';

test('canonical special-event builder defaults schema-shaped FLAG_OR_HGP to Monday and preserves explicit scope', () => {
	const base = {
		maxConsecutiveTeachingMinutesBeforeBreak: 120,
		minBreakMinutesAfterConsecutiveBlock: 15,
		maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00',
		latestEndTime: '18:30',
		specialEvents: [{ eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony', startTime: '07:00', endTime: '07:30', enabled: true }],
	};
	assert.equal(buildSpecialEventSlots(base).find((slot) => slot.eventName === 'Flag Ceremony')?.dayOfWeek, 'MONDAY');
	assert.equal(buildSpecialEventSlots({ ...base, specialEvents: [{ ...base.specialEvents[0], dayOfWeek: 'TUESDAY' }] }).find((slot) => slot.eventName === 'Flag Ceremony')?.dayOfWeek, 'TUESDAY');
});

test('fallback period builder keeps Monday-only flag boundaries available to other weekdays', () => {
	const policy = {
		periodLengthMinutes: 45,
		maxConsecutiveTeachingMinutesBeforeBreak: 120,
		minBreakMinutesAfterConsecutiveBlock: 15,
		maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00',
		latestEndTime: '08:00',
		specialEvents: [{ eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony', startTime: '06:00', endTime: '06:45', dayOfWeek: 'MONDAY' }],
	};
	assert.deepEqual(buildPeriodSlots(policy).map((slot) => `${slot.startTime}-${slot.endTime}`), ['06:00-06:45', '06:45-07:30']);
	assert.deepEqual(buildPeriodSlots({ ...policy, specialEvents: [{ ...policy.specialEvents[0], dayOfWeek: undefined }] }).map((slot) => `${slot.startTime}-${slot.endTime}`), ['06:00-06:45', '06:45-07:30']);
	assert.deepEqual(buildPeriodSlots({ ...policy, specialEvents: [{ ...policy.specialEvents[0], eventType: 'RECESS', dayOfWeek: undefined }] }).map((slot) => `${slot.startTime}-${slot.endTime}`), ['06:45-07:30']);
	assert.deepEqual(buildPeriodSlots({ ...policy, specialEvents: undefined, enableFlagCeremony: true }).map((slot) => `${slot.startTime}-${slot.endTime}`), ['06:00-06:45', '06:45-07:30']);
});

test('teacher-program production builder keeps Monday-only breaks, numeric print order, and reference-only exclusion', async () => {
	const client = {
		facultyMirror: {
			findFirst: async () => ({
				id: 501,
				firstName: 'Ari',
				lastName: 'Teacher',
				employeeId: 'E-501',
				plantillaPosition: 'Teacher I',
				designationTitle: null,
				undergraduateDegree: null,
				postgraduateDegree: null,
				ancillaryRoles: [],
				ancillaryMinutesPerWeek: 0,
				ancillaryLoadSource: 'NONE',
				advisoryEquivalentHours: 0,
				isClassAdviser: false,
				advisedSectionName: null,
			}),
		},
		generationRun: {
			findFirst: async () => ({
				id: 42,
				status: 'COMPLETED',
				summary: { timetableDisplaySlots: [
					{ startTime: '07:00', endTime: '07:30', isSpecialEvent: true, eventName: 'FLAG CEREMONY', dayOfWeek: 'MONDAY' },
					{ startTime: '13:00', endTime: '13:45' },
					{ startTime: '07:30', endTime: '08:15' },
				] },
				draftEntries: [
					{ entryId: 'late', facultyId: 501, roomId: 601, subjectId: 11, sectionId: 701, day: 'MONDAY', startTime: '13:00', endTime: '13:45', durationMinutes: 45 },
					{ entryId: 'early', facultyId: 501, roomId: 601, subjectId: 11, sectionId: 701, day: 'MONDAY', startTime: '07:30', endTime: '08:15', durationMinutes: 45 },
					{ entryId: 'reference', facultyId: 501, roomId: 601, subjectId: 99, sectionId: 701, day: 'MONDAY', startTime: '08:15', endTime: '09:00', durationMinutes: 45 },
				],
			}),
		},
		enrollProSchoolYearMirror: { findFirst: async () => ({ yearLabel: '2026-2027' }) },
		schedulingPolicy: { findFirst: async () => ({ enableRecess: false, enableFlagCeremony: true }) },
		subject: { findMany: async () => [
			{ id: 11, name: 'Mathematics', code: 'MATH' },
			{ id: 99, name: 'Homeroom Guidance', code: 'HG' },
		] },
		room: { findMany: async () => [{ id: 601, name: 'Room 601', building: { name: 'Building A' } }] },
		building: { findMany: async () => [{ id: 1, name: 'Building A' }] },
		sectionMirror: { findMany: async () => [{ id: 701, externalId: 701, name: '7-Rizal', gradeLevelName: 'Grade 7' }] },
	};

	const shape = await buildTeacherProgramExportShape({ schoolId: 71, schoolYearId: 11, runId: 42, facultyId: 501, client });
	assert.equal(shape.rows.some((row) => row.label === 'Homeroom Guidance'), false);
	assert.deepEqual(shape.rows.filter((row) => row.kind === 'BREAK').map((row) => row.day), ['MONDAY']);
	assert.deepEqual(shape.rows.filter((row) => row.kind === 'TEACHING').map((row) => row.timeSlot), ['7:30 AM - 8:15 AM', '1:00 PM - 1:45 PM']);
	assert.deepEqual(shape.rows.filter((row) => row.kind === 'BREAK').map((row) => row.timeSlot), ['7:00 AM - 7:30 AM']);
});

test('teacher-program production row sorter is numeric for 12-hour labels and deterministic for ties', () => {
	const rows = [
		{ kind: 'TEACHING' as const, label: 'Late', gradeAndSection: 'Grade 9 - A', day: 'MONDAY', timeSlot: '1:00 PM - 1:45 PM', minutes: 45, room: 'B / 1', source: 'z' },
		{ kind: 'TEACHING' as const, label: 'Early', gradeAndSection: 'Grade 7 - A', day: 'MONDAY', timeSlot: '7:30 AM - 8:15 AM', minutes: 45, room: 'B / 1', source: 'a' },
	];
	assert.deepEqual(sortTeacherProgramWorkloadRows(rows).map((row) => row.label), ['Early', 'Late']);
});

test('published teacher-program shape normalizes nested production entries and excludes HG', async () => {
	const client = {
		facultyMirror: { findFirst: async () => ({
			id: 501, firstName: 'Ari', lastName: 'Teacher', employeeId: 'E-501', plantillaPosition: 'Teacher I',
			designationTitle: null, undergraduateDegree: null, postgraduateDegree: null, ancillaryRoles: [],
			ancillaryMinutesPerWeek: 0, ancillaryLoadSource: 'NONE', advisoryEquivalentHours: 0, isClassAdviser: false,
			advisedSectionName: null,
		}) },
		generationRun: { findFirst: async () => ({ id: 42, status: 'COMPLETED', summary: { isPublished: true, timetableDisplaySlots: [] }, draftEntries: [] }) },
		enrollProSchoolYearMirror: { findFirst: async () => ({ yearLabel: '2026-2027' }) },
		schedulingPolicy: { findFirst: async () => ({ enableRecess: false, enableFlagCeremony: false }) },
		subject: { findMany: async () => [
			{ id: 11, name: 'Mathematics', code: 'MATH' },
			{ id: 99, name: 'Homeroom Guidance', code: 'HG' },
		] },
		room: { findMany: async () => [{ id: 601, name: 'Room 601', building: { name: 'Building A' } }] },
		building: { findMany: async () => [{ id: 1, name: 'Building A' }] },
		sectionMirror: { findMany: async () => [{ id: 701, externalId: 701, name: '7-Rizal', gradeLevelName: 'Grade 7' }] },
	};

	const shape = await buildTeacherProgramExportShape({
		schoolId: 71,
		schoolYearId: 11,
		runId: 42,
		facultyId: 501,
		client,
		publishedScheduleResolver: async () => ({ entries: [
			{
				entryId: 'published-math', day: 'MONDAY', startTime: '07:30', endTime: '08:15', durationMinutes: 45,
				subject: { id: 11 }, section: { externalId: 701 }, faculty: { id: 501 }, room: { id: 601 },
			},
			{
				entryId: 'published-hg', day: 'MONDAY', startTime: '08:15', endTime: '09:00', durationMinutes: 45,
				subject: { id: 99 }, section: { externalId: 701 }, faculty: { id: 501 }, room: { id: 601 },
			},
		] }),
	});

	assert.deepEqual(shape.rows.filter((row) => row.kind === 'TEACHING').map((row) => ({ label: row.label, gradeAndSection: row.gradeAndSection, room: row.room })), [
		{ label: 'Mathematics', gradeAndSection: 'Grade 7 - 7-Rizal', room: 'Building A / Room 601' },
	]);
});

test('DOCX production path consumes the numeric workload sorter instead of lexical time labels', async () => {
	const source = await readFile(new URL('../services/docx-export.service.ts', import.meta.url), 'utf8');
	assert.match(source, /sortTeacherProgramWorkloadRows\(\[\.\.\.compactedTeaching, \.\.\.breakRows\]\)/);
});

test('XLSX production context resolves revision-effective published entries and fails closed on missing term identity', async () => {
	const client = {
		generationRun: { findFirst: async () => ({
			id: 42, status: 'COMPLETED', summary: { isPublished: true, timetableDisplaySlots: [] },
			draftEntries: [{ entryId: 'stale-draft', sectionId: 701, subjectId: 11, facultyId: 501, roomId: 601, day: 'MONDAY', startTime: '07:30', endTime: '08:15', durationMinutes: 45, termIndex: 1 }],
		}) },
		school: { findUnique: async () => ({ name: 'ATLAS School' }) },
		enrollProSchoolYearMirror: { findFirst: async () => ({ yearLabel: '2026-2027' }) },
		sectionMirror: { findMany: async () => [] },
		facultyMirror: { findMany: async () => [] },
		subject: { findMany: async () => [] },
		room: { findMany: async () => [] },
	};
	const revisionEffectiveEntry = { entryId: 'revision-effective', sectionId: 701, subjectId: 11, facultyId: 501, roomId: 601, day: 'TUESDAY', startTime: '13:00', endTime: '13:45', durationMinutes: 45, termIndex: 2 };
	const publishedRunResolver = async () => ({ source: { runId: 42 }, entries: [revisionEffectiveEntry], summary: { isPublished: true, timetableDisplaySlots: [] } });
	const context = await loadExportContext({ schoolId: 71, schoolYearId: 11, runId: 42, client, publishedRunResolver });
	assert.deepEqual(context.entries, [revisionEffectiveEntry]);

	await assert.rejects(
		() => loadExportContext({
			schoolId: 71, schoolYearId: 11, runId: 42, termIndex: 2, client,
			publishedRunResolver: async () => ({ source: { runId: 42 }, entries: [{ ...revisionEffectiveEntry, termIndex: undefined }], summary: { isPublished: true, timetableDisplaySlots: [] } }),
		}),
		(error: unknown) => error instanceof Error && error.message === 'TERM_FILTER_NOT_READY',
	);
	await assert.rejects(
		() => loadExportContext({ schoolId: 71, schoolYearId: 11, runId: 42, client, publishedRunResolver: async () => ({ source: { runId: 43 }, entries: [revisionEffectiveEntry], summary: { isPublished: true, timetableDisplaySlots: [] } }) }),
		(error: unknown) => error instanceof Error && error.message === 'RUN_NOT_FOUND',
	);
});
