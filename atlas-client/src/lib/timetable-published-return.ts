export type PublishedTimetableReturnState = {
	runId: string;
	termFilter: 'all' | number;
	viewMode: 'section' | 'faculty' | 'room';
	entityFilter: string;
};

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
