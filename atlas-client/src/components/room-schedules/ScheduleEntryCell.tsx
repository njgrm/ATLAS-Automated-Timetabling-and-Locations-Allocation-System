import type { RoomScheduleEntry } from '@/types';
import { GradeLevelBadge } from '@/components/GradeLevelBadge';
import type { ViewMode, SectionInfo } from './schedule-types';

export function EntryCell({
	entry,
	viewMode,
	subjectMap,
	facultyMap,
	sectionMap,
	roomMap,
}: {
	entry: RoomScheduleEntry;
	viewMode: ViewMode;
	subjectMap: Map<number, string>;
	facultyMap: Map<number, string>;
	sectionMap: Map<number, SectionInfo>;
	roomMap: Map<number, string>;
}) {
	const sectionInfo = sectionMap.get(entry.sectionId);
	const sectionLabel = sectionInfo?.name ?? 'Section not listed';
	const facultyLabel = entry.facultyId != null
		? (facultyMap.get(entry.facultyId) ?? 'Teacher not listed')
		: 'Unassigned teacher';
	const roomLabel = entry.roomId != null
		? (roomMap.get(entry.roomId) ?? 'Room not listed')
		: '—';

	return (
		<div className="px-1.5 py-1 text-xs leading-snug">
			<div className="font-semibold text-foreground truncate">
				{entry.subjectDisplayLabel ?? subjectMap.get(entry.subjectId) ?? 'Subject not listed'}
			</div>
			{viewMode === 'rooms' && (
				<>
					<div className="flex items-center gap-1 min-w-0">
						<GradeLevelBadge grade={sectionInfo?.gradeLevel ?? null} size="xs" />
						<span className="text-muted-foreground truncate">{sectionLabel}</span>
					</div>
					<div className="text-muted-foreground/80 truncate">{facultyLabel}</div>
				</>
			)}
			{viewMode === 'teachers' && (
				<>
					<div className="flex items-center gap-1 min-w-0">
						<GradeLevelBadge grade={sectionInfo?.gradeLevel ?? null} size="xs" />
						<span className="text-muted-foreground truncate">{sectionLabel}</span>
					</div>
					<div className="text-muted-foreground/80 truncate">{roomLabel}</div>
				</>
			)}
			{viewMode === 'sections' && (
				<>
					<div className="text-muted-foreground truncate">{facultyLabel}</div>
					<div className="text-muted-foreground/80 truncate">{roomLabel}</div>
				</>
			)}
		</div>
	);
}
