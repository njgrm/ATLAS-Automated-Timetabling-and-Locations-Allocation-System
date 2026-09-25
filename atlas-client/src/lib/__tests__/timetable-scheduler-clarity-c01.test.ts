import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SimplePublishedState, readinessLabel } from '@/components/timetable/simple/SimpleHeaderHelpers';
import { resetSimpleWorkspaceFilters } from '@/components/timetable/simple/SimpleHeaderHelpers';
import { deriveSimpleLifecycleAction } from '@/lib/simple-timetable-state';
import { resolveTimetableLoadingIntent } from '@/components/timetable/timetable-route-loading-intent';
import { simpleSetupGuidance } from '@/components/timetable/TimetableSetupPane';
import { buildProgramContextNote } from '@/components/scheduling-policy/policyPaneModel';
import { ShiftSettingsEditor } from '@/components/scheduling-policy/ShiftSettingsEditor';
import { DEFAULT_PROGRAM_WINDOW_OPTIONS, type LocalGradeWindow } from '@/components/scheduling-policy/SchedulingPolicyDialogs';

const clientRoot = resolve(import.meta.dirname, '../../..');
const source = (path: string) => readFileSync(resolve(clientRoot, path), 'utf8');

function context(overrides: Record<string, unknown> = {}) {
	return {
		isPreGenerationWorkspace: false,
		schoolYearContext: { activeSchoolYearLabel: '2030-2031' },
		draft: null,
		summary: null,
		blockingHardCount: 0,
		softCount: 0,
		programFilter: 'all',
		entryKindFilter: 'all',
		severityFilter: 'all',
		...overrides,
	} as never;
}

test('Simple lifecycle labels describe the schedule and next action in plain language', () => {
	assert.equal(readinessLabel(context({ isPreGenerationWorkspace: true })), 'Working schedule draft');
	assert.equal(readinessLabel(context({ isPreGenerationWorkspace: true, curriculumReadiness: { state: 'loading', message: 'technical diagnostic' } })), 'Checking schedule information…');
	assert.equal(readinessLabel(context({ isPreGenerationWorkspace: true, curriculumReadiness: { state: 'failed', message: 'technical diagnostic' } })), 'Schedule check needs retry');
	assert.equal(resolveTimetableLoadingIntent('/timetable/setup')?.title, 'Check schedule information');
	assert.equal(resolveTimetableLoadingIntent('/timetable/setup')?.message,
		'ATLAS is checking the school year and schedule information. No changes are made by this check.');
	const published = renderToStaticMarkup(createElement(SimplePublishedState, { followUpCount: 0 }));
	// SUPERSEDED (LANE-C C03 B4): assert.match(published, /Published schedule — view only/);
	assert.match(published, />Published schedule</);
	assert.match(published, /Changes start on a date you choose/);
	assert.doesNotMatch(published, /view only/);
	assert.doesNotMatch(published, /Published — read only/);
	assert.match(source('src/components/timetable/simple/SimpleDriftBanner.tsx'), /Schedule information changed/);
	assert.match(source('src/lib/simple-timetable-state.ts'), /Checking schedule information…/);
});

test('ordinary stale notice offers one safe setup action and promises the current schedule stays unchanged', () => {
	const drift = source('src/components/timetable/simple/SimpleDriftBanner.tsx');
	assert.match(drift, /The current schedule stays unchanged while you review school information\./i);
	assert.doesNotMatch(drift, /Sync with setup|Refresh before publishing|Update schedule now/);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /showActions=\{false\}/, 'ordinary timetable notice must use its single-action form');
	assert.match(header, /<Link to="\/timetable\/setup">[\s\S]*\{showDriftState \? 'Check school information' : 'School information'\}/);
	assert.match(header, /data-testid="timetable-simple-review-setup"/);
	assert.doesNotMatch(drift, /timetable-simple-check-school-information/, 'the existing setup CTA is reused rather than duplicated');
});

test('shift editor progressively groups descriptive schedules without changing window callbacks or technical copy', () => {
	const editor = source('src/components/scheduling-policy/ShiftSettingsEditor.tsx');
	assert.match(editor, /Accordion, AccordionContent, AccordionItem, AccordionTrigger/);
	assert.match(editor, /Grade \{group\.gradeLevel\} · \{scheduleLabel\}/);
	assert.match(editor, /Add schedule window/);
	assert.doesNotMatch(editor, /Override #|Add Override|EnrollPro|upstream|ownership|TLE-specialization/i);
	assert.match(editor, /onApplyFullDayPreset\}/);
	assert.match(editor, /onApplyHalfDayPreset\}/);
	assert.match(editor, /onAddOverride\}/);
	assert.match(editor, /onRemove\(index\)/);
	assert.match(editor, /onUpdate\(index, 'gradeLevel'/);
	assert.match(editor, /onUpdate\(index, 'programType'/);
	assert.match(editor, /onUpdate\(index, 'startTime'/);
	assert.match(editor, /onUpdate\(index, 'endTime'/);
	assert.match(editor, /Changes are not saved automatically/);
	assert.doesNotMatch(editor, /<details\b/);
	const dialog = source('src/components/scheduling-policy/SchedulingPolicyDialogs.tsx');
	assert.match(dialog, /Add a schedule window/);
	assert.match(dialog, /Add schedule window/);
	const pane = source('src/components/SchedulingPolicyPane.tsx');
	assert.match(pane, /isDirty/);
	assert.match(pane, /Save Policy/);
	const context = buildProgramContextNote(null);
	assert.doesNotMatch(context, /EnrollPro|upstream|ownership|feed|specialization/i);
	assert.match(context, /Program choices are based on the sections set up for this school year/);
	const sectionContext = buildProgramContextNote({ sections: [{ programType: 'SPTVE', tleSpecialization: 'CARPENTRY' }] } as never);
	assert.match(sectionContext, /Technology and Livelihood Education focus/);
	assert.doesNotMatch(sectionContext, /SPTVE|CARPENTRY|EnrollPro|upstream|ownership|feed|specialization/i);
	const windows = [7, 8, 9, 10].flatMap((gradeLevel) => ['ALL', 'REGULAR', 'STE', 'SPS', 'SPA'].map((programType): LocalGradeWindow => ({
		gradeLevel,
		programType: programType === 'ALL' ? null : programType as LocalGradeWindow['programType'],
		startTime: '07:00',
		endTime: '16:00',
	})));
	const markup = renderToStaticMarkup(createElement(ShiftSettingsEditor, {
		shiftWindows: windows,
		onAddOverride: () => {},
		onApplyFullDayPreset: () => {},
		onApplyHalfDayPreset: () => {},
		onRemove: () => {},
		onUpdate: () => {},
		gradeLevels: [7, 8, 9, 10],
		programOptions: DEFAULT_PROGRAM_WINDOW_OPTIONS,
		programContextNote: sectionContext,
	}));
	assert.equal((markup.match(/data-slot="accordion-item"/g) ?? []).length, 20, 'all twenty schedule groups remain available behind progressive disclosure');
	assert.match(markup, /Grade 7 · Morning schedule/);
	assert.match(markup, /Grade 9 · Afternoon schedule/);
	assert.match(markup, /data-state="closed"/, 'schedule windows start collapsed until a group is opened');
	assert.doesNotMatch(markup, /Override #|Add Override|EnrollPro|upstream|ownership|CARPENTRY/i);
});

test('entering the Simple workspace clears old grid filters without deleting filter behavior elsewhere', () => {
	const cleared: string[] = [];
	resetSimpleWorkspaceFilters({
		programFilter: 'special',
		entryKindFilter: 'subject',
		severityFilter: 'hard',
		setProgramFilter: (value: string) => cleared.push(`program:${value}`),
		setEntryKindFilter: (value: string) => cleared.push(`entry:${value}`),
		setSeverityFilter: (value: string) => cleared.push(`attention:${value}`),
	} as never);
	assert.deepEqual(cleared, ['program:all', 'entry:all', 'attention:all']);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /resetSimpleWorkspaceFilters\(context\)/);
	assert.doesNotMatch(header, /SimpleFilterControls|SimpleActiveFilterChips/);
	const workspaceState = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(workspaceState, /const \[programFilter, setProgramFilter\] = useState/);
	assert.match(workspaceState, /const \[entryKindFilter, setEntryKindFilter\] = useState/);
	assert.match(workspaceState, /const \[severityFilter, setSeverityFilter\] = useState/,
		'underlying review filtering remains available outside Simple header controls');
});

test('the 1366px header wraps intentionally instead of scrolling a one-line strip', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const row = header.match(/className="([^"]+)"\s+data-testid="timetable-simple-header-row"/)?.[1] ?? '';
	assert.match(row, /flex-col/);
	assert.doesNotMatch(row, /wide:flex-row|wide:flex-nowrap|overflow-x-auto/);
	assert.match(header, /className="flex min-w-0 flex-wrap items-center gap-1\.5"/);
	assert.doesNotMatch(header, /justify-start gap-1\.5 overflow-x-auto/);
});

test('timetable scroll regions use thin primary-token scrollbars in both browser engines', () => {
	const css = source('src/index.css');
	assert.match(css, /\.scrollbar-thin\s*\{\s*scrollbar-width:\s*thin;/);
	assert.match(css, /scrollbar-color:\s*hsl\(var\(--primary\)\)/);
	assert.match(css, /\.scrollbar-thin::-webkit-scrollbar\s*\{\s*height:\s*6px;\s*width:\s*6px;/);
	assert.doesNotMatch(css, /\.scrollbar-thin\s*\{\s*scrollbar-width:\s*auto;/);
});

test('readiness remains fail-closed while checking and becomes an actionable retry on failure', () => {
	const checking = deriveSimpleLifecycleAction({
		hasGeneratedRun: false,
		isPreGeneration: true,
		curriculumState: 'loading',
	});
	assert.equal(checking.kind, 'retry-readiness');
	assert.equal(checking.disabled, true);
	assert.equal(checking.interactive, false);
	assert.equal(checking.label, 'Checking schedule information…');
	for (const state of ['failed', 'unavailable'] as const) {
		const retry = deriveSimpleLifecycleAction({ hasGeneratedRun: false, isPreGeneration: true, curriculumState: state });
		assert.equal(retry.kind, 'retry-readiness');
		assert.equal(retry.label, 'Retry schedule check');
		assert.equal(retry.disabled, false);
		assert.equal(retry.interactive, true);
	}
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: false, isPreGeneration: true, curriculumState: 'loading' }).kind, 'retry-readiness');
});

test('setup guidance names what ATLAS found and the next safe step without claiming a change', () => {
	assert.match(simpleSetupGuidance({ state: 'loading' }), /ATLAS is checking schedule information/);
	assert.match(simpleSetupGuidance({ state: 'blocked' }), /Open Review readiness/);
	assert.match(simpleSetupGuidance({ state: 'failed' }), /Retry schedule check/);
	assert.match(simpleSetupGuidance({ state: 'ready' }), /ATLAS checked the schedule information/);
	for (const state of ['loading', 'blocked', 'failed', 'ready'] as const) {
		assert.doesNotMatch(simpleSetupGuidance({ state }), /updated|changed to/);
	}
});

test('selected class actions show one concise context and safe preview guidance', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /Selected: \{state\.subjectLabel\(state\.selectedEntry\.subjectId\)\} · \{state\.sectionLabel\(state\.selectedEntry\.sectionId\)\}/);
	assert.match(workspace, /Dismiss selection/);
	assert.match(workspace, /Choose a new time/);
	assert.match(workspace, /Swap with another class/);
	assert.match(workspace, /Review the change before saving/);
	assert.doesNotMatch(workspace, /Choose another occupied slot to review a swap/);
});

test('drift actions distinguish safe published review from draft preview and confirmation', () => {
	const drift = source('src/components/timetable/simple/SimpleDriftBanner.tsx');
	assert.match(drift, /Published schedule is safe to view/);
	assert.match(drift, /Review changes/);
	assert.match(drift, /Start a revision/);
	assert.match(drift, /Regenerate to apply/);
	assert.match(drift, /Nothing has changed yet/);
	assert.match(drift, /onClick=\{\(\) => setShowRegenerateImpact\(true\)\}/);
	assert.match(drift, /onConfirm=\{handleRegenerate\}/);
	assert.match(drift, /onClick=\{onStartRevision\}/);
	assert.doesNotMatch(drift, /Refresh before publishing|Direct sync|stale inputs/i);
});

test('term switcher is a standalone, complete ordered-term control', () => {
	const controls = source('src/components/timetable/simple/SimpleBeneficiaryControls.tsx');
	assert.match(controls, /<span[^>]*>Term<\/span>/);
	assert.match(controls, /Term \$\{option\.value\}/);
	assert.doesNotMatch(controls, /\(active\)|rounded-lg border border-border bg-muted\/20/);
	assert.match(controls, /onTermFilterChange\(next === 'all' \? 'all' : Number\(next\)\)/);
});

test('policy and shift editor use plain labels while retaining explicit technical values', () => {
	const policy = source('src/components/scheduling-policy/PolicyPanePrimitives.tsx');
	const shift = source('src/components/SchedulingPolicyPane.tsx');
	assert.match(policy, /Priority strength/);
	assert.match(policy, /Low.*Standard.*High/s);
	assert.match(policy, /Required/);
	assert.match(policy, /Preferred/);
	assert.match(policy, /Advanced details/);
	assert.match(shift, /Keep each class in one school-day shift/);
	assert.match(shift, /Morning schedule/i);
	assert.match(shift, /Afternoon schedule/i);
	assert.match(policy, /treatAsHard/);
	const policyPage = source('src/components/SchedulingPolicyPane.tsx');
	assert.match(policyPage, /data-testid="advanced-rules-guided-summary"/);
	assert.match(policyPage, /data-testid="edit-advanced-rules"/);
	assert.match(policyPage, /!showAdvancedRules/);
});

test('setup-name refresh states its limited effect and where to fix incorrect names', () => {
	const controls = source('src/components/timetable/simple/SimpleSetupSharedControls.tsx');
	assert.match(controls, /Refresh school names/);
	assert.match(controls, /selected school year only/);
	assert.match(controls, /does not change the schedule/);
	assert.match(controls, /check School information/);
});

test('highlighted select, menu, and selectable rows inherit readable semantic foregrounds', () => {
	const select = source('src/ui/select.tsx');
	const searchable = source('src/ui/searchable-select.tsx');
	const menu = source('src/ui/dropdown-menu.tsx');
	assert.match(select, /data-\[highlighted\]:text-primary-foreground/);
	assert.match(searchable, /hover:\[&_\*\]:text-accent-foreground/);
	assert.match(searchable, /focus:\[&_\*\]:text-accent-foreground/);
	assert.match(menu, /data-\[highlighted\]:text-accent-foreground/);
	assert.match(menu, /data-\[state=open\]:text-accent-foreground/);
});
