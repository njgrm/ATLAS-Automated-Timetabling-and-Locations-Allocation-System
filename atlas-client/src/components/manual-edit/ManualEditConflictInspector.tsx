/**
 * A2 mc — the Conflict Inspector, extracted from `ManualEditPanel.tsx`.
 *
 * WHY THIS FILE EXISTS. `ManualEditPanel.tsx` stood at 996 physical lines against
 * the AGENTS.md §8 cap of 1000, so ANY JSX this packet adds there breaks the cap.
 * §8 says to EXTRACT, never to delete a comment to make room, and the Conflict
 * Inspector body (header badges, results, baseline list, sticky commit footer) is
 * the natural seam: it is one column, it holds no action-form state, and the
 * state it does read (`previewResult`, `commitLoading`) is already a prop.
 *
 * A MOVED COMPONENT IS NOT A CHANGED COMPONENT. Every testid, class and prop the
 * extracted body had is byte-identical; the parent's rendered output is
 * unchanged by the move. What IS new here is slice S4, whose four additions are
 * each marked at its own row:
 *
 *  S4a `Checking this change…` renders in the SAME place the results appear, so
 *       the operator's eye does not move while the server decides. Before this
 *       the only feedback was a spinner INSIDE the Preview button.
 *  S4b the render guard: every title and detail goes through
 *       `manual-edit-conflict-summary`, so `SECTION_TIME_CONFLICT`,
 *       `rejected by shared invariant` and `Manual candidate <entryId>` are
 *       unreachable from rendered text even if an older server sends them.
 *  S4c HARD conflicts come FIRST and are DEDUPLICATED on
 *       `(code, title, detail)`, so one blocker reported for ten sections is one
 *       row carrying its count instead of ten identical cards.
 *  S4d SOFT conflicts are summarised BY CAUSE with counts and a plain next step.
 *       525 individual cards was the defect; a per-cause line is the fix.
 *
 * SUBTRACTION, per AGENTS.md §11: 525 cards become one line per cause, ten
 * repeated blocker cards become one card with a count, and nothing was added to
 * the panel header, the Action form or the grid.
 */
import { AlertCircle, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { VIOLATION_PRESENTATION } from '@/lib/violation-presentation';
import {
	CHECKING_THIS_CHANGE,
	plainConflictDetail,
	plainConflictTitle,
	summarizeConflicts,
} from '@/lib/manual-edit-conflict-summary';
import type { PreviewResult, Violation } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';
import { deltaSentence } from '@/components/manual-edit/manual-edit-foundation';

export type ManualEditConflictInspectorProps = {
	previewResult: PreviewResult | null;
	/** True while the preview request is in flight — S4a's trigger. */
	previewLoading: boolean;
	/** The entry's OWN violations before any edit, from the parent's index. */
	entryViolations: Violation[];
	commitLoading: boolean;
	onCommit: () => void;
	/**
	 * The parent's existing WARNING-READABILITY-C01-R1 formatter: known teacher ids
	 * resolve to names, every other raw id degrades to plain words, bare `min`/`h`
	 * and shouted weekdays expand. Unchanged; the inspector only reads it.
	 */
	formatViolationMessage: (message: string) => string;
};

export function ManualEditConflictInspector({
	previewResult,
	previewLoading,
	entryViolations,
	commitLoading,
	onCommit,
	formatViolationMessage,
}: ManualEditConflictInspectorProps) {
	const hardEntryCount = entryViolations.filter((v) => v.severity === 'HARD').length;
	const softEntryCount = entryViolations.filter((v) => v.severity === 'SOFT').length;

	return (
		<div className="flex flex-col min-h-0 h-full rounded-lg border border-border bg-card overflow-hidden">
			<div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/60 bg-card flex items-center justify-between">
				<h3 className="text-[0.6875rem] font-semibold text-foreground uppercase tracking-wider">
					Conflict Inspector
				</h3>
				{previewResult ? (
					<div className="flex items-center gap-1">
						{previewResult.hardViolations.length > 0 && (
							<Badge
								variant="outline"
								className="h-5 px-1.5 text-[0.625rem] border-red-300 bg-red-50 text-red-700"
							>
								{previewResult.hardViolations.length} hard
							</Badge>
						)}
						{previewResult.softViolations.length > 0 && (
							<Badge
								variant="outline"
								className="h-5 px-1.5 text-[0.625rem] border-amber-300 bg-amber-50 text-amber-700"
							>
								{previewResult.softViolations.length} soft
							</Badge>
						)}
						{previewResult.humanConflicts.length === 0 && (
							<Badge
								variant="outline"
								className="h-5 px-1.5 text-[0.625rem] border-green-300 bg-green-50 text-green-700"
							>
								clean
							</Badge>
						)}
					</div>
				) : entryViolations.length > 0 ? (
					<div className="flex items-center gap-1">
						<span className="text-[0.5625rem] text-muted-foreground mr-1">baseline</span>
						{hardEntryCount > 0 && (
							<Badge
								variant="outline"
								className="h-5 px-1.5 text-[0.625rem] border-red-300/60 bg-red-50/60 text-red-600"
							>
								{hardEntryCount} hard
							</Badge>
						)}
						{softEntryCount > 0 && (
							<Badge
								variant="outline"
								className="h-5 px-1.5 text-[0.625rem] border-amber-300/60 bg-amber-50/60 text-amber-600"
							>
								{softEntryCount} soft
							</Badge>
						)}
					</div>
				) : null}
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<AnimatePresence mode="wait">
					{/* A2 mc S4a — the request starts, this sentence appears immediately,
					    in the SAME slot the results occupy, and the await has not
					    resolved. Before this the panel showed a spinner in the Preview
					    button and an empty inspector. */}
					{previewLoading ? (
						<motion.div
							key="checking"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.12 }}
							className="flex flex-col items-center justify-center py-8 text-center"
							data-testid="manual-edit-preview-checking"
						>
							<Loader2 className="mb-2 size-6 animate-spin text-muted-foreground" aria-hidden="true" />
							<span className="text-sm text-muted-foreground" data-testid="manual-edit-preview-checking-text">
								{CHECKING_THIS_CHANGE}
							</span>
						</motion.div>
					) : previewResult ? (
						<PreviewResults previewResult={previewResult} />
					) : (
						<motion.div
							key="baseline"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="px-4 py-3 space-y-4"
						>
							<BaselineList
								entryViolations={entryViolations}
								formatViolationMessage={formatViolationMessage}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</ScrollArea>

			{/* Sticky commit footer — only shown when preview exists */}
			{previewResult && (
				<div className="shrink-0 border-t border-border px-4 py-3 bg-card space-y-2">
					{previewResult.hardViolations.length > 0 ? (
						/* Hard conflicts — no commit button, just explanation */
						<div className="flex items-center gap-2 text-xs text-red-600">
							<AlertCircle className="size-3.5 shrink-0" />
							<span>
								Resolve {previewResult.hardViolations.length} hard
								conflict
								{previewResult.hardViolations.length !== 1
									? 's'
									: ''}{' '}
								before committing. Adjust your selection and preview
								again.
							</span>
						</div>
					) : (
						/* Clean or soft-only — commit immediately */
						<Button
							size="sm"
							className="w-full h-8 text-xs"
							onClick={onCommit}
							disabled={commitLoading}
							aria-label="Commit changes (Enter)"
						>
							{commitLoading ? (
								<Loader2 className="size-3 mr-1.5 animate-spin" />
							) : (
								<Check className="size-3 mr-1.5" />
							)}
							Commit Changes
							<kbd className="ml-auto text-[0.5625rem] bg-background/50 border border-border/40 rounded px-1 py-px font-mono opacity-70">↵</kbd>
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

/** S4c/S4d — the results body. HARD first, deduplicated; SOFT by cause. */
function PreviewResults({ previewResult }: { previewResult: PreviewResult }) {
	const { hard, soft } = summarizeConflicts(previewResult.humanConflicts);

	return (
		<motion.div
			key="results"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.12 }}
			className="px-4 py-3 space-y-4"
		>
			{/* Violation delta — human sentence */}
			<div
				className={`rounded border border-border bg-muted/30 px-3 py-2 text-xs font-medium ${deltaSentence(previewResult.violationDelta).color}`}
			>
				{deltaSentence(previewResult.violationDelta).text}
			</div>

			{/* Blocking conflicts — S4c: HARD first, deduplicated, count carried. */}
			{hard.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center gap-1.5">
						<AlertCircle className="size-3.5 text-red-600" />
						<span className="text-xs font-semibold text-red-700" data-testid="manual-edit-hard-conflicts-heading">
							Blocking Conflicts ({hard.length})
						</span>
					</div>
					{hard.map((conflict, i) => (
						<div
							key={`${conflict.code}-${i}`}
							className="rounded border-l-[3px] border-l-red-500 border border-red-200 bg-red-50/80 px-3 py-2"
							data-testid="manual-edit-hard-conflict"
							data-conflict-code={conflict.code}
							data-conflict-occurrences={conflict.occurrences}
						>
							<div className="text-xs font-semibold text-red-800">
								{conflict.humanTitle}
								{/* S4c — ONE card for a cause reported N times. The count is the
								    fact; the repeated sentence was the noise. */}
								{conflict.occurrences > 1 && (
									<span className="ml-1.5 font-normal text-red-700" data-testid="manual-edit-hard-conflict-occurrences">
										× {conflict.occurrences}
									</span>
								)}
							</div>
							<div className="mt-0.5 text-xs text-red-700">{conflict.humanDetail}</div>
							{conflict.delta && (
								<div className="mt-1 pt-1 border-t border-red-200/60 text-[0.6875rem] text-red-600 font-mono">
									{conflict.delta}
								</div>
							)}
						</div>
					))}
				</div>
			)}

			{/* S4d — SOFT warnings summarised BY CAUSE with counts and a next step.
			    One line per cause replaces one card per violation; on the operator's
			    drill that is 525 cards -> a handful of lines. */}
			{soft.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center gap-1.5">
						<AlertCircle className="size-3.5 text-amber-600" />
						<span className="text-xs font-semibold text-amber-700" data-testid="manual-edit-soft-warnings-heading">
							Warnings ({soft.length})
						</span>
					</div>
					{soft.map((group, i) => (
						<div
							key={`${group.code}-${i}`}
							className="rounded border-l-[3px] border-l-amber-500 border border-amber-200 bg-amber-50/80 px-3 py-2"
							data-testid="manual-edit-soft-cause"
							data-warning-code={group.code}
							data-warning-count={group.count}
						>
							<div className="text-xs font-semibold text-amber-800">
								{group.humanTitle}
								<span className="ml-1.5 font-normal text-amber-700">{group.count} warning{group.count === 1 ? '' : 's'}</span>
							</div>
							<div className="mt-0.5 text-xs text-amber-700">{group.nextStep}</div>
							{group.exampleDetail && (
								/* A2 mc R2 polish — the example is LABELLED. Unlabelled it read
								 * as the one problem of the cause rather than a sample of it. */
								<div className="mt-0.5 text-xs text-amber-700">
									{group.sameDetail ? 'For example: ' : 'One of these: '}
									{group.exampleDetail}
								</div>
							)}
							{!group.sameDetail && (
								<div className="mt-0.5 text-xs text-amber-700">
									{group.count} warning{group.count === 1 ? '' : 's'} of this kind; the rest say something different.
								</div>
							)}
						</div>
					))}
				</div>
			)}

			{/* Clean result */}
			{previewResult.humanConflicts.length === 0 && (
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<CheckCircle2 className="size-10 text-green-500 mb-2" />
					<span className="text-sm font-medium text-green-700">
						No Conflicts
					</span>
					<span className="text-xs text-muted-foreground mt-0.5">
						This change introduces no violations.
					</span>
				</div>
			)}

			{/* Policy impact summary */}
			{previewResult.policyImpactSummary.length > 0 && (
				<div className="space-y-2">
					<span className="text-xs font-medium text-muted-foreground">
						Policy Impact
					</span>
					{previewResult.policyImpactSummary.map((p, i) => (
						<div
							key={i}
							className={`rounded border px-3 py-2 text-xs ${
								p.severity === 'HARD'
									? 'border-red-200 bg-red-50/50 text-red-700'
									: 'border-amber-200 bg-amber-50/50 text-amber-700'
							}`}
						>
							<div className="font-medium">{p.label}</div>
							<div className="mt-0.5 font-mono text-[0.6875rem]">
								{p.summary}
							</div>
						</div>
					))}
				</div>
			)}
		</motion.div>
	);
}

/** The entry's own violations, before any edit. Unchanged structure. */
function BaselineList({
	entryViolations,
	formatViolationMessage,
}: {
	entryViolations: Violation[];
	formatViolationMessage: (message: string) => string;
}) {
	const hard = entryViolations.filter((v) => v.severity === 'HARD');
	const soft = entryViolations.filter((v) => v.severity === 'SOFT');

	if (entryViolations.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-8 text-center">
				<CheckCircle2 className="size-10 text-green-500/40 mb-2" />
				<span className="text-xs text-muted-foreground">
					No existing violations for this entry.
				</span>
				<span className="text-[0.625rem] text-muted-foreground/70 mt-1">
					Preview your changes to check for new conflicts.
				</span>
			</div>
		);
	}

	return (
		<>
			<div className="rounded border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground font-medium">
				Baseline violations for this entry before any changes.
			</div>
			{hard.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center gap-1.5">
						<AlertCircle className="size-3.5 text-red-600" />
						<span className="text-xs font-semibold text-red-700">
							Blocking Conflicts ({hard.length})
						</span>
					</div>
					{hard.map((v, i) => (
						<div
							key={i}
							className="rounded border-l-[3px] border-l-red-500 border border-red-200 bg-red-50/80 px-3 py-2"
						>
							<div className="text-xs font-semibold text-red-800">
								{plainConflictTitle(v.code, VIOLATION_PRESENTATION[v.code]?.title)}
							</div>
							<div className="mt-0.5 text-xs text-red-700">
								{plainConflictDetail(v.code, formatViolationMessage(v.message))}
							</div>
						</div>
					))}
				</div>
			)}
			{soft.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center gap-1.5">
						<AlertCircle className="size-3.5 text-amber-600" />
						<span className="text-xs font-semibold text-amber-700">
							Warnings ({soft.length})
						</span>
					</div>
					{soft.map((v, i) => (
						<div
							key={i}
							className="rounded border-l-[3px] border-l-amber-500 border border-amber-200 bg-amber-50/80 px-3 py-2"
						>
							<div className="text-xs font-semibold text-amber-800">
								{plainConflictTitle(v.code, VIOLATION_PRESENTATION[v.code]?.title)}
							</div>
							<div className="mt-0.5 text-xs text-amber-700">
								{plainConflictDetail(v.code, formatViolationMessage(v.message))}
							</div>
						</div>
					))}
				</div>
			)}
		</>
	);
}
