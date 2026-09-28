/**
 * A2-C6-TRUTH (T3a) — WHICH schedule am I looking at, and can anyone see it?
 *
 * The live measurement, 2026-09-28 on release `a1db27d5`, Simple view, draft
 * run 321: `hasRunLine: false`, `hasDraftWord: false`. The only run-ish strings
 * on the page were `REVIEW AND PUBLISH`, `Runs`, `Publish schedule` and
 * `Latest Run` — so an older user could not say which schedule was on screen or
 * whether anyone could see it.
 *
 * THE ANSWER TO "regression or surface move", settled from source: a SURFACE
 * MOVE, not a regression. `runStateSentence` / `runStateBadgeLabel` and the
 * `timetable-run-identity` line were added by A2-TIMETABLE-CUSTODY (c1) to
 * `ScheduleReviewWorkspaceHeader` — the EXPERT header. `TimetableSimpleHeader`
 * never received them, and Simple is the default view the measurement was taken
 * in. c1's own test note records the same fact from the other side: "The
 * pre-candidate base named no run at all", i.e. no run identity existed anywhere
 * before that work, so nothing was removed from Simple.
 *
 * So this module EXTRACTS the presentation the Expert header already had, and
 * both headers now render the same one. That is the "one fact, one place" rule
 * applied to the run's identity: the number and the Draft/Published word can no
 * longer differ between the two views of the same run.
 */

import { CircleCheck, CircleDashed, Hourglass, PencilLine, type LucideIcon } from 'lucide-react';

import { runStateBadgeLabel, runStateSentence } from '@/lib/timetable-plain-language';
import { Badge } from '@/ui/badge';

export type RunStateKey = 'planning' | 'published' | 'draft' | 'empty';

/**
 * One icon, one tone and one sign token per state (U2 + #51).
 *
 * The appearance must be chosen by the RUN (`draft.runId` +
 * `isDraftPublishedStrict`), never by the layout mode: a pre-candidate badge
 * keyed on `isPreGenerationWorkspace` is what made Draft and Published
 * indistinguishable. Three channels, so colour is never load-bearing alone.
 */
export const RUN_STATE_PRESENTATION: Record<RunStateKey, {
	icon: LucideIcon;
	sign: 'in-progress' | 'settled' | 'none';
	tone: 'amber' | 'emerald' | 'muted';
	toneClass: string;
}> = {
	planning: { icon: Hourglass, sign: 'in-progress', tone: 'amber', toneClass: 'border-amber-300 bg-amber-50 text-amber-950' },
	published: { icon: CircleCheck, sign: 'settled', tone: 'emerald', toneClass: 'border-emerald-400 bg-emerald-50 text-emerald-950' },
	draft: { icon: PencilLine, sign: 'in-progress', tone: 'amber', toneClass: 'border-amber-300 bg-amber-50 text-amber-950' },
	empty: { icon: CircleDashed, sign: 'none', tone: 'muted', toneClass: 'border-border bg-muted text-muted-foreground' },
};

/**
 * The one state key, derived from the run on screen.
 *
 * `runId` is the run whose entries are in the grid (`draft.runId`) and
 * `isPublished` is that same run's state. Mixing in `activeGeneratedRunId` here
 * is the defect A2-TIMETABLE-CUSTODY corrected: under `selectedRunId === 'latest'`
 * it resolves to the NEWEST run whether or not it finished, so the header could
 * name a run that was not on the grid and a publication state that was not that
 * run's.
 */
export function runStateKeyOf(input: {
	isPreGeneration: boolean;
	runId: number | null | undefined;
	isPublished: boolean;
}): RunStateKey {
	if (input.isPreGeneration) return 'planning';
	if (input.runId == null || !Number.isFinite(input.runId)) return 'empty';
	return input.isPublished ? 'published' : 'draft';
}

/**
 * C11 D — WHO CAN SEE THIS SCHEDULE, in one sentence, from the same derivation.
 *
 * The recorded walk (`docs/reviews/codex-timetable-walk-20260928/report.md`,
 * defect 3) found no way to tell a draft from a published schedule anywhere in
 * the rendered header: `Publish schedule` sat beside `Schedule information
 * changed` with nothing stating whether anyone could see the run.
 *
 * This is deliberately a FIELD OF `describeRunState`, not a second function that
 * re-derives draft-vs-published. The two headers read the same object, so the
 * badge, the run identity and the visibility sentence can never disagree about
 * the run on screen — the "one fact, one place" rule this module already exists
 * to enforce (see its header note and `runStateKeyOf`).
 *
 * The two sentences are deliberately different facts and must not be merged:
 *  - `sentence`      names WHICH run is on screen ("Run 321 …"),
 *  - `visibility`    names whether TEACHERS can see it.
 *
 * `null` for a pre-generation workspace: the draft workspace is not a schedule
 * that is or is not published, so claiming a visibility state there would be a
 * claim nothing can support. The strip renders nothing rather than guessing.
 */
export function runVisibilitySentence(key: RunStateKey): string | null {
	if (key === 'planning') return null;
	if (key === 'empty') return null;
	return key === 'published'
		? 'Published'
		: 'Draft — not visible to teachers until you publish';
}

/** The badge and the sentences, from one derivation. */
export function describeRunState(input: {
	isPreGeneration: boolean;
	runId: number | null | undefined;
	isPublished: boolean;
}): { key: RunStateKey; badgeLabel: string; sentence: string | null; visibility: string | null } {
	const key = runStateKeyOf(input);
	return {
		key,
		badgeLabel: runStateBadgeLabel({
			isPreGeneration: input.isPreGeneration,
			hasRun: key !== 'empty' && key !== 'planning',
			isPublished: input.isPublished,
		}),
		sentence: runStateSentence({
			isPreGeneration: input.isPreGeneration,
			hasRun: key !== 'empty' && key !== 'planning',
			runId: input.runId,
			isPublished: input.isPublished,
		}),
		visibility: runVisibilitySentence(key),
	};
}

/**
 * C11 S2 (T3a) — WHICH run, in the badge itself.
 *
 * The recorded walk found the header reading only "Draft schedule": an older
 * scheduler could say the schedule was a draft, but not WHICH draft. `Run 321 ·
 * Draft` answers both in five words, and it is derived here rather than
 * assembled at a call site, so the two headers cannot print the run number
 * differently.
 *
 * `null` for the two states where there is no run to name — a pre-generation
 * workspace and an empty grid — so a caller never prints "Run null".
 */
export function runIdentityBadgeLabel(input: {
	isPreGeneration: boolean;
	runId: number | null | undefined;
	isPublished: boolean;
}): string | null {
	const { key } = describeRunState(input);
	if (key === 'planning' || key === 'empty') return null;
	if (input.runId == null || !Number.isFinite(input.runId)) return null;
	return `Run ${input.runId} · ${key === 'published' ? 'Published' : 'Draft'}`;
}

/** The Draft/Published badge. Presentation only; it states, it does not act. */
export function RunStateBadge({
	isPreGeneration,
	runId,
	isPublished,
	includeRunNumber = false,
	className = 'h-7 shrink-0 gap-1.5 px-2.5 text-xs font-semibold',
}: {
	isPreGeneration: boolean;
	runId: number | null | undefined;
	isPublished: boolean;
	/**
	 * C11 S2 (T3a) — prefix the badge with the run on screen ("Run 321 · Draft").
	 * Additive and off by default, so any existing caller that wants the bare
	 * Draft/Published word keeps it and a caller that has no run number to print
	 * is unaffected.
	 */
	includeRunNumber?: boolean;
	className?: string;
}) {
	const { key, badgeLabel } = describeRunState({ isPreGeneration, runId, isPublished });
	const presentation = RUN_STATE_PRESENTATION[key];
	const Icon = presentation.icon;
	const identity = includeRunNumber
		? runIdentityBadgeLabel({ isPreGeneration, runId, isPublished })
		: null;
	return (
		<Badge
			variant="outline"
			className={`${className} ${presentation.toneClass}`}
			data-testid="timetable-run-state-badge"
			data-run-state={key}
			data-run-state-sign={presentation.sign}
			data-run-state-tone={presentation.tone}
			data-run-identity={identity ?? undefined}
		>
			<Icon className="size-3.5 shrink-0" aria-hidden="true" data-testid="timetable-run-state-sign" />
			<span className="truncate">{identity ?? badgeLabel}</span>
		</Badge>
	);
}

/**
 * The quiet line that names the run and whether anyone can see it.
 *
 * Renders nothing when there is genuinely nothing to name, so a caller never
 * prints a placeholder. `data-testid="timetable-run-identity"` is the addressable
 * region A2-TIMETABLE-CUSTODY's own evidence rows read, kept unchanged so that
 * contract still decides on this component.
 */
export function RunIdentityLine({
	isPreGeneration,
	runId,
	isPublished,
	className = 'text-xs text-muted-foreground',
}: {
	isPreGeneration: boolean;
	runId: number | null | undefined;
	isPublished: boolean;
	className?: string;
}) {
	const { sentence } = describeRunState({ isPreGeneration, runId, isPublished });
	if (sentence === null) return null;
	return (
		<span data-testid="timetable-run-identity" className={className}>
			{/* The lead-in is "State:", never "Run:". A2-TIMETABLE-CUSTODY's U1 row
			 * pins that the rendered cell can never contain the literal "Run: Run",
			 * because the value already opens with the run number; a bold "Run:"
			 * lead-in in front of it is that same doubling. The committed contract
			 * reads the lead-in label-agnostically, so this is the label it accepts. */}
			<span className="font-semibold text-foreground">State:</span> {sentence}
		</span>
	);
}
