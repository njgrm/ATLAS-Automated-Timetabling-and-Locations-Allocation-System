import type { AdminSourceState } from '@/components/admin-workspace/AdminWorkspace';
import type { TermAuthority } from '@/types';
import { formatCatalogServedAt, type SubjectCatalogReceipt } from './subject-catalog-receipt';

/**
 * The source-state copy for the Subjects surface, carrying a REAL receipt.
 *
 * A8-C5 S3: the receipt is not a new pattern. It is the same two-part
 * `description` / `nextAction` this resolver has always produced, rendered in the
 * same shared `AdminSourceStateChip` Popover — but it now states WHAT WAS SERVED
 * and WHEN, read from the same record that produced the rows on screen. Before
 * this, the chip said "Using saved data" and nothing else, so an operator waiting
 * 20.5 s for `/subjects` had no way to tell a slow request from an empty catalog.
 *
 * The `receipt` is optional and every existing caller is unaffected: without one
 * the sentences are byte-identical to the accepted A3-C4 copy, so this is purely
 * additive and cannot regress a committed assertion.
 */
export function resolveSubjectSourceCopy(
	sourceState: AdminSourceState,
	receipt?: SubjectCatalogReceipt | null,
) {
	// One sentence, built once, naming the rows and the time. Never a filter
	// count, never a page size: `receipt.count` is the catalog the page painted.
	const servedLine = receipt
		? `ATLAS is showing ${receipt.count} ${receipt.count === 1 ? 'subject' : 'subjects'} `
			+ `${receipt.source === 'saved' ? 'from the copy saved on this device' : 'from the server'}, `
			+ `${receipt.source === 'saved' ? 'saved' : 'loaded'} at ${formatCatalogServedAt(receipt.servedAt)}.`
		: null;
	return {
		description:
			sourceState === 'verified-live'
				? 'ATLAS is showing the saved subject catalog for this school.'
			: sourceState === 'checking-source'
				? 'ATLAS is loading the subject catalog for this school.'
			: sourceState === 'saved-data'
				// A8-C5 S3: the saving clause is kept AND the receipt is added, so
				// the honest "this is the local copy" statement survives while the
				// operator learns what they are looking at and how old it is.
				? (servedLine
					? `ATLAS is showing the saved subject catalog for this school. ${servedLine}`
					: 'ATLAS is showing the saved subject catalog for this school.')
				: 'ATLAS could not load a usable subject catalog.',
		nextAction:
			sourceState === 'verified-live'
				? 'Open coverage for subjects with risk, or add a subject if the catalog is missing one.'
			: sourceState === 'checking-source'
				? 'Wait for the catalog to load before making curriculum changes.'
			: sourceState === 'saved-data'
				// A8-C5 S3: an operator looking at a painted catalog is NOT waiting,
				// so this must not tell them to wait. It says what is happening and
				// what they can do meanwhile.
				? (receipt?.refreshing
					? 'You can keep working. ATLAS is refreshing this list in the background and will update it when it finishes.'
					: 'Add a subject if the catalog is missing one, or open coverage for subjects at risk.')
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
type TermAuthorityCopy = {
	description: string;
	nextAction: string;
	/**
	 * A5 C4: the BANNER HEADLINE, when this code needs one that the `state` alone
	 * cannot supply. Omitted for every code that reads correctly under the
	 * state-derived headline, and the banner falls back to exactly today's
	 * sentence when it is absent — so a mapped code never silently over-rules the
	 * state it arrived in.
	 *
	 * `TERM_CACHE_INVALID` is the one code that needs it, and the reason is
	 * specific: it arrives as `VERIFIED_CACHED`, which otherwise inherits the
	 * stale-SOURCE headline "Using saved EnrollPro year and terms". That names the
	 * source, not the thing the scheduler must do — the TERM information is what
	 * has to be updated before they can schedule. A headline derived from `state`
	 * cannot express that; one derived from the CODE can.
	 */
	headline?: string;
};

const TERM_AUTHORITY_COPY: Readonly<Record<string, TermAuthorityCopy>> = {
	TERM_CACHE_INVALID: {
		description: 'ATLAS could not confirm the saved school year and terms, so it is not using them.',
		nextAction: 'Refresh the term data from EnrollPro, then try again before scheduling into a term.',
		headline: 'Term information needs updating before scheduling.',
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
 * Resolve calm operator copy for a term-authority state.
 *
 * A3-C9: the healthy `VERIFIED_LIVE` state is ROUTINE and now renders nothing at
 * all in the banner — the year-and-terms contract moved to the quiet
 * `SubjectTermContractPopover` in the table footer. It still resolves to an
 * empty description, so the resolver stays the single place that decides which
 * states need exception copy.
 *
 * A5 C4: `headline` is the CODE-AWARE banner headline, and it is `''` unless the
 * mapped code declares one. The banner keeps its own state-derived sentence as
 * the fallback, so this resolver returns a headline only where the `state`
 * genuinely cannot say the right thing — it does not become a second source of
 * truth for every state. `description` and `nextAction` are UNCHANGED by this
 * addition; `A3-C4-3a`/`3b`/`3b2` pin them and they remain the accepted copy.
 */
export function resolveTermAuthorityCopy(
	termAuthority: TermAuthority | null,
): { description: string; nextAction: string; code: string | null; headline: string } {
	if (!termAuthority) return { description: '', nextAction: '', code: null, headline: '' };
	if (termAuthority.state === 'VERIFIED_LIVE') {
		return { description: '', nextAction: '', code: termAuthority.code ?? null, headline: '' };
	}
	const code = (termAuthority.code ?? '').trim();
	const mapped = code ? TERM_AUTHORITY_COPY[code] : undefined;
	const base = mapped ?? TERM_AUTHORITY_FALLBACK;
	return {
		description: base.description,
		nextAction: base.nextAction,
		code: code || null,
		headline: base.headline ?? '',
	};
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
		description: 'This subject carries a scheduling setting that ATLAS set when the school was set up, and it is not an editable setting.',
		nextAction: 'There is nothing to change here. This setting is not editable anywhere in ATLAS, and you do not need to do anything to keep it.',
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
		// A3-C5-4 correction (F-A3b): the previous text said "Close and reopen
		// the subject, then save again. If it keeps failing, contact your ATLAS
		// administrator." Both halves were fabricated. Reopening does not change
		// the payload, so it cannot fix a payload-level rejection; and ATLAS has
		// no escalation route to name, so naming one is a second fabrication.
		nextAction: 'There is nothing to change here. This is a problem with what ATLAS sent, not with what you entered, so re-entering it will not help.',
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
		// A3-C5-4 correction (F-A3a): the previous text said "Choose a
		// qualification priority from the list, then save." There IS no list and
		// no control — `subject-form-utils.ts:15` is the only client mention and
		// merely defaults the value to `DEPARTMENT_FIRST`, and `types.ts:59` types
		// the field as that single literal. Compare `INVALID_ROOM_TYPE`
		// (SubjectFormModal.tsx:512 `Select`) and `INVALID_PROGRAM_SCOPES`
		// (SubjectFormModal.tsx:658 toggles), which say "from the list" and are
		// backed by real controls. This one has no errand to name.
		nextAction: 'There is no setting to change here. ATLAS sets this value itself, so there is nothing to choose.',
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
	// subject.router.ts:182 — 409 "A subject with this code already exists for
	// this school." A3-C6-F1.
	//
	// MAPPED BECAUSE THE CAUSE IS PROVABLE, not because a sentence was wanted.
	// Re-derived for this lane rather than inherited from the c5 handoff:
	//
	//  - `POST /subjects` catches Prisma `P2002` and answers 409 DUPLICATE
	//    (subject.router.ts:181-184).
	//  - `createSubject` (subject.service.ts:1413-1635) performs exactly ONE
	//    Prisma write, `prisma.subject.create` at :1594, so a P2002 raised on
	//    this route can only be that write.
	//  - `model Subject` carries exactly one unique constraint,
	//    `@@unique([schoolId, code], map: "uq_subjects_school_code")`, and the
	//    router passes the ACTOR's school as `schoolId`. So the conflict is
	//    provably (this school, this code) and nothing else.
	//
	// Two consequences the copy depends on, both of which c5's shared fallback
	// could not assert across its heterogeneous class:
	//
	//  - it repeats on EVERY attempt that reuses the code, so a bare "try
	//    again" would send the operator round a deterministic failure — the
	//    exact defect c5 removed from the fallback;
	//  - the errand is therefore to enter a different code, and there is a
	//    real control for it: `SubjectFormModal` renders the code input with
	//    its own validation (SubjectFormModal.tsx:205 "Subject code is
	//    required."), and `Subjects.tsx:419` returns `{ status: 'failed' }`,
	//    which keeps the dialog open on the same form.
	//
	// What the copy deliberately does NOT claim: that nothing was written.
	// That is true today (the 409 precedes any write, and the failing
	// `subject.create` is atomic), but DUPLICATE is a code-keyed resolver entry
	// and a future PATCH-side P2002 would change that reading, so the
	// sentences assert only the conflict and the one errand, which hold for
	// every route that can emit this code.
	DUPLICATE: {
		description: 'Another subject in this school already uses this subject code.',
		nextAction: 'Enter a different subject code, then save the subject again.',
	},
};

/**
 * The unmapped-code, missing-code and no-response-body answer. A FIXED constant
 * with no interpolation — see the load-bearing rule above. It must never
 * incorporate `rawMessage`.
 *
 * A3-C5-4 correction 2 (planner-authorised): the previous text was "Check the
 * school connection, then try again. If it keeps failing, contact your ATLAS
 * administrator." Both halves were fabrications, and this is the MOST-REACHED
 * path in the whole resolver — every unmapped code, every missing code, and
 * every no-response-body network failure lands here.
 *
 * What is actually true here, re-verified against the server before writing:
 * this class is HETEROGENEOUS, and that is the whole point. It currently
 * catches real, unrelated failures — `MISSING_FIELDS` (:137),
 * `CROSS_SCHOOL_YEAR_DENIED` (:405/:442/:478), `DELETE_PREVIEW_REQUIRED`
 * (:239), `SYSTEM_TOKEN_NOT_CONFIGURED` and `INVALID_SYSTEM_TOKEN`
 * (middleware/authenticate.ts:149/:157), plus no-response network failures,
 * plus any code ATLAS has not yet emitted. "Check the school connection" is
 * wrong for a school-year mismatch and for a 409 that will reject the same
 * request again; "try again" is wrong for all of them; and ATLAS has no
 * escalation route, so naming one is a second fabrication — the identical
 * defect just removed from the three mapped codes.
 *
 * So the honest sentence asserts only what holds for ALL of them: ATLAS could
 * not complete the change, and could not say why, so there is no specific
 * action. No remedy is invented, and no support path is named.
 *
 * A3-C6-F1 — `DUPLICATE` WAS IN THIS LIST AND IS NO LONGER. The sentence above
 * previously named `DUPLICATE` (subject.router.ts:182) as one of the causes
 * this branch catches, and that claim is now SUPERSEDED rather than deleted:
 * `DUPLICATE` is mapped in `SUBJECT_MUTATION_COPY` above, because its cause is
 * provable from the schema (a single unique constraint, `@@unique([schoolId,
 * code])`). The class is still heterogeneous — the remaining members still do
 * not share one operator meaning, which is exactly why this fallback keeps
 * asserting nothing beyond "the change did not complete and no action follows".
 * A3-C6-DUPLICATE-COPY test `A3-C6-1d` pins which codes are in the class, so
 * the next lane cannot quietly widen or narrow it by editing this comment.
 */
const SUBJECT_MUTATION_FALLBACK: SubjectMutationCopyPair = {
	description: 'ATLAS could not complete that subject change.',
	nextAction: 'ATLAS could not say what went wrong, so there is no specific action to take here.',
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
