/**
 * A6 c5 — ONE owner of the shortage derivations the Teaching Load page needs.
 *
 * WHY A HOOK, AND WHY IT IS PURE INSIDE. The page was at 981 of a 1000-line cap
 * and four new derivations would have taken it over. Each was already a
 * `useMemo` wearing a formality — read fields, return a value, decide nothing —
 * so the derivations moved here and the page keeps deciding WHEN to recompute.
 * This hook is also the page's single call site for the shortage, which is what
 * makes the subtraction enforceable: one place knows a shortage exists, one
 * place knows its figures, and one place can be wrong.
 *
 * THE THREE THINGS IT OWNS, and the defect each closes.
 *
 *  1. `staffingFigures` — the two figures that lie. `% staffed` counted
 *     `(real + placeholder) / total`, so a roster held entirely by to-be-hired
 *     records read 100% staffed; `Still without a teacher` counted UNOWNED
 *     pairs only, so it read 0 while 25 classes sat on temporary records. Both
 *     are now `realFacultyAssignedPairs`-based, because a to-be-hired record is
 *     not a teacher.
 *
 *  2. `shortageLine` — the per-subject line, with the data date from the only
 *     timestamp the client holds. `null` DROPS the date clause rather than
 *     inventing one.
 *
 *  3. `cover` — the `useCoverShortage` handle, threaded straight through so the
 *     page does not re-plumb the dialog's state.
 *
 * `placeholderFacultyIds` is a PARAMETER, not a derivation. The page already
 * derives the set for `buildTeachingLoadTruthModel`, and a second derivation
 * here would be a second answer to "who is a placeholder" — the same class of
 * second authority the truth panel exists to prevent. The set is built from the
 * SAVED roster's own `isPlaceholder` flag, so no new personnel rule is invented
 * anywhere: A9 removes non-teaching personnel at fetch, so the roster reaching
 * this hook already excludes them.
 *
 * THE `isLive` GATE IS THE SUBTLE PART. A shortage is only CLAIMED when the
 * source is verified. While ATLAS is checking EnrollPro or cannot reach it, the
 * ownership index describes the last saved snapshot, and the header's amber
 * degraded line already withholds every derived figure. Printing a live-sounding
 * shortage sentence beside that amber line would be the "two claims, one fact"
 * defect in its worst form — and `isTeachingLoadSourceDegraded` is the SAME
 * predicate the header and the repair queue already share, so there is one
 * answer to "are these figures confirmed?" rather than three.
 */
import { useMemo } from 'react';

import { isTeachingLoadSourceDegraded } from '@/components/faculty-assignments/WorkspaceToolbar';
import {
	buildShortageLineModel,
	buildStaffingTruthFigures,
	buildSubjectShortage,
	formatShortageDataDate,
} from '@/components/faculty-assignments/teachingLoadOutage';
import { useCoverShortage } from '@/hooks/useCoverShortage';
import type {
	ExternalSection,
	FacultyOwnershipState,
	Subject,
	TeachingLoadCoverageTotals,
} from '@/types';

export type UseTeachingLoadOutageParams = {
	subjects: Subject[];
	sections: ExternalSection[];
	savedOwnershipMap: Record<string, FacultyOwnershipState>;
	pendingOwnershipMap: Record<string, FacultyOwnershipState>;
	activeFacultyIds: Set<number>;
	/** Faculty ids the SAVED roster marks as to-be-hired. The page owns it. */
	placeholderFacultyIds: Set<number>;
	coverageTotals: TeachingLoadCoverageTotals | null;
	/** The ONLY timestamp the client holds, from `SectionSummaryResponse`. */
	fetchedAt: string | null | undefined;
	schoolId: number | null;
	activeSchoolYearId: number | null;
	/** Changes whenever the school or year changes; opens the cover hook's epoch. */
	scopeKey: string | null;
	dataSource: 'live' | 'cached' | 'refreshing' | 'none';
	isOnline: boolean;
	degradedNotice: string | null;
	sectionMap: Map<number, ExternalSection>;
};

export function useTeachingLoadOutage(params: UseTeachingLoadOutageParams) {
	const staffingFigures = useMemo(
		() => buildStaffingTruthFigures({
			realAssignedPairs: params.coverageTotals?.realFacultyAssignedPairs ?? 0,
			syntheticPlaceholderPairs: params.coverageTotals?.syntheticPlaceholderPairs ?? 0,
			unassignedPairs: params.coverageTotals?.unassignedPairs ?? 0,
			totalPairs: params.coverageTotals?.totalPairs ?? 0,
		}),
		[params.coverageTotals],
	);

	const shortage = useMemo(
		() => buildSubjectShortage({
			subjects: params.subjects,
			sections: params.sections,
			savedOwnershipMap: params.savedOwnershipMap,
			pendingOwnershipMap: params.pendingOwnershipMap,
			placeholderFacultyIds: params.placeholderFacultyIds,
			activeFacultyIds: params.activeFacultyIds,
		}),
		[
			params.subjects,
			params.sections,
			params.savedOwnershipMap,
			params.pendingOwnershipMap,
			params.placeholderFacultyIds,
			params.activeFacultyIds,
		],
	);

	const shortageLine = useMemo(
		() => buildShortageLineModel({
			entries: shortage.entries,
			dataDateLabel: formatShortageDataDate(params.fetchedAt),
		}),
		[params.fetchedAt, shortage.entries],
	);

	const isLive = !isTeachingLoadSourceDegraded({
		dataSource: params.dataSource,
		isOnline: params.isOnline,
		dataSourceNotice: params.degradedNotice,
	}) && shortageLine.visible.length > 0;

	const cover = useCoverShortage({
		schoolId: params.schoolId,
		schoolYearId: params.activeSchoolYearId,
		subjects: params.subjects,
		sectionMap: params.sectionMap,
		scopeKey: params.scopeKey,
	});

	return {
		staffingFigures,
		shortage,
		shortageLine,
		/** Whether row 2 should CLAIM the shortage rather than withhold it. */
		isLive,
		/** The subject the cover dialog opens on: the worst, by class count. */
		primarySubject: shortage.entries[0] ?? null,
		cover,
	};
}
