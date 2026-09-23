import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { buildSectionLabel } from '@/lib/timetable-reference-labels';
import { simpleTutorialSteps } from '../simple/SimpleHeaderHelpers';

const clientRoot = resolve(import.meta.dirname, '../../../..');
const source = (path: string) => readFileSync(resolve(clientRoot, path), 'utf8');

test('C04 ordinary schedule chrome omits routine source, school-year, and run provenance', () => {
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	assert.doesNotMatch(header, /data-testid="timetable-source-truth"/, 'routine source provenance stays out of the ordinary header');
	assert.doesNotMatch(header, /School year #\$\{schoolYearId\}|schoolYearContext\?\.activeSchoolYearLabel/, 'ordinary status chrome does not repeat the year identity');
	assert.match(header, /termAuthorityNotice/, 'actionable unresolved-term guidance remains visible');
	assert.match(header, /newerFailedRunNotice/, 'a genuinely actionable run mismatch remains visible');
});

test('C04 selected section labels and chooser labels share the known canonical grade label', () => {
	const label = buildSectionLabel(new Map([[7, {
		id: 7,
		name: 'Luna',
		gradeLevelId: 17,
		displayOrder: 1,
		gradeLevelName: null,
		programType: 'REGULAR',
	} as any]]), (_type, code) => code ?? 'Special Program');
	assert.equal(label(7), 'GR7 - Luna');
	assert.equal(label(707), 'Section #707', 'an unknown section is not assigned an invented grade');
});

test('C04 user-facing schedule help says Expert and keeps stored layout identity unchanged', () => {
	const visibleCopy = simpleTutorialSteps('generated-reviewable').map((step) => `${step.title} ${step.body} ${step.target}`).join('\n');
	assert.doesNotMatch(visibleCopy, /\bAdvanced\b/i);
	assert.match(visibleCopy, /Expert view/);
	assert.match(source('src/components/timetable/ScheduleReviewWorkspace.tsx'), /atlas_timetable_layout_mode.*advanced/s, 'the persisted route/layout key does not change');
});

test('C04 the Simple draft header exposes Return to published when a published context is saved', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /data-testid="timetable-return-to-published"/);
	assert.match(header, /Return to published/);
});

test('C04 term scope and control fail closed together and term navigation avoids a full bootstrap', () => {
	const data = source('src/hooks/useTimetableData.ts');
	const state = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(data, /fallbackTermIndex[\s\S]{0,300}termFilter/);
	assert.doesNotMatch(data, /const loadAll = useCallback[\s\S]*?\}, \[[^\]]*termFilter/, 'term selection does not recreate the full bootstrap callback');
	assert.doesNotMatch(state, /const handleTermFilterChange[\s\S]*?setTermFilter\(value\)/, 'unresolved authority cannot leave All terms selected over a concrete fallback grid');
	assert.match(data, /queryKey: timetableRunBundleQueryKey\(currentScope\)/, 'term data remains term-scoped');
});

test('C04 issue activation uses the violation canonical teacher, not an unrelated first entry', () => {
	const mutations = source('src/hooks/useTimetableMutations.ts');
	assert.match(mutations, /v\.entities\.facultyId/, 'teacher identity comes from the canonical violation when present');
	assert.match(mutations, /entryIds[\s\S]{0,160}facultyId[\s\S]{0,160}canonicalFaculty/, 'the affected entry is matched to the canonical teacher');
});

test('C04 school branding has a local visual fallback after the configured logo fails', () => {
	const sidebar = source('src/components/app-shell/AppSidebar.tsx');
	assert.match(sidebar, /onError=/, 'the failed image switches to the existing local school icon');
	assert.match(sidebar, /<School/, 'fallback remains a local icon rather than a network retry');
});
