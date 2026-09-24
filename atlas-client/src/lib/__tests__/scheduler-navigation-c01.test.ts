import assert from 'node:assert/strict';
import test from 'node:test';

import { getVisibleNavigation } from '../../components/app-shell/navigation';

test('scheduler navigation is limited to scheduling workspace routes', () => {
	const paths = getVisibleNavigation({ role: 'scheduler', capabilities: ['timetable:read'] })
		.map((item) => item.to);

	assert.deepEqual(paths, ['/', '/teaching-load', '/faculty/concerns', '/timetable', '/schedules']);
	assert.equal(paths.some((path) => path.startsWith('/admin')), false);
	assert.equal(paths.includes('/teachers'), false);
});

test('teacher-schedulers retain self-service and teacher-only accounts do not get scheduler routes', () => {
	const combined = getVisibleNavigation({
		role: 'scheduler',
		capabilities: ['faculty:self-service', 'timetable:read'],
	}).map((item) => item.to);
	const teacher = getVisibleNavigation({ role: 'faculty', capabilities: ['faculty:self-service'] })
		.map((item) => item.to);

	// D6 — the teacher portal is retired; only the read-only `/my` remains.
	assert.ok(combined.includes('/my'));
	assert.ok(combined.includes('/faculty/concerns'));
	assert.deepEqual(teacher, ['/my']);
});

test('role names alone do not grant scheduler navigation without capability', () => {
	const paths = getVisibleNavigation({ role: 'scheduler', capabilities: [] }).map((item) => item.to);
	assert.deepEqual(paths, ['/']);
});
