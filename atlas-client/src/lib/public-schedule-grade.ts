function parseJuniorHighGrade(value: string | null | undefined): number | null {
	if (!value) return null;
	const match = value.match(/(?:grade\s*)?(7|8|9|10)\b/i);
	return match ? Number(match[1]) : null;
}

export function resolvePublicSectionGrade(
	gradeLevel: number | null | undefined,
	gradeLevelName: string | null | undefined,
	sectionName: string | null | undefined,
): number | null {
	if (gradeLevel != null && Number.isInteger(gradeLevel) && gradeLevel >= 7 && gradeLevel <= 10) {
		return gradeLevel;
	}
	return parseJuniorHighGrade(gradeLevelName) ?? parseJuniorHighGrade(sectionName);
}
