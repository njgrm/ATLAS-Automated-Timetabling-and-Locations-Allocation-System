/**
 * Constructor integration tests — proves shift-specific events are applied
 * per grade/program in timetable shape contracts.
 */
import { buildTimetableShapeContract } from '../services/schedule-constructor.js';
import { getEffectiveEvents } from '../lib/policy-special-events.js';
let pass = 0;
let fail = 0;
function assert(condition, label) {
    if (condition) {
        pass++;
        console.log(`  ✓ ${label}`);
    }
    else {
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
// ═══════════════════════════════════════════════════════════════
// Prompt 04: Candidate-slot proof and special-event blocking
// ═══════════════════════════════════════════════════════════════
// ─── Test 11: GR7/GR8 can produce schedulable candidates at 06:00 ───
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
    const firstSlot = contract.periodSlots[0];
    assert(firstSlot?.startTime === '06:00', `GR7 first period starts at 06:00 (got ${firstSlot?.startTime})`);
    assert(firstSlot?.endTime === '06:45', `GR7 first period ends at 06:45 (got ${firstSlot?.endTime})`);
    assert(!firstSlot?.isSpecialEvent, 'GR7 06:00 slot is schedulable (not a special event)');
}
// ─── Test 12: GR9/GR10 can produce schedulable candidates after 17:00 ───
{
    const contract = buildTimetableShapeContract({
        gradeLevel: 9,
        programType: null,
        startTime: '09:45',
        endTime: '18:30',
        periodLengthMinutes: 45,
        periodsPerDay: 12,
        basePolicy: { ...BASE_POLICY, periodsPerDay: 12, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
    });
    // GR9 window is 09:45-18:30. With 45-min periods, slots after 17:00 should exist.
    const slotsAfter1700 = contract.periodSlots.filter((s) => s.startTime >= '17:00');
    assert(slotsAfter1700.length > 0, `GR9 has schedulable candidates after 17:00 (found ${slotsAfter1700.length})`);
    assert(slotsAfter1700[0].startTime === '17:00', `GR9 first post-17:00 slot starts at 17:00 (got ${slotsAfter1700[0]?.startTime})`);
    assert(slotsAfter1700[0].endTime === '17:45', `GR9 first post-17:00 slot ends at 17:45 (got ${slotsAfter1700[0]?.endTime})`);
}
// ─── Test 13: GR9/GR10 can produce schedulable candidates through 18:30 ───
{
    const contract = buildTimetableShapeContract({
        gradeLevel: 10,
        programType: null,
        startTime: '09:45',
        endTime: '18:30',
        periodLengthMinutes: 45,
        periodsPerDay: 12,
        basePolicy: { ...BASE_POLICY, periodsPerDay: 12, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
    });
    const lastSlot = contract.periodSlots[contract.periodSlots.length - 1];
    // GR9/GR10 window ends at 18:30. Last 45-min slot that fits: 17:45-18:30
    assert(lastSlot?.startTime === '17:45', `GR10 last period starts at 17:45 (got ${lastSlot?.startTime})`);
    assert(lastSlot?.endTime === '18:30', `GR10 last period ends at 18:30 (got ${lastSlot?.endTime})`);
}
// ─── Test 14: GR7 health break blocks 09:00-09:15 but not other slots ───
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
    // 08:15-09:00 should exist (before health break)
    assert(periodStarts.includes('08:15'), 'GR7 has 08:15 slot (before health break)');
    // 09:00 should NOT be a period start (blocked by health break 09:00-09:15)
    assert(!periodStarts.includes('09:00'), 'GR7 09:00 blocked by health break');
    // 09:15 should exist (after health break)
    assert(periodStarts.includes('09:15'), 'GR7 has 09:15 slot (after health break)');
}
// ─── Test 15: GR9 health break blocks 15:15-15:30 but not other slots ───
{
    const contract = buildTimetableShapeContract({
        gradeLevel: 9,
        programType: null,
        startTime: '09:45',
        endTime: '18:30',
        periodLengthMinutes: 45,
        periodsPerDay: 12,
        basePolicy: { ...BASE_POLICY, periodsPerDay: 12, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
    });
    const periodStarts = contract.periodSlots.map((s) => s.startTime);
    // 14:30-15:15 should exist (before health break)
    assert(periodStarts.includes('14:30'), 'GR9 has 14:30 slot (before health break)');
    // 15:15 should NOT be a period start (blocked by health break 15:15-15:30)
    assert(!periodStarts.includes('15:15'), 'GR9 15:15 blocked by health break');
    // 15:30 should exist (after health break)
    assert(periodStarts.includes('15:30'), 'GR9 has 15:30 slot (after health break)');
}
// ─── Test 16: GR7 health break does NOT block GR9 ───
{
    const contract = buildTimetableShapeContract({
        gradeLevel: 9,
        programType: null,
        startTime: '09:45',
        endTime: '18:30',
        periodLengthMinutes: 45,
        periodsPerDay: 12,
        basePolicy: { ...BASE_POLICY, periodsPerDay: 12, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
    });
    const periodStarts = contract.periodSlots.map((s) => s.startTime);
    // GR9 should have a slot at 09:45 (GR7's health break at 09:00-09:15 does NOT apply to GR9)
    assert(periodStarts.includes('09:45'), 'GR9 has 09:45 slot (GR7 health break does not block GR9)');
}
// ─── Test 17: Display slots include events, period slots do not ───
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
    const displayEvents = contract.displaySlots.filter((s) => s.isSpecialEvent);
    const periodEvents = contract.periodSlots.filter((s) => s.isSpecialEvent);
    assert(displayEvents.length === 2, `displaySlots has 2 events (got ${displayEvents.length})`);
    assert(periodEvents.length === 0, `periodSlots has 0 events (got ${periodEvents.length})`);
    assert(contract.periodSlots.length < contract.displaySlots.length, 'periodSlots < displaySlots (events add to display only)');
}
// ─── Test 18: GR9 lunch at 12:15-13:00 blocks that range for GR9 ───
{
    const contract = buildTimetableShapeContract({
        gradeLevel: 9,
        programType: null,
        startTime: '09:45',
        endTime: '18:30',
        periodLengthMinutes: 45,
        periodsPerDay: 12,
        basePolicy: { ...BASE_POLICY, periodsPerDay: 12, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
    });
    const periodStarts = contract.periodSlots.map((s) => s.startTime);
    // 11:15-12:00 should exist (before lunch)
    assert(periodStarts.includes('11:15'), 'GR9 has 11:15 slot (before lunch)');
    // 12:00-12:45 overlaps lunch (12:15-13:00), so 12:00 should be blocked
    assert(!periodStarts.includes('12:00'), 'GR9 12:00 blocked by lunch overlap');
    // 13:00 should exist (after lunch)
    assert(periodStarts.includes('13:00'), 'GR9 has 13:00 slot (after lunch)');
}
// ─── Test 19: GR7 lunch at 12:15-13:00 blocks that range for GR7 ───
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
    assert(periodStarts.includes('11:30'), 'GR7 has 11:30 slot (before lunch)');
    assert(!periodStarts.includes('12:15'), 'GR7 12:15 blocked by lunch');
    assert(periodStarts.includes('13:00'), 'GR7 has 13:00 slot (after lunch)');
}
// ─── Test 20: GR7 candidate slots span full day-shift range ───
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
    // Verify candidates exist across the full day-shift range
    assert(periodStarts[0] === '06:00', `GR7 earliest candidate is 06:00 (got ${periodStarts[0]})`);
    const lastPeriod = contract.periodSlots[contract.periodSlots.length - 1];
    assert(lastPeriod.endTime === '15:15', `GR7 latest candidate ends at 15:15 (got ${lastPeriod.endTime})`);
    assert(contract.periodSlots.length >= 10, `GR7 has at least 10 schedulable periods (got ${contract.periodSlots.length})`);
}
// ─── Test 21: GR9 candidate slots span full afternoon-shift range ───
{
    const contract = buildTimetableShapeContract({
        gradeLevel: 9,
        programType: null,
        startTime: '09:45',
        endTime: '18:30',
        periodLengthMinutes: 45,
        periodsPerDay: 12,
        basePolicy: { ...BASE_POLICY, periodsPerDay: 12, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
    });
    const periodStarts = contract.periodSlots.map((s) => s.startTime);
    assert(periodStarts[0] === '09:45', `GR9 earliest candidate is 09:45 (got ${periodStarts[0]})`);
    const lastPeriod = contract.periodSlots[contract.periodSlots.length - 1];
    assert(lastPeriod.endTime === '18:30', `GR9 latest candidate ends at 18:30 (got ${lastPeriod.endTime})`);
    assert(contract.periodSlots.length >= 10, `GR9 has at least 10 schedulable periods (got ${contract.periodSlots.length})`);
}
// ═══════════════════════════════════════════════════════════════
// Per-section display slot selection tests
// ═══════════════════════════════════════════════════════════════
// ─── Test 22: GR7 shape contract displaySlots contains only day-shift events ───
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
    const displayEvents = contract.displaySlots.filter((s) => s.isSpecialEvent);
    const eventNames = displayEvents.map((s) => s.eventName);
    assert(eventNames.includes('Day Shift Health Break'), 'GR7 displaySlots includes Day Shift Health Break');
    assert(eventNames.includes('Day Shift Lunch Break'), 'GR7 displaySlots includes Day Shift Lunch Break');
    assert(!eventNames.includes('Afternoon Shift Health Break'), 'GR7 displaySlots excludes Afternoon Shift Health Break');
    assert(!eventNames.includes('Afternoon Shift Lunch Break'), 'GR7 displaySlots excludes Afternoon Shift Lunch Break');
}
// ─── Test 23: GR9 shape contract displaySlots contains only afternoon-shift events ───
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
    const displayEvents = contract.displaySlots.filter((s) => s.isSpecialEvent);
    const eventNames = displayEvents.map((s) => s.eventName);
    assert(eventNames.includes('Afternoon Shift Health Break'), 'GR9 displaySlots includes Afternoon Shift Health Break');
    assert(eventNames.includes('Afternoon Shift Lunch Break'), 'GR9 displaySlots includes Afternoon Shift Lunch Break');
    assert(!eventNames.includes('Day Shift Health Break'), 'GR9 displaySlots excludes Day Shift Health Break');
    assert(!eventNames.includes('Day Shift Lunch Break'), 'GR9 displaySlots excludes Day Shift Lunch Break');
}
// ─── Test 24: Union display slots contain both shift events ───
{
    const { buildUnionDisplaySlots } = await import('../services/schedule-constructor.js');
    const gr7Contract = buildTimetableShapeContract({
        gradeLevel: 7, programType: null, startTime: '06:00', endTime: '15:30',
        periodLengthMinutes: 45, periodsPerDay: 10,
        basePolicy: { ...BASE_POLICY, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
    });
    const gr9Contract = buildTimetableShapeContract({
        gradeLevel: 9, programType: null, startTime: '09:45', endTime: '18:30',
        periodLengthMinutes: 45, periodsPerDay: 10,
        basePolicy: { ...BASE_POLICY, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
    });
    const union = buildUnionDisplaySlots([gr7Contract, gr9Contract]);
    const unionEvents = union.filter((s) => s.isSpecialEvent);
    const unionNames = unionEvents.map((s) => s.eventName);
    assert(unionNames.includes('Day Shift Health Break'), 'union includes Day Shift Health Break');
    assert(unionNames.includes('Day Shift Lunch Break'), 'union includes Day Shift Lunch Break');
    assert(unionNames.includes('Afternoon Shift Health Break'), 'union includes Afternoon Shift Health Break');
    assert(unionNames.includes('Afternoon Shift Lunch Break'), 'union includes Afternoon Shift Lunch Break');
    assert(unionEvents.length === 4, `union has exactly 4 event slots (got ${unionEvents.length})`);
}
// ─── Test 25: GR7 displaySlots has day-shift time range only ───
{
    const contract = buildTimetableShapeContract({
        gradeLevel: 7, programType: null, startTime: '06:00', endTime: '15:30',
        periodLengthMinutes: 45, periodsPerDay: 10,
        basePolicy: { ...BASE_POLICY, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
    });
    // GR7 displaySlots should span from 06:00 to at least 13:45 (day-shift range)
    const firstDisplay = contract.displaySlots[0];
    assert(firstDisplay.startTime === '06:00', `GR7 displaySlots first slot starts at 06:00 (got ${firstDisplay.startTime})`);
    const lastDisplay = contract.displaySlots[contract.displaySlots.length - 1];
    assert(lastDisplay.startTime >= '13:00', `GR7 displaySlots last slot starts at or after 13:00 (got ${lastDisplay.startTime})`);
    // No display slot should extend past 15:30 (day-shift end)
    const anyAfter1530 = contract.displaySlots.some((s) => s.startTime >= '15:30');
    assert(!anyAfter1530, 'GR7 displaySlots has no slot at or after 15:30');
}
// ─── Test 26: GR9 displaySlots has afternoon-shift time range only ───
{
    const contract = buildTimetableShapeContract({
        gradeLevel: 9, programType: null, startTime: '09:45', endTime: '18:30',
        periodLengthMinutes: 45, periodsPerDay: 10,
        basePolicy: { ...BASE_POLICY, specialEvents: BASELINE_EVENTS, showSpecialEventsInGrid: true },
    });
    const firstDisplay = contract.displaySlots[0];
    assert(firstDisplay.startTime === '09:45', `GR9 displaySlots first slot starts at 09:45 (got ${firstDisplay.startTime})`);
    const lastDisplay = contract.displaySlots[contract.displaySlots.length - 1];
    assert(lastDisplay.endTime === '18:30', `GR9 displaySlots last slot ends at 18:30 (got ${lastDisplay.endTime})`);
}
console.log(`\n${pass + fail} tests, ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
//# sourceMappingURL=schedule-constructor-shift-events.test.js.map