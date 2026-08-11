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
	firstName?: string;
	lastName?: string;
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
	const [specialization, setSpecialization] = useState('');
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

				setSpecialization(facultyToEdit.specialization || '');
				setMaxHours(facultyToEdit.maxHoursPerWeek);
				setCanTeachOutside(facultyToEdit.canTeachOutsideDepartment ?? true);
				setLocalNotes(facultyToEdit.localNotes || '');
			} else {
				// Phase 3.5 / Decision shorthand: default name fields are EMPTY so a
				// placeholder is never accidentally saved as the brand string
				// "Teacher X". The hint suggests a meaningful temporary name.
				setFirstName('');
				setLastName('');
				setSelectedDept(departments[0] || 'PLACEHOLDER');
				setCustomDept('');
				setSpecialization('');
				setMaxHours(30);
				setCanTeachOutside(true);
				setLocalNotes('');
				// Focus the first name field so a non-technical user can start typing.
				requestAnimationFrame(() => firstNameRef.current?.focus());
			}
		}
	}, [open, facultyToEdit, departments]);

	// Phase 3.5: validate before saving, render inline errors (not only toasts).
	const nextErrors: FieldErrors = {};
	if (!firstName.trim()) nextErrors.firstName = 'First name is required.';
	if (!lastName.trim()) nextErrors.lastName = 'Last name is required.';
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
					specialization: specialization.trim() || null,
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
					specialization: specialization.trim() || null,
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
			<DialogContent className="sm:max-w-[480px]">
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
							<Label htmlFor="firstName" className="text-sm font-semibold">
								First name
								<span className="text-destructive ml-0.5" aria-label="required">*</span>
							</Label>
							<Input
								id="firstName"
								ref={firstNameRef}
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								placeholder="e.g. To Be Hired"
								aria-invalid={Boolean(fieldErrors.firstName) || undefined}
								aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined}
								className="h-9"
							/>
							{fieldErrors.firstName ? (
								<p id="firstName-error" role="alert" className="flex items-center gap-1 text-xs font-semibold text-destructive">
									<AlertTriangle className="size-3" /> {fieldErrors.firstName}
								</p>
							) : null}
						</div>
						<div className="space-y-2">
							<Label htmlFor="lastName" className="text-sm font-semibold">
								Last name
								<span className="text-destructive ml-0.5" aria-label="required">*</span>
							</Label>
							<Input
								id="lastName"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								placeholder="e.g. (Math)"
								aria-invalid={Boolean(fieldErrors.lastName) || undefined}
								aria-describedby={fieldErrors.lastName ? 'lastName-error' : undefined}
								className="h-9"
							/>
							{fieldErrors.lastName ? (
								<p id="lastName-error" role="alert" className="flex items-center gap-1 text-xs font-semibold text-destructive">
									<AlertTriangle className="size-3" /> {fieldErrors.lastName}
								</p>
							) : null}
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
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

						<div className="space-y-2">
							<Label htmlFor="specialization" className="text-sm font-semibold">Specialization (optional)</Label>
							<Input
								id="specialization"
								value={specialization}
								onChange={(e) => setSpecialization(e.target.value)}
								placeholder="e.g. Algebra"
								className="h-9"
							/>
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