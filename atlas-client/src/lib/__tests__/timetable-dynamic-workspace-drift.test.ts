import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { describeRunInputDrift } from '../../components/timetable/timetableDriftRouting';
import { formatCheckedAtAge } from '../../components/timetable/timetableWorkspaceTruth';
import type { GenerationInputComparison } from '../../types';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function inputState(overrides: Partial<GenerationInputComparison> = {}): GenerationInputComparison {
	return {
		status: 'STALE',
		message: 'Setup changed since this run.',
		actionHint: 'Sync or regenerate.',
		changedDomains: [],
		checkedAt: '2026-09-13T00:00:00.000Z',
		...overrides,
	} as GenerationInputComparison;
}

// --- R6 typed source-drift visibility with routed repairs ---

test('R6 each changed domain is surfaced with its own repair home', () => {
	const drift = describeRunInputDrift(inputState({ changedDomains: ['rooms', 'teachingLoad'] }));
	assert.equal(drift.status, 'STALE');
	assert.deepEqual(drift.domains.map((d) => d.domain), ['rooms', 'teachingLoad']);
	assert.equal(drift.domains.find((d) => d.domain === 'rooms')?.href, '/map');
	assert.equal(drift.domains.find((d) => d.domain === 'teachingLoad')?.href, '/teaching-load');
	assert.equal(drift.primaryHref, '/map');
});

test('R6 an unknown comparison state is surfaced, not silently fresh', () => {
	const drift = describeRunInputDrift(inputState({ status: 'UNKNOWN', message: 'Comparison unavailable' }));
	assert.equal(drift.status, 'UNKNOWN');
	assert.equal(drift.message, 'Comparison unavailable');
});

test('R6 a fresh comparison surfaces no domain chips', () => {
	const drift = describeRunInputDrift(inputState({ status: 'FRESH', changedDomains: [] }));
	assert.equal(drift.domains.length, 0);
});

test('R6 a missing comparison is treated as fresh with no invented domains', () => {
	const drift = describeRunInputDrift(null);
	assert.equal(drift.status, 'FRESH');
	assert.deepEqual(drift.domains, []);
});

test('R6 Simple renders the shared drift banner and rollover authority surface', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const banner = source('src/components/timetable/simple/SimpleDriftBanner.tsx');
	assert.match(header, /SimpleDriftBanner/);
	assert.match(banner, /RolloverGuidanceCard/);
	assert.match(banner, /data-testid="timetable-simple-input-drift"/);
	assert.match(banner, /data-testid="timetable-simple-sync-setup"/);
	assert.match(banner, /SetupImpactDialog/);
	// Drift blocks generation in Simple exactly as it does in Advanced.
	assert.match(header, /driftBlocked:/);
});

// --- B-10 cache/checked-at age is surfaced ---

test('B-10 checked-at age is rendered for recent, minutes, and hours', () => {
	const now = Date.parse('2026-09-13T12:00:00.000Z');
	assert.equal(formatCheckedAtAge('2026-09-13T11:59:30.000Z', now), 'checked 30s ago');
	assert.equal(formatCheckedAtAge('2026-09-13T11:30:00.000Z', now), 'checked 30m ago');
	assert.equal(formatCheckedAtAge('2026-09-13T06:00:00.000Z', now), 'checked 6h ago');
});

test('B-10 a missing or malformed checked-at yields no age claim', () => {
	assert.equal(formatCheckedAtAge(null), null);
	assert.equal(formatCheckedAtAge(undefined), null);
	assert.equal(formatCheckedAtAge('not-a-date'), null);
});

test('B-10 both Simple and Advanced surface the checked-at age', () => {
	assert.match(source('src/components/timetable/simple/SimpleDriftBanner.tsx'), /formatCheckedAtAge/);
	assert.match(source('src/components/timetable/ScheduleReviewInputStateBanner.tsx'), /formatCheckedAtAge/);
});
