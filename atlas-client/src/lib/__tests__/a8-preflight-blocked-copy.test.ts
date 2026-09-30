/**
 * A8 (2026-09-30) — a server preflight refusal must name each blocker in plain
 * words and offer the ONE button that opens its fix.
 *
 * The fixture is the REAL live payload measured read-only on 2026-09-30 for
 * school 1 / year 5 (2026-2027): `buildGenerationPreflight(1, 5)` returned
 * `ok=false` with exactly this one blocker, and the live app showed the operator
 * only "Generation is blocked by its read-only preflight..." with no input named
 * and no way forward.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { generationStoppersFromPreflightBlockers } from '@/lib/timetable-capabilities';

/** The exact blocker the live preflight returned (verbatim fields). */
const LIVE_BLOCKER = {
	code: 'TERM_AUTHORITY_UNRESOLVED',
	category: 'DEMAND_AUTHORITY',
	termIdentity: null,
	sectionId: null,
	subjectId: null,
	subjectCode: null,
	entity: 'Ordered term authority · school 1 · year 5',
	reason: 'The active ordered term is unresolved, so the term-scoped teacher availability (HARD exclusions) cannot be applied. Generation is refused rather than run without its HARD authority.',
	owningSurface: 'EnrollPro term authority cache',
	nextAction: 'Resolve or refresh the active ordered term authority, then re-run readiness.',
};

test('the real live blocker becomes one plain-words cause with a real fix button', () => {
	const stoppers = generationStoppersFromPreflightBlockers([LIVE_BLOCKER]);
	assert.equal(stoppers.length, 1);
	const [stopper] = stoppers;
	assert.equal(stopper.line, LIVE_BLOCKER.reason, 'the line is the server\'s own plain reason');
	assert.ok(!/[A-Z][A-Z0-9_]{5,}/.test(stopper.line), `no engine code may leak: ${stopper.line}`);
	assert.equal(stopper.count, null, 'this refusal carries no measured count, so it states no number');
	assert.ok(stopper.href.startsWith('/'), `the button opens a real app path: ${stopper.href}`);
	assert.equal(stopper.href, '/admin/year-setup', 'the term authority is fixed on Year Setup');
	assert.ok(stopper.actionLabel.trim().length > 0, 'the button carries a visible label');
	assert.ok(stopper.shortReason.split(/\s+/).length <= 6, `the short form is at most six words: ${stopper.shortReason}`);
});

test('a second real blocker maps to its own fix route', () => {
	const [stopper] = generationStoppersFromPreflightBlockers([{
		code: 'ROOM_RESOURCE_UNAVAILABLE', category: 'RESOURCE_INFEASIBLE', reason: 'No suitable room is available for this class.',
	}]);
	assert.equal(stopper.href, '/map');
	assert.equal(stopper.line, 'No suitable room is available for this class.');
});

test('a refusal with no readable blockers yields nothing (the caller then says so, not a fabricated list)', () => {
	assert.deepEqual(generationStoppersFromPreflightBlockers(undefined), []);
	assert.deepEqual(generationStoppersFromPreflightBlockers('nope'), []);
	assert.deepEqual(generationStoppersFromPreflightBlockers([{ code: 'X' }]), []);
	assert.deepEqual(generationStoppersFromPreflightBlockers([null, 7]), []);
});
