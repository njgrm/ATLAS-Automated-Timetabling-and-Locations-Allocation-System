/**
 * TT-OUTPUT-C03R2 — Ordered-term grid authority.
 *
 * An academic term is the authoritative scope of a schedule. Each entry belongs
 * to exactly one numeric term; entries without a `termIndex` are visible only in
 * all-term review. This is the single predicate the timetable grid uses, so a
 * selected term selects one non-overlapping set of subject/teacher/room
 * assignments and never mixes terms.
 */

import type { ScheduledEntry } from '@/types';

export function matchesTermScope(
	entry: Pick<ScheduledEntry, 'termIndex'>,
	termFilter: 'all' | number,
): boolean {
	if (termFilter === 'all') return true;
	const entryTermIndex = entry.termIndex ?? null;
	if (entryTermIndex === null) return false;
	return entryTermIndex === termFilter;
}

export function filterEntriesByTermScope<T extends Pick<ScheduledEntry, 'termIndex'>>(
	entries: readonly T[],
	termFilter: 'all' | number,
): T[] {
	return entries.filter((entry) => matchesTermScope(entry, termFilter));
}
