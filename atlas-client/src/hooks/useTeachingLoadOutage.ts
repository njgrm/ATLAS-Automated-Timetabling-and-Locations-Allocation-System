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
 * A6 c7 — THE GATE THAT WAS TWO QUESTIONS, SPLIT BACK IN TWO.
 *
 * A6 c5 exported ONE name, `isLive`, and it answered both "are these figures
 * CONFIRMED?" and "should this surface RENDER?". Conflating them is what put
 * c5's whole surface on the floor in staging: Lane C's Codex walk of train 7
 * (`docs/reviews/codex-staging-train7-e9ddda71/report.md`, MAJOR line 24) saw
 * only the generic `25 classes still need a real teacher.` — no per-subject line,
 * no `Cover these classes` — because staging's source was `cached`, so a
 * SOURCE-FRESHNESS predicate answered a VISIBILITY question. A scheduler whose
 * roster is the saved one is precisely the scheduler who most needs to be told
 * which classes have no teacher.
 *
 * The two questions are now two names, and neither pretends to be the other:
 *
 *  - `figuresVerified` — `!isTeachingLoadSourceDegraded({...})`, the predicate
 *    UNCHANGED. It is still the one answer to "are these figures confirmed?", and
 *    the header, the repair queue and this hook still share it.
 *  - `hasShortageToShow` — `shortageLine.visible.length > 0`. The claim is
 *    renderable whenever classes lack a teacher, from the saved roster as much as
 *    from the live one.
 *
 * WHERE THE SAFETY WENT, and why this is not a regression. c5's gate was
 * protecting a real property — a cover plan computed from a stale snapshot must
 * not be applied to a changed one — and that property is NOT restored by hiding
 * the button. It is restored by `CoverShortageDialog`'s existing `drift` re-check
 * at apply time, which the server performs against the live snapshot and which
 * already 409s with the changed classes named. Hiding the button protected
 * nothing that the drift check does not protect, and cost a scheduler the only
 * attributable figure on the screen. Honesty is preserved by QUALIFYING the
 * action in its own tooltip, not by removing it.
 *
 * `isLive` no longer exists as a name, in either branch: a name that said "live"
 * on a surface that deliberately renders from the last saved roster would lie,
 * and the name is how the two questions got fused in the first place.
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
			// The row's head clause is the WORKSPACE's figure, not the sum of the
			// subjects it had room to name — see `buildShortageLineModel`.
			totalShortClasses: shortage.totalShortClasses,
			dataDateLabel: formatShortageDataDate(params.fetchedAt),
		}),
		[params.fetchedAt, shortage.entries, shortage.totalShortClasses],
	);

	// A6 c7: TWO questions, TWO names. `figuresVerified` is the unchanged
	// freshness predicate and is still the shared answer to "are these figures
	// confirmed?". `hasShortageToShow` is the separate answer to "is there
	// something a scheduler needs to be told?" — and a saved roster is still a
	// roster, so it does not make the answer go away.
	const figuresVerified = !isTeachingLoadSourceDegraded({
		dataSource: params.dataSource,
		isOnline: params.isOnline,
		dataSourceNotice: params.degradedNotice,
	});
	const hasShortageToShow = shortageLine.visible.length > 0;

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
		/** Whether the source is CONFIRMED. Qualifies the claim; never gates it. */
		figuresVerified,
		/** Whether classes lack a teacher — the only question that shows the line. */
		hasShortageToShow,
		/** The subject the cover dialog opens on: the worst, by class count. */
		primarySubject: shortage.entries[0] ?? null,
		cover,
	};
}
