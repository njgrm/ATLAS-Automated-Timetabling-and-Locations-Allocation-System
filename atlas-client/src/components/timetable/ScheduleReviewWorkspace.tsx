import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import {
	AlertCircle,
	AlertTriangle,
	BookOpen,
	CalendarClock,
	CheckCircle2,
	Check,
	ChevronLeft,
	ChevronDown,
	ChevronRight,
	ClipboardList,
	Clock,
	DoorOpen,
	Filter,
	Flag,
	GraduationCap,
	GripVertical,
	History,
	Info,
	Lightbulb,
	Loader2,
	Lock,
	MapPin,
	PanelLeftClose,
	PanelLeftOpen,
	PanelRightClose,
	PanelRightOpen,
	Play,
	Plus,
	RefreshCw,
	Search,
	Send,
	Settings2,
	ShieldAlert,
	Trash2,
	Undo2,
	UserX,
	Users,
	Wand2,
	X,
	Crosshair,
	Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import {
	getDefaultUnassignedReasonDetail,
	getProgramBadgeLabel,
	matchesEntryKindFilter,
	matchesProgramFilter,
	type EntryKindFilter,
	type ProgramFilter,
} from '@/lib/schedule-review-helpers';
import { cn, formatTime } from '@/lib/utils';
import type {
	Building,
	CellConflictInfo,
	CommitResult,
	DraftReport,
	ExternalSection,
	FixSuggestion,
	FixSuggestionsResponse,
	FacultyOptionEnriched,
	GenerationRun,
	ManualEditProposal,
	ManualEditRecord,
	PreviewResult,
	Room,
	RoomPreferenceDecisionStatus,
	RoomPreferencePreviewResponse,
	RoomRequestAppeal,
	RoomRequestAppealStatus,
	RoomPreferenceStatus,
	RoomPreferenceSummaryResponse,
	RunSummary,
	ScheduledEntry,
	SectionSummaryResponse,
	Subject,
	FacultyMirror,
	DraftBoardState,
	DraftPlacement,
	DraftPlacementCommitResult,
	DraftQueueItem,
	PeriodSlot,
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import { Skeleton } from '@/ui/skeleton';
import { Separator } from '@/ui/separator';
import { Textarea } from '@/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/ui/resizable';

import { TutorialOverlay, useTutorial } from '@/components/TutorialOverlay';
import { ExplainabilityDrawer, VIOLATION_EXPLANATIONS } from '@/components/ExplainabilityDrawer';
import { CenterWorkspace } from '@/components/timetable/CenterWorkspace';
import { FilterChip, StatItem, ViolationGroup } from '@/components/timetable/TimetableShared';
import { TimetableToolbar } from '@/components/timetable/TimetableToolbar';
import { LeftRail } from '@/components/timetable/LeftRail';
import { LeftRailContent } from '@/components/timetable/LeftRailContent';
import { RightPanel } from '@/components/timetable/RightPanel';
import { HardBlockerDialog } from '@/components/timetable/modals/HardBlockerDialog';
import { ScheduleReviewDialogs } from '@/components/timetable/modals/ScheduleReviewDialogs';
import { SoftViolationConfirmDialog } from '@/components/timetable/modals/SoftViolationConfirmDialog';
import { useTimetableData } from '@/hooks/useTimetableData';
import { useTimetableDragDrop } from '@/hooks/useTimetableDragDrop';
import { useTimetableMutations } from '@/hooks/useTimetableMutations';
import { useIsDesktop } from '@/hooks/useTimetableState';
import {
	buildUnassignedKey,
	buildViolationIndex,
	deriveTimeSlots,
	entrySeverity,
	formatDuration,
	formatTimestamp,
	initials,
	minutesBetween,
	parseDraftPlacementId,
	scopePreviewToCandidate,
	statusColor,
} from '@/lib/timetable-utils';

/* --- Constants --- */

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
const GRADE_CARD_BG: Record<number, string> = {
	7: 'bg-green-50/60 border-green-200/80',
	8: 'bg-yellow-50/60 border-yellow-200/80',
	9: 'bg-red-50/60 border-red-200/80',
	10: 'bg-blue-50/60 border-blue-200/80',
};

type SeverityFilter = 'all' | 'hard' | 'soft' | 'conflicts' | 'wellbeing';
type ViewMode = 'section' | 'faculty' | 'room';
type CenterViewMode = 'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building';
type PreGenDragSource =
	| { type: 'draftQueue'; item: DraftQueueItem }
	| { type: 'draftPlacement'; placement: DraftPlacement };

function isDraftPlacementSource(source: PreGenDragSource): source is { type: 'draftPlacement'; placement: DraftPlacement } {
	return source.type === 'draftPlacement';
}

type DragSource =
	| { type: 'entry'; entry: ScheduledEntry }
	| { type: 'unassigned'; item: UnassignedItem }
	| PreGenDragSource
	| null;

type PreGenPendingPlacement = {
	placementId?: number;
	entryKind: 'SECTION' | 'COHORT';
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
	sourceLabel: string;
};

type PendingSwapAction = {
	source: PreGenDragSource;
	target: {
		day: string;
		startTime: string;
		endTime: string;
		facultyId: number;
		roomId: number;
	};
	displaced: DraftPlacement;
	displacementMode: 'to-queue';
	sourceLabel: string;
};

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

/* --- Tutorial step definitions --- */

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

const PROGRAM_FILTER_OPTIONS: Array<{ value: ProgramFilter; label: string }> = [
	{ value: 'all', label: 'All Programs' },
	{ value: 'REGULAR', label: 'Regular' },
	{ value: 'SPECIAL', label: 'Any Special Program' },
	{ value: 'STE', label: 'STE' },
	{ value: 'SPA', label: 'SPA' },
	{ value: 'SPS', label: 'SPS' },
	{ value: 'SPJ', label: 'SPJ' },
	{ value: 'SPFL', label: 'SPFL' },
	{ value: 'SPTVE', label: 'SPTVE' },
	{ value: 'OTHER', label: 'Other' },
];

const ENTRY_KIND_FILTER_OPTIONS: Array<{ value: EntryKindFilter; label: string }> = [
	{ value: 'all', label: 'All Entries' },
	{ value: 'section', label: 'Section Entries' },
	{ value: 'cohort', label: 'Cohort Entries' },
];

/* --- Main Component --- */

export default function ScheduleReviewWorkspace() {
	/* -- Data state -- */
	const [schoolYearId, setSchoolYearId] = useState<number | null>(null);
	const [runs, setRuns] = useState<GenerationRun[]>([]);
	const [selectedRunId, setSelectedRunId] = useState<string>('latest');
	const [draft, setDraft] = useState<DraftReport | null>(null);
	const [violationReport, setViolationReport] = useState<ViolationReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	/* -- Reference data lookups -- */
	const [subjectMap, setSubjectMap] = useState<Map<number, Subject>>(new Map());
	const [facultyMap, setFacultyMap] = useState<Map<number, FacultyMirror>>(new Map());
	const [sectionMap, setSectionMap] = useState<Map<number, ExternalSection>>(new Map());
	const [sectionSummary, setSectionSummary] = useState<SectionSummaryResponse | null>(null);

	/* -- Filter / selection state -- */
	const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
	const [violationSearch, setViolationSearch] = useState('');
	const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
	const [selectedEntry, setSelectedEntry] = useState<ScheduledEntry | null>(null);
	const [followUps, setFollowUps] = useState<Set<string>>(new Set());
	const [entityFilter, setEntityFilter] = useState<string>('');
	const [viewMode, setViewMode] = useState<ViewMode>('section');
	const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');
	const [entryKindFilter, setEntryKindFilter] = useState<EntryKindFilter>('all');
	const [leftTab, setLeftTab] = useState<'violations' | 'unassigned' | 'locks' | 'requests'>('violations');
	const [draftBoard, setDraftBoard] = useState<DraftBoardState | null>(null);
	const [draftBoardSummary, setDraftBoardSummary] = useState<DraftBoardState['counts'] | null>(null);
	const [showResetDraftDialog, setShowResetDraftDialog] = useState(false);
	const [showLeavePreGenDialog, setShowLeavePreGenDialog] = useState(false);
	const [pendingCenterSwitch, setPendingCenterSwitch] = useState<(() => void) | null>(null);

	const [requestStatusFilter, setRequestStatusFilter] = useState<'ALL' | RoomPreferenceStatus>('SUBMITTED');
	const [requestDecisionFilter, setRequestDecisionFilter] = useState<'ALL' | RoomPreferenceDecisionStatus>('PENDING');
	const [requestSearch, setRequestSearch] = useState('');
	const [roomRequestSummary, setRoomRequestSummary] = useState<RoomPreferenceSummaryResponse | null>(null);
	const [roomRequestLoading, setRoomRequestLoading] = useState(false);
	const [roomRequestError, setRoomRequestError] = useState<string | null>(null);
	const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
	const [requestPreview, setRequestPreview] = useState<RoomPreferencePreviewResponse | null>(null);
	const [requestPreviewLoading, setRequestPreviewLoading] = useState(false);
	const [requestReviewSaving, setRequestReviewSaving] = useState(false);
	const [requestReviewerNotes, setRequestReviewerNotes] = useState('');
	const [newDraftLoading, setNewDraftLoading] = useState(false);
	const userRole = localStorage.getItem('userRole'); // Get role from session/auth context
	const isPrivilegedUser = userRole != null && ['admin', 'officer', 'SYSTEM_ADMIN'].includes(userRole);
	const isDesktop = useIsDesktop();

	/* -- Generate / Publish workflow state -- */
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

	/* -- Room reference data -- */
	const [roomMap, setRoomMap] = useState<Map<number, RoomInfo>>(new Map());
	const [buildings, setBuildings] = useState<Building[]>([]);
	const [mapBuildingId, setMapBuildingId] = useState<number | null>(null);
	const [mapRoomId, setMapRoomId] = useState<number | null>(null);
	const [requestAppeals, setRequestAppeals] = useState<RoomRequestAppeal[]>([]);
	const [appealsLoading, setAppealsLoading] = useState(false);
	const [appealReason, setAppealReason] = useState('');
	const [appealSubmitting, setAppealSubmitting] = useState(false);

	/* -- Layout state -- */
	const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
	const [isRightCollapsed, setIsRightCollapsed] = useState(true);
	const [centerView, setCenterView] = useState<CenterViewMode>('schedule');
	// Panel refs for imperative collapse/expand
	const leftPanelRef = useRef<ImperativePanelHandle>(null);
	const rightPanelRef = useRef<ImperativePanelHandle>(null);
	// Snapshot of panel state before entering a swap view so we can restore on exit
	const panelSnapshot = useRef<{ left: boolean; right: boolean } | null>(null);
	// Which action the officer triggered from the right panel
	const [pendingAction, setPendingAction] = useState<'CHANGE_TIMESLOT' | 'CHANGE_ROOM' | 'CHANGE_FACULTY' | null>(null);

	/* -- Manual edit / DnD state -- */
	const [dragItem, setDragItem] = useState<DragSource>(null);
	const [blockerModalData, setBlockerModalData] = useState<import('@/types').HumanConflict[] | null>(null);
	const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
	const [softConfirmWarnings, setSoftConfirmWarnings] = useState<Violation[]>([]);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [showSoftConfirm, setShowSoftConfirm] = useState(false);
	const [pendingCommitProposal, setPendingCommitProposal] = useState<ManualEditProposal | null>(null);
	const [editHistory, setEditHistory] = useState<ManualEditRecord[]>([]);
	const [showEditHistory, setShowEditHistory] = useState(false);
	const [commitLoading, setCommitLoading] = useState(false);
	const [revertLoading, setRevertLoading] = useState(false);
	/** Keyboard-accessible DnD: selected source for placement */
	const [kbSelectedSource, setKbSelectedSource] = useState<DragSource>(null);
	const [preGenKbSource, setPreGenKbSource] = useState<PreGenDragSource | null>(null);
	const [preGenPending, setPreGenPending] = useState<PreGenPendingPlacement | null>(null);
	const [preGenPreview, setPreGenPreview] = useState<PreviewResult | null>(null);
	const [preGenPreviewLoading, setPreGenPreviewLoading] = useState(false);
	const [preGenSaving, setPreGenSaving] = useState(false);
	const [preGenAllowSoftOverride, setPreGenAllowSoftOverride] = useState(false);
	const [preGenPreviewError, setPreGenPreviewError] = useState<string | null>(null);

	/** Wave 4.5: map-first onboarding banner active state */
	const [preGenOnboarding, setPreGenOnboarding] = useState(false);
	/** Wave 4.5c Pass 3 F: tracks whether map/building was entered from pre-gen context */
	const [preGenMapContext, setPreGenMapContext] = useState(false);

	/** Wave 4.5: mandatory faculty + room confirm sheet */
	const [showPreGenConfirm, setShowPreGenConfirm] = useState(false);
	const [preGenConfirmCtx, setPreGenConfirmCtx] = useState<{
		source: PreGenDragSource;
		day: string;
		startTime: string;
		endTime: string;
	} | null>(null);
	const [confirmFacultyId, setConfirmFacultyId] = useState<string>('');
	const [confirmRoomId, setConfirmRoomId] = useState<string>('');
	const [confirmPreviewLoading, setConfirmPreviewLoading] = useState(false);
	const [confirmPreview, setConfirmPreview] = useState<PreviewResult | null>(null);
	const [confirmRawPreview, setConfirmRawPreview] = useState<PreviewResult | null>(null);
	const [confirmPreviewError, setConfirmPreviewError] = useState<string | null>(null);
	const [confirmAllowSoftOverride, setConfirmAllowSoftOverride] = useState(false);
	const [confirmAllowDailyOverride, setConfirmAllowDailyOverride] = useState(false);
	const [confirmSaving, setConfirmSaving] = useState(false);
	const [showSwapConfirm, setShowSwapConfirm] = useState(false);
	const [swapAction, setSwapAction] = useState<PendingSwapAction | null>(null);
	const [swapSaving, setSwapSaving] = useState(false);
	const [regularSwapPending, setRegularSwapPending] = useState<{ entryA: ScheduledEntry; entryB: ScheduledEntry } | null>(null);
	const [regularSwapSaving, setRegularSwapSaving] = useState(false);
	/** Wave 4.5c C: ID of a placement being deleted (unassign) */
	const [deletingPlacementId, setDeletingPlacementId] = useState<number | null>(null);
	/** Wave 4.5c Pass 3 E: Unassign confirmation dialog state */
	const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
	const [pendingUnassignId, setPendingUnassignId] = useState<number | null>(null);
	const [unassignDropActive, setUnassignDropActive] = useState(false);

	/** Wave 4.5: Pins panel search + grade filter */
	const [pinsSearch, setPinsSearch] = useState('');
	const [pinsGradeFilter, setPinsGradeFilter] = useState<number | 'all'>('all');
	/** Wave 4.5b: additional Pins panel filters */
	const [pinsSubjectFilter, setPinsSubjectFilter] = useState<number | 'all'>('all');
	const [pinsSectionFilter, setPinsSectionFilter] = useState<number | 'all'>('all');
	const [pinsQueuePage, setPinsQueuePage] = useState(30);
	const [violationsGroupPage, setViolationsGroupPage] = useState(10);
	/** Ref for auto-preview debounce in PreGenConfirmSheet */
	const autoPreviewRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	/** Assignment picker modal for unassigned placements */
	const [showAssignmentPicker, setShowAssignmentPicker] = useState(false);
	const [assignPickerTarget, setAssignPickerTarget] = useState<{ day: string; startTime: string; endTime: string; item: UnassignedItem } | null>(null);
	const [assignPickerFacultyId, setAssignPickerFacultyId] = useState<string>('');
	const [assignPickerRoomId, setAssignPickerRoomId] = useState<string>('');

	/* -- Tutorial + Explainability -- */
	const tutorial = useTutorial('atlas_timetable_tour');
	const [drawerViolation, setDrawerViolation] = useState<Violation | null>(null);
	const [drawerUnassigned, setDrawerUnassigned] = useState<UnassignedItem | null>(null);
	const showExplainDrawer = !!drawerViolation || !!drawerUnassigned;
	const [fixLoading, setFixLoading] = useState<string | null>(null);

	/* -- Unassigned triage state -- */
	const [expandedUnassigned, setExpandedUnassigned] = useState<Set<string>>(new Set());
	const [unassignedFixSuggestions, setUnassignedFixSuggestions] = useState<Record<string, UnassignedExplanation | null>>({});
	const [unassignedReasonFilter, setUnassignedReasonFilter] = useState<UnassignedReason | 'all'>('all');

	useEffect(() => {
		rightPanelRef.current?.collapse();
	}, []);

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
		setCenterView('schedule');
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
		setCenterView('schedule');
	}, []);

	const switchCenterViewWithGuard = useCallback((action: () => void) => {
		const hasUnsavedPreGen = centerView === 'pre-generation' && (preGenPending != null || (draftBoard?.counts.draft ?? 0) > 0);
		if (hasUnsavedPreGen) {
			setPendingCenterSwitch(() => action);
			setShowLeavePreGenDialog(true);
			return;
		}
		action();
	}, [centerView, draftBoard?.counts.draft, preGenPending]);


	const {
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
	} = useTimetableData({
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
	});

	const {
		filteredRoomRequests,
		focusRequestInGrid,
		openRequestPreview,
		submitAppeal,
		updateAppealStatus,
		reviewRoomRequest,
		requestPreviewConflicts,
		requestPreviewHardConflicts,
		requestPreviewSoftWarnings,
		handleViolationSelect,
		handleEntryClick,
		toggleFollowUp,
		triggerGeneration,
		handleTriggerGenerate,
		confirmGenerate,
		openPreGenerationWorkspace,
		handleStartNewPreGenerationDraft,
		handlePublishConfirm,
		runIdNumeric,
		runVersion,
		apiBase,
		fetchEditHistory,
		previewEdit,
		commitEdit,
		revertLastEdit,
		choosePreGenFaculty,
		choosePreGenRoom,
		buildPreGenPendingPlacement,
		openSwapPrompt,
		runPreGenPreview,
		stagePreGenDrop,
		runConfirmPreview,
		commitConfirmPlacement,
		executeSwapAction,
		executeRegularSwap,
		unassignDraftPlacement,
		getDraggedDraftPlacementId,
		commitPreGenPending,
	} = useTimetableMutations({
		schoolYearId,
		roomRequestSummary,
		requestStatusFilter,
		requestDecisionFilter,
		requestSearch,
		setViewMode,
		setEntityFilter,
		draft,
		setSelectedEntry,
		rightPanelRef,
		openRoomGridWorkspace,
		setSelectedRequestId,
		setRequestPreviewLoading,
		setRequestPreview,
		setRequestReviewerNotes,
		setAppealsLoading,
		setRequestAppeals,
		loadRoomRequestSummary,
		requestPreview,
		appealReason,
		setAppealSubmitting,
		setAppealReason,
		setRequestReviewSaving,
		requestReviewerNotes,
		setKbSelectedSource,
		setPreGenKbSource,
		setSelectedViolation,
		setFollowUps,
		setGenerating,
		setShowGenerateConfirm,
		draftBoardSummary,
		fetchDraftBoardSummary,
		loadAll,
		setNewDraftLoading,
		setDraftBoard,
		setDraftBoardSummary,
		setLeftTab,
		setCenterView,
		setPreGenOnboarding,
		setPreGenPending,
		setPreGenPreview,
		setPreGenPreviewLoading,
		setPreGenPreviewError,
		setPreGenAllowSoftOverride,
		preGenPending,
		preGenAllowSoftOverride,
		setPreGenSaving,
		setShowResetDraftDialog,
		draftBoard,
		setShowPublishDialog,
		setSwapAction,
		setShowSwapConfirm,
		setSwapSaving,
		swapAction,
		setRegularSwapSaving,
		setRegularSwapPending,
		regularSwapPending,
		setDeletingPlacementId,
		setBlockerModalData,
		setShowPreGenConfirm,
		preGenConfirmCtx,
		setPreGenConfirmCtx,
		confirmFacultyId,
		setConfirmFacultyId,
		confirmRoomId,
		setConfirmRoomId,
		setConfirmPreviewLoading,
		setConfirmPreview,
		setConfirmRawPreview,
		setConfirmPreviewError,
		setConfirmAllowSoftOverride,
		setConfirmAllowDailyOverride,
		setConfirmSaving,
		autoPreviewRef,
		setEditHistory,
		setDraft,
		setPreviewLoading,
		setPreviewResult,
		setCommitLoading,
		setSoftConfirmWarnings,
		setShowSoftConfirm,
		setPendingCommitProposal,
		setDragItem,
		setRevertLoading,
		setViolationReport,
		viewMode,
		entityFilter,
		facultyMap,
		roomMap,
	});

	const handleRunChange = useCallback(async (runId: string) => {
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
	}, [schoolYearId, fetchRunData]);

	/** Handle drop of item onto a timetable cell */
	const handleCellDrop = useCallback(
		async (day: string, startTime: string, endTime: string) => {
			if (!dragItem) return;
			if (dragItem.type === 'draftQueue' || dragItem.type === 'draftPlacement') {
				await stagePreGenDrop(dragItem, day, startTime, endTime);
				setDragItem(null);
				return;
			}

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
			if (dragItem.type === 'entry' && centerView === 'pre-generation') {
				const placementId = parseDraftPlacementId(dragItem.entry.entryId);
				if (placementId != null) {
					const placement = draftBoard?.placements.find((candidate) => candidate.id === placementId);
					if (placement) {
						await stagePreGenDrop({ type: 'draftPlacement', placement }, day, startTime, endTime, { suppressConfirm: true });
						setDragItem(null);
						return;
					}
				}
			}
			const entry = dragItem.entry;
			// Detect if target slot is occupied � scope to same pivot entity for current viewMode
			const targetKey = `${day}-${startTime}`;
			const pivotId = viewMode === 'section' ? entry.sectionId : viewMode === 'faculty' ? entry.facultyId : entry.roomId;
			const cellOccupants = (gridIndex.get(targetKey) ?? []).filter((occ) => {
				if (occ.entryId === entry.entryId) return false;
				if (viewMode === 'section') return occ.sectionId === pivotId;
				if (viewMode === 'faculty') return occ.facultyId === pivotId;
				return occ.roomId === pivotId;
			});
			if (cellOccupants.length > 0) {
				setRegularSwapPending({ entryA: entry, entryB: cellOccupants[0] });
				setDragItem(null);
				return;
			}
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
			const scopedPreview = scopePreviewToCandidate(preview, { day, startTime, endTime });

			if (!scopedPreview.allowed) {
				setBlockerModalData(scopedPreview.humanConflicts.filter((hc) => hc.severity === 'HARD'));
				setDragItem(null);
				return;
			}

			// Soft violations are informational only � proceed without blocking
			await commitEdit(proposal, scopedPreview.softViolations.length > 0);
		},
		[dragItem, entityFilter, viewMode, previewEdit, commitEdit, stagePreGenDrop, centerView, draftBoard?.placements, gridIndex],
	);

	/** Keyboard-accessible placement confirm */
	const handleKbPlace = useCallback(
		async (day: string, startTime: string, endTime: string) => {
			if (!kbSelectedSource) return;
			const fakeItem = kbSelectedSource;
			setKbSelectedSource(null);

			if (fakeItem.type === 'draftQueue' || fakeItem.type === 'draftPlacement') {
				setPreGenKbSource(null);
				await stagePreGenDrop(fakeItem, day, startTime, endTime);
				return;
			}

			// Fix 1: draft placement entry KB-placed in pre-gen mode ? route to pre-gen commit path
			if (fakeItem.type === 'entry' && centerView === 'pre-generation' && fakeItem.entry.entryId.startsWith('draft-placement-')) {
				const pid = Number(fakeItem.entry.entryId.replace('draft-placement-', ''));
				const placement = draftBoard?.placements.find((p) => p.id === pid);
				if (placement) {
					setPreGenKbSource(null);
					await stagePreGenDrop({ type: 'draftPlacement', placement }, day, startTime, endTime, { suppressConfirm: true });
					return;
				}
			}

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

			// Detect occupied slot ? scope to same pivot entity for current viewMode
			if (fakeItem.type === 'entry') {
				const targetKey = `${day}-${startTime}`;
				const kbPivotId = viewMode === 'section' ? fakeItem.entry.sectionId : viewMode === 'faculty' ? fakeItem.entry.facultyId : fakeItem.entry.roomId;
				const kbOccupants = (gridIndex.get(targetKey) ?? []).filter((occ) => {
					if (occ.entryId === fakeItem.entry.entryId) return false;
					if (viewMode === 'section') return occ.sectionId === kbPivotId;
					if (viewMode === 'faculty') return occ.facultyId === kbPivotId;
					return occ.roomId === kbPivotId;
				});
				if (kbOccupants.length > 0) {
					setRegularSwapPending({ entryA: fakeItem.entry, entryB: kbOccupants[0] });
					return;
				}
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
			const scopedPreview = scopePreviewToCandidate(preview, { day, startTime, endTime });
			if (!scopedPreview.allowed) {
				setBlockerModalData(scopedPreview.humanConflicts.filter((hc) => hc.severity === 'HARD'));
				setDragItem(null);
				return;
			}
			// Soft violations are informational only � proceed without blocking
			await commitEdit(proposal, scopedPreview.softViolations.length > 0);
		},
		[kbSelectedSource, entityFilter, viewMode, previewEdit, commitEdit, stagePreGenDrop, centerView, draftBoard?.placements, gridIndex],
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
		const scopedPreview = scopePreviewToCandidate(preview, { day, startTime, endTime });
		if (!scopedPreview.allowed) {
			setBlockerModalData(scopedPreview.humanConflicts.filter((hc) => hc.severity === 'HARD'));
			setDragItem(null);
			return;
		}
		// Soft violations are informational only � proceed without blocking
		await commitEdit(proposal, scopedPreview.softViolations.length > 0);
	}, [assignPickerTarget, assignPickerFacultyId, assignPickerRoomId, previewEdit, commitEdit]);

	/** Load edit history on mount / run change */
	useEffect(() => {
		fetchEditHistory();
	}, [fetchEditHistory]);

	/* -- Lookup helpers -- */


	const resolveEntryProgramType = useCallback(
		(entry: ScheduledEntry | UnassignedItem): string | null => {
			return entry.programType ?? sectionMap.get(entry.sectionId)?.programType ?? null;
		},
		[sectionMap],
	);

	const resolveEntryProgramCode = useCallback(
		(entry: ScheduledEntry | UnassignedItem): string | null => {
			return entry.programCode ?? sectionMap.get(entry.sectionId)?.programCode ?? null;
		},
		[sectionMap],
	);

	const entryContextLabel = useCallback(
		(entry: ScheduledEntry | UnassignedItem): string => {
			if (entry.entryKind === 'COHORT' && entry.cohortCode) {
				const memberCount = entry.cohortMemberSectionIds?.length ?? 0;
				return `${entry.cohortCode}${memberCount > 0 ? ` � ${memberCount} section${memberCount === 1 ? '' : 's'}` : ''}`;
			}
			const adviser = entry.adviserName ?? sectionMap.get(entry.sectionId)?.adviserName;
			return adviser ? `${sectionLabel(entry.sectionId)} � Adviser ${adviser}` : sectionLabel(entry.sectionId);
		},
		[sectionLabel, sectionMap],
	);

	/** Human-readable room label and compact variants are provided by useTimetableData. */

	const formatConstraintMessage = useCallback(
		(message: string): string => {
			const roomFormatted = message.replace(/\broom\s+#?(\d+)\b/gi, (_match, rawId: string) => {
				const id = Number(rawId);
				if (!Number.isFinite(id)) return _match;
				const room = roomMap.get(id);
				return room ? roomLabelShort(id) : _match;
			});

			const facultyFormatted = roomFormatted.replace(/\bfaculty\s+#?(\d+)\b/gi, (_match, rawId: string) => {
				const id = Number(rawId);
				if (!Number.isFinite(id)) return _match;
				const faculty = facultyMap.get(id);
				return faculty ? `${faculty.lastName}, ${faculty.firstName}` : _match;
			});

			return facultyFormatted.replace(/\bsection\s+#?(\d+)\b/gi, (_match, rawId: string) => {
				const id = Number(rawId);
				if (!Number.isFinite(id)) return _match;
				const section = sectionMap.get(id);
				return section ? section.name : _match;
			});
		},
		[facultyMap, roomLabelShort, roomMap, sectionMap],
	);

	/** isStaleRoom and pivotLabel are provided by useTimetableData. */

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

	/** Hierarchical grouping for entity filter dropdown: Building?Room, Grade?Section, Department?Faculty */
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
			// Group sections by grade level and program bucket
			const byGrade = new Map<string, number[]>();
			for (const id of pivotEntityIds) {
				const grade = gradeForSection(id);
				const section = sectionMap.get(id);
				const programLabel = section?.programType && section.programType !== 'REGULAR'
					? getProgramBadgeLabel(section.programType, section.programCode)
					: 'Regular';
				const key = grade ? `G${grade} � ${programLabel}` : programLabel;
				const list = byGrade.get(key) ?? [];
				list.push(id);
				byGrade.set(key, list);
			}
			for (const [grade, ids] of Array.from(byGrade.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
				groups.push({ label: grade, ids });
			}
		} else {
			// Faculty � group by department if available, else flat
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
	}, [viewMode, pivotEntityIds, roomMap, gradeForSection, facultyMap, sectionMap]);

	const confirmDisplacedPlacement = useMemo(() => {
		if (!preGenConfirmCtx) return null;
		const source = preGenConfirmCtx.source;
		const atTarget = (draftBoard?.placements ?? []).filter((placement) =>
			placement.status === 'DRAFT'
			&& placement.day === preGenConfirmCtx.day
			&& placement.startTime === preGenConfirmCtx.startTime
			&& placement.endTime === preGenConfirmCtx.endTime,
		);
		if (isDraftPlacementSource(source)) {
			return atTarget.find((placement) => placement.id !== source.placement.id) ?? null;
		}
		return atTarget[0] ?? null;
	}, [draftBoard?.placements, preGenConfirmCtx]);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
	const { dropTarget, setDropTarget } = useTimetableDragDrop();

	const handleGlobalDragStart = useCallback((event: DragStartEvent) => {
		const data = event.active.data.current as
			| { type?: string; entry?: ScheduledEntry; item?: UnassignedItem | DraftQueueItem; placement?: DraftPlacement }
			| undefined;
		if (!data?.type) return;

		if (data.type === 'entry' && data.entry) {
			setDragItem({ type: 'entry', entry: data.entry });
			return;
		}
		if (data.type === 'unassigned' && data.item) {
			setDragItem({ type: 'unassigned', item: data.item as UnassignedItem });
			return;
		}
		if (data.type === 'draftQueue' && data.item) {
			setDragItem({ type: 'draftQueue', item: data.item as DraftQueueItem });
			return;
		}
		if (data.type === 'draftPlacement' && data.placement) {
			setDragItem({ type: 'draftPlacement', placement: data.placement });
		}
	}, []);

	const handleGlobalDragOver = useCallback((event: DragOverEvent) => {
		const key = event.over?.id ? String(event.over.id) : null;
		setDropTarget(key);
	}, [setDropTarget]);

	const handleGlobalDragEnd = useCallback((event: DragEndEvent) => {
		const overData = event.over?.data.current as { day?: string; startTime?: string; endTime?: string } | undefined;
		setUnassignDropActive(false);
		setDropTarget(null);

		if (overData?.day && overData.startTime && overData.endTime) {
			handleCellDrop(overData.day, overData.startTime, overData.endTime);
		}
		setDragItem(null);
	}, [handleCellDrop, setDropTarget]);

	/* -- Render -- */

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

	const hardCount = violations.filter((v) => v.severity === 'HARD').length;
	const softCount = violations.filter((v) => v.severity === 'SOFT').length;
	const selectedMapBuilding = buildings.find((b) => b.id === mapBuildingId) ?? null;
	const selectedMapBuildingFloors = selectedMapBuilding ? Array.from({ length: selectedMapBuilding.floorCount }, (_, i) => selectedMapBuilding.floorCount - i) : [];
	const contractWarnings = Array.from(new Set([...(summary?.contractWarnings ?? []), ...(sectionSummary?.contractWarnings ?? [])]));

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)]">
			<DndContext
				sensors={sensors}
				onDragStart={handleGlobalDragStart}
				onDragOver={handleGlobalDragOver}
				onDragEnd={handleGlobalDragEnd}
			>
			{/* -- Header: Controls + Inline Stat Banner -- */}
			<div className="shrink-0 border-b border-border bg-background">
				{/* Row 1: Run Management */}
				<div className="flex items-center gap-2 px-4 pt-3 pb-1.5 flex-wrap">
					<Badge
						variant={isPreGenerationWorkspace ? 'secondary' : 'default'}
						className={cn('h-7 px-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase', isPreGenerationWorkspace ? 'border border-border bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground')}
					>
						{isPreGenerationWorkspace ? 'Pre-Generation Draft' : `Generated Run #${activeGeneratedRunId ?? '-'}`}
					</Badge>

					{/* Run selector */}
					<div data-tutorial="run-selector">
					<Select value={selectedRunId} onValueChange={handleRunChange} disabled={runs.length === 0 || centerView === 'pre-generation'}>
						<SelectTrigger className="h-8 w-44 text-xs">
							<SelectValue placeholder={runs.length === 0 ? 'No generated run yet' : 'Select run'} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="latest" disabled={runs.length === 0}>Latest Run</SelectItem>
							{runs.map((r) => (
								<SelectItem key={r.id} value={String(r.id)}>
									Run #{r.id} � {formatTimestamp(r.createdAt)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					</div>

					<Button
						variant="outline"
						size="sm"
						className="h-8 gap-1.5"
						disabled={newDraftLoading || !schoolYearId}
						onClick={handleStartNewPreGenerationDraft}
					>
						{newDraftLoading ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarClock className="size-3.5" />}
						New Pre-Generation Draft
					</Button>

					{/* Wave 4.5b: Continue pre-gen draft � visible when draft has work and user is not already in pre-gen */}
					{(draftBoard?.counts.draft ?? 0) > 0 && !isPreGenerationWorkspace && (
						<Button
							variant="secondary"
							size="sm"
							className="h-8 gap-1.5 border border-primary/30"
							onClick={() => void openPreGenerationWorkspace(false)}
						>
							<CalendarClock className="size-3.5" />
							Continue Draft
						</Button>
					)}

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
									{generating ? 'Generating�' : 'Generate'}
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
									disabled={!draft || hardCount > 0 || centerView === 'pre-generation'}
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

					{/* Scheduling Policy � inline center-pane toggle */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									data-tutorial="policy-btn"
									variant={centerView === 'policy' ? 'default' : 'outline'}
									size="sm"
									className="h-8 gap-1.5"
									disabled={!schoolYearId}
									onClick={() => centerView === 'policy' ? exitPolicyView() : switchCenterViewWithGuard(enterPolicyView)}
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
									variant={centerView === 'map' || centerView === 'building' ? 'default' : 'outline'}
									size="sm"
									className="h-8 gap-1.5"
									disabled={!schoolYearId}
									onClick={() => { void openMapWorkspace(); }}
								>
									<Crosshair className="size-3.5" />
									{centerView === 'map' || centerView === 'building' ? 'Map Workspace' : 'Map View'}
								</Button>
							</TooltipTrigger>
							<TooltipContent>Navigate buildings and rooms without leaving the editable grid</TooltipContent>
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
								{draft?.status ?? '�'}
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
							{summary.cohortizedClassCount && summary.cohortizedClassCount > 0 && (
								<StatItem
									icon={Users}
									label="Cohorts"
									value={String(summary.cohortizedClassCount)}
									explanation="Scheduled entries that were generated as cohort-aware inter-section classes."
								/>
							)}
							<StatItem
								icon={Clock}
								label="Duration"
								value={formatDuration(draft ? runs.find((r) => String(r.id) === selectedRunId || (selectedRunId === 'latest' && r.id === runs[0]?.id))?.durationMs ?? null : null)}
								explanation="Real-world computing time it took to generate this draft."
							/>
						</div>
					)}
				</div>

				{contractWarnings.length > 0 && (
					<div className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
						<AlertTriangle className="size-3.5 shrink-0" />
						<span className="font-semibold">Contract warnings</span>
						<span className="text-amber-800/80">{contractWarnings.join(' ')}</span>
					</div>
				)}

				{/* Row 2: Grid Controls */}
				<TimetableToolbar
					viewMode={viewMode}
					viewModeLabels={VIEW_MODE_LABELS}
					onViewModeChange={(value) => {
						setViewMode(value as ViewMode);
						setEntityFilter('');
						setSelectedEntry(null);
						setSelectedViolation(null);
						setPreGenKbSource(null);
						setKbSelectedSource(null);
					}}
					entityFilter={entityFilter}
					onEntityFilterChange={(value) => {
						setEntityFilter(value);
						setSelectedEntry(null);
						setSelectedViolation(null);
						setPreGenKbSource(null);
						setKbSelectedSource(null);
					}}
					groupedPivotEntities={groupedPivotEntities}
					pivotLabel={pivotLabel}
					programFilter={programFilter}
					onProgramFilterChange={(value) => setProgramFilter(value as ProgramFilter)}
					programFilterOptions={PROGRAM_FILTER_OPTIONS}
					entryKindFilter={entryKindFilter}
					onEntryKindFilterChange={(value) => setEntryKindFilter(value as EntryKindFilter)}
					entryKindFilterOptions={ENTRY_KIND_FILTER_OPTIONS}
				>
					<div className="h-4 w-px bg-border mx-0.5" />
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
				</TimetableToolbar>
			</div>

			{/* -- Body: Resizable Panels -- */}
			<ResizablePanelGroup direction="horizontal" className="flex flex-1 min-h-0">
				{/* LEFT: Violations + Unassigned Tabs */}
				<LeftRail
					panelRef={leftPanelRef as any}
					onCollapseChange={setIsLeftCollapsed}
					isCollapsed={isLeftCollapsed}
					isPreGenerationWorkspace={isPreGenerationWorkspace}
					leftTab={leftTab}
					setLeftTab={setLeftTab}
					violationsCount={violations.length}
					unassignedCount={summary?.unassignedCount ?? 0}
					pendingRequestCount={roomRequestSummary?.counts.pending ?? 0}
				>

					<LeftRailContent
context={{
leftTab,
isPreGenerationWorkspace,
hardViolationCount,
topBlockers,
violations,
handleViolationSelect,
setSeverityFilter,
VIOLATION_LABELS,
violationSearch,
setViolationSearch,
filteredViolations,
violationsByCode,
selectedViolation,
setDrawerViolation,
formatConstraintMessage,
draftBoard,
isDesktop,
setDragItem,
toast,
summary,
filteredUnassignedItems,
programKindFilteredUnassignedItems,
UNASSIGNED_REASON_LABELS,
unassignedReasonFilter,
setUnassignedReasonFilter,
resolveEntryProgramType,
resolveEntryProgramCode,
sectionLabel,
subjectLabel,
kbSelectedSource,
buildUnassignedKey,
followUps,
expandedUnassigned,
setExpandedUnassigned,
unassignedFixSuggestions,
fixLoading,
schoolYearId,
runs,
selectedRunId,
defaultSchoolId: DEFAULT_SCHOOL_ID,
setFixLoading,
setUnassignedFixSuggestions,
entryContextLabel,
previewEdit,
setDrawerUnassigned,
setFollowUps,
showSoftConfirm,
setUnassignDropActive,
fetchDraftBoardSummary,
preGenPending,
pinsSearch,
setPinsSearch,
pinsGradeFilter,
setPinsGradeFilter,
pinsSectionFilter,
setPinsSectionFilter,
pinsSubjectFilter,
setPinsSubjectFilter,
getDraggedDraftPlacementId,
dragItem,
setPendingUnassignId,
setShowUnassignConfirm,
pinsQueuePage,
setPinsQueuePage,
preGenKbSource,
setPreGenKbSource,
setKbSelectedSource,
rightPanelRef,
setSelectedEntry,
setSelectedViolation,
preGenEntries,
gradeForSection,
formatTime,
DAY_SHORT,
formatFacultyInitials,
roomLabelShort,
GRADE_BADGE,
GRADE_CARD_BG,
roomRequestSummary,
requestSearch,
setRequestSearch,
requestStatusFilter,
setRequestStatusFilter,
requestDecisionFilter,
setRequestDecisionFilter,
roomRequestError,
roomRequestLoading,
filteredRoomRequests,
selectedRequestId,
focusRequestInGrid,
openRequestPreview,
isPrivilegedUser,
}}
/>
				</LeftRail>

				<ResizableHandle withHandle />

				{/* CENTER: Timetable Grid or Policy Pane */}
<CenterWorkspace
centerView={centerView}
selectedEntry={selectedEntry}
violationIndex={violationIndex}
followUps={followUps}
toggleFollowUp={toggleFollowUp}
exitPolicyView={exitPolicyView}
handleRefresh={handleRefresh}
defaultSchoolId={DEFAULT_SCHOOL_ID}
schoolYearId={schoolYearId}
pendingAction={pendingAction}
roomMap={roomMap}
facultyMap={facultyMap}
draftEntries={draft?.entries ?? []}
previewEdit={previewEdit}
commitEdit={commitEdit}
previewLoading={previewLoading}
commitLoading={commitLoading}
subjectLabel={subjectLabel}
facultyLabel={facultyLabel}
sectionLabel={sectionLabel}
gradeForSection={gradeForSection}
roomLabel={roomLabel}
isStaleRoom={isStaleRoom}
timeSlots={timeSlots}
preGenOnboarding={preGenOnboarding}
setCenterView={setCenterView}
buildings={buildings}
mapBuildingId={mapBuildingId}
setMapBuildingId={setMapBuildingId}
openBuildingWorkspace={openBuildingWorkspace}
selectedMapBuilding={selectedMapBuilding}
selectedMapBuildingFloors={selectedMapBuildingFloors}
mapRoomId={mapRoomId}
openRoomGridWorkspace={openRoomGridWorkspace}
draftBoard={draftBoard}
draft={draft}
runs={runs}
entityFilter={entityFilter}
pivotLabel={pivotLabel}
viewMode={viewMode}
setPreGenOnboarding={setPreGenOnboarding}
gridEntries={gridEntries}
highlightedEntryIds={highlightedEntryIds}
handleEntryClick={handleEntryClick}
entryContextLabel={entryContextLabel}
formatFacultyInitials={formatFacultyInitials}
roomLabelShort={roomLabelShort}
dragItem={dragItem}
kbSelectedSource={kbSelectedSource}
handleKbPlace={handleKbPlace}
cellConflictMap={cellConflictMap}
navToFaculty={navToFaculty}
navToSection={navToSection}
navToRoom={navToRoom}
dropTarget={dropTarget}
setDropTarget={setDropTarget}
preGenPending={preGenPending}
preGenPreviewLoading={preGenPreviewLoading}
preGenPreviewError={preGenPreviewError}
preGenPreview={preGenPreview}
commitPreGenPending={commitPreGenPending}
preGenSaving={preGenSaving}
setPreGenPending={setPreGenPending}
setPreGenPreview={setPreGenPreview}
setPreGenPreviewError={setPreGenPreviewError}
setPreGenAllowSoftOverride={setPreGenAllowSoftOverride}
dayShort={DAY_SHORT}
/>

<RightPanel
rightPanelRef={rightPanelRef}
setIsRightCollapsed={setIsRightCollapsed}
isRightCollapsed={isRightCollapsed}
isPreGenerationWorkspace={isPreGenerationWorkspace}
preGenKbSource={preGenKbSource}
selectedEntry={selectedEntry}
setPreGenKbSource={setPreGenKbSource}
setKbSelectedSource={setKbSelectedSource}
gradeBadge={GRADE_BADGE}
initials={initials}
facultyMap={facultyMap}
formatFacultyInitials={formatFacultyInitials}
isDesktop={isDesktop}
subjectLabel={subjectLabel}
toggleFollowUp={toggleFollowUp}
followUps={followUps}
setSelectedEntry={setSelectedEntry}
gradeForSection={gradeForSection}
violationIndex={violationIndex}
sectionLabel={sectionLabel}
facultyLabel={facultyLabel}
roomLabel={roomLabel}
roomRequestSummary={roomRequestSummary}
previewResult={previewResult}
formatConstraintMessage={formatConstraintMessage}
violationLabels={VIOLATION_LABELS}
violationExplanations={VIOLATION_EXPLANATIONS}
setSelectedViolation={setSelectedViolation}
toast={toast}
draftBoard={draftBoard}
parseDraftPlacementId={parseDraftPlacementId}
deletingPlacementId={deletingPlacementId}
setPendingUnassignId={setPendingUnassignId}
setShowUnassignConfirm={setShowUnassignConfirm}
enterManualEditView={enterManualEditView}
dayShort={DAY_SHORT}
/>
			</ResizablePanelGroup>
			</DndContext>

			<ScheduleReviewDialogs
context={{
showUnassignConfirm,
setShowUnassignConfirm,
setPendingUnassignId,
pendingUnassignId,
unassignDraftPlacement,
showGenerateConfirm,
setShowGenerateConfirm,
draftBoardSummary,
followUps,
confirmGenerate,
showResetDraftDialog,
setShowResetDraftDialog,
openPreGenerationWorkspace,
showLeavePreGenDialog,
setShowLeavePreGenDialog,
pendingCenterSwitch,
setPendingCenterSwitch,
requestPreview,
requestPreviewLoading,
setRequestPreview,
setSelectedRequestId,
setRequestAppeals,
setAppealReason,
requestPreviewHardConflicts,
requestPreviewSoftWarnings,
requestAppeals,
appealsLoading,
isPrivilegedUser,
updateAppealStatus,
appealReason,
appealSubmitting,
submitAppeal,
requestReviewerNotes,
setRequestReviewerNotes,
requestReviewSaving,
reviewRoomRequest,
generating,
generationElapsed,
showPublishDialog,
setShowPublishDialog,
softCount,
handlePublishConfirm,
showPreGenConfirm,
setShowPreGenConfirm,
setPreGenConfirmCtx,
setConfirmPreview,
setConfirmRawPreview,
setConfirmPreviewError,
setConfirmAllowSoftOverride,
setConfirmAllowDailyOverride,
preGenConfirmCtx,
confirmFacultyId,
setConfirmFacultyId,
confirmPreview,
confirmRoomId,
setConfirmRoomId,
facultyMap,
roomMap,
DAYS,
DAY_SHORT,
confirmPreviewLoading,
confirmPreviewError,
confirmDisplacedPlacement,
toast,
openSwapPrompt,
confirmAllowDailyOverride,
confirmSaving,
commitConfirmPlacement,
showSwapConfirm,
setShowSwapConfirm,
setSwapAction,
swapAction,
formatFacultyInitials,
roomLabelShort,
subjectLabel,
sectionLabel,
swapSaving,
executeSwapAction,
regularSwapPending,
setRegularSwapPending,
regularSwapSaving,
executeRegularSwap,
showSoftConfirm,
softConfirmWarnings,
commitLoading,
formatConstraintMessage,
setPendingCommitProposal,
setPreviewResult,
setSoftConfirmWarnings,
setDragItem,
pendingCommitProposal,
commitEdit,
showAssignmentPicker,
setShowAssignmentPicker,
setAssignPickerTarget,
assignPickerTarget,
assignPickerFacultyId,
setAssignPickerFacultyId,
assignPickerRoomId,
setAssignPickerRoomId,
confirmAssignmentPicker,
showEditHistory,
setShowEditHistory,
editHistory,
}}
/>
{/* -- Tutorial Overlay -- */}
			<TutorialOverlay
				steps={TUTORIAL_STEPS}
				active={tutorial.active}
				onComplete={tutorial.complete}
			/>

			{/* -- Hard Violation Blocker Modal -- */}
			<HardBlockerDialog
				open={!!blockerModalData}
				items={blockerModalData ?? []}
				onClose={() => setBlockerModalData(null)}
			/>

			{/* -- Explainability Drawer -- */}
			<ExplainabilityDrawer
				open={showExplainDrawer}
				onClose={() => { setDrawerViolation(null); setDrawerUnassigned(null); }}
				violation={drawerViolation ?? undefined}
				unassignedItem={drawerUnassigned ?? undefined}
			/>
		</div>
	);
}

/* --- Entry Detail Panel --- */

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
							{entry.entryKind === 'COHORT' && entry.cohortCode && (
								<Badge variant="outline" className="h-4 px-1 text-[0.5625rem] border-sky-300 bg-sky-50 text-sky-700">
									{entry.cohortCode}
								</Badge>
							)}
						</div>
					</DetailRow>

					{entry.programType && entry.programType !== 'REGULAR' && (
						<DetailRow label="Program" value={getProgramBadgeLabel(entry.programType, entry.programCode)} />
					)}

					{entry.entryKind === 'COHORT' && entry.cohortName && (
						<DetailRow label="Cohort" value={`${entry.cohortName}${entry.cohortExpectedEnrollment ? ` � ${entry.cohortExpectedEnrollment} learners` : ''}`} />
					)}

					{entry.adviserName && (
						<DetailRow label="Adviser" value={entry.adviserName} />
					)}

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
						value={`${DAY_SHORT[entry.day] ?? entry.day} ${formatTime(entry.startTime)}�${formatTime(entry.endTime)}`}
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
												<div>Observed: {String(v.meta.consecutiveMinutes)} min � Limit: {String(v.meta.maxConsecutive)} min � <span className="font-semibold">? +{Number(v.meta.consecutiveMinutes) - Number(v.meta.maxConsecutive)} min</span></div>
											)}
											{v.meta.dailyMinutes != null && v.meta.maxTeachingMinutesPerDay != null && (
												<div>Observed: {String(v.meta.dailyMinutes)} min � Limit: {String(v.meta.maxTeachingMinutesPerDay)} min � <span className="font-semibold">? +{Number(v.meta.dailyMinutes) - Number(v.meta.maxTeachingMinutesPerDay)} min</span></div>
											)}
											{v.meta.actualGapMinutes != null && v.meta.requiredBreakMinutes != null && (
												<div>Actual break: {String(v.meta.actualGapMinutes)} min � Required: {String(v.meta.requiredBreakMinutes)} min � <span className="font-semibold">Short by {Number(v.meta.requiredBreakMinutes) - Number(v.meta.actualGapMinutes)} min</span></div>
											)}
											{v.meta.totalIdleMinutes != null && v.meta.configuredThresholds != null && (
												<div>Idle: {String(v.meta.totalIdleMinutes)} min � Limit: {String((v.meta.configuredThresholds as Record<string,unknown>).maxIdleGapMinutesPerDay ?? '?')} min</div>
											)}
											{v.meta.estimatedDistanceMeters != null && (
												<div>Distance: ~{String(v.meta.estimatedDistanceMeters)}m{v.meta.configuredThresholds ? ` � Limit: ${String((v.meta.configuredThresholds as Record<string,unknown>).maxWalkingDistanceMetersPerTransition ?? '?')}m` : ''}</div>
											)}
											{v.meta.gapMinutes != null && (
												<div>Gap: {String(v.meta.gapMinutes)} min</div>
											)}
											{v.meta.buildingTransitions != null && (
												<div>Building transitions: {String(v.meta.buildingTransitions)}{v.meta.configuredThresholds ? ` � Limit: ${String((v.meta.configuredThresholds as Record<string,unknown>).maxBuildingTransitionsPerDay ?? '?')}` : ''}</div>
											)}
											{v.meta.backToBackTransitions != null && (
												<div>Back-to-back cross-building: {String(v.meta.backToBackTransitions)}{v.meta.configuredThresholds ? ` � Limit: ${String((v.meta.configuredThresholds as Record<string,unknown>).maxBackToBackTransitionsWithoutBuffer ?? '?')}` : ''}</div>
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

/* --- Detail Row --- */

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

/* --- Unassigned Reason Badge --- */

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
