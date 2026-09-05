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
	MoreVertical,
	Pencil,
	Trash2,
	Archive,
	RotateCcw,
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
import type { RoomType, Subject, SubjectCoverageSummary, SubjectCoverageRow } from '@/types';
import { fetchSubjectCoverageSummary } from '@/lib/coverage';
import { SubjectFormModal, type SubjectFormValues } from '@/components/subjects/SubjectFormModal';
import { SubjectRow } from '@/components/subjects/SubjectRow';
import { SubjectMobileCard } from '@/components/subjects/SubjectMobileCard';
import { SubjectCoverageSheet } from '@/components/subjects/SubjectCoverageSheet';
import { SyncPreviewSheet, type SyncPreviewData } from '@/components/subjects/SyncPreviewSheet';
import { SubjectStatusBanners } from '@/components/subjects/SubjectStatusBanners';
import { useSubjectStats, useCoverageDetail } from '@/components/subjects/useSubjectStats';
import { subjectToFormValues } from '@/components/subjects/subject-form-utils';
import { SubjectFilterToolbar } from '@/components/subjects/SubjectFilterToolbar';
import { SubjectTablePagination } from '@/components/subjects/SubjectTablePagination';
import { SortableHeader } from '@/components/subjects/SortableHeader';
import type { SortField, SortDir } from '@/components/subjects/SortableHeader';
import { resolveSubjectSourceCopy } from '@/components/subjects/subject-source-utils';
import { SubjectMobileList } from '@/components/subjects/SubjectMobileList';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/dropdown-menu';
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
import { resolveActorSchoolId } from '@/lib/settings';


// Prompt 01A: school scope comes from the authenticated actor (server-enforced
// on mutations). This constant is a display-only fallback for public catalog
// reads before the actor scope resolves; it never owns a mutation.
const FALLBACK_READ_SCHOOL_ID = 1;
const PAGE_SIZES = [10, 25, 50, 100];

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
	const [syncPreview, setSyncPreview] = useState<SyncPreviewData | null>(null);
	const [syncPreviewLoading, setSyncPreviewLoading] = useState(false);
	const [syncApplyLoading, setSyncApplyLoading] = useState(false);
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
	const [subjectCoverageSummary, setSubjectCoverageSummary] = useState<SubjectCoverageSummary | null>(null);

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

	// Prompt 01A: actor school scope — resolved from /auth/me once, used for all
	// reads and mutations; falls back only for public reads before resolution.
	const [actorSchoolId, setActorSchoolId] = useState<number | null>(null);

	useEffect(() => {
		resolveActorSchoolId().then((id) => {
			if (id != null) setActorSchoolId(id);
		});
	}, []);

	const schoolScope = actorSchoolId ?? FALLBACK_READ_SCHOOL_ID;

	const fetchSubjects = useCallback(async () => {
		setLoading(true);
		try {
			const { data } = await atlasApi.get<{ subjects: Subject[] }>('/subjects', {
				params: { schoolId: schoolScope },
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
				params: { schoolId: schoolScope, schoolYearId },
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
			const summary = await fetchSubjectCoverageSummary(schoolYearId);
			setSubjectCoverageSummary(summary);
		} catch {
			setSubjectCoverageSummary(null);
		}
	}, [ensureActiveSchoolYear]);

	useEffect(() => {
		if (subjects.length > 0) {
			void fetchCoverageSummary();
		}
	}, [fetchCoverageSummary, subjects.length]);

	// Filtered, sorted, paginated
	const coverageBySubjectId = useMemo(() => {
		if (!subjectCoverageSummary) return null;
		const map = new Map<number, SubjectCoverageRow>();
		for (const row of subjectCoverageSummary.rows) {
			map.set(row.subjectId, row);
		}
		return map;
	}, [subjectCoverageSummary]);

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
		if (attentionFilter === 'missing-coverage' && coverageBySubjectId) list = list.filter((s) => s.isActive && (coverageBySubjectId.get(s.id)?.uncoveredSectionCount ?? 0) > 0);
		if (attentionFilter === 'room-constrained') list = list.filter((s) => s.isActive && (s.preferredRoomType !== 'CLASSROOM' || s.requiredFeatures.length > 0));

		// Sort
		const sorted = [...list].sort((a, b) => {
			let cmp = 0;
			switch (sortField) {
				case 'code': cmp = a.code.localeCompare(b.code); break;
				case 'name': cmp = a.name.localeCompare(b.name); break;
				case 'minMinutesPerWeek': cmp = a.minMinutesPerWeek - b.minMinutesPerWeek; break;
				case 'preferredRoomType': cmp = a.preferredRoomType.localeCompare(b.preferredRoomType); break;
				case 'gradeLevels': cmp = a.gradeLevels.length - b.gradeLevels.length; break;
				case 'isSeedable': cmp = Number(b.isSeedable) - Number(a.isSeedable); break;
			}
			return sortDir === 'desc' ? -cmp : cmp;
		});

		const tf = sorted.length;
		const tp = Math.max(1, Math.ceil(tf / pageSize));
		const start = (page - 1) * pageSize;
		return { paged: sorted.slice(start, start + pageSize), totalFiltered: tf, totalPages: tp };
	}, [subjects, searchQuery, statusFilter, roomTypeFilter, gradeLevelFilter, programScopeFilter, attentionFilter, coverageBySubjectId, sortField, sortDir, page, pageSize]);

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

	const handleModalSave = async (values: SubjectFormValues) => {
		setSaving(true);
		try {
			if (modalMode === 'edit' && values.id != null) {
				// Prompt 01B-R: send expectedUpdatedAt for atomic version guard
				const currentSubject = subjects.find((s) => s.id === values.id);
				const expectedUpdatedAt = currentSubject?.updatedAt;
				if (!expectedUpdatedAt) {
					toast.error('Cannot determine current version. Refresh and retry.');
					return;
				}
				await atlasApi.patch(`/subjects/${values.id}`, {
					name: values.name,
					outputLabel: values.outputLabel?.trim() ? values.outputLabel.trim() : null,
					ownerDepartment: values.ownerDepartment?.trim() ? values.ownerDepartment.trim() : null,
					allowedOwnerDepartments: values.allowedOwnerDepartments,
					rotationFamily: values.rotationFamily?.trim() ? values.rotationFamily.trim() : null,
					minMinutesPerWeek: values.minMinutesPerWeek,
					preferredRoomType: values.preferredRoomType,
					isSeedable: values.isSeedable,
					isSystemManaged: values.isSystemManaged,
					gradeLevels: values.gradeLevels,
					interSectionEnabled: values.interSectionEnabled,
					interSectionGradeLevels: values.interSectionGradeLevels,
					modularGroupId: values.modularGroupId?.trim() ? values.modularGroupId.trim() : null,
					modularOrder: values.modularGroupId?.trim() ? values.modularOrder : null,
					programScopes: values.programScopes,
					requiredFeatures: values.requiredFeatures,
					expectedUpdatedAt,
				});
				toast.success('Subject updated successfully.');
			} else {
				// Prompt 01A: server derives school ownership from the authenticated
				// actor — no client-supplied schoolId on create.
				await atlasApi.post('/subjects', {
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
			const code = err?.response?.data?.code;
			const msg = err?.response?.data?.message ?? 'Failed to save subject.';
			if (code === 'STALE_WRITE') {
				toast.error('This subject was modified by another user. Refresh and retry.');
			} else if (code === 'PROTECTED_FIELD' || code === 'UNKNOWN_FIELD') {
				toast.error(msg);
			} else {
				toast.error(msg);
			}
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

	const handleSyncPreview = async () => {
		setSyncPreviewLoading(true);
		setSyncError(false);
		try {
			const schoolYearId = await ensureActiveSchoolYear();
			const previewRes = await atlasApi.post('/subjects/sync-offerings/preview', {
				schoolId: schoolScope,
				schoolYearId,
			});
			const preview = previewRes.data?.preview;
			if (!preview) {
				toast.error('Failed to generate sync preview.');
				return;
			}
			if (preview.summary.totalChanges === 0) {
				toast.info('No subject offering changes detected.');
				setSyncPreview(null);
				return;
			}
			setSyncPreview(preview);
		} catch (err: any) {
			setSyncError(true);
			toast.error(err?.response?.data?.message ?? 'Failed to preview subject offerings.');
		} finally {
			setSyncPreviewLoading(false);
		}
	};

	const handleSyncApply = async () => {
		if (!syncPreview) return;
		setSyncApplyLoading(true);
		setSyncError(false);
		try {
			const schoolYearId = await ensureActiveSchoolYear();
			await atlasApi.post('/subjects/sync-offerings/apply', {
				schoolId: schoolScope,
				schoolYearId,
				fingerprint: syncPreview.fingerprint,
			});
			setSyncPreview(null);
			await fetchSubjects();
			await fetchCoverageSummary();
			toast.success(`Subject offerings refreshed. ${syncPreview.summary.totalChanges} change(s) applied.`);
		} catch (err: any) {
			setSyncError(true);
			const code = err?.response?.data?.code;
			const msg = err?.response?.data?.message ?? 'Failed to apply subject offerings.';
			if (code === 'SYNC_DRIFT') {
				toast.error('Upstream data changed since preview. Re-running preview...');
				setSyncPreview(null);
				await handleSyncPreview();
			} else {
				toast.error(msg);
			}
		} finally {
			setSyncApplyLoading(false);
		}
	};

	const handleSyncCancel = () => {
		setSyncPreview(null);
	};



	const handleArchiveSubject = async (target: Subject) => {
		setArchivingLoading(true);
		try {
			// Prompt 01B-R: send expectedUpdatedAt for atomic version guard
			const currentSubject = subjects.find((s) => s.id === target.id);
			const expectedUpdatedAt = currentSubject?.updatedAt ?? target.updatedAt;
			await atlasApi.post(`/subjects/${target.id}/archive`, { expectedUpdatedAt });
			toast.success(`"${target.name}" archived.`);
			setArchiveTarget(null);
			await fetchSubjects();
		} catch (err: any) {
			const code = err?.response?.data?.code;
			const msg = err?.response?.data?.message ?? 'Failed to archive subject.';
			if (code === 'ALREADY_ARCHIVED') {
				toast.info('Subject is already archived.');
				setArchiveTarget(null);
				await fetchSubjects();
			} else if (code === 'STALE_WRITE') {
				toast.error('This subject was modified by another user. Refresh and retry.');
			} else {
				toast.error(msg);
			}
		} finally {
			setArchivingLoading(false);
		}
	};



	const handleReactivateSubject = async (target: Subject) => {
		try {
			// Prompt 01B-R: send expectedUpdatedAt for atomic version guard
			const currentSubject = subjects.find((s) => s.id === target.id);
			const expectedUpdatedAt = currentSubject?.updatedAt ?? target.updatedAt;
			await atlasApi.post(`/subjects/${target.id}/reactivate`, { expectedUpdatedAt });
			toast.success(`${target.name} reactivated.`);
			await fetchSubjects();
		} catch (err: any) {
			const code = err?.response?.data?.code;
			const msg = err?.response?.data?.message ?? 'Failed to reactivate subject.';
			if (code === 'ALREADY_ACTIVE') {
				toast.info('Subject is already active.');
				await fetchSubjects();
			} else if (code === 'STALE_WRITE') {
				toast.error('This subject was modified by another user. Refresh and retry.');
			} else {
				toast.error(msg);
			}
		}
	};

	const subjectSourceState = useMemo<AdminSourceState>(() => {
		// Prompt 01A: provenance truth. A successful catalog load is a read of
		// persisted ATLAS data — it is NOT proof of an upstream verification
		// event. Only an explicit, successful sync-offerings refresh (or a live
		// EnrollPro-backed sync with captured evidence) may display the live
		// state; everything else is honestly "saved data".
		if (loading || syncPreviewLoading || syncApplyLoading) return 'checking-source';
		if (error && subjects.length === 0) return 'no-saved-data';
		return 'saved-data';
	}, [error, loading, subjects.length, syncPreviewLoading, syncApplyLoading]);

	const subjectStats = useSubjectStats({ subjects, coverageBySubjectId });
	const coverageDetail = useCoverageDetail({ coverageSubject, teacherCoverage });
	const openSubjectEditor = useCallback((subject: Subject) => {
		setModalSubject(subjectToFormValues(subject));
		setModalSubjectMeta(subject);
		setModalMode('edit');
	}, []);
	const openSubjectCoverage = useCallback((subject: Subject) => {
		setCoverageSubject(subject);
		fetchTeacherCoverage(subject.id);
	}, [fetchTeacherCoverage]);

		const subjectSourceCopy = resolveSubjectSourceCopy(subjectSourceState);

		return (
			<AdminWorkspaceFrame
				title = "Subjects"
				description="Review the curriculum subjects that can be scheduled for this school year. Start with missing teacher coverage and room-constrained subjects before generation."
				sourceState={subjectSourceState}
				sourceCopy={subjectSourceCopy}
stats={subjectStats}
			secondaryActions={null}
			primaryActions={(
				<div className="flex items-center gap-2">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" onClick={handleSyncPreview} size="sm" className="gap-2" disabled={syncPreviewLoading}>
									<RefreshCw className={`size-4 ${syncPreviewLoading ? 'animate-spin' : ''}`} />
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
				<SubjectFilterToolbar
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					showFilters={showFilters}
					onToggleFilters={() => setShowFilters(!showFilters)}
					hasActiveFilters={hasActiveFilters}
					statusFilter={statusFilter}
					onStatusFilterChange={(v) => setStatusFilter(v as typeof statusFilter)}
					attentionFilter={attentionFilter}
					onAttentionFilterChange={(v) => setAttentionFilter(v as typeof attentionFilter)}
					roomTypeFilter={roomTypeFilter}
					onRoomTypeFilterChange={(v) => setRoomTypeFilter(v as typeof roomTypeFilter)}
					gradeLevelFilter={gradeLevelFilter}
					onGradeLevelFilterChange={setGradeLevelFilter}
					programScopeFilter={programScopeFilter}
					onProgramScopeFilterChange={setProgramScopeFilter}
					onResetFilters={() => {
						setStatusFilter('all');
						setRoomTypeFilter('all');
						setGradeLevelFilter('all');
						setProgramScopeFilter('all');
						setAttentionFilter('all');
						setSearchQuery('');
					}}
				/>
			)}
		>

			{/* Status Banners */}
			<SubjectStatusBanners
				syncError={syncError}
				error={error}
				syncPreviewLoading={syncPreviewLoading}
				onRetrySync={handleSyncPreview}
				onRetryLoad={fetchSubjects}
			/>

			{/* Sync Preview Confirmation Sheet */}
			<SyncPreviewSheet
				preview={syncPreview}
				applyLoading={syncApplyLoading}
				onApply={handleSyncApply}
				onCancel={handleSyncCancel}
			/>

			<AdminTableShell
				footer={!loading && subjects.length > 0 ? (
					<SubjectTablePagination
						page={page}
						pageSize={pageSize}
						totalFiltered={totalFiltered}
						totalPages={totalPages}
						onPageChange={setPage}
						onPageSizeChange={setPageSize}
					/>
				) : undefined}
			>
						<SubjectMobileList
							loading={loading}
							paged={paged}
							subjects={subjects}
							coverageBySubjectId={coverageBySubjectId}
							onReviewCoverage={(s) => { setCoverageSubject(s); }}
							onEdit={openSubjectEditor}
							onArchive={(s) => { setArchiveTarget(s); }}
							onReactivate={handleReactivateSubject}
							onDelete={(s) => { setDeleteTarget(s); }}
						/>
					<table className="hidden w-full text-sm md:table">
							<thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
								<tr className="border-b">
									{/* Phase 2.4: SortableHeader helper mirrors Phase 1.5. aria-sort
										exposes the sort state, the button carries an accessible
										name + visible Tooltip. The helper closes over the
										component's sortField/sortDir/toggleSort. */}
									<SortableHeader field="name" label="Subject" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} align="left" />
									<SortableHeader field="gradeLevels" label="Grades / program" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} align="left" />
									<SortableHeader field="minMinutesPerWeek" label="Weekly need" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} align="left" />
									<SortableHeader field="preferredRoomType" label="Room need" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} align="left" />
									<SortableHeader field="isSeedable" label="Teacher coverage" sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} align="left" />
									<th className="px-4 py-3 text-right font-semibold text-muted-foreground uppercase tracking-wider text-xs">Action</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/40">
								{loading ? (
									Array.from({ length: 8 }).map((_, i) => (
										<tr key={i}>
											<td className="px-4 py-4"><Skeleton className="h-5 w-48" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-24" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-16" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-24" /></td>
											<td className="px-4 py-4"><Skeleton className="h-5 w-20" /></td>
											<td className="px-4 py-4"><Skeleton className="h-8 w-28 ml-auto" /></td>
										</tr>
									))
								) : paged.length === 0 ? (
									<tr>
										<td colSpan={6} className="px-4 py-20 text-center">
											<AdminStatePanel icon={<BookOpen className="size-8" />} title = {subjects.length === 0 ? 'No subjects found.' : 'No matches found.'} description={subjects.length === 0 ? 'Refresh offerings to load curriculum subjects for this school year.' : 'Clear a filter or search another subject name or code.'} />
										</td>
									</tr>
								) : (
									paged.map((s) => (
<SubjectRow
											key={s.id}
											subject={s}
											timeMode="hours"
											coverageRow={coverageBySubjectId?.get(s.id) ?? undefined}
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
											<Link to={`/teaching-load?view=subjects&subjectId=${coverageSubject.id}&filter=missing-coverage`} className="mt-3 inline-flex">
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
										Section coverage
									</h4>
									<div className={(coverageDetail?.uncoveredGrades.length ?? 0) > 0 ? 'rounded-xl border border-amber-200 bg-amber-50 p-4' : 'rounded-xl border border-emerald-200 bg-emerald-50 p-4'}>
										{(coverageDetail?.uncoveredGrades.length ?? 0) > 0 ? (
											<div className="space-y-3">
												<p className="text-sm font-bold text-amber-900">Some required sections still need a teacher for this subject.</p>
												<div className="flex flex-wrap gap-1.5">
													{coverageDetail?.uncoveredGrades.map((grade) => (
														<Badge key={grade} variant="outline" className={`font-bold ${GRADE_COLORS[String(grade)] ?? ''}`}>{gradeLabel(grade)}</Badge>
													))}
												</div>
												<Link to={`/teaching-load?view=subjects&subjectId=${coverageSubject.id}&filter=missing-coverage`} className="inline-flex">
													<Button size="sm" variant="outline" className="gap-2 border-amber-300 text-amber-900 hover:bg-amber-100">
														Fix coverage in Teaching Load
														<ChevronRight className="size-3.5" />
													</Button>
												</Link>
											</div>
										) : (coverageDetail?.programScopes.length ?? 0) > 0 ? (
											<div className="flex items-start gap-3 text-amber-900">
												<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
												<div>
													<p className="text-sm font-bold">All required sections have assigned teachers.</p>
													<p className="text-xs font-medium text-amber-800">This subject is scoped to specific programs. Review section coverage in Teaching Load before generation.</p>
												</div>
											</div>
										) : (
											<div className="flex items-start gap-3 text-emerald-900">
												<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
												<div>
													<p className="text-sm font-bold">All required sections have assigned teachers.</p>
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
									<Link to={`/teaching-load?view=subjects&subjectId=${coverageSubject.id}&filter=missing-coverage`} className="inline-flex">
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
