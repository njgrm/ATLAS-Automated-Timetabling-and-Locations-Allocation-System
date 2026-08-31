import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';

import { formatTime } from '@/lib/utils';
import type { RoomScheduleView, RoomScheduleEntry } from '@/types';
import { Badge } from '@/ui/badge';
import { EntryCell } from './ScheduleEntryCell';
import type { ViewMode, SectionInfo, ConflictClickHandler, ScheduleGridSharedProps } from './schedule-types';
import { DAY_SHORT } from './schedule-types';

type CellRender = {
	entries: RoomScheduleEntry[];
	conflict: boolean;
	rowSpan: number;
} | null;

function computeSpanData(view: RoomScheduleView): CellRender[][] {
	const { grid, days } = view;
	const rowCount = grid.length;
	const dayCount = days.length;

	const result: CellRender[][] = Array.from({ length: rowCount }, () =>
		Array(dayCount).fill(null) as CellRender[],
	);

	for (let dayIdx = 0; dayIdx < dayCount; dayIdx++) {
		let skipUntilRow = -1;

		for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
			if (rowIdx < skipUntilRow) {
				result[rowIdx][dayIdx] = null;
				continue;
			}

			const cell = grid[rowIdx].cells[dayIdx];

			if (!cell.occupied) {
				result[rowIdx][dayIdx] = { entries: [], conflict: false, rowSpan: 1 };
				continue;
			}

			const entryIds = new Set(cell.entries.map((e) => e.entryId));
			let span = 1;

			for (let nextRow = rowIdx + 1; nextRow < rowCount; nextRow++) {
				const nextCell = grid[nextRow].cells[dayIdx];
				if (!nextCell.occupied) break;
				const nextIds = nextCell.entries.map((e) => e.entryId);
				if (nextIds.length !== entryIds.size) break;
				if (!nextIds.every((id) => entryIds.has(id))) break;
				span++;
			}

			result[rowIdx][dayIdx] = {
				entries: cell.entries,
				conflict: cell.conflict,
				rowSpan: span,
			};

			if (span > 1) skipUntilRow = rowIdx + span;
		}
	}

	return result;
}

export function ScheduleTimetableGrid({
	view,
	viewMode,
	subjectMap,
	facultyMap,
	sectionMap,
	roomMap,
	onConflictClick,
}: ScheduleGridSharedProps & {
	view: RoomScheduleView;
	onConflictClick?: ConflictClickHandler;
}) {
	const spanData = useMemo(() => computeSpanData(view), [view]);

	return (
		<table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
			<colgroup>
				<col className="w-24" />
				{view.days.map((d) => (
					<col key={d} />
				))}
			</colgroup>
			<thead className="sticky top-0 z-10 bg-background">
				<tr>
					<th className="sticky left-0 z-20 bg-background border-b-2 border-r px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Time
					</th>
					{view.days.map((d) => (
						<th
							key={d}
							className="border-b-2 px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
						>
							{DAY_SHORT[d] ?? d}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{view.grid.map((row, rowIdx) => (
					<tr key={rowIdx}>
						<td className="sticky left-0 z-5 bg-background border-r border-b px-2 py-3 align-middle w-24">
							{row.timeSlot.eventLabel ? (
								<div className="text-xs font-bold text-foreground">
									{row.timeSlot.eventLabel}
								</div>
							) : (
								<div className="text-xs font-semibold text-foreground">
									{formatTime(row.timeSlot.startTime)}–{formatTime(row.timeSlot.endTime)}
								</div>
							)}
						</td>

						{spanData[rowIdx].map((cellData, dayIdx) => {
							if (cellData === null) return null;

							if (cellData.entries.length === 0) {
								return (
									<td
										key={dayIdx}
										rowSpan={cellData.rowSpan}
										className="border-b border-r last:border-r-0 px-1 py-1"
									/>
								);
							}

							const firstGrade = cellData.entries.length > 0
								? sectionMap.get(cellData.entries[0].sectionId)?.gradeLevel ?? null
								: null;
							let baseCellClass = 'bg-primary/5 border-primary/20';
							if (firstGrade === 7) baseCellClass = 'bg-green-50 border-green-200';
							else if (firstGrade === 8) baseCellClass = 'bg-yellow-50 border-yellow-200';
							else if (firstGrade === 9) baseCellClass = 'bg-red-50 border-red-200';
							else if (firstGrade === 10) baseCellClass = 'bg-blue-50 border-blue-200';

							return (
								<td
									key={dayIdx}
									rowSpan={cellData.rowSpan}
									className={`border-b border-r last:border-r-0 px-1 py-0.5 align-top transition-colors ${
										cellData.conflict
											? 'bg-red-50 border-red-200 cursor-pointer hover:bg-red-100'
											: baseCellClass
									}`}
									onClick={cellData.conflict && onConflictClick ? () => {
										const timeSlot = view.grid[rowIdx].timeSlot;
										onConflictClick(
											view.days[dayIdx],
											DAY_SHORT[view.days[dayIdx]] ?? view.days[dayIdx],
											timeSlot.startTime,
											timeSlot.endTime,
											cellData.entries,
										);
									} : undefined}
								>
									{cellData.entries.map((entry) => (
										<EntryCell
											key={entry.entryId}
											entry={entry}
											viewMode={viewMode}
											subjectMap={subjectMap}
											facultyMap={facultyMap}
											sectionMap={sectionMap}
											roomMap={roomMap}
										/>
									))}
									{cellData.conflict && (
										<Badge
											variant="destructive"
											className="mt-0.5 text-xs px-1 py-0 cursor-pointer hover:bg-red-700 transition-colors"
											role="button"
											tabIndex={0}
											aria-label="Inspect conflict"
										>
											<AlertTriangle className="mr-0.5 size-2.5" />
											Conflict — Click to inspect
										</Badge>
									)}
								</td>
							);
						})}
					</tr>
				))}
			</tbody>
		</table>
	);
}
