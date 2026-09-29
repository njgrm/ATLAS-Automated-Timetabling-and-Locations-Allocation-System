/**
 * A5 (2026-09-30) — the Dashboard server count is rotation-aware.
 *
 * `dashboard-readiness.service.ts` used `prisma.subject.count(...)`, which counts
 * catalogue ROWS: a school year running the Science rotation
 * (SCI_BIO/SCI_CHEM/SCI_ES) and the TLE rotation
 * (TLE_AFA_EXP/TLE_FCS_EXP/TLE_ICT_EXP) read as SIX subjects where the scheduler
 * knows TWO. `countRotationSubjectGroups` is the pure, dependency-free rule the
 * service now calls; this file pins its output and the failing-first contrast.
 *
 * The end-to-end (DB-backed) dashboard suites live in `test:server-db`; they need
 * a disposable PostgreSQL. This hermetic control decides the COUNT RULE, which is
 * the only thing this cycle changed.
 *
 * Run: `npm --prefix atlas-server run test:rotation-subject-counts`
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
	countRotationSubjectGroups,
	normalizeSubjectRotationGroupKey,
	subjectRotationGroupKey,
	type SubjectRotationCountRow,
} from '../services/subject-rotation-count.service.js';

/* ─────────────────────────── fixtures ─────────────────────────── */

const SCIENCE: SubjectRotationCountRow[] = [
	{ rotationFamily: 'SCIENCE', termGroupId: 'SCIENCE', hasFacultySubject: true },
	{ rotationFamily: 'SCIENCE', termGroupId: 'SCIENCE', hasFacultySubject: true },
	{ rotationFamily: 'SCIENCE', termGroupId: 'SCIENCE', hasFacultySubject: true },
];
const TLE: SubjectRotationCountRow[] = [
	{ rotationFamily: 'TLE', termGroupId: 'TLE_EXPLORATORY', hasFacultySubject: true },
	{ rotationFamily: 'TLE', termGroupId: 'TLE_EXPLORATORY', hasFacultySubject: true },
	{ rotationFamily: 'TLE', termGroupId: 'TLE_EXPLORATORY', hasFacultySubject: true },
];
const STANDALONE: SubjectRotationCountRow[] = [
	{ rotationFamily: null, termGroupId: null, hasFacultySubject: true },
	{ rotationFamily: null, termGroupId: null, hasFacultySubject: true },
];

const ROTATION_ONLY = [...SCIENCE, ...TLE];
const FULL = [...SCIENCE, ...TLE, ...STANDALONE];

/* ─────────────────────────── the rule ─────────────────────────── */

test('SRC-1 normalizeSubjectRotationGroupKey trims, uppercases and nulls empties', () => {
	assert.equal(normalizeSubjectRotationGroupKey('  science  '), 'SCIENCE');
	assert.equal(normalizeSubjectRotationGroupKey(''), null);
	assert.equal(normalizeSubjectRotationGroupKey('   '), null);
	assert.equal(normalizeSubjectRotationGroupKey(null), null);
	assert.equal(normalizeSubjectRotationGroupKey(undefined), null);
});

test('SRC-2 subjectRotationGroupKey: termGroupId wins, then rotationFamily', () => {
	assert.equal(subjectRotationGroupKey({ termGroupId: 'SCIENCE', rotationFamily: 'TLE' }), 'SCIENCE');
	assert.equal(subjectRotationGroupKey({ termGroupId: null, rotationFamily: 'tle' }), 'TLE');
	assert.equal(subjectRotationGroupKey({ termGroupId: null, rotationFamily: null }), null);
});

/* ─────────────────────────── counts + failing-first ─────────────────────────── */

test('SRC-3 FAILING-FIRST: naive row count 6/8 collapses to 2/4', () => {
	// The base implementation, verbatim: a row count.
	const base = (rows: SubjectRotationCountRow[]): number => rows.length;

	assert.equal(base(ROTATION_ONLY), 6, 'the recorded base behaviour changed');
	const rotation = countRotationSubjectGroups(ROTATION_ONLY);
	assert.equal(rotation.subjectCount, 2, 'Science(3)+TLE(3) must count as TWO subjects');
	assert.ok(
		base(ROTATION_ONLY) > rotation.subjectCount,
		'DISCRIMINATION FAILURE: the naive count does not exceed the fixed count',
	);

	assert.equal(base(FULL), 8, 'the naive count over the full fixture is not 8');
	assert.equal(countRotationSubjectGroups(FULL).subjectCount, 4, 'Science+TLE+2 standalone must be FOUR');
});

test('SRC-4 unassignedSubjectCount keeps the family-level "a gap exists" signal', () => {
	// Science: one member unstaffed -> ONE unassigned group. TLE fully staffed.
	const rows: SubjectRotationCountRow[] = [
		{ rotationFamily: 'SCIENCE', termGroupId: 'SCIENCE', hasFacultySubject: false },
		{ rotationFamily: 'SCIENCE', termGroupId: 'SCIENCE', hasFacultySubject: true },
		{ rotationFamily: 'SCIENCE', termGroupId: 'SCIENCE', hasFacultySubject: true },
		...TLE,
	];
	const result = countRotationSubjectGroups(rows);
	assert.equal(result.subjectCount, 2, 'the two families are two subject groups');
	assert.equal(
		result.unassignedSubjectCount,
		1,
		'a partly-staffed family must read as ONE unassigned group, preserving > 0',
	);
	assert.ok(result.unassignedSubjectCount > 0, 'the gap signal must never be hidden by a partly-staffed family');

	// Full fixture: one Science member unstaffed and one standalone unstaffed -> TWO groups with a gap.
	const withGaps: SubjectRotationCountRow[] = [
		{ rotationFamily: 'SCIENCE', termGroupId: 'SCIENCE', hasFacultySubject: false },
		...SCIENCE.slice(1),
		...TLE,
		{ rotationFamily: null, termGroupId: null, hasFacultySubject: false },
		{ rotationFamily: null, termGroupId: null, hasFacultySubject: true },
	];
	assert.deepEqual(
		countRotationSubjectGroups(withGaps),
		{ subjectCount: 4, unassignedSubjectCount: 2 },
		'the Science family and the one standalone gap must be exactly TWO unassigned groups',
	);
});

test('SRC-5 two distinct rotation groups stay two', () => {
	const rows: SubjectRotationCountRow[] = [
		{ rotationFamily: 'SCIENCE', termGroupId: 'SCIENCE', hasFacultySubject: true },
		{ rotationFamily: 'TLE', termGroupId: 'TLE_EXPLORATORY', hasFacultySubject: true },
	];
	assert.equal(countRotationSubjectGroups(rows).subjectCount, 2, 'distinct termGroupId values must not merge');
});
