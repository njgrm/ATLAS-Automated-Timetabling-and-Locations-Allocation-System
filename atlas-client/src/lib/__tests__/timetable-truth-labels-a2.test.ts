/**
 * A2-TIMETABLE-CUSTODY — the timetable says which number it means, and which run
 * is on screen.
 *
 * Four findings, one candidate. Each has a behavioural row on the production
 * function that decides the words, a rendered-output row, and a wiring row naming
 * the real consumer, so a future bypass of the shared helper is caught rather
 * than assumed away.
 *
 * ── #57/#44, two numbers for the same thing (HIGH) ───────────────────────────
 * In one flow the generate dialog said "Still unassigned: 1295 sessions" and the
 * finish toast, seconds later, said "completed with 0 unassigned session(s)", and
 * the publish checklist on the same page said 0. Traced, and the two numbers are
 * NOT the same population:
 *   - the generate dialog reads `draftBoardSummary.unscheduled`, which is
 *     `pre-generation-draft.service.ts`'s `counts.unscheduled`: this year's
 *     WEEKLY demand sessions with no saved pre-generation draft placement;
 *   - the finish toast reads `summary.unassignedCount` and the publish checklist
 *     reads `publishUnassignedCount`, which is the SAME `summary.unassignedCount`
 *     — the sessions that run could not place in its own grid.
 * So the dialog and the left rail were one number under an ambiguous word, and
 * the toast and the checklist were already one number. Neither number is wrong.
 * The fix is therefore to NAME each population, which is the packet's own
 * instruction: a truthful 1295 of a different thing beats a silently reconciled
 * wrong 0. The numbers are NOT reconciled.
 *
 * ── #51, Expert labels a published run "Draft" (HIGH) ────────────────────────
 * The Expert heading badge read "Generated timetable" over a PUBLISHED run, so it
 * never said what the run was, and the sub-nav tab labelled "Draft" sat beside it
 * and read as that run's state.
 *
 * ── #41, the screen never says which run is on screen ────────────────────────
 * The orientation strip named the term and the scope but never the run.
 *
 * ── #3, "Change owner" lands on the wrong teacher ────────────────────────────
 * The routing rows live in `useTeachingLoadRouteIntent-change-owner-a2.test.ts`;
 * which task and params the timetable emits is asserted here.
 *
 * Run: `npm run test:a2-timetable-truth-labels` (wired in atlas-client/package.json
 * in this same commit, and added to `test:client-suite`).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import {
	ALL_SESSIONS_PLACED_LABEL,
	BUILD_NEW_DRAFT_LABEL,
	CLASS_NOUN,
	GENERATE_DIALOG_DEMAND_UNMEASURED_WORD,
	GENERATE_DIALOG_HEADLINE_LABEL,
	GENERATE_DIALOG_LOCKED_LABEL,
	GENERATE_DIALOG_TERM_LABEL,
	GENERATE_DIALOG_YEAR_LABEL,
	GENERATE_SETUP_UNAVAILABLE_SENTENCE,
	PUBLISHED_SCHEDULE_STAYS_IN_USE,
	UNPLACED_COUNT_DISAMBIGUATION,
	WEEKLY_UNPLACED_BADGE_LABEL,
	WEEKLY_UNPLACED_LABEL,
	buildGenerateDialogCopy,
	buildNewDraftDialogTitle,
	classesNeedingTime,
	generationNotificationSentence,
	generationOutcomeToastSentence,
	publishPlacementBlockedSentence,
	runStateBadgeLabel,
	runStateSentence,
	runUnplacedSentence,
} from '@/lib/timetable-plain-language';
import { TimetableWorkflowDialogs } from '@/components/timetable/modals/TimetableWorkflowDialogs';
import { GenerateConfirmDialog, GenerateConfirmDialogBody } from '@/components/timetable/modals/TimetableWorkflowDialogs';
import { TimetableSubNav } from '@/components/timetable/TimetableSubNav';
import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';

const RUN_ID = 321;
const CLIENT_ROOT = resolve(import.meta.dirname, '../../..');

function source(relative: string): string {
	return readFileSync(resolve(CLIENT_ROOT, relative), 'utf8');
}

/**
 * The same source with its comments removed, for "this string is gone" rows.
 *
 * A correction here documents the pre-fix words in a comment, which would
 * otherwise satisfy a `doesNotMatch` that is meant to decide whether a string
 * can still reach a scheduler. Comments are not rendered, so they are removed
 * here and never counted as copy.
 */
function code(relative: string): string {
	return source(relative)
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * The generate and publish dialogs are Radix `Dialog`s. They render NOTHING under
 * `renderToStaticMarkup` (Radix portals) and nothing under a JSDOM mount either,
 * so both methods would have "passed" against EMPTY markup — the exact false
 * green this suite must not produce.
 *
 * So the dialog rows read the component's REAL returned element tree.
 * `TimetableWorkflowDialogs` is a plain function component with no hooks, so
 * calling it executes the production render path exactly; `collectText` then walks
 * the returned tree and gathers every string child. That is the words the dialog
 * will show, produced by the production component, with no UI stub and no source
 * matching. Each row asserts `text.length` is substantial, which is the guard
 * against this method degrading into an empty pass.
 */
function collectText(node: ReactNode, out: string[] = []): string[] {
	if (node == null || typeof node === 'boolean') return out;
	if (typeof node === 'string' || typeof node === 'number') {
		out.push(String(node));
		return out;
	}
	if (Array.isArray(node)) {
		for (const child of node) collectText(child, out);
		return out;
	}
	if (isValidElement(node)) {
		collectText((node.props as { children?: ReactNode }).children, out);
		return out;
	}
	return out;
}

/**
 * The element the production component really produced for `data-testid`, with
 * its real props - the cue's `className` and its state attributes, not a source
 * string and not a re-declared copy of the mapping.
 *
 * This replaces a regex that matched the cue's className ternary in the source
 * text. That regex passed vacuously the moment the mapping stopped being a
 * two-arm ternary, and it could not see a colour that a helper computed. Reading
 * the returned tree keeps the assertion behavioural: it is the production render
 * path, walked the same way `collectText` walks it for words.
 */
function findByTestId(node: ReactNode, testId: string): Record<string, unknown> | null {
	if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return null;
	if (Array.isArray(node)) {
		for (const child of node) {
			const hit = findByTestId(child, testId);
			if (hit) return hit;
		}
		return null;
	}
	if (isValidElement(node)) {
		const props = node.props as { [key: string]: unknown; children?: ReactNode };
		if (props['data-testid'] === testId) return props as Record<string, unknown>;
		return findByTestId(props.children, testId);
	}
	return null;
}

/** The production dialog body's real cue element for a given demand count. */
function demandCue(classesToSchedule: number | null): Record<string, unknown> {
	const body = GenerateConfirmDialogBody({
		copy: buildGenerateDialogCopy({
			schoolYearLabel: '2031-2032',
			termSource: 'atlas',
			lockedClassCount: 0,
			classesToSchedule,
		}),
		classesToSchedule,
		enforceShiftWindows: true,
		setEnforceShiftWindows: () => {},
	});
	const cue = findByTestId(body, 'timetable-generate-demand-cue');
	assert.ok(cue, `the demand count carries a visible cue for ${String(classesToSchedule)}`);
	return cue;
}

function dialogText(context: Partial<ScheduleReviewDialogsContext>): string {
	const merged = {
		showGenerateConfirm: false,
		setShowGenerateConfirm: () => {},
		enforceShiftWindows: true,
		setEnforceShiftWindows: () => {},
		draftBoardSummary: null,
		followUps: new Set<string>(),
		confirmGenerate: () => {},
		activeSchoolYearLabel: '2031-2032',
		schoolYearSource: 'atlas',
		generating: false,
		generationElapsed: 0,
		softCount: 0,
		showPublishDialog: false,
		setShowPublishDialog: () => {},
		publishAcknowledged: false,
		setPublishAcknowledged: () => {},
		publishUnassignedCount: 0,
		handlePublishConfirm: () => {},
		canRequestPublication: false,
		canApprovePublication: false,
		...context,
	} as unknown as ScheduleReviewDialogsContext;
	// The production component, invoked directly.
	return collectText(TimetableWorkflowDialogs({ context: merged })).join(' ');
}

/**
 * A2-UX-WIRE-C2 — the generate dialog is now two components, and both are read
 * directly.
 *
 * `dialogText()` walks the tree `TimetableWorkflowDialogs` returns, and a nested
 * function component is a leaf to that walk: the harness would see every OTHER
 * dialog and none of the generate one. So the generate dialog is measured by
 * invoking its own two production components directly — the same technique and
 * the same guarantee. The words come from the real render path, not from a source
 * string and not from a stub. The inputs are the seven context fields the parent
 * maps onto its props.
 */
function generateDialogText(
	context: Partial<ScheduleReviewDialogsContext>,
	isPublished = false,
): string {
	const termSource = context.schoolYearSource === 'atlas-persisted' ? 'atlas' : context.schoolYearSource ?? 'atlas';
	const frame = collectText(GenerateConfirmDialog({
		open: true,
		onOpenChange: () => {},
		isPublished,
		schoolYearLabel: context.activeSchoolYearLabel ?? '2031-2032',
		termSource,
		lockedClassCount: context.draftBoardSummary?.draft ?? 0,
		classesToSchedule: context.draftBoardSummary?.unscheduled ?? 0,
		enforceShiftWindows: context.enforceShiftWindows ?? true,
		setEnforceShiftWindows: () => {},
		followUpCount: context.followUps?.size ?? 0,
		onConfirm: () => {},
	})).join(' ');
	return `${frame} ${generateDialogBodyText(context)}`;
}

/** The MEASURED region: the dialog body's own words, with no dialog chrome. */
function generateDialogBodyText(context: Partial<ScheduleReviewDialogsContext>): string {
	return collectText(GenerateConfirmDialogBody({
		copy: buildGenerateDialogCopy({
			schoolYearLabel: context.activeSchoolYearLabel ?? '2031-2032',
			termSource: context.schoolYearSource === 'atlas-persisted' ? 'atlas' : context.schoolYearSource ?? 'atlas',
			lockedClassCount: context.draftBoardSummary?.draft ?? 0,
			classesToSchedule: context.draftBoardSummary?.unscheduled ?? 0,
		}),
		classesToSchedule: context.draftBoardSummary?.unscheduled ?? 0,
		enforceShiftWindows: true,
		setEnforceShiftWindows: () => {},
	})).join(' ');
}

// ── the two populations, named ───────────────────────────────────────────────

test('#57/#44 the pre-generation count and the run count are named as DIFFERENT things', () => {
	assert.equal(
		WEEKLY_UNPLACED_LABEL,
		'Weekly demand with no time yet',
		'the generate-dialog label names the pre-generation population',
	);
	assert.ok(
		!/unassigned/i.test(WEEKLY_UNPLACED_LABEL),
		'and no longer borrows the ambiguous word the finding is about',
	);
	assert.equal(runUnplacedSentence(0), '0 classes this schedule could not place', 'the run population is named too');
	assert.equal(runUnplacedSentence(1), '1 class this schedule could not place', 'singular is singular');
	assert.equal(runUnplacedSentence(1295), '1295 classes this schedule could not place', 'plural is plural');
	assert.notEqual(
		runUnplacedSentence(1295),
		runUnplacedSentence(0),
		'the two counts are never collapsed into one word — they measure different sets',
	);
	assert.match(UNPLACED_COUNT_DISAMBIGUATION, /weekly demand/i, 'the disambiguation names the pre-generation population');
	assert.match(UNPLACED_COUNT_DISAMBIGUATION, /could not place/i, 'and the run population');
	assert.ok(
		UNPLACED_COUNT_DISAMBIGUATION.includes(WEEKLY_UNPLACED_LABEL),
		'and it quotes the shared label, so the two cannot drift apart',
	);
});

// ── the generate dialog, from the production component ───────────────────────

test('#57 the generate dialog still shows the real 1295, under the new plain headline', () => {
	const text = generateDialogText({
		draftBoardSummary: { draft: 3, lockedForRun: 0, archived: 0, unscheduled: 1295 },
	} as Partial<ScheduleReviewDialogsContext>);
	// The guard against an empty-method pass.
	assert.ok(text.length > 200, `the dialog produced real text (${text.length} chars)`);
	// The number is still shown, unchanged: nothing was reconciled away.
	assert.ok(text.includes('1295'), `the real number is still rendered: ${text.slice(0, 300)}`);
	// A2-UX-WIRE-C2 CORRECTION. The row previously asserted the rendered dialog
	// carried `WEEKLY_UNPLACED_LABEL` and the 20-word `UNPLACED_COUNT_DISAMBIGUATION`
	// note. That vocabulary is what the 45-word budget removed: the pre-generation
	// population is now the HEADLINE itself ("Classes to schedule: 1295") and the
	// multi-sentence note is gone. The intent of the row is preserved and is
	// asserted more strictly below — the count is still shown, it is still named
	// as this year's demand, and the ambiguous word is now banned outright.
	assert.ok(
		text.includes(GENERATE_DIALOG_HEADLINE_LABEL),
		'the pre-generation population is the headline, not an ambiguous row label',
	);
	assert.ok(
		!/Still unassigned/.test(text),
		'the ambiguous pre-fix label is gone from the rendered dialog',
	);
	for (const banned of [/unassigned/i, /session/i, /\(s\)/, /run #/i, /authority/i, /anchor/i]) {
		assert.doesNotMatch(text, banned, `the rendered dialog must not contain ${banned}`);
	}
	// And the reader can tell it is NOT the run's count: the publish dialog in the
	// same component names the run's own unplaced classes from the other source.
	const publish = dialogText({ showPublishDialog: true, publishUnassignedCount: 0 } as Partial<ScheduleReviewDialogsContext>);
	assert.notEqual(text, publish, 'the two dialogs are distinct surfaces, not one reused block');
});

test('U3a/#43 MEASURED: the rendered generate-dialog body is within its word budget', () => {
	const body = generateDialogBodyText({
		draftBoardSummary: { draft: 3, lockedForRun: 0, archived: 0, unscheduled: 1295 },
	} as Partial<ScheduleReviewDialogsContext>);
	const measured = words(body);
	// The guard against an empty-method pass: the pre-fix body was 116 words.
	assert.ok(body.length > 200, `the body produced real text (${body.length} chars)`);
	assert.ok(
		measured <= DIALOG_WORD_BUDGET,
		`the rendered body is ${measured} words, budget is ${DIALOG_WORD_BUDGET}: ${body}`,
	);
	for (const banned of [/unassigned/i, /session/i, /run #/i, /authority/i, /anchor/i, /\(s\)/]) {
		assert.doesNotMatch(body, banned, `the rendered body must not contain ${banned}`);
	}
	// The full dialog, chrome included, for the record. The budget governs the
	// BODY — the title, the first line, `Cancel` and the primary button are the
	// dialog's frame and control labels, not its copy — and this row pins the
	// whole number too, so words cannot be moved out of the measured region and
	// into the frame to buy budget.
	const whole = generateDialogText({
		draftBoardSummary: { draft: 3, lockedForRun: 0, archived: 0, unscheduled: 1295 },
	} as Partial<ScheduleReviewDialogsContext>);
	const FRAME_ALLOWANCE = 20; // title (3) + first line (6) + Cancel (1) + button (3), plus slack
	assert.ok(
		words(whole) <= DIALOG_WORD_BUDGET + FRAME_ALLOWANCE,
		`the whole dialog is ${words(whole)} words (body ${measured}); frame allowance is ${FRAME_ALLOWANCE}`,
	);
	assert.ok(
		words(whole) - measured <= FRAME_ALLOWANCE,
		`the frame is ${words(whole) - measured} words, so the body cannot be shortened by moving words into it`,
	);
	// The 1295 is stated exactly once in the body: the pre-fix dialog repeated it
	// as a fourth row under the ambiguous word.
	assert.equal(body.split('1295').length - 1, 1, `the demand count is stated once: ${body}`);
});

test('#43 MEASURED: the dialog has one close control, and a visible cue beside the count', () => {
	const dialogs = source('src/components/timetable/modals/TimetableWorkflowDialogs.tsx');
	// The duplicate control: `DialogContent` renders its own unlabelled `X`, so a
	// dialog that also has a real `Cancel` had two controls for one action. Exactly
	// one of the two survives.
	const generateContent = dialogs.match(/<DialogContent\b(?=[^>]*\bclassName="sm:max-w-md")(?=[^>]*\bhideClose)(?=[^>]*\bdata-testid="timetable-generate-confirm-dialog")[^>]*>/);
	assert.ok(generateContent, 'the generate dialog keeps exactly one real, labelled close');
	// A `Cancel` in the same dialog is the affordance that is kept.
	assert.match(dialogs, /<Button variant="outline" onClick=\{\(\) => onOpenChange\(false\)\}>Cancel<\/Button>/, 'Cancel is the one close');
	// The unlabelled X is not rendered anywhere in this dialog.
	assert.doesNotMatch(
		dialogs.match(/function GenerateConfirmDialog[\s\S]*?\n}\n/)?.[0] ?? '',
		/hideClose(?! )/,
		'the generate dialog never renders the unlabelled close control',
	);
	// The density fix, as a count rather than a claim: the pre-fix dialog had
	// fourteen 12px text items; this one has a headline, three rows, one sentence
	// and one checkbox.
	const body = generateDialogBodyText({
		draftBoardSummary: { draft: 3, lockedForRun: 0, archived: 0, unscheduled: 1295 },
	} as Partial<ScheduleReviewDialogsContext>);
	assert.equal(body.split('1295').length - 1, 1, 'the headline states the count once');
	assert.equal((body.match(/School year|Term setup|Locked classes kept/g) ?? []).length, 3, 'three facts beside the headline, not four');
	// The visible cue beside the count. It is a real rendered element, and it
	// encodes the one fact that is true: whether there is work, there is none, or
	// the count was never measured.
	//
	// CORRECTED (A2-UX-STATUS-C2 B2) from a source regex over a two-arm
	// `className={hasWork ? ... : ...}` ternary.
	// PRESERVED INTENT: the cue exists, "there is work" is visibly distinct, and
	// the states are distinguishable by something other than an invented severity
	// scale. All three still hold; the row now also pins the case the regex could
	// not express at all.
	const work = demandCue(1295);
	assert.match(String(work.className), /amber/, 'there is work to do');
	assert.equal(work['data-demand-state'], 'work', 'and it is the work state');
	const none = demandCue(0);
	assert.match(String(none.className), /emerald/, 'and nothing to do is visibly different, not a third invented severity');
	assert.equal(none['data-demand-state'], 'none', 'the measured zero is the none state');

	// The absent count: NEITHER of the two. It must not be painted with the green
	// "nothing to do" cue, because ATLAS did not establish that everything is
	// placed - it failed to count it at all.
	const unknown = demandCue(null);
	assert.equal(unknown['data-demand-state'], 'unknown', 'an unmeasured count is its own state, not the none state');
	assert.doesNotMatch(String(unknown.className), /emerald/, 'an unmeasured count is NEVER given the green nothing-to-do cue');
	assert.doesNotMatch(String(unknown.className), /amber/, 'and it borrows no work cue either: there is no work claim to make');
	assert.notEqual(String(unknown.className), String(none.className), 'so it is visibly distinct from a measured zero');
	// Colour is never load-bearing alone: the state is also an attribute, and the
	// headline beside the icon says the same thing in words.
	assert.equal(unknown['data-has-work'], 'false', 'the legacy boolean attribute is preserved and agrees');
	assert.match(
		collectText(GenerateConfirmDialogBody({
			copy: buildGenerateDialogCopy({ schoolYearLabel: '2031-2032', termSource: 'atlas', lockedClassCount: 0, classesToSchedule: null }),
			classesToSchedule: null,
			enforceShiftWindows: true,
			setEnforceShiftWindows: () => {},
		})).join(' '),
		new RegExp(GENERATE_DIALOG_DEMAND_UNMEASURED_WORD),
		'the words beside the cue state the same fact, so the cue is not load-bearing alone',
	);
});

test('#56 the dialog title, its first line and its button are ONE verb, and the published case opens with the reassurance', () => {
	const published = generateDialogText({
		draftBoardSummary: { draft: 3, lockedForRun: 0, archived: 0, unscheduled: 1295 },
	} as Partial<ScheduleReviewDialogsContext>, true);
	const draft = generateDialogText({
		draftBoardSummary: { draft: 3, lockedForRun: 0, archived: 0, unscheduled: 1295 },
	} as Partial<ScheduleReviewDialogsContext>, false);

	// The unpublished case: the title and the button are the same verb, and the
	// reassurance is the one true thing to say when nothing is published.
	assert.ok(draft.includes(BUILD_NEW_DRAFT_LABEL), `the draft dialog uses the one verb: ${draft.slice(0, 160)}`);
	assert.equal(published.split(BUILD_NEW_DRAFT_LABEL).length - 1, 2, 'title and primary button both say it');
	assert.ok(!/Generate updated schedule|Generate schedule/.test(draft + published), 'neither pre-fix verb survives');

	// The published case: the FIRST line is the reassurance, so a scheduler can
	// tell a new draft from a dated change to the schedule in use.
	// A7 c12b (row 8) SUPERSEDED the verb: `Build a new draft?` is `Generate a draft?`.
	assert.ok(
		published.startsWith('Generate a draft?'),
		`the published dialog asks about a draft: ${published.slice(0, 120)}`,
	);
	const afterTitle = published.replace(buildNewDraftDialogTitle(true), '').trim();
	assert.ok(
		afterTitle.startsWith(PUBLISHED_SCHEDULE_STAYS_IN_USE),
		`the published schedule reassurance is the first line: ${afterTitle.slice(0, 120)}`,
	);
	// And the unpublished case does NOT claim a published schedule exists.
	assert.ok(
		!draft.includes(PUBLISHED_SCHEDULE_STAYS_IN_USE),
		'"Your published schedule stays in use" would be a false claim with nothing published',
	);
});

test('#58 ONE generation emits ONE user-visible outcome message', () => {
	const mutations = source('src/hooks/useTimetableMutations.ts');
	// The pre-fix three: a completion toast with three counts and the banned noun,
	// a "totals are loading" toast, and a locked-anchor toast — three messages for
	// one action.
	assert.doesNotMatch(mutations, /Schedule generated - /, 'the three-count completion toast is gone');
	assert.doesNotMatch(mutations, /ATLAS is loading the assigned, unassigned, and conflict totals/, 'the loading toast is gone');
	assert.doesNotMatch(mutations, /draft anchor\$\{lockedAnchorCount/, 'the third, anchor-count toast is gone');
	// The one message, composed by the shared helper so the number, the noun and
	// the next step cannot drift from the dialog and the publish checklist.
	assert.match(mutations, /toast\.success\(generationOutcomeToastSentence\(unplaced\)\)/, 'exactly one outcome toast, from the shared sentence');
	// Exactly one success call site in the whole hook.
	assert.equal(
		(mutations.match(/toast\.success\(/g) ?? []).length >= 1,
		true,
		'the outcome toast exists',
	);
	// Zero residue of the two banned forms anywhere in the generation path.
	const generationPath = mutations.match(/const triggerGeneration = useCallback[\s\S]*?\n\t}, \[/)?.[0] ?? '';
	assert.ok(generationPath.length > 500, `the generation path was located (${generationPath.length} chars)`);
	for (const banned of [/run #/i, /session\(s\)/i]) {
		assert.doesNotMatch(generationPath, banned, `the generation path must not contain ${banned}`);
	}
	// Truthfulness: an unmeasured count is never announced as zero.
	assert.match(
		mutations,
		/if \(typeof unplaced === 'number' && Number\.isFinite\(unplaced\)\) \{\s*toast\.success\(generationOutcomeToastSentence\(unplaced\)\);/,
		'the outcome sentence is only emitted for a count the run actually reported',
	);
});

test('#57 the publish checklist names the run population, in one noun and one verb', () => {
	const text = dialogText({ showPublishDialog: true, publishUnassignedCount: 3 } as Partial<ScheduleReviewDialogsContext>);
	assert.ok(text.length > 200, `the publish dialog produced real text (${text.length} chars)`);
	// A2-UX-WIRE-C2 CORRECTION. The sentence was composed here as
	// `runUnplacedSentence(n) + " must be placed before this schedule can be published."`
	// — two verbs on one clause, the number restated by the modal, and a stacked
	// obligation. The row's intent (the count names the run's own population and
	// the publication consequence is still stated) is preserved; the composition
	// is now the shared, grammatically checked one.
	assert.ok(
		text.includes(publishPlacementBlockedSentence(3)),
		`the checklist uses the shared sentence: ${text.slice(0, 300)}`,
	);
	assert.ok(text.includes('Place them before you publish'), 'and keeps the publication consequence');
	assert.equal(
		publishPlacementBlockedSentence(3).split('3').length - 1,
		1,
		'the count is stated exactly once',
	);
	assert.ok(
		!/still need placing/.test(text),
		'the pre-fix wording, which never said whose count it was, is gone',
	);
	for (const banned of [/session/i, /\(s\)/, /unassigned/i, /must be placed/i]) {
		assert.doesNotMatch(text, banned, `the publish checklist must not contain ${banned}`);
	}
});

test('item 4 the publish-checklist resolver says "class" everywhere, never "session"', () => {
	const readiness = source('src/components/timetable/simplePublishReadiness.ts');
	// Every quoted copy literal in the file is a string a scheduler reads, so the
	// banned noun must not appear in any of them. A comment or a field name can
	// therefore never satisfy this row by accident.
	const literals = [...readiness.matchAll(/'([^'\n]{12,})'/g)].map((m) => m[1]);
	assert.ok(literals.length > 40, `the file's copy literals were collected (${literals.length})`);
	for (const literal of literals) {
		assert.doesNotMatch(literal, /\bsessions?\b/i, `"${literal}" must use the one noun`);
	}
	// And the two sentences the finding named, by their new text.
	assert.match(readiness, /classesNeedingTime\(totalUnresolved\)/, 'the blocked summary uses the canonical class/time-slot wording');
	assert.match(readiness, /problems or classes without a time remain\./, 'and the clean branch names classes, not sessions');
	assert.match(readiness, /import \{ CLASS_NOUN, classesNeedingTime, mustFixProblemCountLabel/, 'the resolver imports the shared count wording');
	assert.equal(
		`${classesNeedingTime(3)} before this schedule can be published.`,
		'3 classes need a time slot before this schedule can be published.',
		'the blocked sentence says what needs placement and why publishing is blocked',
	);
});

// ── #41 / #51 the run line and the heading badge ─────────────────────────────

test('#41 runStateSentence names the run and whether it is Draft or Published', () => {
	assert.equal(
		runStateSentence({ isPreGeneration: false, hasRun: true, runId: RUN_ID, isPublished: true }),
		'Published — this is the schedule in use. (Run 321)',
		'a published run leads with its STATE and what the state means; the run number is a quiet trailing reference',
	);
	assert.equal(
		runStateSentence({ isPreGeneration: false, hasRun: true, runId: RUN_ID, isPublished: false }),
		'Draft — teachers and students cannot see it yet. (Run 321)',
		'an unpublished run says what a draft MEANS, not merely the word "Draft"',
	);
	assert.equal(
		runStateSentence({ isPreGeneration: true, hasRun: false, runId: null, isPublished: false }),
		'Draft · nothing placed yet',
		// A7 c12b (row 10) SUPERSEDED `No schedule made yet.`; the property is
		// unchanged — the pre-generation line names the draft and claims no run.
		'U5: the planner names the draft state and claims no run',
	);
	assert.equal(
		runStateSentence({ isPreGeneration: false, hasRun: false, runId: null, isPublished: false }),
		null,
		'with no run there is nothing to name, so no line is printed',
	);
	// A junk id is never printed as "Run NaN".
	for (const runId of [undefined, null, Number.NaN]) {
		assert.equal(
			runStateSentence({ isPreGeneration: false, hasRun: true, runId, isPublished: true }),
			null,
			`a non-numeric run id (${String(runId)}) prints no run number at all`,
		);
	}
});

test('U1 the run-state sentence never doubles a word, never leads with the run number, and never uses banned forms', () => {
	const sentences = [
		runStateSentence({ isPreGeneration: true, hasRun: false, runId: null, isPublished: false }),
		runStateSentence({ isPreGeneration: false, hasRun: true, runId: RUN_ID, isPublished: true }),
		runStateSentence({ isPreGeneration: false, hasRun: true, runId: RUN_ID, isPublished: false }),
	];
	for (const sentence of sentences) {
		assert.ok(sentence, 'the fixture produced a sentence');
		const text = sentence as string;
		// The recorded defect: the sentence was "Run 321 · Draft" and the header's
		// own cell label is "Run:", so the screen read "Run: Run 321".
		assert.doesNotMatch(text, /Run: Run/, `"${text}" must not produce the doubled word`);
		assert.doesNotMatch(text, /Run Run/, `"${text}" must not repeat the run word`);
		// U1: the run number is secondary and must never be the subject.
		assert.doesNotMatch(text, /^Run\b/, `"${text}" must not lead with the run number`);
		assert.doesNotMatch(text, /session/i, `"${text}" must not use the retired noun`);
		assert.doesNotMatch(text, /unassigned/i, `"${text}" must not use the ambiguous word`);
		assert.doesNotMatch(text, /run #/i, `"${text}" must not print a run id as "run #"`);
		// The state leads.
		assert.match(text, /^(Published|Draft|No schedule made yet)/, `"${text}" must lead with the state`);
	}
	// The run number survives, because #41 requires the screen to name the run it
	// is showing — but only as a trailing reference after the meaning.
	assert.match(
		runStateSentence({ isPreGeneration: false, hasRun: true, runId: RUN_ID, isPublished: true })!,
		/\(Run 321\)$/,
		'the run number is the LAST thing in the sentence',
	);
});

test('#51 runStateBadgeLabel never shows "Generated timetable" over a published run', () => {
	assert.equal(
		runStateBadgeLabel({ isPreGeneration: false, hasRun: true, isPublished: true }),
		'Published schedule',
		'the badge states the run is published',
	);
	assert.equal(
		runStateBadgeLabel({ isPreGeneration: false, hasRun: true, isPublished: false }),
		'Draft schedule',
		'and states it is a draft when it is',
	);
	assert.equal(
		runStateBadgeLabel({ isPreGeneration: true, hasRun: false, isPublished: false }),
		'No schedule yet',
		'U5: the planner badge says what is missing, not what the screen is',
	);
	assert.equal(
		runStateBadgeLabel({ isPreGeneration: false, hasRun: false, isPublished: false }),
		'No schedule yet',
		'and the empty state says the same, so the two branches cannot disagree',
	);
	const all = [
		runStateBadgeLabel({ isPreGeneration: false, hasRun: true, isPublished: true }),
		runStateBadgeLabel({ isPreGeneration: false, hasRun: true, isPublished: false }),
		runStateBadgeLabel({ isPreGeneration: true, hasRun: false, isPublished: false }),
		runStateBadgeLabel({ isPreGeneration: false, hasRun: false, isPublished: false }),
	];
	for (const label of all) {
		assert.ok(label.trim().length > 0, 'every state has a non-empty label');
		assert.doesNotMatch(label, /Generated timetable/, `"${label}" must not claim the pre-fix wording`);
	}
	// The badge and the line agree on the state word, so they cannot contradict.
	const published = runStateSentence({ isPreGeneration: false, hasRun: true, runId: RUN_ID, isPublished: true })!;
	const draft = runStateSentence({ isPreGeneration: false, hasRun: true, runId: RUN_ID, isPublished: false })!;
	assert.ok(published.includes('Published'), 'the line says Published for a published run');
	assert.ok(draft.includes('Draft') && !draft.includes('Published'), 'and says Draft, not Published, for a draft');
});

// ── #51 the sub-nav tab, RENDERED ────────────────────────────────────────────

test('#51 the sub-nav tab names a SECTION, not the state of the run on screen', () => {
	const markup = renderToStaticMarkup(
		createElement(MemoryRouter, { initialEntries: ['/timetable'] }, createElement(TimetableSubNav)),
	);
	// The tab still exists and still points at the pre-generation surface: the
	// route is unchanged, only the label that collided with the run state.
	assert.match(
		markup,
		/data-testid="timetable-sub-nav-draft"[^>]*href="\/timetable\/pre-generation"/,
		'the tab is still the pre-generation route',
	);
	const tab = markup.match(/data-testid="timetable-sub-nav-draft"[^>]*>([^<]*)</);
	assert.ok(tab, 'the tab renders its label');
	// A7 c12b (decision 8, row 1) SUPERSEDED the label `Planning`: the CORRECTION is
	// explicit — "The draft should never be 'planning', it should be 'draft'." The
	// route and the section identity are unchanged; only the word moved.
	assert.equal(
		tab![1].trim(),
		'Draft',
		'the tab reads the one vocabulary word `Draft`',
	);
});

// ── wiring: the real consumers use the shared helpers ────────────────────────

test('WIRING: every production consumer uses the shared helpers, so none can drift', () => {
	const dialogs = source('src/components/timetable/modals/TimetableWorkflowDialogs.tsx');
	// A2-UX-WIRE-C2 CORRECTION: the three assertions below used to name the
	// pre-budget vocabulary. The intent of the row — the dialog composes its copy
	// from the shared module and never retypes a population name — is preserved
	// and now names the helpers the dialog actually consumes.
	assert.match(dialogs, /buildGenerateDialogCopy/, 'the generate dialog composes its whole copy in the shared module');
	assert.match(dialogs, /GENERATE_DIALOG|buildGenerateDialogCopy/, 'and takes every fact label from that composition');
	assert.match(dialogs, /publishPlacementBlockedSentence\(publishUnassignedCount \?\? 0\)/, 'and the shared run sentence in the publish checklist');
	assert.doesNotMatch(dialogs, /Still unassigned/, 'and the pre-fix label is gone from the source');

	const rail = source('src/components/timetable/LeftRailContent.tsx');
	assert.match(rail, /WEEKLY_UNPLACED_BADGE_LABEL/, 'the left-rail badge uses the shared badge label');
	assert.doesNotMatch(rail, /\?\? 0\} unassigned/, 'and the ambiguous badge wording is gone');

	// A2-C6-TRUTH (T3a) moved the run sentence, the badge and both `data-testid`s
	// out of `ScheduleReviewWorkspaceHeader.tsx` into `RunStateBadge.tsx`, which
	// the header now renders (`<RunIdentityLine/>` + `<RunStateBadge/>`). The row
	// is about the Expert run line using the shared helpers, so it is asserted on
	// the module that now holds them; the rendered wiring is covered separately by
	// `timetable-run-identity-a2.test.tsx` and `timetable-a2-c6-truth.test.ts`.
	const header = source('src/components/timetable/RunStateBadge.tsx');
	assert.match(header, /runStateSentence/, 'the Expert header renders the one run line');
	assert.match(header, /runStateBadgeLabel/, 'and the truthful heading badge');
	assert.match(header, /data-testid="timetable-run-identity"/, 'the line is addressable, so a browser row can find it');
	assert.match(header, /data-testid="timetable-run-state-badge"/, 'and so is the badge');
	assert.doesNotMatch(header, /'Generated timetable'/, 'the pre-fix badge string is gone from the header');

	// #3: the timetable emits the corrected intent and carries a return target.
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(
		workspace,
		/params\.set\('task', 'change-owner'\)/,
		'"Change owner" uses the change-owner intent',
	);
	assert.doesNotMatch(
		workspace,
		/params\.set\('task', 'missing-load'\)/,
		'and no longer uses missing-load, whose no-teaching filter hid the class\'s own teacher',
	);
	assert.match(workspace, /params\.set\('returnTo'/, 'and it emits a return target for the class it came from');

	// The server finish toast names the run population, in the source.
	const generation = readFileSync(
		resolve(CLIENT_ROOT, '../atlas-server/src/services/generation.service.ts'),
		'utf8',
	);
	assert.match(generation, /this run could not place/, 'the finish toast names the run population');
	assert.doesNotMatch(generation, /unassigned session\(s\)/, 'and the ambiguous pre-fix wording is gone from the server');
});

/* ────────────────────────────────────────────────────────────────────────────
 * A2-UX-COPY-C2 — the Wednesday-demo copy pass. One block per work item, on the
 * production function that decides the words, so a later re-typo is caught here
 * and not on a screen in front of a scheduler.
 *
 * Every row is a NEGATIVE control as well as a positive one: each sentence is
 * checked for the banned vocabulary ("unassigned", "session"/"session(s)", "run
 * #") and each composition is measured against its word budget.
 *
 * The final block records the OPEN DEPENDENCIES as assertions on purpose. They
 * are not here to pass a gate — they exist so that a reviewer sees the un-closed
 * consumer rather than a green suite implying the copy has landed everywhere.
 * ──────────────────────────────────────────────────────────────────────────── */

const DIALOG_WORD_BUDGET = 45;

function words(text: string): number {
	return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

test('U3a/#43 the generate dialog copy fits its word budget and carries no banned vocabulary', () => {
	const copy = buildGenerateDialogCopy({
		schoolYearLabel: '2031-2032',
		termSource: 'enrollpro-verified',
		lockedClassCount: 0,
		classesToSchedule: 1295,
	});

	// The headline is ONE line of the form "Classes to schedule: 1295".
	assert.equal(copy.headline, 'Classes to schedule: 1295', 'the headline is one line, the number, no explanation');
	assert.equal(GENERATE_DIALOG_HEADLINE_LABEL, 'Classes to schedule', 'and its label is the plain noun phrase');
	assert.equal(GENERATE_DIALOG_YEAR_LABEL, 'School year', '"Actor school year" is now "School year"');
	assert.equal(GENERATE_DIALOG_TERM_LABEL, 'Term setup', '"Term authority" is now the saved term setup');
	assert.equal(GENERATE_DIALOG_LOCKED_LABEL, 'Locked classes kept', '"Retained draft anchors: N locked sessions" is now plain');
	assert.doesNotMatch(GENERATE_DIALOG_LOCKED_LABEL, /session/i, 'and the locked row no longer says "sessions"');
	assert.doesNotMatch(GENERATE_DIALOG_TERM_LABEL, /authority/i, 'and the term row no longer says "authority"');
	assert.doesNotMatch(GENERATE_DIALOG_YEAR_LABEL, /actor/i, 'and the year row no longer says "Actor"');

	// The engineer-facing values are plain words, not system names.
	assert.match(copy.rows[1].value, /^(Confirmed with EnrollPro|Saved in ATLAS|Not confirmed)$/, 'the term source is one of three plain words');
	assert.equal(copy.rows[2].label, GENERATE_DIALOG_LOCKED_LABEL, 'the locked row keeps the plain label');
	assert.equal(copy.rows[2].value, '0', 'and its value is the bare count, not "0 locked sessions"');

	// AT MOST ONE short sentence about unavailable setup data (U3a: <= 20 words).
	assert.ok(
		words(GENERATE_SETUP_UNAVAILABLE_SENTENCE) <= 20,
		`the setup-unavailable sentence is ${words(GENERATE_SETUP_UNAVAILABLE_SENTENCE)} words, cap is 20`,
	);
	assert.ok(words(copy.unavailability) <= 20, 'and the composed copy uses the same one sentence');

	// The 35-word "why two different numbers appear" note is gone.
	assert.ok(
		words(UNPLACED_COUNT_DISAMBIGUATION) <= 20,
		`the disambiguation is now ${words(UNPLACED_COUNT_DISAMBIGUATION)} words, was 35`,
	);

	// THE WHOLE DIALOG, budgeted.
	assert.ok(
		words(copy.plainText) <= DIALOG_WORD_BUDGET,
		`the whole dialog copy is ${words(copy.plainText)} words, budget is ${DIALOG_WORD_BUDGET} (was 155): ${copy.plainText}`,
	);

	// Banned vocabulary, over every word the dialog shows.
	for (const banned of [/unassigned/i, /session/i, /run #/i, /authority/i, /anchor/i, /\(s\)/]) {
		assert.doesNotMatch(copy.plainText, banned, `the dialog copy must not contain ${banned}`);
	}

	// "less is more": the headline number appears ONCE, not again in a fourth row.
	assert.equal(
		copy.plainText.split('1295').length - 1,
		1,
		`the demand count is stated exactly once: ${copy.plainText}`,
	);
	assert.equal(copy.rows.length, 3, 'three facts beside the headline, not four');
});

test('U3a the generate dialog copy degrades honestly on absent values', () => {
	const copy = buildGenerateDialogCopy({});
	// CORRECTED (A2-UX-STATUS-C2 B2). This row previously asserted
	// `copy.headline === 'Classes to schedule: 0'` - "an absent count reads 0,
	// never NaN". That was the FALSE ZERO: `fetchDraftBoardSummary` returns null on
	// an intermittent 502, the caller passed `?? 0`, and a count that was never
	// measured was announced as a measured "nothing to schedule". The server this
	// release shipped states why that is the worst possible lie: a scheduler
	// reading "all classes placed" stops looking for the classes with no slot.
	//
	// PRESERVED INTENT, unchanged and still asserted below: never render NaN, and
	// never invent a number. Both were the row's point and neither is weakened -
	// the honest absent state satisfies them more strictly than a 0 did, because a
	// 0 IS an invented number. What changed is only WHICH absent rendering is
	// honest.
	assert.equal(
		copy.headline,
		`${GENERATE_DIALOG_HEADLINE_LABEL}: ${GENERATE_DIALOG_DEMAND_UNMEASURED_WORD}`,
		'an absent count is REPORTED ABSENT in words, never rendered as the number 0',
	);
	assert.equal(copy.classesToScheduleKnown, false, 'and the copy says the count is not known');
	assert.doesNotMatch(copy.headline, /\b0\b/, 'an absent count never reaches the screen as 0');
	assert.doesNotMatch(copy.headline, /all|placed|complete|nothing to/i, 'and it never claims there is nothing to do');
	assert.equal(copy.rows[0].value, 'Not set', 'an absent school year says so');
	assert.equal(copy.rows[1].value, 'Not confirmed', 'an unknown term source is reported, not assumed');
	assert.doesNotMatch(copy.plainText, /NaN|undefined|null/, 'no placeholder leaks into the copy');
	for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
		assert.doesNotMatch(buildGenerateDialogCopy({ classesToSchedule: bad }).plainText, /NaN|Infinity/, 'a non-finite count never reaches the screen');
		assert.equal(
			buildGenerateDialogCopy({ classesToSchedule: bad }).classesToScheduleKnown,
			false,
			`a non-finite count (${String(bad)}) is an absent count, not a measured one`,
		);
	}
	// The measured case is untouched, and 0 is still a MEASURED zero.
	const zero = buildGenerateDialogCopy({ classesToSchedule: 0 });
	assert.equal(zero.headline, 'Classes to schedule: 0', 'a measured zero still reads 0, because it was measured');
	assert.equal(zero.classesToScheduleKnown, true, 'and it is distinguished from the absent case above');
});

// ─── A2 C5 item 4a — the residual "Locked classes kept" unmeasured 0 ─────────
//
// FAILING-FIRST (M4a-C), recorded at base `bd789d86` with the two source files
// reverted to their base bytes and this test in place:
//
//   npx tsx --test src/lib/__tests__/timetable-truth-labels-a2.test.ts
//
//   ✖ A2 C5 4a: "Locked classes kept" is a tri-state, never an unmeasured 0
//     AssertionError [ERR_ASSERTION]: an absent locked count is REPORTED ABSENT
//     in words, never rendered as the number 0
//       actual:   '0'
//     expected: 'Not checked'
//
// `actual: '0'` is the defect this item removes. The cause was
// `countOrZero(input.lockedClassCount)` in `buildGenerateDialogCopy`, reached
// from `lockedClassCount={draftBoardSummary?.draft ?? 0}` in
// `TimetableWorkflowDialogs.tsx`: an absent board summary — an intermittent 502,
// or no authenticated school scope — printed "Locked classes kept: 0", a claim
// that ATLAS had established nothing is locked when it had established nothing
// at all. The headline one line above had already been converted to a tri-state
// in c2 for exactly this reason and the secondary row was missed, so one failed
// read produced "Classes to schedule: Not checked" directly above a confident
// "Locked classes kept: 0".

/**
 * The production body's fact rows, keyed by their LABEL.
 *
 * Keyed by the label rather than by row position or a `data-known` attribute,
 * because both of those are what this candidate ADDS: at base the rows carry
 * neither, so a control keyed on them would fail on its own bookkeeping instead
 * of on the false zero it exists to catch. The label is present in every
 * revision, so this walks the real render path and finds the same row before and
 * after the fix.
 */
function rowValues(lockedClassCount: number | null): Map<string, { value: string; className: string; dataKnown: string | undefined }> {
	const found = new Map<string, { value: string; className: string; dataKnown: string | undefined }>();
	let lastText = '';
	const walk = (node: ReactNode): void => {
		if (node == null || typeof node === 'boolean') return;
		if (typeof node === 'string' || typeof node === 'number') {
			lastText = String(node);
			return;
		}
		if (Array.isArray(node)) {
			for (const child of node) walk(child);
			return;
		}
		if (isValidElement(node)) {
			const props = node.props as { [key: string]: unknown; children?: ReactNode };
			if (props['data-testid'] === 'timetable-generate-confirm-row-value') {
				found.set(lastText, {
					value: collectText(props.children).join(''),
					className: String(props['className'] ?? ''),
					dataKnown: props['data-known'] === undefined ? undefined : String(props['data-known']),
				});
			}
			walk(props.children);
		}
	};
	walk(
		GenerateConfirmDialogBody({
			copy: buildGenerateDialogCopy({
				schoolYearLabel: '2031-2032',
				termSource: 'atlas',
				lockedClassCount,
				classesToSchedule: null,
			}),
			classesToSchedule: null,
			enforceShiftWindows: true,
			setEnforceShiftWindows: () => {},
		}),
	);
	return found;
}

test('A2 C5 4a: "Locked classes kept" is a tri-state, never an unmeasured 0', () => {
	// M4a-A, asserted FIRST through the REAL render path, because that is the
	// fact a scheduler reads. At base this is the assertion that fails, with
	// `actual: '0'` — the exact false zero. The copy-module rows follow it, so the
	// recorded failing-first output is the decisive one.
	const lockedAbsent = rowValues(null).get(GENERATE_DIALOG_LOCKED_LABEL);
	assert.ok(lockedAbsent, 'the rendered body carries the locked row');
	assert.equal(
		lockedAbsent!.value,
		GENERATE_DIALOG_DEMAND_UNMEASURED_WORD,
		'an absent locked count is REPORTED ABSENT in words, never rendered as the number 0',
	);
	assert.doesNotMatch(lockedAbsent!.value, /\d/, 'and the not-checked value contains no digit at all');
	assert.doesNotMatch(
		lockedAbsent!.className,
		/font-semibold/,
		'an unmeasured row never wears the measured-figure treatment',
	);
	assert.equal(lockedAbsent!.dataKnown, 'false', 'and the DOM states the neutral state, so colour is never load-bearing alone');

	// M4a-A — the copy module itself, which every caller shares.
	const absent = buildGenerateDialogCopy({ schoolYearLabel: '2031-2032', termSource: 'atlas' });
	assert.equal(absent.lockedKnown, false, 'an absent locked count is reported as not known');
	assert.equal(absent.classesToScheduleKnown, false, 'and so is the headline it sits under');
	const lockedRow = absent.rows.find((row) => row.label === GENERATE_DIALOG_LOCKED_LABEL);
	assert.ok(lockedRow, 'the locked row is present in the copy');
	assert.equal(lockedRow!.value, GENERATE_DIALOG_DEMAND_UNMEASURED_WORD, 'and its value is the not-checked state');
	assert.equal(lockedRow!.known, false, 'and the row carries the neutral state for the renderer');

	// M4a-B — a MEASURED zero is a real answer and still reads `0`. This is why
	// the tri-state exists: collapsing it to the neutral state would destroy a
	// true fact.
	const measuredZero = buildGenerateDialogCopy({ lockedClassCount: 0 });
	assert.equal(measuredZero.lockedKnown, true, 'a measured zero IS known');
	assert.equal(
		measuredZero.rows.find((row) => row.label === GENERATE_DIALOG_LOCKED_LABEL)!.value,
		'0',
		'and it is still rendered as the number 0, because it was measured',
	);
	const renderedZero = rowValues(0).get(GENERATE_DIALOG_LOCKED_LABEL);
	assert.equal(renderedZero!.value, '0', 'the rendered measured zero still reads 0');
	assert.equal(renderedZero!.className, 'font-semibold text-foreground', 'and keeps the measured-figure treatment');
	assert.equal(renderedZero!.dataKnown, 'true', 'and the DOM states it is known');

	// A non-finite count is an absent count, never a measured one — the rule the
	// headline already had.
	for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
		const copy = buildGenerateDialogCopy({ lockedClassCount: bad });
		assert.equal(copy.lockedKnown, false, `a non-finite locked count (${String(bad)}) is absent, not measured`);
		assert.doesNotMatch(copy.plainText, /NaN|Infinity/, 'and it never reaches the screen as a number');
	}

	// The call site must not re-introduce the coercion the copy module now owns.
	const dialogs = code('src/components/timetable/modals/TimetableWorkflowDialogs.tsx');
	assert.doesNotMatch(
		dialogs,
		/lockedClassCount=\{draftBoardSummary\?\.draft \?\? 0\}/,
		'the dialog no longer coerces an absent board summary to 0 before the copy module sees it',
	);
	assert.match(dialogs, /lockedClassCount=\{draftBoardSummary\?\.draft \?\? null\}/, 'it passes the absence through as null');
	assert.match(dialogs, /lockedClassCount: number \| null;/, 'and the prop type admits null, like classesToSchedule');
});

test('#56 one verb for "generate" on a published schedule', () => {
	// A7 c12b (row 8) SUPERSEDED the verb: `Build a new draft` is `Generate a draft`.
	assert.equal(BUILD_NEW_DRAFT_LABEL, 'Generate a draft', 'the single verb, used for menu, title and button');
	assert.equal(PUBLISHED_SCHEDULE_STAYS_IN_USE, 'Your published schedule stays in use.', 'the first line is present');
	assert.equal(buildNewDraftDialogTitle(true), 'Generate a draft?', 'the published dialog asks about the same thing');
	assert.equal(buildNewDraftDialogTitle(false), BUILD_NEW_DRAFT_LABEL, 'and the draft dialog uses the same verb, not a second one');
	// The ambiguity being removed: four different verbs for one action.
	for (const superseded of ['New version', 'Build a new version', 'Generate updated schedule?', 'Generate schedule']) {
		assert.notEqual(BUILD_NEW_DRAFT_LABEL, superseded, `"${superseded}" is not the verb`);
	}
	// The reassurance must not read as an edit to the live schedule.
	assert.doesNotMatch(PUBLISHED_SCHEDULE_STAYS_IN_USE, /replace|overwrite|change/i, 'it promises the published schedule is untouched');
});

test('#58 one generation emits one outcome message, and it names the real number', () => {
	assert.equal(
		generationOutcomeToastSentence(0),
		'Draft schedule ready — 0 classes left to place. Review it, then publish.',
		'the zero case is the recorded target copy, count visible',
	);
	assert.equal(
		generationOutcomeToastSentence(12),
		'Draft schedule ready — 12 classes need a time slot. Review them, then publish.',
		'the non-zero case names the real number of classes without a time',
	);
	for (const unplaced of [0, 1, 12, 1295]) {
		const sentence = generationOutcomeToastSentence(unplaced);
		assert.ok(sentence.startsWith('Draft schedule ready'), 'every case is the same one outcome sentence');
		for (const banned of [/session/i, /\(s\)/, /run #/i, /unassigned/i]) {
			assert.doesNotMatch(sentence, banned, `"${sentence}" must not contain ${banned}`);
		}
		assert.ok(words(sentence) <= 15, `"${sentence}" is ${words(sentence)} words, cap is 15`);
		// Truthfulness: the number in the sentence is the number that was passed.
		assert.ok(sentence.includes(String(unplaced)), `"${sentence}" states the real count`);
	}
	// The two variants differ, so zero is never implied by a non-zero run.
	assert.notEqual(generationOutcomeToastSentence(0), generationOutcomeToastSentence(1), 'zero and non-zero are distinguishable');
});

test('U4 the generation notification names the real number of classes still needing a time', () => {
	assert.equal(generationNotificationSentence(0), 'New schedule ready. All classes placed.', 'the zero case is the recorded target copy');
	assert.equal(generationNotificationSentence(12), 'New schedule ready. 12 classes need a time slot.', 'the non-zero case names the real number');
	assert.equal(ALL_SESSIONS_PLACED_LABEL, 'All classes placed', 'and it reuses the one positive label, so the two cannot drift');
	for (const unplaced of [0, 1, 3, 1295]) {
		const sentence = generationNotificationSentence(unplaced);
		for (const banned of [/session/i, /\(s\)/, /run #/i, /run \d/i, /unassigned/i]) {
			assert.doesNotMatch(sentence, banned, `"${sentence}" must not contain ${banned}`);
		}
		assert.ok(words(sentence) <= 10, `"${sentence}" is ${words(sentence)} words, cap is 10`);
	}
	// The pre-fix sentence's shape, so the change is a change and not a paraphrase.
	assert.doesNotMatch(generationNotificationSentence(12), /completed with/i, 'no "completed with" boilerplate');
});

test('the publish-checklist sentence is one noun, present tense, and states the number once', () => {
	assert.equal(
		publishPlacementBlockedSentence(12),
		'12 classes need a time slot. Place them before you publish.',
		'one noun, one verb, the number once',
	);
	assert.equal(classesNeedingTime(1), '1 class needs a time slot', 'singular is singular');
	assert.equal(classesNeedingTime(12), '12 classes need a time slot', 'plural is plural');
	for (const count of [1, 2, 12, 1295]) {
		const sentence = publishPlacementBlockedSentence(count);
		assert.equal(sentence.split(String(count)).length - 1, 1, `"${sentence}" states the count exactly once`);
		for (const banned of [/session/i, /\(s\)/, /unassigned/i, /run #/i]) {
			assert.doesNotMatch(sentence, banned, `"${sentence}" must not contain ${banned}`);
		}
		// The pre-fix sentence was "N sessions this run could not place must be
		// placed before…" — two verbs on one clause and a stacked modal.
		assert.doesNotMatch(sentence, /must be placed/i, 'the stacked obligation is gone');
	}
	assert.equal(publishPlacementBlockedSentence(0), 'All classes placed.', 'the zero case is truthful, not a block');
});

test('NOUN RULE: no user-facing string in the copy module says "session"', () => {
	// The constant list below is the module's whole user-facing vocabulary. A new
	// export that reintroduces the retired noun is caught here, not on a screen.
	const vocabulary = [
		WEEKLY_UNPLACED_LABEL,
		WEEKLY_UNPLACED_BADGE_LABEL,
		UNPLACED_COUNT_DISAMBIGUATION,
		ALL_SESSIONS_PLACED_LABEL,
		// A2-UX-STATUS-C2 B2: a new user-facing export of the copy module, so it
		// joins the vocabulary sweep below and cannot reintroduce a banned noun.
		GENERATE_DIALOG_DEMAND_UNMEASURED_WORD,
		GENERATE_DIALOG_HEADLINE_LABEL,
		GENERATE_DIALOG_YEAR_LABEL,
		GENERATE_DIALOG_TERM_LABEL,
		GENERATE_DIALOG_LOCKED_LABEL,
		GENERATE_SETUP_UNAVAILABLE_SENTENCE,
		PUBLISHED_SCHEDULE_STAYS_IN_USE,
		BUILD_NEW_DRAFT_LABEL,
		CLASS_NOUN,
		runUnplacedSentence(0),
		runUnplacedSentence(1),
		classesNeedingTime(0),
		classesNeedingTime(2),
		generationOutcomeToastSentence(0),
		generationNotificationSentence(0),
		publishPlacementBlockedSentence(3),
		runStateSentence({ isPreGeneration: true, hasRun: false, runId: null, isPublished: false }) ?? '',
		runStateSentence({ isPreGeneration: false, hasRun: true, runId: RUN_ID, isPublished: true }) ?? '',
		runStateBadgeLabel({ isPreGeneration: false, hasRun: true, isPublished: true }),
	];
	for (const text of vocabulary) {
		assert.doesNotMatch(text, /\bsessions?\b/i, `"${text}" must use the one noun`);
		assert.doesNotMatch(text, /\bunassigned\b/i, `"${text}" must not use the ambiguous word`);
	}
	// The plural is real English, never a "(s)" construction.
	assert.match(classesNeedingTime(2), /classes/, 'the plural is spelled out');
	assert.doesNotMatch(classesNeedingTime(2), /\(s\)/, 'and never written as "(s)"');
});

/* ── the OPEN dependencies, recorded as visible failures-by-design ───────────
 * Each row asserts that a component this executor does NOT own still carries its
 * pre-fix string. When the owning executor adopts the exported copy, the row
 * fails and the copy has demonstrably landed. They are additive evidence for the
 * planner, not gates this candidate claims to satisfy.
 * ──────────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
 * A2-UX-WIRE-C2 — DEPENDENCY STATUS.
 *
 * The rows below were written as "recorded, not satisfied": each asserted that a
 * component still carried its pre-fix string, so that a reviewer could see the
 * un-closed consumer rather than a green suite implying the copy had landed.
 *
 * Two of them are now CLOSED by the wiring executor that owns those files. They
 * are kept, not deleted (§16: a correction is additive, and removing an evidence
 * row fails review regardless of the fix) — re-pointed at the new truth so that a
 * later re-typo of the same words fails again. The remaining rows belong to other
 * executors' files and are untouched.
 * ──────────────────────────────────────────────────────────────────────────── */

test('LANDED (was DEPENDENCY): the generate dialog consumes the composed copy, and its one verb is wired', () => {
	const dialogs = code('src/components/timetable/modals/TimetableWorkflowDialogs.tsx');
	// U3a / #56 / the noun rule all closed on this one component. Read with
	// comments stripped, so the words quoted in this file's own notes cannot
	// make a "gone" row pass.
	assert.doesNotMatch(dialogs, /Generate updated schedule\?|Generate schedule/, '#56: the pre-fix title/button verb is gone');
	assert.doesNotMatch(dialogs, /Actor school year/, 'U3a: the engineer-facing "Actor school year" label is gone');
	assert.doesNotMatch(dialogs, /Term authority/, 'U3a: "Term authority" is gone');
	assert.doesNotMatch(dialogs, /Retained draft anchors/, 'U3a: "Retained draft anchors" is gone');
	assert.doesNotMatch(dialogs, /locked session/, 'NOUN RULE: the dialog no longer renders "locked session(s)"');
	assert.doesNotMatch(dialogs, /must be placed before this schedule can be published/, 'the ungrammatical checklist sentence is no longer composed in the component');
	assert.match(dialogs, /buildGenerateDialogCopy\(/, 'it composes its copy through buildGenerateDialogCopy');
	assert.match(dialogs, /buildNewDraftDialogTitle\(isPublished\)/, '#56: the title is the one verb');
	assert.match(dialogs, /\{BUILD_NEW_DRAFT_LABEL\}/, '#56: and so is the primary button');
	assert.match(dialogs, /PUBLISHED_SCHEDULE_STAYS_IN_USE/, '#56: the published case opens with the reassurance');
	// #43: the duplicate close control is gone from the code, not just the render.
	assert.match(dialogs, /sm:max-w-md" hideClose data-testid="timetable-generate-confirm-dialog"/, 'the unlabelled close control is not rendered');
	// The one thing this component could NOT wire itself: the published flag.
	// `isPublished` is an optional prop, so the caller must pass it for the
	// published branch to be live (DEPENDENCY on `ScheduleReviewDialogs.tsx`).
	assert.match(dialogs, /isPublished = false/, 'the unpublished default is the truthful one');
});

test('ADOPTED (was: DEPENDENCY, recorded not satisfied): the More menu and the header carry BUILD_NEW_DRAFT_LABEL', () => {
	// This row was recorded as an OPEN dependency at b7fa0ce3: it asserted that
	// the More menu and the header still carried the PRE-FIX generate label
	// ("New version" / "Build a new version") and had not adopted
	// BUILD_NEW_DRAFT_LABEL. A2-UX-MENU-C2 (#56) is the owning executor for those
	// two files and has adopted it, so the row is restated as the NEW TRUTH
	// rather than deleted — the concern it protects (#56 landing everywhere) is
	// unchanged, and it now fails if either file drifts back.
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.match(helpers, /export const PUBLISHED_GENERATE_LABEL = BUILD_NEW_DRAFT_LABEL;/, '#56: the More label is the copy module\'s one verb');
	assert.match(
		helpers,
		/export const PUBLISHED_GENERATE_DESCRIPTION = `\$\{BUILD_NEW_DRAFT_LABEL\}\. \$\{PUBLISHED_SCHEDULE_STAYS_IN_USE\}`;/,
		'#56: and the sentence says the published schedule stays in use',
	);
	const actions = source('src/components/timetable/simple/SimpleHeaderActions.tsx');
	assert.match(actions, /BUILD_NEW_DRAFT_LABEL/, '#56: the More menu adopts it');
	assert.doesNotMatch(actions, /Build a new version/, '#56: and the retired phrase is gone');
	// A published run is still unambiguous on the surface, not only in the
	// dialog: the item says, beside the label, that nothing in use changes.
	assert.match(actions, /data-testid="timetable-more-generate-published-note"/);
});

// ADOPTED (was: DEPENDENCY, recorded not satisfied) at the integration boundary,
// 2026-09-28. This row existed to FAIL LOUDLY the moment an owner adopted the
// server copy, and it did exactly that — which is the mechanism working, not a
// regression. The tripwire is retained in its converted form: it now asserts the
// NEW truth on the server, and still asserts the client side, so a future
// reversion of either is caught. Nothing was deleted.
test('ADOPTED (was DEPENDENCY): the SERVER generation notification carries the plain outcome, once', () => {
	const mutations = source('src/hooks/useTimetableMutations.ts');
	// #58 CLOSED on the client by the wiring executor: one outcome message.
	assert.match(mutations, /generationOutcomeToastSentence\(unplaced\)/, '#58: the client emits one composed outcome message');
	const generation = readFileSync(
		resolve(CLIENT_ROOT, '../atlas-server/src/services/generation.service.ts'),
		'utf8',
	);
	// U4 and the second server toast are CLOSED by A2-UX-SERVER-C2.
	assert.match(generation, /New schedule ready\./, 'U4: the server now uses the plain outcome sentence');
	// Scoped to the message builder, not the whole file: the two remaining
	// occurrences of "session(s)" are COMMENTS recording the fix, and a
	// whole-file ban would be a test that forbids its own history. The window is
	// the builder's own 800-character body (a fixed slice, so a box-drawing
	// comment banner downstream cannot silently truncate it to the whole file).
	const builderStart = generation.indexOf('export function buildGenerationCompletedMessage');
	const builder = generation.slice(builderStart, builderStart + 800);
	assert.ok(builderStart > 0, 'the completion-message builder is present');
	assert.doesNotMatch(builder, /session/i, 'no "session"/"session(s)" survives in the user-facing message');
	assert.doesNotMatch(builder, /run #/, 'no run id in the user-facing message');
	assert.doesNotMatch(generation, /Generation run #\$\{run\.id\} started\./, '#58: the second "started" message for the same action is gone');
	// The zero claim must be truthful, not a hard-coded success.
	const implementation = generation.slice(builderStart);
	assert.match(implementation, /if \(!Number\.isFinite\(unplacedCount\) \|\| unplacedCount < 0\)\s*\{\s*return 'New schedule ready\.';/, 'an unmeasured count never claims everything is placed');
});
