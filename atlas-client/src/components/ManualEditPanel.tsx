/**
 * ManualEditPanel — Center-pane workspace for manual schedule edits.
 *
 * Layout: 2-column (form left, conflict inspector right), stacked on narrow screens.
 * Replaces the timetable grid when an officer selects an action from the right panel.
 *
 * All conflict messages rendered from server-provided human strings.
 * All inputs use shadcn primitives — no native HTML selects.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Clock, DoorOpen, Loader2, ShieldAlert, Users } from 'lucide-react';

import { formatTime } from '@/lib/utils';
import { formatIdentityFallbackText, formatWarningMessageText } from '@/lib/violation-presentation';
import { getQualificationTier } from '@/lib/grade-labels';
import type { ManualEditProposal, PreviewResult, ScheduledEntry } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Label } from '@/ui/label';
import { ScrollArea } from '@/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/ui/select';
import { SearchableSelect } from '@/ui/searchable-select';
import { freeRoomsAtSlot, NO_OTHER_ROOM_FREE, type RoomRecordLike } from '@/components/manual-edit/manual-edit-room-availability';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/ui/tooltip';
import {
	buildOccupiedSlots,
	DAY_SHORT,
	DAYS,
	GRADE_BADGE,
	type ManualEditActionType,
	type ManualEditPanelProps,
} from '@/components/manual-edit/manual-edit-foundation';
import { ManualEditConflictInspector } from '@/components/manual-edit/ManualEditConflictInspector';
import { describeMoveSwapOffers, type MoveSwapOffer } from '@/components/timetable/timetableMoveTargets';
import { useManualEditOptionGroups } from '@/components/manual-edit/useManualEditOptionGroups';
import { CLASS_SCHEDULE_LABEL } from '@/lib/class-schedule-naming';

/* ─── Constants ─── */

/* ─── Helpers ─── */

/* ─── Component ─── */

export default function ManualEditPanel({
	entry,
	violationIndex,
	onClose,
	subjectLabel,
	facultyLabel,
	sectionLabel,
	gradeForSection,
	roomLabel,
	timeSlots,
	roomMap,
	facultyMap,
	subjectMap,
	draftEntries,
	onPreview,
	onCommit,
	previewLoading,
	commitLoading,
	initialAction,
}: ManualEditPanelProps) {
	const [actionType, setActionType] = useState<ManualEditActionType>(initialAction ?? 'CHANGE_TIMESLOT');
	const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
	const [pendingProposal, setPendingProposal] = useState<ManualEditProposal | null>(null);
	/** Tracks last preview outcome when user adjusts form after previewing */
	const [lastPreviewSummary, setLastPreviewSummary] = useState<{
		hard: number;
		soft: number;
	} | null>(null);

	// Action form state
	const [targetDay, setTargetDay] = useState<string>(entry.day);
	const [targetTimeSlot, setTargetTimeSlot] = useState<string>(
		`${entry.startTime}-${entry.endTime}`,
	);
	const [targetRoomId, setTargetRoomId] = useState<string>(String(entry.roomId));
	const [targetFacultyId, setTargetFacultyId] = useState<string>(String(entry.facultyId));

	const mountedRef = useRef(false);

	// Auto-start with initialAction on mount
	useEffect(() => {
		if (!mountedRef.current && initialAction) {
			setActionType(initialAction);
			mountedRef.current = true;
		}
	}, [initialAction]);

	// Reset when entry changes
	useEffect(() => {
		setPreviewResult(null);
		setPendingProposal(null);
		setLastPreviewSummary(null);
		setTargetDay(entry.day);
		setTargetTimeSlot(`${entry.startTime}-${entry.endTime}`);
		setTargetRoomId(String(entry.roomId));
		setTargetFacultyId(String(entry.facultyId));
	}, [entry.entryId]);

	// When action type changes, clear preview
	useEffect(() => {
		setPreviewResult(null);
		setPendingProposal(null);
	}, [actionType]);

	// ── Derived data ──

	// Room and faculty options for the two SearchableSelect fields — grouping,
	// feature compatibility and qualification ordering — are derived in
	// `useManualEditOptionGroups`, which keeps this panel's surface readable.
	const { roomSearchGroups, facultySearchGroups } = useManualEditOptionGroups({
		roomMap,
		facultyMap,
		subjectMap,
		draftEntries,
		subjectId: entry.subjectId,
	});

	// Pre-filter: slots occupied by current faculty or current room on the selected day
	const occupiedSlots = useMemo(
		() =>
			buildOccupiedSlots(
				draftEntries,
				entry.entryId,
				targetDay,
				entry.facultyId ?? 0,
				entry.roomId ?? 0,
			),
		[draftEntries, entry.entryId, targetDay, entry.facultyId, entry.roomId],
	);

	const freeTimeSlots = useMemo(
		() =>
			timeSlots
				.filter((ts) => !ts.isSpecialEvent)
				.map((ts) => ({
					...ts,
					key: `${ts.startTime}-${ts.endTime}`,
					occupied: occupiedSlots.has(`${ts.startTime}-${ts.endTime}`),
				})),
		[timeSlots, occupiedSlots],
	);

	/**
	 * A2 mc S3c — WHAT IS IN EACH OCCUPIED SLOT, and whether the two classes can
	 * trade places.
	 *
	 * The recorded defect: every occupied period was struck through and labelled
	 * ` (occupied)`, and the only explanation was a helper sentence under the
	 * control ("Struck-through slots are occupied by the same faculty or room on
	 * Monday") — which said nothing about WHICH class was there, whether a swap
	 * was possible, and, after S3a, was no longer even the whole truth.
	 *
	 * The partner decision is DELEGATED to `describeMoveSwapOffers`, which calls
	 * the one `findRegularSwapCandidate` rule. No scoring is re-implemented here.
	 *
	 * WHY REMOVE THE HELPER SENTENCE (subtraction first, AGENTS.md §11): §8 forbids
	 * a helper sentence under a control, and with the option itself now naming the
	 * occupant and the swap verdict, the sentence restated a fact the operator can
	 * now read on the option. It is deleted, not reworded.
	 */
	const timeSlotSwapOffers = useMemo(() => {
		const entries = (draftEntries ?? []) as ScheduledEntry[];
		const offers = describeMoveSwapOffers({
			/* This panel's `timeSlots` prop carries NO day: the Target Day select
			 * and the slot select together form ONE slot, and `buildOccupiedSlots`
			 * above already scopes occupancy to `targetDay`. Stamping the selected
			 * day onto the offered slots is therefore the same fact the panel is
			 * already rendering, not an inference. */
			slots: timeSlots
				.filter((ts) => !ts.isSpecialEvent)
				.map((ts) => ({ ...ts, day: String(targetDay) })),
			occupants: entries.filter((candidate) => String(candidate.day) === String(targetDay)),
			movingEntry: {
				entryId: entry.entryId,
				day: String(entry.day),
				startTime: String(entry.startTime),
				sectionId: entry.sectionId,
				subjectId: entry.subjectId,
				facultyId: entry.facultyId,
				roomId: entry.roomId,
				termIndex: entry.termIndex ?? null,
			},
			subjectLabel,
			facultyLabel,
		});
		return new Map(offers.map((offer) => [`${offer.startTime}-${offer.endTime}`, offer] as const));
	}, [draftEntries, timeSlots, targetDay, entry, subjectLabel, facultyLabel]);

	const swapOfferFor = useCallback(
		(startTime: string, endTime: string): MoveSwapOffer | undefined =>
			timeSlotSwapOffers.get(`${startTime}-${endTime}`),
		[timeSlotSwapOffers],
	);

	const entryViolations = violationIndex.get(entry.entryId) ?? [];

	/**
	 * WARNING-READABILITY-C01-R1 (F1): the conflict inspector renders raw
	 * validator messages, so it applies the same R2 formatting as the rail:
	 * known teacher ids resolve to names via facultyMap, every other raw id
	 * degrades to plain words, and bare `min`/`h` plus shouted weekdays are
	 * expanded. Constraint math is untouched — presentation only.
	 */
	const formatPanelViolationMessage = (message: string): string => {
		const withNames = message.replace(/\bfaculty\s+#?(\d+)\b/gi, (match, rawId: string) => {
			const faculty = facultyMap.get(Number(rawId));
			return faculty ? `${faculty.lastName}, ${faculty.firstName}` : 'this teacher';
		});
		return formatWarningMessageText(formatIdentityFallbackText(withNames));
	};
	const grade = gradeForSection(entry.sectionId);
	const gradeBadge = grade ? GRADE_BADGE[grade] : undefined;

	// ── Actions ──

	const switchAction = useCallback((type: ManualEditActionType) => {
		setActionType(type);
		setLastPreviewSummary(null);
	}, []);

	const handlePreview = useCallback(async () => {
		let proposal: ManualEditProposal;

		if (actionType === 'CHANGE_TIMESLOT') {
			const [startTime, endTime] = targetTimeSlot.split('-');
			proposal = {
				editType: 'CHANGE_TIMESLOT',
				entryId: entry.entryId,
				targetDay,
				targetStartTime: startTime,
				targetEndTime: endTime,
			};
		} else if (actionType === 'CHANGE_ROOM') {
			proposal = {
				editType: 'CHANGE_ROOM',
				entryId: entry.entryId,
				targetRoomId: Number(targetRoomId),
			};
		} else {
			proposal = {
				editType: 'CHANGE_FACULTY',
				entryId: entry.entryId,
				targetFacultyId: Number(targetFacultyId),
			};
		}

		const result = await onPreview(proposal);
		if (result) {
			setPreviewResult(result);
			setPendingProposal(proposal);
			setLastPreviewSummary({
				hard: result.hardViolations.length,
				soft: result.softViolations.length,
			});
		}
	}, [actionType, entry, targetDay, targetTimeSlot, targetRoomId, targetFacultyId, onPreview]);

	const handleCommit = useCallback(async () => {
		if (!pendingProposal) return;
		await onCommit(pendingProposal, true); // always allow soft override
	}, [pendingProposal, onCommit]);

		/**
	 * C11 M2 — the rooms free at THIS class's own day and time.
	 *
	 * Read from the props the panel already had (`roomMap`, `draftEntries`): the
	 * occupied list is every entry in the run on the same day whose slot overlaps,
	 * which is the same comparison the grid's own conflict lookup makes. No new
	 * request, so this can never disagree with the data the grid is showing.
	 */
	const freeRoomOptions = useMemo(() => {
		if (actionType !== 'CHANGE_ROOM') return [];
		return freeRoomsAtSlot({
			rooms: [...roomMap.values()] as RoomRecordLike[],
			occupied: (draftEntries ?? []).map((candidate) => ({
				roomId: Number(candidate.roomId),
				day: String(candidate.day),
				startTime: String(candidate.startTime),
				endTime: String(candidate.endTime),
			})),
			currentRoomId: entry.roomId == null ? null : Number(entry.roomId),
			day: String(entry.day),
			startTime: String(entry.startTime),
			endTime: String(entry.endTime),
		});
	}, [actionType, roomMap, draftEntries, entry]);

	const isFormComplete = useMemo(() => {
		if (actionType === 'CHANGE_TIMESLOT') return !!targetDay && !!targetTimeSlot;
		if (actionType === 'CHANGE_ROOM') return !!targetRoomId;
		if (actionType === 'CHANGE_FACULTY') return !!targetFacultyId;
		return false;
	}, [actionType, targetDay, targetTimeSlot, targetRoomId, targetFacultyId]);

	// Keyboard shortcuts: P = Preview, Enter = Commit, Esc = Back
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			// Skip when focus is in an input/select
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA') return;

			if (e.key === 'p' || e.key === 'P') {
				if (isFormComplete && !previewLoading) {
					e.preventDefault();
					handlePreview();
				}
			} else if (e.key === 'Enter') {
				if (pendingProposal && !commitLoading && previewResult?.hardViolations.length === 0) {
					e.preventDefault();
					handleCommit();
				}
			} else if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [isFormComplete, previewLoading, handlePreview, pendingProposal, commitLoading, previewResult, handleCommit, onClose]);

	// Clear preview when form inputs change (stale result)
	const prevFormKey = useRef('');
	const formKey = `${actionType}|${targetDay}|${targetTimeSlot}|${targetRoomId}|${targetFacultyId}`;
	useEffect(() => {
		if (prevFormKey.current && prevFormKey.current !== formKey) {
			setPreviewResult(null);
			setPendingProposal(null);
		}
		prevFormKey.current = formKey;
	}, [formKey]);

	// ── Render ──

	return (
		<div className="flex flex-col h-full min-h-0 bg-muted/30">
			{/* ── Breadcrumb Bar ── */}
			<div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border bg-background/80 backdrop-blur-sm">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 gap-1.5 text-muted-foreground"
								onClick={onClose}
							aria-label={`Back to ${CLASS_SCHEDULE_LABEL} (Esc)`}
						>
							<ArrowLeft className="size-3.5" />
							Back to {CLASS_SCHEDULE_LABEL}
							<kbd className="text-[0.5625rem] bg-muted border border-border/40 rounded px-1 py-px font-mono opacity-60">Esc</kbd>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						Return to the {CLASS_SCHEDULE_LABEL} grid view
					</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<div className="h-4 w-px bg-border" />

				<div className="flex items-center gap-2 text-xs min-w-0">
					<span className="font-medium truncate">
						{subjectLabel(entry.subjectId)}
					</span>
					<span className="text-muted-foreground shrink-0">·</span>
					<span className="text-muted-foreground truncate">
						{sectionLabel(entry.sectionId)}
					</span>
					{gradeBadge && (
						<Badge
							variant="outline"
							className={`h-4 px-1 text-[0.5625rem] shrink-0 ${gradeBadge}`}
						>
							GR{grade}
						</Badge>
					)}
					<span className="text-muted-foreground shrink-0">·</span>
					<span className="text-muted-foreground truncate">
						{DAY_SHORT[entry.day]} {formatTime(entry.startTime)}–
						{formatTime(entry.endTime)}
					</span>
					<span className="text-muted-foreground shrink-0">·</span>
					<span className="text-muted-foreground truncate">
						{entry.facultyId != null ? facultyLabel(entry.facultyId) : 'Unassigned'}
					</span>
					<span className="text-muted-foreground shrink-0">·</span>
					<span className="text-muted-foreground truncate">
						{entry.roomId != null ? roomLabel(entry.roomId) : 'Unassigned'}
					</span>
				</div>

				{entryViolations.length > 0 && (
					<div className="ml-auto flex items-center gap-1 shrink-0">
						{entryViolations.filter((v) => v.severity === 'HARD').length > 0 && (
							<Badge
								variant="outline"
								className="h-5 px-1.5 text-[0.625rem] border-red-300 bg-red-50 text-red-700"
							>
								{entryViolations.filter((v) => v.severity === 'HARD').length} hard
							</Badge>
						)}
						{entryViolations.filter((v) => v.severity === 'SOFT').length > 0 && (
							<Badge
								variant="outline"
								className="h-5 px-1.5 text-[0.625rem] border-amber-300 bg-amber-50 text-amber-700"
							>
								{entryViolations.filter((v) => v.severity === 'SOFT').length} soft
							</Badge>
						)}
					</div>
				)}
			</div>

			{/* ── 2-Column Workspace ── */}
			<div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
				{/* ── LEFT: Action Form ── */}
				<div className="flex flex-col min-h-0 h-full rounded-lg border border-border bg-card overflow-hidden">
					<div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/60 bg-card">
						<h3 className="text-[0.6875rem] font-semibold text-foreground uppercase tracking-wider">
							Action
						</h3>
					</div>

					<ScrollArea className="flex-1 min-h-0">
						<div className="px-4 py-3 space-y-4">
							{/* Action type selector */}
							<div className="space-y-1.5">
								<Label className="text-xs">Edit Type</Label>
								<div className="flex gap-1.5">
									<Button
										variant={
											actionType === 'CHANGE_TIMESLOT'
												? 'default'
												: 'outline'
										}
										size="sm"
										className="h-7 text-xs gap-1"
										onClick={() => switchAction('CHANGE_TIMESLOT')}
										aria-label="Move Timeslot"
									>
										<Clock className="size-3" />
										Timeslot
									</Button>
									<Button
										variant={
											actionType === 'CHANGE_ROOM' ? 'default' : 'outline'
										}
										size="sm"
										className="h-7 text-xs gap-1"
										onClick={() => switchAction('CHANGE_ROOM')}
										aria-label="Change Room"
									>
										<DoorOpen className="size-3" />
										Room
									</Button>
									<Button
										variant={
											actionType === 'CHANGE_FACULTY'
												? 'default'
												: 'outline'
										}
										size="sm"
										className="h-7 text-xs gap-1"
										onClick={() => switchAction('CHANGE_FACULTY')}
										aria-label="Change Teaching Load owner"
									>
										<Users className="size-3" />
										Faculty
									</Button>
								</div>
							</div>

							{/* Last preview chip (visible when user returns to form after previewing) */}
							{lastPreviewSummary && !previewResult && (
								<div className="rounded border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
									Last preview:{' '}
									{lastPreviewSummary.hard > 0 && (
										<span className="text-red-600 font-medium">
											{lastPreviewSummary.hard} hard
										</span>
									)}
									{lastPreviewSummary.hard > 0 &&
										lastPreviewSummary.soft > 0 &&
										', '}
									{lastPreviewSummary.soft > 0 && (
										<span className="text-amber-600 font-medium">
											{lastPreviewSummary.soft} soft
										</span>
									)}
									{lastPreviewSummary.hard === 0 &&
										lastPreviewSummary.soft === 0 && (
											<span className="text-green-600 font-medium">
												no conflicts
											</span>
										)}
								</div>
							)}

							{/* ── Timeslot form ── */}
							{actionType === 'CHANGE_TIMESLOT' && (
								<>
									<div className="space-y-1.5">
										<Label htmlFor="target-day" className="text-xs">
											Target Day
										</Label>
										<Select value={targetDay} onValueChange={setTargetDay}>
											<SelectTrigger
												id="target-day"
												className="h-8 text-xs"
												aria-label="Select target day"
											>
												<SelectValue placeholder="Select day" />
											</SelectTrigger>
											<SelectContent>
												{DAYS.map((d) => (
													<SelectItem
														key={d}
														value={d}
														className="text-xs"
													>
														{DAY_SHORT[d]}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-1.5">
										<Label htmlFor="target-time" className="text-xs">
											Target Time Slot
										</Label>
										<Select
											value={targetTimeSlot}
											onValueChange={setTargetTimeSlot}
										>
											<SelectTrigger
												id="target-time"
												className="h-8 text-xs"
												aria-label="Select target time slot"
											>
												<SelectValue placeholder="Select time" />
											</SelectTrigger>
											<SelectContent>
												{freeTimeSlots.map((ts) => {
													/* A2 mc S3c — an occupied period names WHO is there and
													   whether the two can swap, instead of a struck-through
													   ` (occupied)`. `Swap with <subject> (<teacher>)` is the
													   exact label shape from the packet; where no legal partner
													   exists the option says so in the same plain words. */
													const offer = ts.occupied ? swapOfferFor(ts.startTime, ts.endTime) : undefined;
													const occupantNote = ts.occupied
														? offer
															? ` · ${offer.allowed ? offer.label : `Not a swap: ${offer.blockedReason}`}`
															: ' · Taken by another class in this view'
														: '';
													return (
														<SelectItem
															key={ts.key}
															value={ts.key}
															className={`text-xs ${ts.occupied ? 'text-amber-700' : ''}`}
															data-swap-state={ts.occupied ? (offer?.allowed ? 'swap-allowed' : 'swap-blocked') : 'free'}
														>
															{formatTime(ts.startTime)} – {formatTime(ts.endTime)}
															{occupantNote}
														</SelectItem>
													);
												})}
											</SelectContent>
										</Select>
									</div>
								</>
							)}

							{/* ── Room form ── */}
							{actionType === 'CHANGE_ROOM' && (
								<div className="space-y-3">
									<div className="space-y-1.5">
										<Label htmlFor="target-room" className="text-xs">
											Target Room
										</Label>
																				{/* C11 M2 — the rooms FREE at this class's own time, one click each. The
										    full searchable `SearchableSelect` stays below it, so a room this view
										    did not offer is still reachable. Derived from `roomMap`/`draftEntries`
										    — no new fetch, and no second source of truth beside the grid. */}
										{freeRoomOptions.length > 0 ? (
											<div className="flex flex-wrap gap-1" data-testid="manual-edit-free-rooms">
												{freeRoomOptions.map((room) => (
													<Button
														key={room.id}
														type="button"
														variant={String(targetRoomId) === String(room.id) ? 'default' : 'outline'}
														size="sm"
														className="h-8 px-2 text-xs"
														onClick={() => setTargetRoomId(String(room.id))}
														data-testid={`manual-edit-free-room-${room.id}`}
													>
														{room.label}
													</Button>
												))}
											</div>
										) : (
											/* C11 M2 — the NEGATIVE case the recorded walk never got. Named
											   plainly in one sentence, and the selection is untouched: no
											   target is cleared and no control is dismissed, so the operator
											   keeps the class they are working on. */
											<p className="text-xs text-muted-foreground" data-testid="manual-edit-no-free-room">
												{NO_OTHER_ROOM_FREE}
											</p>
										)}
										<SearchableSelect
											groups={roomSearchGroups}
											value={targetRoomId}
											onValueChange={setTargetRoomId}
											placeholder="Search rooms…"
											triggerClassName="h-8 text-xs w-full"
										/>
									</div>
									
									{/* Feature Check Display */}
									{(() => {
										const subject = subjectMap.get(entry.subjectId);
										const selectedRoom = roomMap.get(Number(targetRoomId));
										// A2-CUSTODY: normalise both optional fields once. This line used to
										// read `!selectedRoom?.features.length`, whose optional chaining
										// guards only an absent ROOM — an absent `features` still threw,
										// which crashed /timetable for any subject with no required
										// features. No control may crash the page over a missing field.
										const requiredFeatures = subject?.requiredFeatures ?? [];
										const roomFeatures = selectedRoom?.features ?? [];
										if (!subject || (requiredFeatures.length === 0 && roomFeatures.length === 0)) return null;

										return (
											<div className="rounded-md border border-border/50 bg-muted/20 p-2.5 space-y-2">
												<div className="text-[0.625rem] font-semibold text-muted-foreground uppercase tracking-tight">Requirement vs capability</div>
												
												<div className="space-y-1.5">
													<p className="text-[0.65rem] font-medium flex items-center gap-1.5">
														<span className="text-muted-foreground">Subject requires:</span>
														{requiredFeatures.length > 0 ? (
															requiredFeatures.map((f: string) => (
																<Badge key={f} variant="outline" className="text-[0.55rem] px-1 py-0 border-amber-200 bg-amber-50 text-amber-700">{f}</Badge>
															))
														) : <span className="italic text-muted-foreground/60">No specific features</span>}
													</p>

													<p className="text-[0.65rem] font-medium flex items-center gap-1.5">
														<span className="text-muted-foreground">Room provides:</span>
														{roomFeatures.length > 0 ? (
															roomFeatures.map((f: string) => (
																<Badge key={f} variant="outline" className="text-[0.55rem] px-1 py-0 border-sky-200 bg-sky-50 text-sky-700">{f}</Badge>
															))
														) : <span className="italic text-muted-foreground/60">No features tagged</span>}
													</p>
												</div>

												{selectedRoom && requiredFeatures.some((f: string) => !roomFeatures.includes(f)) && (
													<div className="flex items-center gap-1.5 text-[0.65rem] text-red-600 font-medium pt-1 border-t border-border/40">
														<AlertCircle className="size-3" />
														Lacks: {requiredFeatures.filter((f: string) => !roomFeatures.includes(f)).join(', ')}
													</div>
												)}
											</div>
										);
									})()}
								</div>
							)}

							{/* ── Faculty form ── */}
							{actionType === 'CHANGE_FACULTY' && (
								<div className="space-y-3">
									<div className="space-y-1.5">
										<Label htmlFor="target-faculty" className="text-xs">
											Target Faculty
										</Label>
										<SearchableSelect
											groups={facultySearchGroups}
											value={targetFacultyId}
											onValueChange={setTargetFacultyId}
											placeholder="Search owners..."
											triggerClassName="h-8 text-xs w-full"
										/>
									</div>

									{/* Qualification Check Display */}
									{(() => {
										const subject = subjectMap.get(entry.subjectId);
										const faculty = facultyMap.get(Number(targetFacultyId));
										if (!subject || !faculty) return null;
										
										const tier = getQualificationTier(faculty, subject);
										
										return (
											<div className={`rounded-md border p-2.5 flex items-start gap-3 transition-colors ${
												tier === 1 ? 'border-emerald-200 bg-emerald-50/30' :
												tier === 2 ? 'border-sky-200 bg-sky-50/30' :
												tier === 3 ? 'border-amber-200 bg-amber-50/30' :
												'border-red-200 bg-red-50/30'
											}`}>
												<div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
													tier === 1 ? 'bg-emerald-100 text-emerald-600' :
													tier === 2 ? 'bg-sky-100 text-sky-600' :
													tier === 3 ? 'bg-amber-100 text-amber-600' :
													'bg-red-100 text-red-600'
												}`}>
													<Users className="size-4" />
												</div>
												<div className="space-y-1 min-w-0">
													<div className="flex items-center gap-2">
														<span className="text-xs font-bold truncate">{faculty.lastName}, {faculty.firstName}</span>
														{(tier === 1 || tier === 2) && <Badge className="text-[0.55rem] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 px-1 py-0">Department Match</Badge>}
														{tier === 3 && <Badge className="text-[0.55rem] bg-amber-100 text-amber-700 hover:bg-amber-100 px-1 py-0">Secondary Match</Badge>}
														{!tier && <Badge variant="destructive" className="text-[0.55rem] px-1 py-0">Unqualified</Badge>}
													</div>
													<p className="text-[0.65rem] text-muted-foreground leading-tight">
														{(tier === 1 || tier === 2) ? 'Department match: teacher belongs to the department mapped to this subject.' :
														 tier === 3 ? 'Secondary match: qualified based on specific specialization credentials.' :
														 'No qualification match found. This may cause scheduling failures.'}
													</p>
												</div>
											</div>
										);
									})()}
								</div>
							)}
						</div>
					</ScrollArea>

					{/* Sticky preview footer */}
					<div className="shrink-0 border-t border-border px-4 py-3 bg-card">
						<Button
							size="sm"
							className="w-full h-8 text-xs"
							onClick={handlePreview}
							disabled={!isFormComplete || previewLoading}
							aria-label="Preview changes (P)"
						>
							{previewLoading ? (
								<Loader2 className="size-3 mr-1.5 animate-spin" />
							) : (
								<ShieldAlert className="size-3 mr-1.5" />
							)}
							Preview Changes
							<kbd className="ml-auto text-[0.5625rem] bg-background/50 border border-border/40 rounded px-1 py-px font-mono opacity-70">P</kbd>
						</Button>
					</div>
				</div>

				{/* ── RIGHT: Conflict Inspector ──
				    A2 mc: extracted to `manual-edit/ManualEditConflictInspector.tsx`
				    because this file stood at 996 physical lines against the AGENTS.md
				    §8 cap of 1000 and slice S4 adds JSX here. Same component, same
				    testids, same classes, same props; the move changes no rendered
				    output. */}
				<ManualEditConflictInspector
					previewResult={previewResult}
					previewLoading={previewLoading}
					entryViolations={entryViolations}
					commitLoading={commitLoading}
					onCommit={handleCommit}
					formatViolationMessage={formatPanelViolationMessage}
				/>

			</div>
		</div>
	);
}
