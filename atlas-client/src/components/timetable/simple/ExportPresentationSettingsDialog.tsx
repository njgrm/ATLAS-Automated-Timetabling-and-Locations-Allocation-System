/**
 * BENEFICIARY-EXPORT-PARITY-C05R1 — editable Teacher Program export
 * presentation (signatory) settings editor.
 *
 * Reachable from the Simple Timetable download area. Uses ATLAS shadcn/Radix
 * controls only, is bound to the active school/year, and performs an optimistic
 * revision (CAS) save. Reads and previews are zero-write.
 */

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Separator } from '@/ui/separator';

import {
	ExportPresentationError,
	fetchExportPresentationProfile,
	saveExportPresentationSettings,
	toExportPresentationInput,
	type ExportPresentationInput,
	type ExportPresentationProfile,
} from '@/components/timetable/simple/exportPresentationApi';

type Props = {
	schoolId: number;
	schoolYearId: number | null;
	yearLabel: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const FIELD_GROUPS: Array<{ key: keyof ExportPresentationInput; titleKey: keyof ExportPresentationInput; label: string }> = [
	{ key: 'schoolHeadName', titleKey: 'schoolHeadTitle', label: 'School Head' },
	{ key: 'psdsName', titleKey: 'psdsTitle', label: 'PSDS' },
	{ key: 'cidChiefName', titleKey: 'cidChiefTitle', label: 'CID Chief' },
	{ key: 'asdsName', titleKey: 'asdsTitle', label: 'ASDS' },
];

const IDENTITY_FIELDS: Array<{ key: 'officialSchoolName' | 'headerLine' | 'regionLine' | 'divisionLine' | 'districtLine'; label: string }> = [
	{ key: 'officialSchoolName', label: 'Official school name' },
	{ key: 'headerLine', label: 'Header or department line' },
	{ key: 'regionLine', label: 'Region' },
	{ key: 'divisionLine', label: 'Division' },
	{ key: 'districtLine', label: 'District' },
];

export function ExportPresentationSettingsDialog({ schoolId, schoolYearId, yearLabel, open, onOpenChange }: Props) {
	const [profile, setProfile] = useState<ExportPresentationProfile | null>(null);
	const [draft, setDraft] = useState<Required<ExportPresentationInput> | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!Number.isInteger(schoolYearId) || (schoolYearId ?? 0) <= 0) return;
		setLoading(true);
		setError(null);
		setStatus(null);
		try {
			const loaded = await fetchExportPresentationProfile(schoolId, schoolYearId as number);
			setProfile(loaded);
			setDraft(toExportPresentationInput(loaded));
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not load export presentation settings.');
		} finally {
			setLoading(false);
		}
	}, [schoolId, schoolYearId]);

	useEffect(() => {
		if (open) void load();
	}, [open, load]);

	const update = (key: keyof ExportPresentationInput, value: string) => {
		setDraft((previous) => (previous ? { ...previous, [key]: value } : previous));
	};

	const handleSave = async () => {
		if (!draft || saving) return;
		if (!Number.isInteger(schoolYearId) || (schoolYearId ?? 0) <= 0) {
			setError('Select the active school year before editing export signatories.');
			return;
		}
		setSaving(true);
		setError(null);
		setStatus(null);
		try {
			const expectedRevision = profile?.revision ?? 0;
			const result = await saveExportPresentationSettings(schoolId, schoolYearId as number, expectedRevision, draft);
			setProfile(result.profile);
			setDraft(toExportPresentationInput(result.profile));
			setStatus(result.replayed ? 'No changes to save.' : `Saved as revision ${result.revision}.`);
		} catch (err) {
			if (err instanceof ExportPresentationError && err.code === 'PRESENTATION_PROFILE_STALE') {
				// The profile changed elsewhere; reload so the next save is bound.
				setError('These settings changed since they were loaded. Reloading the current values.');
				await load();
			} else {
				setError(err instanceof Error ? err.message : 'Could not save export presentation settings.');
			}
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-w-2xl"
				data-testid="export-presentation-dialog"
				data-school-id={schoolId}
				data-school-year-id={schoolYearId ?? ''}
				data-revision={profile?.revision ?? ''}
			>
				<DialogHeader>
					<DialogTitle>Official export profile</DialogTitle>
					<DialogDescription>
						These identity lines, names, and titles print on official Word schedules for
						{yearLabel ? ` SY ${yearLabel}` : ' the active school year'}. Published and archived
						exports keep the values that were effective when they were published.
					</DialogDescription>
				</DialogHeader>

				{loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
				{error ? (
					<p className="text-sm font-medium text-red-600" role="alert" data-testid="export-presentation-error">
						{error}
					</p>
				) : null}
				{status ? (
					<p className="text-sm font-medium text-emerald-700" data-testid="export-presentation-status">
						{status}
					</p>
				) : null}

				{draft ? (
					<div className="flex max-h-[60svh] flex-col gap-4 overflow-y-auto pr-1">
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							{IDENTITY_FIELDS.map((field) => (
								<div key={field.key} className="flex flex-col gap-1.5">
									<Label htmlFor={`export-presentation-${field.key}`}>{field.label}</Label>
									<Input id={`export-presentation-${field.key}`} value={(draft[field.key] as string) ?? ''} onChange={(event) => update(field.key, event.target.value)} data-testid={`export-presentation-${field.key}`} />
								</div>
							))}
						</div>
						<Separator />
						{FIELD_GROUPS.map((group) => (
							<div key={group.key} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<div className="flex flex-col gap-1.5">
									<Label htmlFor={`export-presentation-${group.key}`}>{group.label} name</Label>
									<Input
										id={`export-presentation-${group.key}`}
										value={(draft[group.key] as string) ?? ''}
										onChange={(event) => update(group.key, event.target.value)}
										placeholder="Leave blank for a blank signature line"
										data-testid={`export-presentation-${group.key}`}
									/>
								</div>
								<div className="flex flex-col gap-1.5">
									<Label htmlFor={`export-presentation-${group.titleKey}`}>{group.label} displayed title</Label>
									<Input
										id={`export-presentation-${group.titleKey}`}
										value={(draft[group.titleKey] as string) ?? ''}
										onChange={(event) => update(group.titleKey, event.target.value)}
										data-testid={`export-presentation-${group.titleKey}`}
									/>
								</div>
							</div>
						))}
						<Separator />
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="export-presentation-footer">Footer line (optional)</Label>
							<Input
								id="export-presentation-footer"
								value={draft.footerText ?? ''}
								onChange={(event) => update('footerText', event.target.value)}
								placeholder="e.g. For every learner, we rise!"
								data-testid="export-presentation-footerText"
							/>
						</div>
						<p className="text-xs text-muted-foreground">
							The Teacher signatory always resolves from the selected teacher and cannot be replaced here.
						</p>
					</div>
				) : null}

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="export-presentation-cancel">
						Cancel
					</Button>
					<Button
						type="button"
						onClick={() => { void handleSave(); }}
						disabled={saving || loading || !draft}
						data-testid="export-presentation-save"
						data-busy={saving ? 'true' : 'false'}
					>
						{saving ? 'Saving…' : 'Save'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
