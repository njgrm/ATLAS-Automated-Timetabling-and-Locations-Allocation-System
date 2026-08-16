import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';

import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext, type ActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { findGradeWindow, getProgramBadgeLabel, matchesEntryKindFilter, matchesProgramFilter, resolveSectionGradeNumber } from '@/lib/schedule-review-helpers';
import {
	buildViolationIndex,
	deriveTimeSlotsFromSummary,
	minutesBetween,
} from '@/lib/timetable-utils';
import { buildLiveConflictIndex, createLiveConflictLookup } from '@/lib/timetable-live-conflict';
import type {
	Building,
	CellConflictInfo,
	DraftBoardState,
	DraftReport,
	EntryKindFilter,
	ExternalSection,
	FacultyMirror,
	GenerationRun,
	ProgramFilter,
	RoomPreferenceDecisionStatus,
	RoomPreferenceStatus,
	RoomPreferenceSummaryResponse,
	RunSummary,
	ScheduledEntry,
	SectionSummaryResponse,
	Subject,
	UnassignedItem,
	UnassignedReason,
	Violation,
	ViolationCode,
	ViolationReport,
} from '@/types';

const DEFAULT_SCHOOL_ID = 1;
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

const VIOLATION_LABELS: Record<ViolationCode, string> = {
	FACULTY_TIME_CONFLICT: 'Faculty Time Conflict',
	ROOM_TIME_CONFLICT: 'Room Time Conflict',
	SECTION_TIME_CONFLICT: 'Section Time Conflict',
	FACULTY_OVERLOAD: 'Faculty Overload',
	ROOM_TYPE_MISMATCH: 'Room Type Mismatch',
	FACULTY_SUBJECT_NOT_QUALIFIED: 'Teaching Load Review',
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: 'Consecutive Limit',
	FACULTY_BREAK_REQUIREMENT_VIOLATED: 'Break Requirement',
	FACULTY_DAILY_STANDARD_EXCEEDED: 'Daily Load Warning',
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
	LACKING_FACULTY: 'Lacking Faculty',
	INCOMPLETE_MODULAR_GROUP: 'Incomplete Modular Group',
	SPECIALIZED_ROOM_UNAVAILABLE: 'Specialized Room Unavailable',
	UNASSIGNED_SECTION: 'Unassigned Section',
	ZONE_IMBALANCE_WARNING: 'Zone Imbalance Warning',
};

const CONFLICT_CODES: Set<ViolationCode> = new Set([
	'FACULTY_TIME_CONFLICT',
	'ROOM_TIME_CONFLICT',
	'SECTION_TIME_CONFLICT',
]);

type TimetableApiErrorPayload = {
	code?: string;
	message?: string;
	actionHint?: string;
};

function getTimetableApiErrorPayload(error: unknown): TimetableApiErrorPayload | null {
	const payload = (error as { response?: { data?: TimetableApiErrorPayload } } | null)?.response?.data;
	if (!payload) {
		return null;
	}
	return payload;
}

function getTimetableApiErrorCode(error: unknown): string | undefined {
	return getTimetableApiErrorPayload(error)?.code;
}

function buildTimetableErrorMessage(error: unknown, fallbackMessage: string): string {
	const payload = getTimetableApiErrorPayload(error);
	if (payload?.code === 'NO_ACTIVE_DRAFT') {
		const base = payload.message ?? 'No active draft timetable run is available for the active school year.';
		const hint = payload.actionHint ?? 'Generate a timetable for the active school year, then refresh.';
		return `${base} ${hint}`;
	}
	if (payload?.code === 'STALE_RUN_DATA') {
		const base = payload.message ?? 'The latest timetable run references stale data.';
		const hint = payload.actionHint ?? 'Run faculty sync, regenerate the timetable, then refresh.';
		return `${base} ${hint}`;
	}
	if (payload?.message) {
		return payload.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return fallbackMessage;
}

const WELLBEING_CODES: Set<ViolationCode> = new Set([
	'FACULTY_EXCESSIVE_TRAVEL_DISTANCE',
	'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS',
	'FACULTY_INSUFFICIENT_TRANSITION_BUFFER',
	'FACULTY_EXCESSIVE_IDLE_GAP',
	'FACULTY_EARLY_START_PREFERENCE',
	'FACULTY_LATE_END_PREFERENCE',
]);

const TIMETABLE_CACHE_TTL_MS = 120000;

type CachedReferenceData = {
	ts: number;
	subjects: Subject[];
	faculty: FacultyMirror[];
	buildings: Building[];
	sections: ExternalSection[];
	sectionSummary: SectionSummaryResponse;
};

type CachedRunData = {
	ts: number;
	draft: DraftReport;
	violations: ViolationReport;
	followUpEntryIds: string[];
};

type CachedRuns = {
	ts: number;
	runs: GenerationRun[];
};

type CachedDraftBoard = {
	ts: number;
	board: DraftBoardState;
};

type CachedRoomRequestSummary = {
	ts: number;
	data: RoomPreferenceSummaryResponse;
};

type FetchOptions = {
	preferCache?: boolean;
	backgroundRefresh?: boolean;
	forceRefresh?: boolean;
};

const referenceDataCacheBySchoolYear = new Map<number, CachedReferenceData>();
const runDataCacheBySchoolYearAndRun = new Map<string, CachedRunData>();
const runsCacheBySchoolYear = new Map<number, CachedRuns>();
const draftBoardCacheBySchoolYear = new Map<number, CachedDraftBoard>();
const roomRequestSummaryCacheByKey = new Map<string, CachedRoomRequestSummary>();

function isFresh(cacheTs: number): boolean {
	return Date.now() - cacheTs < TIMETABLE_CACHE_TTL_MS;
}

function cacheRunKey(schoolYearId: number, runId: string): string {
	return `${schoolYearId}:${runId}`;
}

function cacheRoomRequestKey(
	schoolYearId: number,
	statusFilter: 'ALL' | RoomPreferenceStatus,
	decisionFilter: 'ALL' | RoomPreferenceDecisionStatus,
): string {
	return `${schoolYearId}:${statusFilter}:${decisionFilter}`;
}

function sameDraftSnapshot(previous: DraftReport | null, next: DraftReport): boolean {
	if (!previous) return false;
	return previous.runId === next.runId
		&& previous.version === next.version
		&& previous.status === next.status
		&& previous.finishedAt === next.finishedAt
		&& previous.createdAt === next.createdAt
		&& previous.entries.length === next.entries.length
		&& previous.unassignedItems.length === next.unassignedItems.length
		&& JSON.stringify(previous.summary) === JSON.stringify(next.summary)
		&& JSON.stringify({ ...previous.inputState, checkedAt: null, computedAt: null })
			=== JSON.stringify({ ...next.inputState, checkedAt: null, computedAt: null });
}

type RoomInfo = {
	id: number;
	name: string;
	buildingId: number;
	buildingName: string;
	buildingShortCode: string | null;
	floor: number;
	type: string;
	isTeachingSpace: boolean;
};

type UseTimetableDataInput = {
	schoolYearId: number | null;
	setSchoolYearId: React.Dispatch<React.SetStateAction<number | null>>;
	runs: GenerationRun[];
	setRuns: React.Dispatch<React.SetStateAction<GenerationRun[]>>;
	selectedRunId: string;
	setSelectedRunId: React.Dispatch<React.SetStateAction<string>>;
	draft: DraftReport | null;
	setDraft: React.Dispatch<React.SetStateAction<DraftReport | null>>;
	violationReport: ViolationReport | null;
	setViolationReport: React.Dispatch<React.SetStateAction<ViolationReport | null>>;
	setLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setError: React.Dispatch<React.SetStateAction<string | null>>;

	severityFilter: 'all' | 'hard' | 'soft' | 'conflicts' | 'wellbeing';
	setSeverityFilter: React.Dispatch<React.SetStateAction<'all' | 'hard' | 'soft' | 'conflicts' | 'wellbeing'>>;
	violationSearch: string;
	selectedViolation: Violation | null;
	setSelectedViolation: React.Dispatch<React.SetStateAction<Violation | null>>;
	selectedEntry: ScheduledEntry | null;
	setSelectedEntry: React.Dispatch<React.SetStateAction<ScheduledEntry | null>>;
	setFollowUps: React.Dispatch<React.SetStateAction<Set<string>>>;
	entityFilter: string;
	setEntityFilter: React.Dispatch<React.SetStateAction<string>>;
	viewMode: 'section' | 'faculty' | 'room';
	setViewMode: React.Dispatch<React.SetStateAction<'section' | 'faculty' | 'room'>>;
	programFilter: ProgramFilter;
	entryKindFilter: EntryKindFilter;
	leftTab: 'violations' | 'unassigned' | 'pinned' | 'requests';
	setLeftTab: React.Dispatch<React.SetStateAction<'violations' | 'unassigned' | 'pinned' | 'requests'>>;
	unassignedReasonFilter: UnassignedReason | 'all';

	showFullDay: boolean;
	gradeWindows: Array<{ gradeLevel: number; programType?: string | null; startTime: string; endTime: string }>;

	draftBoard: DraftBoardState | null;
	setDraftBoard: React.Dispatch<React.SetStateAction<DraftBoardState | null>>;
	setDraftBoardSummary: React.Dispatch<React.SetStateAction<DraftBoardState['counts'] | null>>;

	requestStatusFilter: 'ALL' | RoomPreferenceStatus;
	requestDecisionFilter: 'ALL' | RoomPreferenceDecisionStatus;
	setRoomRequestSummary: React.Dispatch<React.SetStateAction<RoomPreferenceSummaryResponse | null>>;
	setRoomRequestLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setRoomRequestError: React.Dispatch<React.SetStateAction<string | null>>;

	setSubjectMap: React.Dispatch<React.SetStateAction<Map<number, Subject>>>;
	setFacultyMap: React.Dispatch<React.SetStateAction<Map<number, FacultyMirror>>>;
	setSectionMap: React.Dispatch<React.SetStateAction<Map<number, ExternalSection>>>;
	setSectionSummary: React.Dispatch<React.SetStateAction<SectionSummaryResponse | null>>;
	setRoomMap: React.Dispatch<React.SetStateAction<Map<number, RoomInfo>>>;
	setBuildings: React.Dispatch<React.SetStateAction<Building[]>>;

	isLeftCollapsed: boolean;
	leftPanelRef: React.RefObject<ImperativePanelHandle | null>;
	centerView: 'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building';
	preGenOnboarding: boolean;
	preGenMapContext: boolean;
	setPreGenMapContext: React.Dispatch<React.SetStateAction<boolean>>;
	setCenterView: React.Dispatch<React.SetStateAction<'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building'>>;
	setMapBuildingId: React.Dispatch<React.SetStateAction<number | null>>;
	setMapRoomId: React.Dispatch<React.SetStateAction<number | null>>;
	switchCenterViewWithGuard: (action: () => void) => void;

	facultyMap: Map<number, FacultyMirror>;
	sectionMap: Map<number, ExternalSection>;
	roomMap: Map<number, RoomInfo>;
	subjectMap: Map<number, Subject>;

	dragItem: any;
	dragActiveRef: React.MutableRefObject<boolean>;
	preGenKbSource: any;
	kbSelectedSource: any;
	setPreGenKbSource: React.Dispatch<React.SetStateAction<any>>;
	setKbSelectedSource: React.Dispatch<React.SetStateAction<any>>;
};

export type TimetableDataState = {
	violations: Violation[];
	violationIndex: Map<string, Violation[]>;
	highlightedEntryIds: Set<string>;
	filteredViolations: Violation[];
	violationsByCode: Map<ViolationCode, Violation[]>;
	hardViolationCount: number;
	topBlockers: Violation[];
	preGenEntries: ScheduledEntry[];
	isPreGenerationWorkspace: boolean;
	activeGridEntriesBase: ScheduledEntry[];
	timeSlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string }>;
	displayTimeSlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string }>;
	hiddenRowCount: number;
	getCellConflict: ((cellId: string) => import('@/types').CellConflictInfo | null) | null;
	getLiveCellConflict: (source: any, cellId: string) => import('@/types').CellConflictInfo | null;
	releaseDeferredDragUpdates: () => void;
	filteredDraftEntries: ScheduledEntry[];
	programKindFilteredUnassignedItems: UnassignedItem[];
	filteredUnassignedItems: UnassignedItem[];
	sectionIds: number[];
	pivotEntityIds: number[];
	gridEntries: ScheduledEntry[];
	gridIndex: Map<string, ScheduledEntry[]>;
	pivotKeyOf: (e: ScheduledEntry) => number | null;
	summary: RunSummary | null;
	navToFaculty: (id: number) => void;
	navToSection: (id: number) => void;
	navToRoom: (id: number) => void;
	activeGeneratedRunId: number | null;
	schoolYearContext: ActiveSchoolYearContext | null;
	fetchSchoolYear: () => Promise<number | null>;
	fetchRuns: (syId: number) => Promise<GenerationRun[]>;
	fetchRunData: (syId: number, runId: string) => Promise<void>;
	fetchDraftBoardSummary: (syId: number) => Promise<DraftBoardState['counts'] | null>;
	loadRoomRequestSummary: (
		syId: number,
		statusFilter: 'ALL' | RoomPreferenceStatus,
		decisionFilter: 'ALL' | RoomPreferenceDecisionStatus,
	) => Promise<void>;
	fetchReferenceData: (syId: number) => Promise<void>;
	refreshReferenceLabels: () => void;
	openMapWorkspace: () => Promise<void>;
	openBuildingWorkspace: (buildingId: number) => Promise<void>;
	openRoomGridWorkspace: (roomId: number) => void;
	loadAll: (preserveRun?: boolean) => Promise<void>;
	handleRefresh: () => void;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	formatFacultyInitials: (id: number) => string;
	sectionLabel: (id: number) => string;
	roomLabel: (roomId: number) => string;
	roomLabelShort: (roomId: number) => string;
	isStaleRoom: (roomId: number) => boolean;
	pivotLabel: (id: number) => string;
	referenceLookupStatus: { state: 'loading' | 'ready' | 'needs-refresh'; label: string };
};

function useStablePrimitiveArray<T>(arr: T[]): T[] {
	const ref = useRef(arr);
	const isEqual = arr.length === ref.current.length && arr.every((val, i) => val === ref.current[i]);
	if (!isEqual) ref.current = arr;
	return ref.current;
}

function timeToMinutes(time: string): number {
	const [h, m] = time.split(':').map(Number);
	return h * 60 + m;
}

export function useTimetableData(input: UseTimetableDataInput): TimetableDataState {
	const {
		schoolYearId,
		setSchoolYearId,
		runs,
		setRuns,
		selectedRunId,
		setSelectedRunId,
		draft,
		setDraft,
		violationReport,
		setViolationReport,
		setLoading,
		setError,
		severityFilter,
		setSeverityFilter,
		violationSearch,
		selectedViolation,
		setSelectedViolation,
		selectedEntry,
		setSelectedEntry,
		setFollowUps,
		entityFilter,
		setEntityFilter,
		viewMode,
		setViewMode,
		programFilter,
		entryKindFilter,
		leftTab,
		setLeftTab,
		unassignedReasonFilter,
		draftBoard,
		setDraftBoard,
		setDraftBoardSummary,
		requestStatusFilter,
		requestDecisionFilter,
		setRoomRequestSummary,
		setRoomRequestLoading,
		setRoomRequestError,
		setSubjectMap,
		setFacultyMap,
		setSectionMap,
		setSectionSummary,
		setRoomMap,
		setBuildings,
		isLeftCollapsed,
		leftPanelRef,
		centerView,
		preGenOnboarding,
		preGenMapContext,
		setPreGenMapContext,
		setCenterView,
		setMapBuildingId,
		setMapRoomId,
		switchCenterViewWithGuard,
		facultyMap,
		sectionMap,
		roomMap,
		subjectMap,
		dragItem,
		dragActiveRef,
		preGenKbSource,
		kbSelectedSource,
		setPreGenKbSource,
		setKbSelectedSource,
	} = input;
	const deferredDraftBoardRef = useRef<DraftBoardState | null>(null);
	const deferredRoomRequestRef = useRef<RoomPreferenceSummaryResponse | null>(null);
	const deferredDragReleaseTimerRef = useRef<number | null>(null);
	const applyDraftBoard = useCallback((board: DraftBoardState) => {
		if (dragActiveRef.current) {
			deferredDraftBoardRef.current = board;
			return;
		}
		setDraftBoard((previous) => JSON.stringify(previous) === JSON.stringify(board) ? previous : board);
		setDraftBoardSummary((previous) => JSON.stringify(previous) === JSON.stringify(board.counts) ? previous : board.counts);
	}, [dragActiveRef, setDraftBoard, setDraftBoardSummary]);
	const applyRoomRequestSummary = useCallback((summary: RoomPreferenceSummaryResponse) => {
		if (dragActiveRef.current) {
			deferredRoomRequestRef.current = summary;
			return;
		}
		setRoomRequestSummary((previous) => JSON.stringify(previous) === JSON.stringify(summary) ? previous : summary);
		setRoomRequestError(null);
	}, [dragActiveRef, setRoomRequestError, setRoomRequestSummary]);
	const releaseDeferredDragUpdates = useCallback(() => {
		if (deferredDragReleaseTimerRef.current != null) window.clearTimeout(deferredDragReleaseTimerRef.current);
		deferredDragReleaseTimerRef.current = window.setTimeout(() => {
			deferredDragReleaseTimerRef.current = null;
			const draftBoardUpdate = deferredDraftBoardRef.current;
			const roomRequestUpdate = deferredRoomRequestRef.current;
			deferredDraftBoardRef.current = null;
			deferredRoomRequestRef.current = null;
			if (draftBoardUpdate) applyDraftBoard(draftBoardUpdate);
			if (roomRequestUpdate) applyRoomRequestSummary(roomRequestUpdate);
		}, 800);
	}, [applyDraftBoard, applyRoomRequestSummary]);
	useEffect(() => () => {
		if (deferredDragReleaseTimerRef.current != null) {
			window.clearTimeout(deferredDragReleaseTimerRef.current);
		}
	}, []);

	const selectedRunIdRef = useRef(selectedRunId);
	const latestRunDataFetchSeqRef = useRef(0);
	const [schoolYearContext, setSchoolYearContext] = useState<ActiveSchoolYearContext | null>(null);
	useEffect(() => {
		selectedRunIdRef.current = selectedRunId;
	}, [selectedRunId]);

	const violations = useMemo(() => violationReport?.violations ?? [], [violationReport]);
	const violationIndex = useMemo(() => buildViolationIndex(violations), [violations]);

	const highlightedEntryIds = useMemo(() => {
		if (!selectedViolation) return new Set<string>();
		return new Set(selectedViolation.entities.entryIds ?? []);
	}, [selectedViolation]);

	const filteredViolations = useMemo(() => {
		let filtered = violations;

		if (severityFilter === 'hard') filtered = filtered.filter((v) => v.severity === 'HARD');
		else if (severityFilter === 'soft') filtered = filtered.filter((v) => v.severity === 'SOFT');
		else if (severityFilter === 'conflicts') filtered = filtered.filter((v) => CONFLICT_CODES.has(v.code));
		else if (severityFilter === 'wellbeing') filtered = filtered.filter((v) => WELLBEING_CODES.has(v.code));

		if (violationSearch.trim()) {
			const q = violationSearch.toLowerCase();
			filtered = filtered.filter(
				(v) =>
					v.message.toLowerCase().includes(q)
					|| v.code.toLowerCase().includes(q)
					|| VIOLATION_LABELS[v.code].toLowerCase().includes(q),
			);
		}

		return filtered;
	}, [violations, severityFilter, violationSearch]);

	const violationsByCode = useMemo(() => {
		const groups = new Map<ViolationCode, Violation[]>();
		for (const v of filteredViolations) {
			const list = groups.get(v.code) ?? [];
			list.push(v);
			groups.set(v.code, list);
		}
		return groups;
	}, [filteredViolations]);

	const hardViolationCount = useMemo(() => violations.filter((v) => v.severity === 'HARD').length, [violations]);

	const topBlockers = useMemo(() => {
		const hardViolations = violations.filter((v) => v.severity === 'HARD');
		const seen = new Set<ViolationCode>();
		const result: Violation[] = [];
		for (const v of hardViolations) {
			if (!seen.has(v.code)) {
				seen.add(v.code);
				result.push(v);
				if (result.length >= 3) break;
			}
		}
		return result;
	}, [violations]);

	const prevHardCountRef = useRef<number | null>(null);
	useEffect(() => {
		if (prevHardCountRef.current === null) {
			prevHardCountRef.current = hardViolationCount;
			return;
		}
		if (hardViolationCount > 0 && prevHardCountRef.current === 0) {
			setLeftTab('violations');
			setSeverityFilter('hard');
			if (isLeftCollapsed) leftPanelRef.current?.expand();
		}
		prevHardCountRef.current = hardViolationCount;
	}, [hardViolationCount, isLeftCollapsed, leftPanelRef, setLeftTab, setSeverityFilter]);

	const preGenEntries = useMemo<ScheduledEntry[]>(() => {
		return (draftBoard?.placements ?? [])
			.filter((placement) => placement.status === 'DRAFT' && placement.facultyId != null && placement.roomId != null)
			.map((placement) => ({
				entryId: `draft-placement-${placement.id}`,
				facultyId: placement.facultyId!,
				roomId: placement.roomId!,
				subjectId: placement.subjectId,
				sectionId: placement.sectionId,
				day: placement.day,
				startTime: placement.startTime,
				endTime: placement.endTime,
				durationMinutes: minutesBetween(placement.startTime, placement.endTime),
				entryKind: placement.entryKind,
				cohortCode: placement.cohortCode ?? null,
			}));
	}, [draftBoard?.placements]);

	const isPreGenerationWorkspace = centerView === 'pre-generation'
		|| (centerView === 'map' && (preGenOnboarding || preGenMapContext))
		|| (centerView === 'building' && preGenMapContext);

	const activeGridEntriesBase = useMemo(() => isPreGenerationWorkspace ? preGenEntries : (draft?.entries ?? []), [isPreGenerationWorkspace, preGenEntries, draft]);
	const timeSlots = useMemo(
		() => isPreGenerationWorkspace && draftBoard?.periodSlots?.length
			? draftBoard.periodSlots
			: deriveTimeSlotsFromSummary(activeGridEntriesBase, {
				timetableDisplaySlots: draft?.summary?.timetableDisplaySlots,
				timetableShapeContracts: draft?.summary?.timetableShapeContracts,
			}),
		[
			activeGridEntriesBase,
			draft?.summary?.timetableDisplaySlots,
			draft?.summary?.timetableShapeContracts,
			draftBoard?.periodSlots,
			isPreGenerationWorkspace,
		],
	);

	// Context-aware display slots: filter timeSlots based on view mode and entity selection
	const { gradeWindows, showFullDay } = input;
	const displayTimeSlots = useMemo(() => {
		if (showFullDay) return timeSlots;

		const selectedId = Number(entityFilter);
		if (!selectedId || !draft?.entries) return timeSlots;

		const entries = draft.entries;

		if (viewMode === 'section') {
			// Section view: use the section's grade/program window
			const section = sectionMap.get(selectedId);
			if (!section) return timeSlots;
			const gradeNumber = resolveSectionGradeNumber(section);
			if (gradeNumber == null) return timeSlots;
			const matchingWindow = findGradeWindow(gradeNumber, section.programType, gradeWindows);
			if (!matchingWindow) return timeSlots;

			const windowStart = timeToMinutes(matchingWindow.startTime);
			const windowEnd = timeToMinutes(matchingWindow.endTime);

			// Collect occupied time ranges for this section (for overlap detection)
			const occupiedRanges: Array<{ start: number; end: number }> = [];
			for (const e of entries) {
				if (e.sectionId === selectedId) {
					occupiedRanges.push({ start: timeToMinutes(e.startTime), end: timeToMinutes(e.endTime) });
				}
			}

			return timeSlots.filter((slot) => {
				const slotStart = timeToMinutes(slot.startTime);
				const slotEnd = timeToMinutes(slot.endTime);

				if (slot.isSpecialEvent) {
					// Include special events that overlap the section's visible window
					if (slotStart < windowEnd && slotEnd > windowStart) return true;
					// Also include special events that overlap any occupied entry
					for (const range of occupiedRanges) {
						if (range.start < slotEnd && range.end > slotStart) return true;
					}
					return false;
				}

				const start = timeToMinutes(slot.startTime);
				const end = timeToMinutes(slot.endTime);
				if (start >= windowStart && end <= windowEnd) return true;
				// Check if any occupied entry overlaps this time slot
				for (const range of occupiedRanges) {
					if (range.start < end && range.end > start) return true;
				}
				return false;
			});
		}

		if (viewMode === 'faculty') {
			// Teacher view: show all occupied rows for this teacher
			const occupiedKeys = new Set<string>();
			for (const e of entries) {
				if (e.facultyId === selectedId) {
					occupiedKeys.add(`${e.startTime}-${e.endTime}`);
				}
			}
			if (occupiedKeys.size === 0) return timeSlots;
			return timeSlots.filter((slot) => {
				if (slot.isSpecialEvent) return true;
				return occupiedKeys.has(`${slot.startTime}-${slot.endTime}`);
			});
		}

		if (viewMode === 'room') {
			// Room view: show all occupied rows for this room
			const occupiedKeys = new Set<string>();
			for (const e of entries) {
				if (e.roomId === selectedId) {
					occupiedKeys.add(`${e.startTime}-${e.endTime}`);
				}
			}
			if (occupiedKeys.size === 0) return timeSlots;
			return timeSlots.filter((slot) => {
				if (slot.isSpecialEvent) return true;
				return occupiedKeys.has(`${slot.startTime}-${slot.endTime}`);
			});
		}

		return timeSlots;
	}, [showFullDay, timeSlots, entityFilter, viewMode, draft?.entries, sectionMap, gradeWindows]);

	const hiddenRowCount = timeSlots.length - displayTimeSlots.length;

	const conflictContext = useMemo(() => {
		let sectionId: number | undefined;
		let facultyId: number | undefined;
		let allFacultyOptions: number[] | undefined;
		let roomId: number | undefined;
		let sourceEntryId: string | undefined;

		if (dragItem) {
			if (dragItem.type === 'entry') {
				sectionId = dragItem.entry.sectionId;
				facultyId = dragItem.entry.facultyId;
				roomId = dragItem.entry.roomId;
				sourceEntryId = dragItem.entry.entryId;
			} else if (dragItem.type === 'draftQueue') {
				sectionId = dragItem.item.sectionId;
				facultyId = dragItem.item.facultyOptions[0];
				allFacultyOptions = dragItem.item.facultyOptions;
			} else if (dragItem.type === 'draftPlacement') {
				sectionId = dragItem.placement.sectionId;
				facultyId = dragItem.placement.facultyId ?? undefined;
				roomId = dragItem.placement.roomId ?? undefined;
				sourceEntryId = `draft-placement-${dragItem.placement.id}`;
			} else if (dragItem.type === 'unassigned') {
				sectionId = dragItem.item.sectionId;
				facultyId = dragItem.item.facultyId ?? undefined;
				roomId = dragItem.item.homeRoomId ?? undefined;
			}
		} else if (preGenKbSource) {
			if (preGenKbSource.type === 'draftQueue') {
				sectionId = preGenKbSource.item.sectionId;
				facultyId = preGenKbSource.item.facultyOptions[0];
				allFacultyOptions = preGenKbSource.item.facultyOptions;
			} else if (preGenKbSource.type === 'draftPlacement') {
				sectionId = preGenKbSource.placement.sectionId;
				facultyId = preGenKbSource.placement.facultyId ?? undefined;
				roomId = preGenKbSource.placement.roomId ?? undefined;
				sourceEntryId = `draft-placement-${preGenKbSource.placement.id}`;
			}
		} else if (kbSelectedSource) {
			if (kbSelectedSource.type === 'entry') {
				sectionId = kbSelectedSource.entry.sectionId;
				facultyId = kbSelectedSource.entry.facultyId;
				roomId = kbSelectedSource.entry.roomId;
				sourceEntryId = kbSelectedSource.entry.entryId;
			} else if (kbSelectedSource.type === 'unassigned') {
				sectionId = kbSelectedSource.item.sectionId;
				facultyId = kbSelectedSource.item.facultyId ?? undefined;
				roomId = kbSelectedSource.item.homeRoomId ?? undefined;
			}
		}

		if (!sectionId) return null;
		return { sectionId, facultyId, allFacultyOptions, roomId, sourceEntryId };
	}, [dragItem, kbSelectedSource, preGenKbSource]);

	const legacyCellConflictMap = useMemo<Map<string, import('@/types').CellConflictInfo> | null>(() => {
		if (!conflictContext) return null;

		const {
			sectionId,
			facultyId,
			allFacultyOptions,
			roomId,
			sourceEntryId,
		} = conflictContext;

		const sourceEntry = sourceEntryId
			? activeGridEntriesBase.find((entry) => entry.entryId === sourceEntryId)
			: null;
		const sourceEntryDuration = sourceEntry
			? minutesBetween(sourceEntry.startTime, sourceEntry.endTime)
			: 0;

		const allIndex = new Map<string, ScheduledEntry[]>();
		const facultyDailyMinutes = new Map<string, number>();
		for (const e of activeGridEntriesBase) {
			const key = `${e.day}-${e.startTime}-${e.endTime}`;
			const list = allIndex.get(key) ?? [];
			list.push(e);
			allIndex.set(key, list);
			if (e.facultyId != null) {
				const dailyKey = `${e.day}:${e.facultyId}`;
				facultyDailyMinutes.set(dailyKey, (facultyDailyMinutes.get(dailyKey) ?? 0) + minutesBetween(e.startTime, e.endTime));
			}
		}

		const fName = (id: number): string => {
			const f = facultyMap.get(id);
			if (!f) return `Faculty #${id}`;
			const init = f.firstName ? `${f.firstName.charAt(0).toUpperCase()}.` : '';
			return init ? `${init} ${f.lastName}` : f.lastName;
		};
		const sName = (id: number): string => sectionMap.get(id)?.name ?? `Section #${id}`;
		const rName = (id: number): string => {
			const r = roomMap.get(id);
			if (!r) return `Room #${id}`;
			const b = r.buildingShortCode || r.buildingName;
			return b ? `${r.name} · ${b}` : r.name;
		};
		const subName = (id: number): string => subjectMap.get(id)?.name ?? `Subject #${id}`;

		const map = new Map<string, CellConflictInfo>();
		for (const slot of timeSlots) {
			for (const day of DAYS) {
				const key = `${day}-${slot.startTime}-${slot.endTime}`;
				if (slot.isSpecialEvent) {
					map.set(key, {
						kind: 'hard',
						reasons: [`${slot.eventName ?? 'Special event'} slot is non-schedulable`],
						displaced: [],
					});
					continue;
				}
				const cellEntries = allIndex.get(key) ?? [];

				if (sourceEntryId && cellEntries.some((e) => e.entryId === sourceEntryId)) {
					map.set(key, { kind: 'self', reasons: ['Current position'], displaced: [] });
					continue;
				}

				const hardReasons: string[] = [];
				const softReasons: string[] = [];
				const displaced: CellConflictInfo['displaced'] = [];

				for (const e of cellEntries) {
					if (e.entryId === sourceEntryId) continue;
					if (e.sectionId === sectionId) {
						const label = sName(sectionId);
						if (!hardReasons.some((r) => r.startsWith('Section occupied'))) hardReasons.push(`Section occupied: ${label}`);
						displaced.push({ entryId: e.entryId, subjectName: subName(e.subjectId), entityName: label, entityId: sectionId, conflictType: 'section' });
					}
					if (roomId && e.roomId === roomId) {
						const label = rName(roomId);
						if (!hardReasons.some((r) => r.startsWith('Room occupied'))) hardReasons.push(`Room occupied: ${label}`);
						displaced.push({ entryId: e.entryId, subjectName: subName(e.subjectId), entityName: label, entityId: roomId, conflictType: 'room' });
					}
				}

				if (allFacultyOptions && allFacultyOptions.length > 0) {
					const busyOptions = allFacultyOptions.filter((fid) => cellEntries.some((e) => e.entryId !== sourceEntryId && e.facultyId === fid));
					if (busyOptions.length > 0) {
						const freeFacultyExists = busyOptions.length < allFacultyOptions.length;
						if (freeFacultyExists) {
							const busyLabels = busyOptions.map(fName).join(', ');
							if (!softReasons.some((r) => r.startsWith('Faculty busy'))) softReasons.push(`Faculty busy: ${busyLabels} (alternatives available)`);
						} else {
							const busyLabels = busyOptions.map(fName).join(', ');
							if (!hardReasons.some((r) => r.startsWith('Faculty overlap'))) {
								hardReasons.push(`Faculty overlap: all ${allFacultyOptions.length} option${allFacultyOptions.length !== 1 ? 's' : ''} busy (${busyLabels})`);
							}
						}
						for (const fid of busyOptions) {
							const conflictEntry = cellEntries.find((e) => e.entryId !== sourceEntryId && e.facultyId === fid);
							if (conflictEntry) displaced.push({ entryId: conflictEntry.entryId, subjectName: subName(conflictEntry.subjectId), entityName: fName(fid), entityId: fid, conflictType: 'faculty' });
						}
					}
				} else if (facultyId) {
					const conflictEntry = cellEntries.find((e) => e.entryId !== sourceEntryId && e.facultyId === facultyId);
					if (conflictEntry) {
						const label = fName(facultyId);
						if (!hardReasons.some((r) => r.startsWith('Faculty overlap'))) hardReasons.push(`Faculty overlap: ${label}`);
						displaced.push({ entryId: conflictEntry.entryId, subjectName: subName(conflictEntry.subjectId), entityName: label, entityId: facultyId, conflictType: 'faculty' });
					}
				}

				const sessionDuration = minutesBetween(slot.startTime, slot.endTime);
				if (sessionDuration > 0) {
					const optionsToCheck = allFacultyOptions && allFacultyOptions.length > 0 ? allFacultyOptions : facultyId ? [facultyId] : [];
					const softCap = 360;
					const hardCap = 480;
					for (const fid of optionsToCheck) {
						const dailyKey = `${day}:${fid}`;
						let existingDailyMins = facultyDailyMinutes.get(dailyKey) ?? 0;
						if (
							sourceEntry
							&& sourceEntry.facultyId === fid
							&& sourceEntry.day === day
						) {
							existingDailyMins = Math.max(0, existingDailyMins - sourceEntryDuration);
						}
						const projected = existingDailyMins + sessionDuration;
						if (projected > hardCap) {
							const label = fName(fid);
							if (!hardReasons.some((r) => r.includes('daily load'))) hardReasons.push(`Daily load hard cap: ${label} would reach ${Math.round((projected / 60) * 10) / 10}h (max 8h)`);
						} else if (projected > softCap) {
							const label = fName(fid);
							if (!softReasons.some((r) => r.includes('daily load'))) softReasons.push(`Daily load soft cap: ${label} would reach ${Math.round((projected / 60) * 10) / 10}h (soft limit 6h)`);
						}
					}
				}

				let kind: CellConflictInfo['kind'];
				const reasons: string[] = [];
				if (hardReasons.length > 0) {
					kind = 'hard';
					reasons.push(...hardReasons, ...softReasons);
				} else if (softReasons.length > 0) {
					kind = 'soft';
					reasons.push(...softReasons);
				} else {
					kind = 'clean';
				}
				map.set(key, { kind, reasons, displaced });
			}
		}
		return map;
	}, [conflictContext, activeGridEntriesBase, timeSlots, facultyMap, roomMap, sectionMap, subjectMap]);

	const liveConflictIndex = useMemo(
		() => buildLiveConflictIndex(activeGridEntriesBase, timeSlots),
		[activeGridEntriesBase, timeSlots],
	);

	const conflictLookup = useMemo(() => createLiveConflictLookup(
		activeGridEntriesBase,
		timeSlots,
		conflictContext,
		{
			facultyName: (id) => {
				const faculty = facultyMap.get(id);
				if (!faculty) return `Faculty #${id}`;
				const initial = faculty.firstName ? `${faculty.firstName.charAt(0).toUpperCase()}.` : '';
				return initial ? `${initial} ${faculty.lastName}` : faculty.lastName;
			},
			sectionName: (id) => sectionMap.get(id)?.name ?? `Section #${id}`,
			roomName: (id) => {
				const room = roomMap.get(id);
				if (!room) return `Room #${id}`;
				const building = room.buildingShortCode || room.buildingName;
				return building ? `${room.name} Â· ${building}` : room.name;
			},
			subjectName: (id) => subjectMap.get(id)?.name ?? `Subject #${id}`,
		},
		liveConflictIndex,
	), [conflictContext, activeGridEntriesBase, timeSlots, facultyMap, roomMap, sectionMap, subjectMap, liveConflictIndex]);
	const conflictLookupRef = useRef<typeof conflictLookup>(null);
	conflictLookupRef.current = conflictLookup;
	const getCellConflict = useCallback(
		(cellId: string) => conflictLookupRef.current?.(cellId) ?? null,
		[],
	);
	const liveDragConflictRef = useRef<{
		source: any;
		entries: ScheduledEntry[];
		lookup: ((cellId: string) => import('@/types').CellConflictInfo | null) | null;
	} | null>(null);
	const getLiveCellConflict = useCallback((source: any, cellId: string) => {
		if (!source) return getCellConflict(cellId);
		const cached = liveDragConflictRef.current;
		if (!cached || cached.source !== source || cached.entries !== activeGridEntriesBase) {
			let context: import('@/lib/timetable-live-conflict').TimetableConflictContext | null = null;
			if (source.type === 'entry') {
				context = { sectionId: source.entry.sectionId, facultyId: source.entry.facultyId, roomId: source.entry.roomId, sourceEntryId: source.entry.entryId };
			} else if (source.type === 'draftQueue') {
				context = { sectionId: source.item.sectionId, facultyId: source.item.facultyOptions?.[0], allFacultyOptions: source.item.facultyOptions };
			} else if (source.type === 'draftPlacement') {
				context = { sectionId: source.placement.sectionId, facultyId: source.placement.facultyId ?? undefined, roomId: source.placement.roomId ?? undefined, sourceEntryId: `draft-placement-${source.placement.id}` };
			} else if (source.type === 'unassigned') {
				context = { sectionId: source.item.sectionId, facultyId: source.item.facultyId ?? undefined, roomId: source.item.homeRoomId ?? undefined };
			}
			const lookup = createLiveConflictLookup(activeGridEntriesBase, timeSlots, context, {
				facultyName: (id) => {
					const faculty = facultyMap.get(id);
					if (!faculty) return `Faculty #${id}`;
					const initial = faculty.firstName ? `${faculty.firstName.charAt(0).toUpperCase()}.` : '';
					return initial ? `${initial} ${faculty.lastName}` : faculty.lastName;
				},
				sectionName: (id) => sectionMap.get(id)?.name ?? `Section #${id}`,
				roomName: (id) => {
					const room = roomMap.get(id);
					if (!room) return `Room #${id}`;
					const building = room.buildingShortCode || room.buildingName;
					return building ? `${room.name} · ${building}` : room.name;
				},
				subjectName: (id) => subjectMap.get(id)?.name ?? `Subject #${id}`,
			}, liveConflictIndex);
			liveDragConflictRef.current = { source, entries: activeGridEntriesBase, lookup };
		}
		const activeLookup = liveDragConflictRef.current?.lookup;
		return activeLookup?.(cellId) ?? null;
	}, [activeGridEntriesBase, facultyMap, getCellConflict, liveConflictIndex, roomMap, sectionMap, subjectMap, timeSlots]);

	const filteredDraftEntries = useMemo(() => {
		return activeGridEntriesBase.filter((entry) => {
			const programType = entry.programType ?? sectionMap.get(entry.sectionId)?.programType ?? null;
			return matchesProgramFilter(programType, programFilter) && matchesEntryKindFilter(entry.entryKind, entryKindFilter);
		});
	}, [activeGridEntriesBase, entryKindFilter, programFilter, sectionMap]);

	const programKindFilteredUnassignedItems = useMemo(() => {
		return (draft?.unassignedItems ?? []).filter((item) => {
			const programType = item.programType ?? sectionMap.get(item.sectionId)?.programType ?? null;
			if (!matchesProgramFilter(programType, programFilter)) return false;
			if (!matchesEntryKindFilter(item.entryKind, entryKindFilter)) return false;
			return true;
		});
	}, [draft, entryKindFilter, programFilter, sectionMap]);

	const filteredUnassignedItems = useMemo(() => {
		return programKindFilteredUnassignedItems.filter((item) => {
			if (unassignedReasonFilter !== 'all' && item.reason !== unassignedReasonFilter) return false;
			return true;
		});
	}, [programKindFilteredUnassignedItems, unassignedReasonFilter]);

	const rawSectionIds = useMemo(() => {
		const ids = new Set<number>();
		for (const e of filteredDraftEntries) ids.add(e.sectionId);
		return Array.from(ids).sort((a, b) => a - b);
	}, [filteredDraftEntries]);
	const sectionIds = useStablePrimitiveArray(rawSectionIds);

	const rawPivotEntityIds = useMemo(() => {
		const entries = filteredDraftEntries;
		const isPreGen = centerView === 'pre-generation';
		if (viewMode === 'section') {
			if (isPreGen) {
				const ids = new Set<number>(sectionIds);
				for (const id of sectionMap.keys()) ids.add(id);
				return Array.from(ids).sort((a, b) => a - b);
			}
			return sectionIds;
		}
		if (viewMode === 'faculty') {
			const ids = new Set<number>();
			for (const e of entries) if (e.facultyId) ids.add(e.facultyId);
			if (isPreGen) for (const id of facultyMap.keys()) ids.add(id);
			return Array.from(ids).sort((a, b) => a - b);
		}
		const ids = new Set<number>();
		for (const e of entries) if (e.roomId) ids.add(e.roomId);
		for (const [id, room] of roomMap.entries()) {
			if (room.isTeachingSpace) ids.add(id);
		}
		return Array.from(ids).sort((a, b) => {
			const ra = roomMap.get(a);
			const rb = roomMap.get(b);
			if (!ra || !rb) return a - b;
			const bldgA = (ra.buildingShortCode || ra.buildingName).toLowerCase();
			const bldgB = (rb.buildingShortCode || rb.buildingName).toLowerCase();
			if (bldgA !== bldgB) return bldgA.localeCompare(bldgB);
			return ra.name.localeCompare(rb.name);
		});
	}, [filteredDraftEntries, viewMode, sectionIds, sectionMap, roomMap, centerView, facultyMap]);
	const pivotEntityIds = useStablePrimitiveArray(rawPivotEntityIds);

	const gridEntries = useMemo(() => {
		const entries = filteredDraftEntries;
		const id = Number(entityFilter);
		if (!id) return [];
		if (viewMode === 'section') return entries.filter((e) => e.sectionId === id);
		if (viewMode === 'faculty') return entries.filter((e) => e.facultyId === id);
		return entries.filter((e) => e.roomId === id);
	}, [entityFilter, filteredDraftEntries, viewMode]);

	const gridIndex = useMemo(() => {
		const index = new Map<string, ScheduledEntry[]>();
		for (const e of gridEntries) {
			const key = `${e.day}-${e.startTime}-${e.endTime}`;
			const list = index.get(key) ?? [];
			list.push(e);
			index.set(key, list);
		}
		return index;
	}, [gridEntries]);

	const pivotKeyOf = useCallback(
		(e: ScheduledEntry): number | null => {
			if (viewMode === 'section') return e.sectionId;
			if (viewMode === 'faculty') return e.facultyId;
			return e.roomId;
		},
		[viewMode],
	);

	const summary: RunSummary | null = draft?.summary ?? null;

	const navToFaculty = useCallback((id: number) => { setViewMode('faculty'); setEntityFilter(String(id)); }, [setViewMode, setEntityFilter]);
	const navToSection = useCallback((id: number) => { setViewMode('section'); setEntityFilter(String(id)); }, [setViewMode, setEntityFilter]);
	const navToRoom = useCallback((id: number) => { setViewMode('room'); setEntityFilter(String(id)); }, [setViewMode, setEntityFilter]);

	const activeGeneratedRunId = useMemo(() => {
		if (selectedRunId === 'latest') return runs[0]?.id ?? draft?.runId ?? null;
		const parsed = Number(selectedRunId);
		if (Number.isFinite(parsed)) return parsed;
		return draft?.runId ?? null;
	}, [selectedRunId, runs, draft?.runId]);

	useEffect(() => {
		if (pivotEntityIds.length > 0) {
			const currentValid = entityFilter && entityFilter !== 'all' && pivotEntityIds.includes(Number(entityFilter));
			if (!currentValid) setEntityFilter(String(pivotEntityIds[0]));
		}
	}, [pivotEntityIds, entityFilter, setEntityFilter]);

	const fetchSchoolYear = useCallback(async () => {
		const context = await resolveActiveSchoolYearContext({
			// Prefer cached school-year immediately so timetable bootstrap doesn't
			// block waiting on a forced upstream verification on every navigation.
			preferCache: true,
			backgroundRefresh: true,
			allowStaleOnError: true,
			allowEnrollProFallback: false,
		});
		setSchoolYearContext(context);
		if (context.activeSchoolYearId) setSchoolYearId(context.activeSchoolYearId);
		if (context.source === 'cache' || context.stale) {
			void resolveActiveSchoolYearContext({
				forceRefresh: true,
				allowStaleOnError: true,
				allowEnrollProFallback: false,
			}).then((freshContext) => {
				setSchoolYearContext(freshContext);
				if (freshContext.activeSchoolYearId) setSchoolYearId(freshContext.activeSchoolYearId);
			}).catch(() => {
				// Keep the visible cached/stale source state. The header will state that
				// ATLAS is working from saved data instead of hiding the uncertainty.
			});
		}
		return context.activeSchoolYearId ?? null;
	}, [setSchoolYearId]);

	const fetchRuns = useCallback(async (syId: number, options?: FetchOptions) => {
		const { preferCache = false, forceRefresh = false } = options ?? {};
		const cached = runsCacheBySchoolYear.get(syId);
		const canUseCache = !forceRefresh && preferCache && cached && isFresh(cached.ts);

		if (canUseCache) {
			setRuns(cached.runs);
			return cached.runs;
		}

		const { data } = await atlasApi.get<{ runs: GenerationRun[] }>(`/generation/${DEFAULT_SCHOOL_ID}/${syId}/runs`, { params: { limit: 20 } });
		runsCacheBySchoolYear.set(syId, { ts: Date.now(), runs: data.runs });
		setRuns(data.runs);
		return data.runs;
	}, [setRuns]);

	const fetchRunData = useCallback(async (syId: number, runId: string, options?: FetchOptions) => {
		const { preferCache = false, backgroundRefresh = false, forceRefresh = false } = options ?? {};
		const runKey = cacheRunKey(syId, runId);
		const cached = runDataCacheBySchoolYearAndRun.get(runKey);
		const canUseCache = !forceRefresh && preferCache && cached && isFresh(cached.ts);
		const applyRunSnapshot = (draftSnapshot: DraftReport, violationsSnapshot: ViolationReport) => {
			setDraft((prev) => sameDraftSnapshot(prev, draftSnapshot) ? prev : draftSnapshot);
			setViolationReport((prev) => JSON.stringify(prev) === JSON.stringify(violationsSnapshot) ? prev : violationsSnapshot);
		};
		const refreshFollowUps = async (
			numericRunId: number,
			draftSnapshot: DraftReport,
			violationsSnapshot: ViolationReport,
			requestSeq: number,
		) => {
			let followUpEntryIds: string[] = [];
			try {
				const { data } = await atlasApi.get<{ flags: Array<{ entryId: string }> }>(`/follow-up-flags/${DEFAULT_SCHOOL_ID}/${syId}/runs/${numericRunId}/flags`);
				followUpEntryIds = data.flags.map((flag) => flag.entryId);
			} catch {
				followUpEntryIds = [];
			}
			if (requestSeq !== latestRunDataFetchSeqRef.current) return;
			runDataCacheBySchoolYearAndRun.set(runKey, {
				ts: Date.now(),
				draft: draftSnapshot,
				violations: violationsSnapshot,
				followUpEntryIds,
			});
			setFollowUps((prev) => {
				if (prev.size !== followUpEntryIds.length) return new Set(followUpEntryIds);
				for (const item of followUpEntryIds) if (!prev.has(item)) return new Set(followUpEntryIds);
				return prev;
			});
		};

		if (canUseCache) {
			applyRunSnapshot(cached.draft, cached.violations);
			setFollowUps((prev) => {
				if (prev.size !== cached.followUpEntryIds.length) return new Set(cached.followUpEntryIds);
				for (const item of cached.followUpEntryIds) if (!prev.has(item)) return new Set(cached.followUpEntryIds);
				return prev;
			});
			if (backgroundRefresh) {
				const requestSeq = latestRunDataFetchSeqRef.current + 1;
				latestRunDataFetchSeqRef.current = requestSeq;
				const base = `/generation/${DEFAULT_SCHOOL_ID}/${syId}/runs`;
				const runPath = runId === 'latest' ? `${base}/latest` : `${base}/${runId}`;
				void Promise.all([
					atlasApi.get<DraftReport>(`${runPath}/draft`),
					atlasApi.get<ViolationReport>(`${runPath}/violations`),
				]).then(([draftRes, violationsRes]) => {
					if (requestSeq !== latestRunDataFetchSeqRef.current) return;
					runDataCacheBySchoolYearAndRun.set(runKey, {
						ts: Date.now(),
						draft: draftRes.data,
						violations: violationsRes.data,
						followUpEntryIds: cached.followUpEntryIds,
					});
					applyRunSnapshot(draftRes.data, violationsRes.data);
					void refreshFollowUps(draftRes.data.runId, draftRes.data, violationsRes.data, requestSeq);
				}).catch(() => {
					// keep warm cache on transient refresh failure
				});
			}
			return;
		}

		const base = `/generation/${DEFAULT_SCHOOL_ID}/${syId}/runs`;
		const runPath = runId === 'latest' ? `${base}/latest` : `${base}/${runId}`;
		const requestSeq = latestRunDataFetchSeqRef.current + 1;
		latestRunDataFetchSeqRef.current = requestSeq;
		try {
			const [draftRes, violationsRes] = await Promise.all([
				atlasApi.get<DraftReport>(`${runPath}/draft`),
				atlasApi.get<ViolationReport>(`${runPath}/violations`),
			]);
			if (requestSeq !== latestRunDataFetchSeqRef.current) return;
			applyRunSnapshot(draftRes.data, violationsRes.data);
			runDataCacheBySchoolYearAndRun.set(runKey, {
				ts: Date.now(),
				draft: draftRes.data,
				violations: violationsRes.data,
				followUpEntryIds: [],
			});
			void refreshFollowUps(draftRes.data.runId, draftRes.data, violationsRes.data, requestSeq);
		} catch (error) {
			// Preserve structured API errors (NO_RUNS, NO_ACTIVE_DRAFT, STALE_RUN_DATA)
			// so loadAll's catch block can inspect the code and keep the workspace open.
			const code = getTimetableApiErrorCode(error);
			if (code === 'NO_RUNS' || code === 'NO_ACTIVE_DRAFT' || code === 'STALE_RUN_DATA') {
				throw error;
			}
			throw new Error(buildTimetableErrorMessage(error, 'Failed to load timetable run data.'));
		}
	}, [setDraft, setViolationReport, setFollowUps]);

	const fetchDraftBoardSummary = useCallback(async (syId: number, options?: FetchOptions) => {
		const { preferCache = false, backgroundRefresh = false, forceRefresh = false } = options ?? {};
		const cached = draftBoardCacheBySchoolYear.get(syId);
		const canUseCache = !forceRefresh && preferCache && cached && isFresh(cached.ts);

		if (canUseCache) {
			applyDraftBoard(cached.board);
			if (backgroundRefresh) {
				void atlasApi
					.get<DraftBoardState>(`/generation/${DEFAULT_SCHOOL_ID}/${syId}/pre-generation-drafts?preferCachedSections=true`)
					.then(({ data }) => {
						draftBoardCacheBySchoolYear.set(syId, { ts: Date.now(), board: data });
						applyDraftBoard(data);
					})
					.catch(() => {
						// keep warm cache on transient refresh failure
					});
			}
			return cached.board.counts;
		}

		try {
			const { data } = await atlasApi.get<DraftBoardState>(`/generation/${DEFAULT_SCHOOL_ID}/${syId}/pre-generation-drafts?preferCachedSections=true`);
			draftBoardCacheBySchoolYear.set(syId, { ts: Date.now(), board: data });
			applyDraftBoard(data);
			return data.counts;
		} catch {
			// Do NOT wipe the context state on intermittent 502/network errors.
			// Wiping the state causes massive re-renders that destroy active drag operations.
			return null;
		}
	}, [applyDraftBoard]);

	const loadRoomRequestSummary = useCallback(async (
		syId: number,
		statusFilter: 'ALL' | RoomPreferenceStatus,
		decisionFilter: 'ALL' | RoomPreferenceDecisionStatus,
		options?: FetchOptions,
	) => {
		const { preferCache = false, backgroundRefresh = false, forceRefresh = false } = options ?? {};
		const requestKey = cacheRoomRequestKey(syId, statusFilter, decisionFilter);
		const cached = roomRequestSummaryCacheByKey.get(requestKey);
		const canUseCache = !forceRefresh && preferCache && cached && isFresh(cached.ts);

		if (canUseCache) {
			applyRoomRequestSummary(cached.data);
			if (backgroundRefresh) {
				const params: Record<string, string> = {};
				if (statusFilter !== 'ALL') params.status = statusFilter;
				if (decisionFilter !== 'ALL') params.decisionStatus = decisionFilter;
				void atlasApi
					.get<RoomPreferenceSummaryResponse>(`/room-preferences/${DEFAULT_SCHOOL_ID}/${syId}/latest/summary`, { params })
					.then(({ data }) => {
						roomRequestSummaryCacheByKey.set(requestKey, { ts: Date.now(), data });
						applyRoomRequestSummary(data);
					})
					.catch(() => {
						// keep warm cache on transient refresh failure
					});
			}
			return;
		}

		setRoomRequestLoading(true);
		try {
			const params: Record<string, string> = {};
			if (statusFilter !== 'ALL') params.status = statusFilter;
			if (decisionFilter !== 'ALL') params.decisionStatus = decisionFilter;
			const { data } = await atlasApi.get<RoomPreferenceSummaryResponse>(`/room-preferences/${DEFAULT_SCHOOL_ID}/${syId}/latest/summary`, { params });
			roomRequestSummaryCacheByKey.set(requestKey, { ts: Date.now(), data });
			applyRoomRequestSummary(data);
		} catch (err) {
			setRoomRequestError(buildTimetableErrorMessage(err, 'Failed to load room requests.'));
		} finally {
			setRoomRequestLoading(false);
		}
	}, [applyRoomRequestSummary, setRoomRequestError, setRoomRequestLoading]);

	const fetchReferenceData = useCallback(async (syId: number, options?: FetchOptions) => {
		const { preferCache = false, forceRefresh = false } = options ?? {};
		const cached = referenceDataCacheBySchoolYear.get(syId);
		const canUseCache = !forceRefresh && preferCache && cached && isFresh(cached.ts);

		const hydrateReferenceState = (entry: CachedReferenceData) => {
			setSubjectMap((prev) => {
				if (prev.size === entry.subjects.length && JSON.stringify(Array.from(prev.values())) === JSON.stringify(entry.subjects)) return prev;
				return new Map(entry.subjects.map((subject) => [subject.id, subject]));
			});

			setFacultyMap((prev) => {
				if (prev.size === entry.faculty.length && JSON.stringify(Array.from(prev.values())) === JSON.stringify(entry.faculty)) return prev;
				return new Map(entry.faculty.map((facultyMember) => [facultyMember.id, facultyMember]));
			});

			setBuildings((prev) => JSON.stringify(prev) === JSON.stringify(entry.buildings) ? prev : entry.buildings);

			setSectionSummary((prev) => JSON.stringify(prev) === JSON.stringify(entry.sectionSummary) ? prev : entry.sectionSummary);

			setSectionMap((prev) => {
				if (prev.size === entry.sections.length && JSON.stringify(Array.from(prev.values())) === JSON.stringify(entry.sections)) return prev;
				return new Map(entry.sections.map((section) => [section.id, section]));
			});

			const enrichedRooms = new Map<number, RoomInfo>();
			for (const building of entry.buildings) {
				for (const room of building.rooms) {
					enrichedRooms.set(room.id, {
						id: room.id,
						name: room.name,
						buildingId: building.id,
						buildingName: building.name,
						buildingShortCode: building.shortCode,
						floor: room.floor,
						type: room.type,
						isTeachingSpace: room.isTeachingSpace,
					});
				}
			}
			setRoomMap((prev) => {
				if (prev.size === enrichedRooms.size && JSON.stringify(Array.from(prev.values())) === JSON.stringify(Array.from(enrichedRooms.values()))) return prev;
				return enrichedRooms;
			});
		};

		if (canUseCache) {
			hydrateReferenceState(cached);
			return;
		}

		const [subjectsRes, facultyRes, buildingsRes, sectionsRes] = await Promise.all([
			atlasApi.get<{ subjects: Subject[] }>(`/subjects?schoolId=${DEFAULT_SCHOOL_ID}`),
			atlasApi.get<{ faculty: FacultyMirror[] }>(`/faculty?schoolId=${DEFAULT_SCHOOL_ID}`),
			atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
			atlasApi.get<SectionSummaryResponse>(`/sections/summary/${syId}?schoolId=${DEFAULT_SCHOOL_ID}`).catch(() => ({ data: { sections: [] as ExternalSection[] } })),
		]);

		const nextEntry: CachedReferenceData = {
			ts: Date.now(),
			subjects: subjectsRes.data.subjects,
			faculty: facultyRes.data.faculty,
			buildings: buildingsRes.data.buildings,
			sections: sectionsRes.data.sections,
			sectionSummary: sectionsRes.data as SectionSummaryResponse,
		};
		referenceDataCacheBySchoolYear.set(syId, nextEntry);

		hydrateReferenceState(nextEntry);
	}, [setBuildings, setFacultyMap, setRoomMap, setSectionMap, setSectionSummary, setSubjectMap]);

	const openMapWorkspace = useCallback(async () => {
		if (!schoolYearId) return;
		if (subjectMap.size === 0 || facultyMap.size === 0 || roomMap.size === 0 || sectionMap.size === 0) {
			await fetchReferenceData(schoolYearId, { preferCache: true, backgroundRefresh: true });
		}
		setPreGenMapContext(isPreGenerationWorkspace);
		switchCenterViewWithGuard(() => setCenterView('map'));
	}, [schoolYearId, subjectMap.size, facultyMap.size, roomMap.size, sectionMap.size, fetchReferenceData, isPreGenerationWorkspace, setPreGenMapContext, switchCenterViewWithGuard, setCenterView]);

	const openBuildingWorkspace = useCallback(async (buildingId: number) => {
		if (!schoolYearId) return;
		if (subjectMap.size === 0 || facultyMap.size === 0 || roomMap.size === 0 || sectionMap.size === 0) {
			await fetchReferenceData(schoolYearId, { preferCache: true, backgroundRefresh: true });
		}
		setMapBuildingId(buildingId);
		setPreGenMapContext(isPreGenerationWorkspace);
		switchCenterViewWithGuard(() => setCenterView('building'));
	}, [schoolYearId, subjectMap.size, facultyMap.size, roomMap.size, sectionMap.size, fetchReferenceData, isPreGenerationWorkspace, setMapBuildingId, setPreGenMapContext, switchCenterViewWithGuard, setCenterView]);

	const openRoomGridWorkspace = useCallback((roomId: number) => {
		const room = roomMap.get(roomId);
		if (room) setMapBuildingId(room.buildingId);
		setMapRoomId(roomId);
		setViewMode('room');
		setEntityFilter(String(roomId));
		setPreGenMapContext(false);
		switchCenterViewWithGuard(() => setCenterView(preGenMapContext ? 'pre-generation' : (draft ? 'schedule' : 'pre-generation')));
	}, [draft, preGenMapContext, roomMap, setMapBuildingId, setMapRoomId, setViewMode, setEntityFilter, setPreGenMapContext, switchCenterViewWithGuard, setCenterView]);

	const loadAll = useCallback(async (options?: { preserveRun?: boolean; force?: boolean } | boolean) => {
		const preserveRun = typeof options === 'boolean' ? options : options?.preserveRun ?? false;
		const force = typeof options === 'object' ? options?.force ?? false : false;

		setLoading(true);
		setError(null);
		try {
			const syId = schoolYearId ?? (await fetchSchoolYear());
			if (!syId) {
				setError('No active school year found.');
				setLoading(false);
				return;
			}
			const fetchedRuns = await fetchRuns(syId, { preferCache: !force, forceRefresh: force });
			const referenceDataPromise = fetchReferenceData(syId, {
				preferCache: !force,
				forceRefresh: force,
				backgroundRefresh: !force,
			}).catch(() => {
				// Reference labels and advanced map pivots are non-primary for first grid readiness.
				// Keep the timetable usable with ID fallbacks and let explicit refresh retry.
			});

			if (fetchedRuns.length === 0) {
				setDraft(null);
				setViolationReport(null);
				setSelectedRunId('latest');
				void fetchDraftBoardSummary(syId, { preferCache: !force, forceRefresh: force });
				void loadRoomRequestSummary(syId, requestStatusFilter, requestDecisionFilter, { preferCache: !force, forceRefresh: force });
				void referenceDataPromise;
				setLoading(false);
				return;
			}

			const runId = preserveRun ? selectedRunIdRef.current : 'latest';
			if (!preserveRun) setSelectedRunId('latest');
			try {
				await fetchRunData(syId, runId, { preferCache: !force, forceRefresh: force });
			} catch (error) {
				const code = getTimetableApiErrorCode(error);
				if (runId === 'latest' && code === 'STALE_RUN_DATA') {
					const latestRunId = fetchedRuns[0]?.id;
					if (latestRunId == null) throw error;
					await fetchRunData(syId, String(latestRunId), { preferCache: !force, forceRefresh: force });
				} else {
					throw error;
				}
			}

			// Secondary rail diagnostics are intentionally deferred to keep first render interactive.
			void referenceDataPromise;
			void fetchDraftBoardSummary(syId, { preferCache: !force, forceRefresh: force });
			void loadRoomRequestSummary(syId, requestStatusFilter, requestDecisionFilter, { preferCache: !force, forceRefresh: force });
		} catch (e: unknown) {
			const code = getTimetableApiErrorCode(e);
			if (code === 'NO_ACTIVE_DRAFT' || code === 'STALE_RUN_DATA' || code === 'NO_RUNS') {
				// Keep the workspace accessible for setup/pre-generation controls.
				setDraft(null);
				setViolationReport(null);
				setError(null);
			} else {
				const msg = buildTimetableErrorMessage(e, 'Failed to load data.');
				setError(msg);
			}
		} finally {
			setLoading(false);
		}
	}, [
		schoolYearId,
		fetchSchoolYear,
		fetchRuns,
		fetchRunData,
		fetchReferenceData,
		fetchDraftBoardSummary,
		loadRoomRequestSummary,
		requestDecisionFilter,
		requestStatusFilter,
		setLoading,
		setError,
		setDraft,
		setViolationReport,
		setSelectedRunId,
	]);

	useEffect(() => {
		void loadAll();
	}, [loadAll]);

	useEffect(() => {
		if (!schoolYearId) return;
		void loadRoomRequestSummary(schoolYearId, requestStatusFilter, requestDecisionFilter);
	}, [schoolYearId, loadRoomRequestSummary, requestStatusFilter, requestDecisionFilter]);

	useEffect(() => {
		if (runs.length === 0) setLeftTab('pinned');
	}, [runs.length, setLeftTab]);

	useEffect(() => {
		if (!isPreGenerationWorkspace && leftTab === 'pinned') setLeftTab('violations');
	}, [isPreGenerationWorkspace, leftTab, runs.length, setLeftTab]);

	useEffect(() => {
		if (centerView !== 'pre-generation') {
			setPreGenKbSource(null);
			if (kbSelectedSource?.type === 'draftPlacement' || kbSelectedSource?.type === 'draftQueue') setKbSelectedSource(null);
		}
	}, [centerView, kbSelectedSource, setPreGenKbSource, setKbSelectedSource]);

	useEffect(() => {
		if (!selectedEntry) return;
		setPreGenKbSource(null);
		if (kbSelectedSource && kbSelectedSource.type !== 'entry') setKbSelectedSource(null);
	}, [selectedEntry, kbSelectedSource, setPreGenKbSource, setKbSelectedSource]);

	useEffect(() => {
		if (!selectedEntry) return;
		const updated = activeGridEntriesBase.find((entry) => entry.entryId === selectedEntry.entryId) ?? null;
		if (!updated) {
			setSelectedEntry(null);
			setSelectedViolation(null);
			return;
		}
		if (updated !== selectedEntry) setSelectedEntry(updated);
	}, [activeGridEntriesBase, selectedEntry, setSelectedEntry, setSelectedViolation]);

	const handleRefresh = useCallback(() => {
		void loadAll({ preserveRun: true, force: true });
	}, [loadAll]);

	const refreshReferenceLabels = useCallback(() => {
		if (!schoolYearId) return;
		void fetchReferenceData(schoolYearId, { forceRefresh: true });
	}, [fetchReferenceData, schoolYearId]);

	const subjectLabel = useCallback((id: number) => {
		const s = subjectMap.get(id);
		if (s) return s.displayCode ?? s.code;
		return subjectMap.size === 0 ? 'Loading subject name...' : 'Subject name missing';
	}, [subjectMap]);

	const facultyLabel = useCallback((id: number) => {
		const f = facultyMap.get(id);
		if (!f) return facultyMap.size === 0 ? 'Loading teacher name...' : 'Teacher name missing';
		const adviserSuffix = f.advisedSectionName ? ` · Adviser ${f.advisedSectionName}` : '';
		return `${f.lastName}, ${f.firstName}${adviserSuffix}`;
	}, [facultyMap]);

	const formatFacultyInitials = useCallback((id: number) => {
		const f = facultyMap.get(id);
		if (!f) return `Faculty #${id}`;
		const initial = f.firstName ? `${f.firstName.charAt(0).toUpperCase()}.` : '';
		return `${initial} ${f.lastName}`.trim();
	}, [facultyMap]);

	const sectionLabel = useCallback((id: number) => {
		const s = sectionMap.get(id);
		if (!s) return sectionMap.size === 0 ? 'Loading section name...' : 'Section name missing';
		const programLabel = s.programType && s.programType !== 'REGULAR'
			? ` · ${getProgramBadgeLabel(s.programType, s.programCode)}`
			: '';
		return `${s.name}${programLabel}`;
	}, [sectionMap]);

	const roomLabel = useCallback((roomId: number) => {
		const ri = roomMap.get(roomId);
		if (!ri) return roomMap.size === 0 ? 'Loading room name...' : 'Room name missing';
		const bldg = ri.buildingShortCode || ri.buildingName;
		return `${ri.name} · ${bldg} (Floor ${ri.floor})`;
	}, [roomMap]);

	const roomLabelShort = useCallback((roomId: number) => {
		const ri = roomMap.get(roomId);
		if (!ri) return roomMap.size === 0 ? 'Loading room name...' : 'Room name missing';
		const bldg = ri.buildingShortCode || ri.buildingName;
		return `${ri.name} · ${bldg}`;
	}, [roomMap]);

	const referenceLookupStatus = useMemo(() => {
		if (subjectMap.size === 0 || sectionMap.size === 0 || facultyMap.size === 0 || roomMap.size === 0) {
			return { state: 'loading' as const, label: 'Loading names' };
		}
		const hasMissingReference = activeGridEntriesBase.some((entry) => (
			!subjectMap.has(entry.subjectId)
			|| !sectionMap.has(entry.sectionId)
			|| (entry.facultyId != null && !facultyMap.has(entry.facultyId))
			|| !roomMap.has(entry.roomId)
		));
		return hasMissingReference
			? { state: 'needs-refresh' as const, label: 'Some names need refresh' }
			: { state: 'ready' as const, label: 'Names loaded' };
	}, [activeGridEntriesBase, facultyMap, roomMap, sectionMap, subjectMap]);

	const isStaleRoom = useCallback((roomId: number): boolean => !roomMap.has(roomId), [roomMap]);

	const pivotLabel = useCallback((id: number): string => {
		if (viewMode === 'section') return sectionLabel(id);
		if (viewMode === 'faculty') return facultyLabel(id);
		return roomLabelShort(id);
	}, [viewMode, sectionLabel, facultyLabel, roomLabelShort]);

	return {
		violations,
		violationIndex,
		highlightedEntryIds,
		filteredViolations,
		violationsByCode,
		hardViolationCount,
		topBlockers,
		preGenEntries,
		isPreGenerationWorkspace,
		activeGridEntriesBase,
		timeSlots,
		displayTimeSlots,
		hiddenRowCount,
		getCellConflict,
		getLiveCellConflict,
		releaseDeferredDragUpdates,
		filteredDraftEntries,
		programKindFilteredUnassignedItems,
		filteredUnassignedItems,
		sectionIds,
		pivotEntityIds,
		gridEntries,
		gridIndex,
		pivotKeyOf,
		summary,
		navToFaculty,
		navToSection,
		navToRoom,
		activeGeneratedRunId,
		fetchSchoolYear,
		fetchRuns,
		fetchRunData,
		fetchDraftBoardSummary,
		loadRoomRequestSummary,
		fetchReferenceData,
		refreshReferenceLabels,
		openMapWorkspace,
		openBuildingWorkspace,
		openRoomGridWorkspace,
		loadAll,
		handleRefresh,
		subjectLabel,
		facultyLabel,
		formatFacultyInitials,
		sectionLabel,
		roomLabel,
		roomLabelShort,
		isStaleRoom,
		pivotLabel,
		schoolYearContext,
		referenceLookupStatus,
	};
}
