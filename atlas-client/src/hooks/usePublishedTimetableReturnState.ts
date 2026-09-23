import { useCallback, useEffect, useRef, useState } from 'react';

import {
	capturePublishedReturnState,
	type PublishedTimetableReturnState,
} from '@/lib/timetable-published-return';

export type PublishedTimetableReturnContext = {
	centerView: string;
	isPublished: boolean;
	runId: string;
	termFilter: 'all' | number;
	viewMode: 'section' | 'faculty' | 'room';
	entityFilter: string;
};

function sameSnapshot(left: PublishedTimetableReturnState | null, right: PublishedTimetableReturnState | null): boolean {
	return left === right || (left != null && right != null
		&& left.runId === right.runId
		&& left.termFilter === right.termFilter
		&& left.viewMode === right.viewMode
		&& left.entityFilter === right.entityFilter);
}

export function usePublishedTimetableReturnState(context: PublishedTimetableReturnContext) {
	const [snapshot, setSnapshot] = useState<PublishedTimetableReturnState | null>(null);
	const snapshotRef = useRef<PublishedTimetableReturnState | null>(null);
	const storeSnapshot = useCallback((next: PublishedTimetableReturnState | null) => {
		if (sameSnapshot(snapshotRef.current, next)) return;
		snapshotRef.current = next;
		setSnapshot(next);
	}, []);
	const capture = useCallback((centerView = context.centerView) => {
		storeSnapshot(capturePublishedReturnState(snapshotRef.current, { ...context, centerView }));
	}, [context.centerView, context.entityFilter, context.isPublished, context.runId, context.termFilter, context.viewMode, storeSnapshot]);
	const clear = useCallback(() => storeSnapshot(null), [storeSnapshot]);

	useEffect(() => {
		capture();
	}, [capture]);

	return { snapshot, capture, clear };
}
