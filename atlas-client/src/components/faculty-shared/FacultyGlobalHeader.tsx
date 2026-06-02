import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, Wifi, WifiOff } from 'lucide-react';

import { Button } from '@/ui/button';

type SyncState = 'idle' | 'queued-offline' | 'syncing' | 'queued' | 'failed' | 'synced';

type Step = {
	id: number;
	label: string;
};

type Advisory = {
	title: string;
	variant?: 'info' | 'warning' | 'success' | 'destructive';
	message?: string;
};

type FacultyGlobalHeaderProps = {
	title: string;
	subtitle?: string;
	eyebrow?: string;
	steps?: Step[];
	activeStep?: number;
	online: boolean;
	syncState: SyncState;
	advisory?: Advisory;
	onRetryFailed?: () => void;
	rightSlot?: ReactNode;
	belowSlot?: ReactNode;
	children?: ReactNode;
	// Back-compat optional props (accepted but not surfaced as visual chrome anymore)
	realtimeConnected?: boolean;
	queuedCount?: number;
	failedCount?: number;
	lastSyncedAt?: string | null;
	liveViewers?: number;
};

function useIsMobile() {
	const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches);
	useEffect(() => {
		const media = window.matchMedia('(max-width: 1023px)');
		const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
		media.addEventListener('change', handler);
		return () => media.removeEventListener('change', handler);
	}, []);
	return isMobile;
}

function advisoryTone(variant: Advisory['variant']) {
	switch (variant) {
		case 'warning':
			return { wrap: 'border-amber-200 bg-amber-50 text-amber-900', Icon: AlertTriangle };
		case 'destructive':
			return { wrap: 'border-red-200 bg-red-50 text-red-900', Icon: AlertTriangle };
		case 'success':
			return { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-900', Icon: CheckCircle2 };
		case 'info':
		default:
			return { wrap: 'border-sky-200 bg-sky-50 text-sky-900', Icon: Info };
	}
}

function StatusPill({ online, syncState, onRetryFailed }: { online: boolean; syncState: SyncState; onRetryFailed?: () => void }) {
	if (syncState === 'failed') {
		return (
			<Button
				type='button'
				onClick={onRetryFailed}
				variant='outline'
				size='sm'
				className='h-7 rounded-full border-amber-300 bg-amber-100/80 px-2.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-200'
			>
				<RefreshCw className='size-3' /> Retry sync
			</Button>
		);
	}
	const label = !online ? 'Offline' : syncState === 'syncing' ? 'Syncing' : 'Online';
	const Icon = online ? Wifi : WifiOff;
	const tone = online
		? 'border-emerald-200 bg-emerald-50 text-emerald-700'
		: 'border-amber-200 bg-amber-50 text-amber-800';
	return (
		<span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}>
			<Icon className='size-3' />
			{label}
		</span>
	);
}

function StepBar({ steps, activeStep }: { steps: Step[]; activeStep?: number }) {
	return (
		<ol className='flex items-center gap-2'>
			{steps.map((step, index) => {
				const done = activeStep !== undefined && step.id < activeStep;
				const active = step.id === activeStep;
				return (
					<li key={step.id} className='flex items-center gap-2'>
						{index > 0 && <span className='h-px w-3 bg-border sm:w-5' aria-hidden='true' />}
						<span
							className={[
								'flex size-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
								active
									? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20'
									: done
										? 'bg-primary/15 text-primary'
										: 'bg-muted text-muted-foreground',
							].join(' ')}
						>
							{step.id}
						</span>
						<span className={`text-xs font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label.replace(/^\d+\s*/, '')}</span>
					</li>
				);
			})}
		</ol>
	);
}

export default function FacultyGlobalHeader({
	title,
	subtitle,
	eyebrow,
	steps,
	activeStep,
	online,
	syncState,
	advisory,
	onRetryFailed,
	rightSlot,
	belowSlot,
	children,
}: FacultyGlobalHeaderProps) {
	const isMobile = useIsMobile();
	const reduceMotion = useReducedMotion();

	if (isMobile) {
		return (
			<header className='shrink-0 border-b border-border/60 bg-card'>
				<div className='px-4 pt-4 pb-3'>
					{eyebrow && <p className='text-[11px] font-semibold uppercase tracking-wider text-primary/80'>{eyebrow}</p>}
					<div className='mt-0.5 flex items-start justify-between gap-3'>
						<h1 className='text-[22px] font-bold leading-tight tracking-tight text-foreground'>{title}</h1>
						<StatusPill online={online} syncState={syncState} onRetryFailed={onRetryFailed} />
					</div>
					{subtitle && <p className='mt-1.5 text-[13px] leading-snug text-muted-foreground'>{subtitle}</p>}
					{steps && steps.length > 0 && (
						<div className='mt-3 -mx-1 overflow-x-auto px-1'>
							<StepBar steps={steps} activeStep={activeStep} />
						</div>
					)}
					{rightSlot && <div className='mt-3'>{rightSlot}</div>}
					{children && <div className='mt-3'>{children}</div>}
				</div>
				{advisory && (
					<motion.div
						initial={reduceMotion ? false : { opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
						className={`flex items-start gap-2 border-t px-4 py-2.5 text-xs ${advisoryTone(advisory.variant).wrap}`}
					>
						{(() => {
							const Icon = advisoryTone(advisory.variant).Icon;
							return <Icon className='mt-0.5 size-3.5 shrink-0' />;
						})()}
						<div className='min-w-0 flex-1'>
							<p className='font-semibold leading-tight'>{advisory.title}</p>
							{advisory.message && <p className='mt-0.5 leading-snug opacity-90'>{advisory.message}</p>}
						</div>
					</motion.div>
				)}
				{belowSlot && <div className='border-t border-border/60 bg-muted/30 px-4 py-2'>{belowSlot}</div>}
			</header>
		);
	}

	// Desktop
	return (
		<header className='shrink-0 border-b border-border/60 bg-card'>
			<div className='mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 pt-5 pb-4'>
				<div className='flex items-end justify-between gap-6'>
					<div className='min-w-0'>
						{eyebrow && <p className='text-[11px] font-semibold uppercase tracking-wider text-primary/80'>{eyebrow}</p>}
						<h1 className='mt-0.5 text-2xl font-bold tracking-tight text-foreground'>{title}</h1>
						{subtitle && <p className='mt-1 text-sm text-muted-foreground'>{subtitle}</p>}
					</div>
					<div className='flex shrink-0 items-center gap-2'>
						{rightSlot}
						<StatusPill online={online} syncState={syncState} onRetryFailed={onRetryFailed} />
					</div>
				</div>
				{steps && steps.length > 0 && (
					<div className='flex items-center gap-4'>
						<StepBar steps={steps} activeStep={activeStep} />
					</div>
				)}
				{children && <div>{children}</div>}
				{belowSlot && <div>{belowSlot}</div>}
			</div>
			{advisory && (
				<div className={`border-t ${advisoryTone(advisory.variant).wrap}`}>
					<div className='mx-auto flex w-full max-w-7xl items-start gap-2 px-6 py-2.5 text-xs'>
						{(() => {
							const Icon = advisoryTone(advisory.variant).Icon;
							return <Icon className='mt-0.5 size-3.5 shrink-0' />;
						})()}
						<div className='min-w-0 flex-1'>
							<span className='font-semibold'>{advisory.title}</span>
							{advisory.message && <span className='ml-2 opacity-90'>{advisory.message}</span>}
						</div>
						{onRetryFailed && syncState === 'failed' && (
							<Button size='sm' variant='outline' className='h-7 rounded-full px-3 text-[11px]' onClick={onRetryFailed}>
								<RefreshCw className='mr-1 size-3' /> Retry
							</Button>
						)}
					</div>
				</div>
			)}
		</header>
	);
}
