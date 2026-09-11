import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
	buildAssignmentSignature,
	normalizeDraftAssignments,
	type FacultyAssignmentDraft,
} from '@/lib/faculty-assignment-helpers';
import type { ExternalSection, Subject } from '@/types';

type UseAssignmentHistoryParams = {
	scopeKey: string | null;
	selectedId: number | null; // Keep for interface compatibility if needed, but history is global
	subjects: Subject[];
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	savedAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	sectionMap: Map<number, ExternalSection>;
	setDraftAssignmentsByFaculty: Dispatch<SetStateAction<Record<number, FacultyAssignmentDraft[]>>>;
};

function cloneAssignments(assignments: FacultyAssignmentDraft[]): FacultyAssignmentDraft[] {
	return assignments.map((assignment) => ({
		subjectId: assignment.subjectId,
		sectionIds: [...assignment.sectionIds],
		gradeLevels: [...assignment.gradeLevels],
	}));
}

type GlobalSnapshot = Record<number, FacultyAssignmentDraft[]>;

export function useAssignmentHistory({
	scopeKey,
	selectedId,
	subjects,
	effectiveAssignmentsByFaculty,
	savedAssignmentsByFaculty,
	sectionMap,
	setDraftAssignmentsByFaculty,
}: UseAssignmentHistoryParams) {
	const [undoStack, setUndoStack] = useState<GlobalSnapshot[]>([]);
	const [redoStack, setRedoStack] = useState<GlobalSnapshot[]>([]);

	// Canonical persisted identity only. Display-name matching is never authority.
	const homeroomSubjectIds = useMemo(() => {
		const ids = new Set<number>();
		for (const subject of subjects) {
			if (subject.code === 'HG') ids.add(subject.id);
		}
		return ids;
	}, [subjects]);

	// A scope change invalidates the whole local history so stale undo/redo
	// snapshots can never be replayed against a different school/year.
	useEffect(() => {
		setUndoStack([]);
		setRedoStack([]);
	}, [scopeKey]);

	const splitImmutableAssignments = useCallback((assignments: FacultyAssignmentDraft[]) => {
		const immutable = assignments.filter((assignment) => homeroomSubjectIds.has(assignment.subjectId));
		const mutable = assignments.filter((assignment) => !homeroomSubjectIds.has(assignment.subjectId));
		return { immutable, mutable };
	}, [homeroomSubjectIds]);

	const getGlobalMutableSnapshot = useCallback(() => {
		const snapshot: GlobalSnapshot = {};
		for (const [facultyId, assignments] of Object.entries(effectiveAssignmentsByFaculty)) {
			const id = Number(facultyId);
			const mutable = splitImmutableAssignments(assignments).mutable;
			if (mutable.length > 0) {
				snapshot[id] = cloneAssignments(mutable);
			}
		}
		return snapshot;
	}, [effectiveAssignmentsByFaculty, splitImmutableAssignments]);

	const pushHistory = useCallback(() => {
		const snapshot = getGlobalMutableSnapshot();
		setUndoStack((previous) => [...previous.slice(-29), snapshot]);
		setRedoStack([]);
	}, [getGlobalMutableSnapshot]);

	const applyGlobalMutableSnapshot = useCallback((mutableSnapshot: GlobalSnapshot) => {
		setDraftAssignmentsByFaculty((previousDrafts) => {
			const nextDrafts = { ...previousDrafts };
			
			// Process all faculty IDs that exist in either current state or snapshot
			const facultyIds = new Set([
				...Object.keys(effectiveAssignmentsByFaculty).map(Number),
				...Object.keys(mutableSnapshot).map(Number)
			]);

			for (const facultyId of facultyIds) {
				const current = effectiveAssignmentsByFaculty[facultyId] ?? [];
				const immutable = splitImmutableAssignments(current).immutable;
				const snapshotAssignments = mutableSnapshot[facultyId] ?? [];
				
				const merged = normalizeDraftAssignments([...cloneAssignments(immutable), ...cloneAssignments(snapshotAssignments)], sectionMap);
				
				const savedSignature = buildAssignmentSignature(savedAssignmentsByFaculty[facultyId] ?? []);
				if (buildAssignmentSignature(merged) === savedSignature) {
					delete nextDrafts[facultyId];
				} else {
					nextDrafts[facultyId] = merged;
				}
			}
			return nextDrafts;
		});
	}, [effectiveAssignmentsByFaculty, savedAssignmentsByFaculty, sectionMap, setDraftAssignmentsByFaculty, splitImmutableAssignments]);

	const handleUndo = useCallback(() => {
		if (undoStack.length === 0) return;
		const previousSnapshot = undoStack[undoStack.length - 1];
		setUndoStack((previous) => previous.slice(0, -1));
		setRedoStack((previous) => [...previous, getGlobalMutableSnapshot()]);
		applyGlobalMutableSnapshot(previousSnapshot);
	}, [applyGlobalMutableSnapshot, getGlobalMutableSnapshot, undoStack]);

	const handleRedo = useCallback(() => {
		if (redoStack.length === 0) return;
		const nextSnapshot = redoStack[redoStack.length - 1];
		setRedoStack((previous) => previous.slice(0, -1));
		setUndoStack((previous) => [...previous.slice(-29), getGlobalMutableSnapshot()]);
		applyGlobalMutableSnapshot(nextSnapshot);
	}, [applyGlobalMutableSnapshot, getGlobalMutableSnapshot, redoStack]);

	const handleResetAssignments = useCallback(() => {
		if (!selectedId) return;
		pushHistory();
		// We only want to reset the selected teacher, so we modify the global snapshot
		const currentSnapshot = getGlobalMutableSnapshot();
		currentSnapshot[selectedId] = []; // Clear mutable assignments for selected teacher
		applyGlobalMutableSnapshot(currentSnapshot);
		toast.success('Mutable assignments were reset for this teacher.');
	}, [applyGlobalMutableSnapshot, getGlobalMutableSnapshot, pushHistory, selectedId]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
			if (!(event.ctrlKey || event.metaKey)) return;
			if (event.key.toLowerCase() === 'z') {
				event.preventDefault();
				handleUndo();
			} else if (event.key.toLowerCase() === 'y') {
				event.preventDefault();
				handleRedo();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [handleRedo, handleUndo]);

	return {
		canUndo: undoStack.length > 0,
		canRedo: redoStack.length > 0,
		pushHistory,
		handleUndo,
		handleRedo,
		handleResetAssignments,
	};
}
