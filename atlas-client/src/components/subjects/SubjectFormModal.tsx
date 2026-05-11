import { useState, useEffect } from 'react';
import type { RoomType, SessionPattern } from '@/types';
import {
	ALL_ROOM_TYPES,
	GRADE_OPTIONS,
	PROGRAM_SCOPE_BADGE,
	PROGRAM_SCOPE_OPTIONS,
	ROOM_TYPE_LABELS,
	SESSION_PATTERN_LABELS,
	type NewSubjectForm,
	emptyForm,
} from '@/lib/subject-constants';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';
import { gradeLabel } from '@/lib/grade-labels';

export type SubjectFormValues = NewSubjectForm & {
	id?: number;
};

type Props = {
	open: boolean;
	mode: 'add' | 'edit';
	initialValues?: SubjectFormValues;
	saving: boolean;
	availableSpecializations: string[];
	onSave: (values: SubjectFormValues) => void;
	onClose: () => void;
};

export function SubjectFormModal({
	open,
	mode,
	initialValues,
	saving,
	availableSpecializations,
	onSave,
	onClose,
}: Props) {
	const [form, setForm] = useState<SubjectFormValues>(initialValues ?? { ...emptyForm });
	const [timeMode, setTimeMode] = useState<'minutes' | 'hours'>('minutes');

	// Sync initialValues when modal opens
	useEffect(() => {
		if (open) {
			setForm(initialValues ?? { ...emptyForm });
			setTimeMode('minutes');
		}
	}, [open, initialValues]);

	const toggleGradeLevel = (g: number) => {
		setForm((p) => ({
			...p,
			gradeLevels: p.gradeLevels.includes(g)
				? p.gradeLevels.filter((x) => x !== g)
				: [...p.gradeLevels, g].sort((a, b) => a - b),
		}));
	};

	const toggleProgramScope = (value: string) => {
		setForm((p) => {
			const has = p.programScopes.includes(value);
			const next = has ? p.programScopes.filter((x) => x !== value) : [...p.programScopes, value];
			return { ...p, programScopes: next.length > 0 ? next : [value] };
		});
	};

	const toggleSpecialization = (spec: string) => {
		setForm((p) => {
			const has = p.allowedSpecializations.includes(spec);
			return {
				...p,
				allowedSpecializations: has
					? p.allowedSpecializations.filter((x) => x !== spec)
					: [...p.allowedSpecializations, spec],
			};
		});
	};

	const canSave = form.code.trim().length > 0 && form.name.trim().length > 0 && !saving;

	return (
		<Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
			<DialogContent className="max-w-2xl max-h-[90svh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{mode === 'add' ? 'Add Subject' : 'Edit Subject'}</DialogTitle>
				</DialogHeader>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{/* Code — read-only in edit mode */}
					<div>
						<label className="text-xs font-medium text-muted-foreground">Code</label>
						<Input
							placeholder="e.g. ELEC1"
							value={form.code}
							readOnly={mode === 'edit'}
							onChange={(e) =>
								mode === 'add' &&
								setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))
							}
							className={mode === 'edit' ? 'bg-muted/40 cursor-default' : ''}
						/>
					</div>

					{/* Name */}
					<div>
						<label className="text-xs font-medium text-muted-foreground">Name</label>
						<Input
							placeholder="Subject name"
							value={form.name}
							onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
						/>
					</div>

					{/* Duration */}
					<div>
						<div className="flex justify-between items-center mb-1">
							<label className="text-xs font-medium text-muted-foreground">
								Duration ({timeMode === 'minutes' ? 'min' : 'hr'}/wk)
							</label>
							<div className="flex gap-1 text-[0.625rem]">
								<button
									type="button"
									onClick={() => setTimeMode('minutes')}
									className={`px-1 rounded ${timeMode === 'minutes' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-muted'}`}
								>
									Min
								</button>
								<button
									type="button"
									onClick={() => setTimeMode('hours')}
									className={`px-1 rounded ${timeMode === 'hours' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-muted'}`}
								>
									Hr
								</button>
							</div>
						</div>
						<Input
							type="number"
							min={0}
							step={timeMode === 'minutes' ? 45 : 0.5}
							value={
								timeMode === 'minutes'
									? form.minMinutesPerWeek
									: Math.round((form.minMinutesPerWeek / 60) * 10) / 10
							}
							onChange={(e) => {
								const val = Number(e.target.value);
								setForm((p) => ({
									...p,
									minMinutesPerWeek: timeMode === 'minutes' ? val : Math.round(val * 60),
								}));
							}}
						/>
						<div className="flex gap-1 mt-1">
							{[200, 225, 240, 250].map((val) => (
								<button
									type="button"
									key={val}
									onClick={() => setForm((p) => ({ ...p, minMinutesPerWeek: val }))}
									className="rounded border bg-accent/5 px-1.5 py-0.5 text-[0.5625rem] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
								>
									{val}m
								</button>
							))}
						</div>
					</div>

					{/* Preferred Room Type */}
					<div>
						<label className="text-xs font-medium text-muted-foreground mb-1 block">Preferred Room Type</label>
						<Select
							value={form.preferredRoomType}
							onValueChange={(v) => setForm((p) => ({ ...p, preferredRoomType: v as RoomType }))}
						>
							<SelectTrigger className="flex h-9 w-full bg-background text-sm shadow-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ALL_ROOM_TYPES.map((t) => (
									<SelectItem key={t} value={t}>
										{ROOM_TYPE_LABELS[t]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Session Pattern */}
					<div>
						<label className="text-xs font-medium text-muted-foreground mb-1 block">Session Pattern</label>
						<Select
							value={form.sessionPattern}
							onValueChange={(v) => setForm((p) => ({ ...p, sessionPattern: v as SessionPattern }))}
						>
							<SelectTrigger className="flex h-9 w-full bg-background text-sm shadow-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{(Object.keys(SESSION_PATTERN_LABELS) as SessionPattern[]).map((p) => (
									<SelectItem key={p} value={p}>
										{SESSION_PATTERN_LABELS[p]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-[0.6rem] text-muted-foreground mt-1">
							MWF = Mon/Wed/Fri only · TTH = Tue/Thu only · Any = all days
						</p>
					</div>

					{/* Inter-Section */}
					<div>
						<label className="text-xs font-medium text-muted-foreground mb-1 block">Inter-Section Scheduling</label>
						<div className="flex items-center gap-2 mt-1">
							<Switch
								checked={form.interSectionEnabled ?? false}
								onCheckedChange={(v) =>
									setForm((p) => ({
										...p,
										interSectionEnabled: v,
										interSectionGradeLevels: v ? p.interSectionGradeLevels : [],
									}))
								}
								aria-label="Enable inter-section scheduling"
							/>
							<span className="text-xs text-muted-foreground">
								{form.interSectionEnabled ? 'Enabled' : 'Disabled'}
							</span>
						</div>
						{form.interSectionEnabled && (
							<div className="flex gap-1 mt-2">
								{form.gradeLevels.map((g) => (
									<button
										key={g}
										type="button"
										onClick={() =>
											setForm((p) => {
												const has = (p.interSectionGradeLevels ?? []).includes(g);
												return {
													...p,
													interSectionGradeLevels: has
														? (p.interSectionGradeLevels ?? []).filter((x) => x !== g)
														: [...(p.interSectionGradeLevels ?? []), g].sort((a, b) => a - b),
												};
											})
										}
										className={`rounded border px-1.5 py-0.5 text-[0.6rem] font-medium transition-colors ${
											(form.interSectionGradeLevels ?? []).includes(g)
												? 'border-primary bg-primary text-primary-foreground'
												: 'border-border text-muted-foreground hover:bg-accent/10'
										}`}
									>
										{gradeLabel(g)}
									</button>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Grade Levels */}
				<div>
					<label className="text-xs font-medium text-muted-foreground">Grade Levels</label>
					<div className="mt-1 flex gap-2">
						{GRADE_OPTIONS.map((g) => (
							<button
								key={g}
								type="button"
								onClick={() => toggleGradeLevel(g)}
								className={`inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
									form.gradeLevels.includes(g)
										? 'border-primary bg-primary text-primary-foreground'
										: 'border-border bg-background text-muted-foreground hover:bg-accent/10'
								}`}
							>
								G{g}
							</button>
						))}
					</div>
				</div>

				{/* Program Scopes */}
				<div>
					<label className="text-xs font-medium text-muted-foreground">Program Scopes</label>
					<div className="mt-1 flex flex-wrap gap-1.5">
						{PROGRAM_SCOPE_OPTIONS.map(({ value, label }) => (
							<button
								key={value}
								type="button"
								onClick={() => toggleProgramScope(value)}
								className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
									form.programScopes.includes(value)
										? `border-current ${PROGRAM_SCOPE_BADGE[value] ?? 'bg-sky-50 text-sky-700 border-sky-200'}`
										: 'border-border text-muted-foreground hover:bg-accent/10'
								}`}
							>
								{label}
							</button>
						))}
					</div>
				</div>

				{/* Specialization Restriction */}
				{availableSpecializations.length > 0 && (
					<div>
						<label className="text-xs font-medium text-muted-foreground">
							Specialization Restriction{' '}
							<span className="font-normal text-muted-foreground/70">(leave blank = open to all)</span>
						</label>
						<div className="mt-1 flex flex-wrap gap-1.5">
							{availableSpecializations.map((spec) => (
								<button
									key={spec}
									type="button"
									onClick={() => toggleSpecialization(spec)}
									className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
										form.allowedSpecializations.includes(spec)
											? 'border-violet-400 bg-violet-50 text-violet-700'
											: 'border-border text-muted-foreground hover:bg-accent/10'
									}`}
								>
									{spec}
								</button>
							))}
						</div>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={saving}>
						Cancel
					</Button>
					<Button onClick={() => onSave(form)} disabled={!canSave}>
						{saving ? (mode === 'add' ? 'Creating...' : 'Saving...') : (mode === 'add' ? 'Create Subject' : 'Save Changes')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
