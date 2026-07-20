import { StackedWorkloadBar } from '@/components/faculty-assignments/StackedWorkloadBar';
import { MAX_WEEKLY_TEACHING_HOURS } from '@/lib/faculty-assignment-helpers';
import type { FacultyMirror } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';

import {
	compactLoadStatus,
	facultyDisplayName,
	formatHours,
} from './TacticalSandboxDock.helpers';

export type Candidate = {
	faculty: FacultyMirror;
	teachingHours: number;
	creditHours: number;
	creditedTotalHours: number;
	statusLabel: string;
	toCapHours: number;
	overCapHours: number;
	isCurrent: boolean;
	isSelected: boolean;
};

export type ReviewStep = {
	label: string;
	state: 'done' | 'active' | 'waiting' | 'blocked';
};

export function ReviewStepPill({ step }: { step: ReviewStep }) {
	const tone = step.state === 'done'
		? 'border-emerald-200 bg-emerald-50 text-emerald-700'
		: step.state === 'active'
			? 'border-primary/25 bg-primary/10 text-primary'
			: step.state === 'blocked'
				? 'border-red-200 bg-red-50 text-red-700'
				: 'border-border bg-muted/30 text-muted-foreground';

	return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>{step.label}</span>;
}

type TeacherCandidateCardProps = {
	candidate: Candidate;
	showWorkloadDetails: boolean;
	onApply: (facultyId: number) => void;
};

export function TeacherCandidateCard({ candidate, showWorkloadDetails, onApply }: TeacherCandidateCardProps) {
	return (
		<div key={candidate.faculty.id} className="min-w-0 rounded-md border border-border/80 bg-card p-3 shadow-sm" data-teacher-candidate-row="true">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-1.5">
						<p className="truncate text-sm font-semibold text-foreground">{facultyDisplayName(candidate.faculty)}</p>
						{candidate.isCurrent ? <Badge variant="outline" className="h-5 px-1.5 text-xs">Current</Badge> : null}
						{candidate.isSelected ? <Badge className="h-5 px-1.5 text-xs">Previewed</Badge> : null}
					</div>
					<p className="text-xs text-muted-foreground">
						{candidate.faculty.department ?? 'Unassigned'}
						{candidate.faculty.specialization ? ` - ${candidate.faculty.specialization}` : ''}
					</p>
				</div>
				<Button
					type="button"
					size="sm"
					variant={candidate.isSelected ? 'secondary' : 'outline'}
					className="h-8 text-xs"
					onClick={() => onApply(candidate.faculty.id)}
					aria-label={`Use ${facultyDisplayName(candidate.faculty)} for this sandbox repair`}
				>
					{candidate.isSelected ? 'Selected' : 'Use teacher'}
				</Button>
			</div>
			<div className="mt-2 flex flex-wrap items-center justify-between gap-2">
				<Badge variant={candidate.overCapHours > 0 ? 'destructive' : candidate.toCapHours <= 2 ? 'outline' : 'secondary'} className="h-5 px-2 text-xs">
					{compactLoadStatus(candidate)}
				</Badge>
				<p className="text-xs font-medium text-muted-foreground">{candidate.statusLabel}</p>
			</div>
			{showWorkloadDetails ? (
				<div className="mt-2 grid gap-2 sm:grid-cols-[1fr_11rem] sm:items-center">
					<StackedWorkloadBar
						teachingHours={candidate.teachingHours}
						creditHours={candidate.creditHours}
						maxHours={candidate.faculty.maxHoursPerWeek || MAX_WEEKLY_TEACHING_HOURS}
						compact
					/>
					<div className="text-xs text-muted-foreground sm:text-right">
						<p className="font-medium text-foreground">{formatHours(candidate.creditedTotalHours)} credited</p>
						<p>{formatHours(candidate.teachingHours)} teaching + {formatHours(candidate.creditHours)} credit</p>
						<p>{candidate.overCapHours > 0 ? `${formatHours(candidate.overCapHours)} over cap` : `${formatHours(candidate.toCapHours)} to cap`}</p>
					</div>
				</div>
			) : null}
		</div>
	);
}
