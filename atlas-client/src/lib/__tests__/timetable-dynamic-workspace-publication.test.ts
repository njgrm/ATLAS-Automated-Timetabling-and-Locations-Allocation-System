import assert from 'node:assert/strict';
import test from 'node:test';

import {
	deriveRunWideReadiness,
	hasSupersededPublicationMarkers,
	isDraftPublishedStrict,
	isRunPublishedStrict,
} from '../../components/timetable/timetableWorkspaceTruth';
import type { RunSummary, Violation } from '../../types';

function violation(severity: 'HARD' | 'SOFT', code = 'FACULTY_TIME_CONFLICT'): Violation {
	return {
		code,
		severity,
		message: 'test violation',
		entities: {},
	} as unknown as Violation;
}

function summary(overrides: Record<string, unknown> = {}): RunSummary {
	return {
		classesProcessed: 0,
		assignedCount: 0,
		unassignedCount: 0,
		policyBlockedCount: 0,
		hardViolationCount: 0,
		...overrides,
	} as unknown as RunSummary;
}

// --- R1 publish gate consumes RUN-WIDE truth, display stays term-scoped ---

test('R1 run-wide hard count from summary blocks publish even when the selected term shows none', () => {
	// Negative control: the selected-term display array has zero HARD violations,
	// but the persisted run summary carries one scoped to an unselected term.
	const display: Violation[] = [];
	const runSummary = summary({ hardViolationCount: 1 });
	const readiness = deriveRunWideReadiness(runSummary, display);
	assert.equal(readiness.hardCount, 1, 'run-wide HARD count must come from the summary');
	assert.notEqual(readiness.hardCount, display.filter((v) => v.severity === 'HARD').length);
});

test('R1 run-wide soft count from summary drives acknowledgement, not the term display', () => {
	const display: Violation[] = [violation('SOFT')];
	const runSummary = summary({ hardViolationCount: 0, softViolationCount: 3 });
	const readiness = deriveRunWideReadiness(runSummary, display);
	assert.equal(readiness.softCount, 3);
});

test('R1 a run with no authoritative summary falls back to the display list', () => {
	const display: Violation[] = [violation('HARD'), violation('SOFT')];
	const readiness = deriveRunWideReadiness(null, display);
	assert.equal(readiness.hardCount, 1);
	assert.equal(readiness.softCount, 1);
	assert.equal(readiness.derivedFromDisplayFallback, true);
});

test('R1 zero run-wide counters are honored instead of the fallback', () => {
	const display: Violation[] = [violation('HARD')];
	const readiness = deriveRunWideReadiness(summary({ hardViolationCount: 0, softViolationCount: 0 }), display);
	assert.equal(readiness.hardCount, 0);
	assert.equal(readiness.softCount, 0);
	assert.equal(readiness.derivedFromDisplayFallback, false);
});

// --- R2 one strict publication predicate everywhere ---

test('R2 a superseded run with stale markers is not published', () => {
	const superseded = { isPublished: false, publishedAt: '2026-01-01T00:00:00.000Z', publishedBy: 7 };
	assert.equal(isRunPublishedStrict(superseded), false, 'isPublished:false must win over stale markers');
	assert.equal(hasSupersededPublicationMarkers(superseded), true);
	assert.equal(isDraftPublishedStrict({ summary: superseded as unknown as RunSummary }), false);
});

test('R2 a truly published run satisfies the strict predicate', () => {
	assert.equal(isRunPublishedStrict({ isPublished: true }), true);
});

test('R2 marker-only summaries are never treated as published', () => {
	assert.equal(isRunPublishedStrict({ publishedAt: '2026-01-01T00:00:00.000Z' }), false);
	assert.equal(isRunPublishedStrict({ publishedBy: 4 }), false);
	assert.equal(isRunPublishedStrict(null), false);
	assert.equal(isRunPublishedStrict(undefined), false);
});
