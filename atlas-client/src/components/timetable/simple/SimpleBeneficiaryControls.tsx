/**
 * TT-OUTPUT-C03R2 — Visible Simple Timetable term switcher and beneficiary
 * export menu. The switcher selects exactly one ordered term; the export menu
 * binds every official download to that selected term.
 */

import { AlertTriangle, Download, Loader2 } from 'lucide-react';

import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { SimpleExportKind } from '@/components/timetable/simple/simpleExportRequests';

export function SimpleTermSwitcher({ context }: { context: ScheduleReviewWorkspaceHeaderContext }) {
	const value = context.termFilter === 'all' ? 'all' : String(context.termFilter);
	const optionValues = context.termOptions.map((option) => option.value).join(',');

	return (
		<div
			className="flex shrink-0 items-center gap-2"
			data-testid="timetable-simple-term-switcher"
		>
			<span className="text-sm font-medium text-foreground">Term</span>
			<Select value={value} onValueChange={(next) => context.onTermFilterChange(next === 'all' ? 'all' : Number(next))}>
				<SelectTrigger
					className="h-9 w-[8.5rem] shrink-0 text-sm"
					aria-label="Term"
					data-testid="timetable-simple-term-filter"
					data-term-filter={value}
					data-term-options={optionValues}
				>
					<SelectValue placeholder="Term" />
				</SelectTrigger>
				<SelectContent>
					{context.termOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.value === 'all' ? 'All terms' : `Term ${option.value}`}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<span className="sr-only" data-testid="timetable-simple-term-options">
				Available terms: {context.termOptions.map((option) => option.label).join(', ')}
			</span>
		</div>
	);
}

type SimpleExportMenuProps = {
	onOpenDownloadSchedules: () => void;
};

export function SimpleExportMenu({ onOpenDownloadSchedules }: SimpleExportMenuProps) {
	return (
		<div className="flex shrink-0 items-center gap-1.5" data-testid="timetable-simple-print-actions">
			<Button type="button" variant="outline" size="sm" className="h-8 min-h-11 min-w-11 gap-1.5 px-2.5 text-xs sm:min-h-0 sm:min-w-0" onClick={onOpenDownloadSchedules} data-testid="timetable-open-download-schedules">
				<Download className="size-3.5" aria-hidden="true" /><span>Download schedules</span>
			</Button>
		</div>
	);
}

type SimpleExportErrorBannerProps = {
	error: { kind: SimpleExportKind; message: string } | null;
	onRetry: (kind: SimpleExportKind) => void;
	onDismiss: () => void;
};

/**
 * TT-OUTPUT-C03R3 — one visible, retryable failure surface for EVERY official
 * beneficiary download (summary workbook, class program, teacher program), not
 * only the teacher program. The retry re-dispatches the exact failed kind.
 */
export function SimpleExportErrorBanner({ error, onRetry, onDismiss }: SimpleExportErrorBannerProps) {
	if (!error) return null;
	return (
		<div
			className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border-t border-red-200"
			data-testid="timetable-simple-export-error"
			data-export-error-kind={error.kind}
		>
			<AlertTriangle className="size-3.5 text-red-600 shrink-0" aria-hidden="true" />
			<span className="text-xs text-red-700">{error.message}</span>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="h-5 px-1 text-xs text-red-600 hover:text-red-800"
				data-testid="timetable-simple-export-retry"
				onClick={() => onRetry(error.kind)}
			>
				Retry
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="h-5 px-1 text-xs text-red-600 hover:text-red-800"
				onClick={onDismiss}
			>
				Dismiss
			</Button>
		</div>
	);
}
