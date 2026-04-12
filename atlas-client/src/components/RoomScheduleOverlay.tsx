/**
 * RoomScheduleOverlay — Full-screen-ish overlay that renders a complete
 * room timetable grid with utilization stats. Used from Dashboard to avoid
 * page navigation. Closes with Escape or close button.
 */

import { useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	Clock,
	ExternalLink,
	X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { formatTime } from '@/lib/utils';
import type { RoomScheduleView, RoomScheduleEntry } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';

/* ─── Constants ─── */

const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

/* ─── Types ─── */

export interface RoomScheduleOverlayProps {
	open: boolean;
	onClose: () => void;
	roomName: string;
	roomId: number;
	schedule: RoomScheduleView | null;
}

/* ─── Component ─── */

export function RoomScheduleOverlay({
	open,
	onClose,
	roomName,
	roomId,
	schedule,
}: RoomScheduleOverlayProps) {
	// Escape key handler
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		},
		[onClose],
	);

	useEffect(() => {
		if (open) {
			document.addEventListener('keydown', handleKeyDown);
			return () => document.removeEventListener('keydown', handleKeyDown);
		}
	}, [open, handleKeyDown]);

	return (
		<AnimatePresence>
			{open && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						className="fixed inset-0 z-50 bg-black/60"
						onClick={onClose}
					/>

					{/* Overlay panel */}
					<motion.div
						initial={{ opacity: 0, scale: 0.96, y: 16 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 16 }}
						transition={{ duration: 0.2, ease: 'easeOut' }}
						className="fixed inset-4 z-50 flex flex-col rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
						role="dialog"
						aria-label={`Full schedule for ${roomName}`}
						aria-modal="true"
					>
						{/* Header */}
						<div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-border">
							<Clock className="size-4 text-primary" />
							<h2 className="text-sm font-bold flex-1">{roomName} — Full Room Schedule</h2>

							{/* Inline stat banner */}
							{schedule && (
								<div className="flex items-center gap-3 text-xs text-muted-foreground">
									<span>
										Utilization: <span className="font-semibold text-foreground">{schedule.summary.utilizationPercent}%</span>
									</span>
									<span className="text-border">•</span>
									<span>
										{schedule.summary.occupiedMinutes}/{schedule.summary.availableMinutes} min
									</span>
									<span className="text-border">•</span>
									{schedule.summary.conflictCount > 0 ? (
										<Badge variant="destructive" className="text-[11px]">
											<AlertTriangle className="mr-0.5 size-3" />
											{schedule.summary.conflictCount} conflict{schedule.summary.conflictCount !== 1 ? 's' : ''}
										</Badge>
									) : (
										<span className="text-green-600 font-medium">0 conflicts</span>
									)}
									<span className="text-border">•</span>
									<span>
										Run #{schedule.source.runId} · {schedule.source.status}
									</span>
								</div>
							)}

							<Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1.5">
								<Link to={`/room-schedules?roomId=${roomId}&source=latest`}>
									<ExternalLink className="size-3" />
									Open Full Page
								</Link>
							</Button>

							<Button
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0"
								onClick={onClose}
								aria-label="Close overlay (Esc)"
							>
								<X className="size-4" />
							</Button>
						</div>

						{/* Grid area */}
						<ScrollArea className="flex-1 min-h-0">
							{schedule ? (
								<div className="p-5">
									<OverlayTimetableGrid schedule={schedule} />
								</div>
							) : (
								<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
									No schedule data available.
								</div>
							)}
						</ScrollArea>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

/* ─── Grid rendering (simplified from RoomSchedules) ─── */

function OverlayTimetableGrid({ schedule }: { schedule: RoomScheduleView }) {
	return (
		<table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
			<colgroup>
				<col className="w-24" />
				{schedule.days.map((d) => (
					<col key={d} />
				))}
			</colgroup>
			<thead className="sticky top-0 z-10 bg-background">
				<tr>
					<th className="sticky left-0 z-20 bg-background border-b-2 border-r px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Time
					</th>
					{schedule.days.map((d) => (
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
				{schedule.grid.map((row, rowIdx) => (
					<tr key={rowIdx}>
						<td className="sticky left-0 z-[5] bg-background border-r border-b px-2 py-3 align-middle w-24">
							<div className="text-[11px] font-semibold text-foreground">P{rowIdx + 1}</div>
							<div className="text-[10px] text-muted-foreground leading-tight">
								{formatTime(row.timeSlot.startTime)}–{formatTime(row.timeSlot.endTime)}
							</div>
						</td>
						{row.cells.map((cell, dayIdx) => {
							if (!cell.occupied) {
								return (
									<td key={dayIdx} className="border-b border-r last:border-r-0 px-1 py-1" />
								);
							}
							return (
								<td
									key={dayIdx}
									className={`border-b border-r last:border-r-0 px-1 py-0.5 align-top ${
										cell.conflict
											? 'bg-red-50 border-red-200'
											: 'bg-primary/5 border-primary/20'
									}`}
								>
									{cell.entries.map((entry) => (
										<OverlayEntryCell key={entry.entryId} entry={entry} />
									))}
									{cell.conflict && (
										<Badge variant="destructive" className="mt-0.5 text-[9px] px-1 py-0">
											<AlertTriangle className="mr-0.5 size-2.5" />
											Conflict
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

function OverlayEntryCell({ entry }: { entry: RoomScheduleEntry }) {
	return (
		<div className="px-1.5 py-1 text-[11px] leading-snug">
			<div className="font-semibold text-foreground truncate">
				{entry.subjectId ? `Subject #${entry.subjectId}` : 'Unknown'}
			</div>
			<div className="text-muted-foreground truncate">
				Section #{entry.sectionId}
			</div>
			<div className="text-muted-foreground/80 truncate">
				Faculty #{entry.facultyId}
			</div>
		</div>
	);
}
