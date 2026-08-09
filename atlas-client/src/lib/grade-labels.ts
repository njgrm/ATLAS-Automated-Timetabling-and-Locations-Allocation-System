/**
 * Shared grade label normalization helper.
 *
 * Per Decision 5 in `docs/phases/setup-content-area-improvement-plan-2026-08-08.md`:
 * the official compact grade format is `GR{grade}` (e.g. `GR7`, `GR8`, `GR9`, `GR10`).
 * The shorthand `G{grade}` is intentionally absent. The long form is
 * `Grade {grade}` -- use `gradeLong` in `deped-glossary.ts` for explanatory
 * copy where space is not constrained.
 */

/** Convert a numeric grade level to its compact short label (e.g. `GR7`). */
export function gradeLabel(grade: number): string {
	return `GR${grade}`;
}

/** DepEd semantic grade colors */
export const GRADE_COLORS: Record<string, string> = {
	'7': 'bg-green-100/80 text-green-700',
	'8': 'bg-yellow-100/80 text-yellow-700',
	'9': 'bg-red-100/80 text-red-700',
	'10': 'bg-blue-100/80 text-blue-700',
};

export interface DepartmentMatchOptions {
	/**
	 * Explicit non-JHS opt-in for deployments that still classify MTB separately.
	 * JHS flows should keep this disabled.
	 */
	allowNonJhsDepartmentKeywords?: boolean;
	/** @deprecated Use allowNonJhsDepartmentKeywords for explicit non-JHS opt-in. */
	allowMotherTongue?: boolean;
}

/** Department-to-subject keyword mapping for JHS DepEd subjects */
const JHS_DEPT_KEYWORDS: Record<string, string[]> = {
	mathematics: ['math', 'mathematics', 'algebra', 'geometry', 'statistics'],
	science: ['sci', 'science', 'biology', 'chemistry', 'physics', 'earth'],
	english: ['eng', 'english', 'reading', 'literature', 'oral'],
	filipino: ['fil', 'filipino', 'wika'],
	'araling panlipunan': ['ap', 'araling', 'panlipunan', 'social'],
	mapeh: ['mapeh', 'music', 'arts', 'pe', 'physical', 'health'],
	'technology and livelihood education': ['tle', 'technology', 'livelihood', 'cookery', 'ict', 'agri', 'industrial', 'home economics'],
	'edukasyon sa pagpapakatao': ['values', 'edukasyon', 'pagpapakatao', 'esp'],
	'homeroom guidance': ['homeroom', 'guidance'],
};

const NON_JHS_DEPT_KEYWORDS: Record<string, string[]> = {
	'mother tongue-based': ['mother tongue', 'mtb', 'mtb-mle'],
};

const DEPARTMENT_ALIASES: Record<string, string> = {
	'social studies': 'araling panlipunan',
	ap: 'araling panlipunan',
	theology: 'edukasyon sa pagpapakatao',
	'values education': 'edukasyon sa pagpapakatao',
	esp: 'edukasyon sa pagpapakatao',
	tleb: 'technology and livelihood education',
	tle: 'technology and livelihood education',
};

function getDepartmentKeywords(options: DepartmentMatchOptions = {}): Record<string, string[]> {
	const allowNonJhsDepartmentKeywords = options.allowNonJhsDepartmentKeywords || options.allowMotherTongue;
	return allowNonJhsDepartmentKeywords
		? { ...JHS_DEPT_KEYWORDS, ...NON_JHS_DEPT_KEYWORDS }
		: JHS_DEPT_KEYWORDS;
}

function normalizeDepartment(department: string, options: DepartmentMatchOptions = {}): string | null {
	const lowered = department.trim().toLowerCase();
	if (!lowered) {
		return null;
	}

	const departmentKeywords = getDepartmentKeywords(options);

	for (const [alias, canonical] of Object.entries(DEPARTMENT_ALIASES)) {
		if (lowered.includes(alias)) {
			return canonical;
		}
	}

	for (const key of Object.keys(departmentKeywords)) {
		if (lowered.includes(key)) {
			return key;
		}
	}

	return null;
}

/** Determine if a subject matches a faculty member's department specialization */
export function matchesFacultyDepartment(
	department: string | null,
	subjectCode: string,
	subjectName: string,
	options: DepartmentMatchOptions = {},
): boolean {
	const code = subjectCode.toLowerCase();
	const name = subjectName.toLowerCase();

	if (code.includes('homeroom') || name.includes('homeroom guidance') || name.includes('homeroom')) {
		return true;
	}

	if (!department) return false;
	const dept = normalizeDepartment(department, options);
	if (!dept) return false;

	const keywords = getDepartmentKeywords(options)[dept] ?? [];
	if (keywords.length === 0) return false;
	return keywords.some((kw) => code.includes(kw) || name.includes(kw));
}

export type QualificationTier = 1 | 2 | 3 | null;

export interface SpecializationAliasLike {
	alias: string;
	canonical: string;
}

/**
 * Tiered Qualification Matcher (Phase 3 subject-domain reset)
 *
 * For regular-track subjects, department ownership is primary.
 * For SPA/SPS specialization rows, specialization matching is primary.
 *
 * Tier 1: Primary baseline match for the subject family.
 * Tier 2: Secondary fallback match.
 *
 * @param aliases  - Pass the SpecializationAlias catalog fetched from the API.
 *                   When empty or undefined, Tier 1 is skipped and the function
 *                   gracefully falls through to Tier 2/3.
 */
export function getQualificationTier(
	faculty: { specialization: string | null; department: string | null },
	subject: { code: string; name: string; allowedSpecializations?: string[] },
	aliases: SpecializationAliasLike[] = [],
): QualificationTier {
	const allowed = subject.allowedSpecializations ?? [];
	const specializationPrimary = subject.code.startsWith('SPA_') || subject.code.startsWith('SPS_');
	const departmentMatch = matchesFacultyDepartment(faculty.department, subject.code, subject.name);

	let specializationMatch = false;
	if (faculty.specialization && aliases.length > 0) {
		specializationMatch = aliases.some(
			(a) => a.alias === faculty.specialization && a.canonical === subject.code,
		);
	}
	if (!specializationMatch && faculty.specialization && allowed.includes(faculty.specialization)) {
		specializationMatch = true;
	}
	if (!specializationMatch && faculty.department && allowed.includes(faculty.department)) {
		specializationMatch = true;
	}

	if (specializationPrimary) {
		if (specializationMatch) return 1;
		if (departmentMatch) return 2;
	} else {
		if (departmentMatch) return 1;
		if (specializationMatch) return 2;
	}

	return null;
}

export const isDepartmentMatch = matchesFacultyDepartment;
