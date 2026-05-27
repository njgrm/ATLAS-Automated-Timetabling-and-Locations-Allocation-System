import { useCallback, useMemo, useState } from 'react';
import type { 
	FacultySummary, 
	Subject, 
	ExternalSection, 
	FacultyAssignmentDraft,
	CoverageMode,
	AutoFillSummaryResult,
	TeachingLoadCoverageTotals,
	TeachingLoadIntegrityDiagnostics,
	TeachingLoadSplitBrainReconcileResult,
} from '@/types';
import { 
	getFacultyComparableLoadHours, 
	matchesOwnershipDepartment, 
	getAssignmentOwnershipKey,
	buildTeachingLoadProfile,
	CLASS_ADVISER_EQUIVALENT_HOURS,
} from '@/lib/faculty-assignment-helpers';

type UseTeachingLoadUIParams = {
	faculty: FacultySummary[];
	subjects: Subject[];
	allKnownSections: ExternalSection[];
	selected: FacultySummary | null;
	currentAssignments: FacultyAssignmentDraft[];
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	savedOwnershipMap: Record<string, any>;
	pendingOwnershipMap: Record<string, any>;
	activeFacultyIds: Set<number>;
	sectionMap: Map<number, ExternalSection>;
};

export function useTeachingLoadUI({
	faculty,
	subjects,
	allKnownSections,
	selected,
	currentAssignments,
	effectiveAssignmentsByFaculty,
	savedOwnershipMap,
	pendingOwnershipMap,
	activeFacultyIds,
	sectionMap,
}: UseTeachingLoadUIParams) {
	const [searchQuery, setSearchQuery] = useState('');
	const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'unassigned'>('all');
	const [departmentFilter, setDepartmentFilter] = useState<string>('all');
	const [subjectSearch, setSubjectSearch] = useState('');
	const [sectionFilter, setSectionFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
	const [gradeLevelFilter, setGradeLevelFilter] = useState<string>('all');
	const [sortOrder, setSortOrder] = useState<'load-asc' | 'load-desc'>('load-asc');
	const [loadFilter, setLoadFilter] = useState<'all' | 'overloaded' | 'optimal' | 'underloaded'>('all');
	const [reviewDismissed, setReviewDismissed] = useState(false);
	const [showTemporaryRoles, setShowTemporaryRoles] = useState(false);
	const [showFilters, setShowFilters] = useState(false);
	const [showJumpList, setShowJumpList] = useState(false);
	const [viewMode, setViewMode] = useState<'teacher' | 'allocation'>('teacher');
	const [showOutsideDept, setShowOutsideDept] = useState(false);
	const [sectionModeFilter, setSectionModeFilter] = useState<'all' | 'unassigned' | 'constrained'>('unassigned');
	const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
	const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
	const [inspectorOpen, setInspectorOpen] = useState(false);
	const [staffingAuditOpen, setStaffingAuditOpen] = useState(false);
	const [coverageMode, setCoverageMode] = useState<CoverageMode>('REAL_FACULTY_THEN_TEACHER_X');
	const [rotationSheetOpen, setRotationSheetOpen] = useState(false);
	const [summaryModalOpen, setSummaryModalOpen] = useState(false);
	const [autoFillDialogOpen, setAutoFillDialogOpen] = useState(false);
	const [resetDialogOpen, setResetDialogOpen] = useState(false);
	const [resetConfirmText, setResetConfirmText] = useState('');
	const [hoveredIncomingMinutes, setHoveredIncomingMinutes] = useState(0);
	const [swapCandidate, setSwapCandidate] = useState<{ subjectId: number; sectionId: number; fromFacultyId: number; toFacultyId?: number | null } | null>(null);

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
			const load = getFacultyComparableLoadHours(member);
			if (loadFilter === 'overloaded') return load > 30;
			if (loadFilter === 'optimal') return load >= 25 && load <= 30;
			if (loadFilter === 'underloaded') return load < 25;
			return true;
		});

		nextFaculty = [...nextFaculty].sort((left, right) => {
			const leftLoad = getFacultyComparableLoadHours(left);
			const rightLoad = getFacultyComparableLoadHours(right);
			if (sortOrder === 'load-asc') {
				if (leftLoad !== rightLoad) return leftLoad - rightLoad;
			} else if (leftLoad !== rightLoad) {
				return rightLoad - leftLoad;
			}
			return `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`);
		});

		return nextFaculty;
	}, [faculty, showTemporaryRoles, searchQuery, filterStatus, departmentFilter, effectiveAssignmentsByFaculty, loadFilter, sortOrder]);

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

	const jumpListItems = useMemo(() => {
		const items = [
			...departmentQualifiedSubjects.map(s => ({ id: s.id, code: s.code, type: 'qualified' }))
		];
		if (showOutsideDept) {
			items.push(...outsideDepartmentSubjects.map(s => ({ id: s.id, code: s.code, type: 'outside' })));
		}
		return items;
	}, [departmentQualifiedSubjects, outsideDepartmentSubjects, showOutsideDept]);

	return {
		searchQuery, setSearchQuery,
		filterStatus, setFilterStatus,
		departmentFilter, setDepartmentFilter,
		subjectSearch, setSubjectSearch,
		sectionFilter, setSectionFilter,
		gradeLevelFilter, setGradeLevelFilter,
		sortOrder, setSortOrder,
		loadFilter, setLoadFilter,
		reviewDismissed, setReviewDismissed,
		showTemporaryRoles, setShowTemporaryRoles,
		showFilters, setShowFilters,
		showJumpList, setShowJumpList,
		viewMode, setViewMode,
		showOutsideDept, setShowOutsideDept,
		sectionModeFilter, setSectionModeFilter,
		selectedSectionId, setSelectedSectionId,
		selectedSubjectId, setSelectedSubjectId,
		inspectorOpen, setInspectorOpen,
		staffingAuditOpen, setStaffingAuditOpen,
		rotationSheetOpen, setRotationSheetOpen,
		summaryModalOpen, setSummaryModalOpen,
		autoFillDialogOpen, setAutoFillDialogOpen,
		resetDialogOpen, setResetDialogOpen,
		resetConfirmText, setResetConfirmText,
		hoveredIncomingMinutes, setHoveredIncomingMinutes,
		swapCandidate, setSwapCandidate,
		coverageMode, setCoverageMode,
		filteredFaculty,
		groupedFaculty,
		departmentQualifiedSubjects,
		outsideDepartmentSubjects,
		loadProfile,
		departmentStats,
		jumpListItems,
	};
}
