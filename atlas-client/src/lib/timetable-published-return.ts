export type PublishedTimetableReturnState = {
	runId: string;
	termFilter: 'all' | number;
	viewMode: 'section' | 'faculty' | 'room';
	entityFilter: string;
};

export type PublishedTimetableReturnSetters = {
	setRunId: (runId: string) => void;
	setTermFilter: (termFilter: 'all' | number) => void;
	setViewMode: (viewMode: 'section' | 'faculty' | 'room') => void;
	setEntityFilter: (entityFilter: string) => void;
};

export function restorePublishedTimetableContext(
	snapshot: PublishedTimetableReturnState | null,
	setters: PublishedTimetableReturnSetters,
): boolean {
	if (!snapshot) return false;
	setters.setRunId(snapshot.runId);
	setters.setTermFilter(snapshot.termFilter);
	setters.setViewMode(snapshot.viewMode);
	setters.setEntityFilter(snapshot.entityFilter);
	return true;
}

type PublishedReturnContext = PublishedTimetableReturnState & {
	centerView: string;
	isPublished: boolean;
};

export function capturePublishedReturnState(
	previous: PublishedTimetableReturnState | null,
	context: PublishedReturnContext,
): PublishedTimetableReturnState | null {
	if (context.centerView !== 'schedule' && previous) return previous;
	if (!context.isPublished || !context.runId || context.runId === 'latest') return previous;
	return {
		runId: context.runId,
		termFilter: context.termFilter,
		viewMode: context.viewMode,
		entityFilter: context.entityFilter,
	};
}
