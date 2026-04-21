import type { UnassignedItem } from '../types';

export type ProgramFilter = 'all' | 'REGULAR' | 'SPECIAL' | 'STE' | 'SPA' | 'SPS' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER';
export type EntryKindFilter = 'all' | 'section' | 'cohort';

type ReviewEntryKind = 'SECTION' | 'COHORT' | undefined;

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