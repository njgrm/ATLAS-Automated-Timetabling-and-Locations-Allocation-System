import assert from 'node:assert/strict';
import test from 'node:test';

import { parseRouteIntent } from '../useTeachingLoadRouteIntent';

function params(entries: Record<string, string>): URLSearchParams {
	return new URLSearchParams(entries);
}

test('parseRouteIntent: no parameters returns null viewMode', () => {
	const intent = parseRouteIntent(new URLSearchParams());
	assert.equal(intent.viewMode, null);
	assert.equal(intent.facultyId, null);
	assert.equal(intent.sectionId, null);
	assert.equal(intent.subjectId, null);
	assert.equal(intent.task, null);
});

test('parseRouteIntent: view=subjects without facultyId opens subjects mode', () => {
	const intent = parseRouteIntent(params({ view: 'subjects' }));
	assert.equal(intent.viewMode, 'subjects');
});

test('parseRouteIntent: view=subjects with facultyId does NOT open subjects mode', () => {
	const intent = parseRouteIntent(params({ view: 'subjects', facultyId: '7' }));
	assert.equal(intent.viewMode, 'teacher');
	assert.equal(intent.facultyId, 7);
});

test('parseRouteIntent: task=missing-load without facultyId opens subjects mode (school-wide)', () => {
	const intent = parseRouteIntent(params({ task: 'missing-load' }));
	assert.equal(intent.viewMode, 'subjects');
	assert.equal(intent.task, 'missing-load');
	assert.equal(intent.facultyId, null);
});

test('parseRouteIntent: task=missing-load with facultyId opens teacher mode (teacher-specific)', () => {
	const intent = parseRouteIntent(params({ facultyId: '7', task: 'missing-load' }));
	assert.equal(intent.viewMode, 'teacher');
	assert.equal(intent.facultyId, 7);
	assert.equal(intent.task, 'missing-load');
});

test('parseRouteIntent: sectionId opens allocation mode', () => {
	const intent = parseRouteIntent(params({ sectionId: '42' }));
	assert.equal(intent.viewMode, 'allocation');
	assert.equal(intent.sectionId, 42);
});

test('parseRouteIntent: facultyId opens teacher mode', () => {
	const intent = parseRouteIntent(params({ facultyId: '7' }));
	assert.equal(intent.viewMode, 'teacher');
	assert.equal(intent.facultyId, 7);
});

test('parseRouteIntent: task=over-cap opens teacher mode', () => {
	const intent = parseRouteIntent(params({ facultyId: '5', task: 'over-cap' }));
	assert.equal(intent.viewMode, 'teacher');
	assert.equal(intent.facultyId, 5);
	assert.equal(intent.task, 'over-cap');
});

test('parseRouteIntent: view=subjects takes precedence over sectionId', () => {
	const intent = parseRouteIntent(params({ view: 'subjects', sectionId: '42' }));
	assert.equal(intent.viewMode, 'subjects');
	assert.equal(intent.sectionId, null, 'sectionId must be null when view=subjects wins');
});

test('parseRouteIntent: sectionId takes precedence over facultyId alone', () => {
	const intent = parseRouteIntent(params({ facultyId: '7', sectionId: '42' }));
	assert.equal(intent.viewMode, 'allocation');
	assert.equal(intent.sectionId, 42);
	assert.equal(intent.facultyId, 7, 'facultyId is preserved for selection');
});

test('parseRouteIntent: subjectId is preserved in all modes', () => {
	const subjectsIntent = parseRouteIntent(params({ view: 'subjects', subjectId: '10' }));
	assert.equal(subjectsIntent.subjectId, 10);

	const sectionIntent = parseRouteIntent(params({ sectionId: '42', subjectId: '10' }));
	assert.equal(sectionIntent.subjectId, 10);

	const teacherIntent = parseRouteIntent(params({ facultyId: '7', subjectId: '10' }));
	assert.equal(teacherIntent.subjectId, 10);
});

test('parseRouteIntent: invalid numeric IDs are treated as null', () => {
	const intent = parseRouteIntent(params({ facultyId: 'abc', sectionId: 'xyz' }));
	assert.equal(intent.facultyId, null);
	assert.equal(intent.sectionId, null);
	assert.equal(intent.viewMode, null);
});

test('parseRouteIntent: non-positive IDs are rejected', () => {
	assert.equal(parseRouteIntent(params({ facultyId: '0' })).facultyId, null);
	assert.equal(parseRouteIntent(params({ facultyId: '-1' })).facultyId, null);
	assert.equal(parseRouteIntent(params({ sectionId: '0' })).sectionId, null);
	assert.equal(parseRouteIntent(params({ sectionId: '-5' })).sectionId, null);
});

test('parseRouteIntent: decimal IDs are rejected', () => {
	assert.equal(parseRouteIntent(params({ facultyId: '7.5' })).facultyId, null);
	assert.equal(parseRouteIntent(params({ sectionId: '42.1' })).sectionId, null);
});

test('parseRouteIntent: Infinity and NaN are rejected', () => {
	assert.equal(parseRouteIntent(params({ facultyId: 'Infinity' })).facultyId, null);
	assert.equal(parseRouteIntent(params({ facultyId: 'NaN' })).facultyId, null);
	assert.equal(parseRouteIntent(params({ sectionId: 'Infinity' })).sectionId, null);
});

test('parseRouteIntent: facultyId + subjectId opens teacher mode with subject discoverable', () => {
	const intent = parseRouteIntent(params({ facultyId: '7', subjectId: '10' }));
	assert.equal(intent.viewMode, 'teacher');
	assert.equal(intent.facultyId, 7);
	assert.equal(intent.subjectId, 10);
});

test('parseRouteIntent: sectionId + subjectId opens allocation mode with subject', () => {
	const intent = parseRouteIntent(params({ sectionId: '42', subjectId: '10' }));
	assert.equal(intent.viewMode, 'allocation');
	assert.equal(intent.sectionId, 42);
	assert.equal(intent.subjectId, 10);
});

test('parseRouteIntent: task=review-placeholders opens teacher mode', () => {
	const intent = parseRouteIntent(params({ task: 'review-placeholders' }));
	assert.equal(intent.viewMode, 'teacher');
	assert.equal(intent.task, 'review-placeholders');
});

test('parseRouteIntent: unknown task opens teacher mode', () => {
	const intent = parseRouteIntent(params({ task: 'unknown-task' }));
	assert.equal(intent.viewMode, 'teacher');
	assert.equal(intent.task, 'unknown-task');
});

test('parseRouteIntent: facultyId + task=over-cap opens teacher mode with task', () => {
	const intent = parseRouteIntent(params({ facultyId: '5', task: 'over-cap' }));
	assert.equal(intent.viewMode, 'teacher');
	assert.equal(intent.facultyId, 5);
	assert.equal(intent.task, 'over-cap');
});

test('parseRouteIntent: view=subjects with facultyId falls through to teacher mode', () => {
	// When view=subjects is combined with facultyId, facultyId takes precedence
	// because teacher-specific intent should not be overridden by view=subjects
	const intent = parseRouteIntent(params({ view: 'subjects', facultyId: '7' }));
	assert.equal(intent.viewMode, 'teacher');
	assert.equal(intent.facultyId, 7);
});
