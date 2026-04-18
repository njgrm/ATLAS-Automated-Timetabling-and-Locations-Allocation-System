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

/** Department-to-subject keyword mapping for JHS DepEd subjects */
const DEPT_KEYWORDS: Record<string, string[]> = {
	mathematics: ['math'],
	science: ['sci', 'science'],
	english: ['eng', 'english'],
	filipino: ['fil', 'filipino'],
	'social studies': ['ap', 'araling', 'social'],
	mapeh: ['mapeh', 'music', 'arts', 'pe', 'health'],
	tle: ['tle', 'technology', 'livelihood'],
	'values education': ['values', 'edukasyon', 'esp'],
};

/** Determine if a subject matches a faculty member's department specialization */
export function isDepartmentMatch(
	department: string | null,
	subjectCode: string,
	subjectName: string,
): boolean {
	if (!department) return true; // no department = treat all as primary
	const dept = department.toLowerCase();
	const code = subjectCode.toLowerCase();
	const name = subjectName.toLowerCase();

	// Special case: Homeroom Guidance matches all departments
	if (code.includes('homeroom') || name.includes('homeroom')) return true;

	const keywords = Object.entries(DEPT_KEYWORDS)
		.filter(([key]) => dept.includes(key))
		.flatMap(([, vals]) => vals);

	if (keywords.length === 0) return true; // unknown department = treat all as primary
	return keywords.some((kw) => code.includes(kw) || name.includes(kw));
}
