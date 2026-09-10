import { deriveSimpleLifecycleAction, type SimpleLifecycleAction } from './simple-timetable-state';

/**
 * The single Year Setup / status surface for repairing school-year and term
 * authority. The superseded `/curriculum-requirements` page must never be the
 * normal operator repair destination.
 */
export const YEAR_SETUP_HREF = '/admin/year-setup';

export type TimetableLifecycleState =
	| 'resolve-scope'
	| 'setup-loading'
	| 'setup-blocked'
	| 'setup-unavailable'
	| 'ready-no-run'
	| 'pre-generation'
	| 'generating'
	| 'failed-run'
	| 'generated-issues'
	| 'generated-reviewable'
	| 'published';

export type TimetableCapabilityId =
	| 'viewSelection'
	| 'setupInputStatus'
	| 'roomRequests'
	| 'move'
	| 'changeRoom'
	| 'swap'
	| 'ownerRepair'
	| 'issueReview'
	| 'generation'
	| 'publication';

export type TimetableRepair = {
	kind: 'navigate' | 'retry' | 'none';
	label: string | null;
	href: string | null;
};

export type TimetableActionGate = {
	enabled: boolean;
	reason: string | null;
	repair: TimetableRepair;
};

export type TimetableCapabilityInput = {
	/** False while the actor school/year scope is still unresolved. */
	scopeResolved: boolean;
	curriculumState: 'loading' | 'ready' | 'blocked' | 'unavailable' | 'failed';
	generating: boolean;
	isPreGeneration: boolean;
	hasGeneratedRun: boolean;
	isPublished: boolean;
	latestRunFailed: boolean;
	hardCount: number;
	unassignedCount: number;
	softCount: number;
	hasSelectedEntry: boolean;
	requestPendingCount: number;
	/** A stale/ drift setup state blocks generation the same way an unresolved year does. */
	driftBlocked?: boolean;
	driftMessage?: string | null;
};

export type TimetableCapabilities = {
	lifecycle: TimetableLifecycleState;
	lifecycleLabel: string;
	/** The one readiness decision both Simple and Advanced generation triggers consume. */
	generation: TimetableActionGate;
	gates: Record<TimetableCapabilityId, TimetableActionGate>;
};

const NONE: TimetableRepair = { kind: 'none', label: null, href: null };

function navigate(label: string, href: string): TimetableRepair {
	return { kind: 'navigate', label, href };
}

function retry(label: string): TimetableRepair {
	return { kind: 'retry', label, href: null };
}

function allowed(): TimetableActionGate {
	return { enabled: true, reason: null, repair: NONE };
}

function denied(reason: string, repair: TimetableRepair = NONE): TimetableActionGate {
	return { enabled: false, reason, repair };
}

function lifecycleState(input: TimetableCapabilityInput): TimetableLifecycleState {
	if (!input.scopeResolved) return 'resolve-scope';
	if (input.generating) return 'generating';
	if (input.curriculumState === 'loading') return 'setup-loading';
	if (input.curriculumState === 'blocked') return 'setup-blocked';
	if (input.curriculumState === 'unavailable' || input.curriculumState === 'failed') return 'setup-unavailable';
	if (input.isPreGeneration) return 'pre-generation';
	if (!input.hasGeneratedRun) return input.latestRunFailed ? 'failed-run' : 'ready-no-run';
	if (input.isPublished) return 'published';
	if (input.hardCount > 0 || input.unassignedCount > 0 || input.softCount > 0) return 'generated-issues';
	return 'generated-reviewable';
}

const LIFECYCLE_LABELS: Record<TimetableLifecycleState, string> = {
	'resolve-scope': 'Checking school scope',
	'setup-loading': 'Checking setup',
	'setup-blocked': 'Setup needs attention',
	'setup-unavailable': 'Setup check unavailable',
	'ready-no-run': 'Ready to generate',
	'pre-generation': 'Planning draft',
	generating: 'Generating…',
	'failed-run': 'Last generation failed',
	'generated-issues': 'Generated — issues to review',
	'generated-reviewable': 'Generated — ready to review',
	published: 'Published — read only',
};

/**
 * Derives the one capability model used by both Simple and Advanced timetable
 * modes. Every generation trigger and run-dependent action must read from this
 * model instead of a broad shared boolean.
 */
export function deriveTimetableCapabilities(input: TimetableCapabilityInput): TimetableCapabilities {
	const lifecycle = lifecycleState(input);

	const generation: TimetableActionGate = (() => {
		if (!input.scopeResolved) return denied('Waiting for your school and school year to load.');
		if (input.generating) return denied('A generation run is already in progress.');
		if (input.curriculumState === 'loading') return denied('Still checking setup inputs for this school year.');
		if (input.curriculumState === 'blocked') {
			return denied(
				'Setup inputs for the active school year are not ready yet.',
				navigate('Open Year Setup', YEAR_SETUP_HREF),
			);
		}
		if (input.curriculumState === 'unavailable' || input.curriculumState === 'failed') {
			return denied('Setup inputs could not be checked.', retry('Retry setup check'));
		}
		if (input.driftBlocked) {
			return denied(
				input.driftMessage ?? 'The active school year is out of sync with setup.',
				navigate('Open Year Setup', YEAR_SETUP_HREF),
			);
		}
		return allowed();
	})();

	const runReady = input.hasGeneratedRun;
	const runOnlyReason = (what: string) =>
		`${what} becomes available after ATLAS generates a timetable for this school year.`;

	const gates: Record<TimetableCapabilityId, TimetableActionGate> = {
		viewSelection: allowed(),
		setupInputStatus: allowed(),
		roomRequests: runReady
			? allowed()
			: denied(runOnlyReason('Room requests'), navigate('Start with generation', '/timetable')),
		move: input.hasSelectedEntry
			? (runReady ? allowed() : denied(runOnlyReason('Moving a class'), navigate('Generate a timetable', '/timetable')))
			: denied('Select a scheduled class on the grid first.'),
		changeRoom: input.hasSelectedEntry
			? (runReady ? allowed() : denied(runOnlyReason('Changing a room'), navigate('Generate a timetable', '/timetable')))
			: denied('Select a scheduled class on the grid first.'),
		swap: runReady
			? allowed()
			: denied(runOnlyReason('Swapping sessions'), navigate('Generate a timetable', '/timetable')),
		ownerRepair: runReady
			? allowed()
			: denied(runOnlyReason('Teaching Load owner repair'), navigate('Open Teaching Load', '/teaching-load')),
		issueReview: runReady
			? allowed()
			: denied(runOnlyReason('Reviewing issues'), navigate('Generate a timetable', '/timetable')),
		generation,
		publication: (() => {
			if (!runReady) return denied('No generated timetable exists yet to publish.', navigate('Generate a timetable', '/timetable'));
			if (input.isPreGeneration) return denied('Finish the pre-generation draft before publishing.');
			if (input.isPublished) return denied('This timetable is already published.');
			if (input.hardCount > 0) return denied(`Fix ${input.hardCount} hard blocker${input.hardCount === 1 ? '' : 's'} before publishing.`);
			if (input.unassignedCount > 0) return denied(`Place ${input.unassignedCount} unresolved session${input.unassignedCount === 1 ? '' : 's'} before publishing.`);
			return allowed();
		})(),
	};

	return {
		lifecycle,
		lifecycleLabel: LIFECYCLE_LABELS[lifecycle],
		generation,
		gates,
	};
}

/**
 * Maps the raw curriculum readiness state to honest operator-facing copy and a
 * single Year Setup repair. It never names the superseded curriculum
 * requirements page.
 */
export function describeSetupState(
	readiness: { state: 'loading' | 'ready' | 'blocked' | 'unavailable' | 'failed'; message: string } | undefined,
): { label: string; message: string; repair: TimetableRepair } {
	if (!readiness || readiness.state === 'loading') {
		return { label: 'Checking setup', message: 'Checking the term and setup data for the active school year…', repair: NONE };
	}
	if (readiness.state === 'ready') {
		return { label: 'Setup ready', message: 'Term and setup data for the active school year are ready for generation.', repair: NONE };
	}
	if (readiness.state === 'blocked') {
		return {
			label: 'Setup needs attention',
			message: readiness.message || 'Term and setup data for the active school year are incomplete.',
			repair: navigate('Open Year Setup', YEAR_SETUP_HREF),
		};
	}
	return {
		label: 'Setup check unavailable',
		message: readiness.message || 'Term and setup data could not be checked for the active school year.',
		repair: retry('Retry setup check'),
	};
}

export type { SimpleLifecycleAction };

/**
 * Convenience wrapper that preserves the mature lifecycle reducer while making
 * the shared capability model available alongside it.
 */
export function deriveTimetableLifecycleAction(input: {
	hasGeneratedRun: boolean;
	isPreGeneration?: boolean;
	generating?: boolean;
	hardCount?: number;
	unassignedCount?: number;
	softCount?: number;
	isPublished?: boolean;
	scopeResolved?: boolean;
	curriculumState?: 'loading' | 'ready' | 'blocked' | 'unavailable' | 'failed';
	latestRunFailed?: boolean;
}): SimpleLifecycleAction {
	return deriveSimpleLifecycleAction(input);
}
