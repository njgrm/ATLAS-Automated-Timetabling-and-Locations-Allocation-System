import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	CalendarClock,
	GripVertical,
	Loader2,
	Lock,
	RefreshCw,
	ShieldAlert,
	Sparkles,
	Trash2,
	Undo2,
} from 'lucide-react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import type {
	DraftBoardState,
	DraftPlacement,
	DraftPlacementCommitResult,
	DraftQueueItem,
	ExternalSection,
	FacultyMirror,
	PeriodSlot,
	PreviewResult,
	RoomType,
	Subject,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { ScrollArea } from '@/ui/scroll-area';
import { SearchableSelect, type SearchableSelectGroup } from '@/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Separator } from '@/ui/separator';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

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

type PendingPlacement = {
	placementId?: number;
	entryKind: 'SECTION' | 'COHORT';
	assignmentKey: string;
	sectionId: number;
	subjectId: number;
	facultyId: number;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
	cohortCode?: string | null;
	notes?: string | null;
	expectedVersion?: number;
	source: 'queue' | 'placement';
	queueLabel: string;
	roomType: RoomType;
	expectedEnrollment: number | null;
};

type DragPayload =
	| { type: 'queue'; item: DraftQueueItem }
	| { type: 'placement'; placement: DraftPlacement };

interface LockPanelProps {
	schoolId: number;
	schoolYearId: number;
	sections: Map<number, ExternalSection>;
	subjects: Map<number, Subject>;
	faculty: Map<number, FacultyMirror>;
	rooms: Map<number, RoomInfo>;
	onBoardChange?: (board: DraftBoardState) => void;
}

function queueLabel(item: DraftQueueItem) {
	return `${item.subjectCode} · ${item.sectionName}${item.cohortCode ? ` · ${item.cohortCode}` : ''} · ${item.sessionNumber}/${item.sessionsPerWeek}`;
}

function placementLabel(placement: DraftPlacement, sections: Map<number, ExternalSection>, subjects: Map<number, Subject>) {
	const subject = subjects.get(placement.subjectId);
	const section = sections.get(placement.sectionId);
	return `${subject?.code ?? `Subj #${placement.subjectId}`} · ${section?.name ?? `Section #${placement.sectionId}`}`;
}

function slotKey(slot: PeriodSlot) {
	return `${slot.startTime}-${slot.endTime}`;
}

function placementKey(placement: PendingPlacement | DraftPlacement) {
	return [placement.sectionId, placement.subjectId, placement.cohortCode ?? 'section', placement.day, placement.startTime, placement.endTime].join(':');
}

export default function LockPanel({ schoolId, schoolYearId, sections, subjects, faculty, rooms, onBoardChange }: LockPanelProps) {
	const [board, setBoard] = useState<DraftBoardState | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
	const [pending, setPending] = useState<PendingPlacement | null>(null);
	const [preview, setPreview] = useState<PreviewResult | null>(null);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [allowSoftOverride, setAllowSoftOverride] = useState(false);
	const [gradeFilter, setGradeFilter] = useState('all');
	const [sectionFilter, setSectionFilter] = useState('all');
	const [departmentFilter, setDepartmentFilter] = useState('all');
	const [buildingFilter, setBuildingFilter] = useState('all');

	const fetchBoard = useCallback(async () => {
		if (!schoolId || !schoolYearId) return;
		try {
			setLoading(true);
			const response = await atlasApi.get<DraftBoardState>(`/generation/${schoolId}/${schoolYearId}/pre-generation-drafts`);
			setBoard(response.data);
			onBoardChange?.(response.data);
		} catch {
			toast.error('Failed to load pre-generation drafting board.');
		} finally {
			setLoading(false);
		}
	}, [schoolId, schoolYearId]);

	useEffect(() => {
		fetchBoard();
	}, [fetchBoard]);

	const filteredQueue = useMemo(() => {
		if (!board) return [];
		return board.queue.filter((item) => {
			if (gradeFilter !== 'all' && item.gradeLevel !== Number(gradeFilter)) return false;
			if (sectionFilter !== 'all' && item.sectionId !== Number(sectionFilter)) return false;
			return true;
		});
	}, [board, gradeFilter, sectionFilter]);

	const activeSectionId = useMemo(() => {
		if (sectionFilter !== 'all') return Number(sectionFilter);
		const firstQueue = filteredQueue[0]?.sectionId;
		if (firstQueue) return firstQueue;
		return board?.placements.find((placement) => placement.status === 'DRAFT')?.sectionId ?? null;
	}, [board, filteredQueue, sectionFilter]);

	const gridPlacements = useMemo(() => {
		if (!board || !activeSectionId) return [];
		return board.placements.filter((placement) => placement.status === 'DRAFT' && placement.sectionId === activeSectionId);
	}, [activeSectionId, board]);

	const gridIndex = useMemo(() => {
		const index = new Map<string, DraftPlacement[]>();
		for (const placement of gridPlacements) {
			const key = `${placement.day}-${placement.startTime}-${placement.endTime}`;
			const entries = index.get(key) ?? [];
			entries.push(placement);
			index.set(key, entries);
		}
		return index;
	}, [gridPlacements]);

	const roomList = useMemo(() => Array.from(rooms.values()).filter((room) => room.isTeachingSpace), [rooms]);

	const sectionOptions = useMemo(() => {
		const ids = new Set(filteredQueue.map((item) => item.sectionId));
		for (const placement of gridPlacements) ids.add(placement.sectionId);
		return Array.from(ids)
			.map((sectionId) => sections.get(sectionId))
			.filter((section): section is ExternalSection => Boolean(section))
			.sort((left, right) => left.name.localeCompare(right.name));
	}, [filteredQueue, gridPlacements, sections]);

	const filteredFacultyGroups = useMemo(() => {
		const groups = new Map<string, { value: string; label: string }[]>();
		for (const member of faculty.values()) {
			if (!member.isActiveForScheduling) continue;
			if (departmentFilter !== 'all' && member.department !== departmentFilter) continue;
			const groupLabel = member.department ?? 'No Department';
			const entries = groups.get(groupLabel) ?? [];
			entries.push({ value: String(member.id), label: `${member.lastName}, ${member.firstName}` });
			groups.set(groupLabel, entries);
		}
		return Array.from(groups.entries())
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([label, items]) => ({ label, items: items.sort((left, right) => left.label.localeCompare(right.label)) }));
	}, [departmentFilter, faculty]);

	const filteredRoomGroups = useMemo(() => {
		const groups = new Map<number, { label: string; items: { value: string; label: string }[] }>();
		for (const room of roomList) {
			if (buildingFilter !== 'all' && room.buildingId !== Number(buildingFilter)) continue;
			const label = room.buildingShortCode || room.buildingName;
			const group = groups.get(room.buildingId) ?? { label, items: [] };
			group.items.push({
				value: String(room.id),
				label: `${room.name} · Floor ${room.floor}${room.capacity != null ? ` · Cap ${room.capacity}` : ''} · ${room.type}`,
			});
			groups.set(room.buildingId, group);
		}
		return Array.from(groups.values())
			.sort((left, right) => left.label.localeCompare(right.label))
			.map((group) => ({ label: group.label, items: group.items.sort((left, right) => left.label.localeCompare(right.label)) }));
	}, [buildingFilter, roomList]);

	const pendingSection = pending ? sections.get(pending.sectionId) : null;
	const pendingSubject = pending ? subjects.get(pending.subjectId) : null;
	const pendingFaculty = pending ? faculty.get(pending.facultyId) : null;
	const pendingRoom = pending ? rooms.get(pending.roomId) : null;

	const chooseDefaultFaculty = useCallback((item: DraftQueueItem) => {
		const candidateIds = departmentFilter === 'all'
			? item.facultyOptions
			: item.facultyOptions.filter((facultyId) => faculty.get(facultyId)?.department === departmentFilter);
		return candidateIds[0] ?? item.facultyOptions[0] ?? Array.from(faculty.keys())[0] ?? 0;
	}, [departmentFilter, faculty]);

	const chooseDefaultRoom = useCallback((item: DraftQueueItem) => {
		const eligible = roomList.filter((room) => {
			if (buildingFilter !== 'all' && room.buildingId !== Number(buildingFilter)) return false;
			return room.type === item.preferredRoomType;
		});
		if (eligible.length > 0) return eligible[0].id;
		const fallback = roomList.find((room) => buildingFilter === 'all' || room.buildingId === Number(buildingFilter));
		return fallback?.id ?? 0;
	}, [buildingFilter, roomList]);

	const runPreview = useCallback(async (draft: PendingPlacement) => {
		try {
			setPreviewLoading(true);
			setPreviewError(null);
			const response = await atlasApi.post<PreviewResult>(`/generation/${schoolId}/${schoolYearId}/pre-generation-drafts/preview`, {
				placementId: draft.placementId,
				entryKind: draft.entryKind,
				sectionId: draft.sectionId,
				subjectId: draft.subjectId,
				facultyId: draft.facultyId,
				roomId: draft.roomId,
				day: draft.day,
				startTime: draft.startTime,
				endTime: draft.endTime,
				cohortCode: draft.cohortCode,
				notes: draft.notes,
				expectedVersion: draft.expectedVersion,
			});
			setPreview(response.data);
		} catch (error: any) {
			setPreview(null);
			setPreviewError(error?.response?.data?.message ?? 'Unable to preview this placement.');
		} finally {
			setPreviewLoading(false);
		}
	}, [schoolId, schoolYearId]);

	useEffect(() => {
		if (!pending) {
			setPreview(null);
			setPreviewError(null);
			return;
		}
		if (!pending.facultyId || !pending.roomId) return;
		void runPreview(pending);
	}, [pending, runPreview]);

	const stageQueueDrop = useCallback((item: DraftQueueItem, day: string, slot: PeriodSlot) => {
		const nextPending: PendingPlacement = {
			entryKind: item.entryKind,
			assignmentKey: item.assignmentKey,
			sectionId: item.sectionId,
			subjectId: item.subjectId,
			facultyId: chooseDefaultFaculty(item),
			roomId: chooseDefaultRoom(item),
			day,
			startTime: slot.startTime,
			endTime: slot.endTime,
			cohortCode: item.cohortCode,
			source: 'queue',
			queueLabel: queueLabel(item),
			roomType: item.preferredRoomType,
			expectedEnrollment: item.expectedEnrollment,
		};
		setAllowSoftOverride(false);
		setPending(nextPending);
	}, [chooseDefaultFaculty, chooseDefaultRoom]);

	const stagePlacementMove = useCallback((placement: DraftPlacement, day: string, slot: PeriodSlot) => {
		const subject = subjects.get(placement.subjectId);
		const nextPending: PendingPlacement = {
			placementId: placement.id,
			entryKind: placement.entryKind,
			assignmentKey: placementKey(placement),
			sectionId: placement.sectionId,
			subjectId: placement.subjectId,
			facultyId: placement.facultyId ?? 0,
			roomId: placement.roomId ?? 0,
			day,
			startTime: slot.startTime,
			endTime: slot.endTime,
			cohortCode: placement.cohortCode,
			notes: placement.notes ?? null,
			expectedVersion: placement.version,
			source: 'placement',
			queueLabel: `${subject?.code ?? `Subj #${placement.subjectId}`} move`,
			roomType: subject?.preferredRoomType ?? 'CLASSROOM',
			expectedEnrollment: sections.get(placement.sectionId)?.enrolledCount ?? null,
		};
		setAllowSoftOverride(false);
		setPending(nextPending);
	}, [sections, subjects]);

	const handleDrop = useCallback((day: string, slot: PeriodSlot) => {
		if (!dragPayload) return;
		if (dragPayload.type === 'queue') {
			stageQueueDrop(dragPayload.item, day, slot);
		} else {
			stagePlacementMove(dragPayload.placement, day, slot);
		}
		setDragPayload(null);
	}, [dragPayload, stagePlacementMove, stageQueueDrop]);

	const handleSave = useCallback(async () => {
		if (!pending) return;
		try {
			setSaving(true);
			const response = await atlasApi.post<DraftPlacementCommitResult>(`/generation/${schoolId}/${schoolYearId}/pre-generation-drafts/commit`, {
				placementId: pending.placementId,
				entryKind: pending.entryKind,
				sectionId: pending.sectionId,
				subjectId: pending.subjectId,
				facultyId: pending.facultyId,
				roomId: pending.roomId,
				day: pending.day,
				startTime: pending.startTime,
				endTime: pending.endTime,
				cohortCode: pending.cohortCode,
				notes: pending.notes,
				expectedVersion: pending.expectedVersion,
				allowSoftOverride,
			});
			setBoard(response.data.board);
			onBoardChange?.(response.data.board);
			setPreview(response.data.preview);
			setPending(null);
			setAllowSoftOverride(false);
			setPreviewError(null);
			toast.success(pending.placementId ? 'Draft placement updated.' : 'Draft placement saved.');
		} catch (error: any) {
			toast.error(error?.response?.data?.message ?? 'Unable to save draft placement.');
		} finally {
			setSaving(false);
		}
	}, [allowSoftOverride, pending, schoolId, schoolYearId]);

	const handleUndo = useCallback(async () => {
		try {
			setSaving(true);
			const response = await atlasApi.post<DraftBoardState>(`/generation/${schoolId}/${schoolYearId}/pre-generation-drafts/undo`);
			setBoard(response.data);
			onBoardChange?.(response.data);
			setPending(null);
			setPreview(null);
			setPreviewError(null);
			setAllowSoftOverride(false);
			toast.success('Last draft placement action reverted.');
		} catch (error: any) {
			toast.error(error?.response?.data?.message ?? 'Nothing to undo.');
		} finally {
			setSaving(false);
		}
	}, [schoolId, schoolYearId]);

	const handleClear = useCallback(async () => {
		try {
			setSaving(true);
			const response = await atlasApi.post<DraftBoardState>(`/generation/${schoolId}/${schoolYearId}/pre-generation-drafts/clear`);
			setBoard(response.data);
			onBoardChange?.(response.data);
			setPending(null);
			setPreview(null);
			setPreviewError(null);
			setAllowSoftOverride(false);
			toast.success('Draft placements archived for the current planning session.');
		} catch (error: any) {
			toast.error(error?.response?.data?.message ?? 'Unable to clear draft placements.');
		} finally {
			setSaving(false);
		}
	}, [schoolId, schoolYearId]);

	if (loading) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<Loader2 className="size-4 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!board) {
		return <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">Pre-generation drafting board is unavailable.</div>;
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="border-b border-border px-3 py-2">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-1.5">
						<Lock className="size-3.5 text-primary" />
						<span className="text-xs font-semibold">Pre-Generation Draft Board</span>
					</div>
					<div className="flex items-center gap-1">
						<Button variant="ghost" size="sm" className="h-6 px-2 text-[0.625rem]" onClick={() => void fetchBoard()}>
							<RefreshCw className="mr-1 size-3" />Refresh
						</Button>
						<Button variant="ghost" size="sm" className="h-6 px-2 text-[0.625rem]" onClick={() => void handleUndo()} disabled={saving}>
							<Undo2 className="mr-1 size-3" />Undo
						</Button>
						<Button variant="ghost" size="sm" className="h-6 px-2 text-[0.625rem] text-destructive hover:text-destructive" onClick={() => void handleClear()} disabled={saving}>
							<Trash2 className="mr-1 size-3" />Clear Draft
						</Button>
					</div>
				</div>
				<div className="mt-2 flex flex-wrap items-center gap-1.5">
					<Badge variant="secondary" className="h-5 px-2 text-[0.625rem]">{board.counts.unscheduled} unscheduled</Badge>
					<Badge variant="secondary" className="h-5 px-2 text-[0.625rem]">{board.counts.draft} drafted</Badge>
					<Badge variant="secondary" className="h-5 px-2 text-[0.625rem]">{board.counts.lockedForRun} locked for run</Badge>
					{pending && <Badge className="h-5 px-2 text-[0.625rem]">Pending unsaved placement</Badge>}
				</div>
			</div>

			<div className="grid shrink-0 grid-cols-2 gap-2 border-b border-border px-3 py-2">
				<Select value={gradeFilter} onValueChange={(value) => { setGradeFilter(value); if (value !== 'all') setSectionFilter('all'); }}>
					<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Grade" /></SelectTrigger>
					<SelectContent>
						<SelectItem value="all" className="text-xs">All Grades</SelectItem>
						{board.filters.grades.map((grade) => <SelectItem key={grade} value={String(grade)} className="text-xs">Grade {grade}</SelectItem>)}
					</SelectContent>
				</Select>
				<Select value={sectionFilter} onValueChange={setSectionFilter}>
					<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Section" /></SelectTrigger>
					<SelectContent>
						<SelectItem value="all" className="text-xs">Auto Section</SelectItem>
						{sectionOptions.map((section) => <SelectItem key={section.id} value={String(section.id)} className="text-xs">{section.name}</SelectItem>)}
					</SelectContent>
				</Select>
				<Select value={departmentFilter} onValueChange={setDepartmentFilter}>
					<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
					<SelectContent>
						<SelectItem value="all" className="text-xs">All Departments</SelectItem>
						{board.filters.departments.map((department) => <SelectItem key={department} value={department} className="text-xs">{department}</SelectItem>)}
					</SelectContent>
				</Select>
				<Select value={buildingFilter} onValueChange={setBuildingFilter}>
					<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Building" /></SelectTrigger>
					<SelectContent>
						<SelectItem value="all" className="text-xs">All Buildings</SelectItem>
						{board.filters.buildings.map((building) => <SelectItem key={building.id} value={String(building.id)} className="text-xs">{building.shortCode || building.name}</SelectItem>)}
					</SelectContent>
				</Select>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="space-y-3 p-3">
					<div className="rounded-lg border border-border bg-muted/20">
						<div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
							<GripVertical className="size-3 text-muted-foreground" />
							<span className="text-[0.6875rem] font-semibold">Unscheduled Required Sessions</span>
							<Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[0.5625rem]">{filteredQueue.length}</Badge>
						</div>
						<div className="space-y-1 p-2">
							{filteredQueue.length === 0 ? (
								<p className="px-1 py-2 text-[0.6875rem] text-muted-foreground">All visible demand is already drafted.</p>
							) : filteredQueue.slice(0, 18).map((item) => (
								<div
									key={`${item.assignmentKey}-${item.sessionNumber}`}
									draggable
									onDragStart={() => setDragPayload({ type: 'queue', item })}
									className="cursor-grab rounded-md border border-border bg-background px-2 py-1.5 active:cursor-grabbing"
								>
									<div className="flex items-start gap-2">
										<GripVertical className="mt-0.5 size-3 text-muted-foreground" />
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-1">
												<Badge variant="outline" className={`h-4 px-1 text-[0.5rem] ${GRADE_BADGE[item.gradeLevel] ?? ''}`}>G{item.gradeLevel}</Badge>
												<span className="truncate text-[0.6875rem] font-medium">{item.subjectCode}</span>
												<span className="text-[0.5625rem] text-muted-foreground">{item.sessionNumber}/{item.sessionsPerWeek}</span>
											</div>
											<div className="mt-0.5 text-[0.625rem] text-muted-foreground">{item.sectionName}{item.cohortCode ? ` · ${item.cohortCode}` : ''}</div>
										</div>
									</div>
								</div>
							))}
							{filteredQueue.length > 18 && <p className="px-1 text-[0.625rem] text-muted-foreground">Showing first 18 items. Use grade/section filters to narrow the queue.</p>}
						</div>
					</div>

					<div className="rounded-lg border border-border bg-background">
						<div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
							<CalendarClock className="size-3 text-primary" />
							<span className="text-[0.6875rem] font-semibold">
								{activeSectionId ? sections.get(activeSectionId)?.name ?? `Section #${activeSectionId}` : 'Select a section'}
							</span>
						</div>
						<div className="overflow-x-auto">
							<div className="min-w-170">
								<div className="grid grid-cols-[84px_repeat(5,minmax(116px,1fr))] border-b border-border bg-muted/30">
									<div className="px-2 py-2 text-[0.625rem] font-medium text-muted-foreground">Slot</div>
									{DAYS.map((day) => <div key={day} className="border-l border-border px-2 py-2 text-[0.625rem] font-medium text-muted-foreground">{DAY_SHORT[day]}</div>)}
								</div>
								{board.periodSlots.map((slot) => (
									<div key={slotKey(slot)} className="grid grid-cols-[84px_repeat(5,minmax(116px,1fr))] border-b border-border last:border-b-0">
										<div className="px-2 py-2 text-[0.625rem] text-muted-foreground">{slot.startTime} - {slot.endTime}</div>
										{DAYS.map((day) => {
											const cellPlacements = gridIndex.get(`${day}-${slot.startTime}-${slot.endTime}`) ?? [];
											const isPendingCell = pending?.day === day && pending?.startTime === slot.startTime && pending?.endTime === slot.endTime;
											return (
												<div
													key={`${day}-${slotKey(slot)}`}
													onDragOver={(event) => event.preventDefault()}
													onDrop={() => handleDrop(day, slot)}
													className={`min-h-21.5 border-l border-border p-1.5 ${isPendingCell ? 'bg-primary/5' : 'bg-background'}`}
												>
													<div className="space-y-1">
														{cellPlacements.map((placement) => {
															const subject = subjects.get(placement.subjectId);
															return (
																<div
																	key={placement.id}
																	draggable
																	onDragStart={() => setDragPayload({ type: 'placement', placement })}
																	onClick={() => stagePlacementMove(placement, placement.day, { startTime: placement.startTime, endTime: placement.endTime })}
																	className="cursor-pointer rounded border border-border bg-muted/40 px-1.5 py-1"
																>
																	<div className="truncate text-[0.625rem] font-medium">{subject?.code ?? `Subj #${placement.subjectId}`}</div>
																	<div className="truncate text-[0.5625rem] text-muted-foreground">{faculty.get(placement.facultyId ?? 0)?.lastName ?? 'Assign faculty'} · {rooms.get(placement.roomId ?? 0)?.name ?? 'Assign room'}</div>
																</div>
															);
														})}
														{isPendingCell && pending && (
															<div className="rounded border border-dashed border-primary/40 bg-primary/5 px-1.5 py-1 text-[0.5625rem] text-primary">
																Pending: {pending.queueLabel}
															</div>
														)}
													</div>
												</div>
											);
										})}
									</div>
								))}
							</div>
						</div>
					</div>

					<div className="rounded-lg border border-border bg-muted/20">
						<div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
							<Sparkles className="size-3 text-primary" />
							<span className="text-[0.6875rem] font-semibold">Persistent Conflict Inspector</span>
						</div>
						<div className="space-y-3 p-3">
							{pending ? (
								<>
									<div className="rounded-md border border-border bg-background px-2 py-2">
										<div className="flex items-center gap-1.5">
											<Badge variant="outline" className={`h-4 px-1 text-[0.5rem] ${GRADE_BADGE[pendingSection?.displayOrder ?? 0] ?? ''}`}>G{pendingSection?.displayOrder ?? '—'}</Badge>
											<div className="min-w-0 flex-1">
												<div className="truncate text-[0.6875rem] font-medium">{pendingSubject?.code ?? `Subj #${pending.subjectId}`}</div>
												<div className="truncate text-[0.625rem] text-muted-foreground">{pendingSection?.name ?? `Section #${pending.sectionId}`}{pending.cohortCode ? ` · ${pending.cohortCode}` : ''}</div>
											</div>
										</div>
										<div className="mt-2 grid grid-cols-2 gap-2">
											<Select value={pending.day} onValueChange={(value) => setPending((current) => current ? { ...current, day: value } : current)}>
												<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Day" /></SelectTrigger>
												<SelectContent>
													{DAYS.map((day) => <SelectItem key={day} value={day} className="text-xs">{DAY_SHORT[day]}</SelectItem>)}
												</SelectContent>
											</Select>
											<Select value={`${pending.startTime}-${pending.endTime}`} onValueChange={(value) => {
												const [startTime, endTime] = value.split('-');
												setPending((current) => current ? { ...current, startTime, endTime } : current);
											}}>
												<SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Slot" /></SelectTrigger>
												<SelectContent>
													{board.periodSlots.map((slot) => <SelectItem key={slotKey(slot)} value={slotKey(slot)} className="text-xs">{slot.startTime} - {slot.endTime}</SelectItem>)}
												</SelectContent>
											</Select>
										</div>
										<div className="mt-2 grid grid-cols-1 gap-2">
											<SearchableSelect
												groups={filteredFacultyGroups as SearchableSelectGroup[]}
												value={pending.facultyId ? String(pending.facultyId) : ''}
												onValueChange={(value) => setPending((current) => current ? { ...current, facultyId: Number(value) } : current)}
												placeholder="Select faculty"
												triggerClassName="h-8 w-full text-xs"
												className="w-[320px]"
											/>
											<SearchableSelect
												groups={filteredRoomGroups as SearchableSelectGroup[]}
												value={pending.roomId ? String(pending.roomId) : ''}
												onValueChange={(value) => setPending((current) => current ? { ...current, roomId: Number(value) } : current)}
												placeholder="Select room"
												triggerClassName="h-8 w-full text-xs"
												className="w-[320px]"
											/>
										</div>
										<div className="mt-2 text-[0.625rem] text-muted-foreground">
											{pendingFaculty ? `${pendingFaculty.lastName}, ${pendingFaculty.firstName}` : 'Select faculty'} · {pendingRoom ? `${pendingRoom.buildingShortCode || pendingRoom.buildingName} / ${pendingRoom.name}` : 'Select room'}
										</div>
									</div>

									{previewLoading && (
										<div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-[0.6875rem] text-muted-foreground">
											<Loader2 className="size-3 animate-spin" />Checking conflicts...
										</div>
									)}

									{previewError && (
										<div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[0.6875rem] text-destructive">{previewError}</div>
									)}

									{preview && (
										<div className="rounded-md border border-border bg-background px-3 py-2">
											<div className="flex items-center justify-between gap-2">
												<div className="text-[0.6875rem] font-medium">{preview.allowed ? 'Preview passes hard constraints' : 'Hard conflict detected'}</div>
												<div className="text-[0.625rem] text-muted-foreground">Hard {preview.violationDelta.hardBefore} → {preview.violationDelta.hardAfter} · Soft {preview.violationDelta.softBefore} → {preview.violationDelta.softAfter}</div>
											</div>
											<div className="mt-2 space-y-1">
												{preview.humanConflicts.length === 0 ? (
													<p className="text-[0.625rem] text-emerald-700">No conflicts reported for this pending placement.</p>
												) : preview.humanConflicts.map((conflict) => (
													<div key={`${conflict.code}-${conflict.humanDetail}`} className={`rounded border px-2 py-1 text-[0.625rem] ${conflict.severity === 'HARD' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
														<div className="font-medium">{conflict.humanTitle}</div>
														<div>{conflict.humanDetail}</div>
													</div>
												))}
											</div>
											{preview.softViolations.length > 0 && (
												<div className="mt-2 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-2 text-[0.625rem] text-amber-900">
													<Checkbox checked={allowSoftOverride} onCheckedChange={(checked) => setAllowSoftOverride(Boolean(checked))} />
													<span>Acknowledge soft conflicts and allow save.</span>
												</div>
											)}
										</div>
									)}

									<div className="flex items-center gap-2">
										<Button size="sm" className="h-8 text-xs" onClick={() => void handleSave()} disabled={saving || previewLoading || !preview || (!preview.allowed && !allowSoftOverride)}>
											{saving ? <Loader2 className="mr-1 size-3 animate-spin" /> : <ShieldAlert className="mr-1 size-3" />}Save Draft
										</Button>
										<Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setPending(null); setPreview(null); setPreviewError(null); setAllowSoftOverride(false); }}>
											Discard Pending
										</Button>
									</div>
								</>
							) : (
								<div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[0.6875rem] text-muted-foreground">
									Drag an unscheduled session into the grid, or drag an existing drafted placement to a new slot, to inspect conflicts before saving.
								</div>
							)}

							<Separator />
							<div className="rounded-md border border-border bg-background px-3 py-2">
								<div className="text-[0.6875rem] font-medium">Generation bootstrap notes</div>
								<p className="mt-1 text-[0.625rem] text-muted-foreground">Saved draft placements are consumed before generation, then the constructor schedules only the remaining unscheduled demand.</p>
							</div>
						</div>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
}