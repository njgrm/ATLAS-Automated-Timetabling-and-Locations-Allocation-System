import type {
	PreviewResult,
	ScheduledEntry,
	UnassignedItem,
	Violation,
	ViolationSeverity,
} from '@/types';

export function formatDuration(ms: number | null): string {
	if (ms == null) return '—';
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

export function minutesBetween(startTime: string, endTime: string): number {
	const toMinutes = (value: string) => {
		const [hours, minutes] = value.split(':').map(Number);
		return hours * 60 + minutes;
	};
	return Math.max(0, toMinutes(endTime) - toMinutes(startTime));
}

export function initials(firstName?: string | null, lastName?: string | null): string {
	const first = firstName?.trim()?.charAt(0) ?? '';
	const last = lastName?.trim()?.charAt(0) ?? '';
	return `${first}${last}`.toUpperCase() || '—';
}

export function buildUnassignedKey(item: UnassignedItem): string {
	return [
		item.cohortCode ?? item.sectionId,
		item.subjectId,
		item.session,
		item.entryKind ?? 'SECTION',
	].join(':');
}

export function formatTimestamp(iso: string | null): string {
	if (!iso) return '—';
	return new Date(iso).toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function statusColor(status: string): string {
	switch (status) {
		case 'COMPLETED':
			return 'bg-green-100 text-green-700 border-green-300';
		case 'FAILED':
			return 'bg-red-100 text-red-700 border-red-300';
		case 'RUNNING':
			return 'bg-blue-100 text-blue-700 border-blue-300';
		default:
			return 'bg-gray-100 text-gray-600 border-gray-300';
	}
}

export function deriveTimeSlots(entries: ScheduledEntry[]): Array<{ startTime: string; endTime: string }> {
	const seen = new Map<string, string>();
	for (const e of entries) {
		seen.set(e.startTime, e.endTime);
	}
	return Array.from(seen.entries())
		.map(([startTime, endTime]) => ({ startTime, endTime }))
		.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function buildViolationIndex(violations: Violation[]): Map<string, Violation[]> {
	const index = new Map<string, Violation[]>();
	for (const v of violations) {
		for (const eid of v.entities.entryIds ?? []) {
			const list = index.get(eid) ?? [];
			list.push(v);
			index.set(eid, list);
		}
	}
	return index;
}

export function entrySeverity(entryId: string, violationIndex: Map<string, Violation[]>): ViolationSeverity | null {
	const vList = violationIndex.get(entryId);
	if (!vList?.length) return null;
	return vList.some((v) => v.severity === 'HARD') ? 'HARD' : 'SOFT';
}

export function parseDraftPlacementId(entryId: string): number | null {
	if (!entryId.startsWith('draft-placement-')) return null;
	const parsed = Number(entryId.replace('draft-placement-', ''));
	return Number.isFinite(parsed) ? parsed : null;
}

export function scopePreviewToCandidate(
	preview: PreviewResult,
	target: { day?: string; startTime?: string; endTime?: string } = {},
): PreviewResult {
	const affectedEntryIds = new Set(preview.affectedEntries.map((entry) => entry.entryId));
	const matchesTarget = (violation: Violation) => {
		if (!target.day || !target.startTime || !target.endTime) return false;
		return violation.entities.day === target.day
			&& violation.entities.startTime === target.startTime
			&& violation.entities.endTime === target.endTime;
	};
	const isRelevant = (violation: Violation) => {
		const entryIds = violation.entities.entryIds ?? [];
		if (entryIds.some((entryId) => affectedEntryIds.has(entryId))) return true;
		return matchesTarget(violation);
	};

	const allViolations = [...preview.hardViolations, ...preview.softViolations];
	const relevantIndexes = new Set<number>();
	allViolations.forEach((violation, index) => {
		if (isRelevant(violation)) relevantIndexes.add(index);
	});

	const hardViolations = preview.hardViolations.filter(isRelevant);
	const softViolations = preview.softViolations.filter(isRelevant);
	const humanConflicts = preview.humanConflicts.filter((_, index) => relevantIndexes.has(index));

	return {
		...preview,
		allowed: hardViolations.length === 0,
		hardViolations,
		softViolations,
		humanConflicts,
	};
}
