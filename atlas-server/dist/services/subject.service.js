import { prisma } from '../lib/prisma.js';
import { inferSubjectProgramScopes } from './subject-program-scope.service.js';
import { resolveSubjectContractDefaults, resolveSubjectOwnerDepartmentCode, resolveSubjectQualificationPriority, resolveSubjectRotationFamily, resolveSubjectOutputLabel, } from './subject-ownership.service.js';
const MATATAG_DEFAULTS = [
    // Core bundle shared by regular + offered special programs.
    { code: 'FIL', name: 'Filipino', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'ENG', name: 'English', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'AP', name: 'Araling Panlipunan', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'ESP', name: 'ESP/GMRC', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'MAPEH', name: 'MAPEH', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'HG', name: 'Homeroom Guidance', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    // Regular science contract (tri-sem).
    { code: 'SCI_BIO', name: 'Science - Biology', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'SCIENCE', modularOrder: 1, termGroupId: 'SCIENCE', termCount: 3, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'SCI_CHEM', name: 'Science - Chemistry', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'SCIENCE', modularOrder: 2, termGroupId: 'SCIENCE', termCount: 3, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'SCI_ES', name: 'Science - Earth Science', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'SCIENCE', modularOrder: 3, termGroupId: 'SCIENCE', termCount: 3, programScopes: ['REGULAR', 'STE', 'SPA', 'SPS'] },
    { code: 'SCI_PHYS', name: 'Science - Physics (Transitional)', minMinutesPerWeek: 225, preferredRoomType: 'LABORATORY', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['REGULAR'], isActive: false },
    // Transitional regular TLE row retained for compatibility while exploratory/specialization rows are materialized.
    { code: 'TLE', name: 'Technology and Livelihood Education', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: true, programScopes: ['REGULAR'] },
    // Exploratory TLE (Grades 7-8).
    { code: 'TLE_ICT_EXP', name: 'TLE Exploratory - ICT', minMinutesPerWeek: 225, preferredRoomType: 'COMPUTER_LAB', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'TLE_EXPLORATORY', modularOrder: 1, programScopes: ['REGULAR'], allowedSpecializations: ['ICT'] },
    { code: 'TLE_AFA_EXP', name: 'TLE Exploratory - Agriculture and Fishery Arts', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'TLE_EXPLORATORY', modularOrder: 2, programScopes: ['REGULAR'], allowedSpecializations: ['AFA'] },
    { code: 'TLE_FCS_EXP', name: 'TLE Exploratory - Family and Consumer Science', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, modularGroupId: 'TLE_EXPLORATORY', modularOrder: 3, programScopes: ['REGULAR'], allowedSpecializations: ['FCS'] },
    // STE overlays.
    { code: 'STE_ENV_SCI', name: 'Environmental Science', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7], isSeedable: false, programScopes: ['STE'] },
    { code: 'STE_BIOTECH', name: 'Biotechnology', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [8], isSeedable: false, programScopes: ['STE'] },
    { code: 'STE_APPLIED_CHEM', name: 'Applied Chemistry', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [9], isSeedable: false, programScopes: ['STE'] },
    { code: 'STE_APPLIED_PHYS', name: 'Applied Physics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [10], isSeedable: false, programScopes: ['STE'] },
    { code: 'STE_ROBOTICS', name: 'Robotics', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [10], isSeedable: false, programScopes: ['STE'] },
    { code: 'STE_RESEARCH', name: 'Research', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['STE'] },
    // SPA / SPS umbrella specialization overlays.
    { code: 'SPA_SPEC', name: 'Special Program in the Arts: Specialization', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPA'], allowedSpecializations: ['MUSIC', 'VISUAL_ARTS', 'THEATER_ARTS', 'MEDIA_ARTS', 'CREATIVE_WRITING', 'DANCE', 'TRADITIONAL_ARTS'] },
    { code: 'SPS_SPEC', name: 'Special Program in Sports: Specialization', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['SPS'], allowedSpecializations: ['ATHLETICS', 'SWIMMING', 'BASKETBALL', 'VOLLEYBALL', 'FOOTBALL', 'SEPAK_TAKRAW', 'SOFTBALL', 'BASEBALL', 'BADMINTON', 'TABLE_TENNIS', 'TAEKWONDO', 'TENNIS', 'CHESS', 'GYMNASTICS', 'ARCHERY', 'ARNIS'] },
    { code: 'DEVL_READING', name: 'Developmental Reading', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8, 9, 10], isSeedable: false, programScopes: ['STE', 'SPA'] },
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
    'TLE_IA_EXP',
    'STE_ICT',
];
const PROGRAM_OVERLAY_CODES = {
    REGULAR: [],
    STE: ['STE_ENV_SCI', 'STE_BIOTECH', 'STE_APPLIED_CHEM', 'STE_APPLIED_PHYS', 'STE_ROBOTICS', 'STE_RESEARCH'],
    SPA: ['SPA_SPEC'],
    SPS: ['SPS_SPEC'],
    OTHER: [],
};
const DYNAMIC_TLE_PREFIX = 'TLE_SPEC_';
function withSubjectViewMetadata(subject) {
    const outputLabel = subject.outputLabel?.trim();
    const ownerDepartment = subject.ownerDepartment ?? resolveSubjectOwnerDepartmentCode(subject.code, subject.name);
    const qualificationPriority = resolveSubjectQualificationPriority(subject.code, subject.qualificationPriority ?? null);
    const rotationFamily = subject.rotationFamily ?? resolveSubjectRotationFamily(subject.code, subject.modularGroupId ?? null);
    const isSystemManaged = subject.isSystemManaged === true;
    return {
        ...subject,
        displayCode: outputLabel && outputLabel.length > 0
            ? outputLabel
            : resolveSubjectOutputLabel(subject.code, subject.name, subject.modularGroupId ?? null),
        ownerDepartment,
        qualificationPriority,
        rotationFamily,
        specializationSource: (subject.allowedSpecializations ?? []).length > 0 ? 'SUBJECT_CONTRACT' : 'NONE',
        isSystemManaged,
    };
}
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
    if (normalized === 'SCIENCE_TECHNOLOGY_AND_ENGINEERING' || normalized === 'SCIENCE, TECHNOLOGY & ENGINEERING') {
        return 'STE';
    }
    if (normalized === 'SPECIAL_PROGRAM_IN_THE_ARTS') {
        return 'SPA';
    }
    if (normalized === 'SPECIAL_PROGRAM_IN_SPORTS') {
        return 'SPS';
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
    return 'CLASSROOM';
}
async function fetchJsonWithAuth(url, token) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`Upstream request failed (${response.status}) for ${url}`);
    }
    return response.json();
}
async function fetchSectionsProgramSignals(baseUrl, schoolId, schoolYearId, token) {
    const offered = new Set();
    let currentPage = 1;
    let totalPages = 1;
    const pageSize = 200;
    while (currentPage <= totalPages) {
        const url = `${baseUrl}/integration/v1/sections?schoolId=${schoolId}&schoolYearId=${schoolYearId}&page=${currentPage}&limit=${pageSize}`;
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
async function fetchMirroredProgramSignals(schoolId, schoolYearId) {
    const programs = await prisma.sectionMirror.findMany({
        where: { schoolId, schoolYearId, isStale: false },
        select: { programType: true },
        distinct: ['programType'],
    });
    const offered = new Set(['REGULAR']);
    for (const row of programs) {
        const normalized = normalizeProgramType(row.programType);
        if (normalized)
            offered.add(normalized);
    }
    return offered;
}
async function fetchMirroredTleSignals(schoolId, schoolYearId) {
    const rows = await prisma.sectionMirror.findMany({
        where: {
            schoolId,
            schoolYearId,
            isStale: false,
            tleSpecialization: { not: null },
        },
        select: {
            tleSpecialization: true,
            tleProgramCategory: true,
            gradeLevelId: true,
        },
    });
    const map = new Map();
    for (const row of rows) {
        if (!row.tleSpecialization)
            continue;
        const code = normalizeCode(row.tleSpecialization);
        if (!code)
            continue;
        const existing = map.get(code);
        if (!existing) {
            map.set(code, {
                code,
                name: row.tleSpecialization,
                programCategory: row.tleProgramCategory,
                gradeLevels: [row.gradeLevelId],
            });
            continue;
        }
        existing.gradeLevels = [...new Set([...existing.gradeLevels, row.gradeLevelId])];
        if (!existing.programCategory && row.tleProgramCategory) {
            existing.programCategory = row.tleProgramCategory;
        }
    }
    return [...map.values()];
}
function mergeTleSpecializations(base, fallback) {
    const map = new Map();
    for (const item of [...base, ...fallback]) {
        const existing = map.get(item.code);
        if (!existing) {
            map.set(item.code, {
                code: item.code,
                name: item.name,
                programCategory: item.programCategory,
                gradeLevels: [...new Set(item.gradeLevels)],
            });
            continue;
        }
        existing.gradeLevels = [...new Set([...existing.gradeLevels, ...item.gradeLevels])];
        if (!existing.programCategory && item.programCategory) {
            existing.programCategory = item.programCategory;
        }
    }
    return [...map.values()];
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
        const sectionPrograms = await fetchSectionsProgramSignals(baseUrl, schoolId, schoolYearId, token);
        for (const programType of sectionPrograms) {
            offeredPrograms.add(programType);
        }
    }
    catch {
        // Keep best-effort behavior.
    }
    try {
        const mirrorPrograms = await fetchMirroredProgramSignals(schoolId, schoolYearId);
        for (const programType of mirrorPrograms) {
            offeredPrograms.add(programType);
        }
    }
    catch {
        // Mirror enrichment is best-effort.
    }
    try {
        const tleUrl = `${baseUrl}/bosy/tle-programs?schoolYearId=${schoolYearId}`;
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
    const mirroredTleSpecializations = await fetchMirroredTleSignals(schoolId, schoolYearId);
    return {
        offeredPrograms,
        tleSpecializations: mergeTleSpecializations([...tleSpecializations.values()], mirroredTleSpecializations),
    };
}
function buildSubjectContractData(subject) {
    const defaults = resolveSubjectContractDefaults({
        subjectCode: subject.code,
        subjectName: subject.name,
        modularGroupId: subject.modularGroupId ?? null,
    });
    return {
        ownerDepartment: subject.ownerDepartment ?? defaults.ownerDepartment,
        qualificationPriority: subject.qualificationPriority ?? defaults.qualificationPriority,
        rotationFamily: subject.rotationFamily ?? defaults.rotationFamily,
        outputLabel: subject.outputLabel?.trim() || defaults.outputLabel,
        isSystemManaged: subject.isSystemManaged ?? defaults.isSystemManaged,
    };
}
let subjectContractSchemaReady = null;
async function ensureSubjectContractSchemaColumns() {
    if (!subjectContractSchemaReady) {
        subjectContractSchemaReady = (async () => {
            await prisma.$executeRawUnsafe(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject_qualification_priority') THEN
    CREATE TYPE subject_qualification_priority AS ENUM ('DEPARTMENT_FIRST', 'SPECIALIZATION_PRIMARY');
  END IF;
END
$$;
			`);
            await prisma.$executeRawUnsafe(`
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS output_label VARCHAR(64)
			`);
            await prisma.$executeRawUnsafe(`
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS owner_department VARCHAR(32)
			`);
            await prisma.$executeRawUnsafe(`
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS qualification_priority subject_qualification_priority
			`);
            await prisma.$executeRawUnsafe(`
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS rotation_family VARCHAR(64)
			`);
            await prisma.$executeRawUnsafe(`
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS is_system_managed BOOLEAN NOT NULL DEFAULT FALSE
			`);
            await prisma.$executeRawUnsafe(`
UPDATE subjects
SET
  output_label = CASE
    WHEN code LIKE 'SCI_%' THEN 'SCIENCE'
    WHEN code LIKE 'TLE%' THEN 'TLE'
    WHEN code IN ('SPA_SPEC', 'SPS_SPEC') THEN 'SPECIALIZATION'
    WHEN code = 'STE_RESEARCH' THEN 'RESEARCH'
    ELSE code
  END,
  owner_department = CASE
    WHEN code LIKE 'FIL%' THEN 'FIL'
    WHEN code LIKE 'ENG%' THEN 'ENG'
    WHEN code LIKE 'MATH%' THEN 'MATH'
    WHEN code LIKE 'AP%' THEN 'AP'
    WHEN code LIKE 'ESP%' OR code = 'HG' THEN 'ESP'
    WHEN code LIKE 'MAPEH%' THEN 'MAPEH'
    WHEN code LIKE 'TLE%' THEN 'TLE'
    WHEN code LIKE 'SCI%' OR code LIKE 'STE_%' THEN 'SCI'
    WHEN code LIKE 'SPA_%' THEN 'SPA'
    WHEN code LIKE 'SPS_%' THEN 'SPS'
    WHEN code = 'DEVL_READING' THEN 'ENG'
    ELSE owner_department
  END,
	qualification_priority = 'DEPARTMENT_FIRST'::subject_qualification_priority,
  rotation_family = CASE
    WHEN code LIKE 'TLE%' THEN 'TLE_ROTATION'
    WHEN modular_group_id IS NOT NULL AND modular_group_id <> '' THEN modular_group_id
    ELSE rotation_family
  END,
  is_system_managed = CASE
    WHEN code LIKE 'TLE_%_EXP' OR code LIKE 'TLE_SPEC_%' THEN TRUE
    ELSE is_system_managed
  END
WHERE
  output_label IS NULL
  OR owner_department IS NULL
  OR qualification_priority IS NULL
  OR rotation_family IS NULL
  OR (code LIKE 'TLE_%_EXP' OR code LIKE 'TLE_SPEC_%')
			`);
            await prisma.$executeRawUnsafe(`
UPDATE subjects
SET qualification_priority = 'DEPARTMENT_FIRST'::subject_qualification_priority
WHERE qualification_priority IS NULL
			`);
            await prisma.$executeRawUnsafe(`
ALTER TABLE subjects
  ALTER COLUMN qualification_priority SET DEFAULT 'DEPARTMENT_FIRST'::subject_qualification_priority
			`);
            await prisma.$executeRawUnsafe(`
ALTER TABLE subjects
  ALTER COLUMN qualification_priority SET NOT NULL
			`);
        })().catch((error) => {
            subjectContractSchemaReady = null;
            throw error;
        });
    }
    await subjectContractSchemaReady;
}
export async function ensureDefaultSubjects(schoolId) {
    await ensureSubjectContractSchemaColumns();
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
    await prisma.$transaction(MATATAG_DEFAULTS.map((subject) => {
        const contract = buildSubjectContractData(subject);
        return prisma.subject.upsert({
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
                ownerDepartment: contract.ownerDepartment,
                qualificationPriority: contract.qualificationPriority,
                rotationFamily: contract.rotationFamily,
                outputLabel: contract.outputLabel,
                isSystemManaged: contract.isSystemManaged,
            },
            create: {
                schoolId,
                code: subject.code,
                name: subject.name,
                minMinutesPerWeek: subject.minMinutesPerWeek,
                preferredRoomType: subject.preferredRoomType,
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
                ownerDepartment: contract.ownerDepartment,
                qualificationPriority: contract.qualificationPriority,
                rotationFamily: contract.rotationFamily,
                outputLabel: contract.outputLabel,
                isSystemManaged: contract.isSystemManaged,
            },
        });
    }));
}
async function materializeDynamicTleSubjects(schoolId, specializations) {
    if (specializations.length === 0) {
        await prisma.subject.updateMany({
            where: {
                schoolId,
                code: { startsWith: DYNAMIC_TLE_PREFIX },
            },
            data: { isActive: false },
        });
        return;
    }
    const dynamicCodes = new Set();
    for (const specialization of specializations) {
        const code = `${DYNAMIC_TLE_PREFIX}${specialization.code}`.slice(0, 64);
        dynamicCodes.add(code);
        const contract = buildSubjectContractData({
            code,
            name: `TLE Specialization - ${specialization.name}`,
            modularGroupId: 'TLE_EXPLORATORY',
            ownerDepartment: 'TLE',
            qualificationPriority: 'DEPARTMENT_FIRST',
            rotationFamily: 'TLE_ROTATION',
            outputLabel: 'TLE',
            isSystemManaged: true,
        });
        await prisma.subject.upsert({
            where: { schoolId_code: { schoolId, code } },
            update: {
                name: `TLE Specialization - ${specialization.name}`,
                gradeLevels: specialization.gradeLevels,
                programScopes: ['REGULAR'],
                interSectionEnabled: true,
                interSectionGradeLevels: specialization.gradeLevels,
                allowedSpecializations: [specialization.code],
                preferredRoomType: inferWorkshopType(specialization.programCategory),
                minMinutesPerWeek: 225,
                isSeedable: false,
                isActive: true,
                ownerDepartment: contract.ownerDepartment,
                qualificationPriority: contract.qualificationPriority,
                rotationFamily: contract.rotationFamily,
                outputLabel: contract.outputLabel,
                isSystemManaged: contract.isSystemManaged,
            },
            create: {
                schoolId,
                code,
                name: `TLE Specialization - ${specialization.name}`,
                gradeLevels: specialization.gradeLevels,
                programScopes: ['REGULAR'],
                interSectionEnabled: true,
                interSectionGradeLevels: specialization.gradeLevels,
                allowedSpecializations: [specialization.code],
                preferredRoomType: inferWorkshopType(specialization.programCategory),
                minMinutesPerWeek: 225,
                isSeedable: false,
                isActive: true,
                ownerDepartment: contract.ownerDepartment,
                qualificationPriority: contract.qualificationPriority,
                rotationFamily: contract.rotationFamily,
                outputLabel: contract.outputLabel,
                isSystemManaged: contract.isSystemManaged,
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
export async function syncSubjectContractFromProgramOfferings(schoolId, schoolYearId, authToken) {
    await ensureSubjectContractSchemaColumns();
    await reconcileSubjectContractFromUpstream(schoolId, schoolYearId, authToken);
    const activeSubjects = await prisma.subject.findMany({
        where: { schoolId, isActive: true },
        select: { code: true, name: true, programScopes: true },
        orderBy: { code: 'asc' },
    });
    const signals = await fetchUpstreamProgramSignals(schoolId, schoolYearId, authToken);
    const mirrorPrograms = await fetchMirroredProgramSignals(schoolId, schoolYearId);
    const offeredPrograms = [...signals.offeredPrograms].sort();
    const mirroredPrograms = [...mirrorPrograms].sort();
    const steCodes = new Set(PROGRAM_OVERLAY_CODES.STE);
    const spaCodes = new Set(PROGRAM_OVERLAY_CODES.SPA);
    const spsCodes = new Set(PROGRAM_OVERLAY_CODES.SPS);
    const activeSteSubjects = activeSubjects.filter((subject) => steCodes.has(subject.code));
    const activeSpaSubjects = activeSubjects.filter((subject) => spaCodes.has(subject.code));
    const activeSpsSubjects = activeSubjects.filter((subject) => spsCodes.has(subject.code));
    const activeTleSubjects = activeSubjects.filter((subject) => subject.code.startsWith('TLE_') || subject.code.startsWith(DYNAMIC_TLE_PREFIX) || subject.code === 'TLE');
    return {
        schoolId,
        schoolYearId,
        offeredPrograms,
        mirroredPrograms,
        activeCounts: {
            total: activeSubjects.length,
            ste: activeSteSubjects.length,
            spa: activeSpaSubjects.length,
            sps: activeSpsSubjects.length,
            tle: activeTleSubjects.length,
        },
        activeSubjectCodes: {
            ste: activeSteSubjects.map((subject) => subject.code),
            spa: activeSpaSubjects.map((subject) => subject.code),
            sps: activeSpsSubjects.map((subject) => subject.code),
            tle: activeTleSubjects.map((subject) => subject.code),
        },
    };
}
export async function getSubjectsBySchool(schoolId, filters) {
    await ensureSubjectContractSchemaColumns();
    const subjects = await prisma.subject.findMany({
        where: { schoolId },
        orderBy: [{ isSeedable: 'desc' }, { name: 'asc' }],
    });
    const includeSte = filters?.includeSte ?? true;
    const includeSpa = filters?.includeSpa ?? true;
    // Use stored programScopes; fall back to heuristic inference for legacy rows with empty scopes
    return subjects
        .map((subject) => withSubjectViewMetadata({
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
    await ensureSubjectContractSchemaColumns();
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject)
        return null;
    return withSubjectViewMetadata({
        ...subject,
        programScopes: subject.programScopes.length > 0
            ? subject.programScopes
            : inferSubjectProgramScopes(subject.code, subject.name),
    });
}
export async function createSubject(schoolId, data) {
    await ensureSubjectContractSchemaColumns();
    // Validate inter-section grade levels are within subject's grade levels
    const interGrades = data.interSectionGradeLevels ?? [];
    if (interGrades.length > 0) {
        const invalid = interGrades.filter((g) => !data.gradeLevels.includes(g));
        if (invalid.length > 0) {
            throw Object.assign(new Error(`interSectionGradeLevels contains grades not in subject gradeLevels: ${invalid.join(', ')}`), { statusCode: 400, code: 'INVALID_INTER_SECTION_GRADES' });
        }
    }
    const contract = buildSubjectContractData({
        code: data.code,
        name: data.name,
        modularGroupId: data.modularGroupId ?? null,
        ownerDepartment: data.ownerDepartment,
        qualificationPriority: data.qualificationPriority,
        rotationFamily: data.rotationFamily,
        outputLabel: data.outputLabel,
        isSystemManaged: data.isSystemManaged,
    });
    return prisma.subject.create({
        data: {
            schoolId,
            code: data.code,
            name: data.name,
            minMinutesPerWeek: data.minMinutesPerWeek,
            preferredRoomType: data.preferredRoomType,
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
            ownerDepartment: contract.ownerDepartment,
            qualificationPriority: contract.qualificationPriority,
            rotationFamily: contract.rotationFamily,
            outputLabel: contract.outputLabel,
            isSystemManaged: contract.isSystemManaged,
        },
    });
}
export async function updateSubject(id, data) {
    await ensureSubjectContractSchemaColumns();
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
        if (data.ownerDepartment !== undefined)
            allowed.ownerDepartment = data.ownerDepartment;
        if (data.qualificationPriority !== undefined)
            allowed.qualificationPriority = data.qualificationPriority;
        if (data.rotationFamily !== undefined)
            allowed.rotationFamily = data.rotationFamily;
        if (data.outputLabel !== undefined)
            allowed.outputLabel = data.outputLabel;
        if (data.isSystemManaged !== undefined)
            allowed.isSystemManaged = data.isSystemManaged;
        return prisma.subject.update({ where: { id }, data: allowed });
    }
    const updateData = {};
    if (data.name !== undefined)
        updateData.name = data.name;
    if (data.minMinutesPerWeek !== undefined)
        updateData.minMinutesPerWeek = data.minMinutesPerWeek;
    if (data.preferredRoomType !== undefined)
        updateData.preferredRoomType = data.preferredRoomType;
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
    if (data.ownerDepartment !== undefined)
        updateData.ownerDepartment = data.ownerDepartment;
    if (data.qualificationPriority !== undefined)
        updateData.qualificationPriority = data.qualificationPriority;
    if (data.rotationFamily !== undefined)
        updateData.rotationFamily = data.rotationFamily;
    if (data.outputLabel !== undefined)
        updateData.outputLabel = data.outputLabel;
    if (data.isSystemManaged !== undefined)
        updateData.isSystemManaged = data.isSystemManaged;
    return prisma.subject.update({ where: { id }, data: updateData });
}
export async function deleteSubject(id, options) {
    await ensureSubjectContractSchemaColumns();
    const cleanupAll = options?.cleanupAll === true;
    const cleanupActive = cleanupAll || options?.cleanupActive === true;
    const cleanupHistorical = cleanupAll || options?.cleanupHistorical === true;
    const subject = await prisma.subject.findUnique({
        where: { id },
        select: { id: true, code: true, name: true, isSeedable: true, isActive: true },
    });
    if (!subject) {
        return { success: false, code: 'NOT_FOUND', error: 'Subject not found.' };
    }
    if (subject.isSeedable) {
        return { success: false, code: 'SEEDABLE_SUBJECT', error: 'DepEd standard subjects cannot be deleted.' };
    }
    const assignments = await prisma.facultySubject.findMany({
        where: { subjectId: id },
        select: {
            id: true,
            facultyId: true,
            sectionIds: true,
            faculty: {
                select: {
                    isActiveForScheduling: true,
                    isStale: true,
                },
            },
            sectionOwnerships: { select: { id: true }, take: 1 },
        },
    });
    const activeAssignments = assignments.filter((assignment) => {
        const ownershipRows = assignment.sectionOwnerships;
        const hasOwnedSections = assignment.sectionIds.length > 0 || Boolean(ownershipRows && ownershipRows.length > 0);
        return assignment.faculty.isActiveForScheduling && !assignment.faculty.isStale && hasOwnedSections;
    });
    const historicalAssignments = assignments.filter((assignment) => !activeAssignments.includes(assignment));
    if (activeAssignments.length > 0) {
        const requiresArchiveFirst = cleanupActive && subject.isActive;
        return {
            success: false,
            code: 'ACTIVE_ASSIGNMENTS',
            error: requiresArchiveFirst
                ? 'Archive the subject before running destructive active-assignment cleanup.'
                : 'This subject is still assigned in active teaching loads. Remove active assignments first.',
            details: {
                subjectId: subject.id,
                subjectCode: subject.code,
                subjectName: subject.name,
                activeAssignmentCount: activeAssignments.length,
                historicalAssignmentCount: historicalAssignments.length,
                action: 'REMOVE_ACTIVE_ASSIGNMENTS',
                canCleanupActive: !subject.isActive,
                canCleanupAll: !subject.isActive,
                requiresArchiveFirst,
                teachingLoadPath: `/assignments?subjectId=${subject.id}`,
            },
        };
    }
    if (historicalAssignments.length > 0 && !cleanupHistorical) {
        return {
            success: false,
            code: 'HISTORICAL_ASSIGNMENTS',
            error: 'Historical faculty-subject records still exist. Archive or run explicit cleanup before deleting.',
            details: {
                subjectId: subject.id,
                subjectCode: subject.code,
                subjectName: subject.name,
                historicalAssignmentCount: historicalAssignments.length,
                activeAssignmentCount: 0,
                canCleanupHistorical: true,
                canCleanupAll: !subject.isActive,
                recommendedAction: subject.isActive ? 'ARCHIVE_THEN_CLEANUP' : 'CLEANUP_THEN_DELETE',
                teachingLoadPath: `/assignments?subjectId=${subject.id}`,
            },
        };
    }
    let cleanedHistoricalAssignments = 0;
    await prisma.$transaction(async (tx) => {
        if (cleanupHistorical || cleanupActive) {
            cleanedHistoricalAssignments = await tx.facultySubject.count({ where: { subjectId: id } });
            await tx.subjectSectionOwnership.deleteMany({ where: { subjectId: id } });
            await tx.facultySubject.deleteMany({ where: { subjectId: id } });
        }
        await tx.subject.delete({ where: { id } });
    });
    return {
        success: true,
        deletedSubjectId: id,
        cleanedHistoricalAssignments,
    };
}
export async function getSubjectCountBySchool(schoolId) {
    await ensureSubjectContractSchemaColumns();
    return prisma.subject.count({ where: { schoolId, isActive: true } });
}
export async function getSubjectsWithoutFaculty(schoolId) {
    await ensureSubjectContractSchemaColumns();
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