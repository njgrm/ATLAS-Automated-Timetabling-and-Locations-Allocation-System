export type PublishedScheduleCacheSource = {
	runId: number;
	publishedAt: string | null;
	requestedDate?: string | null;
	resolvedForDate?: string | null;
	activeRevisionId?: number | null;
	activeRevisionEffectiveDate?: string | null;
	revisionMarker?: string | null;
};

function cachePart(value: string | number | null | undefined): string {
	const normalized = String(value ?? 'none')
		.trim()
		.replace(/[^A-Za-z0-9_-]+/g, '_')
		.replace(/^_+|_+$/g, '');
	return normalized || 'none';
}

export function currentPublishedScheduleDate(): string {
	const now = new Date();
	const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 10);
}

export function resolvePublishedScheduleRequestDate(value?: string | null): string {
	const requestedDate = typeof value === 'string' ? value.trim() : '';
	return requestedDate || currentPublishedScheduleDate();
}

export function buildPublishedScheduleCacheMarker(source: PublishedScheduleCacheSource): string {
	const requestedDate = source.requestedDate ?? source.resolvedForDate?.slice(0, 10) ?? 'current';
	return [
		'run', cachePart(source.runId),
		'published', cachePart(source.publishedAt),
		'revision', cachePart(source.activeRevisionId ?? 'base'),
		'effective', cachePart(source.activeRevisionEffectiveDate ?? 'none'),
		'date', cachePart(requestedDate),
		'marker', cachePart(source.revisionMarker ?? 'base'),
	].join('-');
}