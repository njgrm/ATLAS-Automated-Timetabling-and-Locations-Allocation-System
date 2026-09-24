import type { GenerationInputComparison, GenerationInputDomain } from '@/types';

/**
 * TT-DYNAMIC-WORKSPACE-C04 (R6, findings A-11/B-06/B-14) — one shared mapping
 * from a run's `inputState` freshness comparison to operator-facing domain
 * chips and their correct repair destination.
 *
 * The domain repair homes are the canonical owning surfaces; Simple renders the
 * same information Advanced already shows, without inventing a second
 * authority.
 *
 * S4-client / D5 — every `GenerationInputDomain` the server can report now has
 * a label and a canonical repair home (the previous map covered only 5 of 7, so
 * `availability` and `derivedDemand` fell through to an unlabelled umbrella).
 * `requiresRegeneration` is additive: it names the changed domains a direct
 * setup sync cannot apply on its own and that therefore need the explicit
 * operator-triggered "Regenerate to apply" action.
 */

export type RunInputDriftDomain = {
	domain: GenerationInputDomain;
	label: string;
	href: string;
};

export type RunInputDrift = {
	status: 'FRESH' | 'STALE' | 'UNKNOWN';
	message: string;
	actionHint: string;
	domains: RunInputDriftDomain[];
	checkedAt: string | null;
	/** Where the operator should go when the whole draft must be re-bound. */
	primaryHref: string;
	/**
	 * True when at least one changed domain only takes effect through a fresh
	 * generation (policy, derived demand, reviewed teacher availability). A
	 * direct setup sync cannot apply these on its own.
	 */
	requiresRegeneration: boolean;
};

const DOMAIN_META: Record<GenerationInputDomain, Omit<RunInputDriftDomain, 'domain'>> = {
	teachingLoad: { label: 'Teaching Load', href: '/teaching-load' },
	policy: { label: 'Scheduling policy', href: '/timetable' },
	rooms: { label: 'Rooms', href: '/map' },
	sections: { label: 'Sections', href: '/sections' },
	subjects: { label: 'Subjects', href: '/subjects' },
	// Derived demand is seeded from the EnrollPro active year + ordered terms and
	// the ATLAS-owned subject scheduling metadata; `/admin/year-setup` is the same
	// canonical repair home the Dashboard's derived-demand state uses.
	derivedDemand: { label: 'Derived demand', href: '/admin/year-setup' },
	// Reviewed teacher availability is a per-faculty authority; the Faculty
	// surface is its canonical ATLAS home until the scheduler concern workspace
	// is routed.
	availability: { label: 'Teacher availability', href: '/faculty' },
};

/**
 * The changed domains a direct setup sync cannot apply. Their freshness delta is
 * only applied by a fresh generation, so the Simple drift surface offers the
 * explicit "Regenerate to apply" action for them.
 */
const REGENERATION_ONLY_DOMAINS: ReadonlySet<GenerationInputDomain> = new Set([
	'policy',
	'derivedDemand',
	'availability',
]);

export function domainRequiresRegeneration(domain: GenerationInputDomain): boolean {
	return REGENERATION_ONLY_DOMAINS.has(domain);
}

export function describeRunInputDrift(inputState: GenerationInputComparison | null | undefined): RunInputDrift {
	if (!inputState) {
		return {
			status: 'FRESH',
			message: 'No setup comparison is available for this run.',
			actionHint: 'Generate a run to compare its inputs with setup.',
			domains: [],
			checkedAt: null,
			primaryHref: '/timetable',
			requiresRegeneration: false,
		};
	}

	const changed = Array.isArray(inputState.changedDomains) ? inputState.changedDomains : [];
	const domains = changed
		.filter((domain): domain is GenerationInputDomain => domain in DOMAIN_META)
		.map((domain) => ({ domain, ...DOMAIN_META[domain] }));
	// A changed domain with no single home is still surfaced; the operator gets
	// the canonical Year Setup surface as the umbrella repair.
	const hasUnmappedDomain = changed.some((domain) => !(domain in DOMAIN_META));

	return {
		status: inputState.status,
		message: inputState.message,
		actionHint: inputState.actionHint,
		domains,
		checkedAt: inputState.checkedAt ?? null,
		primaryHref: hasUnmappedDomain
			? '/admin/year-setup'
			: (domains[0]?.href ?? '/admin/year-setup'),
		requiresRegeneration: changed.some((domain) => domainRequiresRegeneration(domain)),
	};
}
