/**
 * AUTHZ-CLASS-TEMPLATE-C07R1 — Audit page section-coverage truthfulness.
 *
 * `atlas-client/src/pages/Audit.tsx` used to treat a FULFILLED class-template
 * read as proof that section coverage could be checked. After the class-template
 * authority correction removed the write-on-read seeding, `templates: []` became
 * a normal response, and the page then:
 *   - pushed no degraded reason (only the rejected-promise branch did),
 *   - skipped every section in `rosterGaps` because no template matched its
 *     `programCode`,
 *   - and therefore rendered the green empty state
 *     ("Sections have required coverage").
 *
 * This module owns the decision that the page must not make implicitly: given
 * the class-template evidence and the loaded sections, can section coverage be
 * VERIFIED? When it cannot, the page must surface a non-green, explicitly
 * UNRESOLVED finding for the section-coverage group and never claim coverage.
 *
 * The helper is pure (no React, no network) so it is directly testable.
 */

export const CLASS_TEMPLATES_NOT_INITIALIZED_REASON = 'Class templates are not initialized for this school.';
export const CLASS_TEMPLATES_UNAVAILABLE_REASON = 'Class templates are unavailable.';

export type ClassTemplateEvidenceState = 'INITIALIZED' | 'NOT_INITIALIZED' | 'UNAVAILABLE';

/**
 * Structural shape of the finding the page must render. It is intentionally
 * compatible with the page-local `Finding` type (including the `blocker`
 * severity, which is what keeps the overall verdict from rendering green).
 */
export interface SectionCoverageUnresolvedFinding {
	id: string;
	title: string;
	blockedLabel: string;
	detail: string;
	why: string;
	actionLabel: string;
	route: string;
	repairTarget: string;
	severity: 'blocker';
}

export interface SectionCoverageAssessment {
	state: ClassTemplateEvidenceState;
	/** true when the page must NOT claim section coverage is verified. */
	coverageUnverified: boolean;
	/** Reason to append to the page's degraded-evidence list, or null. */
	degradedReason: string | null;
	/** Distinct section `programCode` values with no matching class template. */
	sectionsWithoutTemplate: string[];
	/** The non-green finding the page must surface, or null when verified. */
	unresolvedFinding: SectionCoverageUnresolvedFinding | null;
}

/** A class-template row as returned by `GET /class-templates`. */
export interface ClassTemplateEvidenceRow {
	programType?: unknown;
	[key: string]: unknown;
}

/** A section row from the section summary. */
export interface SectionEvidenceRow {
	programCode?: unknown;
	[key: string]: unknown;
}

export interface SectionCoverageInput {
	/** `templates` from `GET /class-templates?schoolId=<actor school>`. */
	templates?: ReadonlyArray<ClassTemplateEvidenceRow | null | undefined> | null;
	/** Whether the class-templates read fulfilled (false = rejected promise). */
	available: boolean;
	/** Sections from the section summary, each with an optional `programCode`. */
	sections?: ReadonlyArray<SectionEvidenceRow | null | undefined> | null;
}

function nonEmptyString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function templateProgramTypes(templates: SectionCoverageInput['templates']): Set<string> {
	const list = Array.isArray(templates) ? templates : [];
	const types = new Set<string>();
	for (const template of list) {
		const programType = nonEmptyString(template?.programType);
		if (programType) types.add(programType);
	}
	return types;
}

/**
 * Distinct `programCode` values from the loaded sections that have no matching
 * class template. These are exactly the sections whose coverage the page used to
 * skip silently.
 */
export function collectSectionProgramCodesWithoutTemplate(
	templates: SectionCoverageInput['templates'],
	sections: SectionCoverageInput['sections'],
): string[] {
	const available = templateProgramTypes(templates);
	const missing = new Set<string>();
	const sectionList = Array.isArray(sections) ? sections : [];
	for (const section of sectionList) {
		const programCode = nonEmptyString(section?.programCode);
		if (programCode && !available.has(programCode)) missing.add(programCode);
	}
	return [...missing];
}

/**
 * Classify the class-template evidence. `available === false` means the read
 * rejected; `INITIALIZED` requires at least one template.
 */
export function classifyClassTemplateEvidence(
	templates: SectionCoverageInput['templates'],
	available: boolean,
): ClassTemplateEvidenceState {
	if (!available) return 'UNAVAILABLE';
	return templateProgramTypes(templates).size > 0 ? 'INITIALIZED' : 'NOT_INITIALIZED';
}

function notInitializedFinding(): SectionCoverageUnresolvedFinding {
	return {
		id: 'section-coverage-unresolved-not-initialized',
		title: 'Section coverage is UNRESOLVED: no class templates are initialized',
		blockedLabel: 'Section coverage cannot be verified.',
		detail: 'ATLAS could not verify section-subject coverage because no class templates are initialized for the loaded sections.',
		why: 'Class templates define which subjects each section requires. Without them ATLAS cannot check coverage, so a clean coverage result must not be reported.',
		actionLabel: 'Review sections',
		route: '/sections',
		repairTarget: 'sections',
		severity: 'blocker',
	};
}

function unavailableFinding(): SectionCoverageUnresolvedFinding {
	return {
		id: 'section-coverage-unresolved-unavailable',
		title: 'Section coverage is UNRESOLVED: class templates could not be loaded',
		blockedLabel: 'Section coverage cannot be verified.',
		detail: 'ATLAS could not verify section-subject coverage because the class-template evidence did not load.',
		why: 'Without the class templates ATLAS cannot know which subjects each section requires, so a clean coverage result must not be reported.',
		actionLabel: 'Review sections',
		route: '/sections',
		repairTarget: 'sections',
		severity: 'blocker',
	};
}

function unmatchedProgramFinding(programCodes: string[]): SectionCoverageUnresolvedFinding {
	const listed = programCodes.join(', ');
	return {
		id: 'section-coverage-unresolved-unmatched-programs',
		title: `Section coverage is UNRESOLVED for ${programCodes.length} program type${programCodes.length === 1 ? '' : 's'} without a class template`,
		blockedLabel: 'Section coverage cannot be verified for every loaded section.',
		detail: `No class template exists for: ${listed}. Sections in these program types were skipped by the coverage check.`,
		why: 'A section whose program type has no class template cannot be checked for required subject coverage, so its clean result must not be reported.',
		actionLabel: 'Review sections',
		route: '/sections',
		repairTarget: 'sections',
		severity: 'blocker',
	};
}

/**
 * The single decision the Audit page must consume. `coverageUnverified` is true
 * whenever section coverage cannot be proven: the templates read failed, no
 * templates are initialized, or at least one loaded section has no matching
 * class template. Only a fully matched template set yields a verified result
 * (no finding, no degraded reason).
 */
export function assessSectionCoverage(input: SectionCoverageInput): SectionCoverageAssessment {
	const state = classifyClassTemplateEvidence(input.templates, input.available);
	const sectionsWithoutTemplate = collectSectionProgramCodesWithoutTemplate(input.templates, input.sections);

	if (state === 'UNAVAILABLE') {
		return {
			state,
			coverageUnverified: true,
			degradedReason: CLASS_TEMPLATES_UNAVAILABLE_REASON,
			sectionsWithoutTemplate,
			unresolvedFinding: unavailableFinding(),
		};
	}

	if (state === 'NOT_INITIALIZED') {
		return {
			state,
			coverageUnverified: true,
			degradedReason: CLASS_TEMPLATES_NOT_INITIALIZED_REASON,
			sectionsWithoutTemplate,
			unresolvedFinding: notInitializedFinding(),
		};
	}

	if (sectionsWithoutTemplate.length > 0) {
		return {
			state,
			coverageUnverified: true,
			degradedReason: null,
			sectionsWithoutTemplate,
			unresolvedFinding: unmatchedProgramFinding(sectionsWithoutTemplate),
		};
	}

	return {
		state,
		coverageUnverified: false,
		degradedReason: null,
		sectionsWithoutTemplate: [],
		unresolvedFinding: null,
	};
}
