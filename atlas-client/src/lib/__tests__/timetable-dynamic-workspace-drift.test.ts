import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { describeRunInputDrift, domainRequiresRegeneration } from '../../components/timetable/timetableDriftRouting';
import { formatCheckedAtAge } from '../../components/timetable/timetableWorkspaceTruth';
import type { GenerationInputComparison, GenerationInputDomain } from '../../types';

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

// --- S4-client / D5 — all seven domains + explicit regeneration ---

test('D5 every GenerationInputDomain has a labelled repair home', () => {
	const all: GenerationInputDomain[] = ['teachingLoad', 'policy', 'rooms', 'sections', 'subjects', 'derivedDemand', 'availability'];
	const drift = describeRunInputDrift(inputState({ changedDomains: all }));
	assert.deepEqual(drift.domains.map((domain) => domain.domain), all);
	for (const domain of drift.domains) {
		assert.ok(domain.label.length > 0, `${domain.domain} carries a label`);
		assert.ok(domain.href.startsWith('/'), `${domain.domain} carries a mounted-style href`);
	}
	assert.equal(drift.domains.find((domain) => domain.domain === 'derivedDemand')?.label, 'Derived demand');
	assert.equal(drift.domains.find((domain) => domain.domain === 'availability')?.label, 'Teacher availability');
	assert.equal(drift.domains.find((domain) => domain.domain === 'derivedDemand')?.href, '/admin/year-setup');
	assert.equal(drift.domains.find((domain) => domain.domain === 'availability')?.href, '/faculty');
});

test('D5 availability and derivedDemand produce a chip, not an umbrella fallback', () => {
	for (const [domain, href] of [['availability', '/faculty'], ['derivedDemand', '/admin/year-setup']] as const) {
		const drift = describeRunInputDrift(inputState({ changedDomains: [domain] }));
		assert.equal(drift.domains.length, 1, `${domain} produces exactly one chip`);
		assert.equal(drift.domains[0].domain, domain);
		assert.equal(drift.primaryHref, href);
		assert.equal(drift.requiresRegeneration, true);
	}
});

test('D5 a syncable-only change does not demand regeneration', () => {
	const drift = describeRunInputDrift(inputState({ changedDomains: ['rooms', 'sections', 'subjects', 'teachingLoad'] }));
	assert.equal(drift.requiresRegeneration, false);
	for (const domain of ['teachingLoad', 'rooms', 'sections', 'subjects'] as const) {
		assert.equal(domainRequiresRegeneration(domain), false, `${domain} is sync-applicable`);
	}
	for (const domain of ['policy', 'derivedDemand', 'availability'] as const) {
		assert.equal(domainRequiresRegeneration(domain), true, `${domain} requires regeneration`);
	}
});

test('D5 a runtime-unknown domain still routes to the umbrella Year Setup primary', () => {
	const drift = describeRunInputDrift(inputState({ changedDomains: ['unknownDomain' as never] }));
	assert.equal(drift.domains.length, 0);
	assert.equal(drift.primaryHref, '/admin/year-setup');
});

test('D5 the Simple drift surface renders the explicit regenerate affordance with its published guard', () => {
	const banner = source('src/components/timetable/simple/SimpleDriftBanner.tsx');
	assert.match(banner, /timetable-simple-regenerate-to-apply/);
	assert.match(banner, /timetable-simple-regenerate-impact/);
	assert.match(banner, /Valid draft placements are preserved/);
	// The published guard is code-level as well as render-level.
	assert.match(banner, /if \(isPublished\) return;/);
	assert.match(banner, /A published schedule is never regenerated automatically/);
	// The header wires the shared generation trigger; no automatic dispatch.
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /onRegenerate=\{context\.handleTriggerGenerate\}/);
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
