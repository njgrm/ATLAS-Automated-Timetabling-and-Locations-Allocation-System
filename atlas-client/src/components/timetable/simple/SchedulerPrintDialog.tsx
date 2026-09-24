import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Printer, Search, Settings2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { getPreferredAccessToken } from '@/lib/auth';
import { ensureFilenameExtension, resolveDownloadFilename, triggerBlobDownload } from '@/lib/export-download';
import { resolveSchedulerPrintOptionsUrl, resolveSchedulerPrintRequest, schedulerPrintProgramForView, type SchedulerPrintProgram } from './schedulerPrintRequests';

type Choice = { value: number; label: string };
type PrintOptions = {
	runId: number;
	termIndex: number;
	yearLabel: string;
	grades: Choice[];
	sections: Choice[];
	teachers: Choice[];
	rooms: Choice[];
};
type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	schoolId: number;
	schoolYearId: number | null;
	runId: number | null;
	termIndex: number | 'all';
	yearLabel: string | null;
	viewMode: 'section' | 'faculty' | 'room';
	entityFilter: string;
	onOpenPresentationSettings?: () => void;
};

const PROGRAMS: Array<{ value: SchedulerPrintProgram; label: string }> = [
	{ value: 'grade', label: 'Grade' },
	{ value: 'section', label: 'Section' },
	{ value: 'teacher', label: 'Teacher' },
	{ value: 'room', label: 'Room' },
];

function choicesFor(options: PrintOptions, program: SchedulerPrintProgram): Choice[] {
	return program === 'grade' ? options.grades
		: program === 'section' ? options.sections
			: program === 'teacher' ? options.teachers : options.rooms;
}

export function SchedulerPrintDialog(props: Props) {
	const [program, setProgram] = useState<SchedulerPrintProgram>('grade');
	const [format, setFormat] = useState<'docx' | 'xlsx'>('docx');
	const [options, setOptions] = useState<PrintOptions | null>(null);
	const [selectedIds, setSelectedIds] = useState<number[]>([]);
	const [query, setQuery] = useState('');
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const optionsUrl = resolveSchedulerPrintOptionsUrl({
		schoolId: props.schoolId, schoolYearId: props.schoolYearId, runId: props.runId,
		termIndex: props.termIndex, yearLabel: props.yearLabel,
	});

	useEffect(() => {
		setOptions(null);
		setSelectedIds([]);
		setQuery('');
		setError(null);
		if (!props.open || !optionsUrl) return;
		const controller = new AbortController();
		setLoading(true);
		void fetch(optionsUrl, { headers: { Authorization: `Bearer ${getPreferredAccessToken() ?? ''}` }, signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) {
					const payload = await response.json().catch(() => ({})) as { message?: string };
					throw new Error(payload.message || 'Print options could not be loaded.');
				}
				return response.json() as Promise<PrintOptions>;
			})
			.then((next) => {
				setOptions(next);
				const selectedMode = schedulerPrintProgramForView(props.viewMode);
				setProgram(selectedMode);
				const selectedId = /^\d+$/.test(props.entityFilter) ? Number(props.entityFilter) : null;
				const choices = choicesFor(next, selectedMode);
				setSelectedIds(selectedId !== null && choices.some((choice) => choice.value === selectedId) ? [selectedId] : []);
			})
			.catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Print options could not be loaded.'); })
			.finally(() => { if (!controller.signal.aborted) setLoading(false); });
		return () => controller.abort();
	}, [props.open, optionsUrl, props.viewMode, props.entityFilter]);

	const choices = options ? choicesFor(options, program) : [];
	const visibleChoices = useMemo(() => {
		const normalized = query.trim().toLocaleLowerCase();
		return choices.filter((choice) => !normalized || choice.label.toLocaleLowerCase().includes(normalized));
	}, [choices, query]);
	const allSelected = choices.length > 0 && selectedIds.length === choices.length;
	const unresolvedReason = props.termIndex === 'all' ? 'Choose one ordered term in the timetable header.'
		: !props.runId ? 'Choose a completed schedule run first.'
			: !props.schoolYearId ? 'School-year scope is not ready.' : null;

	const toggleChoice = (id: number, checked: boolean | 'indeterminate') => {
		setSelectedIds((current) => checked === true
			? current.includes(id) ? current : [...current, id]
			: current.filter((value) => value !== id));
	};

	const download = async () => {
		if (busy || !options || unresolvedReason) return;
		const request = resolveSchedulerPrintRequest({
			schoolId: props.schoolId, schoolYearId: props.schoolYearId, runId: props.runId,
			termIndex: props.termIndex, yearLabel: options.yearLabel, program, format,
			...(allSelected && choices.length > 1 ? { all: true } : { ids: selectedIds }),
		});
		if (!request) return;
		setBusy(true);
		setError(null);
		try {
			const token = getPreferredAccessToken();
			const response = await fetch(request.url, {
				method: request.method,
				headers: { Authorization: `Bearer ${token ?? ''}`, ...(request.body ? { 'Content-Type': 'application/json' } : {}) },
				...(request.body ? { body: JSON.stringify(request.body) } : {}),
			});
			if (!response.ok) {
				const payload = await response.json().catch(() => ({})) as { message?: string };
				throw new Error(payload.message || 'Schedules could not be prepared.');
			}
			const blob = await response.blob();
			const filename = ensureFilenameExtension(resolveDownloadFilename(response, request.filename), request.url);
			triggerBlobDownload(blob, filename);
			props.onOpenChange(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Schedules could not be prepared.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={props.open} onOpenChange={props.onOpenChange}>
			<DialogContent className="max-w-2xl" data-testid="scheduler-print-dialog">
				<DialogHeader>
					<DialogTitle>Download schedules</DialogTitle>
					<DialogDescription>Choose Word for official printable forms or Excel for editable working schedules. Downloads use one completed run and one ordered term. Selecting several items creates one ZIP package.</DialogDescription>
				</DialogHeader>
				{unresolvedReason ? <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{unresolvedReason}</p> : (
					<div className="grid min-h-0 gap-4">
						<div className="flex flex-wrap gap-2" aria-label="File format">
							<Button type="button" size="sm" variant={format === 'docx' ? 'default' : 'outline'} aria-pressed={format === 'docx'} onClick={() => setFormat('docx')}><Printer className="mr-2 size-4" aria-hidden="true" />Word</Button>
							<Button type="button" size="sm" variant={format === 'xlsx' ? 'default' : 'outline'} aria-pressed={format === 'xlsx'} onClick={() => setFormat('xlsx')}><FileSpreadsheet className="mr-2 size-4" aria-hidden="true" />Excel</Button>
						</div>
						<div className="flex flex-wrap gap-2" aria-label="Program type">
							{PROGRAMS.map((item) => (
								<Button key={item.value} type="button" size="sm" variant={program === item.value ? 'default' : 'outline'}
									aria-pressed={program === item.value} onClick={() => { setProgram(item.value); setSelectedIds([]); }}>
									{item.label}
								</Button>
							))}
						</div>
						<div className="flex items-end gap-3">
							<div className="grid flex-1 gap-1.5">
								<Label htmlFor="scheduler-print-search">Search {program.toLowerCase()} programs</Label>
								<div className="relative">
									<Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
									<Input id="scheduler-print-search" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-8" placeholder={`Find a ${program.toLowerCase()}`} />
								</div>
							</div>
							<Button type="button" variant="outline" size="sm" disabled={choices.length === 0}
								onClick={() => setSelectedIds(allSelected ? [] : choices.map((choice) => choice.value))}>
								{allSelected ? 'Clear all' : 'Select all'}
							</Button>
						</div>
						<div className="max-h-64 min-h-20 overflow-auto rounded-md border p-2" aria-live="polite">
							{loading ? <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading available programs…</div>
								: visibleChoices.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No {program.toLowerCase()} programs are available for this term.</p>
									: visibleChoices.map((choice) => (
										<Label key={choice.value} className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm hover:bg-muted/60">
											<Checkbox checked={selectedIds.includes(choice.value)} onCheckedChange={(checked) => toggleChoice(choice.value, checked)} />
											<span>{choice.label}</span>
										</Label>
									))}
						</div>
						<p className="text-xs text-muted-foreground">{selectedIds.length} selected · {options?.yearLabel || 'School year'} · Term {props.termIndex}</p>
					</div>
				)}
				{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
				<DialogFooter>
					{props.onOpenPresentationSettings ? <Button type="button" variant="ghost" onClick={props.onOpenPresentationSettings}><Settings2 className="mr-2 size-4" aria-hidden="true" />Header and signatories</Button> : null}
					<Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Close</Button>
					<Button type="button" onClick={() => { void download(); }} disabled={!options || loading || busy || Boolean(unresolvedReason) || selectedIds.length === 0}>
						{busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : format === 'docx' ? <Printer className="mr-2 size-4" aria-hidden="true" /> : <Download className="mr-2 size-4" aria-hidden="true" />}
						{busy ? 'Preparing…' : selectedIds.length > 1 || (allSelected && choices.length > 1) ? 'Download ZIP' : `Download ${format === 'docx' ? 'Word' : 'Excel'}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
