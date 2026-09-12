/**
 * TT-OUTPUT-C03R3 — Canonical per-term schedule resolution.
 *
 * An academic term is the authoritative scope of a schedule. The constructor
 * produces COMPACT base entries: a year-long subject is one entry per physical
 * weekly session (no term identity), and a rotating family is one compact lane
 * whose `metadata.modularAssignments[]` names the term-specific member/teacher
 * for each ordered term. Neither carries a complete per-term schedule.
 *
 * The former pipeline coerced a missing term identity to Term 1
 * (`normalizeTermIndex` in `generation.service.ts`) and distributed a rotating
 * lane's weekly sessions across its member terms by cycling
 * (`sessionTermIndex = modularTermCycle[session % cycle]`). Both behaviors are
 * wrong under the ordered-term contract:
 *
 *   - a year-long subject must contribute its FULL weekly session count in
 *     every applicable term (never only Term 1);
 *   - a rotating family member must contribute its FULL weekly session count in
 *     its own ordered term (never a 2/2/1 split across terms).
 *
 * This module replaces the ambiguous fallback with EXPLICIT resolved per-term
 * entries computed before validation and persistence. Every base slot expands
 * into one resolved entry per applicable ordered term, each with a numeric
 * `termIndex`, a unique stable `entryId`, and a shared `sourceEntryId` that
 * links equivalent placements across terms. The resolved entries drop the
 * compact `modularAssignments` metadata so downstream effective-resource
 * expansion treats every term entry as a first-class, term-scoped reservation.
 *
 * No I/O. Pure and deterministic.
 */

import type { ScheduledEntry } from './constraint-validator.js';

export interface OrderedTermRef {
	identity: string;
	order: number;
	displayLabel?: string;
}

/**
 * A resolved schedule entry: one physical placement bound to exactly one
 * ordered term. `termIndex` is required and numeric; `sourceEntryId` is the
 * stable identity of the base slot it was expanded from.
 */
export type ResolvedPerTermEntry = Omit<ScheduledEntry, 'termIndex'> & {
	termIndex: number;
	sourceEntryId: string;
	/** True when this entry came from a rotating-family compact lane. */
	fromRotatingFamily: boolean;
};

export interface ResolvePerTermOptions {
	/**
	 * Resolve a rotating-family member's `subjectCode` (carried by the compact
	 * `modularAssignments` row) to its real Subject id. Without the map the
	 * family's primary subject id is retained, which cannot express the
	 * term-specific member.
	 */
	subjectIdByCode?: ReadonlyMap<string, number>;
}

export interface PerTermResolutionIssue {
	code: 'MISSING_TERM_IDENTITY' | 'INVALID_TERM_CONTRACT';
	message: string;
	entryId?: string;
	termIndex?: number;
}

export class PerTermResolutionError extends Error {
	readonly code: PerTermResolutionIssue['code'];
	readonly details: Record<string, unknown>;

	constructor(issue: PerTermResolutionIssue) {
		super(issue.message);
		this.name = 'PerTermResolutionError';
		this.code = issue.code;
		this.details = { ...issue };
	}
}

function assertValidTermContract(terms: readonly OrderedTermRef[]): OrderedTermRef[] {
	if (terms.length === 0) {
		throw new PerTermResolutionError({
			code: 'INVALID_TERM_CONTRACT',
			message: 'A per-term schedule cannot be resolved without at least one ordered term.',
		});
	}
	const sorted = [...terms].sort((a, b) => a.order - b.order);
	for (let index = 0; index < sorted.length; index += 1) {
		if (!Number.isInteger(sorted[index].order) || sorted[index].order !== index + 1) {
			throw new PerTermResolutionError({
				code: 'INVALID_TERM_CONTRACT',
				message: `Ordered terms must be contiguous positive integers starting at 1; received order ${sorted[index].order} at position ${index}.`,
			});
		}
		if (!sorted[index].identity || sorted[index].identity.trim().length === 0) {
			throw new PerTermResolutionError({
				code: 'INVALID_TERM_CONTRACT',
				message: `Ordered term ${index + 1} is missing its identity.`,
			});
		}
	}
	return sorted;
}

/**
 * The term scope of an entry for conflict purposes: an explicit ordered term
 * index, or 0 meaning "unscoped / year-round" (overlaps every term). The former
 * behavior treated a missing term as Term 1; the shared `entryTermScope` helper
 * (from `effective-scheduled-resources`) treats a missing term as all-term
 * scope, and the resolver removes missing-term entries entirely.
 */

function resolveModularSubjectId(
	entry: ScheduledEntry,
	subjectCode: string,
	options: ResolvePerTermOptions,
): number {
	return options.subjectIdByCode?.get(subjectCode) ?? entry.subjectId;
}

function stripModularMetadata(entry: ScheduledEntry): ScheduledEntry['metadata'] {
	if (!entry.metadata) return entry.metadata;
	const { modularAssignments: _drop, ...rest } = entry.metadata;
	return rest;
}

/**
 * Expand compact base entries into explicit resolved per-term entries.
 *
 * - A compact rotating-family lane expands into ONE entry per
 *   `metadata.modularAssignments` row, taking that row's term, subject, and
 *   teacher; the physical slot (room/day/time/section) is shared across terms.
 * - A base entry with an explicit ordered `termIndex` (e.g. a retained/locked
 *   placement) stays in exactly that term.
 * - Any other base entry (a year-long subject session) expands into ONE entry
 *   for EVERY ordered term with the same subject/teacher/room.
 *
 * Every resolved entry has a unique `entryId` (`<source>::t<term>`) and shares
 * the base slot's `sourceEntryId`.
 */
export function resolvePerTermScheduleEntries(
	entries: readonly ScheduledEntry[],
	terms: readonly OrderedTermRef[],
	options: ResolvePerTermOptions = {},
): ResolvedPerTermEntry[] {
	const orderedTerms = assertValidTermContract(terms);
	const termByOrder = new Map(orderedTerms.map((term) => [term.order, term]));
	const resolved: ResolvedPerTermEntry[] = [];

	for (const entry of entries) {
		const modular = entry.metadata?.modularAssignments;
		if (Array.isArray(modular) && modular.length > 0) {
			const assignments = [...modular].sort((a, b) => a.termIndex - b.termIndex);
			for (const assignment of assignments) {
				const term = termByOrder.get(assignment.termIndex);
				if (!term) {
					throw new PerTermResolutionError({
						code: 'MISSING_TERM_IDENTITY',
						message: `Rotating-family assignment for entry ${entry.entryId} names term ${assignment.termIndex}, which is outside the verified ordered-term contract.`,
						entryId: entry.entryId,
						termIndex: assignment.termIndex,
					});
				}
				resolved.push({
					...entry,
					entryId: `${entry.entryId}::t${term.order}`,
					sourceEntryId: entry.entryId,
					termIndex: term.order,
					subjectId: resolveModularSubjectId(entry, assignment.subjectCode, options),
					facultyId: assignment.facultyId,
					metadata: stripModularMetadata(entry),
					fromRotatingFamily: true,
				});
			}
			continue;
		}

		const explicitTerm = typeof entry.termIndex === 'number'
			&& Number.isInteger(entry.termIndex)
			&& termByOrder.has(entry.termIndex)
			? entry.termIndex
			: null;
		const applicableOrders = explicitTerm != null ? [explicitTerm] : orderedTerms.map((term) => term.order);
		for (const order of applicableOrders) {
			resolved.push({
				...entry,
				entryId: explicitTerm != null ? entry.entryId : `${entry.entryId}::t${order}`,
				sourceEntryId: entry.entryId,
				termIndex: order,
				metadata: stripModularMetadata(entry),
				fromRotatingFamily: false,
			});
		}
	}

	return resolved;
}

export interface ResolvedUnassignedItem {
	sectionId: number;
	subjectId: number;
	gradeLevel: number;
	session: number;
	reason: string;
	termIndex: number;
	[k: string]: unknown;
}

/**
 * Give every unassigned item an explicit ordered term. A refusal that already
 * names a term stays in that term; a year-long refusal (missing term) expands
 * into one actionable item per ordered term instead of being coerced to Term 1.
 */
export function resolvePerTermUnassignedItems<T extends object>(
	items: readonly T[],
	terms: readonly OrderedTermRef[],
): Array<T & { termIndex: number }> {
	const orderedTerms = assertValidTermContract(terms);
	const validOrders = new Set(orderedTerms.map((term) => term.order));
	const resolved: Array<T & { termIndex: number }> = [];
	for (const item of items) {
		const rawTerm = (item as { termIndex?: number | null }).termIndex;
		const explicit = typeof rawTerm === 'number' && validOrders.has(rawTerm) ? rawTerm : null;
		const orders = explicit != null ? [explicit] : orderedTerms.map((term) => term.order);
		for (const order of orders) {
			resolved.push({ ...item, termIndex: order });
		}
	}
	return resolved;
}

/** Selected-term projection over resolved entries; excludes any other term. */
export function resolvedEntriesForTerm(
	entries: readonly Pick<ResolvedPerTermEntry, 'termIndex'>[],
	termIndex: number,
): Array<Pick<ResolvedPerTermEntry, 'termIndex'>> {
	return entries.filter((entry) => entry.termIndex === termIndex);
}

export interface CanonicalTermSessionLine {
	subjectId: number;
	sectionId: number;
	termIndex: number;
	sessionsPerWeek: number;
}

/**
 * Fail-closed conservation check: every canonical `(subject, section, term)`
 * demand line contributes exactly its weekly session count to the resolved
 * per-term schedule, with no dropped, duplicated, or term-misassigned entry.
 */
export function assertResolvedPerTermParity(
	resolved: readonly Pick<ResolvedPerTermEntry, 'subjectId' | 'sectionId' | 'termIndex' | 'sourceEntryId'>[],
	canonical: readonly CanonicalTermSessionLine[],
): void {
	const expected = new Map<string, number>();
	let expectedTotal = 0;
	for (const line of canonical) {
		const key = `${line.subjectId}:${line.sectionId}:${line.termIndex}`;
		expected.set(key, (expected.get(key) ?? 0) + line.sessionsPerWeek);
		expectedTotal += line.sessionsPerWeek;
	}

	const actual = new Map<string, number>();
	for (const entry of resolved) {
		const key = `${entry.subjectId}:${entry.sectionId}:${entry.termIndex}`;
		actual.set(key, (actual.get(key) ?? 0) + 1);
	}

	for (const [key, expectedCount] of expected.entries()) {
		const actualCount = actual.get(key) ?? 0;
		if (actualCount !== expectedCount) {
			throw new PerTermResolutionError({
				code: 'MISSING_TERM_IDENTITY',
				message: `Resolved per-term parity mismatch for ${key}: expected ${expectedCount} weekly sessions, resolved ${actualCount}.`,
			});
		}
	}
	for (const [key, actualCount] of actual.entries()) {
		if (!expected.has(key)) {
			throw new PerTermResolutionError({
				code: 'MISSING_TERM_IDENTITY',
				message: `Resolved per-term schedule produced an unverified opportunity ${key} with ${actualCount} sessions.`,
			});
		}
	}
	const resolvedTotal = resolved.length;
	if (resolvedTotal !== expectedTotal) {
		throw new PerTermResolutionError({
			code: 'MISSING_TERM_IDENTITY',
			message: `Resolved per-term session total ${resolvedTotal} does not equal canonical derived-demand session total ${expectedTotal}.`,
		});
	}
}

/** Detect the former T1 coercion: no resolved entry may carry a synthetic term. */
export function assertNoImplicitTermDefault(
	baseEntries: readonly Pick<ScheduledEntry, 'entryId' | 'termIndex'>[],
	resolved: readonly Pick<ResolvedPerTermEntry, 'sourceEntryId' | 'termIndex'>[],
	terms: readonly OrderedTermRef[],
): void {
	const termCount = terms.length;
	const baseById = new Map(baseEntries.map((entry) => [entry.entryId, entry]));
	for (const entry of resolved) {
		const base = baseById.get(entry.sourceEntryId);
		// A base entry without its own term must have expanded to EVERY term.
		if (base && (base.termIndex == null)) {
			const termsForSource = new Set(
				resolved.filter((candidate) => candidate.sourceEntryId === entry.sourceEntryId).map((candidate) => candidate.termIndex),
			);
			if (termsForSource.size !== termCount) {
				throw new PerTermResolutionError({
					code: 'MISSING_TERM_IDENTITY',
					message: `Base entry ${entry.sourceEntryId} has no term authority and must expand to all ${termCount} ordered terms; resolved ${termsForSource.size}.`,
				});
			}
		}
	}
}
