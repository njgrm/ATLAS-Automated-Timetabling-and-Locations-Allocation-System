import assert from 'node:assert/strict';
import test from 'node:test';

import {
	clampWindowToPolicyBounds,
	ensurePhase3GradeWindows,
	type GradeWindowInput,
} from '../services/grade-window.service.js';
import { withDataContext } from '../lib/data-context.js';

const BOUNDS = { earliestStartTime: '07:00', latestEndTime: '18:30' } as const;

test('clamp moves a bootstrap default start up to the policy earliest bound', () => {
	const clamped = clampWindowToPolicyBounds(
		{ gradeLevel: 7, programType: null, startTime: '06:00', endTime: '15:30' },
		BOUNDS,
	);
	assert.deepEqual(clamped, { gradeLevel: 7, programType: null, startTime: '07:00', endTime: '15:30' });
});

test('clamp pulls an end beyond the policy latest bound inward', () => {
	const clamped = clampWindowToPolicyBounds(
		{ gradeLevel: 9, programType: null, startTime: '09:45', endTime: '19:00' },
		BOUNDS,
	);
	assert.deepEqual(clamped, { gradeLevel: 9, programType: null, startTime: '09:45', endTime: '18:30' });
});

test('an already in-bounds window is returned unchanged', () => {
	const input: GradeWindowInput = { gradeLevel: 10, programType: 'STE', startTime: '09:45', endTime: '17:30' };
	const clamped = clampWindowToPolicyBounds(input, BOUNDS);
	assert.deepEqual(clamped, input);
});

test('a default fully outside the bounds yields null instead of an invalid window', () => {
	const clamped = clampWindowToPolicyBounds(
		{ gradeLevel: 7, programType: null, startTime: '06:00', endTime: '06:45' },
		{ earliestStartTime: '07:00', latestEndTime: '07:30' },
	);
	assert.equal(clamped, null);
});

test('clamping preserves the programType when present', () => {
	const clamped = clampWindowToPolicyBounds(
		{ gradeLevel: 7, programType: 'SPS', startTime: '06:00', endTime: '18:45' },
		BOUNDS,
	);
	assert.deepEqual(clamped, { gradeLevel: 7, programType: 'SPS', startTime: '07:00', endTime: '18:30' });
});

test('ensurePhase3GradeWindows clamps bootstrap defaults to policy bounds instead of throwing', async () => {
	// Failing-first: with persisted policy bounds 07:00-18:30 and zero windows,
	// the unclamped bootstrap would throw WINDOW_OUT_OF_POLICY_BOUNDS for the
	// G7/G8 06:00 defaults. The corrected path clamps inward and never throws.
	const createdWindows: Array<{ gradeLevel: number; programType: string | null; startTime: string; endTime: string }> = [];
	const mockClient = {
		schedulingPolicy: {
			findUnique: async () => ({ earliestStartTime: '07:00', latestEndTime: '18:30' }),
		},
		gradeShiftWindow: {
			findFirst: async () => null,
			create: async ({ data }: { data: { gradeLevel: number; programType: string | null; startTime: string; endTime: string } }) => {
				createdWindows.push({ ...data });
				return { id: createdWindows.length, ...data };
			},
			update: async ({ data }: { data: { startTime: string; endTime: string } }) => ({ id: 1, ...data }),
			upsert: async ({ create, update }: { create: { gradeLevel: number; programType: string | null; startTime: string; endTime: string }; update: { startTime: string; endTime: string } }) => {
				createdWindows.push({ ...create });
				return { id: createdWindows.length, ...create };
			},
		},
	} as never;

	const ensured = await withDataContext(mockClient, () => ensurePhase3GradeWindows(1, 8));
	assert.equal(ensured.length > 0, true, 'bootstrap created windows without throwing');
	assert.equal(createdWindows.some((w) => w.gradeLevel === 7 && w.programType === null), true, 'Grade 7 REGULAR default was created');
	for (const window of createdWindows) {
		assert.equal(window.startTime >= '07:00', true, `created window ${window.gradeLevel}/${window.programType} starts within policy bounds (${window.startTime})`);
		assert.equal(window.endTime <= '18:30', true, `created window ${window.gradeLevel}/${window.programType} ends within policy bounds (${window.endTime})`);
	}
	const g7 = createdWindows.find((w) => w.gradeLevel === 7 && w.programType === null);
	assert.equal(g7?.startTime, '07:00', 'Grade 7 REGULAR window start was clamped to the policy earliest bound');
	assert.equal(g7?.endTime, '15:30', 'Grade 7 REGULAR window end was preserved');
});