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
	Filter,
	Map,
	Plus,
	RefreshCw,
	Search,
	Trash2,
	Users,
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
import { Card } from '@/ui/card';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/ui/sheet';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';


const DEFAULT_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50, 100];

type SortField = 'code' | 'name' | 'minMinutesPerWeek' | 'preferredRoomType' | 'gradeLevels';
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
	const [deleteBlocker, setDeleteBlocker] = useState<{
		target: Subject;
		reason: string;
		message: string;
		details?: {
			activeAssignmentCount?: number;
			historicalAssignmentCount?: number;
			canCleanupHistorical?: boolean;
			canCleanupActive?: boolean;
			canCleanupAll?: boolean;
			requiresArchiveFirst?: boolean;
			teachingLoadPath?: string;
			recommendedAction?: string;
		};
	} | null>(null);
	const [deleteActionLoading, setDeleteActionLoading] = useState(false);
	const [syncingContract, setSyncingContract] = useState(false);
	const [syncError, setSyncError] = useState(false);
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [showFilters, setShowFilters] = useState(false);
	const [timeMode, setTimeMode] = useState<'minutes' | 'hours'>('minutes');

	// Teacher coverage drilldown
	const [coverageSubject, setCoverageSubject] = useState<Subject | null>(null);
	const [teacherCoverage, setTeacherCoverage] = useState<Record<number, { 
		assigned: { facultyId: number; name: string; grades: number[]; load: number; sections: string[] }[]
	}>>({});
	const [coverageLoading, setCoverageLoading] = useState(false);

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
		const context = await resolveActiveSchoolYearContext({ allowStaleOnError: true });
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
					const sections = (assignment?.sections ?? []).map((section: any) => `G${section.displayOrder} ${section.name}`);
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
		} catch {
			toast.error('Failed to load teacher coverage');
		} finally {
			setCoverageLoading(false);
		}
	}, [subjects, ensureActiveSchoolYear]);

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

		// Sort
		const sorted = [...list].sort((a, b) => {
			let cmp = 0;
			switch (sortField) {
				case 'code': cmp = a.code.localeCompare(b.code); break;
				case 'name': cmp = a.name.localeCompare(b.name); break;
				case 'minMinutesPerWeek': cmp = a.minMinutesPerWeek - b.minMinutesPerWeek; break;
				case 'preferredRoomType': cmp = a.preferredRoomType.localeCompare(b.preferredRoomType); break;
				case 'gradeLevels': cmp = a.gradeLevels.length - b.gradeLevels.length; break;
			}
			return sortDir === 'desc' ? -cmp : cmp;
		});

		const tf = sorted.length;
		const tp = Math.max(1, Math.ceil(tf / pageSize));
		const start = (page - 1) * pageSize;
		return { paged: sorted.slice(start, start + pageSize), totalFiltered: tf, totalPages: tp };
	}, [subjects, searchQuery, statusFilter, roomTypeFilter, gradeLevelFilter, programScopeFilter, sortField, sortDir, page, pageSize]);

	// Reset page when filters change
	useEffect(() => { setPage(1); }, [searchQuery, statusFilter, roomTypeFilter, gradeLevelFilter, programScopeFilter, pageSize]);

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

	const hasActiveFilters = statusFilter !== 'all' || roomTypeFilter !== 'all' || gradeLevelFilter !== 'all' || programScopeFilter !== 'all';

	const handleSyncContract = async () => {
		setSyncingContract(true);
		try {
			const schoolYearId = await ensureActiveSchoolYear();
			await atlasApi.post('/subjects/sync-offerings', {
				schoolId: DEFAULT_SCHOOL_ID,
				schoolYearId,
			});
			await fetchSubjects();
			toast.success('Subject contract synced from offerings and mirrored section demand.');
		} catch (err: any) {
			toast.error(err?.response?.data?.message ?? 'Failed to sync subject contract.');
		} finally {
			setSyncingContract(false);
		}
	};

	const handleDelete = async (
		target: Subject,
		options?: { cleanupHistorical?: boolean; cleanupActive?: boolean; cleanupAll?: boolean },
	) => {
		try {
			const params: Record<string, boolean> = {};
			if (options?.cleanupHistorical) params.cleanupHistorical = true;
			if (options?.cleanupActive) params.cleanupActive = true;
			if (options?.cleanupAll) params.cleanupAll = true;
			const { data } = await atlasApi.delete<{ cleanedHistoricalAssignments?: number }>(`/subjects/${target.id}`, {
				params: Object.keys(params).length > 0 ? params : undefined,
			});

			if (typeof data?.cleanedHistoricalAssignments === 'number' && data.cleanedHistoricalAssignments > 0) {
				const cleanupLabel = options?.cleanupAll || options?.cleanupActive
					? 'teaching-load assignment rows'
					: 'historical assignment rows';
				toast.success(`Subject deleted. Cleaned ${data.cleanedHistoricalAssignments} ${cleanupLabel}.`);
			} else {
				toast.success('Subject deleted.');
			}
			setDeleteTarget(null);
			setDeleteBlocker(null);
			await fetchSubjects();
		} catch (err: any) {
			const payload = err?.response?.data;
			if (payload?.code === 'DELETE_BLOCKED') {
				setDeleteBlocker({
					target,
					reason: payload?.reason ?? 'UNKNOWN',
					message: payload?.message ?? 'Delete is blocked for this subject.',
					details: payload?.details,
				});
				setDeleteTarget(null);
				return;
			}
			const msg = payload?.message ?? 'Failed to delete subject.';
			toast.error(msg);
		}
	};

	const handleArchiveSubject = async (target: Subject) => {
		setDeleteActionLoading(true);
		try {
			await atlasApi.post(`/subjects/${target.id}/archive`);
			toast.success('Subject archived. You can now run historical cleanup before delete.');
			setDeleteBlocker(null);
			await fetchSubjects();
		} catch (err: any) {
			toast.error(err?.response?.data?.message ?? 'Failed to archive subject.');
		} finally {
			setDeleteActionLoading(false);
		}
	};

	const handleCleanupAndDelete = async (target: Subject) => {
		setDeleteActionLoading(true);
		try {
			if (target.isActive) {
				await handleDelete(target, { cleanupHistorical: true });
			} else {
				await handleDelete(target, { cleanupAll: true });
			}
		} finally {
			setDeleteActionLoading(false);
		}
	};

	const handleClearActiveAssignments = async (target: Subject) => {
		setDeleteActionLoading(true);
		try {
			const schoolYearId = await ensureActiveSchoolYear();
			const preview = await atlasApi.post<TeachingLoadResetPreview>('/faculty-assignments/reset', {
				schoolId: DEFAULT_SCHOOL_ID,
				schoolYearId,
				subjectId: target.id,
				previewOnly: true,
			});

			if ((preview.data.ownershipRowsToRemove ?? 0) <= 0) {
				toast.info('No active section ownership rows were found for this subject in the active school year.');
				return;
			}

			const applied = await atlasApi.post<TeachingLoadResetPreview>('/faculty-assignments/reset', {
				schoolId: DEFAULT_SCHOOL_ID,
				schoolYearId,
				subjectId: target.id,
				previewOnly: false,
				confirmReset: true,
			});

			toast.success(`Removed ${applied.data.ownershipRowsToRemove} subject-section ownership rows for ${target.code}.`);
			setDeleteBlocker(null);
			await fetchSubjects();
		} catch (err: any) {
			toast.error(err?.response?.data?.message ?? 'Failed to clear active assignments for this subject.');
		} finally {
			setDeleteActionLoading(false);
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

	return (
		<div className="flex flex-col h-[calc(100svh-3.5rem)]">
			{/* Top Header - Primary Actions */}
			<div className="shrink-0 px-6 py-4 border-b bg-background/50 backdrop-blur-md">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div className="relative w-64">
							<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
							<Input
								placeholder="Search name or code..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9 h-9"
							/>
						</div>
						<Button
							variant={showFilters ? 'secondary' : 'outline'}
							size="sm"
							className="h-9 gap-2"
							onClick={() => setShowFilters(!showFilters)}
						>
							<Filter className="size-4" />
							Filters
							{hasActiveFilters && (
								<Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-primary text-primary-foreground">
									Active
								</Badge>
							)}
						</Button>
					</div>

					<div className="flex items-center gap-2">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="outline" onClick={handleSyncContract} size="sm" className="h-9" disabled={syncingContract}>
										<RefreshCw className={`size-4 ${syncingContract ? 'animate-spin' : ''}`} />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Sync Offering Contract</TooltipContent>
							</Tooltip>
						</TooltipProvider>


						<div className="h-4 w-px bg-border mx-1" />

						<Button onClick={() => { setModalMode('add'); setModalSubject(null); setModalSubjectMeta(null); }} size="sm" className="h-9 gap-2 shadow-sm">
							<Plus className="size-4" />
							Add Subject
						</Button>
					</div>
				</div>

				{/* Expanded Filters */}
				{showFilters && (
					<div className="flex flex-wrap items-center gap-3 pt-4 animate-in slide-in-from-top-2 duration-200">
						<Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
							<SelectTrigger className="h-8 w-32 text-xs">
								<SelectValue placeholder="All Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">Archived</SelectItem>
							</SelectContent>
						</Select>
						<Select value={roomTypeFilter} onValueChange={(v) => setRoomTypeFilter(v as typeof roomTypeFilter)}>
							<SelectTrigger className="h-8 w-40 text-xs">
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
							<SelectTrigger className="h-8 w-32 text-xs">
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
							<SelectTrigger className="h-8 w-36 text-xs">
								<SelectValue placeholder="All Programs" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Programs</SelectItem>
								{PROGRAM_SCOPE_OPTIONS.map((o) => (
									<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
								))}
							</SelectContent>
						</Select>

						<div className="flex items-center gap-2 border-l pl-3">
							<span className="text-[0.7rem] font-medium text-muted-foreground uppercase">Options:</span>
							<div className="flex items-center p-0.5 rounded-md bg-muted gap-0.5">
								<Button type="button" variant="ghost" size="sm" onClick={() => setTimeMode('hours')} className={`h-6 px-1.5 rounded-sm ${timeMode === 'hours' ? 'bg-background shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>hr</Button>
								<Button type="button" variant="ghost" size="sm" onClick={() => setTimeMode('minutes')} className={`h-6 px-1.5 rounded-sm ${timeMode === 'minutes' ? 'bg-background shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>min</Button>
							</div>
						</div>

						{hasActiveFilters && (
							<Button
								variant="ghost"
								size="sm"
								className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
								onClick={() => { 
									setStatusFilter('all'); 
									setRoomTypeFilter('all'); 
									setGradeLevelFilter('all'); 
									setProgramScopeFilter('all'); 
								}}
							>
								Reset all
							</Button>
						)}
					</div>
				)}
			</div>

			{/* Status Banners */}
			{syncError && (
				<div className="shrink-0 mx-6 mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-sm animate-in fade-in duration-300">
					<AlertTriangle className="size-4 shrink-0 text-amber-600" />
					<span className="flex-1 font-medium">The offerings contract could not be fully verified against the latest enrollment state. Displaying last known contract.</span>
					<Button size="sm" variant="outline" onClick={handleSyncContract} disabled={syncingContract} className="shrink-0 h-7 border-amber-300 hover:bg-amber-100 text-amber-900 font-bold">
						<RefreshCw className={`mr-1.5 size-3 ${syncingContract ? 'animate-spin' : ''}`} /> Retry Sync
					</Button>
				</div>
			)}

			{error && !syncError && (
				<div className="shrink-0 mx-6 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-900 flex items-center justify-between shadow-sm">
					<div className="flex items-center gap-2">
						<AlertTriangle className="size-4 shrink-0 text-red-600" />
						<span className="font-medium">{error}</span>
					</div>
					<Button variant="ghost" size="sm" className="h-7 px-2 font-bold" onClick={() => setError(null)}>Dismiss</Button>
				</div>
			)}

			{/* Table Container */}
			<div className="flex-1 min-h-0 px-6 py-4">
				<Card className="h-full flex flex-col shadow-sm border-border/50 overflow-hidden">
					<div className="flex-1 min-h-0 overflow-auto">
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
								<tr className="border-b">
									<th className="px-4 py-3 text-left">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('name')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground">
											Subject & Code <SortIcon field="name" />
										</Button>
									</th>
									<th className="px-4 py-3 text-left">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('minMinutesPerWeek')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground">
											Duration <SortIcon field="minMinutesPerWeek" />
										</Button>
									</th>
									<th className="px-4 py-3 text-left">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('preferredRoomType')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground">
											Room Pref. <SortIcon field="preferredRoomType" />
										</Button>
									</th>
									<th className="px-4 py-3 text-left">
										<Button variant="ghost" size="sm" onClick={() => toggleSort('gradeLevels')} className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:text-foreground">
											Grades <SortIcon field="gradeLevels" />
										</Button>
									</th>
									<th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[0.7rem]">Scope & Owner</th>
									<th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[0.7rem]">Status</th>
									<th className="px-4 py-3 text-right font-semibold text-muted-foreground uppercase tracking-wider text-[0.7rem]">Actions</th>
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
											<td className="px-4 py-4"><Skeleton className="h-5 w-24" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-14" /></td>
											<td className="px-4 py-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
										</tr>
									))
								) : paged.length === 0 ? (
									<tr>
										<td colSpan={7} className="px-4 py-20 text-center">
											<div className="flex flex-col items-center gap-4 text-muted-foreground max-w-xs mx-auto">
												<BookOpen className="size-12 opacity-20" />
												<div className="space-y-1">
													<p className="font-bold text-foreground">
														{subjects.length === 0 ? 'No subjects found.' : 'No matches found.'}
													</p>
													<p className="text-xs">
														{subjects.length === 0 
															? 'Ensure the offerings contract is synced to begin scheduling.'
															: 'Try adjusting your filters or search query to find the subject you are looking for.'}
													</p>
												</div>
											</div>
										</td>
									</tr>
								) : (
									paged.map((s) => (
										<SubjectRow
											key={s.id}
											subject={s}
											timeMode={timeMode}
											onEdit={() => {
												setModalSubject({
													id: s.id,
													code: s.code,
													outputLabel: s.outputLabel ?? s.displayCode ?? '',
													name: s.name,
													ownerDepartment: s.ownerDepartment ?? '',
													allowedOwnerDepartments: [...(s.allowedOwnerDepartments ?? [])],
													qualificationPriority: s.qualificationPriority ?? 'DEPARTMENT_FIRST',
													rotationFamily: s.rotationFamily ?? '',
													minMinutesPerWeek: s.minMinutesPerWeek,
													preferredRoomType: s.preferredRoomType,
													gradeLevels: [...s.gradeLevels],
													isActive: s.isActive,
													isSeedable: s.isSeedable,
													isSystemManaged: s.isSystemManaged ?? false,
													interSectionEnabled: s.interSectionEnabled ?? false,
													interSectionGradeLevels: [...(s.interSectionGradeLevels ?? [])],
													modularGroupId: s.modularGroupId ?? '',
													modularOrder: s.modularOrder ?? null,
													programScopes: [...(s.programScopes ?? ['REGULAR'])],
													allowedSpecializations: [...(s.allowedSpecializations ?? [])],
													requiredFeatures: [...(s.requiredFeatures ?? [])],
												});
												setModalSubjectMeta(s);
												setModalMode('edit');
											}}
											onDelete={(target) => setDeleteTarget(target)}
											onArchive={(target) => handleArchiveSubject(target)}
											onShowCoverage={(target) => {
												setCoverageSubject(target);
												fetchTeacherCoverage(target.id);
											}}
										onReactivate={handleReactivateSubject}
										/>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* Pagination Footer */}
					{!loading && subjects.length > 0 && (
						<div className="shrink-0 flex items-center justify-between border-t border-border/50 px-4 py-3 bg-muted/20">
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
								<Button 
									variant="outline" 
									size="icon" 
									className="h-8 w-8" 
									onClick={() => setPage(1)} 
									disabled={page <= 1}
								>
									<ChevronsLeft className="size-4" />
								</Button>
								<Button 
									variant="outline" 
									size="icon" 
									className="h-8 w-8" 
									onClick={() => setPage((p) => Math.max(1, p - 1))} 
									disabled={page <= 1}
								>
									<ChevronLeft className="size-4" />
								</Button>
								<div className="flex items-center gap-1.5 px-3 h-8 rounded-md border bg-background text-[0.7rem] font-bold tabular-nums">
									<span>{page}</span>
									<span className="text-muted-foreground/50 font-normal">/</span>
									<span className="text-muted-foreground font-normal">{totalPages}</span>
								</div>
								<Button 
									variant="outline" 
									size="icon" 
									className="h-8 w-8" 
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
									disabled={page >= totalPages}
								>
									<ChevronRight className="size-4" />
								</Button>
								<Button 
									variant="outline" 
									size="icon" 
									className="h-8 w-8" 
									onClick={() => setPage(totalPages)} 
									disabled={page >= totalPages}
								>
									<ChevronsRight className="size-4" />
								</Button>
							</div>
						</div>
					)}
				</Card>
			</div>

			{/* Coverage Side Drawer */}
			<Sheet open={!!coverageSubject} onOpenChange={(open) => !open && setCoverageSubject(null)}>
				<SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
					<SheetHeader className="pb-6 border-b">
						<SheetTitle className="flex items-center gap-2 text-xl font-bold">
							<Users className="size-5 text-primary" />
							Teacher Coverage
						</SheetTitle>
						<SheetDescription>
							Read-only ownership context for <span className="font-bold text-foreground">{coverageSubject?.name}</span>
						</SheetDescription>
					</SheetHeader>

					<div className="py-6 space-y-8">
						{coverageLoading ? (
							<div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
								<RefreshCw className="size-8 animate-spin opacity-20" />
								<p className="text-sm animate-pulse">Analyzing faculty qualifications...</p>
							</div>
						) : coverageSubject && (
							<>
								<div className="rounded-xl border border-violet-100 bg-violet-50/30 p-4 space-y-2">
									<p className="text-[0.65rem] font-bold uppercase tracking-widest text-violet-700/80">Subject Term Context</p>
									<div className="flex flex-wrap gap-1.5">
										<Badge variant="outline" className="bg-white text-violet-700 border-violet-200 font-bold text-[0.65rem] uppercase">
											{coverageSubject.code}
										</Badge>
										{coverageSubject.rotationFamily && (
											<Badge variant="outline" className="bg-violet-100 text-violet-900 border-violet-300 font-bold text-[0.65rem] uppercase">
												{coverageSubject.rotationFamily}
											</Badge>
										)}
										{resolveSubjectTermLabel(coverageSubject) && (
											<Badge variant="outline" className="bg-violet-100 text-violet-900 border-violet-300 font-bold text-[0.65rem] uppercase">
												{resolveSubjectTermLabel(coverageSubject)}
											</Badge>
										)}
									</div>
									<p className="text-xs text-violet-800/80">
										Coverage and load calculations are scoped by rotation family plus term.
									</p>
								</div>

								{/* Assigned Teachers */}
								<div className="space-y-4">
									<h4 className="text-[0.7rem] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
										<div className="size-1.5 rounded-full bg-emerald-500" />
										Currently Assigned
										<Badge variant="secondary" className="ml-auto bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100 font-bold">
											{(teacherCoverage[coverageSubject.id]?.assigned ?? []).length}
										</Badge>
									</h4>
									
									{(teacherCoverage[coverageSubject.id]?.assigned ?? []).length > 0 ? (
										<div className="space-y-3">
											{teacherCoverage[coverageSubject.id].assigned.map((t) => (
												<div key={t.facultyId} className="group p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-sm space-y-3">
													<div className="flex items-start justify-between gap-4 border-b border-emerald-100/50 pb-2">
														<div className="min-w-0">
															<p className="text-sm font-bold truncate leading-tight">{t.name}</p>
															<div className="flex flex-wrap gap-1 mt-1.5">
																{t.grades.map((g) => (
																	<Badge key={g} variant="outline" className={`text-[0.6rem] px-1.5 py-0 h-4 font-bold border-opacity-40 ${GRADE_COLORS[String(g)] ?? ''}`}>
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
															<p className="text-[0.65rem] font-bold text-emerald-700/70 uppercase tracking-wider">Assigned Sections</p>
															<div className="flex flex-wrap gap-1.5">
																{t.sections.map((section, idx) => (
																	<div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-emerald-100/50 shadow-sm">
																		<span className="text-xs font-semibold text-foreground">{section}</span>
																	</div>
																))}
															</div>
														</div>
													) : (
														<p className="text-[0.65rem] text-muted-foreground italic">No sections explicitly mapped.</p>
													)}
												</div>
											))}
										</div>
									) : (
										<div className="p-10 rounded-xl border border-dashed text-center bg-muted/5">
											<p className="text-sm text-muted-foreground italic">No teachers assigned to this subject yet.</p>
										</div>
									)}
								</div>

								{/* Facilities Requirement */}
								{coverageSubject.preferredRoomType !== 'CLASSROOM' && (
									<div className="p-4 rounded-xl bg-muted/40 border border-muted/50 flex items-start gap-3 shadow-sm">
										<Map className="size-5 text-muted-foreground shrink-0 mt-0.5" />
										<div className="space-y-1">
											<p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Resource Constraint</p>
											<p className="text-sm font-medium">Requires <span className="font-bold text-primary">{ROOM_TYPE_LABELS[coverageSubject.preferredRoomType]}</span> facilities.</p>
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

			{/* Delete Confirmation Modal */}
			<ConfirmationModal
				open={deleteTarget !== null}
				onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
				title={`Delete "${deleteTarget?.name ?? ''}"`}
				description={
					<span>
						Permanently delete this subject? This cannot be undone. Only subjects with no active faculty assignments can be deleted directly.
					</span>
				}
				onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
				confirmText="Delete"
				variant="danger"
			/>

			{/* Delete Blocker Dialog */}
			<Dialog open={deleteBlocker !== null} onOpenChange={(open) => { if (!open) setDeleteBlocker(null); }}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-destructive">
							<Trash2 className="size-5 shrink-0" />
							Cannot Delete - Action Required
						</DialogTitle>
						<DialogDescription asChild>
							<div className="space-y-3 pt-1">
								<p className="text-sm text-foreground">{deleteBlocker?.message}</p>
								{deleteBlocker?.details?.activeAssignmentCount != null && deleteBlocker.details.activeAssignmentCount > 0 && (
									<p className="text-xs text-muted-foreground">
										Active assignments: <span className="font-semibold text-foreground">{deleteBlocker.details.activeAssignmentCount}</span>
									</p>
								)}
								{deleteBlocker?.details?.historicalAssignmentCount != null && deleteBlocker.details.historicalAssignmentCount > 0 && (
									<p className="text-xs text-muted-foreground">
										Historical assignment rows: <span className="font-semibold text-foreground">{deleteBlocker.details.historicalAssignmentCount}</span>
									</p>
								)}
								{deleteBlocker?.details?.recommendedAction && (
									<p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
										Recommended: {deleteBlocker.details.recommendedAction}
									</p>
								)}
							</div>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex flex-wrap gap-2 pt-2">
						{deleteBlocker?.details?.requiresArchiveFirst && (
							<Button
								variant="outline"
								size="sm"
								disabled={deleteActionLoading}
								onClick={() => deleteBlocker && handleArchiveSubject(deleteBlocker.target)}
							>
								Archive First
							</Button>
						)}
						{(deleteBlocker?.details?.canCleanupActive || deleteBlocker?.details?.canCleanupAll) && (
							<Button
								variant="outline"
								size="sm"
								className="border-amber-300 text-amber-700 hover:bg-amber-50"
								disabled={deleteActionLoading}
								onClick={() => deleteBlocker && handleClearActiveAssignments(deleteBlocker.target)}
							>
								Clear Active Assignments
							</Button>
						)}
						{(deleteBlocker?.details?.canCleanupHistorical || deleteBlocker?.details?.canCleanupAll) && (
							<Button
								variant="destructive"
								size="sm"
								disabled={deleteActionLoading}
								onClick={() => deleteBlocker && handleCleanupAndDelete(deleteBlocker.target)}
							>
								Clean Up &amp; Delete
							</Button>
						)}
						<Button variant="ghost" size="sm" onClick={() => setDeleteBlocker(null)}>
							Cancel
						</Button>
						<Link to={deleteBlocker?.details?.teachingLoadPath ?? '/teaching-load'}>
							<Button variant="outline" size="sm">View in Teaching Load</Button>
						</Link>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
