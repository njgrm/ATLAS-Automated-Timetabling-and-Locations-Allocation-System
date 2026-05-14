import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
	buildAssignmentSignature,
	normalizeDraftAssignments,
	type FacultyAssignmentDraft,
} from '@/lib/faculty-assignment-helpers';
import type { ExternalSection, Subject } from '@/types';

type UseAssignmentHistoryParams = {
	selectedId: number | null;
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

export function useAssignmentHistory({
	selectedId,
	subjects,
	effectiveAssignmentsByFaculty,
	savedAssignmentsByFaculty,
	sectionMap,
	setDraftAssignmentsByFaculty,
}: UseAssignmentHistoryParams) {
	const [undoStack, setUndoStack] = useState<FacultyAssignmentDraft[][]>([]);
	const [redoStack, setRedoStack] = useState<FacultyAssignmentDraft[][]>([]);

	const homeroomSubjectIds = useMemo(() => {
		const ids = new Set<number>();
		for (const subject of subjects) {
			if (subject.code === 'HG' || subject.name.toLowerCase().includes('homeroom')) ids.add(subject.id);
		}
		return ids;
	}, [subjects]);

	const splitImmutableAssignments = useCallback((assignments: FacultyAssignmentDraft[]) => {
		const immutable = assignments.filter((assignment) => homeroomSubjectIds.has(assignment.subjectId));
		const mutable = assignments.filter((assignment) => !homeroomSubjectIds.has(assignment.subjectId));
		return { immutable, mutable };
	}, [homeroomSubjectIds]);

	const getSelectedMutableSnapshot = useCallback(() => {
		if (!selectedId) return [];
		const current = effectiveAssignmentsByFaculty[selectedId] ?? [];
		return cloneAssignments(splitImmutableAssignments(current).mutable);
	}, [effectiveAssignmentsByFaculty, selectedId, splitImmutableAssignments]);

	const pushHistory = useCallback(() => {
		if (!selectedId) return;
		const snapshot = getSelectedMutableSnapshot();
		setUndoStack((previous) => [...previous.slice(-29), snapshot]);
		setRedoStack([]);
	}, [getSelectedMutableSnapshot, selectedId]);

	const applySelectedMutableSnapshot = useCallback((mutableSnapshot: FacultyAssignmentDraft[]) => {
		if (!selectedId) return;
		const current = effectiveAssignmentsByFaculty[selectedId] ?? [];
		const immutable = splitImmutableAssignments(current).immutable;
		const merged = normalizeDraftAssignments([...cloneAssignments(immutable), ...cloneAssignments(mutableSnapshot)], sectionMap);
		setDraftAssignmentsByFaculty((previousDrafts) => {
			const nextDrafts = { ...previousDrafts };
			const savedSignature = buildAssignmentSignature(savedAssignmentsByFaculty[selectedId] ?? []);
			if (buildAssignmentSignature(merged) === savedSignature) delete nextDrafts[selectedId];
			else nextDrafts[selectedId] = merged;
			return nextDrafts;
		});
	}, [effectiveAssignmentsByFaculty, savedAssignmentsByFaculty, sectionMap, selectedId, setDraftAssignmentsByFaculty, splitImmutableAssignments]);

	const handleUndo = useCallback(() => {
		if (!selectedId || undoStack.length === 0) return;
		const previousSnapshot = undoStack[undoStack.length - 1];
		setUndoStack((previous) => previous.slice(0, -1));
		setRedoStack((previous) => [...previous, getSelectedMutableSnapshot()]);
		applySelectedMutableSnapshot(previousSnapshot);
	}, [applySelectedMutableSnapshot, getSelectedMutableSnapshot, selectedId, undoStack]);

	const handleRedo = useCallback(() => {
		if (!selectedId || redoStack.length === 0) return;
		const nextSnapshot = redoStack[redoStack.length - 1];
		setRedoStack((previous) => previous.slice(0, -1));
		setUndoStack((previous) => [...previous.slice(-29), getSelectedMutableSnapshot()]);
		applySelectedMutableSnapshot(nextSnapshot);
	}, [applySelectedMutableSnapshot, getSelectedMutableSnapshot, redoStack, selectedId]);

	const handleResetAssignments = useCallback(() => {
		if (!selectedId) return;
		pushHistory();
		applySelectedMutableSnapshot([]);
		toast.success('Mutable assignments were reset. Homeroom Guidance assignments were preserved.');
	}, [applySelectedMutableSnapshot, pushHistory, selectedId]);

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
