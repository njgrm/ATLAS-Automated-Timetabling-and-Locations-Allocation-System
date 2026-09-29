/**
 * A2 mc, S2 — every warning row names its REAL section and subject. RENDERED +
 * DERIVED evidence.
 *
 * THE DEFECT (packet item 2), measured at base `c57b8e1d`:
 *
 *   sectionLabel: v.entities.sectionId != null ? sectionLabel(...) : 'Unknown section'
 *
 * `buildSectionLabel` / `buildSubjectLabel` resolve by the real numeric primary
 * key and NEVER return `Unknown section`. So the literal `Unknown section ·
 * Unknown subject` on screen meant exactly one thing: the violation carries no
 * `sectionId` and no `subjectId`.
 *
 * `atlas-server/src/services/constraint-validator.ts` emits exactly that shape
 * for several codes — `entities: { facultyId, day, entryIds }` with no section or
 * subject (lines 824, 1009, 1018, 1040, 1073, 1179, 1194, 1246) — while naming
 * the run's ENTRIES. The client already held the evidence.
 *
 * The fixture below is shaped EXACTLY like those emissions, and the rows prove:
 *   S2a the section and subject resolve from `entities.entryIds` against the
 *        run's own entries;
 *   S2b the honest fallback when nothing resolves says WHAT IS MISSING, in the
 *        operator's words, and never prints the word `Unknown` or a raw id;
 *   S2c the same treatment on `simple/SimpleTaskDrawerHelpers.buildBlockerGroups`,
 *        which held the identical two literals;
 *   S2d precedence: a violation that DOES carry its own ids keeps them, and the
 *        entry resolution never overrides a stated fact;
 *   S2e the fallback fires only when the evidence is genuinely absent — the
 *        control that makes S2a non-vacuous.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	NO_SECTION_ON_RECORD,
	NO_SUBJECT_ON_RECORD,
	resolveViolationEntityIdentity,
} from '@/lib/timetable-violation-identity';
import { deriveSimplePublishReadiness } from '@/components/timetable/simplePublishReadiness';
import { buildBlockerGroups } from '@/components/timetable/simple/SimpleTaskDrawerHelpers';

const sectionLabel = (id: number) => `7-Rizal ${id}`;
const subjectLabel = (id: number) => `TLE ${id}`;
const facultyLabel = (id: number) => `Mr Teacher ${id}`;

/** The run's entries — what `draft.entries` really is. */
const RUN_ENTRIES = [
	{ entryId: 'entry-1::t1', sectionId: 71, subjectId: 11, facultyId: 21, roomId: 31, day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, termIndex: 1 },
	{ entryId: 'entry-2::t1', sectionId: 72, subjectId: 12, facultyId: 22, roomId: 32, day: 'MONDAY', startTime: '07:30', endTime: '08:15', durationMinutes: 45, termIndex: 1 },
];

/** Shaped exactly like `constraint-validator.ts`: ids for the FACULTY only. */
function validatorViolation(code: string, entryIds: string[]): never {
	// `code` is cast, not narrowed: the wire type is `ViolationCode` and the point
	// of this fixture is to be shaped like the server's emission, which is a plain
	// object literal in that file too.
	return {
		code,
		severity: 'SOFT' as const,
		message: 'idle gap',
		schoolId: 1,
		schoolYearId: 1,
		runId: 318,
		entities: { facultyId: 21, day: 'MONDAY', startTime: '06:00', endTime: '06:45', entryIds },
	} as never;
}

function draftWith(entries: unknown[]) {
	return {
		runId: 318,
		status: 'COMPLETED',
		entries,
		version: 4,
		finishedAt: null,
		createdAt: '2026-09-29T00:00:00.000Z',
		summary: { unassignedCount: 0, blockingHardViolationCount: 0, softViolationCount: 1 },
		unassignedItems: [],
	} as never;
}

test('S2a a warning row names its real section and subject, resolved from entryIds', () => {
	const readiness = deriveSimplePublishReadiness(
		draftWith(RUN_ENTRIES),
		[validatorViolation('FACULTY_EXCESSIVE_IDLE_GAP', ['entry-2::t1'])],
		sectionLabel,
		subjectLabel,
		facultyLabel,
		{ blockingHardCount: 0, unassignedCount: 0, softCount: 1 },
	);
	const group = readiness.warningGroups[0];
	assert.equal(group.count, 1, 'one warning, so the label below is the one row');
	const item = group.items[0];
	assert.equal(item.sectionLabel, '7-Rizal 72', 'the section resolves from the violation own entry');
	assert.equal(item.subjectLabel, 'TLE 12', 'and so does the subject');
	assert.equal(item.facultyLabel, 'Mr Teacher 21', 'the faculty, which the violation DID carry, is unchanged');
	// The literal the base rendered for this exact violation shape.
	assert.doesNotMatch(`${item.sectionLabel} · ${item.subjectLabel}`, /Unknown/,
		'the recorded defect literal is gone for a violation the run can name');
});

test('S2b when nothing resolves the fallback says WHAT IS MISSING, never "Unknown" and never an id', () => {
	// The same validator shape, but the run's entries cannot be read — the honest
	// degraded case the fallback exists for.
	const readiness = deriveSimplePublishReadiness(
		draftWith([]),
		[validatorViolation('FACULTY_EXCESSIVE_IDLE_GAP', ['entry-2::t1'])],
		sectionLabel,
		subjectLabel,
		facultyLabel,
		{ blockingHardCount: 0, unassignedCount: 0, softCount: 1 },
	);
	const item = readiness.warningGroups[0].items[0];
	assert.equal(item.sectionLabel, NO_SECTION_ON_RECORD, 'the row says the section is absent, in words');
	assert.equal(item.subjectLabel, NO_SUBJECT_ON_RECORD, 'and the subject too');
	assert.doesNotMatch(`${item.sectionLabel} · ${item.subjectLabel}`, /Unknown/, 'the word Unknown never renders');
	assert.doesNotMatch(`${item.sectionLabel} · ${item.subjectLabel}`, /\d/, 'and no raw id is printed either');
});

test('S2c the same resolution and the same honest fallback on the task drawer blocker groups', () => {
	// A HARD code with only `entryIds` — `constraint-validator` emits this shape for
	// LACKING_FACULTY and the section/room family.
	const groups = buildBlockerGroups(
		[{
			code: 'SECTION_TIME_CONFLICT',
			severity: 'HARD',
			message: 'overlap',
			schoolId: 1,
			schoolYearId: 1,
			runId: 318,
			entities: { facultyId: 22, day: 'MONDAY', entryIds: ['entry-2::t1'] },
		} as never],
		sectionLabel,
		subjectLabel,
		facultyLabel,
		'run-wide',
		RUN_ENTRIES,
	);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].items.length, 1,
		'the row is LISTED — before this slice it named neither a section nor a subject and was dropped from the list while still counted');
	assert.equal(groups[0].items[0].sectionName, '7-Rizal 72');
	assert.equal(groups[0].items[0].subjectName, 'TLE 12');

	// The degraded case on this surface too.
	const unresolved = buildBlockerGroups(
		[{
			code: 'SECTION_TIME_CONFLICT',
			severity: 'HARD',
			message: 'overlap',
			schoolId: 1,
			schoolYearId: 1,
			runId: 318,
			entities: { facultyId: 22, day: 'MONDAY', entryIds: ['entry-2::t1'] },
		} as never],
		sectionLabel,
		subjectLabel,
		facultyLabel,
		'run-wide',
		[],
	);
	assert.equal(unresolved[0].items[0].sectionName, NO_SECTION_ON_RECORD,
		'the honest missing-fact sentence, not the recorded defect literal');
	assert.doesNotMatch(unresolved[0].items[0].sectionName, /Unknown/);
});

test('S2d precedence: a stated id wins, and entry resolution never overrides a stated fact', () => {
	const identity = resolveViolationEntityIdentity(
		{ code: 'FACULTY_TIME_CONFLICT', entities: { sectionId: 71, subjectId: 999, entryIds: ['entry-2::t1'] } },
		RUN_ENTRIES,
	);
	assert.equal(identity.from, 'entities');
	assert.equal(identity.sectionId, 71, 'the section the violation STATES is kept');
	assert.equal(identity.subjectId, 999,
		'and a stated subject is kept even when it names nothing the run holds: overriding a stated fact with an inference would be a second falsehood. The label resolver then renders what it can, and a `Section #<n>` shape is A2 c15 / A3 c16 surface, not this slice');
});

test('S2e the fallback fires ONLY when the evidence is absent — the control that makes S2a real', () => {
	// Named entry, resolvable: `from` is `entries`, not `none`. If the resolution
	// were a no-op the label assertions above would already fail, so this row pins
	// WHICH derivation produced the answer.
	const resolved = resolveViolationEntityIdentity(
		{ code: 'FACULTY_EXCESSIVE_IDLE_GAP', entities: { facultyId: 21, entryIds: ['entry-1::t1'] } },
		RUN_ENTRIES,
	);
	assert.equal(resolved.from, 'entries');
	assert.equal(resolved.sectionId, 71);
	assert.equal(resolved.subjectId, 11);

	// Several named entries that disagree: the FIRST in `entryIds` order wins, and
	// the row says nothing false — it names one real class of the conflict.
	const disagreed = resolveViolationEntityIdentity(
		{ code: 'FACULTY_EXCESSIVE_IDLE_GAP', entities: { entryIds: ['entry-2::t1', 'entry-1::t1'] } },
		RUN_ENTRIES,
	);
	assert.equal(disagreed.sectionId, 72, 'the first named entry decides, as documented');
	assert.equal(disagreed.subjectId, 12);

	// An unknown entry id resolves to nothing — never to a guess.
	const unknown = resolveViolationEntityIdentity(
		{ code: 'FACULTY_EXCESSIVE_IDLE_GAP', entities: { entryIds: ['entry-does-not-exist'] } },
		RUN_ENTRIES,
	);
	assert.equal(unknown.from, 'none');
	assert.equal(unknown.sectionId, null);
});
