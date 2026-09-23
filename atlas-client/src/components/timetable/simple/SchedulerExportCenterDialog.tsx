import { useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { dispatchSimpleExport } from './simpleExportRequests';
import {
	resolveSchedulerExportCenterRequest,
	type SchedulerExportFormat,
	type SchedulerExportKind,
	type SchedulerExportSelection,
} from './schedulerExportCenterRequests';

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	schoolId: number;
	schoolYearId: number | null;
	runId: number | null;
	termIndex: number | 'all';
	yearLabel: string | null;
	selection: SchedulerExportSelection;
};

const EXPORT_OPTIONS: Array<{ value: SchedulerExportKind; label: string }> = [
	{ value: 'teacher-consolidated', label: 'Teacher consolidated workbook' },
	{ value: 'class-program', label: 'Class program' },
	{ value: 'room-program', label: 'Room program' },
	{ value: 'section-program', label: 'Section program' },
];

export function SchedulerExportCenterDialog(props: Props) {
	const [kind, setKind] = useState<SchedulerExportKind>('teacher-consolidated');
	const [format, setFormat] = useState<SchedulerExportFormat>('xlsx');
	const [scope, setScope] = useState<'all' | 'selected'>('all');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const supportsSelection = kind === 'room-program' ? props.selection?.kind === 'room'
		: kind === 'section-program' ? props.selection?.kind === 'section' : false;
	const supportsDocx = kind === 'room-program' || kind === 'section-program';
	const request = useMemo(() => resolveSchedulerExportCenterRequest({
		schoolId: props.schoolId,
		schoolYearId: props.schoolYearId,
		runId: props.runId,
		termIndex: props.termIndex,
		yearLabel: props.yearLabel,
		kind,
		format: supportsDocx ? format : 'xlsx',
		scope: supportsSelection ? scope : 'all',
		selection: props.selection,
	}), [props.schoolId, props.schoolYearId, props.runId, props.termIndex, props.yearLabel, kind, format, scope, supportsDocx, supportsSelection, props.selection]);
	const disabledReason = props.termIndex === 'all'
		? 'Choose one ordered term in the timetable header before exporting.'
		: !props.runId ? 'Select a completed schedule run first.'
			: !request ? 'This export is not available for the current selection.' : null;

	const exportFile = async () => {
		if (!request || busy) return;
		setBusy(true);
		setError(null);
		try {
			await dispatchSimpleExport(request);
			props.onOpenChange(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'The export could not be downloaded.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={props.open} onOpenChange={props.onOpenChange}>
			<DialogContent className="max-w-xl" data-testid="scheduler-export-center">
				<DialogHeader>
					<DialogTitle>Export Center</DialogTitle>
					<DialogDescription>
						Create a paste-ready file from the selected run and ordered term. Draft files are marked for review.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-1.5">
						<Label htmlFor="scheduler-export-kind">Schedule file</Label>
						<Select value={kind} onValueChange={(value) => {
							const next = value as SchedulerExportKind;
							setKind(next);
							if (next === 'teacher-consolidated' || next === 'class-program') setFormat('xlsx');
							setScope('all');
						}}>
							<SelectTrigger id="scheduler-export-kind" data-testid="scheduler-export-kind"><SelectValue /></SelectTrigger>
							<SelectContent>{EXPORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
						</Select>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="scheduler-export-format">File format</Label>
						<Select value={supportsDocx ? format : 'xlsx'} onValueChange={(value) => setFormat(value as SchedulerExportFormat)} disabled={!supportsDocx}>
							<SelectTrigger id="scheduler-export-format" data-testid="scheduler-export-format"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="xlsx">Excel workbook (.xlsx)</SelectItem>
								{supportsDocx ? <SelectItem value="docx">Word document (.docx)</SelectItem> : null}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-1.5 sm:col-span-2">
						<Label htmlFor="scheduler-export-scope">Include</Label>
						<Select value={supportsSelection ? scope : 'all'} onValueChange={(value) => setScope(value as 'all' | 'selected')}>
							<SelectTrigger id="scheduler-export-scope" data-testid="scheduler-export-scope"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All {kind === 'room-program' ? 'rooms' : 'sections'}</SelectItem>
								{supportsSelection ? <SelectItem value="selected">Current selection: {props.selection!.label}</SelectItem> : null}
							</SelectContent>
						</Select>
					</div>
				</div>
				{disabledReason ? <p className="text-sm text-amber-700" role="status" data-testid="scheduler-export-disabled-reason">{disabledReason}</p> : null}
				{error ? <p className="text-sm font-medium text-destructive" role="alert" data-testid="scheduler-export-error">{error}</p> : null}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
					<Button type="button" onClick={() => { void exportFile(); }} disabled={!request || busy} data-testid="scheduler-export-download">
						{busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 size-4" aria-hidden="true" />}
						{busy ? 'Preparing…' : 'Download'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
