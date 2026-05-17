import { prisma } from '../lib/prisma.js';
import { inferSubjectProgramScopes } from './subject-program-scope.service.js';
const MATATAG_DEFAULTS = [
    // Core bundle shared by regular + offered special programs.
    { code: 'FIL', name: 'Filipino', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'ENG', name: 'English', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'ESP', name: 'ESP/GMRC', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'MAPEH', name: 'MAPEH', minMinutesPerWeek: 240, preferredRoomType: 'GYMNASIUM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    // Regular science contract (tri-sem).
    { code: 'SCI_BIO', name: 'Science - Biology', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, termGroupId: 'SCIENCE', termCount: 3, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'SCI_CHEM', name: 'Science - Chemistry', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, termGroupId: 'SCIENCE', termCount: 3, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'SCI_ES', name: 'Science - Earth Science', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, termGroupId: 'SCIENCE', termCount: 3, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'SCI_PHYS', name: 'Science - Physics (Transitional)', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR'], isActive: false },
    // Transitional regular TLE row retained for compatibility while exploratory/specialization rows are materialized.
    { code: 'TLE', name: 'Technology and Livelihood Education', minMinutesPerWeek: 240, preferredRoomType: 'TLE_WORKSHOP', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
    // Exploratory TLE (Grades 7-8).
    { code: 'TLE_ICT_EXP', name: 'TLE Exploratory - ICT', minMinutesPerWeek: 240, preferredRoomType: 'COMPUTER_LAB', gradeLevels: [7, 8], isSeedable: false, programScopes: ['REGULAR'], allowedSpecializations: ['ICT'] },
    { code: 'TLE_AFA_EXP', name: 'TLE Exploratory - Agriculture and Fishery Arts', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8], isSeedable: false, programScopes: ['REGULAR'], allowedSpecializations: ['AFA'] },
    { code: 'TLE_FCS_EXP', name: 'TLE Exploratory - Family and Consumer Science', minMinutesPerWeek: 240, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8], isSeedable: false, programScopes: ['REGULAR'], allowedSpecializations: ['FCS'] },
    { code: 'TLE_IA_EXP', name: 'TLE Exploratory - Industrial Arts', minMinutesPerWeek: 240, preferredRoomType: 'TLE_WORKSHOP', gradeLevels: [7, 8], isSeedable: false, programScopes: ['REGULAR'], allowedSpecializations: ['IA'] },
    // STE overlays (45-minute default overlays).
    { code: 'STE_ENV_SCI', name: 'Environmental Science', minMinutesPerWeek: 45, preferredRoomType: 'LABORATORY', gradeLevels: [7], isSeedable: false, programScopes: ['STE'] },
    { code: 'STE_BIOTECH', name: 'Biotechnology', minMinutesPerWeek: 45, preferredRoomType: 'LABORATORY', gradeLevels: [8], isSeedable: false, programScopes: ['STE'] },
    { code: 'STE_ICT', name: 'ICT', minMinutesPerWeek: 45, preferredRoomType: 'COMPUTER_LAB', gradeLevels: [8], isSeedable: false, programScopes: ['STE'], allowedSpecializations: ['ICT'] },
    { code: 'STE_APPLIED_CHEM', name: 'Applied Chemistry', minMinutesPerWeek: 45, preferredRoomType: 'LABORATORY', gradeLevels: [9], isSeedable: false, programScopes: ['STE'] },
    { code: 'STE_APPLIED_PHYS', name: 'Applied Physics', minMinutesPerWeek: 45, preferredRoomType: 'LABORATORY', gradeLevels: [10], isSeedable: false, programScopes: ['STE'] },
    { code: 'STE_ROBOTICS', name: 'Robotics', minMinutesPerWeek: 45, preferredRoomType: 'LABORATORY', gradeLevels: [10], isSeedable: false, programScopes: ['STE'] },
    { code: 'STE_RESEARCH', name: 'Research', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['STE'] },
    // SPA / SPS umbrella specialization overlays.
    { code: 'SPA_SPEC', name: 'Special Program in the Arts: Specialization', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA'], allowedSpecializations: ['MUSIC', 'VISUAL_ARTS', 'THEATER_ARTS', 'MEDIA_ARTS', 'CREATIVE_WRITING', 'DANCE', 'TRADITIONAL_ARTS'] },
    { code: 'SPS_SPEC', name: 'Special Program in Sports: Specialization', minMinutesPerWeek: 45, preferredRoomType: 'GYMNASIUM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPS'], allowedSpecializations: ['ATHLETICS', 'SWIMMING', 'BASKETBALL', 'VOLLEYBALL', 'FOOTBALL', 'SEPAK_TAKRAW', 'SOFTBALL', 'BASEBALL', 'BADMINTON', 'TABLE_TENNIS', 'TAEKWONDO', 'TENNIS', 'CHESS', 'GYMNASTICS', 'ARCHERY', 'ARNIS'] },
    { code: 'DEVL_READING', name: 'Developmental Reading', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['STE', 'SPA'] },
];
const DEPRECATED_SUBJECT_CODES = [
    'SCI',
    'ICT',
    'TLE_ICT_7',
    'TLE_ICT_8',
    'TLE_ICT_9',
    'TLE_ICT_10',
    'RESEARCH_I',
    'RESEARCH_II',
    'RESEARCH_III',
    'RESEARCH_IV',
    'ENV_SCI',
    'BIOTECHNOLOGY',
    'CONSUMERS_CHEMISTRY',
    'ELECTRONICS_ROBOTICS',
    'ADVANCED_CHEMISTRY',
    'ADVANCED_PHYSICS',
    'ADVANCED_STATISTICS',
    'BASIC_STATISTICS',
    'ELECTRONICS',
    'SPA_SPECIALIZATION',
    'MUSIC',
    'VISUAL_ARTS',
    'THEATER_ARTS',
    'MEDIA_ARTS',
    'CREATIVE_WRITING',
    'DANCE',
];
const PROGRAM_OVERLAY_CODES = {
    REGULAR: [],
    STE: ['STE_ENV_SCI', 'STE_BIOTECH', 'STE_ICT', 'STE_APPLIED_CHEM', 'STE_APPLIED_PHYS', 'STE_ROBOTICS', 'STE_RESEARCH'],
    SPA: ['SPA_SPEC'],
    SPS: ['SPS_SPEC'],
    OTHER: [],
};
const DYNAMIC_TLE_PREFIX = 'TLE_SPEC_';
function resolveEnrollProBaseUrl() {
    return process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
}
function normalizeProgramType(value) {
    if (typeof value !== 'string')
        return null;
    const normalized = value.trim().toUpperCase();
    if (normalized === 'STE' || normalized === 'SPA' || normalized === 'SPS' || normalized === 'REGULAR') {
        return normalized;
    }
    return null;
}
function normalizeCode(value) {
    if (typeof value !== 'string')
        return '';
    return value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}
function inferWorkshopType(programCategory) {
    const normalized = (programCategory ?? '').toUpperCase();
    if (normalized.includes('ICT'))
        return 'COMPUTER_LAB';
    if (normalized.includes('SPORT'))
        return 'GYMNASIUM';
    if (normalized.includes('AGRI') || normalized.includes('FISH') || normalized.includes('FCS'))
        return 'LABORATORY';
    return 'TLE_WORKSHOP';
}
async function fetchJsonWithAuth(url, token) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`Upstream request failed (${response.status}) for ${url}`);
    }
    return response.json();
}
async function fetchSectionsProgramSignals(baseUrl, token) {
    const offered = new Set();
    let currentPage = 1;
    let totalPages = 1;
    const pageSize = 200;
    while (currentPage <= totalPages) {
        const url = `${baseUrl}/integration/v1/sections?page=${currentPage}&limit=${pageSize}`;
        const payload = await fetchJsonWithAuth(url, token);
        const rows = Array.isArray(payload.data) ? payload.data : [];
        for (const row of rows) {
            const programType = normalizeProgramType(row.programType);
            if (programType)
                offered.add(programType);
        }
        const upstreamPages = Number(payload.meta?.totalPages ?? 0);
        totalPages = Number.isFinite(upstreamPages) && upstreamPages > 0
            ? upstreamPages
            : (rows.length < pageSize ? currentPage : currentPage + 1);
        currentPage += 1;
    }
    return offered;
}
async function fetchUpstreamProgramSignals(schoolId, schoolYearId, token) {
    const baseUrl = resolveEnrollProBaseUrl();
    const offeredPrograms = new Set(['REGULAR']);
    const tleSpecializations = new Map();
    try {
        const offeringUrl = `${baseUrl}/integration/v1/subject-offerings?schoolId=${schoolId}&schoolYearId=${schoolYearId}`;
        const offeringsPayload = await fetchJsonWithAuth(offeringUrl, token);
        const offerings = Array.isArray(offeringsPayload.data) ? offeringsPayload.data : [];
        for (const offering of offerings) {
            const programType = normalizeProgramType(offering.programType);
            if (programType)
                offeredPrograms.add(programType);
        }
    }
    catch {
        // Best-effort contract sync; generation flow handles hard upstream failures elsewhere.
    }
    try {
        const sectionPrograms = await fetchSectionsProgramSignals(baseUrl, token);
        for (const programType of sectionPrograms) {
            offeredPrograms.add(programType);
        }
    }
    catch {
        // Keep best-effort behavior.
    }
    try {
        const tleUrl = `${baseUrl}/admin/tle-programs?schoolId=${schoolId}`;
        const tlePayload = await fetchJsonWithAuth(tleUrl, token);
        const tleRows = Array.isArray(tlePayload.data) ? tlePayload.data : [];
        for (const row of tleRows) {
            if (!row || typeof row !== 'object')
                continue;
            const record = row;
            const code = normalizeCode(record.code ?? record.specializationCode ?? record.programCode ?? record.name);
            if (!code)
                continue;
            const name = typeof record.name === 'string' && record.name.trim().length > 0
                ? record.name.trim()
                : code.replace(/_/g, ' ');
            const category = typeof record.programCategory === 'string' ? record.programCategory : null;
            const gradeLevels = Array.isArray(record.gradeLevels)
                ? record.gradeLevels.filter((value) => Number.isFinite(value)).map(Number)
                : [9, 10];
            const existing = tleSpecializations.get(code);
            if (!existing) {
                tleSpecializations.set(code, { code, name, programCategory: category, gradeLevels: [...new Set(gradeLevels)] });
                continue;
            }
            existing.gradeLevels = [...new Set([...existing.gradeLevels, ...gradeLevels])];
            if (!existing.programCategory && category)
                existing.programCategory = category;
        }
    }
    catch {
        // Keep sync resilient when the protected endpoint is unavailable.
    }
    return {
        offeredPrograms,
        tleSpecializations: [...tleSpecializations.values()],
    };
}
export async function ensureDefaultSubjects(schoolId) {
    await prisma.subject.updateMany({
        where: {
            schoolId,
            code: { in: DEPRECATED_SUBJECT_CODES },
        },
        data: {
            isActive: false,
            isSeedable: false,
        },
    });
    await prisma.$transaction(MATATAG_DEFAULTS.map((subject) => prisma.subject.upsert({
        where: {
            schoolId_code: {
                schoolId,
                code: subject.code,
            },
        },
        update: {
            name: subject.name,
            minMinutesPerWeek: subject.minMinutesPerWeek,
            preferredRoomType: subject.preferredRoomType,
            sessionPattern: subject.sessionPattern ?? 'ANY',
            modularGroupId: subject.modularGroupId ?? null,
            modularOrder: subject.modularOrder ?? null,
            termGroupId: subject.termGroupId ?? subject.modularGroupId ?? null,
            termCount: subject.termCount ?? 3,
            gradeLevels: subject.gradeLevels,
            programScopes: subject.programScopes,
            allowedSpecializations: subject.allowedSpecializations ?? [],
            requiredFeatures: subject.requiredFeatures ?? [],
            isSeedable: subject.isSeedable,
            isActive: subject.isActive ?? true,
        },
        create: {
            schoolId,
            code: subject.code,
            name: subject.name,
            minMinutesPerWeek: subject.minMinutesPerWeek,
            preferredRoomType: subject.preferredRoomType,
            sessionPattern: subject.sessionPattern ?? 'ANY',
            modularGroupId: subject.modularGroupId ?? null,
            modularOrder: subject.modularOrder ?? null,
            termGroupId: subject.termGroupId ?? subject.modularGroupId ?? null,
            termCount: subject.termCount ?? 3,
            gradeLevels: subject.gradeLevels,
            programScopes: subject.programScopes,
            allowedSpecializations: subject.allowedSpecializations ?? [],
            requiredFeatures: subject.requiredFeatures ?? [],
            isSeedable: subject.isSeedable,
            isActive: subject.isActive ?? true,
        },
    })));
}
async function materializeDynamicTleSubjects(schoolId, specializations) {
    if (specializations.length === 0)
        return;
    const dynamicCodes = new Set();
    for (const specialization of specializations) {
        const code = `${DYNAMIC_TLE_PREFIX}${specialization.code}`.slice(0, 64);
        dynamicCodes.add(code);
        await prisma.subject.upsert({
            where: { schoolId_code: { schoolId, code } },
            update: {
                name: `TLE Specialization - ${specialization.name}`,
                gradeLevels: specialization.gradeLevels,
                programScopes: ['REGULAR'],
                allowedSpecializations: [specialization.code],
                preferredRoomType: inferWorkshopType(specialization.programCategory),
                minMinutesPerWeek: 240,
                isSeedable: false,
                isActive: true,
            },
            create: {
                schoolId,
                code,
                name: `TLE Specialization - ${specialization.name}`,
                gradeLevels: specialization.gradeLevels,
                programScopes: ['REGULAR'],
                allowedSpecializations: [specialization.code],
                preferredRoomType: inferWorkshopType(specialization.programCategory),
                minMinutesPerWeek: 240,
                sessionPattern: 'ANY',
                isSeedable: false,
                isActive: true,
            },
        });
    }
    await prisma.subject.updateMany({
        where: {
            schoolId,
            code: { startsWith: DYNAMIC_TLE_PREFIX, notIn: [...dynamicCodes] },
        },
        data: { isActive: false },
    });
}
export async function reconcileSubjectContractFromUpstream(schoolId, schoolYearId, authToken) {
    await ensureDefaultSubjects(schoolId);
    const signals = await fetchUpstreamProgramSignals(schoolId, schoolYearId, authToken);
    const offeredPrograms = signals.offeredPrograms;
    for (const [programType, overlayCodes] of Object.entries(PROGRAM_OVERLAY_CODES)) {
        if (programType === 'REGULAR' || programType === 'OTHER')
            continue;
        if (offeredPrograms.has(programType)) {
            await prisma.subject.updateMany({
                where: { schoolId, code: { in: overlayCodes } },
                data: { isActive: true },
            });
        }
        else {
            await prisma.subject.updateMany({
                where: { schoolId, code: { in: overlayCodes } },
                data: { isActive: false },
            });
        }
    }
    const steOffered = offeredPrograms.has('STE');
    const spaOffered = offeredPrograms.has('SPA');
    await prisma.subject.updateMany({
        where: { schoolId, code: 'DEVL_READING' },
        data: { isActive: steOffered || spaOffered },
    });
    await materializeDynamicTleSubjects(schoolId, signals.tleSpecializations);
}
export async function getSubjectsBySchool(schoolId, filters) {
    const subjects = await prisma.subject.findMany({
        where: { schoolId },
        orderBy: [{ isSeedable: 'desc' }, { name: 'asc' }],
    });
    const includeSte = filters?.includeSte ?? true;
    const includeSpa = filters?.includeSpa ?? true;
    // Use stored programScopes; fall back to heuristic inference for legacy rows with empty scopes
    return subjects
        .map((subject) => ({
        ...subject,
        programScopes: subject.programScopes.length > 0
            ? subject.programScopes
            : inferSubjectProgramScopes(subject.code, subject.name),
    }))
        .filter((subject) => {
        if (!includeSte && subject.programScopes.includes('STE'))
            return false;
        if (!includeSpa && subject.programScopes.includes('SPA'))
            return false;
        return true;
    });
}
export async function getSubjectById(id) {
    return prisma.subject.findUnique({ where: { id } });
}
export async function createSubject(schoolId, data) {
    // Validate inter-section grade levels are within subject's grade levels
    const interGrades = data.interSectionGradeLevels ?? [];
    if (interGrades.length > 0) {
        const invalid = interGrades.filter((g) => !data.gradeLevels.includes(g));
        if (invalid.length > 0) {
            throw Object.assign(new Error(`interSectionGradeLevels contains grades not in subject gradeLevels: ${invalid.join(', ')}`), { statusCode: 400, code: 'INVALID_INTER_SECTION_GRADES' });
        }
    }
    return prisma.subject.create({
        data: {
            schoolId,
            code: data.code,
            name: data.name,
            minMinutesPerWeek: data.minMinutesPerWeek,
            preferredRoomType: data.preferredRoomType,
            sessionPattern: data.sessionPattern ?? 'ANY',
            gradeLevels: data.gradeLevels,
            isActive: data.isActive ?? true,
            isSeedable: data.isSeedable ?? false,
            interSectionEnabled: data.interSectionEnabled ?? false,
            interSectionGradeLevels: interGrades,
            modularGroupId: data.modularGroupId ?? null,
            modularOrder: data.modularOrder ?? null,
            termGroupId: data.termGroupId ?? null,
            termCount: data.termCount ?? 3,
            programScopes: data.programScopes ?? ['REGULAR'],
            allowedSpecializations: data.allowedSpecializations ?? [],
            requiredFeatures: data.requiredFeatures ?? [],
        },
    });
}
export async function updateSubject(id, data) {
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject)
        return null;
    // Validate inter-section grade levels if provided
    const newGradeLevels = data.gradeLevels ?? subject.gradeLevels;
    if (data.interSectionGradeLevels !== undefined && data.interSectionGradeLevels.length > 0) {
        const invalid = data.interSectionGradeLevels.filter((g) => !newGradeLevels.includes(g));
        if (invalid.length > 0) {
            throw Object.assign(new Error(`interSectionGradeLevels contains grades not in subject gradeLevels: ${invalid.join(', ')}`), { statusCode: 400, code: 'INVALID_INTER_SECTION_GRADES' });
        }
    }
    // Seedable subjects can update name, minMinutesPerWeek, gradeLevels, and programScopes
    if (subject.isSeedable) {
        const allowed = {};
        if (data.name !== undefined)
            allowed.name = data.name;
        if (data.minMinutesPerWeek !== undefined)
            allowed.minMinutesPerWeek = data.minMinutesPerWeek;
        if (data.gradeLevels !== undefined)
            allowed.gradeLevels = data.gradeLevels;
        if (data.sessionPattern !== undefined)
            allowed.sessionPattern = data.sessionPattern;
        if (data.interSectionEnabled !== undefined)
            allowed.interSectionEnabled = data.interSectionEnabled;
        if (data.interSectionGradeLevels !== undefined)
            allowed.interSectionGradeLevels = data.interSectionGradeLevels;
        if (data.isSeedable !== undefined)
            allowed.isSeedable = data.isSeedable;
        if (data.modularGroupId !== undefined)
            allowed.modularGroupId = data.modularGroupId;
        if (data.modularOrder !== undefined)
            allowed.modularOrder = data.modularOrder;
        if (data.termGroupId !== undefined)
            allowed.termGroupId = data.termGroupId;
        if (data.termCount !== undefined)
            allowed.termCount = data.termCount;
        if (data.programScopes !== undefined)
            allowed.programScopes = data.programScopes;
        if (data.allowedSpecializations !== undefined)
            allowed.allowedSpecializations = data.allowedSpecializations;
        if (data.requiredFeatures !== undefined)
            allowed.requiredFeatures = data.requiredFeatures;
        return prisma.subject.update({ where: { id }, data: allowed });
    }
    const updateData = {};
    if (data.name !== undefined)
        updateData.name = data.name;
    if (data.minMinutesPerWeek !== undefined)
        updateData.minMinutesPerWeek = data.minMinutesPerWeek;
    if (data.preferredRoomType !== undefined)
        updateData.preferredRoomType = data.preferredRoomType;
    if (data.sessionPattern !== undefined)
        updateData.sessionPattern = data.sessionPattern;
    if (data.gradeLevels !== undefined)
        updateData.gradeLevels = data.gradeLevels;
    if (data.isActive !== undefined)
        updateData.isActive = data.isActive;
    if (data.isSeedable !== undefined)
        updateData.isSeedable = data.isSeedable;
    if (data.interSectionEnabled !== undefined)
        updateData.interSectionEnabled = data.interSectionEnabled;
    if (data.interSectionGradeLevels !== undefined)
        updateData.interSectionGradeLevels = data.interSectionGradeLevels;
    if (data.modularGroupId !== undefined)
        updateData.modularGroupId = data.modularGroupId;
    if (data.modularOrder !== undefined)
        updateData.modularOrder = data.modularOrder;
    if (data.termGroupId !== undefined)
        updateData.termGroupId = data.termGroupId;
    if (data.termCount !== undefined)
        updateData.termCount = data.termCount;
    if (data.programScopes !== undefined)
        updateData.programScopes = data.programScopes;
    if (data.allowedSpecializations !== undefined)
        updateData.allowedSpecializations = data.allowedSpecializations;
    if (data.requiredFeatures !== undefined)
        updateData.requiredFeatures = data.requiredFeatures;
    return prisma.subject.update({ where: { id }, data: updateData });
}
export async function deleteSubject(id) {
    const subject = await prisma.subject.findUnique({
        where: { id },
        include: { facultySubjects: { select: { id: true }, take: 1 } },
    });
    if (!subject)
        return { success: false, error: 'Subject not found.' };
    if (subject.isSeedable)
        return { success: false, error: 'DepEd standard subjects cannot be deleted.' };
    if (subject.facultySubjects.length > 0) {
        return { success: false, error: 'Cannot delete a subject that is assigned to faculty.' };
    }
    await prisma.subject.delete({ where: { id } });
    return { success: true };
}
export async function getSubjectCountBySchool(schoolId) {
    return prisma.subject.count({ where: { schoolId, isActive: true } });
}
export async function getSubjectsWithoutFaculty(schoolId) {
    return prisma.subject.findMany({
        where: {
            schoolId,
            isActive: true,
            facultySubjects: { none: {} },
        },
        select: { id: true, name: true, code: true },
    });
}
//# sourceMappingURL=subject.service.js.map