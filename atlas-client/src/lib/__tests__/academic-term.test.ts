/**
 * DEMAND-C01R2 — client ordered-term contract controls.
 *
 * Run (client workspace): `npx tsx --test src/lib/__tests__/academic-term.test.ts`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
	MAX_ACADEMIC_TERM_INDEX,
	academicTermDisplayLabel,
	academicTermFallbackLabel,
	buildAcademicTermOptions,
	isTermIndexWithinTerms,
	repairTermFilter,
} from '@/lib/academic-term';

const HERE = dirname(fileURLToPath(import.meta.url));

const quarterTerms = [
	{ identity: 'Q1', displayLabel: 'Quarter 1', order: 1 },
	{ identity: 'Q2', displayLabel: 'Quarter 2', order: 2 },
	{ identity: 'Q3', displayLabel: 'Quarter 3', order: 3 },
	{ identity: 'Q4', displayLabel: 'Quarter 4', order: 4 },
];

test('control 7a: the timetable term filter renders exact ordered EnrollPro labels and exposes Q4', () => {
	const options = buildAcademicTermOptions(quarterTerms, 4);
	assert.deepEqual(options.map((option) => option.value), ['all', '1', '2', '3', '4']);
	assert.deepEqual(options.map((option) => option.label), ['All terms', 'Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4']);
	assert.equal(MAX_ACADEMIC_TERM_INDEX, 4);
});

test('control 7b: labels fall back to T1/T2 only when no authoritative label exists', () => {
	assert.deepEqual(
		buildAcademicTermOptions(null, null).map((option) => option.label),
		['All terms', 'T1', 'T2', 'T3', 'T4'],
	);
	assert.equal(academicTermFallbackLabel(3), 'T3');
	assert.equal(academicTermDisplayLabel([{ identity: 'X', displayLabel: 'First Quarter', order: 1 }], 1), 'First Quarter');
	assert.equal(academicTermDisplayLabel([{ identity: 'X', displayLabel: '  ', order: 1 }], 1), 'T1');
});

test('control 7c: an invalid selected term is repaired to all on a contract/scope change', () => {
	assert.equal(isTermIndexWithinTerms(4, quarterTerms), true);
	assert.equal(isTermIndexWithinTerms(4, quarterTerms.slice(0, 3)), false);
	assert.equal(repairTermFilter(4, quarterTerms), 4);
	assert.equal(repairTermFilter(4, quarterTerms.slice(0, 3)), 'all', 'a term absent from the new contract clears the filter');
	assert.equal(repairTermFilter('all', quarterTerms), 'all');
});

test('control 7d: no client academic-term surface retains a hard-coded three-term union/options list', () => {
	const boundary = [
		'src/lib/academic-term.ts',
		'src/lib/schedule-pivot.ts',
		'src/hooks/useTimetableData.ts',
		'src/hooks/useScheduleReviewWorkspaceState.ts',
		'src/components/timetable/TimetableToolbar.tsx',
	];
	for (const rel of boundary) {
		const source = readFileSync(resolve(HERE, '../../../', rel), 'utf8');
		assert.doesNotMatch(source, /'all' \| 1 \| 2 \| 3\b/, `${rel} must not hard-code a three-term filter union`);
		assert.doesNotMatch(source, /termIndex: 1 \| 2 \| 3\b/, `${rel} must not hard-code a three-term index union`);
		assert.doesNotMatch(source, /\{ value: '3', label: 'T3' \}/, `${rel} must not hard-code a static three-term option list`);
	}
	// The toolbar consumes runtime term options rather than an internal static list.
	const toolbar = readFileSync(resolve(HERE, '../../../', 'src/components/timetable/TimetableToolbar.tsx'), 'utf8');
	assert.match(toolbar, /termOptions: ReadonlyArray<Option>/, 'toolbar term options come from the caller');
	// Positive control: unrelated non-academic 1..3 concepts remain.
	const gradeLabels = readFileSync(resolve(HERE, '../../../', 'src/lib/grade-labels.ts'), 'utf8');
	assert.match(gradeLabels, /QualificationTier = 1 \| 2 \| 3 \| null/, 'qualification tiers remain untouched');
});
