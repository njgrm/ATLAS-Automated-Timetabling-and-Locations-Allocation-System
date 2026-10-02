import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCanonicalDisplayGrid, buildDayScopedEventWindows } from '../services/schedule-constructor.js';
import { resolveBreakWindowsForScope } from '../services/warning-window-authority.service.js';

const classRows = [
	{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:45', endTime: '07:30', rowKind: 'CLASS' },
	{ gradeLevel: 9, programType: 'REGULAR', startTime: '12:15', endTime: '13:00', rowKind: 'CLASS' },
];
const scopedEvents = [
	{ eventType: 'FLAG_OR_HGP', label: 'Legacy Global Flag', gradeGroup: null, programType: null, startTime: '07:00', endTime: '07:30', enabled: true },
	{ eventType: 'FLAG_OR_HGP', label: 'Flag / HGP', gradeGroup: '7-8', programType: null, startTime: '06:50', endTime: '07:20', enabled: true },
	{ eventType: 'FLAG_OR_HGP', label: 'Flag / HGP', gradeGroup: '9-10', programType: null, startTime: '12:20', endTime: '12:50', enabled: true },
];
const policyBase = {
	maxConsecutiveTeachingMinutesBeforeBreak: 120,
	minBreakMinutesAfterConsecutiveBlock: 15,
	maxTeachingMinutesPerDay: 420,
	earliestStartTime: '06:00',
	latestEndTime: '17:00',
};

test('P07 keeps both scoped overlays in the canonical union, on Monday and within their own class rows', () => {
	const grid = buildCanonicalDisplayGrid({ rows: classRows, policy: { ...policyBase, enableFlagCeremony: true, flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30', specialEvents: scopedEvents } });
	const overlays = grid.specialEventSlots.filter((slot) => slot.isSpecialEvent);
	assert.deepEqual(overlays.map(({ startTime, endTime, dayOfWeek }) => ({ startTime, endTime, dayOfWeek })), [
		{ startTime: '06:45', endTime: '07:30', dayOfWeek: 'MONDAY' },
		{ startTime: '12:15', endTime: '13:00', dayOfWeek: 'MONDAY' },
	]);
	assert.deepEqual(grid.specialEventWindowScopes, [
		{ appliesToAll: false, gradeLevels: [7, 8], programTypes: [] },
		{ appliesToAll: false, gradeLevels: [9, 10], programTypes: [] },
	]);
	assert.deepEqual(buildDayScopedEventWindows({ ...policyBase, specialEvents: scopedEvents }, classRows), [], 'overlays do not become capacity blocks');
});

test('P07 rejects non-containing overlays and scoped authority suppresses the global warning fallback', () => {
	const invalid = [{ ...scopedEvents[0], startTime: '08:00', endTime: '08:30' }];
	const grid = buildCanonicalDisplayGrid({ rows: classRows, policy: { ...policyBase, specialEvents: invalid } });
	assert.equal(grid.specialEventSlots.some((slot) => slot.isSpecialEvent), false);
	const warnings = resolveBreakWindowsForScope({
		policyRow: { enableFlagCeremony: true, flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30' },
		specialEvents: scopedEvents,
		gradeLevel: 7,
		programType: 'REGULAR',
	});
	assert.equal(warnings.some((window) => window.eventType === 'FLAG_OR_HGP'), false);
});
