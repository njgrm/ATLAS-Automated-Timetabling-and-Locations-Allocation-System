/**
 * UX-R03c — the `/timetable/exports` center view.
 *
 * A real route surface composed from the export controls that already exist on
 * the Simple surface: `SimpleExportMenu` and `ExportPresentationSettingsDialog`
 * with the shared `useSimpleExportSurface` orchestration (the same unit the
 * Simple header uses). Nothing about what an export emits changes, and the
 * header control keeps working — this route is an additional place to land.
 *
 * The term scope still belongs to the schedule surface: when no single ordered
 * term is selected the menu stays disabled and the pane says so instead of
 * offering a mixed-term download.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';

import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import {
	SimpleExportErrorBanner,
	SimpleExportMenu,
} from '@/components/timetable/simple/SimpleBeneficiaryControls';
import { ExportPresentationSettingsDialog } from '@/components/timetable/simple/ExportPresentationSettingsDialog';
import { useSimpleExportSurface } from '@/components/timetable/simple/useSimpleExportSurface';

type TimetableExportsPaneProps = {
	schoolId: number;
	schoolYearId: number | null;
	runId: number | null;
	termFilter: 'all' | number;
	yearLabel: string | null;
	viewMode: string;
	entityFilter: string;
	hasGeneratedRun: boolean;
};

export function TimetableExportsPane({
	schoolId,
	schoolYearId,
	runId,
	termFilter,
	yearLabel,
	viewMode,
	entityFilter,
	hasGeneratedRun,
}: TimetableExportsPaneProps) {
	const [presentationSettingsOpen, setPresentationSettingsOpen] = useState(false);
	const facultyId = viewMode === 'faculty' && entityFilter ? Number(entityFilter) : null;
	const {
		summaryExport,
		classProgramExport,
		teacherProgramExport,
		exportingKind,
		exportError,
		setExportError,
		handleSimpleExport,
	} = useSimpleExportSurface({
		schoolId,
		schoolYearId,
		runId,
		termFilter,
		facultyId,
		yearLabel,
	});

	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4" data-testid="timetable-exports-pane">
			<div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-4 text-center">
				<div className="flex items-center justify-center gap-2">
					<Badge variant="outline" className="h-5 px-1.5 text-xs uppercase">Exports</Badge>
				</div>
				<Download className="mx-auto size-10 text-muted-foreground/30" aria-hidden="true" />
				<p className="text-sm font-medium">Beneficiary downloads</p>
				<p className="text-xs text-muted-foreground">
					{termFilter === 'all'
						? 'Choose a single ordered term on the schedule surface first — official downloads are bound to exactly one term.'
						: hasGeneratedRun
							? 'Official beneficiary downloads, bound to the selected ordered term.'
							: 'No timetable exists yet, so there is nothing to download.'}
				</p>
				{hasGeneratedRun ? (
					<div className="flex items-center justify-center gap-2">
						<SimpleExportMenu
							summary={summaryExport}
							classProgram={classProgramExport}
							teacherProgram={teacherProgramExport}
							showTeacherProgram={viewMode === 'faculty' && Boolean(entityFilter)}
							needsTerm={termFilter === 'all'}
							exportingKind={exportingKind}
							onExport={(kind) => { void handleSimpleExport(kind); }}
							onOpenPresentationSettings={() => setPresentationSettingsOpen(true)}
						/>
					</div>
				) : null}
				<SimpleExportErrorBanner
					error={exportError}
					onRetry={(kind) => { void handleSimpleExport(kind); }}
					onDismiss={() => setExportError(null)}
				/>
				<Button asChild variant="outline" size="sm" className="h-7 text-xs">
					<Link to="/timetable">
						<ChevronLeft className="size-3.5" />
						Back to Schedule
					</Link>
				</Button>
			</div>
			{hasGeneratedRun ? (
				<ExportPresentationSettingsDialog
					schoolId={schoolId}
					schoolYearId={schoolYearId}
					yearLabel={yearLabel}
					open={presentationSettingsOpen}
					onOpenChange={setPresentationSettingsOpen}
				/>
			) : null}
		</div>
	);
}
