import { Link } from 'react-router-dom';
import {
	AlertTriangle,
	ArrowRight,
	BookOpen,
	CheckCircle2,
	ClipboardList,
	Loader2,
	MapPinned,
	Users,
} from 'lucide-react';

import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';

export type NextActionInput = {
	loading: boolean;
	subjectCount: number | null;
	facultyCount: number | null;
	sectionCount: number | null;
	unassignedSubjectCount: number | null;
	buildingsDone: boolean;
	buildingsHint?: string;
};

type Step = {
	key: string;
	title: string;
	body: string;
	cta: string;
	to: string;
	icon: typeof BookOpen;
	warning?: string;
};

function pickStep(input: NextActionInput): Step {
	const {
		subjectCount,
		facultyCount,
		sectionCount,
		unassignedSubjectCount,
		buildingsDone,
		buildingsHint,
	} = input;

	if ((subjectCount ?? 0) === 0) {
		return {
			key: 'subjects',
			title: 'Next: Add this year\u2019s subjects',
			body: 'Start setup by adding the subjects you\u2019ll schedule.',
			cta: 'Add subjects',
			to: '/subjects',
			icon: BookOpen,
			warning: 'No subjects added yet',
		};
	}
	if ((sectionCount ?? 0) === 0) {
		return {
			key: 'sections',
			title: 'Next: Check sections before generation',
			body: sectionCount === null
				? 'Enrollment data cannot be reached. Try again or check the connection.'
				: 'No sections were found for the active school year.',
			cta: 'Check sections',
			to: '/sections',
			icon: Users,
			warning: sectionCount === null ? 'Enrollment data unavailable' : 'No sections loaded',
		};
	}
	if ((facultyCount ?? 0) === 0) {
		return {
			key: 'teachers',
			title: 'Next: Bring in your teacher list',
			body: 'Sync teachers from enrollment so they can be assigned subjects.',
			cta: 'Sync teachers',
			to: '/teachers',
			icon: Users,
			warning: 'No teachers synced yet',
		};
	}
	if ((unassignedSubjectCount ?? 0) > 0) {
		return {
			key: 'teaching-load',
			title: `Next: Assign teachers to ${unassignedSubjectCount} subject${unassignedSubjectCount === 1 ? '' : 's'}`,
			body: 'Each subject needs at least one qualified teacher before generation.',
			cta: 'Open teaching load',
			to: '/teaching-load',
			icon: ClipboardList,
			warning: `${unassignedSubjectCount} subject${unassignedSubjectCount === 1 ? '' : 's'} unassigned`,
		};
	}
	if (!buildingsDone) {
		return {
			key: 'buildings',
			title: 'Next: Finish the campus map',
			body: buildingsHint ?? 'Add the buildings and rooms used for teaching.',
			cta: 'Open campus map',
			to: '/map',
			icon: MapPinned,
			warning: buildingsHint ?? 'Campus map incomplete',
		};
	}
	return {
		key: 'ready',
		title: 'Setup looks complete',
		body: 'You can review the readiness check or move on to generating a schedule.',
		cta: 'Run readiness check',
		to: '/audit',
		icon: CheckCircle2,
	};
}

// Single emerald-primary tone for the main CTA. Warnings ride as a small badge
// on the title, not as a competing colored panel.
const TONE = {
	ring: 'ring-1 ring-emerald-200/70',
	bg: 'bg-emerald-50/60',
	icon: 'text-emerald-600 bg-emerald-100',
	cta: 'bg-emerald-600 hover:bg-emerald-700 text-white',
};

export function NextActionPanel(props: NextActionInput) {
	const step = pickStep(props);
	const tone = TONE;
	const Icon = step.icon;

	return (
		<Card className={`shadow-sm border-0 ${tone.ring} ${tone.bg}`}>
			<CardContent className="p-6">
				<div className="flex items-start gap-4">
					<div className={`rounded-xl p-3 shrink-0 ${tone.icon}`}>
						{props.loading ? (
							<Loader2 className="size-6 animate-spin" />
						) : (
							<Icon className="size-6" />
						)}
					</div>
					<div className="flex-1 min-w-0">
						<p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
							Your next step
						</p>
						<h2 className="text-xl font-semibold tracking-tight text-foreground mt-0.5 flex items-center gap-2 flex-wrap">
							<span>{step.title}</span>
							{step.warning && (
								<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-medium text-amber-800">
									<AlertTriangle className="size-3" />
									{step.warning}
								</span>
							)}
						</h2>
						<p className="text-sm text-muted-foreground mt-1 leading-relaxed">
							{step.body}
						</p>
					</div>
					<Button asChild size="lg" className={`shrink-0 h-10 ${tone.cta}`} disabled={props.loading}>
						<Link to={step.to}>
							{step.cta}
							<ArrowRight className="ml-1.5 size-4" />
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
