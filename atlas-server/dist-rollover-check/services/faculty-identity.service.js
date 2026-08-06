import { prisma } from '../lib/prisma.js';
const FACULTY_IDENTITY_SELECT = {
    id: true,
    externalId: true,
    employeeId: true,
    schoolId: true,
    firstName: true,
    lastName: true,
    contactInfo: true,
    isActiveForScheduling: true,
    isStale: true,
    lastSyncedAt: true,
};
const SIGNAL_PRIORITY = {
    SOURCE_EXTERNAL_ID: 500_000,
    EMPLOYEE_ID: 400_000,
    ASSIGNMENT_BEARING: 300_000,
    AUTH_LINK: 200_000,
    TOKEN_EXTERNAL_ID: 100_000,
    CONTACT_EMAIL: 90_000,
};
function normalizeEmail(value) {
    const normalized = value?.trim().toLowerCase();
    return normalized && normalized.includes('@') ? normalized : null;
}
function normalizeEmployeeId(value) {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : null;
}
function positiveInt(value) {
    return Number.isInteger(value) && value && value > 0 ? value : null;
}
function addUnique(target, value) {
    if (value == null)
        return;
    if (!target.includes(value))
        target.push(value);
}
function recordCandidate(candidates, faculty, signal) {
    const current = candidates.get(faculty.id);
    if (current) {
        current.signals.add(signal);
        return;
    }
    candidates.set(faculty.id, {
        faculty,
        signals: new Set([signal]),
        assignmentCount: 0,
        subjectRowCount: 0,
    });
}
async function collectCandidatesByWhere(candidates, where, signal) {
    const faculty = await prisma.facultyMirror.findMany({
        where,
        select: FACULTY_IDENTITY_SELECT,
    });
    for (const member of faculty) {
        recordCandidate(candidates, member, signal);
    }
}
async function applyAssignmentCounts(candidates, schoolId, schoolYearId) {
    const facultyIds = [...candidates.keys()];
    if (facultyIds.length === 0)
        return;
    let currentYearSectionIds = [];
    if (Number.isInteger(schoolYearId) && schoolYearId && schoolYearId > 0) {
        const sections = await prisma.sectionMirror.findMany({
            where: { schoolId, schoolYearId, isStale: false, isActiveForScheduling: true },
            select: { externalId: true },
        });
        currentYearSectionIds = [...new Set(sections.map((section) => section.externalId))];
    }
    const ownershipWhere = {
        schoolId,
        facultyId: { in: facultyIds },
        ...(currentYearSectionIds.length > 0 ? { sectionId: { in: currentYearSectionIds } } : {}),
    };
    const [ownershipCounts, subjectCounts] = await Promise.all([
        prisma.subjectSectionOwnership.groupBy({
            by: ['facultyId'],
            where: ownershipWhere,
            _count: { _all: true },
        }),
        prisma.facultySubject.groupBy({
            by: ['facultyId'],
            where: { schoolId, facultyId: { in: facultyIds } },
            _count: { _all: true },
        }),
    ]);
    for (const row of ownershipCounts) {
        const candidate = candidates.get(row.facultyId);
        if (!candidate)
            continue;
        candidate.assignmentCount = row._count._all;
        if (candidate.assignmentCount > 0)
            candidate.signals.add('ASSIGNMENT_BEARING');
    }
    for (const row of subjectCounts) {
        const candidate = candidates.get(row.facultyId);
        if (!candidate)
            continue;
        candidate.subjectRowCount = row._count._all;
    }
}
function highestSignal(candidate) {
    return [...candidate.signals].sort((left, right) => SIGNAL_PRIORITY[right] - SIGNAL_PRIORITY[left])[0] ?? 'CONTACT_EMAIL';
}
function compareCandidates(left, right) {
    const leftSignal = SIGNAL_PRIORITY[highestSignal(left)];
    const rightSignal = SIGNAL_PRIORITY[highestSignal(right)];
    if (leftSignal !== rightSignal)
        return rightSignal - leftSignal;
    if (left.assignmentCount !== right.assignmentCount)
        return right.assignmentCount - left.assignmentCount;
    if (left.subjectRowCount !== right.subjectRowCount)
        return right.subjectRowCount - left.subjectRowCount;
    if (left.faculty.isStale !== right.faculty.isStale)
        return left.faculty.isStale ? 1 : -1;
    if (left.faculty.isActiveForScheduling !== right.faculty.isActiveForScheduling)
        return left.faculty.isActiveForScheduling ? -1 : 1;
    const leftSynced = left.faculty.lastSyncedAt?.getTime() ?? 0;
    const rightSynced = right.faculty.lastSyncedAt?.getTime() ?? 0;
    if (leftSynced !== rightSynced)
        return rightSynced - leftSynced;
    return left.faculty.id - right.faculty.id;
}
export async function resolveCanonicalFacultyMirror(input) {
    const sourceExternalIds = [];
    const tokenExternalIds = [];
    const linkedFacultyIds = [];
    const employeeIds = [];
    const emails = [];
    addUnique(sourceExternalIds, positiveInt(input.sourceExternalId));
    addUnique(tokenExternalIds, positiveInt(input.tokenUserId));
    addUnique(linkedFacultyIds, positiveInt(input.linkedFacultyId));
    addUnique(employeeIds, normalizeEmployeeId(input.employeeId));
    addUnique(emails, normalizeEmail(input.email));
    if (input.accountId) {
        const account = await prisma.atlasAuthAccount.findFirst({
            where: { id: input.accountId, schoolId: input.schoolId, isActive: true },
            select: {
                facultyId: true,
                email: true,
                employeeId: true,
                accountName: true,
                faculty: { select: { externalId: true, employeeId: true, contactInfo: true } },
            },
        });
        if (account) {
            addUnique(linkedFacultyIds, positiveInt(account.facultyId));
            addUnique(tokenExternalIds, positiveInt(account.faculty?.externalId ?? null));
            addUnique(employeeIds, normalizeEmployeeId(account.employeeId));
            addUnique(employeeIds, normalizeEmployeeId(account.faculty?.employeeId));
            addUnique(emails, normalizeEmail(account.email));
            addUnique(emails, normalizeEmail(account.faculty?.contactInfo));
            addUnique(emails, normalizeEmail(account.accountName));
        }
    }
    const candidates = new Map();
    await Promise.all([
        sourceExternalIds.length > 0
            ? collectCandidatesByWhere(candidates, { schoolId: input.schoolId, externalId: { in: sourceExternalIds } }, 'SOURCE_EXTERNAL_ID')
            : Promise.resolve(),
        employeeIds.length > 0
            ? collectCandidatesByWhere(candidates, { schoolId: input.schoolId, employeeId: { in: employeeIds } }, 'EMPLOYEE_ID')
            : Promise.resolve(),
        linkedFacultyIds.length > 0
            ? collectCandidatesByWhere(candidates, { schoolId: input.schoolId, id: { in: linkedFacultyIds } }, 'AUTH_LINK')
            : Promise.resolve(),
        tokenExternalIds.length > 0
            ? collectCandidatesByWhere(candidates, { schoolId: input.schoolId, externalId: { in: tokenExternalIds } }, 'TOKEN_EXTERNAL_ID')
            : Promise.resolve(),
        emails.length > 0
            ? collectCandidatesByWhere(candidates, { schoolId: input.schoolId, contactInfo: { in: emails, mode: 'insensitive' } }, 'CONTACT_EMAIL')
            : Promise.resolve(),
    ]);
    await applyAssignmentCounts(candidates, input.schoolId, input.schoolYearId);
    const ordered = [...candidates.values()].sort(compareCandidates);
    const selected = ordered[0];
    if (!selected)
        return null;
    return {
        faculty: selected.faculty,
        rule: highestSignal(selected),
        duplicateCandidateIds: ordered.map((candidate) => candidate.faculty.id),
        assignmentBearingCandidateIds: ordered
            .filter((candidate) => candidate.assignmentCount > 0)
            .map((candidate) => candidate.faculty.id),
        candidates: ordered.map((candidate) => ({
            id: candidate.faculty.id,
            externalId: candidate.faculty.externalId,
            employeeId: candidate.faculty.employeeId,
            signals: [...candidate.signals].sort((left, right) => SIGNAL_PRIORITY[right] - SIGNAL_PRIORITY[left]),
            assignmentCount: candidate.assignmentCount,
            subjectRowCount: candidate.subjectRowCount,
            isStale: candidate.faculty.isStale,
            isActiveForScheduling: candidate.faculty.isActiveForScheduling,
        })),
    };
}
export async function resolveCanonicalFacultyFromAuthPayload(user, params) {
    if (!user)
        return null;
    return resolveCanonicalFacultyMirror({
        schoolId: params.schoolId,
        schoolYearId: params.schoolYearId,
        accountId: user.accountId ?? null,
        linkedFacultyId: user.facultyId ?? null,
        tokenUserId: user.userId,
        email: user.email ?? null,
        employeeId: user.employeeId ?? null,
        accountName: user.accountName ?? null,
    });
}
