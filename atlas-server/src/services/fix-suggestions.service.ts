/**
 * Fix Suggestions Service
 *
 * Provides deterministic, human-readable fix suggestions for unassigned schedule items.
 * Maps each unassigned reason to a set of actionable suggestions including manual-edit
 * proposals that the frontend can preview before committing.
 */

import { prisma } from '../lib/prisma.js';

/* ─── Types ─── */

type UnassignedReason = 'NO_QUALIFIED_FACULTY' | 'FACULTY_OVERLOADED' | 'NO_AVAILABLE_SLOT' | 'NO_COMPATIBLE_ROOM';
type EntryKind = 'SECTION' | 'COHORT';

type FixActionType =
	| 'ASSIGN_CANDIDATE_FACULTY'
	| 'SUGGEST_COMPATIBLE_ROOM'
	| 'PLACE_NEXT_BEST_SLOT'
	| 'OPEN_POLICY_SUGGESTION'
	| 'CONVERT_TO_FOLLOW_UP';

interface FixSuggestion {
	action: FixActionType;
	label: string;
	description: string;
	proposal?: Record<string, unknown>;
	policyHint?: string;
}

interface UnassignedExplanation {
	reason: UnassignedReason;
	humanLabel: string;
	humanDetail: string;
	impact: 'PUBLISH_BLOCKER' | 'WARNING';
	suggestions: FixSuggestion[];
}

interface UnassignedItemInput {
	sectionId: number;
	subjectId: number;
	gradeLevel: number;
	session: number;
	reason: UnassignedReason;
	entryKind?: EntryKind;
	programType?: string | null;
	programCode?: string | null;
	programName?: string | null;
	cohortCode?: string | null;
	cohortName?: string | null;
	cohortMemberSectionIds?: number[];
	cohortExpectedEnrollment?: number | null;
	adviserId?: number | null;
	adviserName?: string | null;
}

/* ─── Reason label + detail map ─── */

const REASON_INFO: Record<UnassignedReason, { label: string; detail: string }> = {
	NO_QUALIFIED_FACULTY: {
		label: 'No Qualified Faculty',
		detail: 'No teacher is assigned to this subject at this grade level, or all qualified teachers are unavailable at every possible time slot.',
	},
	FACULTY_OVERLOADED: {
		label: 'Faculty Overloaded',
		detail: 'All teachers qualified for this subject have reached their maximum weekly or daily teaching hours.',
	},
	NO_AVAILABLE_SLOT: {
		label: 'No Available Slot',
		detail: 'Every potential time slot for this session causes a hard constraint violation (double-booking or policy breach).',
	},
	NO_COMPATIBLE_ROOM: {
		label: 'No Compatible Room',
		detail: 'The subject requires a specific room type, but no room of that type is available at any possible time.',
	},
};

function describePlacementScope(item: UnassignedItemInput): string {
	if (item.entryKind !== 'COHORT') {
		return 'this section session';
	}

	const cohortLabel = item.cohortCode ?? item.cohortName ?? `Grade ${item.gradeLevel} cohort`;
	const linkedSections = item.cohortMemberSectionIds?.length ?? 0;
	const linkedSectionLabel = linkedSections > 0
		? ` across ${linkedSections} linked section${linkedSections === 1 ? '' : 's'}`
		: '';
	const enrollmentLabel = item.cohortExpectedEnrollment != null
		? ` for ${item.cohortExpectedEnrollment} learners`
		: '';

	return `${cohortLabel}${linkedSectionLabel}${enrollmentLabel}`;
}

function buildReasonInfo(item: UnassignedItemInput) {
	const base = REASON_INFO[item.reason];
	if (item.entryKind !== 'COHORT') {
		return base;
	}

	const scope = describePlacementScope(item);
	if (item.reason === 'NO_QUALIFIED_FACULTY') {
		return {
			label: 'No Qualified Faculty for Cohort',
			detail: `No faculty member is currently tagged to teach this cohortized subject block for ${scope}.`,
		};
	}
	if (item.reason === 'FACULTY_OVERLOADED') {
		return {
			label: 'Cohort Faculty Overloaded',
			detail: `All teachers qualified for ${scope} have already reached their weekly or daily teaching limits.`,
		};
	}
	if (item.reason === 'NO_AVAILABLE_SLOT') {
		return {
			label: 'No Common Cohort Slot',
			detail: `No shared time slot remains available for ${scope} without creating a hard conflict.`,
		};
	}
	if (item.reason === 'NO_COMPATIBLE_ROOM') {
		return {
			label: 'No Room for Cohort Capacity',
			detail: `No teaching room can host ${scope} at an available time while satisfying the required room type.`,
		};
	}

	return base;
}

/* ─── Core function ─── */

export async function getFixSuggestions(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	item: UnassignedItemInput,
): Promise<{ item: UnassignedItemInput; explanation: UnassignedExplanation }> {
	const info = buildReasonInfo(item);
	const suggestions: FixSuggestion[] = [];
	const placementScope = describePlacementScope(item);

	switch (item.reason) {
		case 'NO_QUALIFIED_FACULTY': {
			// Suggest candidate faculty who teach this subject at any grade
			const candidates = await prisma.facultySubject.findMany({
				where: { subjectId: item.subjectId, schoolId },
				include: { faculty: true },
				take: 5,
			});
			if (candidates.length > 0) {
				const names = candidates.map((c) =>
					`${c.faculty.lastName}, ${c.faculty.firstName}`
				).join('; ');
				suggestions.push({
					action: 'ASSIGN_CANDIDATE_FACULTY',
					label: 'Assign Candidate Faculty',
					description: item.entryKind === 'COHORT'
						? `${candidates.length} teacher(s) teach this subject and may cover ${placementScope}: ${names}. Assign one and preview the shared cohort placement.`
						: `${candidates.length} teacher(s) teach this subject at other grade levels: ${names}. You can assign one and place this session.`,
					proposal: {
						editType: 'PLACE_UNASSIGNED',
						sectionId: item.sectionId,
						subjectId: item.subjectId,
						session: item.session,
						targetFacultyId: candidates[0].faculty.id,
					},
				});
			}
			suggestions.push({
				action: 'OPEN_POLICY_SUGGESTION',
				label: 'Open Policy Suggestion',
				description: item.entryKind === 'COHORT'
					? `Consider assigning a qualified teacher who can cover ${placementScope}, or enable the emergency outside-department path.`
					: 'Consider allowing out-of-field assignments or adding qualified faculty in Faculty Assignments.',
				policyHint: item.entryKind === 'COHORT'
					? 'Go to Faculty Assignments to align subject ownership and adviser-backed homeroom support for the linked sections.'
					: 'Go to Faculty Assignments to assign a teacher for this subject + grade level.',
			});
			break;
		}

		case 'FACULTY_OVERLOADED': {
			// Suggest reassigning to a less-loaded faculty member
			const candidates = await prisma.facultySubject.findMany({
				where: { subjectId: item.subjectId, schoolId },
				include: { faculty: true },
				take: 5,
			});
			if (candidates.length > 0) {
				suggestions.push({
					action: 'ASSIGN_CANDIDATE_FACULTY',
					label: 'Assign Candidate Faculty',
					description: item.entryKind === 'COHORT'
						? `Try assigning ${placementScope} to a less-loaded teacher. ${candidates.length} teacher(s) remain qualified.`
						: `Try assigning to a less-loaded teacher. ${candidates.length} teacher(s) are qualified.`,
					proposal: {
						editType: 'PLACE_UNASSIGNED',
						sectionId: item.sectionId,
						subjectId: item.subjectId,
						session: item.session,
					},
				});
			}
			suggestions.push({
				action: 'OPEN_POLICY_SUGGESTION',
				label: 'Increase Hour Limits',
				description: item.entryKind === 'COHORT'
					? `Consider increasing faculty hour limits or redistributing adviser-backed homeroom work so ${placementScope} can be covered.`
					: 'Consider increasing the maxHoursPerWeek or maxTeachingMinutesPerDay for overloaded faculty.',
				policyHint: 'Adjust in Faculty settings or Scheduling Policy.',
			});
			break;
		}

		case 'NO_AVAILABLE_SLOT': {
			suggestions.push({
				action: 'PLACE_NEXT_BEST_SLOT',
				label: 'Place in Next Best Slot',
				description: item.entryKind === 'COHORT'
					? `Attempt to place ${placementScope} in the least-conflicting shared slot. Preview will show which linked sections still block the move.`
					: 'Attempt to place this session in the least-conflicting slot. Preview will show what violations remain.',
				proposal: {
					editType: 'PLACE_UNASSIGNED',
					sectionId: item.sectionId,
					subjectId: item.subjectId,
					session: item.session,
				},
			});
			suggestions.push({
				action: 'OPEN_POLICY_SUGGESTION',
				label: 'Relax Scheduling Policy',
				description: item.entryKind === 'COHORT'
					? `Consider extending the school day or relaxing time-bound constraints so ${placementScope} can share a common slot.`
					: 'Consider extending the school day (latestEndTime) or relaxing consecutive-teaching limits.',
				policyHint: 'Go to Scheduling Policy to adjust time boundaries.',
			});
			break;
		}

		case 'NO_COMPATIBLE_ROOM': {
			// Find rooms of the required type
			const subject = await prisma.subject.findUnique({ where: { id: item.subjectId } });
			const preferredType = subject?.preferredRoomType ?? 'CLASSROOM';

			const compatibleRooms = await prisma.room.findMany({
				where: {
					building: { schoolId },
					type: preferredType,
					isTeachingSpace: true,
				},
				include: { building: { select: { name: true } } },
				take: 5,
			});

			if (compatibleRooms.length > 0) {
				const roomNames = compatibleRooms.map((r) =>
					`${r.name} (${r.building.name})`
				).join('; ');
				suggestions.push({
					action: 'SUGGEST_COMPATIBLE_ROOM',
					label: 'Suggest Compatible Room',
					description: item.entryKind === 'COHORT'
						? `Found ${compatibleRooms.length} ${preferredType} room(s) that may host ${placementScope}: ${roomNames}. Use Preview to confirm capacity and shared availability.`
						: `Found ${compatibleRooms.length} ${preferredType} room(s): ${roomNames}. They may be occupied — use Preview to check.`,
					proposal: {
						editType: 'PLACE_UNASSIGNED',
						sectionId: item.sectionId,
						subjectId: item.subjectId,
						session: item.session,
						targetRoomId: compatibleRooms[0].id,
					},
				});
			} else {
				suggestions.push({
					action: 'SUGGEST_COMPATIBLE_ROOM',
					label: 'No Rooms Available',
					description: item.entryKind === 'COHORT'
						? `No ${preferredType} rooms currently exist that can host ${placementScope}. Consider adding a larger room or revisiting the cohort grouping.`
						: `No ${preferredType} rooms found. Consider adding rooms of this type in the Map Editor, or change the subject's preferred room type.`,
				});
			}
			suggestions.push({
				action: 'OPEN_POLICY_SUGGESTION',
				label: 'Adjust Room Type',
				description: item.entryKind === 'COHORT'
					? `Revisit the required room type or cohort grouping if ${placementScope} can be taught in a more flexible space.`
					: `Change the subject's preferred room type if it can be taught in a regular classroom.`,
				policyHint: 'Go to Subjects to change the preferred room type.',
			});
			break;
		}
	}

	// Always offer follow-up conversion as last resort
	suggestions.push({
		action: 'CONVERT_TO_FOLLOW_UP',
		label: 'Convert to Follow-up',
		description: 'Flag this item for manual follow-up later. It will remain unassigned but tracked.',
	});

	return {
		item,
		explanation: {
			reason: item.reason,
			humanLabel: info.label,
			humanDetail: info.detail,
			impact: 'PUBLISH_BLOCKER',
			suggestions,
		},
	};
}
