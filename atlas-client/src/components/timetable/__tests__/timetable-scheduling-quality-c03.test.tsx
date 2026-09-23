import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TimetableIssueRepairGuide } from '../TimetableIssueRepairGuide';

const clientRoot = resolve(import.meta.dirname, '../../../..');

test('C03 selected issue guide stays human-readable and exposes preview, not direct apply', () => {
	const context = {
		selectedRunId: '316', runs: [{ id: 316 }], schoolYearId: 10, defaultSchoolId: 1,
		VIOLATION_LABELS: { FACULTY_TIME_CONFLICT: 'Teacher double-booked' },
		sectionLabel: () => 'GR7 - Cedar', subjectLabel: () => 'Mathematics',
		formatConstraintMessage: () => 'A teacher has overlapping classes.',
		previewEdit: () => Promise.resolve(null),
	} as never;
	const markup = renderToStaticMarkup(createElement(TimetableIssueRepairGuide, {
		context,
		violation: {
			code: 'FACULTY_TIME_CONFLICT', severity: 'HARD', message: 'raw saved message',
			schoolId: 1, schoolYearId: 10, runId: 316,
			entities: { sectionId: 7, subjectId: 4, entryIds: ['entry-1'] }, meta: { termIndex: 1 },
		},
	}));
	assert.match(markup, /Selected issue repair guide/);
	assert.match(markup, /Teacher double-booked/);
	assert.match(markup, /A teacher has overlapping classes\./);
	assert.doesNotMatch(markup, /FACULTY_TIME_CONFLICT|fingerprint|source revision/i);
	assert.doesNotMatch(markup, /Preview & Apply|Apply now/i);
	const componentSource = readFileSync(resolve(clientRoot, 'src/components/timetable/TimetableIssueRepairGuide.tsx'), 'utf8');
	assert.match(componentSource, /context\.previewEdit\(option\.proposal\)/, 'each option must enter the existing canonical preview flow');
	assert.match(componentSource, /violation-repair-options/);
	assert.match(componentSource, /setLoading\(true\)/, 'the guide exposes a pending verification state');
	assert.match(componentSource, /setResult\(data\)/, 'only the server response supplies verified options');
	assert.match(componentSource, /setError\('Verified repair guidance could not be loaded/);
	assert.match(componentSource, /result\?\.status !== 'REPAIRABLE'/, 'policy and no-safe results render guidance, not an option');
	assert.match(componentSource, /Projected:.*hard change/);
	assert.doesNotMatch(componentSource, /manual-edits\/commit|\/apply/);
	assert.doesNotMatch(componentSource, /commitManualEdit|applyProposal|setSelectedViolation/, 'opening or previewing the guide cannot apply or advance an issue');
	const railSource = readFileSync(resolve(clientRoot, 'src/components/timetable/GeneratedRunRailPanels.tsx'), 'utf8');
	assert.match(railSource, /<TimetableIssueRepairGuide context=\{context\} violation=\{selectedViolation\} \/>/, 'the rendered issue panel owns the selected issue guide');
});
