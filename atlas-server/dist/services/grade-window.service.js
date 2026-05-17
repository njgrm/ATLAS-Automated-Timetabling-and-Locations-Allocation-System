/**
 * Grade shift window service — time window restrictions per grade band.
 * Business logic only; no transport concerns.
 */
import { prisma } from '../lib/prisma.js';
function err(statusCode, code, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    return e;
}
function isValidTime(value) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}
function timeToMinutes(value) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}
async function validateAgainstPolicyBounds(schoolId, schoolYearId, input) {
    const policy = await prisma.schedulingPolicy.findUnique({
        where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
        select: { earliestStartTime: true, latestEndTime: true },
    });
    if (!policy)
        return;
    const windowStart = timeToMinutes(input.startTime);
    const windowEnd = timeToMinutes(input.endTime);
    const policyStart = timeToMinutes(policy.earliestStartTime);
    const policyEnd = timeToMinutes(policy.latestEndTime);
    if (windowStart < policyStart || windowEnd > policyEnd) {
        throw err(400, 'WINDOW_OUT_OF_POLICY_BOUNDS', `Grade ${input.gradeLevel}${input.programType ? ` / ${input.programType}` : ''} shift window must stay within the scheduling policy bounds (${policy.earliestStartTime} - ${policy.latestEndTime}).`);
    }
}
// ─── List ───
export async function listGradeWindows(schoolId, schoolYearId) {
    return prisma.gradeShiftWindow.findMany({
        where: { schoolId, schoolYearId },
        orderBy: [{ gradeLevel: 'asc' }, { programType: 'asc' }],
    });
}
// ─── Upsert ───
export async function upsertGradeWindow(schoolId, schoolYearId, input) {
    if (![7, 8, 9, 10].includes(input.gradeLevel)) {
        throw err(400, 'INVALID_GRADE', 'Grade level must be 7, 8, 9, or 10.');
    }
    if (input.programType != null && !['REGULAR', 'STE', 'SPS', 'SPA', 'SPJ', 'SPFL', 'SPTVE', 'OTHER'].includes(input.programType)) {
        throw err(400, 'INVALID_PROGRAM', 'programType must be a valid program type when provided.');
    }
    if (!input.startTime || !input.endTime) {
        throw err(400, 'MISSING_FIELDS', 'startTime and endTime are required.');
    }
    if (!isValidTime(input.startTime) || !isValidTime(input.endTime)) {
        throw err(400, 'INVALID_TIME_FORMAT', 'startTime and endTime must use HH:mm format.');
    }
    if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) {
        throw err(400, 'INVALID_TIME_RANGE', 'startTime must be earlier than endTime.');
    }
    await validateAgainstPolicyBounds(schoolId, schoolYearId, input);
    if (input.programType == null) {
        const existing = await prisma.gradeShiftWindow.findFirst({
            where: {
                schoolId,
                schoolYearId,
                gradeLevel: input.gradeLevel,
                programType: null,
            },
            select: { id: true },
        });
        if (existing) {
            return prisma.gradeShiftWindow.update({
                where: { id: existing.id },
                data: {
                    startTime: input.startTime,
                    endTime: input.endTime,
                    programType: null,
                },
            });
        }
        return prisma.gradeShiftWindow.create({
            data: {
                schoolId,
                schoolYearId,
                gradeLevel: input.gradeLevel,
                programType: null,
                startTime: input.startTime,
                endTime: input.endTime,
            },
        });
    }
    return prisma.gradeShiftWindow.upsert({
        where: {
            schoolId_schoolYearId_gradeLevel_programType: {
                schoolId,
                schoolYearId,
                gradeLevel: input.gradeLevel,
                programType: input.programType ?? null,
            },
        },
        update: {
            programType: input.programType ?? null,
            startTime: input.startTime,
            endTime: input.endTime,
        },
        create: {
            schoolId,
            schoolYearId,
            gradeLevel: input.gradeLevel,
            programType: input.programType ?? null,
            startTime: input.startTime,
            endTime: input.endTime,
        },
    });
}
// ─── Batch upsert (for updating all windows at once) ───
export async function upsertGradeWindows(schoolId, schoolYearId, windows) {
    const results = [];
    for (const w of windows) {
        results.push(await upsertGradeWindow(schoolId, schoolYearId, w));
    }
    return results;
}
// ─── Delete ───
export async function deleteGradeWindow(schoolId, schoolYearId, gradeLevel) {
    const existing = await prisma.gradeShiftWindow.findFirst({
        where: { schoolId, schoolYearId, gradeLevel },
    });
    if (!existing) {
        throw err(404, 'WINDOW_NOT_FOUND', `No grade shift window found for grade ${gradeLevel}.`);
    }
    await prisma.gradeShiftWindow.delete({ where: { id: existing.id } });
}
//# sourceMappingURL=grade-window.service.js.map