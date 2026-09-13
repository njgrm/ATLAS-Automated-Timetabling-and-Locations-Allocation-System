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
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /gates\.publication\.enabled/);
	assert.match(header, /gates\.swap\.enabled/);
});

test('R7 room-request review is reachable from Simple without a second authority', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /openRequestsTask/);
	assert.match(header, /context\.setLeftTab\('requests'\)/);
	assert.match(header, /data-testid="timetable-more-review-requests"/);
});

test('R7 setup-sync impact review is reachable from Simple', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /SimpleDriftBanner/);
	assert.match(source('src/components/timetable/simple/SimpleDriftBanner.tsx'), /SetupImpactDialog/);
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
