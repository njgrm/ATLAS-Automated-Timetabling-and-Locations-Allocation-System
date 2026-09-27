import type { AdminSourceState } from '@/components/admin-workspace/AdminWorkspace';
import type { TermAuthority } from '@/types';

export function resolveSubjectSourceCopy(sourceState: AdminSourceState) {
	return {
		description:
			sourceState === 'verified-live'
				? 'ATLAS is showing the saved subject catalog for this school.'
			: sourceState === 'checking-source'
				? 'ATLAS is loading the subject catalog for this school.'
			: sourceState === 'saved-data'
				? 'ATLAS is showing the saved subject catalog for this school.'
				: 'ATLAS could not load a usable subject catalog.',
		nextAction:
			sourceState === 'verified-live'
				? 'Open coverage for subjects with risk, or add a subject if the catalog is missing one.'
			: sourceState === 'checking-source'
				? 'Wait for the catalog to load before making curriculum changes.'
			: sourceState === 'saved-data'
				? 'Add a subject if the catalog is missing one, or open coverage for subjects at risk.'
				: 'Check the school connection, then retry loading the catalog.',
	};
}

/**
 * A3-C4: the operator-facing reading of an EnrollPro term-authority state.
 *
 * The `message` on a `TermAuthority` is SERVER-AUTHORED prose written for
 * engineers — "Saved term contract failed its semantic revision check." It is
 * rendered by this client but authored in
 * `atlas-server/src/services/enrollpro-term-contract.service.ts`, which is
 * outside this stream's fence and is NOT edited. Instead the client keys calm
 * copy off the `code` it already receives, in the same two-part
 * description/nextAction tone as `resolveSubjectSourceCopy` above, and keeps
 * the raw code and the raw message for the diagnostic affordance.
 *
 * The mapping is deliberately keyed on CODE, not on message text. The server
 * emits six distinct sentences under the single `TERM_CACHE_INVALID` code
 * (enrollpro-term-contract.service.ts:439-482); all six mean the same thing to
 * an operator — the saved term contract cannot be trusted — so one sentence is
 * honest for the whole class and does not have to be re-derived per sentence.
 *
 * An unrecognised code falls back to a calm generic reading rather than
 * surfacing the raw sentence, because the raw sentence is the defect.
 */
type TermAuthorityCopy = { description: string; nextAction: string };

const TERM_AUTHORITY_COPY: Readonly<Record<string, TermAuthorityCopy>> = {
	TERM_CACHE_INVALID: {
		description: 'ATLAS could not confirm the saved school year and terms, so it is not using them.',
		nextAction: 'Refresh the term data from EnrollPro, then try again before scheduling into a term.',
	},
	TERM_CACHE_SCHOOL_MISMATCH: {
		description: 'The saved school year and terms belong to a different school, so ATLAS is not using them.',
		nextAction: 'Refresh the term data for this school from EnrollPro.',
	},
	TERM_CACHE_YEAR_MISMATCH: {
		description: 'The saved school year and terms belong to a different school year, so ATLAS is not using them.',
		nextAction: 'Refresh the term data for this school year from EnrollPro.',
	},
	TERM_CACHE_READ_FAILED: {
		description: 'ATLAS could not read the saved school year and terms.',
		nextAction: 'Refresh the term data from EnrollPro, then try again.',
	},
	TERM_YEAR_NOT_MIRRORED: {
		description: 'This school year is not an active EnrollPro mirror, so ATLAS has no terms for it.',
		nextAction: 'Mirror the school year from EnrollPro before scheduling into a term.',
	},
	ENROLLPRO_UNREACHABLE: {
		description: 'ATLAS could not reach EnrollPro to re-check the school year and terms.',
		nextAction: 'Check the school connection, then refresh the term data.',
	},
	ENROLLPRO_ACTIVE_TERM_UNREACHABLE: {
		description: 'ATLAS could not reach EnrollPro to confirm which term is active.',
		nextAction: 'Check the school connection, then refresh the term data.',
	},
	ENROLLPRO_ACTIVE_TERM_UNAVAILABLE: {
		description: 'EnrollPro did not confirm which term is active, so ATLAS is using the ordered terms only.',
		nextAction: 'Wait for the school connection to recover, then refresh the term data.',
	},
	ACTIVE_TERM_UNRESOLVED: {
		description: 'EnrollPro has no term covering today, so ATLAS is showing the ordered terms without an active one.',
		nextAction: 'Check the school year dates with the registrar before scheduling into a term.',
	},
	TERM_AUTHORITY_STALE: {
		description: 'The school year and terms changed in EnrollPro after ATLAS last read them.',
		nextAction: 'Refresh the term data so ATLAS is scheduling against the current terms.',
	},
	TERM_AUTHORITY_MISSING: {
		description: 'ATLAS has no school year and terms for this school yet.',
		nextAction: 'Refresh the term data from EnrollPro to load the school year and its terms.',
	},
};

const TERM_AUTHORITY_FALLBACK: TermAuthorityCopy = {
	description: 'ATLAS could not confirm the school year and terms it needs for scheduling.',
	nextAction: 'Check the school connection, then refresh the term data from EnrollPro.',
};

/**
 * Resolve calm operator copy for a term-authority state. A healthy
 * `VERIFIED_LIVE` state is routine and already has its own compact line, so it
 * resolves to an empty description and the caller keeps that line.
 */
export function resolveTermAuthorityCopy(
	termAuthority: TermAuthority | null,
): { description: string; nextAction: string; code: string | null } {
	if (!termAuthority) return { description: '', nextAction: '', code: null };
	if (termAuthority.state === 'VERIFIED_LIVE') {
		return { description: '', nextAction: '', code: termAuthority.code ?? null };
	}
	const code = (termAuthority.code ?? '').trim();
	const mapped = code ? TERM_AUTHORITY_COPY[code] : undefined;
	const base = mapped ?? TERM_AUTHORITY_FALLBACK;
	return { description: base.description, nextAction: base.nextAction, code: code || null };
}
