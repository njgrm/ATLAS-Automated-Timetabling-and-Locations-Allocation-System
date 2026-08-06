import type {
	FacultyMirror,
	ManualEditProposal,
	PreviewResult,
	ScheduledEntry,
	Subject,
	Violation,
} from '@/types';

export const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri',
};

export const GRADE_BADGE: Record<number, string> = {
	7: 'bg-green-100 text-green-700 border-green-300',
	8: 'bg-yellow-100 text-yellow-700 border-yellow-300',
	9: 'bg-red-100 text-red-700 border-red-300',
	10: 'bg-blue-100 text-blue-700 border-blue-300',
};

export const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
export type ManualEditActionType = 'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY';

export type ManualEditRoomInfo = {
	id: number;
	name: string;
	buildingId: number;
	buildingName: string;
	buildingShortCode: string | null;
	floor: number;
	type: string;
	capacity?: number | null;
	isTeachingSpace: boolean;
	features: string[];
};

export interface ManualEditPanelProps {
	entry: ScheduledEntry;
	violationIndex: Map<string, Violation[]>;
	followUps: Set<string>;
	onToggleFollowUp: (id: string) => void;
	onClose: () => void;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	gradeForSection: (sectionId: number) => number | null;
	roomLabel: (roomId: number) => string;
	isStaleRoom: (roomId: number) => boolean;
	timeSlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean }>;
	roomMap: Map<number, ManualEditRoomInfo>;
	facultyMap: Map<number, FacultyMirror>;
	subjectMap: Map<number, Subject>;
	draftEntries: ScheduledEntry[];
	onPreview: (proposal: ManualEditProposal) => Promise<PreviewResult | null>;
	onCommit: (proposal: ManualEditProposal, allowSoftOverride: boolean) => Promise<boolean>;
	previewLoading: boolean;
	commitLoading: boolean;
	initialAction?: ManualEditActionType | null;
	onForceOpen: () => void;
}

export function deltaSentence(delta: PreviewResult['violationDelta']): { text: string; color: string } {
	const hardDiff = delta.hardAfter - delta.hardBefore;
	const softDiff = delta.softAfter - delta.softBefore;
	const parts: string[] = [];
	if (hardDiff > 0) parts.push(`adds ${hardDiff} blocking conflict${hardDiff === 1 ? '' : 's'}`);
	else if (hardDiff < 0) parts.push(`removes ${Math.abs(hardDiff)} blocking conflict${Math.abs(hardDiff) === 1 ? '' : 's'}`);
	if (softDiff > 0) parts.push(`adds ${softDiff} warning${softDiff === 1 ? '' : 's'}`);
	else if (softDiff < 0) parts.push(`removes ${Math.abs(softDiff)} warning${Math.abs(softDiff) === 1 ? '' : 's'}`);
	if (parts.length === 0) return { text: 'This change does not add or remove conflicts.', color: 'text-muted-foreground' };
	return {
		text: `This change ${parts.join(' and ')}.`,
		color: hardDiff > 0 ? 'text-red-600' : hardDiff < 0 && softDiff <= 0 ? 'text-green-600' : 'text-amber-600',
	};
}

export function buildOccupiedSlots(
	draftEntries: ScheduledEntry[],
	currentEntryId: string,
	targetDay: string,
	entryFacultyId: number,
	entryRoomId: number,
): Set<string> {
	const occupied = new Set<string>();
	for (const entry of draftEntries) {
		if (entry.entryId === currentEntryId || entry.day !== targetDay) continue;
		if (entry.facultyId === entryFacultyId || entry.roomId === entryRoomId) occupied.add(`${entry.startTime}-${entry.endTime}`);
	}
	return occupied;
}
