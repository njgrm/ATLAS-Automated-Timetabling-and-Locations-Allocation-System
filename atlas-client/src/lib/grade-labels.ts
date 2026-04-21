/**
 * Shared grade label normalization helper.
 * All user-facing grade labels should use "Gx" format (G7, G8, G9, G10).
 */

/** Convert a numeric grade level to its short label */
export function gradeLabel(grade: number): string {
	return `G${grade}`;
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

export const isDepartmentMatch = matchesFacultyDepartment;
