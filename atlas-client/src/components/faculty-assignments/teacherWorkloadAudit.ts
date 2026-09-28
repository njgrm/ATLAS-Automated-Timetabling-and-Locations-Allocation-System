/**
 * teacherWorkloadAudit — the ONE classification of teacher workload behind the
 * `Teacher Workload Audit Summary` (Fix 26).
 *
 * WHAT THIS FIXES. Lane C measured live that `Review teachers` opened a
 * single-teacher modal, not a summary. The original Fix 26 criteria ask for
 * "counts (total/balanced/underloaded/overloaded), filters, and a scrollable
 * flagged-teacher list", and the c10 packet requires each of the four counts to
 * be a click-through filter. There was no classification anywhere in the client
 * that produced those four buckets for the whole roster, so this module adds
 * exactly one.
 *
 * THE FOUR BUCKETS ARE NOT INVENTED HERE. Every threshold is the one the roster
 * already uses, so the summary cannot disagree with the roster's own `Load`
 * filter:
 *
 *  - `actualHours` comes from `resolveTeachingActualHours(member, effectiveHours)`
 *    — the same call `TeacherGridMode` makes for the row figure on the very same
 *    screen, so it is draft-aware and includes unsaved Teaching Load changes.
 *  - `standardHours` is the explicit effective school/year teaching standard
 *    (`teachingStandardHoursOf(workloadPolicy)`), the same value
 *    `TeacherLoadReadout` and the roster's `Load` filter use. It is `null` when
 *    the year has no persisted workload policy; ATLAS never substitutes 30h/5h.
 *  - `underloaded` = `actual < standard`, `balanced` = `actual === standard`,
 *    `overloaded` = `actual > standard` — byte-for-byte the rules in
 *    `matchesLoadSelection` and `computeTeachingLoadFacets`
 *    (`@/lib/faculty-assignment-helpers`, lines 690-692 and 756-758).
 *  - `isOverCap` (`actual > maxHoursPerWeek`) is the per-faculty DepEd hard cap.
 *    It is a visible FLAG on a row, never a bucket boundary, so the counts still
 *    equal the roster's counts.
 *
 * A teacher with no teaching load (`actual <= 0`) is NOT underloaded here: the
 * canonical load facets exclude it, so counting it would make this summary
 * disagree with the roster. Such teachers are reported honestly in
 * `unclassifiedCount` and named on screen rather than folded into a bucket.
 *
 * THE STORE. The summary needs the whole roster, but `pages/TeachingLoad.tsx`
 * is outside this stream's fence and passes `ReviewTeachersModal` only the
 * already-selected teacher's inspector node. `TeacherGridMode` — also in this
 * fence, and the component that already holds the roster, the effective
 * (draft-aware) hours map and the standard — publishes a snapshot here on every
 * change, and the modal subscribes. The numbers are therefore the same numbers
 * the roster rows are showing at that moment, computed by the same function.
 * Nothing is fetched, cached, or refetched by the modal.
 *
 * HONEST UNAVAILABILITY. `status` is `unavailable` when the roster has never
 * published (the advanced grid is hidden, or the modal is exercised outside the
 * page) and `loading` while the roster is being fetched. In both cases the UI
 * states which, and shows no number. A plausible wrong number is worse than an
 * honest gap.
 */
import { useSyncExternalStore } from 'react';
import { resolveTeachingActualHours } from '@/lib/faculty-assignment-helpers';
import { formatFacultyDisplayName } from '@/components/faculty/teacherNameDisplay';
import type { FacultySummary } from '@/types';

export type TeacherWorkloadAuditBucket = 'underloaded' | 'balanced' | 'overloaded';
export type TeacherWorkloadAuditFilter = 'all' | TeacherWorkloadAuditBucket;
export type TeacherWorkloadAuditStatus = 'unavailable' | 'loading' | 'ready';

export type TeacherWorkloadAuditRow = {
	facultyId: number;
	/** Stored given and family name, so a row avatar never has to re-parse a label. */
	firstName: string;
	lastName: string;
	displayName: string;
	departmentLabel: string;
	/** Draft-aware actual teaching hours — the same figure the roster row shows. */
	actualHours: number;
	standardHours: number;
	maxHoursPerWeek: number;
	isClassAdviser: boolean;
	isOverCap: boolean;
	bucket: TeacherWorkloadAuditBucket;
};

export type TeacherWorkloadAuditSnapshot = {
	status: TeacherWorkloadAuditStatus;
	/** The explicit effective standard, or null when the year has none persisted. */
	standardHours: number | null;
	policyReady: boolean;
	/**
	 * The classified population: exactly `underloaded + balanced + overloaded`.
	 * Rendered as `Total`.
	 */
	total: number;
	/** Every roster row, classified or not. Always a real measurement. */
	rosterSize: number;
	counts: Record<TeacherWorkloadAuditBucket, number>;
	/** Real teachers with no teaching load, plus temporary rows. Never bucketed. */
	unclassifiedCount: number;
	/** Classified rows only, worst-first. Drives the scrollable list. */
	rows: TeacherWorkloadAuditRow[];
};

/** The click-through filter controls, in the order the criteria name them. */
export const TEACHER_WORKLOAD_AUDIT_FILTERS: ReadonlyArray<{
	id: TeacherWorkloadAuditFilter;
	label: string;
}> = [
	{ id: 'all', label: 'Total' },
	{ id: 'underloaded', label: 'Underloaded' },
	{ id: 'balanced', label: 'Balanced' },
	{ id: 'overloaded', label: 'Overloaded' },
];

/**
 * THE bucket predicate — the single named place it is defined.
 *
 * Returns `null` when a teacher genuinely cannot be classified (no persisted
 * standard, or no teaching load). `null` is a real answer, not a fallback to
 * zero: the caller renders it as unavailable rather than inventing a figure.
 *
 * Thresholds: the explicit effective school/year standard only. There is no
 * client-side default, no fudge band around equality, and no per-department
 * variation — the exact comparisons the roster's `Load` filter already applies.
 */
export function classifyTeacherWorkloadBucket(
	actualHours: number,
	standardHours: number | null,
): TeacherWorkloadAuditBucket | null {
	if (standardHours == null || !(standardHours > 0)) return null;
	if (!Number.isFinite(actualHours) || !(actualHours > 0)) return null;
	if (actualHours < standardHours) return 'underloaded';
	if (actualHours === standardHours) return 'balanced';
	return 'overloaded';
}

/** Order used for the list: the bucket needing attention first, then hours. */
const BUCKET_ORDER: Record<TeacherWorkloadAuditBucket, number> = {
	overloaded: 0,
	underloaded: 1,
	balanced: 2,
};

export type TeacherWorkloadAuditInput = {
	faculty: FacultySummary[];
	/** The draft-aware effective hours map built by `useTeachingLoadUI`. */
	effectiveActualHours: Map<number, number>;
	teachingStandardHours: number | null;
	policyReady: boolean;
	loading: boolean;
};

/** Pure builder. No React, no store — directly unit-testable. */
export function buildTeacherWorkloadAuditSnapshot(
	input: TeacherWorkloadAuditInput,
): TeacherWorkloadAuditSnapshot {
	const { faculty, effectiveActualHours, teachingStandardHours, policyReady, loading } = input;

	if (loading) {
		return { status: 'loading', standardHours: teachingStandardHours, policyReady, total: 0, rosterSize: 0, counts: emptyCounts(), unclassifiedCount: 0, rows: [] };
	}

	const counts = emptyCounts();
	const rows: TeacherWorkloadAuditRow[] = [];
	let unclassifiedCount = 0;

	for (const member of faculty) {
		// A temporary/placeholder row is not a real faculty member and the
		// effective-hours map deliberately omits it, so there is no standard-
		// relative figure to judge. It is counted as unclassified, never
		// bucketed — the same treatment the roster's `showTemporaryRoles`
		// default gives it.
		if (member.isPlaceholder) {
			unclassifiedCount += 1;
			continue;
		}
		const actualHours = resolveTeachingActualHours(member, effectiveActualHours);
		const bucket = classifyTeacherWorkloadBucket(actualHours, teachingStandardHours);
		if (bucket === null) {
			// A zero-teaching teacher is not an underloaded one. It is counted
			// honestly and named on screen instead of being forced into a bucket.
			unclassifiedCount += 1;
			continue;
		}
		counts[bucket] += 1;
		rows.push({
			facultyId: member.id,
			firstName: member.firstName,
			lastName: member.lastName,
			displayName: formatFacultyDisplayName(member),
			departmentLabel: member.departmentLabel || member.department || 'Unmapped',
			actualHours,
			standardHours: teachingStandardHours as number,
			maxHoursPerWeek: member.maxHoursPerWeek,
			isClassAdviser: member.isClassAdviser,
			isOverCap: actualHours > member.maxHoursPerWeek,
			bucket,
		});
	}

	rows.sort((left, right) => {
		const byBucket = BUCKET_ORDER[left.bucket] - BUCKET_ORDER[right.bucket];
		if (byBucket !== 0) return byBucket;
		if (left.actualHours !== right.actualHours) return right.actualHours - left.actualHours;
		return left.displayName.localeCompare(right.displayName);
	});

	const total = counts.underloaded + counts.balanced + counts.overloaded;
	return { status: 'ready', standardHours: teachingStandardHours, policyReady, total, rosterSize: faculty.length, counts, unclassifiedCount, rows };
}

/** The rows a filter selects. `all` is every classified row. */
export function selectTeacherWorkloadAuditRows(
	snapshot: TeacherWorkloadAuditSnapshot,
	filter: TeacherWorkloadAuditFilter,
): TeacherWorkloadAuditRow[] {
	if (filter === 'all') return snapshot.rows;
	return snapshot.rows.filter((row) => row.bucket === filter);
}

function emptyCounts(): Record<TeacherWorkloadAuditBucket, number> {
	return { underloaded: 0, balanced: 0, overloaded: 0 };
}

export const UNAVAILABLE_TEACHER_WORKLOAD_AUDIT: TeacherWorkloadAuditSnapshot = {
	status: 'unavailable',
	standardHours: null,
	policyReady: false,
	total: 0,
	rosterSize: 0,
	counts: emptyCounts(),
	unclassifiedCount: 0,
	rows: [],
};

/* ── store ────────────────────────────────────────────────────────────── */

type Store = {
	snapshot: TeacherWorkloadAuditSnapshot;
	/** The roster's own selection setter. Selection only — never a draft write. */
	selectTeacher: ((facultyId: number) => void) | null;
};

let current: Store = { snapshot: UNAVAILABLE_TEACHER_WORKLOAD_AUDIT, selectTeacher: null };
const listeners = new Set<() => void>();

/** Field-wise equality so a re-render with identical data does not churn React. */
function sameSnapshot(left: TeacherWorkloadAuditSnapshot, right: TeacherWorkloadAuditSnapshot): boolean {
	return (
		left.status === right.status
		&& left.standardHours === right.standardHours
		&& left.policyReady === right.policyReady
		&& left.total === right.total
		&& left.rosterSize === right.rosterSize
		&& left.unclassifiedCount === right.unclassifiedCount
		&& left.counts.underloaded === right.counts.underloaded
		&& left.counts.balanced === right.counts.balanced
		&& left.counts.overloaded === right.counts.overloaded
		&& left.rows === right.rows
	);
}

/**
 * Publish the roster's current classification. Called by `TeacherGridMode`
 * only — the component that owns the real data.
 */
export function publishTeacherWorkloadAudit(
	snapshot: TeacherWorkloadAuditSnapshot,
	selectTeacher: ((facultyId: number) => void) | null,
): void {
	// The callback is refreshed on every publish but never triggers a
	// re-render on its own: only a changed figure can change what is shown.
	const changed = !sameSnapshot(current.snapshot, snapshot);
	current = { snapshot, selectTeacher };
	if (changed) listeners.forEach((listener) => listener());
}

/** Reset to the honest unavailable state. Called when the roster unmounts. */
export function clearTeacherWorkloadAudit(): void {
	publishTeacherWorkloadAudit(UNAVAILABLE_TEACHER_WORKLOAD_AUDIT, null);
}

export function getTeacherWorkloadAudit(): TeacherWorkloadAuditSnapshot {
	return current.snapshot;
}

/**
 * The roster's selection setter, or null when no roster is published. Read
 * outside React (once, on click) so the modal never re-renders on it.
 */
export function getTeacherWorkloadAuditSelectTeacher(): ((facultyId: number) => void) | null {
	return current.selectTeacher;
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Subscribe the summary to the roster's live classification. */
export function useTeacherWorkloadAudit(): TeacherWorkloadAuditSnapshot {
	return useSyncExternalStore(subscribe, getTeacherWorkloadAudit, getTeacherWorkloadAudit);
}
