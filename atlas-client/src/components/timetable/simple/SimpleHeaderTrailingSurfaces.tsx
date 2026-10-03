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
 * ── A7 c14 (operator, 2026-09-30 08:15) — THE STATUS BAND MOVED ─────────────
 * This file used to ALSO render `SimpleHeaderStatusBand`: the run identity, the
 * unverified-term notice and the capped messages, as a third sibling of
 * `</header>`. The operator's 08:15 instruction caps the header area above the
 * grid at ONE control row plus ONE status line, so that band no longer lives
 * here: its body is now `SimpleHeaderStatusLine` in
 * `simple/SimpleHeaderStatusLine.tsx`, rendered as the header's own second band
 * (`data-testid="timetable-simple-status-line"`). What stays here is only the
 * chrome that must NOT be part of that box: the armed-swap banner and the
 * portal-mounted generation-blocker sheet. No state, handler or wiring moved
 * with the band — see the new file for the record of what it carries.
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
 * ── WHAT IS NOT PROVEN HERE ─────────────────────────────────────────────────
 * Nothing in a JSDOM test can measure a 1366×768 pixel row count; JSDOM has no
 * layout engine. A true PIXEL measurement at 1366×768 is a BROWSER row and is
 * owned by Lane C on A4's release, not by this repository's test suite.
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
 * header's box is the row plus the status line and nothing else. The order is
 * load-bearing: the armed-swap band is the one surface that PAINTS, so it comes
 * first, and the blocker sheet is portal-mounted and paints nothing while closed.
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
