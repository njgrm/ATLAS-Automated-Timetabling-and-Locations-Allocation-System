import { useCallback, useEffect, useRef, useState } from 'react';

import {
	parseRouteIntent,
	type TeachingLoadViewMode,
} from '@/hooks/useTeachingLoadRouteIntent';
import type {
	TeachingLoadStatusFilter,
	TeachingLoadLoadFilter,
} from '@/lib/faculty-assignment-helpers';

/**
 * A6-TL-DEEPLINK — the ONE landing mechanism for every entry that names a
 * target in Teaching Load, whether the names arrive in the URL (deep links) or
 * from an in-page control (the repair queue / next-teacher step).
 *
 * THE DEFECT IT REPLACES. `useTeachingLoadRouteIntent` applied the URL intent
 * ONCE ON MOUNT, at which instant the faculty list is empty, so
 * `useTeachingLoadData` nulled the selection and fell back to `faculty[0]`;
 * `TeachingLoad`'s `resetForScope()` then cleared the section/subject selection
 * when the year resolved. The intent was never re-applied, so the named target
 * was lost. Worse, its `intentAppliedRef` reset on every `locationKey` change,
 * so a later URL rewrite re-applied the entry target over whatever the operator
 * had since selected — the "I edited another teacher and it did not save"
 * symptom. The intent was never CONSUMED.
 *
 * THE CONTRACT (packet §2), applied against the LOADED lists:
 *   R-a select the named teacher / section / subject;
 *   R-b scroll the target row into view;
 *   R-c focus the target row;
 *   R-d open the assign editor for an Assign entry;
 *   R-e CONSUME — the entry target can never re-apply on a later render or URL
 *       change, and is never re-derived from the URL after it has landed;
 *   R-f afterwards any teacher/section can be edited and saved.
 *
 * Both entry paths call the same `landTarget`; the URL is only one source of a
 * target. A target stays PENDING until `ready` (the scope and its lists have
 * resolved), is applied exactly once, then is consumed by exact target identity.
 */

export type TeachingLoadLandingTarget = {
	viewMode: TeachingLoadViewMode | null;
	facultyId: number | null;
	sectionId: number | null;
	subjectId: number | null;
	task: string | null;
	/** R-d: an Assign entry opens that teacher's assign editor. */
	openEditor: boolean;
	/** E5: `filter=missing-coverage` narrows the coverage view to this subject's uncovered sections. */
	missingCoverageOnly: boolean;
};

export type TeachingLoadLandingRequest = {
	viewMode?: TeachingLoadViewMode | null;
	facultyId?: number | null;
	sectionId?: number | null;
	subjectId?: number | null;
	task?: string | null;
	openEditor?: boolean;
	missingCoverageOnly?: boolean;
};

type UseTeachingLoadLandingParams = {
	searchParams: URLSearchParams;
	/** True once the resolved scope and its lists are in hand. */
	ready: boolean;
	setViewMode: (mode: TeachingLoadViewMode) => void;
	setSelectedId: (id: number | null) => void;
	setSelectedSectionId: (id: number | null) => void;
	setSectionModeFilter: (filter: 'all' | 'unassigned' | 'constrained') => void;
	setSelectedSubjectId: (id: number | null) => void;
	setSubjectSearch: (search: string) => void;
	setLoadFilter: (filter: TeachingLoadLoadFilter) => void;
	setFilterStatus: (status: TeachingLoadStatusFilter) => void;
	setShowTemporaryRoles: (show: boolean) => void;
};

export function normalizeLandingTarget(request: TeachingLoadLandingRequest): TeachingLoadLandingTarget {
	return {
		viewMode: request.viewMode ?? null,
		facultyId: request.facultyId ?? null,
		sectionId: request.sectionId ?? null,
		subjectId: request.subjectId ?? null,
		task: request.task ?? null,
		openEditor: request.openEditor === true,
		missingCoverageOnly: request.missingCoverageOnly === true,
	};
}

/** Exact target identity used to CONSUME (R-e): the same target never re-applies. */
export function landingTargetKey(target: TeachingLoadLandingTarget): string {
	return [
		target.viewMode ?? '-',
		target.facultyId ?? '-',
		target.sectionId ?? '-',
		target.subjectId ?? '-',
		target.missingCoverageOnly ? 'missing-coverage' : '-',
	].join(':');
}

function namesTarget(intent: ReturnType<typeof parseRouteIntent>): boolean {
	return Boolean(
		intent.viewMode
		|| intent.facultyId != null
		|| intent.sectionId != null
		|| intent.subjectId != null
		|| intent.task,
	);
}

function targetFromIntent(intent: ReturnType<typeof parseRouteIntent>): TeachingLoadLandingTarget {
	return normalizeLandingTarget({
		viewMode: intent.viewMode,
		facultyId: intent.facultyId,
		sectionId: intent.sectionId,
		subjectId: intent.subjectId,
		task: intent.task,
		// R-d: `task=review` and a teacher-specific `task=missing-load` are Assign
		// entries; `change-owner` acts on a class that already has its teacher.
		openEditor: intent.task === 'review' || (intent.task === 'missing-load' && intent.facultyId != null),
		missingCoverageOnly: intent.filter === 'missing-coverage',
	});
}

/**
 * The DOM node a landed target scrolls to and focuses. Resolved by the ids/attrs
 * the row components render (`TeacherGridMode`/`SectionGridMode`), so the
 * mechanism is shared by both view modes and never holds a ref that a remount
 * can orphan.
 */
export function resolveLandingElement(target: TeachingLoadLandingTarget, root: ParentNode | null): HTMLElement | null {
	if (!root) return null;
	if (target.facultyId != null) {
		return root.querySelector<HTMLElement>(`#teaching-load-teacher-row-${target.facultyId}`);
	}
	if (target.sectionId != null) {
		return root.querySelector<HTMLElement>(`#teaching-load-section-row-${target.sectionId}`);
	}
	if (target.subjectId != null) {
		// A subject has no row of its own in the coverage list: land on the first
		// section that carries that subject, which is where the subject is in view.
		for (const row of Array.from(root.querySelectorAll<HTMLElement>('[data-testid="teaching-load-section-row"]'))) {
			const ids = (row.getAttribute('data-subject-ids') ?? '').split(',');
			if (!ids.includes(String(target.subjectId))) continue;
			// The outer card is not focusable; the inner `role="button"` carries the
			// row id and is the element a keyboard user would land on.
			const sectionId = row.getAttribute('data-section-id');
			return (sectionId && root.querySelector<HTMLElement>(`#teaching-load-section-row-${sectionId}`))
				?? row.querySelector<HTMLElement>('[role="button"]')
				?? row;
		}
	}
	return null;
}

export function useTeachingLoadLanding({
	searchParams,
	ready,
	setViewMode,
	setSelectedId,
	setSelectedSectionId,
	setSectionModeFilter,
	setSelectedSubjectId,
	setSubjectSearch,
	setLoadFilter,
	setFilterStatus,
	setShowTemporaryRoles,
}: UseTeachingLoadLandingParams) {
	const [pending, setPending] = useState<TeachingLoadLandingTarget | null>(null);
	/**
	 * The target that has LANDED. Kept after `pending` is cleared so the editor
	 * it opened (R-d) and the scroll/focus (R-b/R-c) survive the consume step.
	 */
	const [landed, setLanded] = useState<TeachingLoadLandingTarget | null>(null);
	const consumedRef = useRef<Set<string>>(new Set());
	const lastUrlKeyRef = useRef<string | null>(null);

	// R-e: a URL intent is a source of a target, never a re-arm. A target already
	// consumed by exact identity is never queued again; the in-page handler's
	// pending target is never clobbered by a URL rewrite it itself caused.
	useEffect(() => {
		const key = searchParams.toString();
		if (lastUrlKeyRef.current === key) return;
		lastUrlKeyRef.current = key;
		const intent = parseRouteIntent(searchParams);
		if (!namesTarget(intent)) return;
		const target = targetFromIntent(intent);
		if (consumedRef.current.has(landingTargetKey(target))) return;
		setPending((current) => current ?? target);
	}, [searchParams]);

	// The in-page path (repair queue / next-teacher). SAME mechanism: it queues
	// the exact same target shape the URL path does.
	const landTarget = useCallback((request: TeachingLoadLandingRequest) => {
		const target = normalizeLandingTarget(request);
		const key = landingTargetKey(target);
		if (consumedRef.current.has(key)) return;
		setPending(target);
	}, []);

	// Apply exactly once, against the loaded lists, then CONSUME.
	useEffect(() => {
		if (!pending) return;
		if (!ready) return;
		const target = pending;

		if (target.viewMode) setViewMode(target.viewMode);
		if (target.facultyId != null) setSelectedId(target.facultyId);
		if (target.sectionId != null) {
			setSelectedSectionId(target.sectionId);
			setSectionModeFilter('all');
		}
		if (target.subjectId != null) {
			setSelectedSubjectId(target.subjectId);
			setSubjectSearch('');
		}
		if (target.missingCoverageOnly) setSectionModeFilter('all');

		if (target.task === 'over-cap') {
			setLoadFilter('excess');
			setFilterStatus('all');
		} else if (target.task === 'missing-load') {
			setFilterStatus('no-teaching');
			setLoadFilter('all');
		} else if (target.task === 'change-owner') {
			setFilterStatus('all');
			setLoadFilter('all');
		} else if (target.task === 'review-placeholders') {
			setShowTemporaryRoles(true);
			setFilterStatus('all');
			setLoadFilter('all');
		}

		consumedRef.current.add(landingTargetKey(target));
		setPending(null);
		setLanded(target);
	}, [
		pending,
		ready,
		setFilterStatus,
		setLoadFilter,
		setSectionModeFilter,
		setSelectedId,
		setSelectedSectionId,
		setSelectedSubjectId,
		setShowTemporaryRoles,
		setSubjectSearch,
		setViewMode,
	]);

	// R-b / R-c: after the selection has painted, scroll the target row into view
	// and focus it. `landed` only changes when a target lands, so an operator's
	// later selection is never re-scrolled or re-focused.
	useEffect(() => {
		if (!landed) return;
		if (typeof document === 'undefined') return;
		const el = resolveLandingElement(landed, document);
		if (!el) return;
		try {
			el.scrollIntoView({ block: 'center' });
		} catch {
			// jsdom / older engines without scrollIntoView: focus is still applied.
		}
		try {
			el.focus();
		} catch {
			// A detached node cannot be focused; nothing else to do.
		}
	}, [landed]);

	return { landed, landTarget };
}
