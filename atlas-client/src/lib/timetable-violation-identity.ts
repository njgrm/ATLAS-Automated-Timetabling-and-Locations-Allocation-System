/**
 * A2 mc, S2 — resolve a violation's real section and subject from the run's own
 * entries, so a warning row stops reading `Unknown section · Unknown subject`.
 *
 * THE DEFECT, MEASURED. `simplePublishReadiness.ts` and
 * `simple/SimpleTaskDrawerHelpers.tsx` both read
 *
 *   v.entities.sectionId != null ? sectionLabel(v.entities.sectionId) : 'Unknown section'
 *
 * and `buildSectionLabel` / `buildSubjectLabel`
 * (`lib/timetable-reference-labels.ts:28,61`) resolve by the real numeric primary
 * key and never return `Unknown section`. So the literal on screen meant exactly
 * one thing: THE VIOLATION CARRIES NO `sectionId` AND NO `subjectId`.
 *
 * `atlas-server/src/services/constraint-validator.ts` emits exactly that shape for
 * several codes — `entities: { facultyId, day, entryIds }` with no section or
 * subject (lines 824, 1009, 1018, 1040, 1073, 1179, 1194, 1246). The client
 * already holds the evidence: `Violation.entities.entryIds` names the run's
 * entries, and every entry carries `sectionId` and `subjectId`.
 *
 * So this module resolves the identity from the violation's OWN entries, and when
 * nothing resolves it degrades to a sentence that says what is MISSING in the
 * operator's words — never the word `Unknown`, and never a raw id (AGENTS.md P4;
 * A3 c16 owns no-codes-on-screen).
 */

export type ViolationIdentityEntry = {
	entryId: string;
	sectionId?: number | null;
	subjectId?: number | null;
	facultyId?: number | null;
};

export type ViolationIdentitySource = {
	code: string;
	entities: {
		sectionId?: number;
		subjectId?: number;
		facultyId?: number;
		entryIds?: string[];
	};
};

export type ViolationEntityIdentity = {
	sectionId: number | null;
	subjectId: number | null;
	facultyId: number | null;
	/** Which of the two derivations produced it — recorded for the control. */
	from: 'entities' | 'entries' | 'none';
};

/** The honest fallback. It says what is missing; it never says `Unknown`. */
export const NO_SECTION_ON_RECORD = 'No section on this record';
export const NO_SUBJECT_ON_RECORD = 'No subject on this record';

/**
 * Resolve `sectionId` / `subjectId` / `facultyId` for a violation.
 *
 * Precedence: the violation's own entities win; a gap is filled from the FIRST
 * entry named in `entities.entryIds` that carries the missing field. "First in
 * `entryIds` order" is the stated tie-break — a row that names one real class of
 * a conflict is better than a row that names neither, and it says nothing false.
 */
export function resolveViolationEntityIdentity(
	violation: ViolationIdentitySource,
	entries: readonly ViolationIdentityEntry[] | null | undefined,
): ViolationEntityIdentity {
	const own = violation.entities ?? {};
	const named = new Map((entries ?? []).map((entry) => [entry.entryId, entry] as const));
	const inOrder = (own.entryIds ?? [])
		.map((id) => named.get(id))
		.filter((entry): entry is ViolationIdentityEntry => entry != null);

	const pick = (ownId: number | undefined, field: 'sectionId' | 'subjectId' | 'facultyId'): number | null => {
		if (typeof ownId === 'number') return ownId;
		for (const entry of inOrder) {
			const value = entry[field];
			if (typeof value === 'number') return value;
		}
		return null;
	};

	const sectionId = pick(own.sectionId, 'sectionId');
	const subjectId = pick(own.subjectId, 'subjectId');
	const facultyId = pick(own.facultyId, 'facultyId');

	const from: ViolationEntityIdentity['from'] = own.sectionId != null && own.subjectId != null
		? 'entities'
		: sectionId != null || subjectId != null
			? 'entries'
			: 'none';

	return { sectionId, subjectId, facultyId, from };
}

/**
 * The rendered pair of labels for a violation row.
 *
 * A label is rendered only when an id resolved; otherwise the honest
 * missing-fact sentence is used. A resolver that cannot name a class is never
 * asked to invent one, so a `Section #<n>` from a caller's own resolver is that
 * caller's surface (A2 c15 / A3 c16), not this module's.
 */
export function violationRowLabels(
	violation: ViolationIdentitySource,
	entries: readonly ViolationIdentityEntry[] | null | undefined,
	resolvers: {
		sectionLabel: (id: number) => string;
		subjectLabel: (id: number) => string;
	},
): { sectionLabel: string; subjectLabel: string; identity: ViolationEntityIdentity } {
	const identity = resolveViolationEntityIdentity(violation, entries);
	return {
		sectionLabel: identity.sectionId != null ? resolvers.sectionLabel(identity.sectionId) : NO_SECTION_ON_RECORD,
		subjectLabel: identity.subjectId != null ? resolvers.subjectLabel(identity.subjectId) : NO_SUBJECT_ON_RECORD,
		identity,
	};
}
