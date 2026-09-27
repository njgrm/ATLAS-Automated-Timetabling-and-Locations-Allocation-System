import { useEffect, useRef, useMemo } from 'react';
import type { useSearchParams } from 'react-router-dom';
import type { TeachingLoadStatusFilter, TeachingLoadLoadFilter } from '@/lib/faculty-assignment-helpers';

export type TeachingLoadViewMode = 'teacher' | 'allocation';

export type ParsedRouteIntent = {
	viewMode: TeachingLoadViewMode | null;
	facultyId: number | null;
	sectionId: number | null;
	subjectId: number | null;
	task: string | null;
};

type ApplyIntentParams = {
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

function parseNumericParam(value: string | null): number | null {
	if (!value) return null;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) return null;
	return parsed;
}

/**
 * Parse and normalize route intent from URL search parameters.
 *
 * Precedence rules (highest to lowest):
 * 1. `view=subjects` (explicit, no facultyId) → subjects mode
 * 2. `task=change-owner` WITH `facultyId` → teacher mode on that teacher, with
 *    `sectionId`/`subjectId` KEPT (A2-TIMETABLE-CUSTODY, finding #3)
 * 3. `task=missing-load` WITHOUT `facultyId` → subjects mode (school-wide)
 * 4. `task=missing-load` WITH `facultyId` → teacher mode (teacher-specific)
 * 5. `sectionId` present → allocation mode
 * 6. `facultyId` present → teacher mode
 * 7. Task-only (e.g., review-placeholders, over-cap) → teacher mode
 * 8. No recognized intent → null (caller keeps current state)
 *
 * Incompatible parameters are normalized: if `view=subjects` and `sectionId`
 * are both present, `view=subjects` wins. If `facultyId` and `sectionId` are
 * both present without `view=subjects`, `sectionId` wins (allocation mode).
 *
 * ── A2-TIMETABLE-CUSTODY: why `change-owner` exists (finding #3) ─────────────
 * The timetable's "Change owner" action linked to
 * `/teaching-load?facultyId=<class teacher>&sectionId=<class>&subjectId=<class>&task=missing-load`.
 * Two source-level defects made that landing page show a different teacher than
 * the class's own, with no route back to the class:
 *
 *   a) rule 4 (above) DISCARDS `sectionId` and returns `sectionId: null`, so the
 *      `sectionId` the timetable carefully put in the URL was thrown away and the
 *      class was never in view;
 *   b) `task=missing-load` applies `filterStatus: 'no-teaching'` (see
 *      `useTeachingLoadRouteIntent`'s task block), whose canonical subject is a
 *      teacher who has NO load. The class being repaired HAS a teacher — the
 *      operator was asking to CHANGE that owner — so the filter selected the
 *      opposite population and surfaced teachers such as the one in the finding
 *      instead of the class's own.
 *
 * `change-owner` states the actual intent: teacher mode on the class's own
 * teacher, the class in view, and NO "no teaching load" filter, because this
 * action is about a teacher who already has the load.
 */
export function parseRouteIntent(searchParams: URLSearchParams): ParsedRouteIntent {
	const viewParam = searchParams.get('view');
	const taskParam = searchParams.get('task');
	const facultyIdParam = parseNumericParam(searchParams.get('facultyId'));
	const sectionIdParam = parseNumericParam(searchParams.get('sectionId'));
	const subjectIdParam = parseNumericParam(searchParams.get('subjectId'));

	// Highest precedence: explicit school-wide coverage view (legacy `view=subjects`
	// token). Same current surface: Sections coverage/navigation, not a second editor.
	if ((viewParam === 'subjects' || viewParam === 'allocation') && facultyIdParam == null) {
		return {
			viewMode: 'allocation',
			facultyId: null,
			sectionId: null,
			subjectId: subjectIdParam,
			task: taskParam,
		};
	}

	// A2-TIMETABLE-CUSTODY (#3): the timetable's "Change owner" intent. Placed
	// ABOVE the `missing-load` rules so it cannot be swallowed by them, and it
	// KEEPS sectionId/subjectId so the class the operator came from stays in
	// view — the discarded sectionId was one of the two reasons that link landed
	// on an unrelated teacher with no way back to the class.
	if (taskParam === 'change-owner' && facultyIdParam != null) {
		return {
			viewMode: 'teacher',
			facultyId: facultyIdParam,
			sectionId: sectionIdParam,
			subjectId: subjectIdParam,
			task: taskParam,
		};
	}

	// task=missing-load WITHOUT facultyId → Sections coverage (school-wide missing coverage)
	if (taskParam === 'missing-load' && facultyIdParam == null) {
		return {
			viewMode: 'allocation',
			facultyId: null,
			sectionId: null,
			subjectId: subjectIdParam,
			task: taskParam,
		};
	}

	// task=missing-load WITH facultyId → teacher mode (teacher-specific missing load)
	if (taskParam === 'missing-load' && facultyIdParam != null) {
		return {
			viewMode: 'teacher',
			facultyId: facultyIdParam,
			sectionId: null,
			subjectId: subjectIdParam,
			task: taskParam,
		};
	}

	// Section ID present → allocation mode
	if (sectionIdParam != null) {
		return {
			viewMode: 'allocation',
			facultyId: facultyIdParam,
			sectionId: sectionIdParam,
			subjectId: subjectIdParam,
			task: taskParam,
		};
	}

	// Faculty ID present → teacher mode
	if (facultyIdParam != null) {
		return {
			viewMode: 'teacher',
			facultyId: facultyIdParam,
			sectionId: null,
			subjectId: subjectIdParam,
			task: taskParam,
		};
	}

	// Task-only (e.g., review-placeholders, over-cap) → teacher mode
	if (taskParam) {
		return {
			viewMode: 'teacher',
			facultyId: null,
			sectionId: null,
			subjectId: subjectIdParam,
			task: taskParam,
		};
	}

	// No recognized intent
	return {
		viewMode: null,
		facultyId: null,
		sectionId: null,
		subjectId: subjectIdParam,
		task: null,
	};
}

/**
 * Apply inbound route intent exactly once per navigation entry.
 *
 * Uses a location-key ref to detect when the URL changes (via navigation,
 * Back/Forward, or reload) and only applies intent on the first render after
 * each location change. User actions that change tabs/teachers/sections
 * immediately supersede the intent.
 */
export function useTeachingLoadRouteIntent(
	searchParams: URLSearchParams,
	apply: ApplyIntentParams,
) {
	const lastLocationKeyRef = useRef<string>('');
	const intentAppliedRef = useRef(false);

	const intent = useMemo(() => parseRouteIntent(searchParams), [searchParams]);

	// Build a stable key from the search params to detect navigation changes
	const locationKey = useMemo(() => searchParams.toString(), [searchParams]);

	useEffect(() => {
		// New navigation entry: reset the applied flag
		if (locationKey !== lastLocationKeyRef.current) {
			lastLocationKeyRef.current = locationKey;
			intentAppliedRef.current = false;
		}

		// Already applied intent for this navigation entry
		if (intentAppliedRef.current) return;

		// No recognized intent
		if (!intent.viewMode && !intent.facultyId && !intent.sectionId && !intent.task) {
			intentAppliedRef.current = true;
			return;
		}

		// Apply view mode
		if (intent.viewMode) {
			apply.setViewMode(intent.viewMode);
		}

		// Apply faculty selection (only if facultyId is valid)
		if (intent.facultyId != null) {
			apply.setSelectedId(intent.facultyId);
		}

		// Apply section focus
		if (intent.sectionId != null) {
			apply.setSelectedSectionId(intent.sectionId);
			apply.setSectionModeFilter('all');
		}

		// Apply subject focus
		if (intent.subjectId != null) {
			apply.setSelectedSubjectId(intent.subjectId);
			apply.setSubjectSearch('');
		}

		// Apply task-specific filters (canonical TL-C01 vocabulary)
		if (intent.task === 'over-cap') {
			apply.setLoadFilter('excess');
			apply.setFilterStatus('all');
		} else if (intent.task === 'missing-load') {
			apply.setFilterStatus('no-teaching');
			apply.setLoadFilter('all');
		} else if (intent.task === 'change-owner') {
			// A2-TIMETABLE-CUSTODY (#3): deliberately NO filter. This action
			// targets a teacher who already has the load, so the `no-teaching`
			// filter that `missing-load` applies would select the opposite
			// population and hide the very teacher being repaired. The class
			// itself arrives via `sectionId` above and is in view.
			apply.setFilterStatus('all');
			apply.setLoadFilter('all');
		} else if (intent.task === 'review-placeholders') {
			apply.setShowTemporaryRoles(true);
			apply.setFilterStatus('all');
			apply.setLoadFilter('all');
		}

		intentAppliedRef.current = true;
	}, [locationKey, intent, apply]);

	return intent;
}
