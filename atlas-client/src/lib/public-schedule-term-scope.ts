export type PublicScheduleTermSelection = number | 'active' | 'invalid';
export const PUBLIC_SCHEDULE_INVALID_TERM_MESSAGE = 'The requested term is invalid. Choose an available published term.';

export function resolvePublicScheduleTermSelection(raw: string | null | undefined): PublicScheduleTermSelection {
	if (typeof raw !== 'string' || raw.trim().length === 0) return 'active';
	const parsed = Number(raw);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : 'invalid';
}

export function buildPublicScheduleTermRequest(selection: PublicScheduleTermSelection): { termIndex: number | 'active' } | null {
	return selection === 'invalid' ? null : { termIndex: selection };
}

export function buildPublicScheduleRequestParams(
	requestedDate: string,
	selection: PublicScheduleTermSelection,
): { date: string; termIndex: number | 'active' } | null {
	const termRequest = buildPublicScheduleTermRequest(selection);
	return termRequest ? { date: requestedDate, ...termRequest } : null;
}

export function isExactPublishedTermPayload(value: {
	source: { termIndex: number; termScope: 'active' | 'explicit' };
	entries: Array<{ termIndex: number }>;
}): boolean {
	return Number.isInteger(value.source.termIndex)
		&& value.source.termIndex > 0
		&& value.entries.every((entry) => entry.termIndex === value.source.termIndex);
}
