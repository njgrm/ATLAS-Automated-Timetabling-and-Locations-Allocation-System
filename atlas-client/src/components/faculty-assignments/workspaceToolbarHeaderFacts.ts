/**
 * The Teaching Load header's THREE DERIVED FACTS, moved out of
 * `WorkspaceToolbar.tsx` on 2026-09-29 (A6 c9).
 *
 * WHY A FILE, and why these three. AGENTS.md §8 caps a React component file at
 * 1000 physical lines, and `A6C7-8` — a PRESERVATION row that has been in the
 * gate since c7 — measures exactly that on this file. Adding c9's summary-window
 * flag pushed it to 1041, so the row went red and the row is RIGHT: §8 says
 * "Extract sub-components before continuing", and a test cannot be relaxed to
 * allow a file to drift over a cap the directive sets.
 *
 * These three were chosen because they are PURE FUNCTIONS OF PROPS. Nothing is
 * decided here that the toolbar used to decide differently: every string, every
 * priority and every disabled rule travelled byte-for-byte, and the toolbar
 * still decides WHEN to compute them. This is the same extraction c5 already
 * performed on `pages/TeachingLoad.tsx` into `teachingLoadWorkspaceMetrics.ts`.
 *
 * WHAT WAS DELIBERATELY LEFT IN THE TOOLBAR, so a reviewer can see the boundary
 * was drawn and not guessed. The `isTeachingLoadSourceDegraded` /
 * `isTeachingLoadSourceUnverified` / `teachingLoadUnverifiedReason` /
 * `teachingLoadUnverifiedStatus` EXPORTS stay: three committed rows locate them
 * by name in `WorkspaceToolbar.tsx` and they are the header's shared authority
 * with the page. `completenessPercent` stays: it is the one arithmetic the c5 S3
 * row names at its call site. The three JSX blocks that RENDER these facts stay,
 * because their `data-testid` / `data-alert-key` / `data-source-state` contracts
 * are read off shipped markup by many rows.
 */

/** The same source-state union `WorkspaceToolbarProps['dataSource']` declares. */
export type TeachingLoadSourceState = 'live' | 'cached' | 'refreshing' | 'none';

export type TeachingLoadStatusConfig = {
	label: string;
	color: string;
	description: string;
};

export function buildTeachingLoadStatusConfig(input: {
	dataSource: TeachingLoadSourceState;
	isOnline: boolean;
	isWorkspaceWritable: boolean;
	degradedWriteEnabled: boolean;
	dataSourceNotice: string | null;
}): TeachingLoadStatusConfig {
	const { dataSource, isOnline, isWorkspaceWritable, degradedWriteEnabled, dataSourceNotice } = input;
	if (!isOnline) return { label: 'Offline', color: 'bg-amber-500', description: 'Disconnected from the server. Changes are locked until ATLAS reconnects.' };
	if (dataSource === 'refreshing') return { label: 'Checking source', color: 'bg-blue-500 animate-pulse', description: dataSourceNotice ?? 'Verifying live data before edits continue.' };
	if (dataSource === 'live') return { label: 'EnrollPro roster verified', color: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]', description: 'ATLAS Teaching Load draft. Freshly verified. Draft changes can be saved.' };
	if (isWorkspaceWritable) return { label: 'ATLAS Teaching Load draft', color: 'bg-amber-500', description: dataSourceNotice ?? 'ATLAS is using synced EnrollPro section data for Teaching Load. This is expected.' };
	if (degradedWriteEnabled) return { label: 'ATLAS Teaching Load draft', color: 'bg-amber-500', description: dataSourceNotice ?? 'ATLAS is using synced EnrollPro section data for Teaching Load. This is expected.' };
	return { label: 'Read-only', color: 'bg-blue-500', description: dataSourceNotice ?? 'Viewing a saved snapshot. Edits need source verification first.' };
}

export type TeachingLoadPrimaryAction = {
	label: string;
	shortLabel: string;
	isSuggestion: boolean;
	onClick: () => void;
	disabled: boolean;
	variant: 'outline' | 'secondary';
	helper: string;
};

export function buildTeachingLoadPrimaryAction(input: {
	dataSource: TeachingLoadSourceState;
	isOnline: boolean;
	autoFillLoading: boolean;
	autoFillEnabled: boolean;
	onAutoFillClick: () => void;
	onRetrySource: () => void;
}): TeachingLoadPrimaryAction {
	const { dataSource, isOnline, autoFillLoading, autoFillEnabled, onAutoFillClick, onRetrySource } = input;
	if (dataSource === 'refreshing') {
		return {
			label: 'Checking source',
			shortLabel: 'Checking',
			isSuggestion: false,
			onClick: onRetrySource,
			disabled: true,
			variant: 'outline',
			helper: 'ATLAS is checking live assignment data.',
		};
	}
	if (!isOnline || dataSource === 'none') {
		return {
			label: isOnline ? 'Retry source' : 'Offline',
			shortLabel: isOnline ? 'Retry' : 'Offline',
			isSuggestion: false,
			onClick: onRetrySource,
			disabled: !isOnline,
			variant: 'outline',
			helper: isOnline ? 'Try loading teaching load data again.' : 'Reconnect before retrying.',
		};
	}
	/*
	 * A6 C2 (Major 1): the operator's own words are `Suggest assignments`,
	 * SECONDARY, not red. The old label was `Preview suggested assignments`
	 * and the old call site forced `border border-primary/20 bg-primary/5
	 * … text-primary` on top of the `secondary` variant, so it READ as the
	 * page's primary action in primary colour while doing nothing until a
	 * second dialog. The label is now the operator's, the primary tint is
	 * gone, and the button is honestly a secondary one.
	 */
	return {
		label: 'Suggest assignments',
		shortLabel: 'Suggest',
		isSuggestion: true,
		onClick: onAutoFillClick,
		disabled: autoFillLoading || !autoFillEnabled,
		variant: 'secondary',
		helper: autoFillEnabled ? 'Preview ATLAS suggestions before any Teaching Load rows are saved. Nothing is applied until you confirm.' : 'Suggestions need live writable data.',
	};
}

/**
 * State-driven alert chip: surfaces only when something needs attention.
 * Priority: above-weekly-maximum classes (generation blocker) > excess teaching
 * load (actual teaching above the standard) > temporary teacher placeholders.
 *
 * A6 c11 — THIS IS A FIGURE, NOT A CONTROL, AND THE TYPE SAYS SO.
 *
 * The model used to carry `onClick` and `disabled`, which is what
 * `docs/prompts/cover-class-flow-2026-09-29.md` calls "a `<span>` whose onClick
 * is dropped": `WorkspaceToolbar` rendered a bare `<span className="… font-bold
 * text-destructive">· {label}</span>`, so the model promised an action the
 * surface silently discarded and a scheduler pressing the chip got nothing. A
 * model that claims a capability no render honours is worse than either honest
 * shape, because every future surface inherits the lie.
 *
 * THE TWO HONEST SHAPES WERE AVAILABLE AND ONE OF THEM WAS RULED OUT. The chip
 * could have become a real `@/ui/button` — but row 2 holds exactly ONE action,
 * the repair queue's `Review staff workload`, and
 * `a6-teaching-load-surface` `A6-C2-2` asserts `row2Buttons.length === 1`. A
 * second button there breaks the header's "one primary action" budget that A6 C2
 * (Major 1) was written to establish, and the operator's own review found that
 * budget cramped. So the chip is PLAIN TEXT and the model no longer claims an
 * action.
 *
 * Nothing is lost by the subtraction, and that is the reason it is safe: each of
 * these three facts already has a control on the same row. The repair queue in
 * `stateLineSlot` prints one `over-cap` item per teacher above the maximum and
 * one `placeholder` item per to-be-hired record, each with its own action and
 * its own review. This chip was always a DUPLICATE of those rows — the same
 * reason A6 c5 removed it beside a shortage line — so it is a summary of work
 * that is already actionable one row below, not a front door of its own.
 */
export type TeachingLoadAlertChip = {
	key: string;
	label: string;
	tone: 'danger' | 'warning';
	/**
	 * What the figure MEANS. It must not promise an action the surface does not
	 * perform, and it must not say "open the filtered list", because nothing here
	 * opens a list.
	 */
	tooltip: string;
	testId: string;
};

export function buildTeachingLoadAlertChip(input: {
	overCapCount: number;
	excessTeachingCount: number;
	policyReady: boolean;
	syntheticPlaceholderPairs: number;
}): TeachingLoadAlertChip | null {
	const { overCapCount, excessTeachingCount, policyReady, syntheticPlaceholderPairs } = input;
	if (overCapCount > 0) {
		return {
			key: 'overcap',
			label: `Above weekly max: ${overCapCount}`,
			tone: 'danger',
			tooltip: 'Active teachers above the weekly maximum. Each one is listed with a fix beside this chip. Move classes before generating.',
			testId: 'teaching-load-alert-over-cap',
		};
	}
	if (policyReady && excessTeachingCount > 0) {
		return {
			key: 'excess',
			label: `Excess teaching load: ${excessTeachingCount}`,
			tone: 'warning',
			tooltip: 'Active teachers with actual teaching above the standard. Advisory credit never counts toward this figure.',
			testId: 'teaching-load-alert-excess',
		};
	}
	if (syntheticPlaceholderPairs > 0) {
		return {
			key: 'teacherx',
			label: `Temporary substitutes: ${syntheticPlaceholderPairs}`,
			tone: 'warning',
			tooltip: 'To-be-hired records are filling load rows, so those classes have no real teacher yet. Replace them before generating.',
			testId: 'teaching-load-alert-teacher-x',
		};
	}
	return null;
}
