import { CheckCircle2, Clock, FileEdit, HelpCircle, XCircle } from 'lucide-react';

import type {
	DayOfWeek,
	FacultyRoomPreferenceEntry,
	RoomPreferenceActionType,
	RoomPreferenceDecisionStatus,
	RoomPreferenceStatus,
	Room,
	TutorialStep,
} from '@/types';
import { Badge } from '@/ui/badge';

export type RoomOption = Room & { buildingName: string };

export const ACTION_LABELS: Record<RoomPreferenceActionType, string> = {
	ROOM_CHANGE: 'Room change only',
	MOVE_TO_EMPTY_SLOT: 'Move to empty slot',
	SWAP_WITH_OCCUPIED: 'Swap with occupied slot',
	TIME_AND_ROOM_CHANGE: 'Time + room change',
};

export const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

export const FACULTY_ROOM_TUTORIAL_STEPS: TutorialStep[] = [
	{
		target: '[data-tutorial="room-step-guidance"]',
		title: 'Follow The 3 Steps',
		content: 'Start from Step 1, then move forward to submit. The page keeps you focused on one action at a time.',
	},
	{
		target: '[data-tutorial="context-toggle"]',
		title: 'Simple View First',
		content: 'You will first see only what you need. Turn on full schedule context only when you need more details.',
	},
	{
		target: '[data-tutorial="my-classes-panel"]',
		title: 'Pick Your Class',
		content: 'Choose your class first. This tells the system which class you are requesting to move.',
	},
	{
		target: '[data-tutorial="target-slot-map"]',
		title: 'Choose New Time Slot',
		content: 'Click a free slot to move. Click an occupied slot to request a swap.',
	},
	{
		target: '[data-tutorial="room-picker-modes"]',
		title: 'Choose Room Your Way',
		content: 'When the request panel opens, you can pick a room using list, building, or map view.',
	},
];

export function statusBadge(status: RoomPreferenceStatus | null, decision: RoomPreferenceDecisionStatus | null) {
	if (decision === 'APPROVED') return <Badge variant='success' className='text-xs h-5 px-1.5 gap-1'><CheckCircle2 className='size-3' /> Approved</Badge>;
	if (decision === 'REJECTED') return <Badge variant='destructive' className='text-xs h-5 px-1.5 gap-1'><XCircle className='size-3' /> Rejected</Badge>;
	if (status === 'SUBMITTED') return <Badge variant='default' className='text-xs h-5 px-1.5 gap-1'><Clock className='size-3' /> Pending</Badge>;
	if (status === 'DRAFT') return <Badge variant='secondary' className='text-xs h-5 px-1.5 gap-1'><FileEdit className='size-3' /> Draft</Badge>;
	return <Badge variant='outline' className='text-xs h-5 px-1.5 text-muted-foreground/60 gap-1'><HelpCircle className='size-3' /> No request</Badge>;
}

export function isEntryDirty(current: FacultyRoomPreferenceEntry, initial?: FacultyRoomPreferenceEntry) {
	return (initial?.requestedRoomId ?? null) !== (current.requestedRoomId ?? null)
		|| (initial?.rationale ?? '') !== (current.rationale ?? '');
}

export function applyRoomSelection(entries: FacultyRoomPreferenceEntry[], entryId: string, room: RoomOption) {
	return entries.map((entry) => entry.entryId === entryId
		? {
			...entry,
			requestedRoomId: room.id,
			requestedRoomName: `${room.name} · ${room.buildingName}`,
		}
		: entry);
}

export function slotKey(day: string, startTime: string, endTime: string) {
	return `${day}|${startTime}|${endTime}`;
}
