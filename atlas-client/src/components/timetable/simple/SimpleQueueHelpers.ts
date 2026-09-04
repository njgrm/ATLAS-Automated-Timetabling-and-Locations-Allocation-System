import { getUnassignedStatus } from '@/components/timetable/GeneratedUnassignedPanel';
import type { LeftRailContentContext } from '@/components/timetable/timetableContexts.types';
import type { DraftQueueItem, UnassignedItem } from '@/types';

export type QueueStatus = ReturnType<typeof getUnassignedStatus>;

export function statusRank(status: QueueStatus) {
	if (status.key === 'ready') return 0;
	if (status.key === 'needs-room') return 1;
	if (status.key === 'needs-owner') return 2;
	return 3;
}

export function sameUnassignedItem(a: UnassignedItem | null, b: UnassignedItem | null) {
	if (!a || !b) return false;
	return a.sectionId === b.sectionId
		&& a.subjectId === b.subjectId
		&& a.session === b.session
		&& (a.cohortCode ?? '') === (b.cohortCode ?? '');
}

export type DraftQueueStatus = {
	key: 'ready' | 'needs-owner' | 'needs-room' | 'blocked';
	label: string;
	actionLabel: string;
	className: string;
};

export function getDraftQueueStatus(
	item: DraftQueueItem,
	roomMap?: LeftRailContentContext['roomMap'],
): DraftQueueStatus {
	if (item.hasNoTeacher || item.facultyOptions.length === 0) {
		return {
			key: 'needs-owner',
			label: 'Needs owner',
			actionLabel: 'Fix owner',
			className: 'border-amber-200 bg-amber-50 text-amber-800',
		};
	}
	const rooms = roomMap ? Array.from(roomMap.values()).filter((room) => room.isTeachingSpace) : [];
	const hasPreferredRoom = rooms.some((room) => room.type === item.preferredRoomType);
	const hasFallbackRoom = rooms.length > 0;
	if (!item.preferredRoomType || !hasFallbackRoom || !hasPreferredRoom) {
		return {
			key: 'needs-room',
			label: 'Needs room',
			actionLabel: 'Choose room',
			className: 'border-sky-200 bg-sky-50 text-sky-800',
		};
	}
	return {
		key: 'ready',
		label: 'Ready to place',
		actionLabel: 'Place',
		className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
	};
}

export function draftStatusRank(status: DraftQueueStatus) {
	if (status.key === 'ready') return 0;
	if (status.key === 'needs-room') return 1;
	if (status.key === 'needs-owner') return 2;
	return 3;
}

export type RowReasonStack = {
	mainIssue: string;
	firstFix: string;
	explanation: string;
};

const BLOCKER_TO_ROW_REASON: Record<string, { mainIssue: string; explanation: string }> = {
	NO_AVAILABLE_SLOT: { mainIssue: 'No available slot', explanation: 'ATLAS cannot test slots until this is resolved.' },
	FACULTY_OVERLOADED: { mainIssue: 'Teacher overloaded', explanation: 'Teacher workload is full. Move or reassign classes.' },
	NO_QUALIFIED_FACULTY: { mainIssue: 'No qualified teacher', explanation: 'No qualified teacher is assigned. Build or repair Teaching Load.' },
	NO_COMPATIBLE_ROOM: { mainIssue: 'No compatible room', explanation: 'No compatible room was found. Review room setup.' },
	ROOM_CAPACITY_EXCEEDED: { mainIssue: 'Room too small', explanation: 'The room is too small for this class. Choose a larger room.' },
};

export function deriveRowReasonStack(
	status: { key: string; label: string; actionLabel: string },
	blockerReason?: string | null,
): RowReasonStack | null {
	if (status.key === 'ready') return null;

	const blockerInfo = blockerReason ? BLOCKER_TO_ROW_REASON[blockerReason] : null;
	const mainIssue = blockerInfo?.mainIssue ?? null;
	const firstFix = status.actionLabel;
	const explanation = blockerInfo?.explanation ?? (
		status.key === 'needs-room' ? 'A room must be chosen before slot testing can continue.'
			: status.key === 'needs-owner' ? 'A Teaching Load owner must be fixed before placement.'
			: 'This session needs review before it can be placed.'
	);

	return { mainIssue: mainIssue ?? 'Needs attention', firstFix, explanation };
}

export function sameDraftQueueItem(a: DraftQueueItem | null, b: DraftQueueItem | null) {
	if (!a || !b) return false;
	return a.assignmentKey === b.assignmentKey && a.sessionNumber === b.sessionNumber;
}

export function draftQueueKey(item: DraftQueueItem) {
	return `${item.assignmentKey}-${item.sessionNumber}`;
}