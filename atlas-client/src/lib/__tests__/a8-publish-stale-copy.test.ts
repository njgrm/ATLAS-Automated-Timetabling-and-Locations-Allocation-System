/**
 * A8 — the Publish "inputs changed" error must NAME the changed inputs in plain
 * words and offer ONE next step.
 *
 * The two-domain fixture is the REAL live payload the operator hit on 2026-09-30:
 * publishing the latest draft of year 2026-2027 returned
 * `409 PUBLICATION_INPUTS_STALE` with `details.changedDomains:
 * ["teachingLoad","availability"]` (measured read-only from run 349). The single
 * `rooms` and three-domain cases are the same server contract with other sets.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
	formatChangedInputNames,
	publicationStalePublishMessage,
} from '@/components/timetable/timetableDriftRouting';
import { BUILD_NEW_DRAFT_LABEL } from '@/lib/timetable-plain-language';

test('names the real live pair in plain words, never the raw domain codes', () => {
	const message = publicationStalePublishMessage(['teachingLoad', 'availability']);
	assert.equal(
		message,
		`Publish blocked: Teaching Load and Teacher availability changed after this draft was built. ${BUILD_NEW_DRAFT_LABEL} to continue — any manual changes on this draft will be rebuilt.`,
	);
	assert.ok(!/[a-z][A-Z]/.test(message), `raw camelCase server code leaked: ${message}`);
	assert.ok(!message.includes('derivedDemand'));
});

test('offers exactly the locked one next step and says manual work is rebuilt', () => {
	const message = publicationStalePublishMessage(['teachingLoad', 'availability']);
	assert.ok(message.includes(`${BUILD_NEW_DRAFT_LABEL} to continue`), message);
	assert.ok(message.includes('any manual changes on this draft will be rebuilt'), message);
	assert.ok(!message.includes('Build a new draft'), 'the locked vocabulary is Generate -> Draft -> Published');
	assert.ok(!/\bstale\b|PUBLICATION_INPUTS_STALE|\b409\b/i.test(message), 'no jargon or raw code');
});

test('single changed input reads as one name', () => {
	assert.equal(
		publicationStalePublishMessage(['rooms']),
		`Publish blocked: Rooms changed after this draft was built. ${BUILD_NEW_DRAFT_LABEL} to continue — any manual changes on this draft will be rebuilt.`,
	);
});

test('three changed inputs read as a plain list', () => {
	assert.match(
		publicationStalePublishMessage(['rooms', 'sections', 'subjects']),
		/Rooms, Sections and Subjects changed after this draft was built\./,
	);
});

test('no changed domains and unknown domains fall back to "Setup data" — never an invented noun', () => {
	assert.match(publicationStalePublishMessage([]), /^Publish blocked: Setup data changed after this draft was built\./);
	assert.match(publicationStalePublishMessage(undefined), /^Publish blocked: Setup data changed/);
	assert.match(publicationStalePublishMessage(['mysteryDomain']), /^Publish blocked: Setup data changed/);
	assert.equal(formatChangedInputNames([]), null);
	assert.equal(formatChangedInputNames(['mysteryDomain']), null);
});
