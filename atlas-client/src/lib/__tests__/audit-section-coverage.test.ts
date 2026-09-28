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
	type ClassTemplateEvidenceState,
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

	// ── SUPERSEDED IN BEHAVIOUR 2026-09-28 c9: the raw enum must not reach an operator ──
	//
	// The original assertion, retained VERBATIM and marked superseded, never deleted
	// (AGENTS.md §16: a correction is additive to evidence, never subtractive):
	//
	//   assert.match(finding.title, /UNRESOLVED/, 'the finding must be explicitly UNRESOLVED');
	//
	// WHY IT IS SUPERSEDED, NOT VIOLATED: the thing it protected is still protected, by the
	// assertions beside it. It demanded that a raw internal enum value — `UNRESOLVED` — be VISIBLE
	// to an operator reading the Audit page.
	// `UNRESOLVED` is a machine state, not a sentence. An operator asking "what is wrong with my
	// sections" cannot act on it; the sibling `detail` and `why` fields, which are already calm
	// plain sentences, are what they act on. Requiring the enum in the title made the finding
	// LESS usable in order to be more explicit.
	//
	// CORRECTION 2026-09-28 (this file, A3-C9 bounded correction). This block ALSO carried a
	// second, false claim, retained above verbatim as the record of the error:
	//
	//     "`UNRESOLVED`, one of the three members of the `ClassTemplateEvidenceState` union
	//      declared 100 lines up in src/lib/audit-section-coverage.ts"
	//
	// THAT WAS NEVER TRUE. The union is `INITIALIZED | NOT_INITIALIZED | UNAVAILABLE` — proven
	// literally by the assertion in "no other operator-facing string in the module leaks a raw
	// enum" below, which matches the declaration text itself. `UNRESOLVED` was a word in the old
	// English TITLE STRING and was never a member of the type. The corrected union is stated here
	// beside the error, and asserted for real by `UNRESOLVED IS NOT A UNION MEMBER` below.
	//
	// What replaces it, immediately below, is strictly STRONGER on both halves the old row was
	// reaching for:
	//   · the NO-RAW-ENUM row, which forbids the leak this cycle exists to close; and
	//   · the STILL-UNMISTAKABLY-A-BLOCKER row, which keeps the old row's real purpose — the
	//     finding must be unmistakably a blocker — while refusing to insist the enum is how that
	//     is communicated.
	// The old assertion is therefore recorded here, not executed, so a reviewer can see exactly
	// what was demanded, when, and why it no longer holds. The equivalent row in the companion
	// case below is where the live assertions live, because the guarantee is about ALL THREE
	// findings, not just this one.
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

test('NO RAW ENUM IN OPERATOR-FACING STRINGS: no title leaks a machine state or a SCREAMING_SNAKE token', () => {
	// A3-C9 REPLACEMENT (additive) for the superseded `/UNRESOLVED/` title assertion in the first
	// test case. See the SUPERSEDED block there for why, and for the verbatim original.
	//
	// The leak is real and was reachable by a reader: `UNRESOLVED`, `UNAVAILABLE` and
	// `NOT_INITIALIZED` are the three members of the `ClassTemplateEvidenceState` union, and the
	// operator-facing `title` of every finding embedded one of them. The fix belongs in the
	// string, not in the enum: the enum is load-bearing TYPE STATE and three separate branches
	// key off it, so renaming or removing a member would be a real behaviour change.
	//
	// CORRECTION 2026-09-28 (A3-C9 bounded correction): the first sentence above is FALSE and is
	// retained verbatim only as the record of the error. The three members of the union are
	// `INITIALIZED`, `NOT_INITIALIZED` and `UNAVAILABLE`. `UNRESOLVED` is NOT a member of the
	// type at all — it was a word in the old English title string. The real leak the row below
	// closes is therefore narrower and more precise than the paragraph claimed: of the three
	// genuine members, `UNAVAILABLE` and `NOT_INITIALIZED` were the ones that reached the DOM,
	// and `UNRESOLVED` was a fourth, non-member token that leaked the same way. All four are
	// still checked below, because the guarantee is "no machine-state token in a title", which
	// holds regardless of which words happen to be type members.
	//
	// Built from the REAL module output for all three blocking states rather than from a
	// hand-written fixture, so a new leak in a fourth branch is caught by construction.
	const assessments: SectionCoverageAssessment[] = [
		assessSectionCoverage({ templates: [], available: true, sections: [SECTION_REGULAR] }),
		assessSectionCoverage({ templates: [], available: false, sections: [SECTION_REGULAR] }),
		assessSectionCoverage({ templates: [TEMPLATE_REGULAR], available: true, sections: [SECTION_REGULAR, SECTION_STE] }),
	];

	// Every member of the internal state union, plus the general shape of a leaked enum.
	const RAW_ENUM_TOKENS = ['UNRESOLVED', 'UNAVAILABLE', 'NOT_INITIALIZED', 'INITIALIZED'];

	for (const assessment of assessments) {
		const finding = assessment.unresolvedFinding;
		assert.ok(finding, 'each blocking state must still produce a finding');
		const state = assessment.state;

		for (const token of RAW_ENUM_TOKENS) {
			assert.equal(
				finding.title.includes(token),
				false,
				`the operator-facing title for state ${state} leaks the raw enum token ${token}: ` +
					`"${finding.title}". An operator cannot act on a machine state; the detail and why fields ` +
					'already say it in plain language and must stay the fields that carry the reason.',
			);
		}

		// A general SCREAMING_SNAKE detector, so a FUTURE leak with a different token name is
		// caught too, not only the three enumerated above. Deliberately loose: it must not be
		// satisfied by checking the known list, or it would add nothing.
		assert.equal(
			/\b[A-Z][A-Z0-9]*(_[A-Z0-9]+)+\b/.test(finding.title),
			false,
			`the operator-facing title for state ${state} contains a SCREAMING_SNAKE token: "${finding.title}". ` +
				'That is an internal identifier leaking into operator copy.',
		);

		// The title must still be a real sentence that says what is wrong — an empty or
		// contentless title would pass a "no enum" check while telling the operator nothing.
		assert.ok(
			finding.title.trim().length > 20,
			`the title for state ${state} is too short to be an operator-facing sentence: "${finding.title}".`,
		);
		assert.match(finding.title, /^Section coverage\b/, 'the title must still name what is wrong');
	}

	// The enum itself is untouched: the branches still key off it, so the guarantee above is a
	// copy guarantee, not a state-machine change.
	assert.equal(classifyClassTemplateEvidence([], true), 'NOT_INITIALIZED', 'the state union is unchanged');
	assert.equal(classifyClassTemplateEvidence([], false), 'UNAVAILABLE', 'the state union is unchanged');
	assert.equal(
		classifyClassTemplateEvidence([TEMPLATE_REGULAR], true),
		'INITIALIZED',
		'the state union is unchanged',
	);
});

test('UNRESOLVED IS NOT A UNION MEMBER: the type and the prose now agree', () => {
	// A3-C9 BOUNDED CORRECTION, additive. The two blocks above (and the module's own doc comment)
	// asserted that `UNRESOLVED` is a member of `ClassTemplateEvidenceState`. It never was. The
	// union is exactly `INITIALIZED | NOT_INITIALIZED | UNAVAILABLE`, which the test near the
	// bottom of this file already proved by matching the declaration text literally — so this
	// range was contradicting itself 150 lines apart.
	//
	// This row states the truth three ways, because the defect was a claim about a TYPE and only
	// one of the three can be checked from each side of that boundary.
	//
	// DISCLOSED LIMITATION: the third control is a source-text assertion. It is included
	// deliberately and is genuinely failing-first, but a string in a comment is not behaviour —
	// it is here to catch the exact regression, a false claim re-appearing in the prose, and it
	// is NOT offered as evidence that the AUDIT PAGE renders anything correctly. The first two
	// controls are the ones that carry real weight.

	// (1) TYPE LEVEL. If a future edit ever adds `UNRESOLVED` to the union, this
	// `@ts-expect-error` becomes unused and `npx tsc --noEmit` FAILS. It is load-bearing in the
	// typecheck gate, not merely decorative.
	// @ts-expect-error `UNRESOLVED` is NOT a member of ClassTemplateEvidenceState
	const notAState: ClassTemplateEvidenceState = 'UNRESOLVED';
	assert.equal(typeof notAState, 'string', 'control: the constant above must still be constructed');

	// (2) BEHAVIOUR. The set of states the module can actually produce, over the whole input
	// domain, is exactly the three declared members — and `UNRESOLVED` is not among them. Built
	// from real calls, so it cannot drift from the implementation the way a comment can.
	const produced = new Set<ClassTemplateEvidenceState>([
		classifyClassTemplateEvidence([], true),
		classifyClassTemplateEvidence([], false),
		classifyClassTemplateEvidence([TEMPLATE_REGULAR], true),
		classifyClassTemplateEvidence([TEMPLATE_REGULAR, TEMPLATE_STE], false),
	]);
	assert.deepEqual(
		[...produced].sort(),
		['INITIALIZED', 'NOT_INITIALIZED', 'UNAVAILABLE'],
		'the module must produce exactly the three declared union members, over the whole input domain',
	);
	assert.equal(
		produced.has('UNRESOLVED' as ClassTemplateEvidenceState),
		false,
		'UNRESOLVED must not be a producible state; it was a word in the old title string only',
	);

	// (3) PROSE. Both files must now carry the corrected claim, and the false one only as
	// explicitly-marked superseded evidence. Fails at the pre-correction revision of either file.
	const moduleSource = readFileSync(resolve(clientRoot, 'src/lib/audit-section-coverage.ts'), 'utf8');
	assert.match(
		moduleSource,
		/`UNRESOLVED` is NOT a member of the/,
		'the module doc comment must state the corrected claim beside the retained false one',
	);
	const selfSource = readFileSync(resolve(import.meta.filename), 'utf8');
	assert.match(
		selfSource,
		/THAT WAS NEVER TRUE/,
		'this file must state the corrected claim beside the retained false one',
	);
});

test('STILL UNMISTAKABLY A BLOCKER: removing the enum does not weaken any repair affordance', () => {
	// A3-C9 REPLACEMENT (additive) for the second half of the superseded assertion. The old row
	// wanted the finding to be "explicitly UNRESOLVED"; this wants it to be an explicit BLOCKER
	// with a complete, calm, actionable repair path — the requirement behind that row, minus the
	// enum.
	for (const assessment of [
		assessSectionCoverage({ templates: [], available: true, sections: [SECTION_REGULAR] }),
		assessSectionCoverage({ templates: [], available: false, sections: [SECTION_REGULAR] }),
		assessSectionCoverage({ templates: [TEMPLATE_REGULAR], available: true, sections: [SECTION_REGULAR, SECTION_STE] }),
	]) {
		const finding = assessment.unresolvedFinding;
		assert.ok(finding, 'a finding must exist');
		const state = assessment.state;

		// 1. It is still a blocker, which is what keeps the page out of the green state.
		assert.equal(finding.severity, 'blocker', `severity must stay blocker for ${state}`);
		assert.equal(
			greenSectionStateReachable(sectionFindingsFor(assessment), 'live'),
			false,
			`${state} must never reach the green section state`,
		);

		// 2. The repair path is intact: where to go, what to fix, what to press.
		assert.equal(finding.route, '/sections', `route must stay /sections for ${state}`);
		assert.equal(finding.repairTarget, 'sections', `repairTarget must stay sections for ${state}`);
		assert.ok(finding.actionLabel.length > 0, `actionLabel must stay populated for ${state}`);

		// 3. The calm sentences are the ones that now carry the whole reason, so they must
		//    survive: they are the fields the operator actually reads.
		assert.ok(finding.blockedLabel.length > 0, `blockedLabel must stay populated for ${state}`);
		// NOTE ON WORDING: the three `detail` strings are NOT identical, and this row
		// deliberately does not force them to be. The unmatched-program branch names the
		// specific program types ("No class template exists for: STE...") where the other two
		// describe the cause generally. What all three must share is the plain-language cause —
		// so that is the invariant asserted, not a phrase only two of the three use. Asserting
		// one branch's wording across all three would be a test over-constraint, and it was one
		// in the first draft of this row.
		assert.match(
			finding.detail,
			/class[- ]template/i,
			`detail must name the class-template cause in plain language for ${state}`,
		);
		assert.match(finding.why, /class[- ]template/i, `why must still explain the class-template cause for ${state}`);
		// The `why` field is what forbids the false clean claim; it must never be softened away.
		assert.match(finding.why, /must not be reported/i, `why must keep the no-clean-claim rule for ${state}`);

		// 4. Nothing operator-facing is empty, placeholder or machine-shaped.
		for (const field of ['title', 'blockedLabel', 'detail', 'why', 'actionLabel'] as const) {
			assert.ok(
				finding[field].trim().length > 0,
				`${field} must stay populated for ${state}; the enum is gone, so these fields carry the reason.`,
			);
		}
	}
});

test('no other operator-facing string in the module leaks a raw enum', () => {
	// A3-C9: the three titles are the leak the packet named, but the module also builds a
	// `degradedReason` that reaches the operator. This asserts the WHOLE module surface, read
	// from the real source, so a fourth leak added later is caught even if a test forgets to
	// exercise the branch that produces it.
	const source = readFileSync(resolve(clientRoot, 'src/lib/audit-section-coverage.ts'), 'utf8');

	// The type union is the legitimate home of these tokens.
	assert.ok(
		source.includes("export type ClassTemplateEvidenceState = 'INITIALIZED' | 'NOT_INITIALIZED' | 'UNAVAILABLE';"),
		'the state union is the legitimate home of the enum tokens; it must not be renamed away',
	);

	// COMMENTS ARE STRIPPED BEFORE THE SCAN, and that is a correctness requirement, not a
	// convenience. AGENTS.md §16 obliges a correction to retain the superseded leak VERBATIM,
	// and the A3-C9 note in the module does exactly that: it quotes the old title, including the
	// word UNRESOLVED, as the record of what was fixed. A raw-text scan would therefore flag
	// this file's own evidence of the fix. The leak being guarded against lives in STRING
	// LITERALS that reach the DOM; prose describing the fix is not rendered to an operator.
	//
	// A naive `${field}:\s*([^\n]+)` scan also silently mis-scanned: `\s` matches newlines, so a
	// comment line ENDING in "why:" consumed the following line and reported a leak that did not
	// exist. Stripping comments removes that class of false positive as a side effect.
	const code = source
		.replace(/\/\*[\s\S]*?\*\//g, '') // block comments
		.replace(/^[^\S\n]*\/\/[^\n]*$/gm, '') // whole-line comments
		.replace(/([:,'"`])([^\n]*?)\/\/[^\n]*$/gm, '$1$2'); // trailing comments on a code line

	// Every quoted string literal assigned to a field an operator reads.
	for (const field of ['title', 'blockedLabel', 'detail', 'why', 'actionLabel']) {
		const assignments = [...code.matchAll(new RegExp(`${field}:\\s*([^\\n]+)`, 'g'))];
		assert.ok(assignments.length > 0, `expected to find ${field} assignments in the module`);
		for (const [, value] of assignments) {
			for (const token of ['UNRESOLVED', 'UNAVAILABLE', 'NOT_INITIALIZED']) {
				assert.equal(
					value.includes(token),
					false,
					`the operator-facing ${field} leaks the raw enum token ${token}: ${value.trim()}`,
				);
			}
		}
	}

	// Proof the stripper is not vacuous: a quoted leak in a COMMENT is not flagged, and a quoted
	// leak in CODE still is. Both halves matter — the first is why §16 evidence is safe here.
	assert.equal(
		`// title: 'Section coverage is UNRESOLVED'`.replace(/^[^\S\n]*\/\/[^\n]*$/gm, '').includes('UNRESOLVED'),
		false,
		'the comment stripper must actually remove comments, or this control proves nothing',
	);
	assert.equal(
		`\t\ttitle: 'Section coverage is UNRESOLVED',`.includes('UNRESOLVED'),
		true,
		'control: a real code-level leak is still detectable after stripping',
	);

	// The degraded reasons the page appends to its evidence list are operator copy too.
	assert.equal(CLASS_TEMPLATES_NOT_INITIALIZED_REASON.includes('UNRESOLVED'), false);
	assert.equal(CLASS_TEMPLATES_UNAVAILABLE_REASON.includes('UNRESOLVED'), false);
	assert.equal(CLASS_TEMPLATES_NOT_INITIALIZED_REASON.includes('NOT_INITIALIZED'), false);
	assert.equal(CLASS_TEMPLATES_UNAVAILABLE_REASON.includes('UNAVAILABLE'), false);
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
