import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';

import { getFacultyComparableLoadHours } from '@/lib/faculty-assignment-helpers';
import type { FacultyAssignmentDraft, FacultySummary } from '@/types';
import type { TeachingLoadRepairQueueItem } from '@/components/faculty-assignments/TeachingLoadRepairQueue';
import { STAFF_WORKLOAD_REVIEW_LABEL } from '@/components/faculty-assignments/teacherReviewEntry';

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
	/**
	 * A6 C2 CORRECTION — REQUIRED, and threaded from the page's own
	 * `data.dataSource` / `data.degradedNotice` / `data.isOnline` through the
	 * shared `isTeachingLoadSourceDegraded` predicate, never sniffed from a
	 * string.
	 *
	 * REQUIRED rather than optional so a new caller cannot inherit the healthy
	 * rendering by omission: a queue that defaults to publishing live figures is
	 * exactly the defect this closes, and a default would reopen it silently.
	 * The queue's component takes NO new prop on purpose — this hook is where the
	 * figures are authored, so withholding them HERE means the component has no
	 * path that can render an unlabelled number, whatever a caller passes it.
	 */
	sourceDegraded: boolean;
	writeBlockedReason: string | null;
	onSelectFaculty: (facultyId: number) => void;
	onSave: () => void;
	onShowSubjectCoverage: () => void;
	onShowTeachersWithoutLoad: () => void;
	onShowOverloaded: () => void;
	onShowPlaceholder: () => void;
	onOpenReview: () => void;
	setAdvancedGridVisible: Dispatch<SetStateAction<boolean>>;
};

function formatTeacherName(member: { firstName: string; lastName: string }) {
	return `${member.lastName}, ${member.firstName}`;
}

/**
 * A6 C2 CORRECTION — what replaces every derived figure while the source is
 * unverified. It NAMES the cause and says the figure is withheld, so no reader
 * is left holding a bare number and no reader is told a false one. The queue's
 * component renders this string as-is beside the one amber line, so the row
 * states its own uncertainty instead of relying on the reader to remember the
 * banner at the far end of it.
 */
const UNVERIFIED_STATUS = 'Unverified — EnrollPro is not reachable, so this figure is withheld.';

/**
 * The `review-ready` item, in the two forms it can honestly take.
 *
 * The defect, as rendered: with the REAL queue in the REAL `CACHED` header,
 * row 2 read `Using the last saved data — EnrollPro not reachableNext
 * stepTeaching Load looks ready23 of 24 classes have a teacher.Review staff
 * workload`. The header had correctly suppressed its OWN `% staffed` and `N
 * classes need a teacher` sentence, but the queue publishes the SAME snapshot's
 * figures beside it — so a scheduler could still conclude staffing was complete
 * from the one line they had been told to trust.
 *
 * Both keep the same `id`, `kind` and `actionLabel`, so routing, the chip tone
 * and the ONE primary action are byte-identical between the two states; only the
 * claims change. The degraded form does not print `23 of 24` labelled either:
 * that number describes the last saved snapshot, and a completeness-shaped
 * figure on the row is the defect even when it is honestly caveated.
 *
 * WHY THIS LIVES IN THE HOOK AND NOT IN THE COMPONENT. The component receives
 * already-authored `title` / `status` / `countLabel` strings. Deciding there
 * which of them are a "completeness claim" would mean matching on their text,
 * which is string sniffing, and it would break the moment a title is reworded.
 * The hook is the authority that WRITES those strings, so it is the only place
 * that can withhold a figure without reading it back.
 */
function buildReviewReadyItem(coverageAssigned: number, coverageTotal: number, sourceDegraded: boolean): TeachingLoadRepairQueueItem {
	if (sourceDegraded) {
		return {
			id: 'review-ready',
			kind: 'review-ready',
			// Not `Teaching Load looks ready`: the title is the strongest claim
			// on the row, and while the source is unreachable the honest claim
			// is that ATLAS cannot tell.
			title: 'Teaching Load not verified',
			description: 'ATLAS cannot reach EnrollPro, so it cannot confirm whether any class, over-cap teacher, or temporary substitute still needs review. Treat the last saved data as unverified until the source is reachable again.',
			status: UNVERIFIED_STATUS,
			actionLabel: STAFF_WORKLOAD_REVIEW_LABEL,
		};
	}
	return {
		id: 'review-ready',
		kind: 'review-ready',
		title: 'Teaching Load looks ready',
		// A6 C2 (Slice 5): the label comes from the ONE opener module, so the
		// queue's roster-level action and the toolbar's per-teacher control
		// cannot drift into two different words. It is `Review staff workload`
		// because that is what the dialog it opens is: a staff-wide census.
		description: 'No open classes, over-cap teachers, or temporary substitutes need review. Review the staff workload once before generating.',
		status: `${coverageAssigned} of ${coverageTotal} classes have a teacher.`,
		actionLabel: STAFF_WORKLOAD_REVIEW_LABEL,
	};
}

/**
 * The ONE item whose figures are not derived from the EnrollPro snapshot: a
 * draft count is the operator's own unsaved work, held in this browser, and is
 * true whether or not the upstream source is reachable. Withholding it would
 * hide something that is known — a second lie, in the opposite direction.
 */
const LOCAL_DRAFT_ITEM_IDS = new Set(['save-draft']);


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
	sourceDegraded,
	writeBlockedReason,
	onSelectFaculty,
	onSave,
	onShowSubjectCoverage,
	onShowTeachersWithoutLoad,
	onShowOverloaded,
	onShowPlaceholder,
	onOpenReview,
	setAdvancedGridVisible,
}: UseTeachingLoadRepairQueueParams) {
	const [activeRepairId, setActiveRepairId] = useState<string | null>(null);
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
			items.push(buildReviewReadyItem(coverageAssigned, coverageTotal, sourceDegraded));
		}
		/*
		 * A6 C2 CORRECTION — withhold every UPSTREAM-derived figure while the
		 * source is unverified. `missing-load` ("2 section-subject pairs need a
		 * teacher"), `over-cap` ("26.0h used / 40h max"), `placeholder` ("3
		 * subject groups assigned") and their `countLabel` badges are all read
		 * off the same snapshot as `23 of 24`, so suppressing the header's
		 * sentence while leaving these on the row would close the finding on one
		 * branch and leave it open on the others. `save-draft` is excluded for
		 * the reason on `LOCAL_DRAFT_ITEM_IDS`.
		 *
		 * The item's TASK, its `actionLabel`, its `id` and its `disabledReason`
		 * are untouched, so the queue still says what to do and the ONE primary
		 * action still works. That is deliberate: a degraded row must not become
		 * a dead row.
		 */
		if (sourceDegraded) {
			for (const item of items) {
				if (LOCAL_DRAFT_ITEM_IDS.has(item.id)) continue;
				item.status = UNVERIFIED_STATUS;
				delete item.countLabel;
			}
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
		sourceDegraded,
		teachersWithoutLoad,
		writeBlockedReason,
	]);

	const routedRepairId = useMemo(() => {
		const viewParam = searchParams.get('view');
		if (viewParam === 'subjects' || viewParam === 'allocation') return 'missing-load';
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

		// Clear all mutually exclusive parameters first
		next.delete('view');
		next.delete('task');
		next.delete('facultyId');
		next.delete('sectionId');
		next.delete('subjectId');

		// Set the parameters appropriate for this repair item
		if (item.facultyId) next.set('facultyId', String(item.facultyId));
		if (item.kind === 'missing-load') {
			next.set('view', 'allocation');
		} else if (item.kind === 'teacher-missing-load') {
			next.set('task', 'missing-load');
		} else if (item.kind === 'over-cap') {
			next.set('task', 'over-cap');
		} else if (item.kind === 'placeholder') {
			next.set('task', 'review-placeholders');
		}
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
		onShowSubjectCoverage,
		setAdvancedGridVisible,
		updateRepairRoute,
	]);

	const handleSelectRepairItem = useCallback((item: TeachingLoadRepairQueueItem) => {
		setActiveRepairId(item.id);
		updateRepairRoute(item);
		if (item.facultyId) onSelectFaculty(item.facultyId);
	}, [onSelectFaculty, updateRepairRoute]);

	return {
		activeRepairId,
		routedRepairId,
		repairQueueItems,
		handleRepairPrimaryAction,
		handleSelectRepairItem,
	};
}
