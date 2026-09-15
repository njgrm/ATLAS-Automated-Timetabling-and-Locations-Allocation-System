import type { RoomScheduleView, RoomScheduleEntry } from '@/types';
import type { ViewMode, SectionInfo } from './schedule-types';
import { DAY_SHORT } from './schedule-types';
import { MAX_ACADEMIC_TERM_INDEX } from '@/lib/academic-term';

/** Mirrors the server `exportFileStem` year token byte-for-byte. */
function exportYearToken(yearLabel: string | null | undefined): string {
	const value = (yearLabel ?? '').trim();
	return value.length > 0 ? `SY${value.replace(/[^a-zA-Z0-9-]/g, '')}` : 'SY-UNLABELED';
}

export type RoomProgramExportRequest = {
	url: string;
	filename: string;
	termIndex: number;
};

/**
 * BENEFICIARY-EXPORT-PARITY-C05 T7/T9/M11/M18 — resolve the official
 * server-generated room program download. Returns `null` (zero dispatch) when
 * the run or the selected term is unresolved, so the control can never request a
 * mixed-term or unscoped official output.
 */
export function resolveRoomProgramExportRequest(target: {
	schoolId: number | null;
	schoolYearId: number | null;
	runId: number | null;
	termFilter: 'all' | number;
	roomId?: number | null;
	yearLabel?: string | null;
}): RoomProgramExportRequest | null {
	const { schoolId, schoolYearId, runId } = target;
	if (!Number.isInteger(schoolId) || (schoolId ?? 0) <= 0) return null;
	if (!Number.isInteger(schoolYearId) || (schoolYearId ?? 0) <= 0) return null;
	if (!Number.isInteger(runId) || (runId ?? 0) <= 0) return null;
	const term = target.termFilter;
	if (typeof term !== 'number' || !Number.isInteger(term) || term < 1 || term > MAX_ACADEMIC_TERM_INDEX) return null;

	const roomScoped = Number.isInteger(target.roomId) && (target.roomId ?? 0) > 0;
	const roomToken = roomScoped ? String(target.roomId) : 'ALL';
	const roomParam = roomScoped ? `&roomId=${roomToken}` : '';
	return {
		url: `/api/v1/generation/${schoolId}/${schoolYearId}/runs/${runId}/export/room-program.xlsx?termIndex=${term}${roomParam}`,
		filename: `room-program-${roomToken}-${exportYearToken(target.yearLabel)}-term${term}.xlsx`,
		termIndex: term,
	};
}

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
