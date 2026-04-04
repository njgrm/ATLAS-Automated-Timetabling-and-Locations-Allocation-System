/**
 * ManualEditPanel — Right-panel state machine for manual schedule edits.
 *
 * States: 'detail' → 'action-form' → 'conflict-inspector'
 *
 * Selecting a different grid cell resets to 'detail'.
 * All action inputs use shadcn primitives (no native HTML selects).
 * All conflict messages rendered from server-provided human strings.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertCircle,
	ArrowLeft,
	Check,
	CheckCircle2,
	Clock,
	DoorOpen,
	Flag,
	Loader2,
	ShieldAlert,
	Users,
	X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { formatTime } from '@/lib/utils';
import type {
	HumanConflict,
	ManualEditProposal,
	PolicyImpact,
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

/* ─── Constants ─── */

const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri',
};

const GRADE_BADGE: Record<number, string> = {
	7: 'bg-green-100 text-green-700 border-green-300',
	8: 'bg-yellow-100 text-yellow-700 border-yellow-300',
	9: 'bg-red-100 text-red-700 border-red-300',
	10: 'bg-blue-100 text-blue-700 border-blue-300',
};

const WELLBEING_CODES: Set<string> = new Set([
	'FACULTY_EXCESSIVE_TRAVEL_DISTANCE',
	'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS',
	'FACULTY_INSUFFICIENT_TRANSITION_BUFFER',
	'FACULTY_EXCESSIVE_IDLE_GAP',
	'FACULTY_EARLY_START_PREFERENCE',
	'FACULTY_LATE_END_PREFERENCE',
]);

const VIOLATION_LABELS: Record<string, string> = {
	FACULTY_TIME_CONFLICT: 'Faculty Time Conflict',
	ROOM_TIME_CONFLICT: 'Room Time Conflict',
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
};

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

/* ─── Types ─── */

type PanelState = 'detail' | 'action-form' | 'conflict-inspector';
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
	/** Available time slots derived from existing draft entries */
	timeSlots: Array<{ startTime: string; endTime: string }>;
	/** Rooms grouped by building */
	roomMap: Map<number, RoomInfo>;
	/** Faculty with load data */
	facultyMap: Map<number, FacultyMirror>;
	/** Draft entries for computing current faculty load */
	draftEntries: ScheduledEntry[];
	/** Preview API call */
	onPreview: (proposal: ManualEditProposal) => Promise<PreviewResult | null>;
	/** Commit API call */
	onCommit: (proposal: ManualEditProposal, allowSoftOverride: boolean) => Promise<void>;
	/** Loading states */
	previewLoading: boolean;
	commitLoading: boolean;
	/** Force-open the panel (called when user clicks an action button) */
	onForceOpen: () => void;
}

export default function ManualEditPanel({
	entry,
	violationIndex,
	followUps,
	onToggleFollowUp,
	onClose,
	subjectLabel,
	facultyLabel,
	sectionLabel,
	gradeForSection,
	roomLabel,
	isStaleRoom,
	timeSlots,
	roomMap,
	facultyMap,
	draftEntries,
	onPreview,
	onCommit,
	previewLoading,
	commitLoading,
	onForceOpen,
}: ManualEditPanelProps) {
	const [panelState, setPanelState] = useState<PanelState>('detail');
	const [actionType, setActionType] = useState<ActionType | null>(null);
	const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
	const [pendingProposal, setPendingProposal] = useState<ManualEditProposal | null>(null);
	const [softAcknowledged, setSoftAcknowledged] = useState(false);

	// Action form state
	const [targetDay, setTargetDay] = useState<string>('');
	const [targetTimeSlot, setTargetTimeSlot] = useState<string>('');
	const [targetRoomId, setTargetRoomId] = useState<string>('');
	const [targetFacultyId, setTargetFacultyId] = useState<string>('');

	// Reset panel when entry changes
	useEffect(() => {
		setPanelState('detail');
		setActionType(null);
		setPreviewResult(null);
		setPendingProposal(null);
		setSoftAcknowledged(false);
		setTargetDay('');
		setTargetTimeSlot('');
		setTargetRoomId('');
		setTargetFacultyId('');
	}, [entry.entryId]);

	// Compute faculty load from draft entries
	const facultyLoadMap = useMemo(() => {
		const loads = new Map<number, number>();
		for (const e of draftEntries) {
			loads.set(e.facultyId, (loads.get(e.facultyId) ?? 0) + e.durationMinutes);
		}
		return loads;
	}, [draftEntries]);

	// Teaching rooms grouped by building
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

	const startAction = useCallback((type: ActionType) => {
		onForceOpen();
		setActionType(type);
		setPanelState('action-form');
		setPreviewResult(null);
		setPendingProposal(null);
		setSoftAcknowledged(false);
		// Pre-fill with current values
		if (type === 'CHANGE_TIMESLOT') {
			setTargetDay(entry.day);
			setTargetTimeSlot(`${entry.startTime}-${entry.endTime}`);
		} else if (type === 'CHANGE_ROOM') {
			setTargetRoomId(String(entry.roomId));
		} else if (type === 'CHANGE_FACULTY') {
			setTargetFacultyId(String(entry.facultyId));
		}
	}, [entry, onForceOpen]);

	const goBackToDetail = useCallback(() => {
		setPanelState('detail');
		setActionType(null);
		setPreviewResult(null);
		setPendingProposal(null);
		setSoftAcknowledged(false);
	}, []);

	const goBackToForm = useCallback(() => {
		setPanelState('action-form');
		setPreviewResult(null);
		setPendingProposal(null);
		setSoftAcknowledged(false);
	}, []);

	const handlePreview = useCallback(async () => {
		let proposal: ManualEditProposal;

		if (actionType === 'CHANGE_TIMESLOT') {
			const [startTime, endTime] = targetTimeSlot.split('-');
			proposal = {
				editType: 'CHANGE_TIMESLOT',
				entryId: entry.entryId,
				targetDay: targetDay,
				targetStartTime: startTime,
				targetEndTime: endTime,
			};
		} else if (actionType === 'CHANGE_ROOM') {
			proposal = {
				editType: 'CHANGE_ROOM',
				entryId: entry.entryId,
				targetRoomId: Number(targetRoomId),
			};
		} else if (actionType === 'CHANGE_FACULTY') {
			proposal = {
				editType: 'CHANGE_FACULTY',
				entryId: entry.entryId,
				targetFacultyId: Number(targetFacultyId),
			};
		} else {
			return;
		}

		const result = await onPreview(proposal);
		if (result) {
			setPreviewResult(result);
			setPendingProposal(proposal);
			setPanelState('conflict-inspector');
			setSoftAcknowledged(false);
		}
	}, [actionType, entry, targetDay, targetTimeSlot, targetRoomId, targetFacultyId, onPreview]);

	const handleCommit = useCallback(async () => {
		if (!pendingProposal) return;
		const hasSoft = (previewResult?.softViolations.length ?? 0) > 0;
		await onCommit(pendingProposal, hasSoft && softAcknowledged);
		// Reset to detail after success (onCommit handles toast + refresh)
		setPanelState('detail');
		setActionType(null);
		setPreviewResult(null);
		setPendingProposal(null);
		setSoftAcknowledged(false);
	}, [pendingProposal, previewResult, softAcknowledged, onCommit]);

	const isFormComplete = useMemo(() => {
		if (actionType === 'CHANGE_TIMESLOT') return !!targetDay && !!targetTimeSlot;
		if (actionType === 'CHANGE_ROOM') return !!targetRoomId;
		if (actionType === 'CHANGE_FACULTY') return !!targetFacultyId;
		return false;
	}, [actionType, targetDay, targetTimeSlot, targetRoomId, targetFacultyId]);

	const entryViolations = violationIndex.get(entry.entryId) ?? [];
	const grade = gradeForSection(entry.sectionId);
	const gradeBadge = grade ? GRADE_BADGE[grade] : undefined;
	const isFollowUp = followUps.has(entry.entryId);

	// ── Render ──

	return (
		<div className="flex flex-col h-full min-h-0">
			<AnimatePresence mode="wait">
				{panelState === 'detail' && (
					<motion.div
						key="detail"
						initial={{ opacity: 0, x: 10 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -10 }}
						transition={{ duration: 0.12 }}
						className="flex flex-col h-full min-h-0"
					>
						{/* Header */}
						<div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
							<span className="text-xs font-semibold">Entry Details</span>
							<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose} aria-label="Close detail panel">
								<X className="size-3.5" />
							</Button>
						</div>

						{/* Scrollable content */}
						<ScrollArea className="flex-1 min-h-0">
							<div className="px-3 py-3 space-y-3">
								<DetailRow label="Subject" value={subjectLabel(entry.subjectId)} />
								<DetailRow label="Section">
									<div className="flex items-center gap-1.5">
										<span className="text-xs">{sectionLabel(entry.sectionId)}</span>
										{gradeBadge && (
											<Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] ${gradeBadge}`}>G{grade}</Badge>
										)}
									</div>
								</DetailRow>
								<DetailRow label="Faculty" value={facultyLabel(entry.facultyId)} />
								<DetailRow label="Room">
									<div className="flex items-center gap-1.5">
										<span className="text-xs">{roomLabel(entry.roomId)}</span>
										{isStaleRoom(entry.roomId) && (
											<Badge variant="outline" className="h-4 px-1 text-[0.5625rem] border-amber-300 bg-amber-50 text-amber-700">stale</Badge>
										)}
									</div>
								</DetailRow>
								<DetailRow label="Schedule" value={`${DAY_SHORT[entry.day] ?? entry.day} ${formatTime(entry.startTime)}–${formatTime(entry.endTime)}`} />
								<DetailRow label="Duration" value={`${entry.durationMinutes} min`} />

								{/* Linked violations */}
								{entryViolations.length > 0 && (
									<div className="space-y-1.5">
										<span className="text-[0.6875rem] font-medium text-muted-foreground">Violations ({entryViolations.length})</span>
										{entryViolations.map((v, i) => (
											<div key={i} className={`rounded border px-2 py-1.5 text-[0.625rem] leading-tight ${v.severity === 'HARD' ? 'border-red-300 bg-red-50 text-red-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
												<div className="font-medium">{VIOLATION_LABELS[v.code] ?? v.code}</div>
												<div className="mt-0.5 opacity-80">{v.message}</div>
											</div>
										))}
									</div>
								)}

								{/* Mobility impact */}
								{(() => {
									const travelViolations = entryViolations.filter((v) => WELLBEING_CODES.has(v.code));
									if (travelViolations.length === 0) return null;
									return (
										<div className="space-y-1.5">
											<span className="text-[0.6875rem] font-medium text-purple-700">Mobility Impact</span>
											<div className="rounded border border-purple-200 bg-purple-50/50 px-2 py-1.5 text-[0.625rem] text-purple-800 space-y-0.5">
												<div>{travelViolations.length} travel/well-being concern{travelViolations.length !== 1 ? 's' : ''}</div>
											</div>
										</div>
									);
								})()}
							</div>
						</ScrollArea>

						{/* Sticky action footer */}
						<div className="shrink-0 border-t border-border px-3 py-2.5 space-y-1.5 bg-background">
							<span className="text-[0.6875rem] font-medium text-muted-foreground">Actions</span>
							<Button variant="outline" size="sm" className="w-full h-7 text-xs justify-start" onClick={() => startAction('CHANGE_TIMESLOT')} aria-label="Move timeslot">
								<Clock className="size-3 mr-1.5" />Move Timeslot
							</Button>
							<Button variant="outline" size="sm" className="w-full h-7 text-xs justify-start" onClick={() => startAction('CHANGE_ROOM')} aria-label="Change room">
								<DoorOpen className="size-3 mr-1.5" />Change Room
							</Button>
							<Button variant="outline" size="sm" className="w-full h-7 text-xs justify-start" onClick={() => startAction('CHANGE_FACULTY')} aria-label="Reassign faculty">
								<Users className="size-3 mr-1.5" />Reassign Faculty
							</Button>
							<Button
								variant={isFollowUp ? 'default' : 'outline'}
								size="sm"
								className="w-full h-7 text-xs justify-start"
								onClick={() => onToggleFollowUp(entry.entryId)}
								aria-label={isFollowUp ? 'Remove follow-up flag' : 'Mark for follow-up'}
							>
								<Flag className={`size-3 mr-1.5 ${isFollowUp ? 'text-primary-foreground' : 'text-amber-500'}`} />
								{isFollowUp ? 'Remove Follow-up' : 'Mark for Follow-up'}
							</Button>
						</div>
					</motion.div>
				)}

				{panelState === 'action-form' && actionType && (
					<motion.div
						key="action-form"
						initial={{ opacity: 0, x: 10 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -10 }}
						transition={{ duration: 0.12 }}
						className="flex flex-col h-full min-h-0"
					>
						{/* Header */}
						<div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border">
							<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={goBackToDetail} aria-label="Back to details">
								<ArrowLeft className="size-3.5" />
							</Button>
							<span className="text-xs font-semibold">
								{actionType === 'CHANGE_TIMESLOT' && 'Move Timeslot'}
								{actionType === 'CHANGE_ROOM' && 'Change Room'}
								{actionType === 'CHANGE_FACULTY' && 'Reassign Faculty'}
							</span>
						</div>

						{/* Current entry summary */}
						<div className="shrink-0 px-3 py-2 border-b border-border bg-muted/30 text-[0.625rem] space-y-0.5">
							<div className="font-medium text-foreground">{subjectLabel(entry.subjectId)} · {sectionLabel(entry.sectionId)}</div>
							<div className="text-muted-foreground">
								{DAY_SHORT[entry.day]} {formatTime(entry.startTime)}–{formatTime(entry.endTime)} · {roomLabel(entry.roomId)} · {facultyLabel(entry.facultyId)}
							</div>
						</div>

						{/* Form content */}
						<ScrollArea className="flex-1 min-h-0">
							<div className="px-3 py-3 space-y-3">
								{actionType === 'CHANGE_TIMESLOT' && (
									<>
										<div className="space-y-1.5">
											<Label htmlFor="target-day" className="text-[0.6875rem]">Target Day</Label>
											<Select value={targetDay} onValueChange={setTargetDay}>
												<SelectTrigger id="target-day" className="h-8 text-xs" aria-label="Select target day">
													<SelectValue placeholder="Select day" />
												</SelectTrigger>
												<SelectContent>
													{DAYS.map((d) => (
														<SelectItem key={d} value={d} className="text-xs">{DAY_SHORT[d]}</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="target-time" className="text-[0.6875rem]">Target Time Slot</Label>
											<Select value={targetTimeSlot} onValueChange={setTargetTimeSlot}>
												<SelectTrigger id="target-time" className="h-8 text-xs" aria-label="Select target time slot">
													<SelectValue placeholder="Select time" />
												</SelectTrigger>
												<SelectContent>
													{timeSlots.map((ts) => (
														<SelectItem key={`${ts.startTime}-${ts.endTime}`} value={`${ts.startTime}-${ts.endTime}`} className="text-xs">
															{formatTime(ts.startTime)} – {formatTime(ts.endTime)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</>
								)}

								{actionType === 'CHANGE_ROOM' && (
									<div className="space-y-1.5">
										<Label htmlFor="target-room" className="text-[0.6875rem]">Target Room</Label>
										<Select value={targetRoomId} onValueChange={setTargetRoomId}>
											<SelectTrigger id="target-room" className="h-8 text-xs" aria-label="Select target room">
												<SelectValue placeholder="Select room" />
											</SelectTrigger>
											<SelectContent>
												{roomsByBuilding.map((group) => (
													<SelectGroup key={group.buildingId}>
														<SelectLabel className="text-[0.625rem] text-muted-foreground">{group.label}</SelectLabel>
														{group.rooms.map((r) => (
															<SelectItem key={r.id} value={String(r.id)} className="text-xs">
																{r.name} · Floor {r.floor}{r.capacity != null ? ` · Cap ${r.capacity}` : ''} · {r.type}
															</SelectItem>
														))}
													</SelectGroup>
												))}
											</SelectContent>
										</Select>
									</div>
								)}

								{actionType === 'CHANGE_FACULTY' && (
									<div className="space-y-1.5">
										<Label htmlFor="target-faculty" className="text-[0.6875rem]">Target Faculty</Label>
										<Select value={targetFacultyId} onValueChange={setTargetFacultyId}>
											<SelectTrigger id="target-faculty" className="h-8 text-xs" aria-label="Select target faculty">
												<SelectValue placeholder="Select faculty" />
											</SelectTrigger>
											<SelectContent>
												{Array.from(facultyMap.values())
													.filter((f) => f.isActiveForScheduling)
													.sort((a, b) => `${a.lastName}, ${a.firstName}`.localeCompare(`${b.lastName}, ${b.firstName}`))
													.map((f) => {
														const loadMinutes = facultyLoadMap.get(f.id) ?? 0;
														const loadHours = Math.round(loadMinutes / 60);
														return (
															<SelectItem key={f.id} value={String(f.id)} className="text-xs">
																{f.lastName}, {f.firstName} — {loadHours}h / {f.maxHoursPerWeek}h max
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
						<div className="shrink-0 border-t border-border px-3 py-2.5 bg-background">
							<Button
								size="sm"
								className="w-full h-8 text-xs"
								onClick={handlePreview}
								disabled={!isFormComplete || previewLoading}
								aria-label="Preview changes"
							>
								{previewLoading ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <ShieldAlert className="size-3 mr-1.5" />}
								Preview Changes
							</Button>
						</div>
					</motion.div>
				)}

				{panelState === 'conflict-inspector' && previewResult && (
					<motion.div
						key="conflict-inspector"
						initial={{ opacity: 0, x: 10 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -10 }}
						transition={{ duration: 0.12 }}
						className="flex flex-col h-full min-h-0"
					>
						{/* Header */}
						<div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border">
							<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={goBackToForm} aria-label="Back to action form">
								<ArrowLeft className="size-3.5" />
							</Button>
							<span className="text-xs font-semibold">Conflict Inspector</span>
							<div className="ml-auto flex items-center gap-1">
								{previewResult.hardViolations.length > 0 && (
									<Badge variant="outline" className="h-4 px-1 text-[0.5625rem] border-red-300 bg-red-50 text-red-700">
										{previewResult.hardViolations.length} hard
									</Badge>
								)}
								{previewResult.softViolations.length > 0 && (
									<Badge variant="outline" className="h-4 px-1 text-[0.5625rem] border-amber-300 bg-amber-50 text-amber-700">
										{previewResult.softViolations.length} soft
									</Badge>
								)}
							</div>
						</div>

						{/* Scrollable conflict content */}
						<ScrollArea className="flex-1 min-h-0">
							<div className="px-3 py-3 space-y-3">
								{/* Violation delta summary */}
								<div className="rounded border border-border bg-muted/30 px-2.5 py-2 text-[0.625rem] space-y-0.5">
									<div className="font-medium text-foreground">Violation Delta</div>
									<div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
										<span>Hard: {previewResult.violationDelta.hardBefore} → {previewResult.violationDelta.hardAfter}</span>
										<span className={previewResult.violationDelta.hardAfter > previewResult.violationDelta.hardBefore ? 'text-red-600 font-medium' : previewResult.violationDelta.hardAfter < previewResult.violationDelta.hardBefore ? 'text-green-600 font-medium' : ''}>
											{previewResult.violationDelta.hardAfter > previewResult.violationDelta.hardBefore ? `+${previewResult.violationDelta.hardAfter - previewResult.violationDelta.hardBefore}` : previewResult.violationDelta.hardAfter < previewResult.violationDelta.hardBefore ? `${previewResult.violationDelta.hardAfter - previewResult.violationDelta.hardBefore}` : 'no change'}
										</span>
										<span>Soft: {previewResult.violationDelta.softBefore} → {previewResult.violationDelta.softAfter}</span>
										<span className={previewResult.violationDelta.softAfter > previewResult.violationDelta.softBefore ? 'text-amber-600 font-medium' : previewResult.violationDelta.softAfter < previewResult.violationDelta.softBefore ? 'text-green-600 font-medium' : ''}>
											{previewResult.violationDelta.softAfter > previewResult.violationDelta.softBefore ? `+${previewResult.violationDelta.softAfter - previewResult.violationDelta.softBefore}` : previewResult.violationDelta.softAfter < previewResult.violationDelta.softBefore ? `${previewResult.violationDelta.softAfter - previewResult.violationDelta.softBefore}` : 'no change'}
										</span>
									</div>
								</div>

								{/* Hard conflicts */}
								{previewResult.humanConflicts.filter((c) => c.severity === 'HARD').length > 0 && (
									<div className="space-y-1.5">
										<div className="flex items-center gap-1.5">
											<AlertCircle className="size-3 text-red-600" />
											<span className="text-[0.6875rem] font-semibold text-red-700">
												Hard Conflicts ({previewResult.humanConflicts.filter((c) => c.severity === 'HARD').length})
											</span>
										</div>
										{previewResult.humanConflicts
											.filter((c) => c.severity === 'HARD')
											.map((c, i) => (
												<div key={i} className="rounded border-l-[3px] border-l-red-500 border border-red-200 bg-red-50/80 px-2.5 py-2 text-[0.625rem]">
													<div className="font-semibold text-red-800">{c.humanTitle}</div>
													<div className="mt-0.5 text-red-700">{c.humanDetail}</div>
													{c.delta && (
														<div className="mt-1 pt-1 border-t border-red-200/60 text-[0.5625rem] text-red-600 font-mono">{c.delta}</div>
													)}
												</div>
											))}
									</div>
								)}

								{/* Soft warnings */}
								{previewResult.humanConflicts.filter((c) => c.severity === 'SOFT').length > 0 && (
									<div className="space-y-1.5">
										<div className="flex items-center gap-1.5">
											<AlertCircle className="size-3 text-amber-600" />
											<span className="text-[0.6875rem] font-semibold text-amber-700">
												Soft Warnings ({previewResult.humanConflicts.filter((c) => c.severity === 'SOFT').length})
											</span>
										</div>
										{previewResult.humanConflicts
											.filter((c) => c.severity === 'SOFT')
											.map((c, i) => (
												<div key={i} className="rounded border-l-[3px] border-l-amber-500 border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-[0.625rem]">
													<div className="font-semibold text-amber-800">{c.humanTitle}</div>
													<div className="mt-0.5 text-amber-700">{c.humanDetail}</div>
													{c.delta && (
														<div className="mt-1 pt-1 border-t border-amber-200/60 text-[0.5625rem] text-amber-600 font-mono">{c.delta}</div>
													)}
												</div>
											))}
									</div>
								)}

								{/* Clean result */}
								{previewResult.humanConflicts.length === 0 && (
									<div className="flex flex-col items-center justify-center py-6 text-center">
										<CheckCircle2 className="size-8 text-green-500 mb-2" />
										<span className="text-xs font-medium text-green-700">No Conflicts</span>
										<span className="text-[0.625rem] text-muted-foreground mt-0.5">This change introduces no violations.</span>
									</div>
								)}

								{/* Policy impact summary */}
								{previewResult.policyImpactSummary.length > 0 && (
									<div className="space-y-1.5">
										<span className="text-[0.6875rem] font-medium text-muted-foreground">Policy Impact</span>
										{previewResult.policyImpactSummary.map((p, i) => (
											<div key={i} className={`rounded border px-2.5 py-1.5 text-[0.625rem] ${p.severity === 'HARD' ? 'border-red-200 bg-red-50/50 text-red-700' : 'border-amber-200 bg-amber-50/50 text-amber-700'}`}>
												<div className="font-medium">{p.label}</div>
												<div className="mt-0.5 font-mono text-[0.5625rem]">{p.summary}</div>
											</div>
										))}
									</div>
								)}
							</div>
						</ScrollArea>

						{/* Sticky commit footer */}
						<div className="shrink-0 border-t border-border px-3 py-2.5 bg-background space-y-2">
							{previewResult.hardViolations.length > 0 ? (
								/* Hard conflicts present — commit blocked */
								<div className="space-y-1.5">
									<div className="flex items-center gap-1.5 text-[0.625rem] text-red-600">
										<AlertCircle className="size-3 shrink-0" />
										<span>Cannot commit — {previewResult.hardViolations.length} hard conflict{previewResult.hardViolations.length !== 1 ? 's' : ''} must be resolved first</span>
									</div>
									<Button size="sm" className="w-full h-8 text-xs" disabled aria-label="Commit blocked by hard conflicts">
										Commit Blocked
									</Button>
								</div>
							) : previewResult.softViolations.length > 0 ? (
								/* Soft only — require acknowledgment */
								<div className="space-y-1.5">
									<div className="flex items-start gap-2">
										<Checkbox
											id="soft-acknowledge"
											checked={softAcknowledged}
											onCheckedChange={(checked) => setSoftAcknowledged(checked === true)}
											className="mt-0.5"
											aria-label="Acknowledge soft warnings"
										/>
										<Label htmlFor="soft-acknowledge" className="text-[0.625rem] text-muted-foreground leading-tight cursor-pointer">
											I acknowledge {previewResult.softViolations.length} soft warning{previewResult.softViolations.length !== 1 ? 's' : ''} and accept the policy impact
										</Label>
									</div>
									<Button
										size="sm"
										className="w-full h-8 text-xs"
										variant="default"
										onClick={handleCommit}
										disabled={!softAcknowledged || commitLoading}
										aria-label="Apply changes with warnings"
									>
										{commitLoading ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <ShieldAlert className="size-3 mr-1.5" />}
										Apply with Warnings
									</Button>
								</div>
							) : (
								/* Clean — simple commit */
								<Button
									size="sm"
									className="w-full h-8 text-xs"
									onClick={handleCommit}
									disabled={commitLoading}
									aria-label="Commit changes"
								>
									{commitLoading ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <Check className="size-3 mr-1.5" />}
									Commit Changes
								</Button>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

/* ─── Detail Row ─── */

function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
	return (
		<div className="flex justify-between items-start gap-2">
			<span className="text-[0.6875rem] text-muted-foreground shrink-0">{label}</span>
			{children ?? <span className="text-xs font-medium text-right">{value}</span>}
		</div>
	);
}
