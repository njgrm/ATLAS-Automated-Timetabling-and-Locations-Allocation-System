import { prisma } from '../lib/prisma.js';
import { publishPublishedScheduleEvent } from './published-schedule-events.service.js';
function err(statusCode, code, message, options) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    e.actionHint = options?.actionHint;
    e.details = options?.details;
    return e;
}
function isPositiveInteger(value) {
    return Number.isInteger(value) && Number(value) > 0;
}
function asSummaryRecord(summary) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary))
        return {};
    return summary;
}
function isPublishedSummary(summary) {
    const candidate = asSummaryRecord(summary);
    if (candidate.isPublished === true)
        return true;
    if (typeof candidate.publishedAt === 'string' && candidate.publishedAt.length > 0)
        return true;
    return typeof candidate.publishedBy === 'number';
}
function sameUtcDate(left, right) {
    return left.getUTCFullYear() === right.getUTCFullYear()
        && left.getUTCMonth() === right.getUTCMonth()
        && left.getUTCDate() === right.getUTCDate();
}
function parseEffectiveDate(value, now) {
    if (value == null || value === '') {
        throw err(400, 'EFFECTIVE_DATE_REQUIRED', 'Published revisions require an effective date.', {
            actionHint: 'Choose the first school day when this published revision should take effect.',
        });
    }
    const effectiveDate = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(effectiveDate.getTime())) {
        throw err(400, 'EFFECTIVE_DATE_INVALID', 'Effective date must be a valid date or ISO date string.');
    }
    if (effectiveDate.getTime() <= now.getTime()) {
        throw err(422, 'EFFECTIVE_DATE_NOT_FUTURE', 'Effective date must be later than the revision creation time.');
    }
    if (sameUtcDate(effectiveDate, now)) {
        throw err(422, 'EFFECTIVE_DATE_SAME_DAY', 'Same-day published revisions are not allowed in this workflow.', {
            actionHint: 'Choose the next school day or a later effective date.',
        });
    }
    return effectiveDate;
}
function normalizeReason(reason) {
    const normalized = typeof reason === 'string' ? reason.trim() : '';
    if (!normalized) {
        throw err(400, 'REVISION_REASON_REQUIRED', 'Published revisions require a reason.');
    }
    if (normalized.length > 500) {
        throw err(400, 'REVISION_REASON_TOO_LONG', 'Revision reason must be 500 characters or fewer.');
    }
    return normalized;
}
function normalizeChanges(changes) {
    if (!Array.isArray(changes) || changes.length === 0) {
        throw err(400, 'REVISION_CHANGES_REQUIRED', 'Published revisions require at least one changed entry.');
    }
    return changes.map((change, index) => {
        const entryId = typeof change?.entryId === 'string' ? change.entryId.trim() : '';
        if (!entryId) {
            throw err(400, 'REVISION_CHANGE_ENTRY_REQUIRED', `Revision change ${index + 1} must include an entryId.`);
        }
        if (!change.previous || typeof change.previous !== 'object' || Array.isArray(change.previous)) {
            throw err(400, 'REVISION_PREVIOUS_VALUES_REQUIRED', `Revision change ${entryId} must include previous values.`);
        }
        if (!change.next || typeof change.next !== 'object' || Array.isArray(change.next)) {
            throw err(400, 'REVISION_NEW_VALUES_REQUIRED', `Revision change ${entryId} must include new values.`);
        }
        return {
            entryId,
            changeType: typeof change.changeType === 'string' && change.changeType.trim()
                ? change.changeType.trim()
                : 'PUBLISHED_REPAIR',
            previous: change.previous,
            next: change.next,
        };
    });
}
function buildValueSnapshot(changes, side) {
    return changes.map((change) => ({
        entryId: change.entryId,
        values: change[side],
    }));
}
export async function createPublishedScheduleRevision(input, options) {
    if (!isPositiveInteger(input.schoolId))
        throw err(400, 'INVALID_SCHOOL_ID', 'schoolId must be a positive integer.');
    if (!isPositiveInteger(input.schoolYearId))
        throw err(400, 'INVALID_SCHOOL_YEAR_ID', 'schoolYearId must be a positive integer.');
    if (!isPositiveInteger(input.sourceRunId))
        throw err(400, 'INVALID_SOURCE_RUN_ID', 'sourceRunId must be a positive integer.');
    if (input.sourceRevisionId != null && !isPositiveInteger(input.sourceRevisionId)) {
        throw err(400, 'INVALID_SOURCE_REVISION_ID', 'sourceRevisionId must be a positive integer when provided.');
    }
    const now = options?.now ?? new Date();
    const effectiveDate = parseEffectiveDate(input.effectiveDate, now);
    const reason = normalizeReason(input.reason);
    const changes = normalizeChanges(input.changes);
    const actorId = input.actorId != null && isPositiveInteger(input.actorId) ? input.actorId : null;
    const sourceRun = await prisma.generationRun.findFirst({
        where: {
            id: input.sourceRunId,
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
        },
        select: {
            id: true,
            schoolId: true,
            schoolYearId: true,
            status: true,
            summary: true,
            version: true,
        },
    });
    if (!sourceRun) {
        throw err(404, 'SOURCE_RUN_NOT_FOUND', 'Source generation run was not found in this school/year scope.');
    }
    if (sourceRun.status !== 'COMPLETED' || !isPublishedSummary(sourceRun.summary)) {
        throw err(422, 'PUBLISHED_SOURCE_REQUIRED', 'Published revisions require a completed published source run.', {
            details: { sourceRunId: input.sourceRunId, status: sourceRun.status },
        });
    }
    if (input.sourceRevisionId != null) {
        const sourceRevision = await prisma.publishedScheduleRevision.findFirst({
            where: {
                id: input.sourceRevisionId,
                schoolId: input.schoolId,
                schoolYearId: input.schoolYearId,
                sourceRunId: input.sourceRunId,
            },
            select: { id: true },
        });
        if (!sourceRevision) {
            throw err(404, 'SOURCE_REVISION_NOT_FOUND', 'Source published revision was not found for this source run.');
        }
    }
    const changedEntryIds = changes.map((change) => change.entryId);
    const changeSummary = input.changeSummary ?? {
        changeCount: changes.length,
        entryIds: changedEntryIds,
    };
    const result = await prisma.$transaction(async (tx) => {
        const revision = await tx.publishedScheduleRevision.create({
            data: {
                schoolId: input.schoolId,
                schoolYearId: input.schoolYearId,
                sourceRunId: input.sourceRunId,
                sourceRevisionId: input.sourceRevisionId ?? null,
                status: 'SCHEDULED',
                effectiveDate,
                actorId,
                reason,
                changeSet: changes,
                changeSummary: changeSummary,
                previousValues: buildValueSnapshot(changes, 'previous'),
                newValues: buildValueSnapshot(changes, 'next'),
                metadata: {
                    ...(input.metadata ?? {}),
                    sourceRunVersion: sourceRun.version,
                    publishedAt: asSummaryRecord(sourceRun.summary).publishedAt ?? null,
                },
            },
        });
        const audit = await tx.auditLog.create({
            data: {
                schoolId: input.schoolId,
                schoolYearId: input.schoolYearId,
                action: 'PUBLISHED_SCHEDULE_REVISION_CREATED',
                actorId: actorId ?? 0,
                targetIds: [input.sourceRunId, revision.id],
                metadata: {
                    revisionId: revision.id,
                    sourceRunId: input.sourceRunId,
                    sourceRevisionId: input.sourceRevisionId ?? null,
                    effectiveDate: revision.effectiveDate.toISOString(),
                    reason,
                    changeCount: changes.length,
                    changedEntryIds,
                    status: revision.status,
                    publishedTruthPreserved: true,
                },
            },
        });
        return { revision, auditId: audit.id };
    });
    // Fire notification event after successful commit
    const affectedFacultyIdsSet = new Set();
    for (const change of changes) {
        if (typeof change.previous.facultyId === 'number') {
            affectedFacultyIdsSet.add(change.previous.facultyId);
        }
        if (typeof change.next.facultyId === 'number') {
            affectedFacultyIdsSet.add(change.next.facultyId);
        }
    }
    const affectedFacultyIds = [...affectedFacultyIdsSet];
    publishPublishedScheduleEvent({
        type: 'SCHEDULE_REVISED',
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        message: `Published schedule has been revised (effective date: ${effectiveDate.toISOString().slice(0, 10)}). Reason: ${reason}`,
        metadata: {
            revisionId: result.revision.id,
            sourceRunId: input.sourceRunId,
            effectiveDate: effectiveDate.toISOString(),
            reason,
            affectedFacultyIds,
            changeCount: changes.length,
        },
    });
    return result;
}
export async function listPublishedScheduleRevisions(params) {
    if (!isPositiveInteger(params.schoolId))
        throw err(400, 'INVALID_SCHOOL_ID', 'schoolId must be a positive integer.');
    if (!isPositiveInteger(params.schoolYearId))
        throw err(400, 'INVALID_SCHOOL_YEAR_ID', 'schoolYearId must be a positive integer.');
    if (params.sourceRunId != null && !isPositiveInteger(params.sourceRunId)) {
        throw err(400, 'INVALID_SOURCE_RUN_ID', 'sourceRunId must be a positive integer when provided.');
    }
    return prisma.publishedScheduleRevision.findMany({
        where: {
            schoolId: params.schoolId,
            schoolYearId: params.schoolYearId,
            ...(params.sourceRunId ? { sourceRunId: params.sourceRunId } : {}),
        },
        orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }],
    });
}
