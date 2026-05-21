import { useState, useEffect } from 'react';
import type { RoomType, SessionPattern } from '@/types';
import {
	ALL_ROOM_TYPES,
	GRADE_OPTIONS,
	PROGRAM_SCOPE_BADGE,
	PROGRAM_SCOPE_OPTIONS,
	QUALIFICATION_PRIORITY_LABELS,
	ROOM_TYPE_LABELS,
	SESSION_PATTERN_LABELS,
	SUBJECT_OWNER_BADGE,
	SUBJECT_OWNER_LABELS,
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
import { gradeLabel } from '@/lib/grade-labels';

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
		qualificationPriority?: 'DEPARTMENT_FIRST' | 'SPECIALIZATION_PRIMARY';
		rotationFamily?: string | null;
		specializationSource?: 'SUBJECT_CONTRACT' | 'NONE';
	};
	saving: boolean;
	availableSpecializations: string[];
	onSave: (values: SubjectFormValues) => void;
	onClose: () => void;
};

export function SubjectFormModal({
	open,
	mode,
	initialValues,
	subjectMeta,
	saving,
	availableSpecializations,
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

	const toggleSpecialization = (specialization: string) => {
		setForm((previous) => {
			const hasSpecialization = previous.allowedSpecializations.includes(specialization);
			return {
				...previous,
				allowedSpecializations: hasSpecialization
					? previous.allowedSpecializations.filter((value) => value !== specialization)
					: [...previous.allowedSpecializations, specialization],
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

	return (
		<Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
			<DialogContent className="max-w-2xl max-h-[90svh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{mode === 'add' ? 'Add Subject' : 'Edit Subject'}</DialogTitle>
					<DialogDescription>
						Configure ownership, scope, and scheduling constraints for this subject.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5">
					{mode === 'edit' && subjectMeta && (
						<section className="rounded-lg border border-border p-4 space-y-3">
							<div>
								<h3 className="text-sm font-semibold">Ownership Snapshot</h3>
								<p className="text-xs text-muted-foreground">Teaching load and autofill use this metadata as the qualification baseline.</p>
							</div>
							<div className="flex flex-wrap gap-2">
								{subjectMeta.ownerDepartment ? (
									<Badge variant="outline" className={SUBJECT_OWNER_BADGE[subjectMeta.ownerDepartment] ?? 'bg-muted border-border text-foreground'}>
										Owner: {SUBJECT_OWNER_LABELS[subjectMeta.ownerDepartment] ?? subjectMeta.ownerDepartment}
									</Badge>
								) : (
									<Badge variant="outline">Owner: Unspecified</Badge>
								)}
								{subjectMeta.qualificationPriority && (
									<Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
										{QUALIFICATION_PRIORITY_LABELS[subjectMeta.qualificationPriority]}
									</Badge>
								)}
								{subjectMeta.rotationFamily && (
									<Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
										Rotation: {subjectMeta.rotationFamily}
									</Badge>
								)}
								{subjectMeta.displayCode && (
									<Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
										Output Label: {subjectMeta.displayCode}
									</Badge>
								)}
								{subjectMeta.specializationSource === 'SUBJECT_CONTRACT' && (
									<Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
										Specializations sourced from subject contract
									</Badge>
								)}
							</div>
						</section>
					)}

					<section className="rounded-lg border border-border p-4 space-y-4">
						<div>
							<h3 className="text-sm font-semibold">Basic Identity</h3>
							<p className="text-xs text-muted-foreground">Core identity and scope settings for this subject.</p>
						</div>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<label className="text-xs font-medium text-muted-foreground">Code</label>
								<Input
									placeholder="e.g. ELEC1"
									value={form.code}
									readOnly={mode === 'edit'}
									onChange={(event) => mode === 'add' && setForm((previous) => ({ ...previous, code: event.target.value.toUpperCase() }))}
									className={mode === 'edit' ? 'bg-muted/40 cursor-default' : ''}
								/>
							</div>
							<div>
								<label className="text-xs font-medium text-muted-foreground">Name</label>
								<Input
									placeholder="Subject name"
									value={form.name}
									onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
								/>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<Switch
								checked={form.isActive}
								onCheckedChange={(value) => setForm((previous) => ({ ...previous, isActive: value }))}
								aria-label="Set subject active status"
							/>
							<span className="text-xs text-muted-foreground">{form.isActive ? 'Active subject' : 'Inactive subject'}</span>
						</div>

						<div>
							<label className="text-xs font-medium text-muted-foreground">Grade Levels</label>
							<div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
								{GRADE_OPTIONS.map((gradeLevel) => (
									<label key={gradeLevel} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
										<Checkbox
											checked={form.gradeLevels.includes(gradeLevel)}
											onCheckedChange={() => toggleGradeLevel(gradeLevel)}
											aria-label={`Include ${gradeLabel(gradeLevel)}`}
										/>
										<span>{gradeLabel(gradeLevel)}</span>
									</label>
								))}
							</div>
						</div>

						<div>
							<label className="text-xs font-medium text-muted-foreground">Program Scopes</label>
							<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
								{PROGRAM_SCOPE_OPTIONS.map(({ value, label }) => (
									<label key={value} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${PROGRAM_SCOPE_BADGE[value] ?? 'bg-sky-50 text-sky-700 border-sky-200'}`}>
										<Checkbox
											checked={form.programScopes.includes(value)}
											onCheckedChange={() => toggleProgramScope(value)}
											aria-label={`Toggle ${label} program scope`}
										/>
										<span>{label}</span>
									</label>
								))}
							</div>
							{form.programScopes.length === 0 && (
								<p className="mt-1 text-[0.65rem] text-red-600">Select at least one program scope.</p>
							)}
						</div>

						{availableSpecializations.length > 0 && (
							<div>
								<label className="text-xs font-medium text-muted-foreground">
									Specialization Restriction{' '}
									<span className="font-normal text-muted-foreground/70">(leave blank = open to all)</span>
								</label>
								<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
									{availableSpecializations.map((specialization) => (
										<label key={specialization} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
											<Checkbox
												checked={form.allowedSpecializations.includes(specialization)}
												onCheckedChange={() => toggleSpecialization(specialization)}
												aria-label={`Toggle specialization ${specialization}`}
											/>
											<span>{specialization}</span>
										</label>
									))}
								</div>
								<p className="mt-1 text-[0.65rem] text-muted-foreground">Source: subject contract and offering sync state.</p>
							</div>
						)}
					</section>

					<section className="rounded-lg border border-border p-4 space-y-4">
						<div>
							<h3 className="text-sm font-semibold">Grid &amp; Time Constraints</h3>
							<p className="text-xs text-muted-foreground">Control placement and weekly minutes on the daily grid.</p>
						</div>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<div className="flex items-center justify-between gap-2 mb-1">
									<label className="text-xs font-medium text-muted-foreground">Duration ({timeMode === 'minutes' ? 'min' : 'hr'}/wk)</label>
									<Select value={timeMode} onValueChange={(value) => setTimeMode(value as 'minutes' | 'hours')}>
										<SelectTrigger className="h-8 w-28 text-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="minutes">Minutes</SelectItem>
											<SelectItem value="hours">Hours</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<Input
									type="number"
									min={0}
									step={timeMode === 'minutes' ? 15 : 0.5}
									value={timeMode === 'minutes' ? form.minMinutesPerWeek : Math.round((form.minMinutesPerWeek / 60) * 10) / 10}
									onChange={(event) => {
										const value = Number(event.target.value);
										setForm((previous) => ({
											...previous,
											minMinutesPerWeek: timeMode === 'minutes' ? value : Math.round(value * 60),
										}));
									}}
								/>
								<div className="flex gap-1 mt-1">
									{[45, 60, 200, 240].map((value) => (
										<Button
											key={value}
											type="button"
											variant="outline"
											size="sm"
											onClick={() => setForm((previous) => ({ ...previous, minMinutesPerWeek: value }))}
											className="h-6 px-2 text-[0.625rem]"
										>
											{value}m
										</Button>
									))}
								</div>
							</div>

							<div>
								<label className="text-xs font-medium text-muted-foreground mb-1 block">Session Pattern</label>
								<Select value={form.sessionPattern} onValueChange={(value) => setForm((previous) => ({ ...previous, sessionPattern: value as SessionPattern }))}>
									<SelectTrigger className="flex h-9 w-full bg-background text-sm shadow-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{(Object.keys(SESSION_PATTERN_LABELS) as SessionPattern[]).map((pattern) => (
											<SelectItem key={pattern} value={pattern}>{SESSION_PATTERN_LABELS[pattern]}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div>
								<label className="text-xs font-medium text-muted-foreground mb-1 block">Preferred Room Type</label>
								<Select value={form.preferredRoomType} onValueChange={(value) => setForm((previous) => ({ ...previous, preferredRoomType: value as RoomType }))}>
									<SelectTrigger className="flex h-9 w-full bg-background text-sm shadow-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ALL_ROOM_TYPES.map((roomType) => (
											<SelectItem key={roomType} value={roomType}>{ROOM_TYPE_LABELS[roomType]}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<Switch
								checked={form.isSeedable}
								onCheckedChange={(value) => setForm((previous) => ({ ...previous, isSeedable: value }))}
								aria-label="Auto-schedule to grid"
							/>
							<div className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground">Auto-Schedule to Grid</span>
								<TooltipProvider delayDuration={200}>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="cursor-help rounded-full border border-border px-1 text-[10px] text-muted-foreground">?</span>
										</TooltipTrigger>
										<TooltipContent side="top" className="max-w-72 text-xs">
											Turn off for subjects like Homeroom Guidance that count toward teacher load but do not require physical grid placement.
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</div>
						</div>

						<div>
							<label className="text-xs font-medium text-muted-foreground">
								Required Room Features{' '}
								<span className="font-normal text-muted-foreground/70">(e.g. Greenhouse, Welding, ICT-Lab)</span>
							</label>
							<div className="mt-1 flex flex-col gap-2">
								<div className="flex gap-2">
									<Input
										placeholder="Add a feature requirement..."
										value={newFeature}
										onChange={(event) => setNewFeature(event.target.value)}
										onKeyDown={(event) => {
											if (event.key === 'Enter') {
												event.preventDefault();
												addFeature();
											}
										}}
										className="h-8 text-xs"
									/>
									<Button type="button" size="sm" onClick={addFeature} className="h-8 px-3">Add</Button>
								</div>
								<div className="flex flex-wrap gap-1.5">
									{form.requiredFeatures.map((feature) => (
										<Badge key={feature} variant="secondary" className="px-2 py-0.5 text-[0.65rem] flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200">
											{feature}
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => removeFeature(feature)}
												className="h-4 w-4 p-0 text-inherit hover:text-red-600"
											>
												×
											</Button>
										</Badge>
									))}
									{form.requiredFeatures.length === 0 && (
										<span className="text-[0.65rem] text-muted-foreground italic">No specific room requirements.</span>
									)}
								</div>
							</div>
						</div>
					</section>

					<section className="rounded-lg border border-border p-4 space-y-4">
						<div>
							<h3 className="text-sm font-semibold">Advanced Grouping</h3>
							<p className="text-xs text-muted-foreground">Configure section pooling and modular term ordering.</p>
						</div>

						<div>
							<label className="text-xs font-medium text-muted-foreground mb-1 block">Enable Inter-Section Pooling</label>
							<div className="flex items-center gap-2 mt-1">
								<Switch
									checked={form.interSectionEnabled ?? false}
									onCheckedChange={(value) => setForm((previous) => ({ ...previous, interSectionEnabled: value, interSectionGradeLevels: value ? previous.interSectionGradeLevels : [] }))}
									aria-label="Enable inter-section pooling"
								/>
								<span className="text-xs text-muted-foreground">{form.interSectionEnabled ? 'Enabled' : 'Disabled'}</span>
							</div>
							{form.interSectionEnabled && (
								<div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
									{form.gradeLevels.map((gradeLevel) => (
										<label key={gradeLevel} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
											<Checkbox
												checked={(form.interSectionGradeLevels ?? []).includes(gradeLevel)}
												onCheckedChange={() => toggleInterSectionGrade(gradeLevel)}
												aria-label={`Toggle ${gradeLabel(gradeLevel)} inter-section pooling`}
											/>
											<span>{gradeLabel(gradeLevel)}</span>
										</label>
									))}
								</div>
							)}
						</div>

						<div className="space-y-3 rounded-md border border-dashed border-border p-3">
							<div className="flex items-center gap-2">
								<Switch
									checked={isModularSubject}
									onCheckedChange={(value) => setForm((previous) => ({
										...previous,
										modularGroupId: value ? (previous.modularGroupId.trim() || 'SCIENCE') : '',
										modularOrder: value ? (previous.modularOrder ?? 1) : null,
									}))}
									aria-label="Toggle modular subject"
								/>
								<span className="text-xs text-muted-foreground">Modular Subject</span>
							</div>
							{isModularSubject && (
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<div>
										<label className="text-xs font-medium text-muted-foreground">Modular Group ID</label>
										<Input
											placeholder="e.g. SCIENCE"
											value={form.modularGroupId}
											onChange={(event) => setForm((previous) => ({ ...previous, modularGroupId: event.target.value.toUpperCase() }))}
										/>
									</div>
									<div>
										<label className="text-xs font-medium text-muted-foreground">Term Order</label>
										<Input
											type="number"
											min={1}
											value={form.modularOrder ?? 1}
											onChange={(event) => setForm((previous) => ({ ...previous, modularOrder: Math.max(1, Number(event.target.value) || 1) }))}
										/>
									</div>
								</div>
							)}
						</div>
					</section>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
					<Button onClick={() => onSave(form)} disabled={!canSave}>
						{saving ? (mode === 'add' ? 'Creating...' : 'Saving...') : (mode === 'add' ? 'Create Subject' : 'Save Changes')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
