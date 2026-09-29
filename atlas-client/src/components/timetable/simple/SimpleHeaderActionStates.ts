/* ------------------------------------------------------------------ *
 * UX-QUICKFIX-C01 — visible Generate/Publish dispatch guards.
 *
 * A8-C5 (2026-09-29): EXTRACTED from `SimpleHeaderHelpers.tsx`, which this
 * change pushed to 1007 physical lines and AGENTS.md section 8 caps at 1000.
 * The rule says to EXTRACT a block, never to delete a comment to make room, so
 * the whole guard block moved here with its comments intact.
 *
 * Every importer path is UNCHANGED: `SimpleHeaderHelpers` re-exports all five
 * names, and every caller in the tree (TimetableSimpleHeader.tsx, and the
 * a2-c11-draft-actions, a2-c13-unavailable-generate, schedule-clarity-c03 and
 * ux-quickfix-c01-header-actions suites) imports them from there. This is the
 * same shape the file already used for `SimpleHeaderReadinessTypes.ts`, whose
 * own note says the component signature and every importer path are unchanged.
 *
 * WHY THIS BLOCK AND NOT ANOTHER. It is the only self-contained unit in the file:
 * pure functions over a plain argument object, with no JSX, no React import and
 * no dependency on anything else declared above them. Moving it removes ~94
 * physical lines and changes no behaviour.
 * ------------------------------------------------------------------ */

export type SimpleHeaderActionState = {
	disabled: boolean;
	reason: string | null;
	/**
	 * A2 C13 (item 3c) — the SAME reason in ≤ 6 words, printed BESIDE the disabled
	 * control so the reason is visible on screen and not hover-only.
	 *
	 * It is produced by the SAME resolver call that produces `reason` (and, for a
	 * capability gate, by the same `denied()` call in `timetable-capabilities.ts`),
	 * so the two cannot drift: there is no second place either string is written.
	 * §8 forbids truncating a sentence to fit, so every short form is authored.
	 */
	shortReason: string | null;
};

/**
 * The single guard behind the visible Generate control. A closed generation
 * gate must dispatch zero requests, so the click handler reads this decision
 * before it calls `context.handleTriggerGenerate()`.
 */
export function shouldDispatchSimpleGenerate(canPlanOrGenerate: boolean): boolean {
	return canPlanOrGenerate;
}

/**
 * The single guard behind the visible Publish control. A closed publication
 * gate (including an already-published run) must dispatch zero requests.
 */
export function shouldDispatchSimplePublish(publicationEnabled: boolean, isRunPublished: boolean): boolean {
	return publicationEnabled && !isRunPublished;
}

/**
 * A2 C13 (item 3c) — the last-resort short form.
 *
 * It is a FALLBACK for a gate that declared no `shortReason`, and it is written
 * here rather than derived from `reason` because §8 forbids cutting a sentence to
 * fit. `a2-c13-unavailable-generate.test.tsx` asserts that every generation and
 * publication gate with a reason also carries a short form, which makes this
 * branch unreachable in production and keeps it honest rather than clever.
 */
const GENERATE_SHORT_FALLBACK = 'Generation is not available';
const PUBLISH_SHORT_FALLBACK = 'Publishing is not available';

export function resolveSimpleGenerateActionState(input: {
	canPlanOrGenerate: boolean;
	loading: boolean;
	generating: boolean;
	gateReason: string | null;
	/** A2 C13 — the gate's own short form, carried beside its full reason. */
	gateShortReason?: string | null;
}): SimpleHeaderActionState {
	if (input.canPlanOrGenerate) {
		// A8-C5 S2.3: the control is ENABLED here, but the cause is still
		// announced. Generate is no longer disabled for an unverified check — it
		// opens the dialog that explains it — so returning `reason: null` would
		// leave a screen-reader user with a bare "Generate schedule" and no way to
		// learn what the dialog is about to tell them.
		//
		// Nothing is rendered beside the button: `SimpleGenerateAction` shows the
		// visible short sentence only for a DISABLED control, and wears the solid
		// primary variant when enabled. So the reason reaches the accessible name
		// and nothing else — which is the "less on screen" rule, not an exception
		// to it.
		return { disabled: false, reason: input.gateReason ?? null, shortReason: null };
	}
	if (input.generating) return { disabled: true, reason: 'A generation run is already in progress.', shortReason: 'A generation run is in progress' };
	if (input.loading) return { disabled: true, reason: 'The timetable is still loading.', shortReason: 'The schedule is still loading' };
	return {
		disabled: true,
		reason: input.gateReason ?? 'Generation is not available for this school year yet.',
		shortReason: input.gateShortReason ?? GENERATE_SHORT_FALLBACK,
	};
}

export function resolveSimplePublishActionState(input: {
	publicationEnabled: boolean;
	isRunPublished: boolean;
	gateReason: string | null;
	/** A2 C13 — the gate's own short form, carried beside its full reason. */
	gateShortReason?: string | null;
}): SimpleHeaderActionState {
	if (input.isRunPublished) return { disabled: true, reason: 'This timetable is already published.', shortReason: 'Already published' };
	if (input.publicationEnabled) return { disabled: false, reason: null, shortReason: null };
	return {
		disabled: true,
		reason: input.gateReason ?? 'Publishing is not available for this run yet.',
		shortReason: input.gateShortReason ?? PUBLISH_SHORT_FALLBACK,
	};
}
