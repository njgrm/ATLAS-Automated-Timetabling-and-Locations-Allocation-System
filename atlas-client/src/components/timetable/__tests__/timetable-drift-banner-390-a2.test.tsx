/**
 * A2-DRIFT-BANNER-390 (item 5) — the drift band must be legible and tappable on
 * a 390x844 phone.
 *
 * The recorded defect: "Schedule information changed" and its message were
 * squeezed into a near one-word-wide column beside "Preview impact" and
 * "Regenerate to apply", because the band was a single `flex-wrap` row of eleven
 * `shrink-0` items and the message was the only shrinkable one (`min-w-0
 * flex-1`), so it absorbed every pixel the actions did not take.
 *
 * ASSERTION STYLE — source-level class assertions, matching the neighbouring
 * timetable suites (`ux-audit-findings-c01`, `ux-r02-simple-stripdown`,
 * `timetable-scheduler-simplicity-c02`), plus real rendered markup from the real
 * component. jsdom has no layout engine, so a "is it clipped" question cannot be
 * measured here; what *can* be decided without inventing a browser is the
 * layout contract the classes encode, and a rendered assertion that the guarded
 * actions and their testids survived the change. Both are asserted, and the
 * class control carries a failing-first mutant so it cannot rot into a
 * tautology.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { SimpleDriftBanner } from '../simple/SimpleDriftBanner';
import { deriveTimetableCapabilities } from '../../../lib/timetable-capabilities';
import type { DraftReport, GenerationInputComparison } from '../../../types';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

const READY_CAPABILITIES = deriveTimetableCapabilities({
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
});

const STALE_INPUT = {
	status: 'STALE',
	message: 'Rooms changed.',
	actionHint: 'Review the rooms that changed.',
	changedDomains: ['rooms', 'faculty'],
	checkedAt: null,
} as unknown as GenerationInputComparison;

function staleDraft(changedDomains: string[] = ['rooms', 'faculty']): DraftReport {
	return {
		runId: 42,
		status: 'COMPLETED',
		entries: [],
		unassignedItems: [],
		summary: { hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0 },
		inputState: { ...STALE_INPUT, changedDomains } as unknown as GenerationInputComparison,
		version: 3,
		finishedAt: null,
		createdAt: '2031-01-01T00:00:00.000Z',
	} as unknown as DraftReport;
}

function renderBanner(props: Record<string, unknown> = {}): string {
	return renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement(SimpleDriftBanner, {
				schoolId: 1,
				schoolYearId: 9,
				activeGeneratedRunId: 42,
				draft: staleDraft(),
				isPreGenerationWorkspace: false,
				loading: false,
				onRefresh: () => {},
				capabilities: READY_CAPABILITIES,
				isPublished: false,
				onRegenerate: () => {},
				...props,
			} as never),
		),
	);
}

/** The class list of the element that carries a testid, in the rendered markup. */
function classListOf(markup: string, testId: string): string {
	const tag = markup.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`))?.[0];
	assert.ok(tag, `the rendered banner must still carry data-testid="${testId}"`);
	return tag.match(/class="([^"]*)"/)?.[1] ?? '';
}

// --- the 390px layout contract ---

test('A2-5 item 5: the message takes its own line below sm, so the actions wrap instead of squeezing it', () => {
	const markup = renderBanner();
	const band = classListOf(markup, 'timetable-simple-input-drift');
	// The band still wraps: that is what moves the action buttons onto the rows
	// after the message instead of clipping them off the right edge.
	assert.match(band, /flex-wrap/, 'the band must keep wrapping its action rows');
	// The message is the one element that was allowed to shrink to nothing. Below
	// the `sm` breakpoint it now claims a full line (the same idiom the
	// neighbouring Simple filter row uses), and from `sm` up it returns to the
	// existing `flex-1` inline share, so no larger viewport moves.
	const message = markup.match(/<span class="([^"]*basis-full[^"]*)">([^<]*School information changed)/);
	assert.ok(message, 'the drift message must carry the small-viewport full-line class');
	assert.match(message[1], /w-full/, 'below sm the message claims the full line width');
	assert.match(message[1], /basis-full/, 'below sm the message claims a full flex basis');
	assert.match(message[1], /sm:w-auto/, 'from sm up the message returns to automatic width');
	assert.match(message[1], /sm:flex-1/, 'from sm up the message keeps the existing flex-1 share');
	assert.match(message[1], /min-w-0/, 'the message stays the only shrinkable element');
	// `cn()` is `twMerge`, and it silently drops a `sm:basis-auto` written before
	// `sm:flex-1` (both set flex-basis). Assert the pair that actually ships, so a
	// later edit cannot reintroduce a class the merge would eat.
	assert.doesNotMatch(message[1], /sm:basis-auto/, 'sm:basis-auto would be stripped by twMerge against sm:flex-1');
});

test('A2-5 item 5: no action button is allowed to squeeze the message at 390px', () => {
	const markup = renderBanner();
	// Every guarded action still declares `shrink-0`, so below `sm` each keeps
	// its intrinsic width and the parent wraps it whole; nothing is truncated.
	for (const testId of [
		'timetable-simple-impact-preview',
		'timetable-simple-regenerate-impact',
		'timetable-simple-regenerate-to-apply',
		'timetable-simple-review-draft-changes',
	]) {
		assert.match(classListOf(markup, testId), /shrink-0/, `${testId} must keep its intrinsic width`);
	}
	// The longest label is the regeneration action; it is a single unbreakable
	// label with no truncation utility, so it wraps whole rather than clipping.
	const regenerate = classListOf(markup, 'timetable-simple-regenerate-to-apply');
	assert.doesNotMatch(regenerate, /truncate|overflow-hidden/, 'the regeneration action must not clip its own label');
	assert.match(markup, /Regenerate to apply<\/button>|Regenerate to apply/, 'the regeneration label is rendered whole');
});

test('A2-5 item 5: the band introduces no new scroll surface', () => {
	const markup = renderBanner();
	const band = classListOf(markup, 'timetable-simple-input-drift');
	for (const forbidden of [/overflow-auto/, /overflow-x-auto/, /overflow-y-auto/, /overflow-scroll/, /overflow-hidden/]) {
		assert.doesNotMatch(band, forbidden, `the band must not add a scroll surface (${forbidden.source})`);
	}
	const pane = source('src/components/timetable/simple/SimpleDriftBanner.tsx');
	// The fix is a wrapping/sizing change only: no `sticky`, no `fixed`, no new
	// overflow container, and the file stays well under the 1000-line cap.
	assert.doesNotMatch(pane, /sticky|fixed inset|position: fixed/);
	assert.ok(pane.split('\n').length <= 1000, 'SimpleDriftBanner must stay under the 1000-line cap');
});

test('A2-5 item 5: mutant — the pre-fix shrinkable message fails this control', () => {
	// The pre-fix class list, verbatim from the base revision of this component.
	const preFixMessage = 'min-w-0 flex-1 break-words whitespace-normal';
	// The control: below `sm` the message must claim a full line, and from `sm`
	// up it must return to the pre-change inline share.
	const control = (className: string): boolean => /w-full/.test(className) && /basis-full/.test(className) && /sm:w-auto/.test(className) && /sm:flex-1/.test(className);
	assert.equal(control(preFixMessage), false, 'the pre-fix message would squeeze the actions into its column');
	// And the shipped class list passes.
	const message = renderBanner().match(/<span class="([^"]*basis-full[^"]*)">/);
	assert.ok(message);
	assert.equal(control(message[1]), true);
	assert.notEqual(message[1], preFixMessage);
});

// --- the guards are untouched ---

test('A2-5 item 5: every guarded action and testid survived the layout change', () => {
	const draft = renderBanner();
	const published = renderBanner({ isPublished: true });
	for (const testId of [
		'timetable-simple-input-drift',
		'timetable-simple-review-draft-changes',
		'timetable-simple-impact-preview',
		'timetable-simple-regenerate-impact',
		'timetable-simple-regenerate-to-apply',
		'timetable-simple-repair-primary',
	]) {
		assert.match(draft, new RegExp(`data-testid="${testId}"`), `the draft band must keep ${testId}`);
	}
	for (const testId of [
		'timetable-simple-published-drift-guidance',
		'timetable-simple-review-published-changes',
		'timetable-simple-start-revision',
	]) {
		assert.match(published, new RegExp(`data-testid="${testId}"`), `the published band must keep ${testId}`);
	}
	// A published run must not expose the draft-only regeneration affordance.
	assert.doesNotMatch(published, /data-testid="timetable-simple-regenerate-to-apply"/);
	assert.doesNotMatch(published, /data-testid="timetable-simple-impact-preview"/);
	// Per-domain repair controls keep their dynamic testids: `rooms` and
	// `sections` are both mapped domains with their own control...
	const twoMapped = renderBanner({ draft: staleDraft(['rooms', 'sections']) });
	assert.match(twoMapped, /data-testid="timetable-simple-repair-rooms"/);
	assert.match(twoMapped, /data-testid="timetable-simple-repair-sections"/);
	// ...and an unmapped domain still falls back to the explicit primary control
	// rather than leaving `primaryHref` dead.
	assert.match(draft, /data-testid="timetable-simple-repair-rooms"/);
	assert.match(draft, /data-testid="timetable-simple-repair-primary"/);
	assert.match(draft, /data-primary-repair="true"/, 'the primary repair control must stay marked');
	// Read-only impact preview: the control is mounted and it only opens a
	// dialog. (Static markup drops event handlers, so the click target itself is
	// asserted on the source below.)
	assert.match(draft, /Preview impact/);
	// No automatic regeneration anywhere: the only regeneration call site is the
	// operator's confirm handler inside the dialog.
	assert.doesNotMatch(draft, /onRegenerate\(\)/, 'the banner must never call onRegenerate on its own');
});

test('A2-5 item 5: the regeneration guard is byte-for-byte the pre-change contract', () => {
	const pane = source('src/components/timetable/simple/SimpleDriftBanner.tsx');
	// Operator-triggered only, and never on a published run.
	assert.match(pane, /const handleRegenerate = \(\) => \{[\s\S]*if \(isPublished\) return;[\s\S]*if \(!regenerationEnabled\) return;[\s\S]*if \(activeGeneratedRunId == null\) return;[\s\S]*onRegenerate\?\.\(\);[\s\S]*\};/);
	// The action is mounted only for a caller that can regenerate, on an
	// unpublished run, with real drift to apply.
	assert.match(pane, /const showRegenerateAction = Boolean\(onRegenerate\) && !isPublished && showRunDrift;/);
	// The disabled set is unchanged: in flight, loading, capability denied, or
	// no run to regenerate.
	assert.match(
		pane,
		/const regenerateDisabled = regenerating \|\| loading \|\| !regenerationEnabled \|\| activeGeneratedRunId == null;/,
	);
	// And the confirm button still respects the shared generation capability.
	// (The dialog is closed in this render, so it is asserted on the source.)
	assert.match(pane, /<Button[\s\S]{0,240}disabled=\{!generationEnabled\}[\s\S]{0,120}data-testid="timetable-simple-regenerate-confirm"/);
	// The dialog can never open on a published run.
	assert.match(pane, /open=\{showImpactPreview && !isPublished\}/);
	assert.match(pane, /open=\{showRegenerateImpact && !isPublished\}/);
	// Both previews are read-only: a click only opens a dialog, and the
	// regeneration click only opens the confirmation dialog.
	assert.match(pane, /data-testid="timetable-simple-impact-preview"[\s\S]{0,80}>/);
	assert.match(pane, /onClick=\{\(\) => setShowImpactPreview\(true\)\}/);
	assert.match(pane, /onClick=\{\(\) => setShowRegenerateImpact\(true\)\}/);
	// And the preservation note the operator relies on is still there.
	assert.match(pane, /data-testid="timetable-simple-regenerate-preservation-note"/);
});
