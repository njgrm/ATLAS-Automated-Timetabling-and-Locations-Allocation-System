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
	// ── SUPERSEDED 2026-09-29 by A8-C5 S2.3 (packet addendum 20:05; the operator,
	// verbatim: "it should never be disabled"). The CONDITION is unchanged — an
	// unresolved scope still stops a run — but the RESPONSE is not. It is now a
	// named stopper the Generate dialog explains, and Generate opens that dialog.
	// The original expectation is recorded here, not deleted, and the run-only
	// actions below are deliberately NOT relaxed: they are not Generate.
	//   was: assert.equal(caps.generation.enabled, false);
	assert.equal(caps.generation.enabled, true, 'A8-C5 S2.3: an unresolved scope is a named stopper, not a greyed button');
	assert.equal(caps.generationStoppers[0]?.key, 'scope-unresolved', 'and the dialog is told which cause it is');
	assert.equal(caps.generationStoppers[0]?.checkFailed, true, 'a scope that did not load is a check that could not run, so it retries once by itself');
	assert.equal(caps.generationStoppers[0]?.retryLabel, 'Retry schedule check', 'and then says so with a Retry button');
	assert.equal(caps.generationStoppers[0]?.href, YEAR_SETUP_HREF, 'with a real place to fix it, not a dead end');
	assert.equal(caps.generation.repair.kind, 'none');
	assert.equal(caps.gates.swap.enabled, false);
	assert.equal(caps.gates.publication.enabled, false);
});

test('R1 blocked setup offers one Year Setup repair, never generation or publish', () => {
	const caps = deriveTimetableCapabilities(base({ curriculumState: 'blocked' }));
	assert.equal(caps.lifecycle, 'setup-blocked');
	// ── SUPERSEDED 2026-09-29 by A8-C5 S2.3. The REPAIR below is unchanged and
	// still asserted: a blocked setup is still sent to Year Setup, and publication
	// is still refused. Only the greyed button became a named stopper.
	//   was: assert.equal(caps.generation.enabled, false);
	assert.equal(caps.generation.enabled, true, 'A8-C5 S2.3: a blocked setup is a named stopper, not a greyed button');
	assert.equal(caps.generationStoppers[0]?.key, 'setup-blocked');
	assert.equal(caps.generationStoppers[0]?.checkFailed, false, 'a blocked setup is a REAL fact, so it is never retried behind the operator');
	assert.equal(caps.generationStoppers[0]?.count, null, 'nothing was measured here, so the line says no number rather than inventing one');
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
		// ── SUPERSEDED 2026-09-29 by A8-C5 S2.3. The RETRY is unchanged and still
		// asserted: what changed is that the operator gets the dialog and the
		// dialog says the check could not run, instead of a button that cannot be
		// pressed.   was: assert.equal(caps.generation.enabled, false);
		assert.equal(caps.generation.enabled, true, `A8-C5 S2.3: ${curriculumState} is a named stopper, not a greyed button`);
		assert.equal(caps.generationStoppers[0]?.key, 'setup-check-failed');
		assert.equal(caps.generationStoppers[0]?.checkFailed, true, 'this is exactly the "a check that could not run" case the packet wants retried once by itself');
		assert.equal(caps.generation.repair.kind, 'retry');
	}
});

test('R1 drift blocks generation and points at Year Setup', () => {
	const caps = deriveTimetableCapabilities(base({ driftBlocked: true, driftMessage: 'Sync the active school year first.' }));
	// ── SUPERSEDED 2026-09-29 by A8-C5 S2.3. The DRIFT MESSAGE and the Year Setup
	// REPAIR below are unchanged and still asserted — including the A2 C13
	// correction that a drifted year must never be told to "retry the schedule
	// check". Only the greyed button became a named stopper.
	//   was: assert.equal(caps.generation.enabled, false);
	assert.equal(caps.generation.enabled, true, 'A8-C5 S2.3: drift is a named stopper, not a greyed button');
	assert.equal(caps.generationStoppers[0]?.key, 'setup-drift');
	assert.equal(caps.generationStoppers[0]?.checkFailed, false, 'drift is a REAL mismatch, not a failed check');
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

/**
 * A2 C13 (operator 2026-09-29) — ADDITIVE, and a stricter reading of the SAME
 * property as the row above. `shortReason` was added to `TimetableActionGate` so
 * the header can print a ≤ 6-word reason BESIDE a disabled control, authored at the
 * same `denied()` call as the full sentence.
 *
 * The two properties this must never have:
 *   - a gate with a reason but no short form would make the header fall back to a
 *     generic sentence, i.e. the two forms COULD drift. So the pairing is required.
 *   - a short form longer than six words would be a truncated full sentence on
 *     screen, which §8 forbids. So the length is a hard bound, not a style note.
 *
 * There is NO deep-equal on a gate object anywhere in the tree, so adding a key is
 * not a structural risk; the risk these rows close is the gate returning a reason
 * with no short form, which is exactly what would let the two drift.
 */
test('R8C the two header gates pair their full reason with a ≤ 6-word short form', () => {
	// SCOPE, deliberately narrow: only `generation` and `gates.publication` are
	// rendered as a disabled LIFECYCLE CONTROL with a visible sentence beside them,
	// and only those two are wired to a `shortReason` by the header. The remaining
	// gates (`move`, `swap`, `roomRequests`, …) render as More-menu entry points that
	// show their full reason in their own surface, so requiring a six-word form on
	// them would be a contract this feature does not make.
	const headerGates = (caps: ReturnType<typeof deriveTimetableCapabilities>) => [
		['generation', caps.generation],
		['publication', caps.gates.publication],
	] as const;

	for (const input of [base(), base({ driftBlocked: true, driftMessage: 'Sync the active school year first.' })]) {
		const caps = deriveTimetableCapabilities(input);
		for (const [id, gate] of headerGates(caps)) {
			if (gate.enabled) continue;
			assert.ok(gate.shortReason, `${id}: a disabled header gate carries a short form, or the header falls back to a generic sentence`);
			assert.ok(
				gate.shortReason.split(/\s+/).length <= 6,
				`${id}: the visible reason is ≤ 6 words, got "${gate.shortReason}"`,
			);
			assert.doesNotMatch(gate.shortReason, /…|\.\.\.$/, `${id}: a short form is never a truncated sentence`);
		}
	}
	// The blocked-setup and no-run shapes are the two the header really hits.
	const blocked = deriveTimetableCapabilities(base({ curriculumState: 'blocked' }));
	// ── SUPERSEDED 2026-09-29 by A8-C5 S2.3: the gate is no longer DISABLED in
	// this shape, so R8C's `if (gate.enabled) continue;` no longer visits it. The
	// six-word bound it enforces is not dropped with the visit — the stopper's own
	// `shortReason` is held to it below, which is the sentence the header would
	// print beside the control if it were ever disabled again.
	//   was: assert.equal(blocked.generation.enabled, false);
	assert.equal(blocked.generation.enabled, true, 'A8-C5 S2.3: a blocked setup opens the dialog');
	assert.equal(blocked.generation.shortReason, 'Setup inputs are not ready');
	assert.ok(
		(blocked.generationStoppers[0]?.shortReason ?? '').split(/\s+/).length <= 6,
		'R8C continues to hold the visible reason to six words — now on the named stopper',
	);
	const noRun = deriveTimetableCapabilities(base());
	assert.equal(noRun.gates.publication.enabled, false);
	assert.equal(noRun.gates.publication.shortReason, 'No generated schedule to publish');
});

test('R8D an ALLOWED gate carries no reason and no short form', () => {
	const caps = deriveTimetableCapabilities(base());
	assert.equal(caps.generation.enabled, true);
	assert.equal(caps.generation.reason, null);
	assert.equal(caps.generation.shortReason, null, 'a control that can act prints no reason beside itself');
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
