import assert from 'node:assert/strict';
import test from 'node:test';

import { canRebaseManualEdits, type ConcurrentManualEdit } from '../services/manual-edit-concurrency.service.js';

const move = (entryId: string) => ({ editType: 'MOVE_ENTRY' as const, entryId, targetDay: 'TUESDAY', targetStartTime: '10:00', targetEndTime: '11:00' });
const placement = (unassignedKey: string) => ({ editType: 'PLACE_UNASSIGNED' as const, unassignedKey, sectionId: 1, subjectId: 2, session: 1 });
const record = (entryId: string, batchSize = 1, batchIndex = 0): ConcurrentManualEdit => ({
	id: batchIndex + 1,
	editType: 'MOVE_ENTRY',
	beforePayload: { entryId },
	afterPayload: { entryId },
	validationSummary: { batchSize, batchIndex },
});

test('same-base edits on distinct entries can be rebased; the same entry is a semantic conflict', () => {
	assert.equal(canRebaseManualEdits([move('entry-a')], [record('entry-b')], 1), true);
	assert.equal(canRebaseManualEdits([move('entry-a')], [record('entry-a')], 1), false);
});

test('quick-place operations rebase only when their exact unassigned identities differ', () => {
	const prior: ConcurrentManualEdit = {
		...record('new-entry'),
		validationSummary: { batchSize: 1, batchIndex: 0, removedUnassignedItem: { sectionId: 1, subjectId: 2, session: 1 } },
	};
	assert.equal(canRebaseManualEdits([placement('1:3:1')], [prior], 1), true);
	assert.equal(canRebaseManualEdits([placement('1:2:1')], [prior], 1), false);
});

test('incomplete history, swaps, and destructive operations fail closed', () => {
	assert.equal(canRebaseManualEdits([move('entry-a')], [], 1), false);
	assert.equal(canRebaseManualEdits([move('entry-a')], [record('entry-b')], 2), false);
	assert.equal(canRebaseManualEdits([{ editType: 'REVERT', entryId: 'entry-a' }], [record('entry-b')], 1), false);
	assert.equal(canRebaseManualEdits([{ editType: 'SWAP_ENTRIES', metadata: { entryIdA: 'entry-a', entryIdB: 'entry-b' } }], [record('entry-c')], 1), false);
});
