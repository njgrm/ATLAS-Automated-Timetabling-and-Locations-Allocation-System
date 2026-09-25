import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const clientRoot = resolve(import.meta.dirname, '../../../..');
const source = (path: string) => readFileSync(resolve(clientRoot, path), 'utf8');

test('published read-only entries preserve keyboard and pointer disclosure without DnD props', () => {
	const entry = source('src/components/timetable/TimetableDraggableEntry.tsx');
	const readOnlyBranch = entry.match(/if \(readOnly\) \{([\s\S]*?)\n\t\}/)?.[1] ?? '';
	assert.match(readOnlyBranch, /onClick=\{onClick\}/);
	assert.match(readOnlyBranch, /onKeyDown=\{onKeyDown\}/);
	assert.match(readOnlyBranch, /tabIndex=\{0\}/);
	assert.doesNotMatch(readOnlyBranch, /\.\.\.attributes|\.\.\.listeners|onPointerDownCapture=/);
});

test('the common workspace owns the strict published signal before paint for both layouts', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(workspace, /isDraftPublishedStrict\(state\.draft\)/);
	assert.match(workspace, /useLayoutEffect\(\(\) => \{\s*setTimetableEntryReadOnly\(isDraftPublished\)/);
	assert.doesNotMatch(header, /setTimetableEntryReadOnly/);
});
