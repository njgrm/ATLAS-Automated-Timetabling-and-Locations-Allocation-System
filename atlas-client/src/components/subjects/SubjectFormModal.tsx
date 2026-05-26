import { useState, useEffect } from 'react';
import type { RoomType } from '@/types';
import {
	ALL_ROOM_TYPES,
	GRADE_OPTIONS,
	PROGRAM_SCOPE_OPTIONS,
	ROOM_TYPE_LABELS,
	SUBJECT_OWNER_BADGE,
	SUBJECT_OWNER_LABELS,
	SUBJECT_OWNER_OPTIONS,
	type NewSubjectForm,
	emptyForm,
} from '@/lib/subject-constants';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { Separator } from '@/ui/separator';
import { gradeLabel } from '@/lib/grade-labels';
import { Info, AlertCircle, Clock, Settings2, ShieldCheck, Layout, X } from 'lucide-react';

export type SubjectFormValues = NewSubjectForm & {
	id?: number;
};

type Props = {
	open: boolean;
	mode: 'add' | 'edit';
	initialValues?: SubjectFormValues;
	subjectMeta?: {
		displayCode?: string;
		ownerDepartment?: string | null;
		allowedOwnerDepartments?: string[];
		rotationFamily?: string | null;
		rotationTermLabel?: string | null;
		rotationTermRank?: number | null;
		rotationTermGroupId?: string | null;
		rotationTermCount?: number | null;
		outputLabel?: string | null;
		isSystemManaged?: boolean;
	};
	saving: boolean;
	onSave: (values: SubjectFormValues) => void;
	onClose: () => void;
};

function resolveCanonicalRotationTermLabel(termLabel: string | null | undefined, termRank: number | null | undefined): string | null {
	if (typeof termRank === 'number' && Number.isInteger(termRank) && termRank > 0) {
		return `Term ${termRank}`;
	}

	const normalizedLabel = (termLabel ?? '').trim();
	if (!normalizedLabel) {
		return null;
	}

	const rankMatch = normalizedLabel.match(/(\d+)/);
	if (rankMatch) {
		const parsed = Number(rankMatch[1]);
		if (Number.isInteger(parsed) && parsed > 0) {
			return `Term ${parsed}`;
		}
	}

	return normalizedLabel;
}

export function SubjectFormModal({
	open,
	mode,
	initialValues,
	subjectMeta,
	saving,
	onSave,
	onClose,
}: Props) {
	const [form, setForm] = useState<SubjectFormValues>(initialValues ?? { ...emptyForm });
	const [timeMode, setTimeMode] = useState<'minutes' | 'hours'>('minutes');

	useEffect(() => {
		if (open) {
			setForm(initialValues ?? { ...emptyForm });
			setTimeMode('minutes');
		}
	}, [open, initialValues]);

	const toggleGradeLevel = (gradeLevel: number) => {
		setForm((previous) => ({
			...previous,
			gradeLevels: previous.gradeLevels.includes(gradeLevel)
				? previous.gradeLevels.filter((value) => value !== gradeLevel)
				: [...previous.gradeLevels, gradeLevel].sort((left, right) => left - right),
		}));
	};

	const toggleProgramScope = (programScope: string) => {
		setForm((previous) => {
			const hasScope = previous.programScopes.includes(programScope);
			const nextScopes = hasScope
				? previous.programScopes.filter((value) => value !== programScope)
				: [...previous.programScopes, programScope];
			return { ...previous, programScopes: nextScopes };
		});
	};

	const toggleAdditionalOwnerDepartment = (departmentCode: string) => {
		setForm((previous) => {
			const current = previous.allowedOwnerDepartments ?? [];
			const hasDepartment = current.includes(departmentCode);
			const next = hasDepartment
				? current.filter((value) => value !== departmentCode)
				: [...current, departmentCode].sort((left, right) => left.localeCompare(right));
			return {
				...previous,
				allowedOwnerDepartments: next,
			};
		});
	};

	const toggleInterSectionGrade = (gradeLevel: number) => {
		setForm((previous) => {
			const current = previous.interSectionGradeLevels ?? [];
			const hasGradeLevel = current.includes(gradeLevel);
			const next = hasGradeLevel
				? current.filter((value) => value !== gradeLevel)
				: [...current, gradeLevel].sort((left, right) => left - right);
			return { ...previous, interSectionGradeLevels: next };
		});
	};

	const [newFeature, setNewFeature] = useState('');
	const addFeature = () => {
		if (!newFeature.trim()) return;
		const normalizedFeature = newFeature.trim().toUpperCase();
		if (!form.requiredFeatures.includes(normalizedFeature)) {
			setForm((previous) => ({
				...previous,
				requiredFeatures: [...previous.requiredFeatures, normalizedFeature],
			}));
		}
		setNewFeature('');
	};

	const removeFeature = (feature: string) => {
		setForm((previous) => ({
			...previous,
			requiredFeatures: previous.requiredFeatures.filter((value) => value !== feature),
		}));
	};

	const isModularSubject = form.modularGroupId.trim().length > 0;
	const canSave = form.code.trim().length > 0
		&& form.name.trim().length > 0
		&& form.programScopes.length > 0
		&& !saving;
	const subjectMetaRotationLabel = resolveCanonicalRotationTermLabel(
		subjectMeta?.rotationTermLabel,
		subjectMeta?.rotationTermRank ?? null,
	);

	return (
		<Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
			<DialogContent className="max-w-2xl max-h-[95svh] overflow-hidden flex flex-col p-0">
				<DialogHeader className="p-6 pb-4 border-b">
					<div className="flex items-center gap-2">
						<div className="p-2 rounded-lg bg-primary/10 text-primary">
							<Settings2 className="size-5" />
						</div>
						<div>
							<DialogTitle className="text-xl font-bold">{mode === 'add' ? 'Add New Subject' : 'Configure Subject'}</DialogTitle>
							<DialogDescription className="text-xs">
								Define scheduling constraints and governance for this academic offering.
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto p-6 space-y-8">
					{/* Metadata Alert if syncing */}
					{mode === 'edit' && subjectMeta && (
						<div className="rounded-xl border bg-muted/30 p-4 flex items-start gap-3">
							<ShieldCheck className="size-5 text-emerald-600 shrink-0 mt-0.5" />
							<div className="space-y-2 flex-1">
								<div className="flex items-center justify-between gap-2">
									<h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Persisted Offerings Contract</h3>
									<Badge variant="outline" className="bg-background font-mono text-[0.6rem]">
										{subjectMeta.displayCode || form.code}
									</Badge>
								</div>

								{/* Output label */}
								{subjectMeta.outputLabel && (
									<p className="text-[0.7rem] text-muted-foreground">
										<span className="font-semibold text-foreground">Print label:</span> {subjectMeta.outputLabel}
									</p>
								)}

								<div className="flex flex-wrap gap-1.5">
									{subjectMeta.isSystemManaged && (
										<Badge variant="secondary" className="text-[0.6rem] bg-slate-100 text-slate-600 border-slate-200">
											System-managed
										</Badge>
									)}
									{subjectMeta.ownerDepartment && (
										<Badge variant="secondary" className={`text-[0.6rem] ${SUBJECT_OWNER_BADGE[subjectMeta.ownerDepartment] ?? ''}`}>
											{SUBJECT_OWNER_LABELS[subjectMeta.ownerDepartment] ?? subjectMeta.ownerDepartment}
										</Badge>
									)}
									{(subjectMeta.allowedOwnerDepartments ?? []).map((departmentCode) => (
										<Badge
											key={`extra-owner-${departmentCode}`}
											variant="outline"
											className={`text-[0.6rem] ${SUBJECT_OWNER_BADGE[departmentCode] ?? ''}`}
										>
											Also qualified: {SUBJECT_OWNER_LABELS[departmentCode] ?? departmentCode}
										</Badge>
									))}
									{subjectMeta.rotationFamily && (
										<Badge variant="outline" className="text-[0.6rem] border-indigo-200 text-indigo-700 bg-indigo-50/30">
											{subjectMeta.rotationFamily}
										</Badge>
									)}
									{subjectMetaRotationLabel && (
										<Badge variant="outline" className="text-[0.6rem] border-indigo-300 text-indigo-900 bg-indigo-100/60">
											{subjectMetaRotationLabel}
										</Badge>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Section 1: Core Identity */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 text-primary">
							<Info className="size-4" />
							<h3 className="text-[0.6875rem] font-bold uppercase tracking-widest">1. Identity & Scope</h3>
						</div>
						
						<div className="grid grid-cols-2 gap-6">
							<div className="space-y-1.5">
								<label className="text-[0.7rem] font-bold text-muted-foreground uppercase ml-0.5">Subject Code</label>
								<Input
									placeholder="e.g. MATH10"
									value={form.code}
									readOnly={mode === 'edit'}
									onChange={(event) => mode === 'add' && setForm((previous) => ({ ...previous, code: event.target.value.toUpperCase() }))}
									className={`font-mono uppercase ${mode === 'edit' ? 'bg-muted/50 cursor-not-allowed' : ''}`}
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-[0.7rem] font-bold text-muted-foreground uppercase ml-0.5">Descriptive Name</label>
								<Input
									placeholder="e.g. Mathematics Grade 10"
									value={form.name}
									onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
								/>
							</div>
						</div>

						<div className="space-y-3">
							<label className="text-[0.7rem] font-bold text-muted-foreground uppercase ml-0.5">Additional Qualified Departments</label>
							<p className="text-[0.65rem] text-muted-foreground">
								Use this when a subject can be baseline-owned by more than one department.
							</p>
							<div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3">
								{SUBJECT_OWNER_OPTIONS.filter((option) => option.value !== 'UNASSIGNED').map((option) => {
									const isPrimary = form.ownerDepartment === option.value;
									const isSelected = isPrimary || (form.allowedOwnerDepartments ?? []).includes(option.value);
									return (
										<Button
											key={`owner-dept-${option.value}`}
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => {
												if (!isPrimary) {
													toggleAdditionalOwnerDepartment(option.value);
												}
											}}
											disabled={isPrimary}
											className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[0.65rem] font-semibold transition ${
												isSelected
													? 'border-primary/40 bg-primary/10 text-primary'
													: 'border-border bg-background text-muted-foreground hover:bg-muted/50'
											}`}
										>
											<Checkbox
												checked={isSelected}
												onCheckedChange={() => undefined}
												disabled={isPrimary}
											/>
											<span className="truncate">
												{option.label}{isPrimary ? ' (Primary)' : ''}
											</span>
										</Button>
									);
								})}
							</div>
						</div>

						<div className="flex items-center justify-between p-3 rounded-lg border bg-accent/5">
							<div className="flex items-center gap-3">
								<Switch
									checked={form.isActive}
									onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
								/>
								<div className="flex flex-col">
									<span className="text-xs font-semibold">Enable for Active Year</span>
									<span className="text-[0.65rem] text-muted-foreground">Inactive subjects are hidden from the weekly grid.</span>
								</div>
							</div>
							{form.isActive ? (
								<Badge className="bg-emerald-100 text-emerald-700 shadow-none hover:bg-emerald-100">Live</Badge>
							) : (
								<Badge variant="secondary" className="shadow-none">Archived</Badge>
							)}
						</div>
					</div>

					<Separator className="opacity-50" />

					{/* Section 2: Capacity */}
					<div className="space-y-4">
						<div className="flex items-center gap-2 text-primary">
							<Clock className="size-4" />
							<h3 className="text-[0.6875rem] font-bold uppercase tracking-widest">2. Scheduling Capacity</h3>
						</div>

						<div className="space-y-2">
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<label className="text-[0.7rem] font-bold text-muted-foreground uppercase ml-0.5">Weekly Duration</label>
									<div className="flex bg-muted rounded-md p-0.5">
										<Button 
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => setTimeMode('minutes')}
											className={`h-6 px-2 text-[0.6rem] rounded ${timeMode === 'minutes' ? 'bg-background shadow-sm font-bold text-foreground' : 'text-muted-foreground'}`}
										>
											min
										</Button>
										<Button 
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => setTimeMode('hours')}
											className={`h-6 px-2 text-[0.6rem] rounded ${timeMode === 'hours' ? 'bg-background shadow-sm font-bold text-foreground' : 'text-muted-foreground'}`}
										>
											hr
										</Button>
									</div>
								</div>
								<div className="relative">
									<Input
										type="number"
										min={0}
										value={timeMode === 'minutes' ? form.minMinutesPerWeek : Math.round((form.minMinutesPerWeek / 60) * 10) / 10}
										onChange={(event) => {
											const value = Number(event.target.value);
											setForm((previous) => ({
												...previous,
												minMinutesPerWeek: timeMode === 'minutes' ? value : Math.round(value * 60),
											}));
										}}
										className="pr-12 font-medium"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.65rem] font-bold text-muted-foreground uppercase">
										{timeMode}
									</span>
								</div>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-6 pt-2">
							<div className="space-y-2">
								<label className="text-[0.7rem] font-bold text-muted-foreground uppercase ml-0.5">Preferred Room Type</label>
								<Select value={form.preferredRoomType} onValueChange={(v) => setForm((p) => ({ ...p, preferredRoomType: v as RoomType }))}>
									<SelectTrigger className="h-10">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ALL_ROOM_TYPES.map((roomType) => (
											<SelectItem key={roomType} value={roomType}>{ROOM_TYPE_LABELS[roomType]}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="flex items-center gap-3 p-3 rounded-lg border bg-accent/5 self-end h-10">
								<Switch
									checked={form.isSeedable}
									onCheckedChange={(v) => setForm((p) => ({ ...p, isSeedable: v }))}
								/>
								<div className="flex items-center gap-1.5">
									<span className="text-[0.7rem] font-semibold uppercase">Auto-Schedule</span>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<AlertCircle className="size-3 text-muted-foreground cursor-help" />
											</TooltipTrigger>
											<TooltipContent className="max-w-xs text-xs">
												Disable for auxiliary subjects that count toward load but don't need fixed grid placement (e.g. HG, Consult).
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							</div>
						</div>
					</div>

					<Separator className="opacity-50" />

					{/* Section 3: Governance */}
					<div className="space-y-6">
						<div className="flex items-center gap-2 text-primary">
							<Layout className="size-4" />
							<h3 className="text-[0.6875rem] font-bold uppercase tracking-widest">3. Governance & Ownership</h3>
						</div>

						<div className="grid grid-cols-2 gap-6">
							<div className="space-y-2">
								<label className="text-[0.7rem] font-bold text-muted-foreground uppercase ml-0.5">Owner Department</label>
								<Select
									value={form.ownerDepartment || 'UNASSIGNED'}
									onValueChange={(value) => setForm((previous) => ({
										...previous,
										ownerDepartment: value === 'UNASSIGNED' ? '' : value,
									}))}
								>
									<SelectTrigger className="h-10">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{SUBJECT_OWNER_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<label className="text-[0.7rem] font-bold text-muted-foreground uppercase ml-0.5">Qualification Baseline</label>
								<div className="h-10 rounded-md border bg-muted/30 px-3 flex items-center">
									<span className="text-xs font-semibold text-foreground">Department ownership</span>
								</div>
							</div>
						</div>

						<div className="space-y-3">
							<label className="text-[0.7rem] font-bold text-muted-foreground uppercase ml-0.5">Target Grade Levels</label>
							<div className="grid grid-cols-4 gap-2">
								{GRADE_OPTIONS.map((g) => (
									<Button
										key={g}
										type="button"
										variant={form.gradeLevels.includes(g) ? 'default' : 'outline'}
										size="sm"
										onClick={() => toggleGradeLevel(g)}
										className="h-9 px-3 text-xs font-bold"
									>
										Grade {g}
									</Button>
								))}
							</div>
						</div>

						<div className="space-y-3">
							<label className="text-[0.7rem] font-bold text-muted-foreground uppercase ml-0.5">Applicable Programs</label>
							<div className="flex flex-wrap gap-2">
								{PROGRAM_SCOPE_OPTIONS.map(({ value, label }) => (
									<Button
										key={value}
										type="button"
										variant="outline"
										size="sm"
										onClick={() => toggleProgramScope(value)}
										className={`h-8 px-4 rounded-full text-[0.65rem] font-bold transition-all ${
											form.programScopes.includes(value)
												? 'bg-sky-100 text-sky-800 border-sky-300 ring-1 ring-sky-300/20 hover:bg-sky-100'
												: 'bg-background text-muted-foreground'
										}`}
									>
										{label}
									</Button>
								))}
							</div>
						</div>
					</div>

					<Separator className="opacity-50" />

					{/* Section 4: Advanced */}
					<div className="space-y-6">
						<div className="flex items-center gap-2 text-primary">
							<Settings2 className="size-4" />
							<h3 className="text-[0.6875rem] font-bold uppercase tracking-widest">4. Advanced Logic</h3>
						</div>

						{/* Inter-section Pooling */}
						<div className="p-4 rounded-xl border bg-muted/20 space-y-4">
							<div className="flex items-center justify-between">
								<div className="flex flex-col">
									<span className="text-xs font-bold uppercase">Inter-Section Pooling</span>
									<span className="text-[0.65rem] text-muted-foreground">Allows teaching one session to multiple sections simultaneously.</span>
								</div>
								<Switch
									checked={form.interSectionEnabled ?? false}
									onCheckedChange={(v) => setForm((p) => ({ ...p, interSectionEnabled: v, interSectionGradeLevels: v ? p.interSectionGradeLevels : [] }))}
								/>
							</div>
							
							{form.interSectionEnabled && (
								<div className="grid grid-cols-4 gap-2 pt-2 animate-in zoom-in-95 duration-200">
									{form.gradeLevels.map((g) => (
										<Button
											key={g}
											type="button"
											variant="outline"
											size="sm"
											onClick={() => toggleInterSectionGrade(g)}
											className={`h-8 px-2 text-[0.65rem] font-bold ${ (form.interSectionGradeLevels ?? []).includes(g) ? 'bg-violet-100 text-violet-800 border-violet-300 hover:bg-violet-100' : ''}`}
										>
											G{g} Pool
										</Button>
									))}
								</div>
							)}
						</div>

						{/* Modular Scheduling */}
						<div className="p-4 rounded-xl border bg-muted/20 space-y-4">
							<div className="flex items-center justify-between">
								<div className="flex flex-col">
									<span className="text-xs font-bold uppercase">Modular Term Ordering</span>
									<span className="text-[0.65rem] text-muted-foreground">Used for subjects that rotate throughout the school year.</span>
								</div>
								<Switch
									checked={isModularSubject}
									onCheckedChange={(v) => setForm((p) => ({
										...p,
										modularGroupId: v ? (p.modularGroupId.trim() || 'SCIENCE') : '',
										modularOrder: v ? (p.modularOrder ?? 1) : null,
									}))}
								/>
							</div>
							
							{isModularSubject && (
								<div className="grid grid-cols-2 gap-4 pt-2 animate-in zoom-in-95 duration-200">
									<div className="space-y-1.5">
										<label className="text-[0.65rem] font-bold text-muted-foreground uppercase">Group ID</label>
										<Input
											placeholder="e.g. SCIENCE"
											value={form.modularGroupId}
											onChange={(e) => setForm((p) => ({ ...p, modularGroupId: e.target.value.toUpperCase() }))}
											className="h-8 text-xs uppercase font-mono"
										/>
									</div>
									<div className="space-y-1.5">
										<label className="text-[0.65rem] font-bold text-muted-foreground uppercase">Term Rank</label>
										<Input
											type="number"
											min={1}
											value={form.modularOrder ?? 1}
											onChange={(e) => setForm((p) => ({ ...p, modularOrder: Math.max(1, Number(e.target.value) || 1) }))}
											className="h-8 text-xs"
										/>
										<p className="text-[0.62rem] text-muted-foreground">
											Term Rank controls the sequence within this modular family (1 = first term).
										</p>
									</div>
								</div>
							)}
						</div>

						{/* Room Requirements */}
						<div className="space-y-3">
							<label className="text-[0.7rem] font-bold text-muted-foreground uppercase ml-0.5">Required Room Features</label>
							<div className="flex gap-2">
								<Input
									placeholder="e.g. ICT-Lab, Heavy Equipment"
									value={newFeature}
									onChange={(e) => setNewFeature(e.target.value)}
									onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
									className="h-9 text-xs"
								/>
								<Button type="button" size="sm" onClick={addFeature} className="h-9 font-bold">Add</Button>
							</div>
							<div className="flex flex-wrap gap-1.5">
								{form.requiredFeatures.map((f) => (
									<Badge key={f} variant="secondary" className="pl-2 pr-1 py-0.5 text-[0.65rem] font-bold flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200">
										{f}
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => removeFeature(f)}
											className="size-4 p-0 hover:text-red-600 transition-colors text-current"
										>
											<X className="size-3" />
										</Button>
									</Badge>
								))}
								{form.requiredFeatures.length === 0 && (
									<span className="text-[0.65rem] text-muted-foreground italic pl-1">No specific hardware requirements defined.</span>
								)}
							</div>
						</div>
					</div>
				</div>

				<DialogFooter className="p-6 border-t bg-muted/20">
					<Button variant="outline" onClick={onClose} disabled={saving} className="h-10 font-bold px-6">Cancel</Button>
					<Button 
						onClick={() => onSave(form)} 
						disabled={!canSave} 
						className="h-10 font-bold px-8 shadow-sm"
					>
						{saving ? (mode === 'add' ? 'Creating...' : 'Saving...') : (mode === 'add' ? 'Create Subject' : 'Update Subject')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
