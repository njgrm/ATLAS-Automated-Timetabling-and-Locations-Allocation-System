import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

// --- R7 the shared capability model is the production guard ---

test('R7 Simple task definitions consume the shared capability gates', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.match(header, /useSimpleTasks\(context, capabilities\.gates\)/);
	assert.match(helpers, /gates: TimetableCapabilities\['gates'\]/);
	assert.match(helpers, /!gates\.publication\.enabled/);
	assert.match(helpers, /!gates\.swap\.enabled/);
	assert.match(helpers, /!gates\.issueReview\.enabled/);
	assert.match(helpers, /gates\.publication\.reason/);
});

test('R7 Simple publish action reads the publication gate, not a local count', () => {
	// SOURCE-SHAPE ROW, restated 2026-09-29 (executor A2). The load-bearing claim
	// is UNCHANGED — neither the publish task nor the swap task may be built from
	// a local count; both read the shared capability gate. Only the FILE holding
	// each read moved, and it moved inside this range: the header kept the
	// publication gate, and when the two-row header extracted the task dispatcher
	// the swap gate went with it.
	// SUPERSEDED 2026-09-29 (authority: AGENTS.md §8 "Header budget", the A2
	// header-budget range) — the two assertions below pinned BOTH reads to the
	// header's own source text. Retained verbatim, per AGENTS.md §16
	// (corrections are additive, never subtractive). The swap read now lives in
	// `SimpleHeaderTasks.ts`, which the header imports as `createSimpleTaskStarter`.
	// const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	// assert.match(header, /gates\.publication\.enabled/);
	// assert.match(header, /gates\.swap\.enabled/);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /gates\.publication\.enabled/);
});

test('R7 [source shape, restated 2026-09-29] neither Simple task action is built from a local count', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const tasks = source('src/components/timetable/simple/SimpleHeaderTasks.ts');

	// PUBLICATION — still the header, still the shared gate, on BOTH the
	// lifecycle action and the task-dispatch plan that routes to it. A local
	// count could satisfy neither: the value is `gates.publication.enabled` itself.
	assert.match(
		header,
		/shouldDispatchSimplePublish\(capabilities\.gates\.publication\.enabled, isRunPublished\)/,
		'the publish ACTION is gated on the shared capability gate, not a local count',
	);
	assert.match(
		header,
		/resolvePublishTaskDispatch\(plan\.kind === 'publish-task' \? capabilities\.gates\.publication\.enabled : false\)/,
		'and so is the task-dispatch PLAN that opens it',
	);

	// SWAP — asserted on the BRANCH BODY, so the other two gate reads in the same
	// function cannot stand in for this one and the row still fails if the swap
	// gate read is deleted.
	const swapBranch = tasks.match(/if \(task === 'swap-sessions'\) \{([\s\S]*?)\n\t\}/);
	assert.ok(swapBranch, 'the swap task must still have its own dispatch branch');
	assert.match(
		swapBranch![1],
		/if \(!capabilities\.gates\.swap\.enabled\) return;/,
		'the swap TASK is gated on the shared capability gate, not a local count',
	);

	// and the header still hands that gate-bearing starter the capabilities object
	const starter = header.match(/createSimpleTaskStarter\(\{([\s\S]*?)\n\t\}\);/);
	assert.ok(starter, 'the header must build the task starter');
	assert.match(
		starter![1],
		/\r?\n\t\tcapabilities,\r?\n/,
		'the starter receives the capabilities the swap gate is read from',
	);
});

test('R7 room-request review is reachable from Simple without a second authority', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(header, /openRequestsTask/);
	assert.match(header, /context\.setLeftTab\('requests'\)/);
	assert.match(header, /SimpleMoreMenuContent/);
	assert.match(menu, /data-testid="timetable-more-review-requests"/);
});

test('R7 setup-sync impact review is reachable from Simple', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /SimpleDriftBanner/);
	assert.match(source('src/components/timetable/simple/SimpleDriftBanner.tsx'), /SetupImpactDialog/);
});

test('R7 Simple links to policy editing without duplicating the Advanced editor', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(header, /SimpleMoreMenuContent/);
	assert.match(menu, /data-testid="timetable-more-policy"/);
	// UX-R03a: the policy item is a real link to the nested policy route; the
	// requestAnimationFrame state workaround is gone. The guarded centerView
	// transition is driven by the route→view sync, not by this menu.
	assert.match(menu, /to="\/timetable\/policies"/);
	assert.match(menu, /asChild/);
	assert.doesNotMatch(menu, /requestAnimationFrame\(\(\) => context\.switchCenterViewWithGuard\(context\.enterPolicyView\)\)/);
	assert.doesNotMatch(menu, /switchCenterViewWithGuard/);
	assert.match(menu, /onLayoutModeChange\('advanced'\)/);
});

// --- R9 A-12 Advanced Requests expands the collapsed rail ---

test('R9/A-12 Advanced Requests expands the left rail instead of only setting the tab', () => {
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	assert.match(header, /onClick=\{\(\) => openLeftTask\('requests'\)\}/);
	assert.match(header, /data-testid="timetable-advanced-requests"/);
});

// --- R9 A-13 collapse the duplicate selected-class surface ---

test('R9/A-13 the shell selected-class strip is Simple-only in Advanced', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /state\.selectedEntry && layoutMode === 'simple'/);
});
