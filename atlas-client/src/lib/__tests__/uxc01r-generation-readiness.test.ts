/**
 * UX-C01R — generation-readiness adapter and capability negative controls.
 *
 * Failing-first: the OLD Timetable wiring read the narrow derived-demand route
 * and mapped `data.ready` directly onto the generation capability. A year that
 * had derived demand but a missing exact Teaching Load owner or an out-of-shape
 * entry would be enabled for generation. These tests prove the corrected path
 * consumes the canonical generation diagnostic and that "derived-ready" is
 * never sufficient on its own.
 *
 * Run: `npx tsx --test src/lib/__tests__/uxc01r-generation-readiness.test.ts`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	deriveGenerationReadinessState,
	deriveTimetableReadinessRepair,
	parseGenerationReadinessDiagnostic,
	summarizeGenerationReadiness,
} from '../timetable-generation-readiness';
import { deriveTimetableCapabilities, type TimetableCapabilityInput } from '../timetable-capabilities';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

const SCOPE = { schoolId: 1, schoolYearId: 8 };

/** A canonical diagnostic that is fully ready: derived demand exists AND the
 * full generation gate agrees. */
function readyDiagnostic(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		scope: { schoolId: 1, schoolYearId: 8 },
		status: 'READY',
		generateAllowed: true,
		schedulerExecuted: true,
		derivedDemandRevision: 'REV-A',
		termStructure: { format: 'TRIMESTER', terms: [{ identity: 'T1', order: 1 }, { identity: 'T2', order: 2 }] },
		totals: { lines: 40, pairs: 12, sessionsByTerm: { T1: 20, T2: 20 } },
		teachingLoadCoverage: { requiredPairs: 12, ownedPairs: 12, missingPairs: 0, inactiveOrStalePairs: 0, outsideScopePairs: 0 },
		blockers: [],
		databaseSignature: { zeroWrite: true },
		...overrides,
	};
}

function blocker(code: string, category: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		code,
		category,
		termIdentity: 'T1',
		sectionId: 9001,
		subjectId: 7,
		subjectCode: 'TLE-7',
		entity: 'Section 7-A · TLE-7',
		reason: `${code} blocks generation.`,
		owningSurface: 'Teaching Load',
		nextAction: 'Assign the exact owner, then check readiness again.',
		...extra,
	};
}

function baseCapabilities(overrides: Partial<TimetableCapabilityInput> = {}): TimetableCapabilityInput {
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

// --- Failing-first: derived-ready is not generation-ready ---

test('UX-C01R: derived-ready with a missing exact Teaching Load owner stays blocked (old boolean would enable)', () => {
	// The narrow derived-demand payload reports ready...
	const legacyDerivedPayload = { available: true, ready: true };
	// ...so the OLD mapping (`data.ready`) would have enabled generation:
	const legacyWouldEnable = legacyDerivedPayload.ready === true;
	assert.equal(legacyWouldEnable, true, 'the retired boolean mapping must be shown to be unsafe');

	// The canonical diagnostic proves a Teaching Load ownership blocker.
	const diagnostic = readyDiagnostic({
		status: 'BLOCKED',
		generateAllowed: false,
		blockers: [blocker('OWNERSHIP_MISSING', 'DEMAND_AUTHORITY')],
	});
	const state = deriveGenerationReadinessState(diagnostic, SCOPE);
	assert.equal(state.state, 'blocked');
	if (state.state === 'blocked') {
		assert.equal(state.code, 'OWNERSHIP_MISSING');
		assert.equal(state.repair.href, '/teaching-load');
		assert.equal(state.diagnostic.generateAllowed, false, 'the full diagnostic is retained, not collapsed to a boolean');
	}
	const caps = deriveTimetableCapabilities(baseCapabilities({
		curriculumState: state.state,
		generationDiagnostic: summarizeGenerationReadiness(state),
		readinessRepair: state.state === 'blocked' ? state.repair : null,
	}));
	assert.equal(caps.generation.enabled, false, 'generation must remain disabled');
	assert.equal(caps.generation.repair.href, '/teaching-load');
});

test('UX-C01R: derived-ready with an out-of-shape entry stays blocked with a shape repair', () => {
	const diagnostic = readyDiagnostic({
		status: 'BLOCKED',
		generateAllowed: false,
		blockers: [blocker('CANONICAL_SHAPE_VIOLATION', 'ALGORITHM_LIMIT', { owningSurface: 'Generation shape' })],
	});
	const state = deriveGenerationReadinessState(diagnostic, SCOPE);
	assert.equal(state.state, 'blocked');
	if (state.state === 'blocked') assert.equal(state.repair.href, '/timetable');
	const caps = deriveTimetableCapabilities(baseCapabilities({
		curriculumState: state.state,
		generationDiagnostic: summarizeGenerationReadiness(state),
	}));
	assert.equal(caps.generation.enabled, false);
});

test('UX-C01R: derived-ready with a stale source revision stays blocked', () => {
	const diagnostic = readyDiagnostic({
		status: 'BLOCKED',
		generateAllowed: false,
		blockers: [blocker('STALE_SOURCE_REVISION', 'DEMAND_AUTHORITY', { owningSurface: 'Rollover' })],
	});
	const state = deriveGenerationReadinessState(diagnostic, SCOPE);
	assert.equal(state.state, 'blocked');
	if (state.state === 'blocked') assert.equal(state.code, 'STALE_SOURCE_REVISION');
});

test('UX-C01R: derived-ready with a policy/template/window blocker stays blocked', () => {
	const diagnostic = readyDiagnostic({
		status: 'BLOCKED',
		generateAllowed: false,
		blockers: [blocker('GRADE_WINDOW_MISSING', 'DATA_GAP', { owningSurface: 'Year Setup' })],
	});
	const state = deriveGenerationReadinessState(diagnostic, SCOPE);
	assert.equal(state.state, 'blocked');
	if (state.state === 'blocked') assert.equal(state.repair.href, '/admin/year-setup');
});

test('UX-C01R: derived-ready with a hard-validator blocker stays blocked and keeps every blocker', () => {
	const diagnostic = readyDiagnostic({
		status: 'BLOCKED',
		generateAllowed: false,
		blockers: [
			blocker('ROOM_TIME_CONFLICT', 'RESOURCE_INFEASIBLE', { owningSurface: 'Timetable review' }),
			blocker('FACULTY_OVERLOAD', 'ALGORITHM_LIMIT', { owningSurface: 'Timetable review' }),
		],
	});
	const state = deriveGenerationReadinessState(diagnostic, SCOPE);
	assert.equal(state.state, 'blocked');
	if (state.state === 'blocked') {
		assert.equal(state.diagnostic.blockers.length, 2, 'every blocker is retained in the readiness state');
		assert.equal(state.repair.href, '/map', 'the first blocker owns the one smallest repair');
	}
});

test('UX-C01R: generation is enabled only when allow + zero-write + scheduler + no blockers agree', () => {
	const diagnostic = readyDiagnostic();
	const state = deriveGenerationReadinessState(diagnostic, SCOPE);
	assert.equal(state.state, 'ready');
	if (state.state === 'ready') {
		assert.equal(state.diagnostic.derivedDemandRevision, 'REV-A');
		assert.deepEqual(state.diagnostic.totals.sessionsByTerm, { T1: 20, T2: 20 });
		assert.equal(state.diagnostic.teachingLoadCoverage?.ownedPairs, 12);
		assert.equal(state.diagnostic.zeroWrite, true);
		assert.equal(state.diagnostic.termStructure?.terms.length, 2);
	}
	const caps = deriveTimetableCapabilities(baseCapabilities({
		curriculumState: state.state,
		generationDiagnostic: summarizeGenerationReadiness(state),
	}));
	assert.equal(caps.generation.enabled, true);
});

test('UX-C01R: a non-zero-write diagnostic can never be ready', () => {
	const diagnostic = readyDiagnostic({ databaseSignature: { zeroWrite: false } });
	const state = deriveGenerationReadinessState(diagnostic, SCOPE);
	assert.equal(state.state, 'blocked');
	if (state.state === 'blocked') assert.equal(state.code, 'ZERO_WRITE_UNPROVEN');
});

test('UX-C01R: a diagnostic for another school/year is unavailable, never reused as ready', () => {
	const diagnostic = readyDiagnostic({ scope: { schoolId: 2, schoolYearId: 8 } });
	const state = deriveGenerationReadinessState(diagnostic, SCOPE);
	assert.equal(state.state, 'unavailable');
	const caps = deriveTimetableCapabilities(baseCapabilities({
		curriculumState: state.state,
		generationDiagnostic: summarizeGenerationReadiness(state),
	}));
	assert.equal(caps.generation.enabled, false);
});

test('UX-C01R: a malformed diagnostic is failed, and failed never enables generation', () => {
	const state = deriveGenerationReadinessState({ nonsense: true }, SCOPE);
	assert.equal(state.state, 'failed');
	const caps = deriveTimetableCapabilities(baseCapabilities({
		curriculumState: state.state,
		generationDiagnostic: summarizeGenerationReadiness(state),
	}));
	assert.equal(caps.generation.enabled, false);
	assert.equal(caps.generation.repair.kind, 'retry');
});

test('UX-C01R: summary gate refuses a ready state whose diagnostic does not prove allow/zero-write/clean', () => {
	// Defense-in-depth: even if a caller hands the capability a "ready" state,
	// an unproven diagnostic still blocks generation.
	const caps = deriveTimetableCapabilities(baseCapabilities({
		curriculumState: 'ready',
		generationDiagnostic: { generateAllowed: false, zeroWrite: true, blockerCount: 0 },
	}));
	assert.equal(caps.generation.enabled, false);
});

test('UX-C01R: repair mapping is deterministic and never the retired requirements page', () => {
	const teachingLoad = deriveTimetableReadinessRepair({
		code: 'OWNERSHIP_MISSING', category: 'DEMAND_AUTHORITY', termIdentity: null, sectionId: null,
		subjectId: null, subjectCode: null, entity: 'x', reason: 'x', owningSurface: 'Teaching Load', nextAction: 'x',
	});
	assert.equal(teachingLoad.href, '/teaching-load');
	const room = deriveTimetableReadinessRepair({
		code: 'ROOM_TIME_CONFLICT', category: 'RESOURCE_INFEASIBLE', termIdentity: null, sectionId: null,
		subjectId: null, subjectCode: null, entity: 'x', reason: 'x', owningSurface: 'Rooms', nextAction: 'x',
	});
	assert.equal(room.href, '/map');
	for (const entry of [teachingLoad, room]) {
		assert.notEqual(entry.href, '/curriculum-requirements');
		assert.notEqual(entry.href, '/subjects/requirements');
	}
});

test('UX-C01R: the parser ignores a missing nested zero-write form only when flat truth is present', () => {
	const parsed = parseGenerationReadinessDiagnostic({ scope: SCOPE, generateAllowed: true, schedulerExecuted: true, zeroWrite: true, blockers: [] });
	assert.equal(parsed?.zeroWrite, true);
	const nested = parseGenerationReadinessDiagnostic({ scope: SCOPE, generateAllowed: true, schedulerExecuted: true, databaseSignature: { zeroWrite: true }, blockers: [] });
	assert.equal(nested?.zeroWrite, true);
	const neither = parseGenerationReadinessDiagnostic({ scope: SCOPE, generateAllowed: true, schedulerExecuted: true, blockers: [] });
	assert.equal(neither?.zeroWrite, false);
});

// --- Production wiring guards ---

test('UX-C01R: the timetable hook consumes the generation diagnostic, never the raw derived-ready route', () => {
	const hook = source('src/hooks/useTimetableData.ts');
	assert.match(hook, /\/readiness\/diagnostic/, 'the hook must fetch the canonical generation diagnostic');
	assert.match(hook, /deriveGenerationReadinessState/);
	// The retired derivation-only readiness route must no longer gate generation.
	assert.doesNotMatch(hook, /\/derived-demand\/\$\{schoolId\}\/\$\{syId\}\/readiness/);
});

test('UX-C01R: both timetable headers feed the canonical diagnostic into the shared generation gate', () => {
	const simple = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const advanced = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	for (const header of [simple, advanced]) {
		assert.match(header, /summarizeGenerationReadiness/);
		assert.match(header, /generationDiagnostic/);
		assert.match(header, /deriveTimetableCapabilities/);
	}
	assert.match(advanced, /generationGate\.enabled/);
	assert.match(advanced, /generationGate\.repair/);
});
