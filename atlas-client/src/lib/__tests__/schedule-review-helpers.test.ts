import assert from 'node:assert/strict';
import test from 'node:test';

import {
	findGradeWindow,
	resolveSectionGradeNumber,
} from '@/lib/schedule-review-helpers';
import type { ExternalSection } from '@/types';

function makeSection(overrides: Partial<ExternalSection> = {}): ExternalSection {
	return {
		id: 1,
		name: 'Section 1',
		maxCapacity: 40,
		enrolledCount: 30,
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		programType: 'REGULAR',
		...overrides,
	} as ExternalSection;
}

const gradeWindows = [
	{ gradeLevel: 7, programType: null, startTime: '07:30', endTime: '12:15' },
	{ gradeLevel: 8, programType: null, startTime: '07:30', endTime: '12:15' },
	{ gradeLevel: 9, programType: 'STE', startTime: '07:30', endTime: '17:00' },
	{ gradeLevel: 10, programType: null, startTime: '13:00', endTime: '17:00' },
];

test('resolveSectionGradeNumber parses gradeLevelName for Grade 7', () => {
	const section = makeSection({ gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7 });
	assert.equal(resolveSectionGradeNumber(section), 7);
});

test('resolveSectionGradeNumber falls back to displayOrder when gradeLevelName has no number', () => {
	const section = makeSection({ gradeLevelId: 17, gradeLevelName: 'Unknown', displayOrder: 8 });
	assert.equal(resolveSectionGradeNumber(section), 8);
});

test('resolveSectionGradeNumber falls back to gradeLevelId when displayOrder is invalid', () => {
	const section = makeSection({ gradeLevelId: 9, gradeLevelName: 'Unknown', displayOrder: 99 });
	assert.equal(resolveSectionGradeNumber(section), 9);
});

test('resolveSectionGradeNumber returns null for non-JHS grades', () => {
	const section = makeSection({ gradeLevelId: 17, gradeLevelName: 'Senior High', displayOrder: 99 });
	assert.equal(resolveSectionGradeNumber(section), null);
});

test('resolveSectionGradeNumber parses GR8 format', () => {
	const section = makeSection({ gradeLevelId: 17, gradeLevelName: 'GR8', displayOrder: 7 });
	assert.equal(resolveSectionGradeNumber(section), 8);
});

test('findGradeWindow matches exact grade + null program type', () => {
	const result = findGradeWindow(7, null, gradeWindows);
	assert.deepEqual(result, { startTime: '07:30', endTime: '12:15' });
});

test('findGradeWindow matches exact grade + REGULAR program type to default window', () => {
	const result = findGradeWindow(7, 'REGULAR', gradeWindows);
	assert.deepEqual(result, { startTime: '07:30', endTime: '12:15' });
});

test('findGradeWindow matches exact grade + empty program type to default window', () => {
	const result = findGradeWindow(7, '', gradeWindows);
	assert.deepEqual(result, { startTime: '07:30', endTime: '12:15' });
});

test('findGradeWindow matches exact grade + undefined program type to default window', () => {
	const result = findGradeWindow(7, undefined, gradeWindows);
	assert.deepEqual(result, { startTime: '07:30', endTime: '12:15' });
});

test('findGradeWindow matches exact grade + STE program type', () => {
	const result = findGradeWindow(9, 'STE', gradeWindows);
	assert.deepEqual(result, { startTime: '07:30', endTime: '17:00' });
});

test('findGradeWindow returns null for unmatched grade', () => {
	const result = findGradeWindow(6, null, gradeWindows);
	assert.equal(result, null);
});

test('findGradeWindow prefers exact program type match over default', () => {
	const windows = [
		{ gradeLevel: 7, programType: 'SPA', startTime: '08:00', endTime: '12:00' },
		{ gradeLevel: 7, programType: null, startTime: '07:30', endTime: '12:15' },
	];
	const result = findGradeWindow(7, 'SPA', windows);
	assert.deepEqual(result, { startTime: '08:00', endTime: '12:00' });
});

test('findGradeWindow falls back to default when specific program not found', () => {
	const windows = [
		{ gradeLevel: 7, programType: 'SPA', startTime: '08:00', endTime: '12:00' },
		{ gradeLevel: 7, programType: null, startTime: '07:30', endTime: '12:15' },
	];
	const result = findGradeWindow(7, 'STE', windows);
	assert.deepEqual(result, { startTime: '07:30', endTime: '12:15' });
});

test('resolveSectionGradeNumber with internal gradeLevelId=17 and gradeLevelName="Grade 7"', () => {
	const section = makeSection({
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
	});
	const grade = resolveSectionGradeNumber(section);
	assert.equal(grade, 7);
	const window = findGradeWindow(grade!, section.programType, gradeWindows);
	assert.deepEqual(window, { startTime: '07:30', endTime: '12:15' });
});

test('resolveSectionGradeNumber with internal gradeLevelId=18 and gradeLevelName="Grade 8"', () => {
	const section = makeSection({
		gradeLevelId: 18,
		gradeLevelName: 'Grade 8',
		displayOrder: 8,
	});
	const grade = resolveSectionGradeNumber(section);
	assert.equal(grade, 8);
	const window = findGradeWindow(grade!, section.programType, gradeWindows);
	assert.deepEqual(window, { startTime: '07:30', endTime: '12:15' });
});
