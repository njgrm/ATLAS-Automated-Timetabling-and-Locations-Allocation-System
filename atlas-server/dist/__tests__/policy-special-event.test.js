/**
 * Tests for policy special events — shift-specific break/event support.
 * Covers 4-tier precedence, program normalization, seed idempotency, and DB uniqueness.
 */
import { getEffectiveEvents, normalizeProgramType } from '../services/policy-special-event.service.js';
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
function makeRow(overrides) {
    return {
        id: 1,
        schoolId: 1,
        schoolYearId: 2,
        label: overrides.label ?? `${overrides.eventType} Event`,
        gradeGroup: overrides.gradeGroup ?? null,
        programType: overrides.programType ?? null,
        startTime: overrides.startTime ?? '09:00',
        endTime: overrides.endTime ?? '09:15',
        enabled: overrides.enabled ?? true,
        sortOrder: overrides.sortOrder ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}
console.log('policy-special-event: getEffectiveEvents\n');
// ─── Basic behavior ───
// Test 1: Empty events
{
    const result = getEffectiveEvents([], 7, null);
    assert(result.length === 0, 'returns empty array when no events exist');
}
// Test 2: Global events fallback
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Global Health Break', startTime: '09:00', endTime: '09:15' }),
        makeRow({ eventType: 'LUNCH_BREAK', label: 'Global Lunch', startTime: '12:00', endTime: '13:00' }),
    ];
    const result = getEffectiveEvents(events, 7, null);
    assert(result.length === 2, 'returns global events when no shift-specific events exist');
    assert(result[0].label === 'Global Health Break', 'first global event label matches');
    assert(result[1].label === 'Global Lunch', 'second global event label matches');
}
// Test 3: Shift-specific for grade 7-8
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Afternoon Shift Health', gradeGroup: '9-10', startTime: '15:15', endTime: '15:30' }),
    ];
    const result = getEffectiveEvents(events, 7, null);
    assert(result.length === 1, 'returns 1 event for grade 7');
    assert(result[0].label === 'Day Shift Health', 'day shift health selected for grade 7');
    assert(result[0].gradeGroup === '7-8', 'grade group is 7-8');
}
// Test 4: Shift-specific for grade 9-10
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Afternoon Shift Health', gradeGroup: '9-10', startTime: '15:15', endTime: '15:30' }),
    ];
    const result = getEffectiveEvents(events, 10, null);
    assert(result.length === 1, 'returns 1 event for grade 10');
    assert(result[0].label === 'Afternoon Shift Health', 'afternoon shift health selected for grade 10');
}
// Test 5: Fallback to global when shift-specific doesn't match grade
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Global Health', startTime: '10:00', endTime: '10:15' }),
    ];
    const result = getEffectiveEvents(events, 9, null);
    assert(result.length === 1, 'returns 1 event for grade 9 (fallback)');
    assert(result[0].label === 'Global Health', 'falls back to global for non-matching grade');
}
// Test 6: Disabled events excluded
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Disabled Health', enabled: false }),
    ];
    const result = getEffectiveEvents(events, 7, null);
    assert(result.length === 0, 'disabled events are excluded');
}
// Test 7: Sort by start time
{
    const events = [
        makeRow({ eventType: 'LUNCH_BREAK', label: 'Lunch', startTime: '12:00', endTime: '13:00' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Health', startTime: '09:00', endTime: '09:15' }),
    ];
    const result = getEffectiveEvents(events, 7, null);
    assert(result[0].label === 'Health', 'sorted by start time: health first');
    assert(result[1].label === 'Lunch', 'sorted by start time: lunch second');
}
// Test 8: All four event types
{
    const events = [
        makeRow({ eventType: 'FLAG_OR_HGP', label: 'Flag', startTime: '07:00', endTime: '07:30' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Health', startTime: '09:00', endTime: '09:15' }),
        makeRow({ eventType: 'LUNCH_BREAK', label: 'Lunch', startTime: '12:00', endTime: '13:00' }),
        makeRow({ eventType: 'CUSTOM', label: 'Custom Event', startTime: '14:00', endTime: '14:15' }),
    ];
    const result = getEffectiveEvents(events, 7, null);
    assert(result.length === 4, 'handles all four event types');
    assert(result.map((e) => e.eventType).join(',') === 'FLAG_OR_HGP,HEALTH_BREAK,LUNCH_BREAK,CUSTOM', 'event types in order');
}
// ─── 4-tier precedence tests ───
// Test 9: Tier 1 — shift + exact program overrides shift default
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift STE Health', gradeGroup: '7-8', programType: 'STE', startTime: '09:30', endTime: '09:45' }),
    ];
    const result = getEffectiveEvents(events, 7, 'STE');
    assert(result.length === 1, 'tier 1: returns exactly 1 event');
    assert(result[0].label === 'Day Shift STE Health', 'tier 1: shift+program override selected');
    assert(result[0].programType === 'STE', 'tier 1: programType is STE');
}
// Test 10: Tier 2 — shift default used when no shift+program override exists
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
    ];
    const result = getEffectiveEvents(events, 7, 'STE');
    assert(result.length === 1, 'tier 2: returns 1 event');
    assert(result[0].label === 'Day Shift Health', 'tier 2: shift default selected');
}
// Test 11: Tier 3 — program-global used when no shift rows exist
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'STE Health Global', programType: 'STE', startTime: '09:30', endTime: '09:45' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Global Health', startTime: '09:00', endTime: '09:15' }),
    ];
    const result = getEffectiveEvents(events, 7, 'STE');
    assert(result.length === 1, 'tier 3: returns 1 event');
    assert(result[0].label === 'STE Health Global', 'tier 3: program-global selected');
}
// Test 12: Tier 4 — global used when no scoped rows exist
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Global Health', startTime: '09:00', endTime: '09:15' }),
    ];
    const result = getEffectiveEvents(events, 7, 'STE');
    assert(result.length === 1, 'tier 4: returns 1 event');
    assert(result[0].label === 'Global Health', 'tier 4: global selected');
}
// Test 13: Tier 1 does not include tier 2 rows for same eventType
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift STE Health', gradeGroup: '7-8', programType: 'STE', startTime: '09:30', endTime: '09:45' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
    ];
    const result = getEffectiveEvents(events, 7, 'STE');
    assert(result.length === 1, 'tier 1 only: exactly 1 event (not 2)');
    assert(result[0].label === 'Day Shift STE Health', 'tier 1 only: shift+program selected, shift default excluded');
}
// Test 14: Tier 2 does not include tier 3/4 rows for same eventType
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'STE Health Global', programType: 'STE', startTime: '09:30', endTime: '09:45' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Global Health', startTime: '10:00', endTime: '10:15' }),
    ];
    const result = getEffectiveEvents(events, 7, 'STE');
    assert(result.length === 1, 'tier 2 only: exactly 1 event (not 3)');
    assert(result[0].label === 'Day Shift Health', 'tier 2 only: shift default selected');
}
// Test 15: Tier 3 does not include tier 4 rows for same eventType
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'STE Health Global', programType: 'STE', startTime: '09:30', endTime: '09:45' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Global Health', startTime: '10:00', endTime: '10:15' }),
    ];
    const result = getEffectiveEvents(events, 7, 'STE');
    assert(result.length === 1, 'tier 3 only: exactly 1 event (not 2)');
    assert(result[0].label === 'STE Health Global', 'tier 3 only: program-global selected');
}
// Test 16: Disabled exact override falls back to next tier
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift STE Health', gradeGroup: '7-8', programType: 'STE', startTime: '09:30', endTime: '09:45', enabled: false }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
    ];
    const result = getEffectiveEvents(events, 7, 'STE');
    assert(result.length === 1, 'disabled override: falls back to tier 2');
    assert(result[0].label === 'Day Shift Health', 'disabled override: shift default selected');
}
// Test 17: Multiple event types resolve independently
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift STE Health', gradeGroup: '7-8', programType: 'STE', startTime: '09:30', endTime: '09:45' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
        makeRow({ eventType: 'LUNCH_BREAK', label: 'Day Shift Lunch', gradeGroup: '7-8', startTime: '12:15', endTime: '13:00' }),
    ];
    const result = getEffectiveEvents(events, 7, 'STE');
    assert(result.length === 2, 'independent resolution: 2 event types');
    const health = result.find((e) => e.eventType === 'HEALTH_BREAK');
    const lunch = result.find((e) => e.eventType === 'LUNCH_BREAK');
    assert(health?.label === 'Day Shift STE Health', 'independent: HEALTH_BREAK uses STE override');
    assert(lunch?.label === 'Day Shift Lunch', 'independent: LUNCH_BREAK uses shift default');
}
// Test 18: Program-specific doesn't override for non-matching program
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'STE Health', programType: 'STE', startTime: '09:30', endTime: '09:45' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Global Health', startTime: '09:00', endTime: '09:15' }),
    ];
    const result = getEffectiveEvents(events, 7, 'SPA');
    assert(result.length === 1, 'returns 1 event for SPA (fallback)');
    assert(result[0].label === 'Global Health', 'falls back to global for non-matching program');
}
// ─── Baseline shift behavior preserved ───
// Test 19: GR7 regular with baseline returns day-shift defaults
{
    const BASELINE = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health Break', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
        makeRow({ eventType: 'LUNCH_BREAK', label: 'Day Shift Lunch Break', gradeGroup: '7-8', startTime: '12:15', endTime: '13:00' }),
        makeRow({ eventType: 'LUNCH_BREAK', label: 'Afternoon Shift Lunch Break', gradeGroup: '9-10', startTime: '12:15', endTime: '13:00' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Afternoon Shift Health Break', gradeGroup: '9-10', startTime: '15:15', endTime: '15:30' }),
    ];
    const result = getEffectiveEvents(BASELINE, 7, null);
    assert(result.length === 2, 'GR7 baseline: 2 events');
    assert(result[0].label === 'Day Shift Health Break', 'GR7 baseline: day health');
    assert(result[1].label === 'Day Shift Lunch Break', 'GR7 baseline: day lunch');
}
// Test 20: GR9 regular with baseline returns afternoon-shift defaults
{
    const BASELINE = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health Break', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
        makeRow({ eventType: 'LUNCH_BREAK', label: 'Day Shift Lunch Break', gradeGroup: '7-8', startTime: '12:15', endTime: '13:00' }),
        makeRow({ eventType: 'LUNCH_BREAK', label: 'Afternoon Shift Lunch Break', gradeGroup: '9-10', startTime: '12:15', endTime: '13:00' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Afternoon Shift Health Break', gradeGroup: '9-10', startTime: '15:15', endTime: '15:30' }),
    ];
    const result = getEffectiveEvents(BASELINE, 10, null);
    assert(result.length === 2, 'GR10 baseline: 2 events');
    assert(result[0].label === 'Afternoon Shift Lunch Break', 'GR10 baseline: afternoon lunch');
    assert(result[1].label === 'Afternoon Shift Health Break', 'GR10 baseline: afternoon health');
}
// ─── Program type normalization tests ───
console.log('\nnormalizeProgramType\n');
// Test 21: Whitespace-only input normalizes to null
{
    const result = normalizeProgramType('   ');
    assert(result === null, 'whitespace-only "   " normalizes to null');
}
// Test 22: Trimmed non-default value normalizes to uppercase
{
    const result = normalizeProgramType(' ste ');
    assert(result === 'STE', '" ste " normalizes to "STE"');
}
// Test 23: Empty string normalizes to null
{
    const result = normalizeProgramType('');
    assert(result === null, 'empty string normalizes to null');
}
// Test 24: "REGULAR" normalizes to null
{
    const result = normalizeProgramType('REGULAR');
    assert(result === null, '"REGULAR" normalizes to null');
}
// Test 25: "regular" (lowercase) normalizes to null
{
    const result = normalizeProgramType('regular');
    assert(result === null, '"regular" normalizes to null');
}
// Test 26: "REG" normalizes to null
{
    const result = normalizeProgramType('REG');
    assert(result === null, '"REG" normalizes to null');
}
// Test 27: null normalizes to null
{
    const result = normalizeProgramType(null);
    assert(result === null, 'null normalizes to null');
}
// Test 28: undefined normalizes to null
{
    const result = normalizeProgramType(undefined);
    assert(result === null, 'undefined normalizes to null');
}
// Test 29: "SPA" stays as "SPA"
{
    const result = normalizeProgramType('SPA');
    assert(result === 'SPA', '"SPA" stays as "SPA"');
}
// Test 30: " spa " (with spaces) normalizes to "SPA"
{
    const result = normalizeProgramType(' spa ');
    assert(result === 'SPA', '" spa " normalizes to "SPA"');
}
// Test 31: "spj" (lowercase) normalizes to "SPJ"
{
    const result = normalizeProgramType('spj');
    assert(result === 'SPJ', '"spj" normalizes to "SPJ"');
}
// ─── Normalization prevents duplicates ───
console.log('\nNormalization prevents duplicates\n');
// Test 32: Different casing of same program does not create duplicate effective scope
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'STE Health', gradeGroup: '7-8', programType: 'STE', startTime: '09:30', endTime: '09:45' }),
        // Simulate a second row with different casing (should not happen with normalization, but test the resolver)
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Ste Health Lower', gradeGroup: '7-8', programType: 'ste', startTime: '09:00', endTime: '09:15' }),
    ];
    const result = getEffectiveEvents(events, 7, 'STE');
    // Tier 1 finds first match: "STE" matches exactly
    assert(result.length === 1, 'normalized casing: only 1 event returned');
    assert(result[0].label === 'STE Health', 'normalized casing: exact match preferred');
}
// Test 33: getEffectiveEvents still chooses shift+program over shift default after normalization
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift STE Health', gradeGroup: '7-8', programType: 'STE', startTime: '09:30', endTime: '09:45' }),
    ];
    const result = getEffectiveEvents(events, 7, 'STE');
    assert(result.length === 1, 'precedence after normalization: 1 event');
    assert(result[0].label === 'Day Shift STE Health', 'precedence: shift+program over shift default');
}
// Test 34: getEffectiveEvents falls back to shift default when no program override
{
    const events = [
        makeRow({ eventType: 'HEALTH_BREAK', label: 'Day Shift Health', gradeGroup: '7-8', startTime: '09:00', endTime: '09:15' }),
    ];
    const result = getEffectiveEvents(events, 7, 'STE');
    assert(result.length === 1, 'fallback after normalization: 1 event');
    assert(result[0].label === 'Day Shift Health', 'fallback: shift default selected');
}
console.log(`\n${pass + fail} tests, ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
//# sourceMappingURL=policy-special-event.test.js.map