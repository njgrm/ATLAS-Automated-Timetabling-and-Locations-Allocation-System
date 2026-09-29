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
import { SIMPLE_HEADER_MESSAGE_LIMIT, type SimpleHeaderMessage } from '@/components/timetable/simple/SimpleHeaderMessages';
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
	/**
	 * A2 HEADER-BUDGET (operator, 2026-09-29) — the ONE derivation of which run is
	 * on screen. It is passed IN, already derived by the header from
	 * `describeRunState`, and rendered here as the run identity. Nothing is
	 * re-derived: this component reads the same values the badge and
	 * `RunIdentityLine` read, so a run cannot be named two different ways on one
	 * screen.
	 *
	 * CORRECTION 2 (F1, 2026-09-29) — `visibility` is NO LONGER RENDERED here. It
	 * stays in the TYPE on purpose: the header passes the whole `describeRunState`
	 * result, so the band cannot drift from the badge by receiving a re-derived
	 * half of it, and the type keeps saying "this is one derivation, not two
	 * arguments". The band deliberately ignores the field, and the F1 comment in
	 * the JSX records why the restatement was deleted rather than reworded.
	 */
	runState?: {
		/** `null` for a pre-generation workspace or an empty grid — nothing to name. */
		sentence: string | null;
		/** Accepted, not rendered. See the F1 note above. */
		visibility: string | null;
	};
	/**
	 * The EXCEPTIONAL notices — the ones that are not the status chip's business,
	 * built by the header's own `buildSimpleHeaderMessages` and handed over with
	 * every `data-testid` intact. `[]` renders nothing.
	 *
	 * A2 HEADER-BUDGET — the setup-blocked paragraph
	 * (`timetable-curriculum-readiness-message`) is deliberately NOT in this list:
	 * §8 gives the header one status chip, that chip's label is now the short
	 * `N setup items to fix`, and the technical diagnostic behind it is the chip
	 * control's `@/ui` Tooltip. The header filters that one id out rather than
	 * this component knowing about it.
	 *
	 * OPTIONAL, WITH A SAFE DEFAULT. `runState` and `messages` were introduced
	 * required, which made this shared component throw at render for ANY caller that
	 * predates them — the base `TimetableSimpleHeader` is exactly such a caller, and
	 * it crashed at `reading 'sentence'`. A shared surface that is handed props by two
	 * generations of caller must degrade to "say nothing", not throw: the band's whole
	 * contract is that it renders NOTHING when it has nothing to say, so an absent
	 * `runState` is just the nothing case.
	 */
	messages?: readonly SimpleHeaderMessage[];
	/**
	 * The unverified-term-authority sentence, or `null`. The header already
	 * computes it with `resolveTermAuthorityNotice`; passing the value keeps one
	 * derivation. `null` renders nothing.
	 */
	termAuthorityNotice?: string | null;
};

/**
 * A2 HEADER-BUDGET — ONE calm line under the header box: which run is on screen,
 * whether anyone can see it, and the exceptional notices.
 *
 * WHY IT IS A SIBLING OF `<header>` AND NOT A THIRD ROW: §8's "Header budget"
 * rule caps the header BOX at two calm rows, and this content used to be inside
 * that box, which is how a header reached seven bands. It adds NO control, it
 * renders NOTHING when it has nothing to say, and it carries no `truncate`: §8
 * forbids a sentence cut off with an ellipsis, so a long notice wraps here rather
 * than disappearing at 1366 px.
 */
function SimpleHeaderStatusBand({
	runState,
	messages,
	termAuthorityNotice,
}: {
	/**
	 * NOT optional here, even though the parent prop is. The parent DEFAULTS these
	 * (`{ sentence: null, visibility: null }` and `[]`), so by the time the band sees
	 * them they are always present — which is what keeps the band's own body free of
	 * `undefined` checks while still making the parent safe for an older caller.
	 */
	runState: { sentence: string | null; visibility: string | null };
	messages: readonly SimpleHeaderMessage[];
	termAuthorityNotice: string | null;
}) {
	/**
	 * A2 HEADER-BUDGET, correction 2 (F1, 2026-09-29) — `sentence` ALONE decides
	 * whether the band has a run to name.
	 *
	 * This used to be `sentence != null || visibility != null`, because the band
	 * rendered BOTH sentences. It no longer does (see the JSX below), and the OR
	 * would now be a latent bug: `runStateKeyOf` returns `null` visibility for
	 * exactly the two keys whose sentence is also `null` (`planning` and `empty`),
	 * so `visibility != null` IMPLIES a run exists, which implies
	 * `runStateSentence` returned a sentence (`RunStateBadge.tsx:94-100` against
	 * `timetable-plain-language.ts:325-330`). The OR is therefore dead, and if it
	 * ever came alive it would paint an EMPTY band rather than say nothing.
	 */
	const hasIdentity = runState.sentence != null;
	// The cap is the SAME `SIMPLE_HEADER_MESSAGE_LIMIT` the in-header list used, and
	// the remainder is still COUNTED rather than silently dropped.
	const shown = messages.slice(0, SIMPLE_HEADER_MESSAGE_LIMIT);
	const hidden = messages.length - shown.length;
	if (!hasIdentity && shown.length === 0 && !termAuthorityNotice) return null;
	const toneClass = (tone: SimpleHeaderMessage['tone']) => tone === 'danger'
		? 'text-red-700'
		: tone === 'warning'
			? 'text-amber-800'
			: tone === 'good'
				? 'text-emerald-800'
				: 'text-muted-foreground';
	return (
		<div
			role="status"
			aria-live="polite"
			data-testid="timetable-simple-status-band"
			className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/60 bg-muted/20 px-3 py-1 text-xs"
		>
			{runState.sentence != null ? (
				<span data-testid="timetable-run-identity" className="text-muted-foreground">
					<span className="font-semibold text-foreground">State:</span> {runState.sentence}
				</span>
			) : null}
			{/* A2 HEADER-BUDGET, CORRECTION 2 (F1 + F2, 2026-09-29) — ONE sentence
			    about the run, and a REAL separator before the term notice.

			    THE DEFECT, in the reviewer's words on the rendered 1366×768 state B:
			    "State: Draft — teachers and students cannot see it yet. (Run 321) in
			    grey is followed 14px later, with no separator and no line break, by
			    bold `Draft — not visible to teachers until you publish`. Same fact,
			    same strip, said twice. It reads as one run-on sentence with a font
			    change in the middle." §11's design gate scores that as a FAIL on "one
			    status per fact", and the operator's own complaint was two elements
			    claiming the same thing, so the disease had simply moved.

			    F1 — WHICH OF THE TWO SURVIVES, AND WHY. `runState.sentence` survives;
			    `runState.visibility` is deleted from this band. Both come from the ONE
			    `describeRunState` call (`RunStateBadge.tsx:103`) and both derive from
			    the same `runStateKeyOf`, so they are the same fact by construction:
			    - `sentence`      = "Draft — teachers and students cannot see it yet. (Run 321)"
			    - `visibility`    = "Draft — not visible to teachers until you publish"
			    The surviving sentence EARNITS its place on a ground the other cannot
			    reach: it carries the RUN NUMBER, and #41 (the screen must name the run
			    it is showing) is accepted committed behaviour. The number is the one
			    thing here a scheduler can act on — it is what `History 3` lists — and
			    after the run number the sentence also states the CONSEQUENCE, which is
			    what a mouse-first scheduler needs from a state word. `visibility` in
			    this band is pure restatement with nothing added, and it is the
			    WORDIER of the two.

			    WHY DELETING IT HERE LOSES NOTHING, AND IS NOT A REWORD. The OTHER
			    surface that renders `timetable-draft-visibility` — `DraftVisibilityState`
			    inside `TimetableDraftStateStrip`, used by the EXPERT header — is
			    untouched, and `a2-c11-draft-actions.test.tsx:173,239` still assert its
			    copy byte-for-byte. In the SIMPLE header that strip is rendered with
			    `visibility={null}` (`SimpleHeaderDraftActions.tsx`), so the run's
			    audience was already stated in exactly one place after this change: the
 band's `sentence`.

			    F2 — THE SEPARATOR. The amber term notice is a DIFFERENT fact about a
			    different thing (term authority, not draft visibility), and
			    `text-amber-800` made it read as the tail of the draft sentence. The
			    container's `gap-x-2` was not enough, because 8 px of white space is a
			    pause, not a boundary. This is a visible middot in its own span: it is
			    `aria-hidden` (a screen reader reads the two facts, not a bullet),
			    `select-none`, at 60% muted foreground so it is quieter than either
			    sentence, and it carries `px-1` so the band reads as "A · B" rather than
			    as one clause with a mark in it. Its own `data-testid` is what the
			    correction-2 row reads, so this separator is asserted, not assumed. */}
			{runState.sentence != null && termAuthorityNotice ? (
				<span
					aria-hidden="true"
					data-testid="timetable-status-band-separator"
					className="select-none px-1 text-muted-foreground/60"
				>
					·
				</span>
			) : null}
			{termAuthorityNotice ? (
				<span data-testid="timetable-term-authority-unverified" className="text-amber-800">
					{termAuthorityNotice}
				</span>
			) : null}
			{shown.map((message) => (
				<span key={message.id} data-testid={message.id} className={`font-medium ${toneClass(message.tone)}`}>
					{message.text}
				</span>
			))}
			{hidden > 0 ? (
				<span data-testid="timetable-status-messages-more" className="text-muted-foreground">
					and {hidden} more
				</span>
			) : null}
		</div>
	);
}

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
	runState = { sentence: null, visibility: null },
	messages = [],
	termAuthorityNotice = null,
}: SimpleHeaderTrailingSurfacesProps) {
	return (
		<>
			{swapClassTimesMode != null ? (
				<TimetableSwapClassTimesBanner mode={swapClassTimesMode} onCancel={() => onSwapClassTimesCancel?.()} />
			) : null}
			{/* A2 HEADER-BUDGET — the ONE calm line that used to be bands 1, 5 and 6 of
			    the operator's seven-band header. It renders nothing when it has nothing
			    to say, and it adds no control. */}
			<SimpleHeaderStatusBand runState={runState} messages={messages} termAuthorityNotice={termAuthorityNotice} />
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
