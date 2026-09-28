/**
 * A3-C9: the Subjects "Term" filter, derived from the real rotation data on
 * `Subject`.
 *
 * WHY A DERIVATION AND NOT A CONSTANT. The ordered term contract is
 * EnrollPro-owned (`TermAuthority.contract.terms`), and the number of terms in a
 * school year is not a client constant. A hard-coded `['Term 1','Term 2',
 * 'Term 3']` would silently contradict a two-term or four-term contract and
 * would offer a term that no subject belongs to. So the option list is built
 * from the subjects actually on screen, and a term option exists only when at
 * least one subject carries it.
 *
 * THE FOUR KINDS OF OPTION, and why all four are needed.
 *
 * - `all`      — no term narrowing. Always present, and it is the ONLY option
 *                that can match a subject whose rotation term was never set.
 * - `term`     — one per distinct rotation term found in the data.
 * - `rotating` — a subject that runs in MORE THAN ONE term (`rotationTermGroupId`
 *                is set, or `rotationTermCount` says more than one). This is the
 *                "which subjects rotate" question, which no single term option
 *                can answer.
 * - `unset`    — a subject with NO rotation term at all. Without it such a
 *                subject would be reachable only by "All terms", so choosing a
 *                term could never bring it back: an operator who filtered to
 *                Term 1 and then asked "where are the subjects with no term?"
 *                would be told "there are none", which is a lie. It is emitted
 *                ONLY when such a subject exists, so the list never grows an
 *                option that matches nothing.
 *
 * MATCHING IS BY KEY, NOT BY LABEL. A subject's term key is its `rotationTermRank`
 * when the server gave a positive integer rank, else its `rotationTermIdentity`,
 * else a normalised copy of its `rotationTermLabel`. Two subjects both saying
 * "Term 1" by different routes therefore still group together, and no option
 * is ever built from a label the data does not actually carry.
 */

import type { Subject } from '@/types';

export const TERM_FILTER_ALL = 'all';
export const TERM_FILTER_ROTATING = 'rotating';
export const TERM_FILTER_UNSET = 'unset';

export type TermFilterOptionKind = 'all' | 'term' | 'rotating' | 'unset';

export type TermFilterOption = {
	value: string;
	label: string;
	kind: TermFilterOptionKind;
};

/** The rotation fields the filter reads. Narrowed so a test can pass a literal. */
export type RotationTermLike = Pick<
	Subject,
	| 'rotationTermIdentity'
	| 'rotationTermRank'
	| 'rotationTermLabel'
	| 'rotationTermGroupId'
	| 'rotationTermCount'
>;

function trimmed(value: string | null | undefined): string {
	return (value ?? '').trim();
}

/** A positive integer rank is the one rotation field the server guarantees order for. */
function rankOf(subject: RotationTermLike): number | null {
	const rank = subject.rotationTermRank;
	return typeof rank === 'number' && Number.isInteger(rank) && rank > 0 ? rank : null;
}

/** The comparable key a subject is grouped and matched by. `null` = no term set. */
export function subjectRotationTermKey(subject: RotationTermLike): string | null {
	const rank = rankOf(subject);
	if (rank != null) return `rank:${rank}`;

	const identity = trimmed(subject.rotationTermIdentity);
	if (identity) return `identity:${identity}`;

	const label = trimmed(subject.rotationTermLabel);
	if (label) return `label:${label.toLowerCase()}`;

	return null;
}

/** The human label for a key's term, taken from the data, never invented. */
function termLabel(subject: RotationTermLike): string {
	const explicit = trimmed(subject.rotationTermLabel);
	if (explicit) return explicit;

	const rank = rankOf(subject);
	if (rank != null) return `Term ${rank}`;

	return trimmed(subject.rotationTermIdentity);
}

/**
 * Does this subject run in more than one term?
 *
 * `rotationTermGroupId` is the server's marker for "this subject belongs to a
 * rotation group", and `rotationTermCount > 1` states the same fact as a count.
 * Either one is enough; a group with a single term is not a rotation.
 */
export function isRotatingSubject(subject: RotationTermLike): boolean {
	if (trimmed(subject.rotationTermGroupId)) return true;

	const count = subject.rotationTermCount;
	return typeof count === 'number' && Number.isFinite(count) && count > 1;
}

/**
 * Build the option list for the given subjects.
 *
 * Terms are ordered by `rotationTermRank` where the data provides one, and
 * otherwise keep the order the catalog returned them in — so a contract that
 * supplies no rank is still shown in a stable, meaningful sequence rather than
 * an arbitrary one.
 */
export function buildTermFilterOptions(subjects: readonly RotationTermLike[]): TermFilterOption[] {
	const byKey = new Map<string, TermFilterOption>();
	const rankByKey = new Map<string, number>();
	const terms: TermFilterOption[] = [];
	let hasRotating = false;
	let hasUnset = false;

	for (const subject of subjects) {
		if (isRotatingSubject(subject)) hasRotating = true;

		const key = subjectRotationTermKey(subject);
		if (key == null) {
			hasUnset = true;
			continue;
		}
		if (byKey.has(key)) continue;

		byKey.set(key, { value: key, label: termLabel(subject), kind: 'term' });
		terms.push(byKey.get(key)!);
		const rank = rankOf(subject);
		if (rank != null) rankByKey.set(key, rank);
	}

	// `Array.prototype.sort` is stable, so ranking the terms that carry a rank
	// ahead of the rest keeps the catalog's own order as the tie-break.
	terms.sort((left, right) => {
		const leftRank = rankByKey.get(left.value) ?? Number.POSITIVE_INFINITY;
		const rightRank = rankByKey.get(right.value) ?? Number.POSITIVE_INFINITY;
		return leftRank - rightRank;
	});

	const options: TermFilterOption[] = [{ value: TERM_FILTER_ALL, label: 'All terms', kind: 'all' }];
	options.push(...terms);
	if (hasRotating) options.push({ value: TERM_FILTER_ROTATING, label: 'Rotates by term', kind: 'rotating' });
	if (hasUnset) options.push({ value: TERM_FILTER_UNSET, label: 'No term set', kind: 'unset' });
	return options;
}

/** Does this subject belong in the filtered list? `value` is a `TermFilterOption.value`. */
export function matchesTermFilter(subject: RotationTermLike, value: string): boolean {
	if (value === TERM_FILTER_ALL) return true;
	if (value === TERM_FILTER_ROTATING) return isRotatingSubject(subject);
	if (value === TERM_FILTER_UNSET) return subjectRotationTermKey(subject) === null;
	return subjectRotationTermKey(subject) === value;
}
