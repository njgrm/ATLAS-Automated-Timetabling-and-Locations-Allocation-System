import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Filter,
	Info,
	Redo2,
	RotateCcw,
	Save,
	Search,
	Undo2,
	UserCog,
	Star,
	MoreHorizontal,
	Settings2,
	Activity,
	Users,
	Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

import { cn } from '@/lib/utils';
import atlasApi from '@/lib/api';
import {
	buildAssignmentSignature,
	buildMultiOwnerSavedMap,
	buildOwnershipMap,
	buildOwnershipMapFromIndex,
	buildPendingOwnershipMap,
	buildSectionMap,
	buildTeachingLoadProfile,
	CLASS_ADVISER_EQUIVALENT_HOURS,
	getAssignmentOwnershipKey,
	normalizeDraftAssignments,
	type FacultyAssignmentDraft,
	type LoadStatus,
	type SubjectSectionOwnershipIndexEntry,
} from '@/lib/faculty-assignment-helpers';
import { isDepartmentMatch, gradeLabel, GRADE_COLORS } from '@/lib/grade-labels';
import {
	resolveActiveSchoolYearContext,
	type ActiveSchoolYearContextSource,
	isUpstreamBackedSchoolYearSource,
} from '@/lib/enrollpro-public-settings';
import {
	getCachedFacultyAssignmentsSummary,
	getCachedSectionSummary,
	getCachedSubjects,
	normalizeFacultySummarySnapshot,
	requestWithRetry,
	setCachedFacultyAssignmentsSummary,
	setCachedSectionSummary,
	setCachedSubjects,
} from '@/lib/faculty-teaching-load-cache';
import { OverviewHeader } from '@/components/faculty-assignments/OverviewHeader';
import { SubjectRow } from '@/components/faculty-assignments/SubjectRow';
import { useAssignmentHistory } from '@/hooks/useAssignmentHistory';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { SearchableSelect } from '@/ui/searchable-select';
import { Skeleton } from '@/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/ui/sheet';
import {
	AutoFillSummaryModal,
	type AutoFillSummaryResult,
	type CoverageMode,
} from '@/components/faculty-assignments/AutoFillSummaryModal';
import type {
	ExternalSection,
	HomeroomHintResponse,
	SectionSummaryResponse,
	Subject,
	FacultyAssignmentRecord,
	FacultySummary,
	TeachingLoadCoverageTotals,
	TeachingLoadIntegrityDiagnostics,
	RotationFamilyLoadDetail,
	RotationFamilyTermBreakdown,
	TeachingLoadSplitBrainReconcileResult,
} from '@/types';

const DEFAULT_SCHOOL_ID = 1;

const STATUS_COLORS: Record<LoadStatus, { bg: string; text: string; border: string }> = {
	'below-standard': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
	compliant: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
	'overload-allowed': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
	'over-cap': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

const COVERAGE_MODE_CONFIG: Record<CoverageMode, { label: string; description: string }> = {
	REAL_FACULTY_STANDARD: {
		label: 'Real Faculty Standard',
		description: 'Use current default policy load caps for real faculty coverage.',
	},
	REAL_FACULTY_HARD_CAP: {
		label: 'Real Faculty Hard Cap',
		description: 'Use real faculty only and stop at policy credited-load limits.',
	},
	REAL_FACULTY_THEN_TEACHER_X: {
		label: 'Real Faculty Then Teacher X',
		description: 'Fill with real faculty first, then create Teacher X placeholders for remaining gaps.',
	},
};

type TeachingLoadResetPreview = {
	applied: boolean;
	scope: 'GLOBAL' | 'SUBJECT';
	schoolId: number;
	schoolYearId: number;
	subjectId: number | null;
	ownershipRowsToRemove: number;
	facultySubjectRowsAffected: number;
	facultySubjectRowsDeleted: number;
	facultySubjectRowsUpdated: number;
	affectedFacultyCount: number;
	affectedSubjectCount: number;
	subjectCodes: string[];
};

type RealFacultyRecoveryApplyResult = {
	applied: boolean;
	placeholderMovesPlanned: number;
	placeholderMovesApplied: number;
	blockers: Array<{ category: string; reason: string }>;
	blockerCounts?: {
		trueDepartmentShortage: number;
		skewedAssignmentTopology: number;
		unresolvedAutomationSeedBias: number;
		rotationFamilyModelingGap: number;
		subjectContractGap: number;
	};
};

function cloneAssignments(assignments: FacultyAssignmentDraft[]): FacultyAssignmentDraft[] {
	return assignments.map((assignment) => ({
		subjectId: assignment.subjectId,
		sectionIds: [...assignment.sectionIds],
		gradeLevels: [...assignment.gradeLevels],
	}));
}

function toDraftAssignments(
	assignments: FacultyAssignmentRecord[],
	sectionMap: Map<number, ExternalSection>,
): FacultyAssignmentDraft[] {
	return normalizeDraftAssignments(
		assignments.map((assignment) => ({
			subjectId: assignment.subjectId,
			sectionIds: assignment.sectionIds,
			gradeLevels: assignment.gradeLevels,
		})),
		sectionMap,
	);
}

function resolveRotationTermRank(subject: Pick<Subject, 'rotationTermRank' | 'modularOrder'>): number {
	if (typeof subject.rotationTermRank === 'number' && Number.isInteger(subject.rotationTermRank) && subject.rotationTermRank > 0) {
		return subject.rotationTermRank;
	}
	if (typeof subject.modularOrder === 'number' && Number.isInteger(subject.modularOrder) && subject.modularOrder > 0) {
		return subject.modularOrder;
	}
	return 0;
}

function resolveCanonicalRotationTermLabel(termLabel: string | null | undefined, termRank: number | null | undefined): string | null {
	if (typeof termRank === 'number' && Number.isInteger(termRank) && termRank > 0) {
		return `Term ${termRank}`;
	}

	const normalizedLabel = (termLabel ?? '').trim();
	if (normalizedLabel.length === 0) {
		return null;
	}

	const rankMatch = normalizedLabel.match(/(\d+)/);
	if (rankMatch) {
		const parsed = Number(rankMatch[1]);
		if (Number.isInteger(parsed) && parsed > 0) {
			return `Term ${parsed}`;
		}
	}

	return normalizedLabel;
}

export default function FacultyAssignments() {
	const [searchParams, setSearchParams] = useSearchParams();
	const [faculty, setFaculty] = useState<FacultySummary[]>([]);
	const [subjects, setSubjects] = useState<Subject[]>([]);
	const [sectionSummary, setSectionSummary] = useState<SectionSummaryResponse | null>(null);
	const [savedOwnershipIndex, setSavedOwnershipIndex] = useState<SubjectSectionOwnershipIndexEntry[]>([]);
	const [coverageTotals, setCoverageTotals] = useState<TeachingLoadCoverageTotals | null>(null);
	const [integrityDiagnostics, setIntegrityDiagnostics] = useState<TeachingLoadIntegrityDiagnostics | null>(null);
	const [splitBrainIncident, setSplitBrainIncident] = useState<TeachingLoadSplitBrainReconcileResult | null>(null);
	const [splitBrainLoading, setSplitBrainLoading] = useState(false);
	const [splitBrainApplyLoading, setSplitBrainApplyLoading] = useState(false);
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [selectedId, setSelectedId] = useState<number | null>(() => {
		const queryValue = searchParams.get('facultyId');
		return queryValue ? Number(queryValue) : null;
	});
	const [subjectFocusId, setSubjectFocusId] = useState<number | null>(() => {
		const queryValue = searchParams.get('subjectId');
		if (!queryValue) return null;
		const parsed = Number(queryValue);
		return Number.isNaN(parsed) ? null : parsed;
	});
	const [searchQuery, setSearchQuery] = useState('');
	const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'unassigned'>('all');
	const [departmentFilter, setDepartmentFilter] = useState<string>('all');
	const [subjectSearch, setSubjectSearch] = useState('');
	const [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
	const [staffingNeedsLoading, setStaffingNeedsLoading] = useState(false);
	const [summaryModalOpen, setSummaryModalOpen] = useState(false);
	const [summaryModalResult, setSummaryModalResult] = useState<AutoFillSummaryResult | null>(null);
	const [coverageMode, setCoverageMode] = useState<CoverageMode>('REAL_FACULTY_STANDARD');
	const [gradeLevelFilter, setGradeLevelFilter] = useState<string>('all');
	const [sortOrder, setSortOrder] = useState<'load-asc' | 'load-desc'>('load-asc');
	const [loadFilter, setLoadFilter] = useState<'all' | 'overloaded' | 'optimal' | 'underloaded'>('all');
	const [showTemporaryRoles, setShowTemporaryRoles] = useState(false);
	const [hoveredIncomingMinutes, setHoveredIncomingMinutes] = useState(0);
	const [swapCandidate, setSwapCandidate] = useState<{ subjectId: number; sectionId: number; fromFacultyId: number } | null>(null);
	const [resetDialogOpen, setResetDialogOpen] = useState(false);
	const [resetPreview, setResetPreview] = useState<TeachingLoadResetPreview | null>(null);
	const [resetLoading, setResetLoading] = useState(false);
	const [recoveryApplyLoading, setRecoveryApplyLoading] = useState(false);
	const [resetConfirmText, setResetConfirmText] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [dataSource, setDataSource] = useState<'live' | 'cached' | 'refreshing' | 'none'>('none');
	const [degradedNotice, setDegradedNotice] = useState<string | null>(null);
	const [isOnline, setIsOnline] = useState(() => navigator.onLine);
	const [homeroomHint, setHomeroomHint] = useState<HomeroomHintResponse | null>(null);
	const [draftAssignmentsByFaculty, setDraftAssignmentsByFaculty] = useState<Record<number, FacultyAssignmentDraft[]>>({});
	const [autoFillLoading, setAutoFillLoading] = useState(false);
	const [autoFillDialogOpen, setAutoFillDialogOpen] = useState(false);
	const [showFilters, setShowFilters] = useState(false);
	const [showJumpList, setShowJumpList] = useState(false);
	const [viewMode, setViewMode] = useState('assignments');

	const hasLocalWriteEvidence = Boolean(
		activeSchoolYearId
		&& (sectionSummary?.sections?.length ?? 0) > 0
		&& subjects.length > 0
		&& faculty.length > 0,
	);
	const hasSettledRuntimeSource = dataSource === 'live' || dataSource === 'cached';
	const degradedWriteEnabled = isOnline && dataSource === 'cached' && hasLocalWriteEvidence;
	const canPersistAssignments = isOnline && (dataSource === 'live' || degradedWriteEnabled);
	const canRunStaffingNeeds = isOnline && hasSettledRuntimeSource && Boolean(activeSchoolYearId);
	const canRunGlobalReset = isOnline && dataSource === 'live' && Boolean(activeSchoolYearId);
	const splitBrainQuarantineRequired = splitBrainIncident?.quarantine.required === true;
	const splitBrainReasonLabel = splitBrainIncident?.quarantine.message ?? 'Repair pending: assignment edits are temporarily blocked.';
	const isReadOnlyMode = !canPersistAssignments || splitBrainQuarantineRequired;

	const activeFacultyIds = useMemo(() => new Set(faculty.map((f) => f.id)), [faculty]);

	const fetchSplitBrainIncident = useCallback(async (schoolYearId: number) => {
		setSplitBrainLoading(true);
		try {
			const { data } = await atlasApi.post<TeachingLoadSplitBrainReconcileResult>(
				'/faculty-assignments/integrity/reconcile-split-brain',
				{
					schoolId: DEFAULT_SCHOOL_ID,
					schoolYearId,
					previewOnly: true,
				},
			);
			setSplitBrainIncident(data);
		} catch {
			setSplitBrainIncident(null);
		} finally {
			setSplitBrainLoading(false);
		}
	}, []);

	const fetchData = useCallback(async (options?: { forceRefresh?: boolean }) => {
		const forceRefresh = options?.forceRefresh === true;
		setLoading(true);
		setError(null);

		let schoolYearId: number | null = null;
		let yearContextSource: ActiveSchoolYearContextSource = 'cache';

		try {
			const schoolYearContext = await resolveActiveSchoolYearContext({
				forceRefresh,
				allowEnrollProFallback: false,
			});
			schoolYearId = schoolYearContext.activeSchoolYearId;
			yearContextSource = schoolYearContext.source;

			if (!forceRefresh) {
				const cachedSummary = getCachedFacultyAssignmentsSummary(DEFAULT_SCHOOL_ID, schoolYearId, {
					maxAgeMs: 3 * 60 * 1000,
				});
				const cachedSubjects = getCachedSubjects(DEFAULT_SCHOOL_ID, { maxAgeMs: 3 * 60 * 1000 });
				const cachedSections = getCachedSectionSummary(DEFAULT_SCHOOL_ID, schoolYearId, { maxAgeMs: 3 * 60 * 1000 });

				if (cachedSummary && cachedSubjects && cachedSections) {
					setActiveSchoolYearId(schoolYearId);
					setFaculty(cachedSummary.data.faculty);
					setSavedOwnershipIndex(cachedSummary.data.ownershipIndex ?? []);
					setCoverageTotals(cachedSummary.data.coverageTotals ?? null);
					setIntegrityDiagnostics(cachedSummary.data.integrityDiagnostics ?? null);
					setSubjects(cachedSubjects.data);
					setSectionSummary(cachedSections.data);
					setDataSource(isOnline ? 'refreshing' : 'cached');
					setDegradedNotice(
						isOnline
							? 'Verifying live teaching load data before enabling edits. Showing your last saved snapshot in the meantime.'
							: 'Offline mode: showing your last saved teaching load snapshot in read-only mode.',
					);
					setLoading(false);
				}
			}

			const [facultyRes, subjectsRes, sectionsRes] = await Promise.all([
				requestWithRetry(
					() =>
						atlasApi.get<{
							faculty: FacultySummary[];
							ownershipIndex?: SubjectSectionOwnershipIndexEntry[];
							coverageTotals?: TeachingLoadCoverageTotals;
							integrityDiagnostics?: TeachingLoadIntegrityDiagnostics;
							fetchedAt?: string | null;
						}>(
							'/faculty-assignments/summary',
							{ params: { schoolId: DEFAULT_SCHOOL_ID, schoolYearId } },
						),
					{ attempts: 2, delayMs: 400 },
				),
				requestWithRetry(
					() => atlasApi.get<{ subjects: Subject[] }>('/subjects', { params: { schoolId: DEFAULT_SCHOOL_ID } }),
					{ attempts: 2, delayMs: 300 },
				),
				requestWithRetry(
					() => atlasApi.get<SectionSummaryResponse>(`/sections/summary/${schoolYearId}`, { params: { schoolId: DEFAULT_SCHOOL_ID } }),
					{ attempts: 2, delayMs: 400 },
				),
			]);

			const normalizedSummary = normalizeFacultySummarySnapshot({
				faculty: facultyRes.data.faculty,
				ownershipIndex: facultyRes.data.ownershipIndex ?? [],
				coverageTotals: facultyRes.data.coverageTotals,
				integrityDiagnostics: facultyRes.data.integrityDiagnostics,
				fetchedAt: facultyRes.data.fetchedAt ?? null,
				schoolYearId,
			});
			if (!normalizedSummary) {
				throw new Error('Teaching Load summary payload is incompatible with the current client contract.');
			}
			const normalizedSubjects = Array.isArray(subjectsRes.data.subjects) ? subjectsRes.data.subjects : [];
			const normalizedSectionSummary = {
				...sectionsRes.data,
				sections: Array.isArray((sectionsRes.data as any)?.sections) ? (sectionsRes.data as any).sections : [],
				gradeLevels: Array.isArray((sectionsRes.data as any)?.gradeLevels) ? (sectionsRes.data as any).gradeLevels : [],
				contractWarnings: Array.isArray((sectionsRes.data as any)?.contractWarnings) ? (sectionsRes.data as any).contractWarnings : [],
			};

			setActiveSchoolYearId(schoolYearId);
			setFaculty(normalizedSummary.faculty);
			setSavedOwnershipIndex(normalizedSummary.ownershipIndex);
			setCoverageTotals(normalizedSummary.coverageTotals ?? null);
			setIntegrityDiagnostics(normalizedSummary.integrityDiagnostics ?? null);
			setSubjects(normalizedSubjects);
			setSectionSummary(normalizedSectionSummary as SectionSummaryResponse);
			setCachedFacultyAssignmentsSummary(DEFAULT_SCHOOL_ID, schoolYearId, normalizedSummary);
			setCachedSubjects(DEFAULT_SCHOOL_ID, normalizedSubjects);
			setCachedSectionSummary(DEFAULT_SCHOOL_ID, schoolYearId, normalizedSectionSummary as SectionSummaryResponse);
			const isUpstreamContext = isUpstreamBackedSchoolYearSource(yearContextSource);
			const isUpstreamBacked = isUpstreamContext && normalizedSectionSummary.source === 'enrollpro';
			setDataSource(isUpstreamBacked ? 'live' : 'cached');
			setDegradedNotice(
				isUpstreamBacked
					? null
					: isUpstreamContext
					? 'Teaching load context is sourced from ATLAS mirror. EnrollPro connection is active.'
					: 'Teaching load data is available from ATLAS runtime cache while upstream verification is unavailable.',
			);
			setError(null);
			void fetchSplitBrainIncident(schoolYearId);
		} catch (requestError: any) {
			const cachedSummary = schoolYearId ? getCachedFacultyAssignmentsSummary(DEFAULT_SCHOOL_ID, schoolYearId) : null;
			const cachedSubjects = getCachedSubjects(DEFAULT_SCHOOL_ID);
			const cachedSections = schoolYearId ? getCachedSectionSummary(DEFAULT_SCHOOL_ID, schoolYearId) : null;

			if (schoolYearId && cachedSummary && cachedSubjects && cachedSections) {
				setActiveSchoolYearId(schoolYearId);
				setFaculty(cachedSummary.data.faculty);
				setSavedOwnershipIndex(cachedSummary.data.ownershipIndex ?? []);
				setCoverageTotals(cachedSummary.data.coverageTotals ?? null);
				setIntegrityDiagnostics(cachedSummary.data.integrityDiagnostics ?? null);
				setSubjects(cachedSubjects.data);
				setSectionSummary(cachedSections.data);
				setDataSource('cached');
				setDegradedNotice('Live teaching load data is unavailable. You are viewing your last saved snapshot in read-only mode.');
				setError(null);
				void fetchSplitBrainIncident(schoolYearId);
			} else {
				setDataSource('none');
				setCoverageTotals(null);
				setIntegrityDiagnostics(null);
				setSplitBrainIncident(null);
				setDegradedNotice(null);
				setError(requestError?.response?.data?.message ?? requestError?.message ?? 'Failed to load teaching load data.');
			}
		} finally {
			setLoading(false);
		}
	}, [fetchSplitBrainIncident]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, []);

	useEffect(() => {
		const queryValue = searchParams.get('facultyId');
		if (queryValue) {
			const parsed = Number(queryValue);
			if (!Number.isNaN(parsed) && faculty.some(m => m.id === parsed)) {
				setSelectedId(parsed);
				return;
			}
		}
		if (faculty.length === 0) {
			setSelectedId(null);
			return;
		}
		if (selectedId == null || !faculty.some((member) => member.id === selectedId)) {
			setSelectedId(faculty[0].id);
		}
	}, [faculty, searchParams, selectedId]);

	useEffect(() => {
		const queryValue = searchParams.get('subjectId');
		if (!queryValue) {
			setSubjectFocusId(null);
			return;
		}
		const parsed = Number(queryValue);
		setSubjectFocusId(Number.isNaN(parsed) ? null : parsed);
	}, [searchParams]);

	useEffect(() => {
		if (!subjectFocusId) return;
		const focusedSubject = subjects.find((subject) => subject.id === subjectFocusId);
		if (!focusedSubject) return;
		setSubjectSearch(focusedSubject.code);
	}, [subjectFocusId, subjects]);

	const allKnownSections = useMemo(() => {
		return [...(sectionSummary?.sections ?? [])].sort(
			(left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id - right.id,
		);
	}, [sectionSummary]);

	const sectionMap = useMemo(() => buildSectionMap(allKnownSections), [allKnownSections]);

	const savedAssignmentsByFaculty = useMemo(() => {
		const result: Record<number, FacultyAssignmentDraft[]> = {};
		for (const member of faculty) {
			result[member.id] = toDraftAssignments(member.assignments, sectionMap);
		}
		return result;
	}, [faculty, sectionMap]);

	const effectiveDraftAssignmentsByFaculty = useMemo(() => {
		const result: Record<number, FacultyAssignmentDraft[]> = {};
		for (const [facultyIdRaw, assignments] of Object.entries(draftAssignmentsByFaculty)) {
			const facultyId = Number(facultyIdRaw);
			const normalized = normalizeDraftAssignments(assignments, sectionMap);
			const savedSignature = buildAssignmentSignature(savedAssignmentsByFaculty[facultyId] ?? []);
			if (buildAssignmentSignature(normalized) !== savedSignature) {
				result[facultyId] = normalized;
			}
		}
		return result;
	}, [draftAssignmentsByFaculty, savedAssignmentsByFaculty, sectionMap]);

	const effectiveAssignmentsByFaculty = useMemo(() => {
		const result: Record<number, FacultyAssignmentDraft[]> = {};
		for (const member of faculty) {
			result[member.id] = effectiveDraftAssignmentsByFaculty[member.id] ?? savedAssignmentsByFaculty[member.id] ?? [];
		}
		return result;
	}, [faculty, effectiveDraftAssignmentsByFaculty, savedAssignmentsByFaculty]);

	const activeDraftCount = useMemo(() => Object.keys(effectiveDraftAssignmentsByFaculty).length, [effectiveDraftAssignmentsByFaculty]);

	const facultyNames = useMemo(
		() => Object.fromEntries(faculty.map((member) => [member.id, `${member.lastName}, ${member.firstName}`])),
		[faculty],
	);

	const savedOwnershipMap = useMemo(
		() => (savedOwnershipIndex.length > 0
			? buildOwnershipMapFromIndex(savedOwnershipIndex)
			: buildOwnershipMap(savedAssignmentsByFaculty, facultyNames, 'saved')),
		[facultyNames, savedAssignmentsByFaculty, savedOwnershipIndex],
	);

	const savedConflictMap = useMemo(
		() => buildMultiOwnerSavedMap(savedAssignmentsByFaculty, facultyNames),
		[facultyNames, savedAssignmentsByFaculty],
	);

	const pendingOwnershipMap = useMemo(
		() => buildPendingOwnershipMap(savedAssignmentsByFaculty, effectiveDraftAssignmentsByFaculty, facultyNames),
		[effectiveDraftAssignmentsByFaculty, facultyNames, savedAssignmentsByFaculty],
	);

	const selected = useMemo(
		() => faculty.find((member) => member.id === selectedId) ?? null,
		[faculty, selectedId],
	);

	const currentAssignments = useMemo(
		() => (selected ? effectiveAssignmentsByFaculty[selected.id] ?? [] : []),
		[effectiveAssignmentsByFaculty, selected],
	);

	const savedAssignmentsForSelected = useMemo(
		() => (selected ? savedAssignmentsByFaculty[selected.id] ?? [] : []),
		[savedAssignmentsByFaculty, selected],
	);

	const dirty = Boolean(
		selected
		&& buildAssignmentSignature(currentAssignments) !== buildAssignmentSignature(savedAssignmentsForSelected),
	);

	const { canUndo, canRedo, pushHistory, handleUndo, handleRedo, handleResetAssignments } = useAssignmentHistory({
		selectedId: selected?.id ?? null,
		subjects,
		effectiveAssignmentsByFaculty,
		savedAssignmentsByFaculty,
		sectionMap,
		setDraftAssignmentsByFaculty,
	});

	useEffect(() => {
		if (!selected) {
			setHomeroomHint(null);
			return;
		}

		let cancelled = false;
		atlasApi
			.get<HomeroomHintResponse>(`/faculty/${selected.id}/homeroom-hint`)
			.then(({ data }) => {
				if (!cancelled) {
					setHomeroomHint(data);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setHomeroomHint(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [selected]);

	const updateSelectedAssignments = useCallback(
		(updater: (current: FacultyAssignmentDraft[]) => FacultyAssignmentDraft[]) => {
			if (!selected) {
				return;
			}
			pushHistory();
			setDraftAssignmentsByFaculty((previousDrafts) => {
				const current = cloneAssignments(previousDrafts[selected.id] ?? savedAssignmentsByFaculty[selected.id] ?? []);
				const nextAssignments = normalizeDraftAssignments(updater(current), sectionMap);
				const savedSignature = buildAssignmentSignature(savedAssignmentsByFaculty[selected.id] ?? []);
				if (buildAssignmentSignature(nextAssignments) === savedSignature) {
					const nextDrafts = { ...previousDrafts };
					delete nextDrafts[selected.id];
					return nextDrafts;
				}
				return {
					...previousDrafts,
					[selected.id]: nextAssignments,
				};
			});
		},
		[pushHistory, sectionMap, selected, savedAssignmentsByFaculty],
	);

	const setSubjectSections = useCallback(
		(subjectId: number, sectionIds: number[]) => {
			updateSelectedAssignments((current) => {
				const nextAssignments = current.filter((assignment) => assignment.subjectId !== subjectId);
				if (sectionIds.length === 0) {
					return nextAssignments;
				}
				return [
					...nextAssignments,
					{ subjectId, sectionIds, gradeLevels: [] },
				];
			});
		},
		[updateSelectedAssignments],
	);

	const discardSelectedDraft = useCallback(() => {
		if (!selected) {
			return;
		}
		pushHistory();
		setDraftAssignmentsByFaculty((previousDrafts) => {
			const nextDrafts = { ...previousDrafts };
			delete nextDrafts[selected.id];
			return nextDrafts;
		});
	}, [pushHistory, selected]);

	const handleSave = useCallback(async () => {
		if (!selected || !activeSchoolYearId) {
			return;
		}
		if (!canPersistAssignments) {
			toast.error('Teaching Load is in read-only mode. Reconnect and refresh live data before saving.');
			return;
		}

		setSaving(true);
		setError(null);
		try {
			await atlasApi.put(`/faculty-assignments/${selected.id}`, {
				schoolId: DEFAULT_SCHOOL_ID,
				schoolYearId: activeSchoolYearId,
				version: selected.version,
				assignments: currentAssignments.map((assignment) => ({
					subjectId: assignment.subjectId,
					sectionIds: assignment.sectionIds,
					gradeLevels: assignment.gradeLevels,
				})),
			});
			await fetchData({ forceRefresh: true });
			setDraftAssignmentsByFaculty((previousDrafts) => {
				const nextDrafts = { ...previousDrafts };
				delete nextDrafts[selected.id];
				return nextDrafts;
			});
			toast.success('Teaching load saved successfully.');
		} catch (requestError: any) {
			const responseCode = requestError?.response?.data?.code as string | undefined;
			const responseMessage = requestError?.response?.data?.message ?? 'Failed to save teaching load.';
			if (responseCode === 'VERSION_CONFLICT') {
				await fetchData({ forceRefresh: true });
				toast.error(`${responseMessage} Latest saved data was reloaded; your local draft remains visible.`);
			} else {
				toast.error(responseMessage);
			}
		} finally {
			setSaving(false);
		}
	}, [activeSchoolYearId, canPersistAssignments, currentAssignments, fetchData, selected]);

	const handleAutoFill = useCallback(async () => {
		if (!activeSchoolYearId) return;
		if (splitBrainQuarantineRequired) {
			toast.error(splitBrainReasonLabel);
			return;
		}
		if (!canPersistAssignments) {
			toast.error('Auto-Fill requires writable runtime evidence. Refresh ATLAS context and try again.');
			return;
		}
		pushHistory();
		setAutoFillLoading(true);
		try {
			const result = await atlasApi.post<AutoFillSummaryResult>(
				'/faculty-assignments/auto-fill',
				{ schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId, coverageMode },
			);
			await fetchData({ forceRefresh: true });
			const { assignmentsCreated, uniqueTeachersAffected, unresolved, teacherXResolution } = result.data;
			setSummaryModalResult(result.data);
			setSummaryModalOpen(true);
			if (assignmentsCreated > 0) {
				toast.success(
					`Assigned ${assignmentsCreated} subject${assignmentsCreated !== 1 ? 's' : ''} across ${uniqueTeachersAffected} teacher${uniqueTeachersAffected !== 1 ? 's' : ''}.`,
				);
			} else if (unresolved > 0) {
				toast.warning(`Auto-Fill: no new assignments made. ${unresolved} pair${unresolved !== 1 ? 's' : ''} remain unresolved.`);
			} else {
				toast.info('Auto-Fill: all subject-section pairs are already assigned.');
			}
			if (coverageMode === 'REAL_FACULTY_THEN_TEACHER_X' && teacherXResolution?.createdPlaceholders) {
				toast.success(
					`Teacher X created ${teacherXResolution.createdPlaceholders} role${teacherXResolution.createdPlaceholders !== 1 ? 's' : ''} and closed ${teacherXResolution.rowsClosedByTeacherX} remaining pair${teacherXResolution.rowsClosedByTeacherX !== 1 ? 's' : ''}.`,
				);
				setShowTemporaryRoles(true);
			}
			if (activeDraftCount > 0) {
				toast.warning('Auto-Fill used saved assignments only. Unsaved drafts were not included.');
			}
		} catch {
			toast.error('Auto-Fill failed. Please try again.');
		} finally {
			setAutoFillLoading(false);
		}
	}, [activeDraftCount, activeSchoolYearId, canPersistAssignments, coverageMode, fetchData, pushHistory, splitBrainQuarantineRequired, splitBrainReasonLabel]);

	const handleViewStaffingNeeds = useCallback(async () => {
		if (!activeSchoolYearId) return;
		if (!canRunStaffingNeeds) {
			toast.error('Staffing needs requires active runtime connectivity. Refresh and try again.');
			return;
		}
		setStaffingNeedsLoading(true);
		try {
			const staffingResult = await atlasApi.post<AutoFillSummaryResult>(
				'/faculty-assignments/report/staffing-needs',
				{ schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId, coverageMode },
			);

			setSummaryModalResult(staffingResult.data);
			setSummaryModalOpen(true);
			toast.info(`Showing staffing needs using ${COVERAGE_MODE_CONFIG[coverageMode].label}.`);
		} catch {
			toast.error('Unable to load staffing needs right now.');
		} finally {
			setStaffingNeedsLoading(false);
		}
	}, [activeSchoolYearId, canRunStaffingNeeds, coverageMode]);

		const handleApplyRealFacultyRecovery = useCallback(async () => {
			if (!activeSchoolYearId) {
				return;
			}
			if (!canPersistAssignments) {
				toast.error('Recovery apply requires writable runtime evidence. Refresh and try again.');
				return;
			}

			setRecoveryApplyLoading(true);
			try {
				const { data } = await atlasApi.post<RealFacultyRecoveryApplyResult>(
					'/faculty-assignments/coverage/recover-real-faculty',
					{ schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId, apply: true },
				);
				await fetchData({ forceRefresh: true });

				if (data.placeholderMovesApplied > 0) {
					toast.success(
						`Saved coverage reconciled: moved ${data.placeholderMovesApplied} row${data.placeholderMovesApplied === 1 ? '' : 's'} to real faculty.`,
					);
				} else {
					toast.info('Recovery apply completed. No additional rows needed reassignment.');
				}

				if (data.blockers.length > 0) {
					toast.warning(`Recovery blockers remain on ${data.blockers.length} row${data.blockers.length === 1 ? '' : 's'}. Review staffing diagnostics.`);
				}
			} catch (requestError: any) {
				toast.error(requestError?.response?.data?.message ?? 'Real-faculty recovery apply failed.');
			} finally {
				setRecoveryApplyLoading(false);
			}
		}, [activeSchoolYearId, canPersistAssignments, fetchData]);

	const handlePreviewSplitBrain = useCallback(async () => {
		if (!activeSchoolYearId) {
			return;
		}
		await fetchSplitBrainIncident(activeSchoolYearId);
		toast.info('Teaching Load incident preview refreshed.');
	}, [activeSchoolYearId, fetchSplitBrainIncident]);

	const handleApplySplitBrainRepair = useCallback(async () => {
		if (!activeSchoolYearId) {
			return;
		}
		if (!canPersistAssignments) {
			toast.error('Split-brain repair apply requires writable runtime evidence.');
			return;
		}

		setSplitBrainApplyLoading(true);
		try {
			await atlasApi.post<TeachingLoadSplitBrainReconcileResult>(
				'/faculty-assignments/integrity/reconcile-split-brain',
				{
					schoolId: DEFAULT_SCHOOL_ID,
					schoolYearId: activeSchoolYearId,
					previewOnly: false,
					confirmApply: true,
				},
			);
			toast.success('Applied split-brain reconciliation workflow. Reloading current Teaching Load truth.');
			await fetchData({ forceRefresh: true });
		} catch (requestError: any) {
			toast.error(requestError?.response?.data?.message ?? 'Split-brain reconciliation apply failed.');
		} finally {
			setSplitBrainApplyLoading(false);
		}
	}, [activeSchoolYearId, canPersistAssignments, fetchData]);

	const openGlobalResetPreview = useCallback(async () => {
		if (!activeSchoolYearId) return;
		if (!canRunGlobalReset) {
			toast.error('Global reset is restricted to live-upstream mode.');
			return;
		}
		setResetLoading(true);
		try {
			const { data } = await atlasApi.post<TeachingLoadResetPreview>(
				'/faculty-assignments/reset',
				{ schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId, previewOnly: true },
			);
			setResetPreview(data);
			setResetConfirmText('');
			setResetDialogOpen(true);
		} catch (requestError: any) {
			toast.error(requestError?.response?.data?.message ?? 'Failed to preview global teaching-load reset.');
		} finally {
			setResetLoading(false);
		}
	}, [activeSchoolYearId, canRunGlobalReset]);

	const applyGlobalReset = useCallback(async () => {
		if (!activeSchoolYearId) return;
		if (!canRunGlobalReset) {
			toast.error('Global reset is restricted to live-upstream mode.');
			return;
		}
		if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
			toast.error('Type RESET to confirm global teaching-load reset.');
			return;
		}

		setResetLoading(true);
		try {
			const { data } = await atlasApi.post<TeachingLoadResetPreview>(
				'/faculty-assignments/reset',
				{ schoolId: DEFAULT_SCHOOL_ID, schoolYearId: activeSchoolYearId, previewOnly: false, confirmReset: true },
			);
			toast.success(`Global teaching-load reset removed ${data.ownershipRowsToRemove} ownership rows.`);
			setResetDialogOpen(false);
			setResetConfirmText('');
			await fetchData({ forceRefresh: true });
		} catch (requestError: any) {
			toast.error(requestError?.response?.data?.message ?? 'Failed to apply global teaching-load reset.');
		} finally {
			setResetLoading(false);
		}
	}, [activeSchoolYearId, canRunGlobalReset, fetchData, resetConfirmText]);

	const getComparableLoadHours = useCallback((member: FacultySummary) => {
		if (member.isPlaceholder) {
			return member.gradeTeachingHours ?? member.syntheticCoverageHours ?? 0;
		}
		return member.policyCreditedHours ?? member.subjectHours ?? 0;
	}, []);

	const filteredFaculty = useMemo(() => {
		let nextFaculty = faculty;
		if (!showTemporaryRoles) {
			nextFaculty = nextFaculty.filter((member) => !member.isPlaceholder);
		}
		if (searchQuery.trim()) {
			const normalizedQuery = searchQuery.toLowerCase();
			nextFaculty = nextFaculty.filter(
				(member) =>
					member.firstName.toLowerCase().includes(normalizedQuery)
					|| member.lastName.toLowerCase().includes(normalizedQuery)
					|| (member.department ?? '').toLowerCase().includes(normalizedQuery),
			);
		}
		if (filterStatus === 'assigned') {
			nextFaculty = nextFaculty.filter((member) => (effectiveAssignmentsByFaculty[member.id]?.length ?? 0) > 0);
		} else if (filterStatus === 'unassigned') {
			nextFaculty = nextFaculty.filter((member) => (effectiveAssignmentsByFaculty[member.id]?.length ?? 0) === 0);
		}
		if (departmentFilter !== 'all') {
			nextFaculty = nextFaculty.filter((member) => member.department === departmentFilter);
		}

		nextFaculty = nextFaculty.filter((member) => {
			if (member.isPlaceholder) {
				return showTemporaryRoles && loadFilter === 'all';
			}
			const load = getComparableLoadHours(member);
			if (loadFilter === 'overloaded') return load > 30;
			if (loadFilter === 'optimal') return load >= 25 && load <= 30;
			if (loadFilter === 'underloaded') return load < 25;
			return true;
		});

		nextFaculty = [...nextFaculty].sort((left, right) => {
			const leftLoad = getComparableLoadHours(left);
			const rightLoad = getComparableLoadHours(right);
			if (sortOrder === 'load-asc') {
				if (leftLoad !== rightLoad) return leftLoad - rightLoad;
			} else if (leftLoad !== rightLoad) {
				return rightLoad - leftLoad;
			}
			return `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`);
		});

		return nextFaculty;
	}, [departmentFilter, faculty, filterStatus, getComparableLoadHours, loadFilter, searchQuery, showTemporaryRoles, sortOrder]);

	const groupedFaculty = useMemo(() => {
		const grouped = new Map<string, FacultySummary[]>();
		for (const member of filteredFaculty) {
			const department = member.isPlaceholder
				? 'UNSTAFFED TEMPORARY ROLES'
				: member.department?.trim() || 'UNASSIGNED DEPARTMENT';
			const bucket = grouped.get(department) ?? [];
			bucket.push(member);
			grouped.set(department, bucket);
		}
		return Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right));
	}, [filteredFaculty]);

	const { departmentQualifiedSubjects, outsideDepartmentSubjects } = useMemo(() => {
		const normalizeDepartmentCode = (value: string | null | undefined): string => {
			const normalized = (value ?? '').trim().toUpperCase();
			if (!normalized) return '';
			const table: Record<string, string> = {
				SCIENCE: 'SCI',
				SCI: 'SCI',
				MATHEMATICS: 'MATH',
				MATH: 'MATH',
				ENGLISH: 'ENG',
				ENG: 'ENG',
				FILIPINO: 'FIL',
				FIL: 'FIL',
				MAPEH: 'MAPEH',
				ESP: 'ESP',
				VALUES: 'ESP',
				'VALUES EDUCATION': 'ESP',
				AP: 'AP',
				'SOCIAL STUDIES': 'AP',
				'ARALING PANLIPUNAN': 'AP',
				TLE: 'TLE',
				LANGUAGES: 'ENG',
				SPA: 'SPA',
				SPS: 'SPS',
			};
			return table[normalized] ?? normalized;
		};

		const matchesOwnershipDepartment = (facultyDepartment: string | null | undefined, subject: Subject): boolean => {
			const ownerDepartments = [
				...(subject.ownerDepartment ? [subject.ownerDepartment] : []),
				...(subject.allowedOwnerDepartments ?? []),
			]
				.map((value) => normalizeDepartmentCode(value))
				.filter((value): value is string => Boolean(value));

			if (ownerDepartments.length > 0) {
				const normalizedFaculty = normalizeDepartmentCode(facultyDepartment);
				if (!normalizedFaculty) return false;
				if (ownerDepartments.includes(normalizedFaculty)) return true;
				if ((ownerDepartments.includes('ENG') || ownerDepartments.includes('FIL')) && normalizedFaculty === 'ENG') return true;
				return false;
			}

			return isDepartmentMatch(facultyDepartment ?? null, subject.code, subject.name);
		};

		const qualified: Subject[] = [];
		const outside: Subject[] = [];

		for (const subject of subjects) {
			const isHgSubject = subject.code === 'HG' || subject.name.toLowerCase().includes('homeroom');
			const departmentQualified = matchesOwnershipDepartment(selected?.department ?? null, subject);
			if ((isHgSubject && selected?.isClassAdviser) || departmentQualified) {
				qualified.push(subject);
			} else {
				outside.push(subject);
			}
		}

		const sortByHR = (a: Subject, b: Subject) => {
			const aIsHR = a.name.toLowerCase().includes('homeroom') || a.code.toLowerCase().includes('homeroom');
			const bIsHR = b.name.toLowerCase().includes('homeroom') || b.code.toLowerCase().includes('homeroom');
			if (aIsHR && !bIsHR) return 1;
			if (!aIsHR && bIsHR) return -1;
			return a.name.localeCompare(b.name);
		};

		qualified.sort(sortByHR);
		outside.sort(sortByHR);

		return {
			departmentQualifiedSubjects: qualified,
			outsideDepartmentSubjects: outside,
		};
	}, [selected, subjects]);

	const rotationHoverStateByFamily = useMemo(() => {
		type FamilyState = {
			termLaneMinutes: Map<number, Map<number, number>>;
			termTotals: Map<number, number>;
			peakMinutes: number;
		};

		const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
		const familyStateByFamily = new Map<string, FamilyState>();

		for (const assignment of currentAssignments) {
			const subject = subjectById.get(assignment.subjectId);
			if (!subject) {
				continue;
			}

			const family = (subject.rotationFamily ?? '').trim().toUpperCase();
			if (family.length === 0) {
				continue;
			}

			const termKey = (() => {
				const rank = resolveRotationTermRank(subject);
				return rank > 0 ? rank : 0;
			})();
			const perUnitMinutes = Math.max(0, Number(subject.minMinutesPerWeek) || 0);

			const familyState = familyStateByFamily.get(family) ?? {
				termLaneMinutes: new Map<number, Map<number, number>>(),
				termTotals: new Map<number, number>(),
				peakMinutes: 0,
			};
			const laneMinutes = familyState.termLaneMinutes.get(termKey) ?? new Map<number, number>();

			for (const sectionId of assignment.sectionIds) {
				const currentMinutes = laneMinutes.get(sectionId) ?? 0;
				if (perUnitMinutes > currentMinutes) {
					laneMinutes.set(sectionId, perUnitMinutes);
				}
			}

			familyState.termLaneMinutes.set(termKey, laneMinutes);
			familyStateByFamily.set(family, familyState);
		}

		for (const familyState of familyStateByFamily.values()) {
			let peakMinutes = 0;
			for (const [termKey, laneMinutes] of familyState.termLaneMinutes.entries()) {
				const termTotal = Array.from(laneMinutes.values()).reduce((sum, value) => sum + value, 0);
				familyState.termTotals.set(termKey, termTotal);
				if (termTotal > peakMinutes) {
					peakMinutes = termTotal;
				}
			}
			familyState.peakMinutes = peakMinutes;
		}

		return familyStateByFamily;
	}, [currentAssignments, subjects]);

	const resolveSectionHoverDeltaMinutes = useCallback((subject: Subject, sectionId: number): number => {
		const perUnitMinutes = Math.max(0, Number(subject.minMinutesPerWeek) || 0);
		if (perUnitMinutes <= 0) {
			return 0;
		}

		const family = (subject.rotationFamily ?? '').trim().toUpperCase();
		if (family.length === 0) {
			return perUnitMinutes;
		}

		const termRank = resolveRotationTermRank(subject);
		const termKey = termRank > 0 ? termRank : 0;
		const familyState = rotationHoverStateByFamily.get(family);
		const laneMinutes = familyState?.termLaneMinutes.get(termKey);
		const currentLaneMinutes = laneMinutes?.get(sectionId) ?? 0;
		const laneIncrease = Math.max(0, perUnitMinutes - currentLaneMinutes);
		if (laneIncrease <= 0) {
			return 0;
		}

		const currentTermTotal = familyState?.termTotals.get(termKey) ?? 0;
		const currentPeak = familyState?.peakMinutes ?? 0;
		const nextTermTotal = currentTermTotal + laneIncrease;
		return Math.max(0, nextTermTotal - currentPeak);
	}, [rotationHoverStateByFamily]);

	const loadProfile = useMemo(() => {
		const profile = buildTeachingLoadProfile(
			currentAssignments,
			subjects,
			sectionMap,
			(selected?.isClassAdviser
				? selected.advisoryEquivalentHours || CLASS_ADVISER_EQUIVALENT_HOURS
				: 0) + ((selected?.ancillaryMinutesPerWeek || 0) / 60),
		);
		return {
			...profile,
			remainingHours: Math.round(((selected?.maxHoursPerWeek || 0) - profile.creditedTotalHours) * 10) / 10,
		};
	}, [currentAssignments, sectionMap, selected, subjects]);

	const sectionsBySubject = useMemo(() => {
		const specializationBySubjectSection = new Map<string, { code: string | null; label: string | null }>();
		for (const assignment of selected?.assignments ?? []) {
			for (const section of assignment.sections ?? []) {
				specializationBySubjectSection.set(`${assignment.subjectId}:${section.id}`, {
					code: section.assignmentSpecializationCode ?? null,
					label: section.assignmentSpecializationLabel ?? null,
				});
			}
		}

		const map: Record<number, ExternalSection[]> = {};
		subjects.forEach((subject) => {
			map[subject.id] = allKnownSections.filter((sec) => {
				const gradeCompatible = subject.gradeLevels.length === 0 || subject.gradeLevels.includes(sec.displayOrder);
				if (!gradeCompatible) return false;
				const programType = (sec.programType ?? 'REGULAR').toUpperCase();
				return subject.programScopes.length === 0 || subject.programScopes.some((scope) => scope.toUpperCase() === programType);
			}).map((section) => {
				const specialization = specializationBySubjectSection.get(`${subject.id}:${section.id}`);
				if (!specialization) {
					return section;
				}

				return {
					...section,
					assignmentSpecializationCode: specialization.code,
					assignmentSpecializationLabel: specialization.label,
					assignmentRotationFamily: section.assignmentRotationFamily ?? null,
					assignmentRotationLaneId: section.assignmentRotationLaneId ?? null,
					assignmentRotationTermRank: section.assignmentRotationTermRank ?? null,
					assignmentRotationTermLabel: section.assignmentRotationTermLabel ?? null,
					assignmentRotationTermGroupId: section.assignmentRotationTermGroupId ?? null,
					assignmentRotationTermCount: section.assignmentRotationTermCount ?? null,
					assignmentRawMinutesPerWeek: section.assignmentRawMinutesPerWeek ?? null,
					assignmentConcurrentDeltaMinutesPerWeek: section.assignmentConcurrentDeltaMinutesPerWeek ?? null,
					assignmentExpandsConcurrentDemand: section.assignmentExpandsConcurrentDemand ?? null,
				};
			});
		});
		return map;
	}, [allKnownSections, selected?.assignments, subjects]);

	const rotationTermBreakdown = useMemo<RotationFamilyTermBreakdown[]>(() => {
		if (Array.isArray(selected?.rotationTermBreakdown) && selected.rotationTermBreakdown.length > 0 && !dirty) {
			return selected.rotationTermBreakdown
				.map((family) => {
					const normalizedBuckets = (family.termBuckets ?? [])
						.map((bucket) => ({
							...bucket,
							termLabel: resolveCanonicalRotationTermLabel(bucket.termLabel, bucket.termRank),
						}))
						.sort((left, right) => {
							const leftRank = typeof left.termRank === 'number' && left.termRank > 0 ? left.termRank : 0;
							const rightRank = typeof right.termRank === 'number' && right.termRank > 0 ? right.termRank : 0;
							if (leftRank !== rightRank) {
								return leftRank - rightRank;
							}
							return right.creditedMinutesPerWeek - left.creditedMinutesPerWeek;
						});

					const peakTermMinutesPerWeek = [...normalizedBuckets]
						.reduce((max, b) => Math.max(max, b.creditedMinutesPerWeek), 0);

					const peakBuckets = normalizedBuckets.filter(b => b.creditedMinutesPerWeek === peakTermMinutesPerWeek && b.creditedMinutesPerWeek > 0);
					const peakTermLabels = peakBuckets
						.map(b => resolveCanonicalRotationTermLabel(b.termLabel, b.termRank))
						.filter(Boolean) as string[];

					return {
						...family,
						peakTermMinutesPerWeek,
						peakTermLabel: peakTermLabels.length > 1 ? `Tied: ${peakTermLabels.join(', ')}` : (peakTermLabels[0] ?? family.peakTermLabel),
						termBuckets: normalizedBuckets.map((bucket) => ({
							...bucket,
							isPeakTerm:
								(bucket.isPeakTerm ?? false)
								|| (peakTermMinutesPerWeek > 0 && bucket.creditedMinutesPerWeek === peakTermMinutesPerWeek),
						})),
					};
				})
				.sort((left, right) => right.peakTermMinutesPerWeek - left.peakTermMinutesPerWeek || left.family.localeCompare(right.family));
		}

		const familyMap = new Map<string, {
			rawMinutesPerWeek: number;
			termBuckets: Map<number, {
				termRank: number | null;
				termLabel: string | null;
				termGroupId: string | null;
				termCount: number | null;
				rawMinutesPerWeek: number;
				laneMinutesBySection: Map<number, number>;
				sectionNamesById: Map<number, string>;
				subjectCodes: Set<string>;
				subjectIds: Set<number>;
			}>;
		}>();

		for (const entry of loadProfile.breakdown) {
			const family = (entry.rotationFamily ?? '').trim().toUpperCase();
			if (family.length === 0) {
				continue;
			}

			const termRank = typeof entry.rotationTermRank === 'number' && Number.isInteger(entry.rotationTermRank) && entry.rotationTermRank > 0
				? entry.rotationTermRank
				: null;
			const termKey = termRank ?? 0;

			const familyEntry = familyMap.get(family) ?? {
				rawMinutesPerWeek: 0,
				termBuckets: new Map(),
			};
			const termBucket = familyEntry.termBuckets.get(termKey) ?? {
				termRank,
				termLabel: resolveCanonicalRotationTermLabel(entry.rotationTermLabel, termRank),
				termGroupId: entry.rotationTermGroupId ?? null,
				termCount: entry.rotationTermCount ?? null,
				rawMinutesPerWeek: 0,
				laneMinutesBySection: new Map<number, number>(),
				sectionNamesById: new Map<number, string>(),
				subjectCodes: new Set<string>(),
				subjectIds: new Set<number>(),
			};

			termBucket.rawMinutesPerWeek += Math.max(0, entry.minutesPerWeek);
			familyEntry.rawMinutesPerWeek += Math.max(0, entry.minutesPerWeek);

			const existingLaneMinutes = termBucket.laneMinutesBySection.get(entry.sectionId) ?? 0;
			if (entry.minutesPerWeek > existingLaneMinutes) {
				termBucket.laneMinutesBySection.set(entry.sectionId, entry.minutesPerWeek);
			}
			termBucket.sectionNamesById.set(entry.sectionId, entry.sectionName);
			termBucket.subjectCodes.add(entry.subjectCode);
			termBucket.subjectIds.add(entry.subjectId);

			familyEntry.termBuckets.set(termKey, termBucket);
			familyMap.set(family, familyEntry);
		}

		return Array.from(familyMap.entries())
			.map(([family, familyEntry]) => {
				const termBuckets = Array.from(familyEntry.termBuckets.values())
					.map((bucket) => {
						const sectionIds = Array.from(bucket.laneMinutesBySection.keys()).sort((left, right) => left - right);
						const creditedMinutesPerWeek = Array.from(bucket.laneMinutesBySection.values()).reduce((sum, value) => sum + value, 0);
						return {
							termRank: bucket.termRank,
							termLabel: resolveCanonicalRotationTermLabel(bucket.termLabel, bucket.termRank),
							termGroupId: bucket.termGroupId,
							termCount: bucket.termCount,
							rawMinutesPerWeek: bucket.rawMinutesPerWeek,
							creditedMinutesPerWeek,
							isPeakTerm: false,
							sectionIds,
							sectionNames: sectionIds.map((sectionId) => bucket.sectionNamesById.get(sectionId) ?? `Section ${sectionId}`),
							subjectCodes: Array.from(bucket.subjectCodes).sort((left, right) => left.localeCompare(right)),
							subjectIds: Array.from(bucket.subjectIds).sort((left, right) => left - right),
						};
					})
					.sort((left, right) => {
						const leftRank = typeof left.termRank === 'number' && left.termRank > 0 ? left.termRank : 0;
						const rightRank = typeof right.termRank === 'number' && right.termRank > 0 ? right.termRank : 0;
						if (leftRank !== rightRank) {
							return leftRank - rightRank;
						}
						return right.creditedMinutesPerWeek - left.creditedMinutesPerWeek;
					});

				const peakTermMinutesPerWeek = [...termBuckets]
					.reduce((max, b) => Math.max(max, b.creditedMinutesPerWeek), 0);

				const peakBuckets = termBuckets.filter(b => b.creditedMinutesPerWeek === peakTermMinutesPerWeek && b.creditedMinutesPerWeek > 0);
				const peakTermLabels = peakBuckets
					.map(b => resolveCanonicalRotationTermLabel(b.termLabel, b.termRank))
					.filter(Boolean) as string[];

				return {
					family,
					rawMinutesPerWeek: familyEntry.rawMinutesPerWeek,
					peakTermMinutesPerWeek,
					peakTermRank: peakBuckets[0]?.termRank ?? null,
					peakTermLabel: peakTermLabels.length > 1 ? `Tied: ${peakTermLabels.join(', ')}` : (peakTermLabels[0] ?? null),
					termGroupId: peakBuckets[0]?.termGroupId ?? null,
					termCount: peakBuckets[0]?.termCount ?? null,
					termBuckets: termBuckets.map((bucket) => ({
						...bucket,
						isPeakTerm:
							peakTermMinutesPerWeek > 0
							&& bucket.creditedMinutesPerWeek === peakTermMinutesPerWeek,
					})),
				};
			})
			.sort((left, right) => right.peakTermMinutesPerWeek - left.peakTermMinutesPerWeek || left.family.localeCompare(right.family));
	}, [dirty, loadProfile.breakdown, selected?.rotationTermBreakdown]);

	const rotationFamilyDetails = useMemo(() => {
		if (Array.isArray(selected?.rotationFamilyLoadDetails) && selected.rotationFamilyLoadDetails.length > 0 && !dirty) {
			return selected.rotationFamilyLoadDetails;
		}
		const computedFamilies = Array.isArray((loadProfile as any).rotationFamilies)
			? (loadProfile as any).rotationFamilies
			: [];
		return computedFamilies.map((family: any) => ({
			family: family.family,
			rawHours: family.rawHours,
			creditedHours: family.creditedHours,
			overcountHours: family.overcountHours,
			unitCount: family.unitCount,
			dominantTermRank: family.dominantTermRank ?? null,
			dominantTermLabel: family.dominantTermLabel ?? null,
			termGroupId: family.termGroupId ?? null,
			termCount: family.termCount ?? null,
			termBuckets: family.termBuckets ?? [],
			subjectCodes: family.subjectCodes,
			subjectIds: [],
		}));
	}, [dirty, loadProfile.rotationFamilies, selected?.rotationFamilyLoadDetails]);

	const rotationOvercountHours = useMemo(() => {
		if (selected?.rotationFamilyOvercountHours != null && !dirty) {
			return selected.rotationFamilyOvercountHours;
		}
		return loadProfile.rotationOvercountHours;
	}, [dirty, loadProfile.rotationOvercountHours, selected?.rotationFamilyOvercountHours]);

	const loadCapMinutes = useMemo(() => {
		if (!selected) return 0;
		return Math.min(selected.maxHoursPerWeek * 60, 2400);
	}, [selected]);

	const remainingCapacityMinutes = useMemo(() => {
		return loadProfile.remainingHours * 60;
	}, [loadProfile.remainingHours]);

	const previewLoadHours = useMemo(() => {
		if (hoveredIncomingMinutes <= 0) return loadProfile.creditedTotalHours;
		return Math.round(((loadProfile.creditedTotalHours * 60 + hoveredIncomingMinutes) / 60) * 10) / 10;
	}, [hoveredIncomingMinutes, loadProfile.creditedTotalHours]);

	const departmentOptions = useMemo(
		() => Array.from(new Set(faculty.map((member) => member.department).filter(Boolean) as string[])).sort(),
		[faculty],
	);

	const advisedSectionMeta = useMemo(() => {
		if (!homeroomHint?.advisedSectionId) {
			return null;
		}
		const section = sectionMap.get(homeroomHint.advisedSectionId);
		if (!section) {
			return null;
		}
		return {
			gradeLevel: section.displayOrder,
			sectionName: section.name,
		};
	}, [homeroomHint?.advisedSectionId, sectionMap]);

	const coverageHeadline = useMemo(() => {
		if (coverageTotals) {
			const activeAssigned = Number.isFinite(coverageTotals.activeAssignedPairs)
				? Math.max(0, coverageTotals.activeAssignedPairs ?? 0)
				: Math.max(0, coverageTotals.assignedPairs);
			const realAssigned = Number.isFinite(coverageTotals.realFacultyAssignedPairs)
				? coverageTotals.realFacultyAssignedPairs
				: Math.max(0, coverageTotals.assignedPairs - (coverageTotals.syntheticPlaceholderPairs ?? 0));
			const syntheticAssigned = Number.isFinite(coverageTotals.syntheticPlaceholderPairs)
				? coverageTotals.syntheticPlaceholderPairs
				: Math.max(0, coverageTotals.assignedPairs - realAssigned);
			const assigned = Math.max(0, activeAssigned);
			const total = Math.max(0, coverageTotals.totalPairs);
			const unassigned = Number.isFinite(coverageTotals.unassignedPairs)
				? Math.max(0, coverageTotals.unassignedPairs)
				: Math.max(0, total - assigned);
			const rawAssigned = Number.isFinite(coverageTotals.rawAssignedPairs)
				? Math.max(0, coverageTotals.rawAssignedPairs ?? 0)
				: assigned;
			const rawUnassigned = Number.isFinite(coverageTotals.rawUnassignedPairs)
				? Math.max(0, coverageTotals.rawUnassignedPairs ?? 0)
				: Math.max(0, total - rawAssigned);
			return {
				total,
				assigned,
				realAssigned,
				syntheticAssigned,
				unassigned,
				rawAssigned,
				rawUnassigned,
			};
		}

		return { total: 0, assigned: 0, realAssigned: 0, syntheticAssigned: 0, unassigned: 0, rawAssigned: 0, rawUnassigned: 0 };
	}, [coverageTotals]);

	const assignedFacultyCount = faculty.filter((member) => !member.isPlaceholder && (effectiveAssignmentsByFaculty[member.id]?.length ?? 0) > 0).length;
	const realFacultyCount = faculty.filter((member) => !member.isPlaceholder).length;
	const syntheticCoverageTeachers = useMemo(
		() => faculty.filter((member) => member.isPlaceholder && (effectiveAssignmentsByFaculty[member.id]?.length ?? 0) > 0),
		[effectiveAssignmentsByFaculty, faculty],
	);
	const syntheticCoverageHours = useMemo(
		() => syntheticCoverageTeachers.reduce((sum, member) => sum + (member.syntheticCoverageHours ?? member.sectionTeachingHours ?? 0), 0),
		[syntheticCoverageTeachers],
	);
	const teacherXRoster = useMemo(
		() => faculty.filter((member) => member.isPlaceholder).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)),
		[faculty],
	);
	const selectTeacherXPlaceholder = useCallback(() => {
		if (teacherXRoster.length === 0) {
			toast.info('No Teacher X roles exist yet. Run Auto-Fill with Teacher X mode to create placeholders.');
			return;
		}
		setShowTemporaryRoles(true);
		setSelectedId(teacherXRoster[0].id);
		toast.success('Teacher X roster is now visible. You can assign sections manually and save.');
	}, [teacherXRoster]);
	const toggleTeacherXRoster = useCallback(() => {
		if (showTemporaryRoles) {
			setShowTemporaryRoles(false);
			if (selected?.isPlaceholder) {
				setSelectedId(null);
			}
			toast.info('Teacher X placeholders are now hidden from the faculty roster.');
			return;
		}
		selectTeacherXPlaceholder();
	}, [selectTeacherXPlaceholder, selected?.isPlaceholder, showTemporaryRoles]);
	const coverageModeConfig = COVERAGE_MODE_CONFIG[coverageMode];
	const sectionsAvailable = Boolean(sectionSummary && sectionSummary.sections.length > 0);

	const departmentStats = useMemo(() => {
		const statsMap = new Map<string, { total: number; assigned: number }>();
		
		subjects.forEach(subject => {
			if (!subject.isActive || subject.code === 'HG') return;
			const dept = subject.ownerDepartment || 'General';
			const current = statsMap.get(dept) ?? { total: 0, assigned: 0 };
			
			const relevantSections = allKnownSections.filter(sec => {
				const gradeCompatible = subject.gradeLevels.length === 0 || subject.gradeLevels.includes(sec.displayOrder);
				if (!gradeCompatible) return false;
				const programType = (sec.programType ?? 'REGULAR').toUpperCase();
				return subject.programScopes.length === 0 || subject.programScopes.some(s => s.toUpperCase() === programType);
			});

			current.total += relevantSections.length;
			relevantSections.forEach(sec => {
				const key = getAssignmentOwnershipKey(subject.id, sec.id);
				const owner = savedOwnershipMap[key] || pendingOwnershipMap[key];
				if (owner && activeFacultyIds.has(owner.facultyId)) {
					current.assigned += 1;
				}
			});
			statsMap.set(dept, current);
		});

		return Array.from(statsMap.entries())
			.map(([name, { total, assigned }]) => ({
				name,
				percent: total > 0 ? Math.round((assigned / total) * 100) : 0
			}))
			.sort((a, b) => b.percent - a.percent);
	}, [subjects, allKnownSections, savedOwnershipMap, pendingOwnershipMap, activeFacultyIds]);

	const pendingChangeLedger = useMemo(() => {
		const changes: { facultyName: string; count: number; type: 'add' | 'remove' | 'mix' }[] = [];
		
		for (const [facultyIdRaw, draft] of Object.entries(effectiveDraftAssignmentsByFaculty)) {
			const facultyId = Number(facultyIdRaw);
			const facultyName = facultyNames[facultyId] ?? `Teacher ${facultyId}`;
			const savedCount = (savedAssignmentsByFaculty[facultyId] ?? []).reduce((sum, a) => sum + a.sectionIds.length, 0);
			const draftCount = draft.reduce((sum, a) => sum + a.sectionIds.length, 0);
			
			changes.push({
				facultyName,
				count: Math.abs(draftCount - savedCount),
				type: draftCount > savedCount ? 'add' : draftCount < savedCount ? 'remove' : 'mix'
			});
		}
		return changes;
	}, [effectiveDraftAssignmentsByFaculty, facultyNames, savedAssignmentsByFaculty]);

	const jumpListItems = useMemo(() => {
		return [
			...departmentQualifiedSubjects.map(s => ({ id: s.id, code: s.code, type: 'qualified' })),
			...outsideDepartmentSubjects.map(s => ({ id: s.id, code: s.code, type: 'outside' }))
		];
	}, [departmentQualifiedSubjects, outsideDepartmentSubjects]);

	const executeSwap = useCallback(() => {
		if (splitBrainQuarantineRequired) {
			toast.error(splitBrainReasonLabel);
			return;
		}
		if (!canPersistAssignments) {
			toast.error('Teaching Load cannot swap ownership while runtime evidence is read-only.');
			return;
		}
		if (!selected || !swapCandidate) return;

		const { subjectId, sectionId, fromFacultyId } = swapCandidate;
		pushHistory();
		setDraftAssignmentsByFaculty((previousDrafts) => {
			const nextDrafts = { ...previousDrafts };

			const fromCurrent = cloneAssignments(previousDrafts[fromFacultyId] ?? savedAssignmentsByFaculty[fromFacultyId] ?? []);
			const fromNext = normalizeDraftAssignments(
				fromCurrent
					.map((assignment) =>
						assignment.subjectId === subjectId
							? { ...assignment, sectionIds: assignment.sectionIds.filter((id: number) => id !== sectionId) }
							: assignment,
					)
					.filter((assignment) => assignment.sectionIds.length > 0),
				sectionMap,
			);
			const fromSavedSignature = buildAssignmentSignature(savedAssignmentsByFaculty[fromFacultyId] ?? []);
			if (buildAssignmentSignature(fromNext) === fromSavedSignature) {
				delete nextDrafts[fromFacultyId];
			} else {
				nextDrafts[fromFacultyId] = fromNext;
			}

			const selectedCurrent = cloneAssignments(previousDrafts[selected.id] ?? savedAssignmentsByFaculty[selected.id] ?? []);
			const selectedMap = new Map(selectedCurrent.map((assignment) => [assignment.subjectId, assignment]));
			const existing = selectedMap.get(subjectId);
			if (existing) {
				if (!existing.sectionIds.includes(sectionId)) {
					existing.sectionIds = [...existing.sectionIds, sectionId];
				}
			} else {
				selectedMap.set(subjectId, { subjectId, sectionIds: [sectionId], gradeLevels: [] });
			}
			const selectedNext = normalizeDraftAssignments(Array.from(selectedMap.values()), sectionMap);
			const selectedSavedSignature = buildAssignmentSignature(savedAssignmentsByFaculty[selected.id] ?? []);
			if (buildAssignmentSignature(selectedNext) === selectedSavedSignature) {
				delete nextDrafts[selected.id];
			} else {
				nextDrafts[selected.id] = selectedNext;
			}

			return nextDrafts;
		});

		setSwapCandidate(null);
		toast.success('Ownership swapped to the selected teacher in draft mode. Save to persist changes.');
	}, [canPersistAssignments, pushHistory, savedAssignmentsByFaculty, sectionMap, selected, splitBrainQuarantineRequired, splitBrainReasonLabel, swapCandidate]);

	const handleSwapRequest = (subjectId: number, sectionId: number, fromFacultyId: number) => {
		setSwapCandidate({ subjectId, sectionId, fromFacultyId });
	};

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex h-[calc(100svh-3.5rem)] flex-col px-6">
				{error && (
					<div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
						<span>{error}</span>
						<Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-7 px-2 text-red-700 hover:bg-red-100 hover:text-red-800 font-bold">
							Dismiss
						</Button>
					</div>
				)}

				{splitBrainIncident && splitBrainIncident.quarantine.severity !== 'NONE' && (splitBrainIncident.quarantine.required || splitBrainIncident.counters.truthRowsToUpdate > 0 || (splitBrainIncident.counters.integrityMissingOwnershipPairs ?? 0) > 0 || (splitBrainIncident.counters.integrityOwnershipWithoutScopePairs ?? 0) > 0) && (
					<div className={cn(
						'mt-2 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs font-semibold',
						splitBrainIncident.quarantine.required
							? 'border-rose-200 bg-rose-50 text-rose-900'
							: 'border-amber-200 bg-amber-50 text-amber-900',
					)}>
						<div className="flex min-w-0 flex-col gap-0.5">
							<span className="font-semibold uppercase tracking-[0.12em]">
								{splitBrainIncident.quarantine.required ? 'Data Truth Quarantine Active' : 'Data Truth Warning'}
							</span>
							<span className="truncate">{splitBrainIncident.quarantine.message}</span>
							<span className="text-[0.65rem] font-bold uppercase tracking-tight opacity-80">
								Pending: {splitBrainIncident.counters.truthRowsToUpdate} truth rows * {splitBrainIncident.counters.realFacultyMovesPlanned} recoverable moves * {splitBrainIncident.counters.trueLoadOutlierRows ?? splitBrainIncident.counters.overloadedFacultyRows} true outliers * {splitBrainIncident.counters.loadReviewRows ?? 0} review-only overloads
							</span>
							<span className="text-[0.62rem] font-semibold uppercase tracking-tight opacity-75">
								Integrity: {splitBrainIncident.counters.integrityMissingOwnershipPairs} missing ownership * {splitBrainIncident.counters.integrityOwnershipWithoutScopePairs} ownership-without-scope * {splitBrainIncident.counters.integrityOutOfSubjectScopePairs ?? 0} out-of-subject-scope
							</span>
							{(splitBrainIncident.repairPreview.realFacultyRecovery.blockers?.[0]?.reason || splitBrainIncident.repairPreview.loadOutliers?.rows?.[0]) && (
								<span className="text-[0.62rem] font-semibold tracking-tight opacity-75">
									{splitBrainIncident.repairPreview.realFacultyRecovery.blockers?.[0]?.reason
										? `Top blocker: ${splitBrainIncident.repairPreview.realFacultyRecovery.blockers[0].reason}`
										: `Top outlier: ${splitBrainIncident.repairPreview.loadOutliers?.rows?.[0]?.facultyName} (${Math.round((splitBrainIncident.repairPreview.loadOutliers?.rows?.[0]?.overloadHours ?? 0) * 10) / 10}h over cap)`}
								</span>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[0.65rem] font-bold uppercase" onClick={handlePreviewSplitBrain} disabled={splitBrainLoading}>
								{splitBrainLoading ? 'Refreshing...' : 'Refresh Incident'}
							</Button>
							<Button type="button" size="sm" className="h-7 px-2 text-[0.65rem] font-bold uppercase" onClick={handleApplySplitBrainRepair} disabled={splitBrainApplyLoading || !canPersistAssignments}>
								{splitBrainApplyLoading ? 'Applying...' : 'Apply Repair'}
							</Button>
						</div>
					</div>
				)}

				{!splitBrainQuarantineRequired && splitBrainIncident && splitBrainIncident.quarantine.severity === 'WARNING' && splitBrainIncident.counters.truthRowsToUpdate === 0 && (splitBrainIncident.counters.integrityMissingOwnershipPairs ?? 0) === 0 && (splitBrainIncident.counters.integrityOwnershipWithoutScopePairs ?? 0) === 0 && (
					<div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-amber-100 bg-amber-50/50 px-3 py-1.5 text-[0.65rem] font-bold text-amber-800">
						<div className="flex items-center gap-2">
							<AlertTriangle className="size-3 text-amber-600" />
							<span className="uppercase tracking-tight">Review Required:</span>
							<span className="font-medium opacity-90">{splitBrainIncident.quarantine.message}</span>
							<span className="opacity-40">*</span>
							<span className="opacity-80">
								{splitBrainIncident.counters.loadReviewRows ?? 0} Overloads
							</span>
						</div>
						<Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[0.6rem] font-bold uppercase text-amber-700 hover:bg-amber-100/50" onClick={handleViewStaffingNeeds}>
							View Details
						</Button>
					</div>
				)}

				<div className="flex items-center justify-between gap-4 py-1">
					<div className="flex-1 min-w-0">
						<OverviewHeader
							realAssignedPairs={coverageHeadline.realAssigned}
							syntheticPlaceholderPairs={coverageHeadline.syntheticAssigned}
							unassignedPairs={coverageHeadline.unassigned}
							rawUnassignedPairs={coverageHeadline.rawUnassigned}
							totalPairs={coverageHeadline.total}
							assignedFacultyCount={assignedFacultyCount}
							totalFacultyCount={realFacultyCount}
							activeDraftCount={activeDraftCount}
							autoFillLoading={autoFillLoading}
							staffingNeedsLoading={staffingNeedsLoading}
							autoFillEnabled={Boolean(activeSchoolYearId) && canPersistAssignments && !splitBrainQuarantineRequired}
							onAutoFillClick={() => {
								if (splitBrainQuarantineRequired) {
									toast.error(splitBrainReasonLabel);
									return;
								}
								if (!canPersistAssignments) {
									toast.error('Auto-Fill requires writable runtime evidence. Refresh and try again.');
									return;
								}
								setAutoFillDialogOpen(true);
							}}
							onViewStaffingNeedsClick={handleViewStaffingNeeds}
							departmentStats={departmentStats}
							viewMode={viewMode}
							onViewModeChange={setViewMode}
							dataSource={dataSource}
							degradedWriteEnabled={degradedWriteEnabled}
							isOnline={isOnline}
							dataSourceNotice={degradedNotice}
							/>
							</div>

							<div className="shrink-0 flex items-center gap-2">
								<div className="hidden lg:flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1 shadow-sm">
									<span className="text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Coverage</span>
									<Select value={coverageMode} onValueChange={(value) => setCoverageMode(value as CoverageMode)}>
										<SelectTrigger className="h-7 w-55 text-xs">
											<SelectValue aria-label={coverageModeConfig.label}>
												{coverageModeConfig.label}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="REAL_FACULTY_STANDARD">Real Faculty Standard</SelectItem>
											<SelectItem value="REAL_FACULTY_HARD_CAP">Real Faculty Hard Cap</SelectItem>
											<SelectItem value="REAL_FACULTY_THEN_TEACHER_X">Real Faculty Then Teacher X</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant={showTemporaryRoles ? 'secondary' : 'outline'}
											size="sm"
											onClick={toggleTeacherXRoster}
											disabled={teacherXRoster.length === 0 && !showTemporaryRoles}
											className="h-7 px-2 gap-2 font-semibold text-muted-foreground hover:text-foreground shadow-sm bg-background border-border/60"
										>
											<Users className="size-3" />
											<span className="hidden xl:inline text-[0.65rem] uppercase tracking-tight">
												{showTemporaryRoles ? 'Hide Teacher X' : 'Teacher X'}
											</span>
											<span className="xl:hidden text-[0.65rem] uppercase tracking-tight">
												{showTemporaryRoles ? 'Hide TX' : 'TX'}
											</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent side="bottom" className="max-w-xs text-xs">
										{showTemporaryRoles
											? 'Hide Teacher X placeholders from roster view.'
											: 'Open Teacher X placeholders for manual section assignment and save workflow.'}
									</TooltipContent>
								</Tooltip>

							<Sheet>
							<SheetTrigger asChild>
								<Button variant="outline" size="sm" className="h-7 px-2 gap-2 font-semibold text-muted-foreground hover:text-foreground shadow-sm bg-background border-border/60">
									<Settings2 className="size-3" />
									<span className="hidden lg:inline text-[0.65rem] uppercase tracking-tight">Workspace Ops</span>
									<span className="lg:hidden text-[0.65rem] uppercase tracking-tight">Ops</span>
								</Button>
							</SheetTrigger>
							<SheetContent className="w-80 overflow-y-auto">
								<SheetHeader className="pb-6">
									<SheetTitle className="text-xl font-bold flex items-center gap-2">
										<Settings2 className="size-5 text-primary" />
										Operations & Health
									</SheetTitle>
									<SheetDescription>
										Manage workspace navigation, diagnostics, and global assignment tools.
									</SheetDescription>
								</SheetHeader>

								<div className="space-y-8">
									<section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
										<h5 className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
											<Layers className="size-3" />
											Coverage Strategy
										</h5>
										<Select value={coverageMode} onValueChange={(value) => setCoverageMode(value as CoverageMode)}>
											<SelectTrigger className="h-9 w-full text-xs">
												<SelectValue aria-label={coverageModeConfig.label}>{coverageModeConfig.label}</SelectValue>
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="REAL_FACULTY_STANDARD">Real Faculty Standard</SelectItem>
												<SelectItem value="REAL_FACULTY_HARD_CAP">Real Faculty Hard Cap</SelectItem>
												<SelectItem value="REAL_FACULTY_THEN_TEACHER_X">Real Faculty Then Teacher X</SelectItem>
											</SelectContent>
										</Select>
										<p className="text-[0.7rem] text-muted-foreground leading-snug">{coverageModeConfig.description}</p>
										<Button
											variant={showTemporaryRoles ? 'secondary' : 'outline'}
											className="w-full justify-start gap-2"
											onClick={toggleTeacherXRoster}
											disabled={teacherXRoster.length === 0 && !showTemporaryRoles}
										>
											<Users className="size-4" />
											{showTemporaryRoles ? 'Hide Teacher X Placeholder Roster' : 'Open Teacher X Placeholder Roster'}
										</Button>
									</section>

									<section className="space-y-3">
										<h5 className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
											<CheckCircle2 className="size-3" />
											Audit & Maintenance
										</h5>
										<div className="space-y-2">
											<Button
												variant="outline"
												className="w-full justify-start gap-3 h-auto py-2.5 px-4"
												onClick={handlePreviewSplitBrain}
												disabled={splitBrainLoading || !activeSchoolYearId}
											>
												<Activity className="size-4 text-amber-600" />
												<div className="flex flex-col items-start">
													<span className="font-bold text-xs">Preview Data Truth Incident</span>
													<span className="text-[0.65rem] text-muted-foreground">Inspect contradictions before any repair apply</span>
												</div>
											</Button>

											<Button
												variant="outline"
												className="w-full justify-start gap-3 h-auto py-2.5 px-4"
												onClick={handleApplySplitBrainRepair}
												disabled={splitBrainApplyLoading || !activeSchoolYearId || !canPersistAssignments}
											>
												<CheckCircle2 className="size-4 text-rose-600" />
												<div className="flex flex-col items-start">
													<span className="font-bold text-xs">Apply Data Truth Repair</span>
													<span className="text-[0.65rem] text-muted-foreground">Run stale cleanup, truth reconcile, and real-faculty recovery</span>
												</div>
											</Button>

											<Button
												variant="outline"
												className="w-full justify-start gap-3 h-auto py-2.5 px-4"
												onClick={handleApplyRealFacultyRecovery}
												disabled={recoveryApplyLoading || !canPersistAssignments || !activeSchoolYearId}
											>
												<Redo2 className="size-4 text-emerald-600" />
												<div className="flex flex-col items-start">
													<span className="font-bold text-xs">Reconcile Saved Coverage</span>
													<span className="text-[0.65rem] text-muted-foreground">Apply recoverable real-faculty rows now</span>
												</div>
											</Button>

											{integrityDiagnostics && (
												<Dialog>
													<SheetTrigger asChild>
														<Button variant="outline" className="w-full justify-start gap-3 h-auto py-2.5 px-4">
															<Activity className="size-4 text-blue-600" />
															<div className="flex flex-col items-start">
																<span className="font-bold text-xs">Assignment Health Audit</span>
																<span className="text-[0.65rem] text-muted-foreground">
																	{integrityDiagnostics.currentYearMissingOwnershipPairs > 0 
																		? `${integrityDiagnostics.currentYearMissingOwnershipPairs} issues found` 
																		: 'Healthy'}
																</span>
															</div>
														</Button>
													</SheetTrigger>
													<DialogContent className="max-w-2xl">
														<div className="p-6">
															<h2 className="text-lg font-bold mb-2">Teaching Load Health Audit</h2>
															<p className="text-sm text-muted-foreground mb-4">Technical reconciliation between the subject-section contract and current ownership rows.</p>
															<div className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-3">
																<div className="rounded-xl border p-3 bg-muted/20">
																	<p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Empty seeded rows</p>
																	<p className="text-xl font-bold mt-1">{integrityDiagnostics.emptySectionRows}</p>
																</div>
																<div className="rounded-xl border p-3 bg-muted/20">
																	<p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Missing ownership</p>
																	<p className="text-xl font-bold mt-1 text-blue-700">{integrityDiagnostics.currentYearRowsMissingOwnership}</p>
																</div>
																<div className="rounded-xl border p-3 bg-muted/20">
																	<p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Outside scope</p>
																	<p className="text-xl font-bold mt-1">{integrityDiagnostics.currentYearOwnershipWithoutMatchingScope}</p>
																</div>
																{(integrityDiagnostics.quarantinedZombieCount ?? 0) > 0 && (
																	<div className="rounded-xl border p-3 bg-muted/20">
																		<p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Quarantined Zombies</p>
																		<p className="text-xl font-bold mt-1 text-amber-700">{integrityDiagnostics.quarantinedZombieCount}</p>
																	</div>
																)}
																{(integrityDiagnostics.staleAdvisoryCount ?? 0) > 0 && (
																	<div className="rounded-xl border p-3 bg-muted/20">
																		<p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Stale Advisories</p>
																		<p className="text-xl font-bold mt-1 text-amber-700">{integrityDiagnostics.staleAdvisoryCount}</p>
																	</div>
																)}
															</div>
														</div>
													</DialogContent>
												</Dialog>
											)}

											<Button 
												variant="outline" 
												className="w-full justify-start gap-3 h-auto py-2.5 px-4 text-destructive hover:text-destructive hover:bg-destructive/5"
												disabled={resetLoading || !canRunGlobalReset}
												onClick={openGlobalResetPreview}
											>
												<RotateCcw className="size-4" />
												<div className="flex flex-col items-start">
													<span className="font-bold text-xs uppercase">Reset Global Load</span>
													<span className="text-[0.65rem] opacity-70">Remove all current assignments</span>
												</div>
											</Button>
										</div>
									</section>
								</div>
							</SheetContent>
							</Sheet>
							</div>
							</div>

							<div className="mt-0.5 flex min-h-0 flex-1 gap-3 pb-2">
							{/* Roster Panel */}
							<div className="flex w-64 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
							<div className="border-b border-border p-1.5 space-y-1.5 bg-muted/10">
							<div className="flex items-center gap-2">
								<div className="relative flex-1">
									<Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
									<Input
										placeholder="Search roster..."
										value={searchQuery}
										onChange={(event) => setSearchQuery(event.target.value)}
										className="h-7 pl-8 text-[0.7rem] bg-background"
									/>
								</div>
								<Button
									variant={showFilters ? 'secondary' : 'outline'}
									size="icon-sm"
									className="h-7 w-7"
									onClick={() => setShowFilters(!showFilters)}
								>
									<Filter className="size-3" />
								</Button>
							</div>

							{showFilters && (
								<div className="space-y-1 pt-1 animate-in slide-in-from-top-2 duration-200">
									<div className="flex gap-1">
										{(['all', 'assigned', 'unassigned'] as const).map((status) => (
											<Button
												key={status}
												type="button"
												variant={filterStatus === status ? 'default' : 'outline'}
												size="sm"
												onClick={() => setFilterStatus(status)}
												className="h-5 flex-1 px-0 text-[0.6rem] font-bold uppercase tracking-tight"
											>
												{status === 'all' ? 'Any' : status.charAt(0).toUpperCase() + status.slice(1)}
											</Button>
										))}
									</div>

									<div className="grid grid-cols-1 gap-1">
										<SearchableSelect
											value={departmentFilter}
											onValueChange={setDepartmentFilter}
											placeholder="All Departments"
											triggerClassName="h-6 w-full justify-between text-[0.65rem] font-semibold bg-background"
											className="w-full"
											items={[
												{ value: 'all', label: 'All Departments' },
												...departmentOptions.map((department) => ({ value: department, label: department })),
											]}
										/>
									</div>

									<div className="grid grid-cols-1 gap-1">
										<Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'load-asc' | 'load-desc')}>
											<SelectTrigger className="h-6 w-full text-[0.65rem] font-semibold bg-background">
												<SelectValue placeholder="Sort by load" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="load-asc" className="text-[0.65rem] font-semibold uppercase">Load: Low to High</SelectItem>
												<SelectItem value="load-desc" className="text-[0.65rem] font-semibold uppercase">Load: High to Low</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							)}
							</div>

							<div className="flex-1 overflow-auto">
							{loading ? (
								Array.from({ length: 12 }).map((_, index) => (
									<div key={index} className="flex items-center gap-3 border-b border-border px-4 py-3">
										<Skeleton className="size-8 shrink-0 rounded-full" />
										<div className="flex-1 space-y-1.5">
											<Skeleton className="h-4 w-28" />
											<Skeleton className="h-3 w-20" />
										</div>
										<Skeleton className="h-5 w-12 shrink-0" />
									</div>
								))
							) : filteredFaculty.length === 0 ? (
								<p className="p-8 text-center text-xs text-muted-foreground italic">
									{faculty.length === 0 ? 'No teachers synced.' : 'No matches found.'}
								</p>
							) : (
								groupedFaculty.map(([departmentName, members]) => (
									<div key={departmentName} className="border-b border-border/80">
										<div className="bg-muted/40 px-3 py-1 text-[0.55rem] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center justify-between">
											<span className="truncate">{departmentName}</span>
											<span className="shrink-0 ml-2 opacity-40">{members.length}</span>
										</div>
										{members.map((member) => {
											const effectiveSubjectCount = effectiveAssignmentsByFaculty[member.id]?.length ?? 0;
											const hasDraft = Boolean(effectiveDraftAssignmentsByFaculty[member.id]);
											const displayHours = getComparableLoadHours(member);
											const actualLoadPercentage = member.isPlaceholder
												? 0
												: Math.round(member.policyLoadPercentage ?? (member.maxHoursPerWeek > 0 ? (displayHours / member.maxHoursPerWeek) * 100 : 0));
											const loadColorClass = actualLoadPercentage > 150
												? 'text-red-600'
												: actualLoadPercentage > 100
													? 'text-amber-600'
													: 'text-emerald-600';
											return (
												<Button
													key={member.id}
													type="button"
													variant="ghost"
													onClick={() => setSelectedId(member.id)}
													className={`h-auto w-full justify-start rounded-none border-b border-border/50 px-3 py-1.5 text-left transition-all ${
														selectedId === member.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50 border-l-2 border-l-transparent'
													}`}
												>
													<div className="flex w-full items-center gap-2">
														<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.6rem] font-bold text-primary border border-primary/5">
															{member.firstName[0]}
															{member.lastName[0]}
														</div>
														<div className="flex-1 min-w-0">
															<p className={`truncate text-sm ${selectedId === member.id ? 'font-semibold text-foreground' : 'font-bold text-muted-foreground'}`}>
																{member.lastName}, {member.firstName}
															</p>
															<div className="flex items-center gap-2 mt-0.5">
																<span className="truncate text-xs text-muted-foreground/80 font-bold flex-1">
																	{member.specialization || member.department || 'General'}
																</span>
																<span className={`text-xs font-semibold tabular-nums ${loadColorClass}`}>
																	{member.isPlaceholder ? `${Math.round(displayHours * 10) / 10}h` : `${actualLoadPercentage}%`}
																</span>
															</div>
														</div>
														<div className="flex items-center gap-1 shrink-0">
															{hasDraft && <div className="size-2 rounded-full bg-sky-500 animate-pulse" />}
															{effectiveSubjectCount === 0 ? (
																<AlertTriangle className="size-3.5 text-amber-500 opacity-70" />
															) : (
																<CheckCircle2 className="size-3.5 text-emerald-500 opacity-70" />
															)}
														</div>
													</div>
												</Button>
											);
										})}
									</div>
								))
							)}
							</div>
							<div className="border-t border-border bg-muted/20 px-4 py-2 text-xs font-bold text-muted-foreground/80 flex items-center justify-between uppercase tracking-tight">
							<div className="flex items-center gap-4">
								<span className="cursor-help hover:text-foreground transition-colors">{coverageHeadline.realAssigned} Staffed</span>
								<span className="opacity-30">/</span>
								<span className="cursor-help hover:text-foreground transition-colors">{coverageHeadline.syntheticAssigned} Temp</span>
							</div>
							<span className={coverageHeadline.unassigned > 0 ? 'text-amber-600' : 'text-emerald-600'}>
								{coverageHeadline.unassigned} Unassigned
							</span>
							</div>
							</div>

							{/* Main Workspace Area */}
							<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
							{!selected ? (
							<div className="flex-1 flex h-full items-center justify-center text-muted-foreground bg-muted/5 border border-dashed border-border/60 rounded-xl">
								<div className="text-center">
									<UserCog className="mx-auto size-10 text-muted-foreground/30" />
									<p className="mt-2 text-sm font-semibold">Select a teacher from the roster to manage assignments</p>
								</div>
							</div>
							) : (
							<div className="flex-1 flex flex-col space-y-1.5 min-h-0">
								{/* Identity Bar - Optimized vertical space */}
								<div className="shrink-0 flex items-center justify-between gap-4 p-1.5 px-3 bg-card border border-border/50 rounded-xl shadow-sm">
									<div className="flex items-center gap-3 flex-1 min-w-0">
										<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.65rem] font-bold text-primary border border-primary/10">
											{selected.firstName[0]}{selected.lastName[0]}
										</div>
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<p className="truncate text-sm font-bold leading-none uppercase tracking-tight">
													{selected.firstName} {selected.lastName}
												</p>
												{selected.isClassAdviser && (
													<Tooltip>
														<TooltipTrigger asChild>
															<Star className="size-3.5 fill-amber-500 text-amber-600 cursor-help" />
														</TooltipTrigger>
														<TooltipContent className="text-xs font-bold">
															{advisedSectionMeta ? `Adviser: GR${advisedSectionMeta.gradeLevel} - ${advisedSectionMeta.sectionName}` : 'Class Adviser'}
														</TooltipContent>
													</Tooltip>
												)}
											</div>
											<p className="truncate text-[11px] text-muted-foreground font-bold mt-1 uppercase tracking-wider flex items-center gap-1.5 leading-none">
												<span className="text-foreground/70">{selected.specialization || 'General'}</span>
												<span className="opacity-30">*</span>
												<span>{selected.department || 'No Dept'}</span>
											</p>
										</div>
									</div>

									<div className="flex items-center gap-3">
										{splitBrainQuarantineRequired ? (
											<div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-tight text-rose-800">
												<AlertTriangle className="size-3.5" />
												<span>Teacher Arithmetic Hidden While Data Truth Repair Is Pending</span>
											</div>
										) : (
										<div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-muted/30 border border-border/40 shadow-inner">
											<div className="flex flex-col items-center">
												<span className="text-[0.55rem] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mb-1">Credited Weekly Load</span>
												<div className="flex items-center gap-2">
													<span className="text-lg font-semibold tabular-nums leading-none text-foreground">{loadProfile.creditedTotalHours}h</span>
													<Badge className={`${STATUS_COLORS[loadProfile.status].bg} ${STATUS_COLORS[loadProfile.status].text} h-4 border-none text-[0.6rem] font-bold uppercase px-1.5 shadow-none`}>
														{loadProfile.statusLabel}
													</Badge>
												</div>
											</div>

											<div className="h-8 w-px bg-border/40" />

											<div className="flex flex-col items-center">
												<span className="text-[0.55rem] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mb-1">Concurrent Teaching</span>
												<div className="flex items-center gap-2">
													<span className="text-sm font-semibold tabular-nums leading-none text-foreground">{loadProfile.actualTeachingHours}h</span>
													<Tooltip>
														<TooltipTrigger asChild>
															<Info className="size-3 text-muted-foreground/40 cursor-help" />
														</TooltipTrigger>
														<TooltipContent className="text-[0.65rem] font-bold max-w-50">
															Active time spent in the classroom during the busiest term.
														</TooltipContent>
													</Tooltip>
												</div>
											</div>

											{rotationOvercountHours > 0 && (
												<div className="h-8 w-px bg-border/40" />
											)}

											{rotationOvercountHours > 0 && (
												<Tooltip>
													<TooltipTrigger asChild>
														<div className="flex flex-col items-center cursor-help">
															<span className="text-[0.55rem] font-bold text-amber-700/60 uppercase tracking-widest leading-none mb-1">Rotation Adjustment</span>
															<span className="text-xs font-semibold text-amber-600 tabular-nums leading-none">-{rotationOvercountHours}h</span>
														</div>
													</TooltipTrigger>
													<TooltipContent className="text-[0.65rem] font-bold">
														Load reduction because Science/TLE rotational subjects share the same weekly slot across different terms.
													</TooltipContent>
												</Tooltip>
											)}

											<div className="h-8 w-px bg-border/40" />

											<div className="w-16 space-y-1">
												<div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-muted/50 relative shadow-inner">
													<div
														className="h-full bg-emerald-500 transition-all absolute left-0 top-0 z-10"
															style={{ width: `${Math.min((loadProfile.creditedTotalHours * 60 / Math.max(loadCapMinutes, 1)) * 100, 100)}%` }}
													/>
												</div>
												<div className="flex justify-center text-[0.6rem] font-semibold uppercase tracking-tighter tabular-nums text-muted-foreground/80">
													<span>{Math.round((loadProfile.creditedTotalHours / selected.maxHoursPerWeek) * 100)}% Cap</span>
												</div>
											</div>

													<div className="h-8 w-px bg-border/40" />

													<div className="flex flex-col items-center">
														<span className="text-[0.55rem] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mb-1">Remaining</span>
														<span className={cn('text-xs font-semibold tabular-nums leading-none', loadProfile.remainingHours < 0 ? 'text-rose-600' : 'text-emerald-700')}>
															{loadProfile.remainingHours.toFixed(1)}h
														</span>
													</div>

													{hoveredIncomingMinutes > 0 && (
														<>
															<div className="h-8 w-px bg-border/40" />
															<div className="flex flex-col items-center">
																<span className="text-[0.55rem] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mb-1">Projected</span>
																<span className={cn('text-xs font-semibold tabular-nums leading-none', previewLoadHours > selected.maxHoursPerWeek ? 'text-rose-600' : 'text-primary')}>
																	{previewLoadHours.toFixed(1)}h
																</span>
															</div>
														</>
													)}

											<Popover>
												<PopoverTrigger asChild>
													<Button variant="ghost" size="icon-xs" className="h-7 w-7 rounded-lg hover:bg-primary/5 text-primary ml-1 border border-primary/10">
														<Info className="size-4" />
													</Button>
												</PopoverTrigger>
												<PopoverContent side="bottom" align="end" className="w-96 p-0 overflow-hidden shadow-xl border-border/50">
													<div className="bg-primary p-4 text-white">
														<h5 className="text-[0.6rem] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">Worked Weekly Calculation</h5>
														<div className="flex items-center gap-3">
															<div className="flex flex-col">
																<span className="text-2xl font-bold leading-none">{loadProfile.creditedTotalHours}h</span>
																<span className="text-[0.6rem] font-medium opacity-70 uppercase tracking-wider">Credited Weekly Load</span>
															</div>
															<div className="h-8 w-px bg-white/20" />
															<div className="text-[0.65rem] font-medium opacity-90 leading-tight">
																Calculation includes teaching hours, <br />
																rotation adjustments, and credits.
															</div>
														</div>
													</div>
													
													<div className="p-4 space-y-4 bg-card">
														<div className="space-y-3">
															<h6 className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">Step-by-Step Arithmetic</h6>
															
															<div className="space-y-2">
																<div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30 border border-border/40">
																	<div className="flex flex-col">
																		<span className="font-bold">Total Weekly Rows</span>
																		<span className="text-[0.6rem] text-muted-foreground uppercase">Sum of all assigned classes</span>
																	</div>
																	<span className="font-mono font-bold">{(loadProfile?.rawTeachingHours ?? 0).toFixed(1)}h</span>
																</div>

																<div className="flex items-center justify-between text-xs p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-900">
																	<div className="flex flex-col">
																		<span className="font-bold">Rotation Adjustment</span>
																		<span className="text-[0.6rem] text-amber-700/70 uppercase tracking-tight font-semibold">Shared Science/TLE term lanes</span>
																	</div>
																	<span className="font-mono font-bold">-{(loadProfile?.rotationOvercountHours ?? 0).toFixed(1)}h</span>
																</div>

																<div className="flex items-center justify-between text-xs p-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-900 italic">
																	<div className="flex flex-col">
																		<span className="font-bold">Active Weekly Teaching</span>
																		<span className="text-[0.6rem] text-blue-700/70 uppercase">Maximum concurrent classroom time</span>
																	</div>
																	<span className="font-mono font-bold">{((loadProfile?.rawTeachingHours ?? 0) - (loadProfile?.rotationOvercountHours ?? 0)).toFixed(1)}h</span>
																</div>

																<div className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-900">
																	<div className="flex flex-col">
																		<span className="font-bold">Advisory & Other Credits</span>
																		<span className="text-[0.6rem] text-emerald-700/70 uppercase">Non-teaching responsibilities</span>
																	</div>
																	<span className="font-mono font-bold">+{(loadProfile?.equivalentHours ?? 0).toFixed(1)}h</span>
																</div>

																<div className="flex items-center justify-between text-sm p-3 rounded-lg bg-primary/5 border border-primary/20 text-primary">
																	<span className="font-bold uppercase tracking-tight">Credited Weekly Load</span>
																	<span className="font-mono font-semibold">{(loadProfile?.creditedTotalHours ?? 0).toFixed(1)}h</span>
																</div>
															</div>
														</div>

														<div className="text-[0.65rem] text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-dashed border-border/60">
															<p className="font-bold text-foreground/70 mb-1">How rotation works:</p>
															<p>Rotational subjects share the same weekly slot across different terms. Only the busiest term (Peak) is counted toward the total weekly load.</p>
														</div>

														{rotationTermBreakdown.length > 0 && (
															<div className="border-t border-border/40 pt-4 space-y-3">
																<h6 className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">Rotation Term-Lane Breakdown</h6>
																<div className="space-y-2">
																	{rotationTermBreakdown.map((f) => (
																		<div key={f.family} className="flex flex-col gap-1.5 p-2.5 rounded-lg border border-violet-100 bg-violet-50/30">
																			<div className="flex items-center justify-between">
																				<span className="text-[0.65rem] font-semibold text-violet-700 uppercase tracking-tighter">{f.family}</span>
																				<Badge variant="outline" className="h-4 text-[0.55rem] font-bold bg-white text-violet-600 border-violet-200">
																					Peak: {f.peakTermLabel || `Term ${f.peakTermRank}`} * {f.peakTermMinutesPerWeek / 60}h
																				</Badge>
																			</div>
																			<div className="flex gap-1.5">
																				{[1, 2, 3].map(term => {
																					const bucket = f.termBuckets.find(b => b.termRank === term);
																					return (
																						<div key={term} className={cn("flex-1 p-1 rounded border text-center transition-colors", bucket?.isPeakTerm ? "bg-violet-100 border-violet-300 shadow-sm" : "bg-background border-border/50 opacity-60")}>
																							<p className="text-[0.5rem] font-semibold text-muted-foreground uppercase leading-none mb-1">T{term}</p>
																							<p className={cn("text-[0.6rem] font-bold tabular-nums leading-none", bucket?.isPeakTerm ? "text-violet-800" : "text-muted-foreground")}>
																								{bucket ? `${bucket.creditedMinutesPerWeek / 60}h` : '0h'}
																							</p>
																						</div>
																					);
																				})}
																			</div>
																			<p className="text-[0.55rem] text-muted-foreground font-medium italic mt-0.5">
																				{f.peakTermLabel || `Term ${f.peakTermRank}`} is the load-driving term for this group.
																			</p>
																		</div>
																	))}
																</div>
															</div>
														)}
													</div>
												</PopoverContent>
											</Popover>
										</div>
										)}

										<div className="flex items-center gap-2 border-l border-border/50 pl-3">
											<div className="flex items-center bg-background rounded-lg border border-border/60 p-0.5 shadow-inner">
												<Button type="button" variant="ghost" size="icon-xs" onClick={handleUndo} disabled={!canUndo || saving || isReadOnlyMode} className="h-6 w-7">
													<Undo2 className="size-3" />
												</Button>
												<Button type="button" variant="ghost" size="icon-xs" onClick={handleRedo} disabled={!canRedo || saving || isReadOnlyMode} className="h-6 w-7">
													<Redo2 className="size-3" />
												</Button>
											</div>

											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant={dirty ? 'secondary' : 'outline'} size="xs" className="h-7 font-bold text-[0.6rem] gap-1.5 shadow-sm uppercase px-2">
														<Settings2 className="size-3" />
														{dirty ? 'Draft' : 'Tools'}
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="w-52">
													<DropdownMenuItem onSelect={handleResetAssignments} disabled={saving || !selected.isActiveForScheduling || isReadOnlyMode || dataSource !== 'live'} className="gap-2 cursor-pointer font-bold uppercase text-[0.65rem]">
														<RotateCcw className="size-3" />
														Reset Teacher Draft
													</DropdownMenuItem>
													{dirty && (
														<DropdownMenuItem onSelect={discardSelectedDraft} disabled={saving || isReadOnlyMode} className="gap-2 cursor-pointer text-amber-600 font-bold uppercase text-[0.65rem]">
															<RotateCcw className="size-3" />
															Discard Changes
														</DropdownMenuItem>
													)}
												</DropdownMenuContent>
											</DropdownMenu>

											<Button type="button" size="xs" onClick={handleSave} disabled={!dirty || saving || !selected.isActiveForScheduling || isReadOnlyMode} className="h-7 font-bold text-[0.6rem] gap-1.5 shadow-md shadow-primary/10 uppercase px-2">
												<Save className="size-3" />
												{saving ? 'Saving...' : 'Save Draft'}
											</Button>
										</div>
									</div>
								</div>

								{!splitBrainQuarantineRequired && rotationTermBreakdown.length > 0 && (
									<div className="shrink-0 rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 shadow-sm">
										<div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
											<div className="flex flex-col gap-1">
												<p className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-sky-800 flex items-center gap-1.5">
													<Layers className="size-3" />
													Rotational Family Breakdown
												</p>
												<p className="text-[0.65rem] font-medium text-sky-700 leading-tight max-w-2xl">
													Year-round classes stay every week. Rotational Science/TLE contributes only from the busiest term. 
													<span className="font-bold text-sky-900"> Credited load = year-round classes + peak rotational term.</span>
												</p>
											</div>
										</div>
										<div className="mt-3 grid gap-2 xl:grid-cols-2">
											{rotationTermBreakdown.map((family) => (
												<div key={family.family} className="rounded-lg border border-sky-200/70 bg-white/90 px-3 py-2.5 shadow-sm">
													<div className="flex items-center justify-between gap-2 border-b border-sky-100 pb-2 mb-2">
														<div className="flex items-center gap-2 min-w-0">
															<span className="text-[0.65rem] font-semibold uppercase tracking-tight text-sky-900 truncate">{family.family}</span>
															{family.peakTermLabel && (
																<Badge variant="outline" className="h-4.5 px-2 text-[0.6rem] font-semibold uppercase border-sky-400 bg-sky-50 text-sky-800 shadow-none">
																	Peak: {family.peakTermLabel}
																</Badge>
															)}
														</div>
														<div className="flex flex-col items-end">
															<span className="text-[0.65rem] font-semibold text-sky-900 tabular-nums">
																{(family.peakTermMinutesPerWeek / 60).toFixed(1)}h credited
															</span>
															<span className="text-[0.55rem] font-bold text-sky-600/70 uppercase">Weekly Contribution</span>
														</div>
													</div>
													<div className="grid gap-1.5 sm:grid-cols-3">
														{family.termBuckets.map((bucket) => (
															<div
																key={`${family.family}-${bucket.termRank ?? 0}`}
																className={`rounded-md border p-2 transition-all ${bucket.isPeakTerm ? 'border-sky-400 bg-sky-100/50 ring-1 ring-sky-400/20 shadow-inner' : 'border-sky-100 bg-sky-50/30 opacity-70'}`}
															>
																<div className="flex items-center justify-between gap-2 mb-1">
																	<span className={cn("text-[0.55rem] font-semibold uppercase tracking-tight", bucket.isPeakTerm ? "text-sky-900" : "text-sky-700/60")}>
																		{resolveCanonicalRotationTermLabel(bucket.termLabel, bucket.termRank) ?? 'Term ?'}
																	</span>
																	{bucket.isPeakTerm && (
																		<CheckCircle2 className="size-2.5 text-sky-600" />
																	)}
																</div>
																<div className={cn("text-[0.6rem] font-semibold tabular-nums leading-tight", bucket.isPeakTerm ? "text-sky-800" : "text-sky-700/60")}>
																	{(bucket.creditedMinutesPerWeek / 60).toFixed(1)}h 
																	<span className="ml-1 text-[0.5rem] font-bold uppercase opacity-70">active</span>
																</div>
																<div className="mt-1 flex items-center gap-1.5 text-[0.5rem] font-bold text-sky-700/50 uppercase tracking-tighter">
																	<span>{bucket.sectionIds.length} sec</span>
																	<span>*</span>
																	<span>{bucket.subjectCodes.length} sub</span>
																</div>
															</div>
														))}
													</div>
													{!family.termBuckets.some(b => b.isPeakTerm) && (
														<p className="mt-2 text-[0.55rem] text-rose-600 font-bold italic">Warning: No peak term identified for this family.</p>
													)}
												</div>
											))}
										</div>
									</div>
								)}

										{/* Content Row with Jump List and Assignment Card */}
								<div className="flex-1 flex min-h-0 gap-3">
									<AnimatePresence mode="popLayout">
										{showJumpList && (
											<motion.div
												initial={{ width: 0, opacity: 0, x: -10 }}
												animate={{ width: 64, opacity: 1, x: 0 }}
												exit={{ width: 0, opacity: 0, x: -10 }}
												transition={{ type: 'spring', damping: 25, stiffness: 200 }}
												className="shrink-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden py-2"
											>
												<h5 className="text-[0.55rem] font-bold text-center uppercase tracking-tighter text-muted-foreground opacity-60">Jump</h5>
												<div className="flex-1 overflow-auto no-scrollbar space-y-1 px-2 mt-2">
													{jumpListItems.map((item) => (
														<Tooltip key={item.id}>
															<TooltipTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon-xs"
																	className={`w-full h-8 font-bold text-[0.65rem] ${item.type === 'qualified' ? 'text-emerald-700 hover:bg-emerald-50' : 'text-muted-foreground hover:bg-muted'}`}
																	onClick={() => {
																		document.getElementById(`subject-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
																	}}
																>
																	{item.code.slice(0, 3)}
																</Button>
															</TooltipTrigger>
															<TooltipContent side="right" className="text-xs font-bold">
																{item.code} {item.type === 'qualified' ? '(Qualified)' : '(Outside Dept)'}
															</TooltipContent>
														</Tooltip>
													))}
												</div>
											</motion.div>
										)}
									</AnimatePresence>

									<Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-sm border-border/40">
										<div className="flex items-center gap-4 border-b border-border bg-muted/5 px-5 py-2.5">
											<div className="relative w-60 shrink-0">
												<Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
												<Input
													placeholder="Filter assignments..."
													value={subjectSearch}
													onChange={(event) => setSubjectSearch(event.target.value)}
													className="h-8 pl-9 text-xs bg-background shadow-sm"
												/>
											</div>
											<Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v as 'all' | 'unassigned' | 'assigned')}>
												<SelectTrigger className="h-8 w-36 text-xs font-bold bg-background shadow-sm uppercase tracking-tight">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all" className="text-xs font-bold uppercase">All Sections</SelectItem>
													<SelectItem value="unassigned" className="text-xs font-bold uppercase">Unassigned</SelectItem>
													<SelectItem value="assigned" className="text-xs font-bold uppercase">Assigned</SelectItem>
												</SelectContent>
											</Select>
											<Select value={gradeLevelFilter} onValueChange={setGradeLevelFilter}>
												<SelectTrigger className="h-8 w-32 text-xs font-bold bg-background shadow-sm uppercase tracking-tight">
													<SelectValue placeholder="Grade" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all" className="text-xs font-bold uppercase">All Grades</SelectItem>
													<SelectItem value="7" className="text-xs font-bold uppercase">Grade 7</SelectItem>
													<SelectItem value="8" className="text-xs font-bold uppercase">Grade 8</SelectItem>
													<SelectItem value="9" className="text-xs font-bold uppercase">Grade 9</SelectItem>
													<SelectItem value="10" className="text-xs font-bold uppercase">Grade 10</SelectItem>
												</SelectContent>
											</Select>

											<div className="flex-1" />

											<Button
												variant={showJumpList ? 'secondary' : 'outline'}
												size="icon-sm"
												className="h-8 w-8 shadow-sm"
												onClick={() => setShowJumpList(!showJumpList)}
											>
												<Activity className="size-3.5" />
											</Button>
										</div>

										<CardContent className="flex-1 overflow-auto pt-4 space-y-4 scroll-smooth no-scrollbar">
											{(() => {
												if (viewMode === 'assignments') {
													return (
														<>
															{departmentQualifiedSubjects.length > 0 && (
																<section className="space-y-3">
																	<div className="flex items-center gap-3">
																		<h4 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-600/70">Department Qualified</h4>
																		<div className="flex-1 h-px bg-emerald-500/10" />
																	</div>
																	<div className="space-y-3">
																		{departmentQualifiedSubjects.map((subject) => (
																			<SubjectRow
																				key={subject.id}
																				subject={subject}
																				assignment={currentAssignments.find((a) => a.subjectId === subject.id)}
																				sections={sectionsBySubject[subject.id] ?? []}
																				disabled={saving || !selected.isActiveForScheduling || isReadOnlyMode}
																				selectedFacultyId={selected.id}
																				savedOwnershipMap={savedOwnershipMap}
																				pendingOwnershipMap={pendingOwnershipMap}
																				savedConflictMap={savedConflictMap}
																				onSetSections={setSubjectSections}
																				searchTerm={subjectSearch}
																				gradeLevelFilter={gradeLevelFilter}
																				sectionFilter={sectionFilter}
																				advisedSectionId={homeroomHint?.advisedSectionId ?? null}
																				remainingCapacityMinutes={remainingCapacityMinutes}
																				onHoverLoadMinutes={setHoveredIncomingMinutes}
																				onClearHoverLoad={() => setHoveredIncomingMinutes(0)}
																				activeFacultyIds={activeFacultyIds}
																				onSwapSectionOwnership={handleSwapRequest}
																				selectedFacultySpecialization={selected.specialization}
																				resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
																				quarantined={splitBrainQuarantineRequired}
																				quarantineLabel={splitBrainReasonLabel}
																			/>
																		))}
																	</div>
																</section>
															)}

															{outsideDepartmentSubjects.length > 0 && (
																<section className="space-y-3 pt-2">
																	<div className="flex items-center gap-3">
																		<h4 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Outside Department</h4>
																		<div className="flex-1 h-px bg-border/40" />
																	</div>
																	<div className="space-y-3">
																		{outsideDepartmentSubjects.map((subject) => (
																			<SubjectRow
																				key={subject.id}
																				subject={subject}
																				assignment={currentAssignments.find((a) => a.subjectId === subject.id)}
																				sections={sectionsBySubject[subject.id] ?? []}
																				disabled={saving || !selected.isActiveForScheduling || isReadOnlyMode}
																				selectedFacultyId={selected.id}
																				savedOwnershipMap={savedOwnershipMap}
																				pendingOwnershipMap={pendingOwnershipMap}
																				savedConflictMap={savedConflictMap}
																				onSetSections={setSubjectSections}
																				isOutsideDepartment
																				searchTerm={subjectSearch}
																				gradeLevelFilter={gradeLevelFilter}
																				sectionFilter={sectionFilter}
																				advisedSectionId={homeroomHint?.advisedSectionId ?? null}
																				remainingCapacityMinutes={remainingCapacityMinutes}
																				onHoverLoadMinutes={setHoveredIncomingMinutes}
																				onClearHoverLoad={() => setHoveredIncomingMinutes(0)}
																				activeFacultyIds={activeFacultyIds}
																				onSwapSectionOwnership={handleSwapRequest}
																				selectedFacultySpecialization={selected.specialization}
																				resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
																				quarantined={splitBrainQuarantineRequired}
																				quarantineLabel={splitBrainReasonLabel}
																			/>
																		))}
																	</div>
																</section>
															)}
														</>
													);
												}

												if (viewMode === 'shortage') {
													const shortageSubjects = subjects.filter((s: Subject) => {
														const sections = sectionsBySubject[s.id] ?? [];
														return sections.some((sec: ExternalSection) => {
															const key = getAssignmentOwnershipKey(s.id, sec.id);
															const owner = savedOwnershipMap[key] || pendingOwnershipMap[key];
															return !owner || !activeFacultyIds.has(owner.facultyId);
														});
													}).sort((a: Subject, b: Subject) => {
														const aCount = (sectionsBySubject[a.id] ?? []).filter((sec: ExternalSection) => !(savedOwnershipMap[getAssignmentOwnershipKey(a.id, sec.id)] || pendingOwnershipMap[getAssignmentOwnershipKey(a.id, sec.id)])).length;
														const bCount = (sectionsBySubject[b.id] ?? []).filter((sec: ExternalSection) => !(savedOwnershipMap[getAssignmentOwnershipKey(b.id, sec.id)] || pendingOwnershipMap[getAssignmentOwnershipKey(b.id, sec.id)])).length;
														return bCount - aCount;
													});

													if (shortageSubjects.length === 0) {
														return (
															<div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
																<div className="size-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
																	<CheckCircle2 className="size-8" />
																</div>
																<div className="space-y-1">
																	<p className="text-sm font-bold uppercase tracking-tight">Full Coverage Achieved</p>
																	<p className="text-xs text-muted-foreground font-medium">All active subject-sections have been assigned to teachers.</p>
																</div>
															</div>
														);
													}

													return (
														<div className="space-y-3">
															<div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
																<AlertTriangle className="size-4 text-amber-600 shrink-0" />
																<p className="text-xs text-amber-900/80 font-bold leading-relaxed">
																	Showing <span className="text-amber-900 font-bold">{shortageSubjects.length} subjects</span> with unassigned sections. Prioritize these to complete the school year staffing.
																</p>
															</div>
															{shortageSubjects.map((subject) => (
																<SubjectRow
																	key={subject.id}
																	subject={subject}
																	assignment={currentAssignments.find((a) => a.subjectId === subject.id)}
																	sections={sectionsBySubject[subject.id] ?? []}
																	disabled={saving || !selected.isActiveForScheduling || isReadOnlyMode}
																	selectedFacultyId={selected.id}
																	savedOwnershipMap={savedOwnershipMap}
																	pendingOwnershipMap={pendingOwnershipMap}
																	savedConflictMap={savedConflictMap}
																	onSetSections={setSubjectSections}
																	searchTerm={subjectSearch}
																	gradeLevelFilter={gradeLevelFilter}
																	sectionFilter="unassigned"
																	advisedSectionId={homeroomHint?.advisedSectionId ?? null}
																	remainingCapacityMinutes={remainingCapacityMinutes}
																	onHoverLoadMinutes={setHoveredIncomingMinutes}
																	onClearHoverLoad={() => setHoveredIncomingMinutes(0)}
																	activeFacultyIds={activeFacultyIds}
																	onSwapSectionOwnership={handleSwapRequest}
																	selectedFacultySpecialization={selected.specialization}
																	resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
																	quarantined={splitBrainQuarantineRequired}
																	quarantineLabel={splitBrainReasonLabel}
																/>
															))}
														</div>
													);
												}

												if (viewMode === 'utilization') {
													const underloadedFaculty = faculty.filter(f => !f.isPlaceholder && (f.policyLoadPercentage ?? 0) < 80).sort((a, b) => (a.policyLoadPercentage ?? 0) - (b.policyLoadPercentage ?? 0));

													return (
														<div className="space-y-3">
															<div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
																<Users className="size-4 text-blue-600 shrink-0" />
																<p className="text-xs text-blue-900/80 font-bold leading-relaxed">
																	Showing <span className="text-blue-900 font-bold">{underloadedFaculty.length} teachers</span> with spare capacity (less than 80% load). These can cover the remaining unassigned rows.
																</p>
															</div>
															<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
																{underloadedFaculty.map(f => (
																	<Card 
																		key={f.id} 
																		className="p-3 border-border/60 shadow-none hover:border-primary/30 transition-all cursor-pointer group" 
																		onClick={() => {
																			setSelectedId(f.id);
																			setViewMode('assignments');
																			window.scrollTo({ top: 0, behavior: 'smooth' });
																		}}
																	>
																		<div className="flex items-center justify-between">
																			<div className="flex items-center gap-2">
																				<div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[0.65rem] font-bold text-primary">
																					{f.firstName[0]}{f.lastName[0]}
																				</div>
																				<div className="min-w-0">
																					<p className="text-xs font-bold truncate group-hover:text-primary transition-colors uppercase tracking-tight">{f.lastName}, {f.firstName}</p>
																					<p className="text-[0.6rem] text-muted-foreground font-bold uppercase tracking-widest">{f.department || 'No Dept'}</p>
																				</div>
																			</div>
																			<div className="text-right">
																				<p className="text-xs font-bold text-blue-600">{f.policyLoadPercentage}%</p>
																				<p className="text-[0.55rem] text-muted-foreground font-bold uppercase tracking-tighter">{f.policyCreditedHours}h / {f.maxHoursPerWeek}h</p>
																			</div>
																		</div>
																	</Card>
																))}
															</div>
														</div>
													);
												}

												if (viewMode === 'redistribution') {
													const specialSubjects = subjects.filter(s => 
														['SPA', 'SPS', 'STE', 'SPECIAL'].some(term => s.name.toUpperCase().includes(term) || s.code.toUpperCase().includes(term))
													);

													return (
														<div className="space-y-3">
															<div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-violet-50 border border-violet-100">
																<Layers className="size-4 text-violet-600 shrink-0" />
																<p className="text-xs text-violet-900/80 font-bold leading-relaxed">
																	Showing <span className="text-violet-900 font-bold">{specialSubjects.length} Special Programs</span>. Audit concentrated ownership here to redistribute load for SPA, SPS, or STE sections.
																</p>
															</div>
															{specialSubjects.map((subject) => (
																<SubjectRow
																	key={subject.id}
																	subject={subject}
																	assignment={currentAssignments.find((a) => a.subjectId === subject.id)}
																	sections={sectionsBySubject[subject.id] ?? []}
																	disabled={saving || !selected.isActiveForScheduling || isReadOnlyMode}
																	selectedFacultyId={selected.id}
																	savedOwnershipMap={savedOwnershipMap}
																	pendingOwnershipMap={pendingOwnershipMap}
																	savedConflictMap={savedConflictMap}
																	onSetSections={setSubjectSections}
																	searchTerm={subjectSearch}
																	gradeLevelFilter={gradeLevelFilter}
																	advisedSectionId={homeroomHint?.advisedSectionId ?? null}
																	remainingCapacityMinutes={remainingCapacityMinutes}
																	onHoverLoadMinutes={setHoveredIncomingMinutes}
																	onClearHoverLoad={() => setHoveredIncomingMinutes(0)}
																	activeFacultyIds={activeFacultyIds}
																	onSwapSectionOwnership={handleSwapRequest}
																	selectedFacultySpecialization={selected.specialization}
																	resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
																	quarantined={splitBrainQuarantineRequired}
																	quarantineLabel={splitBrainReasonLabel}
																/>
															))}
														</div>
													);
												}
												return null;
											})()}
										</CardContent>
									</Card>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			<ConfirmationModal
				open={autoFillDialogOpen}
				onOpenChange={setAutoFillDialogOpen}
				title="Auto-Fill Remaining Assignments?"
				description={`Coverage mode: ${coverageModeConfig.label}. ${coverageModeConfig.description}`}
				onConfirm={handleAutoFill}
				confirmText="Run Auto-Fill"
				variant="primary"
				loading={autoFillLoading}
			/>

			<ConfirmationModal
				open={Boolean(swapCandidate)}
				onOpenChange={(open) => {
					if (!open) setSwapCandidate(null);
				}}
				title="Swap Section Ownership?"
				description="This will move the selected subject-section from the current owner to the selected teacher in draft mode."
				onConfirm={executeSwap}
				confirmText="Swap"
				variant="primary"
			/>

			<AutoFillSummaryModal
				open={summaryModalOpen}
				onOpenChange={setSummaryModalOpen}
				result={summaryModalResult}
			/>

			<Dialog open={resetDialogOpen} onOpenChange={(open) => { if (!open) { setResetDialogOpen(false); setResetConfirmText(''); } }}>
				<DialogContent className="max-w-md">
					<div className="p-6">
						<h2 className="text-lg font-bold text-destructive flex items-center gap-2 mb-4">
							<AlertTriangle className="size-5 shrink-0" />
							Reset Global Teaching Load
						</h2>
						<div className="space-y-4">
							<p className="text-sm">
								This removes all active subject-section ownership rows for the current school year.
							</p>
							{resetPreview && (
								<div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-xs font-medium">
									<div className="flex justify-between">
										<span className="text-muted-foreground">Ownership rows removed</span>
										<span className="font-bold text-destructive">{resetPreview.ownershipRowsToRemove}</span>
									</div>
								</div>
							)}
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground">Type <span className="font-bold font-mono text-foreground">RESET</span> to confirm:</p>
								<Input
									value={resetConfirmText}
									onChange={(event) => setResetConfirmText(event.target.value)}
									placeholder="RESET"
									className="font-mono"
									autoComplete="off"
								/>
							</div>
							<div className="flex justify-end gap-2 pt-2">
								<Button variant="ghost" size="sm" onClick={() => { setResetDialogOpen(false); setResetConfirmText(''); }}>
									Cancel
								</Button>
								<Button
									variant="destructive"
									size="sm"
									disabled={!canRunGlobalReset || resetLoading || resetConfirmText.trim().toUpperCase() !== 'RESET'}
									onClick={applyGlobalReset}
								>
									{resetLoading ? 'Resetting...' : 'Confirm Reset'}
								</Button>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</TooltipProvider>
	);
}
