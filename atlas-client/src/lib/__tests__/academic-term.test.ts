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

	// ROOM-SCHEDULES-TERM-C01 — the fail-open this guard did not cover. The
	// client pivot mapped `termIndex: e.termIndex ?? 1`, so an entry with no term
	// identity was reported as Term 1 and the view claimed a verified
	// single-term schedule it could not support. A committed row existed and was
	// green throughout, because its fixture also lacked a term and therefore
	// exercised the fall-open rather than the filter.
	//
	// Strengthened HERE, in the guard that already owns "the client academic-term
	// boundary", rather than in a second file: two authorities for one invariant
	// is the hazard these label maps exist to prevent.
	//
	// ONE regex, matched in BOTH orders. An earlier draft of this guard used two
	// separate patterns, and its own positive control proved the second one could
	// not fire — `?? 1` follows the property name in the real code, not precedes
	// it. A guard that cannot match is false assurance, so it was replaced rather
	// than kept alongside the working one.
	const termFallOpen = /(termIndex[^;\n]*\?\?\s*\d)|(\?\?\s*\d[^;\n]*termIndex)/;
	for (const rel of ['src/lib/schedule-pivot.ts', 'src/lib/academic-term.ts']) {
		const source = readFileSync(resolve(HERE, '../../../', rel), 'utf8');
		assert.doesNotMatch(
			source,
			termFallOpen,
			`${rel} must not default a missing term identity to Term 1`,
		);
	}

	// Positive control: the guard must be able to fail in EITHER order, or the row
	// above is decorative. This is what caught the dead pattern.
	assert.match('const a = { termIndex: e.termIndex ?? 1 };', termFallOpen, 'property-then-fallback ordering must be caught');
	assert.match('const t = entry.termIndex ?? 1;', termFallOpen, 'read-then-fallback ordering must be caught');
	// And it must NOT fire on a legitimate numeric fallback that has nothing to do
	// with a term, or the guard is too broad to be trusted.
	assert.doesNotMatch('const n = count ?? 1;', termFallOpen, 'an unrelated numeric fallback must not trip the guard');
	// The toolbar consumes runtime term options rather than an internal static list.
	const toolbar = readFileSync(resolve(HERE, '../../../', 'src/components/timetable/TimetableToolbar.tsx'), 'utf8');
	assert.match(toolbar, /termOptions: ReadonlyArray<Option>/, 'toolbar term options come from the caller');
	// Positive control: unrelated non-academic 1..3 concepts remain.
	const gradeLabels = readFileSync(resolve(HERE, '../../../', 'src/lib/grade-labels.ts'), 'utf8');
	assert.match(gradeLabels, /QualificationTier = 1 \| 2 \| 3 \| null/, 'qualification tiers remain untouched');
});
