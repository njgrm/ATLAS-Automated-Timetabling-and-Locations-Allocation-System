/**
 * FACULTY-GRADE-PREFERENCE-C01 (D10) — client proof.
 *
 * Pure helper behaviour for the soft grade preference plus a source-level guard
 * that the roster actually renders the editor and the wide-span attention signal
 * (and does not fake an auto-assign preview it does not have).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	PREFERRED_GRADE_CHOICES,
	WIDE_GRADE_SPAN_THRESHOLD,
	hasWideGradeSpan,
	normalizePreferredGrades,
} from '../../components/faculty/FacultyRow';

const here = dirname(fileURLToPath(import.meta.url));
const clientSrc = resolve(here, '..', '..');

test('normalizePreferredGrades keeps only numeric JHS grades 7-10', () => {
	assert.deepEqual(normalizePreferredGrades([9, 7, 7, 10]), [7, 9, 10]);
	assert.deepEqual(normalizePreferredGrades([1, 2, 3]), [], 'EnrollPro grade-level IDs are dropped');
	assert.deepEqual(normalizePreferredGrades(undefined), []);
	assert.deepEqual(normalizePreferredGrades([]), []);
	assert.deepEqual([...PREFERRED_GRADE_CHOICES], [7, 8, 9, 10]);
});

test('hasWideGradeSpan flags 3 or more actual grades', () => {
	assert.equal(WIDE_GRADE_SPAN_THRESHOLD, 3);
	assert.equal(hasWideGradeSpan([7, 8]), false);
	assert.equal(hasWideGradeSpan([7, 8, 9]), true);
	assert.equal(hasWideGradeSpan([7, 8, 9, 10]), true);
	assert.equal(hasWideGradeSpan(undefined), false);
});

test('roster exposes the preference editor, the footprint, and the wide-span signal', () => {
	const row = readFileSync(resolve(clientSrc, 'components', 'faculty', 'FacultyRow.tsx'), 'utf8');
	assert.match(row, /export function FacultyPreferredGradesControl/);
	assert.match(row, /PREFERRED_GRADE_CHOICES/);
	assert.match(row, /data-testid="teacher-wide-grade-span"/);
	assert.match(row, /not available on this page/, 'honest note instead of a faked auto-assign preview');

	const page = readFileSync(resolve(clientSrc, 'pages', 'Faculty.tsx'), 'utf8');
	assert.match(page, /<FacultyPreferredGradesControl faculty=\{teacher\} \/>/);

	const types = readFileSync(resolve(clientSrc, 'types.ts'), 'utf8');
	assert.match(types, /export type TeachingLoadPreferenceNotice =/);
	assert.match(types, /preferenceNotices\?: TeachingLoadPreferenceNotice\[\]/);
});
