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
	UNPLACED_COUNT_DISAMBIGUATION,
	WEEKLY_UNPLACED_BADGE_LABEL,
	WEEKLY_UNPLACED_LABEL,
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
		'Weekly sessions with no placement yet',
		'the generate-dialog label names the pre-generation population',
	);
	assert.ok(
		!/unassigned/i.test(WEEKLY_UNPLACED_LABEL),
		'and no longer borrows the ambiguous word the finding is about',
	);
	assert.equal(runUnplacedSentence(0), '0 sessions this run could not place', 'the run population is named too');
	assert.equal(runUnplacedSentence(1), '1 session this run could not place', 'singular is singular');
	assert.equal(runUnplacedSentence(1295), '1295 sessions this run could not place', 'plural is plural');
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
		text.includes('could not place in its own grid'),
		'the dialog carries the one disambiguation naming the other population, so 1295 and 0 are reconcilable by the reader',
	);
});

test('#57 the publish checklist names the run population', () => {
	const text = dialogText({ showPublishDialog: true, publishUnassignedCount: 3 } as Partial<ScheduleReviewDialogsContext>);
	assert.ok(text.length > 200, `the publish dialog produced real text (${text.length} chars)`);
	assert.ok(
		text.includes('3 sessions this run could not place'),
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
		'Run 321 · Published',
		'a published run says both its number and its state',
	);
	assert.equal(
		runStateSentence({ isPreGeneration: false, hasRun: true, runId: RUN_ID, isPublished: false }),
		'Run 321 · Draft',
		'an unpublished run says Draft, not "Generated timetable"',
	);
	assert.equal(
		runStateSentence({ isPreGeneration: true, hasRun: false, runId: null, isPublished: false }),
		'Planning draft — no generated run yet',
		'the planner still gets a line, because its state IS a state',
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
		'Planning draft',
		'the planner keeps its own name',
	);
	assert.equal(
		runStateBadgeLabel({ isPreGeneration: false, hasRun: false, isPublished: false }),
		'No generated run yet',
		'and an empty state still says so',
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
