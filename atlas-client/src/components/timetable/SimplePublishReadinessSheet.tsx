import { memo, useCallback, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Copy, Download, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { MUST_FIX_LABEL, plainScopeLabel, runAnchorLabel } from '@/lib/timetable-plain-language';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import { deriveSimplePublishReadiness, resolveBlockerDestination, type SimplePublishReadiness, type BlockerGroup, type BlockerItem, type WarningGroup, type RunWidePublishAuthority } from '@/components/timetable/simplePublishReadiness';
import type { DraftReport, Violation } from '@/types';

type RepairIdentity = {
	sectionId: number | null;
	subjectId: number | null;
	facultyId: number | null;
};

type SimplePublishReadinessSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	draft: DraftReport | null;
	violations: Violation[];
	sectionLabel: (id: number) => string;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	/**
	 * Run-wide publication authority (C07B/B1). Publication is always decided
	 * run-wide (`counts.runWide.blockingHard` + the run's unassigned
	 * requirement); the selected-term `violations` array is supporting detail.
	 */
	runWide?: RunWidePublishAuthority | null;
	onNavigateToRepair: (
		href: string,
		reason?: string,
		identity?: RepairIdentity | null,
		/**
		 * C1-a — the affected-session count of the group whose action was
		 * followed. Optional because the `/timetable/setup` caller
		 * (`TimetableSetupPane`) renders this same sheet with real
		 * `BlockerGroup`s that carry real counts, but its `onNavigateToRepair`
		 * callback does not thread a count through — so the affected-session
		 * clause is omitted there rather than rendered as a zero.
		 */
		groupCount?: number | null,
	) => void;
};

const VIOLATION_TO_BLOCKER_REASON: Record<string, string> = {
	UNASSIGNED_SECTION: 'UNASSIGNED_SECTION',
	FACULTY_OVERLOAD: 'FACULTY_OVERLOADED',
	SPECIALIZED_ROOM_UNAVAILABLE: 'NO_COMPATIBLE_ROOM',
	FACULTY_SUBJECT_NOT_QUALIFIED: 'NO_QUALIFIED_FACULTY',
	ROOM_CAPACITY_EXCEEDED: 'ROOM_CAPACITY_EXCEEDED',
};

/**
 * R9/A-18 — resolve the exact section/subject/faculty identity behind a blocker
 * group so the repair link can deep-link with context instead of dropping the
 * operator into a generic page.
 *
 * A2 mc S1b — it now also accepts the SPECIFIC item, so one row's own fix button
 * carries THAT row's identity instead of the group's first. Without it every
 * must-fix row on the sheet pointed at the same entity, which made per-item
 * buttons a decoration: nine different buttons, one destination.
 */
function resolveRepairIdentity(
	reason: string | undefined,
	draft: DraftReport | null,
	violations: Violation[],
	item?: BlockerItem | null,
): RepairIdentity | null {
	// The item's own resolved identity is the most specific answer available: it
	// was itself derived from the violation's own `entryIds` when the violation
	// carried no ids (A2 mc S2).
	if (item) {
		return {
			sectionId: item.sectionId ?? null,
			subjectId: item.subjectId ?? null,
			facultyId: item.facultyId ?? null,
		};
	}
	if (!reason) return null;
	const unassigned = draft?.unassignedItems ?? [];
	const unassignedItem = unassigned.find((candidate) => candidate.reason === reason);
	if (unassignedItem) {
		return {
			sectionId: unassignedItem.sectionId ?? null,
			subjectId: unassignedItem.subjectId ?? null,
			facultyId: unassignedItem.facultyId ?? null,
		};
	}
	const violation = violations.find(
		(candidate) => candidate.severity === 'HARD'
			&& (VIOLATION_TO_BLOCKER_REASON[candidate.code] ?? candidate.code) === reason,
	);
	if (violation) {
		return {
			sectionId: violation.entities.sectionId ?? null,
			subjectId: violation.entities.subjectId ?? null,
			facultyId: violation.entities.facultyId ?? null,
		};
	}
	return null;
}

/**
 * A2 mc S1 — one count, one list.
 *
 * THE THREE DEFECTS, MEASURED:
 *  S1a This row rendered `group.items.slice(0, 3)` plus a `Show N more`
 *       disclosure. On the operator's own run that hid SEVEN of the TEN must-fix
 *       sessions behind a control they had to discover, on the ONE list that
 *       blocks publishing. A must-fix item is never behind a disclosure now: every
 *       item renders, and the `Show N more` control is GONE from this row.
 *       The WARNING row below keeps its disclosure untouched — a warning is
 *       reviewable and blocks nothing, and this slice says nothing about it.
 *  S1b Each item now carries the group's action label as a REAL control that
 *       dispatches the same repair with THAT item's own identity, so a row's
 *       button lands on that row. The button reuses the group header's exact
 *       `@/ui` treatment (`variant="outline" size="sm" h-11`), so it looks like
 *       every other repair control on the sheet (AGENTS.md §8 One look per
 *       control) and it cannot be a bare text link.
 *  S1c The count line now states WHAT the count covers and over WHICH scope, in
 *       the existing scope Badge plus a short clause. Before this the header
 *       chip, this sheet's gate and the selected-term line all read `Must fix`
 *       over three different populations with nothing on screen saying so.
 *
 * WHAT WAS REMOVED BESIDE WHAT WAS ADDED (AGENTS.md §11, subtract first): the
 * `Show N more` control, the `useState`/`expanded` state it needed, and the
 * `Show less` branch. On the operator's ten-item group that is one fewer control
 * and seven fewer hidden must-fix sessions; the added buttons are the packet's
 * explicit requirement and are the only new controls on this row.
 */
function BlockerGroupRow({ group, onNavigate }: { group: BlockerGroup; onNavigate: (href: string, reason?: string, groupCount?: number, identity?: RepairIdentity | null) => void }) {
	const whyItMatters = group.items[0]?.nextStep ?? 'Fix this group before the schedule can be published.';
	const scopeLabel = plainScopeLabel(group.scope);
	const destination = resolveBlockerDestination(group.reason, group.actionHref);
	return (
		<div
			className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900"
			data-testid="timetable-simple-blocker-group"
			data-blocker-scope={group.scope}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-sm font-semibold">{group.plainLabel}</p>
					<p className="mt-0.5 text-xs text-red-700">
						<Badge variant="outline" className="mr-1 h-4 px-1 text-[0.625rem] font-normal" data-testid="timetable-simple-blocker-scope">
							{scopeLabel}
						</Badge>
						{group.count} session{group.count === 1 ? '' : 's'} affected
						{/* S1c — the population this count covers. `blockerPopulationLabel`
						    comes from the derivation and uses the shared plain nouns, so
						    this line cannot name a population the list does not hold. */}
						<span data-testid="timetable-simple-blocker-population">
							{` — ${group.populationLabel} in this list`}
						</span>
					</p>
					<p className="mt-1 text-xs text-red-700">Why it matters: {whyItMatters}</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-11 shrink-0 gap-1 px-3 text-xs"
					onClick={() => onNavigate(group.actionHref, group.reason, group.count)}
					data-testid="timetable-simple-blocker-next-action"
					data-blocker-reason={group.reason}
					data-action-kind={destination.kind}
					data-action-href={destination.href ?? ''}
					aria-label={`${group.actionLabel}: ${group.plainLabel}, ${group.count} sessions affected`}
				>
					{group.actionLabel}
					<ExternalLink className="size-3" aria-hidden="true" />
				</Button>
			</div>
			{group.items.length > 0 && (
				/* S1a — EVERY item. No slice, no disclosure. */
				<div className="mt-2 space-y-1" data-testid="timetable-simple-blocker-items">
					{group.items.map((item, index) => (
						<div key={index} className="rounded-lg border border-red-100 bg-white/60 px-2 py-1.5 text-xs">
							<p className="font-medium text-red-800">{item.sectionLabel} · {item.subjectLabel}</p>
							<div className="flex items-center justify-between gap-2">
								<p className="min-w-0 text-red-600">{item.facultyLabel}</p>
								{/* S1b — this row's OWN repair control, carrying this row's
								    identity. Same @/ui treatment as the group header, so it
								    looks like every other repair control on the sheet. */}
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-11 shrink-0 cursor-pointer gap-1 px-2 text-xs"
									onClick={() => onNavigate(group.actionHref, group.reason, group.count, {
										sectionId: item.sectionId,
										subjectId: item.subjectId,
										facultyId: item.facultyId,
									})}
									data-testid="timetable-simple-blocker-item-action"
									data-blocker-reason={group.reason}
									data-item-section-id={item.sectionId ?? ''}
									data-item-subject-id={item.subjectId ?? ''}
									data-item-faculty-id={item.facultyId ?? ''}
									aria-label={`${group.actionLabel}: ${item.sectionLabel}, ${item.subjectLabel}`}
								>
									{group.actionLabel}
									<ExternalLink className="size-3" aria-hidden="true" />
								</Button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * C07B/F3 — the aggregate warning row. The candidate rendered a bare label +
 * count, so the affected sessions were unreachable from the readiness surface.
 * Like the blocker rows, the row now expands into every affected entry.
 */
function WarningGroupRow({ group }: { group: WarningGroup }) {
	const [expanded, setExpanded] = useState(false);
	const visibleItems = expanded ? group.items : group.items.slice(0, 3);
	return (
		<div
			className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-xs"
			data-testid="timetable-simple-warning-row"
			data-warning-code={group.code}
		>
			<div className="flex items-center justify-between gap-2">
				<span className="text-amber-800">{group.plainLabel}</span>
				<Badge variant="outline" className="h-5 text-[0.65rem]" data-testid="timetable-simple-warning-count">
					{group.count} session{group.count === 1 ? '' : 's'} affected
				</Badge>
			</div>
			{group.items.length > 0 && (
				<div className="mt-1.5 space-y-1">
					{visibleItems.map((item, index) => (
						<div
							key={index}
							className="rounded-lg border border-amber-100 bg-white/60 px-2 py-1 text-xs"
							data-testid="timetable-simple-warning-item"
						>
							<p className="font-medium text-amber-900">{item.sectionLabel} · {item.subjectLabel}</p>
							<p className="text-amber-700">{item.facultyLabel}</p>
						</div>
					))}
					{group.items.length > 3 && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-11 gap-1 px-2 text-xs text-amber-800"
							onClick={() => setExpanded((value) => !value)}
							aria-expanded={expanded}
							data-testid="timetable-simple-warning-expand"
						>
							{expanded ? 'Show less' : `Show ${group.items.length - 3} more`}
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

export type SimplePublishReadinessSheetBodyProps = {
	readiness: SimplePublishReadiness;
	/**
	 * C1-a — carries the followed group's own `count` so the repair banner can
	 * state the real number of affected sessions instead of a hard-coded zero.
	 */
	onNavigate: (href: string, reason?: string, groupCount?: number, identity?: RepairIdentity | null) => void;
	onCopySummary: () => void;
	onDownloadCsv: () => void;
	onClose: () => void;
};

/**
 * The readiness sheet body, separated from the Radix `Sheet` portal so the real
 * rendered surface is directly testable (C07B). The sheet renders exactly this
 * component; there is no second rendering path.
 */
export function SimplePublishReadinessSheetBody({
	readiness,
	onNavigate,
	onCopySummary,
	onDownloadCsv,
	onClose,
}: SimplePublishReadinessSheetBodyProps) {
	return (
		<>
			<ScrollArea className="flex-1 overflow-auto" style={{ height: 'calc(100svh - 8rem)' }}>
				<div className="space-y-3 p-4" data-testid="timetable-simple-publish-blocker-summary">
					{!readiness.hasGeneratedRun && (
						<div className="rounded-xl border border-slate-200 bg-muted/30 p-3 text-foreground" data-testid="timetable-simple-no-run-readiness">
							<p className="text-sm font-semibold">No timetable generated yet</p>
							<p className="mt-1 text-xs text-muted-foreground">Generate a timetable before reviewing publish readiness. Preview and readiness checks alone cannot be published.</p>
						</div>
					)}

					{readiness.hasGeneratedRun && (
						<div
							className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground"
							data-testid="timetable-simple-readiness-scope"
						>
							<p className="font-semibold text-foreground">The whole year&rsquo;s schedule decides whether you can publish</p>
							<p className="mt-1">
								{plainScopeLabel('run-wide')}: <span className="font-medium text-foreground" data-testid="timetable-simple-run-wide-blocking">{readiness.runWideBlockingHard}</span> {MUST_FIX_LABEL} · <span className="font-medium text-foreground" data-testid="timetable-simple-run-wide-unassigned">{readiness.runWideUnassigned}</span> session{readiness.runWideUnassigned === 1 ? '' : 's'} still to place
							</p>
							<p className="mt-0.5">
								Detail for the {plainScopeLabel('selected-term').toLowerCase()}: <span className="font-medium text-foreground" data-testid="timetable-simple-selected-term-count">{readiness.selectedTermViolationCount}</span> shown · <span className="font-medium text-foreground" data-testid="timetable-simple-selected-term-blocking">{readiness.selectedTermBlockingHard}</span> {MUST_FIX_LABEL}
							</p>
						</div>
					)}

					{readiness.isClean && (
						<div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900" data-testid="timetable-simple-ready-to-publish">
							<CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							<div>
								<p className="text-sm font-semibold">Ready to publish</p>
								<p className="mt-0.5 text-xs">No &ldquo;{MUST_FIX_LABEL}&rdquo; problems and no unresolved sessions remain for the {plainScopeLabel('run-wide').toLowerCase()}.</p>
							</div>
						</div>
					)}

					{readiness.hasBlockers && (
						<>
							<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">
								<p className="text-sm font-semibold">Cannot publish yet</p>
								<p className="mt-1 text-xs" data-testid="timetable-simple-blocker-sentence">
									{readiness.blockerSentence}
								</p>
								<p className="mt-1 text-xs text-red-700">Fix the &ldquo;{MUST_FIX_LABEL}&rdquo; problems first. Warnings can be reviewed once they are clear.</p>
							</div>

							<div className="space-y-2">
								{readiness.blockerGroups.map((group) => (
									<BlockerGroupRow key={group.reason} group={group} onNavigate={onNavigate} />
								))}
							</div>
						</>
					)}

					{readiness.hasWarnings && !readiness.hasBlockers && (
						<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
							<p className="text-sm font-semibold">Ready except for warnings</p>
							<p className="mt-1 text-xs">No &ldquo;{MUST_FIX_LABEL}&rdquo; problems remain for the {plainScopeLabel('run-wide').toLowerCase()}. Review the warnings, then publish if the schedule is acceptable.</p>
						</div>
					)}

					{readiness.warningGroups.length > 0 && (
						<div className="space-y-1.5" data-testid="timetable-simple-warning-group">
							<p className="text-xs font-semibold text-muted-foreground">Warnings ({readiness.totalSoftWarnings})</p>
							{readiness.totalSoftWarnings > readiness.selectedTermWarningCount && (
								<p className="text-[0.65rem] text-muted-foreground" data-testid="timetable-simple-warning-scope-note">
									Showing {readiness.selectedTermWarningCount} of {readiness.totalSoftWarnings} run-wide warnings in the selected term.
								</p>
							)}
							{readiness.warningGroups.map((wg) => (
								<WarningGroupRow key={wg.code} group={wg} />
							))}
						</div>
					)}
				</div>
			</ScrollArea>

			<div className="border-t px-4 py-3 space-y-2">
				{readiness.hasBlockers || readiness.hasWarnings ? (
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9 flex-1 gap-1.5 text-xs"
							onClick={onCopySummary}
						>
							<Copy className="size-3.5" aria-hidden="true" />
							Copy summary
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9 flex-1 gap-1.5 text-xs"
							onClick={onDownloadCsv}
						>
							<Download className="size-3.5" aria-hidden="true" />
							Download CSV
						</Button>
					</div>
				) : null}
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9 w-full gap-1.5 text-xs"
					onClick={onClose}
				>
					Close
				</Button>
			</div>
		</>
	);
}

function SimplePublishReadinessSheetImpl({
	open,
	onOpenChange,
	...contentProps
}: SimplePublishReadinessSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full max-w-md p-0 sm:max-w-lg"
				data-testid="timetable-simple-publish-readiness-sheet"
			>
				<SheetHeader className="border-b px-4 py-3">
					<SheetTitle className="text-base">Publish Readiness</SheetTitle>
					<SheetDescription className="text-xs">
						Why can't I publish?
					</SheetDescription>
				</SheetHeader>

				<SimplePublishReadinessSheetContent
					{...contentProps}
					onRequestClose={() => onOpenChange(false)}
				/>
			</SheetContent>
		</Sheet>
	);
}

export type SimplePublishReadinessSheetContentProps = Omit<SimplePublishReadinessSheetProps, 'open' | 'onOpenChange'> & {
	onRequestClose: () => void;
};

/**
 * C07B — the production readiness surface. The Radix `SheetContent` portal
 * renders exactly this component, so every gate, scope label and repair action
 * asserted against this content is the real mounted UI.
 */
export function SimplePublishReadinessSheetContent({
	draft,
	violations,
	sectionLabel,
	subjectLabel,
	facultyLabel,
	runWide,
	onNavigateToRepair,
	onRequestClose,
}: SimplePublishReadinessSheetContentProps) {
	const readiness = useMemo(
		() => deriveSimplePublishReadiness(draft, violations, sectionLabel, subjectLabel, facultyLabel, runWide),
		[draft, violations, sectionLabel, subjectLabel, facultyLabel, runWide],
	);

	const handleNavigate = useCallback(
		(href: string, reason?: string, groupCount?: number, identity?: RepairIdentity | null) => {
			onRequestClose();
			onNavigateToRepair(href, reason, resolveRepairIdentity(reason, draft, violations, identity), groupCount);
		},
		[onRequestClose, onNavigateToRepair, draft, violations],
	);

	const summaryPlain = useMemo(() => {
		const runId = draft?.runId ?? null;
		const lines: string[] = [];
		lines.push(`Publish Readiness Report`);
		/* J2 (P3): this text is pasted into emails and tickets, so the run number
		 * is a quiet suffix behind a plain phrase rather than the heading. Only a
		 * run id is available here — no timestamp — so the phrase is the anchor.
		 * The CSV download filename below is deliberately NOT changed: it stays
		 * machine-parseable. */
		if (runId) lines.push(runAnchorLabel(runId));
		/* J1r (QA F2) — this text is what the operator pastes into an email or a
		 * ticket, so it is operator-facing copy and carries the same one-word-per-
		 * idea contract as the sheet above it. The three lines that still said
		 * "blocking hard", "Hard blockers" and "run-wide" are routed through
		 * MUST_FIX_LABEL and plainScopeLabel so the pasted text cannot reintroduce
		 * a retired name the sheet itself no longer shows. */
		lines.push(`Gate (${plainScopeLabel('run-wide')}): ${readiness.runWideBlockingHard} ${MUST_FIX_LABEL}, ${readiness.runWideUnassigned} unresolved session${readiness.runWideUnassigned === 1 ? '' : 's'}`);
		lines.push(`Detail for the ${plainScopeLabel('selected-term').toLowerCase()}: ${readiness.selectedTermViolationCount} shown, ${readiness.selectedTermBlockingHard} ${MUST_FIX_LABEL}`);
		lines.push(`${MUST_FIX_LABEL} in total: ${readiness.totalHardBlockers}`);
		lines.push(`Warnings: ${readiness.totalSoftWarnings}`);
		lines.push('');
		if (readiness.hasBlockers) {
			lines.push('Blocker causes:');
			for (const group of readiness.blockerGroups) {
				lines.push(`  ${group.plainLabel}: ${group.count} session${group.count === 1 ? '' : 's'} (${plainScopeLabel(group.scope)}; ${group.populationLabel})`);
				lines.push(`    Action: ${group.actionLabel}`);
				lines.push(`    Next step: ${group.items[0]?.nextStep ?? 'Review issue'}`);
			}
		}
		if (readiness.warningGroups.length > 0) {
			lines.push('');
			lines.push('Warnings:');
			for (const wg of readiness.warningGroups) {
				lines.push(`  ${wg.plainLabel}: ${wg.count}`);
			}
		}
		return lines.join('\n');
	}, [draft?.runId, readiness]);

	const handleCopySummary = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(summaryPlain);
		} catch {
			// Clipboard write failed silently
		}
	}, [summaryPlain]);

	const handleDownloadCsv = useCallback(() => {
		const runId = draft?.runId ?? '';
		const rows: string[] = ['Type,Category,Count,Action,Next Step,Scope,Population'];
		for (const group of readiness.blockerGroups) {
			rows.push(`Blocker,"${group.plainLabel}",${group.count},"${group.actionLabel}","${group.items[0]?.nextStep ?? ''}","${plainScopeLabel(group.scope)}","${group.populationLabel}"`);
		}
		for (const wg of readiness.warningGroups) {
			rows.push(`Warning,"${wg.plainLabel}",${wg.count},,`);
		}
		const csv = rows.join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `publish-blockers-run-${runId}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}, [draft?.runId, readiness]);

	return (
		<SimplePublishReadinessSheetBody
			readiness={readiness}
			onNavigate={handleNavigate}
			onCopySummary={handleCopySummary}
			onDownloadCsv={handleDownloadCsv}
			onClose={onRequestClose}
		/>
	);
}

export const SimplePublishReadinessSheet = memo(SimplePublishReadinessSheetImpl);
