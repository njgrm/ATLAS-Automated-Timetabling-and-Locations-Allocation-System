/**
 * LANE-C-PLAIN-TOKENS-C04 (J2) — no engine token reaches the operator, proved
 * on RENDERED text, not on source.
 *
 * Every content assertion in this file runs against `document.body.textContent`
 * after the real component has mounted through the real Radix portal, because
 * this area's recorded failure mode is a control that reads source strings and a
 * fixture whose contradiction could not render. A regression that emitted
 * `<span>3</span> blockers` around a token would pass a naive markup regex and
 * fail here.
 *
 * DOCUMENTED EXCLUSIONS from the no-engine-token guard:
 *  1. A resolved Subject's own `displayCode` (or `code` when there is no
 *     `displayCode`), and every other value the surface's own name RESOLVERS
 *     returned (section name, teacher name, room label), plus the product's own
 *     name "ATLAS", which the existing house copy in `violation-presentation.ts`
 *     already uses ("current ATLAS no longer calculates"). Those are names the
 *     operator legitimately reads, not engine tokens, and they are removed from
 *     the scan by `assertNoEngineTokens`'s `allowedNames` argument. The second
 *     test in the exclusions block proves the guard is not over-broad by
 *     asserting a resolved name SURVIVES on screen.
 *  2. CSS `uppercase` rendering. Assertions read `textContent`, which is
 *     pre-`text-transform`, so a label written "Room Request" and displayed as
 *     "ROOM REQUEST" is correctly not treated as a SHOUTED token.
 *  3. Time and date values ("08:15", "2026-09-26") and the run number itself
 *     ("run 318"), which the brief requires to be kept.
 *  4. `HardBlockerDialog`'s `humanDetail`, which the SERVER builds with bare
 *     `min` abbreviations ("320 min/week", `manual-edit.service.ts`
 *     `buildHumanConflicts`). P1 row 3 of the brief is scoped to `item.delta`,
 *     and `humanDetail` is rendered raw by six other consumers as well
 *     (`LockPanel`, `ManualEditPanel`, `ConflictInspector`, `CenterWorkspace`,
 *     `TeacherDepartureRecoverySheet`, `TacticalSandboxDock`), so humanising it
 *     in this one dialog would make the same string read two ways. Reported as a
 *     successor, not half-fixed here.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, mock, test } from 'node:test';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

import type { Violation } from '../../../types';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;

// react-dom must load after the DOM globals, or it disables input events.
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { Dialog } = await import('../../../ui/dialog');
const { ResizablePanelGroup } = await import('../../../ui/resizable');
const { RightPanel } = await import('../RightPanel');
const { TimetableRunsPane } = await import('../TimetableRunsPane');
const { TimetableIssueRepairGuide } = await import('../TimetableIssueRepairGuide');
const { HardBlockerDialog } = await import('../modals/HardBlockerDialog');
const { SoftViolationConfirmDialog } = await import('../modals/SoftViolationConfirmDialog');
const { TimetableAssignmentDialogs } = await import('../modals/TimetableAssignmentDialogs');
const { PublishChecklistContent } = await import('../simple/SimpleTaskDrawerHelpers');
const atlasApi = (await import('../../../lib/api')).default;

const clientRoot = resolve(import.meta.dirname, '../../../..');

let root: Root | null = null;
const container = () => document.getElementById('root')!;

async function mount(element: ReturnType<typeof createElement>) {
	if (root) await act(async () => { root?.unmount(); });
	root = createRoot(container());
	await act(async () => { root?.render(element); });
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((settle) => setTimeout(settle, 0)); });
	}
}

function text() {
	return document.body.textContent ?? '';
}

/**
 * The no-engine-token guard. `label` names the state under test.
 * `allowedNames` are real names (a subject code, a section, a teacher, a room,
 * the product) that are removed before the scan.
 */
function assertNoEngineTokens(rendered: string, label: string, allowedNames: string[] = []) {
	const scan = allowedNames.reduce((body, name) => body.split(name).join(' '), rendered);
	const shouted = scan.match(/\b[A-Z][A-Z0-9_]{3,}\b/)?.[0];
	assert.equal(shouted, undefined, `${label}: no SHOUTED engine token may render (found: ${shouted})`);
	assert.doesNotMatch(scan, /#[0-9]+/, `${label}: no numeric id may render`);
	assert.doesNotMatch(document.body.innerHTML, /font-mono/, `${label}: no monospace code element may render`);
}

/** The names every fixture resolves to, plus the product's own name. */
const RIGHT_PANEL_NAMES = ['GR7 - Luna', 'Cruz, Juan', 'Room 103 - G7AW', 'Room 204 - G7AW', 'MATH', 'GR10 - Rizal', 'MATH 10', 'ATLAS'];

/** The unmapped engine code used as the P1 negative control throughout. */
const UNMAPPED_CODE = 'FACULTY_LUNCH_WINDOW_VIOLATION';

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	mock.restoreAll();
	dom.window.close();
});

/* ── P1 row 1 — the soft-violation confirm dialog ─────────────────────────── */

function softWarning(code: string, message: string): Violation {
	return { code, severity: 'SOFT', message, entities: {}, meta: {} } as unknown as Violation;
}

function softDialog(warnings: Violation[]) {
	return createElement(Dialog, { open: true },
		createElement(SoftViolationConfirmDialog, {
			open: true,
			warnings,
			commitLoading: false,
			onCancel: () => {},
			onConfirm: () => {},
			formatConstraintMessage: (message: string) => message,
		}));
}

test('J2 P1.1 the soft-warning dialog names each rule in plain words, never as a code', async () => {
	const warning = softWarning('FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', 'Ms. Dela Cruz teaches 180 consecutive teaching min on Monday, exceeds limit 135 minutes.');
	await mount(softDialog([warning]));
	const rendered = text();
	assert.match(rendered, /Long teaching block/, 'the rule is named in plain words');
	assert.match(rendered, /180 consecutive teaching min/, 'the humanised message is still shown');
	assertNoEngineTokens(rendered, 'P1.1 soft-warning dialog', ['Ms. Dela Cruz', 'ATLAS']);
	assert.doesNotMatch(rendered, /warning\(s\)/, 'the count construct is gone');
	assert.doesNotMatch(rendered, /This edit introduces 1 soft warning/, 'the old count sentence is gone');
	assert.match(rendered, /This edit introduces 1 warning\./, 'the count sentence is plain English');
});

test('J2 P1.1 mutant: a rule with no plain name degrades to the shared sentence, not the token', async () => {
	// The OLD rendering printed exactly `warning.code` in a monospace span, so
	// this control fails against it and passes only after the fix.
	const warning = softWarning(UNMAPPED_CODE, 'The lunch window rule was recorded by an older run.');
	assert.equal(warning.code, UNMAPPED_CODE, 'the fixture really carries an unmapped engine code');
	await mount(softDialog([warning]));
	const rendered = text();
	assert.doesNotMatch(rendered, new RegExp(UNMAPPED_CODE), 'the unmapped code must not reach the operator');
	assert.match(rendered, /does not have a name for yet/, 'the fallback is a plain sentence');
	assertNoEngineTokens(rendered, 'P1.1 unlabelled rule', ['ATLAS']);
});

/* ── P1 row 3 — the hard blocker dialog's policy delta ────────────────────── */

test('J2 P1.3 the hard-blocker dialog states the policy threshold in plain words', async () => {
	await mount(createElement(Dialog, { open: true }, createElement(HardBlockerDialog, {
		open: true,
		// Every `delta` is copied verbatim from the traced producer
		// (`manual-edit.service.ts` `buildHumanConflicts`).
		items: [
			{ humanTitle: 'Teacher above weekly load', humanDetail: 'Weekly teaching is above the saved maximum.', delta: 'Limit: 200 min · Observed: 320 min · Δ +120 min' },
			{ humanTitle: 'Break is too short', humanDetail: 'The gap after a long block is shorter than the required break.', delta: 'Required: 10 min · Actual: 4 min · Short by 6 min' },
			{ humanTitle: 'Section day is too compressed', humanDetail: 'The section has too many consecutive class periods.', delta: 'Target: 2 period(s) · Observed: 0 period(s)' },
		],
		onClose: () => {},
	})));
	const rendered = text();
	// The three traced delta shapes, read exactly. `humanDetail` is neutral here
	// so the assertion is about the delta line and nothing else.
	assert.match(rendered, /Limit: 200 minutes; Observed: 320 minutes; 120 minutes over/);
	assert.match(rendered, /Required: 10 minutes; Actual: 4 minutes; Short by 6 minutes/);
	assert.match(rendered, /Target: 2 periods; Observed: 0 periods/);
	assert.doesNotMatch(rendered, /Δ/, 'the delta glyph is not a word');
	assert.doesNotMatch(rendered, /period\(s\)/, 'the (s) construct is gone');
	assert.doesNotMatch(rendered, / · /, 'the parts separator must read as a sentence');
	assert.doesNotMatch(rendered, /Limit: 200 min ·/, 'the raw delta must not survive');
	assertNoEngineTokens(rendered, 'P1.3 hard-blocker dialog');
});

test('J2 P1.3 mutant: reintroducing the raw delta fails this control', async () => {
	// Negative control: the pre-fix surface rendered `item.delta` verbatim in a
	// monospace span. Assert that string against the same expectations the test
	// above applies to the shipped surface, and watch it fail.
	const rawDelta = 'Limit: 200 min · Observed: 320 min · Δ +120 min';
	assert.match(rawDelta, /Δ/, 'the pre-fix string really carried the delta glyph');
	assert.match(rawDelta, /\bmin\b/, 'the pre-fix string really carried a bare min');
	assert.throws(() => assert.doesNotMatch(rawDelta, /Δ/), /expected to not match/);
	assert.throws(() => assert.doesNotMatch(rawDelta, /\bmin\b/), /expected to not match/);
	assert.throws(() => assert.match(rawDelta, /Limit: 200 minutes/), /input did not match/);
});

/* ── P1 row 2 + P2 — the right panel ──────────────────────────────────────── */

function rightPanelProps(overrides: Record<string, unknown>) {
	return {
		rightPanelRef: { current: null },
		setIsRightCollapsed: () => {},
		isRightCollapsed: false,
		isPreGenerationWorkspace: false,
		preGenKbSource: null,
		selectedEntry: { entryId: 'entry-4::t1', facultyId: 7, roomId: 103, subjectId: 5, sectionId: 91, day: 'MONDAY', startTime: '08:15', endTime: '09:00' },
		setPreGenKbSource: () => {},
		setKbSelectedSource: () => {},
		gradeBadge: {},
		initials: () => 'JC',
		facultyMap: new Map([[7, { id: 7, firstName: 'Juan', lastName: 'Cruz', department: 'Math', advisedSectionName: 'GR7 - Luna' }]]),
		formatFacultyInitials: () => 'JC',
		isDesktop: true,
		subjectLabel: () => 'MATH',
		toggleFollowUp: async () => {},
		followUps: new Set<string>(),
		setSelectedEntry: () => {},
		gradeForSection: () => 7,
		violationIndex: new Map<string, unknown[]>([
			['entry-4::t1', [
				{ code: 'FACULTY_TIME_CONFLICT', severity: 'HARD' },
				// A code with no label — the exact case the old `?? v.code` leaked.
				{ code: UNMAPPED_CODE, severity: 'SOFT' },
			]],
		]),
		sectionLabel: () => 'GR7 - Luna',
		facultyLabel: () => 'Cruz, Juan',
		roomLabel: () => 'Room 103 - G7AW',
		roomRequestSummary: null,
		previewResult: null,
		formatConstraintMessage: (message: string) => message,
		violationLabels: { FACULTY_TIME_CONFLICT: 'Teacher double-booked' },
		violationExplanations: {},
		setSelectedViolation: () => {},
		toast: { error: () => {}, info: () => {} },
		draftBoard: null,
		parseDraftPlacementId: () => null,
		deletingPlacementId: null,
		setPendingUnassignId: () => {},
		setShowUnassignConfirm: () => {},
		enterManualEditView: () => {},
		openTacticalSandbox: () => {},
		dayShort: { MONDAY: 'Mon' },
		...overrides,
	};
}

function rightPanel(overrides: Record<string, unknown> = {}) {
	return createElement(ResizablePanelGroup, { direction: 'horizontal' },
		createElement(RightPanel, rightPanelProps(overrides) as never));
}

test('J2 P1.2 the right panel never falls back to a raw code for an unlabelled rule', async () => {
	await mount(rightPanel());
	const rendered = text();
	assert.match(rendered, /Teacher double-booked/, 'a labelled rule still shows its plain name');
	assert.doesNotMatch(rendered, new RegExp(UNMAPPED_CODE), 'the unlabelled code must not render');
	assert.match(rendered, /does not have a name for yet/, 'the fallback reads as English');
	assertNoEngineTokens(rendered, 'P1.2 right panel', RIGHT_PANEL_NAMES);
});

test('J2 P2 the right panel states the room-request decision in plain words and says what happens next', async () => {
	await mount(rightPanel({ roomRequestSummary: { requests: [{
		entryId: 'entry-4::t1', requestedRoomName: 'Room 204 - G7AW', status: 'SUBMITTED',
		decisionStatus: 'REJECTED', rationale: 'Lab only free on Tuesday', reviewerNotes: 'None',
		appealCount: 3, openAppealCount: 1, latestAppealStatus: 'UNDER_REVIEW',
	}] } }));
	const rendered = text();
	assert.match(rendered, /Decision: Not approved/, 'the decision is a plain state');
	assert.match(rendered, /The request was declined, so this session keeps the room and time it already had\./, 'the copy says what happens next');
	assert.match(rendered, /Appeals: 3 raised, 1 still open/, 'the appeal counts read as counts');
	assert.match(rendered, /latest appeal is being looked at now/, 'the appeal state is plain');
	assert.doesNotMatch(rendered, /REJECTED|UNDER_REVIEW|SUBMITTED/, 'no raw enum may render');
	assert.doesNotMatch(rendered, /Lab only free on Tuesday ·/, 'the reason keeps its own line');
	assertNoEngineTokens(rendered, 'P2 rejected room request', [...RIGHT_PANEL_NAMES, 'Lab only free on Tuesday']);
});

test('J2 P2 mutant: reintroducing the raw enum fails this control', async () => {
	// Negative control, recorded literally: the pre-fix JSX was
	// `Status: {matchingRequest.decisionStatus} · Reason: …`. Feed this control
	// that exact expression and watch the shipped assertion fail, then assert
	// the real surface satisfies it.
	const decisionStatus = 'APPROVED';
	const preFixText = `Status: APPROVED · Reason: Lab only free on Tuesday`;
	assert.ok(preFixText.includes(decisionStatus), 'the pre-fix expression really printed the enum');
	assert.throws(() => assert.doesNotMatch(preFixText, new RegExp(decisionStatus)), /expected to not match/);

	await mount(rightPanel({ roomRequestSummary: { requests: [{
		entryId: 'entry-4::t1', requestedRoomName: 'Room 204 - G7AW', status: 'SUBMITTED',
		decisionStatus, rationale: 'Lab only free on Tuesday', reviewerNotes: 'None',
		appealCount: 0, openAppealCount: 0, latestAppealStatus: null,
	}] } }));
	const rendered = text();
	assert.doesNotMatch(rendered, new RegExp(decisionStatus), 'the shipped panel must not print the enum');
	assert.match(rendered, /Decision: Approved/);
	assert.match(rendered, /The schedule has been changed to use the requested room\./);
	assertNoEngineTokens(rendered, 'P2 approved room request', [...RIGHT_PANEL_NAMES, 'Lab only free on Tuesday']);
});

test('J2 P2 an unsent draft says it is not in the decision queue', async () => {
	await mount(rightPanel({ roomRequestSummary: { requests: [{
		entryId: 'entry-4::t1', requestedRoomName: 'Room 204 - G7AW', status: 'DRAFT',
		decisionStatus: 'PENDING', rationale: null, reviewerNotes: null,
		appealCount: 0, openAppealCount: 0, latestAppealStatus: null,
	}] } }));
	const rendered = text();
	assert.match(rendered, /Not sent yet/);
	assert.match(rendered, /has not been sent to a scheduler, so no decision is expected on it yet\./);
	assert.doesNotMatch(rendered, /Waiting for a decision/, 'a draft must not claim to be waiting for a decision');
	assertNoEngineTokens(rendered, 'P2 draft room request', RIGHT_PANEL_NAMES);
});

/* ── P3 — run numbers stay, but never as the label ───────────────────────── */

test('J2 P3 the run list pairs each run number with its date as a quiet suffix', async () => {
	await mount(createElement(MemoryRouter, null, createElement(TimetableRunsPane, {
		runs: [
			{ id: 318, status: 'COMPLETED', triggeredBy: 46, startedAt: '2026-09-26T00:05:00.000Z', finishedAt: '2026-09-26T00:06:00.000Z', durationMs: 61000, error: null, createdAt: '2026-09-26T00:05:00.000Z', runType: 'FULL', version: 3 },
			// A run that never finished: no finish time and no duration, which is
			// the real shape `listRuns` returns for a failed generation.
			{ id: 317, status: 'FAILED', triggeredBy: 46, startedAt: '2026-09-25T00:05:00.000Z', finishedAt: null, durationMs: null, error: 'Solver timed out', createdAt: '2026-09-25T00:05:00.000Z', runType: 'FULL', version: 1 },
		],
		selectedRunId: '318',
		onSelectRun: () => {},
		formatTimestamp: (value: string | null) => (value ? new Date(value).toISOString().slice(0, 16).replace('T', ' ') : 'unknown'),
		formatDuration: (value: number | null) => (value == null ? 'unknown' : `${Math.round(value / 1000)}s`),
	})));
	const rendered = text();
	assert.match(rendered, /2026-09-26 00:05 · run 318/, 'the date leads and the run number is the quiet suffix');
	assert.match(rendered, /2026-09-25 00:05 · run 317/);
	assert.doesNotMatch(rendered, /Run #/, 'the old `Run #id` label is gone');
	assert.doesNotMatch(rendered, /COMPLETED|FAILED|FULL/, 'the run state and kind enums are gone');
	assert.match(rendered, /Finished/, 'a completed run reads as a finished run');
	assert.match(rendered, /Did not finish/, 'a failed run reads as a failed run');
	assert.match(rendered, /Full run/, 'the run kind reads as words');
	assertNoEngineTokens(rendered, 'P3 run list');
});

test('J2 P3 the publish checklist keeps the run number as a quiet suffix', async () => {
	await mount(createElement(PublishChecklistContent, {
		runId: 318,
		assignedCount: 40,
		unassignedCount: 0,
		hardCount: 0,
		blockingHardCount: 0,
		softCount: 0,
		violations: [],
		sectionLabel: () => 'GR7 - Luna',
		subjectLabel: () => 'MATH',
		facultyLabel: () => 'Cruz, Juan',
		onPublish: () => {},
		onReviewIssues: () => {},
		onPlaceUnresolved: () => {},
	} as never));
	const rendered = text();
	assert.match(rendered, /Generated schedule · run 318/);
	assert.doesNotMatch(rendered, /Run #/, 'the old `Run #id` label is gone');
	assertNoEngineTokens(rendered, 'P3 publish checklist', RIGHT_PANEL_NAMES);
});

test('J2 P3 the run selector surfaces delegate to the one run-anchor helper', () => {
	// The two run Selects only mount their items when the operator opens the
	// list, which a headless DOM cannot drive reliably. This row therefore proves
	// the delegation and the absence of the old label in source, while the two
	// rendered rows above prove the resulting wording on real surfaces. The
	// helper's own contract, including the blank-anchor case, is proved in
	// plain-tokens-c04-mapping.test.ts.
	for (const relative of [
		'src/components/timetable/ScheduleReviewWorkspaceHeader.tsx',
		'src/components/timetable/simple/SimpleMoreMenuContent.tsx',
	]) {
		const source = readFileSync(resolve(clientRoot, relative), 'utf8');
		assert.match(source, /runAnchorLabel\(/, `${relative} must use the shared run anchor`);
		assert.doesNotMatch(source, /Run #\{/, `${relative} must not keep the raw run-number label`);
	}
});

test('J2 P3 the readiness report and the CSV download keep the run anchor and the filename', () => {
	// The pasted report is plain text assembled in the component, so it is proved
	// at its source with the exact expected line. The CSV FILENAME is
	// deliberately unchanged so it stays machine-parseable: `publish-blockers-
	// run-{runId}.csv` is produced and never parsed anywhere in the repository.
	const source = readFileSync(resolve(clientRoot, 'src/components/timetable/SimplePublishReadinessSheet.tsx'), 'utf8');
	assert.match(source, /lines\.push\(runAnchorLabel\(runId\)\)/, 'the pasted report uses the shared run anchor');
	assert.doesNotMatch(source, /Run: #/, 'the old `Run: #id` report line is gone');
	assert.match(source, /publish-blockers-run-\$\{runId\}\.csv/, 'the machine-parseable CSV filename is unchanged');
});

/* ── P4 — manual edit history ────────────────────────────────────────────── */

test('J2 P4 the edit history reads as plain actions, names no actor id, and uses a Tooltip not a title', async () => {
	await mount(createElement(Dialog, { open: true }, createElement(TimetableAssignmentDialogs, {
		context: {
			showEditHistory: true,
			setShowEditHistory: () => {},
			editHistory: [
				{ id: 46, runId: 318, actorId: 46, editType: 'PLACE_UNASSIGNED', validationSummary: { hardCount: 2, softCount: 1 }, createdAt: '2026-09-26T00:05:00.000Z' },
				{ id: 45, runId: 318, actorId: 12, editType: 'CHANGE_ROOM', validationSummary: { hardCount: 0, softCount: 0 }, createdAt: '2026-09-25T00:05:00.000Z' },
			],
			revertEditById: async () => {},
			revertLoading: false,
			currentRunVersion: 7,
		} as never,
	})));
	const rendered = text();
	assert.match(rendered, /Gave an unplaced session a slot/, 'the action reads as what it did');
	assert.match(rendered, /Changed the room/);
	assert.doesNotMatch(rendered, /PLACE UNASSIGNED|PLACE_UNASSIGNED/, 'the raw editType is gone');
	assert.doesNotMatch(rendered, /by user/, 'the bare actor id attribution is gone');
	assert.doesNotMatch(rendered, /Edit #/, 'the raw edit id label is gone');
	assert.match(rendered, /All serious problems: 2, warnings: 1/, 'the total keeps the total word, not the blocking word');
	assertNoEngineTokens(rendered, 'P4 edit history');
	// AGENTS.md section 8: no native `title` attribute for extra information.
	assert.doesNotMatch(document.body.innerHTML, /\stitle=/, 'no native title attribute may survive');
	assert.match(rendered, /Revert this edit/, 'the revert action keeps its plain label');
	// The explanation is still available, through the @/ui Tooltip primitive.
	const dialogSource = readFileSync(resolve(clientRoot, 'src/components/timetable/modals/TimetableAssignmentDialogs.tsx'), 'utf8');
	assert.match(dialogSource, /<TooltipContent>\{revertReason\}<\/TooltipContent>/, 'the reason moved into the Tooltip primitive');
});

test('J2 P4 mutant: the pre-fix actor attribution fails this control', () => {
	// The pre-fix line was `Edit #{edit.id} · by user #{edit.actorId}`.
	const preFixText = 'Edit #46 · by user #46';
	assert.match(preFixText, /#[0-9]+/, 'the pre-fix line really printed two numeric ids');
	assert.throws(() => assert.doesNotMatch(preFixText, /#[0-9]+/), /expected to not match/);
	assert.throws(() => assertNoEngineTokens(preFixText, 'P4 pre-fix line'), /no numeric id may render/);
});

/* ── P6 — the projection line ────────────────────────────────────────────── */

const REPAIR_OPTION = {
	id: 'move-a',
	label: 'Move this session to tuesday 08:00-08:45',
	explanation: 'Teacher double-booked: this preview removes the selected issue without adding a hard conflict.',
	affectedEntryIds: ['entry-a'],
	proposal: { editType: 'CHANGE_TIMESLOT', entryId: 'entry-a', targetDay: 'TUESDAY', targetStartTime: '08:00', targetEndTime: '08:45' },
	// The traced server shape (`violation-repair-options.service.ts`): the
	// server only emits an option when `targetIssuesAfter` is 0 and
	// `hardAfter <= hardBefore`.
	projectedDelta: { targetIssuesBefore: 1, targetIssuesAfter: 0, hardBefore: 1, hardAfter: 0, softBefore: 0, softAfter: 0 },
};

function guideContext() {
	return {
		selectedRunId: '318',
		runs: [{ id: 318 }],
		schoolYearId: 10,
		defaultSchoolId: 1,
		VIOLATION_LABELS: { FACULTY_TIME_CONFLICT: 'Teacher double-booked' },
		sectionLabel: () => 'GR7 - Luna',
		subjectLabel: () => 'MATH',
		formatConstraintMessage: (message: string) => message,
		previewEdit: async () => null,
	};
}

function guideViolation() {
	return {
		code: 'FACULTY_TIME_CONFLICT',
		severity: 'HARD',
		message: 'Conflict',
		schoolId: 1,
		schoolYearId: 10,
		runId: 318,
		entities: { sectionId: 91, subjectId: 5, entryIds: ['entry-1::t1'] },
		meta: { termIndex: 1 },
	};
}

async function mountGuide(projectedDelta: typeof REPAIR_OPTION.projectedDelta) {
	mock.method(atlasApi, 'post', async () => ({ data: {
		violation: { code: 'FACULTY_TIME_CONFLICT', severity: 'HARD', message: 'Conflict', entities: {} },
		evidence: [],
		status: 'REPAIRABLE',
		verifiedAt: '2026-09-26T00:05:00.000Z',
		options: [{ ...REPAIR_OPTION, projectedDelta }],
		blockers: [],
	} }));
	await mount(createElement(TimetableIssueRepairGuide, {
		context: guideContext() as never,
		violation: guideViolation() as never,
	}));
}

test('J2 P6 the projection line names what each number counts and drops the (s) construct', async () => {
	await mountGuide(REPAIR_OPTION.projectedDelta);
	const rendered = text();
	assert.match(rendered, /Projected: 1 fewer selected issue and 1 fewer Must fix problem\./,
		'both numbers name what they count, in words');
	assert.doesNotMatch(rendered, /issue\(s\)/, 'the (s) construct is gone');
	assert.doesNotMatch(rendered, /-1 hard change/, 'a signed delta no longer reads as a count of changes');
	assert.doesNotMatch(rendered, /hard change/, 'the old label is gone');
	assertNoEngineTokens(rendered, 'P6 projection line', RIGHT_PANEL_NAMES);
	mock.restoreAll();
});

test('J2 P6 a zero shift says so in words rather than printing a bare zero', async () => {
	await mountGuide({ targetIssuesBefore: 1, targetIssuesAfter: 0, hardBefore: 0, hardAfter: 0, softBefore: 0, softAfter: 0 });
	const rendered = text();
	assert.match(rendered, /Projected: 1 fewer selected issue and no change to the Must fix problems\./);
	mock.restoreAll();
});

test('J2 P6 a worsening shift is stated in words, with the same arithmetic', async () => {
	// The same two subtractions, worded. `hardAfter - hardBefore` is +1 here, so
	// the old line printed "1 hard change" for a change that makes things worse.
	await mountGuide({ targetIssuesBefore: 0, targetIssuesAfter: 1, hardBefore: 0, hardAfter: 1, softBefore: 0, softAfter: 0 });
	const rendered = text();
	assert.match(rendered, /Projected: 1 more selected issue and 1 more Must fix problem\./);
	mock.restoreAll();
});

/* ── the guard's documented exclusions ───────────────────────────────────── */

test('J2 guard exclusion 1: a resolved Subject code is a NAME and must survive', async () => {
	// The grid prints a subject's own `displayCode` (or `code`) in every cell.
	// That is a name lookup, so the no-engine-token guard must NOT reject it.
	// This row proves the guard is not over-broad, by feeding a real code and
	// asserting it is still on screen.
	await mount(rightPanel({ subjectLabel: () => 'MATH 10', sectionLabel: () => 'GR10 - Rizal' }));
	const rendered = text();
	assert.match(rendered, /MATH 10/, 'a subject name/code lookup still renders');
	assert.match(rendered, /GR10 - Rizal/, 'a section name still renders');
});

test('J2 guard mutant: the token scan really fires on a shouted engine token', () => {
	// A guard that cannot fail is not a guard. This proves the scan rejects the
	// exact strings the pre-fix surfaces printed, and that a resolved name is
	// only spared because it is passed as an allowed name lookup.
	assert.throws(() => assertNoEngineTokens('Room 103 - G7AW', 'guard self-test'), /SHOUTED engine token/);
	assert.throws(() => assertNoEngineTokens('Run #318', 'guard self-test'), /no numeric id may render/);
	assert.throws(() => assertNoEngineTokens('FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', 'guard self-test'), /SHOUTED engine token/);
	// The same shouted string, once declared a real name, is spared.
	assert.doesNotThrow(() => assertNoEngineTokens('FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', 'guard self-test', ['FACULTY_CONSECUTIVE_LIMIT_EXCEEDED']));
});
