import type { ReactNode } from 'react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { ScrollArea } from '@/ui/scroll-area';
import { cn, formatTime } from '@/lib/utils';
import type { RoomScheduleEntry, RoomScheduleView } from '@/types';

const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

type TemplateVariant = '11x6' | '13x6';

type OccupancyTemplatePreviewProps = {
	view: RoomScheduleView;
	variant: TemplateVariant;
	subjectMap: Map<number, string>;
	facultyMap: Map<number, string>;
	sectionMap: Map<number, string>;
	onPrint: () => void;
	header?: ReactNode;
};

function getRowCount(variant: TemplateVariant): number {
	return variant === '11x6' ? 11 : 13;
}

function buildRows(view: RoomScheduleView, rowCount: number) {
	return Array.from({ length: rowCount }, (_, rowIndex) => {
		const sourceRow = view.grid[rowIndex] ?? null;
		const cells = view.days.map((day, dayIndex) => {
			const sourceCell = sourceRow?.cells[dayIndex] ?? null;
			return {
				day,
				entries: sourceCell?.entries ?? [],
				occupied: sourceCell?.occupied ?? false,
				conflict: sourceCell?.conflict ?? false,
			};
		});

		return {
			rowLabel: `Block ${rowIndex + 1}`,
			startTime: sourceRow?.timeSlot.startTime ?? null,
			endTime: sourceRow?.timeSlot.endTime ?? null,
			cells,
		};
	});
}

function formatEntry(entry: RoomScheduleEntry, subjectMap: Map<number, string>, facultyMap: Map<number, string>, sectionMap: Map<number, string>) {
	return {
		subject: subjectMap.get(entry.subjectId) ?? `Subject #${entry.subjectId}`,
		faculty: facultyMap.get(entry.facultyId) ?? `Faculty #${entry.facultyId}`,
		section: sectionMap.get(entry.sectionId) ?? `Section #${entry.sectionId}`,
	};
}

export function OccupancyTemplatePreview({
	view,
	variant,
	subjectMap,
	facultyMap,
	sectionMap,
	onPrint,
	header,
}: OccupancyTemplatePreviewProps) {
	const rowCount = getRowCount(variant);
	const rows = buildRows(view, rowCount);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
				<Badge variant="outline" className="h-5 px-1.5 text-[0.625rem] uppercase">Occupancy Template</Badge>
				<span>{variant}</span>
				<span className="text-border">•</span>
				<span>{rowCount} rows × 6 columns</span>
				<span className="text-border">•</span>
				<span>{view.summary.entryCount} occupied sessions</span>
				{header}
				<Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={onPrint}>
					Print / Save PDF
				</Button>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="p-4 pt-0">
					<Card className="overflow-hidden border-border/80 shadow-sm">
						<CardHeader className="border-b border-border/70 py-3">
							<CardTitle className="text-sm">{view.room.name} · {variant} occupancy form</CardTitle>
						</CardHeader>
						<CardContent className="p-0">
							<div className="overflow-auto">
								<table className="min-w-[860px] w-full border-collapse text-[11px]">
									<colgroup>
										<col className="w-28" />
										{view.days.map((day) => <col key={day} />)}
									</colgroup>
									<thead className="sticky top-0 z-10 bg-background">
										<tr>
											<th className="border-b border-r border-border px-3 py-2 text-left font-semibold uppercase tracking-[0.08em] text-muted-foreground">Slot</th>
											{view.days.map((day) => (
												<th key={day} className="border-b border-border px-2 py-2 text-left font-semibold uppercase tracking-[0.08em] text-muted-foreground">
													{DAY_SHORT[day] ?? day}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{rows.map((row, rowIndex) => (
											<tr key={`${row.rowLabel}-${rowIndex}`} className="align-top">
												<th className="sticky left-0 z-10 border-b border-r border-border bg-muted/30 px-3 py-2 text-left font-semibold text-foreground">
													<div>{row.rowLabel}</div>
													<div className="font-normal text-muted-foreground">
														{row.startTime && row.endTime ? `${formatTime(row.startTime)} - ${formatTime(row.endTime)}` : 'Open block'}
													</div>
												</th>
												{row.cells.map((cell) => (
													<td key={`${row.rowLabel}-${cell.day}`} className={cn('border-b border-border px-1.5 py-1 align-top', cell.conflict ? 'bg-red-50/60' : cell.occupied ? 'bg-primary/5' : 'bg-background')}>
														{cell.entries.length === 0 ? (
															<div className="rounded border border-dashed border-border/70 px-2 py-3 text-center text-muted-foreground">Empty</div>
														) : (
															<div className="space-y-1">
																{cell.entries.map((entry) => {
																	const details = formatEntry(entry, subjectMap, facultyMap, sectionMap);
																	return (
																		<div key={entry.entryId} className="rounded border border-border bg-background px-2 py-1 shadow-sm">
																			<div className="flex items-center justify-between gap-2">
																			<span className="font-semibold text-foreground">{details.subject}</span>
																			<span className="text-[10px] text-muted-foreground">{formatTime(entry.startTime)}-{formatTime(entry.endTime)}</span>
																		</div>
																		<div className="mt-0.5 text-muted-foreground">{details.section}</div>
																		<div className="mt-0.5 text-muted-foreground/80">{details.faculty}</div>
																	</div>
																);
																})}
															</div>
														)}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>
				</div>
			</ScrollArea>
		</div>
	);
}
