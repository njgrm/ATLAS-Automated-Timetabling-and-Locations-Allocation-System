import { prisma } from '../lib/prisma.js';

export type QualificationTier = 1 | 2 | 3 | null;

export interface QualificationResult {
	tier: QualificationTier;
	reason: string;
}

export class QualificationService {
	/**
	 * Tiered Qualification Matcher (Backend Implementation)
	 * Tier 1: Explicitly Mapped Specialization (Administrator-defined in Specialization Mapping)
	 * Tier 2: Direct Specialization/Department Match (Fallback to subject.allowedSpecializations)
	 * Tier 3: Fuzzy Keyword match (Legacy fallback)
	 */
	static async getQualificationTier(
		schoolId: number,
		faculty: { specialization: string | null; department: string | null },
		subject: { code: string; name: string; allowedSpecializations?: string[] }
	): Promise<QualificationResult> {
		// Tier 1: Explicitly Mapped Specialization (from specialization_aliases table)
		if (faculty.specialization) {
			const mappings = await prisma.specializationAlias.findMany({
				where: { 
					schoolId,
					alias: faculty.specialization,
					canonical: subject.code
				}
			});
			if (mappings.length > 0) {
				return { tier: 1, reason: `Matched via Explicit Mapping: ${faculty.specialization} -> ${subject.code}` };
			}
		}

		const allowed = subject.allowedSpecializations ?? [];

		// Tier 2: Direct Specialization/Department Match (via subject.allowedSpecializations array)
		if (faculty.specialization && allowed.includes(faculty.specialization)) {
			return { tier: 2, reason: `Matched via Subject Allowed Specialization: ${faculty.specialization}` };
		}
		if (faculty.department && allowed.includes(faculty.department)) {
			return { tier: 2, reason: `Matched via Subject Allowed Department: ${faculty.department}` };
		}

		// Tier 3: Legacy Keyword Matching (Fuzzy fallback)
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
