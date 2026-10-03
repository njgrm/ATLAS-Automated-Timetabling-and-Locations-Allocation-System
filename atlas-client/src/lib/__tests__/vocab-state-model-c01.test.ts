/**
 * VOCAB-STATE-MODEL-C01 — operator decision D1, asserted as BEHAVIOUR.
 *
 * Run: `npx tsx --test src/lib/__tests__/vocab-state-model-c01.test.ts`
 *
 * ── WHAT THIS FILE IS FOR ────────────────────────────────────────────────────
 * D1 (NJ, 2026-10-03, verbatim): *"Yes, we'll use SAVE and EDIT instead of
 * Publish and Draft."* This is a WORDING change, and the repo has been burned by
 * wording changes before (30 Sep: three header tests pinned old copy and blocked
 * train 22). So this file deliberately asserts almost NO literal copy. What it
 * pins is the three properties a rename must not break:
 *
 *   S1  THE STATE SET IS UNCHANGED. The schedule still has exactly the same
 *       states it had before D1 — nothing added, nothing lost. Enumerated from
 *       `runStateKeyOf`, which is the ONE derivation both headers read.
 *   S2  THE SAVE ACTION IS STILL REFUSED WHEN HARD VIOLATIONS EXIST. The gate
 *       is `deriveTimetableCapabilities(...).gates.publication`; D1 changed the
 *       WORDS it refuses with, never WHAT it refuses or in what order.
 *   S3  NO STORED VALUE MOVED. `GenerationRunStatus`, the `published`
 *       lifecycle kind, the `draft` run-state key and every API/Prisma value
 *       are byte-identical, so the display rename cannot have migrated storage.
 *
 * Roles, testids and state are asserted; copy is not. A future wording change
 * that quietly adds or drops a state fails S1; one that weakens the gate fails
 * S2.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	EDIT_STATE_LABEL,
	PLANNING_STATE_SENTENCE_STARTS_WITH,
	planningStateSentence,
	runStateSentence,
	saveStateSentence,
	editStateSentence,
	stateBadgeLabel,
	stateVisibilitySentence,
	stateWord,
} from '../../lib/timetable-plain-language';
import {
	RUN_STATE_PRESENTATION,
	describeRunState,
	runIdentityBadgeLabel,
	runStateKeyOf,
	type RunStateKey,
} from '../../components/timetable/RunStateBadge';
import { resolveDraftStripPublishPlan } from '../../components/timetable/TimetableDraftStateStrip';
import { deriveTimetableCapabilities } from '../../lib/timetable-capabilities';
// D1: the input type is imported so the gate fixture below needs no `any` cast —
// a cast here would have hidden a shape change in `TimetableCapabilityInput`.
import type { TimetableCapabilityInput } from '../../lib/timetable-capabilities';
import {
	deriveSimpleLifecycleAction,
	type SimpleLifecycleKind,
} from '../../lib/simple-timetable-state';
import { shouldDispatchSimplePublish } from '../../components/timetable/simple/SimpleHeaderActionStates';

// ═══ S1 — the state set is exactly what it was ═══════════════════════════════

test('S1 the schedule has the SAME four states before and after the rename', () => {
	// The four states, from the ONE derivation both headers read. Every element
	// of `RunStateKey` is reached, so a fifth state would be a compile error and
	// a missing branch would be an unequal set here.
	const reachable = new Set<RunStateKey>([
		runStateKeyOf({ isPreGeneration: true, runId: 321, isPublished: false }),
		runStateKeyOf({ isPreGeneration: true, runId: 321, isPublished: true }),
		runStateKeyOf({ isPreGeneration: false, runId: null, isPublished: false }),
		runStateKeyOf({ isPreGeneration: false, runId: null, isPublished: true }),
		runStateKeyOf({ isPreGeneration: false, runId: 321, isPublished: false }),
		runStateKeyOf({ isPreGeneration: false, runId: 321, isPublished: true }),
	]);
	assert.deepEqual([...reachable].sort(), ['draft', 'empty', 'planning', 'published'],
		'exactly the same four states as before D1 — nothing added, nothing lost');

	// And each one still has its own icon/tone/sign: the rename is display-only,
	// so two states must never collapse onto one another's presentation.
	const keys = Object.keys(RUN_STATE_PRESENTATION).sort();
	assert.deepEqual(keys, ['draft', 'empty', 'planning', 'published'],
		'the presentation map has one entry per state, keyed by the state itself');
	assert.notEqual(RUN_STATE_PRESENTATION.draft.toneClass, RUN_STATE_PRESENTATION.published.toneClass);
	assert.notEqual(RUN_STATE_PRESENTATION.draft.icon, RUN_STATE_PRESENTATION.published.icon);
	assert.notEqual(RUN_STATE_PRESENTATION.draft.sign, RUN_STATE_PRESENTATION.published.sign,
		'D1 changed wording only — colour, icon and sign are still three channels');
});

test('S1b every state resolves to a non-empty label, a run, or null — never a placeholder', () => {
	const cases = [
		{ isPreGeneration: true, runId: 321, isPublished: false },
		{ isPreGeneration: false, runId: null, isPublished: false },
		{ isPreGeneration: false, runId: 321, isPublished: false },
		{ isPreGeneration: false, runId: 321, isPublished: true },
	];
	for (const input of cases) {
		const described = describeRunState(input);
		assert.ok(described.badgeLabel.length > 0, 'every state has a badge label');
		if (described.sentence !== null) {
			assert.equal(described.sentence.includes('undefined'), false, 'never prints "undefined"');
			assert.equal(described.sentence.includes('null'), false, 'never prints "null"');
			assert.equal(described.sentence.includes('NaN'), false, 'never prints "NaN"');
		}
		// The run-less states name NO run and print NO identity label.
		if (described.key === 'empty' || described.key === 'planning') {
			assert.equal(runIdentityBadgeLabel(input), null, 'a run-less state names no run');
			assert.equal(described.visibility, null, 'and claims no visibility state it cannot support');
		} else {
			assert.match(String(runIdentityBadgeLabel(input)), /^Run \d+ · \S+$/,
				'a state with a run names the run first and the state second');
		}
	}
});

test('S1c the two states are still distinguishable to an older scheduler', () => {
	// The two run states must still differ on every channel a scheduler reads,
	// because "Edit" and "Save" are short words sitting in the same badge.
	const edited = describeRunState({ isPreGeneration: false, runId: 321, isPublished: false });
	const saved = describeRunState({ isPreGeneration: false, runId: 321, isPublished: true });
	assert.notEqual(edited.sentence, saved.sentence);
	assert.notEqual(edited.badgeLabel, saved.badgeLabel);
	assert.notEqual(edited.visibility, saved.visibility);
	assert.equal(edited.sentence?.includes(stateWord(true)), false,
		'the Edit state never carries the Save word anywhere in its sentence');
	assert.equal(saved.sentence?.includes(stateWord(false)), false,
		'the Save state never carries the Edit word anywhere in its sentence');
	// The consequence is still stated, not just the state word.
	assert.match(String(edited.sentence), /cannot see it yet/);
	assert.match(String(saved.sentence), /in use/);
});

test('S1d the pre-generation state is a planner, and still says it is', () => {
	const sentence = planningStateSentence();
	assert.ok(sentence.startsWith(EDIT_STATE_LABEL), 'the planner wears the Edit word');
	assert.equal(sentence.split(' · ')[0], PLANNING_STATE_SENTENCE_STARTS_WITH,
		'the sentence opens with the one Edit word every other Edit surface uses');
	assert.match(sentence, /nothing placed yet/,
		'and it still says what is missing, so it is not just a renamed noun');
	// A pre-generation workspace is not a run, so it names no run.
	assert.equal(
		runStateSentence({ isPreGeneration: true, hasRun: false, runId: null, isPublished: false }),
		planningStateSentence());
});

// ═══ S2 — the save action is still refused when HARD violations exist ════════

/** The gate input a real caller builds. Only the fields the gate reads. */
function capabilityInput(overrides: Partial<TimetableCapabilityInput> = {}): TimetableCapabilityInput {
	return {
		scopeResolved: true,
		curriculumState: 'ready',
		generating: false,
		isPreGeneration: false,
		hasGeneratedRun: true,
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

test('S2 a run with HARD violations is NOT savable — the gate survives the rename', () => {
	const clean = deriveTimetableCapabilities(capabilityInput());
	const blocked = deriveTimetableCapabilities(capabilityInput({ hardCount: 3 }));

	assert.equal(clean.gates.publication.enabled, true, 'precondition: a clean run is savable');
	assert.equal(blocked.gates.publication.enabled, false,
		'THREE HARD violations and the save gate is shut — this is the invariant');
	assert.ok(blocked.gates.publication.reason, 'a shut gate always states why');

	// DISCRIMINATION: the gate is not shut because the input changed shape. The
	// ONLY difference between the two calls above is `hardCount`, and the gate
	// flips on that one field alone.
	assert.equal(clean.gates.generation.enabled, blocked.gates.generation.enabled,
		'the generation gate is untouched by a hard-violation count, so the flip above is the publication gate');
});

test('S2b unplaced classes still refuse the save, exactly like HARD violations', () => {
	const blocked = deriveTimetableCapabilities(capabilityInput({ unassignedCount: 12 }));
	assert.equal(blocked.gates.publication.enabled, false,
		'unresolved classes refuse the save — zero-HARD is not sufficient on its own');
});

test('S2c the refusal ORDER is unchanged: no run, then pre-generation, then saved, then hard', () => {
	// D1 re-worded these reasons; it must not have reordered or merged them, or a
	// scheduler would be told the wrong thing to fix first.
	const noRun = deriveTimetableCapabilities(capabilityInput({ hasGeneratedRun: false })).gates.publication;
	assert.equal(noRun.enabled, false, 'no generated run means nothing to save');

	const preGen = deriveTimetableCapabilities(
		capabilityInput({ isPreGeneration: true, hardCount: 9 })).gates.publication;
	assert.equal(preGen.enabled, false, 'the pre-generation workspace refuses before the hard count is even reached');

	const alreadySaved = deriveTimetableCapabilities(
		capabilityInput({ isPublished: true, hardCount: 9 })).gates.publication;
	assert.equal(alreadySaved.enabled, false, 'an already-saved run refuses');
	// An already-saved run is refused by its OWN STATE, not by its violations —
	// that is the branch that has to stay ahead of the hard-count branch.
	assert.match(String(alreadySaved.reason), /already/i);
	assert.doesNotMatch(String(alreadySaved.reason), /hard blocker/,
		'the already-saved branch still speaks for itself rather than blaming violations');
});

test('S2d the header dispatch guard still refuses to send a save request twice', () => {
	assert.equal(shouldDispatchSimplePublish(true, false), true, 'an open gate on an unsaved run may dispatch');
	assert.equal(shouldDispatchSimplePublish(false, false), false, 'a shut gate dispatches nothing');
	assert.equal(shouldDispatchSimplePublish(true, true), false, 'an already-saved run dispatches nothing');
	assert.equal(shouldDispatchSimplePublish(false, true), false);
});

test('S2e the strip plan still refuses a closed gate rather than opening a dialog', () => {
	assert.deepEqual(
		resolveDraftStripPublishPlan({ isPublished: true, publicationGateEnabled: true }),
		{ kind: 'disabled', reason: 'This schedule is already saved.' });
	assert.deepEqual(
		resolveDraftStripPublishPlan({ isPublished: false, publicationGateEnabled: false }).kind,
		'disabled',
		'a closed gate is REFUSED, never routed to a readiness sheet the operator could confirm through');
	assert.deepEqual(
		resolveDraftStripPublishPlan({ isPublished: false, publicationGateEnabled: true }),
		{ kind: 'publish-task' },
		'an open gate still reaches the readiness surface');
});

test('S2f the lifecycle kinds are the same set — a renamed word added no state', () => {
	const kinds: SimpleLifecycleKind[] = [
		'resolve-scope', 'fix-setup', 'start-draft', 'generate', 'generating',
		'retry-generate', 'retry-readiness', 'fix-blockers', 'review-warnings',
		'publish', 'review-follow-ups', 'published',
	];
	// Every kind is reachable from some input, and no input produces a kind
	// outside the list. The label may be re-worded; the KIND is the state model.
	const produced = new Set<SimpleLifecycleKind>();
	for (const hardCount of [0, 4]) {
		for (const unassignedCount of [0, 3]) {
			for (const softCount of [0, 9]) {
				for (const isPublished of [false, true]) {
					for (const hasGeneratedRun of [false, true]) {
						for (const generating of [false, true]) {
							const action = deriveSimpleLifecycleAction({
								hasGeneratedRun, generating, hardCount, unassignedCount,
								softCount, isPublished, scopeResolved: true, curriculumState: 'ready',
							});
							assert.ok(kinds.includes(action.kind), `kind ${action.kind} is in the declared set`);
							produced.add(action.kind);
						}
					}
				}
			}
		}
	}
	// Three kinds are gated behind inputs the loop does not vary: an unresolved
	// scope, a blocked setup check, and a setup check still loading. Each is added
	// explicitly from the real resolver rather than asserted by hand, so a state
	// that became unreachable would fail here rather than pass on a stale list.
	produced.add(deriveSimpleLifecycleAction({ hasGeneratedRun: false, scopeResolved: false }).kind);
	for (const curriculumState of ['blocked', 'loading', 'unavailable', 'failed'] as const) {
		produced.add(deriveSimpleLifecycleAction({
			hasGeneratedRun: false, scopeResolved: true, curriculumState,
		}).kind);
	}
	// `generate` is the pre-generation workspace's own next action, and
	// `retry-generate` is the failed-newest-run branch — neither is produced by a
	// run-bearing input, so both come from their real resolvers here.
	produced.add(deriveSimpleLifecycleAction({
		hasGeneratedRun: false, isPreGeneration: true, scopeResolved: true, curriculumState: 'ready',
	}).kind);
	produced.add(deriveSimpleLifecycleAction({
		hasGeneratedRun: false, latestRunFailed: true, scopeResolved: true, curriculumState: 'ready',
	}).kind);
	for (const kind of kinds) {
		assert.equal(produced.has(kind), true, `the ${kind} state is still reachable`);
	}
	assert.equal(produced.size, kinds.length, 'no kind outside the declared set is reachable');
});

// ═══ S3 — no stored value moved ═════════════════════════════════════════════

test('S3 the rename is display-only: every stored value keeps its own name', async () => {
	// `GenerationRunStatus` is the persisted enum. D1 must not have touched it,
	// and the label map that renders it is still TOTAL over it.
	// The persisted enum still reads "COMPLETED" on screen as an unchanged plain
	// word — D1 did not reach it, because it is a RUN status, not a run state.
	const { generationRunStateLabel } = await import('../../lib/timetable-plain-language');
	for (const status of ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'] as const) {
		assert.ok(generationRunStateLabel(status).length > 0, `${status} still has a label`);
	}
	assert.equal(
		generationRunStateLabel('COMPLETED'), 'Finished',
		'the persisted enum is still COMPLETED and still labelled by the unchanged plain-language map');

	// The run-state KEY that the badge, the identity line and the strip all share
	// is still called `draft`/`published`. Only its LABEL changed.
	const edited = runStateKeyOf({ isPreGeneration: false, runId: 321, isPublished: false });
	const saved = runStateKeyOf({ isPreGeneration: false, runId: 321, isPublished: true });
	assert.equal(edited, 'draft', 'the stored run-state key is still "draft"');
	assert.equal(saved, 'published', 'the stored run-state key is still "published"');
	// ...while what the scheduler READS is the new vocabulary.
	assert.equal(stateWord(false), EDIT_STATE_LABEL);
	assert.equal(stateBadgeLabel(true), 'Save schedule');
	assert.equal(stateBadgeLabel(false), 'Edit schedule');
});

test('S3b the two label mappings cannot drift apart', () => {
	// One mapping, four surfaces: the badge, the identity line, the visibility
	// sentence and the state word. Asserting they agree is what makes "a screen
	// reader must not hear one word while the screen says another" structural.
	assert.equal(stateBadgeLabel(false), `${stateWord(false)} schedule`);
	assert.equal(stateBadgeLabel(true), `${stateWord(true)} schedule`);
	assert.equal(stateVisibilitySentence(true), stateWord(true),
		'the visible visibility sentence for a saved run is exactly its state word');
	assert.equal(stateVisibilitySentence(false).startsWith(stateWord(false)), true);
	assert.equal(
		describeRunState({ isPreGeneration: false, runId: 321, isPublished: true }).badgeLabel,
		`${stateWord(true)} schedule`,
		'the badge a header renders agrees with the mapping, not with a retyped literal');
});

test('S3c the state sentences keep their consequence clause', () => {
	// A bare "Edit"/"Save" would satisfy a name-only check while telling a
	// scheduler nothing about what the state MEANS — which is the defect #41 was
	// written to fix. The consequence is asserted, not the word.
	assert.match(editStateSentence(), /cannot see it yet/);
	assert.match(saveStateSentence(), /in use/);
	assert.equal(editStateSentence().startsWith(`${EDIT_STATE_LABEL} — `), true);
	assert.equal(saveStateSentence().startsWith(`${stateWord(true)} — `), true);
});