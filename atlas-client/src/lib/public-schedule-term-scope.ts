export type PublicScheduleTermSelection = number | 'active';

export function resolvePublicScheduleTermSelection(raw: string | null | undefined): PublicScheduleTermSelection {
	if (typeof raw !== 'string' || raw.trim().length === 0) return 'active';
	const parsed = Number(raw);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : 'active';
}

export function isExactPublishedTermPayload(value: {
	source: { termIndex: number; termScope: 'active' | 'explicit' };
	entries: Array<{ termIndex: number }>;
}): boolean {
	return Number.isInteger(value.source.termIndex)
		&& value.source.termIndex > 0
		&& value.entries.every((entry) => entry.termIndex === value.source.termIndex);
}
