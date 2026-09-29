import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { deriveSimpleLifecycleAction } from '../simple-timetable-state';
import { isHomeroomGuidanceCode, placementSaveAvailability } from '../timetable-ttc02-insertion';
import { deriveSimplePublishReadiness } from '../../components/timetable/simplePublishReadiness';
import { buildBlockerGroups } from '../../components/timetable/simple/SimpleTaskDrawerHelpers';
import { readinessLabel } from '../../components/timetable/simple/SimpleHeaderHelpers';
import { CLASS_SCHEDULE_LABEL } from '../class-schedule-naming';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function headerContext(overrides: Record<string, unknown> = {}) {
	// C04/F2: readiness copy reads the allowlist-filtered blocking count; default
	// it to the total so existing fixtures keep their meaning unless overridden.
	const hardCount = typeof overrides.hardCount === 'number' ? overrides.hardCount : 0;
	return {
		schoolYearContext: { activeSchoolYearLabel: 'SY 2029-2030' },
		isPreGenerationWorkspace: false,
		draft: null,
		summary: null,
		hardCount,
		blockingHardCount: hardCount,
		softCount: 0,
		...overrides,
	} as unknown as Parameters<typeof readinessLabel>[0];
}

function generatedDraft(overrides: Record<string, unknown> = {}) {
	return {
		runId: 7,
		unassignedItems: [],
		summary: {},
		...overrides,
	};
}

const label = (prefix: string) => (id: number) => `${prefix} ${id}`;

// --- TT-C04 unified operator lifecycle: exactly one primary next action ---

test('lifecycle legacy matrix is preserved when new inputs are omitted', () => {
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: false }).kind, 'start-draft');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: false, generating: true }).kind, 'generating');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: false, isPreGeneration: true }).kind, 'generate');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true, hardCount: 2 }).kind, 'fix-blockers');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true, unassignedCount: 3 }).kind, 'fix-blockers');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true, softCount: 1 }).kind, 'review-warnings');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true }).kind, 'publish');
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: true, isPublished: true }).kind, 'published');
	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: true, isPublished: true, unassignedCount: 2 }).kind,
		'review-follow-ups',
	);
});

test('lifecycle unresolved scope is non-interactive and wins over everything', () => {
	const action = deriveSimpleLifecycleAction({ hasGeneratedRun: false, scopeResolved: false });
	assert.equal(action.kind, 'resolve-scope');
	assert.equal(action.disabled, true);
	assert.equal(action.interactive, false);

	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: true, generating: true, scopeResolved: false }).kind,
		'resolve-scope',
	);
	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: true, hardCount: 5, scopeResolved: false }).kind,
		'resolve-scope',
	);
});

test('lifecycle blocked setup routes to repair, never generation or publish', () => {
	const action = deriveSimpleLifecycleAction({ hasGeneratedRun: false, curriculumState: 'blocked' });
	assert.equal(action.kind, 'fix-setup');
	assert.equal(action.label, 'Open Year Setup');
	assert.equal(action.interactive, true);

	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: true, hardCount: 4, unassignedCount: 9, curriculumState: 'blocked' }).kind,
		'fix-setup',
	);
	// An in-flight generation keeps its own state; setup repair resumes after it.
	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: false, generating: true, curriculumState: 'blocked' }).kind,
		'generating',
	);
});

test('lifecycle failed newest run with no reviewable run offers retry, never publish', () => {
	const action = deriveSimpleLifecycleAction({ hasGeneratedRun: false, latestRunFailed: true });
	assert.equal(action.kind, 'retry-generate');
	assert.equal(action.interactive, true);

	// Negative: a failed flag must not hijack a reviewable generated run.
	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: true, latestRunFailed: true, hardCount: 1 }).kind,
		'fix-blockers',
	);
	assert.equal(
		deriveSimpleLifecycleAction({ hasGeneratedRun: true, latestRunFailed: true }).kind,
		'publish',
	);
});

test('lifecycle fails closed while readiness is unresolved or unavailable', () => {
	const checking = deriveSimpleLifecycleAction({ hasGeneratedRun: false, curriculumState: 'loading' });
	assert.equal(checking.kind, 'retry-readiness');
	assert.equal(checking.label, 'Checking schedule information…');
	assert.equal(checking.disabled, true);
	assert.equal(checking.interactive, false);

	for (const curriculumState of ['unavailable', 'failed'] as const) {
		const retry = deriveSimpleLifecycleAction({ hasGeneratedRun: false, curriculumState });
		assert.equal(retry.kind, 'retry-readiness');
		assert.equal(retry.label, 'Retry schedule check');
		assert.equal(retry.disabled, false);
		assert.equal(retry.interactive, true);
	}
});

test('production header mounts the lifecycle-derived primary cluster and the visible gated Generate control', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	// A3 — one action cluster. The primary identifies the same sole action in
	// each of its four conditional render forms (in-place retry, external
	// fix-setup Link, task-href Link, lifecycle dispatcher).
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): the lifecycle primary is no
	// longer a visible control. Its warning steps are the merged warnings
	// control; its other steps (in-place retry, external fix-setup link,
	// lifecycle dispatcher) are ONE More ▸ "Next step" entry.
	// assert.equal((header.match(/data-testid="timetable-simple-primary-action"/g) ?? []).length, 4,
	// 	'the four conditional render forms must identify the same sole primary action');
	// assert.match(header, /onClick=\{\(\) => activeTask \? void startTask\(activeTaskDefinition\.id\) : handleLifecycleAction\(\)\}/);
	assert.equal((header.match(/data-testid="timetable-simple-primary-action"/g) ?? []).length, 0);
	assert.match(header, /onSelect: \(\) => context\.handleRefresh\(\)/, 'in-place retry');
	assert.match(header, /href: setupRepair\.href \?\? YEAR_SETUP_HREF/, 'external fix-setup link');
	assert.match(header, /onSelect: handleLifecycleAction/, 'lifecycle dispatcher');
	assert.doesNotMatch(header, /data-testid="timetable-empty-generate-action"/);
	// UX-QUICKFIX-C01 supersedes the "Generate exists only in More" contract: the
	// action row mounts the visible, gate-guarded Generate control. Dispatch still
	// flows through the guarded handler, never inline.
	assert.match(header, /<SimpleGenerateAction/);
	assert.match(header, /onClick=\{handleGenerateClick\}/);
	assert.doesNotMatch(header, /onClick=\{context\.handleTriggerGenerate\}/);
});

test('the hidden generation bypasses are superseded by the visible, gated action cluster', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	// The removed hidden control may never return anywhere in the header.
	assert.doesNotMatch(header, /timetable-simple-mobile-lifecycle-action/);
	// UX-QUICKFIX-C01 deliberately reintroduces Generate as a VISIBLE, gated
	// control. The old grep guarded a hidden control that bypassed the lifecycle
	// dispatcher; the replacement lives in the extracted action module, is always
	// visible, and reads the shared readiness decision before it dispatches.
	assert.match(header, /<SimpleGenerateAction/);
	assert.match(helpers, /data-testid="timetable-simple-generate-action"/);
	// No hidden control may carry a direct generation call.
	assert.doesNotMatch(header, /onClick=\{context\.handleTriggerGenerate\}/);
	assert.doesNotMatch(header, /className="hidden"[\s\S]{0,300}context\.handleTriggerGenerate/);
	// The direct generation calls left are the gate-guarded visible handler and
	// the visible lifecycle retry.
	assert.match(header, /if \(!shouldDispatchSimpleGenerate\(canPlanOrGenerate\)\) return;/);
	assert.match(header, /case 'retry-generate': context\.handleTriggerGenerate\(\); break;/);
	// A3 — the duplicate Generate entry was removed from More; the visible header
	// control is the single Generate surface.
	const moreMenu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.doesNotMatch(moreMenu, /Generate schedule/, 'More no longer duplicates the header Generate control');
	assert.doesNotMatch(moreMenu, /context\.handleTriggerGenerate/, 'More dispatches no generation request');

	// A3 — the preview-demand control stays a preview-only action in the single
	// action row, and the NEXT STEP names the primary action.
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): Preview demand moved into
	// More ▸ Schedule actions with the same gate and the same dispatch.
	// assert.match(header, /data-testid="timetable-unassigned-insertion-action"/);
	// assert.match(header, /Preview demand/);
	const actions = source('src/components/timetable/simple/SimpleHeaderActions.tsx');
	assert.match(actions, /data-testid="timetable-unassigned-insertion-action"/);
	assert.match(actions, /Preview demand/);
	assert.match(header, /visible: generationReady && !hasGeneratedRun,\s*disabled: !canPlanOrGenerate,/);
	assert.match(header, /setInsertionOpen\(true\)/);
});

// --- TT-C04 honest readiness copy ---

test('readiness chip never reports generated counts without a run', () => {
	const labelText = readinessLabel(headerContext());
	assert.match(labelText, /No SY 2029-2030 timetable yet/);
	assert.doesNotMatch(labelText, /\d+ blocker|\d+ unresolved|\d+ warning/);
});

test('readiness chip reports unresolved sessions instead of ready to publish', () => {
	const draft = generatedDraft();
	const unresolvedOnly = readinessLabel(headerContext({ draft, summary: { unassignedCount: 3 } }));
	assert.equal(unresolvedOnly, '3 unresolved');
	assert.doesNotMatch(unresolvedOnly, /Ready to publish/);

	// Negative: unresolved wins over softer warnings, never the reverse.
	const unresolvedPlusWarnings = readinessLabel(
		headerContext({ draft, summary: { unassignedCount: 1 }, softCount: 2 }),
	);
	assert.equal(unresolvedPlusWarnings, '1 unresolved');
});

test('readiness chip keeps blockers first and stays honest when clean', () => {
	const draft = generatedDraft();
	// SUPERSEDED BY WORD (LANE-C-PLAIN-LANGUAGE-C03 J1, 2026-09-26). This row's
	// intent is unchanged and still fully asserted: a run-wide blocking HARD
	// takes precedence over unassigned sessions and over warnings, and the count
	// 2 is still carried. Only the noun changed — the 2026-09-26 audit finding 3
	// found this concept under four names in one viewport and J1 makes
	// "Must fix" the single plain word. Original retained verbatim:
	//   assert.equal(readinessLabel(headerContext({ draft, hardCount: 2, summary: { unassignedCount: 5 }, softCount: 9 })), '2 blockers');
	assert.equal(
		readinessLabel(headerContext({ draft, hardCount: 2, summary: { unassignedCount: 5 }, softCount: 9 })),
		'2 Must fix',
		'blocking HARD still outranks unassigned sessions and warnings',
	);
	// The precedence itself is still proven, not just the wording: a blocking
	// count still wins even when a larger unassigned count is present.
	// ── SUPERSEDED IN PLACE (QA F9, 2026-09-26), retained VERBATIM as the
	// record of the vacuous row. `'5 classes still to place (whole year)'` is a
	// publish-CHECKLIST `<li>` fragment, and `readinessLabel` — a header CHIP
	// label — can never return it, so the assertion passed even if the label had
	// returned "Ready to publish". The comment above it also overstated what it
	// proved. Replaced by the real precedence pair immediately below, which
	// compares two label values the function CAN actually return.
	//   assert.notEqual(
	//     readinessLabel(headerContext({ draft, hardCount: 2, summary: { unassignedCount: 5 }, softCount: 9 })),
	//     '5 classes still to place (whole year)',
	//   );
	// The replacement precedence pair — both sides are reachable return values,
	// so a wrong label fails the row:
	//   (a) blocking problems outrank unassigned sessions and warnings;
	assert.equal(
		readinessLabel(headerContext({ draft, hardCount: 0, blockingHardCount: 2, summary: { unassignedCount: 5 }, softCount: 9 })),
		'2 Must fix',
		'the publication-blocking count outranks a larger unassigned count and warnings',
	);
	//   (b) with no blocking problem, the unassigned count outranks warnings;
	//       the unassigned clause names sessions, not classes.
	assert.equal(
		readinessLabel(headerContext({ draft, hardCount: 0, blockingHardCount: 0, summary: { unassignedCount: 5 }, softCount: 9 })),
		'5 unresolved',
		'with nothing publication-blocking, unassigned sessions outrank warnings',
	);
	assert.doesNotMatch(
		readinessLabel(headerContext({ draft, hardCount: 0, blockingHardCount: 0, summary: { unassignedCount: 5 }, softCount: 9 })),
		/classes/,
		'the unassigned clause names the unit every other consumer uses (sessions)',
	);
	assert.equal(
		readinessLabel(headerContext({ draft, summary: { unassignedCount: 0 }, softCount: 2 })),
		'2 warnings',
	);
	assert.equal(readinessLabel(headerContext({ draft, summary: { unassignedCount: 0 } })), 'Ready to publish');
});

test('readiness chip distinguishes published follow-ups from clean published', () => {
	const draft = generatedDraft({ summary: { isPublished: true } });
	/* SUPERSEDED IN PLACE — A2 HEADER-BUDGET, CORRECTION 2 (F3, 2026-09-29).
	 * The original assertion is retained VERBATIM as a comment and is NOT run as
	 * pass/fail (AGENTS.md §16 forbids closing a finding by editing the row that
	 * found it):
	 *
	 *   assert.equal(
	 *     readinessLabel(headerContext({ draft, summary: { unassignedCount: 2 } })),
	 *     'Published with 2 follow-up items',
	 *   );
	 *
	 * WHY IT IS SUPERSEDED, AND IT IS A DUPLICATE, NOT A LOSS. The design-judgement
	 * reviewer (AGENTS.md §11 gate item 4) returned REJECT_UX on the header budget
	 * with one rubric item failing — "one status per fact" — and measured the
	 * published state at 1366×768: a small pill reading `Published with 2 follow-up
	 * items`, and 30 px to its right the green primary surface reading `Published
	 * schedule — 2 follow-up items remain`. The count, twice, side by side, in one
	 * row. The operator's own complaint was two elements claiming the same thing, so
	 * the header budget had moved that disease rather than removed it.
	 *
	 * The count now lives on the published PRIMARY surface alone
	 * (`SimplePublishedState`, the dominant `h-11` emerald object that
	 * `resolveSimpleHeaderPrimary` puts in the lifecycle primary slot, and the
	 * surface a scheduler reads first). The chip says the state and nothing more.
	 * Nothing is lost: the chip reaches this branch only when `context.draft` exists
	 * and `summary.isPublished === true` — the same predicate `isRunPublishedStrict`
	 * uses — so the published primary surface is on screen in every state that can
	 * read "Published" here.
	 *
	 * THE REPLACEMENT below asserts the SURVIVING claim, and asserts it as a rule
	 * rather than as one string, so it can still catch the duplicate returning: the
	 * chip must name the STATE, must not name a COUNT, and must be identical for a
	 * published run with and without follow-ups. The rendered, in-header evidence —
	 * including the exact published-surface copy that `ux-quickfix-c01`,
	 * `schedule-clarity-c03`, `timetable-header-collapse-c01` and
	 * `a2-header-budget-2026-09-29` still pin — lives in
	 * `a2-header-budget-2026-09-29.test.tsx`, row `H12 F3 state C+`. */
	assert.equal(
		readinessLabel(headerContext({ draft, summary: { unassignedCount: 2 } })),
		'Published',
		'SUPERSEDED REPLACEMENT: a published run with follow-ups reads `Published` on the chip — the count belongs to the published primary surface, once',
	);
	assert.equal(readinessLabel(headerContext({ draft, summary: { unassignedCount: 0 } })), 'Published');
	assert.equal(readinessLabel(headerContext({ draft, summary: { unassignedCount: 12 } })), 'Published',
		'and the chip is identical for 2, 0 and 12 follow-ups, which is the rule: the chip never names a count');
	assert.doesNotMatch(
		readinessLabel(headerContext({ draft, summary: { unassignedCount: 2 } })),
		/\d/,
		'the readiness chip states the run\'s state and no number at all',
	);
	assert.equal(readinessLabel(headerContext({ isPreGenerationWorkspace: true })), 'Working schedule draft');
});

// --- TT-C04 publish readiness: no run is never clean ---

test('publish readiness without a run is not clean and shows no generated counts', () => {
	const readiness = deriveSimplePublishReadiness(null, [], label('Section'), label('Subject'), label('Teacher'));
	assert.equal(readiness.hasGeneratedRun, false);
	assert.equal(readiness.isClean, false);
	assert.equal(readiness.hasBlockers, false);
	assert.equal(readiness.hasWarnings, false);
	assert.equal(readiness.totalUnresolved, 0);
	assert.equal(readiness.totalHardBlockers, 0);
	assert.match(readiness.summaryText, /No timetable generated yet/);
});

test('publish readiness groups unassigned blockers with a repair destination', () => {
	const draft = generatedDraft({
		unassignedItems: [
			{ sectionId: 1, subjectId: 2, gradeLevel: 8, session: 1, facultyId: 9, reason: 'NO_AVAILABLE_SLOT' },
			{ sectionId: 3, subjectId: 4, gradeLevel: 8, session: 2, facultyId: null, reason: 'NO_AVAILABLE_SLOT' },
		],
	});
	const readiness = deriveSimplePublishReadiness(
		draft as never,
		[],
		label('Section'),
		label('Subject'),
		label('Teacher'),
	);
	assert.equal(readiness.hasGeneratedRun, true);
	assert.equal(readiness.isClean, false);
	assert.equal(readiness.totalUnresolved, 2);
	assert.equal(readiness.blockerGroups.length, 1);
	assert.equal(readiness.blockerGroups[0].plainLabel, 'No allowed time slot was found');
	assert.equal(readiness.blockerGroups[0].actionLabel, 'Place manually');
	assert.ok(readiness.blockerGroups[0].items[0].nextStep.length > 0);
});

test('publish readiness clean run stays publishable; warnings-only is not clean', () => {
	const clean = deriveSimplePublishReadiness(
		generatedDraft() as never,
		[],
		label('Section'),
		label('Subject'),
		label('Teacher'),
	);
	assert.equal(clean.isClean, true);
	assert.match(clean.summaryText, /Ready to publish/);

	const warned = deriveSimplePublishReadiness(
		generatedDraft() as never,
		[{ severity: 'SOFT', code: 'ROOM_TYPE_MISMATCH', entities: {} } as never],
		label('Section'),
		label('Subject'),
		label('Teacher'),
	);
	assert.equal(warned.isClean, false);
	assert.equal(warned.hasWarnings, true);
	assert.equal(warned.hasBlockers, false);
});

// --- TT-C04 Homeroom Guidance can never read as placeable demand ---

test('homeroom guidance codes are detected across spellings', () => {
	assert.equal(isHomeroomGuidanceCode('HG'), true);
	assert.equal(isHomeroomGuidanceCode('hg'), true);
	assert.equal(isHomeroomGuidanceCode('Homeroom Guidance'), true);
	assert.equal(isHomeroomGuidanceCode('MATH'), false);
	assert.equal(isHomeroomGuidanceCode(null), false);
	assert.equal(isHomeroomGuidanceCode(''), false);
});

test('homeroom guidance line is save-blocked even when mislabeled previewable', () => {
	const blocked = placementSaveAvailability({
		state: 'INDIVIDUALLY_PREVIEWABLE',
		hasCandidates: true,
		allowApply: true,
		subjectCode: 'HG',
	});
	assert.equal(blocked.canSave, false);
	assert.equal(blocked.label, 'Save blocked');
	assert.match(blocked.detail, /Homeroom Guidance is never timetable demand/);

	// Control: an ordinary subject keeps the normal preview-only contract.
	const previewOnly = placementSaveAvailability({
		state: 'INDIVIDUALLY_PREVIEWABLE',
		hasCandidates: true,
		allowApply: false,
		subjectCode: 'MATH',
	});
	assert.equal(previewOnly.canSave, false);
	assert.match(previewOnly.label, /preview only/);
});

// --- TT-C04 structural guardrails (repo source-text style) ---

test('blocker repair actions keep 44px targets and screen-reader names', () => {
	const sheet = source('src/components/timetable/SimplePublishReadinessSheet.tsx');
	const drawer = source('src/components/timetable/simple/SimpleTaskDrawerHelpers.tsx');
	assert.doesNotMatch(sheet, /className="h-7 shrink-0 gap-1 text-xs"/);
	assert.doesNotMatch(drawer, /className="h-7 shrink-0 gap-1 text-xs"/);
	assert.doesNotMatch(drawer, /className="h-6 gap-1 text-xs text-red-700"/);
	assert.match(sheet, /sessions affected/);
	assert.match(drawer, /sessions affected/);
});

test('publish stays disabled with unresolved sessions across surfaces', () => {
	// ── C11 CORRECTION 2 (QA-B1) — RE-POINTED, additively ──────────────────────
	// C11 D extracted the Expert header's publication gate into
	// `TimetableExpertPublishControl.tsx` (that file was at 961 of the 1000-line cap,
	// AGENTS.md §8, and had to take the persistent draft strip). Every clause moved
	// in the same order with the same wording, so this row's requirement — the
	// Advanced Publish control stays disabled while sessions are unplaced — is
	// unchanged. Retained as SUPERSEDED:
	//   const advanced = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	//   assert.match(advanced, /unassignedCount > 0 \|\| centerView === 'pre-generation'/);
	// The replacement reads the file that owns the gate and proves the header still
	// builds it from the same inputs, so the two cannot drift apart.
	const advanced = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	const gate = source('src/components/timetable/TimetableExpertPublishControl.tsx');
	assert.match(gate, /unassignedCount: number;/, 'the gate still reads the unplaced-session count');
	assert.match(gate, /if \(input\.unassignedCount > 0\) \{[\s\S]*allowed: false,/,
		'and still refuses to publish while any session is unplaced');
	assert.match(gate, /if \(input\.isPreGenerationView\) \{[\s\S]*allowed: false,/,
		'and still refuses to publish the draft workspace');
	assert.match(gate, /disabled=\{!gate\.allowed\}/, 'the control is disabled by that one gate');
	assert.match(advanced, /<TimetableExpertPublishControl/,
		'the Advanced header still mounts exactly that control');
	assert.match(advanced, /resolveExpertPublishGate\(\{/,
		'and builds it from the header own inputs');
	const dialog = source('src/components/timetable/modals/TimetableWorkflowDialogs.tsx');
	assert.match(dialog, /publishUnassignedCount/);
	// SUPERSEDED TWICE, retained verbatim and visibly marked, never deleted
	// (§16: a correction is additive, and removing an assertion fails review
	// regardless of the fix).
	//
	// R1 — f9879289 (A2-TIMETABLE-CUSTODY) replaced the bare count sentence with
	// `runUnplacedSentence(n) + " must be placed before …"`, so the count named the
	// population it measures. R2 — A2-UX-WIRE-C2 replaced that with
	// `publishPlacementBlockedSentence(n)`, which keeps the population and fixes the
	// grammar: the pre-fix pair was two verbs on one clause with the number restated
	// by a stacked modal. The gate the row is really about is unchanged, and the
	// three assertions below prove the gate survived BOTH rewrites rather than that
	// the sentence kept its old wording.
	// assert.match(dialog, /still need placing before this schedule can be published/);
	// assert.match(dialog, /runUnplacedSentence\(publishUnassignedCount \?\? 0\)/);
	// assert.match(dialog, /must be placed before this schedule can be published/);
	assert.match(dialog, /publishPlacementBlockedSentence\(publishUnassignedCount \?\? 0\)/, 'the count is still the gate, now naming its population in one noun and one verb');
	assert.match(dialog, /publishUnassignedCount \?\? 0\) > 0 \|\| \(softCount > 0 && !publishAcknowledged\)/, 'the same > 0 condition still gates the Publish button');
	assert.doesNotMatch(dialog, /must be placed before this schedule can be published/, 'and the ungrammatical pre-fix composition is gone');
});

test('drawer blocker items carry plain-language next steps, never raw codes', () => {
	const groups = buildBlockerGroups(
		[{ severity: 'HARD', code: 'NO_AVAILABLE_SLOT', entities: { sectionId: 1, subjectId: 2, facultyId: 3 } } as never],
		(id: number) => `Section ${id}`,
		(id: number) => `Subject ${id}`,
		(id: number) => `Teacher ${id}`,
	);
	assert.equal(groups.length, 1);
	assert.equal(
		groups[0].items[0].nextStep,
		'No allowed time slot was found. Try manual placement or review the scheduling policy.',
	);
	assert.doesNotMatch(groups[0].items[0].nextStep, /^[A-Z_]+$/);
});

test('failed newest run is named explicitly instead of looking like no history', () => {
	// A2-C6-TRUTH (T3f) moved the status rows out of `TimetableSimpleHeader.tsx`
	// into `simple/SimpleHeaderMessages.tsx` (the cap + honest `and N more`
	// region), so BOTH the testid and the sentence now live there. The header
	// still owns the `latestRunFailed` condition that feeds the row.
	const header = source('src/components/timetable/simple/SimpleHeaderMessages.tsx');
	assert.match(header, /timetable-last-generation-failed-message/);
	assert.match(header, /The last schedule build did not finish/);
});

test('insertion workflow stays preview-only with zero production apply', () => {
	const workflow = source('src/components/timetable/UnassignedInsertionWorkflow.tsx');
	assert.match(workflow, /allowApply: false/);
});

// --- TT-UX01 operator readiness honesty (2026-09-11) ---

test('TTX-01 no-run center has no write CTA and defers to the header action', () => {
	// ── C11 CORRECTION 2 (QA-B1) — RE-POINTED, additively ──────────────────────
	// The centre pane chain moved to `CenterWorkspacePaneSurface.tsx` (C11 F4: a
	// test must drive a real component the product renders). All four properties
	// survive the move — the three NEGATIVE ones are properties of the file as a
	// whole, so they are asserted against BOTH files, and the positive one is
	// re-pointed. Retained as SUPERSEDED:
	//   const center = source('src/components/timetable/CenterWorkspace.tsx');
	//   assert.match(center, /primary action above/);
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	const paneSurface = source('src/components/timetable/CenterWorkspacePaneSurface.tsx');
	for (const [name, file] of [['the panel', center], ['the pane surface', paneSurface]] as const) {
		assert.doesNotMatch(file, /timetable-empty-primary-actions/, `${name} offers no write CTA cluster`);
		assert.doesNotMatch(file, /Start Pre-Generation Draft/, `${name} does not name its own primary verb`);
		assert.doesNotMatch(file, /handleStartNewPreGenerationDraft\(\)/, `${name} never dispatches a draft itself`);
	}
	assert.match(paneSurface, /primary action above/, 'the empty centre still defers to the header primary action');
	assert.match(center, /<CenterWorkspacePaneSurface \{\.\.\.props\}/, 'the panel renders the pane surface that does');
});

test('TTX-02 run-derived clean claims are gated on run existence', () => {
	const rail = source('src/components/timetable/GeneratedRunRailPanels.tsx');
	assert.match(rail, /const hasGeneratedRun = Boolean\(context\.summary\)/);
	assert.match(rail, /hasGeneratedRun && hardViolationCount === 0 && violations\.length === 0/);
	assert.match(rail, /No generated run yet/);
	const drawer = source('src/components/timetable/TimetableTaskDrawer.tsx');
	assert.match(drawer, /if \(!context\.summary\)/);
});

test('TTX-03 advanced run badge never renders a null run as #-', () => {
	const advanced = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	assert.doesNotMatch(advanced, /Generated Run #\$\{activeGeneratedRunId \?\? '-'/);
	assert.match(advanced, /No generated run yet/);
});

test('TTX-04 deciding readiness copy is visible on mobile and not hard-truncated', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.doesNotMatch(header, /hidden max-w-xl truncate text-xs text-muted-foreground sm:block/);
	assert.doesNotMatch(header, /hidden max-w-xl truncate text-xs font-medium text-red-700 sm:block/);
	// A2-C6-TRUTH (T3f) moved these two rows into `SimpleHeaderMessages.tsx`,
	// which renders the whole status region and caps it at three visible rows
	// plus an honest `and N more`. The addressable testid is no longer a literal
	// `data-testid="..."` attribute in source: the builder now returns rows whose
	// `id` IS the testid, and the row component binds `data-testid={message.id}`.
	// So the pinned literal is the id each row is constructed with — same string,
	// current form. The id -> `data-testid` binding and the rendered attribute
	// are asserted on the real surface by `timetable-a2-c6-truth.test.ts` (row
	// ids) and `timetable-dynamic-workspace-rendered.test.ts` (markup).
	const headerMessages = source('src/components/timetable/simple/SimpleHeaderMessages.tsx');
	assert.match(headerMessages, /id: 'timetable-curriculum-readiness-message'/);
	assert.match(headerMessages, /id: 'timetable-last-generation-failed-message'/);
});

test('TTX-05 run-dependent More items are disabled with an accessible reason', () => {
	// C04: the More menu was extracted into SimpleMoreMenuContent.
	const header = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(header, /runToolsAvailable/);
	assert.equal((header.match(/disabled=\{!runToolsAvailable\}/g) ?? []).length, 4);
	assert.match(header, /timetable-more-place-unresolved/);
	assert.match(header, /timetable-more-swap-sessions/);
	assert.match(header, /timetable-more-review-issues/);
	assert.match(header, /teacher-departure-trigger/);
	assert.match(header, /Unavailable: no generated run yet/);
});

test('TTX-06 empty entity selector is disabled with a reason', () => {
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.match(helpers, /entityOptionsAvailable/);
	assert.match(helpers, /disabled=\{!entityOptionsAvailable\}/);
	assert.match(helpers, /No schedule options are available yet/);
	const select = source('src/ui/searchable-select.tsx');
	assert.match(select, /disabled\?: boolean/);
});

test('TTX-07 tutorial reports an unavailable target instead of a silent no-op', () => {
	// A2-UX-MENU-C2: the tutorial moved to its own module so
	// `SimpleHeaderHelpers` stays inside the 1000-line component budget, and it is
	// re-exported from there. The intent of this row — the tutorial SAYS when it
	// cannot point at its target, instead of doing nothing quietly — is unchanged
	// and now also covers the "Show me" resolution, which walks the step's
	// alternate target face before giving up.
	const tutorial = source('src/components/timetable/simple/SimpleTutorial.tsx');
	assert.match(tutorial, /timetable-simple-tutorial-unavailable/);
	assert.match(tutorial, /if \(!target\)/);
	assert.match(tutorial, /is not on this page/, 'the message says plainly that the control is absent');
	assert.match(
		tutorial,
		/\[step\.targetTestId, step\.altTargetTestId\]/,
		'both faces of a control are tried before the step is called unavailable',
	);
	// The header still re-exports it, so every existing importer is unchanged.
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.match(helpers, /export \{ SimpleTutorialControl, simpleTutorialSteps \} from/);
});

test('TTX-08 tutorial trigger has an accessible name and 44px mobile target', () => {
	// Same move as TTX-07: the trigger now lives in the tutorial module, and the
	// accessible name and the 44px touch target are asserted there. The
	// schedule-sheet trigger it also pins is still in the header helpers.
	const tutorial = source('src/components/timetable/simple/SimpleTutorial.tsx');
	// SUPERSEDED (A2 C13, 2026-09-29) — the LABEL, corrected. The ORIGINAL row read:
	//     assert.match(tutorial, /aria-label="Open timetable tutorial"/);
	// My first replacement asserted the post-rename LITERAL
	// `/aria-label="Open class schedule tutorial"/`, which is wrong: the source now
	// derives the name from the shared constant
	// (`` aria-label={`Open ${CLASS_SCHEDULE_LABEL.toLowerCase()} tutorial`} ``), so
	// no assembled string appears in the file. A row marked superseded that still
	// fails is a false record, so this asserts the SOURCE FORM and keeps the row's
	// real property: the tutorial trigger is named from the ONE place name, so it
	// can never drift from the nav, the breadcrumb group and the `<h1>`.
	assert.match(tutorial, /CLASS_SCHEDULE_LABEL/,
		'the tutorial trigger is named from the one shared place-name constant');
	assert.match(tutorial, /aria-label=\{`Open \$\{CLASS_SCHEDULE_LABEL\.toLowerCase\(\)\} tutorial`\}/,
		'and the accessible name is assembled from it, not from a second literal');
	assert.doesNotMatch(tutorial, /aria-label="Open timetable tutorial"/,
		'the internal name no longer reaches this control');
	assert.equal(
		`Open ${CLASS_SCHEDULE_LABEL.toLowerCase()} tutorial`,
		'Open class schedule tutorial',
		'the accessible name a scheduler actually reads is spelled this way',
	);
	assert.match(tutorial, /min-h-11/);
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.match(
		helpers,
		/data-testid="timetable-simple-schedule-sheet-trigger"[\s\S]{0,80}min-h-11 min-w-11|min-h-11 min-w-11[\s\S]{0,200}data-testid="timetable-simple-schedule-sheet-trigger"/,
	);
});

test('TTX-11 room-request no-run 404 is empty, deduplicated, and gated on a completed run', () => {
	const useData = source('src/hooks/useTimetableData.ts');
	assert.match(useData, /getTimetableApiErrorCode\(err\) === 'NO_ACTIVE_DRAFT'/);
	// UX-P01: the load sequencing (and therefore the completed-run gate) moved to
	// the production orchestration module; assert the gate there, and assert it
	// is the only path that reaches the room-request read.
	const orchestration = source('src/lib/timetable-data/timetableLoadOrchestration.ts');
	assert.match(orchestration, /hasCompletedRun/);
	assert.match(orchestration, /hasCompletedRun\s*\?\s*ports\.loadRoomRequestSummary/);
	assert.doesNotMatch(
		useData,
		/if \(!schoolYearId\) return;\s*void loadRoomRequestSummary\(schoolYearId, requestStatusFilter, requestDecisionFilter\);/,
	);
});

test('TTX-12 a visible, gated publish control replaces the permanently hidden one', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	// UX-QUICKFIX-C01 deliberately reintroduces Publish as a VISIBLE, gated
	// control; the permanently hidden control is superseded.
	assert.match(header, /<SimplePublishAction/);
	assert.match(helpers, /data-testid="timetable-simple-publish-action"/);
	assert.doesNotMatch(header, /className="hidden"[\s\S]{0,300}timetable-simple-publish-action/);
});
