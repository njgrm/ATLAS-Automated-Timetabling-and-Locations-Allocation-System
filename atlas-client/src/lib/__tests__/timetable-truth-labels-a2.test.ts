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
import { TimetableSubNav } from '@/components/timetable/TimetableSubNav';
import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';

const RUN_ID = 321;
const CLIENT_ROOT = resolve(import.meta.dirname, '../../..');

function source(relative: string): string {
	return readFileSync(resolve(CLIENT_ROOT, relative), 'utf8');
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

test('#57 the generate dialog names the 1295 as the pre-generation population', () => {
	const text = dialogText({
		showGenerateConfirm: true,
		draftBoardSummary: { draft: 3, lockedForRun: 0, archived: 0, unscheduled: 1295 },
	} as Partial<ScheduleReviewDialogsContext>);
	// The guard against an empty-method pass.
	assert.ok(text.length > 400, `the dialog produced real text (${text.length} chars)`);
	// The number is still shown, unchanged: nothing was reconciled away.
	assert.ok(text.includes('1295'), `the real number is still rendered: ${text.slice(0, 300)}`);
	assert.ok(
		text.includes(WEEKLY_UNPLACED_LABEL),
		'under the population name, not under the ambiguous word',
	);
	assert.ok(
		!/Still unassigned/.test(text),
		'the ambiguous pre-fix label is gone from the rendered dialog',
	);
	// And the reader can tell it is not the run's count.
	assert.ok(
		text.includes('could not place'),
		'the dialog carries the one disambiguation naming the other population, so 1295 and 0 are reconcilable by the reader',
	);
});

test('#57 the publish checklist names the run population', () => {
	const text = dialogText({ showPublishDialog: true, publishUnassignedCount: 3 } as Partial<ScheduleReviewDialogsContext>);
	assert.ok(text.length > 200, `the publish dialog produced real text (${text.length} chars)`);
	assert.ok(
		text.includes('3 classes this schedule could not place'),
		`the checklist names the run population: ${text.slice(0, 300)}`,
	);
	assert.ok(text.includes('before this schedule can be published'), 'and keeps the publication consequence');
	assert.ok(
		!/still need placing/.test(text),
		'the pre-fix wording, which never said whose count it was, is gone',
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
		'No schedule made yet.',
		'U5: the planner says what is missing, in three words',
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
	assert.equal(
		tab![1].trim(),
		'Planning',
		'it no longer reads as the state of the run on screen',
	);
});

// ── wiring: the real consumers use the shared helpers ────────────────────────

test('WIRING: every production consumer uses the shared helpers, so none can drift', () => {
	const dialogs = source('src/components/timetable/modals/TimetableWorkflowDialogs.tsx');
	assert.match(dialogs, /WEEKLY_UNPLACED_LABEL/, 'the generate dialog uses the shared pre-generation label');
	assert.match(dialogs, /UNPLACED_COUNT_DISAMBIGUATION/, 'and the shared disambiguation line');
	assert.match(dialogs, /runUnplacedSentence/, 'and the shared run sentence in the publish checklist');
	assert.doesNotMatch(dialogs, /Still unassigned/, 'and the pre-fix label is gone from the source');

	const rail = source('src/components/timetable/LeftRailContent.tsx');
	assert.match(rail, /WEEKLY_UNPLACED_BADGE_LABEL/, 'the left-rail badge uses the shared badge label');
	assert.doesNotMatch(rail, /\?\? 0\} unassigned/, 'and the ambiguous badge wording is gone');

	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
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
	assert.equal(copy.headline, 'Classes to schedule: 0', 'an absent count reads 0, never NaN');
	assert.equal(copy.rows[0].value, 'Not set', 'an absent school year says so');
	assert.equal(copy.rows[1].value, 'Not confirmed', 'an unknown term source is reported, not assumed');
	assert.doesNotMatch(copy.plainText, /NaN|undefined|null/, 'no placeholder leaks into the copy');
	for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
		assert.doesNotMatch(buildGenerateDialogCopy({ classesToSchedule: bad }).plainText, /NaN|Infinity/, 'a non-finite count never reaches the screen');
	}
});

test('#56 one verb for "generate" on a published schedule', () => {
	assert.equal(BUILD_NEW_DRAFT_LABEL, 'Build a new draft', 'the single verb, used for menu, title and button');
	assert.equal(PUBLISHED_SCHEDULE_STAYS_IN_USE, 'Your published schedule stays in use.', 'the first line is present');
	assert.equal(buildNewDraftDialogTitle(true), 'Build a new draft?', 'the published dialog asks about the same thing');
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
		'Draft schedule ready — 12 classes still need a time. Review them, then publish.',
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
	assert.equal(generationNotificationSentence(12), 'New schedule ready. 12 classes still need a time.', 'the non-zero case names the real number');
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
		'12 classes still need a time. Place them before you publish.',
		'one noun, one verb, the number once',
	);
	assert.equal(classesNeedingTime(1), '1 class still needs a time', 'singular is singular');
	assert.equal(classesNeedingTime(12), '12 classes still need a time', 'plural is plural');
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

test('DEPENDENCY (recorded, not satisfied): the generate dialog component still renders the pre-fix copy', () => {
	const dialogs = source('src/components/timetable/modals/TimetableWorkflowDialogs.tsx');
	// U3a / #56 / the noun rule are all waiting on this one component.
	assert.match(dialogs, /Generate updated schedule\?|Generate schedule/, '#56: the dialog title/button verb is still the pre-fix one');
	assert.match(dialogs, /Actor school year/, 'U3a: the engineer-facing "Actor school year" label is still there');
	assert.match(dialogs, /Term authority/, 'U3a: "Term authority" is still there');
	assert.match(dialogs, /Retained draft anchors/, 'U3a: "Retained draft anchors" is still there');
	assert.match(dialogs, /locked session/, 'NOUN RULE: the dialog still renders "locked session(s)"');
	assert.match(dialogs, /must be placed before this schedule can be published/, 'the ungrammatical checklist sentence is still composed in the component');
	assert.doesNotMatch(dialogs, /buildGenerateDialogCopy/, 'it has not yet adopted buildGenerateDialogCopy');
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

test('DEPENDENCY (recorded, not satisfied): the generation toasts and the server notification are unchanged', () => {
	const mutations = source('src/hooks/useTimetableMutations.ts');
	// #58: the completed toast and the loading toast are both still there, so one
	// generation still emits more than one message.
	assert.match(mutations, /Schedule generated - \$\{assigned\} assigned/, '#58: the completed toast is still the pre-fix one');
	assert.match(mutations, /ATLAS is loading the assigned, unassigned, and conflict totals/, '#58: the loading toast still exists');
	assert.doesNotMatch(mutations, /generationOutcomeToastSentence/, 'the hook has not yet adopted generationOutcomeToastSentence');
	const generation = readFileSync(
		resolve(CLIENT_ROOT, '../atlas-server/src/services/generation.service.ts'),
		'utf8',
	);
	// U4 lives on the server, which is outside this candidate's authority.
	assert.match(generation, /completed with \$\{summary\.unassignedCount\} session\(s\)/, 'U4: the server notification is still the pre-fix "session(s)" wording');
	assert.match(generation, /Generation run #\$\{run\.id\} started\./, '#58: the server also emits a "started" message for the same action');
	assert.doesNotMatch(generation, /New schedule ready\./, 'and ATLAS has not yet adopted the new sentence');
});
