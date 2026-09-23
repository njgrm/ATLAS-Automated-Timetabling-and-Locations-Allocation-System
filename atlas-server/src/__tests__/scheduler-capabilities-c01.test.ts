import assert from 'node:assert/strict';
import test from 'node:test';

import {
	mapEnrollProRoles,
	capabilitiesForRole,
	SCHEDULING_CAPABILITIES,
	hasCapability,
} from '../services/scheduler-capabilities.js';
import { requireCapability } from '../middleware/authorize.js';

test('coordinator plus teacher maps to least-privilege scheduler with teacher self-service', () => {
	const identity = mapEnrollProRoles(['TEACHER', 'GRADE_LEVEL_COORDINATOR']);
	assert.equal(identity.role, 'scheduler');
	assert.ok(identity.capabilities.includes('faculty:self-service'));
	for (const capability of SCHEDULING_CAPABILITIES) assert.ok(identity.capabilities.includes(capability), capability);
	assert.equal(identity.capabilities.includes('timetable:publish'), false);
});

test('coordinator eligibility comes only from the upstream role claim', () => {
	assert.deepEqual(mapEnrollProRoles(['TEACHER']), {
		role: 'faculty',
		capabilities: ['faculty:self-service'],
	});
	assert.equal(mapEnrollProRoles(['GRADE_LEVEL_COORDINATOR']).role, 'scheduler');
	assert.deepEqual(mapEnrollProRoles(['GRADE_LEVEL_COORDINATOR']).capabilities, [...SCHEDULING_CAPABILITIES]);
	assert.equal(mapEnrollProRoles(['SCHEDULER', 'IT_ADMIN']).role, null);
});

test('scheduler has workspace capabilities but no administration or direct publication', () => {
	const scheduler = capabilitiesForRole('scheduler', []);
	for (const capability of SCHEDULING_CAPABILITIES) assert.equal(hasCapability(scheduler, capability), true, capability);
	assert.equal(hasCapability(scheduler, 'system:admin'), false);
	assert.equal(hasCapability(scheduler, 'users:admin'), false);
	assert.equal(hasCapability(scheduler, 'timetable:publish'), false);
	assert.equal(hasCapability(['admin:*'], 'system:admin'), true);
});

test('capability middleware admits schedulers to the workspace and rejects teachers and admins-only work', () => {
	const invoke = (role: string, capabilities: string[], required: Parameters<typeof requireCapability>[0]) => {
		let nextCalled = false;
		let status = 200;
		const middleware = requireCapability(required);
		middleware(
			{ user: { role, capabilities } } as never,
			{ status: (value: number) => { status = value; return { json: () => undefined }; } } as never,
			() => { nextCalled = true; },
		);
		return { nextCalled, status };
	};

	assert.deepEqual(invoke('scheduler', [], 'timetable:generate'), { nextCalled: true, status: 200 });
	assert.deepEqual(invoke('faculty', [], 'timetable:generate'), { nextCalled: false, status: 403 });
	assert.deepEqual(invoke('scheduler', [], 'users:admin'), { nextCalled: false, status: 403 });
	assert.deepEqual(invoke('scheduler', [], 'timetable:publish'), { nextCalled: false, status: 403 });
});
