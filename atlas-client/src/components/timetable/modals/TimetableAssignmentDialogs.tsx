import { History, Users } from 'lucide-react';

import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';
import { formatTime } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { SearchableSelect } from '@/ui/searchable-select';

export function TimetableAssignmentDialogs({ context }: { context: ScheduleReviewDialogsContext }) {
	const {
		showAssignmentPicker, setShowAssignmentPicker, setAssignPickerTarget, assignPickerTarget,
		assignPickerFacultyId, setAssignPickerFacultyId, assignPickerRoomId, setAssignPickerRoomId,
		confirmAssignmentPicker, facultyMap, roomMap, subjectLabel, sectionLabel, DAY_SHORT, setDragItem,
		showEditHistory, setShowEditHistory, editHistory,
	} = context;
	const closeAssignment = () => {
		setShowAssignmentPicker(false);
		setAssignPickerTarget(null);
		setDragItem(null);
	};
	const facultyGroups = Array.from(facultyMap.values()).reduce((groups, faculty) => {
		const label = faculty.department ?? 'Unassigned department';
		const items = groups.get(label) ?? [];
		items.push({ value: String(faculty.id), label: `${faculty.lastName}, ${faculty.firstName}` });
		groups.set(label, items);
		return groups;
	}, new Map<string, Array<{ value: string; label: string }>>());
	const roomGroups = Array.from(roomMap.values()).filter((room) => room.isTeachingSpace).reduce((groups, room) => {
		const label = room.buildingShortCode || room.buildingName;
		const items = groups.get(label) ?? [];
		items.push({ value: String(room.id), label: room.name });
		groups.set(label, items);
		return groups;
	}, new Map<string, Array<{ value: string; label: string }>>());

	return <>
		<Dialog open={showAssignmentPicker} onOpenChange={(open) => { if (!open) closeAssignment(); }}>
			<DialogContent className="max-w-sm">
				<DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="size-4" />Assign teacher and room</DialogTitle><DialogDescription>{assignPickerTarget ? `${subjectLabel(assignPickerTarget.item.subjectId)} for ${sectionLabel(assignPickerTarget.item.sectionId)}, ${DAY_SHORT[assignPickerTarget.day]} ${formatTime(assignPickerTarget.startTime)}` : 'Choose the teacher and room for this session.'}</DialogDescription></DialogHeader>
				<div className="space-y-3"><div className="space-y-1"><label className="text-xs font-medium">Teacher</label><SearchableSelect value={assignPickerFacultyId} onValueChange={setAssignPickerFacultyId} groups={Array.from(facultyGroups, ([label, items]) => ({ label, items }))} placeholder="Choose teacher" /></div><div className="space-y-1"><label className="text-xs font-medium">Room</label><SearchableSelect value={assignPickerRoomId} onValueChange={setAssignPickerRoomId} groups={Array.from(roomGroups, ([label, items]) => ({ label, items }))} placeholder="Choose room" /></div></div>
				<DialogFooter><Button variant="outline" onClick={closeAssignment}>Cancel</Button><Button disabled={!assignPickerFacultyId || !assignPickerRoomId} onClick={() => void confirmAssignmentPicker()}>Preview placement</Button></DialogFooter>
			</DialogContent>
		</Dialog>

		<Dialog open={showEditHistory} onOpenChange={setShowEditHistory}>
			<DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><History className="size-4" />Manual edit history</DialogTitle><DialogDescription>{editHistory.length === 0 ? 'No manual edits have been made on this run.' : `${editHistory.length} edit${editHistory.length === 1 ? '' : 's'} recorded.`}</DialogDescription></DialogHeader><div className="max-h-64 space-y-2 overflow-auto py-2">{editHistory.map((edit) => { const summary = edit.validationSummary as Record<string, number> | null; return <div key={edit.id} className="rounded-md border p-3 text-xs"><div className="flex items-center justify-between gap-2"><Badge variant="outline" className="text-xs">{edit.editType.replaceAll('_', ' ')}</Badge><span className="text-muted-foreground">{new Date(edit.createdAt).toLocaleString()}</span></div>{summary && <p className="mt-1 text-muted-foreground">Blocking: {summary.hardCount ?? 0}, warnings: {summary.softCount ?? 0}</p>}</div>; })}</div><DialogFooter><Button variant="outline" onClick={() => setShowEditHistory(false)}>Close</Button></DialogFooter></DialogContent>
		</Dialog>
	</>;
}
