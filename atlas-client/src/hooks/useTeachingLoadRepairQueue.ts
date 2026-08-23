import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';

import { getFacultyComparableLoadHours } from '@/lib/faculty-assignment-helpers';
import type { FacultyAssignmentDraft, FacultySummary } from '@/types';
import type { TeachingLoadRepairQueueItem } from '@/components/faculty-assignments/TeachingLoadRepairQueue';

type UseTeachingLoadRepairQueueParams = {
	searchParams: URLSearchParams;
	setSearchParams: SetURLSearchParams;
	faculty: FacultySummary[];
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	activeDraftCount: number;
	isReadOnlyMode: boolean;
	selectedId: number | null;
	coverageAssigned: number;
	coverageTotal: number;
	coverageUnassigned: number;
	writeBlockedReason: string | null;
	onSelectFaculty: (facultyId: number) => void;
	onSave: () => void;
	onShowUnassigned: () => void;
	onShowSubjectCoverage: () => void;
	onShowTeachersWithoutLoad: () => void;
	onShowOverloaded: () => void;
	onShowPlaceholder: () => void;
	onOpenReview: () => void;
	setAdvancedGridVisible: Dispatch<SetStateAction<boolean>>;
	setDraftStatusMessage: (message: string) => void;
};

function formatTeacherName(member: { firstName: string; lastName: string }) {
	return `${member.lastName}, ${member.firstName}`;
}

export function useTeachingLoadRepairQueue({
	searchParams,
	setSearchParams,
	faculty,
	effectiveAssignmentsByFaculty,
	activeDraftCount,
	isReadOnlyMode,
	selectedId,
	coverageAssigned,
	coverageTotal,
	coverageUnassigned,
	writeBlockedReason,
	onSelectFaculty,
	onSave,
	onShowUnassigned,
	onShowSubjectCoverage,
	onShowTeachersWithoutLoad,
	onShowOverloaded,
	onShowPlaceholder,
	onOpenReview,
	setAdvancedGridVisible,
	setDraftStatusMessage,
}: UseTeachingLoadRepairQueueParams) {
	const [activeRepairId, setActiveRepairId] = useState<string | null>(null);
	const [skippedRepairIds, setSkippedRepairIds] = useState<Set<string>>(() => new Set());
	const teacherRepairIntent = searchParams.get('task');

	const teachersWithoutLoad = useMemo(
		() => faculty
			.filter((member) => member.isActiveForScheduling && !member.isPlaceholder && (effectiveAssignmentsByFaculty[member.id]?.length ?? 0) === 0)
			.sort((left, right) => formatTeacherName(left).localeCompare(formatTeacherName(right))),
		[effectiveAssignmentsByFaculty, faculty],
	);

	const overCapTeachers = useMemo(
		() => faculty
			.filter((member) => member.isActiveForScheduling && !member.isPlaceholder && getFacultyComparableLoadHours(member) > member.maxHoursPerWeek)
			.sort((left, right) => getFacultyComparableLoadHours(right) - getFacultyComparableLoadHours(left)),
		[faculty],
	);

	const placeholderTeachers = useMemo(
		() => faculty
			.filter((member) => member.isPlaceholder && (effectiveAssignmentsByFaculty[member.id]?.length ?? 0) > 0)
			.sort((left, right) => formatTeacherName(left).localeCompare(formatTeacherName(right))),
		[effectiveAssignmentsByFaculty, faculty],
	);

	const repairQueueItems = useMemo<TeachingLoadRepairQueueItem[]>(() => {
		const items: TeachingLoadRepairQueueItem[] = [];
		if (activeDraftCount > 0) {
			items.push({
				id: 'save-draft',
				kind: 'save-draft',
				title: 'Save draft changes',
				description: 'You have unsaved Teaching Load changes. Save or discard them before moving to generation.',
				status: `${activeDraftCount} draft ${activeDraftCount === 1 ? 'teacher' : 'teachers'} waiting to save.`,
				actionLabel: `Save ${activeDraftCount}`,
				disabledReason: isReadOnlyMode ? writeBlockedReason : null,
				countLabel: `${activeDraftCount} draft`,
			});
		}
		if (coverageUnassigned > 0) {
			items.push({
				id: 'missing-load',
				kind: 'missing-load',
				title: 'Assign teachers to open classes',
				description: 'Some subject-section pairs still need a teacher. Review subject coverage to see exactly which sections are uncovered.',
				status: `${coverageUnassigned} section-subject ${coverageUnassigned === 1 ? 'pair needs' : 'pairs need'} a teacher.`,
				actionLabel: 'Review subject coverage',
				disabledReason: isReadOnlyMode ? writeBlockedReason : null,
				countLabel: `${coverageUnassigned} open`,
			});
		}
		for (const member of teachersWithoutLoad.slice(0, 4)) {
			items.push({
				id: `teacher-missing-${member.id}`,
				kind: 'teacher-missing-load',
				title: `${formatTeacherName(member)} has no load`,
				description: 'This active teacher has no assigned subject or section. Review whether they should receive load or stay excluded.',
				status: member.department ? `${member.department} department` : 'No department listed',
				actionLabel: 'Assign teaching load',
				facultyId: member.id,
				disabledReason: isReadOnlyMode ? writeBlockedReason : null,
			});
		}
		for (const member of overCapTeachers.slice(0, 4)) {
			const loadHours = getFacultyComparableLoadHours(member);
			items.push({
				id: `over-cap-${member.id}`,
				kind: 'over-cap',
				title: `${formatTeacherName(member)} is over the weekly max`,
				description: 'Move one class to another eligible teacher or reduce this teacher’s assigned load before generation.',
				status: `${loadHours.toFixed(1)}h used / ${member.maxHoursPerWeek}h max.`,
				actionLabel: 'Move classes',
				facultyId: member.id,
				disabledReason: isReadOnlyMode ? writeBlockedReason : null,
			});
		}
		for (const member of placeholderTeachers.slice(0, 3)) {
			const subjectGroupCount = effectiveAssignmentsByFaculty[member.id]?.length ?? 0;
			items.push({
				id: `placeholder-${member.id}`,
				kind: 'placeholder',
				title: `${formatTeacherName(member)} is still a temporary substitute`,
				description: 'This temporary record is holding coverage. Replace it with a real eligible teacher when staffing is known.',
				status: `${subjectGroupCount} subject ${subjectGroupCount === 1 ? 'group' : 'groups'} assigned.`,
				actionLabel: 'Review temporary',
				facultyId: member.id,
				disabledReason: isReadOnlyMode ? writeBlockedReason : null,
			});
		}
		if (items.length === 0) {
			items.push({
				id: 'review-ready',
				kind: 'review-ready',
				title: 'Teaching Load looks ready',
				description: 'No open classes, over-cap teachers, or temporary substitutes need review. Review teachers once before generating.',
				status: `${coverageAssigned}/${coverageTotal} pairs staffed.`,
				actionLabel: 'Review teachers',
			});
		}
		return items;
	}, [
		activeDraftCount,
		coverageAssigned,
		coverageTotal,
		coverageUnassigned,
		effectiveAssignmentsByFaculty,
		isReadOnlyMode,
		overCapTeachers,
		placeholderTeachers,
		teachersWithoutLoad,
		writeBlockedReason,
	]);

	const routedRepairId = useMemo(() => {
		const viewParam = searchParams.get('view');
		if (viewParam === 'subjects') return 'missing-load';
		if (!selectedId) {
			if (teacherRepairIntent === 'review-placeholders') return repairQueueItems.find((item) => item.kind === 'placeholder')?.id ?? null;
			return null;
		}
		if (teacherRepairIntent === 'missing-load') return `teacher-missing-${selectedId}`;
		if (teacherRepairIntent === 'over-cap') return `over-cap-${selectedId}`;
		if (teacherRepairIntent === 'review-placeholders') return `placeholder-${selectedId}`;
		return null;
	}, [repairQueueItems, selectedId, teacherRepairIntent, searchParams]);

	const updateRepairRoute = useCallback((item: TeachingLoadRepairQueueItem) => {
		const next = new URLSearchParams(searchParams);
		if (item.facultyId) next.set('facultyId', String(item.facultyId));
		if (item.kind === 'missing-load') {
			next.set('view', 'subjects');
			next.delete('task');
		} else if (item.kind === 'teacher-missing-load') next.set('task', 'missing-load');
		else if (item.kind === 'over-cap') next.set('task', 'over-cap');
		else if (item.kind === 'placeholder') next.set('task', 'review-placeholders');
		else next.delete('task');
		setSearchParams(next, { replace: true });
	}, [searchParams, setSearchParams]);

	const handleRepairPrimaryAction = useCallback((item: TeachingLoadRepairQueueItem) => {
		setActiveRepairId(item.id);
		updateRepairRoute(item);
		if (item.facultyId) onSelectFaculty(item.facultyId);
		if (item.kind === 'save-draft') return onSave();
		if (item.kind === 'missing-load') onShowSubjectCoverage();
		else if (item.kind === 'teacher-missing-load') onShowTeachersWithoutLoad();
		else if (item.kind === 'over-cap') onShowOverloaded();
		else if (item.kind === 'placeholder') onShowPlaceholder();
		else onOpenReview();
		setAdvancedGridVisible(true);
	}, [
		onOpenReview,
		onSave,
		onSelectFaculty,
		onShowOverloaded,
		onShowPlaceholder,
		onShowTeachersWithoutLoad,
		onShowUnassigned,
		onShowSubjectCoverage,
		setAdvancedGridVisible,
		updateRepairRoute,
	]);

	const handleSelectRepairItem = useCallback((item: TeachingLoadRepairQueueItem) => {
		setActiveRepairId(item.id);
		updateRepairRoute(item);
		if (item.facultyId) onSelectFaculty(item.facultyId);
	}, [onSelectFaculty, updateRepairRoute]);

	const handleSkipRepairItem = useCallback((item: TeachingLoadRepairQueueItem) => {
		setSkippedRepairIds((prev) => {
			const next = new Set(prev);
			next.add(item.id);
			return next;
		});
		setDraftStatusMessage(`Skipped "${item.title}" for now. It stays in this local queue.`);
	}, [setDraftStatusMessage]);

	return {
		activeRepairId,
		routedRepairId,
		skippedRepairIds,
		repairQueueItems,
		handleRepairPrimaryAction,
		handleSelectRepairItem,
		handleSkipRepairItem,
	};
}
