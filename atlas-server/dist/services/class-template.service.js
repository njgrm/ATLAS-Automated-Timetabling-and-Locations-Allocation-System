/**
 * Class Template Service
 *
 * Manages configurable class templates per school. Each template defines:
 * - The program type (REGULAR, STE, SPA, etc.)
 * - Period structure (period length in minutes, periods per day)
 * - Subject bundle (which subjects belong to this class type)
 *
 * Templates replace the previously hardcoded STE/SPA subject inference.
 * Schools can clone, customize, and extend templates without changing core logic.
 */
import { prisma } from '../lib/prisma.js';
const DEFAULT_TEMPLATE_SPECS = [
    {
        name: 'Regular BEC',
        label: 'Regular',
        programType: 'REGULAR',
        gradeApplicability: [7, 8, 9, 10],
        periodLengthMinutes: 60,
        periodsPerDay: 8,
        isDefault: true,
        subjectCodes: ['FIL', 'ENG', 'MATH', 'AP', 'MAPEH', 'ESP', 'HG', 'SCI_BIO', 'SCI_CHEM', 'SCI_ES', 'TLE_ICT_EXP', 'TLE_AFA_EXP', 'TLE_FCS_EXP'],
    },
    {
        name: 'Science, Technology & Engineering',
        label: 'STE',
        programType: 'STE',
        gradeApplicability: [7, 8, 9, 10],
        periodLengthMinutes: 45,
        periodsPerDay: 10,
        isDefault: false,
        subjectCodes: ['FIL', 'ENG', 'MATH', 'AP', 'MAPEH', 'ESP', 'HG', 'SCI_BIO', 'SCI_CHEM', 'SCI_ES', 'TLE_ICT_EXP', 'TLE_AFA_EXP', 'TLE_FCS_EXP', 'STE_ENV_SCI', 'STE_BIOTECH', 'STE_APPLIED_CHEM', 'STE_APPLIED_PHYS', 'STE_ROBOTICS', 'STE_RESEARCH'],
    },
    {
        name: 'Special Program in the Arts',
        label: 'SPA',
        programType: 'SPA',
        gradeApplicability: [7, 8, 9, 10],
        periodLengthMinutes: 45,
        periodsPerDay: 10,
        isDefault: false,
        subjectCodes: ['FIL', 'ENG', 'MATH', 'AP', 'MAPEH', 'ESP', 'HG', 'SCI_BIO', 'SCI_CHEM', 'SCI_ES', 'TLE_ICT_EXP', 'TLE_AFA_EXP', 'TLE_FCS_EXP', 'SPA_SPEC', 'DEVL_READING'],
    },
    {
        name: 'Special Program in Sports',
        label: 'SPS',
        programType: 'SPS',
        gradeApplicability: [7, 8, 9, 10],
        periodLengthMinutes: 45,
        periodsPerDay: 10,
        isDefault: false,
        subjectCodes: ['FIL', 'ENG', 'MATH', 'AP', 'MAPEH', 'ESP', 'HG', 'SCI_BIO', 'SCI_CHEM', 'SCI_ES', 'TLE_ICT_EXP', 'TLE_AFA_EXP', 'TLE_FCS_EXP', 'SPS_SPEC', 'DEVL_READING'],
    },
];
/**
 * Seed default class templates for a school if they do not exist.
 * Called alongside ensureDefaultSubjects.
 */
export async function ensureDefaultTemplates(schoolId) {
    for (const spec of DEFAULT_TEMPLATE_SPECS) {
        const existing = await prisma.classTemplate.findUnique({
            where: {
                schoolId_programType: { schoolId, programType: spec.programType },
            },
        });
        if (existing) {
            continue;
        }
        // Resolve subject IDs from codes for this school
        const subjects = await prisma.subject.findMany({
            where: { schoolId, code: { in: spec.subjectCodes }, isActive: true },
            select: { id: true, code: true },
        });
        const bindingRows = subjects.map((s) => ({ subjectId: s.id }));
        await prisma.classTemplate.create({
            data: {
                schoolId,
                name: spec.name,
                label: spec.label,
                programType: spec.programType,
                gradeApplicability: spec.gradeApplicability,
                periodLengthMinutes: spec.periodLengthMinutes,
                periodsPerDay: spec.periodsPerDay,
                isActive: true,
                isDefault: spec.isDefault,
                subjectBindings: {
                    create: bindingRows,
                },
            },
        });
    }
}
/**
 * Ensure templates exist for all program types found in fetched sections.
 * Called after section fetch to auto-provision templates for any special program
 * types that EnrollPro returns but don't yet have a template in ATLAS.
 *
 * For known program types (REGULAR, STE, SPA), the full default spec is used.
 * For other/unknown types (SPS, SPJ, SPFL, SPTVE, OTHER), a minimal placeholder
 * template is created with 45-min periods so scheduling doesn't block.
 */
export async function ensureTemplatesForProgramTypes(schoolId, programTypes) {
    const seeded = [];
    const unique = [...new Set(programTypes)];
    for (const programType of unique) {
        const existing = await prisma.classTemplate.findUnique({
            where: { schoolId_programType: { schoolId, programType } },
        });
        if (existing)
            continue;
        // Try matching against the known default spec first
        const spec = DEFAULT_TEMPLATE_SPECS.find((s) => s.programType === programType);
        if (spec) {
            const subjects = await prisma.subject.findMany({
                where: { schoolId, code: { in: spec.subjectCodes } },
                select: { id: true },
            });
            await prisma.classTemplate.create({
                data: {
                    schoolId,
                    name: spec.name,
                    label: spec.label,
                    programType,
                    gradeApplicability: spec.gradeApplicability,
                    periodLengthMinutes: spec.periodLengthMinutes,
                    periodsPerDay: spec.periodsPerDay,
                    isActive: true,
                    isDefault: spec.isDefault,
                    subjectBindings: {
                        create: subjects.map((s) => ({ subjectId: s.id })),
                    },
                },
            });
        }
        else {
            // Unknown / less common program type — seed a minimal placeholder
            // with the same period structure as REGULAR so generation doesn't stall.
            // Officers can customize the template afterward.
            const regularSubjects = await prisma.subject.findMany({
                where: {
                    schoolId,
                    programScopes: { has: 'REGULAR' },
                    isActive: true,
                },
                select: { id: true },
            });
            await prisma.classTemplate.create({
                data: {
                    schoolId,
                    name: programType,
                    label: programType,
                    programType,
                    gradeApplicability: [7, 8, 9, 10],
                    periodLengthMinutes: 45,
                    periodsPerDay: 10,
                    isActive: true,
                    isDefault: false,
                    subjectBindings: {
                        create: regularSubjects.map((s) => ({ subjectId: s.id })),
                    },
                },
            });
        }
        seeded.push(programType);
        console.log(`[class-template] Auto-seeded template for programType=${programType} schoolId=${schoolId}`);
    }
    return { seeded };
}
export async function getTemplatesBySchool(schoolId) {
    const templates = await prisma.classTemplate.findMany({
        where: { schoolId },
        include: {
            subjectBindings: {
                include: {
                    subject: {
                        select: { id: true, code: true, name: true, programScopes: true },
                    },
                },
            },
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return templates.map((t) => ({
        id: t.id,
        schoolId: t.schoolId,
        name: t.name,
        label: t.label,
        programType: t.programType,
        gradeApplicability: t.gradeApplicability,
        periodLengthMinutes: t.periodLengthMinutes,
        periodsPerDay: t.periodsPerDay,
        isActive: t.isActive,
        isDefault: t.isDefault,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        subjects: t.subjectBindings.map((b) => b.subject),
    }));
}
export async function getTemplateById(id) {
    const t = await prisma.classTemplate.findUnique({
        where: { id },
        include: {
            subjectBindings: {
                include: {
                    subject: {
                        select: { id: true, code: true, name: true, programScopes: true },
                    },
                },
            },
        },
    });
    if (!t)
        return null;
    return {
        id: t.id,
        schoolId: t.schoolId,
        name: t.name,
        label: t.label,
        programType: t.programType,
        gradeApplicability: t.gradeApplicability,
        periodLengthMinutes: t.periodLengthMinutes,
        periodsPerDay: t.periodsPerDay,
        isActive: t.isActive,
        isDefault: t.isDefault,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        subjects: t.subjectBindings.map((b) => b.subject),
    };
}
export async function createTemplate(schoolId, data) {
    // Validate: no empty period structure
    if (data.periodLengthMinutes <= 0 || data.periodsPerDay <= 0) {
        throw Object.assign(new Error('periodLengthMinutes and periodsPerDay must be positive integers.'), { statusCode: 400, code: 'INVALID_PERIOD_STRUCTURE' });
    }
    const t = await prisma.classTemplate.create({
        data: {
            schoolId,
            name: data.name,
            label: data.label,
            programType: data.programType,
            gradeApplicability: data.gradeApplicability,
            periodLengthMinutes: data.periodLengthMinutes,
            periodsPerDay: data.periodsPerDay,
            isActive: true,
            isDefault: false,
            subjectBindings: data.subjectIds?.length
                ? { create: data.subjectIds.map((sid) => ({ subjectId: sid })) }
                : undefined,
        },
        include: {
            subjectBindings: {
                include: {
                    subject: { select: { id: true, code: true, name: true, programScopes: true } },
                },
            },
        },
    });
    return {
        id: t.id,
        schoolId: t.schoolId,
        name: t.name,
        label: t.label,
        programType: t.programType,
        gradeApplicability: t.gradeApplicability,
        periodLengthMinutes: t.periodLengthMinutes,
        periodsPerDay: t.periodsPerDay,
        isActive: t.isActive,
        isDefault: t.isDefault,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        subjects: t.subjectBindings.map((b) => b.subject),
    };
}
export async function updateTemplate(id, data) {
    const existing = await prisma.classTemplate.findUnique({ where: { id } });
    if (!existing)
        return null;
    if (data.periodLengthMinutes !== undefined && data.periodLengthMinutes <= 0) {
        throw Object.assign(new Error('periodLengthMinutes must be a positive integer.'), { statusCode: 400, code: 'INVALID_PERIOD_LENGTH' });
    }
    if (data.periodsPerDay !== undefined && data.periodsPerDay <= 0) {
        throw Object.assign(new Error('periodsPerDay must be a positive integer.'), { statusCode: 400, code: 'INVALID_PERIODS_PER_DAY' });
    }
    const updateData = {};
    if (data.name !== undefined)
        updateData.name = data.name;
    if (data.label !== undefined)
        updateData.label = data.label;
    if (data.gradeApplicability !== undefined)
        updateData.gradeApplicability = data.gradeApplicability;
    if (data.periodLengthMinutes !== undefined)
        updateData.periodLengthMinutes = data.periodLengthMinutes;
    if (data.periodsPerDay !== undefined)
        updateData.periodsPerDay = data.periodsPerDay;
    if (data.isActive !== undefined)
        updateData.isActive = data.isActive;
    const t = await prisma.classTemplate.update({
        where: { id },
        data: updateData,
        include: {
            subjectBindings: {
                include: {
                    subject: { select: { id: true, code: true, name: true, programScopes: true } },
                },
            },
        },
    });
    return {
        id: t.id,
        schoolId: t.schoolId,
        name: t.name,
        label: t.label,
        programType: t.programType,
        gradeApplicability: t.gradeApplicability,
        periodLengthMinutes: t.periodLengthMinutes,
        periodsPerDay: t.periodsPerDay,
        isActive: t.isActive,
        isDefault: t.isDefault,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        subjects: t.subjectBindings.map((b) => b.subject),
    };
}
/**
 * Replace the subject bundle for a template.
 * Removes all existing bindings and creates the new set.
 */
export async function setTemplateSubjects(templateId, subjectIds) {
    if (subjectIds.length === 0) {
        throw Object.assign(new Error('A class template must have at least one subject in its bundle.'), { statusCode: 400, code: 'EMPTY_SUBJECT_BUNDLE' });
    }
    await prisma.$transaction([
        prisma.classTemplateSubject.deleteMany({ where: { templateId } }),
        prisma.classTemplateSubject.createMany({
            data: subjectIds.map((subjectId) => ({ templateId, subjectId })),
        }),
    ]);
}
/**
 * Get period profiles for all active templates in a school.
 * Used by the schedule constructor to determine period length per program type.
 */
export async function getTemplatePeriodProfiles(schoolId) {
    const templates = await prisma.classTemplate.findMany({
        where: { schoolId, isActive: true },
        select: { programType: true, periodLengthMinutes: true, periodsPerDay: true },
    });
    return templates.map((t) => ({
        programType: t.programType,
        periodLengthMinutes: t.periodLengthMinutes,
        periodsPerDay: t.periodsPerDay,
    }));
}
/**
 * Get the set of subject IDs that belong to a template for a given program type.
 * Used for subject filtering during demand construction.
 */
export async function getTemplateSubjectIds(schoolId, programType) {
    const template = await prisma.classTemplate.findUnique({
        where: {
            schoolId_programType: { schoolId, programType },
        },
        include: {
            subjectBindings: { select: { subjectId: true } },
        },
    });
    if (!template || !template.isActive)
        return null;
    return new Set(template.subjectBindings.map((b) => b.subjectId));
}
//# sourceMappingURL=class-template.service.js.map