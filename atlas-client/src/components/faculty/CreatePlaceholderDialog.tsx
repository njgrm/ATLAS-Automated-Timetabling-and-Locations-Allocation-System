import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Switch } from '@/ui/switch';
import { Textarea } from '@/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { toast } from 'sonner';
import atlasApi from '@/lib/api';
import type { FacultySummary } from '@/types';

interface CreatePlaceholderDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	facultyToEdit: FacultySummary | null;
	departments: string[];
}

const DEFAULT_SCHOOL_ID = 1;

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

	useEffect(() => {
		if (open) {
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
				setFirstName('Teacher');
				setLastName('X');
				setSelectedDept(departments[0] || 'PLACEHOLDER');
				setCustomDept('');
				setSpecialization('');
				setMaxHours(30);
				setCanTeachOutside(true);
				setLocalNotes('');
			}
		}
	}, [open, facultyToEdit, departments]);

	const handleSave = async () => {
		const finalDept = selectedDept === 'CUSTOM' ? customDept.trim() : selectedDept;
		if (!firstName.trim()) {
			toast.error('First name is required.');
			return;
		}
		if (!lastName.trim()) {
			toast.error('Last name is required.');
			return;
		}
		if (selectedDept === 'CUSTOM' && !customDept.trim()) {
			toast.error('Please enter a custom department name.');
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
				toast.success('Placeholder teacher updated successfully.');
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
				toast.success('Placeholder teacher created successfully.');
			}
			onSuccess();
			onOpenChange(false);
		} catch (err: any) {
			const errMsg = err?.response?.data?.message ?? 'Failed to save placeholder teacher.';
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
						{isEdit ? 'Edit Placeholder Teacher' : 'Create Placeholder Teacher'}
					</DialogTitle>
					<DialogDescription>
						{isEdit 
							? 'Modify details for this temporary/placeholder teacher.' 
							: 'Add a temporary Teacher X placeholder to allocate sections before real hires are finalized.'}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-3">
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">First Name</Label>
							<Input 
								id="firstName" 
								value={firstName} 
								onChange={(e) => setFirstName(e.target.value)} 
								placeholder="e.g. Teacher"
								className="h-9"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last Name</Label>
							<Input 
								id="lastName" 
								value={lastName} 
								onChange={(e) => setLastName(e.target.value)} 
								placeholder="e.g. X"
								className="h-9"
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="department" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Department</Label>
							<Select value={selectedDept} onValueChange={setSelectedDept}>
								<SelectTrigger className="h-9">
									<SelectValue placeholder="Select Department" />
								</SelectTrigger>
								<SelectContent>
									{departments.map((d) => (
										<SelectItem key={d} value={d}>{d}</SelectItem>
									))}
									<SelectItem value="CUSTOM">Other (Type custom...)</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="specialization" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Specialization (Optional)</Label>
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
							<Label htmlFor="customDept" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom Department Name</Label>
							<Input 
								id="customDept" 
								value={customDept} 
								onChange={(e) => setCustomDept(e.target.value)} 
								placeholder="Enter department name"
								className="h-9"
							/>
						</div>
					)}

					<div className="grid grid-cols-2 gap-4 pt-1">
						<div className="space-y-2">
							<Label htmlFor="maxHours" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
								<span>Max Hours/Week</span>
								<span className="font-semibold text-primary">{maxHours}h</span>
							</Label>
							<Input 
								id="maxHours" 
								type="number"
								min={1}
								max={60}
								value={maxHours} 
								onChange={(e) => setMaxHours(Math.max(1, Math.min(60, Number(e.target.value))))} 
								className="h-9"
							/>
						</div>

						<div className="flex flex-col justify-end space-y-2 pb-1">
							<Label htmlFor="canTeachOutside" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teach Outside Dept</Label>
							<div className="flex h-9 items-center justify-between rounded-md border px-3 bg-muted/10">
								<span className="text-xs text-muted-foreground">Allowed</span>
								<Switch 
									id="canTeachOutside" 
									checked={canTeachOutside} 
									onCheckedChange={setCanTeachOutside} 
								/>
							</div>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="localNotes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Local Notes (Optional)</Label>
						<Textarea 
							id="localNotes" 
							value={localNotes} 
							onChange={(e) => setLocalNotes(e.target.value)} 
							placeholder="Add any staffing/hiring context..."
							rows={3}
							className="resize-none"
						/>
					</div>
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={() => onOpenChange(false)} className="h-9" disabled={saving}>
						Cancel
					</Button>
					<Button onClick={handleSave} className="h-9" disabled={saving}>
						{saving ? 'Saving...' : 'Save Teacher'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
