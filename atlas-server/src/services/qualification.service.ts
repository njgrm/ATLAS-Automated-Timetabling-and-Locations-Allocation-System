import { prisma } from '../lib/prisma.js';

export type QualificationTier = 1 | 2 | 3 | null;

export interface QualificationResult {
	tier: QualificationTier;
	reason: string;
}

export class QualificationService {
	/**
	 * Tiered Qualification Matcher (Backend Implementation)
	 * Tier 1: Explicit Specialization match (Source of Truth)
	 * Tier 2: Structural Department match
	 * Tier 3: Fuzzy Keyword match (Smart Suggestion via SpecializationAlias)
	 */
	static async getQualificationTier(
		schoolId: number,
		faculty: { specialization: string | null; department: string | null },
		subject: { code: string; name: string; allowedSpecializations?: string[] }
	): Promise<QualificationResult> {
		const allowed = subject.allowedSpecializations ?? [];

		// Tier 1: Explicit Specialization Match
		if (faculty.specialization && allowed.includes(faculty.specialization)) {
			return { tier: 1, reason: `Matched via Explicit Specialization: ${faculty.specialization}` };
		}

		// Tier 2: Structural Department Match
		if (faculty.department && allowed.includes(faculty.department)) {
			return { tier: 2, reason: `Matched via Structural Department: ${faculty.department}` };
		}

		// Tier 3: Fuzzy Match via SpecializationAlias (Dynamic Synonyms)
		const aliases = await prisma.specializationAlias.findMany({
			where: { schoolId }
		});

		const facultySpecs = new Set<string>();
		if (faculty.specialization) facultySpecs.add(faculty.specialization);
		if (faculty.department) facultySpecs.add(faculty.department);

		// Find if any faculty spec/dept is an alias for a canonical name that is allowed
		for (const alias of aliases) {
			if (facultySpecs.has(alias.alias) && allowed.includes(alias.canonical)) {
				return { tier: 3, reason: `Matched via Specialization Alias: ${alias.alias} -> ${alias.canonical}` };
			}
		}

		// Fallback Tier 3: Legacy Keyword Matching (to be phased out)
		if (this.matchesLegacyKeywords(faculty.department, subject.code, subject.name)) {
			return { tier: 3, reason: 'Matched via Legacy Keyword Heuristics' };
		}

		return { tier: null, reason: 'No qualification match found' };
	}

	private static matchesLegacyKeywords(department: string | null, subjectCode: string, subjectName: string): boolean {
		if (!department) return false;
		const code = subjectCode.toLowerCase();
		const name = subjectName.toLowerCase();

		if (code.includes('homeroom') || name.includes('homeroom guidance') || name.includes('homeroom')) {
			return true;
		}

		const JHS_DEPT_KEYWORDS: Record<string, string[]> = {
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
