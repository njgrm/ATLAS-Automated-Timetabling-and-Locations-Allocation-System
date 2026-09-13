import type { GenerationInputComparison, GenerationInputDomain } from '@/types';

/**
 * TT-DYNAMIC-WORKSPACE-C04 (R6, findings A-11/B-06/B-14) — one shared mapping
 * from a run's `inputState` freshness comparison to operator-facing domain
 * chips and their correct repair destination.
 *
 * The domain repair homes are the canonical owning surfaces; Simple renders the
 * same information Advanced already shows, without inventing a second
 * authority.
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
};

const DOMAIN_META: Record<GenerationInputDomain, Omit<RunInputDriftDomain, 'domain'>> = {
	teachingLoad: { label: 'Teaching Load', href: '/teaching-load' },
	policy: { label: 'Scheduling policy', href: '/timetable' },
	rooms: { label: 'Rooms', href: '/map' },
	sections: { label: 'Sections', href: '/sections' },
	subjects: { label: 'Subjects', href: '/subjects' },
};

export function describeRunInputDrift(inputState: GenerationInputComparison | null | undefined): RunInputDrift {
	if (!inputState) {
		return {
			status: 'FRESH',
			message: 'No setup comparison is available for this run.',
			actionHint: 'Generate a run to compare its inputs with setup.',
			domains: [],
			checkedAt: null,
			primaryHref: '/timetable',
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
	};
}
