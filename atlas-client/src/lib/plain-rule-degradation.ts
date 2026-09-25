/**
 * PLAIN-LANGUAGE-J2J3-C01 R1 (B1) — the ONE degradation rule, for EVERY
 * canonical code space, owned by a module neither label module imports.
 *
 * THE RULE, in three steps, and there is no fourth step:
 *
 *   1. ABSENT (`null` / `undefined` / empty / already the marker) renders the
 *      em-dash marker. Absent is NOT "unknown name": it says the server sent no
 *      value at all, and saying "this version of ATLAS has no name for it" about
 *      a value that was never sent is a false claim.
 *   2. KNOWN (a member of the canonical map) renders its plain label from that
 *      ONE map. There is no second label set for one status anywhere.
 *   3. UNMAPPED or OUT-OF-UNION (a newer server, a stored legacy row, a typo) is
 *      a value ATLAS cannot name, and it renders the honest shared sentence
 *      `UNLABELLED_RULE_SENTENCE` — NEVER a de-snake-cased engine token.
 *
 * WHY THIS IS A THIRD MODULE. `timetable-plain-language.ts` imports
 * `humaniseEngineToken` from `violation-presentation.ts`, so the sentence could
 * not be imported back from there without a cycle. That structural pressure is
 * what produced the defect this module closes: with no shared home, one range
 * reached for a de-snake-cased fallback and the SAME code then rendered two
 * different sentences on two surfaces — `"Excessive Travel Distance"` on the
 * right panel and the shared sentence in the publish-readiness warning group.
 * The rule therefore lives here, downstream of both label modules, and both
 * import it. Neither imports the other.
 *
 * WHY NEVER A DE-SNAKE-CASED TOKEN. `"faculty lunch window violation"` reads as a
 * broken sentence, looks like a typo the scheduler caused, and is
 * indistinguishable on screen from a genuine label. Worse, it is a FALSE claim
 * in the other direction too: ATLAS has no words for that rule *in this version*,
 * which is exactly what the shared sentence says and the de-snake-cased phrase
 * does not.
 *
 * `plainRuleValue` is the single implementation. Every resolver in this codebase
 * that has to degrade a canonical code — `resolveViolationTitle`,
 * `plainRoomDecisionStatus`, `plainRoomAppealStatus`, `plainGenerationRunStatus`,
 * the unassigned-reason badge and filter labels — routes through it, so the three
 * steps above cannot drift into three implementations.
 */

/**
 * The one plain sentence for a stored code this version has no words for. It is
 * used wherever a canonical label lookup misses.
 *
 * It deliberately does NOT de-snake-case the token: "faculty excessive idle gap"
 * reads as a broken sentence and looks like a typo the scheduler caused, whereas
 * this says plainly that ATLAS has no name for the rule and invites the honest
 * next step.
 *
 * Shared by the publish-readiness warning groups (`simplePublishReadiness`), the
 * block-repair banner (`TimetableSimpleHeader`), the blocker-repair dialog
 * (`SoftViolationConfirmDialog`), the right panel and rail resolvers, and the
 * plain-language resolvers, so those consumers cannot drift into two different
 * sentences for one gap.
 */
export const UNLABELLED_RULE_SENTENCE = 'A problem that this version of ATLAS does not have a name for yet.';

/**
 * The one "this value is genuinely absent" marker, matching the em dash the
 * surfaces already used. It is not an enum, so it is never in any map, and a map
 * that does contain it still degrades to the marker rather than rendering the
 * marker as though it were a label.
 */
export const ABSENT_VALUE_LABEL = '—';

/** The absent-value test the rule's step 1 depends on, in one place. */
function isAbsentValue(value: string | null | undefined): value is null | undefined | '' {
	return value == null || value === '' || value === ABSENT_VALUE_LABEL;
}

/**
 * THE ONE total degradation helper. `map` is the canonical plain-label map for
 * the code space; `label` projects a map entry to its plain words, so an
 * object-valued map can be read through one field instead of being restated as a
 * second label set.
 *
 * Total by construction: it never returns an empty string, never returns a raw
 * engine token, and never throws. That totality is what fixed the empty tooltip
 * heading in the right panel, and it is what makes the same code safe to render
 * from three different surfaces.
 */
export function plainRuleValue<T extends string, V>(
	map: Record<T, V>,
	value: string | null | undefined,
	label: (entry: V) => string,
): string {
	// Step 1 — ABSENT. The marker, not a word and not a claim about ATLAS.
	if (isAbsentValue(value)) return ABSENT_VALUE_LABEL;
	// Step 2 — KNOWN. The plain label from the ONE canonical map.
	const known = map[value as T];
	if (known !== undefined) return label(known);
	// Step 3 — UNMAPPED / OUT-OF-UNION. The honest shared sentence, never a
	// de-snake-cased token: a missing map entry is a defect in ATLAS, not
	// something the operator caused and not something to disguise as a name.
	return UNLABELLED_RULE_SENTENCE;
}

/**
 * The code-space-agnostic form of step 3, for a resolver that has already
 * consulted every map it owns (canonical plus retired wire codes) and found
 * nothing. Same three-step rule, reduced to its last step: absent still renders
 * the marker, so a caller can never get the sentence for a value that was never
 * sent.
 *
 * `humaniseEngineToken` is deliberately NOT used here. It stays exported and
 * unit-covered for free-form text (a `runType` a server operator can type), but a
 * value drawn from a canonical code space is not free-form text and must not be
 * de-snake-cased for the operator.
 */
export function degradeUnnamedRuleValue(value: string | null | undefined): string {
	return isAbsentValue(value) ? ABSENT_VALUE_LABEL : UNLABELLED_RULE_SENTENCE;
}
