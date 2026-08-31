import type { RoomScheduleView, RoomScheduleEntry } from '@/types';
import type { ViewMode, SectionInfo } from './schedule-types';
import { DAY_SHORT } from './schedule-types';

export function exportScheduleToCsv(
	view: RoomScheduleView,
	viewMode: ViewMode,
	selectedName: string,
	subjectMap: Map<number, string>,
	facultyMap: Map<number, string>,
	sectionMap: Map<number, SectionInfo>,
	roomMap: Map<number, string>,
): void {
	const rows: string[] = ['Day,Time,Subject,Section,Teacher,Room,Conflict'];

	for (const day of view.days) {
		const dayLabel = DAY_SHORT[day] ?? day;
		for (const row of view.grid) {
			const dayIdx = view.days.indexOf(day);
			const cell = row.cells[dayIdx];
			if (!cell.occupied || cell.entries.length === 0) continue;

			for (const entry of cell.entries) {
				const subject = entry.subjectDisplayLabel ?? subjectMap.get(entry.subjectId) ?? 'Subject not listed';
				const section = sectionMap.get(entry.sectionId)?.name ?? 'Section not listed';
				const teacher = entry.facultyId != null
					? (facultyMap.get(entry.facultyId) ?? 'Teacher not listed')
					: 'Unassigned';
				const room = entry.roomId != null
					? (roomMap.get(entry.roomId) ?? 'Room not listed')
					: '—';
				const conflict = cell.conflict ? 'Yes' : 'No';
				const time = row.timeSlot.eventLabel
					? row.timeSlot.eventLabel
					: `${row.timeSlot.startTime}–${row.timeSlot.endTime}`;

				rows.push(`${dayLabel},"${time}","${subject}","${section}","${teacher}","${room}",${conflict}`);
			}
		}
	}

	const csv = rows.join('\n');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	const safeName = selectedName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
	link.href = url;
	link.download = `schedule-${viewMode}-${safeName}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}
