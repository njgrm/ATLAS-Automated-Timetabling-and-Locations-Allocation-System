import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import {
	AlertCircle,
	AlertTriangle,
	CalendarClock,
	Check,
	ChevronDown,
	ChevronRight,
	Clock,
	DoorOpen,
	Filter,
	Flag,
	GraduationCap,
	GripVertical,
	History,
	Lightbulb,
	Loader2,
	Lock,
	PanelLeftClose,
	PanelLeftOpen,
	PanelRightClose,
	PanelRightOpen,
	Play,
	RefreshCw,
	Search,
	Send,
	Settings2,
	ShieldAlert,
	Undo2,
	Users,
	Wand2,
	X,
	Crosshair,
	Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import { formatTime } from '@/lib/utils';
import type {
	Building,
	CommitResult,
	DraftReport,
	ExternalSection,
	FixSuggestion,
	FixSuggestionsResponse,
	GenerationRun,
	ManualEditProposal,
	ManualEditRecord,
	PreviewResult,
	Room,
	RunSummary,
	ScheduledEntry,
	SectionSummaryResponse,
	Subject,
	FacultyMirror,
	UnassignedExplanation,
	UnassignedItem,
	UnassignedReason,
	Violation,
	ViolationCode,
	ViolationReport,
	ViolationSeverity,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { SearchableSelect } from '@/ui/searchable-select';
import { Skeleton } from '@/ui/skeleton';
import { Separator } from '@/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/ui/resizable';

import SchedulingPolicyPane from '@/components/SchedulingPolicyPane';
import ManualEditPanel from '@/components/ManualEditPanel';
import LockPanel from '@/components/LockPanel';
import { TutorialOverlay, useTutorial } from '@/components/TutorialOverlay';
import { ExplainabilityDrawer, VIOLATION_EXPLANATIONS } from '@/components/ExplainabilityDrawer';

/* ─── Constants ─── */

const DEFAULT_SCHOOL_ID = 1;

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

const CONFLICT_CODES: Set<ViolationCode> = new Set([
	'FACULTY_TIME_CONFLICT',
	'ROOM_TIME_CONFLICT',
]);

const WELLBEING_CODES: Set<ViolationCode> = new Set([
	'FACULTY_EXCESSIVE_TRAVEL_DISTANCE',
	'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS',
	'FACULTY_INSUFFICIENT_TRANSITION_BUFFER',
	'FACULTY_EXCESSIVE_IDLE_GAP',
	'FACULTY_EARLY_START_PREFERENCE',
	'FACULTY_LATE_END_PREFERENCE',
]);

const GRADE_BADGE: Record<number, string> = {
	7: 'bg-green-100 text-green-700 border-green-300',
	8: 'bg-yellow-100 text-yellow-700 border-yellow-300',
	9: 'bg-red-100 text-red-700 border-red-300',
	10: 'bg-blue-100 text-blue-700 border-blue-300',
};

type SeverityFilter = 'all' | 'hard' | 'soft' | 'conflicts' | 'wellbeing';
type ViewMode = 'section' | 'faculty' | 'room';

/** Enriched room info for display (includes parent building context) */
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

/* ─── Tutorial step definitions ─── */

const TUTORIAL_STEPS = [
	{
		target: '[data-tutorial="run-selector"]',
		title: 'Run Selector',
		content: 'Pick which generation run to review. "Latest Run" is selected by default. Each run is a separate scheduling attempt.',
	},
	{
		target: '[data-tutorial="left-tabs"]',
		title: 'Violations & Unassigned',
		content: 'Two panels here: Violations shows constraint issues, Unassigned shows sessions that couldn\'t be placed. Both need attention before you can publish.',
	},
	{
		target: '[data-tutorial="grid-controls"]',
		title: 'Grid Controls & Filters',
		content: 'Switch between Section, Faculty, or Room views. Use severity filters to focus on what matters most.',
	},
	{
		target: '[data-tutorial="center-grid"]',
		title: 'Timetable Grid',
		content: 'Click any entry in the grid to see its details. Drag entries or unassigned items to different slots. The system will preview the impact before applying.',
	},
	{
		target: '[data-tutorial="manual-edit-actions"]',
		title: 'Manual Edit Actions',
		content: 'Select an entry, then use these buttons to move its timeslot, change room, or reassign faculty. Every edit shows a preview first.',
		roles: ['admin', 'officer', 'SYSTEM_ADMIN'],
	},
	{
		target: '[data-tutorial="policy-btn"]',
		title: 'Scheduling Policy',
		content: 'Open the policy pane to adjust constraint weights, teaching limits, break requirements, and more. Changes affect the next generation run.',
		roles: ['admin', 'officer', 'SYSTEM_ADMIN'],
	},
	{
		target: '[data-tutorial="undo-btn"]',
		title: 'History & Undo',
		content: 'Every manual edit is tracked. Use Undo to revert the last change, or view the full edit history.',
		roles: ['admin', 'officer', 'SYSTEM_ADMIN'],
	},
];

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
	section: 'Section',
	faculty: 'Faculty',
	room: 'Room',
};

/* ─── Helpers ─── */

function formatDuration(ms: number | null): string {
	if (ms == null) return '—';
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(iso: string | null): string {
	if (!iso) return '—';
	return new Date(iso).toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function statusColor(status: string): string {
	switch (status) {
		case 'COMPLETED':
			return 'bg-green-100 text-green-700 border-green-300';
		case 'FAILED':
			return 'bg-red-100 text-red-700 border-red-300';
		case 'RUNNING':
			return 'bg-blue-100 text-blue-700 border-blue-300';
		default:
			return 'bg-gray-100 text-gray-600 border-gray-300';
	}
}

/** Derive unique sorted time slots from entries */
function deriveTimeSlots(entries: ScheduledEntry[]): Array<{ startTime: string; endTime: string }> {
	const seen = new Map<string, string>();
	for (const e of entries) {
		seen.set(e.startTime, e.endTime);
	}
	return Array.from(seen.entries())
		.map(([startTime, endTime]) => ({ startTime, endTime }))
		.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Build violation lookup: entryId → violations affecting that entry */
function buildViolationIndex(violations: Violation[]): Map<string, Violation[]> {
	const index = new Map<string, Violation[]>();
	for (const v of violations) {
		for (const eid of v.entities.entryIds ?? []) {
			const list = index.get(eid) ?? [];
			list.push(v);
			index.set(eid, list);
		}
	}
	return index;
}

/** Determine worst severity for an entry */
function entrySeverity(entryId: string, violationIndex: Map<string, Violation[]>): ViolationSeverity | null {
	const vList = violationIndex.get(entryId);
	if (!vList?.length) return null;
	return vList.some((v) => v.severity === 'HARD') ? 'HARD' : 'SOFT';
}

/* ─── Main Component ─── */

export default function ScheduleReview() {
	/* ── Data state ── */
	const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
	const [runs, setRuns] = useState<GenerationRun[]>([]);
	const [selectedRunId, setSelectedRunId] = useState<string>('latest');
	const [draft, setDraft] = useState<DraftReport | null>(null);
	const [violationReport, setViolationReport] = useState<ViolationReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	/* ── Reference data lookups ── */
	const [subjectMap, setSubjectMap] = useState<Map<number, Subject>>(new Map());
	const [facultyMap, setFacultyMap] = useState<Map<number, FacultyMirror>>(new Map());
	const [sectionMap, setSectionMap] = useState<Map<number, ExternalSection>>(new Map());

	/* ── Filter / selection state ── */
	const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
	const [violationSearch, setViolationSearch] = useState('');
	const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
	const [selectedEntry, setSelectedEntry] = useState<ScheduledEntry | null>(null);
	const [followUps, setFollowUps] = useState<Set<string>>(new Set());
	const [entityFilter, setEntityFilter] = useState<string>('');
	const [viewMode, setViewMode] = useState<ViewMode>('section');
	const [leftTab, setLeftTab] = useState<'violations' | 'unassigned' | 'locks'>('violations');

	/* ── Generate / Publish workflow state ── */
	const [generating, setGenerating] = useState(false);
	const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
	const [showPublishDialog, setShowPublishDialog] = useState(false);
	const [publishAcknowledged, setPublishAcknowledged] = useState(false);
	const [generationElapsed, setGenerationElapsed] = useState(0);

	// Elapsed-time counter while generating
	useEffect(() => {
		if (!generating) { setGenerationElapsed(0); return; }
		const t0 = Date.now();
		const iv = setInterval(() => setGenerationElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
		return () => clearInterval(iv);
	}, [generating]);

	/* ── Room reference data ── */
	const [roomMap, setRoomMap] = useState<Map<number, RoomInfo>>(new Map());

	/* ── Layout state ── */
	const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
	const [isRightCollapsed, setIsRightCollapsed] = useState(false);
	const [centerView, setCenterView] = useState<'grid' | 'policy' | 'manual-edit'>('grid');
	// Panel refs for imperative collapse/expand
	const leftPanelRef = useRef<ImperativePanelHandle>(null);
	const rightPanelRef = useRef<ImperativePanelHandle>(null);
	// Snapshot of panel state before entering a swap view so we can restore on exit
	const panelSnapshot = useRef<{ left: boolean; right: boolean } | null>(null);
	// Which action the officer triggered from the right panel
	const [pendingAction, setPendingAction] = useState<'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY' | null>(null);

	/* ── Manual edit / DnD state ── */
	const [dragItem, setDragItem] = useState<{ type: 'entry'; entry: ScheduledEntry } | { type: 'unassigned'; item: UnassignedItem } | null>(null);
	const [blockerModalData, setBlockerModalData] = useState<import('@/types').HumanConflict[] | null>(null);
	const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [showSoftConfirm, setShowSoftConfirm] = useState(false);
	const [pendingCommitProposal, setPendingCommitProposal] = useState<ManualEditProposal | null>(null);
	const [editHistory, setEditHistory] = useState<ManualEditRecord[]>([]);
	const [showEditHistory, setShowEditHistory] = useState(false);
	const [commitLoading, setCommitLoading] = useState(false);
	const [revertLoading, setRevertLoading] = useState(false);
	/** Keyboard-accessible DnD: selected source for placement */
	const [kbSelectedSource, setKbSelectedSource] = useState<{ type: 'entry'; entry: ScheduledEntry } | { type: 'unassigned'; item: UnassignedItem } | null>(null);

	/** Assignment picker modal for unassigned placements */
	const [showAssignmentPicker, setShowAssignmentPicker] = useState(false);
	const [assignPickerTarget, setAssignPickerTarget] = useState<{ day: string; startTime: string; endTime: string; item: UnassignedItem } | null>(null);
	const [assignPickerFacultyId, setAssignPickerFacultyId] = useState<string>('');
	const [assignPickerRoomId, setAssignPickerRoomId] = useState<string>('');

	/* ── Tutorial + Explainability ── */
	const tutorial = useTutorial('atlas_timetable_tour');
	const [drawerViolation, setDrawerViolation] = useState<Violation | null>(null);
	const [drawerUnassigned, setDrawerUnassigned] = useState<UnassignedItem | null>(null);
	const showExplainDrawer = !!drawerViolation || !!drawerUnassigned;
	const [fixLoading, setFixLoading] = useState<string | null>(null);

	/* ── Unassigned triage state ── */
	const [expandedUnassigned, setExpandedUnassigned] = useState<Set<string>>(new Set());
	const [unassignedFixSuggestions, setUnassignedFixSuggestions] = useState<Record<string, UnassignedExplanation | null>>({});
	const [unassignedReasonFilter, setUnassignedReasonFilter] = useState<UnassignedReason | 'all'>('all');

	const enterPolicyView = useCallback(() => {
		panelSnapshot.current = { left: isLeftCollapsed, right: isRightCollapsed };
		leftPanelRef.current?.collapse();
		rightPanelRef.current?.collapse();
		setCenterView('policy');
	}, [isLeftCollapsed, isRightCollapsed]);

	const exitPolicyView = useCallback(() => {
		if (panelSnapshot.current) {
			if (!panelSnapshot.current.left) leftPanelRef.current?.expand();
			if (!panelSnapshot.current.right) rightPanelRef.current?.expand();
			panelSnapshot.current = null;
		}
		setCenterView('grid');
	}, []);

	const enterManualEditView = useCallback((action: 'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY') => {
		panelSnapshot.current = { left: isLeftCollapsed, right: isRightCollapsed };
		leftPanelRef.current?.collapse();
		rightPanelRef.current?.collapse();
		setPendingAction(action);
		setCenterView('manual-edit');
	}, [isLeftCollapsed, isRightCollapsed]);

	const exitManualEditView = useCallback(() => {
		if (panelSnapshot.current) {
			if (!panelSnapshot.current.left) leftPanelRef.current?.expand();
			if (!panelSnapshot.current.right) rightPanelRef.current?.expand();
			panelSnapshot.current = null;
		}
		setPendingAction(null);
		setCenterView('grid');
	}, []);

	/* ── Derived state ── */
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
		else if (severityFilter === 'conflicts')
			filtered = filtered.filter((v) => CONFLICT_CODES.has(v.code));
		else if (severityFilter === 'wellbeing')
			filtered = filtered.filter((v) => WELLBEING_CODES.has(v.code));

		if (violationSearch.trim()) {
			const q = violationSearch.toLowerCase();
			filtered = filtered.filter(
				(v) =>
					v.message.toLowerCase().includes(q) ||
					v.code.toLowerCase().includes(q) ||
					VIOLATION_LABELS[v.code].toLowerCase().includes(q),
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

	/** Top blocker violations — first 3 hard violations, deduped by code */
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

	/** Auto-switch to violations tab and expand panel when hard violations appear */
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
	}, [hardViolationCount, isLeftCollapsed]);

	const timeSlots = useMemo(() => deriveTimeSlots(draft?.entries ?? []), [draft]);

	const sectionIds = useMemo(() => {
		const ids = new Set<number>();
		for (const e of draft?.entries ?? []) ids.add(e.sectionId);
		return Array.from(ids).sort((a, b) => a - b);
	}, [draft]);

	/** Row-axis entities based on view mode */
	const pivotEntityIds = useMemo(() => {
		const entries = draft?.entries ?? [];
		if (viewMode === 'section') return sectionIds;
		if (viewMode === 'faculty') {
			const ids = new Set<number>();
			for (const e of entries) if (e.facultyId) ids.add(e.facultyId);
			return Array.from(ids).sort((a, b) => a - b);
		}
		// room — sort by building label then room name for readability
		const ids = new Set<number>();
		for (const e of entries) if (e.roomId) ids.add(e.roomId);
		return Array.from(ids).sort((a, b) => {
			const ra = roomMap.get(a);
			const rb = roomMap.get(b);
			if (!ra || !rb) return a - b;
			const bldgA = (ra.buildingShortCode || ra.buildingName).toLowerCase();
			const bldgB = (rb.buildingShortCode || rb.buildingName).toLowerCase();
			if (bldgA !== bldgB) return bldgA.localeCompare(bldgB);
			return ra.name.localeCompare(rb.name);
		});
	}, [draft, viewMode, sectionIds, roomMap]);

	const gridEntries = useMemo(() => {
		if (!draft?.entries) return [];
		const entries = draft.entries;
		const id = Number(entityFilter);
		if (!id) return [];
		if (viewMode === 'section') return entries.filter((e) => e.sectionId === id);
		if (viewMode === 'faculty') return entries.filter((e) => e.facultyId === id);
		return entries.filter((e) => e.roomId === id);
	}, [draft, entityFilter, viewMode]);

	/** Simplified room lookup for LockPanel */
	const lockPanelRooms = useMemo(() => {
		const m = new Map<number, { id: number; name: string; buildingName: string }>();
		for (const [id, r] of roomMap) {
			m.set(id, { id, name: r.name, buildingName: r.buildingName });
		}
		return m;
	}, [roomMap]);

	/** Grid lookup: `${day}-${startTime}` → entries in that cell, grouped by pivot entity */
	const gridIndex = useMemo(() => {
		const index = new Map<string, ScheduledEntry[]>();
		for (const e of gridEntries) {
			const key = `${e.day}-${e.startTime}`;
			const list = index.get(key) ?? [];
			list.push(e);
			index.set(key, list);
		}
		return index;
	}, [gridEntries]);

	/** For a given entry, get the pivot entity ID it belongs to */
	const pivotKeyOf = useCallback(
		(e: ScheduledEntry): number | null => {
			if (viewMode === 'section') return e.sectionId;
			if (viewMode === 'faculty') return e.facultyId;
			return e.roomId;
		},
		[viewMode],
	);

	const summary: RunSummary | null = draft?.summary ?? null;

	/** Auto-select first pivot entity when entities change */
	useEffect(() => {
		if (pivotEntityIds.length > 0) {
			const currentValid = entityFilter && entityFilter !== 'all' && pivotEntityIds.includes(Number(entityFilter));
			if (!currentValid) {
				setEntityFilter(String(pivotEntityIds[0]));
			}
		}
	}, [pivotEntityIds, entityFilter]);

	/* ── Data fetching ── */

	const fetchSchoolYear = useCallback(async () => {
		const settings = await fetchPublicSettings();
		if (settings.activeSchoolYearId) {
			setSchoolYearId(settings.activeSchoolYearId);
		}
		return settings.activeSchoolYearId ?? null;
	}, []);

	const fetchRuns = useCallback(
		async (syId: number) => {
			const { data } = await atlasApi.get<{ runs: GenerationRun[] }>(
				`/generation/${DEFAULT_SCHOOL_ID}/${syId}/runs`,
				{ params: { limit: 20 } },
			);
			setRuns(data.runs);
			return data.runs;
		},
		[],
	);

	const fetchRunData = useCallback(
		async (syId: number, runId: string) => {
			const base = `/generation/${DEFAULT_SCHOOL_ID}/${syId}/runs`;
			const runPath = runId === 'latest' ? `${base}/latest` : `${base}/${runId}`;

			const [draftRes, violationsRes] = await Promise.all([
				atlasApi.get<DraftReport>(`${runPath}/draft`),
				atlasApi.get<ViolationReport>(`${runPath}/violations`),
			]);

			setDraft(draftRes.data);
			setViolationReport(violationsRes.data);

			// Load persisted follow-up flags for this run
			const numericRunId = draftRes.data.runId;
			try {
				const { data } = await atlasApi.get<{ flags: Array<{ entryId: string }> }>(
					`/follow-up-flags/${DEFAULT_SCHOOL_ID}/${syId}/runs/${numericRunId}/flags`,
				);
				setFollowUps(new Set(data.flags.map((f) => f.entryId)));
			} catch {
				setFollowUps(new Set());
			}
		},
		[],
	);

	const fetchReferenceData = useCallback(async (syId: number) => {
		const [subjectsRes, facultyRes, buildingsRes, sectionsRes] = await Promise.all([
			atlasApi.get<{ subjects: Subject[] }>(`/subjects?schoolId=${DEFAULT_SCHOOL_ID}`),
			atlasApi.get<{ faculty: FacultyMirror[] }>(`/faculty?schoolId=${DEFAULT_SCHOOL_ID}`),
			atlasApi.get<{ buildings: Building[] }>(`/map/schools/${DEFAULT_SCHOOL_ID}/buildings`),
			atlasApi.get<SectionSummaryResponse>(`/sections/summary/${syId}?schoolId=${DEFAULT_SCHOOL_ID}`)
				.catch(() => ({ data: { sections: [] as ExternalSection[] } })),
		]);
		setSubjectMap(new Map(subjectsRes.data.subjects.map((s) => [s.id, s])));
		setFacultyMap(new Map(facultyRes.data.faculty.map((f) => [f.id, f])));
		setSectionMap(new Map(sectionsRes.data.sections.map((s) => [s.id, s])));

		// Build enriched room lookup with building context
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
	}, []);

	const loadAll = useCallback(
		async (preserveRun = false) => {
			setLoading(true);
			setError(null);
			try {
				const syId = schoolYearId ?? (await fetchSchoolYear());
				if (!syId) {
					setError('No active school year found.');
					setLoading(false);
					return;
				}

				const [fetchedRuns] = await Promise.all([fetchRuns(syId), fetchReferenceData(syId)]);

				if (fetchedRuns.length === 0) {
					setDraft(null);
					setViolationReport(null);
					setLoading(false);
					return;
				}

				const runId = preserveRun ? selectedRunId : 'latest';
				if (!preserveRun) setSelectedRunId('latest');
				await fetchRunData(syId, runId);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : 'Failed to load data.';
				setError(msg);
			} finally {
				setLoading(false);
			}
		},
		[schoolYearId, selectedRunId, fetchSchoolYear, fetchRuns, fetchRunData, fetchReferenceData],
	);

	useEffect(() => {
		loadAll();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleRunChange = useCallback(
		async (runId: string) => {
			setSelectedRunId(runId);
			setSelectedViolation(null);
			setSelectedEntry(null);
			setEditHistory([]);
			if (!schoolYearId) return;
			setLoading(true);
			try {
				await fetchRunData(schoolYearId, runId);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : 'Failed to load run.';
				toast.error(msg);
			} finally {
				setLoading(false);
			}
		},
		[schoolYearId, fetchRunData],
	);

	const handleRefresh = useCallback(() => {
		loadAll(true);
	}, [loadAll]);

	const handleViolationSelect = useCallback(
		(v: Violation) => {
			setSelectedViolation((prev) => (prev === v ? null : v));
			// Auto-select first affected entry
			const firstId = v.entities.entryIds?.[0];
			if (firstId && draft?.entries) {
				const entry = draft.entries.find((e) => e.entryId === firstId);
				if (entry) setSelectedEntry(entry);
			}
		},
		[draft],
	);

	const handleEntryClick = useCallback((entry: ScheduledEntry) => {
		setSelectedEntry((prev) => (prev?.entryId === entry.entryId ? null : entry));
	}, []);

	const toggleFollowUp = useCallback(
		async (entryId: string) => {
			if (!draft || !schoolYearId) return;
			// Optimistic update
			setFollowUps((prev) => {
				const next = new Set(prev);
				if (next.has(entryId)) next.delete(entryId);
				else next.add(entryId);
				return next;
			});
			try {
				await atlasApi.put(
					`/follow-up-flags/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${draft.runId}/flags/${entryId}`,
				);
			} catch {
				// Revert on failure
				setFollowUps((prev) => {
					const next = new Set(prev);
					if (next.has(entryId)) next.delete(entryId);
					else next.add(entryId);
					return next;
				});
				toast.error('Failed to update follow-up flag.');
			}
		},
		[draft, schoolYearId],
	);

	/* ── Generate handler ── */

	const triggerGeneration = useCallback(async () => {
		if (!schoolYearId) return;
		setGenerating(true);
		try {
			const { data: run } = await atlasApi.post<GenerationRun>(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs`);
			if (run.status === 'FAILED') {
				toast.error(`Generation failed: ${run.error ?? 'Unknown error'}`);
			} else {
				const summary = run.summary as RunSummary | null;
				const assigned = summary?.assignedCount ?? 0;
				const unassigned = summary?.unassignedCount ?? 0;
				const hardViolations = summary?.hardViolationCount ?? 0;
				toast.success(
					`Schedule generated — ${assigned} assigned, ${unassigned} unassigned, ${hardViolations} hard violations`,
				);
			}
			await loadAll(false);
		} catch (e: unknown) {
			const axiosErr = e as { response?: { data?: { message?: string } } };
			const msg = axiosErr?.response?.data?.message ?? (e instanceof Error ? e.message : 'Generation request failed.');
			toast.error(msg);
		} finally {
			setGenerating(false);
		}
	}, [schoolYearId, loadAll]);

	const handleTriggerGenerate = useCallback(() => {
		if (followUps.size > 0) {
			setShowGenerateConfirm(true);
		} else {
			triggerGeneration();
		}
	}, [followUps, triggerGeneration]);

	const confirmGenerate = useCallback(() => {
		setShowGenerateConfirm(false);
		triggerGeneration();
	}, [triggerGeneration]);

	/* ── Publish handler (placeholder — Phase 5 scope) ── */

	const handlePublishConfirm = useCallback(() => {
		setShowPublishDialog(false);
		toast.info('Publish API is Phase 5 scope — no action taken.');
	}, []);

	/* ── Manual Edit handlers ── */

	const runIdNumeric = draft?.runId ?? null;
	const runVersion = draft?.version ?? 0;

	const apiBase = useMemo(() => {
		if (!schoolYearId || !runIdNumeric) return null;
		return `/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${runIdNumeric}/manual-edits`;
	}, [schoolYearId, runIdNumeric]);

	const fetchEditHistory = useCallback(async () => {
		if (!apiBase) return;
		try {
			const { data } = await atlasApi.get<{ edits: ManualEditRecord[] }>(apiBase);
			setEditHistory(data.edits);
		} catch { /* ignore */ }
	}, [apiBase]);

	const previewEdit = useCallback(
		async (proposal: ManualEditProposal): Promise<PreviewResult | null> => {
			if (!apiBase) return null;
			setPreviewLoading(true);
			try {
				const { data } = await atlasApi.post<PreviewResult>(`${apiBase}/preview`, proposal);
				setPreviewResult(data);
				return data;
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : 'Preview failed.';
				toast.error(msg);
				return null;
			} finally {
				setPreviewLoading(false);
			}
		},
		[apiBase],
	);

	const commitEdit = useCallback(
		async (proposal: ManualEditProposal, allowSoftOverride = false) => {
			if (!apiBase) return;
			setCommitLoading(true);
			try {
				const { data } = await atlasApi.post<CommitResult>(`${apiBase}/commit`, {
					proposal,
					expectedVersion: runVersion,
					allowSoftOverride,
				});
				// Apply returned draft in-place
				setDraft(data.draft);
				// Re-validate violations from the updated draft
				if (schoolYearId && runIdNumeric) {
					const violRes = await atlasApi.get<ViolationReport>(
						`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${runIdNumeric}/violations`,
					);
					setViolationReport(violRes.data);
				}
				fetchEditHistory();
				if (data.warnings.length > 0) {
					toast.warning(`Edit applied with ${data.warnings.length} soft warning(s).`);
				} else {
					toast.success('Edit applied successfully.');
				}
			} catch (e: unknown) {
				const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
					?? (e instanceof Error ? e.message : 'Commit failed.');
				if (msg.includes('VERSION_CONFLICT') || msg.includes('version conflict')) {
					toast.error('Version conflict — someone else edited this run. Please refresh.');
				} else {
					toast.error(msg);
				}
			} finally {
				setCommitLoading(false);
				setPreviewResult(null);
				setShowSoftConfirm(false);
				setPendingCommitProposal(null);
				setDragItem(null);
			}
		},
		[apiBase, runVersion, schoolYearId, runIdNumeric, fetchEditHistory],
	);

	const revertLastEdit = useCallback(async () => {
		if (!apiBase) return;
		setRevertLoading(true);
		try {
			const { data } = await atlasApi.post<CommitResult>(`${apiBase}/revert`);
			setDraft(data.draft);
			if (schoolYearId && runIdNumeric) {
				const violRes = await atlasApi.get<ViolationReport>(
					`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${runIdNumeric}/violations`,
				);
				setViolationReport(violRes.data);
			}
			fetchEditHistory();
			toast.success('Last edit reverted.');
		} catch (e: unknown) {
			const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
				?? (e instanceof Error ? e.message : 'Revert failed.');
			toast.error(msg);
		} finally {
			setRevertLoading(false);
		}
	}, [apiBase, schoolYearId, runIdNumeric, fetchEditHistory]);

	/** Handle drop of item onto a timetable cell */
	const handleCellDrop = useCallback(
		async (day: string, startTime: string, endTime: string) => {
			if (!dragItem) return;

			if (dragItem.type === 'unassigned') {
				// Show assignment picker modal instead of auto-selecting
				setAssignPickerTarget({ day, startTime, endTime, item: dragItem.item });
				// Pre-select from current view context if possible
				const firstEntity = Number(entityFilter);
				if (viewMode === 'faculty') {
					setAssignPickerFacultyId(String(firstEntity));
					setAssignPickerRoomId('');
				} else if (viewMode === 'room') {
					setAssignPickerRoomId(String(firstEntity));
					setAssignPickerFacultyId('');
				} else {
					setAssignPickerFacultyId('');
					setAssignPickerRoomId('');
				}
				setShowAssignmentPicker(true);
				return;
			}

			const entry = dragItem.entry;
			const proposal: ManualEditProposal = {
				editType: 'MOVE_ENTRY',
				entryId: entry.entryId,
				targetDay: day,
				targetStartTime: startTime,
				targetEndTime: endTime,
			};

			// Preview first
			const preview = await previewEdit(proposal);
			if (!preview) return;

			if (!preview.allowed) {
				setBlockerModalData(preview.humanConflicts.filter((hc) => hc.severity === 'HARD'));
				setDragItem(null);
				return;
			}

			if (preview.softViolations.length > 0) {
				setPendingCommitProposal(proposal);
				setShowSoftConfirm(true);
				return;
			}

			await commitEdit(proposal);
		},
		[dragItem, entityFilter, viewMode, previewEdit, commitEdit],
	);

	/** Keyboard-accessible placement confirm */
	const handleKbPlace = useCallback(
		async (day: string, startTime: string, endTime: string) => {
			if (!kbSelectedSource) return;
			const fakeItem = kbSelectedSource;
			setKbSelectedSource(null);

			if (fakeItem.type === 'unassigned') {
				// Route to assignment picker
				setAssignPickerTarget({ day, startTime, endTime, item: fakeItem.item });
				const firstEntity = Number(entityFilter);
				if (viewMode === 'faculty') {
					setAssignPickerFacultyId(String(firstEntity));
					setAssignPickerRoomId('');
				} else if (viewMode === 'room') {
					setAssignPickerRoomId(String(firstEntity));
					setAssignPickerFacultyId('');
				} else {
					setAssignPickerFacultyId('');
					setAssignPickerRoomId('');
				}
				setShowAssignmentPicker(true);
				return;
			}

			const proposal: ManualEditProposal = {
				editType: 'MOVE_ENTRY',
				entryId: fakeItem.entry.entryId,
				targetDay: day,
				targetStartTime: startTime,
				targetEndTime: endTime,
			};

			setDragItem(fakeItem);
			const preview = await previewEdit(proposal);
			if (!preview) { setDragItem(null); return; }
			if (!preview.allowed) {
				setBlockerModalData(preview.humanConflicts.filter((hc) => hc.severity === 'HARD'));
				setDragItem(null);
				return;
			}
			if (preview.softViolations.length > 0) {
				setPendingCommitProposal(proposal);
				setShowSoftConfirm(true);
				return;
			}
			await commitEdit(proposal);
		},
		[kbSelectedSource, entityFilter, viewMode, previewEdit, commitEdit],
	);

	/** Confirm assignment picker and submit the unassigned placement */
	const confirmAssignmentPicker = useCallback(async () => {
		if (!assignPickerTarget) return;
		const { day, startTime, endTime, item } = assignPickerTarget;
		const targetFacultyId = Number(assignPickerFacultyId);
		const targetRoomId = Number(assignPickerRoomId);
		if (!targetFacultyId || !targetRoomId) {
			toast.error('Please select both a faculty member and a room.');
			return;
		}
		setShowAssignmentPicker(false);

		const proposal: ManualEditProposal = {
			editType: 'PLACE_UNASSIGNED',
			sectionId: item.sectionId,
			subjectId: item.subjectId,
			session: item.session,
			targetDay: day,
			targetStartTime: startTime,
			targetEndTime: endTime,
			targetFacultyId,
			targetRoomId,
		};

		const preview = await previewEdit(proposal);
		if (!preview) { setDragItem(null); return; }
		if (!preview.allowed) {
			setBlockerModalData(preview.humanConflicts.filter((hc) => hc.severity === 'HARD'));
			setDragItem(null);
			return;
		}
		if (preview.softViolations.length > 0) {
			setPendingCommitProposal(proposal);
			setShowSoftConfirm(true);
			return;
		}
		await commitEdit(proposal);
	}, [assignPickerTarget, assignPickerFacultyId, assignPickerRoomId, previewEdit, commitEdit]);

	/** Load edit history on mount / run change */
	useEffect(() => {
		fetchEditHistory();
	}, [fetchEditHistory]);

	/* ── Lookup helpers ── */

	const subjectLabel = useCallback(
		(id: number) => {
			const s = subjectMap.get(id);
			return s ? s.code : `Unknown Subject (#${id})`;
		},
		[subjectMap],
	);

	const facultyLabel = useCallback(
		(id: number) => {
			const f = facultyMap.get(id);
			return f ? `${f.lastName}, ${f.firstName}` : `Unknown Faculty (#${id})`;
		},
		[facultyMap],
	);

	const sectionLabel = useCallback(
		(id: number) => {
			const s = sectionMap.get(id);
			return s ? s.name : `Unknown Section (#${id})`;
		},
		[sectionMap],
	);

	/** Human-readable room label: "RoomName · BuildingLabel (Floor X)" */
	const roomLabel = useCallback(
		(roomId: number): string => {
			const ri = roomMap.get(roomId);
			if (!ri) return `Unknown Room (#${roomId})`;
			const bldg = ri.buildingShortCode || ri.buildingName;
			return `${ri.name} · ${bldg} (Floor ${ri.floor})`;
		},
		[roomMap],
	);

	/** Compact room label for grid cells */
	const roomLabelShort = useCallback(
		(roomId: number): string => {
			const ri = roomMap.get(roomId);
			if (!ri) return `Unknown Room (#${roomId})`;
			const bldg = ri.buildingShortCode || ri.buildingName;
			return `${ri.name} · ${bldg}`;
		},
		[roomMap],
	);

	/** Whether a room is a stale/missing reference */
	const isStaleRoom = useCallback(
		(roomId: number): boolean => !roomMap.has(roomId),
		[roomMap],
	);

	/** Pivot-specific row label resolver */
	const pivotLabel = useCallback(
		(id: number): string => {
			if (viewMode === 'section') return sectionLabel(id);
			if (viewMode === 'faculty') return facultyLabel(id);
			return roomLabelShort(id);
		},
		[viewMode, sectionLabel, facultyLabel, roomLabelShort],
	);

	const gradeForSection = useCallback(
		(sectionId: number): number | null => {
			// Prefer grade from section adapter data
			const sec = sectionMap.get(sectionId);
			if (sec) {
				// displayOrder is the grade level (7, 8, 9, 10)
				const match = sec.gradeLevelName.match(/(\d+)/);
				if (match) return Number(match[1]);
			}
			// Fallback: infer grade from the entry's subject
			const entry = draft?.entries.find((e) => e.sectionId === sectionId);
			if (!entry) return null;
			const subj = subjectMap.get(entry.subjectId);
			return subj?.gradeLevels?.[0] ?? null;
		},
		[sectionMap, draft, subjectMap],
	);

	/** Hierarchical grouping for entity filter dropdown: Building→Room, Grade→Section, Department→Faculty */
	const groupedPivotEntities = useMemo(() => {
		const groups: { label: string; ids: number[] }[] = [];
		if (viewMode === 'room') {
			// Group rooms by building
			const byBuilding = new Map<string, number[]>();
			for (const id of pivotEntityIds) {
				const room = roomMap.get(id);
				const bldg = room ? (room.buildingShortCode || room.buildingName) : 'Unknown';
				const list = byBuilding.get(bldg) ?? [];
				list.push(id);
				byBuilding.set(bldg, list);
			}
			for (const [bldg, ids] of Array.from(byBuilding.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
				groups.push({ label: bldg, ids });
			}
		} else if (viewMode === 'section') {
			// Group sections by grade level
			const byGrade = new Map<string, number[]>();
			for (const id of pivotEntityIds) {
				const grade = gradeForSection(id);
				const key = grade ? `G${grade}` : 'Other';
				const list = byGrade.get(key) ?? [];
				list.push(id);
				byGrade.set(key, list);
			}
			for (const [grade, ids] of Array.from(byGrade.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
				groups.push({ label: grade, ids });
			}
		} else {
			// Faculty — group by department if available, else flat
			const byDept = new Map<string, number[]>();
			for (const id of pivotEntityIds) {
				const f = facultyMap.get(id);
				const dept = f?.department || 'Unassigned';
				const list = byDept.get(dept) ?? [];
				list.push(id);
				byDept.set(dept, list);
			}
			for (const [dept, ids] of Array.from(byDept.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
				groups.push({ label: dept, ids });
			}
		}
		return groups;
	}, [viewMode, pivotEntityIds, roomMap, gradeForSection, facultyMap]);

	/* ── Render ── */

	// Loading skeleton
	if (loading && !draft) {
		return (
			<div className="flex flex-col h-[calc(100svh-3.5rem)]">
				<div className="shrink-0 border-b px-4 py-3 space-y-2">
					<div className="flex items-center gap-3">
						<Skeleton className="h-8 w-40" />
						<Skeleton className="h-8 w-24" />
						<Skeleton className="h-5 w-16" />
						<Skeleton className="h-5 w-16" />
						<Skeleton className="h-5 w-16" />
					</div>
					<div className="flex items-center gap-4">
						{Array.from({ length: 6 }).map((_, i) => (
							<Skeleton key={i} className="h-4 w-20" />
						))}
					</div>
				</div>
				<div className="flex flex-1 min-h-0">
					<div className="w-64 border-r p-3 space-y-2">
						{Array.from({ length: 8 }).map((_, i) => (
							<Skeleton key={i} className="h-10 w-full" />
						))}
					</div>
					<div className="flex-1 min-w-0 p-4">
						<Skeleton className="h-full w-full rounded-lg" />
					</div>
				</div>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className="flex flex-col h-[calc(100svh-3.5rem)] items-center justify-center gap-4">
				<div className="flex items-center gap-2 text-destructive">
					<AlertCircle className="size-5" />
					<span className="text-sm font-medium">{error}</span>
				</div>
				<Button variant="outline" size="sm" onClick={() => loadAll()}>
					<RefreshCw className="size-3.5 mr-1.5" />
					Retry
				</Button>
			</div>
		);
	}

	// No runs state
	if (runs.length === 0) {
		return (
			<div className="flex flex-col h-[calc(100svh-3.5rem)] items-center justify-center gap-3">
				<div className="flex size-14 items-center justify-center rounded-full bg-muted">
					<CalendarClock className="size-7 text-muted-foreground/50" />
				</div>
				<h2 className="text-lg font-bold text-foreground">No Generation Runs</h2>
				<p className="text-sm text-muted-foreground max-w-xs text-center">
					No schedule generation runs have been performed yet. Generate your first
					schedule or refresh to check for new runs.
				</p>
				<div className="flex items-center gap-2">
					<Button
						variant="default"
						size="sm"
						disabled={generating || !schoolYearId}
						onClick={triggerGeneration}
					>
						{generating ? (
							<Loader2 className="size-3.5 mr-1.5 animate-spin" />
						) : (
							<Play className="size-3.5 mr-1.5" />
						)}
						{generating ? 'Generating…' : 'Generate Schedule'}
					</Button>
					<Button variant="outline" size="sm" onClick={() => loadAll()}>
						<RefreshCw className="size-3.5 mr-1.5" />
						Refresh
					</Button>
				</div>
			</div>
		);
	}

	const hardCount = violations.filter((v) => v.severity === 'HARD').length;
	const softCount = violations.filter((v) => v.severity === 'SOFT').length;

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)]">
			{/* ── Header: Controls + Inline Stat Banner ── */}
			<div className="shrink-0 border-b border-border bg-background">
				{/* Row 1: Run Management */}
				<div className="flex items-center gap-2 px-4 pt-3 pb-1.5 flex-wrap">
					{/* Run selector */}
					<div data-tutorial="run-selector">
					<Select value={selectedRunId} onValueChange={handleRunChange}>
						<SelectTrigger className="h-8 w-44 text-xs">
							<SelectValue placeholder="Select run" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="latest">Latest Run</SelectItem>
							{runs.map((r) => (
								<SelectItem key={r.id} value={String(r.id)}>
									Run #{r.id} — {formatTimestamp(r.createdAt)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					</div>

					{/* Generate new run */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="default"
									size="sm"
									className="h-8 gap-1.5"
									disabled={generating || loading || !schoolYearId}
									onClick={handleTriggerGenerate}
								>
									{generating ? (
										<Loader2 className="size-3.5 animate-spin" />
									) : (
										<Play className="size-3.5" />
									)}
									{generating ? 'Generating…' : 'Generate'}
								</Button>
							</TooltipTrigger>
							<TooltipContent>Trigger a new schedule generation run</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					{/* Publish schedule */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="h-8 gap-1.5"
									disabled={!draft || hardCount > 0}
									onClick={() => {
										setPublishAcknowledged(false);
										setShowPublishDialog(true);
									}}
								>
									<Send className="size-3.5" />
									Publish
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								{hardCount > 0
									? `Cannot publish: ${hardCount} hard violation(s) remaining`
									: 'Publish this schedule'}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					{/* Scheduling Policy – inline center-pane toggle */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									data-tutorial="policy-btn"
									variant={centerView === 'policy' ? 'default' : 'outline'}
									size="sm"
									className="h-8 gap-1.5"
									disabled={!schoolYearId}
									onClick={() => centerView === 'policy' ? exitPolicyView() : enterPolicyView()}
								>
									<Settings2 className="size-3.5" />
									{centerView === 'policy' ? 'Close Policy' : 'Policy'}
								</Button>
							</TooltipTrigger>
							<TooltipContent>Configure scheduling policy and soft-constraint weights</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="h-8"
									onClick={handleRefresh}
									disabled={loading}
									aria-label="Refresh data"
								>
									<RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Refresh data</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					{/* Undo Last Edit */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									data-tutorial="undo-btn"
									variant="outline"
									size="sm"
									className="h-8 gap-1.5"
									disabled={revertLoading || editHistory.length === 0 || !draft}
									onClick={revertLastEdit}
								>
									<Undo2 className={`size-3.5 ${revertLoading ? 'animate-spin' : ''}`} />
									Undo
								</Button>
							</TooltipTrigger>
							<TooltipContent>Revert the last manual edit</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					{/* Edit History */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="h-8 gap-1.5"
									disabled={editHistory.length === 0}
									onClick={() => setShowEditHistory(true)}
								>
									<History className="size-3.5" />
									<span className="text-[0.625rem]">{editHistory.length}</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>View manual edit history</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					{/* Tutorial + How It Works */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="h-8 gap-1.5"
									onClick={tutorial.start}
								>
									<GraduationCap className="size-3.5" />
									Tour
								</Button>
							</TooltipTrigger>
							<TooltipContent>Start guided tour of the schedule review page</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					<Link to="/timetabling/how-it-works" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
						<Lightbulb className="size-3.5" />
						How It Works
					</Link>

					{/* Inline stat banner */}
					{summary && (
						<div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
							<Badge variant="outline" className={`h-5 px-1.5 text-[0.625rem] font-bold ${statusColor(draft?.status ?? '')}`}>
								{draft?.status ?? '—'}
							</Badge>
							<StatItem
								icon={Check}
								label="Assigned"
								value={`${summary.assignedCount}/${summary.classesProcessed}`}
								explanation="Classes successfully placed vs total classes the algorithm attempted to schedule."
							/>
							<StatItem
								icon={ShieldAlert}
								label="Hard"
								value={String(summary.hardViolationCount)}
								className={summary.hardViolationCount > 0 ? 'text-red-600 font-semibold' : ''}
								explanation="Critical policy violations. A schedule with any Hard Violations cannot be published."
							/>
							<StatItem
								icon={Clock}
								label="Duration"
								value={formatDuration(draft ? runs.find((r) => String(r.id) === selectedRunId || (selectedRunId === 'latest' && r.id === runs[0]?.id))?.durationMs ?? null : null)}
								explanation="Real-world computing time it took to generate this draft."
							/>
						</div>
					)}
				</div>

				{/* Row 2: Grid Controls */}
				<div className="flex items-center gap-2 px-4 pb-2 flex-wrap" data-tutorial="grid-controls">
					{/* View-by pivot */}
					<Select value={viewMode} onValueChange={(v) => { setViewMode(v as ViewMode); setEntityFilter(''); }}>
						<SelectTrigger className="h-7 w-32 text-xs">
							<SelectValue placeholder="View by" />
						</SelectTrigger>
						<SelectContent>
							{(Object.entries(VIEW_MODE_LABELS) as [ViewMode, string][]).map(([key, label]) => (
								<SelectItem key={key} value={key}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Entity filter — hierarchical groups by building/grade/department */}
					<SearchableSelect
						value={entityFilter}
						onValueChange={setEntityFilter}
						placeholder={`Select ${VIEW_MODE_LABELS[viewMode]}…`}
						triggerClassName="h-7 w-44 text-xs"
						groups={groupedPivotEntities.map((group) => ({
							label: group.label,
							items: group.ids.map((id) => ({ value: String(id), label: pivotLabel(id) })),
						}))}
					/>

					<div className="h-4 w-px bg-border mx-0.5" />

					{/* Severity filter chips */}
					<FilterChip
						label="All"
						count={violations.length}
						active={severityFilter === 'all'}
						onClick={() => setSeverityFilter('all')}
					/>
					<FilterChip
						label="Hard"
						count={hardCount}
						active={severityFilter === 'hard'}
						onClick={() => setSeverityFilter('hard')}
						variant="destructive"
					/>
					<FilterChip
						label="Soft"
						count={softCount}
						active={severityFilter === 'soft'}
						onClick={() => setSeverityFilter('soft')}
						variant="warning"
					/>
					<FilterChip
						label="Conflicts"
						count={violations.filter((v) => CONFLICT_CODES.has(v.code)).length}
						active={severityFilter === 'conflicts'}
						onClick={() => setSeverityFilter('conflicts')}
					/>
					<FilterChip
						label="Well-being"
						count={violations.filter((v) => WELLBEING_CODES.has(v.code)).length}
						active={severityFilter === 'wellbeing'}
						onClick={() => setSeverityFilter('wellbeing')}
					/>
				</div>
			</div>

			{/* ── Body: Resizable Panels ── */}
			<ResizablePanelGroup direction="horizontal" className="flex flex-1 min-h-0">
				{/* LEFT: Violations + Unassigned Tabs */}
				<ResizablePanel
					ref={leftPanelRef}
					id="left-panel"
					order={1}
					minSize={12}
					maxSize={40}
					defaultSize={20}
					collapsible
					collapsedSize={3}
					onCollapse={() => setIsLeftCollapsed(true)}
					onExpand={() => setIsLeftCollapsed(false)}
					className="flex flex-col min-h-0 bg-background overflow-hidden border-r border-border"
				>
					{/* Minimized icon-strip when collapsed */}
					{isLeftCollapsed ? (
						<div className="flex flex-col items-center gap-2 pt-2 w-full h-full">
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => leftPanelRef.current?.expand()} aria-label="Expand left panel">
											<PanelLeftOpen className="size-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="right">Expand panel</TooltipContent>
								</Tooltip>
								<Separator />
								<Tooltip>
									<TooltipTrigger asChild>
										<button type="button" className="relative flex items-center justify-center h-8 w-8 rounded hover:bg-muted transition-colors" onClick={() => { leftPanelRef.current?.expand(); setLeftTab('violations'); }}>
											<ShieldAlert className="size-4 text-muted-foreground" />
											{violations.length > 0 && (
												<span className="absolute -top-1 -right-1 text-[0.5rem] font-bold leading-none bg-red-500 text-white rounded-full px-1">{violations.length}</span>
											)}
										</button>
									</TooltipTrigger>
									<TooltipContent side="right">Violations</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<button type="button" className="relative flex items-center justify-center h-8 w-8 rounded hover:bg-muted transition-colors" onClick={() => { leftPanelRef.current?.expand(); setLeftTab('unassigned'); }}>
											<AlertTriangle className="size-4 text-muted-foreground" />
											{summary && summary.unassignedCount > 0 && (
												<span className="absolute -top-1 -right-1 text-[0.5rem] font-bold leading-none bg-amber-500 text-white rounded-full px-1">{summary.unassignedCount}</span>
											)}
										</button>
									</TooltipTrigger>
									<TooltipContent side="right">Unassigned</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<button type="button" className="flex items-center justify-center h-8 w-8 rounded hover:bg-muted transition-colors" onClick={() => { leftPanelRef.current?.expand(); setLeftTab('locks'); }}>
											<Lock className="size-4 text-muted-foreground" />
										</button>
									</TooltipTrigger>
									<TooltipContent side="right">Pinned Sessions</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					) : (
						<>
					{/* Tab switcher */}
					<div className="shrink-0 flex border-b border-border" role="tablist" aria-label="Schedule review panels" data-tutorial="left-tabs">
						<button
							id="tab-violations"
							type="button"
							role="tab"
							aria-selected={leftTab === 'violations'}
							aria-controls="panel-violations"
							onClick={() => setLeftTab('violations')}
							className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
								leftTab === 'violations'
									? 'text-foreground border-b-2 border-primary'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							Violations
							<span className="ml-1 text-[0.625rem] opacity-70">{violations.length}</span>
						</button>
						<button
							id="tab-unassigned"
							type="button"
							role="tab"
							aria-selected={leftTab === 'unassigned'}
							aria-controls="panel-unassigned"
							onClick={() => setLeftTab('unassigned')}
							className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
								leftTab === 'unassigned'
									? 'text-foreground border-b-2 border-primary'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							Unassigned
							{summary && summary.unassignedCount > 0 && (
								<span className="ml-1 text-[0.625rem] text-amber-600 font-semibold">{summary.unassignedCount}</span>
							)}
						</button>
						<button
							id="tab-locks"
							type="button"
							role="tab"
							aria-selected={leftTab === 'locks'}
							aria-controls="panel-locks"
							onClick={() => setLeftTab('locks')}
							className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
								leftTab === 'locks'
									? 'text-foreground border-b-2 border-primary'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							<Lock className="inline size-3 mr-0.5 -mt-px" />
							Pins
						</button>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0 shrink-0 ml-auto"
							onClick={() => leftPanelRef.current?.collapse()}
							aria-label="Collapse left panel"
						>
							<PanelLeftClose className="size-4" />
						</Button>
					</div>

					{leftTab === 'violations' ? (
						<div id="panel-violations" role="tabpanel" aria-labelledby="tab-violations" className="flex flex-col flex-1 min-h-0">
							{/* Top blockers quick list */}
							{hardViolationCount > 0 && (
								<div className="shrink-0 px-3 py-2 border-b border-red-100 bg-red-50/50">
									<div className="flex items-center gap-1.5 text-[0.625rem] font-semibold text-red-700 mb-1">
										<ShieldAlert className="size-3" />
										Top blockers ({hardViolationCount} hard)
									</div>
									<div className="space-y-0.5">
										{topBlockers.map((v, i) => {
											const count = violations.filter((vv) => vv.code === v.code && vv.severity === 'HARD').length;
											return (
												<button
													key={i}
													type="button"
													onClick={() => {
														handleViolationSelect(v);
														setSeverityFilter('hard');
													}}
													className="flex items-center gap-1.5 w-full text-left text-[0.5625rem] text-red-800 hover:text-red-600 hover:bg-red-100/60 rounded px-1 py-0.5 transition-colors"
												>
													<ChevronRight className="size-2.5 shrink-0" />
													<span className="truncate flex-1">{VIOLATION_LABELS[v.code]}</span>
													<span className="shrink-0 text-red-500 font-medium">×{count}</span>
												</button>
											);
										})}
									</div>
								</div>
							)}
							{hardViolationCount === 0 && violations.length === 0 && (
								<div className="shrink-0 px-3 py-2 border-b border-emerald-100 bg-emerald-50/50">
									<div className="flex items-center gap-1.5 text-[0.625rem] font-medium text-emerald-700">
										<Check className="size-3" />
										No violations — schedule is clean
									</div>
								</div>
							)}

							<div className="shrink-0 px-3 py-2">
								<div className="relative">
									<Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
									<Input
										placeholder="Search violations…"
										value={violationSearch}
										onChange={(e) => setViolationSearch(e.target.value)}
										className="h-7 pl-7 text-xs"
									/>
									{violationSearch && (
										<button
											type="button"
											aria-label="Clear search"
											onClick={() => setViolationSearch('')}
											className="absolute right-2 top-1/2 -translate-y-1/2"
										>
											<X className="size-3 text-muted-foreground" />
										</button>
									)}
								</div>
							</div>

							<ScrollArea className="flex-1 min-h-0">
								<div className="px-3 pb-3 space-y-1">
									{filteredViolations.length === 0 ? (
										<div className="py-6 text-center text-xs text-muted-foreground">
											{violations.length === 0 ? 'No violations found' : 'No matching violations'}
										</div>
									) : (
										Array.from(violationsByCode.entries()).map(([code, vList]) => (
											<ViolationGroup
												key={code}
												code={code}
												violations={vList}
												selectedViolation={selectedViolation}
												onSelect={handleViolationSelect}
												onExplain={setDrawerViolation}
											/>
										))
									)}
								</div>
							</ScrollArea>
						</div>
					) : leftTab === 'unassigned' ? (
						<ScrollArea id="panel-unassigned" role="tabpanel" aria-labelledby="tab-unassigned" className="flex-1 min-h-0">
							<div className="px-3 py-3 space-y-3">
								{summary ? (
									<>
										{/* Dense Inline Stat Block */}
										<div className="flex flex-wrap items-center justify-between gap-1.5 rounded border border-border bg-muted/20 px-3 py-1.5 text-xs">
											<div className="flex items-center gap-1.5">
												<span className="text-muted-foreground font-medium">Processed</span>
												<span className="font-bold">{summary.classesProcessed}</span>
											</div>
											<div className="flex items-center gap-1.5">
												<span className="text-muted-foreground font-medium">Assigned</span>
												<span className="font-bold text-emerald-600">{summary.assignedCount}</span>
											</div>
											<div className="flex items-center gap-1.5">
												<span className="text-muted-foreground font-medium">Unassigned</span>
												<span className={`font-bold ${summary.unassignedCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{summary.unassignedCount}</span>
											</div>
										</div>

										{/* Unassigned items list */}
										{(draft?.unassignedItems ?? []).length > 0 && (
											<div className="space-y-2">
												{/* Reason filter chips */}
												<div className="flex flex-wrap gap-1">
													{(['all', 'NO_QUALIFIED_FACULTY', 'FACULTY_OVERLOADED', 'NO_AVAILABLE_SLOT', 'NO_COMPATIBLE_ROOM'] as const).map((r) => {
														const label = r === 'all' ? 'All' : (UNASSIGNED_REASON_LABELS[r]?.label ?? r);
														const count = r === 'all'
															? (draft?.unassignedItems ?? []).length
															: (draft?.unassignedItems ?? []).filter((it) => it.reason === r).length;
														if (r !== 'all' && count === 0) return null;
														return (
															<button
																key={r}
																onClick={() => setUnassignedReasonFilter(r)}
																className={`rounded-full px-2 py-0.5 text-[0.5625rem] font-medium transition-colors ${
																	unassignedReasonFilter === r
																		? 'bg-primary text-primary-foreground'
																		: 'bg-muted text-muted-foreground hover:bg-muted/80'
																}`}
															>
																{label} ({count})
															</button>
														);
													})}
												</div>

												<span className="text-[0.6875rem] font-medium text-muted-foreground">
													Drag to grid or expand for triage actions
												</span>
												{(draft?.unassignedItems ?? [])
													.filter((it) => unassignedReasonFilter === 'all' || it.reason === unassignedReasonFilter)
													.map((item, i) => {
													const grade = item.gradeLevel;
													const gradeBadge = grade ? GRADE_BADGE[grade] : undefined;
													const isKbSelected = kbSelectedSource?.type === 'unassigned'
														&& kbSelectedSource.item.sectionId === item.sectionId
														&& kbSelectedSource.item.subjectId === item.subjectId
														&& kbSelectedSource.item.session === item.session;
													const itemKey = `${item.sectionId}-${item.subjectId}-${item.session}`;
													const isFollowUp = followUps.has(itemKey);
													const isExpanded = expandedUnassigned.has(itemKey);
													const cachedFix = unassignedFixSuggestions[itemKey];
													return (
														<div
															key={`${itemKey}-${i}`}
															draggable
															onDragStart={() => setDragItem({ type: 'unassigned', item })}
															onDragEnd={() => { if (!showSoftConfirm) setDragItem(null); }}
															className={`rounded border text-xs transition-colors ${
																isKbSelected
																	? 'border-primary bg-primary/10 ring-2 ring-primary'
																	: isFollowUp
																		? 'border-amber-300 bg-amber-50/80'
																		: 'border-amber-200 bg-amber-50/50 hover:border-amber-300'
															}`}
														>
															<button
																type="button"
																className="w-full max-w-full overflow-hidden text-left px-2 py-1.5 space-y-1 cursor-grab active:cursor-grabbing"
																onClick={() => {
																	setExpandedUnassigned((prev) => {
																		const next = new Set(prev);
																		if (next.has(itemKey)) next.delete(itemKey);
																		else next.add(itemKey);
																		return next;
																	});
																	setKbSelectedSource(isKbSelected ? null : { type: 'unassigned', item });
																}}
															>
																<div className="flex items-center gap-1.5 min-w-0">
																	<ChevronDown className={`size-3 text-muted-foreground shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
																	<GripVertical className="size-3 text-muted-foreground/50 shrink-0" />
																	{gradeBadge && (
																		<Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] shrink-0 ${gradeBadge}`}>
																			G{grade}
																		</Badge>
																	)}
																	<span className="font-medium truncate min-w-0">{sectionLabel(item.sectionId)}</span>
																	<span className="text-muted-foreground shrink-0">·</span>
																	<span className="truncate min-w-0">{subjectLabel(item.subjectId)}</span>
																</div>
																<div className="flex items-center gap-1.5 text-[0.625rem] text-muted-foreground pl-[1.125rem]">
																	<UnassignedReasonBadge reason={item.reason} />
																	<span className="opacity-60 font-medium">Session {item.session}</span>
																	<span className="ml-auto text-red-600/80 font-semibold tracking-wide uppercase text-[0.5rem] flex items-center gap-0.5">
																		<AlertTriangle className="size-2.5" /> Blocker
																	</span>
																</div>
															</button>

															{/* Expanded detail panel */}
															<AnimatePresence>
																{isExpanded && (
																	<motion.div
																		initial={{ height: 0, opacity: 0 }}
																		animate={{ height: 'auto', opacity: 1 }}
																		exit={{ height: 0, opacity: 0 }}
																		transition={{ duration: 0.15 }}
																		className="overflow-hidden"
																	>
																		<div className="px-2 pb-2 pt-1 border-t border-amber-200 space-y-2">
																			{/* Reason explanation */}
																			<div className="rounded border border-red-200 bg-red-50/50 p-2 space-y-1">
																				<div className="flex items-center gap-1.5 text-[0.625rem] text-red-800 font-medium">
																					<AlertTriangle className="size-3" />
																					Why blocked
																				</div>
																				<p className="font-medium text-[0.6875rem] text-red-900 break-words whitespace-normal leading-snug">
																					{unassignedFixSuggestions[itemKey]
																						? unassignedFixSuggestions[itemKey]!.humanDetail
																						: item.reason === 'NO_QUALIFIED_FACULTY'
																							? 'No faculty member is tagged as qualified to teach this subject at this grade level.'
																							: item.reason === 'FACULTY_OVERLOADED'
																								? 'All qualified teachers have reached their maximum weekly/daily hours.'
																								: item.reason === 'NO_AVAILABLE_SLOT'
																									? 'Every possible time slot already causes a hard conflict.'
																									: item.reason === 'NO_COMPATIBLE_ROOM'
																										? 'No room of the required type is available at any open time.'
																										: 'This session could not be placed by the algorithm.'
																					}
																				</p>
																			</div>

																			{/* Impact */}
																			<div className="flex items-center gap-1.5 text-[0.625rem]">
																				<ShieldAlert className="size-2.5 text-red-600 shrink-0" />
																				<span className="text-red-700 font-medium">Publish blocker</span>
																				<span className="text-muted-foreground">— must be resolved before publishing</span>
																			</div>

																			{/* Fix suggestions (inline) */}
																			{cachedFix === undefined ? (
																				<Button
																					variant="outline"
																					size="sm"
																					className="w-full h-6 text-[0.5625rem] gap-1"
																					disabled={fixLoading === itemKey}
																					onClick={async (e) => {
																						e.stopPropagation();
																						// Resolve run ID - if 'latest', use first run id
																						const resolvedRunId = selectedRunId === 'latest' ? runs[0]?.id : selectedRunId;
																						if (!resolvedRunId) {
																							toast.error('No generation run selected');
																							return;
																						}
																						setFixLoading(itemKey);
																						try {
																							const { data } = await atlasApi.post<FixSuggestionsResponse>(
																								`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs/${resolvedRunId}/fix-suggestions`,
																								{
																									sectionId: item.sectionId,
																									subjectId: item.subjectId,
																									gradeLevel: item.gradeLevel,
																									session: item.session,
																									reason: item.reason,
																								},
																							);
																							setUnassignedFixSuggestions((prev) => ({
																								...prev,
																								[itemKey]: data.explanation,
																							}));
																						} catch (err: unknown) {
																							// Handle auth/permission errors with user-friendly messages
																							const error = err as { response?: { status?: number; data?: { code?: string } } };
																							const status = error.response?.status;
																							const code = error.response?.data?.code;
																							
																							if (status === 401) {
																								const msg = code === 'TOKEN_EXPIRED' 
																									? 'Session expired. Re-open ATLAS from EnrollPro.'
																									: 'Session missing or invalid. Re-open ATLAS from EnrollPro.';
																								toast.error(msg);
																							} else if (status === 403) {
																								toast.error('You do not have permission to request fix suggestions.');
																							} else if (status === 400) {
																								toast.error('Fix suggestion request is invalid. Please refresh run data and try again.');
																							} else {
																								toast.error('Could not fetch fix suggestions');
																							}
																							setUnassignedFixSuggestions((prev) => ({
																								...prev,
																								[itemKey]: null,
																							}));
																						} finally {
																							setFixLoading(null);
																						}
																					}}
																				>
																					{fixLoading === itemKey ? (
																						<Loader2 className="size-2.5 animate-spin" />
																					) : (
																						<Wand2 className="size-2.5" />
																					)}
																					Load fix suggestions
																				</Button>
																			) : cachedFix === null ? (
																				<div className="text-[0.625rem] text-muted-foreground italic px-1">
																					Could not load suggestions. Try again later.
																				</div>
																			) : (
																				<div className="space-y-1.5">
																					<div className="text-[0.625rem] font-semibold text-foreground flex items-center gap-1">
																						<Wand2 className="size-2.5 text-primary" />
																						Recommended fixes ({cachedFix.suggestions.length})
																					</div>
																					{cachedFix.suggestions.length === 0 ? (
																						<div className="text-[0.625rem] text-muted-foreground italic">
																							No automatic fix available. Manual intervention needed.
																						</div>
																					) : (
																						cachedFix.suggestions.map((sug, si) => (
																							<div key={si} className="rounded border border-border bg-background px-2 py-1.5 space-y-1">
																								<div className="flex items-center gap-1">
																									<span className="text-[0.625rem] font-medium text-foreground">{si + 1}. {sug.label}</span>
																								</div>
																								<p className="text-[0.5625rem] text-muted-foreground leading-relaxed">{sug.description}</p>
																								{sug.proposal && (
																									<Button
																										variant="outline"
																										size="sm"
																										className="h-5 text-[0.5rem] gap-0.5 mt-0.5"
																										onClick={(e) => {
																											e.stopPropagation();
																											if (sug.proposal) {
																												previewEdit(sug.proposal);
																											}
																										}}
																									>
																										<Zap className="size-2" />
																										Preview & Apply
																									</Button>
																								)}
																								{sug.policyHint && (
																									<p className="text-[0.5rem] text-muted-foreground/70 italic">
																										Policy: {sug.policyHint}
																									</p>
																								)}
																							</div>
																						))
																					)}
																				</div>
																			)}

																			{/* Quick action row */}
																			<div className="flex items-center gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
																				<Button
																					variant="ghost"
																					size="sm"
																					className="h-5 px-1.5 text-[0.5625rem] gap-0.5"
																					onClick={() => setDrawerUnassigned(item)}
																				>
																					<Lightbulb className="size-2.5" />
																					Full explanation
																				</Button>
																				<Button
																					variant="ghost"
																					size="sm"
																					className={`h-5 px-1.5 text-[0.5625rem] gap-0.5 ${isFollowUp ? 'text-amber-600' : ''}`}
																					onClick={() => {
																						setFollowUps((prev) => {
																							const next = new Set(prev);
																							if (next.has(itemKey)) next.delete(itemKey);
																							else next.add(itemKey);
																							return next;
																						});
																						toast.info(isFollowUp ? 'Follow-up removed' : 'Marked for follow-up');
																					}}
																				>
																					<Flag className={`size-2.5 ${isFollowUp ? 'fill-amber-500' : ''}`} />
																					{isFollowUp ? 'Unflag' : 'Flag'}
																				</Button>
																			</div>
																		</div>
																	</motion.div>
																)}
															</AnimatePresence>
														</div>
													);
												})}
											</div>
										)}

										{summary.unassignedCount === 0 && (
											<div className="py-4 text-center text-xs text-muted-foreground">
												<Check className="mx-auto size-6 text-emerald-500 mb-1" />
												All classes assigned successfully
											</div>
										)}
									</>
								) : (
									<div className="py-6 text-center text-xs text-muted-foreground">
										No draft data available
									</div>
								)}
							</div>
						</ScrollArea>
						) : (
						<div id="panel-locks" role="tabpanel" aria-labelledby="tab-locks" className="flex flex-col flex-1 min-h-0">
							<LockPanel
								schoolId={DEFAULT_SCHOOL_ID}
								schoolYearId={schoolYearId ?? 0}
								sections={sectionMap}
								subjects={subjectMap}
								faculty={facultyMap}
								rooms={lockPanelRooms}
							/>
						</div>
						)}
						</>
					)}
				</ResizablePanel>

				<ResizableHandle withHandle />

				{/* CENTER: Timetable Grid or Policy Pane */}
				<ResizablePanel id="center-panel" order={2} defaultSize={60} className="flex-1 min-w-0 flex flex-col min-h-0 relative" data-tutorial="center-grid">
					<AnimatePresence mode="wait">
						{centerView === 'policy' ? (
							<motion.div
								key="policy"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: 8 }}
								transition={{ duration: 0.18 }}
								className="flex flex-col min-h-0 h-full"
							>
								<SchedulingPolicyPane
									schoolId={DEFAULT_SCHOOL_ID}
									schoolYearId={schoolYearId}
									onBack={exitPolicyView}
									onPolicySaved={handleRefresh}
								/>
							</motion.div>
						) : centerView === 'manual-edit' && selectedEntry ? (
							<motion.div
								key="manual-edit"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: 8 }}
								transition={{ duration: 0.18 }}
								className="flex flex-col min-h-0 h-full"
							>
								<ManualEditPanel
									entry={selectedEntry}
									violationIndex={violationIndex}
									followUps={followUps}
									onToggleFollowUp={toggleFollowUp}
									onClose={exitManualEditView}
									subjectLabel={subjectLabel}
									facultyLabel={facultyLabel}
									sectionLabel={sectionLabel}
									gradeForSection={gradeForSection}
									roomLabel={roomLabel}
									isStaleRoom={isStaleRoom}
									timeSlots={timeSlots}
									roomMap={roomMap}
									facultyMap={facultyMap}
									draftEntries={draft?.entries ?? []}
									onPreview={previewEdit}
									onCommit={commitEdit}
									previewLoading={previewLoading}
									commitLoading={commitLoading}
									initialAction={pendingAction}
									onForceOpen={() => {}}
								/>
							</motion.div>
						) : (
							<motion.div
								key="grid"
								initial={{ opacity: 0, y: -8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={{ duration: 0.18 }}
								className="flex-1 min-w-0 flex flex-col min-h-0"
							>
								{draft && draft.entries.length > 0 ? (
									<ScrollArea className="flex-1 min-h-0">
										<div className="p-4">
											<TimetableGrid
												entries={gridEntries}
												timeSlots={timeSlots}
												violationIndex={violationIndex}
												highlightedEntryIds={highlightedEntryIds}
												selectedEntry={selectedEntry}
												followUps={followUps}
												onEntryClick={handleEntryClick}
												subjectLabel={subjectLabel}
												sectionLabel={sectionLabel}
												viewMode={viewMode}
												pivotLabel={pivotLabel}
												roomLabelShort={roomLabelShort}
												dragItem={dragItem}
												setDragItem={setDragItem}
												onCellDrop={handleCellDrop}
												kbSelectedSource={kbSelectedSource}
												onKbPlace={handleKbPlace}
											/>
										</div>
									</ScrollArea>
								) : (
									<div className="flex-1 flex items-center justify-center">
										<div className="text-center space-y-2">
											<CalendarClock className="mx-auto size-10 text-muted-foreground/30" />
											<p className="text-sm text-muted-foreground">
												{draft ? 'No draft entries in this run' : 'Select a run to view the timetable'}
											</p>
										</div>
									</div>
								)}
							</motion.div>
						)}
					</AnimatePresence>
				</ResizablePanel>

				{/* RIGHT: Compact Entry Detail — action buttons trigger center-pane swap */}
				<ResizableHandle withHandle />
				<ResizablePanel
					ref={rightPanelRef}
					id="right-panel"
					order={3}
					minSize={12}
					maxSize={30}
					defaultSize={20}
					collapsible
					collapsedSize={3}
					onCollapse={() => setIsRightCollapsed(true)}
					onExpand={() => setIsRightCollapsed(false)}
					className="flex flex-col min-h-0 bg-background overflow-hidden border-l border-border"
				>
					{/* Minimized icon-strip when collapsed */}
					{isRightCollapsed ? (
						<div className="flex flex-col items-center gap-2 pt-2 w-full h-full">
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => rightPanelRef.current?.expand()} aria-label="Expand right panel">
											<PanelRightOpen className="size-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="left">Expand panel</TooltipContent>
								</Tooltip>
								<Separator />
								<Tooltip>
									<TooltipTrigger asChild>
										<button type="button" className="relative flex items-center justify-center h-8 w-8 rounded hover:bg-muted transition-colors" onClick={() => rightPanelRef.current?.expand()}>
											<Users className="size-4 text-muted-foreground" />
											{selectedEntry && (
												<span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
											)}
										</button>
									</TooltipTrigger>
									<TooltipContent side="left">Entry detail</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					) : (
					<AnimatePresence mode="wait">
						{selectedEntry ? (
							<motion.div
								key={selectedEntry.entryId}
								initial={{ opacity: 0, x: 10 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: 10 }}
								transition={{ duration: 0.15 }}
								className="flex flex-col min-h-0 h-full"
							>
								{/* Entry summary header */}
								<div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
									<span className="text-xs font-semibold truncate">{subjectLabel(selectedEntry.subjectId)}</span>
									<div className="flex items-center gap-1 shrink-0">
										{/* Follow-up flag as icon in header */}
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														variant="ghost"
															size="sm"
															className="h-6 w-6 p-0"
															onClick={() => toggleFollowUp(selectedEntry.entryId)}
															aria-label={followUps.has(selectedEntry.entryId) ? 'Remove follow-up flag' : 'Mark for follow-up'}
														>
															<Flag className={`size-3.5 ${followUps.has(selectedEntry.entryId) ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
														</Button>
													</TooltipTrigger>
													<TooltipContent side="left">{followUps.has(selectedEntry.entryId) ? 'Remove follow-up flag' : 'Mark for follow-up'}</TooltipContent>
												</Tooltip>
											</TooltipProvider>
											<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => rightPanelRef.current?.collapse()} aria-label="Collapse panel">
												<PanelRightClose className="size-3.5" />
											</Button>
											<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedEntry(null)} aria-label="Close">
												<X className="size-3.5" />
											</Button>
										</div>
									</div>

									{/* Compact entry facts */}
									<ScrollArea className="flex-1 min-h-0">
										<div className="px-3 py-2 space-y-2">
											{(() => {
												const grade = gradeForSection(selectedEntry.sectionId);
												const gradeBadge = grade ? GRADE_BADGE[grade] : undefined;
												const entryViolations = violationIndex.get(selectedEntry.entryId) ?? [];
												return (
													<>
														<div className="flex items-center gap-1.5">
															<span className="text-xs font-medium">{sectionLabel(selectedEntry.sectionId)}</span>
															{gradeBadge && <Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] shrink-0 ${gradeBadge}`}>G{grade}</Badge>}
														</div>
														<p className="text-[0.6875rem] text-muted-foreground">{facultyLabel(selectedEntry.facultyId)}</p>
														<p className="text-[0.6875rem] text-muted-foreground">{DAY_SHORT[selectedEntry.day]} {formatTime(selectedEntry.startTime)}–{formatTime(selectedEntry.endTime)}</p>
														<p className="text-[0.6875rem] text-muted-foreground truncate">{roomLabel(selectedEntry.roomId)}</p>
														{entryViolations.length > 0 && (
															<div className="space-y-1 pt-1">
																{/* Concise summary line */}
																<div className="flex items-center gap-1.5">
																	{entryViolations.some((v) => v.severity === 'HARD') && (
																		<Badge variant="outline" className="h-4 px-1.5 text-[0.5rem] border-red-300 bg-red-50 text-red-700">
																			{entryViolations.filter((v) => v.severity === 'HARD').length} hard
																		</Badge>
																	)}
																	{entryViolations.some((v) => v.severity === 'SOFT') && (
																		<Badge variant="outline" className="h-4 px-1.5 text-[0.5rem] border-amber-300 bg-amber-50 text-amber-700">
																			{entryViolations.filter((v) => v.severity === 'SOFT').length} soft
																		</Badge>
																	)}
																</div>
																{/* Individual violation pills with tooltip detail */}
																{entryViolations.map((v, i) => {
																	const explanation = VIOLATION_EXPLANATIONS[v.code];
																	return (
																		<TooltipProvider key={i}>
																			<Tooltip delayDuration={200}>
																				<TooltipTrigger asChild>
																					<div className={`rounded px-2 py-1 text-[0.625rem] leading-snug cursor-help ${v.severity === 'HARD' ? 'border border-red-200 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-800' : 'border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'}`}>
																						{VIOLATION_LABELS[v.code] ?? v.code}
																					</div>
																				</TooltipTrigger>
																				{explanation && (
																					<TooltipContent side="left" className="max-w-[250px] text-xs">
																						<p className="font-medium mb-1">{VIOLATION_LABELS[v.code]}</p>
																						<p className="text-muted-foreground">{explanation.why}</p>
																					</TooltipContent>
																				)}
																			</Tooltip>
																		</TooltipProvider>
																	);
																})}
															</div>
														)}
													</>
												);
											})()}
										</div>
									</ScrollArea>

									{/* Sticky action footer — buttons open center-pane workspace */}
									<div className="shrink-0 border-t border-border px-3 py-2 space-y-1.5 bg-background" data-tutorial="manual-edit-actions">
										<p className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">Manual Edits</p>
										<Button variant="outline" size="sm" className="w-full h-7 text-xs justify-start" onClick={() => enterManualEditView('CHANGE_TIMESLOT')} aria-label="Move timeslot">
											<Clock className="size-3 mr-1.5" />Move Timeslot
										</Button>
										<Button variant="outline" size="sm" className="w-full h-7 text-xs justify-start" onClick={() => enterManualEditView('CHANGE_ROOM')} aria-label="Change room">
											<DoorOpen className="size-3 mr-1.5" />Change Room
										</Button>
										<Button variant="outline" size="sm" className="w-full h-7 text-xs justify-start" onClick={() => enterManualEditView('CHANGE_FACULTY')} aria-label="Reassign faculty">
											<Users className="size-3 mr-1.5" />Reassign Faculty
										</Button>
									</div>
								</motion.div>
							) : (
								<motion.div
									key="empty"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className="flex-1 flex flex-col"
								>
									<div className="shrink-0 flex items-center justify-end px-3 py-2 border-b border-border">
										<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => rightPanelRef.current?.collapse()} aria-label="Collapse panel">
											<PanelRightClose className="size-3.5" />
										</Button>
									</div>
									<div className="flex-1 flex items-center justify-center">
										<div className="text-center space-y-2 px-4">
											<Users className="mx-auto size-8 text-muted-foreground/30" />
											<p className="text-xs text-muted-foreground">Click an entry in the grid to view details and actions</p>
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					)}
				</ResizablePanel>
			</ResizablePanelGroup>

			{/* ── Generate Confirmation Dialog ── */}
			<Dialog open={showGenerateConfirm} onOpenChange={setShowGenerateConfirm}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Generate New Schedule?</DialogTitle>
						<DialogDescription>
							You have <span className="font-semibold text-amber-600">{followUps.size}</span> flagged
							follow-up{followUps.size !== 1 ? 's' : ''} in the current draft. A new generation will
							replace the current draft and those flags will be lost.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" size="sm" onClick={() => setShowGenerateConfirm(false)}>
							Cancel
						</Button>
						<Button variant="default" size="sm" onClick={confirmGenerate}>
							<Play className="size-3.5 mr-1.5" />
							Generate Anyway
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ── Generation Progress Overlay ── */}
			<Dialog open={generating} modal>
				<DialogContent className="sm:max-w-sm" onPointerDownOutside={(e) => e.preventDefault()} hideClose>
					<div className="flex flex-col items-center gap-4 py-4">
						<div className="relative flex items-center justify-center">
							<div className="absolute size-16 rounded-full border-4 border-primary/20" />
							<Loader2 className="size-10 text-primary animate-spin" />
						</div>
						<div className="text-center space-y-1">
							<h3 className="text-base font-semibold">Generating Schedule</h3>
							<p className="text-sm text-muted-foreground">
								Constructing timetable and validating constraints…
							</p>
						</div>
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
							<Clock className="size-3" />
							<span>Elapsed: {generationElapsed}s</span>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* ── Publish Dialog ── */}
			<Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Publish Schedule</DialogTitle>
						<DialogDescription>
							{softCount > 0 ? (
								<>
									This draft has <span className="font-semibold text-amber-600">{softCount}</span> soft
									violation{softCount !== 1 ? 's' : ''}. Please review and acknowledge before publishing.
								</>
							) : (
								'This draft has no violations. Ready to publish.'
							)}
						</DialogDescription>
					</DialogHeader>

					{softCount > 0 && (
						<div className="flex items-start gap-2 pt-2">
							<Checkbox
								id="ack-soft"
								checked={publishAcknowledged}
								onCheckedChange={(v) => setPublishAcknowledged(v === true)}
							/>
							<label htmlFor="ack-soft" className="text-sm leading-tight cursor-pointer select-none">
								I have reviewed all soft violations and accept them for this published schedule.
							</label>
						</div>
					)}

					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" size="sm" onClick={() => setShowPublishDialog(false)}>
							Cancel
						</Button>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span>
										<Button
											variant="default"
											size="sm"
											disabled={softCount > 0 && !publishAcknowledged}
											onClick={handlePublishConfirm}
										>
											<Send className="size-3.5 mr-1.5" />
											Publish
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>Publish API implementation is Phase 5 scope</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ── Soft-Violation Confirm Dialog ── */}
			<Dialog open={showSoftConfirm} onOpenChange={(open) => {
				if (!open) {
					setShowSoftConfirm(false);
					setPendingCommitProposal(null);
					setPreviewResult(null);
					setDragItem(null);
				}
			}}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="size-4 text-amber-500" />
							Soft Constraint Warnings
						</DialogTitle>
						<DialogDescription>
							This edit introduces {previewResult?.softViolations.length ?? 0} soft warning(s).
							You can still apply it, but review the issues below.
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-48 overflow-auto space-y-1.5 py-2">
						{previewResult?.softViolations.map((v, i) => (
							<div
								key={i}
								className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
							>
								<span className="font-mono text-[0.625rem] opacity-60 mr-1.5">{v.code}</span>
								{v.message}
							</div>
						))}
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setShowSoftConfirm(false);
								setPendingCommitProposal(null);
								setPreviewResult(null);
								setDragItem(null);
							}}
						>
							Cancel
						</Button>
						<Button
							variant="default"
							size="sm"
							disabled={commitLoading}
							onClick={() => {
								if (pendingCommitProposal) commitEdit(pendingCommitProposal, true);
							}}
						>
							{commitLoading ? 'Applying…' : 'Apply Anyway'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ── Assignment Picker for Unassigned Placement ── */}
			<Dialog open={showAssignmentPicker} onOpenChange={(open) => {
				if (!open) {
					setShowAssignmentPicker(false);
					setAssignPickerTarget(null);
					setDragItem(null);
				}
			}}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Users className="size-4 text-primary" />
							Assign Faculty &amp; Room
						</DialogTitle>
						<DialogDescription>
							{assignPickerTarget && (
								<>
									Placing <span className="font-medium">{subjectLabel(assignPickerTarget.item.subjectId)}</span>
									{' '}for {sectionLabel(assignPickerTarget.item.sectionId)} on {DAY_SHORT[assignPickerTarget.day]} at {formatTime(assignPickerTarget.startTime)}.
								</>
							)}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<div className="space-y-1.5">
							<span className="text-xs font-medium">Faculty</span>
							<Select value={assignPickerFacultyId} onValueChange={setAssignPickerFacultyId}>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue placeholder="Select a faculty member…" />
								</SelectTrigger>
								<SelectContent>
									{Array.from(facultyMap.values())
										.sort((a, b) => `${a.lastName}`.localeCompare(`${b.lastName}`))
										.map((f) => (
											<SelectItem key={f.id} value={String(f.id)}>
												{f.lastName}, {f.firstName}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<span className="text-xs font-medium">Room</span>
							<Select value={assignPickerRoomId} onValueChange={setAssignPickerRoomId}>
								<SelectTrigger className="h-8 text-xs">
									<SelectValue placeholder="Select a room…" />
								</SelectTrigger>
								<SelectContent>
									{Array.from(roomMap.values())
										.filter((r) => r.isTeachingSpace)
										.sort((a, b) => {
											const ba = (a.buildingShortCode || a.buildingName).toLowerCase();
											const bb = (b.buildingShortCode || b.buildingName).toLowerCase();
											if (ba !== bb) return ba.localeCompare(bb);
											return a.name.localeCompare(b.name);
										})
										.map((r) => (
											<SelectItem key={r.id} value={String(r.id)}>
												{r.buildingShortCode || r.buildingName} — {r.name}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" size="sm" onClick={() => {
							setShowAssignmentPicker(false);
							setAssignPickerTarget(null);
							setDragItem(null);
						}}>
							Cancel
						</Button>
						<Button
							variant="default"
							size="sm"
							disabled={!assignPickerFacultyId || !assignPickerRoomId}
							onClick={confirmAssignmentPicker}
						>
							Preview &amp; Place
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ── Edit History Dialog ── */}
			<Dialog open={showEditHistory} onOpenChange={setShowEditHistory}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<History className="size-4" />
							Manual Edit History
						</DialogTitle>
						<DialogDescription>
							{editHistory.length === 0
								? 'No manual edits have been made on this run.'
								: `${editHistory.length} edit(s) recorded.`}
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-64 overflow-auto space-y-1.5 py-2">
						{editHistory.map((edit) => (
							<div
								key={edit.id}
								className={`rounded border px-3 py-2 text-xs space-y-0.5 ${
									edit.editType === 'REVERT'
										? 'border-muted bg-muted/30'
										: 'border-border bg-background'
								}`}
							>
								<div className="flex items-center justify-between">
									<Badge variant="outline" className="h-4 px-1 text-[0.5625rem]">
										{edit.editType.replace(/_/g, ' ')}
									</Badge>
									<span className="text-[0.625rem] text-muted-foreground">
										{new Date(edit.createdAt).toLocaleString()}
									</span>
								</div>
								{edit.validationSummary != null ? (() => {
									const vs = edit.validationSummary as Record<string, number>;
									return (
										<div className="text-muted-foreground text-[0.625rem]">
											Hard: {vs.hardCount ?? 0}, Soft: {vs.softCount ?? 0}
										</div>
									);
								})() : null}
							</div>
						))}
					</div>
					<DialogFooter>
						<Button variant="outline" size="sm" onClick={() => setShowEditHistory(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ── Tutorial Overlay ── */}
			<TutorialOverlay
				steps={TUTORIAL_STEPS}
				active={tutorial.active}
				onComplete={tutorial.complete}
			/>

			{/* ── Hard Violation Blocker Modal ── */}
			<Dialog open={!!blockerModalData} onOpenChange={(o) => { if (!o) setBlockerModalData(null); }}>
				<DialogContent className="w-[calc(100%-2rem)] sm:max-w-md rounded-2xl p-6 overflow-hidden">
					<DialogHeader className="space-y-4">
						<div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 ring-4 ring-red-50 mx-auto">
							<ShieldAlert className="size-6 text-red-600" />
						</div>
						<DialogTitle className="text-xl font-bold tracking-tight text-center text-red-900">
							Edit Blocked
						</DialogTitle>
						<DialogDescription className="text-center text-sm text-foreground">
							This change violates one or more <strong className="font-semibold text-red-700">hard constraints</strong> and cannot be applied to the schedule.
						</DialogDescription>
					</DialogHeader>

					<div className="mt-4 bg-red-50/50 border border-red-100 rounded-xl overflow-hidden max-h-[40vh]">
						<ScrollArea className="max-h-[40vh]">
							<div className="p-4 space-y-3">
								{blockerModalData?.map((hc, i) => (
									<div key={i} className="flex items-start gap-2">
										<AlertCircle className="size-4 shrink-0 mt-0.5 text-red-500" />
										<div className="space-y-0.5">
											<p className="text-sm font-medium text-red-800 leading-snug">{hc.humanTitle}</p>
											<p className="text-xs text-red-700/80 leading-snug">{hc.humanDetail}</p>
											{hc.delta && (
												<p className="text-[0.625rem] text-red-500/70 font-mono mt-0.5">{hc.delta}</p>
											)}
										</div>
									</div>
								))}
							</div>
						</ScrollArea>
					</div>

					<DialogFooter className="mt-6 sm:justify-center">
						<Button
							variant="outline"
							onClick={() => setBlockerModalData(null)}
							className="w-full sm:w-auto min-w-32 active:scale-95 transition-all text-red-700 border-red-200 hover:bg-red-50"
						>
							Understood
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ── Explainability Drawer ── */}
			<ExplainabilityDrawer
				open={showExplainDrawer}
				onClose={() => { setDrawerViolation(null); setDrawerUnassigned(null); }}
				violation={drawerViolation ?? undefined}
				unassignedItem={drawerUnassigned ?? undefined}
			/>
		</div>
	);
}

/* ─── Sub-Components ─── */

function FilterChip({
	label,
	count,
	active,
	onClick,
	variant,
}: {
	label: string;
	count: number;
	active: boolean;
	onClick: () => void;
	variant?: 'destructive' | 'warning';
}) {
	let base = 'border-border text-muted-foreground hover:bg-muted';
	if (active) {
		if (variant === 'destructive') base = 'border-red-300 bg-red-50 text-red-700';
		else if (variant === 'warning') base = 'border-amber-300 bg-amber-50 text-amber-700';
		else base = 'border-primary/30 bg-primary/5 text-foreground';
	}

	return (
		<Badge
			variant="outline"
			className={`h-6 px-2 text-[0.6875rem] cursor-pointer select-none ${base}`}
			onClick={onClick}
		>
			{label}
			<span className="ml-1 opacity-70">{count}</span>
		</Badge>
	);
}

function StatItem({
	icon: Icon,
	label,
	value,
	explanation,
	className = '',
}: {
	icon: React.ElementType;
	label: string;
	value: string;
	explanation?: React.ReactNode;
	className?: string;
}) {
	const content = (
		<span className={`flex items-center gap-1 ${className}`}>
			<Icon className="size-3 shrink-0" />
			<span className={explanation ? "opacity-90 border-b border-dotted border-current/50" : "opacity-70"}>{label}:</span>
			<span className="font-medium text-foreground">{value}</span>
		</span>
	);

	if (!explanation) return content;

	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button type="button" className="cursor-help outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm text-left align-top transition-colors hover:opacity-80">
						{content}
					</button>
				</TooltipTrigger>
				<TooltipContent className="max-w-[220px] text-xs font-normal leading-relaxed" side="bottom">
					{explanation}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function MetricExplain({ label, explanation }: { label: string; explanation: React.ReactNode }) {
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button type="button" className="text-xs font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm text-left transition-colors hover:text-foreground hover:border-foreground/50 pb-0.5">
						{label}
					</button>
				</TooltipTrigger>
				<TooltipContent className="max-w-[260px] text-xs font-normal leading-relaxed" side="bottom">
					{explanation}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/* ─── Violation Group ─── */

function ViolationGroup({
	code,
	violations,
	selectedViolation,
	onSelect,
	onExplain,
}: {
	code: ViolationCode;
	violations: Violation[];
	selectedViolation: Violation | null;
	onSelect: (v: Violation) => void;
	onExplain?: (v: Violation) => void;
}) {
	const isHard = violations[0]?.severity === 'HARD';
	const [expanded, setExpanded] = useState(isHard);

	return (
		<div className="rounded-md border border-border overflow-hidden">
			<button
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-2 w-full px-2 py-1.5 text-left text-xs font-medium hover:bg-muted/50 transition-colors"
			>
				<ChevronRight
					className={`size-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
				/>
				<Badge
					variant="outline"
					className={`h-4 px-1 text-[0.5625rem] ${isHard ? 'border-red-300 bg-red-50 text-red-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
				>
					{isHard ? 'HARD' : 'SOFT'}
				</Badge>
				<span className="truncate flex-1">{VIOLATION_LABELS[code]}</span>
				<span className="text-muted-foreground">{violations.length}</span>
			</button>

			<AnimatePresence>
				{expanded && (
					<motion.div
						initial={{ height: 0 }}
						animate={{ height: 'auto' }}
						exit={{ height: 0 }}
						transition={{ duration: 0.15 }}
						className="overflow-hidden"
					>
						<div className="border-t border-border">
							{violations.map((v, i) => {
								const isSelected = selectedViolation === v;
								return (
									<div key={i} className={`flex items-center gap-0.5 ${
										isSelected
											? 'bg-primary/10 text-foreground'
											: 'text-muted-foreground hover:bg-muted/50'
									}`}>
										{v.meta && Object.keys(v.meta).length > 0 ? (
											<TooltipProvider delayDuration={200}>
												<Tooltip>
													<TooltipTrigger asChild>
														<button
															onClick={() => onSelect(v)}
															className="flex-1 text-left px-3 py-1.5 text-[0.6875rem] leading-tight transition-colors"
														>
															<span className="line-clamp-2 underline decoration-dashed decoration-muted-foreground/50 underline-offset-2">{v.message}</span>
														</button>
													</TooltipTrigger>
													<TooltipContent className="max-w-[280px] text-[0.625rem] font-normal leading-relaxed space-y-1 py-2 px-3 border-amber-200 bg-amber-50 text-amber-900" side="right">
														<div className="font-semibold text-amber-700 pb-1 mb-1 border-b border-amber-200/60">Constraint Context</div>
														{v.meta.consecutiveMinutes != null && v.meta.maxConsecutive != null && (
															<div>Observed: {String(v.meta.consecutiveMinutes)} min · Limit: {String(v.meta.maxConsecutive)} min · <span className="font-semibold">Δ +{Number(v.meta.consecutiveMinutes) - Number(v.meta.maxConsecutive)} min</span></div>
														)}
														{v.meta.dailyMinutes != null && v.meta.maxTeachingMinutesPerDay != null && (
															<div>Observed: {String(v.meta.dailyMinutes)} min · Limit: {String(v.meta.maxTeachingMinutesPerDay)} min · <span className="font-semibold">Δ +{Number(v.meta.dailyMinutes) - Number(v.meta.maxTeachingMinutesPerDay)} min</span></div>
														)}
														{v.meta.actualGapMinutes != null && v.meta.requiredBreakMinutes != null && (
															<div>Actual break: {String(v.meta.actualGapMinutes)} min · Required: {String(v.meta.requiredBreakMinutes)} min · <span className="font-semibold">Short by {Number(v.meta.requiredBreakMinutes) - Number(v.meta.actualGapMinutes)} min</span></div>
														)}
														{v.meta.totalIdleMinutes != null && v.meta.configuredThresholds != null && (
															<div>Idle: {String(v.meta.totalIdleMinutes)} min · Limit: {String((v.meta.configuredThresholds as Record<string,unknown>).maxIdleGapMinutesPerDay ?? '?')} min</div>
														)}
														{v.meta.estimatedDistanceMeters != null && (
															<div>Distance: ~{String(v.meta.estimatedDistanceMeters)}m{v.meta.configuredThresholds ? ` · Limit: ${String((v.meta.configuredThresholds as Record<string,unknown>).maxWalkingDistanceMetersPerTransition ?? '?')}m` : ''}</div>
														)}
														{v.meta.gapMinutes != null && (
															<div>Gap: {String(v.meta.gapMinutes)} min</div>
														)}
														{v.meta.buildingTransitions != null && (
															<div>Building trans: {String(v.meta.buildingTransitions)}{v.meta.configuredThresholds ? ` · Limit: ${String((v.meta.configuredThresholds as Record<string,unknown>).maxBuildingTransitionsPerDay ?? '?')}` : ''}</div>
														)}
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										) : (
											<button
												onClick={() => onSelect(v)}
												className="flex-1 text-left px-3 py-1.5 text-[0.6875rem] leading-tight transition-colors"
											>
												<span className="line-clamp-2">{v.message}</span>
											</button>
										)}
										<button
											onClick={(e) => { e.stopPropagation(); onSelect(v); }}
											className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
											aria-label="Focus grid on this violation"
											title="Focus grid"
										>
											<Crosshair className="size-3 text-primary/70" />
										</button>
										{onExplain && (
											<button
												onClick={(e) => { e.stopPropagation(); onExplain(v); }}
												className="shrink-0 p-1 mr-1 rounded hover:bg-muted transition-colors"
												aria-label="Explain this violation"
											>
												<Lightbulb className="size-3 text-amber-500" />
											</button>
										)}
									</div>
								);
							})}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

/* ─── Timetable Grid ─── */

type DragSource = { type: 'entry'; entry: ScheduledEntry } | { type: 'unassigned'; item: UnassignedItem } | null;

function TimetableGrid({
	entries,
	timeSlots,
	violationIndex,
	highlightedEntryIds,
	selectedEntry,
	followUps,
	onEntryClick,
	subjectLabel,
	sectionLabel,
	viewMode,
	pivotLabel,
	roomLabelShort,
	dragItem,
	setDragItem,
	onCellDrop,
	kbSelectedSource,
	onKbPlace,
}: {
	entries: ScheduledEntry[];
	timeSlots: Array<{ startTime: string; endTime: string }>;
	violationIndex: Map<string, Violation[]>;
	highlightedEntryIds: Set<string>;
	selectedEntry: ScheduledEntry | null;
	followUps: Set<string>;
	onEntryClick: (e: ScheduledEntry) => void;
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	viewMode: ViewMode;
	pivotLabel: (id: number) => string;
	roomLabelShort: (roomId: number) => string;
	dragItem: DragSource;
	setDragItem: (d: DragSource) => void;
	onCellDrop: (day: string, startTime: string, endTime: string) => void;
	kbSelectedSource: DragSource;
	onKbPlace: (day: string, startTime: string, endTime: string) => void;
}) {
	const [dropTarget, setDropTarget] = useState<string | null>(null);

	/** Grid lookup: `${day}-${startTime}` → entries */
	const gridIndex = useMemo(() => {
		const index = new Map<string, ScheduledEntry[]>();
		for (const e of entries) {
			const key = `${e.day}-${e.startTime}`;
			const list = index.get(key) ?? [];
			list.push(e);
			index.set(key, list);
		}
		return index;
	}, [entries]);

	const isDragging = dragItem !== null;
	const hasKbSource = kbSelectedSource !== null;

	return (
		<div className="overflow-auto">
			<table className="w-full border-collapse text-xs min-w-[640px]">
				<thead>
					<tr>
						<th className="w-20 px-2 py-2 text-left text-muted-foreground font-medium border-b border-border">
							Time
						</th>
						{DAYS.map((day) => (
							<th
								key={day}
								className="px-2 py-2 text-center font-medium text-muted-foreground border-b border-border"
							>
								{DAY_SHORT[day]}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{timeSlots.map((slot) => (
						<tr key={slot.startTime} className="border-b border-border/50">
							<td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap font-mono text-[0.625rem] align-top">
								{formatTime(slot.startTime)}
								<br />
								<span className="opacity-50">{formatTime(slot.endTime)}</span>
							</td>
							{DAYS.map((day) => {
								const key = `${day}-${slot.startTime}`;
								const cellEntries = gridIndex.get(key) ?? [];
								const isDropOver = dropTarget === key;
								// Determine cell drop zone class
								let dropClass = '';
								if (isDragging || hasKbSource) {
									if (isDropOver) {
										dropClass = ' ring-2 ring-primary bg-primary/5';
									} else {
										dropClass = ' ring-1 ring-dashed ring-muted-foreground/20';
									}
								}
								return (
									<td
										key={day}
										className={`px-1 py-1 align-top border-l border-border/30 transition-all${dropClass}`}
										onDragOver={(ev) => {
											if (!isDragging) return;
											ev.preventDefault();
											ev.dataTransfer.dropEffect = 'move';
											setDropTarget(key);
										}}
										onDragLeave={() => {
											if (dropTarget === key) setDropTarget(null);
										}}
										onDrop={(ev) => {
											ev.preventDefault();
											setDropTarget(null);
											onCellDrop(day, slot.startTime, slot.endTime);
										}}
										onClick={() => {
											if (hasKbSource) {
												onKbPlace(day, slot.startTime, slot.endTime);
											}
										}}
									>
										<div className="space-y-0.5 min-h-[1.5rem]">
											{cellEntries.map((e) => {
												const sev = entrySeverity(e.entryId, violationIndex);
												const isHighlighted = highlightedEntryIds.has(e.entryId);
												const isSelected = selectedEntry?.entryId === e.entryId;
												const isFollowUp = followUps.has(e.entryId);

												let cellClass = 'bg-muted/50 border-transparent';
												if (sev === 'HARD')
													cellClass = 'bg-red-500/10 border-red-500 text-red-700';
												else if (sev === 'SOFT')
													cellClass = 'bg-amber-500/10 border-amber-500 text-amber-700';
												else cellClass = 'bg-primary/5 border-transparent';

												if (isHighlighted)
													cellClass += ' ring-2 ring-primary ring-offset-1';
												if (isSelected)
													cellClass += ' ring-2 ring-foreground ring-offset-1';

												return (
													<TooltipProvider key={e.entryId}>
														<Tooltip delayDuration={300}>
															<TooltipTrigger asChild>
																<button
																	draggable
																	onDragStart={(ev) => {
																		ev.stopPropagation();
																		setDragItem({ type: 'entry', entry: e });
																	}}
																	onDragEnd={() => setDragItem(null)}
																	onClick={(ev) => {
																		ev.stopPropagation();
																		onEntryClick(e);
																	}}
																	className={`w-full text-left rounded px-1.5 py-1 border text-[0.625rem] leading-tight transition-all cursor-grab active:cursor-grabbing hover:opacity-80 ${cellClass}`}
																>
																	<div className="font-medium truncate flex items-center gap-1">
																		<GripVertical className="size-2.5 text-muted-foreground/40 shrink-0" />
																		{subjectLabel(e.subjectId)}
																	</div>
																	<div className="text-muted-foreground truncate">
																		{viewMode === 'room'
																			? sectionLabel(e.sectionId)
																			: sectionLabel(e.sectionId)}
																		{viewMode === 'section' && (
																			<span className="ml-1 opacity-60" title={roomLabelShort(e.roomId)}>
																				{roomLabelShort(e.roomId)}
																			</span>
																		)}
																		{viewMode === 'faculty' && (
																			<span className="ml-1 opacity-60">
																				{roomLabelShort(e.roomId)}
																			</span>
																		)}
																	</div>
																	{isFollowUp && (
																		<Flag className="size-2.5 text-amber-500 inline-block ml-0.5" />
																	)}
																</button>
															</TooltipTrigger>
															<TooltipContent side="right" className="space-y-1 z-[100] max-w-[200px]">
																<div className="font-semibold">{subjectLabel(e.subjectId)}</div>
																<div className="text-muted-foreground text-xs">{sectionLabel(e.sectionId)} • {roomLabelShort(e.roomId)}</div>
																<div className="text-muted-foreground text-xs">{DAY_SHORT[e.day] ?? e.day} {formatTime(e.startTime)}–{formatTime(e.endTime)}</div>
																{(() => {
																	const evList = violationIndex.get(e.entryId) ?? [];
																	return evList.length > 0 ? (
																		<div className="pt-1 mt-1 border-t border-border/50">
																			<span className="text-[0.625rem] font-medium text-amber-600 block mb-0.5">Constraint Warnings</span>
																			{evList.map((v: Violation, i: number) => (
																				<div key={i} className="text-[0.625rem] text-muted-foreground ml-1.5">
																					• {VIOLATION_LABELS[v.code] ?? v.code}
																				</div>
																			))}
																		</div>
																	) : null;
																})()}
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												);
											})}
										</div>
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/* ─── Entry Detail Panel ─── */

function EntryDetailPanel({
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
	onMoveTimeslot,
}: {
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
	onMoveTimeslot: () => void;
}) {
	const entryViolations = violationIndex.get(entry.entryId) ?? [];
	const grade = gradeForSection(entry.sectionId);
	const gradeBadge = grade ? GRADE_BADGE[grade] : undefined;
	const isFollowUp = followUps.has(entry.entryId);

	return (
		<>
			{/* Header */}
			<div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
				<span className="text-xs font-semibold">Entry Details</span>
				<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
					<X className="size-3.5" />
				</Button>
			</div>

			{/* Content */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="px-3 py-3 space-y-3">
					{/* Subject */}
					<DetailRow label="Subject" value={subjectLabel(entry.subjectId)} />

					{/* Section with grade badge */}
					<DetailRow label="Section">
						<div className="flex items-center gap-1.5">
							<span className="text-xs">{sectionLabel(entry.sectionId)}</span>
							{gradeBadge && (
								<Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] ${gradeBadge}`}>
									G{grade}
								</Badge>
							)}
						</div>
					</DetailRow>

					{/* Faculty */}
					<DetailRow label="Faculty" value={facultyLabel(entry.facultyId)} />

					{/* Room */}
					<DetailRow label="Room">
						<div className="flex items-center gap-1.5">
							<span className="text-xs">{roomLabel(entry.roomId)}</span>
							{isStaleRoom(entry.roomId) && (
								<Badge variant="outline" className="h-4 px-1 text-[0.5625rem] border-amber-300 bg-amber-50 text-amber-700">
									stale
								</Badge>
							)}
						</div>
					</DetailRow>

					{/* Day/Time */}
					<DetailRow
						label="Schedule"
						value={`${DAY_SHORT[entry.day] ?? entry.day} ${formatTime(entry.startTime)}–${formatTime(entry.endTime)}`}
					/>
					<DetailRow label="Duration" value={`${entry.durationMinutes} min`} />

					{/* Linked violations */}
					{entryViolations.length > 0 && (
						<div className="space-y-1.5">
							<span className="text-[0.6875rem] font-medium text-muted-foreground">
								Violations ({entryViolations.length})
							</span>
							{entryViolations.map((v, i) => (
								<div
									key={i}
									className={`rounded border px-2 py-1.5 text-[0.625rem] leading-tight ${
										v.severity === 'HARD'
											? 'border-red-300 bg-red-50 text-red-700'
											: 'border-amber-300 bg-amber-50 text-amber-700'
									}`}
								>
									<div className="font-medium">{VIOLATION_LABELS[v.code]}</div>
									<div className="mt-0.5 opacity-80">{v.message}</div>
									{/* Policy threshold vs observed delta */}
									{v.meta && (
										<div className="mt-1 pt-1 border-t border-current/10 text-[0.5625rem] space-y-0.5 opacity-90">
											{v.meta.consecutiveMinutes != null && v.meta.maxConsecutive != null && (
												<div>Observed: {String(v.meta.consecutiveMinutes)} min · Limit: {String(v.meta.maxConsecutive)} min · <span className="font-semibold">Δ +{Number(v.meta.consecutiveMinutes) - Number(v.meta.maxConsecutive)} min</span></div>
											)}
											{v.meta.dailyMinutes != null && v.meta.maxTeachingMinutesPerDay != null && (
												<div>Observed: {String(v.meta.dailyMinutes)} min · Limit: {String(v.meta.maxTeachingMinutesPerDay)} min · <span className="font-semibold">Δ +{Number(v.meta.dailyMinutes) - Number(v.meta.maxTeachingMinutesPerDay)} min</span></div>
											)}
											{v.meta.actualGapMinutes != null && v.meta.requiredBreakMinutes != null && (
												<div>Actual break: {String(v.meta.actualGapMinutes)} min · Required: {String(v.meta.requiredBreakMinutes)} min · <span className="font-semibold">Short by {Number(v.meta.requiredBreakMinutes) - Number(v.meta.actualGapMinutes)} min</span></div>
											)}
											{v.meta.totalIdleMinutes != null && v.meta.configuredThresholds != null && (
												<div>Idle: {String(v.meta.totalIdleMinutes)} min · Limit: {String((v.meta.configuredThresholds as Record<string,unknown>).maxIdleGapMinutesPerDay ?? '?')} min</div>
											)}
											{v.meta.estimatedDistanceMeters != null && (
												<div>Distance: ~{String(v.meta.estimatedDistanceMeters)}m{v.meta.configuredThresholds ? ` · Limit: ${String((v.meta.configuredThresholds as Record<string,unknown>).maxWalkingDistanceMetersPerTransition ?? '?')}m` : ''}</div>
											)}
											{v.meta.gapMinutes != null && (
												<div>Gap: {String(v.meta.gapMinutes)} min</div>
											)}
											{v.meta.buildingTransitions != null && (
												<div>Building transitions: {String(v.meta.buildingTransitions)}{v.meta.configuredThresholds ? ` · Limit: ${String((v.meta.configuredThresholds as Record<string,unknown>).maxBuildingTransitionsPerDay ?? '?')}` : ''}</div>
											)}
											{v.meta.backToBackTransitions != null && (
												<div>Back-to-back cross-building: {String(v.meta.backToBackTransitions)}{v.meta.configuredThresholds ? ` · Limit: ${String((v.meta.configuredThresholds as Record<string,unknown>).maxBackToBackTransitionsWithoutBuffer ?? '?')}` : ''}</div>
											)}
										</div>
									)}
								</div>
							))}
						</div>
					)}

					{/* Mobility impact subsection */}
					{(() => {
						const travelViolations = entryViolations.filter((v) => WELLBEING_CODES.has(v.code));
						if (travelViolations.length === 0) return null;
						return (
							<div className="space-y-1.5">
								<span className="text-[0.6875rem] font-medium text-purple-700">
									Mobility Impact
								</span>
								<div className="rounded border border-purple-200 bg-purple-50/50 px-2 py-1.5 text-[0.625rem] text-purple-800 space-y-0.5">
									<div>{travelViolations.length} travel/well-being concern{travelViolations.length !== 1 ? 's' : ''}</div>
									{travelViolations.some((v) => v.meta?.estimatedDistanceMeters != null) && (
										<div className="opacity-80">
											Max distance: ~{Math.max(...travelViolations.map((v) => Number(v.meta?.estimatedDistanceMeters ?? 0)))}m
										</div>
									)}
								</div>
							</div>
						);
					})()}

					{/* Action buttons */}
					<div className="border-t border-border pt-3 space-y-1.5">
						<span className="text-[0.6875rem] font-medium text-muted-foreground">Actions</span>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="block">
										<Button
											variant="outline"
											size="sm"
											className="w-full h-7 text-xs justify-start"
											disabled
										>
											<Users className="size-3 mr-1.5" />
											Reassign Faculty
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>Phase 4 edit API pending</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="block">
										<Button
											variant="outline"
											size="sm"
											className="w-full h-7 text-xs justify-start"
											onClick={onMoveTimeslot}
										>
											<Clock className="size-3 mr-1.5" />
											Move Timeslot
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>Click, then select a target cell in the grid</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="block">
										<Button
											variant="outline"
											size="sm"
											className="w-full h-7 text-xs justify-start"
											disabled
										>
											<CalendarClock className="size-3 mr-1.5" />
											Change Room
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>Phase 4 edit API pending</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<Button
							variant={isFollowUp ? 'default' : 'outline'}
							size="sm"
							className="w-full h-7 text-xs justify-start"
							onClick={() => onToggleFollowUp(entry.entryId)}
						>
							<Flag className={`size-3 mr-1.5 ${isFollowUp ? 'text-primary-foreground' : 'text-amber-500'}`} />
							{isFollowUp ? 'Remove Follow-up' : 'Mark for Follow-up'}
						</Button>
					</div>
				</div>
			</ScrollArea>
		</>
	);
}

/* ─── Detail Row ─── */

function DetailRow({
	label,
	value,
	children,
}: {
	label: string;
	value?: string;
	children?: React.ReactNode;
}) {
	return (
		<div className="flex justify-between items-start gap-2">
			<span className="text-[0.6875rem] text-muted-foreground shrink-0">{label}</span>
			{children ?? <span className="text-xs font-medium text-right">{value}</span>}
		</div>
	);
}

/* ─── Unassigned Reason Badge ─── */

const UNASSIGNED_REASON_LABELS: Record<string, { label: string; className: string }> = {
	NO_QUALIFIED_FACULTY: { label: 'No Qualified Faculty', className: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-800' },
	FACULTY_OVERLOADED: { label: 'Faculty Overloaded', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
	NO_AVAILABLE_SLOT: { label: 'No Available Slot', className: 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' },
	NO_COMPATIBLE_ROOM: { label: 'No Compatible Room', className: 'border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
};

function UnassignedReasonBadge({ reason }: { reason: string }) {
	const info = UNASSIGNED_REASON_LABELS[reason] ?? { label: reason, className: 'border-gray-300 bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700' };
	return (
		<Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] ${info.className}`}>
			{info.label}
		</Badge>
	);
}
