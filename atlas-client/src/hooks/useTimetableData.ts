import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import { getProgramBadgeLabel, matchesEntryKindFilter, matchesProgramFilter } from '@/lib/schedule-review-helpers';
import {
	buildViolationIndex,
	deriveTimeSlots,
	minutesBetween,
} from '@/lib/timetable-utils';
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
	FACULTY_SUBJECT_NOT_QUALIFIED: 'Not Qualified',
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
	SESSION_PATTERN_VIOLATED: 'Session Pattern Violated',
	LACKING_FACULTY: 'Lacking Faculty',
	INCOMPLETE_MODULAR_GROUP: 'Incomplete Modular Group',
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
	cellConflictMap: Map<string, CellConflictInfo> | null;
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
};

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
		preGenKbSource,
		kbSelectedSource,
		setPreGenKbSource,
		setKbSelectedSource,
	} = input;

	const violations = violationReport?.violations ?? [];
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

	const activeGridEntriesBase = isPreGenerationWorkspace ? preGenEntries : (draft?.entries ?? []);
	const timeSlots = useMemo(
		() => isPreGenerationWorkspace && draftBoard?.periodSlots?.length
			? draftBoard.periodSlots
			: deriveTimeSlots(activeGridEntriesBase),
		[activeGridEntriesBase, draftBoard?.periodSlots, isPreGenerationWorkspace],
	);

	const cellConflictMap = useMemo<Map<string, CellConflictInfo> | null>(() => {
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
			}
		} else if (selectedEntry) {
			sectionId = selectedEntry.sectionId;
			facultyId = selectedEntry.facultyId;
			roomId = selectedEntry.roomId;
			sourceEntryId = selectedEntry.entryId;
		}

		if (!sectionId) return null;

		const allIndex = new Map<string, ScheduledEntry[]>();
		for (const e of activeGridEntriesBase) {
			const key = `${e.day}-${e.startTime}-${e.endTime}`;
			const list = allIndex.get(key) ?? [];
			list.push(e);
			allIndex.set(key, list);
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
						const existingDailyMins = activeGridEntriesBase
							.filter((e) => e.day === day && e.facultyId === fid && e.entryId !== sourceEntryId)
							.reduce((sum, e) => sum + minutesBetween(e.startTime, e.endTime), 0);
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
	}, [dragItem, preGenKbSource, kbSelectedSource, selectedEntry, activeGridEntriesBase, timeSlots, facultyMap, sectionMap, roomMap, subjectMap]);

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

	const sectionIds = useMemo(() => {
		const ids = new Set<number>();
		for (const e of filteredDraftEntries) ids.add(e.sectionId);
		return Array.from(ids).sort((a, b) => a - b);
	}, [filteredDraftEntries]);

	const pivotEntityIds = useMemo(() => {
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
		if (isPreGen) {
			for (const [id, room] of roomMap.entries()) if (room.isTeachingSpace) ids.add(id);
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
		const settings = await fetchPublicSettings();
		if (settings.activeSchoolYearId) setSchoolYearId(settings.activeSchoolYearId);
		return settings.activeSchoolYearId ?? null;
	}, [setSchoolYearId]);

	const fetchRuns = useCallback(async (syId: number) => {
		const { data } = await atlasApi.get<{ runs: GenerationRun[] }>(`/generation/${DEFAULT_SCHOOL_ID}/${syId}/runs`, { params: { limit: 20 } });
		setRuns(data.runs);
		return data.runs;
	}, [setRuns]);

	const fetchRunData = useCallback(async (syId: number, runId: string) => {
		const base = `/generation/${DEFAULT_SCHOOL_ID}/${syId}/runs`;
		const runPath = runId === 'latest' ? `${base}/latest` : `${base}/${runId}`;
		try {
			const [draftRes, violationsRes] = await Promise.all([
				atlasApi.get<DraftReport>(`${runPath}/draft`),
				atlasApi.get<ViolationReport>(`${runPath}/violations`),
			]);
			setDraft(draftRes.data);
			setViolationReport(violationsRes.data);
			const numericRunId = draftRes.data.runId;
			try {
				const { data } = await atlasApi.get<{ flags: Array<{ entryId: string }> }>(`/follow-up-flags/${DEFAULT_SCHOOL_ID}/${syId}/runs/${numericRunId}/flags`);
				setFollowUps(new Set(data.flags.map((f) => f.entryId)));
			} catch {
				setFollowUps(new Set());
			}
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

	const fetchDraftBoardSummary = useCallback(async (syId: number) => {
		try {
			const { data } = await atlasApi.get<DraftBoardState>(`/generation/${DEFAULT_SCHOOL_ID}/${syId}/pre-generation-drafts`);
			setDraftBoard(data);
			setDraftBoardSummary(data.counts);
			return data.counts;
		} catch {
			setDraftBoard(null);
			setDraftBoardSummary(null);
			return null;
		}
	}, [setDraftBoard, setDraftBoardSummary]);

	const loadRoomRequestSummary = useCallback(async (syId: number, statusFilter: 'ALL' | RoomPreferenceStatus, decisionFilter: 'ALL' | RoomPreferenceDecisionStatus) => {
		setRoomRequestLoading(true);
		try {
			const params: Record<string, string> = {};
			if (statusFilter !== 'ALL') params.status = statusFilter;
			if (decisionFilter !== 'ALL') params.decisionStatus = decisionFilter;
			const { data } = await atlasApi.get<RoomPreferenceSummaryResponse>(`/room-preferences/${DEFAULT_SCHOOL_ID}/${syId}/latest/summary`, { params });
			setRoomRequestSummary(data);
			setRoomRequestError(null);
		} catch (err) {
			setRoomRequestError(buildTimetableErrorMessage(err, 'Failed to load room requests.'));
		} finally {
			setRoomRequestLoading(false);
		}
	}, [setRoomRequestError, setRoomRequestLoading, setRoomRequestSummary]);

	const fetchReferenceData = useCallback(async (syId: number) => {
		const [subjectsRes, facultyRes, buildingsRes, sectionsRes] = await Promise.all([
			atlasApi.get<{ subjects: Subject[] }>(`/subjects?schoolId=${DEFAULT_SCHOOL_ID}`),
			atlasApi.get<{ faculty: FacultyMirror[] }>(`/faculty?schoolId=${DEFAULT_SCHOOL_ID}`),
			atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
			atlasApi.get<SectionSummaryResponse>(`/sections/summary/${syId}?schoolId=${DEFAULT_SCHOOL_ID}`).catch(() => ({ data: { sections: [] as ExternalSection[] } })),
		]);
		setSubjectMap(new Map(subjectsRes.data.subjects.map((s) => [s.id, s])));
		setFacultyMap(new Map(facultyRes.data.faculty.map((f) => [f.id, f])));
		setBuildings(buildingsRes.data.buildings);
		setSectionSummary(sectionsRes.data as SectionSummaryResponse);
		setSectionMap(new Map(sectionsRes.data.sections.map((s) => [s.id, s])));

		const enrichedRooms = new Map<number, RoomInfo>();
		for (const b of buildingsRes.data.buildings) {
			for (const r of b.rooms) {
				enrichedRooms.set(r.id, {
					id: r.id,
					name: r.name,
					buildingId: b.id,
					buildingName: b.name,
					buildingShortCode: b.shortCode,
					floor: r.floor,
					type: r.type,
					isTeachingSpace: r.isTeachingSpace,
				});
			}
		}
		setRoomMap(enrichedRooms);
	}, [setBuildings, setFacultyMap, setRoomMap, setSectionMap, setSectionSummary, setSubjectMap]);

	const openMapWorkspace = useCallback(async () => {
		if (!schoolYearId) return;
		await fetchReferenceData(schoolYearId);
		setPreGenMapContext(isPreGenerationWorkspace);
		switchCenterViewWithGuard(() => setCenterView('map'));
	}, [schoolYearId, fetchReferenceData, isPreGenerationWorkspace, setPreGenMapContext, switchCenterViewWithGuard, setCenterView]);

	const openBuildingWorkspace = useCallback(async (buildingId: number) => {
		if (!schoolYearId) return;
		await fetchReferenceData(schoolYearId);
		setMapBuildingId(buildingId);
		setPreGenMapContext(isPreGenerationWorkspace);
		switchCenterViewWithGuard(() => setCenterView('building'));
	}, [schoolYearId, fetchReferenceData, isPreGenerationWorkspace, setMapBuildingId, setPreGenMapContext, switchCenterViewWithGuard, setCenterView]);

	const openRoomGridWorkspace = useCallback((roomId: number) => {
		const room = roomMap.get(roomId);
		if (room) setMapBuildingId(room.buildingId);
		setMapRoomId(roomId);
		setViewMode('room');
		setEntityFilter(String(roomId));
		setPreGenMapContext(false);
		switchCenterViewWithGuard(() => setCenterView(preGenMapContext ? 'pre-generation' : (draft ? 'schedule' : 'pre-generation')));
	}, [draft, preGenMapContext, roomMap, setMapBuildingId, setMapRoomId, setViewMode, setEntityFilter, setPreGenMapContext, switchCenterViewWithGuard, setCenterView]);

	const loadAll = useCallback(async (preserveRun = false) => {
		setLoading(true);
		setError(null);
		try {
			const syId = schoolYearId ?? (await fetchSchoolYear());
			if (!syId) {
				setError('No active school year found.');
				setLoading(false);
				return;
			}
			const [fetchedRuns] = await Promise.all([
				fetchRuns(syId),
				fetchReferenceData(syId),
				fetchDraftBoardSummary(syId),
				loadRoomRequestSummary(syId, requestStatusFilter, requestDecisionFilter),
			]);

			if (fetchedRuns.length === 0) {
				setDraft(null);
				setViolationReport(null);
				setSelectedRunId('latest');
				setLoading(false);
				return;
			}

			const runId = preserveRun ? selectedRunId : 'latest';
			if (!preserveRun) setSelectedRunId('latest');
			await fetchRunData(syId, runId);
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
		selectedRunId,
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
		void loadAll(true);
	}, [loadAll]);

	const subjectLabel = useCallback((id: number) => {
		const s = subjectMap.get(id);
		return s ? s.code : `Unknown Subject (#${id})`;
	}, [subjectMap]);

	const facultyLabel = useCallback((id: number) => {
		const f = facultyMap.get(id);
		if (!f) return `Unknown Faculty (#${id})`;
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
		if (!s) return `Unknown Section (#${id})`;
		const programLabel = s.programType && s.programType !== 'REGULAR'
			? ` · ${getProgramBadgeLabel(s.programType, s.programCode)}`
			: '';
		return `${s.name}${programLabel}`;
	}, [sectionMap]);

	const roomLabel = useCallback((roomId: number) => {
		const ri = roomMap.get(roomId);
		if (!ri) return `Unknown Room (#${roomId})`;
		const bldg = ri.buildingShortCode || ri.buildingName;
		return `${ri.name} · ${bldg} (Floor ${ri.floor})`;
	}, [roomMap]);

	const roomLabelShort = useCallback((roomId: number) => {
		const ri = roomMap.get(roomId);
		if (!ri) return `Unknown Room (#${roomId})`;
		const bldg = ri.buildingShortCode || ri.buildingName;
		return `${ri.name} · ${bldg}`;
	}, [roomMap]);

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
		cellConflictMap,
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
	};
}
