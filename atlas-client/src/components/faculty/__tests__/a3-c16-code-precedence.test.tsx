/**
 * A3-C16-CODE-PRECEDENCE — the two places where a CODE was deliberately
 * allowed to win over a NAME, which is what put an internal token in front of a
 * scheduler on a sheet whose every other row printed a name.
 *
 * These are behaviour assertions, not source-text assertions: both helpers are
 * the production functions the surfaces call, and the readiness row is produced
 * by the real `deriveSimplePublishReadiness` over a real-shaped draft report.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { deriveSimplePublishReadiness } from '@/components/timetable/simplePublishReadiness';
import { departmentLabel, programShortLabel } from '@/lib/deped-glossary';
import { sectionCoverageGapSubjectLabel } from '@/pages/Audit';

const clientRoot = resolve(import.meta.dirname, '../../../..');
const read = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');

/* ───────────── simplePublishReadiness: the LABEL wins over the code ───────── */

test('A3-c16-P1 the unassigned-cluster blocker prints the subject NAME, not its code', () => {
	// The exact precedence the packet named: the line used to read
	// `entry.subjectCode || subjectLabel(entry.subjectId)`, so the code always won
	// and the resolved name was dead code on this path.
	const draft: any = {
		summary: {
			resourceDiagnostics: {
				unassignedBySubjectGrade: [
					{ subjectId: 41, subjectCode: 'TLE_ICT_EXP', gradeLevel: 9, count: 2, reasons: { NO_QUALIFIED_TEACHER: 2 } },
				],
			},
		},
		unassignedItems: [],
	};
	const subjectLabel = (id: number) => (id === 41 ? 'TLE Exploratory - ICT' : 'Unknown subject');

	const readiness = deriveSimplePublishReadiness(draft, [], () => 'Section', subjectLabel, () => 'Teacher');

	const labels = readiness.blockerGroups.flatMap((group) => group.items.map((item) => item.subjectLabel));
	assert.ok(labels.length > 0, 'the unassigned cluster must produce blocker items');
	assert.deepEqual(
		[...new Set(labels)],
		['TLE Exploratory - ICT'],
		`the blocker must name the subject; saw ${JSON.stringify(labels)}`,
	);
	assert.doesNotMatch(labels.join(' | '), /TLE_ICT_EXP/, 'the raw code must not reach the publish-readiness sheet');
});

test('A3-c16-P1b the code is still the fallback when the label resolver cannot name it', () => {
	// A negative control: if the swap were `subjectLabel(...)` alone, this row
	// would render an empty subject line. The code must survive as the last resort.
	const draft: any = {
		summary: {
			resourceDiagnostics: {
				unassignedBySubjectGrade: [
					{ subjectId: 99, subjectCode: 'SCI_BIO', gradeLevel: 10, count: 1, reasons: { NO_QUALIFIED_TEACHER: 1 } },
				],
			},
		},
		unassignedItems: [],
	};
	const readiness = deriveSimplePublishReadiness(
		draft, [], () => 'Section', () => '', () => 'Teacher',
	);
	const labels = readiness.blockerGroups.flatMap((group) => group.items.map((item) => item.subjectLabel));
	assert.deepEqual([...new Set(labels)], ['SCI_BIO'], 'an unnameable subject falls back to its code, not to a blank');
});

test('A3-c16-P1c the unassigned-items blocker source already used the label, and still does', () => {
	// A preservation control: the precedence swap touched ONE line in ONE builder.
	// This pins the sibling builder so a blanket "swap every precedence" change
	// would be caught rather than inherited.
	const fromUnassigned = deriveSimplePublishReadiness(
		{
			unassignedItems: [{ key: 'k1', subjectId: 41, sectionId: 7, session: 1, state: 'NO_AVAILABLE_SLOT', reason: 'NO_AVAILABLE_SLOT' }],
			summary: null,
		} as any,
		[], () => 'Section', (id) => (id === 41 ? 'TLE Exploratory - ICT' : 'x'), () => 'Teacher',
	);
	const labels = fromUnassigned.blockerGroups.flatMap((group) => group.items.map((item) => item.subjectLabel));
	assert.ok(labels.length > 0, 'the unassigned item must produce a blocker row');
	assert.match(labels.join(' | '), /TLE Exploratory - ICT/);
});

/* ───────────────── Audit: the finding body agrees with its title ──────────── */

test('A3-c16-P2 the section-coverage finding names the subject the same way in title and body', () => {
	const gap = { subjectName: 'Applied Physics', subjectCode: 'STE_APPLIED_PHYS' };
	assert.equal(sectionCoverageGapSubjectLabel(gap), 'Applied Physics');
	// A blank name falls back to the code so the finding is never nameless.
	assert.equal(sectionCoverageGapSubjectLabel({ subjectName: '', subjectCode: 'STE_APPLIED_PHYS' }), 'STE_APPLIED_PHYS');
	// A gap with neither is named in words, never as an internal id.
	assert.equal(sectionCoverageGapSubjectLabel({ subjectName: null, subjectCode: null }), 'Unknown subject');

	// Belt-and-braces over the rendered claim: BOTH the title and the detail in
	// `pages/Audit.tsx` must go through the one helper. If a future change
	// re-splits them and one reverts to the raw code, this fails.
	const source = read('src/pages/Audit.tsx');
	const titleLine = source.split(/\r?\n/).find((l) => l.includes('is missing ${sectionCoverageGapSubjectLabel(gap)}')) ?? '';
	const detailLine = source.split(/\r?\n/).find((l) => l.includes('no assigned teacher for ${sectionCoverageGapSubjectLabel(gap)}')) ?? '';
	assert.ok(titleLine, 'the finding title must name the subject through the shared helper');
	assert.ok(detailLine, 'the finding body must name the subject through the same helper');
	assert.doesNotMatch(detailLine, /\$\{gap\.subjectCode\}/, 'the body must not revert to the raw code');
});

/* ───────── the committed glossary helpers this lane routed through ────────── */

test('A3-c16-P3 the department and program codes this lane replaced resolve to words', () => {
	// These are the two substitutions on surfaces outside the roster, so the
	// mapping itself is pinned rather than left to a reader's trust.
	assert.equal(departmentLabel('MATH'), 'Mathematics');
	assert.equal(departmentLabel('TLE'), 'Technology and Livelihood Education');
	// An unknown code falls back to the raw value: translating is a courtesy,
	// hiding data would be a lie.
	assert.equal(departmentLabel('ZZZ'), 'ZZZ');
	assert.equal(departmentLabel(null), 'General');

	assert.equal(programShortLabel('REGULAR'), 'Regular');
	assert.equal(programShortLabel('SPTVE'), 'SPTVE');
	assert.equal(programShortLabel('SPA'), 'SPA');
	assert.doesNotMatch(programShortLabel('REGULAR'), /^REGULAR$/, 'the raw enum must not survive');
});
