import { useEffect, useRef, useMemo } from 'react';
import type { useSearchParams } from 'react-router-dom';

export type TeachingLoadViewMode = 'teacher' | 'allocation' | 'subjects';

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
	setLoadFilter: (filter: 'all' | 'overloaded' | 'optimal' | 'underloaded') => void;
	setFilterStatus: (status: 'all' | 'assigned' | 'unassigned') => void;
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
 * 2. `task=missing-load` WITHOUT `facultyId` → subjects mode (school-wide)
 * 3. `task=missing-load` WITH `facultyId` → teacher mode (teacher-specific)
 * 4. `sectionId` present → allocation mode
 * 5. `facultyId` present → teacher mode
 * 6. Task-only (e.g., review-placeholders, over-cap) → teacher mode
 * 7. No recognized intent → null (caller keeps current state)
 *
 * Incompatible parameters are normalized: if `view=subjects` and `sectionId`
 * are both present, `view=subjects` wins. If `facultyId` and `sectionId` are
 * both present without `view=subjects`, `sectionId` wins (allocation mode).
 */
export function parseRouteIntent(searchParams: URLSearchParams): ParsedRouteIntent {
	const viewParam = searchParams.get('view');
	const taskParam = searchParams.get('task');
	const facultyIdParam = parseNumericParam(searchParams.get('facultyId'));
	const sectionIdParam = parseNumericParam(searchParams.get('sectionId'));
	const subjectIdParam = parseNumericParam(searchParams.get('subjectId'));

	// Highest precedence: explicit subjects view (school-wide, no facultyId)
	if (viewParam === 'subjects' && facultyIdParam == null) {
		return {
			viewMode: 'subjects',
			facultyId: null,
			sectionId: null,
			subjectId: subjectIdParam,
			task: taskParam,
		};
	}

	// task=missing-load WITHOUT facultyId → subjects mode (school-wide missing coverage)
	if (taskParam === 'missing-load' && facultyIdParam == null) {
		return {
			viewMode: 'subjects',
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

		// Apply task-specific filters
		if (intent.task === 'over-cap') {
			apply.setLoadFilter('overloaded');
			apply.setFilterStatus('all');
		} else if (intent.task === 'missing-load') {
			apply.setFilterStatus('unassigned');
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
