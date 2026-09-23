import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildSectionLabel } from '@/lib/timetable-reference-labels';

const clientRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const source = (path: string) => readFileSync(`${clientRoot}/${path}`, 'utf8');

test('known section labels lead with the grade and retain special-program suffixes', () => {
	const label = buildSectionLabel(new Map([[7, {
		id: 7,
		name: 'A',
		gradeLevelId: 8,
		gradeLevelName: 'Grade 8',
		programType: 'STE',
		programCode: 'STE',
	} as any]]), (_type, code) => code ?? 'Special Program');
	assert.equal(label(7), 'GR8 - A · STE');
	assert.equal(label(404), 'Section #404');
});

test('the ordinary Simple header hides provenance while retaining actionable drift warnings', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.doesNotMatch(header, /\{source\}/);
	assert.match(header, /<SimpleDriftBanner/);
	assert.match(header, /stale|unresolved|rechecking/i);
});

test('user-facing layout entry points use Expert while the stored layout key stays stable', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(header, /Expert view/);
	assert.match(workspace, /Expert details/);
	assert.match(menu, /Expert view/);
	assert.match(workspace, /localStorage\.getItem\('atlas_timetable_layout_mode'\).*advanced/s);
});

test('ordinary schedule chrome does not expose implementation provenance', () => {
	const files = [
		'src/components/timetable/TimetableSimpleHeader.tsx',
		'src/components/timetable/ScheduleReviewWorkspace.tsx',
		'src/components/timetable/InlinePlacementPreview.tsx',
	].map((path) => source(path)).join('\n');
	assert.doesNotMatch(files, /TeachingLoadModulesSection|source[- ]revision|fingerprint/i);
});

test('entering a timetable preserves the desktop sidebar preference', () => {
	const appShell = source('src/components/AppShell.tsx');
	assert.doesNotMatch(appShell, /if \(isTimetableRoute && !wasTimetableRoute\) setSidebarOpen\(false\)/);
	assert.match(appShell, /isMobile/);
});

test('ordinary schedule repair keeps issue summary separate from technical detail', () => {
	const issues = source('src/components/timetable/ViolationsSidebar.tsx');
	assert.match(issues, /Issue details|Details/);
	assert.doesNotMatch(issues, /underline decoration-dotted|border-dashed|border-dotted/);
	assert.match(issues, /z-\[?(?:[4-9]\d|\d{3,})/);
});

test('timetable route updates keep mounted-grid state and skip broad reload on term changes', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const data = source('src/hooks/useTimetableData.ts');
	assert.match(workspace, /data-testid="timetable-term-switcher/);
	assert.match(data, /term.*cache|cache.*term/i);
	assert.doesNotMatch(data, /if \(typeof termFilter === 'number' \|\| input\.userOverrodeTermFilter\) \{\s*void loadAll\(\{ preserveRun: true \}\);/);
});
