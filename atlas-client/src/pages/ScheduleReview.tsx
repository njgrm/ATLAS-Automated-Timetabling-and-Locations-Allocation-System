import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertCircle,
	AlertTriangle,
	CalendarClock,
	Check,
	ChevronRight,
	Clock,
	DoorOpen,
	Flag,
	Loader2,
	PanelLeftClose,
	PanelLeftOpen,
	Play,
	RefreshCw,
	Search,
	Send,
	ShieldAlert,
	Users,
	X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { fetchPublicSettings } from '@/lib/settings';
import { formatTime } from '@/lib/utils';
import type {
	Building,
	DraftReport,
	ExternalSection,
	GenerationRun,
	Room,
	RunSummary,
	ScheduledEntry,
	SectionSummaryResponse,
	Subject,
	FacultyMirror,
	UnassignedItem,
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
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

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
};

const CONFLICT_CODES: Set<ViolationCode> = new Set([
	'FACULTY_TIME_CONFLICT',
	'ROOM_TIME_CONFLICT',
]);

const WELLBEING_CODES: Set<ViolationCode> = new Set([
	'FACULTY_EXCESSIVE_TRAVEL_DISTANCE',
	'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS',
	'FACULTY_INSUFFICIENT_TRANSITION_BUFFER',
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
	const [leftTab, setLeftTab] = useState<'violations' | 'unassigned'>('violations');

	/* ── Generate / Publish workflow state ── */
	const [generating, setGenerating] = useState(false);
	const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
	const [showPublishDialog, setShowPublishDialog] = useState(false);
	const [publishAcknowledged, setPublishAcknowledged] = useState(false);

	/* ── Room reference data ── */
	const [roomMap, setRoomMap] = useState<Map<number, RoomInfo>>(new Map());

	/* ── Layout state ── */
	const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
	const [isRightCollapsed, setIsRightCollapsed] = useState(false);

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
			await atlasApi.post(`/generation/${DEFAULT_SCHOOL_ID}/${schoolYearId}/runs`);
			toast.success('Generation started — refreshing…');
			// Poll briefly, then reload
			setTimeout(() => loadAll(false), 2000);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Generation request failed.';
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
						<Play className={`size-3.5 mr-1.5 ${generating ? 'animate-pulse' : ''}`} />
						Generate Schedule
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
									<Play className={`size-3.5 ${generating ? 'animate-pulse' : ''}`} />
									Generate
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

					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="h-8"
									onClick={handleRefresh}
									disabled={loading}
								>
									<RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Refresh data</TooltipContent>
						</Tooltip>
					</TooltipProvider>

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
				<div className="flex items-center gap-2 px-4 pb-2 flex-wrap">
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

					{/* Entity filter — filters grid by section/faculty/room based on view mode */}
					<Select value={entityFilter} onValueChange={setEntityFilter}>
						<SelectTrigger className="h-7 w-44 text-xs">
							<SelectValue placeholder={`Select ${VIEW_MODE_LABELS[viewMode]}…`} />
						</SelectTrigger>
						<SelectContent>
							{pivotEntityIds.map((id) => (
								<SelectItem key={id} value={String(id)}>
									{pivotLabel(id)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

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

			{/* ── Body: Two-panel split (right detail is a Sheet overlay) ── */}
			<div className="flex flex-1 min-h-0">
				{/* LEFT: Violations + Unassigned Tabs (collapsible) */}
				<motion.div
					animate={{ width: isLeftCollapsed ? '3rem' : '16rem' }}
					transition={{ duration: 0.2, ease: 'easeInOut' }}
					className="shrink-0 border-r border-border flex flex-col min-h-0 bg-background overflow-hidden">
					{/* Collapse toggle */}
					<div className="shrink-0 flex items-center justify-end px-1 py-1 border-b border-border">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsLeftCollapsed((c) => !c)}>
										{isLeftCollapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
									</Button>
								</TooltipTrigger>
								<TooltipContent side="right">{isLeftCollapsed ? 'Expand panel' : 'Collapse panel'}</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>

					{/* Collapsed icon strip */}
					{isLeftCollapsed ? (
						<div className="flex flex-col items-center gap-1 py-2">
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant={leftTab === 'violations' ? 'default' : 'ghost'}
											size="sm"
											className="h-8 w-8 p-0"
											onClick={() => { setLeftTab('violations'); setIsLeftCollapsed(false); }}
										>
											<ShieldAlert className="size-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="right">Violations ({violations.length})</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant={leftTab === 'unassigned' ? 'default' : 'ghost'}
											size="sm"
											className="h-8 w-8 p-0"
											onClick={() => { setLeftTab('unassigned'); setIsLeftCollapsed(false); }}
										>
											<AlertTriangle className="size-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="right">Unassigned ({summary?.unassignedCount ?? 0})</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					) : (
					<>
					{/* Tab switcher */}
					<div className="shrink-0 flex border-b border-border" role="tablist" aria-label="Schedule review panels">
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
					</div>

					{leftTab === 'violations' ? (
						<div id="panel-violations" role="tabpanel" aria-labelledby="tab-violations" className="flex flex-col flex-1 min-h-0">
							<div className="shrink-0 px-3 pt-3 pb-2">
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
											/>
										))
									)}
								</div>
							</ScrollArea>
						</div>
					) : (
						<ScrollArea id="panel-unassigned" role="tabpanel" aria-labelledby="tab-unassigned" className="flex-1 min-h-0">
							<div className="px-3 py-3 space-y-3">
								{summary ? (
									<>
										<div className="rounded-md border border-border p-3 space-y-2">
											<div className="flex items-center justify-between">
												<MetricExplain
													label="Classes Processed"
													explanation="The total number of class demands (e.g., Math 7 Section A) the algorithm attempted to schedule."
												/>
												<span className="text-sm font-bold">{summary.classesProcessed}</span>
											</div>
											<div className="flex items-center justify-between">
												<MetricExplain
													label="Assigned"
													explanation="Class sessions that were successfully pinned to a timeslot, room, and teacher without breaking hard constraints."
												/>
												<span className="text-sm font-bold text-emerald-600">{summary.assignedCount}</span>
											</div>
											<div className="flex items-center justify-between">
												<MetricExplain
													label="Unassigned"
													explanation="Class sessions that failed to be placed. These will require you to manually triage them, or fix upstream setup data."
												/>
												<span className={`text-sm font-bold ${summary.unassignedCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
													{summary.unassignedCount}
												</span>
											</div>
											{summary.policyBlockedCount > 0 && (
												<div className="flex items-start justify-between mt-3 pt-2 border-t border-border/50">
													<div className="flex-1 pr-2">
														<MetricExplain
															label="Policy-Blocked"
															explanation={
																<div className="space-y-1.5 opacity-90">
																	<p className="font-semibold text-red-400">Not a class count.</p>
																	<p>This shows how many times the search algorithm hit a dead-end because of a hard policy stricture (like a teacher being overloaded or unavailable).</p>
																	<p>A massive number (e.g., 1000+) just means the computer had to search extensively to find a valid arrangement.</p>
																</div>
															}
														/>
													</div>
													<span className="text-sm font-bold text-red-600 tabular-nums">{summary.policyBlockedCount}</span>
												</div>
											)}
										</div>

										{/* Unassigned items list */}
										{(draft?.unassignedItems ?? []).length > 0 && (
											<div className="space-y-1">
												<span className="text-[0.6875rem] font-medium text-muted-foreground">
													Unassigned Items
												</span>
												{(draft?.unassignedItems ?? []).map((item, i) => {
													const grade = item.gradeLevel;
													const gradeBadge = grade ? GRADE_BADGE[grade] : undefined;
													return (
														<div
															key={`${item.sectionId}-${item.subjectId}-${item.session}-${i}`}
															className="rounded border border-amber-200 bg-amber-50/50 px-2 py-1.5 text-xs space-y-0.5"
														>
															<div className="flex items-center gap-1.5">
																{gradeBadge && (
																	<Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] shrink-0 ${gradeBadge}`}>
																		G{grade}
																	</Badge>
																)}
																<span className="font-medium truncate">{sectionLabel(item.sectionId)}</span>
																<span className="text-muted-foreground">·</span>
																<span className="truncate">{subjectLabel(item.subjectId)}</span>
															</div>
															<div className="flex items-center gap-1.5 text-[0.625rem] text-muted-foreground">
																<UnassignedReasonBadge reason={item.reason} />
																<span className="opacity-60">Session {item.session}</span>
															</div>
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
						)}
					</>)}
				</motion.div>

				{/* CENTER: Timetable Grid */}
				<div className="flex-1 min-w-0 flex flex-col min-h-0">
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
				</div>

				{/* RIGHT: Entry Detail Panel (collapsible) */}
				<motion.div
					animate={{ width: isRightCollapsed ? '3rem' : '18rem' }}
					transition={{ duration: 0.2, ease: 'easeInOut' }}
					className="shrink-0 border-l border-border flex flex-col min-h-0 bg-background overflow-hidden"
				>
					{/* Collapse toggle */}
					<div className="shrink-0 flex items-center px-1 py-1 border-b border-border">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsRightCollapsed((c) => !c)}>
										{isRightCollapsed ? <PanelLeftClose className="size-3.5 rotate-180" /> : <PanelLeftOpen className="size-3.5 rotate-180" />}
									</Button>
								</TooltipTrigger>
								<TooltipContent side="left">{isRightCollapsed ? 'Expand panel' : 'Collapse panel'}</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>

					{!isRightCollapsed ? (
						<AnimatePresence mode="wait">
							{selectedEntry ? (
								<motion.div
									key={selectedEntry.entryId}
									initial={{ opacity: 0, x: 10 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: 10 }}
									transition={{ duration: 0.15 }}
									className="flex flex-col min-h-0 h-full w-72"
								>
									<EntryDetailPanel
										entry={selectedEntry}
										violationIndex={violationIndex}
										followUps={followUps}
										onToggleFollowUp={toggleFollowUp}
										onClose={() => setSelectedEntry(null)}
										subjectLabel={subjectLabel}
										facultyLabel={facultyLabel}
										sectionLabel={sectionLabel}
										gradeForSection={gradeForSection}
										roomLabel={roomLabel}
										isStaleRoom={isStaleRoom}
									/>
								</motion.div>
							) : (
								<motion.div
									key="empty"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className="flex-1 flex items-center justify-center w-72"
								>
									<div className="text-center space-y-2 px-6">
										<Users className="mx-auto size-8 text-muted-foreground/30" />
										<p className="text-xs text-muted-foreground">
											Click an entry in the grid or select a violation to view details
										</p>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					) : (
						<div className="flex-1 flex flex-col items-center py-4 text-muted-foreground/50">
							<DoorOpen className="size-4" />
						</div>	
					)}
				</motion.div>
			</div>

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
}: {
	code: ViolationCode;
	violations: Violation[];
	selectedViolation: Violation | null;
	onSelect: (v: Violation) => void;
}) {
	const [expanded, setExpanded] = useState(true);
	const isHard = violations[0]?.severity === 'HARD';

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
									<button
										key={i}
										onClick={() => onSelect(v)}
										className={`w-full text-left px-3 py-1.5 text-[0.6875rem] leading-tight transition-colors ${
											isSelected
												? 'bg-primary/10 text-foreground'
												: 'text-muted-foreground hover:bg-muted/50'
										}`}
									>
										<span className="line-clamp-2">{v.message}</span>
									</button>
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
}) {
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
								return (
									<td key={day} className="px-1 py-1 align-top border-l border-border/30">
										<div className="space-y-0.5">
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
													<button
														key={e.entryId}
														onClick={() => onEntryClick(e)}
														aria-label={`${subjectLabel(e.subjectId)}, ${sectionLabel(e.sectionId)}, ${DAY_SHORT[e.day] ?? e.day} ${formatTime(e.startTime)}–${formatTime(e.endTime)}`}
														className={`w-full text-left rounded px-1.5 py-1 border text-[0.625rem] leading-tight transition-all cursor-pointer hover:opacity-80 ${cellClass}`}
													>
														<div className="font-medium truncate">
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
									{v.meta && WELLBEING_CODES.has(v.code) && (
										<div className="mt-1 pt-1 border-t border-current/10 text-[0.5625rem] space-y-0.5 opacity-90">
											{v.meta.estimatedDistanceMeters != null && (
												<div>Distance: ~{String(v.meta.estimatedDistanceMeters)}m</div>
											)}
											{v.meta.gapMinutes != null && (
												<div>Gap: {String(v.meta.gapMinutes)} min</div>
											)}
											{v.meta.buildingTransitions != null && (
												<div>Building transitions: {String(v.meta.buildingTransitions)}</div>
											)}
											{v.meta.backToBackTransitions != null && (
												<div>Back-to-back cross-building: {String(v.meta.backToBackTransitions)}</div>
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
											disabled
										>
											<Clock className="size-3 mr-1.5" />
											Move Timeslot
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
	NO_QUALIFIED_FACULTY: { label: 'No Qualified Faculty', className: 'border-red-300 bg-red-50 text-red-700' },
	FACULTY_OVERLOADED: { label: 'Faculty Overloaded', className: 'border-amber-300 bg-amber-50 text-amber-700' },
	NO_AVAILABLE_SLOT: { label: 'No Available Slot', className: 'border-orange-300 bg-orange-50 text-orange-700' },
	NO_COMPATIBLE_ROOM: { label: 'No Compatible Room', className: 'border-purple-300 bg-purple-50 text-purple-700' },
};

function UnassignedReasonBadge({ reason }: { reason: string }) {
	const info = UNASSIGNED_REASON_LABELS[reason] ?? { label: reason, className: 'border-gray-300 bg-gray-50 text-gray-700' };
	return (
		<Badge variant="outline" className={`h-4 px-1 text-[0.5625rem] ${info.className}`}>
			{info.label}
		</Badge>
	);
}
