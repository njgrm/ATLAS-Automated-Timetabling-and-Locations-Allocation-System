/**
 * LANE-C-PLAIN-LANGUAGE-C03 (J1) — one plain word for one idea, stated once.
 *
 * The 2026-09-26 audit (finding 3) found the same HARD problem rendered under
 * four different names on one screen — `Must fix` (grid), `Blocked` (grid
 * badge), `blocker` (header chip) and `Hard` (summary stat) — and three
 * different "hard" numbers with nothing saying they can legitimately differ. A
 * scheduler could read `0 Hard` in one place and `3 blockers` in another and
 * conclude the product contradicts itself.
 *
 * `MUST_FIX_LABEL` is the single plain word. It is already the grid's severity
 * sign and the C1 disclosure paragraph already speaks of a rule that "breaks",
 * so reusing it introduces no new vocabulary for an older scheduler to learn.
 *
 * The three counts are genuinely different measurements and are NOT merged by
 * this module: `blockingHardCount` is the allowlist-filtered,
 * publication-relevant count, `hardCount` is every HARD, and
 * `summary.hardViolationCount` is the run's recorded total.
 * `HARD_COUNT_RELATIONSHIP_NOTE` states that relationship once in plain words,
 * so any surface showing more than one of them explains itself. No new number
 * is introduced.
 */

/** The one plain word for "a problem that stops you saving and publishing". */
export const MUST_FIX_LABEL = 'Must fix';

/** `mustFixCountLabel(3)` -> `"3 Must fix"`. */
export function mustFixCountLabel(count: number): string {
	return `${count} ${MUST_FIX_LABEL}`;
}

/* The consequence sentences ("This blocks saving and publishing." / "This does
 * not block saving or publishing.") are deliberately NOT re-exported here: they
 * are already correct in the grid badge and the session details, they are the
 * best plain English on the surface, and a second copy of the same idea is the
 * exact hazard this module exists to remove (audit "protect this" 2). */

/**
 * Stated once, in plain words, on any surface that shows more than one "hard"
 * number. It names why the numbers differ (so a mismatch reads as deliberate
 * rather than contradictory) and what a zero in the first column means.
 */
export const HARD_COUNT_RELATIONSHIP_NOTE =
	'“Must fix” counts the problems that stop you saving and publishing. The total also counts '
	+ 'serious problems that do not stop publishing, so the total can be higher. '
	+ 'If “Must fix” is 0 but the total is not, the schedule can still be published.';

/**
 * Plain scope words. `run-wide` is the whole year's schedule, which is what
 * decides publication; a selected-term scope is only what one term shows.
 */
export function plainScopeLabel(scope: 'run-wide' | 'selected-term'): string {
	return scope === 'run-wide' ? 'Whole year' : 'Selected term only';
}

/**
 * J2 — a run is the one internal id a scheduler can legitimately act on, so it
 * is kept, but never presented as the label on its own. Where the run has a
 * date, that date is the human anchor; the bare number remains as the
 * disambiguating suffix rather than the heading.
 */
export function runAnchorLabel(runId: number | string, when?: string | null): string {
	const id = `schedule version #${runId}`;
	return when ? `${id} (${when})` : id;
}
