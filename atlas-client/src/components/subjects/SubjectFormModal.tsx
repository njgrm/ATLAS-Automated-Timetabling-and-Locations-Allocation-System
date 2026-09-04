import { useState, useEffect, useRef, useId } from 'react';
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
import { Info, AlertCircle, Clock, Settings2, ShieldCheck, Layout, X, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';

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
	const [timeMode, setTimeMode] = useState<'minutes' | 'hours'>('hours');
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [validationErrors, setValidationErrors] = useState<{
		code?: string;
		name?: string;
		programScopes?: string;
	}>({});
	const codeInputRef = useRef<HTMLInputElement>(null);
	const formId = useId();

	useEffect(() => {
		if (open) {
			setForm(initialValues ?? { ...emptyForm });
			setTimeMode('hours');
			setShowAdvanced(mode === 'edit');
			setValidationErrors({});
			// Phase 2.1: focus the code input on add so a non-technical user
			// can start typing immediately.
			if (mode === 'add') {
				requestAnimationFrame(() => codeInputRef.current?.focus());
			}
		}
	}, [open, initialValues, mode]);

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
	const trimmedCode = form.code.trim();
	const trimmedName = form.name.trim();
	const hasCode = trimmedCode.length > 0;
	const hasName = trimmedName.length > 0;
	const hasProgramScope = form.programScopes.length > 0;
	// Phase 2.2: build a single validation-errors object so we can render
	// inline aria-live error text and an explanatory tooltip on the disabled
	// Save button (AGENTS: "loading/empty/error/disabled states explicit").
	const nextValidationErrors: typeof validationErrors = {};
	if (!hasCode) nextValidationErrors.code = 'Subject code is required.';
	if (!hasName) nextValidationErrors.name = 'Subject name is required.';
	if (!hasProgramScope) nextValidationErrors.programScopes = 'Pick at least one program scope.';
	const canSave = Object.keys(nextValidationErrors).length === 0 && !saving;
	const saveDisabledReason = saving
		? 'Saving in progress.'
		: !hasCode
			? 'Enter a subject code.'
			: !hasName
				? 'Enter a subject name.'
				: !hasProgramScope
					? 'Pick at least one program scope.'
					: '';

	// Re-run validation on every change so the inline errors + tooltip track the
	// live form state. React's sanctioned render-phase setState re-renders
	// before commit, so the errors never flash one frame late.
	if (
		(nextValidationErrors.code ?? null) !== (validationErrors.code ?? null)
		|| (nextValidationErrors.name ?? null) !== (validationErrors.name ?? null)
		|| (nextValidationErrors.programScopes ?? null) !== (validationErrors.programScopes ?? null)
	) {
		setValidationErrors(nextValidationErrors);
	}

	const subjectMetaRotationLabel = resolveCanonicalRotationTermLabel(
		subjectMeta?.rotationTermLabel,
		subjectMeta?.rotationTermRank ?? null,
	);

	// Phase 2.1: step indicator (the modal is a single-scroll layout; the
	// indicator tells the scheduler where they are in the four sections).
	const steps = [
		{ id: 'identity', label: 'Identity' },
		{ id: 'time', label: 'Time and room' },
		{ id: 'governance', label: 'Programs and owner' },
		{ id: 'advanced', label: 'Advanced' },
	] as const;
	const currentStepId = showAdvanced
		? 'advanced'
		: 'governance';
	const currentStepIndex = steps.findIndex((step) => step.id === currentStepId);

	return (
		<Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
			<DialogContent
				className="max-w-2xl max-h-[95svh] overflow-hidden flex flex-col p-0"
			>
				<DialogHeader className="p-6 pb-4 border-b">
					<div className="flex items-center gap-2">
						<div className="p-2 rounded-lg bg-primary/10 text-primary">
							<Settings2 className="size-5" />
						</div>
						<div>
							<DialogTitle className="text-xl font-bold">{mode === 'add' ? 'Add subject' : 'Edit curriculum subject'}</DialogTitle>
							<DialogDescription className="text-sm">
								Set the weekly time, grades, program scope, owner, and room needs used for schedule generation.
							</DialogDescription>
						</div>
					</div>

					{/* Phase 2.1: step indicator (4 sections) so the scheduler knows
						where they are. Identity and Time & room are always required;
						Programs and owner is required; Advanced is optional. */}
					<ol className="mt-4 flex items-center gap-2 text-xs" data-testid="subjects-form-stepper">
						{steps.map((step, index) => {
							const isCurrent = index === currentStepIndex;
							const isDone = index < currentStepIndex;
							return (
								<li key={step.id} className="flex items-center gap-2">
									<span
										className={`flex size-6 items-center justify-center rounded-full border text-[0.7rem] font-bold ${
											isCurrent
												? 'border-primary bg-primary text-primary-foreground shadow-sm'
												: isDone
													? 'border-primary/30 bg-primary/10 text-primary'
													: 'border-border bg-muted/30 text-muted-foreground'
										}`}
										aria-current={isCurrent ? 'step' : undefined}
									>
										{isDone ? <CheckCircle2 className="size-3.5" /> : index + 1}
									</span>
									<span className={`font-semibold ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
									{index < steps.length - 1 ? <ChevronRight className="size-3 text-muted-foreground/50" aria-hidden="true" /> : null}
								</li>
							);
						})}
					</ol>
				</DialogHeader>

				<form
					id={formId}
					onSubmit={(event) => {
						event.preventDefault();
						if (canSave) onSave(form);
					}}
					className="flex-1 min-h-0 flex flex-col"
				>
					<div className="flex-1 overflow-y-auto p-6 space-y-8">
						{/* Metadata Alert if syncing */}
						{mode === 'edit' && subjectMeta && (
							<div className="rounded-xl border bg-muted/30 p-4 flex items-start gap-3">
								<ShieldCheck className="size-5 text-emerald-600 shrink-0 mt-0.5" />
								<div className="space-y-2 flex-1">
									<div className="flex items-center justify-between gap-2">
										<h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Saved curriculum source</h3>
										<Badge variant="outline" className="bg-background font-mono text-xs">
											{subjectMeta.displayCode || form.code}
										</Badge>
									</div>

									{/* Output label */}
									{subjectMeta.outputLabel && (
										<p className="text-xs text-muted-foreground">
											<span className="font-semibold text-foreground">Print label:</span> {subjectMeta.outputLabel}
										</p>
									)}

									<div className="flex flex-wrap gap-1.5">
										{subjectMeta.isSystemManaged && (
											<Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600 border-slate-200">
												System-managed
											</Badge>
										)}
										{subjectMeta.ownerDepartment && (
											<Badge variant="secondary" className={`text-xs ${SUBJECT_OWNER_BADGE[subjectMeta.ownerDepartment] ?? ''}`}>
												{SUBJECT_OWNER_LABELS[subjectMeta.ownerDepartment] ?? subjectMeta.ownerDepartment}
											</Badge>
										)}
										{(subjectMeta.allowedOwnerDepartments ?? []).map((departmentCode) => (
											<Badge
												key={`extra-owner-${departmentCode}`}
												variant="outline"
												className={`text-xs ${SUBJECT_OWNER_BADGE[departmentCode] ?? ''}`}
											>
												Also qualified: {SUBJECT_OWNER_LABELS[departmentCode] ?? departmentCode}
											</Badge>
										))}
										{subjectMeta.rotationFamily && (
											<Badge variant="outline" className="text-xs border-indigo-200 text-indigo-700 bg-indigo-50/30">
												{subjectMeta.rotationFamily}
											</Badge>
										)}
										{subjectMetaRotationLabel && (
											<Badge variant="outline" className="text-xs border-indigo-300 text-indigo-900 bg-indigo-100/60">
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
								<h3 className="text-sm font-bold uppercase tracking-wider">1. Subject identity</h3>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
								<div className="space-y-1.5">
									<label htmlFor={`${formId}-code`} className="text-sm font-semibold text-foreground ml-0.5">
										Subject code
										<span className="text-destructive ml-0.5" aria-label="required">*</span>
									</label>
									<Input
										id={`${formId}-code`}
										ref={codeInputRef}
										placeholder="e.g. MATH10"
										value={form.code}
										readOnly={mode === 'edit'}
										onChange={(event) => mode === 'add' && setForm((previous) => ({ ...previous, code: event.target.value.toUpperCase() }))}
										aria-invalid={Boolean(validationErrors.code) || undefined}
										aria-describedby={validationErrors.code ? `${formId}-code-error` : `${formId}-code-help`}
										className={`font-mono uppercase ${mode === 'edit' ? 'bg-muted/50 cursor-not-allowed' : ''}`}
									/>
									{validationErrors.code ? (
										<p id={`${formId}-code-error`} role="alert" className="flex items-center gap-1 text-xs font-semibold text-destructive">
											<AlertTriangle className="size-3" /> {validationErrors.code}
										</p>
									) : (
										<p id={`${formId}-code-help`} className="text-xs text-muted-foreground">Short code shown in tables, schedules, and reports.</p>
									)}
								</div>
								<div className="space-y-1.5">
									<label htmlFor={`${formId}-name`} className="text-sm font-semibold text-foreground ml-0.5">
										Subject name
										<span className="text-destructive ml-0.5" aria-label="required">*</span>
									</label>
									<Input
										id={`${formId}-name`}
										placeholder="e.g. Mathematics Grade 10"
										value={form.name}
										onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
										aria-invalid={Boolean(validationErrors.name) || undefined}
										aria-describedby={validationErrors.name ? `${formId}-name-error` : `${formId}-name-help`}
									/>
									{validationErrors.name ? (
										<p id={`${formId}-name-error`} role="alert" className="flex items-center gap-1 text-xs font-semibold text-destructive">
											<AlertTriangle className="size-3" /> {validationErrors.name}
										</p>
									) : (
										<p id={`${formId}-name-help`} className="text-xs text-muted-foreground">Plain subject name officers and teachers will recognize.</p>
									)}
								</div>
							</div>

							<div className="flex items-center justify-between p-3 rounded-lg border bg-accent/5">
								<div className="flex items-center gap-3">
									<Switch
										checked={form.isActive}
										onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
									/>
									<div className="flex flex-col">
										<span className="text-sm font-semibold">Available for this school year</span>
										<span className="text-xs text-muted-foreground">Archived subjects stay in history but are not used for new schedules.</span>
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
								<h3 className="text-sm font-bold uppercase tracking-wider">2. Weekly time and room need</h3>
							</div>

							<div className="space-y-2">
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<label htmlFor={`${formId}-time`} className="text-sm font-semibold text-foreground ml-0.5">Weekly time</label>
										{/* Phase 2.1: single unit display. The toggle still exists for
											power users who think in minutes, but the default unit is
											hours and the visual hint matches the selected unit. The
											"min" / "hr" / "minutes" / "hours" jargon no longer appears
											three different ways in the same row. */}
										<div className="flex bg-muted rounded-md p-0.5" role="group" aria-label="Time unit">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												aria-pressed={timeMode === 'hours'}
												onClick={() => setTimeMode('hours')}
												className={`h-7 px-2 text-xs rounded ${timeMode === 'hours' ? 'bg-background shadow-sm font-bold text-foreground' : 'text-muted-foreground'}`}
											>
												Hours
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												aria-pressed={timeMode === 'minutes'}
												onClick={() => setTimeMode('minutes')}
												className={`h-7 px-2 text-xs rounded ${timeMode === 'minutes' ? 'bg-background shadow-sm font-bold text-foreground' : 'text-muted-foreground'}`}
											>
												Minutes
											</Button>
										</div>
									</div>
								<div className="relative">
									<Input
										id={`${formId}-time`}
										type="number"
										min={0}
										// Prompt 01A: exact minute-preserving hours conversion.
										// 225 min = 3.75 h — step must accept quarter-hour precision
										// (0.25) so the browser never blocks a legal value; the old
										// implicit step=1 silently rejected 3.8/3.75 and swallowed
										// the submit while Save stayed enabled.
										step={timeMode === 'minutes' ? 1 : 0.25}
										value={timeMode === 'minutes' ? form.minMinutesPerWeek : Math.round((form.minMinutesPerWeek / 60) * 100) / 100}
										onChange={(event) => {
											const value = Number(event.target.value);
											setForm((previous) => ({
												...previous,
												// round to the nearest whole minute; 3.75 h -> 225 min exactly
												minMinutesPerWeek: timeMode === 'minutes' ? Math.round(value) : Math.round(value * 60),
											}));
										}}
										aria-describedby={`${formId}-time-help`}
										className="pr-16 font-medium"
									/>
										<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground uppercase">
											{timeMode === 'minutes' ? 'min/wk' : 'hr/wk'}
										</span>
									</div>
									<p id={`${formId}-time-help`} className="text-xs text-muted-foreground">Used to calculate how many class periods this subject needs each week.</p>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
								<div className="space-y-2">
									<label htmlFor={`${formId}-room`} className="text-sm font-semibold text-foreground ml-0.5">Room need</label>
									<Select value={form.preferredRoomType} onValueChange={(v) => setForm((p) => ({ ...p, preferredRoomType: v as RoomType }))}>
										<SelectTrigger id={`${formId}-room`} className="h-10">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{ALL_ROOM_TYPES.map((roomType) => (
												<SelectItem key={roomType} value={roomType}>{ROOM_TYPE_LABELS[roomType]}</SelectItem>
											))}
										</SelectContent>
									</Select>
									<p className="text-xs text-muted-foreground">Choose standard classroom unless this subject needs a specialized room.</p>
								</div>

								{/* Phase 2.1 + Decision 2: rename "Can be scheduled" to the
									plain-language "Available for timetable" with helper. The
									default is on (per Decision 2). When the user disables it,
									a confirmation state explains the consequence. */}
								<div className="space-y-2">
									<div className="flex items-center gap-3 p-3 rounded-lg border bg-accent/5 self-end h-10">
										<Switch
											checked={form.isSeedable}
											onCheckedChange={(v) => setForm((p) => ({ ...p, isSeedable: v }))}
										/>
										<label className="text-sm font-semibold cursor-pointer" onClick={() => setForm((p) => ({ ...p, isSeedable: !p.isSeedable }))}>
											Available for timetable
										</label>
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<AlertCircle className="size-3 text-muted-foreground cursor-help" />
												</TooltipTrigger>
												<TooltipContent className="max-w-xs text-xs">
													Turn this off only if this subject should not appear in schedule generation (e.g. Homeroom Guidance, consultation periods).
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</div>
									{!form.isSeedable ? (
										<div
											role="status"
											data-testid="subjects-form-seedable-warning"
											className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
										>
											<AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
											<p>
												This subject will be excluded from schedule generation. Existing assignments are kept.
											</p>
										</div>
									) : null}
								</div>
							</div>
						</div>

						<Separator className="opacity-50" />

						{/* Section 3: Governance */}
						<div className="space-y-6">
							<div className="flex items-center gap-2 text-primary">
								<Layout className="size-4" />
								<h3 className="text-sm font-bold uppercase tracking-wider">3. Programs and teacher owner</h3>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
								<div className="space-y-2">
									<label htmlFor={`${formId}-owner`} className="text-sm font-semibold text-foreground ml-0.5">Owner department</label>
									<Select
										value={form.ownerDepartment || 'UNASSIGNED'}
										onValueChange={(value) => setForm((previous) => ({
											...previous,
											ownerDepartment: value === 'UNASSIGNED' ? '' : value,
										}))}
									>
										<SelectTrigger id={`${formId}-owner`} className="h-10">
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
									<p className="text-xs text-muted-foreground">Department normally responsible for teaching this subject.</p>
								</div>
								<div className="space-y-2">
									<label className="text-sm font-semibold text-foreground ml-0.5">Coverage rule</label>
									<div className="h-10 rounded-md border bg-muted/30 px-3 flex items-center">
										<span className="text-sm font-semibold text-foreground">Department ownership</span>
									</div>
								</div>
							</div>

							<div className="space-y-3">
								<label className="text-sm font-semibold text-foreground ml-0.5">Additional Qualified Departments</label>
								<p className="text-xs text-muted-foreground">
									Use this when a subject can be baseline-owned by more than one department.
								</p>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3">
									{SUBJECT_OWNER_OPTIONS.filter((option) => option.value !== 'UNASSIGNED').map((option) => {
										const isPrimary = form.ownerDepartment === option.value;
										const isSelected = isPrimary || (form.allowedOwnerDepartments ?? []).includes(option.value);
										return (
											<div
												key={`owner-dept-${option.value}`}
												className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
													isSelected
														? 'border-primary/40 bg-primary/10 text-primary'
														: 'border-border bg-background text-muted-foreground hover:bg-muted/50'
												}`}
											>
												<Checkbox
													aria-label={`Allow ${option.label} to teach this subject`}
													checked={isSelected}
													onCheckedChange={() => {
														if (!isPrimary) {
															toggleAdditionalOwnerDepartment(option.value);
														}
													}}
													disabled={isPrimary}
												/>
												<span className="truncate">
													{option.label}{isPrimary ? ' (Primary)' : ''}
												</span>
											</div>
										);
									})}
								</div>
							</div>

							<div className="space-y-3">
								<label className="text-sm font-semibold text-foreground ml-0.5">Grade coverage</label>
								<div className="grid grid-cols-4 gap-2">
									{GRADE_OPTIONS.map((g) => (
										<Button
											key={g}
											type="button"
											variant={form.gradeLevels.includes(g) ? 'default' : 'outline'}
											size="sm"
											onClick={() => toggleGradeLevel(g)}
											aria-pressed={form.gradeLevels.includes(g)}
											className="h-9 px-3 text-sm font-bold"
										>
											{gradeLabel(g)}
										</Button>
									))}
								</div>
							</div>

							<div className="space-y-3">
								<label className="text-sm font-semibold text-foreground ml-0.5">
									Program coverage
									<span className="text-destructive ml-0.5" aria-label="required">*</span>
								</label>
								<div
									aria-invalid={Boolean(validationErrors.programScopes) || undefined}
									aria-describedby={validationErrors.programScopes ? `${formId}-programs-error` : undefined}
									className="flex flex-wrap gap-2"
								>
									{PROGRAM_SCOPE_OPTIONS.map(({ value, label }) => (
										<Button
											key={value}
											type="button"
											variant="outline"
											size="sm"
											onClick={() => toggleProgramScope(value)}
											aria-pressed={form.programScopes.includes(value)}
											className={`h-9 px-4 rounded-full text-xs font-bold transition-all ${
												form.programScopes.includes(value)
													? 'bg-sky-100 text-sky-800 border-sky-300 ring-1 ring-sky-300/20 hover:bg-sky-100'
													: 'bg-background text-muted-foreground'
											}`}
										>
											{label}
										</Button>
									))}
								</div>
								{validationErrors.programScopes ? (
									<p id={`${formId}-programs-error`} role="alert" className="flex items-center gap-1 text-xs font-semibold text-destructive">
										<AlertTriangle className="size-3" /> {validationErrors.programScopes}
									</p>
								) : null}
							</div>
						</div>

						<Separator className="opacity-50" />

						{/* Phase 2.1: "Skip if unsure" gate on Advanced. Collapsed by
							default in add mode so non-technical users are not confronted
							with three unfamiliar concepts at once. */}
						<div className="space-y-4">
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-center gap-2 text-primary">
									<Settings2 className="size-4" />
									<h3 className="text-sm font-bold uppercase tracking-wider">4. Advanced scheduling rules</h3>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setShowAdvanced((show) => !show)}
									aria-expanded={showAdvanced}
									aria-controls="subjects-form-advanced"
									data-testid="subjects-form-advanced-toggle"
									className="h-9 font-bold"
								>
									{showAdvanced ? 'Hide advanced' : 'Show advanced'}
									{showAdvanced ? <ChevronLeft className="ml-1 size-3.5" /> : <ChevronRight className="ml-1 size-3.5" />}
								</Button>
							</div>
							{!showAdvanced ? (
								<p className="text-xs text-muted-foreground">
									Skip if you are unsure. These settings are only needed for shared class sessions, modular (rotating) subjects, and special room features.
								</p>
							) : (
								<div id="subjects-form-advanced" className="space-y-4 animate-in zoom-in-95 duration-200">
									{/* Inter-section Pooling */}
									<div className="p-4 rounded-xl border bg-muted/20 space-y-4">
										<div className="flex items-center justify-between">
											<div className="flex flex-col">
												<span className="text-sm font-bold">Shared class session</span>
												<span className="text-xs text-muted-foreground">Use only when one teacher can teach multiple sections at the same time.</span>
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
														className={`h-8 px-2 text-xs font-bold ${(form.interSectionGradeLevels ?? []).includes(g) ? 'bg-violet-100 text-violet-800 border-violet-300 hover:bg-violet-100' : ''}`}
													>
														{gradeLabel(g)} Pool
													</Button>
												))}
											</div>
										)}
									</div>

									{/* Modular Scheduling */}
									<div className="p-4 rounded-xl border bg-muted/20 space-y-4">
										<div className="flex items-center justify-between">
											<div className="flex flex-col">
												<span className="text-sm font-bold">Rotates by term</span>
												<span className="text-xs text-muted-foreground">Use for subjects that share one weekly schedule lane across terms.</span>
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
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 animate-in zoom-in-95 duration-200">
												<div className="space-y-1.5">
													<label className="text-xs font-bold text-muted-foreground uppercase">Rotation family</label>
													<Input
														placeholder="e.g. SCIENCE"
														value={form.modularGroupId}
														onChange={(e) => setForm((p) => ({ ...p, modularGroupId: e.target.value.toUpperCase() }))}
														className="h-9 text-sm uppercase font-mono"
													/>
												</div>
												<div className="space-y-1.5">
													<label className="text-xs font-bold text-muted-foreground uppercase">Term rank</label>
													<Input
														type="number"
														min={1}
														value={form.modularOrder ?? 1}
														onChange={(e) => setForm((p) => ({ ...p, modularOrder: Math.max(1, Number(e.target.value) || 1) }))}
														aria-describedby="modular-rank-help"
														className="h-9 text-sm"
													/>
													<p id="modular-rank-help" className="text-xs text-muted-foreground">
														Term rank controls the sequence within this rotation family (1 = first term).
													</p>
												</div>
											</div>
										)}
									</div>

									{/* Room Requirements */}
									<div className="space-y-3">
										<label className="text-sm font-semibold text-foreground ml-0.5">Required room features</label>
										<div className="flex gap-2">
											<Input
												placeholder="e.g. ICT lab, workshop tools"
												value={newFeature}
												onChange={(e) => setNewFeature(e.target.value)}
												onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
												className="h-9 text-sm"
											/>
											<Button type="button" size="sm" onClick={addFeature} className="h-9 font-bold">Add</Button>
										</div>
										<div className="flex flex-wrap gap-1.5">
											{form.requiredFeatures.map((f) => (
												<Badge key={f} variant="secondary" className="pl-2 pr-1 py-0.5 text-xs font-bold flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200">
													{f}
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={() => removeFeature(f)}
														aria-label={`Remove required feature ${f}`}
														className="size-4 p-0 hover:text-red-600 transition-colors text-current"
													>
														<X className="size-3" />
													</Button>
												</Badge>
											))}
											{form.requiredFeatures.length === 0 && (
												<span className="text-xs text-muted-foreground italic pl-1">No special room features needed.</span>
											)}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>

					<DialogFooter className="p-6 border-t bg-muted/20">
						<Button type="button" variant="outline" onClick={onClose} disabled={saving} className="h-10 font-bold px-6">Cancel</Button>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									{/* The button is disabled when the form is invalid; the
										tooltip explains why so the older non-technical scheduler
										knows what to fix (AGENTS: disabled states explicit). */}
									<span className="inline-block">
										<Button
											type="submit"
											disabled={!canSave}
											data-testid="subjects-form-save"
											className="h-10 font-bold px-8 shadow-sm"
										>
											{saving ? (mode === 'add' ? 'Creating...' : 'Saving...') : (mode === 'add' ? 'Create subject' : 'Save curriculum subject')}
										</Button>
									</span>
								</TooltipTrigger>
								{!canSave && !saving && saveDisabledReason ? (
									<TooltipContent side="top" className="text-xs">{saveDisabledReason}</TooltipContent>
								) : null}
							</Tooltip>
						</TooltipProvider>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}