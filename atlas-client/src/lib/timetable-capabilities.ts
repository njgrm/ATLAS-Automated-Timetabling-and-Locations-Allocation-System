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
	/**
	 * A8-C5 S2.3 — what genuinely prevents a timetable, one named entry per cause.
	 *
	 * Before this, every one of these conditions produced a DISABLED Generate
	 * button and a sentence beside it. The operator, verbatim: *"it should never
	 * be disabled."* A disabled control with a tooltip is a dead end — a
	 * scheduler cannot act on it, cannot see what would change, and has no way to
	 * tell "nothing is wrong yet" from "this will never work". Generate is now
	 * clickable in every state except a run already in progress; clicking opens
	 * the dialog, and the dialog reads THIS list.
	 */
	generationStoppers: TimetableGenerationStopper[];
};

/**
 * A8-C5 S2.3 — one plain line per cause, with a count where one was measured and
 * ONE real fix route.
 *
 * This is PRESENTATION. It is not a gate and it does not replace one: the
 * canonical decision remains `deriveGenerateDecision`
 * (`atlas-server/src/services/generation-blocker-groups.service.ts:258`), called
 * in production from `generation-readiness.service.ts`, and it still refuses on
 * its own terms. "Always enabled" means the operator always gets the dialog and
 * an honest list — it does not mean the client became the only gate.
 */
export type TimetableGenerationStopper = {
	/** Stable key for the cause. Carries no engine text into the DOM. */
	key: string;
	/** One plain sentence. Never a code, never a truncated sentence. */
	line: string;
	/** The SAME sentence in at most six words, for a tight header. Authored, never sliced. */
	shortReason: string;
	/**
	 * The count the SERVER measured, or null when nothing was measured. Null is
	 * honest and load-bearing: an invented count is the "651 setup items" defect
	 * this lane exists to remove, so a cause with no measurement says no number.
	 */
	count: number | null;
	/** ONE real fix route. Always a mounted app path. */
	href: string;
	/** The ONE button label on that route. */
	actionLabel: string;
	/**
	 * True when the CAUSE is that a check could not run, not that setup is wrong.
	 * The dialog retries these by itself once, and then says so plainly with a
	 * Retry button — it never spins forever and it never pretends to know.
	 */
	checkFailed: boolean;
	/** The Retry label, present exactly when `checkFailed`. */
	retryLabel: string | null;
	/**
	 * The real repair for this cause, carried through to the header unchanged.
	 * `none` is legitimate: a cause whose fix is only a fix ROUTE (which the
	 * dialog offers) has no in-place action to perform.
	 */
	repair: TimetableRepair;
};

/**
 * A8-C5 S2.3 — the ONE decision behind the Generate click.
 *
 * It lives here, not in the workspace hook, for the reason S2.1's table lives in
 * a lib: the click is the whole operator-visible half of "Generate is never
 * greyed out", and a decision that can only be reached by mounting a 2,400-line
 * provider hook is a decision nothing can test.
 *
 * THE DEFECT THIS REPLACES. The hook read:
 *   `if (readiness.state !== 'ready') { toast.error(readiness.message); return; }`
 * So from the moment the gate became enabled in every state, every blocked year
 * produced a TOAST and no dialog. The operator was told the button was
 * clickable, clicked it, and was told nothing, with no way forward — the exact
 * dead end the addendum was written to remove, reached by a different route.
 *
 * THE TWO SOURCES, AND WHY. `clickSiteStoppers` is the array the clicked control
 * itself derived; the headers are the only readers of the complete capability
 * input on those surfaces, because school-year drift comes from the rollover
 * status each header already fetches. `fallbackStoppers` is what this workspace
 * owns, for a caller that passes none. They cannot disagree about WORDING — the
 * sentences are composed in `deriveTimetableGenerationStoppers` — only about
 * which causes were visible, and the wired path is the complete one.
 *
 * `mayGenerate` is a plain restatement of the readiness state, and it is the
 * ONLY thing that decides whether the run starts. "Always enabled" never became
 * "always allowed": a non-ready year opens the dialog and explains itself.
 */
export function resolveGenerateTrigger(input: {
	readinessState: 'loading' | 'ready' | 'blocked' | 'unavailable' | 'failed';
	clickSiteStoppers?: TimetableGenerationStopper[] | null;
	fallbackStoppers: TimetableGenerationStopper[];
}): { stoppers: TimetableGenerationStopper[]; opensDialog: boolean; mayGenerate: boolean } {
	const fromClickSite = Array.isArray(input.clickSiteStoppers) && input.clickSiteStoppers.length > 0
		? input.clickSiteStoppers
		: input.fallbackStoppers;
	if (input.readinessState !== 'ready') {
		return { stoppers: fromClickSite, opensDialog: true, mayGenerate: false };
	}
	// A ready year clears the list: a cause captured during an earlier blocked visit
	// must never linger in a dialog that no longer has anything to explain.
	return { stoppers: [], opensDialog: false, mayGenerate: true };
}

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

/**
 * A8-C5 S2.3 — every condition that used to DISABLE Generate, expressed as a
 * named stopper the dialog can explain.
 *
 * Each former `denied(...)` branch of the generation gate appears here exactly
 * once, with its sentence, its count (or an honest null), and its fix route. The
 * gate below then reads the FIRST stopper for its reason and repair, so the
 * header and the dialog cannot disagree about what is wrong or where it is
 * fixed — the same single-source rule S2.2 applied to the blocker panel.
 *
 * ORDER IS PRIORITY, not severity: scope, then a check still running, then a
 * blocked setup, then a check that could not run, then an unverified decision,
 * then drift. The first entry is the one the header repairs, so it is the one
 * that has to be the one an operator can act on.
 *
 * A8-C5 S2.3 (executor, 2026-09-29) — the parameter is a `Pick` of the fields
 * this function READS, not the whole `TimetableCapabilityInput`. A caller that
 * only wants the causes (the Generate dialog's fallback derivation, which owns
 * the readiness but not the run state) must not have to invent a
 * `hasGeneratedRun` to get an honest list, and a field added to the full input
 * for the GATES must not become a required field of the stoppers. The `Pick` is
 * the check: anything this function stops reading is a compile error here.
 */
export type TimetableGenerationStopperInput = Pick<
	TimetableCapabilityInput,
	| 'scopeResolved'
	| 'curriculumState'
	| 'generating'
	| 'generationDiagnostic'
	| 'readinessRepair'
	| 'driftBlocked'
	| 'driftMessage'
>;

export function deriveTimetableGenerationStoppers(input: TimetableGenerationStopperInput): TimetableGenerationStopper[] {
	const stoppers: TimetableGenerationStopper[] = [];

	if (!input.scopeResolved) {
		stoppers.push({
			key: 'scope-unresolved',
			line: 'ATLAS could not load your school and school year, so it does not yet know which year to build a timetable for.',
			shortReason: 'Waiting for school and year',
			count: null,
			href: YEAR_SETUP_HREF,
			actionLabel: 'Open Year Setup',
			checkFailed: true,
			retryLabel: 'Retry schedule check',
			repair: NONE,
		});
	}

	if (input.curriculumState === 'loading') {
		stoppers.push({
			key: 'setup-loading',
			line: 'The schedule check is still running for this school year. It retries once on its own, then waits for you.',
			shortReason: 'Checking schedule information',
			count: null,
			href: YEAR_SETUP_HREF,
			actionLabel: 'Open Year Setup',
			checkFailed: true,
			retryLabel: 'Retry schedule check',
			repair: NONE,
		});
	}

	if (input.curriculumState === 'blocked') {
		// The readiness adapter already resolved the real repair for the exact
		// blocker, and it distinguishes a fix ROUTE from an in-place re-run. Both
		// are carried: the repair is what the header acts on, the route is what
		// the dialog's button opens when the repair is a retry.
		const repair: TimetableRepair = input.readinessRepair
			? input.readinessRepair.kind === 'retry'
				? retry(input.readinessRepair.label)
				: navigate(input.readinessRepair.label, input.readinessRepair.href)
			: navigate('Open Year Setup', YEAR_SETUP_HREF);
		const navigates = repair.kind === 'navigate' && repair.href !== null;
		const blocking = input.generationDiagnostic?.blockerCount ?? null;
		stoppers.push({
			key: 'setup-blocked',
			line: blocking !== null && blocking > 0
				? `${blocking} setup ${blocking === 1 ? 'item needs' : 'items need'} fixing before ATLAS can make a timetable.`
				: 'Setup inputs for the active school year are not ready yet.',
			shortReason: 'Setup inputs are not ready',
			count: blocking !== null && blocking > 0 ? blocking : null,
			href: navigates ? repair.href! : YEAR_SETUP_HREF,
			actionLabel: navigates ? repair.label! : 'Open Year Setup',
			// A blocked setup is a REAL setup fact, not a check that failed, so it
			// is never retried behind the operator's back.
			checkFailed: false,
			retryLabel: null,
			repair,
		});
	}

	if (input.curriculumState === 'unavailable' || input.curriculumState === 'failed') {
		stoppers.push({
			key: 'setup-check-failed',
			line: 'The schedule check could not read this school year. ATLAS does not know yet whether the setup is ready.',
			shortReason: 'Schedule information unavailable',
			count: null,
			href: YEAR_SETUP_HREF,
			actionLabel: 'Open Year Setup',
			checkFailed: true,
			retryLabel: 'Retry schedule check',
			repair: retry('Retry schedule check'),
		});
	}

	// UX-C01R — the server's own decision, never a raw row count. A8 C3: a teacher
	// gap is a setup fact the run carries and names, so `blockerCount` alone must
	// not produce a stopper and does not appear in the expression below.
	if (input.generationDiagnostic
		&& (!input.generationDiagnostic.generateAllowed || !input.generationDiagnostic.zeroWrite)) {
		const repair: TimetableRepair = input.readinessRepair
			? input.readinessRepair.kind === 'retry'
				? retry(input.readinessRepair.label)
				: navigate(input.readinessRepair.label, input.readinessRepair.href)
			: retry('Retry schedule check');
		const navigates = repair.kind === 'navigate' && repair.href !== null;
		const blocking = input.generationDiagnostic.blockerCount;
		stoppers.push({
			key: 'readiness-unverified',
			line: blocking > 0
				? `ATLAS checked this school year and ${blocking} setup ${blocking === 1 ? 'item is' : 'items are'} not ready. The full list, with the place to fix each one, opens from Generate.`
				: 'ATLAS has not verified that this school year is ready to make a timetable.',
			shortReason: 'Readiness is not verified',
			count: blocking > 0 ? blocking : null,
			href: navigates ? repair.href! : YEAR_SETUP_HREF,
			actionLabel: navigates ? repair.label! : 'Open Year Setup',
			// A `retry` repair means the decision is re-runnable, which is exactly
			// the "a check that could not run" case the packet wants retried once.
			checkFailed: repair.kind === 'retry',
			retryLabel: repair.kind === 'retry' ? repair.label : null,
			repair,
		});
	}

	if (input.driftBlocked) {
		// REVERTED (A2 C13 correction, 2026-09-29) and preserved here: the repair is
		// Year Setup, NOT a retry. An operator blocked by a drifted school year must
		// be sent to the one place drift is actually fixed, not told to re-check.
		stoppers.push({
			key: 'setup-drift',
			line: input.driftMessage ?? 'The active school year is out of sync with setup.',
			shortReason: 'School year out of sync',
			count: null,
			href: YEAR_SETUP_HREF,
			actionLabel: 'Open Year Setup',
			checkFailed: false,
			retryLabel: null,
			repair: navigate('Open Year Setup', YEAR_SETUP_HREF),
		});
	}

	return stoppers;
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
	'generated-issues': 'Generated — issues to review',
	'generated-reviewable': 'Generated — ready to review',
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

	// A8-C5 S2.3 — Generate is never greyed out.
	//
	// The operator, verbatim (addendum 20:05): "it should never be disabled." So
	// this gate is `enabled` in every state except a run already in progress, and
	// every condition that used to deny it is now a NAMED STOPPER the dialog
	// explains with a count and a fix route. The first stopper still supplies this
	// gate's `reason` and `repair`, so the header's existing sentence and its
	// "Open Year Setup" action keep working unchanged — nothing was removed to
	// make the button look enabled.
	//
	// WHAT THIS IS NOT: a new server gate. `deriveGenerateDecision`
	// (atlas-server/src/services/generation-blocker-groups.service.ts:258) remains
	// the canonical decision and still refuses on its own terms, exercised by
	// generation-canonical-readiness-genc02.test.ts. "Always enabled" means the
	// operator always reaches the dialog and an honest list, never that the client
	// became the only thing standing between a bad year and a run.
	const generationStoppers = deriveTimetableGenerationStoppers(input);

	const generation: TimetableActionGate = (() => {
		// The ONE state that still disables it: a run is in progress, and a second
		// run would collide with the first.
		if (input.generating) {
			return denied('A generation run is already in progress.', NONE, 'A generation run is in progress');
		}
		if (generationStoppers.length === 0) return allowed();
		const first = generationStoppers[0];
		return { enabled: true, reason: first.line, shortReason: first.shortReason, repair: first.repair };
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
			if (!runReady) return denied('No generated timetable exists yet to publish.', navigate('Generate a timetable', '/timetable'), 'No generated schedule to publish');
			if (input.isPreGeneration) return denied('Finish the pre-generation draft before publishing.', NONE, 'Finish the pre-generation draft');
			if (input.isPublished) return denied('This timetable is already published.', NONE, 'Already published');
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
		generationStoppers,
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
