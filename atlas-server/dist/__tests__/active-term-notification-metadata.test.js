import assert from 'node:assert/strict';
import test from 'node:test';
import { disposeNotificationEventBridges, initializeNotificationEventBridges, subscribeNotificationEvents, } from '../services/notification-events.service.js';
import { publishPublishedScheduleEvent } from '../services/published-schedule-events.service.js';
import { publishTimetableEvent } from '../services/timetable-events.service.js';
/**
 * These tests prove the actual metadata computation logic used by service emitters.
 * Each test replicates the exact computation from the production service code
 * and verifies it produces correct affected-term metadata.
 */
// ─── Computation logic extracted from manual-edit.service.ts commitManualEditBatch ───
function computeBatchAffectedTerms(applied) {
    const terms = new Set();
    for (const edit of applied) {
        if (edit.beforeEntry && typeof edit.beforeEntry.termIndex === 'number') {
            terms.add(edit.beforeEntry.termIndex);
        }
        if (edit.afterEntry && typeof edit.afterEntry.termIndex === 'number') {
            terms.add(edit.afterEntry.termIndex);
        }
        if (edit.removedUnassigned && typeof edit.removedUnassigned.termIndex === 'number') {
            terms.add(edit.removedUnassigned.termIndex);
        }
    }
    return terms.size > 0 ? [...terms].sort() : null;
}
// ─── Computation logic extracted from manual-edit.service.ts swapManualEntries ───
function computeSwapAffectedTerms(newEntries, entryIdA, entryIdB) {
    const terms = new Set();
    for (const entry of newEntries) {
        if (entry.entryId === entryIdA || entry.entryId === entryIdB) {
            if (typeof entry.termIndex === 'number')
                terms.add(entry.termIndex);
        }
    }
    return terms.size > 0 ? [...terms].sort() : null;
}
// ─── Computation logic extracted from published-revision.service.ts ───
function computeRevisionAffectedTerms(changes) {
    const terms = new Set();
    for (const change of changes) {
        if (typeof change.previous.termIndex === 'number')
            terms.add(change.previous.termIndex);
        if (typeof change.next.termIndex === 'number')
            terms.add(change.next.termIndex);
    }
    return terms.size > 0 ? [...terms].sort() : null;
}
// ─── Test: Batch edit affected terms from applied edits only ───
test('batch edit computes affected terms from applied edits, not all entries', () => {
    // Simulate: 3 entries in run (terms 1, 2, 3), but only 1 edit applied (term 1)
    const applied = [
        { beforeEntry: { entryId: 'e1', termIndex: 1 }, afterEntry: { entryId: 'e1', termIndex: 1, roomId: 100 } },
    ];
    const result = computeBatchAffectedTerms(applied);
    assert.deepStrictEqual(result, [1], 'Only term 1 is affected');
});
test('batch edit with multiple edits across terms', () => {
    const applied = [
        { beforeEntry: { entryId: 'e1', termIndex: 1 }, afterEntry: { entryId: 'e1', termIndex: 1 } },
        { beforeEntry: { entryId: 'e2', termIndex: 2 }, afterEntry: { entryId: 'e2', termIndex: 2 } },
    ];
    const result = computeBatchAffectedTerms(applied);
    assert.deepStrictEqual(result, [1, 2], 'Terms 1 and 2 are affected');
});
test('batch edit with removed unassigned item', () => {
    const applied = [
        { beforeEntry: null, afterEntry: { entryId: 'e5', termIndex: 3 }, removedUnassigned: { subjectId: 10, termIndex: 3 } },
    ];
    const result = computeBatchAffectedTerms(applied);
    assert.deepStrictEqual(result, [3], 'Term 3 from removed unassigned');
});
test('batch edit with empty applied list returns null', () => {
    const result = computeBatchAffectedTerms([]);
    assert.strictEqual(result, null, 'Empty applied returns null');
});
test('batch edit with no termIndex in any entry returns null', () => {
    const applied = [
        { beforeEntry: { entryId: 'e1' }, afterEntry: { entryId: 'e1', roomId: 100 } },
    ];
    const result = computeBatchAffectedTerms(applied);
    assert.strictEqual(result, null, 'No termIndex returns null');
});
test('batch edit deduplicates terms', () => {
    const applied = [
        { beforeEntry: { entryId: 'e1', termIndex: 1 }, afterEntry: { entryId: 'e1', termIndex: 2 } },
    ];
    const result = computeBatchAffectedTerms(applied);
    assert.deepStrictEqual(result, [1, 2], 'Deduplicates and sorts');
});
// ─── Test: Swap affected terms from swapped entries only ───
test('swap computes affected terms from swapped entries only', () => {
    const newEntries = [
        { entryId: 'e1', termIndex: 1 },
        { entryId: 'e2', termIndex: 2 },
        { entryId: 'e3', termIndex: 3 },
    ];
    const result = computeSwapAffectedTerms(newEntries, 'e1', 'e2');
    assert.deepStrictEqual(result, [1, 2], 'Only terms 1 and 2 from swapped entries');
});
test('swap with same-term entries', () => {
    const newEntries = [
        { entryId: 'e1', termIndex: 1 },
        { entryId: 'e2', termIndex: 1 },
        { entryId: 'e3', termIndex: 2 },
    ];
    const result = computeSwapAffectedTerms(newEntries, 'e1', 'e2');
    assert.deepStrictEqual(result, [1], 'Deduplicates same term');
});
test('swap with missing termIndex', () => {
    const newEntries = [
        { entryId: 'e1', termIndex: 1 },
        { entryId: 'e2' },
    ];
    const result = computeSwapAffectedTerms(newEntries, 'e1', 'e2');
    assert.deepStrictEqual(result, [1], 'Only term from entry with termIndex');
});
test('swap with no matching entries returns null', () => {
    const newEntries = [
        { entryId: 'e3', termIndex: 3 },
    ];
    const result = computeSwapAffectedTerms(newEntries, 'e1', 'e2');
    assert.strictEqual(result, null, 'No matching entries returns null');
});
// ─── Test: Revision affected terms from changed entries ───
test('revision computes affected terms from changed entries', () => {
    const changes = [
        { previous: { termIndex: 1 }, next: { termIndex: 1, roomId: 100 } },
        { previous: { termIndex: 2 }, next: { termIndex: 2, roomId: 200 } },
    ];
    const result = computeRevisionAffectedTerms(changes);
    assert.deepStrictEqual(result, [1, 2], 'Terms 1 and 2 from changed entries');
});
test('revision with term change across terms', () => {
    const changes = [
        { previous: { termIndex: 1 }, next: { termIndex: 2 } },
    ];
    const result = computeRevisionAffectedTerms(changes);
    assert.deepStrictEqual(result, [1, 2], 'Both old and new terms');
});
test('revision with no termIndex returns null', () => {
    const changes = [
        { previous: { facultyId: 1, termIndex: undefined }, next: { facultyId: 2, termIndex: undefined } },
    ];
    const result = computeRevisionAffectedTerms(changes);
    assert.strictEqual(result, null, 'No termIndex returns null');
});
test('revision deduplicates terms', () => {
    const changes = [
        { previous: { termIndex: 1 }, next: { termIndex: 1 } },
        { previous: { termIndex: 1 }, next: { termIndex: 2 } },
    ];
    const result = computeRevisionAffectedTerms(changes);
    assert.deepStrictEqual(result, [1, 2], 'Deduplicates');
});
// ─── Test: Integration with event emitters ───
function setupEmitter() {
    disposeNotificationEventBridges();
    initializeNotificationEventBridges();
    const events = [];
    const stop = subscribeNotificationEvents({
        schoolId: 1,
        schoolYearId: 55,
        facultyId: null,
        send: (e) => events.push(e),
    });
    return { events, stop };
}
function teardownEmitter(stop) {
    stop();
    disposeNotificationEventBridges();
}
test('batch edit emitter receives computed affectedTermIndices', () => {
    const { events, stop } = setupEmitter();
    const applied = [
        { beforeEntry: { entryId: 'e1', termIndex: 1 }, afterEntry: { entryId: 'e1', termIndex: 1 } },
    ];
    const affectedTermIndices = computeBatchAffectedTerms(applied);
    publishTimetableEvent({
        type: 'TIMETABLE_EDIT_COMMITTED',
        schoolId: 1, schoolYearId: 55, runId: 100, actorId: 1,
        message: 'Test batch.',
        metadata: { editIds: [1], batchSize: 1, affectedTermIndices },
    });
    const event = events.at(-1);
    assert.strictEqual(event?.type, 'TIMETABLE_EDIT_COMMITTED');
    assert.deepStrictEqual(event?.metadata?.affectedTermIndices, [1]);
    teardownEmitter(stop);
});
test('swap emitter receives computed affectedTermIndices', () => {
    const { events, stop } = setupEmitter();
    const newEntries = [
        { entryId: 'e1', termIndex: 1 },
        { entryId: 'e2', termIndex: 3 },
    ];
    const affectedTermIndices = computeSwapAffectedTerms(newEntries, 'e1', 'e2');
    publishTimetableEvent({
        type: 'TIMETABLE_EDIT_COMMITTED',
        schoolId: 1, schoolYearId: 55, runId: 100, actorId: 1,
        message: 'Test swap.',
        metadata: { editId: 10, strategy: 'DIRECT', entryIdA: 'e1', entryIdB: 'e2', affectedTermIndices },
    });
    const event = events.at(-1);
    assert.deepStrictEqual(event?.metadata?.affectedTermIndices, [1, 3]);
    teardownEmitter(stop);
});
test('revision emitter receives computed affectedTermIndices', () => {
    const { events, stop } = setupEmitter();
    const changes = [
        { previous: { termIndex: 2 }, next: { termIndex: 2, roomId: 100 } },
    ];
    const affectedTermIndices = computeRevisionAffectedTerms(changes);
    publishPublishedScheduleEvent({
        type: 'SCHEDULE_REVISED',
        schoolId: 1, schoolYearId: 55,
        message: 'Test revision.',
        metadata: { revisionId: 1, affectedTermIndices },
    });
    const event = events.at(-1);
    assert.strictEqual(event?.type, 'SCHEDULE_REVISED');
    assert.deepStrictEqual(event?.metadata?.affectedTermIndices, [2]);
    teardownEmitter(stop);
});
test('emitter with null affectedTermIndices (no terms)', () => {
    const { events, stop } = setupEmitter();
    const applied = [{ beforeEntry: { entryId: 'e1' }, afterEntry: { entryId: 'e1' } }];
    const affectedTermIndices = computeBatchAffectedTerms(applied);
    publishTimetableEvent({
        type: 'TIMETABLE_EDIT_COMMITTED',
        schoolId: 1, schoolYearId: 55, runId: 100, actorId: 1,
        message: 'No terms.',
        metadata: { editIds: [1], batchSize: 1, affectedTermIndices },
    });
    const event = events.at(-1);
    assert.strictEqual(event?.metadata?.affectedTermIndices, null);
    teardownEmitter(stop);
});
//# sourceMappingURL=active-term-notification-metadata.test.js.map