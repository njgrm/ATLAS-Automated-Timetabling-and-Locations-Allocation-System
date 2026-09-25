import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode, TdHTMLAttributes } from 'react';
import { AlertCircle, AlertTriangle, ArrowRightLeft, Flag, GripVertical, Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { toast } from 'sonner';

import { parseDraftPlacementId } from '@/lib/timetable-utils';
import { isDayScopedOverlay } from '@/lib/timetable-grid-slots';
import { resolveCellTeacherText } from '@/lib/timetable-cell-teacher';
import { cn, formatTime } from '@/lib/utils';
import type { CellConflictInfo, ScheduledEntry, Violation, ViolationCode } from '@/types';

import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { EMPTY_SCHEDULED_ENTRIES, getEntrySeverity, TIMETABLE_DAY_SHORT, TIMETABLE_DAYS } from '@/components/timetable/TimetableGrid.constants';
import { TimetableCellOverflowSheet } from '@/components/timetable/TimetableCellOverflowSheet';
import { ConflictBadgeWithTooltip } from '@/components/timetable/TimetableGridConflictBadge';
import { DraggableEntry } from '@/components/timetable/TimetableDraggableEntry';
import { SandboxEntryBadge, TeacherDepartureEntryBadge } from '@/components/timetable/TimetableGridEntryBadges';

/**
 * C01R C2 — cell density (packet F-07). The room short label repeats its own
 * building grade (`G7 Room 103 · G7AW`: `{gradeToken} {roomName} ·
 * {buildingCode}`). When the trailing building code starts with the leading
 * grade token, drop that token from the room name once; otherwise return the
 * label untouched so no information is ever dropped.
 */
export function dedupeCellGradeRepetition(roomText: string): string {
	const token = roomText.match(/^G\d+/)?.[0];
	if (!token) return roomText;
	const segments = roomText.split('·');
	if (segments.length < 2) return roomText;
	const buildingCode = segments.at(-1)?.trim() ?? '';
	if (!buildingCode.startsWith(token)) return roomText;
	return roomText.replace(new RegExp(`^${token}\\s+`), '');
}

interface GridCellProps {
	cellId: string;
	day: string;
	startTime: string;
	endTime: string;
	cellEntries: ScheduledEntry[];
	isSpecialEvent: boolean;
	eventName?: string;
	/** When present, the event blocks only this weekday. */
	eventDayOfWeek?: string;
	hasKbSource: boolean;
	violationIndex: Map<string, Violation[]>;
	highlightedEntryIds: Set<string>;
	swapClassAEntryId?: string | null;
	swapClassBEntryId?: string | null;
	teacherDepartureEntryIds?: Set<string>;
	localSandboxChangedEntryIds?: Set<string>;
	localSandboxConflictEntryIds?: Set<string>;
	selectedEntry: ScheduledEntry | null;
	followUps: Set<string>;
	onEntryClick: (entry: ScheduledEntry) => void;
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	gradeForSection: (sectionId: number) => number | null;
	entryContextLabel: (entry: ScheduledEntry) => string;
	formatFacultyInitials: (id: number) => string;
	facultyLabel: (id: number) => string;
	viewMode: 'section' | 'faculty' | 'room';
	/** Selected ordered-term scope. Resolves the teacher from the entry in that term. */
	termFilter?: 'all' | number;
	/**
	 * A2 — resolves the visible ordered-term label for an entry. Only consulted
	 * under the `All terms` comparison scope, where stacked entries from
	 * different terms must be distinguishable.
	 */
	termLabelFor?: (termIndex: number | null | undefined) => string | null;
	/** A8 — only entries in the active review set carry a warning marker. */
	reviewEntryIds?: ReadonlySet<string>;
	showTeacherDetails?: boolean;
	pivotLabel: (id: number) => string;
	roomLabelShort: (roomId: number) => string;
	onKbPlace: (day: string, startTime: string, endTime: string) => void;
	onKbPlaceStart?: () => void;
	getCellConflict: ((cellId: string) => CellConflictInfo | null) | null;
	fullPreviewInfo: CellConflictInfo | null;
	onNavToFaculty: (id: number) => void;
	onNavToSection: (id: number) => void;
	onNavToRoom: (id: number) => void;
	onReassignTeacher?: (entry: ScheduledEntry) => void;
	simpleMode?: boolean;
}

type ActiveDragCellState = {
	cellId: string;
	isOver: true;
	info: CellConflictInfo | null;
};

const inactiveDragCellState = { isOver: false, info: null } as const;
let activeDragCellState: ActiveDragCellState | null = null;
const dragCellListeners = new Set<() => void>();
const POINTER_ACTIVE_CELL_VISUAL_DELAY_MS = 40;

function publishActiveDragCell(cellId: string | null, info: CellConflictInfo | null) {
	if (cellId === null) {
		if (activeDragCellState === null) return;
		activeDragCellState = null;
	} else if (activeDragCellState?.cellId === cellId && activeDragCellState.info === info) {
		return;
	} else {
		activeDragCellState = { cellId, isOver: true, info };
	}
	for (const listener of dragCellListeners) listener();
}

function useGridCellDragState(cellId: string) {
	return useSyncExternalStore(
		(listener) => {
			dragCellListeners.add(listener);
			return () => dragCellListeners.delete(listener);
		},
		() => activeDragCellState?.cellId === cellId ? activeDragCellState : inactiveDragCellState,
		() => inactiveDragCellState,
	);
}

// DnD context updates at pointer frequency. Keep its subscription in this
// wrapper so activation and release do not re-render the complete timetable.
const GridDropContainer = memo(function GridDropContainer({ children }: { children: ReactNode }) {
	const { setNodeRef } = useDroppable({
		id: 'timetable-grid-drop-zone',
		data: { type: 'timetableGrid' },
	});

	return <div ref={setNodeRef} className="overflow-auto scrollbar-thin">{children}</div>;
});

const GridCell = memo(function GridCell({
	cellId,
	day,
	startTime,
	endTime,
	cellEntries,
	isSpecialEvent,
	eventName,
	eventDayOfWeek,
	hasKbSource,
	violationIndex,
	highlightedEntryIds,
	swapClassAEntryId,
	swapClassBEntryId,
	teacherDepartureEntryIds,
	localSandboxChangedEntryIds,
	localSandboxConflictEntryIds,
	selectedEntry,
	followUps,
	onEntryClick,
	subjectLabel,
	sectionLabel,
	gradeForSection,
	entryContextLabel,
	formatFacultyInitials,
	facultyLabel,
	viewMode,
	termFilter = 'all',
	termLabelFor,
	reviewEntryIds,
	showTeacherDetails = true,
	pivotLabel,
	roomLabelShort,
	onKbPlace,
	onKbPlaceStart,
	getCellConflict,
	fullPreviewInfo,
	onNavToFaculty,
	onNavToSection,
	onNavToRoom,
	onReassignTeacher,
	simpleMode = false,
}: GridCellProps) {
	const { isOver, info } = useGridCellDragState(cellId);
	const [isKbHovered, setIsKbHovered] = useState(false);
	const [kbConflictInfo, setKbConflictInfo] = useState<CellConflictInfo | null>(null);
	const [overflowOpen, setOverflowOpen] = useState(false);
	const touchPlacementConfirmedRef = useRef(false);
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const win = window as Window & {
			__captureGridCellCommits?: boolean;
			__gridCellCommitLogs?: Array<{ cellId: string; timestamp: number; isOver: boolean }>;
		};
		if (!win.__captureGridCellCommits) return;
		win.__gridCellCommitLogs ??= [];
		win.__gridCellCommitLogs.push({ cellId, timestamp: performance.now(), isOver });
	});
	useEffect(() => {
		if (!hasKbSource && (isKbHovered || kbConflictInfo !== null)) {
			setIsKbHovered(false);
			setKbConflictInfo(null);
		}
	}, [hasKbSource, isKbHovered, kbConflictInfo]);

	// A day-scoped event (Monday Flag/HGP) is only non-schedulable on its own
	// weekday; the identical interval remains an ordinary class cell elsewhere.
	// A merged period row carrying a day-scoped overlay renders the event inside
	// its own period cell on the event weekday while Tue–Fri show the class.
	const dayScopedOverlay = isDayScopedOverlay({ isSpecialEvent, eventName, dayOfWeek: eventDayOfWeek });
	const eventAppliesToDay = isSpecialEvent
		? (!eventDayOfWeek || eventDayOfWeek === day)
		: dayScopedOverlay && eventDayOfWeek === day;
	// A day-scoped overlay that sits on a period the section actually attends is
	// an annotation ON the class, never a replacement for it: the ceremony must
	// not hide the registered subject or its teacher. Every SY 2026-2027
	// stakeholder class program prints the ceremony in the Monday cell of a row
	// whose Tue–Fri cells are ordinary subjects and whose Teacher column names
	// the displaced subject's teacher, so hiding the class here would make a
	// scheduler conclude no class is registered in the ceremony period.
	const ceremonyOverlayWithClass = dayScopedOverlay && eventAppliesToDay && cellEntries.length > 0;

	if (eventAppliesToDay && !ceremonyOverlayWithClass) {
		if (hasKbSource) {
			return (
				<td
					data-day={day}
					data-start-time={startTime}
					data-end-time={endTime}
					data-cell-entry-ids={cellEntries.map((entry) => entry.entryId).join(' ')}
					role="button"
					tabIndex={0}
					aria-label={`Blocked slot: ${eventName ?? 'Special Event'} on ${TIMETABLE_DAY_SHORT[day] ?? day} ${formatTime(startTime)}`}
					className="px-1 py-1 align-top border-l border-border/30 bg-amber-50/40 text-center text-xs font-medium text-amber-700 outline-none ring-2 ring-primary/40 ring-offset-1"
					onKeyDown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							toast.info(`This slot is blocked by ${eventName ?? 'Special Event'}. Choose a regular class slot.`);
						}
					}}
				>
					{eventName ?? 'Special Event'}
				</td>
			);
		}
		return (
			<td
				data-day={day}
				data-start-time={startTime}
				data-end-time={endTime}
				data-cell-entry-ids={cellEntries.map((entry) => entry.entryId).join(' ')}
				className="px-1 py-1 align-top border-l border-border/30 bg-amber-50/40 text-center text-xs font-medium text-amber-700"
			>
				{eventName ?? 'Special Event'}
			</td>
		);
	}

	const isDropOver = isOver || (hasKbSource && isKbHovered);
	const activeInfo = info ?? kbConflictInfo ?? fullPreviewInfo;
	const isActive = activeInfo !== null;
	const hasPlacementSource = hasKbSource || fullPreviewInfo !== null;
	const dropFeedbackMode = hasPlacementSource ? (cellEntries.length > 0 ? 'swap' : 'place') : null;
	// R4: label candidate cells with icon + text so placement state is never
	// communicated by color alone. Hard/soft cells keep their conflict badge,
	// which already renders "Blocked"/"Warning".
	const placementLabel = hasPlacementSource && activeInfo?.kind === 'clean' && (isActive || isDropOver)
		? (cellEntries.length > 0
			? { text: 'Swap', className: 'bg-amber-100 text-amber-800', Icon: ArrowRightLeft }
			: { text: 'Place', className: 'bg-emerald-100 text-emerald-700', Icon: Plus })
		: null;
	// All-terms is an explicit comparison scope: every session stays visible in
	// the cell so a scheduler never has to discover term-specific work through a
	// secondary sheet. Concrete-term views retain the compact overflow affordance.
	const visibleEntries = termFilter === 'all' ? cellEntries : cellEntries.slice(0, 2);
	const hiddenEntries = termFilter === 'all' ? [] : cellEntries.slice(2);
	const hiddenAffectedCount = hiddenEntries.filter((entry) => teacherDepartureEntryIds?.has(entry.entryId)).length;
	const overflowEntryIds = hiddenEntries.map((entry) => entry.entryId).join(' ');

	let dropClass = '';
	if (isActive) {
		if (activeInfo?.kind === 'self') {
			dropClass = ' ring-2 ring-blue-400/60 bg-blue-50/20';
		} else if (activeInfo?.kind === 'hard') {
			dropClass = isDropOver
				? ' ring-2 ring-red-500 bg-red-50/60'
				: ' ring-1 ring-red-400/50 bg-red-50/25';
		} else if (activeInfo?.kind === 'soft') {
			dropClass = isDropOver
				? ' ring-2 ring-amber-400 bg-amber-50/60'
				: ' ring-1 ring-amber-300/50 bg-amber-50/20';
		} else {
			dropClass = isDropOver
				? ' ring-2 ring-emerald-400 bg-emerald-50/60'
				: ' ring-1 ring-dashed ring-emerald-300/50 bg-emerald-50/10';
		}
	} else if (hasPlacementSource) {
		dropClass = isDropOver
			? ' ring-2 ring-emerald-400 bg-emerald-50/60'
			: ' ring-1 ring-dashed ring-muted-foreground/20';
	}

	return (
		<td
			data-day={day}
			data-start-time={startTime}
			data-end-time={endTime}
			data-cell-entry-ids={cellEntries.map((entry) => entry.entryId).join(' ')}
			role={hasKbSource ? 'button' : undefined}
			tabIndex={hasKbSource ? 0 : undefined}
			aria-label={
				hasKbSource
					? `Move selected session to ${TIMETABLE_DAY_SHORT[day] ?? day} ${formatTime(startTime)}`
					: `Timetable slot ${TIMETABLE_DAY_SHORT[day] ?? day} ${formatTime(startTime)}`
			}
			className={cn(
				'px-1 py-1 align-top border-l border-border/30 transition-all duration-75',
				dropClass
			)}
			onMouseEnter={() => {
				if (hasKbSource) {
					setIsKbHovered(true);
					setKbConflictInfo(hasKbSource ? getCellConflict?.(cellId) ?? null : null);
				}
			}}
			onMouseLeave={() => {
				if (hasKbSource) {
					setIsKbHovered(false);
					setKbConflictInfo(null);
				}
			}}
			onFocus={() => {
				if (hasKbSource) {
					setIsKbHovered(true);
					setKbConflictInfo(hasKbSource ? getCellConflict?.(cellId) ?? null : null);
				}
			}}
			onBlur={() => {
				if (hasKbSource) {
					setIsKbHovered(false);
					setKbConflictInfo(null);
				}
			}}
			onClick={() => {
				if (touchPlacementConfirmedRef.current) {
					touchPlacementConfirmedRef.current = false;
					return;
				}
				if (hasKbSource) {
					onKbPlace(day, startTime, endTime);
				}
			}}
			onTouchStart={() => {
				if (!hasKbSource) return;
				onKbPlaceStart?.();
			}}
			onTouchEnd={(event) => {
				if (!hasKbSource) return;
				touchPlacementConfirmedRef.current = true;
				event.preventDefault();
				event.stopPropagation();
				onKbPlace(day, startTime, endTime);
			}}
			onKeyDown={(event) => {
				if (hasKbSource && (event.key === 'Enter' || event.key === ' ')) {
					event.preventDefault();
					onKbPlace(day, startTime, endTime);
				}
			}}
		>
			{ceremonyOverlayWithClass && (
				<div
					className="mb-0.5 flex items-center gap-1 rounded-sm bg-amber-100 px-1 py-0.5 text-[0.6rem] font-semibold leading-none text-amber-800"
					data-testid="timetable-ceremony-overlay-label"
				>
					<Flag className="size-2.5 shrink-0" aria-hidden="true" />
					<span className="min-w-0 truncate">{eventName ?? 'Special Event'}</span>
				</div>
			)}
			{isActive && activeInfo && (activeInfo.kind === 'hard' || activeInfo.kind === 'soft') && (info !== null || kbConflictInfo !== null) && (
				<ConflictBadgeWithTooltip
					info={activeInfo}
					onNavToFaculty={onNavToFaculty}
					onNavToSection={onNavToSection}
					onNavToRoom={onNavToRoom}
				/>
			)}
			{isActive && activeInfo?.kind === 'self' && (
				<div className="mb-0.5 flex h-4 items-center justify-center rounded-sm bg-blue-100 px-1">
					<span className="text-xs font-medium leading-none text-blue-700">Current</span>
				</div>
			)}
			{placementLabel && (
				<div
					className={cn('mb-0.5 flex h-4 items-center justify-center gap-0.5 rounded-sm px-1', placementLabel.className)}
					data-testid="placement-target-label"
					data-placement-state={placementLabel.text.toLowerCase()}
				>
					<placementLabel.Icon className="size-3" aria-hidden="true" />
					<span className="text-[0.6rem] font-semibold leading-none">{placementLabel.text}</span>
				</div>
			)}
			<div className="space-y-0.5 min-h-6 overflow-hidden">
				{visibleEntries.map((entry) => {
					const rawSeverity = getEntrySeverity(entry.entryId, violationIndex);
					// A8 — prioritise: only cells in the active review set carry a
					// marker, so an attention filter narrows the flagged set instead
					// of flagging every violating cell identically. Severity stays
					// differentiated (HARD ring+icon vs SOFT border+icon).
					const severity = rawSeverity && (reviewEntryIds == null || reviewEntryIds.has(entry.entryId))
						? rawSeverity
						: null;
					const isHighlighted = highlightedEntryIds.has(entry.entryId);
					const isTeacherDepartureAffected = teacherDepartureEntryIds?.has(entry.entryId) ?? false;
					const isSandboxChanged = localSandboxChangedEntryIds?.has(entry.entryId) ?? false;
					const isSandboxConflict = localSandboxConflictEntryIds?.has(entry.entryId) ?? false;
					const isSelected = selectedEntry?.entryId === entry.entryId;
					const isFollowUp = followUps.has(entry.entryId);
					const grade = gradeForSection(entry.sectionId);
					// A2 — under the `All terms` comparison scope every stacked
					// entry must name its ordered term, otherwise identical rows
					// from different terms are indistinguishable.
					const entryTermLabel = termFilter === 'all' ? (termLabelFor?.(entry.termIndex) ?? null) : null;

					let cellClass = 'border-transparent text-foreground';
					if (grade === 7) cellClass = 'bg-green-50 border-green-200';
					else if (grade === 8) cellClass = 'bg-yellow-50 border-yellow-200';
					else if (grade === 9) cellClass = 'bg-red-50 border-red-200';
					else if (grade === 10) cellClass = 'bg-blue-50 border-blue-200';
					else cellClass = 'bg-muted/40 border-border';

					if (severity === 'HARD') {
						cellClass += ' border-red-500 ring-1 ring-red-300';
					} else if (severity === 'SOFT') {
						cellClass += ' border-amber-400';
					}

					if (isHighlighted) cellClass += ' ring-2 ring-primary ring-offset-1';
					if (entry.entryId === swapClassAEntryId) cellClass += ' ring-2 ring-blue-600 ring-offset-1 border-blue-300 bg-blue-50';
					if (entry.entryId === swapClassBEntryId) cellClass += ' ring-2 ring-amber-500 ring-offset-1 border-amber-300 bg-amber-50';
					if (isTeacherDepartureAffected) cellClass += ' ring-2 ring-violet-500 ring-offset-1';
					if (isSandboxChanged) cellClass += ' ring-2 ring-emerald-400 ring-offset-1';
					if (isSandboxConflict) cellClass += ' border-red-600 ring-2 ring-red-300 ring-offset-1';
					if (isSelected) cellClass += ' ring-2 ring-foreground ring-offset-1';

					const placementId = parseDraftPlacementId(entry.entryId);
					const entryData = placementId != null
						? { type: 'draftPlacement' as const, entry, placementId }
						: { type: 'entry' as const, entry };
					const entrySubjectLabel = subjectLabel(entry.subjectId);
					const entrySectionLabel = sectionLabel(entry.sectionId);
					const entryDayLabel = TIMETABLE_DAY_SHORT[day] ?? day;
					const entryTimeLabel = formatTime(startTime);

					return (
						<DraggableEntry
							key={entry.entryId}
							entryId={entry.entryId}
							entryData={entryData}
							role="button"
							aria-label={`Select ${entrySubjectLabel} for ${entrySectionLabel}, ${entryDayLabel} ${entryTimeLabel}`}
							data-timetable-entry="true"
							data-timetable-entry-id={entry.entryId}
							data-subject-id={entry.subjectId}
							data-subject-label={entrySubjectLabel}
							data-section-id={entry.sectionId}
							data-section-label={entrySectionLabel}
							data-faculty-id={entry.facultyId ?? ''}
							onClick={(event) => {
								if (hasKbSource) {
									event.stopPropagation();
									onKbPlace(day, startTime, endTime);
									return;
								}
								event.stopPropagation();
								onEntryClick(entry);
							}}
							onKeyDown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									onEntryClick(entry);
								}
							}}
							className={cn(
								simpleMode
									? 'min-h-11 w-full text-left rounded-lg border px-2.5 py-1.5 text-xs leading-tight transition-colors cursor-pointer active:cursor-grabbing hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 select-none'
									: 'min-h-10 w-full text-left rounded border px-2 py-1 text-xs leading-tight transition-colors cursor-pointer active:cursor-grabbing hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 select-none',
								cellClass
							)}
						>
							<div className="font-semibold text-xs truncate flex items-center gap-1">
								<GripVertical className="size-2.5 text-muted-foreground/40 shrink-0" />
								<span className="min-w-0 flex-1 truncate">{entrySubjectLabel}</span>
								{entryTermLabel ? (
									<span
										className="shrink-0 rounded bg-muted px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
										data-testid="timetable-entry-term-label"
										data-term-index={entry.termIndex ?? ''}
									>
										{entryTermLabel}
									</span>
								) : null}
								{severity === 'HARD' && (
									<AlertCircle className="size-3.5 shrink-0 text-red-500" />
								)}
								{severity === 'SOFT' && (
									<AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
								)}
								{entry.entryKind === 'COHORT' && entry.cohortCode && (
									<span className="rounded bg-sky-100 px-1 py-0.5 text-xs font-bold uppercase tracking-wide text-sky-700 shrink-0">
										{entry.cohortCode}
									</span>
								)}
								{isSandboxChanged && <SandboxEntryBadge />}
								{isTeacherDepartureAffected && <TeacherDepartureEntryBadge />}
								{isSandboxConflict && <AlertCircle className="size-2.5 shrink-0 text-red-600 shrink-0" />}
								{isFollowUp && (
									<Flag className="size-2.5 text-amber-500 fill-amber-500 shrink-0" />
								)}
							</div>
							{(() => {
								const roomText = roomLabelShort(entry.roomId);
								// QF-CELL-INFO: resolve the teacher from the entry in the
								// selected term (distinct terms may name distinct teachers).
								const teacherText = resolveCellTeacherText(entry, termFilter, formatFacultyInitials);
								const sectionText = sectionLabel(entry.sectionId);
								// C01R C2 — the display copy drops the room's repeated
								// building grade once; the full string stays behind
								// the Tooltip.
								const displayRoomText = dedupeCellGradeRepetition(roomText);
								let fullDetailsText = '';
								let displayDetailsText = '';
								if (viewMode === 'section') {
									// Section is the pivot row; the cell names the non-pivot
									// dimensions: teacher + room.
									fullDetailsText = showTeacherDetails ? `${teacherText} · ${roomText}` : roomText;
									displayDetailsText = showTeacherDetails ? `${teacherText} · ${displayRoomText}` : displayRoomText;
								} else if (viewMode === 'faculty') {
									// Faculty is the pivot row; the cell names section + room.
									fullDetailsText = `${sectionText} · ${roomText}`;
									displayDetailsText = `${sectionText} · ${displayRoomText}`;
								} else if (viewMode === 'room') {
									fullDetailsText = `${sectionText} · ${teacherText}`;
									displayDetailsText = fullDetailsText;
								}
								return (
									<TooltipProvider delayDuration={300}>
										<Tooltip>
											<TooltipTrigger asChild>
												<p
													className="truncate text-xs font-medium text-muted-foreground/80 mt-0.5"
													data-testid="timetable-cell-detail"
													data-cell-term={entry.termIndex ?? ''}
													data-cell-teacher={teacherText}
												>
													{displayDetailsText}
												</p>
											</TooltipTrigger>
											<TooltipContent side="bottom" className="max-w-xs" data-testid="timetable-cell-detail-full">
												<p>{fullDetailsText}</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								);
							})()}
						</DraggableEntry>
					);
				})}
				{termFilter !== 'all' && cellEntries.length > 2 && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 min-h-7 w-full justify-start rounded-md px-1.5 text-xs text-muted-foreground hover:bg-muted"
						onClick={(event) => {
							event.stopPropagation();
							setOverflowOpen(true);
						}}
						data-testid="timetable-cell-overflow-trigger"
						data-overflow-entry-ids={overflowEntryIds}
						aria-label={`Show ${cellEntries.length} sessions in ${TIMETABLE_DAY_SHORT[day] ?? day} ${formatTime(startTime)}`}
					>
						Show {cellEntries.length - 2} more class{cellEntries.length - 2 === 1 ? '' : 'es'}
						{hiddenAffectedCount > 0 ? (
							<span
								className="ml-auto rounded bg-violet-100 px-1 text-[0.65rem] font-semibold text-violet-700"
								data-testid="teacher-departure-hidden-cell-badge"
							>
								{hiddenAffectedCount} need teacher
							</span>
						) : null}
					</Button>
				)}
			</div>
			{termFilter !== 'all' && cellEntries.length > 2 ? (
				<TimetableCellOverflowSheet
					open={overflowOpen}
					onOpenChange={setOverflowOpen}
					entries={cellEntries}
					day={day}
					startTime={startTime}
					endTime={endTime}
					violationIndex={violationIndex}
					teacherDepartureEntryIds={teacherDepartureEntryIds}
					subjectLabel={subjectLabel}
					sectionLabel={sectionLabel}
					facultyLabel={facultyLabel}
					roomLabelShort={roomLabelShort}
					onEntryClick={onEntryClick}
					onReassignTeacher={onReassignTeacher}
				/>
			) : null}
		</td>
	);
});

interface TimetableGridProps {
	entries: ScheduledEntry[];
	timeSlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string; dayOfWeek?: string }>;
	violationIndex: Map<string, Violation[]>;
	highlightedEntryIds: Set<string>;
	swapClassAEntryId?: string | null;
	swapClassBEntryId?: string | null;
	teacherDepartureEntryIds?: Set<string>;
	localSandboxChangedEntryIds?: Set<string>;
	localSandboxConflictEntryIds?: Set<string>;
	selectedEntry: ScheduledEntry | null;
	followUps: Set<string>;
	onEntryClick: (entry: ScheduledEntry) => void;
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	gradeForSection: (sectionId: number) => number | null;
	entryContextLabel: (entry: ScheduledEntry) => string;
	formatFacultyInitials: (id: number) => string;
	facultyLabel: (id: number) => string;
	viewMode: 'section' | 'faculty' | 'room';
	/** Selected ordered-term scope. Resolves the teacher from the entry in that term. */
	termFilter?: 'all' | number;
	/** A2 — the configured ordered-term options, used to label stacked entries. */
	termOptions?: ReadonlyArray<{ value: string; label: string }>;
	/** A8 — only entries in the active review set carry a warning marker. */
	reviewEntryIds?: ReadonlySet<string>;
	showTeacherDetails?: boolean;
	pivotLabel: (id: number) => string;
	roomLabelShort: (roomId: number) => string;
	kbSelectedSource: GridDragSource;
	onKbPlace: (day: string, startTime: string, endTime: string) => void;
	onKbPlaceStart?: () => void;
	getCellConflict: ((cellId: string) => CellConflictInfo | null) | null;
	getLiveCellConflict: (source: any, cellId: string) => CellConflictInfo | null;
	onNavToFaculty: (id: number) => void;
	onNavToSection: (id: number) => void;
	onNavToRoom: (id: number) => void;
	onReassignTeacher?: (entry: ScheduledEntry) => void;
	simpleMode?: boolean;
}

export type GridDragSource =
	| { type: 'entry'; entry: ScheduledEntry }
	| { type: 'unassigned'; item: unknown }
	| { type: 'draftQueue'; item: unknown }
	| { type: 'draftPlacement'; placement: unknown }
	| null;

export const TimetableGrid = memo(function TimetableGrid({
	entries,
	timeSlots,
	violationIndex,
	highlightedEntryIds,
	swapClassAEntryId,
	swapClassBEntryId,
	teacherDepartureEntryIds,
	localSandboxChangedEntryIds,
	localSandboxConflictEntryIds,
	selectedEntry,
	followUps,
	onEntryClick,
	subjectLabel,
	sectionLabel,
	gradeForSection,
	entryContextLabel,
	formatFacultyInitials,
	facultyLabel,
	viewMode,
	termFilter = 'all',
	termOptions = [],
	reviewEntryIds,
	showTeacherDetails = true,
	pivotLabel,
	roomLabelShort,
	kbSelectedSource,
	onKbPlace,
	onKbPlaceStart,
	getCellConflict,
	getLiveCellConflict,
	onNavToFaculty,
	onNavToSection,
	onNavToRoom,
	onReassignTeacher,
	simpleMode = false,
}: TimetableGridProps) {
	const pendingDragCellRef = useRef<{ cellId: string; source: any } | null>(null);
	const dragCellTimerRef = useRef<number | null>(null);
	const dragPreviewTimerRef = useRef<number | null>(null);
	useEffect(() => {
		if (!kbSelectedSource || !onKbPlaceStart || typeof window === 'undefined') return;
		const announcePlacementTouch = () => onKbPlaceStart();
		window.addEventListener('touchstart', announcePlacementTouch, { capture: true, passive: true });
		return () => window.removeEventListener('touchstart', announcePlacementTouch, { capture: true });
	}, [kbSelectedSource, onKbPlaceStart]);
	useEffect(() => {
		const cleanupPointerPreview = () => {
			const labels = document.querySelectorAll('[data-pointer-preview-label="true"]');
			labels.forEach((label) => label.remove());
			const decoratedCells = document.querySelectorAll<HTMLElement>('[data-pointer-preview-status]');
			decoratedCells.forEach((cell) => {
				cell.removeAttribute('data-pointer-preview-status');
				cell.classList.remove(
					'ring-1',
					'ring-dashed',
					'ring-red-400/50',
					'ring-amber-300/50',
					'ring-emerald-300/50',
					'bg-red-50/25',
					'bg-amber-50/20',
					'bg-emerald-50/10',
				);
			});
		};
		const decoratePointerPreview = (source: NonNullable<GridDragSource>) => {
			cleanupPointerPreview();
			let cancelled = false;
			const cells = Array.from(
				document.querySelectorAll<HTMLElement>('td[data-day][data-start-time][data-end-time]'),
			);
			let cursor = 0;

			const decorateBatch = () => {
				if (cancelled) return;
				const end = Math.min(cursor + 14, cells.length);
				for (; cursor < end; cursor += 1) {
					const cell = cells[cursor];
					const day = cell.dataset.day;
					const startTime = cell.dataset.startTime;
					const endTime = cell.dataset.endTime;
					if (!day || !startTime || !endTime) continue;

					const cellId = `${day}-${startTime}-${endTime}`;
					const info = getLiveCellConflict(source, cellId) ?? getCellConflict?.(cellId) ?? null;
					const occupiedCount = cell.querySelectorAll('[data-timetable-entry="true"]').length;
					const mode = occupiedCount > 0 ? 'swap' : 'place';
					const status = info?.kind === 'hard'
						? 'blocked'
						: info?.kind === 'soft'
							? 'warning'
							: mode;

					cell.dataset.pointerPreviewStatus = status;
					cell.classList.add('ring-1');
					if (status === 'blocked') {
						cell.classList.add('ring-red-400/50', 'bg-red-50/25');
					} else if (status === 'warning' || mode === 'swap') {
						cell.classList.add('ring-amber-300/50', 'bg-amber-50/20');
					} else {
						cell.classList.add('ring-dashed', 'ring-emerald-300/50', 'bg-emerald-50/10');
					}
				}
				if (cursor < cells.length) {
					window.requestAnimationFrame(decorateBatch);
				}
			};

			window.requestAnimationFrame(decorateBatch);
			return () => {
				cancelled = true;
				cleanupPointerPreview();
			};
		};
		let cancelPreviewDecorations: (() => void) | null = null;
		const clearPreviewTimer = () => {
			if (dragPreviewTimerRef.current !== null) {
				window.clearTimeout(dragPreviewTimerRef.current);
				dragPreviewTimerRef.current = null;
			}
		};
		const clearPointerPreview = () => {
			clearPreviewTimer();
			cancelPreviewDecorations?.();
			cancelPreviewDecorations = null;
			cleanupPointerPreview();
		};
		const handlePreviewSource = (event: Event) => {
			const detail = (event as CustomEvent<{ source?: GridDragSource }>).detail;
			const nextSource = detail.source ?? null;
			clearPointerPreview();
			if (!nextSource) {
				return;
			}
			// Grid-wide guidance is useful, but calculating every visible cell in the
			// pointer activation frame creates a visible hitch on lower-end devices.
			// Defer pointer-drag guidance slightly; click/keyboard guidance remains immediate.
			dragPreviewTimerRef.current = window.setTimeout(() => {
				dragPreviewTimerRef.current = null;
				cancelPreviewDecorations = decoratePointerPreview(nextSource);
			}, 120);
		};
		window.addEventListener('atlas:timetable-drag-source', handlePreviewSource);
		return () => {
			clearPointerPreview();
			window.removeEventListener('atlas:timetable-drag-source', handlePreviewSource);
		};
	}, [getCellConflict, getLiveCellConflict]);
	useEffect(() => {
		const cancelPendingCellUpdate = () => {
			if (dragCellTimerRef.current !== null) {
				window.clearTimeout(dragCellTimerRef.current);
				dragCellTimerRef.current = null;
			}
		};
		const flushPendingCellUpdate = () => {
			dragCellTimerRef.current = null;
			const pending = pendingDragCellRef.current;
			if (!pending) return;
			const nextConflict = pending.source
				? getLiveCellConflict(pending.source, pending.cellId)
				: getCellConflict?.(pending.cellId) ?? null;
			publishActiveDragCell(pending.cellId, nextConflict);
		};
		const handleCellChange = (event: Event) => {
			const detail = (event as CustomEvent<{ cellId: string | null; source?: any }>).detail;
			if (!detail.cellId) {
				cancelPendingCellUpdate();
				pendingDragCellRef.current = null;
				publishActiveDragCell(null, null);
				return;
			}

			// Keep the conflict inspector live without letting its lookup and render
			// work enter dnd-kit's two-frame pointer activation window.
			pendingDragCellRef.current = { cellId: detail.cellId, source: detail.source ?? null };
			if (dragCellTimerRef.current === null) {
				dragCellTimerRef.current = window.setTimeout(
					flushPendingCellUpdate,
					POINTER_ACTIVE_CELL_VISUAL_DELAY_MS,
				);
			}
		};
		const handleDragEnding = () => cancelPendingCellUpdate();
		window.addEventListener('atlas:timetable-drag-cell', handleCellChange);
		window.addEventListener('atlas:timetable-drag-ending', handleDragEnding);
		return () => {
			cancelPendingCellUpdate();
			publishActiveDragCell(null, null);
			window.removeEventListener('atlas:timetable-drag-cell', handleCellChange);
			window.removeEventListener('atlas:timetable-drag-ending', handleDragEnding);
		};
	}, [getCellConflict, getLiveCellConflict]);
	const gridIndex = useMemo(() => {
		const index = new Map<string, ScheduledEntry[]>();
		for (const entry of entries) {
			const key = `${entry.day}-${entry.startTime}-${entry.endTime}`;
			const list = index.get(key) ?? [];
			list.push(entry);
			index.set(key, list);
		}
		return index;
	}, [entries]);

	const hasKbSource = kbSelectedSource !== null;
	// A2 — one ordered-term label resolver for the `All terms` scope. Falls back
	// to plain "Term N" language rather than an enum code when the option is absent.
	const termLabelFor = useMemo(() => {
		const byValue = new Map<string, string>();
		for (const option of termOptions) byValue.set(option.value, option.label);
		return (index: number | null | undefined): string | null => {
			if (index == null) return null;
			return byValue.get(String(index)) ?? `Term ${index}`;
		};
	}, [termOptions]);
	const activePreviewSource = kbSelectedSource;
	const fullPreviewByCell = useMemo(() => {
		if (!activePreviewSource) return null;
		const index = new Map<string, CellConflictInfo | null>();
		for (const slot of timeSlots) {
			for (const day of TIMETABLE_DAYS) {
				const cellId = `${day}-${slot.startTime}-${slot.endTime}`;
				const info = getLiveCellConflict(activePreviewSource, cellId) ?? getCellConflict?.(cellId) ?? null;
				index.set(cellId, info);
			}
		}
		return index;
	}, [activePreviewSource, getCellConflict, getLiveCellConflict, timeSlots]);

	return (
		<TooltipProvider>
			<GridDropContainer>
				<table aria-label="Timetable" className="w-full table-fixed border-collapse text-xs min-w-160">
					<thead>
						<tr>
							<th className="w-20 px-2 py-2 text-left text-muted-foreground font-medium border-b border-border">
								Time
							</th>
							{TIMETABLE_DAYS.map((day) => (
								<th
									key={day}
									className="w-[20%] px-2 py-2 text-center font-medium text-muted-foreground border-b border-border"
								>
									{TIMETABLE_DAY_SHORT[day]}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{timeSlots.map((slot) => {
							const rowKey = `${slot.startTime}-${slot.endTime}`;
							return (
								<tr key={rowKey} className="border-b border-border/50">
									<td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap font-mono text-xs align-top">
										{formatTime(slot.startTime)}
										<br />
										<span className="opacity-50">{formatTime(slot.endTime)}</span>
									</td>
									{TIMETABLE_DAYS.map((day) => {
										const key = `${day}-${slot.startTime}-${slot.endTime}`;
										const cellEntries = gridIndex.get(key) ?? EMPTY_SCHEDULED_ENTRIES;

										return (
											<GridCell
												key={key}
												cellId={key}
												day={day}
												startTime={slot.startTime}
												endTime={slot.endTime}
												cellEntries={cellEntries}
												isSpecialEvent={!!slot.isSpecialEvent}
												eventName={slot.eventName}
												eventDayOfWeek={slot.dayOfWeek}
												hasKbSource={hasKbSource}
												violationIndex={violationIndex}
												highlightedEntryIds={highlightedEntryIds}
												// LANE-C C03 (B8) — the grid received the swap picks but never
												// passed them to its cells, so Class A had no highlight.
												swapClassAEntryId={swapClassAEntryId}
												swapClassBEntryId={swapClassBEntryId}
												teacherDepartureEntryIds={teacherDepartureEntryIds}
												localSandboxChangedEntryIds={localSandboxChangedEntryIds}
												localSandboxConflictEntryIds={localSandboxConflictEntryIds}
												selectedEntry={selectedEntry}
												followUps={followUps}
												onEntryClick={onEntryClick}
												subjectLabel={subjectLabel}
												sectionLabel={sectionLabel}
												gradeForSection={gradeForSection}
												entryContextLabel={entryContextLabel}
												formatFacultyInitials={formatFacultyInitials}
												facultyLabel={facultyLabel}
												viewMode={viewMode}
												termFilter={termFilter}
												termLabelFor={termLabelFor}
												reviewEntryIds={reviewEntryIds}
												showTeacherDetails={showTeacherDetails}
												pivotLabel={pivotLabel}
												roomLabelShort={roomLabelShort}
												onKbPlace={onKbPlace}
												onKbPlaceStart={onKbPlaceStart}
												getCellConflict={getCellConflict}
												fullPreviewInfo={fullPreviewByCell?.get(key) ?? null}
												onNavToFaculty={onNavToFaculty}
												onNavToSection={onNavToSection}
												onNavToRoom={onNavToRoom}
												onReassignTeacher={onReassignTeacher}
												simpleMode={simpleMode}
											/>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</GridDropContainer>
		</TooltipProvider>
	);
});
