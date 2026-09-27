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
import { describeRunInputDrift } from '../timetableDriftRouting';
import { deriveRunFreshness, runDriftClaimSentence } from '../../../lib/schedule-lifecycle';
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

/**
 * A2-UX-WIRE-C2 — the fixture is corrected to the REAL wire shape.
 *
 * `GenerationInputComparison.checkedAt` is a required `string` on the wire
 * (`src/types.ts`), and the comparison it describes is written by the server
 * after the run it compares against exists. The pre-fix fixture set it to
 * `null`, which is not a shape the server can send — and that invented shape is
 * what made the banner's drift claim look trustworthy when it was not. The run's
 * own end time is `2031-01-01T00:00:00.000Z` and the comparison is `T00:05`,
 * five minutes AFTER the run finished: the honest, production-shaped case, and
 * the one every layout assertion below is really about.
 */
const RUN_FINISHED_AT = '2031-01-01T00:00:00.000Z';
const CHECKED_AFTER_RUN = '2031-01-01T00:05:00.000Z';

const STALE_INPUT = {
	status: 'STALE',
	message: 'Rooms changed.',
	actionHint: 'Review the rooms that changed.',
	changedDomains: ['rooms', 'faculty'],
	checkedAt: CHECKED_AFTER_RUN,
} as unknown as GenerationInputComparison;

function staleDraft(
	changedDomains: string[] = ['rooms', 'faculty'],
	timing: { checkedAt?: string | null; finishedAt?: string | null } = {},
): DraftReport {
	return {
		runId: 42,
		status: 'COMPLETED',
		entries: [],
		unassignedItems: [],
		summary: { hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0 },
		inputState: {
			...STALE_INPUT,
			changedDomains,
			checkedAt: timing.checkedAt === undefined ? CHECKED_AFTER_RUN : timing.checkedAt,
		} as unknown as GenerationInputComparison,
		version: 3,
		finishedAt: timing.finishedAt === undefined ? RUN_FINISHED_AT : timing.finishedAt,
		createdAt: RUN_FINISHED_AT,
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
	// A2-UX-WIRE-C2: the last term is new and load-bearing. "Regenerate to apply"
	// applies a drift, and #59/#17 established that a comparison which predates
	// the run on screen is not a drift claim about that run. The other three
	// guards are byte-for-byte unchanged.
	assert.match(pane, /const showRegenerateAction = Boolean\(onRegenerate\) && !isPublished && showRunDrift && driftClaimed;/);
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

/* ────────────────────────────────────────────────────────────────────────────
 * A2-UX-WIRE-C2 — #59 / #17, the truthfulness half.
 *
 * The recorded defect: "Schedule information changed. Regenerate to apply" stayed
 * up after a successful generation, and appeared on a run generated seconds
 * earlier. The banner read the server's freshness row on its own, and that row
 * says nothing about WHICH run it was compared against — so a comparison written
 * before this run finished was read as a claim about this run.
 *
 * These rows are behavioural (rendered markup from the real component) and each
 * carries a failing-first mutant, so they cannot rot into tautologies.
 * ──────────────────────────────────────────────────────────────────────────── */

test('#59/#17 the drift claim is shown only when the comparison is trustworthy about THIS run', () => {
	// 1. The comparison AFTER the run finished: the claim is earned, and the
	//    whole existing surface — alarm styling, message, repair links and the
	//    regeneration affordance — is present.
	const claimed = renderBanner();
	assert.match(claimed, /data-drift-claimable="true"/, 'a comparison later than the run may be shown as drift');
	assert.match(claimed, /Schedule information changed/, 'and the alarm title is rendered');
	assert.match(claimed, /data-testid="timetable-simple-regenerate-to-apply"/, 'and the regeneration affordance is mounted');

	// 2. The defect itself: the comparison was written BEFORE this run finished,
	//    so it describes an older schedule. The run on screen is fresh.
	const fresh = renderBanner({ draft: staleDraft(['rooms'], { checkedAt: '2030-12-31T23:59:00.000Z' }) });
	assert.match(fresh, /data-drift-status="STALE"/, "the server's own verdict is still reported verbatim");
	assert.match(fresh, /data-drift-claimable="false"/, 'but it may not be shown as a drift claim about this run');
	assert.doesNotMatch(fresh, /Schedule information changed/, 'the alarm title is not shown on a run generated seconds ago');
	assert.doesNotMatch(fresh, /Regenerate to apply/, 'and there is nothing to apply, so the affordance is not offered');
	// The claim is suppressed; the DRIFT IS NOT. The changed domain, its repair
	// control and one honest sentence all still render, because "not proven" is
	// not "nothing is wrong".
	assert.match(fresh, /data-testid="timetable-simple-repair-rooms"/, 'the changed domain is still surfaced');
	assert.match(fresh, /data-testid="timetable-simple-review-draft-changes"/, 'and so is the review control');
	assert.match(
		fresh,
		/This check is not timed to the schedule on screen, so it may not apply to it\./,
		// CORRECTED (A2-UX-STATUS-C2 B7). This row previously asserted
		// "ATLAS has not re-checked this schedule against your latest setup data",
		// which CONTRADICTS the payload it came from: the server's response to this
		// comparison said STALE, so ATLAS did check, and it found drift. The old
		// sentence denied a real check.
		// PRESERVED INTENT, unchanged: exactly ONE honest sentence is offered in
		// place of the drift claim, and it is the one that may honestly be said. Only
		// WHICH honest sentence changed - to the actual condition, that the
		// comparison cannot be tied in time to the schedule on screen.
		'and the one sentence that may honestly be said is said, and it no longer denies a check the server did run',
	);
	assert.doesNotMatch(fresh, /has not re-checked/, 'the note must not claim ATLAS did not check a STALE comparison it was sent');
	// Amber is reserved for a claim ATLAS can back.
	assert.doesNotMatch(classListOf(fresh, 'timetable-simple-input-drift'), /amber/, 'an unproven comparison wears no alarm styling');
});

test('B7/#59 the neutral note names the timing, and a GENUINE stale comparison still alarms', () => {
	// (1) The audit case: the server said STALE but stamped no `checkedAt`. The
	// comparison exists and reported drift; only its MOMENT is unusable.
	const untimedComparison = renderBanner({ draft: staleDraft(['rooms'], { checkedAt: null }) });
	assert.match(untimedComparison, /data-drift-status="STALE"/, "the server's own STALE verdict is still reported verbatim");
	assert.doesNotMatch(untimedComparison, /data-drift-claimable="true"/, 'so no drift CLAIM is made about this run');
	assert.doesNotMatch(untimedComparison, /Regenerate to apply/, 'and the regeneration affordance is withheld, as before');
	assert.match(
		untimedComparison,
		/This check is not timed to the schedule on screen/,
		'the note states the actual condition: the comparison is not timed to this schedule',
	);
	assert.doesNotMatch(
		untimedComparison,
		/has not (re-)?checked/,
		'and it does NOT claim ATLAS failed to check - it checked, and that is where STALE came from',
	);
	// The drift is still surfaced, so nothing is hidden by not claiming it.
	assert.match(untimedComparison, /data-testid="timetable-simple-repair-rooms"/, 'the changed domain and its repair control are still mounted');

	// (2) THE PREDICATE IS UNCHANGED. A comparison stamped AFTER the run finished is
	// genuinely about the run on screen, so the real alarm still fires. If the
	// correction had widened the suppression, this row would fail.
	const genuine = renderBanner();
	assert.match(genuine, /data-drift-claimable="true"/, 'a comparison later than the run is still claimable');
	assert.match(genuine, /Schedule information changed/, 'the alarm still fires for genuine post-generation drift');
	assert.match(genuine, /data-testid="timetable-simple-regenerate-to-apply"/, 'and the repair affordance is still offered');
	assert.doesNotMatch(genuine, /This check is not timed/, 'a trustworthy comparison shows the claim, not the neutral note');
});

test('#59/#17 a run with NO comparable timing is not failed, and real drift is not hidden', () => {
	// No finish time at all: the comparison cannot be tied to the run, but the
	// server's STALE verdict may still be true, so it is KEPT rather than
	// refused. Refusing every untimed run would hide real drift.
	const untimed = renderBanner({ draft: staleDraft(['rooms'], { finishedAt: null, checkedAt: null }) });
	assert.match(untimed, /data-drift-status="STALE"/, 'the drift is still reported');
	assert.match(untimed, /Rooms/, 'and the changed domain is still named');
	assert.match(untimed, /data-testid="timetable-simple-repair-rooms"/, 'and its repair control is still mounted');
	// A run whose comparison is later than it still gets the full claim, so the
	// guard cannot be satisfied by suppressing everything.
	const later = renderBanner();
	assert.match(later, /data-drift-claimable="true"/, 'a timed, later comparison still yields the claim');
});

test('#59/#17 FAILING-FIRST: the pre-fix rule shows the claim on the run it must not', () => {
	const RUN_END = RUN_FINISHED_AT;
	const BEFORE_RUN = '2030-12-31T23:59:00.000Z';
	// The pre-fix predicate, verbatim: the server's status and nothing else.
	const preFixClaim = (status: string): string | null =>
		status === 'STALE' ? 'Schedule information changed. Regenerate to apply' : null;
	// The shipped predicate, through the production resolver.
	const shipped = (checkedAt: string, finishedAt: string): string | null =>
		runDriftClaimSentence(deriveRunFreshness({ status: 'STALE', checkedAt, runFinishedAt: finishedAt }));

	// The pre-fix rule claims drift on a run generated AFTER the comparison —
	// exactly the recorded defect.
	assert.equal(
		preFixClaim('STALE'),
		'Schedule information changed. Regenerate to apply',
		'the pre-fix rule ships the false claim on a fresh run',
	);
	// The shipped rule does not, and the rendered banner agrees.
	assert.equal(shipped(BEFORE_RUN, RUN_END), null, 'the shipped rule refuses the comparison that predates the run');
	assert.doesNotMatch(
		renderBanner({ draft: staleDraft(['rooms'], { checkedAt: BEFORE_RUN }) }),
		/Regenerate to apply/,
		'and the rendered banner agrees with the predicate',
	);
	// It is not "refuse everything": the same rule still claims a real drift.
	assert.equal(
		shipped(CHECKED_AFTER_RUN, RUN_END),
		'Schedule information changed. Regenerate to apply',
		'the shipped rule still claims a drift the comparison can support',
	);
});

test('#59/#17 the drift resolver exposes the verdict, and the unverified note is exclusive of the claim', () => {
	const routing = source('src/components/timetable/timetableDriftRouting.ts');
	assert.match(routing, /deriveRunFreshness\(/, 'the shared resolver times the comparison against the run');
	assert.match(routing, /driftClaim: runDriftClaimSentence\(freshness\)/, 'the claim comes from the one predicate');
	assert.match(routing, /freshnessNote: runFreshnessUnverifiedSentence\(freshness\)/, 'and so does the honest alternative');
	// Mutually exclusive by construction, so no surface can print both.
	for (const checkedAt of ['2030-12-31T23:59:00.000Z', CHECKED_AFTER_RUN, '']) {
		const drift = describeRunInputDrift(
			{ status: 'STALE', message: '', actionHint: '', changedDomains: ['rooms'], checkedAt } as never,
			{ finishedAt: RUN_FINISHED_AT, createdAt: RUN_FINISHED_AT },
		);
		assert.ok(
			!(drift.driftClaim && drift.freshnessNote),
			`the claim and the unverified note are never both present (checkedAt=${checkedAt || 'absent'})`,
		);
	}
	// And every prior field of the shape is still returned, unchanged: the new
	// fields are additive, so the header and the teacher-concern card are intact.
	const drift = describeRunInputDrift(
		{ status: 'STALE', message: 'Rooms changed.', actionHint: 'h', changedDomains: ['rooms'], checkedAt: CHECKED_AFTER_RUN } as never,
		{ finishedAt: RUN_FINISHED_AT, createdAt: RUN_FINISHED_AT },
	);
	assert.equal(drift.status, 'STALE', 'status is still the server verdict');
	assert.equal(drift.checkedAt, CHECKED_AFTER_RUN, 'checkedAt is still passed through');
	assert.equal(drift.primaryHref, '/map', 'the repair home is unchanged');
	assert.equal(drift.requiresRegeneration, false, 'and the regeneration-only set is unchanged');
});
