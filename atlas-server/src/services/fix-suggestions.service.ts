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

/* ─── Core function ─── */

export async function getFixSuggestions(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	item: UnassignedItemInput,
): Promise<{ item: UnassignedItemInput; explanation: UnassignedExplanation }> {
	const info = REASON_INFO[item.reason];
	const suggestions: FixSuggestion[] = [];

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
					description: `${candidates.length} teacher(s) teach this subject at other grade levels: ${names}. You can assign one and place this session.`,
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
				description: 'Consider allowing out-of-field assignments or adding qualified faculty in Faculty Assignments.',
				policyHint: 'Go to Faculty Assignments to assign a teacher for this subject + grade level.',
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
					description: `Try assigning to a less-loaded teacher. ${candidates.length} teacher(s) are qualified.`,
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
				description: 'Consider increasing the maxHoursPerWeek or maxTeachingMinutesPerDay for overloaded faculty.',
				policyHint: 'Adjust in Faculty settings or Scheduling Policy.',
			});
			break;
		}

		case 'NO_AVAILABLE_SLOT': {
			suggestions.push({
				action: 'PLACE_NEXT_BEST_SLOT',
				label: 'Place in Next Best Slot',
				description: 'Attempt to place this session in the least-conflicting slot. Preview will show what violations remain.',
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
				description: 'Consider extending the school day (latestEndTime) or relaxing consecutive-teaching limits.',
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
					description: `Found ${compatibleRooms.length} ${preferredType} room(s): ${roomNames}. They may be occupied — use Preview to check.`,
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
					description: `No ${preferredType} rooms found. Consider adding rooms of this type in the Map Editor, or change the subject's preferred room type.`,
				});
			}
			suggestions.push({
				action: 'OPEN_POLICY_SUGGESTION',
				label: 'Adjust Room Type',
				description: `Change the subject's preferred room type if it can be taught in a regular classroom.`,
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
