import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	CANDIDATE_REJECTION_LABELS,
	candidateRejectionsForResult,
	summarizeCandidateRejections,
	totalCandidateRejections,
} from '@/lib/teaching-load-suggestion-diagnostics';
import type { TeachingLoadCandidateRejection } from '@/types';

function rejection(overrides: Partial<TeachingLoadCandidateRejection> = {}): TeachingLoadCandidateRejection {
	return {
		subjectId: 21,
		subjectCode: 'MATH',
		sectionId: 7001,
		sectionName: 'G7-7001',
		facultyId: 102,
		facultyName: 'Mila Math',
		reason: 'NOT_QUALIFIED',
		...overrides,
	};
}

test('summarizeCandidateRejections groups by reason in canonical order', () => {
	const groups = summarizeCandidateRejections([
		rejection({ reason: 'CURRENT_OWNER', facultyId: 1, facultyName: 'Current Owner' }),
		rejection({ reason: 'NOT_QUALIFIED', facultyId: 2, facultyName: 'No Authority' }),
		rejection({ reason: 'PROGRAM_SCOPE_INCOMPATIBLE', facultyId: 3, facultyName: 'Wrong Program' }),
		rejection({ reason: 'NOT_QUALIFIED', facultyId: 4, facultyName: 'Also No Authority' }),
	]);

	assert.deepEqual(
		groups.map((group) => group.reason),
		['PROGRAM_SCOPE_INCOMPATIBLE', 'NOT_QUALIFIED', 'CURRENT_OWNER'],
	);
	assert.equal(groups[0].count, 1);
	assert.equal(groups[1].count, 2);
	assert.equal(groups[0].label, CANDIDATE_REJECTION_LABELS.PROGRAM_SCOPE_INCOMPATIBLE);
});

test('summarizeCandidateRejections bounds and de-duplicates faculty names', () => {
	const rows = Array.from({ length: 9 }, (_, index) => rejection({ facultyId: index + 1, facultyName: `Teacher ${index + 1}` }));
	rows.push(rejection({ facultyId: 1, facultyName: 'Teacher 1' }));
	const groups = summarizeCandidateRejections(rows);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].count, 10);
	assert.equal(groups[0].facultyNames.length, 4);
	assert.deepEqual(groups[0].facultyNames, ['Teacher 1', 'Teacher 2', 'Teacher 3', 'Teacher 4']);
});

test('summarizeCandidateRejections tolerates undefined/null/empty input', () => {
	assert.deepEqual(summarizeCandidateRejections(undefined), []);
	assert.deepEqual(summarizeCandidateRejections(null), []);
	assert.deepEqual(summarizeCandidateRejections([]), []);
	assert.equal(totalCandidateRejections(undefined), 0);
	assert.equal(totalCandidateRejections([rejection()]), 1);
});

test('candidateRejectionsForResult prefers the top-level list and falls back to the plan', () => {
	const planRow = rejection({ reason: 'HARD_CAP_EXCEEDED' });
	const topRow = rejection({ reason: 'PLACEHOLDER_FACULTY' });
	assert.deepEqual(
		candidateRejectionsForResult({ distribution: { candidateRejections: [planRow] } }),
		[planRow],
	);
	assert.deepEqual(
		candidateRejectionsForResult({ candidateRejections: [topRow], distribution: { candidateRejections: [planRow] } }),
		[topRow],
	);
	assert.deepEqual(candidateRejectionsForResult(null), []);
});
