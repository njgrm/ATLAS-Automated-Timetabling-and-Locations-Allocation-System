/**
 * Constructor integration tests — proves shift-specific events are applied
 * per grade/program in timetable shape contracts.
 */

import { buildTimetableShapeContract, buildPeriodSlots, buildSpecialEventSlots } from '../services/schedule-constructor.js';
import { getEffectiveEvents } from '../lib/policy-special-events.js';

let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string) {
	if (condition) {
		pass++;
		console.log(`  ✓ ${label}`);
	} else {
		fail++;
		console.error(`  ✗ ${label}`);
	}
}

const BASELINE_EVENTS = [
	{ eventType: 'HEALTH_BREAK', label: 'Day Shift Health Break', gradeGroup: '7-8', programType: null, startTime: '09:00', endTime: '09:15', enabled: true },
	{ eventType: 'LUNCH_BREAK', label: 'Day Shift Lunch Break', gradeGroup: '7-8', programType: null, startTime: '12:15', endTime: '13:00', enabled: true },
	{ eventType: 'LUNCH_BREAK', label: 'Afternoon Shift Lunch Break', gradeGroup: '9-10', programType: null, startTime: '12:15', endTime: '13:00', enabled: true },
	{ eventType: 'HEALTH_BREAK', label: 'Afternoon Shift Health Break', gradeGroup: '9-10', programType: null, startTime: '15:15', endTime: '15:30', enabled: true },
];

const BASE_POLICY = {
	maxConsecutiveTeachingMinutesBeforeBreak: 120,
	minBreakMinutesAfterConsecutiveBlock: 15,
	maxTeachingMinutesPerDay: 480,
	earliestStartTime: '06:00',
	latestEndTime: '18:30',
	periodLengthMinutes: 45,
	periodsPerDay: 10,
};

console.log('schedule-constructor: shift-specific event integration\n');

// ─── Test 1: GR7 shape includes only day-shift events ───
{
	const contract = buildTimetableShapeContract({
		gradeLevel: 7,
		programType: null,
		startTime: '06:00',
		endTime: '15:30',
		periodLengthMinutes: 45,
		periodsPerDay: 10,
		basePolicy: { ...BASE_POLICY, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
	});

	const eventSlots = contract.displaySlots.filter((s) => s.isSpecialEvent);
	const eventNames = eventSlots.map((s) => s.eventName);

	assert(eventNames.includes('Day Shift Health Break'), 'GR7 includes Day Shift Health Break');
	assert(eventNames.includes('Day Shift Lunch Break'), 'GR7 includes Day Shift Lunch Break');
	assert(!eventNames.includes('Afternoon Shift Health Break'), 'GR7 excludes Afternoon Shift Health Break');
	assert(!eventNames.includes('Afternoon Shift Lunch Break'), 'GR7 excludes Afternoon Shift Lunch Break');
	assert(eventSlots.length === 2, `GR7 has exactly 2 event slots (got ${eventSlots.length})`);
}

// ─── Test 2: GR9 shape includes only afternoon-shift events ───
{
	const contract = buildTimetableShapeContract({
		gradeLevel: 9,
		programType: null,
		startTime: '09:45',
		endTime: '18:30',
		periodLengthMinutes: 45,
		periodsPerDay: 10,
		basePolicy: { ...BASE_POLICY, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
	});

	const eventSlots = contract.displaySlots.filter((s) => s.isSpecialEvent);
	const eventNames = eventSlots.map((s) => s.eventName);

	assert(eventNames.includes('Afternoon Shift Health Break'), 'GR9 includes Afternoon Shift Health Break');
	assert(eventNames.includes('Afternoon Shift Lunch Break'), 'GR9 includes Afternoon Shift Lunch Break');
	assert(!eventNames.includes('Day Shift Health Break'), 'GR9 excludes Day Shift Health Break');
	assert(!eventNames.includes('Day Shift Lunch Break'), 'GR9 excludes Day Shift Lunch Break');
	assert(eventSlots.length === 2, `GR9 has exactly 2 event slots (got ${eventSlots.length})`);
}

// ─── Test 3: GR7 period slots are not blocked by afternoon events ───
{
	const contract = buildTimetableShapeContract({
		gradeLevel: 7,
		programType: null,
		startTime: '06:00',
		endTime: '15:30',
		periodLengthMinutes: 45,
		periodsPerDay: 12,
		basePolicy: { ...BASE_POLICY, periodsPerDay: 12, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
	});

	const periodStarts = contract.periodSlots.map((s) => s.startTime);
	// With 12 max periods and day-shift events only, the afternoon health break (15:15-15:30)
	// should NOT appear as a blocked window for GR7.
	// Last slot should be 14:30-15:15 (fits within 06:00-15:30 window).
	const lastSlot = contract.periodSlots[contract.periodSlots.length - 1];
	assert(lastSlot?.startTime === '14:30', `GR7 last period starts at 14:30 (got ${lastSlot?.startTime})`);
	assert(lastSlot?.endTime === '15:15', `GR7 last period ends at 15:15 (got ${lastSlot?.endTime})`);
	// Verify the afternoon health break time (15:15-15:30) is not in any period slot
	const hasSlotBlockingAfternoon = periodStarts.some((s) => s >= '15:15');
	assert(!hasSlotBlockingAfternoon, 'GR7 has no period slot blocked by 15:15 afternoon health break');
}

// ─── Test 4: Global fallback works when no persisted events ───
{
	const contract = buildTimetableShapeContract({
		gradeLevel: 7,
		programType: null,
		startTime: '06:00',
		endTime: '18:30',
		periodLengthMinutes: 45,
		periodsPerDay: 10,
		basePolicy: {
			...BASE_POLICY,
			enableFlagCeremony: true,
			flagCeremonyStartTime: '07:00',
			flagCeremonyEndTime: '07:30',
			enableRecess: true,
			recessStartTime: '09:45',
			recessEndTime: '10:00',
			enableLunchWindow: true,
			lunchStartTime: '11:55',
			lunchEndTime: '12:55',
			showSpecialEventsInGrid: true,
			specialEvents: [],
		},
	});

	const eventSlots = contract.displaySlots.filter((s) => s.isSpecialEvent);
	const eventNames = eventSlots.map((s) => s.eventName);

	assert(eventNames.includes('FLAG CEREMONY'), 'Global fallback includes FLAG CEREMONY');
	assert(eventNames.includes('RECESS'), 'Global fallback includes RECESS');
	assert(eventNames.includes('LUNCH BREAK'), 'Global fallback includes LUNCH BREAK');
	assert(eventSlots.length === 3, `Global fallback has exactly 3 event slots (got ${eventSlots.length})`);
}

// ─── Test 5: getEffectiveEvents directly ───
{
	const result = getEffectiveEvents(BASELINE_EVENTS, 7, null);
	const labels = result.map((e) => e.label);
	assert(labels.includes('Day Shift Health Break'), 'getEffectiveEvents(7) includes day health');
	assert(labels.includes('Day Shift Lunch Break'), 'getEffectiveEvents(7) includes day lunch');
	assert(!labels.includes('Afternoon Shift Health Break'), 'getEffectiveEvents(7) excludes afternoon health');
	assert(!labels.includes('Afternoon Shift Lunch Break'), 'getEffectiveEvents(7) excludes afternoon lunch');

	const result9 = getEffectiveEvents(BASELINE_EVENTS, 10, null);
	const labels9 = result9.map((e) => e.label);
	assert(labels9.includes('Afternoon Shift Health Break'), 'getEffectiveEvents(10) includes afternoon health');
	assert(labels9.includes('Afternoon Shift Lunch Break'), 'getEffectiveEvents(10) includes afternoon lunch');
	assert(!labels9.includes('Day Shift Health Break'), 'getEffectiveEvents(10) excludes day health');
	assert(!labels9.includes('Day Shift Lunch Break'), 'getEffectiveEvents(10) excludes day lunch');
}

// ─── Test 6: GR8 uses same day-shift events as GR7 ───
{
	const contract = buildTimetableShapeContract({
		gradeLevel: 8,
		programType: null,
		startTime: '06:00',
		endTime: '15:30',
		periodLengthMinutes: 45,
		periodsPerDay: 10,
		basePolicy: { ...BASE_POLICY, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
	});

	const eventSlots = contract.displaySlots.filter((s) => s.isSpecialEvent);
	const eventNames = eventSlots.map((s) => s.eventName);
	assert(eventNames.includes('Day Shift Health Break'), 'GR8 includes Day Shift Health Break');
	assert(!eventNames.includes('Afternoon Shift Health Break'), 'GR8 excludes Afternoon Shift Health Break');
}

// ─── Test 7: GR10 uses same afternoon-shift events as GR9 ───
{
	const contract = buildTimetableShapeContract({
		gradeLevel: 10,
		programType: null,
		startTime: '09:45',
		endTime: '18:30',
		periodLengthMinutes: 45,
		periodsPerDay: 10,
		basePolicy: { ...BASE_POLICY, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
	});

	const eventSlots = contract.displaySlots.filter((s) => s.isSpecialEvent);
	const eventNames = eventSlots.map((s) => s.eventName);
	assert(eventNames.includes('Afternoon Shift Health Break'), 'GR10 includes Afternoon Shift Health Break');
	assert(!eventNames.includes('Day Shift Health Break'), 'GR10 excludes Day Shift Health Break');
}

// ─── Test 8: GR7 STE with STE override uses STE-specific event ───
{
	const eventsWithSTE = [
		...BASELINE_EVENTS,
		{ eventType: 'HEALTH_BREAK', label: 'GR7 STE Health', gradeGroup: '7-8', programType: 'STE', startTime: '09:30', endTime: '09:45', enabled: true },
	];
	const contract = buildTimetableShapeContract({
		gradeLevel: 7,
		programType: 'STE',
		startTime: '06:00',
		endTime: '15:30',
		periodLengthMinutes: 45,
		periodsPerDay: 10,
		basePolicy: { ...BASE_POLICY, specialEvents: eventsWithSTE, showSpecialEventsInGrid: true },
	});

	const eventSlots = contract.displaySlots.filter((s) => s.isSpecialEvent);
	const healthEvents = eventSlots.filter((s) => s.eventName?.includes('Health'));
	assert(healthEvents.length === 1, 'GR7 STE: exactly 1 health event (not 2)');
	assert(healthEvents[0].eventName === 'GR7 STE Health', 'GR7 STE: uses STE-specific health event');
}

// ─── Test 9: GR7 STE without STE override uses shift default ───
{
	const contract = buildTimetableShapeContract({
		gradeLevel: 7,
		programType: 'STE',
		startTime: '06:00',
		endTime: '15:30',
		periodLengthMinutes: 45,
		periodsPerDay: 10,
		basePolicy: { ...BASE_POLICY, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
	});

	const eventSlots = contract.displaySlots.filter((s) => s.isSpecialEvent);
	const healthEvents = eventSlots.filter((s) => s.eventName?.includes('Health'));
	assert(healthEvents.length === 1, 'GR7 STE no override: exactly 1 health event');
	assert(healthEvents[0].eventName === 'Day Shift Health Break', 'GR7 STE no override: uses shift default');
}

// ─── Test 10: GR7 regular still uses grade-default row ───
{
	const eventsWithSTE = [
		...BASELINE_EVENTS,
		{ eventType: 'HEALTH_BREAK', label: 'GR7 STE Health', gradeGroup: '7-8', programType: 'STE', startTime: '09:30', endTime: '09:45', enabled: true },
	];
	const contract = buildTimetableShapeContract({
		gradeLevel: 7,
		programType: null,
		startTime: '06:00',
		endTime: '15:30',
		periodLengthMinutes: 45,
		periodsPerDay: 10,
		basePolicy: { ...BASE_POLICY, specialEvents: eventsWithSTE, showSpecialEventsInGrid: true },
	});

	const eventSlots = contract.displaySlots.filter((s) => s.isSpecialEvent);
	const healthEvents = eventSlots.filter((s) => s.eventName?.includes('Health'));
	assert(healthEvents.length === 1, 'GR7 regular: exactly 1 health event');
	assert(healthEvents[0].eventName === 'Day Shift Health Break', 'GR7 regular: uses shift default, not STE override');
}

console.log(`\n${pass + fail} tests, ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
