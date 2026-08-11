import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	BookOpen,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Loader2,
	Map as MapIcon,
	Plus,
	RefreshCw,
	Users,
	Info,
	CheckCircle2,
} from 'lucide-react';

import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import { gradeLabel, GRADE_COLORS } from '@/lib/grade-labels';
import {
	ALL_ROOM_TYPES,
	GRADE_OPTIONS,
	PROGRAM_SCOPE_OPTIONS,
	ROOM_TYPE_LABELS,
} from '@/lib/subject-constants';
import type { RoomType, Subject } from '@/types';
import { SubjectFormModal, type SubjectFormValues } from '@/components/subjects/SubjectFormModal';
import { SubjectRow } from '@/components/subjects/SubjectRow';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { DeleteSubjectDialog } from '@/components/subjects/DeleteSubjectDialog';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/ui/sheet';
import { Skeleton } from '@/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';
import { departmentLabel, programFullLabel, gradeCompact } from '@/lib/deped-glossary';
import {
	AdminSearchFilterToolbar,
	AdminStatePanel,
	AdminTableShell,
	AdminWorkspaceFrame,
	type AdminSourceState,
} from '@/components/admin-workspace/AdminWorkspace';


const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50, 100];

type SortField = 'code' | 'name' | 'minMinutesPerWeek' | 'preferredRoomType' | 'programScopes' | 'gradeLevels' | 'isSeedable';
type SortDir = 'asc' | 'desc';

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

function resolveSubjectTermRank(subject: Pick<Subject, 'rotationTermRank' | 'modularOrder'>): number | null {
	if (typeof subject.rotationTermRank === 'number' && Number.isInteger(subject.rotationTermRank) && subject.rotationTermRank > 0) {
		return subject.rotationTermRank;
	}
	if (typeof subject.modularOrder === 'number' && Number.isInteger(subject.modularOrder) && subject.modularOrder > 0) {
		return subject.modularOrder;
	}
	return null;
}

function resolveSubjectTermLabel(subject: Pick<Subject, 'rotationTermLabel' | 'rotationTermRank' | 'modularOrder'>): string | null {
	const explicit = (subject.rotationTermLabel ?? '').trim();
	if (explicit.length > 0) {
		const rankMatch = explicit.match(/(\d+)/);
		if (rankMatch) {
			const parsed = Number(rankMatch[1]);
			if (Number.isInteger(parsed) && parsed > 0) {
				return `Term ${parsed}`;
			}
		}
		return explicit;
	}
	const rank = resolveSubjectTermRank(subject);
	return rank ? `Term ${rank}` : null;
}

export default function Subjects() {
	const [subjects, setSubjects] = useState<Subject[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
	const [modalSubject, setModalSubject] = useState<SubjectFormValues | null>(null);
	const [modalSubjectMeta, setModalSubjectMeta] = useState<Subject | null>(null);
	const [saving, setSaving] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
	const [archiveTarget, setArchiveTarget] = useState<Subject | null>(null);
	const [archivingLoading, setArchivingLoading] = useState(false);
	const [syncingContract, setSyncingContract] = useState(false);
	const [syncError, setSyncError] = useState(false);
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [showFilters, setShowFilters] = useState(false);

	// Teacher coverage drilldown
	const [coverageSubject, setCoverageSubject] = useState<Subject | null>(null);
	const [teacherCoverage, setTeacherCoverage] = useState<Record<number, {
		assigned: { facultyId: number; name: string; grades: number[]; load: number; sections: string[] }[]
	}>>({});
	const [coverageLoading, setCoverageLoading] = useState(false);
	// Phase 2.3: per-subject coverage fetch error so the drawer can distinguish
	// "no teachers assigned" from "the coverage fetch failed" (audit Sub-5).
	const [coverageError, setCoverageError] = useState<Map<number, string>>(new Map());
	const [assignedSubjectIds, setAssignedSubjectIds] = useState<Set<number> | null>(null);

	// Sorting
	const [sortField, setSortField] = useState<SortField>('code');
	const [sortDir, setSortDir] = useState<SortDir>('asc');

	// Pagination
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);

	// Filters
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
	const [roomTypeFilter, setRoomTypeFilter] = useState<RoomType | 'all'>('all');
	const [gradeLevelFilter, setGradeLevelFilter] = useState<number | 'all'>('all');
	const [programScopeFilter, setProgramScopeFilter] = useState<string>('all');
	const [attentionFilter, setAttentionFilter] = useState<'all' | 'missing-coverage' | 'room-constrained'>('all');

	const fetchSubjects = useCallback(async () => {
		setLoading(true);
		try {
			const { data } = await atlasApi.get<{ subjects: Subject[] }>('/subjects', {
				params: { schoolId: DEFAULT_SCHOOL_ID },
			});
			setSubjects(data.subjects);
			setError(null);
		} catch {
			setError('Failed to load subjects.');
		} finally {
			setLoading(false);
		}
	}, []);

	const ensureActiveSchoolYear = useCallback(async () => {
		if (activeSchoolYearId) {
			return activeSchoolYearId;
		}
		const context = await resolveActiveSchoolYearContext({
			allowStaleOnError: true,
			allowEnrollProFallback: false,
		});
		if (!context.activeSchoolYearId) {
			throw new Error('Active school year is not configured.');
		}
		setActiveSchoolYearId(context.activeSchoolYearId);
		return context.activeSchoolYearId;
	}, [activeSchoolYearId]);

	useEffect(() => {
		fetchSubjects();
	}, [fetchSubjects]);

	useEffect(() => {
		ensureActiveSchoolYear().catch(() => {
			// Keep page readable even if school-year context is temporarily unavailable.
		});
	}, [ensureActiveSchoolYear]);

	const fetchTeacherCoverage = useCallback(async (subjectId: number) => {
		const targetSubject = subjects.find(s => s.id === subjectId);
		if (!targetSubject) return;

		setCoverageLoading(true);
		try {
			const schoolYearId = await ensureActiveSchoolYear();
			const { data } = await atlasApi.get<{ faculty: any[] }>('/faculty-assignments/summary', {
				params: { schoolId: DEFAULT_SCHOOL_ID, schoolYearId }, 
			});
			
			const assigned: { facultyId: number; name: string; grades: number[]; load: number; sections: string[] }[] = [];

			for (const f of data.faculty ?? []) {
				const isAssigned = (f.assignments ?? []).some((a: any) => a.subjectId === subjectId);
				const load = (f as any).loadPercentage ?? 0;
				if (isAssigned) {
					const assignment = f.assignments.find((a: any) => a.subjectId === subjectId);
					const sections = (assignment?.sections ?? []).map((section: any) => `${gradeCompact(section.displayOrder)} ${section.name}`);
					assigned.push({ 
						facultyId: f.id,
						name: `${f.lastName}, ${f.firstName}`, 
						grades: assignment.gradeLevels ?? [],
						load,
						sections,
					});
				}
			}

			setTeacherCoverage((prev) => ({ 
				...prev, 
				[subjectId]: { assigned } 
			}));
		} catch (err: any) {
			const message = err?.response?.data?.message ?? err?.message ?? 'Failed to load teacher coverage';
			setCoverageError((prev) => {
				const next = new Map(prev);
				next.set(subjectId, message);
				return next;
			});
			toast.error(message);
		} finally {
			setCoverageLoading(false);
		}
	}, [subjects, ensureActiveSchoolYear]);

	const fetchCoverageSummary = useCallback(async () => {
		try {
			const schoolYearId = await ensureActiveSchoolYear();
			const { data } = await atlasApi.get<{ faculty: any[] }>('/faculty-assignments/summary', {
				params: { schoolId: DEFAULT_SCHOOL_ID, schoolYearId },
			});
			const nextAssignedSubjectIds = new Set<number>();
			for (const faculty of data.faculty ?? []) {
				for (const assignment of faculty.assignments ?? []) {
					if (typeof assignment.subjectId === 'number') {
						nextAssignedSubjectIds.add(assignment.subjectId);
					}
				}
			}
			setAssignedSubjectIds(nextAssignedSubjectIds);
		} catch {
			setAssignedSubjectIds(null);
		}
	}, [ensureActiveSchoolYear]);

	useEffect(() => {
		if (subjects.length > 0) {
			void fetchCoverageSummary();
		}
	}, [fetchCoverageSummary, subjects.length]);

	// Filtered, sorted, paginated
	const { paged, totalFiltered, totalPages } = useMemo(() => {
		let list = subjects;

		// Search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
			);
		}

		// Status filter
		if (statusFilter === 'active') list = list.filter((s) => s.isActive);
		else if (statusFilter === 'inactive') list = list.filter((s) => !s.isActive);

		// Room type filter
		if (roomTypeFilter !== 'all') list = list.filter((s) => s.preferredRoomType === roomTypeFilter);

		// Grade level filter
		if (gradeLevelFilter !== 'all') list = list.filter((s) => s.gradeLevels.includes(gradeLevelFilter));

		// Program scope filter
		if (programScopeFilter !== 'all') list = list.filter((s) => (s.programScopes ?? []).includes(programScopeFilter));
		if (attentionFilter === 'missing-coverage' && assignedSubjectIds) list = list.filter((s) => s.isActive && !assignedSubjectIds.has(s.id));
		if (attentionFilter === 'room-constrained') list = list.filter((s) => s.isActive && (s.preferredRoomType !== 'CLASSROOM' || s.requiredFeatures.length > 0));

		// Sort
		const sorted = [...list].sort((a, b) => {
			let cmp = 0;
			switch (sortField) {
				case 'code': cmp = a.code.localeCompare(b.code); break;
				case 'name': cmp = a.name.localeCompare(b.name); break;
				case 'minMinutesPerWeek': cmp = a.minMinutesPerWeek - b.minMinutesPerWeek; break;
				case 'preferredRoomType': cmp = a.preferredRoomType.localeCompare(b.preferredRoomType); break;
				case 'programScopes': cmp = (a.programScopes?.[0] ?? '').localeCompare(b.programScopes?.[0] ?? ''); break;
				case 'gradeLevels': cmp = a.gradeLevels.length - b.gradeLevels.length; break;
				case 'isSeedable': cmp = Number(b.isSeedable) - Number(a.isSeedable); break;
			}
			return sortDir === 'desc' ? -cmp : cmp;
		});

		const tf = sorted.length;
		const tp = Math.max(1, Math.ceil(tf / pageSize));
		const start = (page - 1) * pageSize;
		return { paged: sorted.slice(start, start + pageSize), totalFiltered: tf, totalPages: tp };
	}, [subjects, searchQuery, statusFilter, roomTypeFilter, gradeLevelFilter, programScopeFilter, attentionFilter, assignedSubjectIds, sortField, sortDir, page, pageSize]);

	// Reset page when filters change
	useEffect(() => { setPage(1); }, [searchQuery, statusFilter, roomTypeFilter, gradeLevelFilter, programScopeFilter, attentionFilter, pageSize]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		} else {
			setSortField(field);
			setSortDir('asc');
		}
	};

	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) return <ArrowUpDown className="size-3 text-muted-foreground/50" />;
		return sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
	};
	// Phase 2.4: SortableHeader closes over sortField/sortDir/toggleSort from
	// the component scope. aria-sort exposes the WCAG-standard sort state;
	// the button carries a plain-language accessible name and a visible Tooltip.
	const SortableHeader = ({
		field,
		label,
		align = 'left',
	}: {
		field: SortField;
		label: string;
		align?: 'left' | 'right';
	}) => {
		const isActive = sortField === field;
		const direction = isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
		const ariaLabel = `Sort by ${label}, currently ${direction}`;
		return (
			<th
				className={cn('px-4 py-3 text-left', align === 'right' && 'text-right')}
				aria-sort={direction as 'ascending' | 'descending' | 'none'}
			>
				<TooltipProvider delayDuration={200}>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => toggleSort(field)}
								aria-label={ariaLabel}
								className={cn(
									'h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground',
									align === 'right' && 'ml-auto',
								)}
							>
								{label} <SortIcon field={field} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top" className="text-xs">{ariaLabel}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</th>
		);
	};

	const handleModalSave = async (values: SubjectFormValues) => {
		setSaving(true);
		try {
			if (modalMode === 'edit' && values.id != null) {
				await atlasApi.patch(`/subjects/${values.id}`, {
					name: values.name,
					outputLabel: values.outputLabel?.trim() ? values.outputLabel.trim() : null,
					ownerDepartment: values.ownerDepartment?.trim() ? values.ownerDepartment.trim() : null,
					allowedOwnerDepartments: values.allowedOwnerDepartments,
					rotationFamily: values.rotationFamily?.trim() ? values.rotationFamily.trim() : null,
					minMinutesPerWeek: values.minMinutesPerWeek,
					preferredRoomType: values.preferredRoomType,
					isActive: values.isActive,
					isSeedable: values.isSeedable,
					isSystemManaged: values.isSystemManaged,
					gradeLevels: values.gradeLevels,
					interSectionEnabled: values.interSectionEnabled,
					interSectionGradeLevels: values.interSectionGradeLevels,
					modularGroupId: values.modularGroupId?.trim() ? values.modularGroupId.trim() : null,
					modularOrder: values.modularGroupId?.trim() ? values.modularOrder : null,
					programScopes: values.programScopes,
					requiredFeatures: values.requiredFeatures,
				});
				toast.success('Subject updated successfully.');
			} else {
				await atlasApi.post('/subjects', {
					schoolId: DEFAULT_SCHOOL_ID,
					...values,
					outputLabel: values.outputLabel?.trim() ? values.outputLabel.trim() : null,
					ownerDepartment: values.ownerDepartment?.trim() ? values.ownerDepartment.trim() : null,
					allowedOwnerDepartments: values.allowedOwnerDepartments,
					rotationFamily: values.rotationFamily?.trim() ? values.rotationFamily.trim() : null,
					modularGroupId: values.modularGroupId?.trim() ? values.modularGroupId.trim() : null,
					modularOrder: values.modularGroupId?.trim() ? values.modularOrder : null,
				});
				toast.success('Subject created successfully.');
			}
			setModalMode(null);
			setModalSubject(null);
			setModalSubjectMeta(null);
			await fetchSubjects();
		} catch (err: any) {
			const msg = err?.response?.data?.message ?? 'Failed to save subject.';
			toast.error(msg);
		} finally {
			setSaving(false);
		}
	};

	const hasActiveFilters = statusFilter !== 'all'
		|| roomTypeFilter !== 'all'
		|| gradeLevelFilter !== 'all'
		|| programScopeFilter !== 'all'
		|| attentionFilter !== 'all'
		|| searchQuery.trim() !== '';

	const handleSyncContract = async () => {
		setSyncingContract(true);
		setSyncError(false);
		try {
			const schoolYearId = await ensureActiveSchoolYear();
			await atlasApi.post('/subjects/sync-offerings', {
				schoolId: DEFAULT_SCHOOL_ID,
				schoolYearId,
			});
			await fetchSubjects();
			await fetchCoverageSummary();
			toast.success('Subject offerings refreshed for the active school year.');
		} catch (err: any) {
			setSyncError(true);
			toast.error(err?.response?.data?.message ?? 'Failed to refresh subject offerings.');
		} finally {
			setSyncingContract(false);
		}
	};



	const handleArchiveSubject = async (target: Subject) => {
		setArchivingLoading(true);
		try {
			await atlasApi.post(`/subjects/${target.id}/archive`);
			toast.success(`"${target.name}" archived.`);
			setArchiveTarget(null);
			await fetchSubjects();
		} catch (err: any) {
			toast.error(err?.response?.data?.message ?? 'Failed to archive subject.');
		} finally {
			setArchivingLoading(false);
		}
	};



	const handleReactivateSubject = async (target: Subject) => {
		try {
			await atlasApi.post(`/subjects/${target.id}/reactivate`);
			toast.success(`${target.name} reactivated.`);
			await fetchSubjects();
		} catch (err: any) {
			toast.error(err?.response?.data?.message ?? 'Failed to reactivate subject.');
		}
	};

	const subjectSourceState = useMemo<AdminSourceState>(() => {
		if (loading || syncingContract) return 'checking-source';
		if (error && subjects.length === 0) return 'no-saved-data';
		if (syncError) return 'saved-data';
		return 'verified-live';
	}, [error, loading, subjects.length, syncError, syncingContract]);

	const subjectStats = useMemo(() => {
		const activeCount = subjects.filter((subject) => subject.isActive).length;
		const archivedCount = subjects.length - activeCount;
		const roomConstrainedCount = subjects.filter((subject) => subject.isActive && (subject.preferredRoomType !== 'CLASSROOM' || subject.requiredFeatures.length > 0)).length;
		const coverageRiskCount = assignedSubjectIds
			? subjects.filter((subject) => subject.isActive && subject.isSeedable && !assignedSubjectIds.has(subject.id)).length
			: null;
		return [
			{ label: 'Active subjects', value: activeCount, tone: activeCount > 0 ? 'success' as const : 'warning' as const, helpText: archivedCount > 0 ? `${activeCount} active · ${archivedCount} archived (kept for history, hidden from new setup).` : 'Subjects currently available for scheduling this school year.' },
			{
				label: 'Missing coverage',
				value: coverageRiskCount === null
					? <Loader2 className="size-3 animate-spin" data-testid="subjects-missing-coverage-spinner" />
					: coverageRiskCount,
				tone: coverageRiskCount === null ? 'info' as const : coverageRiskCount > 0 ? 'warning' as const : 'success' as const,
				helpText: coverageRiskCount === null
					? 'ATLAS is checking teaching-load coverage.'
					: 'Active schedulable subjects with no assigned teacher found in the current teaching load.',
			},
			{ label: 'Room constrained', value: roomConstrainedCount, tone: roomConstrainedCount > 0 ? 'warning' as const : 'success' as const, helpText: 'Active subjects that need a specialized room type or room feature.' },
		];
	}, [assignedSubjectIds, subjects]);

	const coverageDetail = useMemo(() => {
		if (!coverageSubject) return null;
		const assigned = teacherCoverage[coverageSubject.id]?.assigned ?? [];
		const coveredGrades = new Set(assigned.flatMap((teacher) => teacher.grades));
		const uncoveredGrades = coverageSubject.gradeLevels.filter((grade) => !coveredGrades.has(grade));
		return {
			assigned,
			uncoveredGrades,
			programScopes: coverageSubject.programScopes ?? [],
		};
	}, [coverageSubject, teacherCoverage]);
	const openSubjectEditor = useCallback((subject: Subject) => {
		setModalSubject({
			id: subject.id,
			code: subject.code,
			outputLabel: subject.outputLabel ?? subject.displayCode ?? '',
			name: subject.name,
			ownerDepartment: subject.ownerDepartment ?? '',
			allowedOwnerDepartments: [...(subject.allowedOwnerDepartments ?? [])],
			qualificationPriority: subject.qualificationPriority ?? 'DEPARTMENT_FIRST',
			rotationFamily: subject.rotationFamily ?? '',
			minMinutesPerWeek: subject.minMinutesPerWeek,
			preferredRoomType: subject.preferredRoomType,
			gradeLevels: [...subject.gradeLevels],
			isActive: subject.isActive,
			isSeedable: subject.isSeedable,
			isSystemManaged: subject.isSystemManaged ?? false,
			interSectionEnabled: subject.interSectionEnabled ?? false,
			interSectionGradeLevels: [...(subject.interSectionGradeLevels ?? [])],
			modularGroupId: subject.modularGroupId ?? '',
			modularOrder: subject.modularOrder ?? null,
			programScopes: [...(subject.programScopes ?? ['REGULAR'])],
			allowedSpecializations: [...(subject.allowedSpecializations ?? [])],
			requiredFeatures: [...(subject.requiredFeatures ?? [])],
		});
		setModalSubjectMeta(subject);
		setModalMode('edit');
	}, []);
	const openSubjectCoverage = useCallback((subject: Subject) => {
		setCoverageSubject(subject);
		fetchTeacherCoverage(subject.id);
	}, [fetchTeacherCoverage]);
const SubjectMobileCard = ({ subject }: { subject: Subject }) => {
		const duration = `${Math.round((subject.minMinutesPerWeek / 60) * 10) / 10} h`;
		const roomNeedLabel = subject.preferredRoomType === 'CLASSROOM'
			? 'Standard classroom'
			: ROOM_TYPE_LABELS[subject.preferredRoomType] ?? subject.preferredRoomType;
		const grades = subject.gradeLevels.length > 0
			? [...subject.gradeLevels].sort((a, b) => a - b).map((grade) => gradeLabel(grade)).join(', ')
			: 'No grades';
		const programScopes = subject.programScopes ?? [];
		const programCopy = programScopes.length === 0 ? 'All programs' : programScopes.length === 1 ? programFullLabel(programScopes[0]) : `${programScopes.length} programs`;
		const coverage = teacherCoverage[subject.id]?.assigned?.length ?? 0;
		const needsCoverage = assignedSubjectIds !== null && subject.isActive && subject.isSeedable && !assignedSubjectIds.has(subject.id);

		return (
			<div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-sm" data-testid="subject-mobile-card">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="outline" className="h-6 rounded-full bg-white text-xs font-bold">{subject.code}</Badge>
							{/* Phase 2.4 audit fix: match the desktop Coverage column
								(Archived / Excluded / schedulable states). */}
							{!subject.isActive ? (
								<Badge className="h-6 rounded-full border-0 bg-amber-50 text-xs font-bold text-amber-700">Archived</Badge>
							) : subject.isSeedable ? (
								<Badge className="h-6 rounded-full border-0 bg-emerald-50 text-xs font-bold text-emerald-700">Available</Badge>
							) : (
								<Badge className="h-6 rounded-full border-0 bg-slate-50 text-xs font-bold text-slate-600">Excluded</Badge>
							)}
							{needsCoverage && <Badge className="h-6 rounded-full border-0 bg-amber-100 text-xs font-bold text-amber-800">Needs teacher</Badge>}
						</div>
						<h3 className="mt-2 truncate text-base font-bold text-foreground">{subject.name}</h3>
						<p className="mt-0.5 text-xs font-medium text-muted-foreground">{departmentLabel(subject.ownerDepartment)} · {programCopy}</p>
					</div>
				</div>

				<div className="mt-3 grid grid-cols-2 gap-2 text-xs">
					<div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
						<p className="font-bold uppercase tracking-widest text-muted-foreground">Weekly time</p>
						<p className="mt-1 text-sm font-bold text-foreground">{duration}</p>
					</div>
					<div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
						<p className="font-bold uppercase tracking-widest text-muted-foreground">Room need</p>
						<p className="mt-1 truncate text-sm font-bold text-foreground">{roomNeedLabel}</p>
					</div>
					<div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
						<p className="font-bold uppercase tracking-widest text-muted-foreground">Grades</p>
						<p className="mt-1 truncate text-sm font-bold text-foreground">{grades}</p>
					</div>
					<div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
						<p className="font-bold uppercase tracking-widest text-muted-foreground">Coverage</p>
						<p className={needsCoverage ? 'mt-1 text-sm font-bold text-amber-700' : 'mt-1 text-sm font-bold text-emerald-700'}>
							{!subject.isActive ? 'Archived' : !subject.isSeedable ? 'Excluded' : needsCoverage ? 'Needs teacher' : `${coverage} teacher${coverage === 1 ? '' : 's'}`}
						</p>
					</div>
				</div>

				<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3">
					<Button type="button" size="sm" className="h-11 flex-1 font-bold" onClick={() => openSubjectCoverage(subject)}>
						Review coverage
					</Button>
					<Button type="button" size="sm" variant="outline" className="h-11 flex-1 font-bold" onClick={() => openSubjectEditor(subject)}>
						Edit subject
					</Button>
				</div>
			</div>
		);
	};

	return (
		<AdminWorkspaceFrame
			title = "Subjects"
			description="Review the curriculum subjects that can be scheduled for this school year. Start with missing teacher coverage and room-constrained subjects before generation."
			sourceState={subjectSourceState}
			sourceCopy={{
				description:
					subjectSourceState === 'verified-live'
							? 'The curriculum subject list is loaded for the active school year.'
						: subjectSourceState === 'checking-source'
							? 'ATLAS is checking which subjects and program offerings should be active while the page stays usable.'
						: subjectSourceState === 'saved-data'
							? 'ATLAS is showing the last known curriculum list while offering verification is incomplete.'
						: 'ATLAS could not load a usable subject catalog.',
				nextAction:
					subjectSourceState === 'verified-live'
							? 'Open coverage for subjects with risk, or add a subject if the curriculum list is missing one.'
						: subjectSourceState === 'checking-source'
							? 'Keep reviewing subjects and wait before final curriculum changes.'
						: subjectSourceState === 'saved-data'
							? 'Refresh offerings before treating this as final curriculum truth.'
						: 'Reconnect and sync subjects before this page can be used.',
			}}
stats={subjectStats}
			secondaryActions={null}
			primaryActions={(
				<div className="flex items-center gap-2">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" onClick={handleSyncContract} size="sm" className="gap-2" disabled={syncingContract}>
									<RefreshCw className={`size-4 ${syncingContract ? 'animate-spin' : ''}`} />
									Refresh offerings
								</Button>
							</TooltipTrigger>
							<TooltipContent className="max-w-72 text-xs leading-relaxed">Checks which subjects and program offerings should be active for the current school year.</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					<Button onClick={() => { setModalMode('add'); setModalSubject(null); setModalSubjectMeta(null); }} variant="outline" size="sm" className="gap-2">
						<Plus className="size-4" />
						Add subject
					</Button>
				</div>
			)}
			toolbar={(
				<AdminSearchFilterToolbar
					searchValue={searchQuery}
					onSearchChange={setSearchQuery}
					searchPlaceholder="Search name or code..."
					filtersOpen={showFilters}
					onToggleFilters={() => setShowFilters(!showFilters)}
					hasActiveFilters={hasActiveFilters}
				>
						<Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
							<SelectTrigger className="h-10 w-36 text-sm">
								<SelectValue placeholder="All Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">Archived</SelectItem>
							</SelectContent>
						</Select>
						<Select value={attentionFilter} onValueChange={(value) => setAttentionFilter(value as typeof attentionFilter)}>
							<SelectTrigger className="h-10 w-52 text-sm">
								<SelectValue placeholder="All statuses" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								<SelectItem value="missing-coverage">Missing teacher coverage</SelectItem>
								<SelectItem value="room-constrained">Room-constrained subjects</SelectItem>
							</SelectContent>
						</Select>
						<Select value={roomTypeFilter} onValueChange={(v) => setRoomTypeFilter(v as typeof roomTypeFilter)}>
							<SelectTrigger className="h-10 w-44 text-sm">
								<SelectValue placeholder="All Room Types" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Room Types</SelectItem>
								{ALL_ROOM_TYPES.map((t) => (
									<SelectItem key={t} value={t}>{ROOM_TYPE_LABELS[t]}</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select value={String(gradeLevelFilter)} onValueChange={(v) => setGradeLevelFilter(v === 'all' ? 'all' : Number(v))}>
							<SelectTrigger className="h-10 w-36 text-sm">
								<SelectValue placeholder="All Grades" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Grades</SelectItem>
								{GRADE_OPTIONS.map((g) => (
									<SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select value={programScopeFilter} onValueChange={setProgramScopeFilter}>
							<SelectTrigger className="h-10 w-40 text-sm">
								<SelectValue placeholder="All Programs" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Programs</SelectItem>
								{PROGRAM_SCOPE_OPTIONS.map((o) => (
									<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
								))}
							</SelectContent>
</Select>

					{hasActiveFilters && (
							<Button
								variant="ghost"
								size="sm"
								className="px-3 text-sm text-muted-foreground hover:text-foreground"
								data-testid="subjects-reset-filters"
								onClick={() => {
									setStatusFilter('all');
									setRoomTypeFilter('all');
									setGradeLevelFilter('all');
									setProgramScopeFilter('all');
									setAttentionFilter('all');
									setSearchQuery('');
								}}
							>
								Reset filters
							</Button>
						)}
				</AdminSearchFilterToolbar>
			)}
		>

			{/* Status Banners */}
			{syncError && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-sm animate-in fade-in duration-300">
					<AlertTriangle className="size-4 shrink-0 text-amber-600" />
						<span className="flex-1 font-medium">ATLAS could not refresh the active subject offerings. The last saved curriculum list is still shown.</span>
					<Button size="sm" variant="outline" onClick={handleSyncContract} disabled={syncingContract} className="shrink-0 h-7 border-amber-300 hover:bg-amber-100 text-amber-900 font-bold">
							<RefreshCw className={`mr-1.5 size-3 ${syncingContract ? 'animate-spin' : ''}`} /> Retry refresh
					</Button>
				</div>
			)}

			{error && !syncError && (
				<div
					role={error ? 'alert' : 'status'}
					data-testid="subjects-error-banner"
					className="shrink-0 mx-6 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive flex items-center justify-between shadow-sm"
				>
					<div className="flex items-center gap-2">
						<AlertTriangle className="size-4 shrink-0" />
						<span className="font-medium">{error}</span>
					</div>
					<div className="flex items-center gap-1">
						<Button
							size="sm"
							variant="outline"
							onClick={() => void fetchSubjects()}
							disabled={loading}
							className="h-7 px-2 font-bold"
							data-testid="subjects-error-retry"
						>
							<RefreshCw className={`mr-1 size-3 ${loading ? 'animate-spin' : ''}`} /> Try again
						</Button>
						<Button variant="ghost" size="sm" className="h-7 px-2 font-bold" onClick={() => setError(null)}>Dismiss</Button>
					</div>
				</div>
			)}

			<AdminTableShell
				footer={!loading && subjects.length > 0 ? (
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
							<span>
								{totalFiltered === 0
									? 'No results'
									: `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalFiltered)} of ${totalFiltered} results`}
							</span>
							<div className="flex items-center gap-2 border-l pl-4 border-border/50">
								<span>Rows per page:</span>
								<Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
									<SelectTrigger className="h-7 w-20 text-xs bg-background">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="flex items-center gap-1.5">
							<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={page <= 1}><ChevronsLeft className="size-4" /></Button>
							<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft className="size-4" /></Button>
							<div className="flex items-center gap-1.5 px-3 h-8 rounded-md border bg-background text-xs font-bold tabular-nums"><span>{page}</span><span className="text-muted-foreground/50 font-normal">/</span><span className="text-muted-foreground font-normal">{totalPages}</span></div>
							<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}><ChevronRight className="size-4" /></Button>
							<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={page >= totalPages}><ChevronsRight className="size-4" /></Button>
						</div>
					</div>
				) : undefined}
			>
						<div className="space-y-3 p-3 md:hidden">
							{loading ? (
								Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)
							) : paged.length === 0 ? (
								<div className="flex min-h-80 items-center justify-center px-4 py-12 text-center">
									<AdminStatePanel
										icon={<BookOpen className="size-8" />}
										title={subjects.length === 0 ? 'No subjects found.' : 'No matches found.'}
										description={subjects.length === 0 ? 'Refresh offerings to load curriculum subjects for this school year.' : 'Clear a filter or search another subject name or code.'}
									/>
								</div>
							) : (
								paged.map((subject) => <SubjectMobileCard key={subject.id} subject={subject} />)
							)}
						</div>
					<table className="hidden w-full text-sm md:table">
							<thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
								<tr className="border-b">
									{/* Phase 2.4: SortableHeader helper mirrors Phase 1.5. aria-sort
										exposes the sort state, the button carries an accessible
										name + visible Tooltip. The helper closes over the
										component's sortField/sortDir/toggleSort. */}
									<SortableHeader field="name" label="Subject and code" align="left" />
									<SortableHeader field="minMinutesPerWeek" label="Weekly time" align="left" />
									<SortableHeader field="preferredRoomType" label="Room need" align="left" />
									<SortableHeader field="programScopes" label="Program" align="left" />
									<SortableHeader field="gradeLevels" label="Grades" align="left" />
									<SortableHeader field="isSeedable" label="Coverage" align="left" />
									<th className="px-4 py-3 text-right font-semibold text-muted-foreground uppercase tracking-wider text-xs">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/40">
								{loading ? (
									Array.from({ length: 8 }).map((_, i) => (
										<tr key={i}>
											<td className="px-4 py-4"><Skeleton className="h-5 w-48" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-16" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-24" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-20" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-16" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-24" /></td>
											<td className="px-4 py-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
										</tr>
									))
								) : paged.length === 0 ? (
									<tr>
										<td colSpan={7} className="px-4 py-20 text-center">
											<AdminStatePanel icon={<BookOpen className="size-8" />} title = {subjects.length === 0 ? 'No subjects found.' : 'No matches found.'} description={subjects.length === 0 ? 'Refresh offerings to load curriculum subjects for this school year.' : 'Clear a filter or search another subject name or code.'} />
										</td>
									</tr>
								) : (
									paged.map((s) => (
<SubjectRow
											key={s.id}
											subject={s}
											timeMode="hours"
											assignedSubjectIds={assignedSubjectIds ?? undefined}
											onEdit={openSubjectEditor}
											onDelete={(target) => setDeleteTarget(target)}
											onArchive={(target) => setArchiveTarget(target)}
											onShowCoverage={openSubjectCoverage}
										onReactivate={handleReactivateSubject}
										/>
									))
								)}
							</tbody>
						</table>
			</AdminTableShell>

			{/* Coverage Side Drawer */}
			<Sheet open={!!coverageSubject} onOpenChange={(open) => !open && setCoverageSubject(null)}>
				<SheetContent className="w-full sm:max-w-md overflow-y-auto">
					<SheetHeader className="pb-6 border-b">
						<SheetTitle className="flex items-center gap-2 text-xl font-bold">
							<Users className="size-5 text-primary" />
							Subject coverage
						</SheetTitle>
						<SheetDescription>
							Assigned teachers and uncovered grade/program scope for <span className="font-bold text-foreground">{coverageSubject?.name}</span>.
						</SheetDescription>
					</SheetHeader>

					<div className="py-6 space-y-8">
						{coverageLoading ? (
							<div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
								<RefreshCw className="size-8 animate-spin opacity-20" />
								<p className="text-sm animate-pulse">Analyzing teacher qualifications...</p>
							</div>
						) : coverageSubject && (
							<>
								{/* Phase 2.3: in-drawer error panel (audit Sub-5). Distinct
									from the "no teachers assigned" empty state below so a
									network failure is not misclassified as a coverage gap. */}
								{coverageError.has(coverageSubject.id) ? (
									<div
										role="alert"
										data-testid="coverage-drawer-error"
										className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
									>
										<AlertTriangle className="size-5 shrink-0 mt-0.5" />
										<div className="space-y-1">
											<p className="font-semibold">Could not load coverage right now.</p>
											<p className="text-xs opacity-90">{coverageError.get(coverageSubject.id)}</p>
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="mt-2 h-8 font-bold"
												onClick={() => fetchTeacherCoverage(coverageSubject.id)}
											>
												<RefreshCw className="mr-1 size-3" /> Try again
											</Button>
										</div>
									</div>
								) : null}

								{/* Phase 2.3: only render the Term rotation panel for subjects
									with a rotation family. The italic body line that
									always rendered was confusing for non-rotating subjects. */}
								{coverageSubject.rotationFamily ? (
									<div className="rounded-xl border border-violet-100 bg-violet-50/30 p-4 space-y-3">
										<div className="flex items-center justify-between">
											<p className="text-xs font-semibold uppercase tracking-widest text-violet-700/80">Term rotation</p>
											<Tooltip>
												<TooltipTrigger asChild>
													<div className="flex items-center gap-1.5 cursor-help">
														<Info className="size-3 text-violet-400" />
														<span className="text-xs font-bold text-violet-600 uppercase tracking-tight">Rotates by term</span>
													</div>
												</TooltipTrigger>
												<TooltipContent side="top" className="text-xs font-bold max-w-50">
													This subject shares a weekly schedule lane with related subjects across terms.
												</TooltipContent>
											</Tooltip>
										</div>
										<div className="flex flex-wrap gap-1.5">
											<Badge variant="outline" className="bg-white text-violet-700 border-violet-200 font-bold text-xs uppercase px-1.5 h-5 shadow-none">
												{coverageSubject.code}
											</Badge>
											<Badge variant="outline" className="bg-violet-100 text-violet-900 border-violet-300 font-semibold text-xs uppercase px-1.5 h-5 shadow-none">
												Rotating
											</Badge>
											{resolveSubjectTermLabel(coverageSubject) && (
												<Badge variant="outline" className="bg-violet-100 text-violet-900 border-violet-300 font-semibold text-xs uppercase px-1.5 h-5 shadow-none">
													{resolveSubjectTermLabel(coverageSubject)}
												</Badge>
											)}
										</div>
										<p className="text-xs text-violet-800/80 leading-relaxed font-medium italic">
											Rotating subjects share time across terms, so check both assigned teachers and uncovered grades before generation.
										</p>
									</div>
								) : null}

								{/* Assigned Teachers */}
								<div className="space-y-4">
									<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
										<div className="size-1.5 rounded-full bg-emerald-500" />
										Assigned teachers
										<Badge variant="secondary" className="ml-auto bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100 font-bold">
											{coverageDetail?.assigned.length ?? 0}
										</Badge>
									</h4>
									
									{(coverageDetail?.assigned.length ?? 0) > 0 ? (
										<div className="space-y-3">
											{coverageDetail?.assigned.map((t) => (
												<div key={t.facultyId} className="group p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-sm space-y-3">
													<div className="flex items-start justify-between gap-4 border-b border-emerald-100/50 pb-2">
														<div className="min-w-0">
															<p className="text-sm font-bold truncate leading-tight">{t.name}</p>
															<div className="flex flex-wrap gap-1 mt-1.5">
																{t.grades.map((g) => (
																	<Badge key={g} variant="outline" className={`text-xs px-1.5 py-0 h-4 font-bold border-opacity-40 ${GRADE_COLORS[String(g)] ?? ''}`}>
																		{gradeLabel(g)}
																	</Badge>
																))}
															</div>
														</div>
														<Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shadow-none border-emerald-200 font-bold">
															{t.load}% Load
														</Badge>
													</div>
													
													{t.sections.length > 0 ? (
														<div className="space-y-1.5">
															<p className="text-xs font-bold text-emerald-700/70 uppercase tracking-wider">Assigned Sections</p>
															<div className="flex flex-wrap gap-1.5">
																{t.sections.map((section, idx) => (
																	<div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-emerald-100/50 shadow-sm">
																		<span className="text-xs font-semibold text-foreground">{section}</span>
																	</div>
																))}
															</div>
														</div>
													) : (
														<p className="text-xs text-muted-foreground italic">No sections explicitly mapped.</p>
													)}
												</div>
											))}
										</div>
									) : (
										<div className="p-10 rounded-xl border border-dashed text-center bg-muted/5">
											<p className="text-sm text-muted-foreground italic">No teachers assigned to this subject yet.</p>
											<Link to={`/teaching-load?subjectId=${coverageSubject.id}`} className="mt-3 inline-flex">
												<Button size="sm" className="gap-2 bg-primary text-primary-foreground shadow-primary-glow hover:bg-primary/90">
													Fix in Teaching Load
													<ChevronRight className="size-3.5" />
												</Button>
											</Link>
										</div>
									)}
								</div>

								<div className="space-y-4">
									<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
										<div className={`size-1.5 rounded-full ${(coverageDetail?.uncoveredGrades.length ?? 0) > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
										Coverage gaps
									</h4>
									<div className={(coverageDetail?.uncoveredGrades.length ?? 0) > 0 ? 'rounded-xl border border-amber-200 bg-amber-50 p-4' : 'rounded-xl border border-emerald-200 bg-emerald-50 p-4'}>
										{(coverageDetail?.uncoveredGrades.length ?? 0) > 0 ? (
											<div className="space-y-3">
												<p className="text-sm font-bold text-amber-900">These grades do not yet have a teacher mapped for this subject.</p>
												<div className="flex flex-wrap gap-1.5">
													{coverageDetail?.uncoveredGrades.map((grade) => (
														<Badge key={grade} variant="outline" className={`font-bold ${GRADE_COLORS[String(grade)] ?? ''}`}>{gradeLabel(grade)}</Badge>
													))}
												</div>
												<Link to={`/teaching-load?subjectId=${coverageSubject.id}`} className="inline-flex">
													<Button size="sm" variant="outline" className="gap-2 border-amber-300 text-amber-900 hover:bg-amber-100">
														Fix coverage in Teaching Load
														<ChevronRight className="size-3.5" />
													</Button>
												</Link>
											</div>
										) : (coverageDetail?.programScopes.length ?? 0) > 0 ? (
											/* Phase 2.3: when program scopes are set, we cannot
												verify per-program coverage from the current data
												shape. The audit (Sub-6) flagged the green "all
												covered" check as misleading in that case. Show a
												neutral "verify in Teaching Load" hint instead. */
											<div className="flex items-start gap-3 text-amber-900">
												<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
												<div>
													<p className="text-sm font-bold">All listed grades have assigned coverage.</p>
													<p className="text-xs font-medium text-amber-800">This subject is scoped to specific programs. Verify per-program coverage in Teaching Load before generation.</p>
												</div>
											</div>
										) : (
											<div className="flex items-start gap-3 text-emerald-900">
												<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
												<div>
													<p className="text-sm font-bold">All listed grades have assigned coverage.</p>
												</div>
											</div>
										)}
									</div>
									<div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
										<span className="font-bold uppercase tracking-wider">Program scope:</span>
										{coverageDetail?.programScopes.map((scope) => (
											<Badge key={scope} variant="outline" className="bg-white text-slate-700 shadow-none" aria-label={programFullLabel(scope)}>{programFullLabel(scope)}</Badge>
										))}
									</div>
									<Link to={`/teaching-load?subjectId=${coverageSubject.id}`} className="inline-flex">
										<Button size="sm" variant="outline" className="gap-2">
											Open in Teaching Load
											<ChevronRight className="size-3.5" />
										</Button>
									</Link>
								</div>

								{/* Phase 2.3: render Resource requirements for non-classroom
									subjects AND for subjects with required room features
									(audit Sub-6 -- the old code only gated on
									preferredRoomType !== 'CLASSROOM', silently dropping
									subjects that needed a feature but used a standard room). */}
								{((coverageSubject.preferredRoomType !== 'CLASSROOM') || (coverageSubject.requiredFeatures.length > 0)) && (
									<div className="p-4 rounded-xl bg-muted/40 border border-muted/50 flex items-start gap-3 shadow-sm">
										<MapIcon className="size-5 text-muted-foreground shrink-0 mt-0.5" />
										<div className="space-y-1">
											<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Resource requirements</p>
											{coverageSubject.preferredRoomType !== 'CLASSROOM' ? (
												<p className="text-sm font-medium">Requires <span className="font-bold text-primary">{ROOM_TYPE_LABELS[coverageSubject.preferredRoomType] ?? coverageSubject.preferredRoomType}</span> facilities.</p>
											) : null}
											{coverageSubject.requiredFeatures.length > 0 ? (
												<p className="text-sm font-medium">
													Needs {coverageSubject.requiredFeatures.length} room feature{coverageSubject.requiredFeatures.length === 1 ? '' : 's'}:{' '}
													<span className="font-bold text-primary">{coverageSubject.requiredFeatures.join(', ')}</span>
												</p>
											) : null}
											<Link to="/map" className="text-xs text-primary font-bold flex items-center gap-1 hover:underline pt-1 uppercase tracking-tight">
												View occupancy map
												<ChevronRight className="size-3" />
											</Link>
										</div>
									</div>
								)}
							</>
						)}
					</div>
				</SheetContent>
			</Sheet>

			{/* Subject Form Modal (Add / Edit) */}
			<SubjectFormModal
				open={modalMode !== null}
				mode={modalMode ?? 'add'}
				initialValues={modalSubject ?? undefined}
				subjectMeta={modalSubjectMeta ? {
					displayCode: modalSubjectMeta.displayCode,
					ownerDepartment: modalSubjectMeta.ownerDepartment,
					allowedOwnerDepartments: modalSubjectMeta.allowedOwnerDepartments,
					rotationFamily: modalSubjectMeta.rotationFamily,
					rotationTermLabel: modalSubjectMeta.rotationTermLabel,
					rotationTermRank: modalSubjectMeta.rotationTermRank,
					rotationTermGroupId: modalSubjectMeta.rotationTermGroupId,
					rotationTermCount: modalSubjectMeta.rotationTermCount,
					outputLabel: modalSubjectMeta.outputLabel,
					isSystemManaged: modalSubjectMeta.isSystemManaged,
				} : undefined}
				saving={saving}
				onSave={handleModalSave}
				onClose={() => { setModalMode(null); setModalSubject(null); setModalSubjectMeta(null); }}
			/>

			<ConfirmationModal
				open={!!archiveTarget}
				title = "Archive subject for new schedules"
				description={archiveTarget ? `Archive "${archiveTarget.name}"? It will stay in history but will not appear in new subject setup or teaching-load assignments.` : ''}
				confirmText="Archive subject"
				variant="warning"
				loading={archivingLoading}
				onConfirm={() => archiveTarget && handleArchiveSubject(archiveTarget)}
				onOpenChange={(open) => !open && setArchiveTarget(null)}
			/>

			<DeleteSubjectDialog
				target={deleteTarget}
				onClose={() => setDeleteTarget(null)}
				onDeleted={() => {
					void fetchSubjects();
				}}
				onEnsureSchoolYear={ensureActiveSchoolYear}
			/>
		</AdminWorkspaceFrame>
	);
}
