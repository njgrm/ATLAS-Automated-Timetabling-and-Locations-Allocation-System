import { useCallback, useMemo, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';

import { getFacultyComparableLoadHours } from '@/lib/faculty-assignment-helpers';
import type { FacultyAssignmentDraft, FacultySummary } from '@/types';
import type { TeachingLoadRepairQueueItem } from '@/components/faculty-assignments/TeachingLoadRepairQueue';
import { STAFF_WORKLOAD_REVIEW_LABEL } from '@/components/faculty-assignments/teacherReviewEntry';
import {
	isTeachingLoadSourceUnverified,
	teachingLoadUnverifiedReason,
	teachingLoadUnverifiedStatus,
} from '@/components/faculty-assignments/WorkspaceToolbar';

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
	/**
	 * A6 C3 (N-1 / N-3) — the SOURCE STATE ITSELF, threaded next to
	 * `sourceDegraded` rather than replacing it.
	 *
	 * `sourceDegraded` answers "is there something wrong worth an amber line?",
	 * which is deliberately `false` while `refreshing`; the queue's question is the
	 * wider "are these figures confirmed?", which is `false` for `refreshing` too.
	 * Both answers are needed and they are not the same answer, so the page hands
	 * over the STATE and this hook derives the second one itself, through the same
	 * shared module the header uses. A page that passed a second boolean would be a
	 * second copy of the rule, which is the defect A6 C2 already had to correct
	 * once.
	 *
	 * REQUIRED for the reason `sourceDegraded` is: an omitted argument must not
	 * make the queue publish snapshot figures as if they were live.
	 */
	sourceState: {
		dataSource: 'live' | 'cached' | 'refreshing' | 'none';
		isOnline: boolean;
	};
	writeBlockedReason: string | null;
	/**
	 * A6 c5 §1 — "is there a real shortage right now?", from the PAGE's own line
	 * model.
	 *
	 * REQUIRED, for the reason `sourceDegraded` is: an omitted argument must not
	 * silently change which items the queue offers. Two things depend on it and
	 * both were defects:
	 *
	 *   1. The `missing-load` item is GONE while a shortage exists. The packet
	 *      says the shortage line *replaces* it, and it did: the line names the
	 *      subject, the queue item asked the scheduler to click through to
	 *      Subject Coverage to find out which subject was short. Keeping both
	 *      would put one fact on row 2 twice, in two vocabularies.
	 *   2. The `review-ready` FALLBACK is suppressed while a shortage exists.
	 *      With the `missing-load` item removed, an outage page would otherwise
	 *      fall through to `Teaching Load looks ready · 23 of 24 classes have a
	 *      teacher.` — the queue contradicting the line sitting directly above
	 *      it. A degraded row must never become a contradiction.
	 *
	 * `null`/absent keeps the pre-A6-c5 behaviour exactly, so every committed
	 * control that calls this hook without the new argument is untouched.
	 */
	hasShortage?: boolean;
	onSelectFaculty: (facultyId: number) => void;
	onSave: () => void;
	onShowSubjectCoverage: () => void;
	onShowTeachersWithoutLoad: () => void;
	onShowOverloaded: () => void;
	onShowPlaceholder: () => void;
	onOpenReview: () => void;
	/**
	 * A6 c4 (G1) — `setAdvancedGridVisible` is GONE from this hook's contract.
	 *
	 * It existed for one reason: `handleRepairPrimaryAction` called
	 * `setAdvancedGridVisible(true)` so that taking a repair action would pull the
	 * advanced grid back up when the Guided placeholder was standing in front of
	 * it. With Guided mode removed the grid is never hidden, so that call was a
	 * no-op that kept a required argument alive in a page which had no state left
	 * to set — a signature that claimed a capability the product no longer has.
	 */
};

function formatTeacherName(member: { firstName: string; lastName: string }) {
	return `${member.lastName}, ${member.firstName}`;
}

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
 * claims change. The unverified form does not print `23 of 24` labelled either:
 * that number describes the last saved snapshot, and a completeness-shaped
 * figure on the row is the defect even when it is honestly caveated.
 *
 * A6 C3 (N-1 / N-3): the gate is now `sourceUnverified`, not `sourceDegraded`, so
 * this item refuses to claim readiness while `refreshing` too. The withheld
 * string and the reason both come from the shared module, which means the
 * description can name the ACTUAL cause instead of always saying "cannot reach
 * EnrollPro" — false when ATLAS itself is offline, and false when there is no
 * source at all.
 *
 * WHY THIS LIVES IN THE HOOK AND NOT IN THE COMPONENT. The component receives
 * already-authored `title` / `status` / `countLabel` strings. Deciding there
 * which of them are a "completeness claim" would mean matching on their text,
 * which is string sniffing, and it would break the moment a title is reworded.
 * The hook is the authority that WRITES those strings, so it is the only place
 * that can withhold a figure without reading it back.
 */
function buildReviewReadyItem(
	coverageAssigned: number,
	coverageTotal: number,
	sourceUnverified: boolean,
	withheldStatus: string,
	unverifiedReason: string,
): TeachingLoadRepairQueueItem {
	if (sourceUnverified) {
		return {
			id: 'review-ready',
			kind: 'review-ready',
			// Not `Teaching Load looks ready`: the title is the strongest claim
			// on the row, and while the figures are unconfirmed the honest claim
			// is that ATLAS cannot tell.
			title: 'Teaching Load not verified',
			description: `ATLAS cannot confirm this because ${unverifiedReason}, so it cannot say whether any class, over-cap teacher, or temporary substitute still needs review. Treat the last saved data as unverified until the source is confirmed again.`,
			status: withheldStatus,
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
	sourceState,
	writeBlockedReason,
	hasShortage = false,
	onSelectFaculty,
	onSave,
	onShowSubjectCoverage,
	onShowTeachersWithoutLoad,
	onShowOverloaded,
	onShowPlaceholder,
	onOpenReview,
}: UseTeachingLoadRepairQueueParams) {
	const [activeRepairId, setActiveRepairId] = useState<string | null>(null);
	const teacherRepairIntent = searchParams.get('task');

	/*
	 * A6 C3 (N-1 / N-3) — the two strings this page's rows print instead of a
	 * figure, and the flag that gates both.
	 *
	 * They are derived HERE, inside the hook, from the state the page threaded —
	 * not from a second boolean the page computed, and not from a module-level
	 * constant as the previous version was. The constant is the defect this
	 * replaces: one fixed sentence claiming one fixed cause, printed in states
	 * where that cause is false. `cached` + online still produces the exact same
	 * string it always did, so the common case is unchanged, while `OFFLINE` and
	 * `NONE` now name what is actually wrong.
	 */
	const sourceUnverified = isTeachingLoadSourceUnverified(sourceState);
	const withheldStatus = teachingLoadUnverifiedStatus(sourceState);
	const unverifiedReason = teachingLoadUnverifiedReason(sourceState);

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
		/*
		 * A6 c5 §1 — THE `missing-load` ITEM IS GONE, and this is the subtraction
		 * the packet names: the shortage line "replaces" it. It asked a scheduler
		 * to read `12 section-subject pairs need a teacher` and then click through
		 * to Subject Coverage to discover WHICH subject was short; the line states
		 * that per subject, in words, with a button that starts fixing it.
		 *
		 * The `kind`, the routing (`view=allocation` → `missing-load`) and
		 * `onShowSubjectCoverage` are all RETAINED, because they are how a deep
		 * link and a saved filter still resolve to the sections view. What is
		 * removed is only the queue ROW, so the same fact cannot appear twice.
		 */
		if (coverageUnassigned > 0 && !hasShortage) {
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
		/*
		 * A6 c5 §1 — the `review-ready` FALLBACK is suppressed while a shortage
		 * exists, and this is the defect it prevents. With the `missing-load` item
		 * removed above, an outage page fell through to `Teaching Load looks
		 * ready · 23 of 24 classes have a teacher.` while the header line directly
		 * above it read `MAPEH: 9 classes need a teacher`. The queue did not
		 * merely duplicate the line; it CONTRADICTED it, and a queue that claims
		 * readiness on a page with an outage is worse than no queue at all.
		 *
		 * Suppressed, not reworded: "wording" would still be a second claim, and
		 * the shortage line is already the one statement of the fact.
		 */
		if (items.length === 0 && !hasShortage) {
			items.push(buildReviewReadyItem(coverageAssigned, coverageTotal, sourceUnverified, withheldStatus, unverifiedReason));
		}
		/*
		 * A6 C3 (N-2) — WITHHOLD EVERY SNAPSHOT-DERIVED FIGURE, EXPLICITLY.
		 *
		 * A6 C2 did this with one blanket loop keyed on `sourceDegraded`, which
		 * had two defects this replaces rather than edits.
		 *
		 * FIRST, it was too NARROW in one state. `sourceDegraded` is `false` while
		 * `refreshing`, so mid-check the queue printed `Teaching Load looks ready`
		 * and `23 of 24 classes have a teacher` beside the header's own
		 * `Checking EnrollPro for the latest roster…`. Both numbers describe the
		 * last saved snapshot; the wider `sourceUnverified` gate covers this.
		 *
		 * SECOND, it was too WIDE in one item. The blanket loop withheld
		 * EVERYTHING that was not a local draft, including
		 * `${department} department` — a label on a record already on screen
		 * above, not a figure derived from the snapshot. Replacing a known
		 * department with "Unverified" tells the scheduler less, and withholds
		 * nothing they could not already read. Over-reach is its own kind of lie.
		 *
		 * SO THE POLICY IS PER ITEM, AND EXPLICIT:
		 *   1. `save-draft` is untouched — see `LOCAL_DRAFT_ITEM_IDS`.
		 *   2. `teacher-missing-load` keeps its department status, for the reason
		 *      above.
		 *   3. Every other kind (`missing-load`, `over-cap`, `placeholder`) has its
		 *      snapshot-derived status REPLACED and its `countLabel` deleted, since
		 *      both are read off the same snapshot as the withheld header figures.
		 *   4. And their TITLES are NOT prefixed. A6 c7 §1.4 deleted the
		 *      `Last saved data — ` prefix (the code is quoted verbatim at its
		 *      old site): the saved-roster fact already has a home — the header's
		 *      degraded pill and the plain status sentence in (3) — and a prefix
		 *      restated it in a second vocabulary inside every item.
		 *   5. `id`, `kind`, `actionLabel`, `facultyId`, `disabledReason` and every
		 *      `description` are untouched, so a withheld row is still a row that
		 *      says what to do. A degraded row must never become a dead row.
		 */
		if (sourceUnverified) {
			for (const item of items) {
				if (LOCAL_DRAFT_ITEM_IDS.has(item.id)) continue;
				// 2. `teacher-missing-load` is the ONE exception, and it is an
				// exception to the STATUS only. Its department is a label on a
				// record already on screen, not a figure derived from the
				// snapshot, so replacing it with `Unverified` told the scheduler
				// less and withheld nothing they could not already read. Its
				// TITLE still asserts a snapshot-derived state (`… has no
				// load`), so it is qualified below like every other.
				if (item.kind !== 'teacher-missing-load') {
					item.status = withheldStatus;
					delete item.countLabel;
				}
				// 4. A6 c7 §1.4 — THE `Last saved data — ` TITLE PREFIX IS GONE.
				// SUPERSEDED 2026-09-29; the removed code was:
				//
				//   if (item.kind !== 'review-ready') {
				//     item.title = `Last saved data — ${item.title}`;
				//   }
				//
				// It is deleted, not weakened: the chip now reads
				// `Next step · <count> · <task> · <c6's plain status>`, one line, and
				// Lane C read the stacked form as status jargon
				// (`Next step Last saved data - Assign teachers to open classes
				// Unverified`, report.md older-user line 31). The saved-roster FACT is
				// not lost — it is now stated ONCE, by c6's plain status clause and by
				// the degraded pill, which is the single place on the header that
				// says the roster is the last saved one. Prefixing every title
				// restated that fact in a second vocabulary inside every item.
				//
				// The `id`, `kind`, `actionLabel`, `facultyId`, `description` and the
				// withheld `status` above are all unchanged: a qualified row is
				// replaced by a SENTENCE that says why, and it must never become a
				// dead row. `a6-teaching-load-surface` `A6-C3-3-N2` keeps the
				// superseded assertions in place and asserts the unprefixed titles
				// beside them; `a6-c7-shortage-owner-undo` `A6C7-7` is the row that
				// forbids the prefix in every source state.
			}
		}
		return items;
	}, [
		activeDraftCount,
		coverageAssigned,
		coverageTotal,
		coverageUnassigned,
		effectiveAssignmentsByFaculty,
		hasShortage,
		isReadOnlyMode,
		overCapTeachers,
		placeholderTeachers,
		sourceDegraded,
		sourceState,
		sourceUnverified,
		withheldStatus,
		unverifiedReason,
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
		// A6 c4 (G1): the `setAdvancedGridVisible(true)` that used to close this
		// function existed only to pull the grid back from the Guided placeholder.
		// The grid is unconditional now, so the call is deleted rather than made
		// conditional — there is no longer a state it could be guarding.
	}, [
		onOpenReview,
		onSave,
		onSelectFaculty,
		onShowOverloaded,
		onShowPlaceholder,
		onShowTeachersWithoutLoad,
		onShowSubjectCoverage,
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
