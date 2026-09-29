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
 */
export type TeachingLoadAlertChip = {
	key: string;
	label: string;
	tone: 'danger' | 'warning';
	tooltip: string;
	onClick: () => void;
	disabled: boolean;
	testId: string;
};

export function buildTeachingLoadAlertChip(input: {
	overCapCount: number;
	excessTeachingCount: number;
	policyReady: boolean;
	syntheticPlaceholderPairs: number;
	onShowExcessTeachingLoad: () => void;
	onShowTemporarySubstitutes: () => void;
}): TeachingLoadAlertChip | null {
	const { overCapCount, excessTeachingCount, policyReady, syntheticPlaceholderPairs, onShowExcessTeachingLoad, onShowTemporarySubstitutes } = input;
	if (overCapCount > 0) {
		return {
			key: 'overcap',
			label: `Above weekly max: ${overCapCount}`,
			tone: 'danger',
			tooltip: 'Active teachers above the weekly maximum. Review the filtered teacher list and move classes before generating.',
			onClick: onShowExcessTeachingLoad,
			disabled: false,
			testId: 'teaching-load-alert-over-cap',
		};
	}
	if (policyReady && excessTeachingCount > 0) {
		return {
			key: 'excess',
			label: `Excess teaching load: ${excessTeachingCount}`,
			tone: 'warning',
			tooltip: 'Active teachers with actual teaching above the standard. Advisory credit never counts toward this figure.',
			onClick: onShowExcessTeachingLoad,
			disabled: false,
			testId: 'teaching-load-alert-excess',
		};
	}
	if (syntheticPlaceholderPairs > 0) {
		return {
			key: 'teacherx',
			label: `Temporary substitutes: ${syntheticPlaceholderPairs}`,
			tone: 'warning',
			tooltip: 'Temporary substitutes are filling load rows. Open the filtered teacher list to replace them before generating.',
			onClick: onShowTemporarySubstitutes,
			disabled: false,
			testId: 'teaching-load-alert-teacher-x',
		};
	}
	return null;
}
