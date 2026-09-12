/**
 * TT-OUTPUT-C03R2 — Visible Simple Timetable term switcher and beneficiary
 * export menu. The switcher selects exactly one ordered term; the export menu
 * binds every official download to that selected term.
 */

import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { SimpleExportDescriptor, SimpleExportKind } from '@/components/timetable/simple/simpleExportRequests';

export function SimpleTermSwitcher({ context }: { context: ScheduleReviewWorkspaceHeaderContext }) {
	const value = context.termFilter === 'all' ? 'all' : String(context.termFilter);
	const optionValues = context.termOptions.map((option) => option.value).join(',');

	return (
		<div
			className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-2 py-1"
			data-testid="timetable-simple-term-switcher"
		>
			<span className="hidden shrink-0 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground xl:inline">
				Term
			</span>
			<Select value={value} onValueChange={(next) => context.onTermFilterChange(next === 'all' ? 'all' : Number(next))}>
				<SelectTrigger
					className="h-8 w-[8.5rem] shrink-0 text-xs"
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
							{option.label}
							{context.activeTermIndex !== null && option.value === String(context.activeTermIndex) ? (
								<span className="ml-1 text-[0.6rem] text-muted-foreground">(active)</span>
							) : null}
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
	summary: SimpleExportDescriptor | null;
	classProgram: SimpleExportDescriptor | null;
	teacherProgram: SimpleExportDescriptor | null;
	showTeacherProgram: boolean;
	needsTerm: boolean;
	exportingKind: SimpleExportKind | null;
	onExport: (kind: SimpleExportKind) => void;
};

function ExportIcon({ spinning }: { spinning: boolean }) {
	return spinning
		? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
		: <Download className="size-3.5" aria-hidden="true" />;
}

export function SimpleExportMenu({
	summary,
	classProgram,
	teacherProgram,
	showTeacherProgram,
	needsTerm,
	exportingKind,
	onExport,
}: SimpleExportMenuProps) {
	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 min-h-11 min-w-11 shrink gap-1 px-1.5 text-xs sm:min-h-0 sm:min-w-0 sm:gap-1.5 sm:px-2.5"
						aria-label="Download beneficiary outputs"
						data-testid="timetable-simple-export-trigger"
						data-export-needs-term={needsTerm ? 'true' : 'false'}
						data-export-summary-url={summary?.url ?? ''}
						data-export-summary-filename={summary?.filename ?? ''}
						data-export-class-program-url={classProgram?.url ?? ''}
						data-export-class-program-filename={classProgram?.filename ?? ''}
						data-export-teacher-program-url={teacherProgram?.url ?? ''}
						data-export-teacher-program-filename={teacherProgram?.filename ?? ''}
					>
						<Download className="size-3.5" aria-hidden="true" />
						<span className="hidden sm:inline">Download</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-72">
					<DropdownMenuLabel className="text-xs">Beneficiary downloads</DropdownMenuLabel>
					{needsTerm ? (
						<p
							className="px-2 pb-1 text-xs font-medium text-amber-700"
							data-testid="timetable-simple-export-needs-term-menu"
						>
							Choose a term to export.
						</p>
					) : null}
					<DropdownMenuItem
						className="h-9 gap-2 text-xs"
						disabled={!summary}
						data-testid="timetable-simple-export-workbook"
						onSelect={(event) => { event.preventDefault(); onExport('summary-teacher-schedule'); }}
					>
						<ExportIcon spinning={exportingKind === 'summary-teacher-schedule'} />
						Summary workbook (.xlsx)
					</DropdownMenuItem>
					<DropdownMenuItem
						className="h-9 gap-2 text-xs"
						disabled={!classProgram}
						data-testid="timetable-simple-export-class-program"
						onSelect={(event) => { event.preventDefault(); onExport('class-program'); }}
					>
						<ExportIcon spinning={exportingKind === 'class-program'} />
						Class program (.xlsx)
					</DropdownMenuItem>
					{showTeacherProgram ? (
						<DropdownMenuItem
							className="h-9 gap-2 text-xs"
							disabled={!teacherProgram || exportingKind === 'teacher-program'}
							data-testid="timetable-simple-export-teacher-program"
							onSelect={(event) => { event.preventDefault(); onExport('teacher-program'); }}
						>
							<ExportIcon spinning={exportingKind === 'teacher-program'} />
							Teacher program (.docx)
						</DropdownMenuItem>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
			{needsTerm ? (
				<span
					className="hidden shrink-0 text-[0.68rem] font-medium text-amber-700 lg:inline"
					data-testid="timetable-simple-export-needs-term"
				>
					Choose a term to export.
				</span>
			) : null}
		</>
	);
}
