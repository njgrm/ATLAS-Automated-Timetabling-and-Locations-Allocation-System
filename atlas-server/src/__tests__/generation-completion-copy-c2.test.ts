/**
 * A2-UX-SERVER-C2 — one generation, one operator-facing outcome message.
 *
 * A single generation produced THREE user-facing messages where one belongs:
 * a server "started" notification row, a client loading toast, and a server
 * "completed" notification row. The client half is a concurrent candidate's.
 * This file is the SERVER half, and it is the half an operator actually
 * receives: the started row was persisted and toasted, not merely logged.
 *
 * Two work items:
 *
 * 1. #58 — the in-flight `GENERATION_RUN_STARTED` publish is removed. It was a
 *    genuine user-facing notification row: `publishNotificationEvent`
 *    (notification-events.service.ts:107) buffers the event, fans it to SSE
 *    subscribers, and hands it to the durable inbox listener, which writes one
 *    `prisma.notification` row per recipient with `title = event.message`
 *    (notification-inbox.service.ts:290,315). The client toasted it globally
 *    because `generation` is in `GLOBAL_TOAST_DOMAINS`
 *    (useNotificationStream.ts:30) and the type is in
 *    `NOTIFICATION_EVENT_TYPES` (:34), so severity `info` took the
 *    `toast.info` default arm (:96). The COMPLETION row survives — it is the
 *    one that says the work is ready.
 *
 * 2. U4 — "Generation run #N completed with N session(s) this run could not
 *    place" becomes plain language. "run #", "session(s)" and the raw number
 *    are the engine's vocabulary; the operator's noun is "class", which is
 *    also the client's noun. The number itself is never re-derived:
 *    `buildGenerationCompletedMessage` receives the same
 *    `summary.unassignedCount` the persisted summary and the notification
 *    metadata already carry.
 *
 * 3. A TRUTHFUL ZERO. "All classes placed" is asserted only from a finite
 *    zero. An absent, NaN, infinite or negative count falls back to "New
 *    schedule ready." with no completeness claim — announcing an unmeasured
 *    count as 0 is the worst available lie, because a scheduler who reads it
 *    stops looking for the classes that have no slot.
 *
 * Hermetic: the real exported formatter, plus the real production source
 * expressions for the two strings that only exist inside the generation
 * transaction. No database, no network, no live mutation, no runtime.
 *
 * Run: `npm run test:generation-completion-copy-c2` (wired in
 * `atlas-server/package.json` in the same commit as this file).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildGenerationCompletedMessage } from '../services/generation.service.js';

const SERVICE_SOURCE = readFileSync(new URL('../services/generation.service.ts', import.meta.url), 'utf8');

/** Every user-facing string the generation lifecycle can send to a scheduler. */
function everyCopy(): string[] {
	return [
		buildGenerationCompletedMessage(0),
		buildGenerationCompletedMessage(1),
		buildGenerationCompletedMessage(2),
		buildGenerationCompletedMessage(1295),
		buildGenerationCompletedMessage(Number.NaN),
		buildGenerationCompletedMessage(Number.POSITIVE_INFINITY),
		buildGenerationCompletedMessage(-1),
	];
}

// ─── U4: the plain-language completion sentence ──────────────────────────────

test('U4: a real zero reads "New schedule ready. All classes placed."', () => {
	assert.equal(
		buildGenerationCompletedMessage(0),
		'New schedule ready. All classes placed.',
		'the zero case is the exact required sentence',
	);
});

test('U4: a non-zero count names the real number of classes still needing a time slot', () => {
	assert.equal(
		buildGenerationCompletedMessage(2),
		'New schedule ready. 2 classes still need a time slot.',
		'the plural case names the number, the noun, and the outstanding action',
	);
	assert.equal(
		buildGenerationCompletedMessage(1),
		'New schedule ready. 1 class still needs a time slot.',
		'one is a single class and a singular verb, not "1 class still need"',
	);
	assert.equal(
		buildGenerationCompletedMessage(1295),
		'New schedule ready. 1295 classes still need a time slot.',
		'the number is the caller\'s number, not a rounded or re-derived figure',
	);
});

test('U4: the sentence drops the run id and the engine noun', () => {
	for (const copy of everyCopy()) {
		assert.doesNotMatch(copy, /run #/i, `no run id in user-facing text: ${copy}`);
		assert.doesNotMatch(copy, /session/i, `the engine noun "session" is gone: ${copy}`);
		assert.doesNotMatch(copy, /\(s\)|session\(s\)/i, `no plural placeholder survives: ${copy}`);
		assert.doesNotMatch(copy, /unassigned/i, `the operator never sees "unassigned": ${copy}`);
	}
	assert.equal(
		buildGenerationCompletedMessage(2),
		'New schedule ready. 2 classes still need a time slot.',
		'the noun in the shipped sentence is "class"',
	);
});

// ─── A truthful zero ─────────────────────────────────────────────────────────

test('U4/truthful-zero: an unmeasured count is NEVER announced as zero', () => {
	for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, -100]) {
		const copy = buildGenerationCompletedMessage(bad);
		assert.doesNotMatch(
			copy,
			/All classes placed/,
			`a non-measurable count (${String(bad)}) must not claim every class is placed: ${copy}`,
		);
		assert.doesNotMatch(copy, /still need/i, `and must not invent an outstanding number: ${copy}`);
		assert.equal(copy, 'New schedule ready.', `the fallback is exactly the ready sentence, with no claim`);
	}
});

test('U4/truthful-zero: the completeness claim is a pure function of a finite zero', () => {
	// The discriminator: the claim appears for 0 and for nothing else, so this
	// assertion cannot pass vacuously against an always-say-0 implementation.
	const claims = [0, 1, 2, 7, Number.NaN, -1].map(
		(n) => buildGenerationCompletedMessage(n).includes('All classes placed'),
	);
	assert.deepEqual(claims, [true, false, false, false, false, false], 'only a finite zero claims completeness');
});

// ─── #58: the in-flight started row is gone; the outcome row survives ────────

test('#58: generation.service.ts publishes no GENERATION_RUN_STARTED notification', () => {
	assert.doesNotMatch(
		SERVICE_SOURCE,
		/type: 'GENERATION_RUN_STARTED'/,
		'the in-flight notification row must be removed from the publisher',
	);
	assert.doesNotMatch(
		SERVICE_SOURCE,
		/started\.`/,
		'the "started." user-facing message must not remain in the service',
	);
});

test('#58: the OUTCOME notification survives — completion and failure both still publish', () => {
	assert.match(
		SERVICE_SOURCE,
		/type: 'GENERATION_RUN_COMPLETED'/,
		'the completed row is the one that says the work is ready and must survive',
	);
	assert.match(
		SERVICE_SOURCE,
		/type: 'GENERATION_RUN_FAILED'/,
		'the failure row is untouched by this change',
	);
	// Exactly two publishes remain in the lifecycle, so the count of generation
	// notifications a scheduler can receive is now two (outcome) instead of
	// three (in-flight + outcome).
	const publishes = SERVICE_SOURCE.match(/publishNotificationEvent\(\{/g) ?? [];
	assert.equal(publishes.length, 2, 'the generation lifecycle publishes exactly two notifications');
});

test('#58: the run lifecycle itself is unchanged — RUNNING, startedAt and the audit rows remain', () => {
	assert.match(SERVICE_SOURCE, /status: 'RUNNING', startedAt/, 'the run still transitions to RUNNING with a start time');
	assert.match(SERVICE_SOURCE, /action: 'GENERATION_RUN_COMPLETED'/, 'the completion audit row is still written');
	assert.match(SERVICE_SOURCE, /action: 'GENERATION_RUN_FAILED'/, 'the failure audit row is still written');
});

// ─── The number on screen is the number the server computed ─────────────────

test('U4: the printed count is the server-computed summary count, not a re-derivation', () => {
	assert.match(
		SERVICE_SOURCE,
		/message: buildGenerationCompletedMessage\(summary\.unassignedCount\)/,
		'the formatter must receive the same computed count the summary and metadata carry',
	);
	assert.match(
		SERVICE_SOURCE,
		/unassignedCount: summary\.unassignedCount,/,
		'the notification metadata still carries the same computed count',
	);
	// `RunSummary.unassignedCount` is a REQUIRED `number`, so the value handed
	// to the formatter is always present — the "absent count" arm is defence,
	// not a normal path.
	assert.match(
		SERVICE_SOURCE,
		/export interface RunSummary \{[\s\S]*?unassignedCount: number;/,
		'RunSummary.unassignedCount is a required number, so it cannot be silently absent',
	);
});

test('U4: the formatter takes exactly one input and derives no number of its own', () => {
	// A pure formatter of the caller's count: the same input always yields the
	// same sentence, and no input is silently coerced to a different figure.
	assert.equal(buildGenerationCompletedMessage(3), buildGenerationCompletedMessage(3), 'deterministic');
	for (const n of [1, 2, 3, 10, 99, 100, 1295, 12345]) {
		const copy = buildGenerationCompletedMessage(n);
		assert.ok(
			copy.includes(String(n)),
			`the caller's own number ${n} must appear verbatim in "${copy}"`,
		);
	}
});
