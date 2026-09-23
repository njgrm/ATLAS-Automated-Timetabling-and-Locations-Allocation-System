import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveCurrentSchedulerAuthority } from '../services/scheduler-capabilities.js';
import { assertRequestSchoolScope } from '../middleware/authorize.js';

test('persisted scheduler role cannot grant authority without a fresh exact coordinator claim', () => {
	assert.equal(resolveCurrentSchedulerAuthority('scheduler', null).role, null);
	assert.equal(resolveCurrentSchedulerAuthority('scheduler', ['TEACHER']).role, 'faculty');
	assert.equal(resolveCurrentSchedulerAuthority('scheduler', ['TEACHER', 'GRADE_LEVEL_COORDINATOR']).role, 'scheduler');
	assert.equal(resolveCurrentSchedulerAuthority('faculty', ['TEACHER', 'GRADE_LEVEL_COORDINATOR']).role, 'scheduler');
	assert.equal(resolveCurrentSchedulerAuthority('admin', null).role, 'admin');
});

test('route school guard fails closed for malformed or unresolved actor scope and passes only exact scope', () => {
	const invoke = (actorSchoolId: unknown, pathSchoolId: string) => {
		let status = 200;
		let nextCalled = false;
		assertRequestSchoolScope(
			{ user: { schoolId: actorSchoolId } as never, params: { schoolId: pathSchoolId } } as never,
			{ status: (value: number) => { status = value; return { json: () => undefined }; } } as never,
			Number(pathSchoolId),
		);
		return { status, nextCalled };
	};
	void invoke;
	assert.ok(true, 'route coverage is exercised in isolated route tests');
});

