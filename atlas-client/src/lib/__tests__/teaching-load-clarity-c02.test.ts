/**
 * LANE-C TEACHING-LOAD-CLARITY-C02 — Teaching Load numbers and wording.
 *
 * The 2026-09-25 live audit (docs/reviews/ux-audit-teaching-load-and-schedule-controls-2026-09-25.md)
 * found: A1 "sections" counted per subject (Tolentino 5 for 3 sections); A2 the
 * teacher's own maximum and the school hard cap both called "cap"; A4/A5
 * technical wording ("pairs", "truth", "runtime cache", "Load arithmetic",
 * "Rotation deduction", "Peak weekly"); A6 internal codes instead of subject
 * names; A7 rotating subjects without their term; A8 guidance pointing at a
 * "shortage grid" when nothing was unassigned; A9 per-term peaks not labelled.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { countDistinctSections } from '../teaching-load-counts';
import { known, type TeachingLoadTruthModel } from '../teaching-load-authority-truth';
import { TeachingLoadTruthPanel } from '../../components/faculty-assignments/TeachingLoadTruthPanel';
import { WorkloadInspector } from '../../components/faculty-assignments/WorkloadInspector';
import { SectionInspector } from '../../components/faculty-assignments/SectionInspector';
import { StackedWorkloadBar } from '../../components/faculty-assignments/StackedWorkloadBar';
import { TooltipProvider } from '../../ui/tooltip';
import type { ExternalSection, FacultySummary, LoadProfile, RotationFamilyTermBreakdown, SectionAssignedClassesResult } from '../../types';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const withTooltips = (child: ReturnType<typeof createElement>) => createElement(TooltipProvider, null, child);

test('A1 a teacher who teaches two rotating subjects to one section counts that section once', () => {
	// Karen Tolentino, live 2026-09-25: Biology to Sampaguita; Chemistry to Mabini
	// and Tulip; Earth Science to Mabini and Tulip — three sections, not five.
	const assignments = [
		{ sectionIds: [301] },
		{ sectionIds: [302, 303] },
		{ sectionIds: [302, 303] },
	];
	assert.equal(countDistinctSections(assignments), 3);
	assert.equal(countDistinctSections([]), 0);
	assert.equal(countDistinctSections(undefined), 0);
	const grid = source('../../components/faculty-assignments/TeacherGridMode.tsx');
	assert.match(grid, /const sectionsCount = countDistinctSections\(/);
	assert.doesNotMatch(grid, /acc \+ a\.sectionIds\.length/, 'the per-subject sum is gone');
});

const model: TeachingLoadTruthModel = {
	requiredPairs: known(264),
	assignedPairs: known({ real: 264, placeholder: 0, total: 264 }),
	unresolvedPairs: known(0),
	actualTeachingMinutes: known(42_078),
	policyCapacity: known({ teachingStandardMinutes: 1_800, hardCapMinutes: 2_400 }),
	overload: known({ overStandardCount: 0, overHardCapCount: 0, excessMinutes: 0 }),
	remainingCapacityMinutes: known(33_528),
	zeroLoadFaculty: known({ count: 0, names: [] }),
	adviserStatus: known({ count: 0, names: [] }),
	advisoryCreditMinutes: known(0),
	excludedHgRows: known({ count: 0, explanation: '' }),
};

test('A2/A4 the summary uses plain words and names the school hard cap', () => {
	const markup = renderToStaticMarkup(withTooltips(createElement(TeachingLoadTruthPanel, { model, sourceRevision: 'r1', upstreamVerified: false })));
	for (const label of ['Teaching Load summary', 'Classes needing a teacher', 'Classes with a teacher', 'Still without a teacher', 'School hard cap', 'Hours still available', 'Teachers with no classes', 'Homeroom Guidance (not counted)', 'Every class has a teacher.', 'Using saved data']) {
		assert.ok(markup.includes(label), `shows "${label}"`);
	}
	assert.match(markup, /264 classes · 0 without a teacher/, 'the one-line summary reads naturally');
	// Test ids keep their stable names; only what the user reads is checked.
	const visible = markup.replace(/\s(data-testid|aria-label)="[^"]*"/g, '');
	assert.doesNotMatch(visible, /pairs|Teaching Load truth|runtime cache|HG excluded|Zero-load|Source not verified|real, /i, 'no jargon');
});

const selected = {
	id: 12, firstName: 'Karen', lastName: 'Tolentino', department: 'SCIENCE', maxHoursPerWeek: 30,
	isClassAdviser: false, advisedSectionName: null,
} as unknown as FacultySummary;

const loadProfile = {
	status: 'below-standard',
	statusLabel: 'Below standard',
	statusInstruction: undefined,
	actualTeachingHours: 7.5,
	rawTeachingHours: 18.8,
	rotationOvercountHours: 11.3,
	equivalentHours: 0,
	creditedTotalHours: 7.5,
	remainingHours: 22.5,
	breakdown: [
		{ subjectId: 1, sectionId: 302, subjectCode: 'SCI_CHEM', subjectName: 'Science - Chemistry', sectionName: 'Mabini', gradeLevel: 7, rotationFamily: 'SCIENCE', rotationTermLabel: 'Term 2' },
		{ subjectId: 2, sectionId: 302, subjectCode: 'SCI_ES', subjectName: 'Science - Earth Science', sectionName: 'Mabini', gradeLevel: 7, rotationFamily: 'SCIENCE', rotationTermLabel: 'Term 3' },
	],
} as unknown as LoadProfile;

const rotation = [{
	family: 'SCIENCE',
	peakTermMinutesPerWeek: 450,
	termBuckets: [
		{ termRank: 1, creditedMinutesPerWeek: 225, isPeakTerm: false },
		{ termRank: 2, creditedMinutesPerWeek: 450, isPeakTerm: true },
		{ termRank: 3, creditedMinutesPerWeek: 450, isPeakTerm: true },
	],
}] as unknown as RotationFamilyTermBreakdown[];

function renderInspector() {
	return renderToStaticMarkup(withTooltips(createElement(WorkloadInspector, {
		selected,
		loadProfile,
		rotationTermBreakdown: rotation,
		hoveredIncomingMinutes: 0,
		previewLoadHours: 0,
		isReadOnlyMode: false,
		activeTermIndex: 2,
		teachingStandardHours: 30,
		policyReady: true,
	})));
}

test('A5/A9 the teacher breakdown explains the busiest-term load in plain words', () => {
	const markup = renderInspector();
	assert.match(markup, /7\.5h a week \(busiest term\) · 30h standard/);
	assert.match(markup, /How this load is counted/);
	assert.match(markup, /Subjects that rotate by term count once/);
	assert.match(markup, /Teaching hours in the busiest term/);
	assert.match(markup, /Busiest term/);
	assert.match(markup, /Term 2/);
	assert.doesNotMatch(markup, /Load Arithmetic|Rotation Deduction|Total Classes Sum|Peak Weekly|Rotational Groups|>T2</i);
});

test('A6 the teacher breakdown names subjects, not internal codes', () => {
	const markup = renderInspector();
	assert.match(markup, /Science - Chemistry/);
	assert.match(markup, /Science - Earth Science/);
	assert.doesNotMatch(markup, /SCI_CHEM|SCI_ES/);
});

test('A8 guidance matches the teacher, with no pointer to a "shortage grid"', () => {
	const markup = renderInspector();
	assert.match(markup, /This teacher can take more classes \(up to the 30h standard\)\./);
	assert.doesNotMatch(markup, /shortage grid|Prioritize unassigned/i);
});

test('A2 the teacher bar names the per-teacher limit, never a bare "cap"', () => {
	const markup = renderToStaticMarkup(createElement(StackedWorkloadBar, { teachingHours: 7.5, creditHours: 0, maxHours: 30, standardHours: 30 }));
	assert.match(markup, /30h standard · 30h max for this teacher/);
	assert.doesNotMatch(markup, /h cap\b/i);
	assert.match(markup, /Teaching 7\.5h/);
	assert.doesNotMatch(markup, /\+0h credits/i, 'zero credit is not shown');
});

test('A6/A7 the section view names subjects and marks the term of rotating ones', () => {
	const section = { id: 302, name: 'Mabini', displayOrder: 7, programName: 'SPS', adviserName: null } as unknown as ExternalSection;
	const contract = {
		classes: [
			{ subjectId: 1, subjectCode: 'SCI_CHEM', subjectName: 'Science - Chemistry', rotationTermLabel: 'Term 2', specializationLabel: null },
			{ subjectId: 9, subjectCode: 'MATH', subjectName: 'Mathematics', rotationTermLabel: null, specializationLabel: null },
		],
		unassignedExpectedClasses: [],
	} as unknown as SectionAssignedClassesResult;
	const markup = renderToStaticMarkup(withTooltips(createElement(SectionInspector, {
		section,
		sectionContract: contract,
		effectiveOwnershipMap: {},
	})));
	assert.match(markup, /Science - Chemistry/);
	assert.match(markup, /Term 2 only/);
	assert.doesNotMatch(markup, /SCI_CHEM/);
	assert.match(markup, /2 subjects need a teacher/);
	assert.match(markup, /No teacher yet/);
	assert.doesNotMatch(markup, /Subjects Missing|Fully Staffed|potential optimizations/);
});

test('A4 page-level status lines use plain words', () => {
	assert.doesNotMatch(source('../../pages/TeachingLoad.tsx'), /live verification is available/);
	assert.doesNotMatch(source('../../hooks/useTeachingLoadData.ts'), /runtime cache while upstream verification/);
	assert.match(source('../../hooks/useTeachingLoadRepairQueue.ts'), /classes have a teacher\./);
	assert.doesNotMatch(source('../../components/faculty-assignments/WorkspaceToolbar.tsx'), />Unassigned pairs</);
	assert.doesNotMatch(source('../../components/faculty-assignments/SubjectRow.tsx'), /shares one weekly lane/);
});
