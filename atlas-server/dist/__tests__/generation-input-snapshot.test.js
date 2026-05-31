import test from 'node:test';
import assert from 'node:assert/strict';
import { compareGenerationInputSnapshots, } from '../services/generation-input-snapshot.service.js';
function snapshot(overrides) {
    const base = {
        schemaVersion: 1,
        schoolId: 1,
        schoolYearId: 55,
        computedAt: '2026-05-31T00:00:00.000Z',
        fingerprint: 'all-fresh',
        domains: {
            teachingLoad: { fingerprint: 'teaching-load-1', signals: { count: 1 } },
            policy: { fingerprint: 'policy-1', signals: { count: 1 } },
            rooms: { fingerprint: 'rooms-1', signals: { count: 1 } },
            sections: { fingerprint: 'sections-1', signals: { count: 1 } },
            subjects: { fingerprint: 'subjects-1', signals: { count: 1 } },
        },
    };
    return { ...base, ...overrides };
}
test('compareGenerationInputSnapshots reports fresh when all domains match', () => {
    const result = compareGenerationInputSnapshots(snapshot(), snapshot(), '2026-05-31T01:00:00.000Z');
    assert.equal(result.status, 'FRESH');
    assert.deepEqual(result.changedDomains, []);
    assert.equal(result.missingReason, undefined);
});
test('compareGenerationInputSnapshots reports changed domains when inputs drift', () => {
    const current = snapshot({
        fingerprint: 'changed',
        domains: {
            ...snapshot().domains,
            teachingLoad: { fingerprint: 'teaching-load-2', signals: { count: 2 } },
            rooms: { fingerprint: 'rooms-2', signals: { count: 2 } },
        },
    });
    const result = compareGenerationInputSnapshots(snapshot(), current, '2026-05-31T01:00:00.000Z');
    assert.equal(result.status, 'STALE');
    assert.deepEqual(result.changedDomains, ['teachingLoad', 'rooms']);
    assert.match(result.message, /changed after this draft was generated/i);
});
test('compareGenerationInputSnapshots reports unknown for runs without snapshots', () => {
    const result = compareGenerationInputSnapshots(null, snapshot(), '2026-05-31T01:00:00.000Z');
    assert.equal(result.status, 'UNKNOWN');
    assert.equal(result.missingReason, 'MISSING_RUN_SNAPSHOT');
    assert.deepEqual(result.changedDomains, []);
});
//# sourceMappingURL=generation-input-snapshot.test.js.map