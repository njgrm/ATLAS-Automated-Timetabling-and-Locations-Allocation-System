import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ImperativePanelHandle } from 'react-resizable-panels';

import { resolveActiveSchoolYearContext, type ActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { resolveActorSchoolId } from '@/lib/settings';
import { isVerifiedOrderedActiveTerm } from '@/lib/academic-term';
import { isVerifiedOrderedActiveTerm } from '@/lib/academic-term';
import { findGradeWindow, getProgramBadgeLabel, matchesEntryKindFilter, matchesProgramFilter, resolveSectionGradeNumber } from '@/lib/schedule-review-helpers';
import {
	buildViolationIndex,
	deriveTimeSlotsFromSummary,
	minutesBetween,
} from '@/lib/timetable-utils';
import {
	buildGridRows,
	resolveEntityDisplaySlots,
	type GridDisplaySlot,
} from '@/lib/timetable-grid-slots';
import { buildLiveConflictIndex, createLiveConflictLookup } from '@/lib/timetable-live-conflict';
import { matchesTermScope } from '@/lib/timetable-term-scope';
import {
	buildFacultyInitials,
	buildFacultyLabel,
	buildRoomLabel,
	buildRoomLabelShort,
	buildSectionLabel,
	buildSubjectLabel,
} from '@/lib/timetable-reference-labels';
import { deriveGenerationReadinessState, type TimetableCurriculumReadinessState } from '@/lib/timetable-generation-readiness';
import {
	isResolvedTimetableScope,
	timetableRunBundleQueryKey,
	type ResolvedTimetableScope,
	type TimetableScope,
} from '@/lib/timetable-data/timetableQueryKeys';
import {
	ensureTimetableDraftBoard,
	ensureTimetableFollowUps,
	ensureTimetableReadiness,
	ensureTimetableReferenceData,
	ensureTimetableRoomRequestSummary,
	ensureTimetableRunBundle,
	ensureTimetableRuns,
	readTimetableWarmSnapshot,
	recordTimetableWarmScope,
} from '@/lib/timetable-data/timetableServerState';
import { TIMETABLE_GC_MS, TIMETABLE_STALE_MS, timetableQueryClient } from '@/lib/timetable-data/timetableQueryClient';
import { runTimetableLoad } from '@/lib/timetable-data/timetableLoadOrchestration';
import type { TimetableReferenceData } from '@/lib/timetable-data/timetableDataSources';
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
import { VIOLATION_TITLES } from '@/lib/violation-presentation';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

const VIOLATION_LABELS: Record<ViolationCode, string> = VIOLATION_TITLES;
// Historical persisted runs can still carry the retired metric code. Keep this
// explicit wire fallback visible here until every such run has aged out.
const LEGACY_VIOLATION_LABELS = {
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: 'Excessive Travel Distance',
} as const;

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

export type { TimetableCurriculumReadinessState };

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
	'FACULTY_FLOOR_TRANSITION',
	'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS',
	'FACULTY_INSUFFICIENT_TRANSITION_BUFFER',
	'FACULTY_EXCESSIVE_IDLE_GAP',
	'FACULTY_EARLY_START_PREFERENCE',
	'FACULTY_LATE_END_PREFERENCE',
]);

/**
 * Resolve a readable violation label. An unknown/legacy code must never throw;
 * it degrades to a humanised code string (R7).
 */
export function resolveViolationLabel(code: string): string {
	const known = VIOLATION_LABELS[code as ViolationCode];
	const legacy = LEGACY_VIOLATION_LABELS[code as keyof typeof LEGACY_VIOLATION_LABELS];
	return known ?? legacy ?? code.replace(/_/g, ' ').toLowerCase();
}

/** Search predicate shared by the violation rail (guarded label lookup). */
export function matchesViolationSearch(violation: Violation, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return violation.message.toLowerCase().includes(q)
		|| violation.code.toLowerCase().includes(q)
		|| resolveViolationLabel(violation.code).toLowerCase().includes(q);
}

/**
 * R7/A-01/F2: the publish gate consumes the run-wide authoritative count when
 * the server provides it; the selected-term display list remains the fallback
 * only for older payloads. Prefer the allowlist-filtered `blockingHard`; a
 * legacy payload without it falls back to the unfiltered `hard` (fail-closed).
 */
export function resolveHardViolationCount(
	report: { counts?: { runWide?: { hard?: number; blockingHard?: number } } } | null | undefined,
	violations: Violation[],
): number {
	const runWideBlocking = report?.counts?.runWide?.blockingHard;
	if (typeof runWideBlocking === 'number') return runWideBlocking;
	const runWideHard = report?.counts?.runWide?.hard;
	if (typeof runWideHard === 'number') return runWideHard;
	return violations.filter((violation) => violation.severity === 'HARD').length;
}

type FetchOptions = {
	preferCache?: boolean;
	backgroundRefresh?: boolean;
	forceRefresh?: boolean;
};

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
	sectionFocusId: number | null;
	viewMode: 'section' | 'faculty' | 'room';
	setViewMode: React.Dispatch<React.SetStateAction<'section' | 'faculty' | 'room'>>;
	programFilter: ProgramFilter;
	entryKindFilter: EntryKindFilter;
	termFilter: 'all' | number;
	userOverrodeTermFilter: boolean;
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
	centerView: 'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building' | 'exports' | 'runs' | 'setup';
	preGenOnboarding: boolean;
	preGenMapContext: boolean;
	setPreGenMapContext: React.Dispatch<React.SetStateAction<boolean>>;
	setCenterView: React.Dispatch<React.SetStateAction<'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building' | 'exports' | 'runs' | 'setup'>>;
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

export type TimetableTermScopeState = {
	authorityReady: boolean;
	queryEnabled: boolean;
	termIndex: 'all' | number | null;
	status: 'checking' | 'setup-required' | 'active';
};

/**
 * TIMETABLE-TERM-GATE-C01 — the single term-authority predicate. Authority is
 * ready only when the context carries a verified active term whose index is a
 * member of the ordered contract. Everything else (unverified, missing,
 * drifted) is unresolved and must never authorize an implicit all-term fetch.
 */
export function isTermAuthorityVerified(
	activeTerm: ActiveSchoolYearContext['activeTerm'] | null | undefined,
): boolean {
	return isVerifiedOrderedActiveTerm(activeTerm);
}

/**
 * D3 — explicit fallback scope when term authority can never be verified. The
 * persisted active term wins when the context carries one; otherwise Term 1.
 * The result is always an explicit numeric term — never an implicit all-term
 * scope — so the implicit-scope protection is preserved by construction.
 */
export function resolveTimetableFallbackTermIndex(
	activeTerm: ActiveSchoolYearContext['activeTerm'] | null | undefined,
): number {
	const persisted = activeTerm?.termIndex;
	if (typeof persisted === 'number' && Number.isInteger(persisted) && persisted > 0) return persisted;
	return 1;
}

/** D3 — the visible notice carried while the fallback scope is in effect. */
export function buildTermAuthorityUnverifiedNotice(termIndex: number): string {
	return `Showing Term ${termIndex} with an explicit scope — term authority unverified. Term setup verification was unavailable, so the timetable loaded one explicit term instead of all terms.`;
}

/**
 * Header-surface derivation (no new plumbing): the notice is visible exactly
 * when authority is unresolved yet timetable data is already on screen — i.e.
 * the D3 fallback loaded. A blocked page (no data) keeps the setup message
 * instead, and a null context (still checking) shows nothing.
 */
export function resolveTermAuthorityNotice(
	schoolYearContext: ActiveSchoolYearContext | null | undefined,
	hasTimetableData: boolean,
): string | null {
	if (!schoolYearContext || hasTimetableData === false) return null;
	if (isTermAuthorityVerified(schoolYearContext.activeTerm)) return null;
	return buildTermAuthorityUnverifiedNotice(resolveTimetableFallbackTermIndex(schoolYearContext.activeTerm));
}

export type TimetableLoadGateDecision =
	| { kind: 'load'; termIndex: number | 'all'; fallback: boolean }
	| { kind: 'blocked-setup' };

/**
 * D2/D3 — the production load gate, extracted pure so the three branches are
 * directly testable. Verified authority with an explicit choice (a numeric
 * term or an explicit All terms override) loads that scope. Unresolved
 * authority never dead-ends and never returns an implicit all-term scope: it
 * loads one explicit term (the user's numeric choice when present, else the
 * persisted active term, else Term 1). Verified authority with no explicit
 * choice yet stays blocked on the setup message until the workspace selects
 * the active term.
 */
export function resolveTimetableLoadGate(args: {
	authorityReady: boolean;
	termFilter: 'all' | number;
	userOverrodeTermFilter: boolean;
	fallbackTermIndex: number;
}): TimetableLoadGateDecision {
	if (args.authorityReady && (typeof args.termFilter === 'number' || args.userOverrodeTermFilter)) {
		return { kind: 'load', termIndex: args.termFilter, fallback: false };
	}
	if (!args.authorityReady) {
		const explicitTerm = typeof args.termFilter === 'number' ? args.termFilter : args.fallbackTermIndex;
		return { kind: 'load', termIndex: explicitTerm, fallback: true };
	}
	return { kind: 'blocked-setup' };
}

export type TimetableTermAuthorityResolution = {
	context: ActiveSchoolYearContext;
	authorityReady: boolean;
	verifyUpstreamRequested: boolean;
};

/**
 * D1 — resolve term authority for the timetable bootstrap. The fast cached
 * read stays the first step so navigation never blocks on upstream
 * verification; when it leaves authority unresolved, exactly one
 * `verifyUpstream: true` call follows (deduped by request profile inside
 * `resolveActiveSchoolYearContext`). Returns null when the actor school moved
 * on while a read was in flight (late-response discard). A failed verification
 * keeps the fast-read state so the caller can fall back to an explicit scope.
 */
export async function resolveTimetableTermAuthority(
	actorSchoolId: number,
	isObsolete: () => boolean,
): Promise<TimetableTermAuthorityResolution | null> {
	const context = await resolveActiveSchoolYearContext({
		schoolId: actorSchoolId,
		// Prefer cached school-year immediately so timetable bootstrap doesn't
		// block waiting on a forced upstream verification on every navigation.
		preferCache: true,
		backgroundRefresh: true,
		allowStaleOnError: true,
		allowEnrollProFallback: false,
	});
	// Discard a late response whose actor school changed while it was in flight.
	if (isObsolete()) return null;
	let current = context;
	let authorityReady = isTermAuthorityVerified(current.activeTerm);
	let verifyUpstreamRequested = false;
	if (!authorityReady) {
		try {
			verifyUpstreamRequested = true;
			// forceRefresh bypasses the fresh-cache short-circuit: a fresh but
			// unverified cache entry would otherwise satisfy this call without
			// ever dispatching, and the gate would stay unsatisfiable. The
			// request still dedupes by profile, so this is exactly one call.
			const verified = await resolveActiveSchoolYearContext({
				schoolId: actorSchoolId,
				forceRefresh: true,
				verifyUpstream: true,
				allowStaleOnError: true,
				allowEnrollProFallback: false,
			});
			if (isObsolete()) return null;
			current = verified;
			authorityReady = isTermAuthorityVerified(current.activeTerm);
		} catch {
			// Keep the fast-read state. The load gate falls back to an explicit
			// term scope (D3) instead of dead-ending.
		}
	}
	return { context: current, authorityReady, verifyUpstreamRequested };
}

/**
 * Resolve the route's term gate before any run query is enabled. The initial
 * unscoped state is deliberately distinct from a deliberate All terms choice.
 */
export function resolveTimetableTermScopeState(
	activeTerm: ActiveSchoolYearContext['activeTerm'] | null | undefined,
	termFilter: 'all' | number,
	userOverrodeTermFilter: boolean,
): TimetableTermScopeState {
	if (!activeTerm) return { authorityReady: false, queryEnabled: false, termIndex: null, status: 'checking' };
	const authorityReady = isTermAuthorityVerified(activeTerm);
	if (!authorityReady) return { authorityReady: false, queryEnabled: false, termIndex: null, status: 'setup-required' };
	if (typeof termFilter === 'number') return { authorityReady: true, queryEnabled: true, termIndex: termFilter, status: 'active' };
	if (userOverrodeTermFilter) return { authorityReady: true, queryEnabled: true, termIndex: 'all', status: 'active' };
	return { authorityReady: true, queryEnabled: false, termIndex: null, status: 'active' };
}

export type TimetableDataState = {
	schoolId: number | null;
	curriculumReadiness: TimetableCurriculumReadinessState;
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
	timeSlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string; dayOfWeek?: string }>;
	displayTimeSlots: Array<{ startTime: string; endTime: string; isSpecialEvent?: boolean; eventName?: string; dayOfWeek?: string }>;
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
	/** D3 — visible notice while the explicit fallback scope is in effect. */
	termAuthorityNotice: string | null;
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
		sectionFocusId,
		viewMode,
		setViewMode,
		programFilter,
		entryKindFilter,
		termFilter,
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
	// A term change can start a new load while the prior authority/bootstrap
	// read is still in flight. Only the newest load may clear or replace the
	// workspace; an older pre-authority result must not restore the setup gate.
	const loadSequenceRef = useRef(0);
	const [schoolYearContext, setSchoolYearContext] = useState<ActiveSchoolYearContext | null>(null);
	const termAuthorityReadyRef = useRef(false);
	// TIMETABLE-TERM-GATE-C01 (D3) — the explicit fallback scope in effect while
	// term authority is unresolved. The ref drives the imperative fetch scopes
	// (stable callback identity); the state re-renders the grid/query gate.
	const fallbackTermRef = useRef<number | null>(null);
	const [fallbackTermIndex, setFallbackTermIndex] = useState<number | null>(null);
	const [termAuthorityNotice, setTermAuthorityNotice] = useState<string | null>(null);
	// D2 — set when the load gate blocks so the verified-landing effect can
	// re-run the load instead of leaving a dead page.
	const gateBlockedRef = useRef(false);
	// Latest context independent of the render closure, so the load gate can
	// derive the D3 fallback from the context that just landed.
	const latestContextRef = useRef<ActiveSchoolYearContext | null>(null);
	const [schoolId, setSchoolId] = useState<number | null>(null);
	const resolvedSchoolIdRef = useRef<number | null>(null);
	const generationReadinessSeqRef = useRef(0);
	const [curriculumReadiness, setCurriculumReadiness] = useState<TimetableCurriculumReadinessState>({ state: 'loading', message: 'Checking generation readiness…' });
	// UX-C01R — a school/year change invalidates any prior readiness decision so
	// a stale ready result can never gate generation for a different scope.
	useEffect(() => {
		generationReadinessSeqRef.current += 1;
		setCurriculumReadiness({ state: 'loading', message: 'Checking generation readiness…' });
	}, [schoolId, schoolYearId]);
	useEffect(() => {
		selectedRunIdRef.current = selectedRunId;
	}, [selectedRunId]);

	// TT-OUTPUT-C03R3: the selected term's violation rail contains only that
	// term's actionable items. Violations with no term identity are global and
	// remain visible for every term.
	const violations = useMemo(() => {
		const all = violationReport?.violations ?? [];
		if (typeof termFilter !== 'number') return all;
		const termByEntryId = new Map((draft?.entries ?? []).map((entry) => [entry.entryId, entry.termIndex]));
		return all.filter((violation) => {
			const metaTerm = (violation.meta as { termIndex?: unknown } | undefined)?.termIndex;
			if (typeof metaTerm === 'number') return metaTerm === termFilter;
			const entryIds = violation.entities?.entryIds ?? [];
			if (entryIds.length === 0) return true;
			return entryIds.some((entryId) => termByEntryId.get(entryId) === termFilter);
		});
	}, [violationReport, termFilter, draft]);
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
			filtered = filtered.filter((v) => matchesViolationSearch(v, violationSearch));
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

	// R7/A-01: the publish gate must consume run-wide truth while the rail keeps
	// rendering the selected-term display list.
	const hardViolationCount = useMemo(
		() => resolveHardViolationCount(violationReport, violations),
		[violationReport, violations],
	);

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

	const termScopeBase = resolveTimetableTermScopeState(schoolYearContext?.activeTerm, termFilter, input.userOverrodeTermFilter);
	// D3 — while term authority is unresolved, the explicit fallback scope (one
	// numeric term, never an implicit all-term fetch) keeps the grid and the
	// run-bundle query enabled. Verified state always wins over the fallback.
	const termAuthorityUnresolved = !isTermAuthorityVerified(schoolYearContext?.activeTerm);
	const termScope: TimetableTermScopeState = termScopeBase.queryEnabled || termAuthorityUnresolved === false || fallbackTermIndex == null
		? termScopeBase
		: { authorityReady: false, queryEnabled: true, termIndex: fallbackTermIndex, status: 'active' };
	const termScopeReady = termScope.queryEnabled;
	const activeGridEntriesBase = useMemo(
		() => !termScopeReady ? [] : (isPreGenerationWorkspace ? preGenEntries : (draft?.entries ?? [])),
		[isPreGenerationWorkspace, preGenEntries, draft, termScopeReady],
	);

	// GRID-SHAPE-AUTHORITY: resolve the shape contract(s) this entity actually
	// consumes instead of the run-wide union of every shape. Section view renders
	// exactly that section's own shape; teacher/room views union only the shapes
	// of the sections the entity is actually scheduled against. The selected
	// slots are then collapsed to one row per (startTime, endTime) so a
	// day-scoped Monday Flag/HGP shares its period row instead of duplicating it.
	const gridDisplaySlots = useMemo<GridDisplaySlot[] | undefined>(() => {
		if (isPreGenerationWorkspace && draftBoard?.periodSlots?.length) return undefined;
		const contracts = draft?.summary?.timetableShapeContracts;
		const entitySlots = resolveEntityDisplaySlots({
			viewMode,
			entityFilter,
			sectionMap,
			entries: activeGridEntriesBase,
			contracts,
		});
		const source = entitySlots && entitySlots.length > 0
			? entitySlots
			: draft?.summary?.timetableDisplaySlots;
		if (!source || source.length === 0) return undefined;
		return buildGridRows(source);
	}, [
		activeGridEntriesBase,
		draft?.summary?.timetableDisplaySlots,
		draft?.summary?.timetableShapeContracts,
		draftBoard?.periodSlots,
		entityFilter,
		isPreGenerationWorkspace,
		sectionMap,
		viewMode,
	]);

	const timeSlots = useMemo(
		() => (isPreGenerationWorkspace && draftBoard?.periodSlots?.length
			? draftBoard.periodSlots
			: gridDisplaySlots ?? deriveTimeSlotsFromSummary(activeGridEntriesBase, {
				timetableShapeContracts: draft?.summary?.timetableShapeContracts,
			})),
		[
			activeGridEntriesBase,
			draft?.summary?.timetableShapeContracts,
			draftBoard?.periodSlots,
			gridDisplaySlots,
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
		// TT-OUTPUT-C03R3: the edited term scope; conflict identity is term-aware.
		let termIndex: number | undefined = typeof termFilter === 'number' ? termFilter : undefined;

		if (dragItem) {
			if (dragItem.type === 'entry') {
				sectionId = dragItem.entry.sectionId;
				facultyId = dragItem.entry.facultyId;
				roomId = dragItem.entry.roomId;
				sourceEntryId = dragItem.entry.entryId;
				termIndex = dragItem.entry.termIndex ?? termIndex;
			} else if (dragItem.type === 'draftQueue') {
				sectionId = dragItem.item.sectionId;
				facultyId = dragItem.item.facultyOptions[0];
				allFacultyOptions = dragItem.item.facultyOptions;
				termIndex = (dragItem.item as { termIndex?: number }).termIndex ?? termIndex;
			} else if (dragItem.type === 'draftPlacement') {
				sectionId = dragItem.placement.sectionId;
				facultyId = dragItem.placement.facultyId ?? undefined;
				roomId = dragItem.placement.roomId ?? undefined;
				sourceEntryId = `draft-placement-${dragItem.placement.id}`;
				termIndex = (dragItem.placement as { termIndex?: number }).termIndex ?? termIndex;
			} else if (dragItem.type === 'unassigned') {
				sectionId = dragItem.item.sectionId;
				facultyId = dragItem.item.facultyId ?? undefined;
				roomId = dragItem.item.homeRoomId ?? undefined;
				termIndex = (dragItem.item as { termIndex?: number }).termIndex ?? termIndex;
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
				termIndex = kbSelectedSource.entry.termIndex ?? termIndex;
			} else if (kbSelectedSource.type === 'unassigned') {
				sectionId = kbSelectedSource.item.sectionId;
				facultyId = kbSelectedSource.item.facultyId ?? undefined;
				roomId = kbSelectedSource.item.homeRoomId ?? undefined;
				termIndex = (kbSelectedSource.item as { termIndex?: number }).termIndex ?? termIndex;
			}
		}

		if (!sectionId) return null;
		return { sectionId, facultyId, allFacultyOptions, roomId, sourceEntryId, termIndex };
	}, [dragItem, kbSelectedSource, preGenKbSource, termFilter]);

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
				// Day-scoped events block only their own weekday; the interval stays
				// schedulable on the other instructional weekdays.
				if (slot.isSpecialEvent && (!slot.dayOfWeek || slot.dayOfWeek === day)) {
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
				return building ? `${room.name} · ${building}` : room.name;
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
			const activeTerm = typeof termFilter === 'number' ? termFilter : undefined;
			if (source.type === 'entry') {
				context = { sectionId: source.entry.sectionId, facultyId: source.entry.facultyId, roomId: source.entry.roomId, sourceEntryId: source.entry.entryId, termIndex: source.entry.termIndex ?? activeTerm };
			} else if (source.type === 'draftQueue') {
				context = { sectionId: source.item.sectionId, facultyId: source.item.facultyOptions?.[0], allFacultyOptions: source.item.facultyOptions, termIndex: (source.item as { termIndex?: number }).termIndex ?? activeTerm };
			} else if (source.type === 'draftPlacement') {
				context = { sectionId: source.placement.sectionId, facultyId: source.placement.facultyId ?? undefined, roomId: source.placement.roomId ?? undefined, sourceEntryId: `draft-placement-${source.placement.id}`, termIndex: (source.placement as { termIndex?: number }).termIndex ?? activeTerm };
			} else if (source.type === 'unassigned') {
				context = { sectionId: source.item.sectionId, facultyId: source.item.facultyId ?? undefined, roomId: source.item.homeRoomId ?? undefined, termIndex: (source.item as { termIndex?: number }).termIndex ?? activeTerm };
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
	}, [activeGridEntriesBase, facultyMap, getCellConflict, liveConflictIndex, roomMap, sectionMap, subjectMap, termFilter, timeSlots]);

	const filteredDraftEntries = useMemo(() => {
		return activeGridEntriesBase.filter((entry) => {
			const programType = entry.programType ?? sectionMap.get(entry.sectionId)?.programType ?? null;
			if (!matchesProgramFilter(programType, programFilter)) return false;
			if (!matchesEntryKindFilter(entry.entryKind, entryKindFilter)) return false;
			// Term is the authoritative schedule scope: an entry belongs to exactly
			// one numeric term; entries without a termIndex stay all-term-only.
			if (!matchesTermScope(entry, termFilter)) return false;
			return true;
		});
	}, [activeGridEntriesBase, entryKindFilter, programFilter, termFilter, sectionMap]);

	const programKindFilteredUnassignedItems = useMemo(() => {
		const unassignedTerm = typeof termFilter === 'number' ? termFilter : null;
		return (draft?.unassignedItems ?? []).filter((item) => {
			const programType = item.programType ?? sectionMap.get(item.sectionId)?.programType ?? null;
			if (!matchesProgramFilter(programType, programFilter)) return false;
			if (!matchesEntryKindFilter(item.entryKind, entryKindFilter)) return false;
			// TT-OUTPUT-C03R3: the selected term's unresolved rail contains only
			// that term's actionable items; a missing term is never Term 1.
			if (unassignedTerm !== null) {
				const itemTerm = (item as { termIndex?: number }).termIndex;
				if (itemTerm !== unassignedTerm) return false;
			}
			return true;
		});
	}, [draft, entryKindFilter, programFilter, sectionMap, termFilter]);

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
			const ids = new Set<number>(sectionIds);
			// Keep sections with unresolved sessions selectable so queue selection can
			// move the grid to the section that needs attention.
			for (const item of programKindFilteredUnassignedItems) ids.add(item.sectionId);
			if (sectionFocusId != null) ids.add(sectionFocusId);
			return Array.from(ids).sort((a, b) => a - b);
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
	}, [filteredDraftEntries, facultyMap, programKindFilteredUnassignedItems, roomMap, sectionFocusId, sectionIds, sectionMap, viewMode, centerView]);
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
			if (viewMode === 'section' && sectionFocusId != null && pivotEntityIds.includes(sectionFocusId)) {
				if (entityFilter !== String(sectionFocusId)) setEntityFilter(String(sectionFocusId));
				return;
			}
			const currentValid = entityFilter && entityFilter !== 'all' && pivotEntityIds.includes(Number(entityFilter));
			if (!currentValid) setEntityFilter(String(pivotEntityIds[0]));
		}
	}, [entityFilter, pivotEntityIds, sectionFocusId, setEntityFilter, viewMode]);

	const fetchSchoolYear = useCallback(async () => {
		// ACTOR-SCOPE-C01: canonical actor-school resolution (token-epoch bound,
		// fail-closed, late-response discard) — never a direct `/auth/me` read.
		const actorSchoolId = await resolveActorSchoolId();
		if (!actorSchoolId) {
			resolvedSchoolIdRef.current = null;
			setSchoolId(null);
			setSchoolYearContext(null);
			setSchoolYearId(null);
			setError('Timetable is unavailable because your school scope could not be verified. Sign in again, then retry.');
			return null;
		}
		resolvedSchoolIdRef.current = actorSchoolId;
		// TIMETABLE-TERM-GATE-C01 (D1) — fast cached read first, then exactly one
		// verified call when authority is still unresolved. Late responses are
		// discarded by actor school inside the resolver.
		const resolution = await resolveTimetableTermAuthority(
			actorSchoolId,
			() => resolvedSchoolIdRef.current !== actorSchoolId,
		);
		// Discard a late response whose actor school changed while it was in flight.
		if (!resolution || resolvedSchoolIdRef.current !== actorSchoolId) return null;
		const context = resolution.context;
		setSchoolId(actorSchoolId);
		setSchoolYearContext({ ...context, schoolId: actorSchoolId });
		latestContextRef.current = { ...context, schoolId: actorSchoolId };
		termAuthorityReadyRef.current = resolution.authorityReady;
		if (context.activeSchoolYearId) setSchoolYearId(context.activeSchoolYearId);
		if (!resolution.authorityReady && (context.source === 'cache' || context.stale)) {
			void resolveActiveSchoolYearContext({
				schoolId: actorSchoolId,
				forceRefresh: true,
				allowStaleOnError: true,
				allowEnrollProFallback: false,
			}).then((freshContext) => {
				// A fresh response for an obsolete actor school must never bind.
				if (resolvedSchoolIdRef.current !== actorSchoolId) return;
				setSchoolYearContext({ ...freshContext, schoolId: actorSchoolId });
				latestContextRef.current = { ...freshContext, schoolId: actorSchoolId };
				termAuthorityReadyRef.current = isTermAuthorityVerified(freshContext.activeTerm);
				if (freshContext.activeSchoolYearId) setSchoolYearId(freshContext.activeSchoolYearId);
			}).catch(() => {
				// Keep the visible cached/stale source state. The header will state that
				// ATLAS is working from saved data instead of hiding the uncertainty.
			});
		}
		return context.activeSchoolYearId ?? null;
	}, [setError, setSchoolYearId]);

	const buildFetchScope = useCallback((syId: number, runId: string | number | null): TimetableScope => ({
		schoolId,
		schoolYearId: syId,
		runId,
		// D3 — while the fallback is in effect the imperative reads fetch the
		// same explicit term the grid renders, never the still-'all' filter.
		termIndex: fallbackTermRef.current ?? termFilter,
	}), [schoolId, termFilter]);

	const fetchRuns = useCallback(async (syId: number, options?: FetchOptions) => {
		if (!schoolId) throw new Error('Authenticated school scope is unavailable.');
		const { forceRefresh = false } = options ?? {};
		// UX-P01 R2: the runs list lives in the scoped query cache. `forceRefresh`
		// invalidates the entry before refetching; a fresh entry is a cache hit.
		const runs = await ensureTimetableRuns(buildFetchScope(syId, selectedRunIdRef.current), { force: forceRefresh });
		setRuns(runs);
		return runs;
	}, [buildFetchScope, schoolId, setRuns]);

	const fetchCurriculumReadiness = useCallback(async (syId: number) => {
		if (!schoolId || resolvedSchoolIdRef.current !== schoolId) {
			setCurriculumReadiness({ state: 'unavailable', message: 'Your school scope could not be verified. Sign in again, then retry.' });
			return;
		}
		// UX-C01R — only the canonical generation diagnostic may gate generation.
		// The narrower derived-demand readiness route proves demand derivation; it
		// does not include Teaching Load ownership, canonical shape, policy/
		// template/window, retained-placement, or hard-validator blockers.
		const requestSeq = generationReadinessSeqRef.current + 1;
		generationReadinessSeqRef.current = requestSeq;
		setCurriculumReadiness({ state: 'loading', message: 'Checking generation readiness (Teaching Load, shape, policy, validators)…' });
		try {
			// Readiness gates generation, so it is always re-verified rather than
			// served from the cache window the rest of the route uses.
			const readiness = await ensureTimetableReadiness(buildFetchScope(syId, selectedRunIdRef.current), { force: true });
			if (requestSeq !== generationReadinessSeqRef.current) return;
			// A diagnostic for a different school/year, a failed read, or a
			// derived-ready-but-blocked diagnostic never reuses a prior ready.
			setCurriculumReadiness(deriveGenerationReadinessState(readiness, { schoolId, schoolYearId: syId }));
		} catch (error) {
			if (requestSeq !== generationReadinessSeqRef.current) return;
			setCurriculumReadiness({
				state: 'failed',
				message: buildTimetableErrorMessage(error, 'Generation readiness could not be checked. Retry before generating.'),
			});
		}
	}, [buildFetchScope, schoolId]);

	const applyRunSnapshot = useCallback((draftSnapshot: DraftReport, violationsSnapshot: ViolationReport) => {
		setDraft((prev) => sameDraftSnapshot(prev, draftSnapshot) ? prev : draftSnapshot);
		setViolationReport((prev) => JSON.stringify(prev) === JSON.stringify(violationsSnapshot) ? prev : violationsSnapshot);
	}, [setDraft, setViolationReport]);

	const applyFollowUpEntryIds = useCallback((followUpEntryIds: string[]) => {
		setFollowUps((prev) => {
			if (prev.size !== followUpEntryIds.length) return new Set(followUpEntryIds);
			for (const item of followUpEntryIds) if (!prev.has(item)) return new Set(followUpEntryIds);
			return prev;
		});
	}, [setFollowUps]);

	const fetchRunData = useCallback(async (syId: number, runId: string, options?: FetchOptions) => {
		if (!schoolId) throw new Error('Authenticated school scope is unavailable.');
		const { forceRefresh = false } = options ?? {};
		const scope = buildFetchScope(syId, runId);
		const requestSeq = latestRunDataFetchSeqRef.current + 1;
		latestRunDataFetchSeqRef.current = requestSeq;
		try {
			// R1/R2: the draft+violations pair is one run-scoped query entry. Both
			// endpoints still fire together inside the query function.
			const bundle = await ensureTimetableRunBundle(scope, { force: forceRefresh });
			if (requestSeq !== latestRunDataFetchSeqRef.current) return;
			applyRunSnapshot(bundle.draft, bundle.violations);
			recordTimetableWarmScope(scope);
			void (async () => {
				let followUpEntryIds: string[] = [];
				try {
					followUpEntryIds = await ensureTimetableFollowUps(scope, bundle.draft.runId);
				} catch {
					followUpEntryIds = [];
				}
				if (requestSeq !== latestRunDataFetchSeqRef.current) return;
				applyFollowUpEntryIds(followUpEntryIds);
			})();
		} catch (error) {
			// Preserve structured API errors (NO_RUNS, NO_ACTIVE_DRAFT, STALE_RUN_DATA)
			// so loadAll's catch block can inspect the code and keep the workspace open.
			const code = getTimetableApiErrorCode(error);
			if (code === 'NO_RUNS' || code === 'NO_ACTIVE_DRAFT' || code === 'STALE_RUN_DATA') {
				throw error;
			}
			throw new Error(buildTimetableErrorMessage(error, 'Failed to load timetable run data.'));
		}
	}, [applyFollowUpEntryIds, applyRunSnapshot, buildFetchScope, schoolId]);

	const fetchDraftBoardSummary = useCallback(async (syId: number, options?: FetchOptions) => {
		if (!schoolId) return null;
		const { forceRefresh = false } = options ?? {};
		try {
			const board = await ensureTimetableDraftBoard(buildFetchScope(syId, selectedRunIdRef.current), { force: forceRefresh });
			applyDraftBoard(board);
			return board.counts;
		} catch {
			// Do NOT wipe the context state on intermittent 502/network errors.
			// Wiping the state causes massive re-renders that destroy active drag operations.
			return null;
		}
	}, [applyDraftBoard, buildFetchScope, schoolId]);

	const loadRoomRequestSummary = useCallback(async (
		syId: number,
		statusFilter: 'ALL' | RoomPreferenceStatus,
		decisionFilter: 'ALL' | RoomPreferenceDecisionStatus,
		options?: FetchOptions,
	) => {
		if (!schoolId) {
			setRoomRequestError('Authenticated school scope is unavailable.');
			return;
		}
		const { forceRefresh = false } = options ?? {};
		setRoomRequestLoading(true);
		try {
			const summary = await ensureTimetableRoomRequestSummary(
				buildFetchScope(syId, selectedRunIdRef.current),
				statusFilter,
				decisionFilter,
				{ force: forceRefresh },
			);
			applyRoomRequestSummary(summary);
		} catch (err) {
			// No active generated draft means there are no room requests yet; this
			// is an empty state, not an error. Avoid surfacing a 404 as noise.
			if (getTimetableApiErrorCode(err) === 'NO_ACTIVE_DRAFT') {
				setRoomRequestError(null);
			} else {
				setRoomRequestError(buildTimetableErrorMessage(err, 'Failed to load room requests.'));
			}
		} finally {
			setRoomRequestLoading(false);
		}
	}, [applyRoomRequestSummary, buildFetchScope, schoolId, setRoomRequestError, setRoomRequestLoading]);

	const hydrateReferenceState = useCallback((entry: TimetableReferenceData) => {
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
	}, [setBuildings, setFacultyMap, setRoomMap, setSectionMap, setSectionSummary, setSubjectMap]);

	const fetchReferenceData = useCallback(async (syId: number, options?: FetchOptions) => {
		if (!schoolId) throw new Error('Authenticated school scope is unavailable.');
		const { forceRefresh = false } = options ?? {};
		const entry = await ensureTimetableReferenceData(buildFetchScope(syId, selectedRunIdRef.current), { force: forceRefresh });
		hydrateReferenceState(entry);
	}, [buildFetchScope, hydrateReferenceState, schoolId]);

	// UX-P01 R2/R4: the reactive, four-part-scoped subscription to the current
	// run bundle. It shares the cache entry the imperative fetch writes, keeps
	// the previous bundle available while a new scope loads
	// (`placeholderData: keepPreviousData`), and never serves another scope's
	// entry because the key changes with every scope part.
	const currentScope = useMemo<TimetableScope>(() => ({
		schoolId,
		schoolYearId,
		runId: selectedRunId,
		// D3 — the reactive bundle query follows the same explicit scope the
		// imperative load fetches while the fallback is in effect.
		termIndex: termScope.queryEnabled && termScope.termIndex != null ? termScope.termIndex : termFilter,
	}), [schoolId, schoolYearId, selectedRunId, termFilter, termScope]);

	const runBundleQuery = useQuery({
		queryKey: timetableRunBundleQueryKey(currentScope),
		queryFn: () => ensureTimetableRunBundle(currentScope),
		enabled: isResolvedTimetableScope(currentScope) && termScopeReady,
		staleTime: TIMETABLE_STALE_MS,
		gcTime: TIMETABLE_GC_MS,
		placeholderData: keepPreviousData,
	}, timetableQueryClient);

	// Placeholder data belongs to a different scope key and must never become
	// actionable grid state. A real cached/refetched entry for the current key is
	// applied here so a revisit renders from cache immediately.
	useEffect(() => {
		if (runBundleQuery.isPlaceholderData) return;
		const bundle = runBundleQuery.data;
		if (!bundle) return;
		applyRunSnapshot(bundle.draft, bundle.violations);
	}, [applyRunSnapshot, runBundleQuery.data, runBundleQuery.isPlaceholderData]);

	// UX-P01 R4: seed the per-mount state from the warm query snapshot before the
	// first paint so a revisit shows the previous data instead of a full
	// skeleton. The snapshot is token-epoch bound; the effect below clears it if
	// the resolved actor school turns out not to match the seeded scope.
	const warmSeededScopeRef = useRef<ResolvedTimetableScope | null>(null);
	useLayoutEffect(() => {
		const snapshot = readTimetableWarmSnapshot();
		if (!snapshot || warmSeededScopeRef.current) return;
		warmSeededScopeRef.current = snapshot.scope;
		setRuns(snapshot.runs);
		if (snapshot.bundle) applyRunSnapshot(snapshot.bundle.draft, snapshot.bundle.violations);
		if (snapshot.reference) hydrateReferenceState(snapshot.reference);
		if (snapshot.draftBoard) applyDraftBoard(snapshot.draftBoard);
		setLoading(false);
	}, [applyDraftBoard, applyRunSnapshot, hydrateReferenceState, setLoading, setRuns]);

	useEffect(() => {
		const seeded = warmSeededScopeRef.current;
		if (!seeded || schoolId == null || seeded.schoolId === schoolId) return;
		// Actor school changed without a matching token epoch transition; the warm
		// snapshot is another scope's data and must not survive.
		warmSeededScopeRef.current = null;
		setRuns([]);
		setDraft(null);
		setViolationReport(null);
		setFollowUps(new Set());
	}, [schoolId, setDraft, setFollowUps, setRuns, setViolationReport]);

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
		const loadSequence = loadSequenceRef.current + 1;
		loadSequenceRef.current = loadSequence;
		const isCurrentLoad = () => loadSequenceRef.current === loadSequence;
		const preserveRun = typeof options === 'boolean' ? options : options?.preserveRun ?? false;
		const force = typeof options === 'object' ? options?.force ?? false : false;

		setLoading(true);
		setError(null);
		try {
			const syId = await fetchSchoolYear();
			if (!isCurrentLoad()) return;
			if (!syId) {
				setError('No active school year found.');
				setLoading(false);
				return;
			}
		// Do not fetch runs, references, or a bundle with an implicit all-term
			// scope while EnrollPro term authority is unresolved. The first enabled
			// timetable request after authority resolves is the verified active term;
			// an explicit All terms choice is only allowed after that point.
			// TIMETABLE-TERM-GATE-C01 — the gate is satisfiable now (D1 verifies),
			// and it never dead-ends: unresolved authority falls back to one
			// explicit term scope (D3) instead of blocking the whole page.
			const gate = resolveTimetableLoadGate({
				authorityReady: termAuthorityReadyRef.current,
				termFilter,
				userOverrodeTermFilter: input.userOverrodeTermFilter,
				fallbackTermIndex: resolveTimetableFallbackTermIndex(latestContextRef.current?.activeTerm),
			});
			if (gate.kind === 'blocked-setup') {
				setRuns([]);
				setDraft(null);
				setViolationReport(null);
				setError('Term setup is required before the timetable can be loaded.');
				setLoading(false);
				// D2 — remember the block so the verified-landing effect re-runs.
				gateBlockedRef.current = true;
				return;
			}
			if (gate.fallback) {
				const explicitTerm = gate.termIndex as number;
				fallbackTermRef.current = explicitTerm;
				setFallbackTermIndex(explicitTerm);
				setTermAuthorityNotice(buildTermAuthorityUnverifiedNotice(explicitTerm));
			} else {
				gateBlockedRef.current = false;
				fallbackTermRef.current = null;
				setFallbackTermIndex(null);
				setTermAuthorityNotice(null);
			}
			await runTimetableLoad({
				readResolvedSchoolId: () => resolvedSchoolIdRef.current,
				currentSchoolId: schoolId,
				fetchRuns: (id) => fetchRuns(id, { preferCache: !force, forceRefresh: force }),
				fetchCurriculumReadiness: (id) => { void fetchCurriculumReadiness(id); },
				fetchReferenceData: (id) => fetchReferenceData(id, { preferCache: !force, forceRefresh: force, backgroundRefresh: !force }),
				fetchDraftBoardSummary: (id) => fetchDraftBoardSummary(id, { preferCache: !force, forceRefresh: force }),
				fetchRunData: (id, runId) => fetchRunData(id, runId, { preferCache: !force, forceRefresh: force }),
				loadRoomRequestSummary: (id) => loadRoomRequestSummary(id, requestStatusFilter, requestDecisionFilter, { preferCache: !force, forceRefresh: force }),
				errorCodeOf: getTimetableApiErrorCode,
				clearRoomRequestError: () => setRoomRequestError(null),
				readSelectedRunId: () => selectedRunIdRef.current,
				preserveRun,
				onScopeMismatch: () => {
					setRuns([]);
					setDraft(null);
					setViolationReport(null);
					setSelectedRunId('latest');
				},
				onNoRuns: () => {
					setDraft(null);
					setViolationReport(null);
					setSelectedRunId('latest');
					// No runs at all means no room-request summary to read.
					setRoomRequestError(null);
				},
				onRunSelected: (runId) => setSelectedRunId(runId),
			}, syId);
			if (!isCurrentLoad()) return;
		} catch (e: unknown) {
			if (!isCurrentLoad()) return;
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
			if (isCurrentLoad()) setLoading(false);
		}
	}, [
		schoolYearId,
		schoolId,
		fetchSchoolYear,
		fetchRuns,
		fetchCurriculumReadiness,
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
		termFilter,
		input.userOverrodeTermFilter,
	]);

	useEffect(() => {
		void loadAll();
	}, [loadAll]);

	// D2 — a blocked page must self-heal. When verified term authority lands
	// after the gate blocked (or while the D3 fallback is showing), drop the
	// fallback and re-run the load so the authoritative scope takes over. The
	// re-run is skipped until an explicit scope exists; the workspace selects
	// the active term on its own and its change re-runs the load.
	useEffect(() => {
		if (!isTermAuthorityVerified(schoolYearContext?.activeTerm)) return;
		if (!gateBlockedRef.current && fallbackTermIndex == null && fallbackTermRef.current == null) return;
		gateBlockedRef.current = false;
		fallbackTermRef.current = null;
		setFallbackTermIndex(null);
		setTermAuthorityNotice(null);
		if (typeof termFilter === 'number' || input.userOverrodeTermFilter) {
			void loadAll({ preserveRun: true });
		}
	}, [schoolYearContext, fallbackTermIndex, loadAll, termFilter, input.userOverrodeTermFilter]);

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

	// QF-CELL-INFO: reference labels degrade to a stable id fallback instead of a
	// permanent "Loading …" placeholder. `fetchReferenceData` is allowed to fail
	// without blocking the grid, so an empty/partial map must never leave a cell
	// stuck on a loading string.
	const subjectLabel = useMemo(() => buildSubjectLabel(subjectMap), [subjectMap]);

	const facultyLabel = useMemo(() => buildFacultyLabel(facultyMap), [facultyMap]);

	const formatFacultyInitials = useMemo(() => buildFacultyInitials(facultyMap), [facultyMap]);

	const sectionLabel = useMemo(
		() => buildSectionLabel(sectionMap, getProgramBadgeLabel),
		[sectionMap],
	);

	const roomLabel = useMemo(() => buildRoomLabel(roomMap), [roomMap]);

	const roomLabelShort = useMemo(() => buildRoomLabelShort(roomMap), [roomMap]);

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
		schoolId,
		curriculumReadiness,
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
		termAuthorityNotice,
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
