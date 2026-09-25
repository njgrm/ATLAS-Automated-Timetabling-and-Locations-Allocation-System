/**
 * LANE-C-PLAIN-TOKENS-C04 (J2) — the mapping contracts, proved from the REAL
 * producers rather than from invented fixtures.
 *
 * Every enum member asserted here is read out of the production source that
 * defines it (`prisma/schema.prisma`, `atlas-client/src/types.ts`,
 * `atlas-server/src/services/manual-edit.service.ts`), because this area's
 * recorded failure mode is a control whose fixture already contained the
 * answer, or an assertion that could not fail. A `TotalEnum` check that
 * enumerates the live source fails if a member is added without wording, and the
 * mutant controls below prove the assertions discriminate.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	UNLABELLED_RULE_SENTENCE,
	generationRunKindLabel,
	generationRunStateLabel,
	manualEditActionLabel,
	roomRequestAppealState,
	roomRequestDecisionState,
	roomRequestSubmissionState,
	runAnchorLabel,
} from '../timetable-plain-language';
import { formatPolicyDeltaText } from '../violation-presentation';

const clientRoot = resolve(import.meta.dirname, '../../..');
const prismaSchema = readFileSync(resolve(clientRoot, '../prisma/schema.prisma'), 'utf8');
const clientTypes = readFileSync(resolve(clientRoot, 'src/types.ts'), 'utf8');
const manualEditService = readFileSync(resolve(clientRoot, '../atlas-server/src/services/manual-edit.service.ts'), 'utf8');

/** The live members of a Prisma enum, read from the schema. */
function prismaEnum(name: string): string[] {
	const body = prismaSchema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\}`))?.[1] ?? '';
	return Array.from(body.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*$/gm)).map((match) => match[1]);
}

/** The live members of a string-literal union, read from the client types. */
function stringUnion(typeName: string): string[] {
	const body = clientTypes.match(new RegExp(`export type ${typeName} =([\\s\\S]*?);`))?.[1] ?? '';
	return Array.from(body.matchAll(/'([^']+)'/g)).map((match) => match[1]);
}

const SCREAMING_SNAKE = /^[A-Z][A-Z0-9_]*$/;

test('J2 P2: every RoomPreferenceDecisionStatus member has plain wording that says what happens next', () => {
	const members = prismaEnum('RoomPreferenceDecisionStatus');
	assert.deepEqual(members, ['PENDING', 'APPROVED', 'REJECTED'], 'the assertion must read the live schema enum');
	for (const member of members) {
		const state = roomRequestDecisionState(member);
		assert.ok(state.label.trim().length > 0, `${member} needs a plain label`);
		assert.ok(state.next.trim().length > 0, `${member} needs a plain next step`);
		assert.doesNotMatch(`${state.label} ${state.next}`, SCREAMING_SNAKE, `${member} wording must not be a token`);
		assert.doesNotMatch(`${state.label} ${state.next}`, new RegExp(member), `${member} must not appear in its own wording`);
	}
	// P2's three required readings: waiting, approved, not approved.
	assert.match(roomRequestDecisionState('PENDING').label, /waiting/i);
	assert.match(roomRequestDecisionState('APPROVED').label, /approved/i);
	assert.match(roomRequestDecisionState('REJECTED').label, /not approved/i);
	assert.equal(roomRequestDecisionState('REJECTED').label.includes('REJECTED'), false);
});

test('J2 P2: every RoomPreferenceStatus member has plain wording', () => {
	const members = prismaEnum('RoomPreferenceStatus');
	assert.deepEqual(members, ['DRAFT', 'SUBMITTED']);
	for (const member of members) {
		const state = roomRequestSubmissionState(member);
		assert.ok(state.label.trim().length > 0, `${member} needs a plain label`);
		assert.ok(state.next.trim().length > 0, `${member} needs a plain next step`);
		assert.doesNotMatch(`${state.label} ${state.next}`, SCREAMING_SNAKE);
	}
	assert.match(roomRequestSubmissionState('DRAFT').label, /not sent/i);
});

test('J2 P2: every RoomRequestAppealStatus member has plain wording', () => {
	const members = prismaEnum('RoomRequestAppealStatus');
	assert.deepEqual(members, ['OPEN', 'UNDER_REVIEW', 'UPHELD', 'DENIED']);
	for (const member of members) {
		const wording = roomRequestAppealState(member);
		assert.ok(wording.trim().length > 0, `${member} needs plain wording`);
		assert.doesNotMatch(wording, SCREAMING_SNAKE, `${member} must not read as a token`);
		assert.doesNotMatch(wording, new RegExp(member), `${member} must not appear in its own wording`);
	}
});

test('J2 P2 mutant: an unmapped member degrades to English and never prints the token', () => {
	// The shape the server could send but this build has no wording for.
	for (const unknown of ['ESCALATED', 'DEFERRED']) {
		const decision = roomRequestDecisionState(unknown);
		assert.ok(decision.label.trim().length > 0, 'an unknown decision still reads as English');
		assert.equal(decision.label.includes(unknown), false, `the raw token ${unknown} must not be printed`);
		assert.equal(decision.next.includes(unknown), false);
		assert.equal(roomRequestAppealState(unknown).includes(unknown), false);
		const submission = roomRequestSubmissionState(unknown);
		assert.equal(submission.label.includes(unknown), false, `the raw token ${unknown} must not be printed`);
		assert.equal(submission.next.includes(unknown), false);
		// The non-vacuous form of the same claim: no SHOUTED token survives.
		assert.doesNotMatch(`${decision.label} ${decision.next} ${roomRequestAppealState(unknown)} ${submission.label} ${submission.next}`,
			/\b[A-Z][A-Z0-9_]{3,}\b/, 'no engine token may survive in any unknown-member fallback');
	}
	// A nullish status is the same case and must also stay English.
	assert.ok(roomRequestDecisionState(null).label.trim().length > 0);
	assert.ok(roomRequestDecisionState(undefined).label.trim().length > 0);
	// Discriminating: the control fails against the old `?? v.code` behaviour,
	// which is exactly `roomRequestDecisionState` returning the member itself.
	assert.notEqual(roomRequestDecisionState('ESCALATED').label, 'ESCALATED');
});

test('J2 P4: every ManualEditType member reads as what the edit did', () => {
	const members = prismaEnum('ManualEditType');
	assert.deepEqual(members, [
		'PLACE_UNASSIGNED', 'MOVE_ENTRY', 'CHANGE_ROOM', 'CHANGE_FACULTY',
		'CHANGE_TIMESLOT', 'SWAP_ENTRIES', 'REVERT',
	]);
	for (const member of members) {
		const wording = manualEditActionLabel(member);
		assert.ok(wording.trim().length > 0, `${member} needs plain wording`);
		assert.doesNotMatch(wording, SCREAMING_SNAKE, `${member} must not read as a token`);
		assert.doesNotMatch(wording, new RegExp(member), `${member} must not appear in its own wording`);
		assert.doesNotMatch(wording, /_/, `${member} must not leak an underscore`);
	}
	// TRACED: the old rendering was `editType.replaceAll('_', ' ')`, i.e. the
	// token with its underscores turned into spaces. This discriminates.
	assert.notEqual(manualEditActionLabel('PLACE_UNASSIGNED'), 'PLACE UNASSIGNED');
	assert.equal(manualEditActionLabel('SOMETHING_NEW'), 'Changed the schedule');
});

test('J2 P3: a run anchor pairs a plain phrase or a date with the run number as a quiet suffix', () => {
	assert.equal(runAnchorLabel(318, 'Sep 26, 08:05 PM'), 'Sep 26, 08:05 PM · run 318');
	assert.equal(runAnchorLabel(318), 'Generated schedule · run 318');
	assert.equal(runAnchorLabel(318, '   '), 'Generated schedule · run 318', 'a blank anchor is not an anchor');
	// The number survives, because it is the one id a scheduler can quote …
	assert.match(runAnchorLabel(318), /run 318/);
	// … but it is never the label on its own, and it is never a `#id`.
	assert.doesNotMatch(runAnchorLabel(318), /Run\s*#?\s*318\s*$/);
	assert.doesNotMatch(runAnchorLabel(318, 'Sep 26'), /#\d/);
});

test('J2 P3: every GenerationRunStatus member has plain wording, and runType does not claim what it cannot trace', () => {
	const members = prismaEnum('GenerationRunStatus');
	assert.deepEqual(members, ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']);
	for (const member of members) {
		const wording = generationRunStateLabel(member);
		assert.ok(wording.trim().length > 0, `${member} needs plain wording`);
		assert.doesNotMatch(wording, SCREAMING_SNAKE);
		assert.doesNotMatch(wording, new RegExp(member));
	}
	assert.equal(generationRunStateLabel('CANCELLED'), 'In a state this version does not name');
	// `runType` is a free-form column, so only the traced default is named.
	assert.match(prismaSchema, /runType\s+String\s+@default\("FULL"\)/);
	assert.equal(generationRunKindLabel('FULL'), 'Full run');
	assert.equal(generationRunKindLabel('PERFORMANCE_FIXTURE'), 'A different kind of run');
});

test('J2 P5: the shared unlabelled sentence is one sentence and never a de-snake-cased token', () => {
	assert.equal(UNLABELLED_RULE_SENTENCE, 'A problem that this version of ATLAS does not have a name for yet.');
	assert.doesNotMatch(UNLABELLED_RULE_SENTENCE, /_/);
	assert.doesNotMatch(UNLABELLED_RULE_SENTENCE, SCREAMING_SNAKE);
	assert.match(UNLABELLED_RULE_SENTENCE, /\.$/);
	// Discriminating against the old `code.replace(/_/g, ' ').toLowerCase()`:
	// for the retired travel code that produced "faculty excessive travel
	// distance", which the new sentence must not reproduce.
	assert.notEqual(UNLABELLED_RULE_SENTENCE, 'faculty excessive travel distance');
	assert.doesNotMatch(UNLABELLED_RULE_SENTENCE, /faculty/);
});

test('J2 P1: the policy delta humaniser keeps the server labels and drops only the tokens', () => {
	// Every delta shape is taken from the traced producer, not invented.
	const shapes = [
		'Limit: 200 min · Observed: 320 min · Δ +120 min',
		'Target: 360 min · Observed: 400 min · Δ +40 min',
		'Required: 10 min · Actual: 4 min · Short by 6 min',
		'Limit: 3 · Observed: 5 · Δ +2',
		'Target: 2 period(s) · Observed: 0 period(s)',
	];
	for (const shape of shapes) {
		// Fixture discipline: every `Label: value` label in the fixture must be
		// one the traced server producer really writes, so the fixture cannot be
		// shaped to flatter the formatter.
		for (const label of shape.split(' · ').map((part) => part.split(':')[0]).filter((part) => part !== shape.split(' · ').at(-1))) {
			assert.ok(manualEditService.includes(`${label}:`), `the traced producer must really build a "${label}:" part`);
		}
		const plain = formatPolicyDeltaText(shape);
		assert.doesNotMatch(plain, /Δ/, 'the delta glyph is not a word');
		assert.doesNotMatch(plain, /\bmin\b/, 'bare min must be spelled out');
		assert.doesNotMatch(plain, /period\(s\)/, 'the (s) construct must go');
		assert.doesNotMatch(plain, / · /, 'the separator must read as a sentence');
		assert.match(plain, /;/, 'the parts must be separated as sentences');
	}
	// Exact readings, so a later "improvement" cannot quietly relabel a value.
	assert.equal(formatPolicyDeltaText('Limit: 200 min · Observed: 320 min · Δ +120 min'),
		'Limit: 200 minutes; Observed: 320 minutes; 120 minutes over');
	assert.equal(formatPolicyDeltaText('Required: 10 min · Actual: 4 min · Short by 6 min'),
		'Required: 10 minutes; Actual: 4 minutes; Short by 6 minutes');
	assert.equal(formatPolicyDeltaText('Limit: 3 · Observed: 5 · Δ +2'),
		'Limit: 3; Observed: 5; 2 over');
	assert.equal(formatPolicyDeltaText('Target: 2 period(s) · Observed: 0 period(s)'),
		'Target: 2 periods; Observed: 0 periods');
	// The overage clause must not say "over the limit": one traced shape is
	// measured against a TARGET, not a limit.
	assert.doesNotMatch(formatPolicyDeltaText('Target: 360 min · Observed: 400 min · Δ +40 min'), /over the limit/);
	// The server's own labels survive, so no number is relabelled.
	assert.match(formatPolicyDeltaText('Limit: 200 min · Observed: 320 min · Δ +120 min'), /Limit: 200 minutes/);
	assert.match(formatPolicyDeltaText('Limit: 200 min · Observed: 320 min · Δ +120 min'), /Observed: 320 minutes/);
});
