/**
 * ConflictInspectorSheet — Right-side sheet that displays details of a
 * room-schedule conflict cell and provides actionable resolution links.
 *
 * Opened from RoomSchedules when user clicks a conflict badge/cell.
 * Deep-links into ScheduleReview with query params for prefiltered views.
 */

import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	CalendarClock,
	Clock,
	DoorOpen,
	ExternalLink,
	ShieldAlert,
	Users,
	X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { formatTime } from '@/lib/utils';
import type { RoomScheduleEntry } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';

/* ─── Types ─── */

export interface ConflictInspectorData {
	day: string;
	dayLabel: string;
	startTime: string;
	endTime: string;
	roomName: string;
	runId: number;
	runStatus: string;
	entries: RoomScheduleEntry[];
	roomId: number;
}

interface Props {
	open: boolean;
	data: ConflictInspectorData | null;
	onClose: () => void;
	subjectMap: Map<number, string>;
	facultyMap: Map<number, string>;
	sectionMap: Map<number, string>;
}

/* ─── Conflict type detection ─── */

function detectConflictTypes(entries: RoomScheduleEntry[]): string[] {
	const types: string[] = [];

	// Room time conflict — multiple entries in same room/time
	if (entries.length > 1) {
		types.push('Room Time Conflict — multiple classes occupy this room at the same time.');
	}

	// Faculty time conflict — same faculty in different entries
	const facultyIds = entries.map((e) => e.facultyId);
	const duplicateFaculty = facultyIds.filter((id, i) => facultyIds.indexOf(id) !== i);
	if (duplicateFaculty.length > 0) {
		types.push('Faculty Time Conflict — a teacher is double-booked in this slot.');
	}

	if (types.length === 0) {
		types.push('Scheduling conflict detected in this slot.');
	}

	return types;
}

/* ─── Component ─── */

export function ConflictInspectorSheet({
	open,
	data,
	onClose,
	subjectMap,
	facultyMap,
	sectionMap,
}: Props) {
	return (
		<AnimatePresence>
			{open && data && (
				<motion.div
					initial={{ x: '100%', opacity: 0 }}
					animate={{ x: 0, opacity: 1 }}
					exit={{ x: '100%', opacity: 0 }}
					transition={{ duration: 0.2, ease: 'easeInOut' }}
					className="fixed right-0 top-14 bottom-0 w-96 z-50 border-l border-border bg-background shadow-xl flex flex-col"
					role="dialog"
					aria-label="Conflict Inspector"
				>
					{/* Header */}
					<div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border">
						<ShieldAlert className="size-4 text-red-600" />
						<span className="text-sm font-semibold flex-1">Conflict Inspector</span>
						<Button
							variant="ghost"
							size="sm"
							className="h-6 w-6 p-0"
							onClick={onClose}
							aria-label="Close inspector"
						>
							<X className="size-3.5" />
						</Button>
					</div>

					<ScrollArea className="flex-1 min-h-0">
						<div className="px-4 py-4 space-y-4">
							{/* Slot context */}
							<div className="rounded-md border border-red-200 bg-red-50/50 px-3 py-2.5 space-y-1.5">
								<div className="flex items-center gap-2 text-xs font-medium text-red-700">
									<AlertTriangle className="size-3.5 shrink-0" />
									{data.entries.length} colliding entries
								</div>
								<div className="grid grid-cols-2 gap-y-1 text-xs">
									<span className="text-muted-foreground">Day / Time</span>
									<span className="font-medium text-foreground">
										{data.dayLabel} · {formatTime(data.startTime)}–{formatTime(data.endTime)}
									</span>
									<span className="text-muted-foreground">Room</span>
									<span className="font-medium text-foreground">{data.roomName}</span>
									<span className="text-muted-foreground">Run</span>
									<span className="font-medium text-foreground">
										#{data.runId} · {data.runStatus}
									</span>
								</div>
							</div>

							{/* Conflict types */}
							<div>
								<h4 className="text-xs font-semibold text-foreground mb-1.5">
									Conflict Type(s)
								</h4>
								{detectConflictTypes(data.entries).map((type, i) => (
									<p key={i} className="text-xs text-muted-foreground leading-relaxed mb-1">
										• {type}
									</p>
								))}
							</div>

							{/* Colliding entries */}
							<div>
								<h4 className="text-xs font-semibold text-foreground mb-2">
									Colliding Entries
								</h4>
								<div className="space-y-2">
									{data.entries.map((entry) => (
										<div
											key={entry.entryId}
											className="rounded-md border border-border bg-card p-3 space-y-1.5"
										>
											<div className="flex items-center gap-2">
												<span className="text-xs font-semibold text-foreground">
													{subjectMap.get(entry.subjectId) ?? `Unknown Subject (#${entry.subjectId})`}
												</span>
											</div>
											<div className="flex items-center gap-3 text-[0.6875rem] text-muted-foreground">
												<span className="flex items-center gap-1">
													<Users className="size-3" />
													{sectionMap.get(entry.sectionId) ?? `Unknown Section (#${entry.sectionId})`}
												</span>
											</div>
											<div className="flex items-center gap-3 text-[0.6875rem] text-muted-foreground">
												<span className="flex items-center gap-1">
													<Users className="size-3" />
													{facultyMap.get(entry.facultyId) ?? `Unknown Faculty (#${entry.facultyId})`}
												</span>
											</div>
											<div className="text-[0.625rem] font-mono text-muted-foreground/70">
												Entry: {entry.entryId.slice(0, 12)}…
											</div>
										</div>
									))}
								</div>
							</div>

							{/* Resolution Actions */}
							<div>
								<h4 className="text-xs font-semibold text-foreground mb-2">
									Resolution Actions
								</h4>
								<div className="space-y-1.5">
									<Button
										asChild
										variant="outline"
										size="sm"
										className="w-full h-8 text-xs justify-start"
									>
										<Link
											to={`/timetable?viewMode=room&entityFilter=${data.roomId}&day=${data.day}&startTime=${data.startTime}&endTime=${data.endTime}&runId=${data.runId}`}
										>
											<CalendarClock className="size-3.5 mr-2" />
											Open in Schedule Review
											<span className="ml-auto text-muted-foreground text-[0.625rem]">
												room/day/slot prefiltered
											</span>
										</Link>
									</Button>

									{data.entries.map((entry) => (
										<Button
											key={entry.entryId}
											asChild
											variant="outline"
											size="sm"
											className="w-full h-8 text-xs justify-start"
										>
											<Link
												to={`/timetable?entryId=${entry.entryId}&runId=${data.runId}`}
											>
												<DoorOpen className="size-3.5 mr-2" />
												Edit "{subjectMap.get(entry.subjectId) ?? 'entry'}" in Manual Edit
												<ExternalLink className="size-3 ml-auto opacity-50" />
											</Link>
										</Button>
									))}

									<Button
										asChild
										variant="outline"
										size="sm"
										className="w-full h-8 text-xs justify-start"
									>
										<Link
											to={`/timetable?severityFilter=conflicts&runId=${data.runId}`}
										>
											<ShieldAlert className="size-3.5 mr-2" />
											View all conflicts for this run
										</Link>
									</Button>
								</div>
							</div>
						</div>
					</ScrollArea>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
