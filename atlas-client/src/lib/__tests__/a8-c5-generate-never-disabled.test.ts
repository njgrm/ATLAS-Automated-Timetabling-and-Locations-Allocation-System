/**
 * A8-C5 S2.3 / acceptance row A8 — Generate is NEVER greyed out.
 *
 * The operator, verbatim (`a8-c5-generation-always-fixable-2026-09-29.md`,
 * addendum 20:05): **"it should never be disabled."** Before this packet, six
 * separate conditions in `timetable-capabilities.ts` produced a DISABLED Generate
 * button with a sentence beside it: unresolved scope, a check still running, a
 * blocked setup, a check that could not run, an unverified diagnostic, and
 * school-year drift. Every one of them is now a NAMED STOPPER the Generate dialog
 * explains, with a count where one was measured and ONE fix route.
 *
 * WHAT THIS ROW IS NOT. It is not a new gate. The canonical decision is still
 * `deriveGenerateDecision`
 * (`atlas-server/src/services/generation-blocker-groups.service.ts:258`), called
 * in production from `generation-readiness.service.ts`, and it still refuses on
 * its own terms — exercised on the server by
 * `generation-canonical-readiness-genc02.test.ts` (script `test:server-suite`).
 * "Always enabled" means the operator always reaches the dialog and an honest
 * list. It does not mean the client became the only thing standing between a bad
 * year and a run.
 *
 * THE SWEEP IS THE POINT. A hand-picked list of inputs proves only that the
 * hand-picked list behaves. This row enumerates the CROSS PRODUCT of every field
 * the generation gate reads (480 combinations) plus a second sweep over the
 * run-state fields, so a new denial branch added to the gate is caught by the
 * very next run rather than by an operator.
 *
 * FOUR things are proved, and the last is what stops the file being vacuous:
 *
 *   1. NO DISABLED GENERATE, EVER — except `generating`. Stated as a predicate
 *      (`returnsDisabledGenerate`) and run over every input.
 *   2. EVERY STOPPER IS COMPLETE AND PLAIN — a sentence with no code, no id and
 *      no ellipsis; a short form of at most six words; one real fix route; a
 *      button label; and a Retry label if and ONLY if the cause is a check that
 *      could not run.
 *   3. NO INVENTED COUNT — a cause with no measurement carries `count: null` and
 *      says no number. A fabricated count is the "651 setup items" defect this
 *      lane exists to remove, so it is asserted rather than trusted.
 *   4. A WARNING NEVER STOPS GENERATION — a year whose only gap is teacher
 *      coverage is READY by the server's own decision, and must produce no
 *      stopper at all. Plus the FAILING-FIRST control: the predicate is run over
 *      a planted "run in progress" input (it must say yes) and over a planted
 *      "ready" input (it must say no), so it is shown to discriminate.
 *
 * Run: `npm run test:a8-c5-generate-gate` (also named in `test:client-suite`).
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	deriveTimetableCapabilities,
	deriveTimetableGenerationStoppers,
	YEAR_SETUP_HREF,
	type TimetableCapabilityInput,
	type TimetableGenerationStopper,
} from '../timetable-capabilities';
import { summarizeGenerationReadiness, type TimetableCurriculumReadinessState } from '../timetable-generation-readiness';

const READY_SUMMARY = { generateAllowed: true, zeroWrite: true, blockerCount: 0, gapCount: 0, gapClassCount: 0 };
/** A year whose ONLY finding is teacher coverage: a gap, never a blocker. */
const GAP_ONLY_SUMMARY = { generateAllowed: true, zeroWrite: true, blockerCount: 0, gapCount: 620, gapClassCount: 50 };
const BLOCKED_SUMMARY = { generateAllowed: false, zeroWrite: true, blockerCount: 468, gapCount: 620, gapClassCount: 50 };
const UNPROVEN_ZERO_WRITE = { generateAllowed: true, zeroWrite: false, blockerCount: 0, gapCount: 0, gapClassCount: 0 };

const DIAGNOSTIC_KINDS = [
	['absent', null],
	['ready', READY_SUMMARY],
	['gap-only', GAP_ONLY_SUMMARY],
	['blocked', BLOCKED_SUMMARY],
	['unproven-zero-write', UNPROVEN_ZERO_WRITE],
] as const;

const REPAIR_KINDS = [
	['none', null],
	['navigate', { kind: 'navigate', label: 'Assign teachers', href: '/teaching-load' } as const],
	['retry', { kind: 'retry', label: 'Retry schedule check' } as const],
] as const;

const CURRICULUM_STATES = ['loading', 'ready', 'blocked', 'unavailable', 'failed'] as const;

/** One input, from the fields the generation gate actually reads. */
function input(overrides: Partial<TimetableCapabilityInput> = {}): TimetableCapabilityInput {
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

/** THE PREDICATE UNDER TEST. Stated once so the controls run the real thing. */
function returnsDisabledGenerate(candidate: TimetableCapabilityInput): boolean {
	return deriveTimetableCapabilities(candidate).generation.enabled === false;
}

/**
 * Every input the gate is reachable with: the full cross product, not a sample.
 * Returned with a human label so a failure names the state instead of an index.
 */
function everyGateInput(): { label: string; input: TimetableCapabilityInput }[] {
	const out: { label: string; input: TimetableCapabilityInput }[] = [];
	for (const scopeResolved of [true, false]) {
		for (const curriculumState of CURRICULUM_STATES) {
			for (const generating of [false, true]) {
				for (const driftBlocked of [false, true]) {
					for (const [diagnosticName, generationDiagnostic] of DIAGNOSTIC_KINDS) {
						for (const [repairName, readinessRepair] of REPAIR_KINDS) {
							out.push({
								label: `scope=${scopeResolved} setup=${curriculumState} generating=${generating} drift=${driftBlocked} diagnostic=${diagnosticName} repair=${repairName}`,
								input: input({
									scopeResolved,
									curriculumState,
									generating,
									driftBlocked,
									driftMessage: driftBlocked ? 'Sync the active school year first.' : null,
									generationDiagnostic,
									readinessRepair,
								}),
							});
						}
					}
				}
			}
		}
	}
	return out;
}

function describeInput(candidate: TimetableCapabilityInput): string {
	return `scope=${candidate.scopeResolved} setup=${candidate.curriculumState} generating=${candidate.generating} drift=${candidate.driftBlocked}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// (1) NO DISABLED GENERATE, EVER — except a run already in progress.
// ─────────────────────────────────────────────────────────────────────────────
test('A8-a no capability input returns a disabled Generate except a run in progress', () => {
	const sweep = everyGateInput();
	assert.equal(sweep.length, 600, 'the sweep is the full cross product (2 scope x 5 setup x 2 running x 2 drift x 5 diagnostic x 3 repair), not a hand-picked list');

	let disabledOutsideARun = 0;
	const offenders: string[] = [];
	for (const { label, input: candidate } of sweep) {
		const caps = deriveTimetableCapabilities(candidate);
		if (caps.generation.enabled) continue;
		if (candidate.generating) continue;
		disabledOutsideARun += 1;
		offenders.push(`${label} -> ${caps.generation.reason ?? '(no reason)'}`);
	}
	assert.deepEqual(offenders, [], `these states still grey out Generate:\n  ${offenders.join('\n  ')}`);
	assert.equal(disabledOutsideARun, 0);

	// And the ONE denial is real, not a gate that never closes: the number of
	// disabled inputs must equal exactly the number of "run in progress" inputs.
	const runsInProgress = sweep.filter(({ input: candidate }) => candidate.generating);
	assert.ok(runsInProgress.length > 0, 'the sweep must actually contain running states');
	const disabled = sweep.filter(({ input: candidate }) => returnsDisabledGenerate(candidate));
	assert.equal(disabled.length, runsInProgress.length, 'exactly the running inputs are disabled');
	assert.ok(
		disabled.every(({ input: candidate }) => candidate.generating),
		'every disabled Generate in the sweep is a run already in progress',
	);

	// FAILING-FIRST / DISCRIMINATION CONTROL. Without this, row (1) would also pass
	// on a predicate that is simply always false. Planted "in progress" must say
	// yes; a planted fully-ready input must say no.
	assert.equal(returnsDisabledGenerate(input({ generating: true })), true,
		'a run already in progress must still refuse a second run');
	assert.equal(returnsDisabledGenerate(input({})), false,
		'the predicate must say NO for a fully ready input, or it discriminates nothing');
	// And the check-failed and drift states, which used to be two of the six
	// denials, are now enabled WITH a stopper naming them.
	for (const candidate of [
		input({ curriculumState: 'failed' }),
		input({ curriculumState: 'unavailable' }),
		input({ driftBlocked: true, driftMessage: 'Sync the active school year first.' }),
		input({ scopeResolved: false }),
		input({ curriculumState: 'loading' }),
		input({ generationDiagnostic: BLOCKED_SUMMARY }),
	]) {
		const caps = deriveTimetableCapabilities(candidate);
		assert.equal(caps.generation.enabled, true, `${describeInput(candidate)} must open the dialog, not a greyed button`);
		assert.ok(caps.generationStoppers.length > 0, `${describeInput(candidate)} must NAME what it is waiting for`);
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) EVERY STOPPER IS COMPLETE AND PLAIN.
// ─────────────────────────────────────────────────────────────────────────────
function assertCompleteStopper(stopper: TimetableGenerationStopper, where: string): void {
	assert.ok(stopper.line.trim().length > 0, `${where}: a stopper must say something`);
	assert.doesNotMatch(stopper.line, /\b[A-Z][A-Z0-9_]{5,}\b/, `${where}: leaks an engine token: ${stopper.line}`);
	assert.doesNotMatch(stopper.line, /\b#\d+\b/, `${where}: leaks an id: ${stopper.line}`);
	assert.doesNotMatch(stopper.line, /…|\.\.\./, `${where}: a truncated sentence is not an explanation (AGENTS.md section 8)`);
	assert.doesNotMatch(stopper.line, /\s+$/, `${where}: trailing whitespace`);

	assert.ok(stopper.shortReason.trim().length > 0, `${where}: a short form is required`);
	assert.ok(
		stopper.shortReason.split(/\s+/).length <= 6,
		`${where}: the short form is at most six words, got "${stopper.shortReason}"`,
	);
	assert.equal(stopper.shortReason.includes('…'), false, `${where}: the short form is never truncated`);

	assert.ok(stopper.href.startsWith('/'), `${where}: the fix route is an absolute app path: ${stopper.href}`);
	assert.equal(stopper.href.includes('//'), false, `${where}: the fix route is a single path: ${stopper.href}`);
	assert.equal(stopper.href, stopper.href.split('?')[0], `${where}: no query string in a fix route: ${stopper.href}`);
	assert.ok(stopper.actionLabel.trim().length > 0, `${where}: the button carries a visible label`);
	assert.equal(stopper.actionLabel.includes('?'), false, `${where}: the button label is not a question`);

	// (3) A CAUSE WITH NO MEASUREMENT SAYS NO NUMBER. A fabricated count is the
	// "651 setup items" defect; a real one is stated only where the server measured.
	if (stopper.count === null) {
		assert.equal(
			/\b\d+\b/.test(stopper.line),
			false,
			`${where}: this cause was never measured, so the line must carry no number: ${stopper.line}`,
		);
	} else {
		assert.ok(Number.isInteger(stopper.count) && stopper.count > 0, `${where}: a real count is a positive integer`);
		assert.ok(stopper.line.includes(String(stopper.count)), `${where}: the line must state the count it carries: ${stopper.line}`);
	}

	// A Retry button exists for a check that could not run, and for nothing else.
	if (stopper.checkFailed) {
		assert.ok(stopper.retryLabel !== null && stopper.retryLabel.trim().length > 0, `${where}: a failed check must offer Retry`);
	} else {
		assert.equal(stopper.retryLabel, null, `${where}: a real setup fact is never retried behind the operator's back`);
	}
}

test('A8-b every stopper is a plain sentence with one real fix route, and a Retry only for a check that could not run', () => {
	const seen = new Set<string>();
	const routes = new Set<string>();
	let withCount = 0;
	let checkFailed = 0;
	for (const { label, input: candidate } of everyGateInput()) {
		for (const stopper of deriveTimetableGenerationStoppers(candidate)) {
			assertCompleteStopper(stopper, label);
			seen.add(stopper.key);
			routes.add(stopper.href);
			if (stopper.count !== null) withCount += 1;
			if (stopper.checkFailed) checkFailed += 1;
		}
	}

	// EVERY former denial is a named cause, not a silent no-op. Six conditions
	// used to disable Generate; six causes must now exist, and each must be
	// reachable by an input in the sweep.
	assert.deepEqual(
		[...seen].sort(),
		['readiness-unverified', 'scope-unresolved', 'setup-blocked', 'setup-check-failed', 'setup-drift', 'setup-loading'],
		'the named causes must be exactly the conditions that used to disable Generate',
	);
	assert.equal(routes.size, 2, `the fix routes in play are ${[...routes].sort().join(', ')} — every one is a real app path`);
	assert.ok(withCount > 0, 'at least one cause states a real measured count');
	assert.ok(checkFailed > 0, 'at least one cause is a check that could not run, and must offer Retry');

	// The blocked and unverified lines carry the SERVER's count, not a row count
	// re-invented here. A blocked setup WITH an unverified diagnostic is TWO real
	// causes, not one: the dialog owes a line for each, and collapsing them is the
	// defect this shape exists to prevent.
	const blocked = deriveTimetableGenerationStoppers(input({ curriculumState: 'blocked', generationDiagnostic: BLOCKED_SUMMARY }));
	assert.deepEqual(blocked.map((stopper) => stopper.key), ['setup-blocked', 'readiness-unverified']);
	assert.equal(blocked[0].count, 468);
	assert.equal(blocked[0].line, '468 setup items need fixing before ATLAS can make a timetable.');
	assert.equal(blocked[0].checkFailed, false, 'a blocked setup is a real fact, not a failed check');
	assert.equal(blocked[0].href, YEAR_SETUP_HREF, 'with no repair supplied it still offers the real fix route');

	const blockedAlone = deriveTimetableGenerationStoppers(input({ curriculumState: 'blocked' }));
	assert.deepEqual(blockedAlone.map((stopper) => stopper.key), ['setup-blocked']);
	assert.equal(blockedAlone[0].count, null, 'with no diagnostic there is no measurement, so it says no number');
	assert.equal(/\b\d+\b/.test(blockedAlone[0].line), false, `and the line must carry no number: ${blockedAlone[0].line}`);

	const unverified = deriveTimetableGenerationStoppers(input({ generationDiagnostic: BLOCKED_SUMMARY }));
	assert.equal(unverified.length, 1);
	assert.equal(unverified[0].key, 'readiness-unverified');
	assert.equal(unverified[0].count, 468, 'it states the count the server measured');
	assert.equal(unverified[0].checkFailed, true, 'its repair is a re-runnable check, so it retries once by itself');
	assert.equal(unverified[0].retryLabel, 'Retry schedule check');
	assert.equal(unverified[0].href, YEAR_SETUP_HREF);

	// Several causes at once are listed, not collapsed: the dialog owes one line
	// per cause. This is also the multi-cause control, so the sweep's
	// single-stopper rows above are not the only shape being checked.
	const many = deriveTimetableGenerationStoppers(input({
		curriculumState: 'blocked',
		driftBlocked: true,
		driftMessage: 'Sync the active school year first.',
		generationDiagnostic: BLOCKED_SUMMARY,
	}));
	assert.deepEqual(many.map((stopper) => stopper.key), ['setup-blocked', 'readiness-unverified', 'setup-drift']);
});

// ─────────────────────────────────────────────────────────────────────────────
// (4) A WARNING NEVER STOPS GENERATION, and nothing is only-a-warning.
// ─────────────────────────────────────────────────────────────────────────────
test('A8-c a teacher-coverage gap is a warning, never a stopper, and a ready year has none at all', () => {
	// A8 C3: 620 of the operator's 651 live rows were ONE fact at two grains. If
	// `gapCount` or `gapClassCount` could stop generation, that is the 651-row
	// defect returning through the front door.
	for (const candidate of [
		input({ generationDiagnostic: GAP_ONLY_SUMMARY }),
		input({ generationDiagnostic: GAP_ONLY_SUMMARY, curriculumState: 'ready', hasGeneratedRun: true }),
		input({ generationDiagnostic: READY_SUMMARY }),
		input({}),
	]) {
		const caps = deriveTimetableCapabilities(candidate);
		assert.deepEqual(caps.generationStoppers, [], `${describeInput(candidate)} must have nothing to fix`);
		assert.equal(caps.generation.enabled, true);
		assert.equal(caps.generation.reason, null, 'nothing to explain means nothing to say beside the button');
		assert.equal(caps.generation.shortReason, null);
		assert.equal(caps.generation.repair.kind, 'none');
	}
	// NEGATIVE CONTROL for the row above: the same shape WITH a blocking count is
	// not a warning, so the sweep is not passing because it cannot see a stopper.
	const warned = deriveTimetableGenerationStoppers(input({ generationDiagnostic: GAP_ONLY_SUMMARY }));
	assert.deepEqual(warned, []);
	const blocking = deriveTimetableGenerationStoppers(input({ generationDiagnostic: BLOCKED_SUMMARY }));
	assert.equal(blocking.length, 1, 'a blocking count DOES produce a named cause — the control discriminates');
});

// ─────────────────────────────────────────────────────────────────────────────
// (5) The run-state fields never change the generation contract.
// ─────────────────────────────────────────────────────────────────────────────
test('A8-d run state, publication and draft state never disable Generate', () => {
	for (const hasGeneratedRun of [false, true]) {
		for (const isPublished of [false, true]) {
			for (const isPreGeneration of [false, true]) {
				for (const latestRunFailed of [false, true]) {
					for (const hardCount of [0, 7]) {
						const candidate = input({ hasGeneratedRun, isPublished, isPreGeneration, latestRunFailed, hardCount });
						assert.equal(
							returnsDisabledGenerate(candidate),
							false,
							`run state must never grey out Generate: ${describeInput(candidate)}`,
						);
					}
				}
			}
		}
	}
	// Publication is a SEPARATE contract and is deliberately NOT relaxed by this
	// packet: it still refuses, because publishing is a HIGH action with its own
	// gates. Asserting it here stops "always enabled" from being read as "always
	// allowed to publish".
	const noRun = deriveTimetableCapabilities(input({}));
	assert.equal(noRun.gates.publication.enabled, false, 'publishing with no run still refuses');
	assert.equal(noRun.gates.publication.shortReason, 'No generated schedule to publish');
});

// ─────────────────────────────────────────────────────────────────────────────
// (6) EXECUTOR FINDING, 2026-09-29 — the compact gate view FAILS CLOSED.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `summarizeGenerationReadiness` read `readiness.diagnostic.generateAllowed`
 * unguarded. Every production caller passes a state produced by
 * `deriveGenerationReadinessState`, which always attaches the diagnostic, so
 * nothing in ATLAS threw — but a readiness is a plain object: test fixtures
 * hand-build it, a cached value can be restored from an older shape, and a
 * `{ state: 'ready' }` literal is exactly what a future caller writes. It threw
 * a `TypeError` from inside the capability derivation, which takes the whole
 * header down, instead of returning the one answer the model already has a
 * rendering for.
 *
 * THE CONTRACT: an unreadable diagnostic is an UNVERIFIED decision, so the
 * summary is `null` — the same value an `unavailable`/`failed`/`loading`
 * readiness already returns — and the capability model then names it
 * `readiness-unverified`, which the Generate dialog explains in words with a fix
 * route. Fail closed, never throw, and never invent a decision.
 */
test('A8-e a readiness with no readable diagnostic fails closed to null, and never throws', () => {
	// The three shapes that used to throw. Each is cast through `unknown` on
	// purpose: the union says `diagnostic` is present on `ready`/`blocked`, and
	// a guard only the compiler can see is not a guard.
	const unreadable = [
		{ state: 'ready', message: 'ready' },
		{ state: 'blocked', message: 'blocked', code: 'X', repair: { kind: 'retry', label: 'Retry schedule check' } },
		{ state: 'ready', message: 'ready', diagnostic: null },
		{ state: 'ready', message: 'ready', diagnostic: 'not-a-diagnostic' },
	] as unknown as TimetableCurriculumReadinessState[];

	for (const readiness of unreadable) {
		let summary: unknown = 'THREW';
		assert.doesNotThrow(() => {
			summary = summarizeGenerationReadiness(readiness);
		}, `a ${(readiness as { state: string }).state} readiness with no diagnostic must not throw`);
		assert.equal(summary, null, 'an unreadable diagnostic is an unverified decision, which is null');
	}

	// POSITIVE CONTROL, so the row above is not passing because the function
	// always returns null: the same call on a real, complete readiness still
	// summarises, and the summary still gates.
	const real = deriveGenerationReadinessStateForTest();
	assert.equal(summarizeGenerationReadiness(real)?.blockerCount, 468,
		'a complete blocked readiness still summarises its blocking count');
	const gated = deriveTimetableCapabilities(input({
		curriculumState: 'blocked',
		generationDiagnostic: summarizeGenerationReadiness(real),
	}));
	assert.equal(gated.generationStoppers.some((stopper) => stopper.key === 'readiness-unverified'), true,
		'and the unverified decision is still NAMED, so failing closed did not silently allow generation');
});

/** A complete `blocked` readiness, as `deriveGenerationReadinessState` builds it. */
function deriveGenerationReadinessStateForTest(): TimetableCurriculumReadinessState {
	return {
		state: 'blocked',
		message: 'Generation readiness is blocked.',
		code: 'GENERATION_BLOCKED',
		repair: { kind: 'navigate', label: 'Open Year Setup', href: YEAR_SETUP_HREF },
		diagnostic: {
			scope: { schoolId: 1, schoolYearId: 2 },
			status: 'BLOCKED',
			generateAllowed: false,
			zeroWrite: true,
			schedulerExecuted: true,
			derivedDemandRevision: 'REV',
			termStructure: null,
			totals: { lines: 40, pairs: 12, sessionsByTerm: {} },
			teachingLoadCoverage: null,
			blockers: [],
			blockerCount: 468,
			gapCount: 620,
			gapClassCount: 50,
			groups: [],
		},
	} as unknown as TimetableCurriculumReadinessState;
}
