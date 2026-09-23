import assert from 'node:assert/strict';
import test from 'node:test';

import {
	mapEnrollProRoles,
	SCHEDULING_CAPABILITIES,
	hasCapability,
} from '../services/scheduler-capabilities.js';

test('coordinator plus teacher maps to least-privilege scheduler with teacher self-service', () => {
	const identity = mapEnrollProRoles(['TEACHER', 'GRADE_LEVEL_COORDINATOR']);
	assert.deepEqual(identity, {
		role: 'scheduler',
		capabilities: ['faculty:self-service', 'timetable:schedule'],
	});
});

test('coordinator eligibility comes only from the upstream role claim', () => {
	assert.deepEqual(mapEnrollProRoles(['TEACHER']), {
		role: 'faculty',
		capabilities: ['faculty:self-service'],
	});
	assert.deepEqual(mapEnrollProRoles(['GRADE_LEVEL_COORDINATOR']), {
		role: 'scheduler',
		capabilities: ['timetable:schedule'],
	});
	assert.equal(mapEnrollProRoles(['TEACHER', 'SCHEDULER', 'IT_ADMIN']).role, null);
});

test('scheduler has workspace capabilities but no administration or direct publication', () => {
	const scheduler = ['faculty:self-service', 'timetable:schedule'];
	for (const capability of SCHEDULING_CAPABILITIES) assert.equal(hasCapability(scheduler, capability), true, capability);
	assert.equal(hasCapability(scheduler, 'system:admin'), false);
	assert.equal(hasCapability(scheduler, 'users:admin'), false);
	assert.equal(hasCapability(scheduler, 'timetable:publish'), false);
	assert.equal(hasCapability(['admin:*'], 'system:admin'), true);
});
