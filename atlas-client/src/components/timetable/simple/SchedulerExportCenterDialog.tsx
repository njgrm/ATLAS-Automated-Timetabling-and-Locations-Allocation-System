import { useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { SearchableSelect } from '@/ui/searchable-select';
import { dispatchSimpleExport } from './simpleExportRequests';
import {
	resolveSchedulerExportCenterRequest,
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
	entities?: Exclude<SchedulerExportSelection, null>[];
};

const EXPORT_OPTIONS: Array<{ value: SchedulerExportKind; label: string }> = [
	{ value: 'teacher-consolidated', label: 'Teacher working data' },
	{ value: 'class-program', label: 'Class working data' },
	{ value: 'section-program', label: 'Section working data' },
	{ value: 'room-program', label: 'Room working data' },
];

export function SchedulerExportCenterDialog(props: Props) {
	const [kind, setKind] = useState<SchedulerExportKind>('teacher-consolidated');
	const [scope, setScope] = useState<'all' | 'selected'>('all');
	const [entityId, setEntityId] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const entityOptions = (props.entities ?? (props.selection ? [props.selection] : []))
		.filter((entity) => entity.kind === (kind === 'room-program' ? 'room' : 'section'));
	const supportsSelection = (kind === 'room-program' || kind === 'section-program') && entityOptions.length > 0;
	const selectedEntity = entityOptions.find((entity) => String(entity.id) === entityId)
		?? (props.selection && props.selection.kind === (kind === 'room-program' ? 'room' : 'section') ? props.selection : null);
	const request = useMemo(() => resolveSchedulerExportCenterRequest({
		schoolId: props.schoolId,
		schoolYearId: props.schoolYearId,
		runId: props.runId,
		termIndex: props.termIndex,
		yearLabel: props.yearLabel,
		kind,
		format: 'xlsx',
		scope: supportsSelection ? scope : 'all',
		selection: selectedEntity,
	}), [props.schoolId, props.schoolYearId, props.runId, props.termIndex, props.yearLabel, kind, scope, supportsSelection, props.selection, props.entities, selectedEntity]);
	const disabledReason = props.termIndex === 'all'
		? 'Choose one ordered term in the timetable header before exporting.'
		: !props.runId ? 'Select a completed schedule run first.'
			: !request ? 'This workbook is not available for the current selection.' : null;

	const exportFile = async () => {
		if (!request || busy) return;
		setBusy(true);
		setError(null);
		try {
			await dispatchSimpleExport(request);
			props.onOpenChange(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'The Excel workbook could not be downloaded.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={props.open} onOpenChange={props.onOpenChange}>
			<DialogContent className="max-w-xl" data-testid="scheduler-office-working-data">
				<DialogHeader>
					<DialogTitle>Office working data</DialogTitle>
					<DialogDescription>Download an Excel workbook from the selected run and ordered term. These are working files, not official print programs.</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-1.5">
						<Label htmlFor="scheduler-office-kind">Excel workbook</Label>
						<Select value={kind} onValueChange={(value) => {
							const next = value as SchedulerExportKind;
							setKind(next);
							const expected = next === 'room-program' ? 'room' : 'section';
							setEntityId(props.selection?.kind === expected ? String(props.selection.id) : '');
							const matchesSelection = (next === 'room-program' && props.selection?.kind === 'room')
								|| (next === 'section-program' && props.selection?.kind === 'section');
							setScope(matchesSelection ? 'selected' : 'all');
						}}>
							<SelectTrigger id="scheduler-office-kind"><SelectValue /></SelectTrigger>
							<SelectContent>{EXPORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
						</Select>
					</div>
					<div className="grid gap-1.5">
						<Label>File type</Label>
						<div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">Excel workbook (.xlsx)</div>
					</div>
					<div className="grid gap-1.5 sm:col-span-2">
						<Label htmlFor="scheduler-office-scope">Include</Label>
						<Select value={supportsSelection ? scope : 'all'} onValueChange={(value) => setScope(value as 'all' | 'selected')}>
							<SelectTrigger id="scheduler-office-scope"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All {kind === 'room-program' ? 'rooms' : 'sections'}</SelectItem>
								{supportsSelection ? <SelectItem value="selected">Current {kind === 'room-program' ? 'room' : 'section'}</SelectItem> : null}
							</SelectContent>
						</Select>
					</div>
					{supportsSelection && scope === 'selected' ? (
						<div className="grid gap-1.5 sm:col-span-2">
							<Label>{kind === 'room-program' ? 'Room' : 'Section'}</Label>
							<SearchableSelect value={selectedEntity ? String(selectedEntity.id) : ''} onValueChange={setEntityId}
								items={entityOptions.map((entity) => ({ value: String(entity.id), label: entity.label }))}
								placeholder={`Search ${kind === 'room-program' ? 'rooms' : 'sections'}`} triggerClassName="w-full justify-between" disabled={entityOptions.length === 0} />
						</div>
					) : null}
				</div>
				{disabledReason ? <p className="text-sm text-amber-700" role="status">{disabledReason}</p> : null}
				{error ? <p className="text-sm font-medium text-destructive" role="alert">{error}</p> : null}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Close</Button>
					<Button type="button" onClick={() => { void exportFile(); }} disabled={!request || busy}>
						{busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 size-4" aria-hidden="true" />}
						{busy ? 'Preparing…' : 'Download Excel'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
