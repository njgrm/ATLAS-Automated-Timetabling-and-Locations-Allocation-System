import assert from 'node:assert/strict';
import test from 'node:test';

import {
	describeForAudience,
	describeLifecycle,
	describeNewerDraft,
	describePublication,
	deriveScheduleLifecycle,
	hasPublication,
	isLive,
	type LifecycleInput,
} from '../schedule-lifecycle';

/**
 * SCHEDULE-LIFECYCLE-C01 acceptance (handoff "Lifecycle candidate"):
 *   1. unit tests cover published-only, reviewing-draft-only, and
 *      published-plus-newer-draft;
 *   2. draft rows are never marked Live.
 *
 * The fixtures use the run identities measured on the deployed release:
 * published run 317 revision 43 on 2026-09-22, newer completed run 318 on
 * 2026-09-25, published termIndex 1 with activeTermVerified true.
 */

const PUBLISHED_317 = { runId: 317, publishedAt: '2026-09-22T23:22:04.198Z', revisionId: 43, termIndex: 1, termLabel: 'TERM 1', termVerified: true };
const DRAFT_318 = { runId: 318, finishedAt: '2026-09-25T08:13:36.961Z', status: 'COMPLETED', hardViolationCount: 0 };

test('PUBLISHED_ONLY: publication date, revision and the term it represents are all stated', () => {
	const lc = deriveScheduleLifecycle({ publication: PUBLISHED_317, draft: null });
	assert.equal(lc.kind, 'PUBLISHED_ONLY');
	assert.equal(isLive(lc), true);
	const sentence = describeLifecycle(lc);
	assert.match(sentence, /Published 2026-09-22/, 'the publication date must be stated');
	assert.match(sentence, /run 317/, 'the published run must be named');
	assert.match(sentence, /revision 43/, 'the revision must be named');
	assert.match(sentence, /TERM 1/, 'the term the revision represents must be stated');
	assert.equal(describeNewerDraft(lc), null, 'there is no newer draft to describe');
});

test('DRAFT_ONLY: a generated run is a draft and is NOT Live', () => {
	const lc = deriveScheduleLifecycle({ publication: null, draft: DRAFT_318 });
	assert.equal(lc.kind, 'DRAFT_ONLY');
	assert.equal(isLive(lc), false, 'a draft must never be Live');
	assert.equal(hasPublication(lc), false);
	assert.equal(describePublication(lc), null, 'a draft has no publication sentence');
	const sentence = describeLifecycle(lc);
	assert.match(sentence, /Draft only: run 318/);
	assert.match(sentence, /Not published/);
	assert.doesNotMatch(sentence, /\bLive\b/i, 'no wording about a draft may claim it is live');
});

test('PUBLISHED_WITH_NEWER_DRAFT: both are named, each labelled, and the draft is never Live', () => {
	const lc = deriveScheduleLifecycle({ publication: PUBLISHED_317, draft: DRAFT_318 });
	assert.equal(lc.kind, 'PUBLISHED_WITH_NEWER_DRAFT');
	assert.equal(isLive(lc), true, 'the lifecycle is live because a real publication exists');

	const published = describePublication(lc) as string;
	const draft = describeNewerDraft(lc) as string;

	// Each half is separately labelled, which is what the four surfaces lacked.
	assert.match(published, /^Published /, 'the publication half must be labelled Published');
	assert.match(draft, /^Newer draft awaiting publication/, 'the draft half must be labelled as a draft');
	assert.match(draft, /run 318/);
	assert.match(draft, /2026-09-25/);
	assert.match(draft, /no blocking issues/, 'readiness comes from the facts, not from optimism');

	const sentence = describeLifecycle(lc);
	assert.ok(sentence.includes(published) && sentence.includes(draft), 'both halves must appear in the one sentence');

	// The load-bearing invariant: the newer draft is never described as live.
	assert.doesNotMatch(draft, /\bLive\b/i, 'the newer-draft sentence must never contain Live');
	assert.doesNotMatch(describeLifecycle({ kind: 'DRAFT_ONLY', publication: null, draft: DRAFT_318 }), /\blive\b/i);
});

test('a draft that IS the published run is the same schedule, not a newer one', () => {
	// Regression guard: a surface that re-reads the published run as "the latest
	// run" would otherwise tell a scheduler a published schedule is awaiting
	// publication.
	const lc = deriveScheduleLifecycle({ publication: PUBLISHED_317, draft: { ...PUBLISHED_317, runId: 317 } });
	assert.equal(lc.kind, 'PUBLISHED_ONLY');
	assert.equal(describeNewerDraft(lc), null);
});

test('UNVERIFIED: no publication facts yields uncertainty, never an assertion', () => {
	const lc = deriveScheduleLifecycle({ publication: null, draft: null });
	assert.equal(lc.kind, 'UNVERIFIED');
	assert.equal(isLive(lc), false);
	const sentence = describeLifecycle(lc);
	// The intent is "no completed publication is ASSERTED", not "the word published
	// is banned" — an honest "could not confirm whether a schedule has been
	// published" must still be allowed to say so.
	assert.doesNotMatch(sentence, /^Published\b/, 'must not open by asserting a publication');
	assert.doesNotMatch(sentence, /\bis live\b/i, 'must not assert the schedule is live');
	assert.match(sentence, /could not confirm/i, 'must state the uncertainty');
});

test('UNVERIFIED: a publication with an UNVERIFIED term states the uncertainty and hides the term', () => {
	// The handoff: "If the underlying facts are insufficient to answer, display that
	// uncertainty rather than asserting a completed publication."
	const lc = deriveScheduleLifecycle({ publication: { ...PUBLISHED_317, termVerified: false } });
	assert.equal(lc.kind, 'UNVERIFIED');
	assert.equal(lc.reason, 'TERM_UNVERIFIED');
	assert.equal(isLive(lc), false, 'an unverified term must not yield a Live claim');
	const sentence = describeLifecycle(lc);
	assert.match(sentence, /could not be verified/);
	assert.doesNotMatch(sentence, /TERM 1/, 'the unverified term must not be printed');
});

test('a publication without a real timestamp is not a publication', () => {
	// "Live" is a property of a publication EVENT, so a row with no publishedAt is
	// not one — this is the row-existence inference the handoff forbids.
	for (const bad of [{ runId: 317 }, { runId: 317, publishedAt: '' }, { runId: 317, publishedAt: '   ' }, { publishedAt: '2026-09-22T00:00:00Z' }]) {
		const lc = deriveScheduleLifecycle({ publication: bad as never, draft: DRAFT_318 });
		assert.equal(lc.kind, 'DRAFT_ONLY', `publication ${JSON.stringify(bad)} must not count as published`);
		assert.equal(isLive(lc), false);
	}
});

test('every state names its audience without changing the facts', () => {
	const cases: Array<[string, LifecycleInput]> = [
		['PUBLISHED_ONLY', { publication: PUBLISHED_317 }],
		['PUBLISHED_WITH_NEWER_DRAFT', { publication: PUBLISHED_317, draft: DRAFT_318 }],
		['DRAFT_ONLY', { draft: DRAFT_318 }],
		['UNVERIFIED', {}],
	];
	for (const [kind, input] of cases) {
		const lc = deriveScheduleLifecycle(input);
		assert.equal(lc.kind, kind);
		for (const audience of ['SCHEDULER', 'TEACHER', 'PUBLIC'] as const) {
			const sentence = describeForAudience(lc, audience);
			assert.ok(sentence.length > 0, `${kind}/${audience} must produce a sentence`);
			// The audience note must not change the underlying claim.
			if (kind === 'PUBLISHED_WITH_NEWER_DRAFT' || kind === 'PUBLISHED_ONLY') {
				assert.ok(sentence.includes(describeLifecycle(lc)), `${kind}/${audience} must contain the base claim`);
			}
			if (kind === 'DRAFT_ONLY' || kind === 'UNVERIFIED') {
				assert.doesNotMatch(sentence, /\bLive\b/i, `${kind}/${audience} must never claim Live`);
			}
		}
	}
});

test('MUTANT: if isLive stopped consulting the publication, the draft cases would still claim it', () => {
	// Proves the suite would catch the exact regression this cycle exists to stop.
	const draftOnly = deriveScheduleLifecycle({ draft: DRAFT_318 });
	const brokenIsLive = (lc: { kind: string }) => lc.kind !== 'UNVERIFIED';
	assert.equal(isLive(draftOnly), false, 'the real predicate says a draft is not live');
	assert.equal(brokenIsLive(draftOnly), true, 'a predicate that only checks for uncertainty would wrongly say live');
	assert.equal(isLive(deriveScheduleLifecycle({ publication: PUBLISHED_317 })), true);
});
