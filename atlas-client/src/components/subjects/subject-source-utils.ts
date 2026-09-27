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

/**
 * A3-C5-4: the operator-facing reading of a Subject-mutation failure.
 *
 * Seven sites on the Subjects route toasted `err?.response?.data?.message`
 * verbatim (Subjects.tsx coverage/save/archive/reactivate,
 * DeleteSubjectDialog.tsx preview/apply). The fallback text those sites supply
 * is fine; the SERVER string is the defect. `subject.service.ts` authors
 * engineer prose for a scheduler to read — "schedulingDisposition is deferred
 * scheduling authority (PENDING_DERIVED_DEMAND_INTEGRATION) and cannot be set
 * through Subject CRUD: …", "minMinutesPerWeek must be a positive number.",
 * "Cannot modify protected fields: isSeedable, isSystemManaged." A field name
 * and a constant name are not operator language.
 *
 * The server files are OUT OF THIS STREAM'S FENCE and are not edited, exactly
 * as in A3-C4's `resolveTermAuthorityCopy`. The client keys calm copy off the
 * `code` it already receives, in the same two-part description/nextAction tone,
 * and hands the raw code and the raw sentence back to the caller so
 * `SubjectMutationDetailPopover` can keep the diagnostic reachable behind a
 * `@/ui` affordance (AGENTS.md §8 forbids a bare `title=`).
 *
 * THE FALLBACK IS THE LOAD-BEARING RULE. An unrecognised code — and a missing
 * code, and a non-HTTP failure with no response body at all — resolves to
 * SUBJECT_MUTATION_FALLBACK, which is a fixed constant and contains no
 * interpolation of any kind. A resolver that fell back to `rawMessage` here
 * would have fixed nothing: today an unmapped error is precisely how an
 * engineer string reaches the operator's screen, so a fallback that echoes the
 * server sentence would reproduce the exact defect it was written to close.
 * The raw text is never destroyed either — it leaves through `rawMessage`.
 *
 * The five ALREADY-PLAIN codes keep the server's own sentence as their
 * `description` verbatim. They are not rewritten: they are already operator
 * language, and re-authoring them would be a second, divergent truth for a
 * string the server already gets right.
 */
export type SubjectMutationErrorCopy = {
	/** Calm operator sentence. Never contains a server-authored string. */
	description: string;
	/** What the operator should actually do next. */
	nextAction: string;
	/** `description` + `nextAction`, for the one-line surfaces (toasts). */
	message: string;
	/** The raw server code, or null. Diagnostic only — never rendered bare. */
	code: string | null;
	/** The raw server sentence, verbatim. Diagnostic only. */
	rawMessage: string;
};

type SubjectMutationCopyPair = { description: string; nextAction: string };

/**
 * Keyed on CODE, never on message text, for the same reason
 * `TERM_AUTHORITY_COPY` is: one code emits several sentences
 * (`INVALID_MIN_MINUTES_PER_WEEK` alone emits "…must be a positive number."
 * and "…must be a positive integer up to 2147483647.") and they all mean one
 * thing to a scheduler.
 */
const SUBJECT_MUTATION_COPY: Readonly<Record<string, SubjectMutationCopyPair>> = {
	// --- Already-plain server strings. Kept VERBATIM as the description. ---
	// atlas-server/src/services/subject.service.ts:505, subject.router.ts:84
	NOT_FOUND: {
		description: 'Subject not found.',
		nextAction: 'Close this screen, reload the subject list, and open the subject again.',
	},
	// subject.service.ts:508, subject-delete-dependencies.service.ts:93
	CROSS_SCHOOL_DENIED: {
		description: 'Subject belongs to another school.',
		nextAction: 'This subject is not part of your school catalog. Refresh the catalog, or ask a school administrator to add it.',
	},
	// subject.service.ts:513, :942, :1023
	STALE_WRITE: {
		description: 'Subject was modified by another user. Refresh and retry.',
		nextAction: 'Your change was not written — close and reopen the subject to load the newer version, then make your change again.',
	},
	// subject.service.ts:992
	ALREADY_ARCHIVED: {
		description: 'Subject is already archived.',
		nextAction: 'No change was needed. The subject is already out of the active catalog.',
	},
	// subject.service.ts:992
	ALREADY_ACTIVE: {
		description: 'Subject is already active.',
		nextAction: 'No change was needed. The subject is already in the active catalog.',
	},

	// --- Engineer strings the server authors for a scheduler, not an operator. ---
	// subject.service.ts:699
	PROTECTED_SCHEDULING_DISPOSITION: {
		description: 'This subject carries a scheduling setting that ATLAS maintains for you, so it cannot be changed here.',
		nextAction: 'Leave that setting alone. If it must change, ask a school administrator to review the scheduling setup.',
	},
	// subject.service.ts:709, :1669
	PROTECTED_TERM_AUTHORITY: {
		description: 'The school year and term settings for this subject come from the enrolment system, so they cannot be changed here.',
		nextAction: 'Update the school year and terms in the enrolment system, then refresh this page.',
	},
	// subject.service.ts:720
	PROTECTED_FIELD: {
		description: 'This subject has a setting that ATLAS maintains for you, so it cannot be changed here.',
		nextAction: 'Edit the other subject details. If the protected setting must change, ask a school administrator.',
	},
	// subject.service.ts:730
	UNKNOWN_FIELD: {
		description: 'ATLAS received a subject setting it does not recognise.',
		nextAction: 'Close and reopen the subject, then save again. If it keeps failing, contact your ATLAS administrator.',
	},
	// subject.service.ts:617, :620
	INVALID_MIN_MINUTES_PER_WEEK: {
		description: 'Weekly minutes must be a whole number greater than zero.',
		nextAction: 'Enter the number of teaching minutes per week again, then save.',
	},
	// subject.service.ts:495, :858, :970 — "subjectId must be a positive integer."
	INVALID_PARAM: {
		description: 'ATLAS could not read which subject this request was for.',
		nextAction: 'Close this screen, reopen the subject, and try again.',
	},
	// subject.service.ts:498, subject.router.ts:281
	SCHOOL_SCOPE_REQUIRED: {
		description: 'ATLAS could not confirm which school this request belongs to.',
		nextAction: 'Sign in again with your school account, then try again.',
	},
	// subject.service.ts:745 — "name must be a non-empty string."
	INVALID_SUBJECT_NAME: {
		description: 'The subject name cannot be empty.',
		nextAction: 'Enter a subject name, then save.',
	},
	// subject.service.ts:750, :754
	INVALID_GRADE_LEVELS: {
		description: 'The grade levels for this subject are not valid.',
		nextAction: 'Choose at least one grade level, using only Grades 7 to 10, then save.',
	},
	// subject.service.ts:763
	INVALID_ROOM_TYPE: {
		description: 'The preferred room type is not one ATLAS recognises.',
		nextAction: 'Choose a room type from the list, then save.',
	},
	// subject.service.ts:771, :775
	INVALID_PROGRAM_SCOPES: {
		description: 'The program scopes for this subject are not valid.',
		nextAction: 'Choose a program scope from the list, or clear the selection, then save.',
	},
	// subject.service.ts:784, :788, :894
	INVALID_INTER_SECTION_GRADES: {
		description: 'The shared class grade levels for this subject are not valid.',
		nextAction: 'Choose shared class grade levels from the grade levels already set on this subject, then save.',
	},
	// subject.service.ts:811, :817
	INVALID_FIELD_TYPE: {
		description: 'One of the settings for this subject was not in the expected format.',
		nextAction: 'Close and reopen the subject, check the values you changed, and save again.',
	},
	// subject.service.ts:822
	INVALID_QUALIFICATION_PRIORITY: {
		description: 'The qualification priority for this subject is not one ATLAS recognises.',
		nextAction: 'Choose a qualification priority from the list, then save.',
	},
	// subject.service.ts:827
	INVALID_TERM_METADATA: {
		description: 'The modular setting for this subject is not valid.',
		nextAction: 'Close and reopen the subject, clear the modular setting, and save again.',
	},
	// subject.service.ts:868, :980
	INVALID_VERSION: {
		description: 'ATLAS could not read the version of this subject that your change was based on.',
		nextAction: 'Close and reopen the subject so ATLAS loads the current version, then make your change again.',
	},
	// subject.router.ts:286
	VERSION_REQUIRED: {
		description: 'ATLAS needs the current version of this subject to change it safely.',
		nextAction: 'Close and reopen the subject so ATLAS loads the current version, then try again.',
	},
	// subject.router.ts:290
	FINGERPRINT_REQUIRED: {
		description: 'The deletion check for this subject did not finish, so the subject was not deleted.',
		nextAction: 'Run the deletion check again, then confirm the deletion.',
	},
};

/**
 * The unmapped-code, missing-code and no-response-body answer. A FIXED constant
 * with no interpolation — see the load-bearing rule above. It must never
 * incorporate `rawMessage`.
 */
const SUBJECT_MUTATION_FALLBACK: SubjectMutationCopyPair = {
	description: 'ATLAS could not complete that subject change.',
	nextAction: 'Check the school connection, then try again. If it keeps failing, contact your ATLAS administrator.',
};

/**
 * A3-C5-4: resolve calm operator copy for a Subject-mutation failure.
 *
 * @param payload The error response body the server sent (`err?.response?.data`),
 *   or a loose `{ message }` object. `null`/`undefined` is the ordinary
 *   network-failure case and is handled, not thrown.
 */
export function resolveSubjectMutationErrorCopy(
	payload: { code?: unknown; message?: unknown } | null | undefined,
): SubjectMutationErrorCopy {
	const code = typeof payload?.code === 'string' ? payload.code.trim() : '';
	const rawMessage = typeof payload?.message === 'string' ? payload.message.trim() : '';
	const mapped = code ? SUBJECT_MUTATION_COPY[code] : undefined;
	const base = mapped ?? SUBJECT_MUTATION_FALLBACK;
	return {
		description: base.description,
		nextAction: base.nextAction,
		message: `${base.description} ${base.nextAction}`,
		code: code || null,
		rawMessage,
	};
}
