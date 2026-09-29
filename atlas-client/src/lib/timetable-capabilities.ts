import { deriveSimpleLifecycleAction, type SimpleLifecycleAction } from './simple-timetable-state';
import type { TimetableReadinessDiagnosticSummary, TimetableReadinessRepair } from './timetable-generation-readiness';

/**
 * The single Year Setup / status surface for repairing school-year and term
 * authority. The retired annual-requirements surface must never be the normal
 * operator repair destination.
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
	/**
	 * A2 C13 (item 3c) — the SAME reason in ≤ 6 words, for the sentence printed
	 * BESIDE a disabled control in the header.
	 *
	 * It lives on the gate, next to `reason`, and is written at the same `denied()`
	 * call, so the short form and the full form cannot drift: there is no second
	 * place either string could be edited.
	 *
	 * §8 forbids truncating a sentence to fit, so this is authored, never sliced.
	 * It is `null` for gates that render no visible reason (the More-menu
	 * entry-point gates), and the header's resolver only ever reads it for the
	 * generation and publication gates.
	 */
	shortReason: string | null;
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
	/**
	 * UX-C01R — the canonical generation diagnostic gate summary. A8 C3: when
	 * present, generation follows the SERVER's `generateAllowed` and its zero-write
	 * proof only. A raw `blockerCount` must never independently block here, because
	 * a teacher gap is a setup fact the run carries and names. This is
	 * defense-in-depth behind the readiness adapter, which already only reports
	 * `ready` under those terms.
	 */
	generationDiagnostic?: TimetableReadinessDiagnosticSummary | null;
	/** The one smallest repair for the exact current blocker, when known. */
	readinessRepair?: TimetableReadinessRepair | null;
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
	return { enabled: true, reason: null, shortReason: null, repair: NONE };
}

/**
 * A2 C13 (item 3c) — `shortReason` is a REQUIRED argument for any gate whose
 * reason can reach a visible header sentence. It is the third parameter precisely
 * so a new `denied(...)` for generation or publication cannot forget it: the
 * committed control asserts every such gate carries a ≤ 6-word short form, so an
 * omission fails a gate rather than shipping a truncated sentence.
 */
function denied(reason: string, repair: TimetableRepair = NONE, shortReason: string | null = null): TimetableActionGate {
	return { enabled: false, reason, shortReason, repair };
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
	'pre-generation': 'Working schedule draft',
	generating: 'Generating…',
	'failed-run': 'Last generation failed',
	'generated-issues': 'Draft — issues to review',
	'generated-reviewable': 'Draft — ready to review',
	// LANE-C C03 (B4) — SUPERSEDED: 'Published schedule — view only'. Dated
	// changes (swap, teacher leaving, move) are allowed, so it was untrue.
	published: 'Published schedule — changes start on a date you choose',
};

/**
 * Derives the one capability model used by both Simple and Advanced timetable
 * modes. Every generation trigger and run-dependent action must read from this
 * model instead of a broad shared boolean.
 */
export function deriveTimetableCapabilities(input: TimetableCapabilityInput): TimetableCapabilities {
	const lifecycle = lifecycleState(input);

	const generation: TimetableActionGate = (() => {
		if (!input.scopeResolved) return denied('Waiting for your school and school year to load.', NONE, 'Waiting for school and year');
		if (input.generating) return denied('A generation run is already in progress.', NONE, 'A generation run is in progress');
		if (input.curriculumState === 'loading') return denied('Checking schedule information for this school year.', NONE, 'Checking schedule information');
		if (input.curriculumState === 'blocked') {
			const repair: TimetableRepair = input.readinessRepair
				? input.readinessRepair.kind === 'retry'
					? retry(input.readinessRepair.label)
					: navigate(input.readinessRepair.label, input.readinessRepair.href)
				: navigate('Open Year Setup', YEAR_SETUP_HREF);
			return denied('Setup inputs for the active school year are not ready yet.', repair, 'Setup inputs are not ready');
		}
		if (input.curriculumState === 'unavailable' || input.curriculumState === 'failed') {
			return denied('Schedule information could not be checked.', retry('Retry schedule check'), 'Schedule information unavailable');
		}
		// UX-C01R — never allow generation from a "ready" state whose canonical
		// diagnostic does not prove allow + zero-write.
		//
		// A8 C3: `blockerCount` is DELIBERATELY not part of this expression. The
		// old form (`blockerCount > 0`) let a raw row count independently block,
		// and on live S.Y. 2023-2024 620 of the operator's 651 rows were ONE fact
		// at two grains — 50 classes with no Teaching Load owner, reported once
		// per pair and once per session of it. The server's `generateAllowed` is
		// now computed from the BLOCKING count, so following it is both stricter
		// (a real hard violation, a dry run that did not happen, or a writing
		// diagnostic still blocks) and correct about teacher gaps. The count is
		// still carried on the summary for REPORTING only.
		if (input.generationDiagnostic
			&& (!input.generationDiagnostic.generateAllowed || !input.generationDiagnostic.zeroWrite)) {
			return denied(
				'Generation readiness is not verified for this school year.',
				retry('Retry schedule check'),
				'Readiness is not verified',
			);
		}
		if (input.driftBlocked) {
			return denied(
				input.driftMessage ?? 'The active school year is out of sync with setup.',
				// REVERTED (A2 C13 correction, 2026-09-29). This candidate had changed
				// the repair to `retry('Retry schedule check')`, which was NOT requested
				// and is strictly worse: an operator blocked by a drifted school year was
				// told to re-check the schedule instead of being sent to Year Setup, the
				// one place drift is actually fixed. `timetable-capabilities.test.ts ::
				// R1 drift blocks generation and points at Year Setup` caught it. The
				// repair is restored to base; ONLY the short reason is added.
				navigate('Open Year Setup', YEAR_SETUP_HREF),
				// A2 C13 correction: this was 7 words ("School year out of sync with
				// setup") and the rule is SIX. Caught by `R8C`, which is why the bound is
				// asserted rather than trusted. The full sentence above keeps the detail.
				'School year out of sync',
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
			? (runReady ? allowed() : denied(runOnlyReason('Moving a class'), navigate('Generate a draft', '/timetable')))
			: denied('Select a scheduled class on the grid first.'),
		changeRoom: input.hasSelectedEntry
			? (runReady ? allowed() : denied(runOnlyReason('Changing a room'), navigate('Generate a draft', '/timetable')))
			: denied('Select a scheduled class on the grid first.'),
		swap: runReady
			? allowed()
			: denied(runOnlyReason('Swapping sessions'), navigate('Generate a draft', '/timetable')),
		ownerRepair: runReady
			? allowed()
			: denied(runOnlyReason('Teaching Load owner repair'), navigate('Open Teaching Load', '/teaching-load')),
		issueReview: runReady
			? allowed()
			: denied(runOnlyReason('Reviewing issues'), navigate('Generate a draft', '/timetable')),
		generation,
		publication: (() => {
			if (!runReady) return denied('No draft yet to publish.', navigate('Generate a draft', '/timetable'), 'No draft to publish');
			if (input.isPreGeneration) return denied('Finish the pre-generation draft before publishing.', NONE, 'Finish the pre-generation draft');
			if (input.isPublished) return denied('This schedule is already published.', NONE, 'Already published');
			if (input.hardCount > 0) return denied(`Fix ${input.hardCount} hard blocker${input.hardCount === 1 ? '' : 's'} before publishing.`, NONE, `Fix ${input.hardCount} hard blocker${input.hardCount === 1 ? '' : 's'}`);
			if (input.unassignedCount > 0) return denied(`Place ${input.unassignedCount} unresolved session${input.unassignedCount === 1 ? '' : 's'} before publishing.`, NONE, `Place ${input.unassignedCount} unresolved session${input.unassignedCount === 1 ? '' : 's'}`);
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
		repair: retry('Retry schedule check'),
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
