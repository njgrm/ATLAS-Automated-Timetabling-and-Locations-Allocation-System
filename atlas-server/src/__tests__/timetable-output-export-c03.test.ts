import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTeacherProgramExportShape, sortTeacherProgramWorkloadRows } from '../services/teacher-program-export.service.js';

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
