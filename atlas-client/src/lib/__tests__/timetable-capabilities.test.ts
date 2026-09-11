import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	deriveTimetableCapabilities,
	describeSetupState,
	YEAR_SETUP_HREF,
	type TimetableCapabilityInput,
} from '../timetable-capabilities';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function base(overrides: Partial<TimetableCapabilityInput> = {}): TimetableCapabilityInput {
	return {
		scopeResolved: true,
		curriculumState: 'ready',
		generating: false,
		isPreGeneration: false,
		hasGeneratedRun: false,
		isPublished: false,
		latestRunFailed: false,
		hardCount: 0,
		unassignedCount: 0,
		softCount: 0,
		hasSelectedEntry: false,
		requestPendingCount: 0,
		...overrides,
	};
}

// --- R1/R8 one shared generation and capability decision ---

test('R1 unresolved scope blocks generation and every run-only action', () => {
	const caps = deriveTimetableCapabilities(base({ scopeResolved: false }));
	assert.equal(caps.lifecycle, 'resolve-scope');
	assert.equal(caps.generation.enabled, false);
	assert.equal(caps.generation.repair.kind, 'none');
	assert.equal(caps.gates.swap.enabled, false);
	assert.equal(caps.gates.publication.enabled, false);
});

test('R1 blocked setup offers one Year Setup repair, never generation or publish', () => {
	const caps = deriveTimetableCapabilities(base({ curriculumState: 'blocked' }));
	assert.equal(caps.lifecycle, 'setup-blocked');
	assert.equal(caps.generation.enabled, false);
	assert.equal(caps.generation.repair.kind, 'navigate');
	assert.equal(caps.generation.repair.href, YEAR_SETUP_HREF);
	assert.equal(caps.gates.publication.enabled, false);
	// No gate may route the operator to the superseded curriculum requirements page.
	for (const gate of Object.values(caps.gates)) {
		assert.notEqual(gate.repair.href, '/curriculum-requirements');
	}
});

test('R1 unavailable setup offers retry, not a navigation or a generation', () => {
	for (const curriculumState of ['unavailable', 'failed'] as const) {
		const caps = deriveTimetableCapabilities(base({ curriculumState }));
		assert.equal(caps.generation.enabled, false);
		assert.equal(caps.generation.repair.kind, 'retry');
	}
});

test('R1 drift blocks generation and points at Year Setup', () => {
	const caps = deriveTimetableCapabilities(base({ driftBlocked: true, driftMessage: 'Sync the active school year first.' }));
	assert.equal(caps.generation.enabled, false);
	assert.equal(caps.generation.reason, 'Sync the active school year first.');
	assert.equal(caps.generation.repair.href, YEAR_SETUP_HREF);
});

test('R1 generation is eligible only when scope, setup, and idle state agree', () => {
	const caps = deriveTimetableCapabilities(base());
	assert.equal(caps.lifecycle, 'ready-no-run');
	assert.equal(caps.generation.enabled, true);

	assert.equal(deriveTimetableCapabilities(base({ generating: true })).generation.enabled, false);
	assert.equal(deriveTimetableCapabilities(base({ curriculumState: 'loading' })).lifecycle, 'setup-loading');
});

test('R1 failed latest run is a distinct lifecycle with retry reachable', () => {
	const caps = deriveTimetableCapabilities(base({ latestRunFailed: true }));
	assert.equal(caps.lifecycle, 'failed-run');
	assert.equal(caps.generation.enabled, true);
	assert.equal(caps.gates.publication.enabled, false);
	assert.equal(caps.gates.issueReview.enabled, false);
});

test('R1 generated and published lifecycles are distinct', () => {
	const generated = deriveTimetableCapabilities(base({ hasGeneratedRun: true }));
	assert.equal(generated.lifecycle, 'generated-reviewable');
	assert.equal(generated.gates.publication.enabled, true);

	const withBlockers = deriveTimetableCapabilities(base({ hasGeneratedRun: true, hardCount: 2 }));
	assert.equal(withBlockers.lifecycle, 'generated-issues');
	assert.equal(withBlockers.gates.publication.enabled, false);

	const published = deriveTimetableCapabilities(base({ hasGeneratedRun: true, isPublished: true }));
	assert.equal(published.lifecycle, 'published');
	assert.equal(published.gates.publication.enabled, false);
});

// --- R8 per-action gates ---

test('R8 run-only actions are gated separately, not by one broad boolean', () => {
	const noRun = deriveTimetableCapabilities(base());
	assert.equal(noRun.gates.viewSelection.enabled, true);
	assert.equal(noRun.gates.setupInputStatus.enabled, true);
	assert.equal(noRun.gates.roomRequests.enabled, false);
	assert.equal(noRun.gates.move.enabled, false);
	assert.equal(noRun.gates.changeRoom.enabled, false);
	assert.equal(noRun.gates.swap.enabled, false);
	assert.equal(noRun.gates.ownerRepair.enabled, false);
	assert.equal(noRun.gates.issueReview.enabled, false);

	const run = deriveTimetableCapabilities(base({ hasGeneratedRun: true }));
	assert.equal(run.gates.roomRequests.enabled, true);
	assert.equal(run.gates.swap.enabled, true);
	assert.equal(run.gates.ownerRepair.enabled, true);
	assert.equal(run.gates.issueReview.enabled, true);
	// Selection-scoped gates still require a selected class.
	assert.equal(run.gates.move.enabled, false);
	assert.equal(run.gates.changeRoom.enabled, false);
	assert.match(run.gates.move.reason ?? '', /Select a scheduled class/);

	const selected = deriveTimetableCapabilities(base({ hasGeneratedRun: true, hasSelectedEntry: true }));
	assert.equal(selected.gates.move.enabled, true);
	assert.equal(selected.gates.changeRoom.enabled, true);
});

test('R8 disabled gates always expose a short reason', () => {
	const caps = deriveTimetableCapabilities(base());
	for (const [id, gate] of Object.entries(caps.gates)) {
		if (!gate.enabled) {
			assert.ok(gate.reason && gate.reason.length > 4, `${id} must explain why it is disabled`);
		}
	}
});

// --- R2 setup copy never points at the superseded page ---

test('R2 setup copy never names the superseded curriculum requirements repair', () => {
	for (const state of ['loading', 'ready', 'blocked', 'unavailable', 'failed'] as const) {
		const described = describeSetupState({ state, message: 'Curriculum Requirements must be completed before generation.' });
		assert.doesNotMatch(described.label, /Curriculum Requirements/);
		assert.doesNotMatch(described.message, /curriculum-requirements/i);
		assert.notEqual(described.repair.href, '/curriculum-requirements');
	}
	const blocked = describeSetupState({ state: 'blocked', message: 'Missing terms.' });
	assert.equal(blocked.repair.href, YEAR_SETUP_HREF);
});

// --- Production wiring guards: one decision for Simple and Advanced ---

test('production Simple header no longer routes repair to curriculum-requirements', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.doesNotMatch(header, /curriculum-requirements/);
	assert.doesNotMatch(header, /Fix Curriculum Requirements/);
});

test('production Simple and Advanced headers consume the shared capability model', () => {
	const simple = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const advanced = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	assert.match(simple, /deriveTimetableCapabilities/);
	assert.match(advanced, /deriveTimetableCapabilities/);
});

test('production Advanced header cannot bypass the shared generation gate', () => {
	const advanced = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	// The raw direct generation call must be routed through the capability gate.
	assert.match(advanced, /generationGate/);
	assert.doesNotMatch(
		advanced,
		/disabled=\{generating \|\| loading \|\| !schoolYearId \|\| generationBlockedByDrift\}\s*\n\s*onClick=\{handleTriggerGenerate\}/,
	);
});
