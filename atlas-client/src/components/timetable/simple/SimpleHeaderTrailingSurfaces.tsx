/**
 * A2 C12 / ITEM H — the two surfaces that are SIBLINGS of the Simple header box.
 *
 * ── WHAT THIS FILE IS ───────────────────────────────────────────────────────
 * Lane C measured the Simple header in a real browser at 1366×768, in the
 * operator's own state (a resolved run, 3 must-fix, 145 advisories, term
 * authority unverified), and found SEVEN text bands / 204 px against an accepted
 * target of at most TWO rows. The structural work was already done — one status
 * strip plus one control row in `timetable-simple-header-row` — and the four
 * surplus bands came from surfaces that were still rendered INSIDE the
 * `<header>` element. Two of them were the armed-swap band and its own `Cancel`.
 *
 * THE OPERATOR'S INSTRUCTION, verbatim: "move blocker sheet and swap banner out
 * of the header box". These are those two surfaces, now rendered immediately
 * after `</header>` as siblings in the workspace's own flex column.
 *
 * ── WHY A FILE AT ALL, RATHER THAN A MOVE INSIDE THE HEADER ────────────────
 * `TimetableSimpleHeader.tsx` was at 971 physical lines against the AGENTS.md §8
 * 1000-line cap, and the move left it at 993 - under the cap, but with only seven
 * lines of headroom for the next slice in this file. A record this size does not
 * belong in those last seven lines, and §8's answer for that is to EXTRACT A
 * SUB-COMPONENT, never to delete a comment. This is that sub-component: it is one
 * coherent unit (the header's own non-row chrome, rendered after the box), it owns
 * no state, and every prop is already derived one layer up. It is also the honest
 * home for the record of what moved and why.
 *
 * ── WHAT DID NOT MOVE ───────────────────────────────────────────────────────
 *  - NO STATE. `blockerSheetOpen` / `setBlockerSheetOpen`, `swapClassTimesMode`
 *    and `onSwapClassTimesCancel` all stay in `TimetableSimpleHeader`. The header
 *    remains the logical owner of both surfaces; only their JSX position changed.
 *  - NO HANDLER. `onRetry` is still the workspace's own `handleRefresh`, and the
 *    banner's Cancel is still the single swap reset (C11 M4).
 *  - NO WIRING. `open` / `onOpenChange` / `diagnostic` are threaded through
 *    untouched, and `diagnostic` is still the same conditional expression.
 *  - NO CONTROL LOST. The blocker sheet still has no trigger and is entered from
 *    the EXISTING merged warnings control, so the ≤6 visible-control cap and the
 *    exactly-one-solid-primary rule (DRAFT-UX-C01) are unchanged.
 *
 * ── WHAT IS STILL IN THE HEADER, AND WHY ───────────────────────────────────
 * The print dialog, the export-settings dialog, the unassigned-insertion
 * workflow, the tutorial dialog and the publish-readiness sheet remain children
 * of `<header>`. All five are portal-mounted or render nothing while closed, so
 * none of them is a band; `a2-c12-header-two-rows.test.tsx` asserts that on the
 * real rendered DOM rather than taking this comment's word for it.
 *
 * ── WHAT THE "blocker line" BAND ACTUALLY IS ───────────────────────────────
 * Established from the real code, not guessed: the band Lane C listed as "blocker
 * line" is the capped status-strip notice `timetable-curriculum-readiness-message`
 * — `simple/SimpleHeaderMessages.tsx:109` (the plain `<p>`) and
 * `simple/SimpleHeaderMessages.tsx:120` (the tooltip-wrapped variant), reached
 * from `simple/SimpleHeaderStatusStrip.tsx:107` via
 * `buildSimpleHeaderMessages({ setupBlockedDiagnostic })` at
 * `TimetableSimpleHeader.tsx`. It is a WRAPPED VISUAL LINE INSIDE row 1, not a
 * third child of the header element, so it is not moved out here: doing so would
 * delete a notice the DRAFT-UX-C01 contract requires, in the exact state
 * (unverified setup with a resolved run on screen) that most needs it.
 *
 * ── WHAT IS NOT PROVEN HERE ─────────────────────────────────────────────────
 * Nothing in a JSDOM test can measure a 1366×768 pixel row count; JSDOM has no
 * layout engine. A true PIXEL measurement at 1366×768 is a BROWSER row and is
 * owned by Lane C on A4's staging, not by this repository's test suite.
 */

import { SimpleGenerationBlockerSheet } from '@/components/timetable/simple/SimpleGenerationBlockerSheet';
import { TimetableSwapClassTimesBanner } from '@/components/timetable/TimetableSwapClassTimesBanner';
import type { TimetableGenerationReadinessDiagnostic } from '@/lib/timetable-generation-readiness';

export type SimpleHeaderTrailingSurfacesProps = {
	/**
	 * C11 M4 — the armed-swap mode. `null`/`undefined` renders no banner, exactly
	 * as the in-header `swapClassTimesMode != null` guard did.
	 */
	swapClassTimesMode?: 'select-first' | 'select-second' | null;
	/** The ONE swap reset. The banner's Cancel calls nothing else. */
	onSwapClassTimesCancel?: () => void;
	/** C2-a — the generation-blocker disclosure's open state. Owned by the header. */
	blockerSheetOpen: boolean;
	onBlockerSheetOpenChange: (open: boolean) => void;
	/** Null renders nothing; the header only opens this for a blocked state. */
	diagnostic: TimetableGenerationReadinessDiagnostic | null;
	/** Re-runs the readiness check in place. Never a no-op. */
	onRetry: () => void;
	labelForSection?: (id: number) => string;
	labelForSubject?: (id: number) => string;
};

/**
 * The header's own non-row chrome, rendered as a SIBLING of the `<header>` so the
 * header's box is the two rows and nothing else. The order is load-bearing: the
 * armed-swap band is the one surface that PAINTS, so it comes first, and the
 * blocker sheet is portal-mounted and paints nothing while closed.
 */
export function SimpleHeaderTrailingSurfaces({
	swapClassTimesMode,
	onSwapClassTimesCancel,
	blockerSheetOpen,
	onBlockerSheetOpenChange,
	diagnostic,
	onRetry,
	labelForSection,
	labelForSubject,
}: SimpleHeaderTrailingSurfacesProps) {
	return (
		<>
			{swapClassTimesMode != null ? (
				<TimetableSwapClassTimesBanner mode={swapClassTimesMode} onCancel={() => onSwapClassTimesCancel?.()} />
			) : null}
			<SimpleGenerationBlockerSheet
				open={blockerSheetOpen}
				onOpenChange={onBlockerSheetOpenChange}
				diagnostic={diagnostic}
				onRetry={onRetry}
				labelForSection={labelForSection}
				labelForSubject={labelForSubject}
			/>
		</>
	);
}
