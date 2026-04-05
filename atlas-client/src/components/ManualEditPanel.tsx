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
import {
	AlertCircle,
	ArrowLeft,
	Check,
	CheckCircle2,
	Clock,
	DoorOpen,
	Loader2,
	ShieldAlert,
	Users,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { formatTime } from '@/lib/utils';
import type {
	ManualEditProposal,
	PreviewResult,
	ScheduledEntry,
	FacultyMirror,
	Violation,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Label } from '@/ui/label';
import { ScrollArea } from '@/ui/scroll-area';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@/ui/select';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/ui/tooltip';

/* ─── Constants ─── */

const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

const GRADE_BADGE: Record<number, string> = {
	7: 'bg-green-100 text-green-700 border-green-300',
	8: 'bg-yellow-100 text-yellow-700 border-yellow-300',
	9: 'bg-red-100 text-red-700 border-red-300',
	10: 'bg-blue-100 text-blue-700 border-blue-300',
};

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

/* ─── Types ─── */

type ActionType = 'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY';

type RoomInfo = {
	id: number;
	name: string;
	buildingId: number;
	buildingName: string;
	buildingShortCode: string | null;
	floor: number;
	type: string;
	capacity?: number | null;
	isTeachingSpace: boolean;
};

export interface ManualEditPanelProps {
	entry: ScheduledEntry;
	violationIndex: Map<string, Violation[]>;
	followUps: Set<string>;
	onToggleFollowUp: (id: string) => void;
	onClose: () => void;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	gradeForSection: (sectionId: number) => number | null;
	roomLabel: (roomId: number) => string;
	isStaleRoom: (roomId: number) => boolean;
	/** All time slots derived from draft entries */
	timeSlots: Array<{ startTime: string; endTime: string }>;
	/** Rooms (teaching + non-teaching) */
	roomMap: Map<number, RoomInfo>;
	/** Faculty with load data */
	facultyMap: Map<number, FacultyMirror>;
	/** Draft entries for computing current faculty load + free-slot filtering */
	draftEntries: ScheduledEntry[];
	/** Preview API call */
	onPreview: (proposal: ManualEditProposal) => Promise<PreviewResult | null>;
	/** Commit API call */
	onCommit: (proposal: ManualEditProposal, allowSoftOverride: boolean) => Promise<void>;
	/** Loading states */
	previewLoading: boolean;
	commitLoading: boolean;
	/** Which action to auto-start on mount (from right panel button) */
	initialAction?: ActionType | null;
	/** No-op stub kept for interface compat */
	onForceOpen: () => void;
}

/* ─── Helpers ─── */

/** Build a human-readable violation-delta sentence. */
function deltaSentence(delta: PreviewResult['violationDelta']): {
	text: string;
	color: string;
} {
	const hardDiff = delta.hardAfter - delta.hardBefore;
	const softDiff = delta.softAfter - delta.softBefore;

	const parts: string[] = [];
	if (hardDiff > 0) parts.push(`increases hard violations by ${hardDiff}`);
	else if (hardDiff < 0) parts.push(`reduces hard violations by ${Math.abs(hardDiff)}`);
	if (softDiff > 0) parts.push(`increases soft warnings by ${softDiff}`);
	else if (softDiff < 0) parts.push(`reduces soft warnings by ${Math.abs(softDiff)}`);

	if (parts.length === 0)
		return { text: 'No change in violation counts.', color: 'text-muted-foreground' };

	const sentence = 'This change ' + parts.join(' and ') + '.';
	const isWorse = hardDiff > 0;
	const isBetter = hardDiff < 0 && softDiff <= 0;
	return {
		text: sentence,
		color: isWorse ? 'text-red-600' : isBetter ? 'text-green-600' : 'text-amber-600',
	};
}

/** Build set of occupied (startTime-endTime) keys for a given faculty/room on a target day. */
function buildOccupiedSlots(
	draftEntries: ScheduledEntry[],
	currentEntryId: string,
	targetDay: string,
	entryFacultyId: number,
	entryRoomId: number,
): Set<string> {
	const occupied = new Set<string>();
	for (const e of draftEntries) {
		if (e.entryId === currentEntryId) continue;
		if (e.day !== targetDay) continue;
		if (e.facultyId === entryFacultyId || e.roomId === entryRoomId) {
			occupied.add(`${e.startTime}-${e.endTime}`);
		}
	}
	return occupied;
}

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
	draftEntries,
	onPreview,
	onCommit,
	previewLoading,
	commitLoading,
	initialAction,
}: ManualEditPanelProps) {
	const [actionType, setActionType] = useState<ActionType>(initialAction ?? 'CHANGE_TIMESLOT');
	const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
	const [pendingProposal, setPendingProposal] = useState<ManualEditProposal | null>(null);
	const [softAcknowledged, setSoftAcknowledged] = useState(false);
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
		setSoftAcknowledged(false);
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
		setSoftAcknowledged(false);
	}, [actionType]);

	// ── Derived data ──

	const facultyLoadMap = useMemo(() => {
		const loads = new Map<number, number>();
		for (const e of draftEntries) {
			loads.set(e.facultyId, (loads.get(e.facultyId) ?? 0) + e.durationMinutes);
		}
		return loads;
	}, [draftEntries]);

	const roomsByBuilding = useMemo(() => {
		const groups: Array<{ buildingId: number; label: string; rooms: RoomInfo[] }> = [];
		const buildingMap = new Map<number, { label: string; rooms: RoomInfo[] }>();
		for (const [, r] of roomMap) {
			if (!r.isTeachingSpace) continue;
			let group = buildingMap.get(r.buildingId);
			if (!group) {
				group = { label: r.buildingShortCode || r.buildingName, rooms: [] };
				buildingMap.set(r.buildingId, group);
			}
			group.rooms.push(r);
		}
		for (const [buildingId, group] of buildingMap) {
			group.rooms.sort((a, b) => a.name.localeCompare(b.name));
			groups.push({ buildingId, ...group });
		}
		groups.sort((a, b) => a.label.localeCompare(b.label));
		return groups;
	}, [roomMap]);

	// Pre-filter: slots occupied by current faculty or current room on the selected day
	const occupiedSlots = useMemo(
		() =>
			buildOccupiedSlots(
				draftEntries,
				entry.entryId,
				targetDay,
				entry.facultyId,
				entry.roomId,
			),
		[draftEntries, entry.entryId, targetDay, entry.facultyId, entry.roomId],
	);

	const freeTimeSlots = useMemo(
		() =>
			timeSlots.map((ts) => ({
				...ts,
				key: `${ts.startTime}-${ts.endTime}`,
				occupied: occupiedSlots.has(`${ts.startTime}-${ts.endTime}`),
			})),
		[timeSlots, occupiedSlots],
	);

	const entryViolations = violationIndex.get(entry.entryId) ?? [];
	const grade = gradeForSection(entry.sectionId);
	const gradeBadge = grade ? GRADE_BADGE[grade] : undefined;

	// ── Actions ──

	const switchAction = useCallback((type: ActionType) => {
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
			setSoftAcknowledged(false);
			setLastPreviewSummary({
				hard: result.hardViolations.length,
				soft: result.softViolations.length,
			});
		}
	}, [actionType, entry, targetDay, targetTimeSlot, targetRoomId, targetFacultyId, onPreview]);

	const handleCommit = useCallback(async () => {
		if (!pendingProposal) return;
		const hasSoft = (previewResult?.softViolations.length ?? 0) > 0;
		await onCommit(pendingProposal, hasSoft && softAcknowledged);
	}, [pendingProposal, previewResult, softAcknowledged, onCommit]);

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
				if (pendingProposal && !commitLoading) {
					const hasSoft = (previewResult?.softViolations.length ?? 0) > 0;
					if (previewResult?.hardViolations.length === 0 && (!hasSoft || softAcknowledged)) {
						e.preventDefault();
						handleCommit();
					}
				}
			} else if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [isFormComplete, previewLoading, handlePreview, pendingProposal, commitLoading, previewResult, softAcknowledged, handleCommit, onClose]);

	// Clear preview when form inputs change (stale result)
	const prevFormKey = useRef('');
	const formKey = `${actionType}|${targetDay}|${targetTimeSlot}|${targetRoomId}|${targetFacultyId}`;
	useEffect(() => {
		if (prevFormKey.current && prevFormKey.current !== formKey) {
			setPreviewResult(null);
			setPendingProposal(null);
			setSoftAcknowledged(false);
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
								aria-label="Back to timetable (Esc)"
							>
								<ArrowLeft className="size-3.5" />
								Back to Timetable
								<kbd className="text-[0.5625rem] bg-muted border border-border/40 rounded px-1 py-px font-mono opacity-60">Esc</kbd>
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							Return to the timetable grid view
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
							G{grade}
						</Badge>
					)}
					<span className="text-muted-foreground shrink-0">·</span>
					<span className="text-muted-foreground truncate">
						{DAY_SHORT[entry.day]} {formatTime(entry.startTime)}–
						{formatTime(entry.endTime)}
					</span>
					<span className="text-muted-foreground shrink-0">·</span>
					<span className="text-muted-foreground truncate">
						{facultyLabel(entry.facultyId)}
					</span>
					<span className="text-muted-foreground shrink-0">·</span>
					<span className="text-muted-foreground truncate">
						{roomLabel(entry.roomId)}
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
										aria-label="Reassign Faculty"
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
												{freeTimeSlots.map((ts) => (
													<SelectItem
														key={ts.key}
														value={ts.key}
														className={`text-xs ${ts.occupied ? 'text-muted-foreground line-through' : ''}`}
													>
														{formatTime(ts.startTime)} –{' '}
														{formatTime(ts.endTime)}
														{ts.occupied && ' (occupied)'}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<p className="text-[0.6875rem] text-muted-foreground">
											Struck-through slots are occupied by the same faculty or
											room on {DAY_SHORT[targetDay] ?? targetDay}.
										</p>
									</div>
								</>
							)}

							{/* ── Room form ── */}
							{actionType === 'CHANGE_ROOM' && (
								<div className="space-y-1.5">
									<Label htmlFor="target-room" className="text-xs">
										Target Room
									</Label>
									<Select
										value={targetRoomId}
										onValueChange={setTargetRoomId}
									>
										<SelectTrigger
											id="target-room"
											className="h-8 text-xs"
											aria-label="Select target room"
										>
											<SelectValue placeholder="Select room" />
										</SelectTrigger>
										<SelectContent>
											{roomsByBuilding.map((group) => (
												<SelectGroup key={group.buildingId}>
													<SelectLabel className="text-xs text-muted-foreground">
														{group.label}
													</SelectLabel>
													{group.rooms.map((r) => (
														<SelectItem
															key={r.id}
															value={String(r.id)}
															className="text-xs"
														>
															{r.name} · Floor {r.floor}
															{r.capacity != null
																? ` · Cap ${r.capacity}`
																: ''}{' '}
															· {r.type}
														</SelectItem>
													))}
												</SelectGroup>
											))}
										</SelectContent>
									</Select>
								</div>
							)}

							{/* ── Faculty form ── */}
							{actionType === 'CHANGE_FACULTY' && (
								<div className="space-y-1.5">
									<Label htmlFor="target-faculty" className="text-xs">
										Target Faculty
									</Label>
									<Select
										value={targetFacultyId}
										onValueChange={setTargetFacultyId}
									>
										<SelectTrigger
											id="target-faculty"
											className="h-8 text-xs"
											aria-label="Select target faculty"
										>
											<SelectValue placeholder="Select faculty" />
										</SelectTrigger>
										<SelectContent>
											{Array.from(facultyMap.values())
												.filter((f) => f.isActiveForScheduling)
												.sort((a, b) =>
													`${a.lastName}, ${a.firstName}`.localeCompare(
														`${b.lastName}, ${b.firstName}`,
													),
												)
												.map((f) => {
													const loadMinutes =
														facultyLoadMap.get(f.id) ?? 0;
													const loadHours = Math.round(
														loadMinutes / 60,
													);
													return (
														<SelectItem
															key={f.id}
															value={String(f.id)}
															className="text-xs"
														>
															{f.lastName}, {f.firstName} —{' '}
															{loadHours}h / {f.maxHoursPerWeek}h max
														</SelectItem>
													);
												})}
										</SelectContent>
									</Select>
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

				{/* ── RIGHT: Conflict Inspector ── */}
				<div className="flex flex-col min-h-0 h-full rounded-lg border border-border bg-card overflow-hidden">
					<div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/60 bg-card flex items-center justify-between">
						<h3 className="text-[0.6875rem] font-semibold text-foreground uppercase tracking-wider">
							Conflict Inspector
						</h3>
						{previewResult ? (
							<div className="flex items-center gap-1">
								{previewResult.hardViolations.length > 0 && (
									<Badge
										variant="outline"
										className="h-5 px-1.5 text-[0.625rem] border-red-300 bg-red-50 text-red-700"
									>
										{previewResult.hardViolations.length} hard
									</Badge>
								)}
								{previewResult.softViolations.length > 0 && (
									<Badge
										variant="outline"
										className="h-5 px-1.5 text-[0.625rem] border-amber-300 bg-amber-50 text-amber-700"
									>
										{previewResult.softViolations.length} soft
									</Badge>
								)}
								{previewResult.humanConflicts.length === 0 && (
									<Badge
										variant="outline"
										className="h-5 px-1.5 text-[0.625rem] border-green-300 bg-green-50 text-green-700"
									>
										clean
									</Badge>
								)}
							</div>
						) : entryViolations.length > 0 ? (
							<div className="flex items-center gap-1">
								<span className="text-[0.5625rem] text-muted-foreground mr-1">baseline</span>
								{entryViolations.filter((v) => v.severity === 'HARD').length > 0 && (
									<Badge
										variant="outline"
										className="h-5 px-1.5 text-[0.625rem] border-red-300/60 bg-red-50/60 text-red-600"
									>
										{entryViolations.filter((v) => v.severity === 'HARD').length} hard
									</Badge>
								)}
								{entryViolations.filter((v) => v.severity === 'SOFT').length > 0 && (
									<Badge
										variant="outline"
										className="h-5 px-1.5 text-[0.625rem] border-amber-300/60 bg-amber-50/60 text-amber-600"
									>
										{entryViolations.filter((v) => v.severity === 'SOFT').length} soft
									</Badge>
								)}
							</div>
						) : null}
					</div>

					<ScrollArea className="flex-1 min-h-0">
						<AnimatePresence mode="wait">
							{previewResult ? (
								<motion.div
									key="results"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.12 }}
									className="px-4 py-3 space-y-4"
								>
									{/* Violation delta — human sentence */}
									<div
										className={`rounded border border-border bg-muted/30 px-3 py-2 text-xs font-medium ${deltaSentence(previewResult.violationDelta).color}`}
									>
										{deltaSentence(previewResult.violationDelta).text}
									</div>

									{/* Hard conflicts */}
									{previewResult.humanConflicts.filter(
										(c) => c.severity === 'HARD',
									).length > 0 && (
										<div className="space-y-2">
											<div className="flex items-center gap-1.5">
												<AlertCircle className="size-3.5 text-red-600" />
												<span className="text-xs font-semibold text-red-700">
													Hard Conflicts (
													{
														previewResult.humanConflicts.filter(
															(c) => c.severity === 'HARD',
														).length
													}
													)
												</span>
											</div>
											{previewResult.humanConflicts
												.filter((c) => c.severity === 'HARD')
												.map((c, i) => (
													<div
														key={i}
														className="rounded border-l-[3px] border-l-red-500 border border-red-200 bg-red-50/80 px-3 py-2"
													>
														<div className="text-xs font-semibold text-red-800">
															{c.humanTitle}
														</div>
														<div className="mt-0.5 text-xs text-red-700">
															{c.humanDetail}
														</div>
														{c.delta && (
															<div className="mt-1 pt-1 border-t border-red-200/60 text-[0.6875rem] text-red-600 font-mono">
																{c.delta}
															</div>
														)}
													</div>
												))}
										</div>
									)}

									{/* Soft warnings */}
									{previewResult.humanConflicts.filter(
										(c) => c.severity === 'SOFT',
									).length > 0 && (
										<div className="space-y-2">
											<div className="flex items-center gap-1.5">
												<AlertCircle className="size-3.5 text-amber-600" />
												<span className="text-xs font-semibold text-amber-700">
													Soft Warnings (
													{
														previewResult.humanConflicts.filter(
															(c) => c.severity === 'SOFT',
														).length
													}
													)
												</span>
											</div>
											{previewResult.humanConflicts
												.filter((c) => c.severity === 'SOFT')
												.map((c, i) => (
													<div
														key={i}
														className="rounded border-l-[3px] border-l-amber-500 border border-amber-200 bg-amber-50/80 px-3 py-2"
													>
														<div className="text-xs font-semibold text-amber-800">
															{c.humanTitle}
														</div>
														<div className="mt-0.5 text-xs text-amber-700">
															{c.humanDetail}
														</div>
														{c.delta && (
															<div className="mt-1 pt-1 border-t border-amber-200/60 text-[0.6875rem] text-amber-600 font-mono">
																{c.delta}
															</div>
														)}
													</div>
												))}
										</div>
									)}

									{/* Clean result */}
									{previewResult.humanConflicts.length === 0 && (
										<div className="flex flex-col items-center justify-center py-8 text-center">
											<CheckCircle2 className="size-10 text-green-500 mb-2" />
											<span className="text-sm font-medium text-green-700">
												No Conflicts
											</span>
											<span className="text-xs text-muted-foreground mt-0.5">
												This change introduces no violations.
											</span>
										</div>
									)}

									{/* Policy impact summary */}
									{previewResult.policyImpactSummary.length > 0 && (
										<div className="space-y-2">
											<span className="text-xs font-medium text-muted-foreground">
												Policy Impact
											</span>
											{previewResult.policyImpactSummary.map((p, i) => (
												<div
													key={i}
													className={`rounded border px-3 py-2 text-xs ${
														p.severity === 'HARD'
															? 'border-red-200 bg-red-50/50 text-red-700'
															: 'border-amber-200 bg-amber-50/50 text-amber-700'
													}`}
												>
													<div className="font-medium">{p.label}</div>
													<div className="mt-0.5 font-mono text-[0.6875rem]">
														{p.summary}
													</div>
												</div>
											))}
										</div>
									)}
								</motion.div>
							) : (
								<motion.div
									key="baseline"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className="px-4 py-3 space-y-4"
								>
									{/* Baseline violations for this entry */}
									{entryViolations.length > 0 ? (
										<>
											<div className="rounded border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground font-medium">
												Baseline violations for this entry before any changes.
											</div>
											{entryViolations.filter((v) => v.severity === 'HARD').length > 0 && (
												<div className="space-y-2">
													<div className="flex items-center gap-1.5">
														<AlertCircle className="size-3.5 text-red-600" />
														<span className="text-xs font-semibold text-red-700">
															Hard Violations ({entryViolations.filter((v) => v.severity === 'HARD').length})
														</span>
													</div>
													{entryViolations.filter((v) => v.severity === 'HARD').map((v, i) => (
														<div
															key={i}
															className="rounded border-l-[3px] border-l-red-500 border border-red-200 bg-red-50/80 px-3 py-2"
														>
															<div className="text-xs font-semibold text-red-800">{v.code.replace(/_/g, ' ')}</div>
															<div className="mt-0.5 text-xs text-red-700">{v.message}</div>
														</div>
													))}
												</div>
											)}
											{entryViolations.filter((v) => v.severity === 'SOFT').length > 0 && (
												<div className="space-y-2">
													<div className="flex items-center gap-1.5">
														<AlertCircle className="size-3.5 text-amber-600" />
														<span className="text-xs font-semibold text-amber-700">
															Soft Warnings ({entryViolations.filter((v) => v.severity === 'SOFT').length})
														</span>
													</div>
													{entryViolations.filter((v) => v.severity === 'SOFT').map((v, i) => (
														<div
															key={i}
															className="rounded border-l-[3px] border-l-amber-500 border border-amber-200 bg-amber-50/80 px-3 py-2"
														>
															<div className="text-xs font-semibold text-amber-800">{v.code.replace(/_/g, ' ')}</div>
															<div className="mt-0.5 text-xs text-amber-700">{v.message}</div>
														</div>
													))}
												</div>
											)}
										</>
									) : (
										<div className="flex flex-col items-center justify-center py-8 text-center">
											<CheckCircle2 className="size-10 text-green-500/40 mb-2" />
											<span className="text-xs text-muted-foreground">
												No existing violations for this entry.
											</span>
											<span className="text-[0.625rem] text-muted-foreground/70 mt-1">
												Preview your changes to check for new conflicts.
											</span>
										</div>
									)}
								</motion.div>
							)}
						</AnimatePresence>
					</ScrollArea>

					{/* Sticky commit footer — only shown when preview exists */}
					{previewResult && (
						<div className="shrink-0 border-t border-border px-4 py-3 bg-card space-y-2">
							{previewResult.hardViolations.length > 0 ? (
								/* Hard conflicts — no commit button, just explanation */
								<div className="flex items-center gap-2 text-xs text-red-600">
									<AlertCircle className="size-3.5 shrink-0" />
									<span>
										Resolve {previewResult.hardViolations.length} hard
										conflict
										{previewResult.hardViolations.length !== 1
											? 's'
											: ''}{' '}
										before committing. Adjust your selection and preview
										again.
									</span>
								</div>
							) : previewResult.softViolations.length > 0 ? (
								/* Soft only — require acknowledgment */
								<div className="space-y-2">
									<div className="flex items-start gap-2">
										<Checkbox
											id="soft-acknowledge"
											checked={softAcknowledged}
											onCheckedChange={(checked) =>
												setSoftAcknowledged(checked === true)
											}
											className="mt-0.5"
											aria-label="Acknowledge soft warnings"
										/>
										<Label
											htmlFor="soft-acknowledge"
											className="text-xs text-muted-foreground leading-tight cursor-pointer"
										>
											I acknowledge{' '}
											{previewResult.softViolations.length} soft warning
											{previewResult.softViolations.length !== 1
												? 's'
												: ''}{' '}
											and accept the policy impact
										</Label>
									</div>
									<Button
										size="sm"
										className="w-full h-8 text-xs"
										variant="default"
										onClick={handleCommit}
										disabled={!softAcknowledged || commitLoading}
										aria-label="Apply changes with warnings (Enter)"
									>
										{commitLoading ? (
											<Loader2 className="size-3 mr-1.5 animate-spin" />
										) : (
											<ShieldAlert className="size-3 mr-1.5" />
										)}
										Apply with Warnings
										<kbd className="ml-auto text-[0.5625rem] bg-background/50 border border-border/40 rounded px-1 py-px font-mono opacity-70">↵</kbd>
									</Button>
								</div>
							) : (
								/* Clean — simple commit */
								<Button
									size="sm"
									className="w-full h-8 text-xs"
									onClick={handleCommit}
									disabled={commitLoading}
									aria-label="Commit changes (Enter)"
								>
									{commitLoading ? (
										<Loader2 className="size-3 mr-1.5 animate-spin" />
									) : (
										<Check className="size-3 mr-1.5" />
									)}
									Commit Changes
									<kbd className="ml-auto text-[0.5625rem] bg-background/50 border border-border/40 rounded px-1 py-px font-mono opacity-70">↵</kbd>
								</Button>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
