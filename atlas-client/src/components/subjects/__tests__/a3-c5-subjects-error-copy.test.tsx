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
		'This subject carries a scheduling setting that ATLAS maintains for you, so it cannot be changed here.',
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

/** Everything an operator is ever shown: the three copy fields together. */
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
			'ATLAS could not complete that subject change.',
			`${code}: unknown code must fall back to the fixed generic sentence`,
		);
		assert.ok(copy.nextAction.length > 20, `${code}: generic fallback still needs a next action`);
	}
});

test('A3-C5-4d: missing, empty and malformed codes behave sanely', () => {
	const hostile = 'Cannot modify protected fields: isSeedable, isSystemManaged.';
	// No response body at all — the ordinary network failure.
	for (const payload of [undefined, null, {}]) {
		const copy = resolveSubjectMutationErrorCopy(payload);
		assert.equal(copy.code, null);
		assert.equal(copy.rawMessage, '');
		assert.equal(copy.description, 'ATLAS could not complete that subject change.');
		assert.equal(copy.message, `${copy.description} ${copy.nextAction}`);
		assert.ok(!operatorVisibleText(copy).includes(hostile));
	}
	// Empty / whitespace / non-string code and message.
	for (const code of ['', '   ', 42, null, undefined, { nested: true }]) {
		const copy = resolveSubjectMutationErrorCopy({ code, message: hostile });
		assert.equal(copy.code, null, `code ${JSON.stringify(code)} must normalise to null`);
		assert.equal(copy.description, 'ATLAS could not complete that subject change.');
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
