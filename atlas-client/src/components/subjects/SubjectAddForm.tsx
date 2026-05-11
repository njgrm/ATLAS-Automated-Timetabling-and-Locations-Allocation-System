import type { Dispatch, SetStateAction } from 'react';
import type { RoomType, SessionPattern } from '@/types';
import {
	ALL_ROOM_TYPES,
	GRADE_OPTIONS,
	PROGRAM_SCOPE_BADGE,
	PROGRAM_SCOPE_OPTIONS,
	ROOM_TYPE_LABELS,
	SESSION_PATTERN_LABELS,
	type NewSubjectForm,
} from '@/lib/subject-constants';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';

type Props = {
	newSubject: NewSubjectForm;
	setNewSubject: Dispatch<SetStateAction<NewSubjectForm>>;
	saving: boolean;
	timeMode: 'minutes' | 'hours';
	setTimeMode: Dispatch<SetStateAction<'minutes' | 'hours'>>;
	availableSpecializations: string[];
	onCreate: () => void;
	onCancel: () => void;
};

export function SubjectAddForm({
	newSubject,
	setNewSubject,
	saving,
	timeMode,
	setTimeMode,
	availableSpecializations,
	onCreate,
	onCancel,
}: Props) {
	const toggleGradeLevel = (g: number) => {
		setNewSubject((p) => ({
			...p,
			gradeLevels: p.gradeLevels.includes(g)
				? p.gradeLevels.filter((x) => x !== g)
				: [...p.gradeLevels, g].sort((a, b) => a - b),
		}));
	};

	return (
		<div className="shrink-0 px-6 pb-2">
			<Card className="shadow-sm border-primary/30">
				<CardContent className="pt-4">
					<p className="text-sm font-semibold mb-3">New Custom Subject</p>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
						<div>
							<label className="text-xs font-medium text-muted-foreground">Code</label>
							<Input
								placeholder="e.g. ELEC1"
								value={newSubject.code}
								onChange={(e) => setNewSubject((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
							/>
						</div>
						<div>
							<label className="text-xs font-medium text-muted-foreground">Name</label>
							<Input
								placeholder="Subject name"
								value={newSubject.name}
								onChange={(e) => setNewSubject((p) => ({ ...p, name: e.target.value }))}
							/>
						</div>
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
										? newSubject.minMinutesPerWeek
										: Math.round((newSubject.minMinutesPerWeek / 60) * 10) / 10
								}
								onChange={(e) => {
									const val = Number(e.target.value);
									setNewSubject((p) => ({
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
										onClick={() => setNewSubject((p) => ({ ...p, minMinutesPerWeek: val }))}
										className="rounded border bg-accent/5 px-1.5 py-0.5 text-[0.5625rem] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
									>
										{val}m
									</button>
								))}
							</div>
						</div>
						<div>
							<label className="text-xs font-medium text-muted-foreground mb-1 block">Preferred Room Type</label>
							<Select
								value={newSubject.preferredRoomType}
								onValueChange={(v) => setNewSubject((p) => ({ ...p, preferredRoomType: v as RoomType }))}
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
						<div>
							<label className="text-xs font-medium text-muted-foreground mb-1 block">Session Pattern</label>
							<Select
								value={newSubject.sessionPattern}
								onValueChange={(v) => setNewSubject((p) => ({ ...p, sessionPattern: v as SessionPattern }))}
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
					</div>

					<div className="mt-3">
						<label className="text-xs font-medium text-muted-foreground">Grade Levels</label>
						<div className="mt-1 flex gap-2">
							{GRADE_OPTIONS.map((g) => (
								<button
									key={g}
									type="button"
									onClick={() => toggleGradeLevel(g)}
									className={`inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
										newSubject.gradeLevels.includes(g)
											? 'border-primary bg-primary text-primary-foreground'
											: 'border-border bg-background text-muted-foreground hover:bg-accent/10'
									}`}
								>
									G{g}
								</button>
							))}
						</div>
					</div>

					<div className="mt-3">
						<label className="text-xs font-medium text-muted-foreground">Program Scopes</label>
						<div className="mt-1 flex flex-wrap gap-1.5">
							{PROGRAM_SCOPE_OPTIONS.map(({ value, label }) => (
								<button
									key={value}
									type="button"
									onClick={() =>
										setNewSubject((p) => {
											const has = p.programScopes.includes(value);
											const next = has
												? p.programScopes.filter((x) => x !== value)
												: [...p.programScopes, value];
											return { ...p, programScopes: next.length > 0 ? next : [value] };
										})
									}
									className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
										newSubject.programScopes.includes(value)
											? `border-current ${PROGRAM_SCOPE_BADGE[value] ?? 'bg-sky-50 text-sky-700 border-sky-200'}`
											: 'border-border text-muted-foreground hover:bg-accent/10'
									}`}
								>
									{label}
								</button>
							))}
						</div>
					</div>

					{availableSpecializations.length > 0 && (
						<div className="mt-3">
							<label className="text-xs font-medium text-muted-foreground">
								Specialization Restriction{' '}
								<span className="font-normal text-muted-foreground/70">(leave blank = open to all)</span>
							</label>
							<div className="mt-1 flex flex-wrap gap-1.5">
								{availableSpecializations.map((spec) => (
									<button
										key={spec}
										type="button"
										onClick={() =>
											setNewSubject((p) => {
												const has = p.allowedSpecializations.includes(spec);
												return {
													...p,
													allowedSpecializations: has
														? p.allowedSpecializations.filter((x) => x !== spec)
														: [...p.allowedSpecializations, spec],
												};
											})
										}
										className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
											newSubject.allowedSpecializations.includes(spec)
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

					<div className="mt-4 flex gap-2">
						<Button
							size="sm"
							onClick={onCreate}
							disabled={saving || !newSubject.code.trim() || !newSubject.name.trim()}
						>
							{saving ? 'Creating...' : 'Create Subject'}
						</Button>
						<Button variant="outline" size="sm" onClick={onCancel}>
							Cancel
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
