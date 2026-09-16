/**
 * AUTHZ-CLASS-TEMPLATE-C07R1 — Audit section-coverage truthfulness.
 *
 * Failing-first: the PRE-FIX page treated a fulfilled class-templates read as
 * proof that coverage could be checked. With `templates: []` (now a normal
 * response after the write-on-read seeding was removed) it pushed no degraded
 * reason, skipped every section in `rosterGaps`, and rendered the GREEN empty
 * state ("Sections have required coverage"). These tests reject exactly that
 * decision: an empty fulfilled class-template list must never yield a green
 * coverage claim.
 *
 * Run: `npx tsx --test src/lib/__tests__/audit-section-coverage.test.ts`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	CLASS_TEMPLATES_NOT_INITIALIZED_REASON,
	CLASS_TEMPLATES_UNAVAILABLE_REASON,
	assessSectionCoverage,
	classifyClassTemplateEvidence,
	collectSectionProgramCodesWithoutTemplate,
	type SectionCoverageAssessment,
} from '../audit-section-coverage';

const clientRoot = resolve(import.meta.dirname, '../../..');

const SECTION_REGULAR = { id: 1, name: '7-A', displayOrder: 7, programCode: 'REGULAR' };
const SECTION_STE = { id: 2, name: '7-B', displayOrder: 7, programCode: 'STE' };
const TEMPLATE_REGULAR = { id: 11, programType: 'REGULAR' };
const TEMPLATE_STE = { id: 12, programType: 'STE' };

/**
 * Mirrors the page's verdict rule: the readiness verdict is green only when the
 * evidence source is usable AND at least one blocker finding exists would not be
 * the case. A `blocker` finding is what keeps the page out of the green state.
 */
function greenSectionStateReachable(
	findings: ReadonlyArray<{ severity: string }>,
	dataSource: 'live' | 'cached' | 'none',
): boolean {
	const blockerCount = findings.filter((finding) => finding.severity === 'blocker').length;
	return dataSource !== 'none' && blockerCount === 0;
}

function sectionFindingsFor(assessment: SectionCoverageAssessment): Array<{ severity: string }> {
	return assessment.unresolvedFinding ? [assessment.unresolvedFinding] : [];
}

test('an empty fulfilled class-template list never yields a green section-coverage claim', () => {
	const assessment = assessSectionCoverage({ templates: [], available: true, sections: [SECTION_REGULAR] });

	assert.equal(classifyClassTemplateEvidence([], true), 'NOT_INITIALIZED');
	assert.equal(assessment.state, 'NOT_INITIALIZED');
	assert.equal(assessment.coverageUnverified, true, 'coverage must be reported as unverified');
	assert.equal(assessment.degradedReason, CLASS_TEMPLATES_NOT_INITIALIZED_REASON, 'a degraded reason must be surfaced');
	assert.ok(assessment.unresolvedFinding, 'an explicit unresolved finding must be surfaced');

	const finding = assessment.unresolvedFinding;
	assert.equal(finding.severity, 'blocker', 'the finding must be non-green');
	assert.match(finding.title, /UNRESOLVED/, 'the finding must be explicitly UNRESOLVED');
	assert.match(finding.detail, /could not verify section-subject coverage/i);
	assert.match(finding.detail, /no class templates are initialized/i);

	// The exact pre-fix outcome this test rejects: zero findings => green state.
	assert.equal(
		greenSectionStateReachable([], 'live'),
		true,
		'control: with no findings the page would render the green empty state',
	);
	assert.equal(
		greenSectionStateReachable(sectionFindingsFor(assessment), 'live'),
		false,
		'an empty class-template list must never reach the green section state',
	);
});

test('a rejected class-templates read keeps its existing reason and is unresolved too', () => {
	const assessment = assessSectionCoverage({ templates: [], available: false, sections: [SECTION_REGULAR] });

	assert.equal(assessment.state, 'UNAVAILABLE');
	assert.equal(assessment.coverageUnverified, true);
	assert.equal(assessment.degradedReason, CLASS_TEMPLATES_UNAVAILABLE_REASON, 'the existing rejected-promise reason is preserved');
	assert.equal(assessment.unresolvedFinding?.severity, 'blocker');
	assert.equal(greenSectionStateReachable(sectionFindingsFor(assessment), 'live'), false);
	assert.equal(greenSectionStateReachable(sectionFindingsFor(assessment), 'cached'), false);
});

test('a template matching every loaded section leaves coverage verified (no over-strict regression)', () => {
	const assessment = assessSectionCoverage({
		templates: [TEMPLATE_REGULAR, TEMPLATE_STE],
		available: true,
		sections: [SECTION_REGULAR, SECTION_STE],
	});

	assert.equal(assessment.state, 'INITIALIZED');
	assert.equal(assessment.coverageUnverified, false);
	assert.equal(assessment.degradedReason, null);
	assert.equal(assessment.unresolvedFinding, null);
	assert.deepEqual(assessment.sectionsWithoutTemplate, []);
	assert.equal(greenSectionStateReachable(sectionFindingsFor(assessment), 'live'), true, 'a fully covered roster may still be green');
});

test('a section whose program type has no template is surfaced instead of silently skipped', () => {
	const assessment = assessSectionCoverage({
		templates: [TEMPLATE_REGULAR],
		available: true,
		sections: [SECTION_REGULAR, SECTION_STE],
	});

	assert.deepEqual(collectSectionProgramCodesWithoutTemplate([TEMPLATE_REGULAR], [SECTION_REGULAR, SECTION_STE]), ['STE']);
	assert.equal(assessment.coverageUnverified, true, 'the uncovered section must not be skipped');
	assert.equal(assessment.unresolvedFinding?.severity, 'blocker');
	assert.match(assessment.unresolvedFinding?.detail ?? '', /STE/, 'the finding names the unmatched program type');
	assert.equal(greenSectionStateReachable(sectionFindingsFor(assessment), 'live'), false);
});

test('sections that expose no program code do not fabricate a blocker', () => {
	const assessment = assessSectionCoverage({
		templates: [TEMPLATE_REGULAR],
		available: true,
		sections: [{ id: 3, name: 'No code' }, SECTION_REGULAR],
	});

	assert.deepEqual(assessment.sectionsWithoutTemplate, []);
	assert.equal(assessment.coverageUnverified, false);
	assert.equal(assessment.unresolvedFinding, null);
});

test('only a fully matched template set can reach the green section state', () => {
	const cases: Array<{ templates: any[]; available: boolean; sections: any[]; verdict: boolean }> = [
		{ templates: [], available: true, sections: [SECTION_REGULAR], verdict: false },
		{ templates: [], available: false, sections: [SECTION_REGULAR], verdict: false },
		{ templates: [TEMPLATE_REGULAR], available: true, sections: [SECTION_STE], verdict: false },
		{ templates: [TEMPLATE_REGULAR], available: true, sections: [SECTION_REGULAR], verdict: true },
		{ templates: [TEMPLATE_REGULAR, TEMPLATE_STE], available: true, sections: [SECTION_REGULAR, SECTION_STE], verdict: true },
		{ templates: [TEMPLATE_REGULAR], available: true, sections: [], verdict: true },
	];

	for (const testCase of cases) {
		const assessment = assessSectionCoverage(testCase);
		assert.equal(
			greenSectionStateReachable(sectionFindingsFor(assessment), 'live'),
			testCase.verdict,
			`green reachable must be ${testCase.verdict} for templates=${JSON.stringify(testCase.templates)} sections=${JSON.stringify(testCase.sections)}`,
		);
	}
});

test('Audit.tsx consumes the helper decision instead of inferring coverage from the read', () => {
	const source = readFileSync(resolve(clientRoot, 'src/pages/Audit.tsx'), 'utf8');

	assert.ok(
		source.includes("import { assessSectionCoverage, type SectionCoverageAssessment } from '@/lib/audit-section-coverage';"),
		'Audit.tsx must import the section-coverage decision helper',
	);
	assert.ok(
		source.includes('const coverage = assessSectionCoverage({'),
		'Audit.tsx must call the helper for the loaded template/section evidence',
	);
	assert.ok(source.includes('setSectionCoverage(coverage);'), 'Audit.tsx must keep the assessment in state');
	assert.ok(
		source.includes('const unresolvedCoverageFinding: Finding | null = sectionCoverage?.unresolvedFinding ?? null;'),
		'Audit.tsx must read the unresolved finding from the assessment',
	);
	assert.ok(
		source.includes('...(unresolvedCoverageFinding ? [unresolvedCoverageFinding] : []),'),
		'Audit.tsx must render the unresolved finding inside the section-coverage group',
	);
	assert.equal(
		source.includes("reasons.push('Class templates are unavailable.');"),
		false,
		'the inline rejected-promise branch must be replaced by the single helper decision',
	);
	assert.equal(
		source.includes("toast.error('Initialize class templates')"),
		false,
		'no initialize affordance or write action may be added to the client',
	);
});
