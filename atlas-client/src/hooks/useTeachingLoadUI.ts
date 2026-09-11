import { useCallback, useEffect, useMemo, useState } from 'react';
import type { 
	FacultySummary, 
	Subject, 
	ExternalSection, 
	FacultyAssignmentDraft,
	CoverageMode,
} from '@/types';
import { 
	matchesOwnershipDepartment, 
	buildTeachingLoadProfile,
	resolveTeachingActualHours,
	resolveAdvisoryCreditHours,
	computeTeachingLoadFacets,
	applyTeachingLoadFilters,
	teachingStandardHoursOf,
	advisoryCreditHoursOf,
	type EffectiveTeachingPolicy,
	type TeachingLoadStatusFilter,
	type TeachingLoadLoadFilter,
} from '@/lib/faculty-assignment-helpers';
import type { WorkloadPolicyReadiness } from '@/lib/faculty-teaching-load-cache';

type UseTeachingLoadUIParams = {
	faculty: FacultySummary[];
	subjects: Subject[];
	selected: FacultySummary | null;
	currentAssignments: FacultyAssignmentDraft[];
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	sectionMap: Map<number, ExternalSection>;
	/** Effective school/year workload policy from the summary contract (null when UNCONFIGURED). */
	workloadPolicy: EffectiveTeachingPolicy | null;
	workloadPolicyStatus: WorkloadPolicyReadiness;
};

export function useTeachingLoadUI({
	faculty,
	subjects,
	selected,
	currentAssignments,
	effectiveAssignmentsByFaculty,
	sectionMap,
	workloadPolicy,
	workloadPolicyStatus,
}: UseTeachingLoadUIParams) {
	const [searchQuery, setSearchQuery] = useState('');
	const [filterStatus, setFilterStatus] = useState<TeachingLoadStatusFilter>('all');
	const [departmentFilter, setDepartmentFilter] = useState<string>('all');
	const [subjectSearch, setSubjectSearch] = useState('');
	const [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
	const [gradeLevelFilter, setGradeLevelFilter] = useState<string>('all');
	const [sortOrder, setSortOrder] = useState<'load-asc' | 'load-desc'>('load-asc');
	const [loadFilter, setLoadFilter] = useState<TeachingLoadLoadFilter>('all');
	const [filterAnnouncement, setFilterAnnouncement] = useState('');
	const [showTemporaryRoles, setShowTemporaryRoles] = useState(false);
	const [showFilters, setShowFilters] = useState(false);
	const [viewMode, setViewMode] = useState<'teacher' | 'allocation'>('teacher');
	const [showOutsideDept, setShowOutsideDept] = useState(false);
	const [showUnmappedSpecialization, setShowUnmappedSpecialization] = useState(false);
	const [sectionModeFilter, setSectionModeFilter] = useState<'all' | 'unassigned' | 'constrained'>('unassigned');
	const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
	const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
	const [coverageMode, setCoverageMode] = useState<CoverageMode>('REAL_FACULTY_THEN_TEACHER_X');
	const [summaryModalOpen, setSummaryModalOpen] = useState(false);
	const [autoFillDialogOpen, setAutoFillDialogOpen] = useState(false);
	const [hoveredIncomingMinutes, setHoveredIncomingMinutes] = useState(0);

	const mappedSpecializations = useMemo(() => {
		const mapped = new Set<string>();
		for (const subject of subjects) {
			mapped.add(subject.code.trim().toLowerCase());
			for (const spec of subject.allowedSpecializations ?? []) {
				mapped.add(spec.trim().toLowerCase());
			}
		}
		return mapped;
	}, [subjects]);

	// Effective school/year workload policy. No client-side defaults: when the
	// backend reports UNCONFIGURED, standard-dependent metrics stay unknown and
	// the UI renders a readiness state instead of inventing 30h/5h.
	const policyReady = workloadPolicyStatus === 'CONFIGURED' && workloadPolicy != null;
	const teachingStandardHours = policyReady && workloadPolicy != null
		? teachingStandardHoursOf(workloadPolicy)
		: null;
	const advisoryCreditHours = policyReady && workloadPolicy != null
		? advisoryCreditHoursOf(workloadPolicy)
		: 0;

	// Draft-aware actual teaching hours per faculty member (rotation-aware, teaching only).
	// Computed with the real effective policy when configured; when UNCONFIGURED
	// the map stays empty and filters fall back to saved row actuals.
	const effectiveActualHours = useMemo(() => {
		const map = new Map<number, number>();
		if (!policyReady || workloadPolicy == null) return map;
		for (const member of faculty) {
			if (member.isPlaceholder) continue;
			const assignments = effectiveAssignmentsByFaculty[member.id] ?? [];
			const profile = buildTeachingLoadProfile(assignments, subjects, sectionMap, 0, workloadPolicy, member.maxHoursPerWeek);
			map.set(member.id, profile.actualTeachingHours);
		}
		return map;
	}, [faculty, effectiveAssignmentsByFaculty, subjects, sectionMap, policyReady, workloadPolicy]);

	const searchBaseFaculty = useMemo(() => {
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
		return nextFaculty;
	}, [faculty, showTemporaryRoles, searchQuery]);

	// Contextual facet counts: status counts respect the department selection,
	// department counts respect the status/load selections.
	const facetCounts = useMemo(() => {
		return computeTeachingLoadFacets(
			searchBaseFaculty,
			{ department: departmentFilter, status: filterStatus, load: loadFilter },
			effectiveActualHours,
			teachingStandardHours,
		);
	}, [searchBaseFaculty, departmentFilter, filterStatus, loadFilter, effectiveActualHours, teachingStandardHours]);

	const departmentFacetOptions = useMemo(() => {
		// Server-supplied canonical labels verbatim: a custom persisted label
		// changes this UI with no client rebuild. Never re-map through the
		// static client glossary here.
		return facetCounts.departmentCounts.map((entry) => ({
			value: entry.value,
			label: entry.label,
			count: entry.count,
		}));
	}, [facetCounts]);

	// If a prior selection becomes impossible after another filter changes,
	// reset it to All with an accessible announcement.
	useEffect(() => {
		if (departmentFilter !== 'all') {
			const option = departmentFacetOptions.find((entry) => entry.value === departmentFilter);
			if (!option || option.count === 0) {
				setDepartmentFilter('all');
				setFilterAnnouncement('Department filter was reset to All departments because the previous selection has no matching teachers.');
			}
		}
	}, [departmentFacetOptions, departmentFilter]);
	useEffect(() => {
		const statusKey = filterStatus === 'teaching-assigned'
			? 'teaching-assigned'
			: filterStatus === 'no-teaching'
				? 'no-teaching'
				: filterStatus === 'adviser-only'
					? 'adviser-only'
					: null;
		if (statusKey && facetCounts.statusCounts[statusKey] === 0) {
			setFilterStatus('all');
			setFilterAnnouncement('Status filter was reset to All because the previous selection has no matching teachers.');
		}
	}, [facetCounts, filterStatus]);
	useEffect(() => {
		if (loadFilter !== 'all' && (teachingStandardHours == null || facetCounts.loadCounts[loadFilter] === 0)) {
			setLoadFilter('all');
			setFilterAnnouncement(
				teachingStandardHours == null
					? 'Load filter was reset to All because the teaching standard is not configured for this school year.'
					: 'Load filter was reset to All because the previous selection has no matching teachers.',
			);
		}
	}, [facetCounts, loadFilter, teachingStandardHours]);

	const clearTeachingLoadFilters = useCallback(() => {
		setSearchQuery('');
		setFilterStatus('all');
		setDepartmentFilter('all');
		setLoadFilter('all');
		setShowUnmappedSpecialization(false);
		setFilterAnnouncement('All Teaching Load filters were cleared.');
	}, []);

	const filteredFaculty = useMemo(() => {
		// Shared pure filter: displayed counts and resulting rows match exactly.
		let nextFaculty = applyTeachingLoadFilters(
			searchBaseFaculty,
			{ department: departmentFilter, status: filterStatus, load: loadFilter },
			effectiveActualHours,
			teachingStandardHours,
		);
		if (loadFilter !== 'all') {
			nextFaculty = nextFaculty.filter((member) => !member.isPlaceholder);
		}
		if (showUnmappedSpecialization) {
			nextFaculty = nextFaculty.filter((member) => {
				if (!member.specialization) return false;
				const spec = member.specialization.trim().toLowerCase();
				return !mappedSpecializations.has(spec);
			});
		}

		nextFaculty = [...nextFaculty].sort((left, right) => {
			const leftLoad = resolveTeachingActualHours(left, effectiveActualHours);
			const rightLoad = resolveTeachingActualHours(right, effectiveActualHours);
			if (sortOrder === 'load-asc') {
				if (leftLoad !== rightLoad) return leftLoad - rightLoad;
			} else if (leftLoad !== rightLoad) {
				return rightLoad - leftLoad;
			}
			return `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`);
		});

		return nextFaculty;
	}, [searchBaseFaculty, filterStatus, departmentFilter, loadFilter, effectiveActualHours, teachingStandardHours, showTemporaryRoles, showUnmappedSpecialization, mappedSpecializations, sortOrder]);

	const groupedFaculty = useMemo(() => {
		const grouped = new Map<string, { label: string; members: FacultySummary[] }>();
		for (const member of filteredFaculty) {
			if (member.isPlaceholder) {
				const bucket = grouped.get('UNSTAFFED TEMPORARY ROLES') ?? { label: 'UNSTAFFED TEMPORARY ROLES', members: [] };
				bucket.members.push(member);
				grouped.set('UNSTAFFED TEMPORARY ROLES', bucket);
				continue;
			}
			// Server-supplied canonical identity groups the grid; unknown maps group under Unmapped.
			const code = member.departmentCode && member.departmentCode.trim() ? member.departmentCode.trim() : 'UNMAPPED';
			const label = code === 'UNMAPPED' ? 'Unmapped' : (member.departmentLabel?.trim() || member.department?.trim() || code);
			const bucket = grouped.get(code) ?? { label, members: [] };
			bucket.members.push(member);
			grouped.set(code, bucket);
		}
		return Array.from(grouped.values())
			.map((entry) => [entry.label, entry.members] as [string, FacultySummary[]])
			.sort(([left], [right]) => left.localeCompare(right));
	}, [filteredFaculty]);

	const { departmentQualifiedSubjects, outsideDepartmentSubjects } = useMemo(() => {
		const qualified: Subject[] = [];
		const outside: Subject[] = [];

		for (const subject of subjects) {
			// Canonical persisted identity only. HG is the exact catalog code; a
			// localized or display name is never authority for exemption.
			const isHgSubject = subject.code === 'HG';
			const departmentQualified = matchesOwnershipDepartment(selected?.department ?? null, subject);
			if ((isHgSubject && selected?.isClassAdviser) || departmentQualified) {
				qualified.push(subject);
			} else {
				outside.push(subject);
			}
		}

		qualified.sort((a, b) => a.name.localeCompare(b.name));
		outside.sort((a, b) => a.name.localeCompare(b.name));

		return {
			departmentQualifiedSubjects: qualified,
			outsideDepartmentSubjects: outside,
		};
	}, [selected, subjects]);

	const loadProfile = useMemo(() => {
		// No effective policy → no invented load profile. The inspector renders
		// the typed readiness state instead.
		if (!policyReady || workloadPolicy == null || selected == null) return null;
		// Advisory authority is the effective policy for valid advisers only.
		const advisoryHours = selected.isClassAdviser ? resolveAdvisoryCreditHours(selected, workloadPolicy) : 0;
		const profile = buildTeachingLoadProfile(
			currentAssignments,
			subjects,
			sectionMap,
			advisoryHours + ((selected.ancillaryMinutesPerWeek || 0) / 60),
			workloadPolicy,
			selected.maxHoursPerWeek,
		);
		return profile;
	}, [currentAssignments, sectionMap, selected, subjects, policyReady, workloadPolicy]);

	// Scope change clears every mutable filter, dialog, selection, and hover so no
	// stale UI state can act on a different school/year.
	const resetForScope = useCallback(() => {
		setSearchQuery('');
		setFilterStatus('all');
		setDepartmentFilter('all');
		setSubjectSearch('');
		setGradeLevelFilter('all');
		setSortOrder('load-asc');
		setLoadFilter('all');
		setFilterAnnouncement('');
		setShowTemporaryRoles(false);
		setShowFilters(false);
		setViewMode('teacher');
		setShowOutsideDept(false);
		setShowUnmappedSpecialization(false);
		setSectionModeFilter('unassigned');
		setSelectedSectionId(null);
		setSelectedSubjectId(null);
		setSummaryModalOpen(false);
		setAutoFillDialogOpen(false);
		setCoverageMode('REAL_FACULTY_THEN_TEACHER_X');
		setHoveredIncomingMinutes(0);
	}, []);

	return {
		searchQuery, setSearchQuery,
		filterStatus, setFilterStatus,
		departmentFilter, setDepartmentFilter,
		subjectSearch, setSubjectSearch,
		gradeLevelFilter, setGradeLevelFilter,
		sortOrder, setSortOrder,
		loadFilter, setLoadFilter,
		showTemporaryRoles, setShowTemporaryRoles,
		showFilters, setShowFilters,
		viewMode, setViewMode,
		showOutsideDept, setShowOutsideDept,
		showUnmappedSpecialization, setShowUnmappedSpecialization,
		sectionModeFilter, setSectionModeFilter,
		selectedSectionId, setSelectedSectionId,
		selectedSubjectId, setSelectedSubjectId,
		summaryModalOpen, setSummaryModalOpen,
		autoFillDialogOpen, setAutoFillDialogOpen,
		hoveredIncomingMinutes, setHoveredIncomingMinutes,
		coverageMode, setCoverageMode,
		filteredFaculty,
		groupedFaculty,
		departmentQualifiedSubjects,
		outsideDepartmentSubjects,
		loadProfile,
		effectiveActualHours,
		departmentFacetOptions,
		statusFacetCounts: facetCounts.statusCounts,
		loadFacetCounts: facetCounts.loadCounts,
		filterAnnouncement,
		clearTeachingLoadFilters,
		resetForScope,
		policyReady,
		teachingStandardHours,
		advisoryCreditHours,
		workloadPolicy,
		workloadPolicyStatus,
	};
}
