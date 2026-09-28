import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readSource(relativePath: string): string {
	return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

test('archived Teaching Load history stays GET-only and free of mutation controls', () => {
	const source = readSource('../../components/faculty-assignments/TeachingLoadHistoryView.tsx');
	for (const writeVerb of ['atlasApi.post', 'atlasApi.put', 'atlasApi.patch', 'atlasApi.delete']) {
		assert.equal(source.includes(writeVerb), false, `history view must not call ${writeVerb}`);
	}
	assert.ok(source.includes('atlasApi.get'), 'history view reads through GET requests');
	assert.ok(source.includes('data-testid="teaching-load-history-read-only"'), 'history view renders the read-only banner');
	assert.ok(source.includes('data-testid="teaching-load-history-year-picker"'), 'history view exposes a local archived-year picker');
	assert.ok(source.includes('?view=history') || source.includes("'view', 'history'"), 'history view keeps its own history view parameter');
});

test('Year Setup renders one normal status card and gates destructive reset behind the advanced disclosure', () => {
	const yearSetup = readSource('../../pages/AdminYearSetup.tsx');
	assert.equal((yearSetup.match(/<RolloverGuidanceCard/g) ?? []).length, 1, 'exactly one normal Year Setup status card');
	assert.ok(yearSetup.includes('<RolloverResetPanel schoolId={schoolId} status={status}'), 'reset panel reuses the single loaded status');
	assert.equal(yearSetup.includes('fetchRolloverStatus'), false, 'Year Setup does not add a duplicate status request');

	// A7-C1 (2026-09-28): the page now also passes the opt-in plain-language
	// treatment. The claim is the same one it always was — one card, one status
	// read, the reset behind the advanced disclosure — with one new fact: the
	// plain treatment reaches this page ONLY through the opt-in prop, so the five
	// other mounts of the card keep today's wording.
	assert.ok(
		yearSetup.includes('plainLanguageNextStep'),
		'Year Setup must pass plainLanguageNextStep so the plain next step is the only treatment on this page',
	);
	assert.equal(
		(yearSetup.match(/^\s*plainLanguageNextStep\s*$/gm) ?? []).length,
		1,
		'Year Setup must pass plainLanguageNextStep as a JSX prop exactly once; a second site would be a second card. '
			+ 'Counted as a standalone attribute, not as a word, because the page also names the prop in an explanatory comment.',
	);

	const resetPanel = readSource('../../components/runtime/RolloverResetPanel.tsx');
	assert.ok(resetPanel.includes('if (status?.canResetDummyYear !== true) return null;'), 'destructive reset renders only for disposable dummy data');
	assert.equal(resetPanel.includes('fetchRolloverStatus'), false, 'reset panel does not fetch status itself');
	// A7-C1: the disclosure trigger lost "disposable" from its label. The claim
	// (the destructive reset lives inside the advanced disclosure) is unchanged;
	// only the literal moved. The original literal is retained here as a
	// SUPERSEDED row so the change is additive evidence, not a deleted assertion.
	assert.ok(
		resetPanel.includes('Advanced: clear test data'),
		'destructive reset sits inside the advanced disclosure',
	);
	assert.equal(
		resetPanel.includes('Advanced: clear disposable test data'),
		false,
		'SUPERSEDED 2026-09-28 by A7-C1: the pre-A7-C1 trigger literal "Advanced: clear disposable test data" is gone. '
			+ 'It was replaced by the same disclosure under a shorter label; the claim it protected is the row above.',
	);
	assert.ok(
		resetPanel.includes('Real school years are kept for reference, never erased.'),
		'the disclosure still tells the operator real years are kept, in words rather than as an "archived" instruction',
	);
});

test('the advanced disclosure trigger exposes aria-expanded for keyboard and screen-reader use', () => {
	const accordion = readSource('../../ui/accordion.tsx');
	assert.ok(accordion.includes('aria-expanded={isOpen}'), 'accordion trigger reports its expanded state');
});

test('the year-change banner is explicitly dismissible and expires via changedAt', () => {
	// CLIENT-QUALITY-C01 (deliberate contract change): the notice was persisted
	// to localStorage and re-hydrated on every load with no dismiss control and
	// no expiry. It must now expose a dismiss control wired to removal of the
	// durable cache entry, and a bounded window keyed on `changedAt`.
	const appShell = readSource('../../components/AppShell.tsx');
	assert.ok(appShell.includes('rollover-awareness-dismiss'), 'the banner exposes a dismiss control');
	assert.ok(appShell.includes('clearRolloverAwarenessNotice'), 'dismiss removes the durable notice cache entry');
	assert.ok(appShell.includes('setRolloverNotice(null)'), 'dismiss clears the in-session notice state');

	const awareness = readSource('../../lib/rollover-awareness.ts');
	assert.ok(awareness.includes('ROLLOVER_NOTICE_TTL_MS'), 'a bounded notice window is declared');
	assert.ok(awareness.includes('isRolloverNoticeExpired'), 'expiry is evaluated from changedAt');
	assert.ok(awareness.includes('clearRolloverAwarenessNotice'), 'the durable cache entry can be removed');
});
