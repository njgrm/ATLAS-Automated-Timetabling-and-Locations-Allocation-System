import { memo, useCallback, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Copy, Download, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import { deriveSimplePublishReadiness, type SimplePublishReadiness, type BlockerGroup } from '@/components/timetable/simplePublishReadiness';
import type { DraftReport, Violation } from '@/types';

type SimplePublishReadinessSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	draft: DraftReport | null;
	violations: Violation[];
	sectionLabel: (id: number) => string;
	subjectLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	onNavigateToRepair: (href: string, reason?: string) => void;
};

function BlockerGroupRow({ group, onNavigate }: { group: BlockerGroup; onNavigate: (href: string, reason?: string) => void }) {
	return (
		<div
			className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900"
			data-testid="timetable-simple-blocker-group"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-sm font-semibold">{group.plainLabel}</p>
					<p className="mt-0.5 text-xs text-red-700">{group.count} session{group.count === 1 ? '' : 's'} affected</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-7 shrink-0 gap-1 text-xs"
					onClick={() => onNavigate(group.actionHref, group.reason)}
					data-testid="timetable-simple-blocker-next-action"
				>
					{group.actionLabel}
					<ExternalLink className="size-3" aria-hidden="true" />
				</Button>
			</div>
			{group.items.length > 0 && (
				<div className="mt-2 space-y-1">
					{group.items.slice(0, 3).map((item, index) => (
						<div key={index} className="rounded-lg border border-red-100 bg-white/60 px-2 py-1.5 text-xs">
							<p className="font-medium text-red-800">{item.sectionLabel} · {item.subjectLabel}</p>
							<p className="text-red-600">{item.facultyLabel}</p>
						</div>
					))}
					{group.items.length > 3 && (
						<p className="text-xs text-red-600">+{group.items.length - 3} more</p>
					)}
				</div>
			)}
		</div>
	);
}

function SimplePublishReadinessSheetImpl({
	open,
	onOpenChange,
	draft,
	violations,
	sectionLabel,
	subjectLabel,
	facultyLabel,
	onNavigateToRepair,
}: SimplePublishReadinessSheetProps) {
	const readiness = useMemo(
		() => deriveSimplePublishReadiness(draft, violations, sectionLabel, subjectLabel, facultyLabel),
		[draft, violations, sectionLabel, subjectLabel, facultyLabel],
	);

	const handleNavigate = useCallback(
		(href: string, reason?: string) => {
			onOpenChange(false);
			onNavigateToRepair(href, reason);
		},
		[onOpenChange, onNavigateToRepair],
	);

	const summaryPlain = useMemo(() => {
		const runId = draft?.runId ?? null;
		const lines: string[] = [];
		lines.push(`Publish Readiness Report`);
		if (runId) lines.push(`Run: #${runId}`);
		lines.push(`Unresolved sessions: ${readiness.totalUnresolved}`);
		lines.push(`Hard blockers: ${readiness.totalHardBlockers}`);
		lines.push(`Soft warnings: ${readiness.totalSoftWarnings}`);
		lines.push('');
		if (readiness.hasBlockers) {
			lines.push('Blocker causes:');
			for (const group of readiness.blockerGroups) {
				lines.push(`  ${group.plainLabel}: ${group.count} session${group.count === 1 ? '' : 's'}`);
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
		const rows: string[] = ['Type,Category,Count,Action,Next Step'];
		for (const group of readiness.blockerGroups) {
			rows.push(`Blocker,"${group.plainLabel}",${group.count},"${group.actionLabel}","${group.items[0]?.nextStep ?? ''}"`);
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

				<ScrollArea className="flex-1 overflow-auto" style={{ height: 'calc(100svh - 8rem)' }}>
					<div className="space-y-3 p-4" data-testid="timetable-simple-publish-blocker-summary">
						{readiness.isClean && (
							<div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
								<CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
								<div>
									<p className="text-sm font-semibold">Ready to publish</p>
									<p className="mt-0.5 text-xs">No hard blockers or unresolved sessions remain.</p>
								</div>
							</div>
						)}

						{readiness.hasBlockers && (
							<>
								<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">
									<p className="text-sm font-semibold">Cannot publish yet</p>
									<p className="mt-1 text-xs">
										{readiness.totalUnresolved} session{readiness.totalUnresolved === 1 ? '' : 's'} still need fixing before this schedule can be published.
									</p>
									<p className="mt-1 text-xs text-red-700">Fix blockers first. Warnings can be reviewed after blockers are clear.</p>
								</div>

								<div className="space-y-2">
									{readiness.blockerGroups.map((group) => (
										<BlockerGroupRow key={group.reason} group={group} onNavigate={handleNavigate} />
									))}
								</div>
							</>
						)}

						{readiness.hasWarnings && !readiness.hasBlockers && (
							<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
								<p className="text-sm font-semibold">Ready except for warnings</p>
								<p className="mt-1 text-xs">No hard blockers remain. Review the warnings, then publish if the schedule is acceptable.</p>
							</div>
						)}

						{readiness.warningGroups.length > 0 && (
							<div className="space-y-1.5" data-testid="timetable-simple-warning-group">
								<p className="text-xs font-semibold text-muted-foreground">Warnings ({readiness.totalSoftWarnings})</p>
								{readiness.warningGroups.map((wg) => (
									<div key={wg.code} className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-xs">
										<span className="text-amber-800">{wg.plainLabel}</span>
										<Badge variant="outline" className="h-5 text-[0.65rem]">{wg.count}</Badge>
									</div>
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
							onClick={handleCopySummary}
						>
							<Copy className="size-3.5" aria-hidden="true" />
							Copy summary
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9 flex-1 gap-1.5 text-xs"
							onClick={handleDownloadCsv}
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
					onClick={() => onOpenChange(false)}
				>
					Close
				</Button>
			</div>
			</SheetContent>
		</Sheet>
	);
}

export const SimplePublishReadinessSheet = memo(SimplePublishReadinessSheetImpl);
