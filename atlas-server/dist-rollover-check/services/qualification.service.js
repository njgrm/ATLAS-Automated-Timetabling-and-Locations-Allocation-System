import { prisma } from '../lib/prisma.js';
export class QualificationService {
    /**
     * Tiered Qualification Matcher (Backend — Alias-Aware)
     *
     * Tier 1 (Explicit): An administrator-defined SpecializationAlias record maps
     *   the faculty's specialization to this subject's code.
     * Tier 2 (Structural): The faculty's specialization/department is in the
     *   subject's allowedSpecializations array (legacy fallback).
     * Tier 3 (Fuzzy): Legacy keyword heuristic.
     */
    static async getQualificationTier(schoolId, faculty, subject) {
        const allowed = (subject.allowedSpecializations ?? []).map((entry) => entry.trim().toLowerCase());
        const normalizedSpecialization = faculty.specialization?.trim().toLowerCase() ?? null;
        const normalizedDepartment = faculty.department?.trim().toLowerCase() ?? null;
        const normalizedSubjectCode = subject.code.trim().toLowerCase();
        // Tier 1: Alias catalog match — administrator-curated source of truth
        if (faculty.specialization) {
            const aliasCandidates = await prisma.specializationAlias.findMany({
                where: {
                    schoolId,
                    canonical: subject.code,
                },
                select: { alias: true },
            });
            const aliasMatch = aliasCandidates.some((entry) => entry.alias.trim().toLowerCase() === normalizedSpecialization);
            if (aliasMatch) {
                return { tier: 1, reason: `Matched via SpecializationAlias: ${faculty.specialization} → ${subject.code}` };
            }
        }
        // Tier 2: allowedSpecializations direct match (structural / legacy)
        if (normalizedSpecialization && allowed.includes(normalizedSpecialization)) {
            return { tier: 2, reason: `Matched via allowedSpecializations (specialization): ${faculty.specialization}` };
        }
        if (normalizedDepartment && allowed.includes(normalizedDepartment)) {
            return { tier: 2, reason: `Matched via allowedSpecializations (department): ${faculty.department}` };
        }
        // Tier 3: Legacy keyword heuristics
        if (faculty.canTeachOutsideDepartment) {
            if (this.matchesLegacyKeywords(faculty.department, subject.code, subject.name)) {
                return { tier: 3, reason: 'Matched via Legacy Keyword Heuristics' };
            }
            return { tier: 3, reason: `Matched via outside-specialization override for ${normalizedSubjectCode}` };
        }
        if (this.matchesLegacyKeywords(faculty.department, subject.code, subject.name)) {
            return { tier: 3, reason: 'Matched via Legacy Keyword Heuristics' };
        }
        return { tier: null, reason: 'No qualification match found' };
    }
    static matchesLegacyKeywords(department, subjectCode, subjectName) {
        if (!department)
            return false;
        const code = subjectCode.toLowerCase();
        const name = subjectName.toLowerCase();
        if (code.includes('homeroom') || name.includes('homeroom guidance') || name.includes('homeroom')) {
            return true;
        }
        const JHS_DEPT_KEYWORDS = {
            'MATHEMATICS': ['math', 'math.', 'mth', 'algebra', 'geometry', 'statistics'],
            'SCIENCE': ['sci', 'sci.', 'biology', 'physics', 'chemistry'],
            'ENGLISH': ['eng', 'eng.', 'english', 'reading', 'writing'],
            'FILIPINO': ['fil', 'fil.', 'filipino', 'wika', 'panitikan'],
            'ARALING PANLIPUNAN': ['ap', 'a.p.', 'socsci', 'history', 'geography'],
            'MAPEH': ['mapeh', 'm.a.p.e.h.', 'pe', 'p.e.', 'music', 'arts', 'health'],
            'TLE': ['tle', 't.l.e.', 'ict', 'agriculture', 'livelihood'],
            'ESP': ['esp', 'e.s.p.', 'values', 'edukasyon sa pagpapakatao']
        };
        const normalizedDept = department.toUpperCase();
        const keywords = JHS_DEPT_KEYWORDS[normalizedDept] ?? [];
        return keywords.some(kw => code.includes(kw) || name.includes(kw));
    }
}
