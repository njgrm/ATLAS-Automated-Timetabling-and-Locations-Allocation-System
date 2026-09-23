import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QueryClient } from '@tanstack/react-query';

import { buildSectionLabel } from '@/lib/timetable-reference-labels';
import { requiresFacultyIssueConfirmation, resolveTimetableEntryPivot } from '@/lib/timetable-entry-pivot';
import { timetableRunBundleQueryKey, timetableRunsQueryKey, timetableReferenceQueryKey, timetableRoomRequestQueryKey } from '@/lib/timetable-data/timetableQueryKeys';

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

test('mouse selection pivots only to canonical section, teacher, room, or homeroom identities', () => {
	const entry = { sectionId: 7, facultyId: 12, roomId: null } as any;
	const shared = {
		entry,
		sections: new Map([[7, { homeRoomId: 41 }]]),
		facultyIds: new Set([12]),
		roomIds: new Set([41]),
	};
	assert.deepEqual(resolveTimetableEntryPivot({ ...shared, viewMode: 'section' }), { entityId: 7, guidance: null });
	assert.deepEqual(resolveTimetableEntryPivot({ ...shared, viewMode: 'faculty' }), { entityId: 12, guidance: null });
	assert.deepEqual(resolveTimetableEntryPivot({ ...shared, viewMode: 'room' }), { entityId: 41, guidance: null });
	assert.deepEqual(resolveTimetableEntryPivot({
		...shared,
		viewMode: 'room',
		entry: { ...entry, roomId: 99 },
	}), { entityId: 41, guidance: null }, 'configured homeroom wins over an assigned room');
	assert.equal(resolveTimetableEntryPivot({ ...shared, viewMode: 'faculty', entry: { ...entry, facultyId: null } }).entityId, null);
	assert.equal(resolveTimetableEntryPivot({ ...shared, viewMode: 'room', sections: new Map(), roomIds: new Set() }).entityId, null);
});

test('scheduled and unassigned session drag starts share canonical context pivot without changing view mode', () => {
	const drag = source('src/hooks/useTimetableDragDrop.ts');
	const state = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	const mutations = source('src/hooks/useTimetableMutations.ts');
	assert.match(drag, /onSessionContextPivot\?\.\(data\.entry\)/);
	assert.match(drag, /onSessionContextPivot\?\.\(\{ sectionId: item\.sectionId, facultyId: item\.facultyId \?\? null, roomId: null \}\)/);
	assert.match(state, /onSessionContextPivot:\s*handleSessionContextPivot/);
	assert.match(mutations, /const handleSessionContextPivot[\s\S]+resolveTimetableEntryPivot[\s\S]+setEntityFilter/);
	assert.doesNotMatch(mutations, /handleSessionContextPivot[\s\S]{0,500}setViewMode/);
});

test('the ordinary Simple header hides provenance while retaining actionable drift warnings', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.doesNotMatch(header, /data-testid="timetable-simple-authority"/);
	assert.match(header, /<SimpleDriftBanner/);
	assert.match(header, /data-testid="timetable-term-authority-unverified"/);
});

test('user-facing layout entry points use Expert while the stored layout key stays stable', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /Expert view/);
	assert.match(workspace, /Expert details/);
	assert.match(menu, /Scheduling policy \(Expert\)/);
	assert.match(workspace, /localStorage\.getItem\('atlas_timetable_layout_mode'\).*advanced/s);
	assert.doesNotMatch(source('src/components/timetable/simple/SimpleHeaderHelpers.tsx'), /Advanced view/);
});

test('ordinary schedule chrome does not expose implementation provenance', () => {
	const files = [
		'src/components/timetable/TimetableSimpleHeader.tsx',
		'src/components/timetable/ScheduleReviewWorkspace.tsx',
		'src/components/timetable/InlinePlacementPreview.tsx',
	].map((path) => source(path)).join('\n');
	assert.equal(/source[- ]revision|fingerprint/i.test(files), false, 'routine placement copy must not name internal freshness tokens');
	const repairCopy = source('src/components/timetable/TacticalSandboxDock.parts.tsx');
	assert.equal(/Server fingerprint issued|issues the fingerprint that apply requires/i.test(repairCopy), false, 'repair preview copy must describe the user action');
});

test('entering a timetable preserves the desktop sidebar preference', () => {
	const appShell = source('src/components/AppShell.tsx');
	assert.doesNotMatch(appShell, /if \(isTimetableRoute && !wasTimetableRoute\) setSidebarOpen\(false\)/);
	assert.match(appShell, /isMobile/);
});

test('ordinary schedule repair keeps issue summary separate from technical detail', () => {
	const issues = source('src/components/timetable/TimetableShared.tsx');
	assert.match(issues, /groupSummary/);
	assert.match(issues, />Details</);
	assert.match(issues, /z-\[?(?:[4-9]\d|\d{3,})/);
	assert.equal(/decoration-dashed|decoration-dotted/.test(issues), false, 'issue copy must not use dotted or dashed word underlines');
});

test('cross-faculty issue selection asks before changing teacher and confirm selects the affected session', () => {
	const mutations = source('src/hooks/useTimetableMutations.ts');
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(mutations, /canonicalFaculty[\s\S]+setPendingFacultyIssuePivot/);
	assert.match(mutations, /requiresFacultyIssueConfirmation\(/);
	assert.equal(requiresFacultyIssueConfirmation({ viewMode: 'section', entityFilter: '7', facultyId: 12, canonicalFacultyExists: true }), true);
	assert.equal(requiresFacultyIssueConfirmation({ viewMode: 'room', entityFilter: '41', facultyId: 12, canonicalFacultyExists: true }), true);
	assert.equal(requiresFacultyIssueConfirmation({ viewMode: 'faculty', entityFilter: '12', facultyId: 12, canonicalFacultyExists: true }), false);
	assert.equal(requiresFacultyIssueConfirmation({ viewMode: 'faculty', entityFilter: '9', facultyId: 12, canonicalFacultyExists: true }), true);
	assert.equal(requiresFacultyIssueConfirmation({ viewMode: 'section', entityFilter: '7', facultyId: 12, canonicalFacultyExists: false }), false);
	assert.match(workspace, /Open \{state\.pendingFacultyIssuePivot\?\.teacherLabel\}/);
	assert.match(workspace, /Button type="button" variant="outline" onClick=\{\(\) => state\.setPendingFacultyIssuePivot\(null\)\}>Cancel/);
	assert.match(workspace, /Button type="button" onClick=\{state\.confirmFacultyIssuePivot\}>Open teacher timetable/);
	assert.match(source('src/hooks/useScheduleReviewWorkspaceState.ts'), /setSelectedViolation\(pending\.violation\)[\s\S]+setSelectedEntry\(pending\.entry\)/);
});

test('published return is visible and restores run, term, view, and entity after draft planning', () => {
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	const state = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(header, /Return to published schedule/);
	assert.match(state, /publishedReturnStateRef\.current = \{ runId: selectedRunId, termFilter, viewMode, entityFilter \}/);
	assert.match(state, /setSelectedRunId\(previous\.runId\)[\s\S]+setTermFilter\(previous\.termFilter\)[\s\S]+setViewMode\(previous\.viewMode\)[\s\S]+setEntityFilter\(previous\.entityFilter\)/);
});

test('draft tray switch review is inline with one Confirm action', () => {
	const dialogs = source('src/components/timetable/modals/TimetablePlacementDialogs.tsx');
	assert.match(dialogs, /data-testid="draft-swap-inline-preview"/);
	assert.match(dialogs, /Confirm switch/);
	assert.doesNotMatch(dialogs, /draft-swap-review-dialog/);
});

test('Teaching Load dock retains all three deliberate mount states', () => {
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	assert.match(center, /tacticalSandboxOpen\s*\|\|\s*sandboxFacultyByEntryId\.size > 0\s*\|\|\s*\(centerView === 'schedule' && selectedUnassigned !== null\)/);
	assert.match(center, /<TacticalSandboxDock\s+open=\{tacticalSandboxOpen\}/);
	assert.match(center, /onOpenChange=\{handleTacticalSandboxOpenChange\}/);
});

test('nested timetable pages keep focused routes without duplicating scheduler chrome', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	assert.match(workspace, /const showSchedulerChrome = isTimetableSchedulerView\(state\.headerContext\.centerView\)/);
	assert.match(center, /centerView === 'setup'|centerView === 'policy'|centerView === 'runs'|centerView === 'exports'/);
	assert.match(workspace, /h-\[calc\(100svh-3\.5rem\)\]/);
	assert.match(center, /min-h-0 overflow-auto|flex-1 min-h-0/);
});

test('timetable route updates keep mounted-grid state and skip broad reload on term changes', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const data = source('src/hooks/useTimetableData.ts');
	assert.match(header, /<SimpleTermSwitcher context=\{context\}/);
	assert.match(data, /queryKey: timetableRunBundleQueryKey\(currentScope\)/);
	assert.match(data, /placeholderData: keepPreviousData/);
	assert.match(data, /Normal term navigation is served by the term-scoped run-bundle query/);
	assert.match(data, /if \(!gateBlockedRef\.current && fallbackTermIndex == null && fallbackTermRef\.current == null\) return;/);
});

test('warm term return and remount reuse the scoped bundle without broad reads', async () => {
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 60_000 } } });
	const requests = new Map<number, number>();
	const fetchTermBundle = (termIndex: number) => {
		const scope = { schoolId: 5, schoolYearId: 9, runId: 'run-12', termIndex };
		return client.fetchQuery({
			queryKey: timetableRunBundleQueryKey(scope),
			queryFn: async () => {
				requests.set(termIndex, (requests.get(termIndex) ?? 0) + 1);
				return { termIndex };
			},
		});
	};
	try {
		await fetchTermBundle(1);
		await fetchTermBundle(2);
		await fetchTermBundle(1);
		await fetchTermBundle(1); // same scoped client after route remount
		assert.deepEqual([...requests.entries()].sort(), [[1, 1], [2, 1]]);
		const scope = { schoolId: 5, schoolYearId: 9, runId: 'run-12', termIndex: 1 };
		assert.deepEqual(timetableRunsQueryKey(scope), timetableRunsQueryKey({ ...scope, termIndex: 2 }));
		assert.deepEqual(timetableReferenceQueryKey(scope), timetableReferenceQueryKey({ ...scope, termIndex: 2 }));
		assert.deepEqual(timetableRoomRequestQueryKey(scope, 'ALL', 'ALL'), timetableRoomRequestQueryKey({ ...scope, termIndex: 2 }, 'ALL', 'ALL'));
	} finally {
		client.clear();
	}
});
