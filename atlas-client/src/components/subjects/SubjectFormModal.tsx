import { useState, useEffect, useRef, useId } from 'react';
import type { RoomType } from '@/types';
import {
	GRADE_OPTIONS,
	PROGRAM_SCOPE_OPTIONS,
	ROOM_TYPE_LABELS,
	SUBJECT_OWNER_BADGE,
	SUBJECT_OWNER_LABELS,
	SUBJECT_OWNER_OPTIONS,
	SUBJECT_ROOM_NEED_TYPES,
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
import { roomAuthoritySemantics } from '@/lib/room-authority-copy';
import { Info, Clock, Settings2, ShieldCheck, Layout, X, ChevronRight, AlertTriangle, CheckCircle2, History } from 'lucide-react';

export type SubjectFormValues = NewSubjectForm & {
	id?: number;
};

/**
 * A3-20: the outcome of a save attempt, as three DISTINCT results.
 *
 * A stale write is not a failure — nothing was lost, but the operator's edit
 * was built on a version that no longer exists, and the only correct next
 * action is to reload. Collapsing it into a generic error string (which is
 * what the single `toast.error(msg)` channel did) told the operator their
 * change failed and gave them no route back. Success closes the dialog, so its
 * result surface exists for the window before close; failure and stale keep
 * the dialog open and are stated inline, so the outcome is readable without
 * depending on a transient toast.
 */
export type SubjectSaveOutcome =
	| { status: 'saved' }
	| { status: 'stale'; message: string }
	| { status: 'failed'; message: string };

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
	onSave: (values: SubjectFormValues) => Promise<SubjectSaveOutcome>;
	onClose: () => void;
};

function resolveCanonicalRotationTermLabel(termLabel: string | null | undefined, termRank: number | null | undefined): string | null {
	const normalizedLabel = (termLabel ?? '').trim();
	if (normalizedLabel) return normalizedLabel;
	return typeof termRank === 'number' && Number.isInteger(termRank) && termRank > 0
		? `Term ${termRank}`
		: null;
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
	// A3-20: the truthful result surface. Cleared on every open so a previous
	// attempt's outcome is never shown against a fresh form.
	const [result, setResult] = useState<SubjectSaveOutcome | null>(null);
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
			setResult(null);
			setValidationErrors({});
			// Phase 2.1: focus the code input on add so a non-technical user
			// can start typing immediately.
			if (mode === 'add') {
				requestAnimationFrame(() => codeInputRef.current?.focus());
			}
		}
	}, [open, initialValues, mode]);

	// A3-20 (Cancel / non-action): Cancel and Escape are a non-action path. They
	// must issue no request and must not mutate form state, so the submit
	// handler is the ONLY thing that calls onSave and it is the only thing that
	// writes a result. This is asserted by a control, not by inspection.
	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!canSave) return;
		setResult(null);
		const outcome = await onSave(form);
		setResult(outcome);
	};

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

	// A3-33B (PRESENTATION ONLY): the shared class session is no longer an
	// operator input in this form, but its PERSISTED value is untouched. Nothing
	// below writes `interSectionEnabled` or `interSectionGradeLevels`, and every
	// setForm call in this component spreads `...previous`, so a subject stored
	// with a shared session carries the same `true` (and the same pooled grade
	// levels) into the save payload. `subjectToFormValues` is what seeds it, and
	// Subjects.handleModalSave is what sends it. A round-trip control asserts
	// the payload; this comment is not the evidence.

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

	// A3-33A: the section map. `showAdvanced` is gone, so the last section is no
	// longer an OPTIONAL step the operator can skip — the form is a single
	// scroll in which all four sections are always present, and its terminal
	// state is the scheduling-rules section. `currentStepId` is therefore a
	// constant, not a derived value: the form never leaves the last section.
	// Nothing dangles on `advanced` and there is no phantom step — 'Advanced'
	// is renamed 'Scheduling rules' to name the section that actually renders.
	const steps = [
		{ id: 'identity', label: 'Identity' },
		{ id: 'time', label: 'Time and room' },
		{ id: 'governance', label: 'Programs and owner' },
		{ id: 'scheduling', label: 'Scheduling rules' },
	] as const;
	const currentStepId = 'scheduling';
	const currentStepIndex = steps.findIndex((step) => step.id === currentStepId);

	return (
		<Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
			<DialogContent
				className="max-w-2xl max-h-[95svh] overflow-hidden flex flex-col p-0"
				data-testid="subjects-form-dialog"
			>
				<DialogHeader className="shrink-0 p-6 pb-4 border-b">
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

					{/* A3-33A: all four sections are always rendered, so the indicator
						is a section map whose current step is the final one. The
						`aria-current="step"` marker is on that section only. */}
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
					onSubmit={handleSubmit}
					className="flex-1 min-h-0 flex flex-col"
				>
					{/* A3-20: the dialog owns its scroll. A fixed header, a single
						`flex-1 min-h-0` scroll region and a fixed footer mean the
						modal can never grow past the viewport or push page scroll
						(AGENTS.md §8), no matter how many sections are open. */}
					<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-8" data-testid="subjects-form-scroll">
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

						<div className="grid grid-cols-1 gap-6 pt-2">
							<div className="space-y-2">
								<label htmlFor={`${formId}-room`} className="text-sm font-semibold text-foreground ml-0.5">Room need</label>
								<Select value={form.preferredRoomType} onValueChange={(v) => setForm((p) => ({ ...p, preferredRoomType: v as RoomType }))}>
									<SelectTrigger id={`${formId}-room`} className="h-10">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{/* A3-32: SUBJECT_ROOM_NEED_TYPES, not ALL_ROOM_TYPES. A
											subject is never scheduled into a Faculty Room or an
											Office, so those were false options here. The list is a
											subset of ALL_ROOM_TYPES, which is still what the Room
											Type FILTER and the room map read. */}
										{SUBJECT_ROOM_NEED_TYPES.map((roomType) => (
											<SelectItem key={roomType} value={roomType}>{ROOM_TYPE_LABELS[roomType]}</SelectItem>
										))}
									</SelectContent>
								</Select>
								{/* C07-R8: the single shared room-authority copy authority explains
									both persisted values. CLASSROOM is not an unconditional
									requirement: special-room use is handled outside this timetable. */}
								<p className="text-xs text-muted-foreground">
									<strong className="font-semibold">Classroom</strong>: {roomAuthoritySemantics('CLASSROOM')}.{' '}
									<strong className="font-semibold">Laboratory</strong>: {roomAuthoritySemantics('LABORATORY')}.
								</p>
							</div>

							{/* SCA-01.2: isSeedable is hidden bootstrap metadata, not
								timetable demand. The old "Available for timetable"
								switch made a false claim about schedule generation:
								archived/active lifecycle (isActive) is the only
								catalog status shown to operators. The stored value
								is preserved untouched by edits. */}
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
									<label htmlFor={`${formId}-owner`} className="text-sm font-semibold text-foreground ml-0.5">Department</label>
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

						{/* A3-33A: ALWAYS VISIBLE. The "Show advanced" disclosure and
							its "Skip if you are unsure" hint are gone — a hidden
							section is a section an operator cannot audit, and the
							values it guarded (term rotation order, required room
							features) feed schedule generation directly. There is no
							disclosure, no collapsed state and no `showAdvanced`.
							A3-33B: the Shared class session control is removed and
							"Rotates by term" is the FIRST control here. */}
						<div className="space-y-4" data-testid="subjects-form-scheduling-section">
							<div className="flex items-center gap-2 text-primary">
								<Settings2 className="size-4" />
								<h3 className="text-sm font-bold uppercase tracking-wider">4. Scheduling rules</h3>
							</div>

							{/* A3-33B: read-only disclosure, NOT an input. A subject stored
								with a shared class session must not appear to have lost
								it when the control disappears, and the value still round-
								trips to the save payload untouched. No control here writes
								`interSectionEnabled`. */}
							{form.interSectionEnabled ? (
								<div
									data-testid="subjects-form-shared-session-readonly"
									className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50/40 px-3 py-2 text-xs text-violet-900"
								>
									<History className="mt-0.5 size-3.5 shrink-0" />
									<p>
										<span className="font-bold">Shared class session is on for this subject</span>
										{(form.interSectionGradeLevels ?? []).length > 0 ? (
											<>
												{' '}· pooled across {form.interSectionGradeLevels.map((g) => gradeLabel(g)).join(', ')}.
											</>
										) : null}
										{' '}This is a saved scheduling attribute and is preserved unchanged when you save.
									</p>
								</div>
							) : null}

							{/* Modular Scheduling — first control of the section (A3-33B). */}
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
					</div>

					{/* A3-20: the truthful result surface, inside the dialog, above the
						footer. `role="alert"` for the two outcomes that need action and
						`role="status"` for the one that does not, so a screen reader
						announces a failure and does not interrupt for a save. The three
						outcomes are distinct in role, wording and icon — a stale write is
						never reported as a plain failure, because its correct next action
						is "reload", not "retry and hope". The page's transient toast
						remains as a secondary channel; this region does not depend on it
						painting above the dialog. */}
					{result ? (
						<div
							role={result.status === 'saved' ? 'status' : 'alert'}
							aria-live={result.status === 'saved' ? 'polite' : 'assertive'}
							data-testid="subjects-form-result"
							data-result-status={result.status}
							className={`mx-6 mb-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
								result.status === 'saved'
									? 'border-emerald-200 bg-emerald-50 text-emerald-900'
									: result.status === 'stale'
										? 'border-amber-300 bg-amber-50 text-amber-900'
										: 'border-destructive/30 bg-destructive/10 text-destructive'
							}`}
						>
							{result.status === 'saved' ? (
								<CheckCircle2 className="mt-0.5 size-4 shrink-0" />
							) : result.status === 'stale' ? (
								<History className="mt-0.5 size-4 shrink-0" />
							) : (
								<AlertTriangle className="mt-0.5 size-4 shrink-0" />
							)}
							<p className="leading-relaxed">
								{result.status === 'saved' ? (
									<><span className="font-bold">Saved.</span> {mode === 'add' ? 'The subject was created.' : 'Your changes were written.'}</>
								) : result.status === 'stale' ? (
									<><span className="font-bold">Not saved — this subject changed while you were editing.</span> {result.message}</>
								) : (
									<><span className="font-bold">Not saved.</span> {result.message}</>
								)}
							</p>
						</div>
					) : null}

					<DialogFooter className="shrink-0 p-6 border-t bg-muted/20">
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
