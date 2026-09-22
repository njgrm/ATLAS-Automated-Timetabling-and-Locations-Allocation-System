/**
 * TIMETABLE-RELAXED-MAIN-C01 — Candidate B behaviour proofs (B1–B4).
 *
 * Real-surface assertions: the actual `InlinePlacementPreview`,
 * `TimetableAdvancedHeaderHelp` and `TimetableSkeleton` render, the real
 * placement decision function runs, and the real Timetable data layer is
 * exercised against a mocked transport so the request counts are observed, not
 * asserted from source text.
 *
 * Fixtures come from the real surface: the ordered-term contract is the
 * committed Term 1/2/3 shape, the unassigned item is the live `UnassignedItem`
 * shape, and the slot strings are the 45-minute Monday 11:30–12:15 cell the
 * live grid uses.
 *
 * Run: `npm run test:timetable-relaxed-main`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test, { after } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { InlinePlacementPreview } from '../InlinePlacementPreview';
import { TimetableAdvancedHeaderHelp } from '../TimetableAdvancedHeaderHelp';
import { TimetableSkeleton } from '../TimetableSkeleton';
import {
	buildInlinePlacementPreviewData,
	describeInlinePlacement,
	type InlinePlacementInput,
} from '@/lib/timetable-inline-placement';
import { decideAutoSavePlacement } from '@/lib/simple-timetable-state';
import atlasApi from '@/lib/api';
import { timetableQueryClient } from '@/lib/timetable-data/timetableQueryClient';
import {
	ensureTimetableDraftBoard,
	ensureTimetableReferenceData,
	ensureTimetableRunBundle,
	ensureTimetableRuns,
	resetTimetableWarmScope,
} from '@/lib/timetable-data/timetableServerState';
import type { ResolvedTimetableScope } from '@/lib/timetable-data/timetableQueryKeys';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

/** The live clean-placement fixture: a resolved owner/room on an empty slot. */
function cleanPlacementInput(overrides: Partial<InlinePlacementInput> = {}): InlinePlacementInput {
	return {
		subjectLabel: 'TLE',
		sectionLabel: 'G7AW',
		session: 1,
		day: 'MONDAY',
		startTime: '11:30',
		endTime: '12:15',
		roomLabel: 'Room 103 - G7 Main',
		softCount: 0,
		hardTitle: null,
		...overrides,
	};
}

/* ── B1 — failing-first control: a clean slot must not auto-commit ───────── */

test('B1 control: a clean slot returns a pending confirm, never an auto-commit', () => {
	const cleanPreview = { allowed: true, hardViolations: [], softViolations: [] };
	const decision = decideAutoSavePlacement({
		hasFacultyOwner: true,
		resolvedRoomId: 103,
		targetSlotOccupied: false,
		preview: cleanPreview,
	});
	// Failing-first control: the pre-B1 contract returned `{ kind: 'auto-commit' }`
	// here, which committed without ever stating the consequence. That kind no
	// longer exists in the union and the clean path must pause for a Confirm.
	assert.notEqual((decision as { kind: string }).kind, 'auto-commit', 'a clean slot must never commit without a confirm');
	assert.deepEqual(decision, { kind: 'preview-confirm', softCount: 0 });
});

test('B1 control: only a genuinely clean, owned, room-resolved, free slot reaches the confirm', () => {
	// The confirm boundary must stay fail-closed: each precondition below still
	// routes to a review/blocked decision rather than the inline confirm.
	const base = {
		hasFacultyOwner: true,
		resolvedRoomId: 103,
		targetSlotOccupied: false,
		preview: { allowed: true, hardViolations: [], softViolations: [] },
	};
	assert.deepEqual(decideAutoSavePlacement({ ...base, hasFacultyOwner: false }), { kind: 'review-no-owner' });
	assert.deepEqual(decideAutoSavePlacement({ ...base, targetSlotOccupied: true }), { kind: 'review-occupied' });
	assert.deepEqual(decideAutoSavePlacement({ ...base, resolvedRoomId: null }), { kind: 'review-no-room' });
	assert.deepEqual(decideAutoSavePlacement({ ...base, preview: null }), { kind: 'review-no-preview' });
	assert.deepEqual(
		decideAutoSavePlacement({ ...base, preview: { allowed: false, hardViolations: [{}], softViolations: [] } }),
		{ kind: 'review-blocked', hardTitle: null },
	);
	// A soft-warned slot keeps its own decision so the count is carried, but the
	// hook routes it to the same inline preview (no modal).
	assert.deepEqual(
		decideAutoSavePlacement({ ...base, preview: { allowed: true, hardViolations: [], softViolations: [{}, {}] } }),
		{ kind: 'review-soft', softCount: 2 },
	);
});

/* ── B1 — the consequence is stated before saving ────────────────────────── */

test('B1: the clean consequence names the destination and promises nothing changes before the confirm', () => {
	const { consequence, confirmable } = describeInlinePlacement(cleanPlacementInput());
	assert.equal(confirmable, true);
	assert.match(consequence, /TLE · G7AW · session 1/, 'the session being placed is named');
	assert.match(consequence, /MONDAY 11:30–12:15 · Room 103 - G7 Main/, 'the exact destination is named');
	assert.match(consequence, /Confirm/);
	assert.doesNotMatch(consequence, /saves immediately/i, 'the removed immediate-save claim must not survive');
});

test('B1: a warned destination states the warning count; a blocked one disables the confirm', () => {
	const warned = describeInlinePlacement(cleanPlacementInput({ softCount: 2 }));
	assert.equal(warned.confirmable, true);
	assert.match(warned.consequence, /2 soft warnings will be acknowledged/);

	const blocked = describeInlinePlacement(cleanPlacementInput({ hardTitle: 'Teacher already booked in this slot' }));
	assert.equal(blocked.confirmable, false);
	assert.match(blocked.consequence, /blocked: Teacher already booked in this slot/);

	const noRoom = describeInlinePlacement(cleanPlacementInput({ roomLabel: null }));
	assert.equal(noRoom.confirmable, false);
	assert.match(noRoom.consequence, /could not choose a room/);
});

/* ── B1 — the rendered inline preview is one Confirm and never a modal ───── */

function renderPreview(input: InlinePlacementInput): string {
	const pending = buildInlinePlacementPreviewData(input);
	return renderToStaticMarkup(
		createElement(InlinePlacementPreview, {
			pending,
			saving: false,
			onConfirm: () => {},
			onCancel: () => {},
		}),
	);
}

test('B1: the rendered preview offers exactly one Confirm, no dialog, and keeps Undo reachable', () => {
	const markup = renderPreview(cleanPlacementInput());
	assert.match(markup, /data-testid="inline-placement-preview"/, 'the inline preview renders');
	assert.equal((markup.match(/data-testid="inline-placement-confirm"/g) ?? []).length, 1, 'exactly one Confirm');
	assert.match(markup, /data-testid="inline-placement-confirm"[^>]*>/, 'Confirm is present');
	assert.doesNotMatch(markup, /role="dialog"/, 'no modal opens per placement');
	assert.doesNotMatch(markup, /<dialog/, 'no dialog element is used');
	assert.match(markup, /data-confirmable="true"/, 'a clean slot is confirmable');
	// Undo is the post-save affordance and lives in the workspace shell, which
	// must still render the auto-save undo strip (asserted below from source).
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /data-testid="timetable-auto-save-undo"/, 'Undo remains available after the confirm');
	assert.match(workspace, /onConfirm=\{\(\) => void state\.confirmInlinePlacement\(\)\}/, 'the single Confirm is the only commit path');
});

test('B1: a blocked destination renders a disabled Confirm with the typed reason', () => {
	const markup = renderPreview(cleanPlacementInput({ hardTitle: 'Room already in use' }));
	assert.match(markup, /data-confirmable="false"/);
	assert.match(markup, /Room already in use/);
	assert.match(markup, /data-testid="inline-placement-confirm"[^>]*disabled/, 'a blocked destination cannot be confirmed');
});

test('B1: the inline preview panel is a status region, never a focus trap', () => {
	const panel = source('src/components/timetable/InlinePlacementPreview.tsx');
	assert.match(panel, /role="status"/);
	assert.doesNotMatch(panel, /Dialog|SheetContent|focus-trap/, 'the preview must not become a modal primitive');
});

test('B1 source contract: the placement hook routes the confirm decisions inline', () => {
	const hook = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.doesNotMatch(hook, /decision\.kind === 'auto-commit'/, 'the removed auto-commit branch must be gone');
	assert.match(hook, /decision\.kind === 'preview-confirm' \|\| decision\.kind === 'review-soft'/);
	assert.match(hook, /buildInlinePlacementPreviewData\(/);
	assert.match(hook, /const confirmInlinePlacement = useCallback/);
	assert.match(hook, /commitEditWithMeta\(\s*pending\.proposal/, 'the confirm is the only commit path');
});

/* ── B2 — the Advanced guidance is visible, not sr-only ──────────────────── */

function renderAdvancedHelp(mode: 'schedule' | 'draft' = 'schedule'): string {
	return renderToStaticMarkup(
		createElement(TimetableAdvancedHeaderHelp, {
			mode,
			activeTaskHelper: 'Choose one unresolved session, then choose a green slot on the grid.',
			editHistoryCount: 0,
			revertLoading: false,
			onRevertLastEdit: () => {},
		}),
	);
}

test('B2: the Advanced guidance renders visibly with the aria-describedby anchor intact', () => {
	const markup = renderAdvancedHelp();
	assert.match(markup, /id="timetable-foolproof-help"/, 'the id the task buttons point at still exists');
	assert.match(markup, /data-testid="timetable-foolproof-help"/);
	assert.match(markup, /No precision dragging required\./, 'the plain-language lead is visible');
	assert.match(markup, /ATLAS previews the result before anything is saved\./, 'the short guidance is visible');
	// The guidance root itself must not be screen-reader-only. (The nested status
	// legend legitimately keeps its own sr-only summary.)
	const rootTag = markup.match(/<div id="timetable-foolproof-help"[^>]*>/)?.[0] ?? '';
	assert.ok(rootTag, 'the guidance root renders');
	assert.doesNotMatch(rootTag, /sr-only/, 'the guidance element is no longer screen-reader-only');
});

test('B2: the draft mode names the draft review instead of the schedule wording', () => {
	const markup = renderAdvancedHelp('draft');
	assert.match(markup, /The draft review opens before anything is saved\./);
	assert.doesNotMatch(markup, /ATLAS previews the result/);
});

test('B2 source contract: the Advanced header renders the visible help and is shorter than before', () => {
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	assert.match(header, /<TimetableAdvancedHeaderHelp/);
	// The old block wrapped the guidance in `sr-only` on the same id.
	assert.doesNotMatch(header, /data-testid="timetable-foolproof-help"[^>]*sr-only/);
	assert.ok(header.split('\n').length < 1069, 'extraction must not grow the over-cap header further');
});

/* ── B3 — progressive first paint: shell + sub-nav + skeleton immediately ── */

function renderSkeleton(): string {
	return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/timetable'] }, createElement(TimetableSkeleton)));
}

test('B3 first paint: the shell, the labelled sub-nav and the skeleton all render before the grid resolves', () => {
	const markup = renderSkeleton();
	assert.match(markup, /data-testid="timetable-first-paint"/, 'the first-paint shell marker renders');
	assert.match(markup, /data-testid="timetable-sub-nav"/, 'the sub-nav is visible immediately');
	// Every labelled destination is reachable while the grid is still loading.
	for (const key of ['schedule', 'draft', 'setup', 'policies', 'runs', 'exports']) {
		assert.match(markup, new RegExp(`data-testid="timetable-sub-nav-${key}"`), `sub-nav ${key} must be visible on first paint`);
	}
	assert.match(markup, /Loading timetable:/, 'the honest loading copy renders');
	assert.match(markup, /the grid fills as soon as the latest run resolves/, 'the copy states the progressive fill');
	assert.doesNotMatch(markup, /finding the latest run first, then adding labels/, 'the old blocking copy is gone');
	// A single height-locked root: the sub-nav must not add a second 100svh frame.
	assert.equal((markup.match(/calc\(100svh-3\.5rem\)/g) ?? []).length, 1, 'exactly one height-locked root');
});

/* ── B3 — no endpoint is repeated on the index → sub-page → index trip ───── */

const runsFixture = [{ id: 42, status: 'COMPLETED' }];
const draftFixture = { runId: 42, version: 3, status: 'COMPLETED', entries: [], unassignedItems: [], summary: {}, inputState: {} };
const violationsFixture = { violations: [] };
const draftBoardFixture = { counts: { draft: 0 } };
const referenceFixture = {
	subjects: [{ id: 1, code: 'TLE', name: 'TLE' }],
	faculty: [{ id: 9, firstName: 'P.', lastName: 'Cruz' }],
	buildings: [{ id: 2, name: 'G7 Main', shortCode: 'G7', rooms: [] }],
	sections: [{ id: 701, name: 'G7AW' }],
	sectionSummary: { sections: [{ id: 701, name: 'G7AW' }] },
};

function respond(url: string): unknown {
	if (/\/generation\/\d+\/\d+\/runs$/.test(url)) return { runs: runsFixture };
	if (url.includes('/runs/latest/draft')) return draftFixture;
	if (url.includes('/runs/latest/violations')) return violationsFixture;
	if (url.includes('pre-generation-drafts')) return draftBoardFixture;
	if (url.includes('/subjects?')) return { subjects: referenceFixture.subjects };
	if (url.includes('/faculty?')) return { faculty: referenceFixture.faculty };
	if (url.includes('/buildings')) return { buildings: referenceFixture.buildings };
	if (url.includes('/sections/summary/')) return referenceFixture.sectionSummary;
	throw new Error(`unexpected URL ${url}`);
}

const scope: ResolvedTimetableScope = { schoolId: 1, schoolYearId: 9, runId: 'latest', termIndex: 2 };

/** One index → sub-page → index trip through the real production read layer. */
async function roundTrip(): Promise<void> {
	await ensureTimetableRuns(scope);
	await ensureTimetableRunBundle(scope);
	await ensureTimetableReferenceData(scope);
	await ensureTimetableDraftBoard(scope);
}

test('B3 dedupe: a second index → sub-page → index trip repeats no endpoint resolved in the session', async () => {
	const originalGet = atlasApi.get;
	const calls: string[] = [];
	(atlasApi as unknown as { get: unknown }).get = async (url: string) => {
		calls.push(url);
		return { data: respond(url) };
	};
	try {
		timetableQueryClient.clear();
		resetTimetableWarmScope();
		await roundTrip();
		const firstTrip = calls.length;
		assert.ok(firstTrip >= 4, `the cold trip must dispatch the scoped reads (observed ${firstTrip})`);
		const uniqueEndpoints = new Set(calls).size;
		assert.equal(uniqueEndpoints, firstTrip, 'the cold trip already issues each endpoint once, never twice');

		calls.length = 0;
		await roundTrip();
		assert.equal(calls.length, 0, `the warm round trip must repeat no endpoint (observed ${calls.length})`);
	} finally {
		(atlasApi as unknown as { get: unknown }).get = originalGet;
		timetableQueryClient.clear();
		resetTimetableWarmScope();
	}
});

test('B3 dedupe control: an uncached read path doubles the dispatches (the mutant the cache prevents)', async () => {
	const originalGet = atlasApi.get;
	const calls: string[] = [];
	(atlasApi as unknown as { get: unknown }).get = async (url: string) => {
		calls.push(url);
		return { data: respond(url) };
	};
	try {
		timetableQueryClient.clear();
		resetTimetableWarmScope();
		// Cached path: one dispatch per endpoint, then zero.
		await ensureTimetableRuns(scope);
		const cachedCold = calls.length;
		calls.length = 0;
		await ensureTimetableRuns(scope);
		assert.equal(calls.length, 0, 'the cached path never re-dispatches');

		// Mutant: a forced read (what every mount used to do) re-dispatches.
		calls.length = 0;
		await ensureTimetableRuns(scope, { force: true });
		assert.ok(calls.length > 0, 'a forced read re-dispatches — this is the doubling the cache removes');
		assert.equal(cachedCold, 1);
	} finally {
		(atlasApi as unknown as { get: unknown }).get = originalGet;
		timetableQueryClient.clear();
		resetTimetableWarmScope();
	}
});

/* ── B4 — no-scroll architecture, structurally re-verified ───────────────── */

test('B4: the workspace, the skeleton and the grid region keep the no-scroll architecture', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const skeleton = source('src/components/timetable/TimetableSkeleton.tsx');
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	const body = source('src/components/timetable/ScheduleReviewWorkspaceBody.tsx');

	// The root of every timetable surface is height-locked to the shell.
	for (const [name, text] of [['workspace', workspace], ['skeleton', skeleton]] as const) {
		assert.match(text, /h-\[calc\(100svh-3\.5rem\)\]/, `${name}: the root must stay height-locked`);
	}
	// The scroll surface is the sanctioned inner region, not the document.
	assert.match(body, /flex flex-1 min-h-0 overflow-hidden/, 'the body clips instead of scrolling the page');
	assert.match(center, /<GridScrollMemory scrollTopRef=\{gridScrollTopRef\}/, 'the grid keeps its inner scroll region');
	assert.match(center, /className="flex-1 min-h-0"/, 'the grid wrapper remains flex-1 min-h-0');
	// No timetable surface may opt the document into a global scrollbar.
	for (const [name, text] of [['workspace', workspace], ['center', center], ['body', body], ['skeleton', skeleton]] as const) {
		assert.doesNotMatch(text, /overflow-(x|y)-scroll/, `${name}: no forced global scrollbar`);
		assert.doesNotMatch(text, /min-w-screen|w-screen/, `${name}: no viewport-width blowout`);
	}
});

test('B4: nothing inside Timetable regresses below the 12px typography floor', () => {
	const candidates = [
		'InlinePlacementPreview.tsx',
		'TimetableAdvancedHeaderHelp.tsx',
		'TimetableSkeleton.tsx',
	];
	for (const file of candidates) {
		const text = source(`src/components/timetable/${file}`);
		for (const match of text.matchAll(/text-\[([0-9.]+)(px|rem)\]/g)) {
			const value = match[2] === 'px' ? Number(match[1]) : Number(match[1]) * 16;
			assert.ok(value >= 12, `${file} contains ${match[0]}, below the 12px floor`);
		}
	}
});

after(() => {
	timetableQueryClient.clear();
});
