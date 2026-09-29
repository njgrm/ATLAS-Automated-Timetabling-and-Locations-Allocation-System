import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Switch } from '@/ui/switch';
import { Textarea } from '@/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import atlasApi from '@/lib/api';
import { departmentLabel } from '@/lib/deped-glossary';
import type { FacultySummary } from '@/types';

interface CreatePlaceholderDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	facultyToEdit: FacultySummary | null;
	departments: string[];
}

const DEFAULT_SCHOOL_ID = 1;
const MAX_WEEKLY_HOURS = 40;

type FieldErrors = {
	customDept?: string;
	maxHours?: string;
};

export function CreatePlaceholderDialog({
	open,
	onOpenChange,
	onSuccess,
	facultyToEdit,
	departments,
}: CreatePlaceholderDialogProps) {
	const isEdit = facultyToEdit !== null;

	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [selectedDept, setSelectedDept] = useState('');
	const [customDept, setCustomDept] = useState('');
	const [maxHours, setMaxHours] = useState(30);
	const [canTeachOutside, setCanTeachOutside] = useState(true);
	const [localNotes, setLocalNotes] = useState('');
	const [saving, setSaving] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const firstNameRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (open) {
			setFieldErrors({});
			if (facultyToEdit) {
				setFirstName(facultyToEdit.firstName);
				setLastName(facultyToEdit.lastName);

				const dept = facultyToEdit.department || '';
				if (departments.includes(dept)) {
					setSelectedDept(dept);
					setCustomDept('');
				} else if (dept) {
					setSelectedDept('CUSTOM');
					setCustomDept(dept);
				} else {
					setSelectedDept('PLACEHOLDER');
					setCustomDept('');
				}

				setMaxHours(facultyToEdit.maxHoursPerWeek);
				setCanTeachOutside(facultyToEdit.canTeachOutsideDepartment ?? true);
				setLocalNotes(facultyToEdit.localNotes || '');
			} else {
				// Phase 3.5 / Decision shorthand: default name fields are EMPTY so a
				// placeholder is never accidentally saved as the brand string
				// "Teacher X". The hint suggests a meaningful temporary name.
				setFirstName('');
				setLastName('');
				// Docx1 T7 (operator 30 Sep 2026): no department is preselected — the
				// trigger shows its `Select Department` placeholder. Saving a blank
				// choice sends `department: null`, and the server stores its own
				// 'PLACEHOLDER' default.
				setSelectedDept('');
				setCustomDept('');
				setMaxHours(30);
				setCanTeachOutside(true);
				setLocalNotes('');
				// Focus the first name field so a non-technical user can start typing.
				requestAnimationFrame(() => firstNameRef.current?.focus());
			}
		}
	}, [open, facultyToEdit, departments]);

	// Phase 3.5: validate before saving, render inline errors (not only toasts).
	// Docx1 T7 (operator 30 Sep 2026): names are OPTIONAL. A blank name is submitted
	// as-is and the server defaults it (`faculty.service.ts` `sanitizeName(input.firstName,
	// 'Teacher')` / `sanitizeName(input.lastName, 'X')`), so the record still becomes
	// "Teacher X" rather than being blocked here.
	const nextErrors: FieldErrors = {};
	if (selectedDept === 'CUSTOM' && !customDept.trim()) nextErrors.customDept = 'Enter the department name.';
	if (!Number.isFinite(Number(maxHours)) || Number(maxHours) < 1 || Number(maxHours) > MAX_WEEKLY_HOURS) {
		nextErrors.maxHours = `Enter a number between 1 and ${MAX_WEEKLY_HOURS} hours.`;
	}
	const canSave = Object.keys(nextErrors).length === 0;

	const handleSave = async () => {
		const finalDept = selectedDept === 'CUSTOM' ? customDept.trim() : selectedDept;
		if (!canSave) {
			setFieldErrors(nextErrors);
			return;
		}

		setSaving(true);
		try {
			if (isEdit && facultyToEdit) {
				await atlasApi.patch(`/faculty/${facultyToEdit.id}`, {
					firstName: firstName.trim(),
					lastName: lastName.trim(),
					department: finalDept || null,
					// `specialization` is intentionally OMITTED (docx1 T7): the field is
					// removed from this form, and omitting the key leaves any existing
					// stored value untouched by the server's Prisma update.
					maxHoursPerWeek: Number(maxHours),
					canTeachOutsideDepartment: canTeachOutside,
					localNotes: localNotes.trim() || null,
					version: facultyToEdit.version,
				});
				toast.success('Temporary teacher updated successfully.');
			} else {
				await atlasApi.post('/faculty/placeholders', {
					schoolId: DEFAULT_SCHOOL_ID,
					firstName: firstName.trim(),
					lastName: lastName.trim(),
					department: finalDept || null,
					// `specialization` is intentionally OMITTED (docx1 T7): the field is
					// removed from this form, and omitting the key leaves any existing
					// stored value untouched by the server's Prisma update.
					maxHoursPerWeek: Number(maxHours),
					canTeachOutsideDepartment: canTeachOutside,
					localNotes: localNotes.trim() || null,
				});
				toast.success('Temporary teacher created successfully.');
			}
			onSuccess();
			onOpenChange(false);
		} catch (err: any) {
			const errMsg = err?.response?.data?.message ?? 'Failed to save temporary teacher.';
			toast.error(errMsg);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				/*
				 * A5 item 23.2 — "Create temporary teacher", target 5 of 5. A DATA/FORM
				 * surface: a form with six fields plus a notes box, so it takes the
				 * shared dialog's default `resizable` handling. `sm:max-w-[480px]` is
				 * kept as this form's own first-paint width; the drag handles and the
				 * clamps come from `@/ui/dialog`.
				 */
				resizable
				className="sm:max-w-[480px]"
			>
				<DialogHeader>
					<DialogTitle className="text-xl font-bold">
						{isEdit ? 'Edit Temporary Teacher' : 'Add Temporary Teacher'}
					</DialogTitle>
					<DialogDescription>
						{isEdit
							? 'Modify details for this temporary teacher.'
							: 'Add a temporary record so sections can be allocated before the real teacher is hired. Replace it before publishing the timetable.'}
					</DialogDescription>
				</DialogHeader>

				<form
					onSubmit={(event) => {
						event.preventDefault();
						void handleSave();
					}}
					className="space-y-4 py-3"
				>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="firstName" className="text-sm font-semibold">First name (optional)</Label>
							<Input
								id="firstName"
								ref={firstNameRef}
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								className="h-9"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="lastName" className="text-sm font-semibold">Last name (optional)</Label>
							<Input
								id="lastName"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								className="h-9"
							/>
						</div>
					</div>

					{/* Docx1 T7: the Specialization field is removed entirely. Existing
					    stored values are left untouched — the key is omitted from both the
					    PATCH and the POST bodies. The Department trigger now occupies the
					    row alone, so it is no longer half-width beside a missing field. */}
					<div className="grid grid-cols-1 gap-4">
						<div className="space-y-2">
							<Label htmlFor="department" className="text-sm font-semibold">Department</Label>
							<Select value={selectedDept} onValueChange={setSelectedDept}>
								<SelectTrigger id="department" className="h-9">
									<SelectValue placeholder="Select Department" />
								</SelectTrigger>
								<SelectContent>
									{departments.map((d) => (
										<SelectItem key={d} value={d}>{departmentLabel(d)}</SelectItem>
									))}
									<SelectItem value="CUSTOM">Other...</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{selectedDept === 'CUSTOM' && (
						<div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
							<Label htmlFor="customDept" className="text-sm font-semibold">Department name</Label>
							<Input
								id="customDept"
								value={customDept}
								onChange={(e) => setCustomDept(e.target.value)}
								placeholder="Enter department name"
								aria-invalid={Boolean(fieldErrors.customDept) || undefined}
								aria-describedby={fieldErrors.customDept ? 'customDept-error' : undefined}
								className="h-9"
							/>
							{fieldErrors.customDept ? (
								<p id="customDept-error" role="alert" className="flex items-center gap-1 text-xs font-semibold text-destructive">
									<AlertTriangle className="size-3" /> {fieldErrors.customDept}
								</p>
							) : null}
						</div>
					)}

					<div className="grid grid-cols-2 gap-4 pt-1">
						<div className="space-y-2">
							<Label htmlFor="maxHours" className="text-sm font-semibold flex justify-between">
								<span>Maximum weekly hours</span>
								<span className="font-semibold text-primary">{maxHours}h</span>
							</Label>
							<Input
								id="maxHours"
								type="number"
								min={1}
								max={MAX_WEEKLY_HOURS}
								value={maxHours}
								onChange={(e) => setMaxHours(Number(e.target.value))}
								aria-invalid={Boolean(fieldErrors.maxHours) || undefined}
								aria-describedby={fieldErrors.maxHours ? 'maxHours-error' : 'maxHours-help'}
								className="h-9"
							/>
							{fieldErrors.maxHours ? (
								<p id="maxHours-error" role="alert" className="flex items-center gap-1 text-xs font-semibold text-destructive">
									<AlertTriangle className="size-3" /> {fieldErrors.maxHours}
								</p>
							) : (
								<p id="maxHours-help" className="text-xs text-muted-foreground">Default 30h. The DepEd maximum is {MAX_WEEKLY_HOURS}h per week.</p>
							)}
						</div>

						<div className="flex flex-col justify-end space-y-2 pb-1">
							<Label htmlFor="canTeachOutside" className="text-sm font-semibold">Can teach outside their department</Label>
							<div className="flex h-9 items-center justify-between rounded-md border px-3 bg-muted/10">
								<span className="text-xs text-muted-foreground">{canTeachOutside ? 'Allowed' : 'Not allowed'}</span>
								<Switch
									id="canTeachOutside"
									checked={canTeachOutside}
									onCheckedChange={setCanTeachOutside}
								/>
							</div>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="localNotes" className="text-sm font-semibold">Local notes (optional)</Label>
						<Textarea
							id="localNotes"
							value={localNotes}
							onChange={(e) => setLocalNotes(e.target.value)}
							placeholder="Add any staffing or hiring context..."
							rows={3}
							className="resize-none"
						/>
					</div>
				</form>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={() => onOpenChange(false)} className="h-9" disabled={saving}>
						Cancel
					</Button>
					<Button onClick={() => void handleSave()} className="h-9" disabled={saving}>
						{saving ? 'Saving...' : isEdit ? 'Update Teacher' : 'Add Temporary Teacher'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}