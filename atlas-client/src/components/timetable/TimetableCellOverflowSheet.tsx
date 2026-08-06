import { AlertTriangle, Eye, MoreHorizontal, Move, Repeat2, UserRoundX } from 'lucide-react';

import { formatTime } from '@/lib/utils';
import type { ScheduledEntry, Violation } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { ScrollArea } from '@/ui/scroll-area';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/ui/sheet';
import { TIMETABLE_DAY_SHORT } from './TimetableGrid.constants';

type TimetableCellOverflowSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entries: ScheduledEntry[];
	day: string;
	startTime: string;
	endTime: string;
	violationIndex: Map<string, Violation[]>;
	teacherDepartureEntryIds?: Set<string>;
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	roomLabelShort: (roomId: number) => string;
	onEntryClick: (entry: ScheduledEntry) => void;
	onReassignTeacher?: (entry: ScheduledEntry) => void;
};

function getSeverityLabel(entryId: string, violationIndex: Map<string, Violation[]>) {
	const violations = violationIndex.get(entryId) ?? [];
	if (violations.some((violation) => violation.severity === 'HARD')) return 'Blocked';
	if (violations.some((violation) => violation.severity === 'SOFT')) return 'Warning';
	return 'Ready';
}

export function TimetableCellOverflowSheet({
	open,
	onOpenChange,
	entries,
	day,
	startTime,
	endTime,
	violationIndex,
	teacherDepartureEntryIds,
	subjectLabel,
	sectionLabel,
	facultyLabel,
	roomLabelShort,
	onEntryClick,
	onReassignTeacher,
}: TimetableCellOverflowSheetProps) {
	const slotLabel = `${TIMETABLE_DAY_SHORT[day] ?? day} ${formatTime(startTime)}-${formatTime(endTime)}`;

	const handleEntryAction = (entry: ScheduledEntry) => {
		onEntryClick(entry);
		onOpenChange(false);
	};

	const handleReassign = (entry: ScheduledEntry) => {
		onReassignTeacher?.(entry);
		onOpenChange(false);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="isolate flex h-full w-[92vw] max-w-none flex-col gap-3 overflow-hidden bg-background p-4 text-foreground shadow-2xl sm:w-[34rem] sm:max-w-[34rem]"
				data-testid="timetable-cell-overflow-sheet"
			>
				<SheetHeader className="space-y-1 pr-8 text-left">
					<SheetTitle className="text-base">All sessions in this slot</SheetTitle>
					<SheetDescription className="text-xs">
						{slotLabel}. Choose the exact class you want to review, move, swap, or reassign.
					</SheetDescription>
				</SheetHeader>

				<ScrollArea className="min-h-0 flex-1 rounded-lg border border-border">
					<div className="divide-y divide-border">
						{entries.map((entry) => {
							const status = getSeverityLabel(entry.entryId, violationIndex);
							const isAffected = teacherDepartureEntryIds?.has(entry.entryId) ?? false;
							const teacher = entry.facultyId ? facultyLabel(entry.facultyId) : 'No teacher assigned';
							return (
								<div
									key={entry.entryId}
									className="grid gap-3 p-3"
									data-testid="timetable-cell-overflow-entry"
									data-timetable-entry-id={entry.entryId}
								>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-1.5">
											<p className="min-w-0 truncate text-sm font-semibold text-foreground">
												{subjectLabel(entry.subjectId)}
											</p>
											<Badge variant={status === 'Blocked' ? 'destructive' : status === 'Warning' ? 'outline' : 'secondary'} className="h-5 px-1.5 text-xs">
												{status}
											</Badge>
											{isAffected ? (
												<Badge variant="outline" className="h-5 border-violet-300 bg-violet-50 px-1.5 text-xs text-violet-700">
													Needs new teacher
												</Badge>
											) : null}
										</div>
										<p className="mt-1 truncate text-xs text-muted-foreground">
											{sectionLabel(entry.sectionId)} · {teacher} · {roomLabelShort(entry.roomId)}
										</p>
									</div>

									<div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr]" data-testid="timetable-overflow-secondary-menu">
										<Button
											type="button"
											variant="default"
											size="sm"
											className="h-11 justify-start gap-1.5 text-xs"
											onClick={() => handleEntryAction(entry)}
											data-testid="timetable-cell-overflow-select-action"
										>
											<Eye className="size-3.5" aria-hidden="true" />
											Select
										</Button>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button type="button" variant="outline" size="sm" className="h-11 gap-1.5 text-xs sm:hidden" aria-label="More actions for this class">
													<MoreHorizontal className="size-3.5" aria-hidden="true" />
													More
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-48">
												<DropdownMenuItem onSelect={(event) => { event.preventDefault(); handleEntryAction(entry); }} data-testid="timetable-cell-overflow-swap-action">
													<Repeat2 className="mr-2 size-3.5" aria-hidden="true" />
													Swap
												</DropdownMenuItem>
												<DropdownMenuItem onSelect={(event) => { event.preventDefault(); handleEntryAction(entry); }}>
													<Move className="mr-2 size-3.5" aria-hidden="true" />
													Move
												</DropdownMenuItem>
												<DropdownMenuItem
													disabled={!entry.facultyId || !onReassignTeacher}
													onSelect={(event) => { event.preventDefault(); handleReassign(entry); }}
													data-testid="timetable-cell-overflow-reassign-action"
												>
													<UserRoundX className="mr-2 size-3.5" aria-hidden="true" />
													Reassign
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="hidden h-11 justify-start gap-1.5 text-xs sm:inline-flex"
											onClick={() => handleEntryAction(entry)}
											data-testid="timetable-cell-overflow-swap-action"
										>
											<Repeat2 className="size-3.5" aria-hidden="true" />
											Swap
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="hidden h-11 justify-start gap-1.5 text-xs sm:inline-flex"
											onClick={() => handleEntryAction(entry)}
										>
											<Move className="size-3.5" aria-hidden="true" />
											Move
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="hidden h-11 justify-start gap-1.5 text-xs sm:inline-flex"
											onClick={() => handleReassign(entry)}
											disabled={!entry.facultyId || !onReassignTeacher}
											data-testid="timetable-cell-overflow-reassign-action"
										>
											{entry.facultyId ? (
												<UserRoundX className="size-3.5" aria-hidden="true" />
											) : (
												<AlertTriangle className="size-3.5" aria-hidden="true" />
											)}
											Reassign
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}
