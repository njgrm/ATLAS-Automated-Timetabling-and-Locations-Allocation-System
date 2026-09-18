import type { ExternalSection, UnassignedItem } from '../types';

export type ProgramFilter = 'all' | 'REGULAR' | 'SPECIAL' | 'STE' | 'SPA' | 'SPS' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER';
export type EntryKindFilter = 'all' | 'section' | 'cohort';

type ReviewEntryKind = 'SECTION' | 'COHORT' | undefined;

const VALID_JHS_GRADES = new Set([7, 8, 9, 10]);

/**
 * EnrollPro `grade_level_id` is an internal FK and is NOT the academic grade.
 * The current feed uses 17–20 for Grades 7–10; the legacy feed used 5–8.
 * Mirrors the server authority (`normalizeInternalGradeId`) so the client grid
 * resolves the same shape contract the scheduler produced.
 */
const INTERNAL_GRADE_ID_MAP: Record<number, number> = {
	5: 7,
	6: 8,
	7: 9,
	8: 10,
	17: 7,
	18: 8,
	19: 9,
	20: 10,
};

/**
 * Map an actual/display grade number (7–10) or a current-feed internal grade ID
 * (17–20) to a JHS grade number. Returns null for anything else.
 *
 * Only 17–20 are mapped here because `displayOrder` and `gradeLevelName` are
 * expected to carry the actual grade; the ambiguous legacy 5–8 IDs are handled
 * exclusively by `normalizeInternalGradeId` for the `gradeLevelId` field.
 */
export function normalizeJhsGradeNumber(value: unknown): number | null {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(n)) return null;
	if (VALID_JHS_GRADES.has(n)) return n;
	if (n >= 17 && n <= 20) return n - 10;
	return null;
}

/**
 * Normalize an EnrollPro internal `gradeLevelId` to an actual JHS grade.
 * Identical mapping to the server's `normalizeInternalGradeId`.
 */
export function normalizeInternalGradeId(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(n)) return n as number;
	if (n in INTERNAL_GRADE_ID_MAP) return INTERNAL_GRADE_ID_MAP[n];
	if (n >= 7 && n <= 10) return n;
	if (n >= 100) {
		const normalized = n % 100;
		if (normalized >= 1 && normalized <= 12) return normalized;
	}
	return n;
}

/**
 * Extract the academic grade number from an ExternalSection.
 * Priority: gradeLevelName → displayOrder → gradeLevelId.
 * The first two carry the actual grade (with a 17–20 feed fallback); the last
 * is an EnrollPro internal FK and is normalized through the shared mapping.
 * Returns null if no valid JHS grade (7–10) can be determined.
 */
export function resolveSectionGradeNumber(section: ExternalSection): number | null {
	const nameMatch = (section.gradeLevelName ?? '').match(/(\d+)/);
	if (nameMatch) {
		const fromName = normalizeJhsGradeNumber(Number(nameMatch[1]));
		if (fromName != null) return fromName;
	}
	const fromDisplayOrder = normalizeJhsGradeNumber(section.displayOrder);
	if (fromDisplayOrder != null) return fromDisplayOrder;
	const fromGradeId = normalizeJhsGradeNumber(normalizeInternalGradeId(section.gradeLevelId));
	if (fromGradeId != null) return fromGradeId;
	return null;
}

/**
 * Normalize a program type to a canonical value for grade-window matching.
 * Treats null, undefined, empty string, and 'REGULAR' as equivalent (default window).
 */
function normalizeProgramTypeForWindow(programType?: string | null): string {
	const pt = (programType ?? '').trim().toUpperCase();
	if (!pt || pt === 'REGULAR') return '';
	return pt;
}

/**
 * Find the matching grade window for a section's grade and program type.
 * Matching priority:
 *   1. exact grade + exact program type
 *   2. exact grade + REGULAR/default window when section is regular
 *   3. exact grade + no program type (fallback default window)
 * Returns null if no match found.
 */
export function findGradeWindow(
	gradeNumber: number,
	programType: string | null | undefined,
	gradeWindows: Array<{ gradeLevel: number; programType?: string | null; startTime: string; endTime: string }>,
): { startTime: string; endTime: string } | null {
	const normalized = normalizeProgramTypeForWindow(programType);

	// Try exact grade + exact program type
	const exactMatch = gradeWindows.find(
		(w) => w.gradeLevel === gradeNumber && normalizeProgramTypeForWindow(w.programType) === normalized,
	);
	if (exactMatch) return { startTime: exactMatch.startTime, endTime: exactMatch.endTime };

	// Fallback: exact grade + default/empty window
	const defaultMatch = gradeWindows.find(
		(w) => w.gradeLevel === gradeNumber && !normalizeProgramTypeForWindow(w.programType),
	);
	return defaultMatch ? { startTime: defaultMatch.startTime, endTime: defaultMatch.endTime } : null;
}

export function isSpecialProgram(programType?: string | null): boolean {
	return Boolean(programType && programType !== 'REGULAR' && programType !== 'OTHER');
}

export function getProgramBadgeLabel(programType?: string | null, programCode?: string | null): string {
	if (programCode) return programCode;
	if (!programType || programType === 'REGULAR') return 'Regular';
	return programType;
}

export function matchesProgramFilter(programType: string | null | undefined, filter: ProgramFilter): boolean {
	if (filter === 'all') return true;
	if (filter === 'SPECIAL') return isSpecialProgram(programType);
	return (programType ?? 'REGULAR') === filter;
}

export function matchesEntryKindFilter(entryKind: ReviewEntryKind, filter: EntryKindFilter): boolean {
	if (filter === 'all') return true;
	if (filter === 'cohort') return entryKind === 'COHORT';
	return (entryKind ?? 'SECTION') === 'SECTION';
}

function formatCohortScope(item: Pick<UnassignedItem, 'cohortCode' | 'cohortName' | 'cohortMemberSectionIds' | 'cohortExpectedEnrollment'>): string {
	const cohortLabel = item.cohortCode ?? item.cohortName ?? 'this cohort';
	const linkedSections = item.cohortMemberSectionIds?.length ?? 0;
	const linkedSectionLabel = linkedSections > 0
		? ` across ${linkedSections} linked section${linkedSections === 1 ? '' : 's'}`
		: '';
	const enrollmentLabel = item.cohortExpectedEnrollment != null
		? ` for ${item.cohortExpectedEnrollment} learners`
		: '';

	return `${cohortLabel}${linkedSectionLabel}${enrollmentLabel}`;
}

export function getDefaultUnassignedReasonDetail(
	item: Pick<UnassignedItem, 'reason' | 'entryKind' | 'cohortCode' | 'cohortName' | 'cohortMemberSectionIds' | 'cohortExpectedEnrollment'>,
): string {
	if (item.entryKind === 'COHORT') {
		const cohortScope = formatCohortScope(item);
		switch (item.reason) {
			case 'NO_QUALIFIED_FACULTY':
				return `No faculty member is currently tagged to teach this cohortized subject block for ${cohortScope}.`;
			case 'FACULTY_OVERLOADED':
				return `All qualified teachers for ${cohortScope} have already reached their weekly or daily teaching limits.`;
			case 'NO_AVAILABLE_SLOT':
				return `No shared time slot remains available for ${cohortScope} without creating a hard conflict.`;
			case 'NO_COMPATIBLE_ROOM':
				return `No teaching room can host ${cohortScope} at an available time while satisfying the required room type.`;
			default:
				return `This cohortized session could not be placed by the algorithm for ${cohortScope}.`;
		}
	}

	switch (item.reason) {
		case 'NO_QUALIFIED_FACULTY':
			return 'No faculty member is tagged as qualified to teach this subject at this grade level.';
		case 'FACULTY_OVERLOADED':
			return 'All qualified teachers have reached their maximum weekly or daily hours.';
		case 'NO_AVAILABLE_SLOT':
			return 'Every possible time slot already causes a hard conflict.';
		case 'NO_COMPATIBLE_ROOM':
			return 'No room of the required type is available at any open time.';
		default:
			return 'This session could not be placed by the algorithm.';
	}
}