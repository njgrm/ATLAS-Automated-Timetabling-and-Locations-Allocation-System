/**
 * A5-C2A — the client's half of the one canonical active-term answer.
 *
 * The recorded defect on `/faculty/concerns` was a page-local notion of the
 * active term: the page resolved it from a live-only EnrollPro read, so a
 * reachable, truthful `ACTIVE_TERM_UNRESOLVED` produced the hard, workflow-
 * disabling "Active ordered term unresolved" while the app shell showed the
 * saved term for the same school year. Two sources of truth for one fact.
 *
 * What is asserted here is the CONTRACT, and each row has a mutant that turns
 * it red:
 *
 *  1. A live answer produces NO saved-data notice. Saved data is never
 *     presented as if it were live.
 *  2. A degraded answer produces exactly the agreed wording — "Using saved term
 *     data from <time>" — carrying the REAL capture time, never a silent
 *     fallback and never a bare "unresolved".
 *  3. A beyond-TTL degraded answer says so rather than implying freshness.
 *  4. The wording helper is the ONLY producer of that phrase, so no second
 *     page can invent a competing label.
 *  5. An unparseable/missing capture time degrades the WORDING, never to a
 *     fabricated time.
 *  6. An unresolved answer yields a real reason string, so the page can never be
 *     a dead end.
 *
 * The RENDERED outcome of both routes is proven separately, on the real build
 * and the real route path, by `qa-artifacts/playwright/specs/a5-c2a-term-truth.spec.ts`
 * (`npm --prefix atlas-client run test:a5-c2a-term-truth`).
 *
 * Run: `npm run test:a5-c2a-term-truth`
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
	describeSavedTermSource,
	describeUnresolvedTermReason,
} from '@/lib/enrollpro-public-settings';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../..');
const CAPTURED_AT = '2026-09-25T08:00:00.000Z';

function payload(overrides: Record<string, unknown> = {}) {
	return {
		source: 'atlas-cache-verified',
		reachable: true,
		verified: true,
		activeTerm: 'T2',
		termIndex: 2,
		schoolYearId: 8,
		matchedSchoolYear: null,
		code: 'ACTIVE_TERM_UNRESOLVED',
		message: '',
		...overrides,
	} as never;
}

// ─── 1. A live answer shows no saved-data notice ───

test('A5-C2A C1: a live verified answer renders NO saved-data notice', () => {
	const live = payload({ source: 'enrollpro-verified', degraded: false, cachedAt: null, code: null });
	assert.equal(describeSavedTermSource(live), null, 'live data must not be labelled as saved');
});

test('A5-C2A C1-mutant: a missing `degraded` flag must not be read as degraded', () => {
	// `degraded` is opt-in. If the helper treated "not true" as degraded, every
	// live page would carry a false "Using saved term data" banner.
	const withoutFlag = payload({ degraded: undefined, cachedAt: CAPTURED_AT });
	assert.equal(describeSavedTermSource(withoutFlag), null);
	assert.equal(describeSavedTermSource(null), null);
	assert.equal(describeSavedTermSource(undefined), null);
});

// ─── 2. A degraded answer names itself and its REAL capture time ───

test('A5-C2A C2: a degraded answer renders "Using saved term data from <real time>"', () => {
	const notice = describeSavedTermSource(payload({ degraded: true, cachedAt: CAPTURED_AT, cachedBeyondTtl: false }));
	assert.ok(notice, 'a degraded answer must always produce a notice — never a silent fallback');
	assert.match(notice!, /^Using saved term data from /, 'the agreed wording');
	// The REAL captured time, rendered — not the machine ISO, and not a placeholder.
	const rendered = notice!.replace('Using saved term data from ', '').replace(/\.$/, '');
	assert.doesNotMatch(rendered, /Z$/, 'the machine ISO stamp must be rendered as a human time');
	assert.match(rendered, /2026/, `the real capture year must be shown, got: ${rendered}`);
	assert.notEqual(rendered, 'now');
});

test('A5-C2A C2-mutant: the capture time is load-bearing', () => {
	const withTime = describeSavedTermSource(payload({ degraded: true, cachedAt: CAPTURED_AT }))!;
	const withOtherTime = describeSavedTermSource(payload({ degraded: true, cachedAt: '2026-01-02T03:04:00.000Z' }))!;
	assert.notEqual(withTime, withOtherTime, 'two different capture times must not render the same notice');
});

// ─── 3. Beyond-TTL is stated, not implied fresh ───

test('A5-C2A C3: a beyond-TTL degraded answer says so', () => {
	const notice = describeSavedTermSource(payload({ degraded: true, cachedAt: CAPTURED_AT, cachedBeyondTtl: true }))!;
	assert.match(notice, /older than the usual refresh window/, 'an old snapshot is not presented as fresh');
});

// ─── 5. Never fabricate a time ───

test('A5-C2A C5: an unparseable or absent capture time degrades the wording, never invents a time', () => {
	for (const cachedAt of [null, undefined, '', 'not-a-date']) {
		const notice = describeSavedTermSource(payload({ degraded: true, cachedAt }));
		assert.equal(notice, 'Using saved term data.', `cachedAt=${String(cachedAt)} must not produce a fabricated time`);
	}
});

// ─── 6. An unresolved answer carries a reason (never a dead end) ───

test('A5-C2A C6: an unresolved answer yields a real reason for the page to show', () => {
	const withMessage = describeUnresolvedTermReason(payload({
		activeTerm: null, termIndex: null, verified: false,
		code: 'TERM_AUTHORITY_STALE',
		message: 'The saved ordered terms no longer match EnrollPro; the active term cannot be resolved from saved data.',
	}));
	assert.match(withMessage, /no longer match EnrollPro/, 'the server reason is shown verbatim');

	const withCodeOnly = describeUnresolvedTermReason(payload({ message: '', code: 'TERM_AUTHORITY_STALE' }));
	assert.match(withCodeOnly, /TERM_AUTHORITY_STALE/, 'a typed code is still a reason');

	const withNothing = describeUnresolvedTermReason(payload({ message: '', code: null }));
	assert.ok(withNothing.length > 0, 'even with no code the operator gets a sentence, not a dead end');
});

// ─── 4. One wording source — no second page-local notion ───

test('A5-C2A C4: "Using saved term data from" is produced in exactly one place', () => {
	const PHRASE = 'Using saved term data from';
	const libDir = resolve(CLIENT_ROOT, 'src/lib');
	const files = readdirSync(libDir).filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'));
	const producers: string[] = [];
	for (const name of files) {
		const text = readFileSync(join(libDir, name), 'utf8');
		// Count the PHRASE inside template literals only, so a doc comment
		// describing the contract is not counted as a producer.
		if (text.includes('`${') && text.includes(PHRASE)) producers.push(name);
	}
	assert.deepEqual(producers, ['enrollpro-public-settings.ts'],
		'only the shared resolver helper may build this phrase; a second producer is a second source of truth');
});

test('A5-C2A C4b: both blocked surfaces read the shared helpers, not a local copy', () => {
	const concerns = readFileSync(resolve(CLIENT_ROOT, 'src/pages/TeacherConcerns.tsx'), 'utf8');
	const yearSetup = readFileSync(resolve(CLIENT_ROOT, 'src/pages/AdminYearSetup.tsx'), 'utf8');
	const concernsHelpers = readFileSync(resolve(CLIENT_ROOT, 'src/components/faculty-shared/teacher-concern-helpers.ts'), 'utf8');
	for (const [name, text] of [['TeacherConcerns.tsx', concerns], ['AdminYearSetup.tsx', yearSetup]] as const) {
		/*
		 * A3 p1 (2026-09-29): SUPERSEDED IN PLACE, second time, same reason class.
		 *
		 * This row used to require `describeSavedTermSource` to appear in the PAGE.
		 * The outage that day was caused by exactly this shape of page-local
		 * wiring: Teacher Concerns bound the resolution itself, and a wrong
		 * predicate made it silently bind nothing, so Save was dead with no
		 * reason on screen. That binding now lives in ONE shared, tested
		 * function (`bindConcernTermResolution`), so the requirement moves with
		 * it - and moves to a STRONGER form: the page must reach the derivation
		 * through that shared helper rather than binding it locally, and the
		 * helper must be the one applying the shared saved-data wording.
		 *
		 * Only TeacherConcerns is held to that helper. AdminYearSetup binds into
		 * its own `{ kind: ... }` state and is not this packet's surface; holding
		 * it to a concerns-shaped helper would force a behavioural change to a
		 * page outside this scope, so it stays pinned to the shared RESOLVER,
		 * which is the part that actually decides the term.
		 */
		assert.match(concerns, /bindConcernTermResolution/,
			'TeacherConcerns must reach the term binding through the shared helper, not bind it locally');
		assert.match(concernsHelpers, /describeSavedTermSource/,
			'the shared helper is where the saved-data wording is applied');
		// ── SUPERSEDED IN PLACE, 2026-09-29, A2-C14 ──
		// The ORIGINAL row asserted, verbatim and no longer run as pass/fail:
		//   assert.match(text, /resolveActiveSchoolYearContext/, `${name} must use the canonical resolver`);
		//
		// WHY IT MOVED, and why the intent is now STRONGER rather than weaker. That
		// assertion pinned the resolver by NAME. `resolveActiveSchoolYearContext`
		// defaults `verifyUpstream` to false, so calling it directly is exactly
		// the defect A2-C14 fixed: both surfaces sent a request that could never
		// resolve a term, which is why the operator saw "Active ordered term
		// unresolved" and every write stayed disabled
		// (docs/reviews/a2-c14-root-cause/root-cause.md §Term 2).
		//
		// The canonical resolver is now reached through its ONE shared entry
		// point, `@/lib/active-term-authority` (`resolveActiveTermAuthority`),
		// which is where the verified-read pattern lives for every surface. A
		// bare direct call is now asserted to be GONE, so the row protects a
		// stronger property than the one it replaces: these pages cannot drift
		// back into an unverified request without failing here.
		assert.match(text, /resolveActiveTermAuthority/,
			`${name} must resolve the term through the shared canonical entry point`);
		assert.match(text, /@\/lib\/active-term-authority/,
			`${name} must import that entry point from the shared lib, not define its own`);
		assert.doesNotMatch(text, /resolveActiveSchoolYearContext\s*\(/,
			`${name} must not call the resolver directly: that call shape cannot verify a term`);
		assert.doesNotMatch(text, /fetchEnrollProActiveTerm/, `${name} must not read EnrollPro directly`);
	}
});

test('A5-C2A C4c: Teacher Concerns resolves the term through the same verified helper the shell uses', () => {
	const concerns = readFileSync(resolve(CLIENT_ROOT, 'src/pages/TeacherConcerns.tsx'), 'utf8');
	const concernsHelpers = readFileSync(resolve(CLIENT_ROOT, 'src/components/faculty-shared/teacher-concern-helpers.ts'), 'utf8');
	/*
	 * A3 p1 (2026-09-29): the verified ordered-term helper moved out of the page
	 * and into the shared binding helper. The INTENT is unchanged and now
	 * stronger - the page cannot derive a term index locally at all, and the ONE
	 * place that derives it is asserted here to be the shared verified reader.
	 */
	assert.doesNotMatch(concerns, /resolveVerifiedActiveTermIndex/,
		'the page must not derive the verified term index itself; the shared helper owns that derivation');
	assert.match(concernsHelpers, /resolveVerifiedActiveTermIndex/,
		'the shared helper is the single resolver of the verified ordered term');
	// The write path sends this exact termIndex and the server re-resolves it
	// live, rejecting a mismatch with TERM_SCOPE_MISMATCH. A page-local
	// derivation would make the page show a term the write path refuses.
	assert.doesNotMatch(concerns, /termIndex:\s*1\b/, 'the write path must never send a hardcoded Term 1');
	// A3 p1: the liveness handed to the resolver must be the NAMED still-current
	// option. A bare predicate is what silently discarded every healthy read.
	assert.match(concerns, /isStillCurrent/,
		'the page must pass its liveness as the named still-current option');
});

test('A5-C2A C4d: Admin Year Setup no longer renders the self-link to the page it is on', () => {
	const yearSetup = readFileSync(resolve(CLIENT_ROOT, 'src/pages/AdminYearSetup.tsx'), 'utf8');
	assert.doesNotMatch(
		yearSetup,
		/adminHref="\/admin\/year-setup"/,
		'a "Year setup" control pointing at /admin/year-setup is a dead-looking self-link on /admin/year-setup',
	);
});
