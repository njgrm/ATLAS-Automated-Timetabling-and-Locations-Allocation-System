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

	const resetPanel = readSource('../../components/runtime/RolloverResetPanel.tsx');
	assert.ok(resetPanel.includes('if (status?.canResetDummyYear !== true) return null;'), 'destructive reset renders only for disposable dummy data');
	assert.equal(resetPanel.includes('fetchRolloverStatus'), false, 'reset panel does not fetch status itself');
	assert.ok(resetPanel.includes('Advanced: clear disposable test data'), 'destructive reset sits inside the advanced disclosure');
});

test('the advanced disclosure trigger exposes aria-expanded for keyboard and screen-reader use', () => {
	const accordion = readSource('../../ui/accordion.tsx');
	assert.ok(accordion.includes('aria-expanded={isOpen}'), 'accordion trigger reports its expanded state');
});
