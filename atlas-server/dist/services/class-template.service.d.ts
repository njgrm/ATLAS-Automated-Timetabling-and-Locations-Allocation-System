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
import type { ProgramType } from '@prisma/client';
export interface ClassTemplateWithSubjects {
    id: number;
    schoolId: number;
    name: string;
    label: string;
    programType: ProgramType;
    gradeApplicability: number[];
    periodLengthMinutes: number;
    periodsPerDay: number;
    isActive: boolean;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
    subjects: Array<{
        id: number;
        code: string;
        name: string;
        programScopes: ProgramType[];
    }>;
}
export interface TemplatePeriodProfile {
    programType: ProgramType;
    periodLengthMinutes: number;
    periodsPerDay: number;
}
/**
 * Seed default class templates for a school if they do not exist.
 * Called alongside ensureDefaultSubjects.
 */
export declare function ensureDefaultTemplates(schoolId: number): Promise<void>;
/**
 * Ensure templates exist for all program types found in fetched sections.
 * Called after section fetch to auto-provision templates for any special program
 * types that EnrollPro returns but don't yet have a template in ATLAS.
 *
 * For known program types (REGULAR, STE, SPA), the full default spec is used.
 * For other/unknown types (SPS, SPJ, SPFL, SPTVE, OTHER), a minimal placeholder
 * template is created with 45-min periods so scheduling doesn't block.
 */
export declare function ensureTemplatesForProgramTypes(schoolId: number, programTypes: ProgramType[]): Promise<{
    seeded: ProgramType[];
}>;
export declare function getTemplatesBySchool(schoolId: number): Promise<ClassTemplateWithSubjects[]>;
export declare function getTemplateById(id: number): Promise<ClassTemplateWithSubjects | null>;
export declare function createTemplate(schoolId: number, data: {
    name: string;
    label: string;
    programType: ProgramType;
    gradeApplicability: number[];
    periodLengthMinutes: number;
    periodsPerDay: number;
    subjectIds?: number[];
}): Promise<ClassTemplateWithSubjects>;
export declare function updateTemplate(id: number, data: Partial<{
    name: string;
    label: string;
    gradeApplicability: number[];
    periodLengthMinutes: number;
    periodsPerDay: number;
    isActive: boolean;
}>): Promise<ClassTemplateWithSubjects | null>;
/**
 * Replace the subject bundle for a template.
 * Removes all existing bindings and creates the new set.
 */
export declare function setTemplateSubjects(templateId: number, subjectIds: number[]): Promise<void>;
/**
 * Get period profiles for all active templates in a school.
 * Used by the schedule constructor to determine period length per program type.
 */
export declare function getTemplatePeriodProfiles(schoolId: number): Promise<TemplatePeriodProfile[]>;
/**
 * Get the set of subject IDs that belong to a template for a given program type.
 * Used for subject filtering during demand construction.
 */
export declare function getTemplateSubjectIds(schoolId: number, programType: ProgramType): Promise<Set<number> | null>;
