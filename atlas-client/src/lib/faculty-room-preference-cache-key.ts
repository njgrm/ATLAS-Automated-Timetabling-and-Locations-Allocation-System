import type { FacultyRoomPreferenceState } from '@/types';

function cachePart(value: string | number | null | undefined): string {
	const normalized = String(value ?? 'none')
		.trim()
		.replace(/[^A-Za-z0-9_-]+/g, '_')
		.replace(/^_+|_+$/g, '');
	return normalized || 'none';
}

export function buildRoomBootstrapCacheMarker(state: FacultyRoomPreferenceState): string {
	return [
		'run', cachePart(state.runId),
		'version', cachePart(state.runVersion),
		'generated', cachePart(state.runGeneratedAt),
		'published', cachePart(state.publishedAt),
		'revision', cachePart(state.activeRevisionId ?? 'base'),
		'effective', cachePart(state.activeRevisionEffectiveDate ?? 'none'),
		'marker', cachePart(state.revisionMarker ?? 'base'),
	].join('-');
}
