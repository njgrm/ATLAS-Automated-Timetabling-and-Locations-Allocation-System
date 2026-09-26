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
import { readdirSync, readFileSync } from 'node:fs';
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
		// C1-c R1 — the fixture carries no reference-read discriminator unless a
		// row supplies one, which is the honest `unknown` case: the copy keeps
		// the pre-C1-c wording instead of guessing a count.
		availableTeachingSpaces: { state: 'unknown' },
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

function renderPreview(input: InlinePlacementInput, extra: Record<string, unknown> = {}): string {
	const pending = buildInlinePlacementPreviewData(input);
	return renderToStaticMarkup(
		createElement(InlinePlacementPreview, {
			pending,
			roomId: 103,
			saving: false,
			onConfirm: () => {},
			onCancel: () => {},
			...extra,
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

test('B1: the room stays choosable inline, so no modal is needed to change it', () => {
	const markup = renderPreview(cleanPlacementInput(), {
		roomOptions: [
			{ value: '103', label: 'Room 103 - G7 Main' },
			{ value: '201', label: 'Room 201 - G7 Main' },
		],
		onRoomChange: () => {},
	});
	assert.match(markup, /data-testid="inline-placement-room-picker"/, 'the room chooser renders inline');
	assert.match(markup, /role="combobox"/, 'the chooser is an inline combobox, not a native select');
	assert.doesNotMatch(markup, /role="dialog"/, 'changing the room opens no modal');
	// A single option is not worth a control: the panel stays short.
	const single = renderPreview(cleanPlacementInput(), {
		roomOptions: [{ value: '103', label: 'Room 103 - G7 Main' }],
		onRoomChange: () => {},
	});
	assert.doesNotMatch(single, /data-testid="inline-placement-room-picker"/);
});

test('B1 source contract: choosing a room re-runs the authoritative preview before the confirm', () => {
	const hook = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(hook, /const changeInlinePlacementRoom = useCallback/);
	assert.match(hook, /const preview = await previewEdit\(nextProposal\)/);
	assert.match(hook, /hardTitle: blockedTitle/, 'a room that blocks the placement disables the confirm');
	assert.match(hook, /roomId: null,[\s\S]{0,200}roomLabel: null/, 'an unresolved room opens the inline chooser, not a dialog');
});

test('B1 source contract: the placement hook routes the confirm decisions inline', () => {
	const hook = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.doesNotMatch(hook, /decision\.kind === 'auto-commit'/, 'the removed auto-commit branch must be gone');
	assert.match(hook, /decision\.kind === 'preview-confirm' \|\| decision\.kind === 'review-soft'/);
	assert.match(hook, /buildInlinePlacementPreviewData\(/);
	assert.match(hook, /const confirmInlinePlacement = useCallback/);
	assert.match(hook, /commitEditWithMeta\(\s*pending\.proposal/, 'the confirm is the only commit path');
});

/* ── C1-c — the room instruction matches what the screen can actually do ──── */

test('C1-c: with more than one teaching space the chooser renders and the step is followable', () => {
	const input = cleanPlacementInput({ roomLabel: null, availableTeachingSpaces: { state: 'ready', count: 2 } });
	const described = describeInlinePlacement(input);
	assert.equal(described.confirmable, false);
	// >1 is the only case where "Choose a room first" names an action the screen
	// offers, so this wording is preserved byte-identically.
	assert.equal(
		described.consequence,
		'ATLAS could not choose a room for this session yet. Choose a room first.',
		'the >1 wording is unchanged',
	);
	const markup = renderPreview(input, {
		roomId: null,
		roomOptions: [
			{ value: '103', label: 'Room 103 - G7 Main' },
			{ value: '201', label: 'Room 201 - G7 Main' },
		],
		onRoomChange: () => {},
	});
	assert.match(markup, /data-testid="inline-placement-room-picker"/, 'the chooser renders when there is a real choice');
	assert.match(markup, /Choose a room first/, 'the rendered consequence matches the rendered control');
	assert.match(markup, /data-testid="inline-placement-confirm"[^>]*disabled/, 'Confirm waits for a room');
});

test('C1-c: with exactly one teaching space the screen never tells the scheduler to choose', () => {
	// The resolver now treats a lone teaching space as the destination, so the
	// placement is confirmable and the copy is the ordinary confirmable one.
	const resolved = cleanPlacementInput({ availableTeachingSpaces: { state: 'ready', count: 1 } });
	const described = describeInlinePlacement(resolved);
	assert.equal(described.confirmable, true, 'a single available space is a resolvable destination, not a choice');
	assert.doesNotMatch(described.consequence, /Choose a room first/, 'no unfollowable instruction');
	assert.match(described.consequence, /Room 103 - G7 Main/, 'the resolved room is named');

	const markup = renderPreview(resolved, {
		roomOptions: [{ value: '103', label: 'Room 103 - G7 Main' }],
		onRoomChange: () => {},
	});
	assert.doesNotMatch(markup, /data-testid="inline-placement-room-picker"/, 'one option is not a chooser');
	assert.doesNotMatch(markup, /Choose a room first/, 'the rendered panel never names an action it does not offer');
	assert.match(markup, /data-confirmable="true"/, 'the step is completable');
	assert.doesNotMatch(markup, /data-testid="inline-placement-confirm"[^>]*disabled/, 'Confirm is enabled');

	// R2 — the defensive copy for a lone space that still did not resolve now
	// states the situation instead of a diagnosis. The pre-R2 assertion
	// (`assert.match(unresolved.consequence, /Room Map \(\/map\)/)`, "the real
	// destination is named") is SUPERSEDED, not deleted: nothing here knows why
	// the one space was not used, so naming Room Map asserted a cause the
	// function cannot know. Its intent — never naming an unfollowable choice —
	// is retained and strengthened by the negative assertion below.
	const unresolved = describeInlinePlacement(cleanPlacementInput({ roomLabel: null, availableTeachingSpaces: { state: 'ready', count: 1 } }));
	assert.equal(unresolved.confirmable, false);
	assert.doesNotMatch(unresolved.consequence, /Choose a room first/);
	assert.doesNotMatch(unresolved.consequence, /could not read/i, 'no unprovable cause is asserted');
	assert.doesNotMatch(unresolved.consequence, /Room Map \(\/map\)/, 'no configuration page is offered for a situation that may not be one');
	assert.match(
		unresolved.consequence,
		/1 teaching space is available and this session is not in it/,
		'the situation is stated, not a diagnosis',
	);
});

test('C1-c: with zero teaching spaces AND a good reference read the copy states the fact and the real destination', () => {
	// R1 — the "no teaching space" claim is only available when reference data
	// is known good, so this row is explicitly the `ready` state. The
	// unread-state counterpart is the R1 row below.
	const input = cleanPlacementInput({ roomLabel: null, availableTeachingSpaces: { state: 'ready', count: 0 } });
	const described = describeInlinePlacement(input);
	assert.equal(described.confirmable, false);
	assert.doesNotMatch(described.consequence, /Choose a room first/, 'there is nothing to choose, so nothing is named as a choice');
	assert.match(described.consequence, /No teaching space is available for this session/, 'the real reason is stated');
	assert.match(described.consequence, /Room Map \(\/map\)/, 'room configuration lives at /map, per the shared blocker resolver');

	const markup = renderPreview(input, { roomId: null, roomOptions: [], onRoomChange: () => {} });
	assert.doesNotMatch(markup, /data-testid="inline-placement-room-picker"/, 'no chooser at zero rooms');
	assert.doesNotMatch(markup, /Choose a room first/, 'the rendered panel never names an action it does not offer');
	assert.match(markup, /No teaching space is available for this session/, 'the rendered consequence is honest');
	assert.match(markup, /Room Map \(\/map\)/, 'the rendered consequence names the real configuration page');
	assert.match(markup, /data-testid="inline-placement-confirm"[^>]*disabled/, 'Confirm stays disabled because the step is not completable');
});

/* ── C1-c R1 — the zero-room claim needs a provable reference read ────────── */

test('C1-c R1: an unread reference read never claims that no teaching space exists', () => {
	// The real degraded path: `runTimetableLoad` swallows a reference-data
	// failure so the grid stays usable, which leaves the room map EMPTY. An
	// empty map is therefore not evidence that the school configured nothing.
	const input = cleanPlacementInput({ roomLabel: null, availableTeachingSpaces: { state: 'unread' } });
	const described = describeInlinePlacement(input);
	assert.equal(described.confirmable, false, 'nothing becomes confirmable when the read is unknown');
	assert.doesNotMatch(described.consequence, /No teaching space is available/, 'no claim that none are configured');
	assert.doesNotMatch(described.consequence, /Room Map \(\/map\)/, 'no routing to a configuration page for a problem that may not exist');
	assert.doesNotMatch(described.consequence, /Choose a room first/, 'no unfollowable instruction when no chooser renders');
	assert.match(described.consequence, /could not read the teaching spaces/, 'the uncertainty itself is named');

	// RENDERED, not source-matched: the panel must show the hedged copy, must
	// not show the zero-room claim, and must not enable Confirm.
	const markup = renderPreview(input, { roomId: null, roomOptions: [], onRoomChange: () => {} });
	assert.match(markup, /could not read the teaching spaces/, 'the rendered panel states the uncertainty');
	assert.match(markup, /Refresh the school names/, 'the remedy the screen really offers is named');
	assert.doesNotMatch(markup, /No teaching space is available/, 'the rendered panel makes no false claim');
	assert.doesNotMatch(markup, /Room Map/, 'the rendered panel does not send the scheduler to /map');
	assert.doesNotMatch(markup, /Choose a room first/, 'the rendered panel names no action it does not offer');
	assert.doesNotMatch(markup, /data-testid="inline-placement-room-picker"/, 'no chooser can render with an unread list');
	assert.match(markup, /data-confirmable="false"/, 'the rendered panel is not confirmable');
	assert.match(markup, /data-testid="inline-placement-confirm"[^>]*disabled/, 'Confirm is not enabled in the unknown state');
});

test('C1-c R1: the zero-room claim and its converse are gated on the same rendered evidence', () => {
	// Converse of the row above, on the identical rendered panel: with reference
	// data known good and 0 spaces, the plain claim DOES render. The two rows
	// together make the discriminator load-bearing — neither copy can be reached
	// from the other state.
	const unread = renderPreview(cleanPlacementInput({ roomLabel: null, availableTeachingSpaces: { state: 'unread' } }), { roomId: null, roomOptions: [] });
	const noneConfigured = renderPreview(cleanPlacementInput({ roomLabel: null, availableTeachingSpaces: { state: 'ready', count: 0 } }), { roomId: null, roomOptions: [] });
	assert.doesNotMatch(unread, /No teaching space is available/, 'the unread state renders no zero-room claim');
	assert.match(noneConfigured, /No teaching space is available/, 'the ready/0 state renders the zero-room claim');
	assert.doesNotMatch(noneConfigured, /could not read the teaching spaces/, 'the ready state does not hedge a fact it can prove');
	// `unknown` (a caller with no discriminator) is also not a licence to claim.
	const unknown = describeInlinePlacement(cleanPlacementInput({ roomLabel: null, availableTeachingSpaces: { state: 'unknown' } }));
	assert.doesNotMatch(unknown.consequence, /No teaching space is available/);
	assert.doesNotMatch(unknown.consequence, /Room Map/);
	assert.equal(unknown.confirmable, false);
});

test('C1-c: the confirmable and blocked copy is byte-identical to before the correction', () => {
	// The >1 room choice and both confirmable outcomes must not drift.
	assert.equal(
		describeInlinePlacement(cleanPlacementInput({ availableTeachingSpaces: { state: 'ready', count: 3 } })).consequence,
		'Confirm to place TLE · G7AW · session 1 in MONDAY 11:30–12:15 · Room 103 - G7 Main. No conflicts were found, so nothing changes until you confirm.',
	);
	assert.equal(
		describeInlinePlacement(cleanPlacementInput({ softCount: 2, availableTeachingSpaces: { state: 'ready', count: 3 } })).consequence,
		'Confirm to place TLE · G7AW · session 1 in MONDAY 11:30–12:15 · Room 103 - G7 Main. 2 soft warnings will be acknowledged.',
	);
	assert.equal(
		describeInlinePlacement(cleanPlacementInput({ hardTitle: 'Room already in use', availableTeachingSpaces: { state: 'ready', count: 3 } })).consequence,
		'This slot is blocked: Room already in use. Choose another slot.',
	);
	// An unknown read state keeps the pre-existing wording rather than guessing.
	assert.equal(
		describeInlinePlacement(cleanPlacementInput({ roomLabel: null })).consequence,
		'ATLAS could not choose a room for this session yet. Choose a room first.',
	);
	// A partial (`needs-refresh`) or still-loading reference read is `unread`,
	// never `ready`, so the hook cannot reach the zero-room claim through it.
	assert.equal(
		describeInlinePlacement(cleanPlacementInput({ roomLabel: null, availableTeachingSpaces: { state: 'unread' } })).consequence,
		'ATLAS could not read the teaching spaces for this session, so it cannot place it yet. Refresh the school names, then place it again.',
	);
});

test('C1-c structural guard: a lone teaching space is the destination, not a dead end', () => {
	// The resolver lives inside the workspace hook and has no unit seam, so this
	// is a STRUCTURAL guard on the fallback, not a behavioural one. The rendered
	// rows above are the behavioural control; this row exists so the fallback
	// cannot be silently deleted while they still pass.
	const hook = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(hook, /if \(teachingSpaces\.length === 1\) return teachingSpaces\[0\]\.id;/, 'one teaching space resolves to that space');
	// R1 — the count is attached only behind a known-good reference read, so a
	// swallowed reference-data failure cannot masquerade as "none configured".
	assert.match(
		hook,
		/referenceLookupStatus\.state === 'ready'\s*\?\s*\{ state: 'ready', count: inlinePlacementRoomOptions\.length \}\s*:\s*\{ state: 'unread' \}/,
		'a count is believed only when the reference read is known good',
	);
	assert.match(hook, /availableTeachingSpaces: inlinePlacementTeachingSpaces/, 'the consequence reads the same canonical list the chooser renders from, with its provenance');
	// The chooser still renders only when there is a real choice.
	assert.match(source('src/components/timetable/InlinePlacementPreview.tsx'), /const canChooseRoom = Boolean\(onRoomChange\) && roomOptions\.length > 1;/);
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
	assert.ok(header.split('\n').length <= 1000, 'the header must stay inside the 1000-physical-line component cap (AGENTS.md §8)');
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
	for (const key of ['schedule', 'draft', 'setup', 'policies', 'runs']) {
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
		// Measured with `performance`-equivalent transport accounting (each
		// `atlasApi.get` dispatch is recorded): the cold trip issues the runs
		// list, the draft, the violations report, the draft board, subjects,
		// faculty, buildings and the section summary — 8 dispatches, each exactly
		// once (the run bundle's two reads and the reference pool's four reads
		// are already issued in parallel, never repeated).
		const firstTrip = calls.length;
		assert.equal(firstTrip, 8, `the cold trip must issue 8 dispatches (observed ${firstTrip})`);
		assert.equal(new Set(calls).size, firstTrip, 'the cold trip already issues each endpoint once, never twice');

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

/*
 * B5: the 1000-physical-line component cap is a repo-wide invariant.
 *
 * This row used to walk a hardcoded list of the ~20 components one historical
 * range happened to touch, which left the other 216 non-test `.tsx` files
 * unguarded — `ManualEditPanel.tsx` reached 1012 physical lines unnoticed. It
 * now enumerates the real filesystem at test time, so a newly added component
 * is covered the moment it lands and a second hardcoded list cannot rot.
 */

const CAP = 1000;

/** Every non-test `.tsx` under `atlas-client/src`, discovered on disk. */
function nonTestComponentFiles(dir: string, found: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = resolve(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === '__tests__') continue;
			nonTestComponentFiles(full, found);
			continue;
		}
		if (!entry.name.endsWith('.tsx')) continue;
		if (/\.test\.tsx?$/.test(entry.name)) continue;
		found.push(full);
	}
	return found;
}

test('B5 cap guard: no non-test component anywhere under src exceeds the 1000-physical-line cap', () => {
	const files = nonTestComponentFiles(resolve(clientRoot, 'src'));
	// A scan that silently matched nothing would pass vacuously; require the
	// real inventory so a broken walker is a failure, not a green row.
	assert.ok(files.length > 200, `expected the real component inventory, found only ${files.length} files`);

	const violations: string[] = [];
	for (const path of files) {
		const text = readFileSync(path, 'utf8');
		// `physical` is the AGENTS.md section 8 measure: a newline-terminated
		// file's line count, with blank lines and comments included. The cap is
		// 1000 physical lines, so 1000 is legal and 1001 is not.
		const physical = text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length;
		// `rawSplit` is the stricter raw `readFileSync(...).split('\n').length`
		// count: it treats the trailing newline as an extra element, so for a
		// newline-terminated file it equals `physical + 1`. The equivalent bound
		// is therefore 1001, not 1000 — asserting 1000 here would enforce 999
		// physical lines, which is stricter than the directive and fails
		// `TimetableGrid.tsx` at exactly 1000 physical lines.
		const rawSplit = text.split('\n').length;
		if (physical > CAP || rawSplit > CAP + 1) {
			violations.push(
				`${path.slice(clientRoot.length + 1).replace(/\\/g, '/')}: ${physical} physical lines, ${rawSplit} by split('\\n') (cap ${CAP} physical; AGENTS.md section 8)`,
			);
		}
	}
	assert.deepEqual(violations, [], `components over the ${CAP}-physical-line cap:\n${violations.join('\n')}`);
});

after(() => {
	timetableQueryClient.clear();
});
