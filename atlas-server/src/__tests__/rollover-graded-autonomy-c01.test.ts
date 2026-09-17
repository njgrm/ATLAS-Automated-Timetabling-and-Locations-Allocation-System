/**
 * ROLLOVER-GRADED-AUTONOMY-C01 control suite (packet R2.6).
 *
 * Every control is driven through the REAL `tickRolloverAutomation` dependency
 * seam with NO database. The tick's only reachable side effects here are the
 * injected `applyRollover` seam, the retained archive-producing spies (which
 * throw if invoked), and the injected publisher — so "zero invocations" and
 * "zero writes" are decisive rather than observational.
 *
 * Control 9 (kill switch) runs in a fresh child process because `ENABLED` is a
 * module-level constant resolved at import time.
 *
 * Harness style follows the existing `enrollpro-rollover-automation.test.ts`
 * custom `section`/`assert`/`assertEqual` pattern with `process.exitCode = 1`
 * on any failure.
 */

import { execFileSync } from 'node:child_process';
import {
	getAutomationStatus,
	resetAutomationState,
	tickRolloverAutomation,
} from '../services/rollover-automation.service.js';
import { subscribeSchoolNotificationEvents, type NotificationEvent } from '../services/notification-events.service.js';
import type { RolloverStatusResult } from '../services/enrollpro-rollover.service.js';

let passCount = 0;
let failCount = 0;

function section(name: string) {
	console.log(`\n  ${name}  `);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`    ${label}`);
		return;
	}
	failCount += 1;
	console.error(`    ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	assert(actual === expected, `${label}   expected ${String(expected)}, got ${String(actual)}`);
}

// ─── Preview builder ───

type DriftStatus = 'aligned' | 'atlas-stale' | 'enrollpro-unreachable' | 'mapping-conflict';
type DriftAction = 'NONE' | 'RUN_ROLLOVER_SYNC' | 'REVIEW_MAPPING_CONFLICT' | 'RETRY_ENROLLPRO' | 'RESET_DUMMY_YEAR' | 'RUN_ARCHIVE_AND_SYNC';

type PreviewOptions = {
	driftStatus?: DriftStatus;
	recommendedAction?: DriftAction;
	driftMessage?: string;
	conflicts?: Array<{ code: string; message: string }>;
	reconfiguredSections?: RolloverStatusResult['reconfiguredSections'];
	activeYearId?: number;
	activeYearLabel?: string;
	testDataMarked?: boolean;
	publishedResetBlocked?: boolean;
};

function makePreview(options: PreviewOptions = {}): RolloverStatusResult {
	const driftStatus = options.driftStatus ?? 'atlas-stale';
	const recommendedAction = options.recommendedAction
		?? (driftStatus === 'atlas-stale' ? 'RUN_ROLLOVER_SYNC' : driftStatus === 'mapping-conflict' ? 'RESET_DUMMY_YEAR' : driftStatus === 'enrollpro-unreachable' ? 'RETRY_ENROLLPRO' : 'NONE');
	const activeYearId = options.activeYearId ?? 600;
	return {
		schoolId: SCHOOL_ID,
		atlasSchoolYearId: driftStatus === 'atlas-stale' ? 500 : activeYearId,
		enrollProActiveYear: { id: activeYearId, yearLabel: options.activeYearLabel ?? '2099-2100' },
		drift: {
			status: driftStatus,
			message: options.driftMessage ?? `Drift is ${driftStatus}.`,
			recommendedAction,
			atlasSchoolYearId: driftStatus === 'atlas-stale' ? 500 : activeYearId,
			enrollProSchoolYearId: activeYearId,
			enrollProSchoolYearLabel: options.activeYearLabel ?? '2099-2100',
			mirrorSyncedAt: null,
		},
		mirror: {
			enrollProSchoolYearId: 500,
			yearLabel: '2098-2099',
			isActive: true,
			lastVerifiedAt: null,
			lastSyncedAt: null,
			facultyCount: 0,
			sectionCount: 0,
			syncStatus: 'setup-review-required',
			lastFailureSummary: null,
		},
		conflicts: options.conflicts ?? [],
		reconfiguredSections: options.reconfiguredSections ?? [],
		canResetDummyYear: false,
		resetTargetSchoolYearId: activeYearId,
		conflictingRecordCounts: null,
		teachingLoadResetRequired: false,
		publishedResetBlocked: options.publishedResetBlocked ?? false,
		testDataMarked: options.testDataMarked ?? false,
	};
}

// ─── Injection harness ───

type AutomationDeps = NonNullable<Parameters<typeof tickRolloverAutomation>[1]>;

type PublishedEvent = {
	type?: string;
	domain?: string;
	severity?: string;
	audience?: string;
	schoolId?: number;
	schoolYearId?: number;
	facultyId?: number | null;
	message?: string;
	metadata?: Record<string, unknown>;
};

type TickHarness = {
	applies: number;
	applyArgs: Array<{ schoolId: number; authToken: unknown; options: { initiatedBy?: string } | undefined }>;
	classifyCalls: number;
	archiveSpyCalls: { applyTestRecovery: number; applyArchiveAndSync: number; archiveYear: number };
	published: PublishedEvent[];
	deps: AutomationDeps;
	deferredRelease: () => void;
};

function makeHarness(preview: RolloverStatusResult, options: { reachable?: boolean; healthMessage?: string; deferredApply?: boolean; realBus?: boolean } = {}): TickHarness {
	const harness: TickHarness = {
		applies: 0,
		applyArgs: [],
		classifyCalls: 0,
		archiveSpyCalls: { applyTestRecovery: 0, applyArchiveAndSync: 0, archiveYear: 0 },
		published: [],
		deferredRelease: () => {},
		deps: {},
	};

	const deferred = options.deferredApply
		? new Promise<void>((resolve) => { harness.deferredRelease = resolve; })
		: null;

	harness.deps = {
		fetchIntegrationHealth: (async () => ({
			reachable: options.reachable ?? true,
			message: options.healthMessage ?? 'EnrollPro is unreachable.',
		})) as never,
		previewRollover: (async () => preview) as never,
		applyRollover: (async (schoolId: number, authToken?: string, applyOptions?: { initiatedBy?: string }) => {
			harness.applies += 1;
			harness.applyArgs.push({ schoolId, authToken, options: applyOptions });
			if (deferred) await deferred;
			return {} as never;
		}) as never,
		classifyRecovery: (async () => {
			harness.classifyCalls += 1;
			return {
				classification: 'TEST_DATA_RECOVERY_AVAILABLE',
				confirmationText: 'CLEAR_TEST_DATA_AND_SYNC_600',
			} as never;
		}) as never,
		applyTestRecovery: (async () => {
			harness.archiveSpyCalls.applyTestRecovery += 1;
			throw new Error('archive seam invoked: applyTestRecovery');
		}) as never,
		applyArchiveAndSync: (async () => {
			harness.archiveSpyCalls.applyArchiveAndSync += 1;
			throw new Error('archive seam invoked: applyArchiveAndSync');
		}) as never,
		archiveYear: (async () => {
			harness.archiveSpyCalls.archiveYear += 1;
			throw new Error('archive seam invoked: archiveYear');
		}) as never,
	};
	if (!options.realBus) {
		harness.deps.publishNotification = ((event: PublishedEvent) => { harness.published.push(event); }) as never;
	}
	return harness;
}

function detectedEvents(harness: TickHarness): PublishedEvent[] {
	return harness.published.filter((event) => event.type === 'ROLLOVER_DETECTED');
}

function completedEvents(harness: TickHarness): PublishedEvent[] {
	return harness.published.filter((event) => event.type === 'ROLLOVER_AUTO_SYNC_COMPLETED');
}

function assertArchiveSpiesSilent(harness: TickHarness, label: string) {
	assertEqual(harness.archiveSpyCalls.applyTestRecovery, 0, `${label}: applyTestRecovery spy never invoked`);
	assertEqual(harness.archiveSpyCalls.applyArchiveAndSync, 0, `${label}: applyArchiveAndSync spy never invoked`);
	assertEqual(harness.archiveSpyCalls.archiveYear, 0, `${label}: archiveYear spy never invoked`);
}

function assertRolloverDetectedShape(event: PublishedEvent | undefined, expected: { schoolId: number; schoolYearId: number; driftStatus: string; recommendedAction: string; conflictCount: number }, label: string) {
	// Guard the shape assertions so a missing event reports a failure instead of
	// aborting the whole suite (the mutant run must reach every control).
	const present = event != null;
	assert(present, `${label}: ROLLOVER_DETECTED event exists`);
	if (!event) return;
	assertEqual(event.domain, 'integration', `${label}: domain integration`);
	assertEqual(event.audience, 'PRIVILEGED', `${label}: audience PRIVILEGED`);
	assertEqual(event.severity, 'warning', `${label}: severity warning`);
	assertEqual(event.schoolId, expected.schoolId, `${label}: schoolId`);
	assertEqual(event.schoolYearId, expected.schoolYearId, `${label}: schoolYearId`);
	assertEqual(event.facultyId, null, `${label}: facultyId null`);
	assertEqual(event.metadata?.driftStatus, expected.driftStatus, `${label}: metadata.driftStatus`);
	assertEqual(event.metadata?.recommendedAction, expected.recommendedAction, `${label}: metadata.recommendedAction`);
	assertEqual(event.metadata?.conflictCount, expected.conflictCount, `${label}: metadata.conflictCount`);
	assert(typeof event.metadata?.driftMessage === 'string' && (event.metadata.driftMessage as string).length > 0, `${label}: metadata.driftMessage present`);
	assert('fromYearLabel' in (event.metadata ?? {}), `${label}: metadata.fromYearLabel key present`);
	assert('toYearLabel' in (event.metadata ?? {}), `${label}: metadata.toYearLabel key present`);
	assert(typeof event.message === 'string' && event.message.includes(expected.driftStatus), `${label}: message names the drift status`);
	assert(typeof event.message === 'string' && event.message.includes(expected.recommendedAction), `${label}: message names the next action`);
}

const SCHOOL_ID = 9_100_777;
const TICK_INTERVAL_MS = Math.max(60_000, Number(process.env.ROLLOVER_AUTO_SYNC_INTERVAL_MS ?? 300_000));
const MAX_BACKOFF_MS = Math.max(TICK_INTERVAL_MS, Number(process.env.ROLLOVER_AUTO_SYNC_MAX_BACKOFF_MS ?? 1_800_000));

async function run() {
	// ── Control 1 ──────────────────────────────────────────────────────────────
	section('C01-1: gate holds → applies exactly once, completion only, no archive, no detection');
	{
		resetAutomationState();
		const preview = makePreview({ driftStatus: 'atlas-stale', recommendedAction: 'RUN_ROLLOVER_SYNC' });
		const harness = makeHarness(preview);
		const result = await tickRolloverAutomation(SCHOOL_ID, harness.deps);

		assertEqual(result.action, 'applied', 'gate holds and the rollover applies');
		assertEqual(harness.applies, 1, 'applyRollover invoked exactly once');
		assertEqual(harness.applyArgs[0]?.schoolId, SCHOOL_ID, 'apply targets the automating school');
		assertEqual(harness.applyArgs[0]?.authToken, undefined, 'apply runs without an auth token');
		assertEqual(harness.applyArgs[0]?.options?.initiatedBy, 'system', 'apply is attributed to the system');
		assertEqual(completedEvents(harness).length, 1, 'exactly one ROLLOVER_AUTO_SYNC_COMPLETED');
		assertEqual(detectedEvents(harness).length, 0, 'no ROLLOVER_DETECTED on the auto-apply path');
		assert(!completedEvents(harness)[0]?.message?.includes('archiv'), 'completion message never claims an archived year');
		assertEqual(result.state.lastResult, 'success', 'state records success');
		assertEqual(result.state.lastNotifiedDriftStatus, null, 'auto-apply resets the observed drift status');
		assertArchiveSpiesSilent(harness, 'C01-1');
	}

	// ── Control 2 ──────────────────────────────────────────────────────────────
	section('C01-2: any conflict → no apply, ROLLOVER_DETECTED carries driftStatus + conflictCount');
	{
		resetAutomationState();
		const preview = makePreview({
			driftStatus: 'atlas-stale',
			recommendedAction: 'RUN_ROLLOVER_SYNC',
			conflicts: [{ code: 'SECTION_ID_COLLISION', message: 'Collision' }],
		});
		const harness = makeHarness(preview);
		const result = await tickRolloverAutomation(SCHOOL_ID, harness.deps);

		assertEqual(harness.applies, 0, 'conflicted drift never auto-applies (zero target-year writes)');
		assertEqual(result.action, 'conflict', 'tick reports the manual conflict');
		assertEqual(detectedEvents(harness).length, 1, 'one ROLLOVER_DETECTED for the conflict');
		assertRolloverDetectedShape(detectedEvents(harness)[0]!, {
			schoolId: SCHOOL_ID,
			schoolYearId: 600,
			driftStatus: 'atlas-stale',
			recommendedAction: 'RUN_ROLLOVER_SYNC',
			conflictCount: 1,
		}, 'C01-2');
		assertArchiveSpiesSilent(harness, 'C01-2');
	}

	// ── Control 2b ─────────────────────────────────────────────────────────────
	section('C01-2b: the Year Setup school-scoped subscriber receives ROLLOVER_DETECTED on the real bus');
	{
		resetAutomationState();
		const received: NotificationEvent[] = [];
		const unsubscribe = subscribeSchoolNotificationEvents({
			schoolId: SCHOOL_ID,
			send: (event) => { received.push(event); },
		});
		try {
			const preview = makePreview({
				driftStatus: 'mapping-conflict',
				recommendedAction: 'RESET_DUMMY_YEAR',
				conflicts: [{ code: 'SECTION_ID_COLLISION', message: 'Collision' }],
			});
			// realBus: do not inject the publisher, so the production
			// publishNotificationEvent routing and canReceive gate are exercised.
			const harness = makeHarness(preview, { realBus: true });
			const result = await tickRolloverAutomation(SCHOOL_ID, harness.deps);
			assertEqual(result.action, 'conflict', 'the tick still refuses to auto-apply');
			const detected = received.filter((event) => event.type === 'ROLLOVER_DETECTED');
			assertEqual(detected.length, 1, 'the school-scoped subscriber receives exactly one ROLLOVER_DETECTED');
			assertEqual(detected[0]?.audience, 'PRIVILEGED', 'delivered event keeps audience PRIVILEGED');
			assertEqual(detected[0]?.domain, 'integration', 'delivered event keeps domain integration');
			assertEqual(detected[0]?.metadata?.conflictCount, 1, 'delivered metadata carries the conflict count');
		} finally {
			unsubscribe();
		}
	}

	// ── Control 3 ──────────────────────────────────────────────────────────────
	section('C01-3: RUN_ARCHIVE_AND_SYNC / mapping-conflict / enrollpro-unreachable → notification only');
	{
		const scenarios: Array<{ label: string; options: PreviewOptions; expectedAction: string; expectedDriftStatus: string }> = [
			{
				label: 'RUN_ARCHIVE_AND_SYNC',
				options: {
					driftStatus: 'mapping-conflict',
					recommendedAction: 'RUN_ARCHIVE_AND_SYNC',
					conflicts: [{ code: 'YEAR_LABEL_MISMATCH', message: 'Label mismatch' }],
				},
				expectedAction: 'conflict',
				expectedDriftStatus: 'mapping-conflict',
			},
			{
				label: 'mapping-conflict',
				options: {
					driftStatus: 'mapping-conflict',
					recommendedAction: 'RESET_DUMMY_YEAR',
					conflicts: [{ code: 'SECTION_ID_COLLISION', message: 'Collision' }],
				},
				expectedAction: 'conflict',
				expectedDriftStatus: 'mapping-conflict',
			},
			{
				label: 'enrollpro-unreachable',
				options: { driftStatus: 'enrollpro-unreachable', recommendedAction: 'RETRY_ENROLLPRO' },
				expectedAction: 'skipped',
				expectedDriftStatus: 'enrollpro-unreachable',
			},
		];

		for (const scenario of scenarios) {
			resetAutomationState();
			const preview = makePreview(scenario.options);
			const harness = makeHarness(preview);
			const result = await tickRolloverAutomation(SCHOOL_ID, harness.deps);

			assertEqual(harness.applies, 0, `${scenario.label}: never auto-applies`);
			assertEqual(result.action, scenario.expectedAction, `${scenario.label}: action is notification-only`);
			assertEqual(detectedEvents(harness).length, 1, `${scenario.label}: exactly one ROLLOVER_DETECTED`);
			assertRolloverDetectedShape(detectedEvents(harness)[0]!, {
				schoolId: SCHOOL_ID,
				schoolYearId: 600,
				driftStatus: scenario.expectedDriftStatus,
				recommendedAction: scenario.options.recommendedAction!,
				conflictCount: scenario.options.conflicts?.length ?? 0,
			}, scenario.label);
			assertArchiveSpiesSilent(harness, scenario.label);
		}
	}

	// ── Control 4 ──────────────────────────────────────────────────────────────
	section('C01-4: unchanged drift status across consecutive ticks → exactly one notification');
	{
		resetAutomationState();
		const conflicted = makePreview({
			driftStatus: 'mapping-conflict',
			recommendedAction: 'RESET_DUMMY_YEAR',
			conflicts: [{ code: 'SECTION_ID_COLLISION', message: 'Collision' }],
		});
		const harness = makeHarness(conflicted);
		const first = await tickRolloverAutomation(SCHOOL_ID, harness.deps);
		assertEqual(detectedEvents(harness).length, 1, 'first observation notifies once');

		// Bypass the bounded-backoff gate without resetting the module state so
		// this control isolates the transition axis, not the retry gate.
		first.state.nextAttemptAt = new Date(0);
		const second = await tickRolloverAutomation(SCHOOL_ID, harness.deps);
		assertEqual(second.action, 'conflict', 'second tick actually runs (not a backoff skip)');
		assertEqual(detectedEvents(harness).length, 1, 'unchanged status does not re-notify');

		// A real status change re-notifies exactly once.
		second.state.nextAttemptAt = new Date(0);
		const changedPreview = makePreview({
			driftStatus: 'atlas-stale',
			recommendedAction: 'RUN_ROLLOVER_SYNC',
			conflicts: [{ code: 'SECTION_ID_COLLISION', message: 'Collision' }],
		});
		const changedHarness = makeHarness(changedPreview);
		// Reuse the observed state by driving the same school through a fresh
		// preview but identical module state.
		const third = await tickRolloverAutomation(SCHOOL_ID, changedHarness.deps);
		assertEqual(third.action, 'conflict', 'changed-status tick runs');
		assertEqual(detectedEvents(changedHarness).length, 1, 'a drift-status change re-notifies exactly once');
		assertEqual(detectedEvents(changedHarness)[0]?.metadata?.driftStatus, 'atlas-stale', 'the re-notification carries the new status');
		assertArchiveSpiesSilent(harness, 'C01-4');
		assertArchiveSpiesSilent(changedHarness, 'C01-4b');
	}

	// ── Control 5 ──────────────────────────────────────────────────────────────
	section('C01-5: never-archive — every scenario keeps all three archive spies at zero');
	{
		const scenarios: Array<{ label: string; options: PreviewOptions; testMode?: boolean }> = [
			{ label: 'conflict', options: { driftStatus: 'atlas-stale', recommendedAction: 'RUN_ROLLOVER_SYNC', conflicts: [{ code: 'SECTION_ID_COLLISION', message: 'Collision' }] } },
			{ label: 'RUN_ARCHIVE_AND_SYNC', options: { driftStatus: 'mapping-conflict', recommendedAction: 'RUN_ARCHIVE_AND_SYNC', conflicts: [{ code: 'YEAR_LABEL_MISMATCH', message: 'Label mismatch' }] } },
			{ label: 'reconfigure-pending', options: { driftStatus: 'atlas-stale', recommendedAction: 'RUN_ROLLOVER_SYNC', reconfiguredSections: [{ externalId: 1, sectionName: '7-A', previousName: '7-A', previousGradeLevelId: 7, previousProgramType: 'REGULAR', newName: '7-A', newGradeLevelId: 8, newProgramType: 'REGULAR' }] } },
			{
				label: 'pending-archive-marker',
				options: { driftStatus: 'aligned', recommendedAction: 'NONE', activeYearId: 777, testDataMarked: true },
			},
			{
				label: 'test-mode collision',
				options: {
					driftStatus: 'mapping-conflict',
					recommendedAction: 'RESET_DUMMY_YEAR',
					conflicts: [{ code: 'SECTION_ID_COLLISION', message: 'Collision' }],
					testDataMarked: true,
					publishedResetBlocked: false,
				},
				testMode: true,
			},
		];

		for (const scenario of scenarios) {
			resetAutomationState();
			const preview = makePreview(scenario.options);
			const harness = makeHarness(preview);
			if (scenario.testMode) {
				(harness.deps as { testModeEnabled?: boolean }).testModeEnabled = true;
			}
			const result = await tickRolloverAutomation(SCHOOL_ID, harness.deps);

			assertArchiveSpiesSilent(harness, `C01-5 ${scenario.label}`);
			assertEqual(harness.applies, 0, `C01-5 ${scenario.label}: no auto-apply`);
			assertEqual(harness.classifyCalls, 0, `C01-5 ${scenario.label}: recovery classification is never consulted`);
			if (scenario.label === 'pending-archive-marker') {
				// Base behaviour would call the (non-injected) marker lookup and fail
				// without a database; the retired path must simply skip.
				assertEqual(result.action, 'skipped', 'C01-5 pending-archive-marker: no unattended archival retry');
			}
			if (scenario.label === 'test-mode collision') {
				assertEqual(result.action, 'conflict', 'C01-5 test-mode collision: no unattended test-data clear');
			}
			if (scenario.label === 'reconfigure-pending') {
				// R2.2's load-bearing fourth term: an unacknowledged reconfigure must
				// never auto-apply, because applyRolloverSync would reject it 409.
				assertEqual(result.action, 'reconfigure-pending', 'C01-5 reconfigure-pending: no auto-apply with unacknowledged sections');
			}
		}
	}

	// ── Control 6 ──────────────────────────────────────────────────────────────
	section('C01-6: two overlapping ticks → exactly one apply (single-flight)');
	{
		resetAutomationState();
		const preview = makePreview({ driftStatus: 'atlas-stale', recommendedAction: 'RUN_ROLLOVER_SYNC' });
		const harness = makeHarness(preview, { deferredApply: true });

		const first = tickRolloverAutomation(SCHOOL_ID, harness.deps);
		const second = await tickRolloverAutomation(SCHOOL_ID, harness.deps);
		assertEqual(second.action, 'skipped', 'the overlapping tick is refused');
		assertEqual(second.detail, 'Already applying', 'refusal reason is the in-process single-flight guard');

		harness.deferredRelease();
		const firstResult = await first;
		assertEqual(firstResult.action, 'applied', 'the first tick still applies');
		assertEqual(harness.applies, 1, 'exactly one apply across overlapping ticks');
		assertEqual(completedEvents(harness).length, 1, 'exactly one completion notification');
		assertArchiveSpiesSilent(harness, 'C01-6');
	}

	// ── Control 7 ──────────────────────────────────────────────────────────────
	section('C01-7: EnrollPro unreachable → bounded backoff, one notification, no apply');
	{
		resetAutomationState();
		const preview = makePreview({ driftStatus: 'atlas-stale', recommendedAction: 'RUN_ROLLOVER_SYNC' });
		const harness = makeHarness(preview, { reachable: false, healthMessage: 'connect ECONNREFUSED' });
		const first = await tickRolloverAutomation(SCHOOL_ID, harness.deps);
		assertEqual(first.action, 'unreachable', 'unreachable health short-circuits');
		assertEqual(harness.applies, 0, 'unreachable never applies');
		assertEqual(detectedEvents(harness).length, 1, 'one ROLLOVER_DETECTED for the unreachable transition');
		assertRolloverDetectedShape(detectedEvents(harness)[0]!, {
			schoolId: SCHOOL_ID,
			schoolYearId: 0,
			driftStatus: 'enrollpro-unreachable',
			recommendedAction: 'RETRY_ENROLLPRO',
			conflictCount: 0,
		}, 'C01-7');
		const grew = first.state.nextAttemptAt.getTime() - Date.now();
		assert(grew > 0, `backoff is in the future (${grew}ms)`);
		assert(grew <= MAX_BACKOFF_MS + 1_000, `backoff is capped at MAX_BACKOFF_MS (${grew} <= ${MAX_BACKOFF_MS + 1_000})`);

		first.state.nextAttemptAt = new Date(0);
		const second = await tickRolloverAutomation(SCHOOL_ID, harness.deps);
		assertEqual(second.action, 'unreachable', 'the retry also reports unreachable');
		assert(second.state.nextAttemptAt.getTime() > first.state.lastAttemptAt!.getTime(), 'nextAttemptAt advanced on the retry');
		assertEqual(detectedEvents(harness).length, 1, 'unchanged unreachable status does not re-notify');
		assertEqual(harness.applies, 0, 'no apply on any unreachable tick');
		assertArchiveSpiesSilent(harness, 'C01-7');
	}

	// ── Control 8 ──────────────────────────────────────────────────────────────
	section('C01-8: second tick after a successful apply → skipped with no duplicate apply');
	{
		resetAutomationState();
		const stale = makePreview({ driftStatus: 'atlas-stale', recommendedAction: 'RUN_ROLLOVER_SYNC' });
		const harness = makeHarness(stale);
		const first = await tickRolloverAutomation(SCHOOL_ID, harness.deps);
		assertEqual(first.action, 'applied', 'first tick applies');
		assertEqual(harness.applies, 1, 'apply count is one after the first tick');

		// A post-apply tick observes aligned drift; bypass the retry gate so the
		// idempotency assertion is about the gate, not the backoff timer.
		first.state.nextAttemptAt = new Date(0);
		const aligned = makePreview({ driftStatus: 'aligned', recommendedAction: 'NONE' });
		(harness.deps as { previewRollover?: unknown }).previewRollover = (async () => aligned) as never;
		const second = await tickRolloverAutomation(SCHOOL_ID, harness.deps);
		assertEqual(second.action, 'skipped', 'second tick skips on aligned drift');
		assertEqual(harness.applies, 1, 'no duplicate apply after success');
		assertEqual(completedEvents(harness).length, 1, 'no duplicate completion notification');
		assertEqual(detectedEvents(harness).length, 0, 'aligned drift never notifies');
		assertArchiveSpiesSilent(harness, 'C01-8');
	}

	// ── Control 9 ──────────────────────────────────────────────────────────────
	section('C01-9: fresh process with ROLLOVER_AUTO_SYNC_ENABLED=false is fully disabled');
	{
		const probe = [
			"import('./src/services/rollover-automation.service.js').then((m) => {",
			"  m.startRolloverAutomation();",
			"  const status = m.getAutomationStatus();",
			"  console.log('PROBE_ENABLED=' + status.enabled);",
			"  console.log('PROBE_SCHOOLS=' + status.schools.length);",
			"}).catch((error) => { console.error(error); process.exit(2); });",
		].join('\n');
		const output = execFileSync(process.execPath, ['--import', 'tsx', '-e', probe], {
			cwd: process.cwd(),
			encoding: 'utf8',
			env: { ...process.env, ROLLOVER_AUTO_SYNC_ENABLED: 'false' },
		});
		assert(output.includes('PROBE_ENABLED=false'), 'getAutomationStatus().enabled is false in a fresh process');
		assert(output.includes('[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false'), 'no timer starts and no detection runs');
		assert(output.includes('PROBE_SCHOOLS=0'), 'no school state is created when disabled');
	}

	console.log(`\nRollover graded-autonomy control suite complete: ${passCount} passed, ${failCount} failed.`);
	if (failCount > 0) {
		process.exitCode = 1;
	}
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
