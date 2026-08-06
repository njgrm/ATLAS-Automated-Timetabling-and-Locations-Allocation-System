/**
 * Preference service — faculty preference CRUD and officer monitoring.
 * Business logic only; no transport concerns.
 */
import { prisma } from '../lib/prisma.js';
import { publishPreferenceEvent } from './preference-events.service.js';
import { resolveCanonicalFacultyMirror } from './faculty-identity.service.js';
function err(statusCode, code, message) {
    return Object.assign(new Error(message), { statusCode, code });
}
// ─── Lifecycle guard ───
/**
 * Check whether the preference window is currently active.
 * In v1 this checks the lifecycle phase constant; in future it will read
 * persisted phase state per school+year.
 *
 * Returns null if window is open, or a ServiceError if blocked.
 */
/** Phases during which faculty may still edit preferences. */
const EDITABLE_PHASES = new Set(['SETUP', 'PREFERENCE_COLLECTION']);
export function checkPreferenceWindow(currentPhase) {
    if (EDITABLE_PHASES.has(currentPhase))
        return null;
    // Distinguishes between "not yet open" (SETUP) and hard lock (any post-collection phase).
    const isLocked = currentPhase !== 'SETUP';
    return err(422, isLocked ? 'PREFERENCE_LOCKED' : 'PREFERENCE_WINDOW_CLOSED', isLocked
        ? `Preferences are locked for editing. The schedule is now in the ${currentPhase} phase. Contact your scheduling officer if a correction is needed.`
        : `Preference submissions are only accepted during the Preference Collection phase. Current phase: ${currentPhase}.`);
}
const ENABLE_LEGACY_TIME_PREFERENCES = process.env.ATLAS_ENABLE_LEGACY_TIME_PREFERENCES === 'true';
function persistedTimeSlots(timeSlots) {
    return ENABLE_LEGACY_TIME_PREFERENCES ? timeSlots ?? [] : [];
}
function preferenceIdentityKeys(member) {
    return [
        member.externalId != null ? `external:${member.externalId}` : null,
        member.employeeId ? `employee:${member.employeeId.trim().toLowerCase()}` : null,
        member.contactInfo ? `email:${member.contactInfo.trim().toLowerCase()}` : null,
    ].filter((value) => Boolean(value));
}
async function resolvePreferenceFacultyContext(schoolId, schoolYearId, facultyId) {
    const requested = await prisma.facultyMirror.findFirst({
        where: { id: facultyId, schoolId },
        select: { id: true, externalId: true, employeeId: true, contactInfo: true, firstName: true, lastName: true },
    });
    if (!requested)
        throw err(404, 'TEACHER_NOT_FOUND', 'Teacher not found in this school.');
    const resolution = await resolveCanonicalFacultyMirror({
        schoolId,
        schoolYearId,
        linkedFacultyId: requested.id,
        sourceExternalId: requested.externalId,
        employeeId: requested.employeeId,
        email: requested.contactInfo,
    });
    const canonicalId = resolution?.faculty.id ?? requested.id;
    const faculty = canonicalId === requested.id
        ? requested
        : await prisma.facultyMirror.findFirst({
            where: { id: canonicalId, schoolId },
            select: { id: true, firstName: true, lastName: true },
        }) ?? requested;
    return {
        faculty,
        candidateFacultyIds: [...new Set([canonicalId, requested.id, ...(resolution?.duplicateCandidateIds ?? [])])],
    };
}
async function selectPreferenceForTeacher(schoolId, schoolYearId, context) {
    const preferences = await prisma.facultyPreference.findMany({
        where: { schoolId, schoolYearId, facultyId: { in: context.candidateFacultyIds } },
        include: { timeSlots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] } },
        orderBy: [{ facultyId: 'asc' }, { updatedAt: 'desc' }],
    });
    const exact = preferences.find((pref) => pref.facultyId === context.faculty.id);
    if (exact)
        return exact;
    const legacy = preferences.find((pref) => pref.status === 'SUBMITTED') ?? preferences[0] ?? null;
    if (!legacy)
        return null;
    return prisma.facultyPreference.update({
        where: { id: legacy.id },
        data: { facultyId: context.faculty.id, version: { increment: 1 } },
        include: { timeSlots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] } },
    });
}
// ─── Faculty self operations ───
export async function getPreference(schoolId, schoolYearId, facultyId) {
    const context = await resolvePreferenceFacultyContext(schoolId, schoolYearId, facultyId);
    const pref = await selectPreferenceForTeacher(schoolId, schoolYearId, context);
    return pref;
}
function wellbeingData(wb) {
    return {
        pregnancySupport: wb?.pregnancySupport ?? false,
        physicalAilmentSupport: wb?.physicalAilmentSupport ?? false,
        minimizeTravelTime: wb?.minimizeTravelTime ?? false,
        avoidUpperFloors: wb?.avoidUpperFloors ?? false,
    };
}
export async function saveDraft(input) {
    const { schoolId, schoolYearId, facultyId, notes, timeSlots, version, wellbeing } = input;
    const context = await resolvePreferenceFacultyContext(schoolId, schoolYearId, facultyId);
    const faculty = context.faculty;
    const existing = await selectPreferenceForTeacher(schoolId, schoolYearId, context);
    const slotsToPersist = persistedTimeSlots(timeSlots);
    if (existing) {
        // Optimistic lock check
        if (version !== undefined && version !== existing.version) {
            throw err(409, 'VERSION_CONFLICT', `Version conflict: expected ${existing.version}, got ${version}. Reload and retry.`);
        }
        // Allow re-editing a previously submitted preference (resets to DRAFT) when the window is open.
        // The route layer has already confirmed the window is open before calling saveDraft.
        const saved = await prisma.$transaction(async (tx) => {
            await tx.preferenceTimeSlot.deleteMany({ where: { preferenceId: existing.id } });
            return tx.facultyPreference.update({
                where: { id: existing.id },
                data: {
                    facultyId: faculty.id,
                    notes,
                    status: 'DRAFT',
                    submittedAt: null,
                    version: { increment: 1 },
                    ...wellbeingData(wellbeing),
                    ...(slotsToPersist.length > 0 ? { timeSlots: {
                            createMany: {
                                data: slotsToPersist.map((ts) => ({
                                    day: ts.day,
                                    startTime: ts.startTime,
                                    endTime: ts.endTime,
                                    preference: ts.preference,
                                })),
                            },
                        } } : {}),
                },
                include: { timeSlots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] } },
            });
        });
        publishPreferenceEvent({
            type: 'PREFERENCE_DRAFT_SAVED',
            schoolId,
            schoolYearId,
            facultyId: faculty.id,
            preferenceId: saved.id,
            message: `${faculty.firstName} ${faculty.lastName} saved a preference draft.`,
        });
        return saved;
    }
    // Create new
    const created = await prisma.facultyPreference.create({
        data: {
            schoolId,
            schoolYearId,
            facultyId: faculty.id,
            notes,
            status: 'DRAFT',
            ...wellbeingData(wellbeing),
            ...(slotsToPersist.length > 0 ? { timeSlots: {
                    createMany: {
                        data: slotsToPersist.map((ts) => ({
                            day: ts.day,
                            startTime: ts.startTime,
                            endTime: ts.endTime,
                            preference: ts.preference,
                        })),
                    },
                } } : {}),
        },
        include: { timeSlots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] } },
    });
    publishPreferenceEvent({
        type: 'PREFERENCE_DRAFT_SAVED',
        schoolId,
        schoolYearId,
        facultyId: faculty.id,
        preferenceId: created.id,
        message: `${faculty.firstName} ${faculty.lastName} started a preference draft.`,
    });
    return created;
}
export async function submitPreference(input) {
    const { schoolId, schoolYearId, facultyId, notes, timeSlots, version, wellbeing } = input;
    const context = await resolvePreferenceFacultyContext(schoolId, schoolYearId, facultyId);
    const faculty = context.faculty;
    const existing = await selectPreferenceForTeacher(schoolId, schoolYearId, context);
    const slotsToPersist = persistedTimeSlots(timeSlots);
    if (existing) {
        if (version !== existing.version) {
            throw err(409, 'VERSION_CONFLICT', `Version conflict: expected ${existing.version}, got ${version}. Reload and retry.`);
        }
        const submitted = await prisma.$transaction(async (tx) => {
            await tx.preferenceTimeSlot.deleteMany({ where: { preferenceId: existing.id } });
            return tx.facultyPreference.update({
                where: { id: existing.id },
                data: {
                    facultyId: faculty.id,
                    notes,
                    status: 'SUBMITTED',
                    submittedAt: new Date(),
                    version: { increment: 1 },
                    ...wellbeingData(wellbeing),
                    ...(slotsToPersist.length > 0 ? { timeSlots: {
                            createMany: {
                                data: slotsToPersist.map((ts) => ({
                                    day: ts.day,
                                    startTime: ts.startTime,
                                    endTime: ts.endTime,
                                    preference: ts.preference,
                                })),
                            },
                        } } : {}),
                },
                include: { timeSlots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] } },
            });
        });
        publishPreferenceEvent({
            type: 'PREFERENCE_SUBMITTED',
            schoolId,
            schoolYearId,
            facultyId: faculty.id,
            preferenceId: submitted.id,
            message: `${faculty.firstName} ${faculty.lastName} submitted teacher preferences.`,
            metadata: {
                pregnancySupport: submitted.pregnancySupport,
                physicalAilmentSupport: submitted.physicalAilmentSupport,
                minimizeTravelTime: submitted.minimizeTravelTime,
                avoidUpperFloors: submitted.avoidUpperFloors,
            },
        });
        return submitted;
    }
    // Create and submit in one step
    const created = await prisma.facultyPreference.create({
        data: {
            schoolId,
            schoolYearId,
            facultyId: faculty.id,
            notes,
            status: 'SUBMITTED',
            submittedAt: new Date(),
            ...wellbeingData(wellbeing),
            ...(slotsToPersist.length > 0 ? { timeSlots: {
                    createMany: {
                        data: slotsToPersist.map((ts) => ({
                            day: ts.day,
                            startTime: ts.startTime,
                            endTime: ts.endTime,
                            preference: ts.preference,
                        })),
                    },
                } } : {}),
        },
        include: { timeSlots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] } },
    });
    publishPreferenceEvent({
        type: 'PREFERENCE_SUBMITTED',
        schoolId,
        schoolYearId,
        facultyId: faculty.id,
        preferenceId: created.id,
        message: `${faculty.firstName} ${faculty.lastName} submitted teacher preferences.`,
        metadata: {
            pregnancySupport: created.pregnancySupport,
            physicalAilmentSupport: created.physicalAilmentSupport,
            minimizeTravelTime: created.minimizeTravelTime,
            avoidUpperFloors: created.avoidUpperFloors,
        },
    });
    return created;
}
// ─── Officer monitoring ───
export async function getOfficerSummary(schoolId, schoolYearId, statusFilter) {
    // All active faculty for this school
    const allFaculty = await prisma.facultyMirror.findMany({
        where: { schoolId, isActiveForScheduling: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, department: true },
    });
    // All preferences for this school+year
    const preferences = await prisma.facultyPreference.findMany({
        where: { schoolId, schoolYearId },
        select: { facultyId: true, status: true, submittedAt: true, version: true },
    });
    const prefMap = new Map(preferences.map((p) => [p.facultyId, p]));
    const items = allFaculty.map((f) => {
        const pref = prefMap.get(f.id);
        return {
            facultyId: f.id,
            firstName: f.firstName,
            lastName: f.lastName,
            department: f.department,
            preferenceStatus: pref ? pref.status : 'MISSING',
            submittedAt: pref?.submittedAt ?? null,
        };
    });
    // Apply status filter
    const filtered = statusFilter
        ? items.filter((i) => i.preferenceStatus === statusFilter)
        : items;
    const counts = {
        total: allFaculty.length,
        submitted: items.filter((i) => i.preferenceStatus === 'SUBMITTED').length,
        draft: items.filter((i) => i.preferenceStatus === 'DRAFT').length,
        missing: items.filter((i) => i.preferenceStatus === 'MISSING').length,
    };
    return { counts, faculty: filtered };
}
// ─── Reminder (placeholder action — logs intent, returns acknowledgement) ───
export async function triggerReminder(schoolId, schoolYearId, facultyIds, triggeredBy) {
    const timestamp = new Date().toISOString();
    // Durable audit record — replaces volatile console.log
    const audit = await prisma.auditLog.create({
        data: {
            schoolId,
            schoolYearId,
            action: 'PREFERENCE_REMINDER_TRIGGERED',
            actorId: triggeredBy,
            targetIds: facultyIds,
            metadata: { count: facultyIds.length, timestamp },
        },
    });
    return {
        reminded: facultyIds.length,
        auditId: audit.id,
        timestamp,
        note: 'Reminder logged. Push/email delivery is not yet implemented.',
    };
}
// ─── Seed preferences (idempotent) ───
export async function seedPreferencesForSchoolYear(schoolId, schoolYearId, actorId) {
    // All active faculty for this school
    const activeFaculty = await prisma.facultyMirror.findMany({
        where: { schoolId, isActiveForScheduling: true },
        select: { id: true },
    });
    // Existing preferences for this school+year
    const existing = await prisma.facultyPreference.findMany({
        where: { schoolId, schoolYearId },
        select: { facultyId: true },
    });
    const existingSet = new Set(existing.map((p) => p.facultyId));
    // Faculty that need seeding
    const toSeed = activeFaculty.filter((f) => !existingSet.has(f.id));
    // Batch-create inside a transaction
    if (toSeed.length > 0) {
        await prisma.$transaction(async (tx) => {
            for (const f of toSeed) {
                await tx.facultyPreference.create({
                    data: {
                        schoolId,
                        schoolYearId,
                        facultyId: f.id,
                        status: 'DRAFT',
                        notes: null,
                    },
                });
            }
        });
    }
    // Durable audit
    const audit = await prisma.auditLog.create({
        data: {
            schoolId,
            schoolYearId,
            action: 'PREFERENCE_SEEDED',
            actorId,
            targetIds: toSeed.map((f) => f.id),
            metadata: {
                totalFaculty: activeFaculty.length,
                alreadySeeded: existingSet.size,
                created: toSeed.length,
            },
        },
    });
    return {
        totalFaculty: activeFaculty.length,
        alreadySeeded: existingSet.size,
        created: toSeed.length,
        schoolId,
        schoolYearId,
        auditId: audit.id,
    };
}
// ─── Officer review operations ───
export async function getOfficerSummaryWithReviews(schoolId, schoolYearId, statusFilter) {
    const allFaculty = await prisma.facultyMirror.findMany({
        where: { schoolId, isActiveForScheduling: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { id: true, externalId: true, employeeId: true, contactInfo: true, firstName: true, lastName: true, department: true },
    });
    const preferences = await prisma.facultyPreference.findMany({
        where: { schoolId, schoolYearId },
        select: {
            facultyId: true,
            status: true,
            submittedAt: true,
            version: true,
            pregnancySupport: true,
            physicalAilmentSupport: true,
            minimizeTravelTime: true,
            avoidUpperFloors: true,
            faculty: { select: { externalId: true, employeeId: true, contactInfo: true } },
            review: {
                select: {
                    reviewStatus: true,
                    reviewedAt: true,
                    reviewerNotes: true,
                    reviewerId: true,
                },
            },
        },
    });
    const prefMap = new Map(preferences.map((p) => [p.facultyId, p]));
    const prefByIdentityKey = new Map();
    for (const pref of preferences) {
        for (const key of preferenceIdentityKeys(pref.faculty)) {
            const current = prefByIdentityKey.get(key);
            if (!current || (pref.status === 'SUBMITTED' && current.status !== 'SUBMITTED')) {
                prefByIdentityKey.set(key, pref);
            }
        }
    }
    const items = allFaculty.map((f) => {
        const pref = prefMap.get(f.id) ?? preferenceIdentityKeys(f).map((key) => prefByIdentityKey.get(key)).find(Boolean);
        return {
            facultyId: f.id,
            firstName: f.firstName,
            lastName: f.lastName,
            department: f.department,
            preferenceStatus: pref ? pref.status : 'MISSING',
            submittedAt: pref?.submittedAt ?? null,
            reviewStatus: pref?.review?.reviewStatus ?? null,
            reviewedAt: pref?.review?.reviewedAt ?? null,
            wellbeing: pref
                ? {
                    pregnancySupport: pref.pregnancySupport,
                    physicalAilmentSupport: pref.physicalAilmentSupport,
                    minimizeTravelTime: pref.minimizeTravelTime,
                    avoidUpperFloors: pref.avoidUpperFloors,
                }
                : null,
        };
    });
    const filtered = statusFilter
        ? items.filter((i) => i.preferenceStatus === statusFilter)
        : items;
    const counts = {
        total: allFaculty.length,
        submitted: items.filter((i) => i.preferenceStatus === 'SUBMITTED').length,
        draft: items.filter((i) => i.preferenceStatus === 'DRAFT').length,
        missing: items.filter((i) => i.preferenceStatus === 'MISSING').length,
    };
    return { counts, faculty: filtered };
}
export async function getPreferenceDetail(schoolId, schoolYearId, facultyId) {
    const context = await resolvePreferenceFacultyContext(schoolId, schoolYearId, facultyId);
    const selected = await selectPreferenceForTeacher(schoolId, schoolYearId, context);
    if (!selected)
        throw err(404, 'PREFERENCE_NOT_FOUND', 'No preference record found for this teacher.');
    const pref = await prisma.facultyPreference.findUnique({
        where: { id: selected.id },
        include: {
            timeSlots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] },
            review: true,
            faculty: {
                select: { firstName: true, lastName: true, department: true },
            },
        },
    });
    if (!pref)
        throw err(404, 'PREFERENCE_NOT_FOUND', 'No preference record found for this teacher.');
    return pref;
}
export async function updateReview(input) {
    const { schoolId, schoolYearId, preferenceId, reviewerId, reviewStatus, reviewerNotes } = input;
    const pref = await prisma.facultyPreference.findFirst({
        where: { id: preferenceId, schoolId, schoolYearId },
        select: {
            id: true,
            status: true,
            facultyId: true,
            faculty: { select: { firstName: true, lastName: true } },
        },
    });
    if (!pref)
        throw err(404, 'PREFERENCE_NOT_FOUND', 'Preference record not found in this school/year scope.');
    if (pref.status !== 'SUBMITTED') {
        throw err(422, 'NOT_SUBMITTED', 'Only submitted preferences can be reviewed.');
    }
    const review = await prisma.preferenceReview.upsert({
        where: { preferenceId },
        create: {
            preferenceId,
            reviewerId,
            reviewStatus,
            reviewerNotes: reviewerNotes ?? null,
            reviewedAt: new Date(),
        },
        update: {
            reviewerId,
            reviewStatus,
            reviewerNotes: reviewerNotes ?? null,
            reviewedAt: new Date(),
        },
    });
    publishPreferenceEvent({
        type: 'PREFERENCE_REVIEWED',
        schoolId,
        schoolYearId,
        facultyId: pref.facultyId,
        preferenceId,
        message: `Preference for ${pref.faculty.firstName} ${pref.faculty.lastName} marked as ${reviewStatus}.`,
        metadata: { reviewStatus, reviewerNotes: reviewerNotes ?? null },
    });
    return review;
}
// ─── Dev bulk-submit helper (non-production QA only) ───
export function isDevToolsEnabled() {
    if (process.env.NODE_ENV === 'production' && process.env.ATLAS_ENABLE_DEV_PREFERENCE_TOOLS !== 'true') {
        return false;
    }
    return true;
}
export async function devBulkSubmitSeeded(schoolId, schoolYearId, actorId) {
    if (!isDevToolsEnabled()) {
        throw err(403, 'DEV_TOOLS_DISABLED', 'Dev preference tools are disabled in production.');
    }
    const drafts = await prisma.facultyPreference.findMany({
        where: { schoolId, schoolYearId, status: 'DRAFT' },
        select: { id: true, facultyId: true, version: true },
    });
    if (drafts.length === 0) {
        return { converted: 0, auditId: null };
    }
    await prisma.$transaction(async (tx) => {
        for (const d of drafts) {
            await tx.facultyPreference.update({
                where: { id: d.id },
                data: {
                    status: 'SUBMITTED',
                    submittedAt: new Date(),
                    version: { increment: 1 },
                },
            });
        }
    });
    const audit = await prisma.auditLog.create({
        data: {
            schoolId,
            schoolYearId,
            action: 'PREFERENCE_DEV_BULK_SUBMIT',
            actorId,
            targetIds: drafts.map((d) => d.facultyId),
            metadata: {
                converted: drafts.length,
                timestamp: new Date().toISOString(),
            },
        },
    });
    return { converted: drafts.length, auditId: audit.id };
}
