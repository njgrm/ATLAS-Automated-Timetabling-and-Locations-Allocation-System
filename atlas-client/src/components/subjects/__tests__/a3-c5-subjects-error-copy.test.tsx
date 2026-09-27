/**
 * A3-C5-SUBJECTS-ERROR-COPY (stream A3) — packet c5 item 4: seven sites on the
 * Subjects route toasted a SERVER-AUTHORED message verbatim.
 *
 * THE DEFECT
 *
 * `Subjects.tsx` (coverage load, save, archive, reactivate) and
 * `DeleteSubjectDialog.tsx` (delete preview, delete confirm) each read
 * `err?.response?.data?.message`. The plain fallback those sites supply is
 * fine; the SERVER string is the problem. `atlas-server/src/services/subject.service.ts`
 * authors engineer prose for a scheduler — "minMinutesPerWeek must be a
 * positive number.", "Cannot modify protected fields: isSeedable,
 * isSystemManaged.". A field name and a constant name are not operator
 * language. The server files are OUT OF FENCE and are not edited, exactly as in
 * A3-C4's `resolveTermAuthorityCopy`; the client learns to speak plainly.
 *
 * FIXTURES ARE THE REAL SERVER STRINGS, VERBATIM (§11)
 *
 * Every fixture below is copied from the server source, with the template
 * variable substituted by a plausible value — NOT invented. `GENERIC_*` records
 * the file:line each one came from. A control whose fixture was written by hand
 * validates a fiction; AGENTS.md §11 records exactly that failure shipping a
 * release.
 *
 * F6 — NOTHING HERE IS AN ABSENCE-ONLY ASSERTION
 *
 * The obvious way to write this suite is "the engineer string does not appear
 * in the output", which a resolver that returns `''` for everything passes
 * perfectly. So every leak assertion is paired with a POSITIVE control in the
 * same test: the resolver is first shown to return specific, non-empty,
 * code-keyed text, and `A3-C5-4b` then runs the whole mapping through a
 * deliberately broken resolver that is FORCED to echo `rawMessage` and proves
 * the leak assertions go RED. A suite that cannot go red is not a control.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	resolveSubjectMutationErrorCopy,
	type SubjectMutationErrorCopy,
} from '@/components/subjects/subject-source-utils';

/**
 * The REAL server envelopes, verbatim. `GENERIC_*` is the provenance.
 * These are the exact `{ code, message }` bodies the seven call sites received.
 */
const SERVER_ENVELOPES = {
	// --- Already-plain. These must NOT be rewritten. ---
	// subject.service.ts:505 / subject.router.ts:84
	NOT_FOUND: {
		code: 'NOT_FOUND',
		message: 'Subject not found.',
		origin: 'atlas-server/src/services/subject.service.ts:505',
	},
	// subject.service.ts:508 / subject-delete-dependencies.service.ts:93
	CROSS_SCHOOL_DENIED: {
		code: 'CROSS_SCHOOL_DENIED',
		message: 'Subject belongs to another school.',
		origin: 'atlas-server/src/services/subject.service.ts:508',
	},
	// subject.service.ts:513, :942, :1023
	STALE_WRITE: {
		code: 'STALE_WRITE',
		message: 'Subject was modified by another user. Refresh and retry.',
		origin: 'atlas-server/src/services/subject.service.ts:513',
	},
	// subject.service.ts:992
	ALREADY_ARCHIVED: {
		code: 'ALREADY_ARCHIVED',
		message: 'Subject is already archived.',
		origin: 'atlas-server/src/services/subject.service.ts:992',
	},
	// subject.service.ts:992
	ALREADY_ACTIVE: {
		code: 'ALREADY_ACTIVE',
		message: 'Subject is already active.',
		origin: 'atlas-server/src/services/subject.service.ts:992',
	},

	// --- Engineer strings that reach a scheduler verbatim today. ---
	// subject.service.ts:699
	PROTECTED_SCHEDULING_DISPOSITION: {
		code: 'PROTECTED_SCHEDULING_DISPOSITION',
		message:
			'schedulingDisposition is deferred scheduling authority (PENDING_DERIVED_DEMAND_INTEGRATION) and cannot be set through Subject CRUD: schedulingDisposition.',
		origin: 'atlas-server/src/services/subject.service.ts:699',
	},
	// subject.service.ts:709
	PROTECTED_TERM_AUTHORITY: {
		code: 'PROTECTED_TERM_AUTHORITY',
		message:
			'EnrollPro term authority fields cannot be modified through Subject CRUD: schoolYearId, activeTermIdentity.',
		origin: 'atlas-server/src/services/subject.service.ts:709',
	},
	// subject.service.ts:721 (message text) — planner cited :721 for the message
	PROTECTED_FIELD: {
		code: 'PROTECTED_FIELD',
		message: 'Cannot modify protected fields: isSeedable, isSystemManaged.',
		origin: 'atlas-server/src/services/subject.service.ts:721',
	},
	// subject.service.ts:731
	UNKNOWN_FIELD: {
		code: 'UNKNOWN_FIELD',
		message: 'Unknown fields not allowed: ownerDepartment, gradeLevels.',
		origin: 'atlas-server/src/services/subject.service.ts:731',
	},
	// subject.service.ts:617
	INVALID_MIN_MINUTES_PER_WEEK_NON_INTEGER: {
		code: 'INVALID_MIN_MINUTES_PER_WEEK',
		message: 'minMinutesPerWeek must be a positive number.',
		origin: 'atlas-server/src/services/subject.service.ts:617',
	},
	// subject.service.ts:620
	INVALID_MIN_MINUTES_PER_WEEK_RANGE: {
		code: 'INVALID_MIN_MINUTES_PER_WEEK',
		message: 'minMinutesPerWeek must be a positive integer up to 2147483647.',
		origin: 'atlas-server/src/services/subject.service.ts:620',
	},
	// subject.service.ts:495
	INVALID_PARAM: {
		code: 'INVALID_PARAM',
		message: 'subjectId must be a positive integer.',
		origin: 'atlas-server/src/services/subject.service.ts:495',
	},
	// subject.service.ts:498 / subject.router.ts:281
	SCHOOL_SCOPE_REQUIRED: {
		code: 'SCHOOL_SCOPE_REQUIRED',
		message: 'Authenticated school scope is required.',
		origin: 'atlas-server/src/services/subject.service.ts:498',
	},
	// subject.service.ts:745
	INVALID_SUBJECT_NAME: {
		code: 'INVALID_SUBJECT_NAME',
		message: 'name must be a non-empty string.',
		origin: 'atlas-server/src/services/subject.service.ts:745',
	},
} as const;

/** Every engineer sentence that must not survive into operator copy. */
const ENGINEER_STRINGS: ReadonlyArray<readonly [string, string, string]> = [
	[
		'PROTECTED_SCHEDULING_DISPOSITION',
		SERVER_ENVELOPES.PROTECTED_SCHEDULING_DISPOSITION.code,
		SERVER_ENVELOPES.PROTECTED_SCHEDULING_DISPOSITION.message,
	],
	[
		'PROTECTED_TERM_AUTHORITY',
		SERVER_ENVELOPES.PROTECTED_TERM_AUTHORITY.code,
		SERVER_ENVELOPES.PROTECTED_TERM_AUTHORITY.message,
	],
	[
		'PROTECTED_FIELD',
		SERVER_ENVELOPES.PROTECTED_FIELD.code,
		SERVER_ENVELOPES.PROTECTED_FIELD.message,
	],
	[
		'UNKNOWN_FIELD',
		SERVER_ENVELOPES.UNKNOWN_FIELD.code,
		SERVER_ENVELOPES.UNKNOWN_FIELD.message,
	],
	[
		'INVALID_MIN_MINUTES_PER_WEEK',
		SERVER_ENVELOPES.INVALID_MIN_MINUTES_PER_WEEK_NON_INTEGER.code,
		SERVER_ENVELOPES.INVALID_MIN_MINUTES_PER_WEEK_NON_INTEGER.message,
	],
	[
		'INVALID_MIN_MINUTES_PER_WEEK',
		SERVER_ENVELOPES.INVALID_MIN_MINUTES_PER_WEEK_RANGE.code,
		SERVER_ENVELOPES.INVALID_MIN_MINUTES_PER_WEEK_RANGE.message,
	],
	[
		'INVALID_PARAM',
		SERVER_ENVELOPES.INVALID_PARAM.code,
		SERVER_ENVELOPES.INVALID_PARAM.message,
	],
	[
		'SCHOOL_SCOPE_REQUIRED',
		SERVER_ENVELOPES.SCHOOL_SCOPE_REQUIRED.code,
		SERVER_ENVELOPES.SCHOOL_SCOPE_REQUIRED.message,
	],
	[
		'INVALID_SUBJECT_NAME',
		SERVER_ENVELOPES.INVALID_SUBJECT_NAME.code,
		SERVER_ENVELOPES.INVALID_SUBJECT_NAME.message,
	],
];

/** The exact operator sentence each engineer code must resolve to. */
const EXPECTED_ENGINEER_COPY: ReadonlyArray<
	readonly [
		string,
		{ readonly code: string; readonly message: string; readonly origin: string },
		string,
	]
> = [
	[
		'PROTECTED_SCHEDULING_DISPOSITION',
		SERVER_ENVELOPES.PROTECTED_SCHEDULING_DISPOSITION,
		'This subject carries a scheduling setting that ATLAS set when the school was set up, and it is not an editable setting.',
	],
	[
		'PROTECTED_TERM_AUTHORITY',
		SERVER_ENVELOPES.PROTECTED_TERM_AUTHORITY,
		'The school year and term settings for this subject come from the enrolment system, so they cannot be changed here.',
	],
	[
		'PROTECTED_FIELD',
		SERVER_ENVELOPES.PROTECTED_FIELD,
		'This subject has a setting that ATLAS maintains for you, so it cannot be changed here.',
	],
	[
		'UNKNOWN_FIELD',
		SERVER_ENVELOPES.UNKNOWN_FIELD,
		'ATLAS received a subject setting it does not recognise.',
	],
	[
		'INVALID_MIN_MINUTES_PER_WEEK',
		SERVER_ENVELOPES.INVALID_MIN_MINUTES_PER_WEEK_NON_INTEGER,
		'Weekly minutes must be a whole number greater than zero.',
	],
	[
		'INVALID_PARAM',
		SERVER_ENVELOPES.INVALID_PARAM,
		'ATLAS could not read which subject this request was for.',
	],
	[
		'SCHOOL_SCOPE_REQUIRED',
		SERVER_ENVELOPES.SCHOOL_SCOPE_REQUIRED,
		'ATLAS could not confirm which school this request belongs to.',
	],
	[
		'INVALID_SUBJECT_NAME',
		SERVER_ENVELOPES.INVALID_SUBJECT_NAME,
		'The subject name cannot be empty.',
	],
];

/**
 * The generic fallback copy, pinned in one place and asserted exactly by 4c,
 * 4d and 4g. The unmapped/missing/no-response path is the MOST-REACHED branch
 * of the resolver, so its two sentences are held as tightly as the mapped ones.
 *
 * A3-C5-4 correction 2: the previous `nextAction` was "Check the school
 * connection, then try again. If it keeps failing, contact your ATLAS
 * administrator." Re-verified against the server, this branch is
 * heterogeneous — it catches `DUPLICATE` (subject.router.ts:182, a 409 that
 * will conflict again on every retry), `MISSING_FIELDS` (:137),
 * `CROSS_SCHOOL_YEAR_DENIED` (:405/:442/:478),
 * `SYSTEM_TOKEN_NOT_CONFIGURED` / `INVALID_SYSTEM_TOKEN`
 * (middleware/authenticate.ts:149/:157), no-response network failures, and
 * future codes. "Check the school connection" is wrong for a duplicate code and
 * for a school-year mismatch; "try again" is wrong for a deterministic 409; and
 * ATLAS has no escalation route to name. The new sentence asserts only what
 * holds for all of them.
 */
const FALLBACK_DESCRIPTION = 'ATLAS could not complete that subject change.';
const FALLBACK_NEXT_ACTION =
	'ATLAS could not say what went wrong, so there is no specific action to take here.';

/** The fallback's first-candidate `nextAction`, kept as a mutation source. */
const FALLBACK_NEXT_ACTION_BEFORE_CORRECTION =
	'Check the school connection, then try again. If it keeps failing, contact your ATLAS administrator.';

/** Every code an operator is ever shown: the three copy fields together. */
function operatorVisibleText(copy: SubjectMutationErrorCopy): string {
	return `${copy.description} ${copy.nextAction} ${copy.message}`;
}

test('A3-C5-4a: every mapped code resolves to a specific plain sentence (exact)', () => {
	for (const [label, envelope, expected] of EXPECTED_ENGINEER_COPY) {
		assert.ok(envelope.origin.length > 0, `${label}: fixture must record its server provenance`);
		const copy = resolveSubjectMutationErrorCopy(envelope);
		assert.equal(copy.description, expected, `${label}: description must be the exact mapped sentence`);
		// POSITIVE CONTROL (F6): non-empty, operator-length, and actually
		// keying off the code rather than returning nothing.
		assert.ok(copy.description.length > 20, `${label}: resolver returned nothing useful`);
		assert.ok(copy.nextAction.length > 20, `${label}: no next action`);
		assert.notEqual(copy.description, envelope.message, `${label}: must not echo the server sentence`);
		// The one-line toast text is both fields, and is derived — not a second
		// authored string that could smuggle the server text in.
		assert.equal(copy.message, `${copy.description} ${copy.nextAction}`);
	}
});

test('A3-C5-4b: engineer strings are absent, and a forced-raw resolver goes RED', () => {
	// The POSITIVE control first: the resolver demonstrably DOES return
	// specific text for every one of these codes. Without this, the absence
	// assertions below would be satisfied by a resolver returning ''.
	for (const [label, envelope, expected] of EXPECTED_ENGINEER_COPY) {
		const copy = resolveSubjectMutationErrorCopy({ code: envelope.code, message: 'x' });
		assert.equal(copy.description, expected, `${label}: positive control — must return specific text`);
		assert.notEqual(copy.description, '', `${label}: positive control — must not be empty`);
	}
	// Now the real claim: none of the nine real engineer sentences survives.
	for (const [label, code, engineerMessage] of ENGINEER_STRINGS) {
		const copy = resolveSubjectMutationErrorCopy({ code, message: engineerMessage });
		const visible = operatorVisibleText(copy);
		assert.ok(
			!visible.includes(engineerMessage),
			`${label}: the server sentence leaked into operator copy: ${visible}`,
		);
		// Individually too: the distinctive token of each engineer string. This
		// catches a resolver that paraphrases but keeps the field name.
		const token = label === 'INVALID_MIN_MINUTES_PER_WEEK'
			? 'minMinutesPerWeek'
			: label === 'INVALID_PARAM'
				? 'subjectId'
				: label === 'INVALID_SUBJECT_NAME'
					? 'name must be'
					: label === 'PROTECTED_FIELD'
						? 'isSeedable'
						: label === 'UNKNOWN_FIELD'
							? 'not allowed'
							: label === 'PROTECTED_TERM_AUTHORITY'
								? 'EnrollPro term authority fields'
								: 'PENDING_DERIVED_DEMAND_INTEGRATION';
		assert.ok(!visible.includes(token), `${label}: engineer token "${token}" leaked into: ${visible}`);
	}
	// THE MUTANT. A resolver that does the defect — falling back to the raw
	// server sentence — must fail the assertions above. Run the real leak
	// assertion against the broken resolver and require it to throw.
	const brokenResolver = (payload: { code?: unknown; message?: unknown } | null | undefined) => ({
		description: typeof payload?.message === 'string' ? payload.message : '',
		nextAction: '',
		message: typeof payload?.message === 'string' ? payload.message : '',
		code: typeof payload?.code === 'string' ? payload.code : null,
		rawMessage: typeof payload?.message === 'string' ? payload.message : '',
	});
	let mutantCaught = 0;
	for (const [label, code, engineerMessage] of ENGINEER_STRINGS) {
		const broken = brokenResolver({ code, message: engineerMessage });
		const visible = operatorVisibleText(broken);
		assert.throws(
			() => {
				assert.ok(
					!visible.includes(engineerMessage),
					`${label}: the server sentence leaked into operator copy: ${visible}`,
				);
			},
			`A3-C5-4b: the forced-raw mutant was NOT caught for ${label} — this control is vacuous`,
		);
		mutantCaught += 1;
	}
	assert.equal(mutantCaught, 9, 'A3-C5-4b: all nine mutants must be caught');
});

test('A3-C5-4c: unknown code with a hostile engineer message leaks nothing', () => {
	const hostile =
		'Assertion failed at subject.service.ts:701: protectedPendingAuthorityFields.length > 0 (PENDING_DERIVED_DEMAND_INTEGRATION) — see atlas-server/src/services/subject.service.ts';
	for (const code of ['TOTALLY_UNKNOWN_CODE', 'PROTECTED_FIELD_V2', 'not_found', 'STALE_WRIT']) {
		const copy = resolveSubjectMutationErrorCopy({ code, message: hostile });
		assert.equal(copy.code, code, 'the raw code must still be reachable for the diagnostic');
		assert.equal(copy.rawMessage, hostile, 'the raw message must still be reachable');
		const visible = operatorVisibleText(copy);
		assert.ok(!visible.includes(hostile), `${code}: hostile message leaked`);
		assert.ok(!visible.includes('PENDING_DERIVED_DEMAND_INTEGRATION'), `${code}: engineer constant leaked`);
		assert.ok(!visible.includes('Assertion failed'), `${code}: stack-shaped text leaked`);
		assert.ok(!visible.includes('subject.service.ts'), `${code}: file path leaked`);
		// Calm and generic, but still specific enough to act on.
		assert.equal(
			copy.description,
			FALLBACK_DESCRIPTION,
			`${code}: unknown code must fall back to the fixed generic sentence`,
		);
		// A3-C5-4 correction 2: pinned EXACTLY. This is the most-reached path in
		// the resolver, so its sentence is held as tightly as the mapped ones —
		// a drift back to "contact your ATLAS administrator" is a test failure,
		// not a reviewer's judgement call.
		assert.equal(copy.nextAction, FALLBACK_NEXT_ACTION, `${code}: fallback next action drifted`);
		assert.equal(copy.message, `${copy.description} ${copy.nextAction}`);
	}
});

test('A3-C5-4d: missing, empty and malformed codes behave sanely', () => {
	const hostile = 'Cannot modify protected fields: isSeedable, isSystemManaged.';
	// No response body at all — the ordinary network failure.
	for (const payload of [undefined, null, {}]) {
		const copy = resolveSubjectMutationErrorCopy(payload);
		assert.equal(copy.code, null);
		assert.equal(copy.rawMessage, '');
		assert.equal(copy.description, FALLBACK_DESCRIPTION);
		assert.equal(copy.nextAction, FALLBACK_NEXT_ACTION, 'no-response fallback next action drifted');
		assert.equal(copy.message, `${copy.description} ${copy.nextAction}`);
		assert.ok(!operatorVisibleText(copy).includes(hostile));
	}
	// Empty / whitespace / non-string code and message.
	for (const code of ['', '   ', 42, null, undefined, { nested: true }]) {
		const copy = resolveSubjectMutationErrorCopy({ code, message: hostile });
		assert.equal(copy.code, null, `code ${JSON.stringify(code)} must normalise to null`);
		assert.equal(copy.description, FALLBACK_DESCRIPTION);
		assert.equal(copy.nextAction, FALLBACK_NEXT_ACTION, 'blank-code fallback next action drifted');
		// The hostile message is preserved for the diagnostic but never shown.
		assert.equal(copy.rawMessage, hostile);
		assert.ok(!operatorVisibleText(copy).includes(hostile));
	}
	// A non-string message must not become "undefined" on screen.
	const odd = resolveSubjectMutationErrorCopy({ code: 'PROTECTED_FIELD', message: { toString: () => 'x' } });
	assert.equal(odd.rawMessage, '');
	assert.equal(odd.description, 'This subject has a setting that ATLAS maintains for you, so it cannot be changed here.');
	assert.ok(!odd.message.includes('undefined'));
	// Whitespace around a KNOWN code is trimmed, so it still maps.
	const padded = resolveSubjectMutationErrorCopy({ code: '  PROTECTED_FIELD  ', message: hostile });
	assert.equal(padded.code, 'PROTECTED_FIELD');
	assert.equal(padded.description, 'This subject has a setting that ATLAS maintains for you, so it cannot be changed here.');
});

test('A3-C5-4e: the already-plain codes were NOT rewritten (over-rewrite guard)', () => {
	const expected: ReadonlyArray<readonly [string, string, string]> = [
		['NOT_FOUND', SERVER_ENVELOPES.NOT_FOUND.code, 'Subject not found.'],
		['CROSS_SCHOOL_DENIED', SERVER_ENVELOPES.CROSS_SCHOOL_DENIED.code, 'Subject belongs to another school.'],
		[
			'STALE_WRITE',
			SERVER_ENVELOPES.STALE_WRITE.code,
			'Subject was modified by another user. Refresh and retry.',
		],
		['ALREADY_ARCHIVED', SERVER_ENVELOPES.ALREADY_ARCHIVED.code, 'Subject is already archived.'],
		['ALREADY_ACTIVE', SERVER_ENVELOPES.ALREADY_ACTIVE.code, 'Subject is already active.'],
	];
	for (const [label, code, plainSentence] of expected) {
		const copy = resolveSubjectMutationErrorCopy({ code, message: plainSentence });
		// The server sentence is already operator language, so the resolver
		// keeps it as the description rather than authoring a rival one.
		assert.equal(copy.description, plainSentence, `${label}: an already-plain sentence was rewritten`);
		// A next action IS still added — that is additive, not a rewrite.
		assert.ok(copy.nextAction.length > 20, `${label}: lost its next action`);
		assert.ok(
			!copy.nextAction.includes(plainSentence),
			`${label}: next action must not merely repeat the description`,
		);
	}
	// The save path's specific STALE_WRITE instruction is preserved, and now
	// lives in ONE place instead of the inline copy this stream removed.
	const stale = resolveSubjectMutationErrorCopy({ code: 'STALE_WRITE', message: SERVER_ENVELOPES.STALE_WRITE.message });
	assert.ok(
		stale.message.includes('Your change was not written — close and reopen the subject to load the newer version'),
		`A3-C5-4e: the save path lost its specific instruction: ${stale.message}`,
	);
});

test('A3-C5-4f: the raw code and raw message stay reachable (diagnostic preserved)', () => {
	// §8 forbids a bare title=, so the diagnostic must be a real affordance —
	// which means the resolver must hand BOTH raw values back untouched.
	for (const [label, code, engineerMessage] of ENGINEER_STRINGS) {
		const copy = resolveSubjectMutationErrorCopy({ code, message: engineerMessage });
		assert.equal(copy.code, code, `${label}: raw code destroyed`);
		assert.equal(copy.rawMessage, engineerMessage, `${label}: raw server message destroyed or altered`);
	}
	// And the value the popover renders must be byte-identical, not trimmed
	// into something else or replaced with a paraphrase.
	const raw = SERVER_ENVELOPES.PROTECTED_FIELD;
	const copy = resolveSubjectMutationErrorCopy(raw);
	assert.equal(copy.rawMessage, raw.message);
	assert.ok(copy.rawMessage.includes('isSeedable'), 'the popover must still show the field name to support');
	// An empty raw message yields no raw text but still keeps a null code shape.
	const none = resolveSubjectMutationErrorCopy({ code: 'PROTECTED_FIELD' });
	assert.equal(none.rawMessage, '');
	assert.equal(none.code, 'PROTECTED_FIELD');
});

/**
 * A3-C5-4 correction: next actions must be FOLLOWABLE, not merely safe.
 *
 * The first candidate passed QA 15/15 and still told an operator to do three
 * things the system cannot support. A next action an operator cannot carry out
 * is a new fabrication, and this stream exists to remove fabrications — so
 * introducing one while claiming to remove others is worse than the defect it
 * fixes. QA graded these NON_BLOCKING because none leaked a server string and
 * none weakened a gate; both true, and neither is the bar for a truthfulness
 * stream. A sentence has to be TRUE.
 *
 * THE THREE DEFECTS, each verified against the real surface first:
 *
 *  - `PROTECTED_SCHEDULING_DISPOSITION` said "ask a school administrator to
 *    review the scheduling setup". There is no such path: subject.service.ts
 *    :550-556 records that `schedulingDisposition` is written ONLY by
 *    controlled bootstrap/migration authority (exact code `HG`), is "NOT yet
 *    an operative operator control", and has no admin CRUD route.
 *  - `INVALID_QUALIFICATION_PRIORITY` said "Choose a qualification priority
 *    from the list, then save." There is no list and no control: the only
 *    client mentions are subject-form-utils.ts:15 (defaults it to
 *    `DEPARTMENT_FIRST`) and types.ts:59 (types it as that single literal).
 *    The two cases that DO say "from the list" —
 *    `INVALID_ROOM_TYPE` (SubjectFormModal.tsx:512 `Select`) and
 *    `INVALID_PROGRAM_SCOPES` (SubjectFormModal.tsx:658 toggles) — are backed
 *    by real controls, are correct, and must stay exactly as they are.
 *  - `UNKNOWN_FIELD` said "Close and reopen the subject, then save again. If it
 *    keeps failing, contact your ATLAS administrator." Reopening cannot change
 *    a payload-level rejection, and ATLAS has no escalation route to name.
 */
const CORRECTED_NEXT_ACTIONS: ReadonlyArray<readonly [string, string]> = [
	[
		'PROTECTED_SCHEDULING_DISPOSITION',
		'There is nothing to change here. This setting is not editable anywhere in ATLAS, and you do not need to do anything to keep it.',
	],
	[
		'INVALID_QUALIFICATION_PRIORITY',
		'There is no setting to change here. ATLAS sets this value itself, so there is nothing to choose.',
	],
	[
		'UNKNOWN_FIELD',
		'There is nothing to change here. This is a problem with what ATLAS sent, not with what you entered, so re-entering it will not help.',
	],
];

/**
 * Named human roles and support routes ATLAS does not actually have. Naming one
 * is the fabrication this control exists to reject.
 */
const UNFALSIFIABLE_ERRANDS: ReadonlyArray<string> = [
	'administrator',
	'admin',
	'contact support',
	'contact it',
	'support team',
	'help desk',
	'it department',
	'call us',
	'raise a ticket',
	'submit a ticket',
];

/** The predicate under test. Deliberately small and mechanical. */
function unfalsifiableErrandsIn(text: string): string[] {
	const lower = text.toLowerCase();
	return UNFALSIFIABLE_ERRANDS.filter((phrase) => lower.includes(phrase));
}

test('A3-C5-4g: corrected next actions are followable and name no phantom errand', () => {
	// 1. The three corrected sentences are pinned EXACTLY, so they cannot drift
	//    back to a fabricated errand without this test going red. The generic
	//    fallback is pinned here too: it is the most-reached path in the
	 //    resolver, so it is held at the same strength, not a looser bar.
	for (const [code, expected] of CORRECTED_NEXT_ACTIONS) {
		const copy = resolveSubjectMutationErrorCopy({ code, message: 'server text' });
		assert.equal(copy.nextAction, expected, `${code}: corrected next action drifted`);
		assert.ok(copy.nextAction.length > 20, `${code}: next action must not be empty`);
	}
	// A3-C6 SUPERSESSION (AGENTS.md §16 — the record is kept, not deleted).
	//
	// The probe list used to be `[{ code: 'DUPLICATE' }, { code: 'MISSING_FIELDS' },
	// {}]`, i.e. it asserted that `DUPLICATE` resolves to the generic fallback.
	// That assertion is now SUPERSEDED and is replaced IN PLACE by the two
	// assertions immediately below — the replacement is not subtractive, and
	// `MISSING_FIELDS` and the no-code probe are still held at the same
	// strength.
	//
	// WHY IT IS SUPERSEDED, and why superseding it is a correction rather than
	// evidence-weakening: the `DUPLICATE` claim rested on "this class is
	// heterogeneous, so no single member may be given a specific answer". That
	// premise does not hold for `DUPLICATE` and A3-C6 proved it from the schema
	// rather than by opinion — `model Subject` has exactly ONE unique
	// constraint, `@@unique([schoolId, code])`, `createSubject` performs
	// exactly one Prisma write, and the router passes the actor's school as
	// `schoolId`. The cause is therefore provably (this school, this code) and
	// nothing else, so the vague sentence was withholding a cause ATLAS can
	// state. The class is still heterogeneous — `MISSING_FIELDS`,
	// `CROSS_SCHOOL_YEAR_DENIED`, the system-token failures and no-response
	// failures remain, and the fallback's two sentences still assert only what
	// holds for all of them.
	//
	// REPLACEMENT ASSERTION 1 — `DUPLICATE` must now resolve to specific copy,
	// not to the fallback. This is the exact inverse of the superseded claim,
	// so a regression back to the fallback is caught here.
	const duplicate = resolveSubjectMutationErrorCopy({
		code: 'DUPLICATE',
		message: 'A subject with this code already exists for this school.',
	});
	assert.equal(
		duplicate.description,
		'Another subject in this school already uses this subject code.',
		'A3-C6: DUPLICATE must no longer resolve to the generic fallback description',
	);
	assert.equal(
		duplicate.nextAction,
		'Enter a different subject code, then save the subject again.',
		'A3-C6: DUPLICATE must no longer resolve to the generic fallback next action',
	);
	assert.notEqual(duplicate.description, FALLBACK_DESCRIPTION, 'A3-C6: DUPLICATE is back on the fallback');
	assert.notEqual(duplicate.nextAction, FALLBACK_NEXT_ACTION, 'A3-C6: DUPLICATE is back on the fallback action');
	// REPLACEMENT ASSERTION 2 — the new copy is held to the SAME bar as the
	// fallback it replaced, so mapping a code is not a licence to fabricate.
	assert.deepEqual(
		unfalsifiableErrandsIn(duplicate.nextAction),
		[],
		'A3-C6: the DUPLICATE next action names an errand ATLAS cannot support',
	);
	assert.ok(!/\bfrom the list\b/.test(duplicate.nextAction), 'A3-C6: the DUPLICATE next action names a phantom list');
	assert.ok(!/\btry again\b/i.test(duplicate.nextAction), 'A3-C6: the DUPLICATE next action sends the operator in a circle');
	// The full unrecognised-class control, with `DUPLICATE` removed as
	// SUPERSEDED (see above). `MISSING_FIELDS` and the no-code probe are the
	// surviving members and are still pinned exactly.
	for (const probe of [{ code: 'MISSING_FIELDS' }, {}]) {
		const copy = resolveSubjectMutationErrorCopy({ ...probe, message: 'server text' });
		assert.equal(copy.nextAction, FALLBACK_NEXT_ACTION, `fallback (${probe.code ?? 'no code'}) drifted`);
		assert.equal(copy.description, FALLBACK_DESCRIPTION);
	}

	// 2. None of them names a role or support route ATLAS does not have.
	for (const [code, expected] of CORRECTED_NEXT_ACTIONS) {
		const found = unfalsifiableErrandsIn(expected);
		assert.deepEqual(
			found,
			[],
			`${code}: next action names an errand ATLAS cannot support: ${found.join(', ')} — "${expected}"`,
		);
	}
	{
		const found = unfalsifiableErrandsIn(FALLBACK_NEXT_ACTION);
		assert.deepEqual(
			found,
			[],
			`fallback: names an errand ATLAS cannot support: ${found.join(', ')} — "${FALLBACK_NEXT_ACTION}"`,
		);
	}

	// 3. The two list-backed cases MUST keep "from the list" — they are backed by
	//    real controls, so a blanket "no list" rule would be wrong. This is the
	//    control that stops the correction from over-reaching.
	for (const code of ['INVALID_ROOM_TYPE', 'INVALID_PROGRAM_SCOPES']) {
		const copy = resolveSubjectMutationErrorCopy({ code, message: 'server text' });
		assert.ok(
			copy.nextAction.includes('from the list'),
			`${code}: a list-backed case lost its correct "from the list" wording`,
		);
	}

	// 4. POSITIVE CONTROL (F6) — the predicate is not vacuous. Each ORIGINAL,
	//    unfalsifiable sentence must be CAUGHT, and each corrected sentence must
	//    NOT be. This is the 4b forced-mutant pattern.
	//
	//    Two DIFFERENT defects need two DIFFERENT mutants, and that is the point:
	//    the two phantom-role sentences are caught by the role scan, while the
	//    phantom-list sentence contains NO role phrase at all. A role-only grep
	//    would have missed it entirely — which is why the list scan exists as a
	//    separate assertion rather than as a hopeful extension of the first.
	const roleScanMutants: ReadonlyArray<readonly [string, string]> = [
		[
			'PROTECTED_SCHEDULING_DISPOSITION (first candidate)',
			'Leave that setting alone. If it must change, ask a school administrator to review the scheduling setup.',
		],
		[
			'UNKNOWN_FIELD (first candidate)',
			'Close and reopen the subject, then save again. If it keeps failing, contact your ATLAS administrator.',
		],
		[
			'SUBJECT_MUTATION_FALLBACK (first candidate)',
			FALLBACK_NEXT_ACTION_BEFORE_CORRECTION,
		],
	];
	let mutantsCaught = 0;
	for (const [label, badNextAction] of roleScanMutants) {
		const found = unfalsifiableErrandsIn(badNextAction);
		assert.ok(found.length > 0, `${label}: the unfalsifiable sentence was NOT caught — control is vacuous`);
		mutantsCaught += 1;
	}
	assert.equal(mutantsCaught, 3, 'A3-C5-4g: all three phantom-role mutants must be caught');

	// 4a. The "names a list that does not exist" defect needs its own mutant,
	//     because the role scan above does not detect it at all. Assert BOTH
	//     that the bad sentence is caught AND that the live, corrected output
	//     is not — so the mutant cannot pass by the predicate rejecting
	//     everything.
	const listClaimMutant: readonly [string, string] = [
		'INVALID_QUALIFICATION_PRIORITY (first candidate)',
		'Choose a qualification priority from the list, then save.',
	];
	assert.throws(
		() => {
			assert.ok(
				!/\bfrom the list\b/.test(listClaimMutant[1]),
				`${listClaimMutant[0]}: names a list that does not exist — "${listClaimMutant[1]}"`,
			);
		},
		`A3-C5-4g: the phantom-list mutant was NOT caught for ${listClaimMutant[0]}`,
	);
	assert.equal(
		unfalsifiableErrandsIn(listClaimMutant[1]).length,
		0,
		'A3-C5-4g: the role scan must MISS the phantom-list mutant, proving the two scans are independent',
	);

	// 4b. The corrected strings must pass BOTH predicates.
	for (const [code, expected] of CORRECTED_NEXT_ACTIONS) {
		assert.doesNotThrow(
			() => {
				assert.deepEqual(unfalsifiableErrandsIn(expected), [], `${code}: flagged by the role scan`);
				assert.ok(!/\bfrom the list\b/.test(expected), `${code}: flagged by the list scan`);
			},
			`A3-C5-4g: the corrected sentence for ${code} was wrongly rejected`,
		);
	}
	// And so must the fallback, under the same two scans.
	assert.doesNotThrow(
		() => {
			assert.deepEqual(unfalsifiableErrandsIn(FALLBACK_NEXT_ACTION), [], 'fallback: flagged by the role scan');
			assert.ok(!/\bfrom the list\b/.test(FALLBACK_NEXT_ACTION), 'fallback: flagged by the list scan');
		},
		'A3-C5-4g: the corrected fallback sentence was wrongly rejected',
	);
	// 4c. The list scan must genuinely MISS the fallback's first candidate, so
	//     the two scans are provably independent rather than one implying the
	//     other. Without this, the list scan could be doing no work at all.
	assert.equal(
		unfalsifiableErrandsIn(FALLBACK_NEXT_ACTION_BEFORE_CORRECTION).length > 0,
		true,
		'A3-C5-4g: the role scan must CATCH the fallback first candidate',
	);
});
