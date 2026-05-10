import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, MouseEvent, TdHTMLAttributes } from 'react';
import {
	AlertCircle,
	AlertTriangle,
	Crosshair,
	Flag,
	GripVertical,
	Plus,
} from 'lucide-react';
import { useDndMonitor, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

import { getProgramBadgeLabel } from '@/lib/schedule-review-helpers';
import { parseDraftPlacementId } from '@/lib/timetable-utils';
import { cn, formatTime } from '@/lib/utils';
import type { CellConflictInfo, ScheduledEntry, Violation, ViolationCode, ViolationSeverity } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

const VIOLATION_LABELS: Record<ViolationCode, string> = {
	FACULTY_TIME_CONFLICT: 'Faculty Time Conflict',
	ROOM_TIME_CONFLICT: 'Room Time Conflict',
	SECTION_TIME_CONFLICT: 'Section Time Conflict',
	FACULTY_OVERLOAD: 'Faculty Overload',
	ROOM_TYPE_MISMATCH: 'Room Type Mismatch',
	FACULTY_SUBJECT_NOT_QUALIFIED: 'Not Qualified',
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: 'Consecutive Limit',
	FACULTY_BREAK_REQUIREMENT_VIOLATED: 'Break Requirement',
	FACULTY_DAILY_MAX_EXCEEDED: 'Daily Max Exceeded',
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: 'Excessive Travel Distance',
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: 'Excessive Building Transitions',
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: 'Insufficient Transition Buffer',
	FACULTY_EXCESSIVE_IDLE_GAP: 'Excessive Idle Gap',
	FACULTY_EARLY_START_PREFERENCE: 'Early Start Preference',
	FACULTY_LATE_END_PREFERENCE: 'Late End Preference',
	FACULTY_INSUFFICIENT_DAILY_VACANT: 'Insufficient Daily Vacant',
	SECTION_OVERCOMPRESSED: 'Section Overcompressed',
	ROOM_CAPACITY_EXCEEDED: 'Room Capacity Exceeded',
	SESSION_PATTERN_VIOLATED: 'Session Pattern Violated',
};

function entrySeverity(entryId: string, violationIndex: Map<string, Violation[]>): ViolationSeverity | null {
	const entries = violationIndex.get(entryId) ?? [];
	if (entries.some((violation) => violation.severity === 'HARD')) return 'HARD';
	if (entries.some((violation) => violation.severity === 'SOFT')) return 'SOFT';
	return null;
}

interface DraggableEntryProps extends HTMLAttributes<HTMLDivElement> {
	entryId: string;
	entryData:
		| { type: 'entry'; entry: ScheduledEntry }
		| { type: 'draftPlacement'; entry: ScheduledEntry; placementId: number };
}

const DraggableEntry = forwardRef<HTMLDivElement, DraggableEntryProps>(function DraggableEntry(
	{ entryId, entryData, children, style, onClick, ...rest },
	forwardedRef,
) {
	const { attributes, listeners, setNodeRef, isDragging: draggingThis, transform } = useDraggable({
		id: entryId,
		data: entryData,
	});

	// Prevent the click-selection handler from firing immediately after a drag.
	// PointerSensor suppresses click when pointer moves >8px, but this ref guards
	// against edge cases where the synthetic click still propagates.
	const didDragRef = useRef(false);
	useEffect(() => {
		if (draggingThis) {
			didDragRef.current = true;
		}
	}, [draggingThis]);

	const handleNodeRef = useCallback((node: HTMLDivElement | null) => {
		setNodeRef(node);
		if (typeof forwardedRef === 'function') {
			forwardedRef(node);
		} else if (forwardedRef) {
			forwardedRef.current = node;
		}
	}, [forwardedRef, setNodeRef]);

	const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
		if (didDragRef.current) {
			didDragRef.current = false;
			return;
		}
		onClick?.(event);
	}, [onClick]);

	return (
		<div
			ref={handleNodeRef}
			{...rest}
			{...attributes}
			{...listeners}
			onClick={handleClick}
			tabIndex={0}
			style={{
				...style,
				transform: CSS.Translate.toString(transform),
				zIndex: draggingThis ? 50 : undefined,
				opacity: draggingThis ? 0 : 1,
				touchAction: 'none',
				willChange: draggingThis ? 'transform' : undefined,
			}}
			data-dnd-source-type={entryData.type}
			data-dnd-entry-id={entryId}
		>
			{children}
		</div>
	);
});

interface DroppableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
	cellId: string;
	cellData: { day: string; startTime: string; endTime: string };
}

function DroppableCell({ cellId, cellData, children, ...tdProps }: DroppableCellProps) {
	const { setNodeRef } = useDroppable({ id: cellId, data: cellData });
	return (
		<td ref={setNodeRef} {...tdProps}>
			{children}
		</td>
	);
}

export type GridDragSource =
	| { type: 'entry'; entry: ScheduledEntry }
	| { type: 'unassigned'; item: unknown }
	| { type: 'draftQueue'; item: unknown }
	| { type: 'draftPlacement'; placement: unknown }
	| null;

interface TimetableGridProps {
	entries: ScheduledEntry[];
	timeSlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string }>;
	violationIndex: Map<string, Violation[]>;
	highlightedEntryIds: Set<string>;
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
	pivotLabel: (id: number) => string;
	roomLabelShort: (roomId: number) => string;
	dragItem: GridDragSource;
	kbSelectedSource: GridDragSource;
	onKbPlace: (day: string, startTime: string, endTime: string) => void;
	conflictMap: Map<string, CellConflictInfo> | null;
	onNavToFaculty: (id: number) => void;
	onNavToSection: (id: number) => void;
	onNavToRoom: (id: number) => void;
}

export const TimetableGrid = memo(function TimetableGrid({
	entries,
	timeSlots,
	violationIndex,
	highlightedEntryIds,
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
	pivotLabel,
	roomLabelShort,
	dragItem,
	kbSelectedSource,
	onKbPlace,
	conflictMap,
	onNavToFaculty,
	onNavToSection,
	onNavToRoom,
}: TimetableGridProps) {
	// Track drop target locally — avoids propagating setDropTarget up to ScheduleReviewWorkspace
	// and causing the whole workspace to re-render on every hover during drag.
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	useDndMonitor({
		onDragOver(event) {
			const key = event.over?.id ? String(event.over.id) : null;
			setDropTarget(key);
		},
		onDragEnd() {
			setDropTarget(null);
		},
		onDragCancel() {
			setDropTarget(null);
		},
	});
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

	const isDragging = dragItem !== null;
	const hasKbSource = kbSelectedSource !== null;
	const showHeavyTooltips = !isDragging && !hasKbSource;

	return (
		<TooltipProvider>
			<div className="overflow-auto">
				<table className="w-full table-fixed border-collapse text-xs min-w-160">
				<thead>
					<tr>
						<th className="w-20 px-2 py-2 text-left text-muted-foreground font-medium border-b border-border">
							Time
						</th>
						{DAYS.map((day) => (
							<th
								key={day}
								className="w-[20%] px-2 py-2 text-center font-medium text-muted-foreground border-b border-border"
							>
								{DAY_SHORT[day]}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{timeSlots.map((slot) => (
						<tr key={`${slot.startTime}-${slot.endTime}`} className="border-b border-border/50">
							<td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap font-mono text-[0.625rem] align-top">
								{formatTime(slot.startTime)}
								<br />
								<span className="opacity-50">{formatTime(slot.endTime)}</span>
								{slot.isSpecialEvent && slot.eventName && (
									<>
										<br />
										<span className="inline-flex mt-1 rounded bg-amber-100 px-1.5 py-0.5 text-[0.55rem] font-semibold text-amber-700">
											{slot.eventName}
										</span>
									</>
								)}
							</td>
							{DAYS.map((day) => {
								const key = `${day}-${slot.startTime}-${slot.endTime}`;
								const cellEntries = gridIndex.get(key) ?? [];
								if (slot.isSpecialEvent) {
									return (
										<td key={key} className="px-1 py-1 align-top border-l border-border/30 bg-amber-50/40 text-center text-[0.65rem] font-medium text-amber-700">
											{slot.eventName ?? 'Special Event'}
										</td>
									);
								}
								const isDropOver = dropTarget === key;
								const dropFeedbackMode = isDropOver ? (cellEntries.length > 0 ? 'swap' : 'replace') : null;
								const info = conflictMap?.get(key) ?? null;
								const isActive = conflictMap !== null;
								let dropClass = '';
								if (isActive) {
									if (info?.kind === 'self') {
										dropClass = ' ring-2 ring-blue-400/60 bg-blue-50/20';
									} else if (info?.kind === 'hard') {
										dropClass = isDropOver
											? ' ring-2 ring-red-500 bg-red-50/60'
											: ' ring-1 ring-red-400/50 bg-red-50/25';
									} else if (info?.kind === 'soft') {
										dropClass = isDropOver
											? ' ring-2 ring-amber-400 bg-amber-50/60'
											: ' ring-1 ring-amber-300/50 bg-amber-50/20';
									} else {
										dropClass = isDropOver
											? ' ring-2 ring-emerald-400 bg-emerald-50/60'
											: (isDragging || hasKbSource)
												? ' ring-1 ring-emerald-300/30 bg-emerald-50/10'
												: '';
									}
								} else if (isDragging || hasKbSource) {
									dropClass = isDropOver
											? ' ring-2 ring-emerald-400 bg-emerald-50/60'
										: ' ring-1 ring-dashed ring-muted-foreground/20';
								}

								return (
									<DroppableCell
										key={key}
										cellId={key}
										cellData={{ day, startTime: slot.startTime, endTime: slot.endTime }}
										data-day={day}
										data-start-time={slot.startTime}
										data-end-time={slot.endTime}
										className={`px-1 py-1 align-top border-l border-border/30 transition-all${dropClass}`}
										onMouseEnter={() => {
											if (hasKbSource) {
												setDropTarget(key);
											}
										}}
										onMouseLeave={() => {
											if (hasKbSource && dropTarget === key) {
												setDropTarget(null);
											}
										}}
										onClick={() => {
											if (hasKbSource) {
												onKbPlace(day, slot.startTime, slot.endTime);
											}
										}}
									>
										{isDropOver && isDragging && dropFeedbackMode && (
											<div
												className={cn(
													'mb-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.5rem] font-semibold uppercase tracking-wide',
													dropFeedbackMode === 'swap'
														? 'bg-amber-100 text-amber-800'
														: 'bg-emerald-100 text-emerald-800',
												)}
											>
												{dropFeedbackMode === 'swap' ? 'Swap Preview' : 'Replace Preview'}
											</div>
										)}
										{isDragging && cellEntries.length > 0 && (
											<div className="mb-0.5 inline-flex items-center rounded-sm bg-muted px-1 py-0.5 text-[0.5rem] text-muted-foreground">
												Occupied ({cellEntries.length})
											</div>
										)}
										{isActive && info && (info.kind === 'hard' || info.kind === 'soft') && (
											showHeavyTooltips ? (
											<Tooltip delayDuration={150}>
												<TooltipTrigger asChild>
													<div className={cn(
														'mb-0.5 flex h-3.5 cursor-default items-center gap-0.5 rounded-sm px-1',
														info.kind === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
													)}>
														{info.kind === 'hard'
															? <AlertCircle className="size-2 shrink-0" />
															: <AlertTriangle className="size-2 shrink-0" />
														}
														<span className="truncate text-[0.5rem] leading-none font-medium">
															{info.reasons[0]?.split(':')[0] ?? info.kind}
														</span>
													</div>
												</TooltipTrigger>
												<TooltipContent side="right" className="z-100 max-w-64 space-y-1.5 p-2 text-xs">
													<p className={cn('font-semibold', info.kind === 'hard' ? 'text-red-700' : 'text-amber-700')}>
														{info.kind === 'hard' ? 'Hard conflict' : 'Soft warning'}
													</p>
													{info.reasons.map((reason, reasonIndex) => (
														<p key={reasonIndex} className="text-muted-foreground">{reason}</p>
													))}
													{info.displaced.length > 0 && (
														<div className="space-y-0.5 border-t border-border/40 pt-1">
															<p className="font-medium text-[0.625rem]">Displaces:</p>
															{info.displaced.slice(0, 3).map((displaced, displacedIndex) => (
																<p key={displacedIndex} className="text-[0.625rem] text-muted-foreground">
																	{displaced.subjectName} - unassigned
																</p>
															))}
														</div>
													)}
													{info.displaced.length > 0 && (
														<div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-1">
															{Array.from(new Map(info.displaced.map((displaced) => [displaced.conflictType, displaced])).values()).map((displaced) => (
																<button
																	key={displaced.conflictType}
																	className="text-[0.625rem] text-primary underline-offset-2 hover:underline"
																	onMouseDown={(event) => {
																		event.stopPropagation();
																		if (displaced.conflictType === 'faculty') onNavToFaculty(displaced.entityId);
																		else if (displaced.conflictType === 'section') onNavToSection(displaced.entityId);
																		else onNavToRoom(displaced.entityId);
																	}}
																>
																	- View {displaced.conflictType === 'faculty' ? 'Faculty' : displaced.conflictType === 'section' ? 'Section' : 'Room'}
																</button>
															))}
														</div>
													)}
												</TooltipContent>
											</Tooltip>
											) : (
												<div className={cn(
													'mb-0.5 flex h-3.5 cursor-default items-center gap-0.5 rounded-sm px-1',
													info.kind === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
												)}>
													{info.kind === 'hard'
														? <AlertCircle className="size-2 shrink-0" />
														: <AlertTriangle className="size-2 shrink-0" />
													}
													<span className="truncate text-[0.5rem] leading-none font-medium">
														{info.reasons[0]?.split(':')[0] ?? info.kind}
													</span>
												</div>
											)
										)}
										{isActive && info?.kind === 'self' && (
											<div className="mb-0.5 flex h-3.5 items-center justify-center rounded-sm bg-blue-100 px-1">
												<span className="text-[0.5rem] font-medium leading-none text-blue-700">Current</span>
											</div>
										)}
										{isActive && info?.kind === 'clean' && cellEntries.length === 0 && (isDragging || hasKbSource) && (
											<div className="flex h-3.5 items-center justify-center opacity-25">
												<Plus className="size-2.5 text-emerald-700" />
											</div>
										)}
										<div className="space-y-0.5 min-h-6 overflow-hidden">
											{cellEntries.slice(0, 2).map((entry) => {
												const severity = entrySeverity(entry.entryId, violationIndex);
												const isHighlighted = highlightedEntryIds.has(entry.entryId);
												const isSelected = selectedEntry?.entryId === entry.entryId;
												const isFollowUp = followUps.has(entry.entryId);
												const grade = gradeForSection(entry.sectionId);

												let cellClass = 'border-transparent text-foreground';
												if (grade === 7) cellClass = 'bg-green-50 border-green-200';
												else if (grade === 8) cellClass = 'bg-yellow-50 border-yellow-200';
												else if (grade === 9) cellClass = 'bg-red-50 border-red-200';
												else if (grade === 10) cellClass = 'bg-blue-50 border-blue-200';
												else cellClass = 'bg-muted/40 border-border';

												if (severity === 'HARD') {
													cellClass += ' border-red-500 ring-1 ring-red-300';
												} else if (severity === 'SOFT') {
													cellClass += ' border-amber-500 border-dashed';
												}

												if (isHighlighted) cellClass += ' ring-2 ring-primary ring-offset-1';
												if (isSelected) cellClass += ' ring-2 ring-foreground ring-offset-1';

													return (
														(() => {
															const placementId = parseDraftPlacementId(entry.entryId);
															const entryData = placementId != null
																? { type: 'draftPlacement' as const, entry, placementId }
																: { type: 'entry' as const, entry };
															const card = (
																<DraggableEntry
																	entryId={entry.entryId}
																	entryData={entryData}
																	role="button"
																	onClick={(event) => {
																		if (hasKbSource) {
																			event.stopPropagation();
																			onKbPlace(day, slot.startTime, slot.endTime);
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
																	className={`w-full text-left rounded px-1.5 py-1 border text-[0.625rem] leading-tight transition-colors cursor-grab active:cursor-grabbing hover:opacity-80 select-none ${cellClass}`}
																>
																	<div className="font-medium truncate flex items-center gap-1">
																		<GripVertical className="size-2.5 text-muted-foreground/40 shrink-0" />
																		{subjectLabel(entry.subjectId)}
																		{severity === 'HARD' && <AlertCircle className="size-2.5 shrink-0 text-red-600" />}
																		{severity === 'SOFT' && <AlertTriangle className="size-2.5 shrink-0 text-amber-600" />}
																		{entry.entryKind === 'COHORT' && entry.cohortCode && (
																			<span className="rounded bg-sky-100 px-1 py-0.5 text-[0.5rem] font-semibold uppercase tracking-wide text-sky-700">
																				{entry.cohortCode}
																			</span>
																		)}
																	</div>
																	<p className="wrap-break-word leading-[1.2] text-muted-foreground">
																		<span className="font-medium text-foreground/80">{entryContextLabel(entry)}</span>
																	</p>
																	<p className="wrap-break-word leading-[1.2] text-muted-foreground">
																		{entry.facultyId ? formatFacultyInitials(entry.facultyId) : 'No faculty'}{' '}
																		<span className="opacity-60">{roomLabelShort(entry.roomId)}</span>
																	</p>
																	{isFollowUp && (
																		<Flag className="size-2.5 text-amber-500 inline-block ml-0.5" />
																	)}
																</DraggableEntry>
															);

															if (!showHeavyTooltips) {
																return <div key={entry.entryId}>{card}</div>;
															}

															return (
													<Tooltip key={entry.entryId} delayDuration={300}>
															<TooltipTrigger asChild>
																{card}
															</TooltipTrigger>
															<TooltipContent side="right" className="space-y-1 z-100 max-w-50">
																<div className="font-semibold">{subjectLabel(entry.subjectId)}</div>
																{entry.facultyId && viewMode !== 'faculty' && (
																	<div className="text-xs font-medium">{facultyLabel(entry.facultyId)}</div>
																)}
																<div className="text-muted-foreground text-xs">{entryContextLabel(entry)} - {roomLabelShort(entry.roomId)}</div>
																{entry.programType && entry.programType !== 'REGULAR' && (
																	<div className="text-[0.625rem] text-violet-700">Program: {getProgramBadgeLabel(entry.programType, entry.programCode)}</div>
																)}
																<div className="text-muted-foreground text-xs">{DAY_SHORT[entry.day] ?? entry.day} {formatTime(entry.startTime)}-{formatTime(entry.endTime)}</div>
																{(() => {
																	const violations = violationIndex.get(entry.entryId) ?? [];
																	return violations.length > 0 ? (
																		<div className="pt-1 mt-1 border-t border-border/50">
																			<span className="text-[0.625rem] font-medium text-amber-600 block mb-0.5">Constraint Warnings</span>
																			{violations.map((violation, violationIndexItem) => (
																				<div key={violationIndexItem} className="text-[0.625rem] text-muted-foreground ml-1.5">
																					- {VIOLATION_LABELS[violation.code] ?? violation.code}
																				</div>
																			))}
																		</div>
																	) : null;
																})()}
															</TooltipContent>
														</Tooltip>
																);
															})()
												);
											})}
											{cellEntries.length > 2 && (
												<div className="text-[0.5rem] text-muted-foreground/70 px-1.5 leading-none">+{cellEntries.length - 2} more</div>
											)}
										</div>
									</DroppableCell>
								);
							})}
						</tr>
					))}
				</tbody>
				</table>
			</div>
		</TooltipProvider>
	);
});
