/**
 * A6 (operator decision 14) — Teaching Load placement gate.
 *
 * Owns the "cannot place this class" state and the ONE one-click alternative
 * teacher for the Teaching Load page. Extracted from `pages/TeachingLoad.tsx`
 * so the page stays under the AGENTS.md §8 1000-physical-line cap (the page
 * crossed it when the gate was added inline).
 *
 * The gate is zero-write on the read side and delegates every scheduling
 * decision to the server (`/faculty-assignments/placement-check`); the server
 * owns the plain sentence the UI renders.
 */
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { formatTeachingLoadSaveError } from '@/lib/teaching-load-helpers';
import {
	blockersFromError,
	runPlacementGuardedSave,
	withPlacementPair,
	type PlacementAlternative,
	type PlacementApi,
	type PlacementBlocker,
} from '@/lib/teaching-load-placement';
import type { FacultyAssignmentDraft } from '@/types';

/** The subset of the Teaching Load data hook this gate reads and mutates. */
export interface TeachingLoadPlacementGateDataSource {
	schoolId: number | null;
	activeSchoolYearId: number | null;
	faculty: Array<{ id: number; version: number }>;
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	savedAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	setDraftAssignmentsByFaculty: (
		updater: (prev: Record<number, FacultyAssignmentDraft[]>) => Record<number, FacultyAssignmentDraft[]>,
	) => void;
	pushHistory: () => void;
	setSaving: (value: boolean) => void;
	fetchData: (options?: { forceRefresh?: boolean }) => Promise<unknown> | unknown;
}

export interface TeachingLoadPlacementGate {
	placementBlockers: PlacementBlocker[];
	setPlacementBlockers: (blockers: PlacementBlocker[]) => void;
	/** Set the blockers carried by a typed 409; returns true when it did. */
	noteBlockersFromError: (error: unknown) => boolean;
	handleUsePlacementAlternative: (blocker: PlacementBlocker, alternative: PlacementAlternative) => Promise<void>;
}

const BLOCKED_MESSAGE = 'The timetable cannot place one or more of these classes. Choose a teacher who fits the free time.';

export function useTeachingLoadPlacementGate(input: {
	api: PlacementApi;
	data: TeachingLoadPlacementGateDataSource;
	setDraftStatusMessage: (message: string) => void;
}): TeachingLoadPlacementGate {
	const { api, data, setDraftStatusMessage } = input;
	const [placementBlockers, setPlacementBlockers] = useState<PlacementBlocker[]>([]);

	const noteBlockersFromError = useCallback((error: unknown): boolean => {
		const blockers = blockersFromError(error);
		if (blockers.length === 0) return false;
		setPlacementBlockers(blockers);
		setDraftStatusMessage(BLOCKED_MESSAGE);
		return true;
	}, [setDraftStatusMessage]);

	/**
	 * ONE one-click alternative teacher who fits: the blocked pair moves off the
	 * blocked teacher onto the alternative in the draft, and the SAME guarded
	 * save re-runs (which re-checks before writing).
	 */
	const handleUsePlacementAlternative = useCallback(async (blocker: PlacementBlocker, alternative: PlacementAlternative) => {
		if (!data.schoolId || !data.activeSchoolYearId) return;
		const blockedRow = data.faculty.find((member) => member.id === blocker.facultyId);
		const alternativeRow = data.faculty.find((member) => member.id === alternative.facultyId);
		if (!blockedRow || !alternativeRow) return;
		const assignmentsFor = (facultyId: number) => data.effectiveAssignmentsByFaculty[facultyId] ?? data.savedAssignmentsByFaculty[facultyId] ?? [];
		const blockedAssignments = withPlacementPair(assignmentsFor(blocker.facultyId), blocker.subjectId, blocker.sectionId, 'remove');
		const alternativeAssignments = withPlacementPair(assignmentsFor(alternative.facultyId), blocker.subjectId, blocker.sectionId, 'add');
		data.pushHistory();
		data.setDraftAssignmentsByFaculty((prev) => ({ ...prev, [blocker.facultyId]: blockedAssignments, [alternative.facultyId]: alternativeAssignments }));
		data.setSaving(true);
		try {
			const outcome = await runPlacementGuardedSave({
				api,
				schoolId: data.schoolId,
				schoolYearId: data.activeSchoolYearId,
				drafts: [
					{ facultyId: blocker.facultyId, version: blockedRow.version, assignments: blockedAssignments },
					{ facultyId: alternative.facultyId, version: alternativeRow.version, assignments: alternativeAssignments },
				],
			});
			if (outcome.status === 'blocked') {
				setPlacementBlockers(outcome.blockers);
				setDraftStatusMessage('The timetable still cannot place this class.');
				return;
			}
			setPlacementBlockers([]);
			if (outcome.status === 'failed') {
				if (noteBlockersFromError(outcome.error)) {
					setDraftStatusMessage('The timetable still cannot place this class.');
					return;
				}
				toast.error(formatTeachingLoadSaveError(outcome.error));
				setDraftStatusMessage(formatTeachingLoadSaveError(outcome.error));
				return;
			}
			const message = `Assigned ${blocker.subjectName} to ${alternative.facultyName}.`;
			toast.success(message);
			setDraftStatusMessage(message);
			await data.fetchData({ forceRefresh: true });
		} finally {
			data.setSaving(false);
		}
	}, [api, data, noteBlockersFromError, setDraftStatusMessage]);

	return { placementBlockers, setPlacementBlockers, noteBlockersFromError, handleUsePlacementAlternative };
}
