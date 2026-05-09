import { useMemo, useState } from 'react';

import type { GenerationGateStatus } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';

type RoomRequestHeaderProps = {
	isMobileViewport: boolean;
	mobileStep: 1 | 2 | 3;
	currentStep: 1 | 2 | 3;
	entriesCount: number;
	runGeneratedAt: string | null;
	submittedCount: number;
	draftCount: number;
	gate: GenerationGateStatus | null;
	dirtyCount: number;
};

const STEP_LABELS = ['1 Select Class', '2 Choose Target', '3 Review & Submit'] as const;

export default function RoomRequestHeader({
	isMobileViewport,
	mobileStep,
	currentStep,
	entriesCount,
	runGeneratedAt,
	submittedCount,
	draftCount,
	gate,
	dirtyCount,
}: RoomRequestHeaderProps) {
	const [advisoryExpanded, setAdvisoryExpanded] = useState(false);
	const activeStep = isMobileViewport ? mobileStep : currentStep;

	const stepCopy = useMemo(() => {
		if (activeStep === 1) return 'Step 1 of 3 - Select one of your classes to begin.';
		if (activeStep === 2) return 'Step 2 of 3 - Choose where you want to move it.';
		return 'Step 3 of 3 - Review conflicts and submit your request.';
	}, [activeStep]);

	return (
		<div className='space-y-3'>
			<div>
				<h1 className='text-2xl font-semibold tracking-tight'>Room Change Requests</h1>
				<p className='text-sm text-muted-foreground'>{stepCopy}</p>
				<div className='mt-2 flex flex-wrap gap-1.5'>
					{STEP_LABELS.map((label, idx) => {
						const step = idx + 1;
						return (
							<span
								key={label}
								className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
									step === activeStep
										? 'border-primary bg-primary text-primary-foreground'
										: step < activeStep
											? 'border-primary/30 bg-primary/15 text-primary'
											: 'border-transparent bg-muted text-muted-foreground'
								}`}
							>
								{label}
							</span>
						);
					})}
				</div>
			</div>

			<div className='flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs sm:text-sm'>
				<span className='font-medium text-foreground'>{entriesCount} classes</span>
				{runGeneratedAt && (
					<>
						<span className='text-border/60'>•</span>
						<span className='text-muted-foreground'>As of {new Date(runGeneratedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
					</>
				)}
				{submittedCount > 0 && (
					<>
						<span className='text-border/60'>•</span>
						<span className='text-muted-foreground'>{submittedCount} pending</span>
					</>
				)}
				{draftCount > 0 && (
					<>
						<span className='text-border/60'>•</span>
						<span className='text-muted-foreground'>{draftCount} draft{draftCount !== 1 ? 's' : ''}</span>
					</>
				)}
				{gate?.blocked && (
					<Badge variant='warning' className='ml-auto'>
						Update paused - {gate.openCount} open
					</Badge>
				)}
				{dirtyCount > 0 && <Badge variant='warning'>{dirtyCount} unsaved</Badge>}
			</div>

			<div className='rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900'>
				<div className='flex items-center justify-between gap-2'>
					<p className='font-medium'>Review schedule active - submit your request and wait for scheduler decision.</p>
					<Button
						type='button'
						variant='ghost'
						size='sm'
						className='h-6 px-2 text-[11px]'
						onClick={() => setAdvisoryExpanded((current) => !current)}
					>
						{advisoryExpanded ? 'Hide' : 'Learn more'}
					</Button>
				</div>
				{advisoryExpanded && (
					<div className='mt-1.5 space-y-1'>
						<p>What happened: You are editing requests on a review schedule.</p>
						<p>What to do now: Submit your room request and wait for the scheduler decision.</p>
						<p>Who to contact: Your scheduling officer if this page does not update after reconnecting.</p>
					</div>
				)}
			</div>
		</div>
	);
}
