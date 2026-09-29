import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
	BookOpen,
	ChevronsLeft,
	ChevronsRight,
	Plus,
	RefreshCw,
	Info,
} from 'lucide-react';

import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import type { RoomType, Subject, SubjectCoverageSummary, SubjectCoverageRow, TermAuthority } from '@/types';
import { fetchSubjectCoverageSummary } from '@/lib/coverage';
import { SubjectFormModal, type SubjectFormValues, type SubjectSaveOutcome } from '@/components/subjects/SubjectFormModal';
import { SubjectRow } from '@/components/subjects/SubjectRow';
import { SubjectCoverageSheet } from '@/components/subjects/SubjectCoverageSheet';
import { SubjectStatusBanners } from '@/components/subjects/SubjectStatusBanners';
import { SubjectTermAuthorityBanner } from '@/components/subjects/SubjectTermAuthorityBanner';
import { useSubjectStats, useCoverageDetail, isRoomConstrainedSubject } from '@/components/subjects/useSubjectStats';
import { subjectToFormValues } from '@/components/subjects/subject-form-utils';
import { SubjectFilterToolbar, type SubjectStatusFilter } from '@/components/subjects/SubjectFilterToolbar';
import { SubjectCatalogBody } from '@/components/subjects/SubjectCatalogBody';
import {
	TERM_FILTER_ALL,
	buildTermFilterOptions,
	matchesTermFilter,
} from '@/components/subjects/subject-term-filter';
import type { SortField, SortDir } from '@/components/subjects/SortableHeader';
import { resolveSubjectSourceCopy, resolveSubjectMutationErrorCopy } from '@/components/subjects/subject-source-utils';
import {
	readSavedSubjectCatalog,
	savedCatalogReceipt,
	writeSavedSubjectCatalog,
	type SubjectCatalogReceipt,
} from '@/components/subjects/subject-catalog-receipt';
import { SubjectMutationDetailPopover } from '@/components/subjects/SubjectMutationDetailPopover';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { useActorSchoolScope } from '@/lib/actor-scope-session';
import { Button } from '@/ui/button';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { DeleteSubjectDialog } from '@/components/subjects/DeleteSubjectDialog';
import { Skeleton } from '@/ui/skeleton';
import {
	AdminStatePanel,
	AdminTableShell,
	AdminWorkspaceFrame,
	type AdminSourceState,
} from '@/components/admin-workspace/AdminWorkspace';
import { resolveSubjectsReadScope } from '@/lib/subject-school-scope';
import { buildOperatorSubjectCreatePayload } from '@/lib/subject-create-payload';


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

export default function Subjects() {
	const [searchParams] = useSearchParams();
	const retiredRequirementsContext = searchParams.get('context') === 'derived-setup';
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
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [termAuthority, setTermAuthority] = useState<TermAuthority | null>(null);
	// A8-C5 S3 — what was actually served, and when. Read by
	// `resolveSubjectSourceCopy` into the EXISTING source-state Popover, so the
	// receipt is a sentence in the place the operator already looks rather than a
	// second banner nobody reads.
	const [catalogReceipt, setCatalogReceipt] = useState<SubjectCatalogReceipt | null>(null);
	// True while a refresh runs behind an already-painted catalog.
	const [refreshingInBackground, setRefreshingInBackground] = useState(false);

	// Teacher coverage drilldown
	const [coverageSubject, setCoverageSubject] = useState<Subject | null>(null);
	const [teacherCoverage, setTeacherCoverage] = useState<Record<number, {
		// A5 (17.1): structured sections — see `SubjectCoverageDetail`.
		assigned: { facultyId: number; name: string; grades: number[]; load: number; sections: { id: number | null; grade: number | null; name: string }[] }[]
	}>>({});
	const [coverageLoading, setCoverageLoading] = useState(false);
	// Phase 2.3: per-subject coverage fetch error so the drawer can distinguish
	// "no teachers assigned" from "the coverage fetch failed" (audit Sub-5).
	const [coverageError, setCoverageError] = useState<Map<number, string>>(new Map());
	const [subjectCoverageSummary, setSubjectCoverageSummary] = useState<SubjectCoverageSummary | null>(null);

	// A3-C5-4: the most recent mutation failure's RAW server code + sentence, so
	// the diagnostic stays reachable behind a `@/ui` Popover once the toast has
	// faded and the calm copy has replaced the engineer string. Null on success.
	const [mutationDetail, setMutationDetail] = useState<{
		code: string | null;
		rawMessage: string;
		context: string;
	} | null>(null);

	// Sorting
	const [sortField, setSortField] = useState<SortField>('code');
	const [sortDir, setSortDir] = useState<SortDir>('asc');

	// Pagination
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);

	// Filters
	// A5 (operator items 9.1 + 41): ONE status control, replacing the two
	// status-looking dropdowns. The value spans both former axes — subject
	// lifecycle (`active` / `inactive`) and coverage attention
	// (`missing-coverage` / `room-constrained`) — so nothing became
	// unreachable when the duplicate was merged. The two existing predicates
	// below are applied exactly as they were; only the state is one value now.
	const [subjectStatusFilter, setSubjectStatusFilter] = useState<SubjectStatusFilter>('all');
	const [roomTypeFilter, setRoomTypeFilter] = useState<RoomType | 'all'>('all');
	const [gradeLevelFilter, setGradeLevelFilter] = useState<number | 'all'>('all');
	const [programScopeFilter, setProgramScopeFilter] = useState<string>('all');
	// A3-C9: the term filter. Its VALUE is a string because the option list is
	// derived from the data (see `subject-term-filter.ts`), and a hard-coded
	// Term 1/2/3 would contradict a contract that is EnrollPro-owned.
	const [termFilter, setTermFilter] = useState<string>(TERM_FILTER_ALL);

	// SCA-01.1 / ACTOR-SCOPE-C01: actor school scope — resolved from /auth/me and
	// bound to the authenticated token epoch, and the ONLY source of the catalog
	// read scope. There is no school-1 fallback: while the scope is unresolved
	// the page renders a bounded state and issues no catalog request. A session
	// mutation synchronously drops the previous school to null and clears state.
	const { actorSchoolId, resolved: actorScopeResolved, retry: retryActorScope } = useActorSchoolScope();

	useEffect(() => {
		if (actorSchoolId == null) {
			setActiveSchoolYearId(null);
			setSubjects([]);
			setError(null);
			// A8-C5 S3: the receipt and the in-flight flag belong to the school
			// they were read for. A session change to another school must not leave
			// the previous school's count and timestamp on screen.
			setCatalogReceipt(null);
			setRefreshingInBackground(false);
		}
	}, [actorSchoolId]);

	const readScope = resolveSubjectsReadScope(actorSchoolId);

	const fetchSubjects = useCallback(async () => {
		// SCA-01.1: never issue a catalog request without a resolved actor
		// school. The loading skeleton stays up until the scope resolves.
		if (!readScope.ready || readScope.schoolId == null) return;
		const scopedSchoolId = readScope.schoolId;
		// A8-C5 S3 — PAINT THE SAVED CATALOG FIRST, then refresh behind it.
		//
		// The operator: a scheduler waiting 20.5 s for `/subjects` thinks it is
		// broken. The read below is unchanged; what changed is that the browser
		// copy is read SYNCHRONOUSLY, before the request is issued, so the first
		// paint already carries rows and the skeleton only stays up when there is
		// genuinely nothing to show.
		//
		// `pendingPaint` is the honest state in between: a catalog IS on screen and
		// a refresh IS still running, which is not the same as "checking source".
		// Without it the page would claim to be waiting while the operator is
		// already reading rows.
		const saved = readSavedSubjectCatalog(scopedSchoolId);
		if (saved) {
			setSubjects(saved.subjects as Subject[]);
			setCatalogReceipt(savedCatalogReceipt(saved.subjects.length, saved.savedAt, true));
			setLoading(false);
		} else {
			setLoading(true);
		}
		setRefreshingInBackground(saved !== null);
		try {
			const context = await resolveActiveSchoolYearContext({
				schoolId: scopedSchoolId,
				allowStaleOnError: true,
				allowEnrollProFallback: false,
			});
			if (context.activeSchoolYearId) {
				setActiveSchoolYearId(context.activeSchoolYearId);
				const { data } = await atlasApi.get<{ subjects: Subject[]; termAuthority: TermAuthority }>('/subjects/scheduling-authority', {
					params: { schoolYearId: context.activeSchoolYearId },
				});
				setSubjects(data.subjects);
				// The receipt is written from the SAME array that was set above, so
				// the count and the time can never describe a different catalog.
				setCatalogReceipt(writeSavedSubjectCatalog(scopedSchoolId, data.subjects));
				setTermAuthority(data.termAuthority);
			} else {
				const { data } = await atlasApi.get<{ subjects: Subject[] }>('/subjects', {
					params: { schoolId: readScope.schoolId },
				});
				setSubjects(data.subjects);
				setCatalogReceipt(writeSavedSubjectCatalog(scopedSchoolId, data.subjects));
				setTermAuthority({
					state: 'BLOCKED', source: 'none', degraded: false, code: 'ACTIVE_SCHOOL_YEAR_REQUIRED',
					message: 'Term scheduling metadata is blocked until the active school year is resolved.', contract: null,
				});
			}
			setError(null);
		} catch {
			// A8-C5 S3: a failed refresh must NOT clear a painted catalog. The
			// receipt keeps saying "saved copy" and the banner below states the
			// failure, so the operator sees stale data labelled as stale rather
			// than an empty table and a guess.
			setError('Failed to load subjects.');
		} finally {
			setLoading(false);
			setRefreshingInBackground(false);
		}
	}, [readScope.ready, readScope.schoolId]);

	const ensureActiveSchoolYear = useCallback(async () => {
		if (activeSchoolYearId) {
			return activeSchoolYearId;
		}
		if (actorSchoolId == null) {
			throw new Error('An authenticated actor school is required to resolve the active school year.');
		}
		const context = await resolveActiveSchoolYearContext({
			schoolId: actorSchoolId,
			allowStaleOnError: true,
			allowEnrollProFallback: false,
		});
		if (!context.activeSchoolYearId) {
			throw new Error('Active school year is not configured.');
		}
		setActiveSchoolYearId(context.activeSchoolYearId);
		return context.activeSchoolYearId;
	}, [activeSchoolYearId, actorSchoolId]);

	useEffect(() => {
		fetchSubjects();
	}, [fetchSubjects]);

	const fetchTeacherCoverage = useCallback(async (subjectId: number) => {
		const targetSubject = subjects.find(s => s.id === subjectId);
		if (!targetSubject) return;
		// SCA-01.1: coverage reads are actor-scoped like the catalog read.
		if (actorSchoolId == null) return;

		setCoverageLoading(true);
		try {
			const schoolYearId = await ensureActiveSchoolYear();
			const { data } = await atlasApi.get<{ faculty: any[] }>('/faculty-assignments/summary', {
				params: { schoolId: actorSchoolId, schoolYearId },
			});
			
			const assigned: { facultyId: number; name: string; grades: number[]; load: number; sections: { id: number | null; grade: number | null; name: string }[] }[] = [];

			for (const f of data.faculty ?? []) {
				const isAssigned = (f.assignments ?? []).some((a: any) => a.subjectId === subjectId);
				const load = (f as any).loadPercentage ?? 0;
				if (isAssigned) {
					const assignment = f.assignments.find((a: any) => a.subjectId === subjectId);
					/*
					 * A5 (operator item 17.1): a section is passed as DATA.
					 * It used to be minted as a single display string
					 * (`` `${gradeCompact(section.displayOrder)} ${section.name}` ``)
					 * which the dialog then rendered as text, so the grade was
					 * printed inside the chip AND again in the header badge row. The
					 * grade is now a number the dialog turns into a colour pill, the
					 * name is the name, and `null` means "this section carries no
					 * usable grade" — never a guess, and never a string to re-parse.
					 */
					const sections = (assignment?.sections ?? []).map((section: any) => ({
						id: typeof section?.id === 'number' ? section.id : null,
						grade: typeof section?.gradeLevel === 'number'
							? section.gradeLevel
							: (typeof section?.displayOrder === 'number' ? section.displayOrder : null),
						name: typeof section?.name === 'string' ? section.name : '',
					}));
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
			// A3-C5-4: the server authors this sentence for a scheduler, so it is
			// resolved to calm copy and the raw pair is parked for the popover.
			const copy = resolveSubjectMutationErrorCopy(
				err?.response?.data ?? { message: err?.message },
			);
			setCoverageError((prev) => {
				const next = new Map(prev);
				next.set(subjectId, copy.message);
				return next;
			});
			setMutationDetail({
				code: copy.code,
				rawMessage: copy.rawMessage,
				context: 'Load teacher coverage',
			});
			toast.error(copy.message);
		} finally {
			setCoverageLoading(false);
		}
	}, [subjects, ensureActiveSchoolYear, actorSchoolId]);

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

		// Status filter (A5: the lifecycle axis of the one merged control)
		if (subjectStatusFilter === 'active') list = list.filter((s) => s.isActive);
		else if (subjectStatusFilter === 'inactive') list = list.filter((s) => !s.isActive);

		// Room type filter
		if (roomTypeFilter !== 'all') list = list.filter((s) => s.preferredRoomType === roomTypeFilter);

		// Grade level filter
		if (gradeLevelFilter !== 'all') list = list.filter((s) => s.gradeLevels.includes(gradeLevelFilter));

		// Program scope filter
		if (programScopeFilter !== 'all') list = list.filter((s) => (s.programScopes ?? []).includes(programScopeFilter));
		// A3-C9: the term filter uses the SHARED predicate, so the option the
		// toolbar offered and the rows that survive it cannot disagree.
		if (termFilter !== TERM_FILTER_ALL) list = list.filter((s) => matchesTermFilter(s, termFilter));
		if (subjectStatusFilter === 'missing-coverage' && coverageBySubjectId) list = list.filter((s) => s.isActive && (coverageBySubjectId.get(s.id)?.uncoveredSectionCount ?? 0) > 0);
		// A3-C5: this list is the "Room constrained" tile's twin, so it filters
		// with the SAME predicate the tile counts with. It previously carried its
		// own inline copy of the rule, which treated an ownership marker as a
		// room need — so the tile and this list answered different questions on
		// the same screen. The rule now lives in one place; this page stays a
		// delegating surface and does not interpret the mixed feature list.
		if (subjectStatusFilter === 'room-constrained') list = list.filter(isRoomConstrainedSubject);

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
	}, [subjects, searchQuery, subjectStatusFilter, roomTypeFilter, gradeLevelFilter, programScopeFilter, termFilter, coverageBySubjectId, sortField, sortDir, page, pageSize]);

	// Reset page when filters change
	useEffect(() => { setPage(1); }, [searchQuery, subjectStatusFilter, roomTypeFilter, gradeLevelFilter, programScopeFilter, termFilter, pageSize]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		} else {
			setSortField(field);
			setSortDir('asc');
		}
	};

	// A3-20: three DISTINCT outcomes, not one error string. `STALE_WRITE` means
	// nothing was lost but the edit was built on a version that no longer
	// exists, so its correct next action is "reload" — reporting it as a plain
	// failure told the operator their change was gone. The modal keeps open on
	// both non-success outcomes and states them inline.
	const handleModalSave = async (values: SubjectFormValues): Promise<SubjectSaveOutcome> => {
		setSaving(true);
		try {
			if (modalMode === 'edit' && values.id != null) {
				// Prompt 01B-R: send expectedUpdatedAt for atomic version guard
				const currentSubject = subjects.find((s) => s.id === values.id);
				const expectedUpdatedAt = currentSubject?.updatedAt;
				if (!expectedUpdatedAt) {
					const message = 'Cannot determine current version. Refresh and retry.';
					toast.error(message);
					return { status: 'stale', message };
				}
				await atlasApi.patch(`/subjects/${values.id}`, {
					name: values.name,
					outputLabel: values.outputLabel?.trim() ? values.outputLabel.trim() : null,
					ownerDepartment: values.ownerDepartment?.trim() ? values.ownerDepartment.trim() : null,
					allowedOwnerDepartments: values.allowedOwnerDepartments,
					rotationFamily: values.rotationFamily?.trim() ? values.rotationFamily.trim() : null,
					minMinutesPerWeek: values.minMinutesPerWeek,
					preferredRoomType: values.preferredRoomType,
					// SCA-01R3: isSeedable/isSystemManaged are protected
					// bootstrap metadata — edits preserve the stored values
					// by omission (the server rejects either key with 400
					// PROTECTED_FIELD) instead of resending form state.
					gradeLevels: values.gradeLevels,
					// A3-33B: the shared class session is no longer editable in the
					// form, but its persisted value is still what gets sent. The form
					// spreads its initial values untouched, so a subject stored with
					// a shared session round-trips `true` (and its pooled grade
					// levels) unchanged.
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
				// SCA-01R3: the create body is built ONLY by
				// buildOperatorSubjectCreatePayload, which omits the protected
				// isSeedable/isSystemManaged bootstrap flags (the server
				// rejects either key with 400 PROTECTED_FIELD). Never spread
				// raw form values here: form state may still carry a stale
				// flag value.
				await atlasApi.post('/subjects', buildOperatorSubjectCreatePayload(values));
				toast.success('Subject created successfully.');
			}
			setModalMode(null);
			setModalSubject(null);
			setModalSubjectMeta(null);
			setMutationDetail(null);
			await fetchSubjects();
			return { status: 'saved' };
		} catch (err: any) {
			// A3-C5-4: one resolver for every outcome, including the two that
			// already had specific copy. `STALE_WRITE` still returns `stale` (the
			// modal stays open and states it inline) — only the string now comes
			// from the shared table instead of a second inline copy.
			const copy = resolveSubjectMutationErrorCopy(err?.response?.data);
			setMutationDetail({
				code: copy.code,
				rawMessage: copy.rawMessage,
				context: 'Save subject',
			});
			if (copy.code === 'STALE_WRITE') {
				toast.error(copy.message);
				return { status: 'stale', message: copy.message };
			}
			toast.error(copy.message);
			return { status: 'failed', message: copy.message };
		} finally {
			setSaving(false);
		}
	};

	const hasActiveFilters = subjectStatusFilter !== 'all'
		|| roomTypeFilter !== 'all'
		|| gradeLevelFilter !== 'all'
		|| programScopeFilter !== 'all'
		|| termFilter !== TERM_FILTER_ALL
		|| searchQuery.trim() !== '';

	// A3-C9: the term options, derived from the catalog actually on screen, so
	// the list never offers a term no subject carries and never hides one that
	// does.
	const termOptions = useMemo(() => buildTermFilterOptions(subjects), [subjects]);

	// A3-C9: if the data stops offering the selected option (a refetch changed
	// which terms exist), fall back rather than filter to an empty table on a
	// value that is no longer offered.
	useEffect(() => {
		if (termFilter === TERM_FILTER_ALL) return;
		if (!termOptions.some((option) => option.value === termFilter)) setTermFilter(TERM_FILTER_ALL);
	}, [termFilter, termOptions]);

	const handleArchiveSubject = async (target: Subject) => {
		setArchivingLoading(true);
		try {
			// Prompt 01B-R: send expectedUpdatedAt for atomic version guard
			const currentSubject = subjects.find((s) => s.id === target.id);
			const expectedUpdatedAt = currentSubject?.updatedAt ?? target.updatedAt;
			await atlasApi.post(`/subjects/${target.id}/archive`, { expectedUpdatedAt });
			toast.success(`"${target.name}" archived.`);
			setArchiveTarget(null);
			setMutationDetail(null);
			await fetchSubjects();
		} catch (err: any) {
			// A3-C5-4: same resolver as save. The `ALREADY_ARCHIVED` no-op still
			// closes the dialog and refetches, and still uses `toast.info` — only
			// the sentence is now shared rather than duplicated here.
			const copy = resolveSubjectMutationErrorCopy(err?.response?.data);
			setMutationDetail({
				code: copy.code,
				rawMessage: copy.rawMessage,
				context: 'Archive subject',
			});
			if (copy.code === 'ALREADY_ARCHIVED') {
				toast.info(copy.description);
				setArchiveTarget(null);
				await fetchSubjects();
			} else if (copy.code === 'STALE_WRITE') {
				toast.error(copy.message);
			} else {
				toast.error(copy.message);
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
			setMutationDetail(null);
			await fetchSubjects();
		} catch (err: any) {
			// A3-C5-4: same resolver as save/archive.
			const copy = resolveSubjectMutationErrorCopy(err?.response?.data);
			setMutationDetail({
				code: copy.code,
				rawMessage: copy.rawMessage,
				context: 'Reactivate subject',
			});
			if (copy.code === 'ALREADY_ACTIVE') {
				toast.info(copy.description);
				await fetchSubjects();
			} else if (copy.code === 'STALE_WRITE') {
				toast.error(copy.message);
			} else {
				toast.error(copy.message);
			}
		}
	};

	const subjectSourceState = useMemo<AdminSourceState>(() => {
		// SCA-01: provenance truth. A successful catalog load is a read of the
		// persisted ATLAS-owned catalog — it is NOT proof of an upstream
		// verification event. The upstream offering refresh is retired, so the
		// page honestly reports saved catalog data once loaded.
		//
		// A8-C5 S3: a refresh running BEHIND a painted catalog is not "checking
		// source". The operator is already reading rows, and telling them the page
		// is still checking is the "20.5 s and it looks broken" defect in its
		// copy form. The skeleton is reserved for the one honest case — nothing on
		// screen yet.
		if (!actorScopeResolved) return 'checking-source';
		if (error && subjects.length === 0) return 'no-saved-data';
		if (loading && subjects.length === 0) return 'checking-source';
		return 'saved-data';
	}, [actorScopeResolved, error, loading, subjects.length]);

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

		const subjectSourceCopy = useMemo(
		() => resolveSubjectSourceCopy(subjectSourceState, catalogReceipt),
		[catalogReceipt, subjectSourceState],
	);

		return (
			<AdminWorkspaceFrame
			title = "Subjects"
			description="The setup surface for ATLAS-owned subject metadata. Each subject's participation, grade and program scope, weekly minutes, rotation, and room needs feed derived demand for every active section. The active school year and ordered terms are read-only EnrollPro source data."
				sourceState={subjectSourceState}
				sourceCopy={subjectSourceCopy}
stats={subjectStats}
			secondaryActions={null}
		primaryActions={(
			<div className="flex items-center gap-2">
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
					hasActiveFilters={hasActiveFilters}
					subjectStatusFilter={subjectStatusFilter}
					onSubjectStatusFilterChange={setSubjectStatusFilter}
					roomTypeFilter={roomTypeFilter}
					onRoomTypeFilterChange={(v) => setRoomTypeFilter(v as typeof roomTypeFilter)}
					gradeLevelFilter={gradeLevelFilter}
					onGradeLevelFilterChange={setGradeLevelFilter}
					programScopeFilter={programScopeFilter}
					onProgramScopeFilterChange={setProgramScopeFilter}
					termFilter={termFilter}
					onTermFilterChange={setTermFilter}
					termOptions={termOptions}
					onResetFilters={() => {
						setSubjectStatusFilter('all');
						setRoomTypeFilter('all');
						setGradeLevelFilter('all');
						setProgramScopeFilter('all');
						setTermFilter(TERM_FILTER_ALL);
						setSearchQuery('');
					}}
				/>
			)}
		>

		{retiredRequirementsContext ? (
			<div
				role="status"
				data-testid="subjects-derived-setup-context"
				className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
			>
				<Info className="mt-0.5 size-4 shrink-0" />
				<p className="leading-relaxed">
					Annual required-subject setup is no longer entered by hand. ATLAS derives demand from the active EnrollPro year and ordered terms
					plus each subject's participation, scope, minutes, and rotation below.
				</p>
			</div>
		) : null}

		{/* Status Banners */}
		<SubjectStatusBanners
			error={error}
			onRetryLoad={fetchSubjects}
		/>

		{/* A3-09/A3-C9: the term-authority EXCEPTION surface. `VERIFIED_LIVE` now
			renders nothing here (see `SubjectTermAuthorityBanner`); the routine
			year-and-terms contract moved to the table footer's quiet affordance
			below, so it stays reachable without costing the header a row. */}
		<SubjectTermAuthorityBanner termAuthority={termAuthority} />

		{/* A3-C5-4: the last failed subject change. The toast carried the calm
			operator copy; the raw code and the raw server sentence stay reachable
			here in a `@/ui` Popover (AGENTS.md §8 forbids a bare `title=`) so
			nothing is destroyed by the rewrite. */}
		{mutationDetail ? (
			<div className="mx-4 mt-2">
				<SubjectMutationDetailPopover
					code={mutationDetail.code}
					rawMessage={mutationDetail.rawMessage}
					context={mutationDetail.context}
				/>
			</div>
		) : null}

		{/* SCA-01.1: while the actor school scope is unresolved, no catalog
			request has been issued — show a bounded scope state instead of an
			empty table so another school's catalog can never render here. */}
		{actorScopeResolved && actorSchoolId == null ? (
			<AdminTableShell>
				<div className="px-4 py-20">
					<AdminStatePanel
						icon={<BookOpen className="size-8" />}
						title="School scope unavailable."
						description="ATLAS could not determine which school catalog to show. No subjects were loaded."
					/>
					<div className="mt-4 flex justify-center">
						<Button size="sm" variant="outline" onClick={retryActorScope} className="gap-2">
							<RefreshCw className="size-3.5" /> Retry
						</Button>
					</div>
				</div>
			</AdminTableShell>
		) : (
		<SubjectCatalogBody
				loading={loading}
				paged={paged}
				subjects={subjects}
				coverageBySubjectId={coverageBySubjectId}
				termAuthority={termAuthority}
				sortField={sortField}
				sortDir={sortDir}
				onToggleSort={toggleSort}
				page={page}
				pageSize={pageSize}
				totalFiltered={totalFiltered}
				totalPages={totalPages}
				onPageChange={setPage}
				onPageSizeChange={setPageSize}
				onReviewCoverage={openSubjectCoverage}
				onEdit={openSubjectEditor}
				onArchive={(target) => { setArchiveTarget(target); }}
				onDelete={(target) => { setDeleteTarget(target); }}
				onReactivate={handleReactivateSubject}
			/>
		)}

		{/* A3-17: the coverage review surface is the extracted, centered Dialog
			component. It used to be a 234-line inline copy of the Sheet that also
			lived in components/subjects/SubjectCoverageSheet.tsx; both are now one
			component, which is what keeps this page inside its line budget. */}
			<SubjectCoverageSheet
				subject={coverageSubject}
				loading={coverageLoading}
				detail={coverageDetail}
				errorBySubjectId={coverageError}
				onRetry={(subjectId) => { void fetchTeacherCoverage(subjectId); }}
				onClose={() => setCoverageSubject(null)}
			/>

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
