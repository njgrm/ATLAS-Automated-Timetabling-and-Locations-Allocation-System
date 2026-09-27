/**
 * teaching-load-labels — the ONE canonical source for Teaching Load status
 * copy, owned by the A3 (Planner A3, non-timetable UI/UX) stream.
 *
 * WHY THIS FILE EXISTS
 *
 * Walkthrough 5/4, item 10: the Teaching Load page mixed three different ways
 * of saying "this teacher is under the hours standard" — the two-word
 * "Below standard", a bare "% OF STANDARD", and the unrelated "wide span". A
 * user could not tell whether two controls were filtering the same thing, so
 * the vocabulary, not the code, was the defect.
 *
 * THE DECISION: the below-standard status label is the single word
 *
 *     "Under"
 *
 * Rationale, so a later reader does not re-open it on taste:
 *
 *  - It is ONE plain word. No jargon, no second word to parse.
 *  - It carries the meaning the two-word form carried: this teacher has fewer
 *    teaching hours than the standard.
 *  - Nothing is lost to the shortening. The standard itself is still stated
 *    where it matters, in the surrounding help/guidance copy that already
 *    existed ("below the 20h standard", "can take more classes (up to the
 *    20h standard)"). The label names the state; the help text numbers it.
 *  - The companion words stay symmetrical: "At standard" and "Excess teaching
 *    load" are unchanged, so the three facets still read as one set.
 *
 * WHAT THIS IS DELIBERATELY NOT
 *
 *  - It is NOT applied to "Wide span". "Wide span" is about a SUBJECT SPAN
 *    (how many distinct sections/subjects a teacher carries), not about hours.
 *    Same-looking, different question. Collapsing it into "Under" would make
 *    the page actively wrong. It is left alone on purpose, and
 *    `a3-c4-draft-truth.test.tsx` B4 pins that it survives.
 *  - It is NOT a rename of the underlying status VALUE. The wire/domain
 *    discriminants stay `'below-standard'`; only the user-visible LABEL is
 *    one word. Renaming the discriminant would churn every consumer,
 *    every test, and every filter parameter for no user benefit.
 *
 * WHY IT LIVES IN ITS OWN MODULE
 *
 * The canonical label was previously inlined in several places, and the one
 * place that is genuinely canonical for it
 * (`components/faculty/FacultyRow.tsx`, `getFacultyLoadPresentation`) belongs
 * to a DIFFERENT stream's fence. A shared, importable constant is what lets
 * the owning lane adopt this in one line later, and what lets a control prove
 * the in-fence surfaces actually use the constant rather than a copied
 * literal that can drift again.
 */

/**
 * The canonical one-word label for the below-standard load status.
 *
 * Pinned deliberately: a test asserts this is exactly `"Under"` and that it
 * contains no whitespace, so a future edit that re-adds a second word fails
 * loudly rather than silently shipping mixed vocabulary again.
 */
export const BELOW_STANDARD_LABEL = 'Under';

/** The sibling facet labels, kept beside it so the three read as one set. */
export const AT_STANDARD_LABEL = 'At standard';
export const EXCESS_LOAD_LABEL = 'Excess teaching load';
