/**
 * Pure helpers for policy special-event resolution.
 * No Prisma dependency — safe for use in schedule-constructor and tests.
 */
// ─── Types ───
export const VALID_EVENT_TYPES = ['FLAG_OR_HGP', 'HEALTH_BREAK', 'LUNCH_BREAK', 'CUSTOM'];
export const VALID_GRADE_GROUPS = ['7-8', '9-10'];
// ─── Helpers ───
function timeToMinutes(value) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}
/**
 * Grade group resolver: maps a numeric grade level to its grade group string.
 */
export function resolveGradeGroup(gradeLevel) {
    if (gradeLevel >= 7 && gradeLevel <= 8)
        return '7-8';
    if (gradeLevel >= 9 && gradeLevel <= 10)
        return '9-10';
    return null;
}
/**
 * Build the effective special events list for a specific grade/program combination.
 * Returns exactly ONE row per eventType — the highest-priority match.
 *
 * Priority per eventType (highest first):
 *   1. Shift + exact program  (gradeGroup matches, programType matches)
 *   2. Shift default          (gradeGroup matches, programType == null)
 *   3. Program-global         (gradeGroup == null, programType matches)
 *   4. Global                 (gradeGroup == null, programType == null)
 *
 * @param specialEvents - All persisted special event rows for this policy
 * @param gradeLevel - The grade level to resolve events for
 * @param programType - Optional program type filter
 * @returns Exactly one effective event per eventType that has any enabled match
 */
export function getEffectiveEvents(specialEvents, gradeLevel, programType) {
    const resolvedGradeGroup = resolveGradeGroup(gradeLevel);
    const normalizedProgram = (programType ?? 'REGULAR').toUpperCase();
    // Group enabled rows by eventType
    const byType = new Map();
    for (const row of specialEvents) {
        if (!row.enabled)
            continue;
        const list = byType.get(row.eventType) ?? [];
        list.push(row);
        byType.set(row.eventType, list);
    }
    const result = [];
    for (const eventType of VALID_EVENT_TYPES) {
        const rows = byType.get(eventType) ?? [];
        if (rows.length === 0)
            continue;
        // Tier 1: Shift + exact program (gradeGroup matches AND programType matches)
        const tier1 = rows.find((r) => r.gradeGroup != null && r.gradeGroup === resolvedGradeGroup
            && r.programType != null && r.programType.toUpperCase() === normalizedProgram);
        if (tier1) {
            result.push(toEffective(tier1));
            continue;
        }
        // Tier 2: Shift default (gradeGroup matches, programType == null)
        const tier2 = rows.find((r) => r.gradeGroup != null && r.gradeGroup === resolvedGradeGroup
            && r.programType == null);
        if (tier2) {
            result.push(toEffective(tier2));
            continue;
        }
        // Tier 3: Program-global (gradeGroup == null, programType matches)
        const tier3 = rows.find((r) => r.gradeGroup == null
            && r.programType != null && r.programType.toUpperCase() === normalizedProgram);
        if (tier3) {
            result.push(toEffective(tier3));
            continue;
        }
        // Tier 4: Global (gradeGroup == null, programType == null)
        const tier4 = rows.find((r) => r.gradeGroup == null && r.programType == null);
        if (tier4) {
            result.push(toEffective(tier4));
        }
    }
    return result.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}
function toEffective(row) {
    return {
        eventType: row.eventType,
        label: row.label,
        startTime: row.startTime,
        endTime: row.endTime,
        gradeGroup: row.gradeGroup,
        programType: row.programType,
    };
}
//# sourceMappingURL=policy-special-events.js.map