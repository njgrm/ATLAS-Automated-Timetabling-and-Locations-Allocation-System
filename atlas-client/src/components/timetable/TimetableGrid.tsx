import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TdHTMLAttributes } from 'react';
import { AlertCircle, ArrowRightLeft, Flag, GripVertical, Plus } from 'lucide-react';
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
import { ConflictBadgeWithTooltip, EntrySeverityIndicator, entryAccessibleName } from '@/components/timetable/TimetableGridConflictBadge';
import { DraggableEntry, useTimetableEntryReadOnly } from '@/components/timetable/TimetableDraggableEntry';
import { useTimetableGridPointerPreview } from '@/components/timetable/useTimetableGridPointerPreview';
import { SandboxEntryBadge, TeacherDepartureEntryBadge } from '@/components/timetable/TimetableGridEntryBadges';
import type { GridCellProps } from '@/components/timetable/TimetableGridCell.types';
import { CLASS_SCHEDULE_LABEL } from '@/lib/class-schedule-naming';
import {
	GridDropContainer,
	inactiveDragCellState,
	POINTER_ACTIVE_CELL_VISUAL_DELAY_MS,
	publishActiveDragCell,
	useGridCellDragState,
} from '@/components/timetable/TimetableGridDropContext';

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

// A2-C7 item 3(a): the drag-cell store, its subscription and the drop wrapper
// were extracted verbatim to `TimetableGridDropContext.tsx` so this file could
// take the blocked-window fix inside the 1000-line component cap (AGENTS.md
// §8). Same objects, same module-scope singletons, same rendered output.
// A2-C7: the cell's prop contract moved to `TimetableGridCell.types.ts`.
// The cap guard (`timetable-relaxed-main` B5) caught this file at 1011 physical
// lines after the blocked-window fix, and the 1000-line cap is not negotiable
// (AGENTS.md §8). It is a TYPE, so the move is erased at compile time. It is
// re-exported here so no importer has to change its import path.
export type { GridCellProps };

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
	moveTargetSlotKeys,
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
	formatWarningMessage,
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
	readOnly = false,
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

	// A2-C7 item 3(a) — a class placed inside a BLOCKED window was invisible.
	// The cell rendered the band name and dropped `cellEntries` entirely, so
	// `manual_schedule_edits` id 12's move of TLE to MON 12:15 produced a cell
	// reading "Lunch Break" on every term and an unexplained empty 06:00 beside
	// it. The grid must never hide a registered class: it shows the class AND
	// says, in words, that it overlaps the block. Without this the operator has
	// no way to learn a class is misplaced except by comparing days.
	//
	// Distinct from `ceremonyOverlayWithClass` on purpose. A day-scoped overlay
	// (the Monday flag/HGP ceremony) is an ANNOTATION on a period the section
	// attends, so it labels the cell. A non-day-scoped blocked window is a
	// genuine policy block that a class is sitting inside, so the cell must also
	// count and name the collision — "1 class overlaps Lunch Break" — which is
	// the difference between a label and a statement about the schedule.
	const blockedWindowWithClass = eventAppliesToDay && !dayScopedOverlay && cellEntries.length > 0;
	const eventLabelWithClass = ceremonyOverlayWithClass || blockedWindowWithClass;

	if (eventAppliesToDay && !eventLabelWithClass) {
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
					className="px-1 py-1 align-top border-l border-border/30 bg-amber-50/40 text-center text-[12px] font-medium text-amber-700 outline-none ring-2 ring-primary/40 ring-offset-1"
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
				className="px-1 py-1 align-top border-l border-border/30 bg-amber-50/40 text-center text-[12px] font-medium text-amber-700"
			>
				{eventName ?? 'Special Event'}
			</td>
		);
	}

	const isDropOver = isOver || (hasKbSource && isKbHovered);
	// C11 M3 (F3) — the status line says "N highlighted free time slots", so the
	// cells it counts MUST be marked. The keys come from the one
	// `describeMoveTargets` derivation, never from a second list, so the grid and
	// the sentence cannot disagree. Colour is not the signal on its own (the same
	// rule the ceremony / blocked-window labels follow here): the cell carries a
	// readable "Move here" cue as well as the ring, and `data-move-target` names
	// the state for assistive technology.
	const isMoveTarget = moveTargetSlotKeys?.has(`${day}-${startTime}`) === true;
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
	// A2-C7 correction (QA `ses_f19fa473bffeDm5iNBes3VX7PH` row 6, BLOCKING): the
	// overlap marker counted `cellEntries` while the cell renders `visibleEntries`,
	// which is `cellEntries.slice(0, 2)` in a concrete-term view. Measured at n=3
	// the marker read "3 classes overlap Lunch Break" above two rendered classes,
	// and worse at n=4 and n=5 — a count an operator can check, disagreeing with
	// what is on screen. It is now the number of classes actually rendered beneath
	// it, and any remainder is STATED rather than silently dropped, because the
	// overflow sheet is a second place to look and this label is the only place
	// that says the collision exists at all.
	const hiddenOverlaps = blockedWindowWithClass ? hiddenEntries.length : 0;
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
	// C11 M3 (F3) — the target ring, applied UNDER the hover/conflict ring so the
	// two never fight for the same outline.
	const moveTargetClass = isMoveTarget
		? ' ring-2 ring-dashed ring-emerald-500 bg-emerald-50/30'
		: '';

	return (
		<td
			data-day={day}
			data-start-time={startTime}
			data-end-time={endTime}
			data-cell-entry-ids={cellEntries.map((entry) => entry.entryId).join(' ')}
			data-move-target={isMoveTarget ? 'true' : undefined}
			role={hasKbSource ? 'button' : undefined}
			tabIndex={hasKbSource ? 0 : undefined}
			aria-label={
				hasKbSource
					? `Move selected session to ${TIMETABLE_DAY_SHORT[day] ?? day} ${formatTime(startTime)}`
					: `Timetable slot ${TIMETABLE_DAY_SHORT[day] ?? day} ${formatTime(startTime)}`
			}
			className={cn(
				'px-1 py-1 align-top border-l border-border/30 transition-all duration-75',
				moveTargetClass,
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
			{/* C11 M3 (F3) — the readable half of the target cue. Without this the
			    ring would be the only signal, and a scheduler who cannot separate the
			    dashed emerald outline from the conflict rings has been told nothing. */}
			{isMoveTarget && (
				<div
					className="mb-0.5 flex items-center gap-1 rounded-sm bg-emerald-100 px-1 py-0.5 text-[12px] font-semibold leading-none text-emerald-900"
					data-testid="timetable-move-target-cue"
				>
					<Plus className="size-2.5 shrink-0" aria-hidden="true" />
					<span className="min-w-0 truncate">Move here</span>
				</div>
			)}
			{ceremonyOverlayWithClass && (
				<div
					className="mb-0.5 flex items-center gap-1 rounded-sm bg-amber-100 px-1 py-0.5 text-[12px] font-semibold leading-none text-amber-800"
					data-testid="timetable-ceremony-overlay-label"
				>
					<Flag className="size-2.5 shrink-0" aria-hidden="true" />
					<span className="min-w-0 truncate">{eventName ?? 'Special Event'}</span>
				</div>
			)}
			{blockedWindowWithClass && (
				// A2-C7 item 3(a). Colour is not the signal: the text states the
				// count and names the block, and the count is the number of classes
				// rendered DIRECTLY BENEATH this label, so the two can be checked by
				// eye. `visibleEntries.length`, never `cellEntries.length` — see the
				// note at the declaration. A remainder is stated rather than hidden,
				// because the overflow sheet is a second place to look and this label
				// is the only place that says the collision exists.
				<div
					className="mb-0.5 flex items-center gap-1 rounded-sm bg-amber-100 px-1 py-0.5 text-[12px] font-semibold leading-none text-amber-900"
					data-testid="timetable-blocked-overlap-label"
					data-overlap-count={visibleEntries.length}
					data-overlap-hidden={hiddenOverlaps}
					data-overlap-window={eventName ?? 'Special Event'}
				>
					<AlertCircle className="size-2.5 shrink-0" aria-hidden="true" />
					<span className="min-w-0 truncate">
						{visibleEntries.length === 1
							? `1 class overlaps ${eventName ?? 'this blocked time'}`
							: `${visibleEntries.length} classes overlap ${eventName ?? 'this blocked time'}`}
						{hiddenOverlaps > 0 ? ` · ${hiddenOverlaps} more in the overflow` : ''}
					</span>
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
					<span className="text-[12px] font-medium leading-none text-blue-700">Current</span>
				</div>
			)}
			{placementLabel && (
				<div
					className={cn('mb-0.5 flex h-4 items-center justify-center gap-0.5 rounded-sm px-1', placementLabel.className)}
					data-testid="placement-target-label"
					data-placement-state={placementLabel.text.toLowerCase()}
				>
					<placementLabel.Icon className="size-3" aria-hidden="true" />
					<span className="text-[12px] font-semibold leading-none">{placementLabel.text}</span>
				</div>
			)}
			<div className="space-y-0.5 min-h-6 overflow-hidden">
				{visibleEntries.map((entry) => {
					const warnings = violationIndex.get(entry.entryId) ?? [];
					const rawSeverity = getEntrySeverity(entry.entryId, violationIndex);
					// Keep every selected-term warning discoverable; the review set only
					// identifies which warning is currently being worked on.
					const severity = rawSeverity;
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
					// A2-UX-STATUS-C2 / #55 (B1): the name below is composed from the same
					// `severitySummary` phrase the indicator it WRAPS shows and names.
					return (
						<DraggableEntry
							key={entry.entryId}
							entryId={entry.entryId}
							entryData={entryData}
							readOnly={readOnly}
							role="button"
							tabIndex={0}
							aria-label={entryAccessibleName({ verb: readOnly ? 'View' : 'Select', subjectLabel: entrySubjectLabel, sectionLabel: entrySectionLabel, dayTimeLabel: `${TIMETABLE_DAY_SHORT[day] ?? day} ${formatTime(startTime)}`, warnings })}
							data-timetable-entry="true"
							data-timetable-entry-id={entry.entryId}
							data-subject-id={entry.subjectId}
							data-subject-label={entrySubjectLabel}
							data-section-id={entry.sectionId}
							data-section-label={entrySectionLabel}
							data-faculty-id={entry.facultyId ?? ''}
							onClick={(event) => {
								if (!readOnly && hasKbSource) {
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
									? `min-h-11 w-full text-left rounded-lg border px-2.5 py-1.5 text-[14px] leading-tight transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 select-none ${readOnly ? 'cursor-default' : 'cursor-pointer active:cursor-grabbing'}`
									: `min-h-10 w-full text-left rounded border px-2 py-1 text-[14px] leading-tight transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 select-none ${readOnly ? 'cursor-default' : 'cursor-pointer active:cursor-grabbing'}`,
								cellClass
							)}
						>
							<div className="font-semibold text-[14px] truncate flex items-center gap-1">
								{readOnly ? null : <GripVertical className="size-2.5 text-muted-foreground/40 shrink-0" />}
								<span className="min-w-0 flex-1 truncate">{entrySubjectLabel}</span>
								{entryTermLabel ? (
									<span
										className="shrink-0 rounded bg-muted px-1 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"
										data-testid="timetable-entry-term-label"
										data-term-index={entry.termIndex ?? ''}
									>
										{entryTermLabel}
									</span>
								) : null}
								{severity ? (
									<EntrySeverityIndicator
										severity={severity}
										reasons={warnings.map((warning) => warning.message).filter(Boolean)}
										warnings={warnings}
										formatWarningMessage={formatWarningMessage}
										reviewFocused={reviewEntryIds?.has(entry.entryId) ?? false}
									/>
								) : null}
								{entry.entryKind === 'COHORT' && entry.cohortCode && (
									<span className="rounded bg-sky-100 px-1 py-0.5 text-[12px] font-bold uppercase tracking-wide text-sky-700 shrink-0">
										{entry.cohortCode}
									</span>
								)}
								{isSandboxChanged && <SandboxEntryBadge />}
								{isTeacherDepartureAffected && <TeacherDepartureEntryBadge />}
								{isSandboxConflict && (
									<span role="img" aria-label="Sandbox conflict" className="inline-flex shrink-0">
										<AlertCircle className="size-2.5 text-red-600" aria-hidden="true" />
									</span>
								)}
								{isFollowUp && (
									<span role="img" aria-label="Marked for follow-up" className="inline-flex shrink-0">
										<Flag className="size-2.5 text-amber-500 fill-amber-500" aria-hidden="true" />
									</span>
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
													className="truncate text-[14px] font-medium text-muted-foreground/80 mt-0.5"
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
						className="h-7 min-h-7 w-full justify-start rounded-md px-1.5 text-[12px] text-muted-foreground hover:bg-muted"
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
								className="ml-auto rounded bg-violet-100 px-1 text-[12px] font-semibold text-violet-700"
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
	/**
	 * C11 M3 (F3) — the legal MOVE-TARGET slot keys for the current view, threaded
	 * from the ONE `describeMoveTargets` derivation in `timetableMoveTargets.ts` so
	 * the highlighted cells and the "N highlighted free time slots" sentence cannot
	 * disagree. Absent/empty means no move is armed and no cell is marked.
	 */
	moveTargetSlotKeys?: ReadonlySet<string>;
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
	/** A8 — the active review set annotates, but never hides, selected-term warnings. */
	reviewEntryIds?: ReadonlySet<string>;
	formatWarningMessage?: (message: string, violation?: Violation) => string;
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
	moveTargetSlotKeys,
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
	formatWarningMessage,
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
	// C11 slice 1 (F3) — the pointer-drag preview decorations moved verbatim to
	// `useTimetableGridPointerPreview.ts` so this file could take the M3 move-target
	// cue without breaching the 1000-line cap (AGENTS.md §8). Same event, same
	// deferral, same classes, same cleanup.
	useTimetableGridPointerPreview({ kbSelectedSource, onKbPlaceStart, getCellConflict, getLiveCellConflict });
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
	// F6 — the header publishes the run's publication state here; a published run
	// renders read-only entries, a draft keeps its edit affordances.
	const readOnly = useTimetableEntryReadOnly();
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
				<table aria-label={CLASS_SCHEDULE_LABEL} className="w-full table-fixed border-collapse text-[14px] min-w-160">
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
									<td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap font-mono text-[14px] align-top">
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
											moveTargetSlotKeys={moveTargetSlotKeys}
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
												formatWarningMessage={formatWarningMessage}
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
												readOnly={readOnly}
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
