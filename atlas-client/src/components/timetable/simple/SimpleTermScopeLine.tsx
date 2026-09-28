/**
 * A2-C6-TRUTH (T3b/T3c) — ONE line for the term, and it says what it knows.
 *
 * The live measurement, 2026-09-28, Simple view: a chip in the app shell read
 * `Active Term: T2` while the stored term authority was
 * `{"source":"atlas-unverified","verified":false,"activeTerm":null,"termIndex":null,…}`.
 * A chip that names a term the system has not verified is the failure class of
 * #44 and #57, and the term is also the one control the scheduler actually
 * filters on — so "one fact, one place" is not tidiness here, it is the fix.
 *
 * TWO FACTS, ONE LINE, AND NEITHER IS INVENTED:
 *
 *   - what the scheduler is VIEWING — always known, it is the selector's value;
 *   - what term the SCHOOL is in — known only from a VERIFIED ordered term
 *     (`verified === true` and the index is present in `orderedTerms`).
 *
 * When the authority is unverified the line says so in those words and offers no
 * term name, which is the state the live run was in. The app shell's separate
 * `Active Term:` chip is removed by the same change: two controls for one fact,
 * one of which cannot see the authority the timetable filters on.
 */

import { resolveTermAuthorityNotice } from '@/hooks/useTimetableData';
import type { ActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';

export type TermScopeViewing = 'all' | number;

export type TermScopeLineInput = {
	/** The term selector's own value — the truth about what is on screen. */
	viewing: TermScopeViewing;
	/** The label the selector prints for the viewed term. */
	viewingLabel: string;
	/** The school-year context that carries the term authority. */
	schoolYearContext: ActiveSchoolYearContext | null | undefined;
	/** Whether a run is on screen, which decides the unverified-authority wording. */
	hasScheduleOnScreen: boolean;
};

/**
 * The verified active term, or `null`.
 *
 * The `verified === true` requirement is the whole point: the durable contract
 * carries `orderedTerms` even when it is unverified, so reading the label from
 * `orderedTerms` alone would print a term the system never confirmed. This is
 * the same derivation `AppShell` and the Expert orientation strip already use.
 */
export function verifiedActiveTermLabel(
	schoolYearContext: ActiveSchoolYearContext | null | undefined,
): string | null {
	const activeTerm = schoolYearContext?.activeTerm;
	if (!activeTerm || activeTerm.verified !== true) return null;
	const termIndex = activeTerm.termIndex;
	if (termIndex == null || !Number.isFinite(termIndex)) return null;
	const ordered = activeTerm.orderedTerms ?? [];
	if (!ordered.some((term) => term.order === termIndex)) return null;
	return ordered.find((term) => term.order === termIndex)?.displayLabel ?? `Term ${termIndex}`;
}

/**
 * The whole line, as the two facts it asserts.
 *
 * Returned as parts rather than one string so the caller can bold the viewing
 * term and keep the school-side clause plain — and so a test can assert each
 * fact without depending on the joiner.
 */
export function termScopeLineParts(input: TermScopeLineInput): {
	viewing: string;
	schoolSide: string;
	activeTermVerified: boolean;
} {
	const activeTermLabel = verifiedActiveTermLabel(input.schoolYearContext);
	return {
		viewing: input.viewing === 'all' ? 'Viewing all terms' : `Viewing ${input.viewingLabel}`,
		schoolSide: activeTermLabel === null
			? 'active term not confirmed'
			: `school is in ${activeTermLabel}`,
		activeTermVerified: activeTermLabel !== null,
	};
}

/** The one sentence both facts make. */
export function termScopeLine(input: TermScopeLineInput): string {
	const parts = termScopeLineParts(input);
	return `${parts.viewing} · ${parts.schoolSide}`;
}

/**
 * The rendered line, plus the unverified-authority notice when the term the
 * timetable is actually filtering on could not be confirmed.
 *
 * The notice is the pre-existing `resolveTermAuthorityNotice` sentence, reused
 * rather than reworded: it already distinguishes "no data to show" from "data
 * shown on an unconfirmed term", and inventing a second wording for one fact is
 * how the two drifted apart in the first place.
 */
export function SimpleTermScopeLine({
	context,
	termFilter,
	termOptions,
	viewingLabel,
	hasScheduleOnScreen,
}: {
	context: ScheduleReviewWorkspaceHeaderContext;
	termFilter: TermScopeViewing;
	termOptions: ReadonlyArray<{ value: string; label: string }>;
	viewingLabel: string;
	hasScheduleOnScreen: boolean;
}) {
	const parts = termScopeLineParts({
		viewing: termFilter,
		viewingLabel,
		schoolYearContext: context.schoolYearContext,
		hasScheduleOnScreen,
	});
	const notice = parts.activeTermVerified
		? null
		: resolveTermAuthorityNotice(context.schoolYearContext, hasScheduleOnScreen);
	return (
		/* A2 C12 / ITEM 1 — ONE LINE AT 1366. This line is the widest thing in the
		 * status region, and it carries THREE facts: what the scheduler is viewing,
		 * what term the school is in, and the unverified-authority notice. Wrapping
		 * any of them is what pushed the status region past one visual line, so from
		 * `lg` up the line does not wrap and each part truncates instead. Below `lg`
		 * it is unchanged, so the narrow/390 px shape is untouched. */
		<span className="flex min-w-0 flex-wrap items-baseline gap-1 text-xs text-muted-foreground lg:flex-nowrap" data-testid="timetable-term-scope-line">
			<span className="min-w-0 lg:truncate">
				<span className="font-semibold text-foreground">Term:</span> {parts.viewing}
			</span>
			<span aria-hidden="true">·</span>
			<span className="min-w-0 lg:truncate" data-term-authority={parts.activeTermVerified ? 'verified' : 'unverified'}>{parts.schoolSide}</span>
			{/* The notice is the ELASTIC part: `lg:flex-1` hands it whatever the
			 * sibling parts do not need, so the amber sentence is what gives up width
			 * rather than the two short facts beside it. */}
			{notice ? <span className="min-w-0 text-amber-800 lg:min-w-0 lg:flex-1 lg:truncate" data-testid="timetable-term-authority-unverified">{notice}</span> : null}
		</span>
	);
}
